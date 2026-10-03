'use strict';

// Exercise the production refill module, separating transaction commit from ACK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const moduleSource = fs.readFileSync(path.join(root, 'calendar-refill.js'), 'utf8');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function ymd(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
function addDays(date, count) {
  const value = new Date(date + 'T12:00:00'); value.setDate(value.getDate() + count); return ymd(value);
}
function el(dataset) {
  const attrs = new Map(), classes = new Set();
  return {
    dataset: { ...dataset }, disabled: false, hidden: false, textContent: '', innerHTML: '', style: {},
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle: (c, yes) => yes ? classes.add(c) : classes.delete(c) },
    setAttribute(key, value) { attrs.set(key, String(value)); },
    getAttribute(key) { const prop = key.startsWith('data-') ? key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()) : ''; return attrs.get(key) ?? (prop ? this.dataset[prop] : null) ?? null; },
    removeAttribute(key) { attrs.delete(key); }, querySelectorAll() { return []; }
  };
}
function snapshot(ref, data) {
  const value = clone(data);
  return { id: ref.id, ref, exists: () => value !== undefined, data: () => clone(value) };
}
function fixture(opts = {}) {
  const owner = opts.owner || 'trainer-a';
  const clock = opts.clock || { now: new Date('2026-10-19T09:00:00').getTime() };
  const shared = opts.shared || { records: new Map(), transactionTail: Promise.resolve() };
  const calls = { queries: [], transactions: [], reads: [], writes: [], notices: [], renders: [] };
  const hooks = {};
  const client = { id: 'c1', trainerId: owner, name: 'Testowy klient', status: 'active', accessMode: 'standard', preferredWeekdays: [1, 3], preferredTrainTime: 'Rano (6-10)', ...(opts.client || {}) };
  const plan = {
    id: 'p1', trainerId: owner, clientId: client.id, name: 'Plan A', status: 'active',
    createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z',
    days: [
      { day: 'PON', weekday: 1, exercises: [{ name: 'Przysiad', sets: '3', reps: '8' }] },
      { day: 'WT', rest: true, exercises: [] },
      { day: 'ŚR', weekday: 3, muscles: 'Plecy', exercises: [{ name: 'Wiosłowanie', sets: '3', reps: '10' }] }
    ], ...(opts.plan || {})
  };
  if (!shared.records.has('clients/' + client.id)) shared.records.set('clients/' + client.id, clone(client));
  if (!shared.records.has('plans/' + plan.id)) shared.records.set('plans/' + plan.id, clone(plan));
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const button = el({ calendarRefillClient: client.id });
  const status = el({ calendarRefillStatus: client.id });
  const document = {
    querySelectorAll(selector) {
      if (selector.includes('data-calendar-refill-client')) return [button];
      if (selector.includes('data-calendar-refill-status')) return [status];
      return [];
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    getElementById() { return null; }, addEventListener() {}
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date: Clock, document,
    setTimeout, clearTimeout, Promise, Map, Set, JSON, Math, Number, String, Object, Array,
    encodeURIComponent, decodeURIComponent, parseInt, isFinite,
    _uid: owner, tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false, _db: {},
    CL: [clone(client)], PL: [clone(plan)], SE: clone(opts.sessions || []), PACKAGES: clone(opts.packages || []),
    notify: message => calls.notices.push(String(message)),
    renderCal: () => calls.renders.push('calendar'),
    renderDash: () => calls.renders.push('dashboard'),
    renderDashCalRefillFollowup: () => calls.renders.push('followup'),
    refreshDashOps: () => calls.renders.push('ops'),
    escHtml: value => String(value ?? ''),
    todayYmd: () => ymd(new Clock()), dateStr: ymd, ymdAdd: addDays,
    clientPlanForCalendar: cid => ctx.PL.find(p => p.clientId === cid && p.status !== 'archived'),
    normalizePreferredWeekdays: days => Array.isArray(days) ? days : [],
    resolvePlanDayWeekday: (day, index, preferred) => Number.isInteger(day.weekday) ? day.weekday : preferred[index],
    scheduleTimeFromClient: () => '08:00',
    clientAccessMode: c => c.accessMode === 'trial' || c.trialAccess ? 'trial' : c.accessMode === 'guest' || c.guestAccess || c.packageSkipped ? 'guest' : 'standard',
    clientPackageExpired: (p, today = ymd(new Clock())) => p.status === 'expired' || p.payStatus === 'expired' || !!(p.expiresDate && p.expiresDate.slice(0, 10) < today),
    isLoggedWorkout: s => !!s && ['live', 'client', 'sala'].includes(s.source),
    tenantSessionIsCurrent: auth => !!auth && auth.uid === ctx._uid && auth.generation === ctx.tenantSessionGeneration,
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    _doc: (_db, collection, id) => ({ collection, id, path: collection + '/' + id }),
    _col: (_db, collection) => ({ collection }),
    _where: (field, op, value) => ({ field, op, value }),
    _query: (collection, ...constraints) => ({ ...collection, constraints })
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._get = async query => {
    calls.queries.push(clone(query));
    if (hooks.beforeQuery) await hooks.beforeQuery(query);
    const docs = [];
    for (const [key, data] of shared.records) {
      if (!key.startsWith(query.collection + '/')) continue;
      if (!(query.constraints || []).every(c => c.op === '==' && data[c.field] === c.value)) continue;
      const id = key.slice(query.collection.length + 1);
      docs.push(snapshot({ collection: query.collection, id, path: key }, data));
    }
    const result = { docs, size: docs.length, empty: !docs.length, forEach: callback => docs.forEach(callback) };
    if (hooks.afterQuery) await hooks.afterQuery(query, result);
    return result;
  };
  ctx._runTransaction = (_db, callback) => {
    const call = { reads: [], writes: [] };
    calls.transactions.push(call);
    const work = shared.transactionTail.then(async () => {
      if (hooks.beforeTransaction) await hooks.beforeTransaction(call);
      const result = await callback({
        get: async ref => {
          assert.equal(call.writes.length, 0, 'all transaction reads precede writes');
          if (hooks.beforeRead) await hooks.beforeRead(ref);
          call.reads.push(ref.path); calls.reads.push(ref.path);
          return snapshot(ref, shared.records.get(ref.path));
        },
        set: (ref, data, options) => { call.writes.push({ ref: clone(ref), data: clone(data), options }); }
      });
      if (hooks.beforeCommit) await hooks.beforeCommit(call, result);
      for (const write of call.writes) {
        shared.records.set(write.ref.path, write.options?.merge ? { ...(shared.records.get(write.ref.path) || {}), ...clone(write.data) } : clone(write.data));
        calls.writes.push(clone(write));
      }
      if (hooks.afterCommit) await hooks.afterCommit(call, result);
      return result;
    });
    shared.transactionTail = work.catch(() => {});
    return work;
  };
  vm.createContext(ctx);
  vm.runInContext(moduleSource, ctx, { filename: 'calendar-refill.js' });
  assert.equal(typeof ctx.refillCalendarConfirmed, 'function');
  const result = {
    ctx, shared, calls, hooks, clock, client, plan, button, status,
    run: options => ctx.refillCalendarConfirmed(client.id, options || {}),
    id: (dayIdx, date) => 'calfill_' + encodeURIComponent(JSON.stringify([owner, client.id, plan.id, dayIdx, date])),
    sessions: () => [...shared.records.entries()].filter(([key]) => key.startsWith('sessions/')),
    remoteClient: () => shared.records.get('clients/' + client.id),
    remotePlan: () => shared.records.get('plans/' + plan.id),
    putSession(data) { shared.records.set('sessions/' + data.id, clone(data)); },
    putPackage(data) { shared.records.set('packages/' + data.id, clone(data)); },
    expected: []
  };
  for (let week = 0; week < 4; week++) {
    for (const [dayIdx, offset] of [[0, 0], [2, 2]]) {
      const date = addDays('2026-10-19', week * 7 + offset);
      result.expected.push({ id: result.id(dayIdx, date), trainerId: owner, clientId: client.id, planId: plan.id, dayIdx, date, source: 'planned' });
    }
  }
  return result;
}
function successful(result, count) {
  assert.ok(result && ['saved', 'unchanged'].includes(result.status), JSON.stringify(result));
  assert.equal(result.added, count);
}
function failed(result) { assert.equal(result?.status, 'error', JSON.stringify(result)); }
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('atomic save uses stable IDs, original day indices, and confirms before memory changes', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const pending = f.run();
  await entered.promise;
  assert.equal(f.sessions().length, 0);
  assert.equal(f.ctx.SE.length, 0);
  assert.equal(f.button.disabled, true); assert.match(f.status.textContent, /Sprawdzam/);
  assert.equal(f.calls.notices.some(x => /dodano|uzupełniono/i.test(x)), false);
  release.resolve();
  successful(await pending, 8);
  assert.deepEqual(f.sessions().map(([key]) => key).sort(), f.expected.map(x => 'sessions/' + x.id).sort());
  assert.equal(f.ctx.SE.length, 8);
  for (const [, session] of f.sessions()) {
    assert.equal(session.trainerId, 'trainer-a'); assert.equal(session.clientId, 'c1');
    assert.equal(session.time, '08:00'); assert.equal(session.duration, 60);
    assert.ok(session.dayIdx === 0 || session.dayIdx === 2);
  }
});

test('failed transaction retains an immutable candidate across retry and date changes', async () => {
  const f = fixture(); let first;
  f.hooks.beforeCommit = call => { first = clone(call.writes); throw new Error('Unavailable'); };
  failed(await f.run());
  assert.equal(f.sessions().length, 0); assert.equal(f.ctx.SE.length, 0);
  f.clock.now += 8 * 86400000;
  f.hooks.beforeCommit = null;
  successful(await f.run({ weeks: 12, time: '22:00' }), 8);
  assert.deepEqual(f.calls.writes.map(x => x.data), first.map(x => x.data));
});

test('lost acknowledgement retry confirms records without writing them again', async () => {
  const f = fixture(); f.hooks.afterCommit = () => { throw new Error('Lost acknowledgement'); };
  failed(await f.run());
  assert.equal(f.sessions().length, 8); assert.equal(f.ctx.SE.length, 0);
  f.hooks.afterCommit = null;
  successful(await f.run(), 0);
  assert.equal(f.calls.writes.length, 8);
  assert.equal(f.ctx.SE.length, 8);
});

test('a committed batch can be acknowledged after plan edits and session moves', async () => {
  const f = fixture(); f.hooks.afterCommit = () => { throw new Error('Lost acknowledgement'); };
  failed(await f.run());
  const [key, moved] = f.sessions()[0];
  moved.date = '2026-10-20'; moved.time = '20:30'; moved.notes = 'Ręczna zmiana'; moved.skipped = true;
  f.remotePlan().days[0].exercises[0].sets = '5';
  const before = clone([...f.shared.records]);
  f.hooks.afterCommit = null;
  successful(await f.run(), 0);
  assert.deepEqual([...f.shared.records], before);
  assert.equal(f.ctx.SE.find(s => s.id === moved.id).notes, 'Ręczna zmiana');
  assert.equal(f.calls.writes.length, 8);
  assert.equal(f.shared.records.get(key).date, '2026-10-20');
});

test('plan changed before a retry with missing sessions rejects the old candidate', async () => {
  const f = fixture();
  f.hooks.beforeCommit = () => { throw new Error('Unavailable'); };
  failed(await f.run());
  f.remotePlan().days[0].exercises[0].sets = '5';
  f.hooks.beforeCommit = null;
  failed(await f.run());
  assert.equal(f.sessions().length, 0); assert.equal(f.calls.writes.length, 0);
});

test('legacy planned/skipped and completed matching sessions are preserved', async () => {
  const f = fixture();
  const existing = [
    { ...f.expected[0], id: 'legacy-planned', time: '19:00', notes: 'Własna uwaga', skipped: true, status: 'opuszczony' },
    { ...f.expected[1], id: 'legacy-completed', source: 'client', status: 'done', exercises: [{ name: 'Wiosłowanie', sets: [1] }] }
  ];
  existing.forEach(s => f.putSession(s));
  successful(await f.run(), 6);
  existing.forEach(s => assert.deepEqual(f.shared.records.get('sessions/' + s.id), s));
  assert.equal(f.sessions().length, 8);
});

test('an existing stable occurrence moved to another date is not recreated', async () => {
  const f = fixture();
  const moved = { ...f.expected[0], date: '2026-10-20', time: '19:30', notes: 'Przeniesiony termin', skipped: true };
  f.putSession(moved);
  successful(await f.run(), 7);
  assert.deepEqual(f.shared.records.get('sessions/' + moved.id), moved);
  assert.equal(f.sessions().length, 8);
});

for (const change of ['trainerId', 'clientId', 'planId', 'dayIdx', 'source']) {
  test('stable ID collision with incompatible ' + change + ' rejects the complete batch', async () => {
    const f = fixture();
    const foreign = { ...f.expected[7], [change]: change === 'dayIdx' ? 99 : 'other' };
    f.putSession(foreign);
    const before = clone([...f.shared.records]);
    failed(await f.run());
    assert.deepEqual([...f.shared.records], before);
    assert.equal(f.calls.writes.length, 0); assert.equal(f.ctx.SE.length, 0);
  });
}

test('two tabs with initially empty snapshots create only one batch', async () => {
  const first = fixture(), second = fixture({ shared: first.shared });
  const results = await Promise.all([first.run(), second.run()]);
  assert.ok(results.every(x => ['saved', 'unchanged'].includes(x.status)));
  assert.equal(results.reduce((n, x) => n + x.added, 0), 8);
  assert.equal(first.sessions().length, 8);
  assert.equal(first.calls.writes.length + second.calls.writes.length, 8);
});

test('rapid repeated clicks share the pending batch', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run(); await entered.promise;
  const second = f.run({ weeks: 12 });
  release.resolve();
  await Promise.all([first, second]);
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.writes.length, 8);
});

test('all collection reads require both owner and client filters', async () => {
  const f = fixture(); successful(await f.run(), 8);
  assert.ok(f.calls.queries.some(q => q.collection === 'sessions'));
  assert.ok(f.calls.queries.some(q => q.collection === 'packages'));
  for (const q of f.calls.queries) {
    assert.ok(['sessions', 'packages'].includes(q.collection));
    assert.ok(q.constraints.some(x => x.field === 'trainerId' && x.op === '==' && x.value === 'trainer-a'));
    assert.ok(q.constraints.some(x => x.field === 'clientId' && x.op === '==' && x.value === 'c1'));
  }
});

for (const invalid of ['signed-out', 'client-mode', 'preview-mode', 'not-ready', 'foreign-client', 'foreign-plan', 'archived-client', 'archived-plan', 'missing-client', 'missing-plan']) {
  test(invalid + ' cannot create sessions', async () => {
    const f = fixture();
    if (invalid === 'signed-out') f.ctx._uid = null;
    if (invalid === 'client-mode') f.ctx._clientAppMode = true;
    if (invalid === 'preview-mode') f.ctx._clientPreviewMode = true;
    if (invalid === 'not-ready') f.ctx._tenantDataReady = false;
    if (invalid === 'foreign-client') f.remoteClient().trainerId = 'trainer-b';
    if (invalid === 'foreign-plan') f.remotePlan().trainerId = 'trainer-b';
    if (invalid === 'archived-client') f.remoteClient().status = 'archived';
    if (invalid === 'archived-plan') f.remotePlan().status = 'archived';
    if (invalid === 'missing-client') f.shared.records.delete('clients/c1');
    if (invalid === 'missing-plan') f.shared.records.delete('plans/p1');
    failed(await f.run());
    assert.equal(f.sessions().length, 0); assert.equal(f.calls.writes.length, 0);
  });
}

for (const field of ['_uid', 'tenantSessionGeneration']) {
  test('session change in ' + field + ' after commit prevents stale UI publication', async () => {
    const f = fixture(); const newer = [{ id: 'next-session', trainerId: 'trainer-b' }];
    f.hooks.afterCommit = () => { f.ctx[field] = field === '_uid' ? 'trainer-b' : 2; f.ctx.SE = newer; };
    await f.run();
    assert.equal(f.ctx.SE, newer); assert.equal(f.ctx.SE.length, 1);
    assert.equal(f.calls.notices.some(x => /dodano|uzupełniono/i.test(x)), false);
  });
}

for (const status of ['pending', 'expired']) {
  test('fresh package state ' + status + ' blocks despite stale locally paid package', async () => {
    const f = fixture({ packages: [{ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'paid' }] });
    f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: status === 'pending' ? 'pending' : 'paid', status: status === 'expired' ? 'expired' : 'active' });
    failed(await f.run());
    assert.equal(f.calls.writes.length, 0); assert.equal(f.sessions().length, 0);
  });
}

test('package changed after query is rechecked in the transaction', async () => {
  const f = fixture();
  f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'paid' });
  f.hooks.afterQuery = query => { if (query.collection === 'packages') f.shared.records.get('packages/pkg1').payStatus = 'pending'; };
  failed(await f.run());
  assert.ok(f.calls.reads.includes('packages/pkg1'));
  assert.equal(f.sessions().length, 0);
});

for (const mode of ['trial', 'guest']) {
  test('fresh ' + mode + ' access preserves the explicit package exception', async () => {
    const f = fixture({ client: { accessMode: mode } });
    f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'pending' });
    successful(await f.run(), 8);
  });
}

test('legacy owner documents without payload ID remain usable by document ID', async () => {
  const f = fixture(); delete f.remoteClient().id; delete f.remotePlan().id;
  successful(await f.run(), 8);
});


test('a failed scoped query cannot publish an empty successful result', async () => {
  const f = fixture();
  f.hooks.beforeQuery = () => { throw Object.assign(new Error('Denied'), { code: 'permission-denied' }); };
  failed(await f.run());
  assert.equal(f.calls.transactions.length, 0); assert.equal(f.ctx.SE.length, 0);
  assert.equal(f.sessions().length, 0);
  assert.equal(f.button.disabled, false); assert.match(f.button.textContent, /Ponów/);
});

test('session change during a query stops before any transaction', async () => {
  const f = fixture();
  f.hooks.afterQuery = () => { f.ctx.tenantSessionGeneration = 2; };
  failed(await f.run());
  assert.equal(f.calls.transactions.length, 0); assert.equal(f.calls.writes.length, 0);
});

test('session change while transaction reads are outstanding prevents every write', async () => {
  const f = fixture();
  f.hooks.beforeRead = ref => { if (ref.collection === 'clients') f.ctx.tenantSessionGeneration = 2; };
  failed(await f.run());
  assert.equal(f.calls.writes.length, 0); assert.equal(f.ctx.SE.length, 0);
});

test('a legacy appointment moved between query and transaction keeps its original reservation', async () => {
  const f = fixture();
  const legacy = { ...f.expected[0], id: 'legacy-move', time: '18:00', notes: 'Zachowaj' };
  f.putSession(legacy);
  f.hooks.afterQuery = query => {
    if (query.collection === 'sessions') {
      const remote = f.shared.records.get('sessions/legacy-move');
      remote.date = '2026-10-20'; remote.time = '19:30'; remote.notes = 'Przeniesiono ręcznie';
    }
  };
  successful(await f.run(), 7);
  assert.equal(f.shared.records.has('sessions/' + f.expected[0].id), false);
  assert.equal(f.shared.records.get('sessions/legacy-move').notes, 'Przeniesiono ręcznie');
  assert.equal(f.ctx.SE.find(s => s.id === 'legacy-move').date, '2026-10-20');
});

test('a stale local Trial flag cannot bypass freshly revoked access', async () => {
  const f = fixture({ client: { accessMode: 'trial' } });
  f.remoteClient().accessMode = 'standard';
  f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'pending' });
  failed(await f.run()); assert.equal(f.calls.writes.length, 0);
});

test('fresh Trial access is used even if local client data still says standard', async () => {
  const f = fixture();
  f.remoteClient().accessMode = 'trial';
  f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'pending' });
  successful(await f.run(), 8);
});

test('lost ACK may confirm an existing batch after access is revoked without creating more sessions', async () => {
  const f = fixture(); f.hooks.afterCommit = () => { throw new Error('Lost acknowledgement'); };
  failed(await f.run()); f.hooks.afterCommit = null;
  f.putPackage({ id: 'pkg1', clientId: 'c1', trainerId: 'trainer-a', payStatus: 'pending' });
  successful(await f.run(), 0);
  assert.equal(f.calls.writes.length, 8);
});

for (const options of [{ weeks: 0 }, { weeks: 13 }, { weeks: 1.5 }, { time: '25:01' }, { duration: -1 }]) {
  test('invalid refill options ' + JSON.stringify(options) + ' make no database requests', async () => {
    const f = fixture(); failed(await f.run(options));
    assert.equal(f.calls.queries.length, 0); assert.equal(f.calls.transactions.length, 0);
  });
}

test('a plan with duplicate weekdays fails rather than putting two automatic workouts on one day', async () => {
  const f = fixture(); f.ctx.PL[0].days[2].weekday = 1;
  failed(await f.run());
  assert.equal(f.calls.queries.length, 0); assert.equal(f.calls.writes.length, 0);
});

test('the maximum twelve-week refill stays in one bounded transaction', async () => {
  const f = fixture();
  successful(await f.run({ weeks: 12 }), 24);
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.writes.length, 24);
});

function addAlternativePlan(f, changes = {}) {
  const plan = { ...clone(f.plan), id: 'p2', name: 'Nowszy plan', updatedAt: '2026-10-18T12:00:00.000Z', ...changes };
  f.ctx.PL.push(clone(plan)); f.shared.records.set('plans/' + plan.id, clone(plan));
  return plan;
}

test('explicit plan uses exactly that plan even when a newer eligible plan exists', async () => {
  const f = fixture(); addAlternativePlan(f);
  successful(await f.run({ planId: 'p1' }), 8);
  assert.ok(f.sessions().every(([, session]) => session.planId === 'p1'));
  assert.ok(f.calls.reads.includes('plans/p1')); assert.equal(f.calls.reads.includes('plans/p2'), false);
});

test('manual refill without planId continues to choose the newest eligible plan', async () => {
  const f = fixture(); addAlternativePlan(f);
  successful(await f.run(), 8);
  assert.ok(f.sessions().every(([, session]) => session.planId === 'p2'));
});

for (const kind of ['absent', 'foreign-owner', 'other-client', 'archived', 'deleted', 'no-training', 'empty-id', 'null-id']) {
  test('explicit ' + kind + ' target never falls back to another eligible plan', async () => {
    const f = fixture();
    const patches = {
      'foreign-owner': { trainerId: 'trainer-b' }, 'other-client': { clientId: 'c2' },
      archived: { status: 'archived' }, deleted: { deleted: true }, 'no-training': { days: [] }
    };
    if (kind in patches) addAlternativePlan(f, patches[kind]);
    failed(await f.run({ planId: kind === 'empty-id' ? '' : kind === 'null-id' ? null : 'p2' }));
    assert.equal(f.calls.queries.length, 0); assert.equal(f.calls.transactions.length, 0);
    assert.equal(f.sessions().length, 0);
  });
}

test('explicit target is revalidated from the remote plan before writing', async () => {
  const f = fixture(); addAlternativePlan(f);
  f.remotePlan().trainerId = 'trainer-b';
  failed(await f.run({ planId: 'p1' }));
  assert.equal(f.calls.writes.length, 0);
  assert.equal(f.calls.reads.includes('plans/p2'), false);
});

test('pending manual operation rejects another explicit plan without disturbing its state', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run(); await entered.promise;
  addAlternativePlan(f);
  const message = f.status.textContent;
  const conflict = f.run({ planId: 'p2' });
  assert.notEqual(conflict, first); failed(await conflict);
  assert.equal(f.button.disabled, true); assert.equal(f.status.textContent, message);
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.notices.length, 0);
  release.resolve(); successful(await first, 8);
  assert.ok(f.sessions().every(([, record]) => record.planId === 'p1'));
});

test('matching explicit requests share their pending promise and confirm once', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  addAlternativePlan(f);
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run({ planId: 'p1', weeks: 4 }); await entered.promise;
  const second = f.run({ planId: 'p1', weeks: '4', duration: '60', time: '08:00' });
  assert.equal(second, first);
  release.resolve(); successful(await second, 8);
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.writes.length, 8);
});

for (const changed of [{ weeks: 8 }, { time: '19:00' }, { duration: 90 }]) {
  test('pending explicit request rejects different scope ' + JSON.stringify(changed), async () => {
    const f = fixture(), entered = deferred(), release = deferred();
    f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
    const first = f.run({ planId: 'p1', weeks: 4 }); await entered.promise;
    failed(await f.run({ planId: 'p1', ...changed }));
    assert.equal(f.calls.transactions.length, 1); assert.equal(f.button.disabled, true);
    release.resolve(); successful(await first, 8);
    assert.equal(f.calls.writes.length, 8);
  });
}

test('implicit defaults on explicit request cannot inherit another pending duration or range', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run({ weeks: 8 }); await entered.promise;
  failed(await f.run({ planId: 'p1' }));
  release.resolve(); successful(await first, 16);
});

test('pending explicit request rejects different effective weekdays', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.ctx.PL[0].days.forEach(day => delete day.weekday);
  f.shared.records.set('plans/p1', clone(f.ctx.PL[0]));
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run({ planId: 'p1', weekdays: [1, 3] }); await entered.promise;
  failed(await f.run({ planId: 'p1', weekdays: [2, 4] }));
  release.resolve(); successful(await first, 8);
  assert.equal(f.calls.transactions.length, 1);
});

test('failed exact-plan operation retries frozen records even after a newer plan appears', async () => {
  const f = fixture(); let firstWrites;
  f.hooks.beforeCommit = call => { firstWrites = clone(call.writes); throw new Error('Unavailable'); };
  failed(await f.run({ planId: 'p1', weeks: 4 }));
  addAlternativePlan(f); f.clock.now += 8 * 86400000;
  f.hooks.beforeCommit = null;
  successful(await f.run({ planId: 'p1', weeks: 4 }), 8);
  assert.deepEqual(f.calls.writes.map(x => x.data), firstWrites.map(x => x.data));
  assert.equal(f.calls.reads.includes('plans/p2'), false);
});

test('another explicit plan cannot consume a failed operation and manual retry preserves its payload', async () => {
  const f = fixture();
  f.hooks.beforeCommit = () => { throw new Error('Unavailable'); };
  failed(await f.run({ planId: 'p1' }));
  addAlternativePlan(f);
  const message = f.status.textContent, notices = f.calls.notices.length;
  failed(await f.run({ planId: 'p2' }));
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.status.textContent, message);
  assert.equal(f.calls.notices.length, notices); assert.equal(f.button.disabled, false);
  f.hooks.beforeCommit = null;
  successful(await f.run(), 8);
  assert.ok(f.sessions().every(([, record]) => record.planId === 'p1'));
});

test('failed operation does not swallow an explicit request with a new range', async () => {
  const f = fixture();
  f.hooks.beforeCommit = () => { throw new Error('Unavailable'); };
  failed(await f.run({ planId: 'p1', weeks: 4 }));
  failed(await f.run({ planId: 'p1', weeks: 8 }));
  assert.equal(f.calls.transactions.length, 1);
  f.hooks.beforeCommit = null;
  successful(await f.run({ planId: 'p1', weeks: 4 }), 8);
});

test('newly saved version of the same plan cannot receive the old pending success', async () => {
  const f = fixture(), entered = deferred(), release = deferred();
  f.hooks.beforeCommit = async () => { entered.resolve(); await release.promise; };
  const first = f.run({ planId: 'p1' }); await entered.promise;
  f.ctx.PL[0].days[0].exercises[0].sets = '5';
  failed(await f.run({ planId: 'p1' }));
  assert.equal(f.calls.transactions.length, 1);
  release.resolve(); successful(await first, 8);
});

test('lost ACK of old plan version requires manual confirmation before an explicit newer version', async () => {
  const f = fixture();
  f.hooks.afterCommit = () => { throw new Error('Lost acknowledgement'); };
  failed(await f.run({ planId: 'p1' }));
  f.ctx.PL[0].days[0].exercises[0].sets = '5';
  f.remotePlan().days[0].exercises[0].sets = '5';
  failed(await f.run({ planId: 'p1' }));
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.writes.length, 8);
  f.hooks.afterCommit = null;
  successful(await f.run(), 0);
  successful(await f.run({ planId: 'p1' }), 0);
  assert.equal(f.calls.writes.length, 8);
});

test('changed plan after a failed pre-commit attempt explicitly explains reload recovery', async () => {
  const f = fixture();
  f.hooks.beforeCommit = () => { throw new Error('Unavailable before commit'); };
  failed(await f.run({ planId: 'p1' }));
  f.ctx.PL[0].days[0].exercises[0].sets = '5';
  f.remotePlan().days[0].exercises[0].sets = '5';
  const conflict = await f.run({ planId: 'p1' });
  failed(conflict); assert.match(conflict.error, /odśwież aplikację/i);
  assert.match(conflict.error, /kontynuuj bez dopełnienia/i);
  assert.doesNotMatch(conflict.error, /ponów je w kalendarzu/i);
  assert.equal(f.calls.transactions.length, 1); assert.equal(f.calls.writes.length, 0);
  f.hooks.beforeCommit = null;
  failed(await f.run()); // Manual retry cannot apply an obsolete plan signature.
  assert.equal(f.calls.writes.length, 0);
});

for (const stage of ['query', 'transaction']) {
  test('coded ' + stage + ' failure returns the same Polish error shown by calendar UI', async () => {
    const f = fixture();
    const error = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
    if (stage === 'query') f.hooks.beforeQuery = () => { throw error; };
    else f.hooks.beforeCommit = () => { throw error; };
    const result = await f.run({ planId: 'p1' });
    failed(result); assert.equal(result.error, f.status.textContent);
    assert.match(result.error, /Nie udało się potwierdzić zapisu/);
    assert.doesNotMatch(result.error, /Missing|insufficient|permission-denied/);
    assert.equal(f.calls.writes.length, 0); assert.equal(f.ctx.SE.length, 0);
    f.hooks.beforeQuery = null; f.hooks.beforeCommit = null;
    successful(await f.run({ planId: 'p1' }), 8);
  });
}

async function run() {
  let passed = 0;
  for (const { name, fn } of tests) {
    let timer;
    try {
      await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scenario timed out')), 5000); })]);
      passed++; console.log('PASS ' + name);
    } catch (error) { error.message = name + ': ' + error.message; throw error; }
    finally { clearTimeout(timer); }
  }
  console.log(passed + '/' + tests.length + ' calendar refill scenarios passed');
  return { passed, total: tests.length };
}
module.exports = { run, fixture };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
