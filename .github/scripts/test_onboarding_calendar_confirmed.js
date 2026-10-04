'use strict';

// Real checklist and onboarding action -> real confirmed calendar module.
// A shared remote Map separates atomic commit from acknowledgement and local UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-refill.js'), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function section(text, from, to) {
  const start = text.indexOf(from), end = text.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, 'bounded production block: ' + from);
  return text.slice(start, end);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function element(id) {
  const attrs = new Map(), classes = new Set();
  return {
    id, innerHTML: '', textContent: '', hidden: false, disabled: false, style: {}, dataset: {},
    classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
    getAttribute: name => attrs.get(name) ?? null,
    setAttribute: (name, value) => attrs.set(name, String(value)),
    removeAttribute: name => attrs.delete(name),
    querySelectorAll: () => [], querySelector: () => null
  };
}

function fixture(options = {}) {
  const effects = { calendar: [], legacy: [], persist: [], notify: [], checklist: [], dashboard: [], clients: [], close: [], open: [], queries: [], transactions: [] };
  const records = new Map(), committed = [], modes = [], reads = [], hooks = {};
  let serial = Promise.resolve(), clock = Date.parse('2026-09-28T09:00:00.000Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const clients = [
    { id: 'c1', trainerId: 'trainer-a', name: 'Klient A', status: 'active', preferredWeekdays: [1, 3], preferredTrainTime: 'Rano' },
    { id: 'c2', trainerId: 'trainer-a', name: 'Klient B', status: 'active', preferredWeekdays: [2, 4] },
    { id: 'foreign', trainerId: 'trainer-b', name: 'Cudzy klient', status: 'active' }
  ];
  const plan = {
    id: 'p1', trainerId: 'trainer-a', clientId: 'c1', name: 'Plan A', duration: '8', status: 'active', createdAt: '2026-09-01T09:00:00Z',
    days: [
      { day: 'PON', muscles: 'Nogi', exercises: [{ name: 'Przysiad', sets: 3 }], rest: false },
      { day: 'WT', rest: true, exercises: [] },
      { day: 'SR', muscles: 'Plecy', exercises: [{ name: 'Wiosłowanie', sets: 3 }], rest: false }
    ]
  };
  clients.forEach(c => records.set('clients/' + c.id, clone(c)));
  records.set('plans/p1', clone(plan));
  const nodes = Object.fromEntries(['m-client-onboard', 'client-onboard-steps', 'client-onboard-intro', 'client-onboard-progress'].map(id => [id, element(id)]));
  nodes['m-client-onboard'].classList.add('show');
  let renderedElements = [], renderedHTML = '';
  Object.defineProperty(nodes['client-onboard-steps'], 'innerHTML', {
    get: () => renderedHTML,
    set: html => {
      renderedHTML = String(html); renderedElements = [];
      const tags = /<(button|div|span)\b([^>]*\bdata-onboard-calendar-(?:client|status)=[^>]*)>([\s\S]*?)<\/\1>/g;
      let tag;
      while ((tag = tags.exec(renderedHTML))) {
        const node = element('');
        for (const attr of tag[2].matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(attr[1], attr[2]);
        node.textContent = tag[3].replace(/<[^>]+>/g, '');
        node.disabled = /\bdisabled(?:\s|=|$)/.test(tag[2]);
        node.hidden = /\bhidden(?:\s|=|$)/.test(tag[2]);
        renderedElements.push(node);
      }
    }
  });
  function selectNodes(selector) {
    const match = /^\[([\w-]+)(?:=["']([^"']*)["'])?\]$/.exec(selector);
    return match ? renderedElements.filter(node => node.getAttribute(match[1]) !== null && (match[2] === undefined || node.getAttribute(match[1]) === match[2])) : [];
  }
  const document = {
    getElementById: id => nodes[id] || null,
    querySelectorAll: selectNodes, querySelector: selector => selectNodes(selector)[0] || null
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date: Clock, Promise, Map, Set, document,
    _uid: 'trainer-a', _db: {}, tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false, _onboardClientId: 'c1',
    CL: clone(clients), PL: [clone(plan)], SE: [], PACKAGES: [],
    escHtml: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: s => !!s && s.uid === ctx._uid && s.generation === ctx.tenantSessionGeneration,
    clientAccessMode: client => client.accessMode || 'standard',
    clientPackageExpired: (pkg, today) => pkg.status === 'expired' || !!(pkg.expiresDate && pkg.expiresDate < today),
    isLoggedWorkout: session => ['live', 'client', 'sala'].includes(session.source),
    notify: message => effects.notify.push(String(message)),
    confirm: message => { effects.notify.push('CONFIRM: ' + message); return options.confirm !== false; },
    renderDash: () => effects.dashboard.push(ctx._onboardClientId),
    renderClients: () => effects.clients.push(ctx._onboardClientId),
    openM: id => { nodes[id]?.classList.add('show'); effects.open.push(id); },
    closeM: id => { nodes[id]?.classList.remove('show'); effects.close.push(id); },
    persistById: (...args) => { effects.persist.push(clone(args)); throw new Error('onboarding calendar must not mutate client flags'); },
    maybeSchedulePlanToCalendar: (...args) => { effects.legacy.push(clone(args)); throw new Error('legacy maybeSchedule must never run'); },
    schedulePlanToCalendar: (...args) => { effects.legacy.push(clone(args)); throw new Error('legacy destructive scheduler must never run'); },
    _doc: (db, collection, id) => ({ collection, id, path: collection + '/' + id }),
    _col: (db, collection) => ({ collection }),
    _where: (field, op, value) => ({ field, op, value }),
    _query: (collection, ...clauses) => ({ ...collection, clauses })
  };
  ctx.window = ctx;
  ctx._get = async query => {
    effects.queries.push(clone(query));
    if (hooks.query) await hooks.query(query);
    const docs = [...records.entries()].filter(([key, value]) => key.startsWith(query.collection + '/') && query.clauses.every(c => {
      assert.equal(c.op, '=='); return value[c.field] === c.value;
    })).map(([key, data]) => ({ id: key.slice(query.collection.length + 1), data: () => clone(data) }));
    return { forEach: callback => docs.forEach(callback) };
  };
  ctx._runTransaction = (db, callback) => {
    const mode = modes.shift() || {};
    const task = async () => {
      const writes = [], txReads = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'all reads precede writes');
          reads.push(ref.path); txReads.push(ref.path);
          const data = clone(records.get(ref.path));
          return { id: ref.id, exists: () => data !== undefined, data: () => clone(data) };
        },
        set: (ref, data, config = {}) => writes.push({ path: ref.path, data: clone(data), config })
      };
      if (hooks.beforeTransaction) await hooks.beforeTransaction();
      const result = await callback(tx);
      effects.transactions.push({ reads: txReads, writes: writes.map(w => w.path) });
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.rejectBefore) throw new Error('Unconfirmed calendar: before commit');
      for (const write of writes) {
        records.set(write.path, write.config.merge ? { ...records.get(write.path), ...write.data } : write.data);
        committed.push(clone(write));
      }
      if (mode.rejectAfter) throw new Error('Unconfirmed calendar: lost acknowledgement');
      return result;
    };
    const result = serial.then(task); serial = result.catch(() => {}); return result;
  };
  vm.createContext(ctx);
  // The real checklist now shares confirmation state with invitation/package skips.
  // Load its actual read/render dependencies so this calendar fixture matches the app.
  vm.runInContext(section(coreSource, 'function assignmentSession()', 'function assertAssignmentSession('), ctx);
  vm.runInContext(section(source, 'const onboardSkipStates', 'function clientNextStartStep'), ctx);
  vm.runInContext(section(source, 'function getClientOnboard', 'function maybeResumeOnboard'), ctx);
  vm.runInContext(section(source, 'function openClientOnboardChecklist', 'function enrollClientInOnboardForum'), ctx);
  vm.runInContext(section(source, 'function latestClientPlan', 'function openClientBaselineModal'), ctx);
  vm.runInContext(section(source, 'function planDayLabelToWeekday', 'function dropPlannedSessionsFrom'), ctx);
  vm.runInContext(calendarSource, ctx);
  const realCalendar = ctx.refillCalendarConfirmed;
  ctx.refillCalendarConfirmed = (...args) => { effects.calendar.push(clone(args)); return realCalendar(...args); };
  const realRender = ctx.renderClientOnboardChecklist;
  ctx.renderClientOnboardChecklist = (...args) => { effects.checklist.push({ id: ctx._onboardClientId, sessionCount: ctx.SE.length }); return realRender(...args); };
  function gate() { const g = { entered: deferred(), release: deferred() }; modes.push({ gate: g }); return g; }
  function addPlan(value) { ctx.PL.push(clone(value)); records.set('plans/' + (value._fbId || value.id), clone(value)); }
  function addSession(value) { ctx.SE.push(clone(value)); records.set('sessions/' + (value._fbId || value.id), clone(value)); }
  function clearEffects() { for (const key of Object.keys(effects)) effects[key].length = 0; }
  ctx.openClientOnboardChecklist('c1'); clearEffects();
  return { ctx, nodes, effects, records, committed, modes, reads, hooks, gate, addPlan, addSession, clearEffects, realCalendar,
    advance: ms => { clock += ms; },
    sessions: () => [...records.entries()].filter(([key]) => key.startsWith('sessions/')),
    elements: selectNodes,
    html: () => nodes['client-onboard-steps'].innerHTML
  };
}


const tests = [];
const test = (name, run) => tests.push({ name, run });
function assertNoLegacy(f) {
  assert.equal(f.effects.legacy.length, 0, 'neither legacy scheduler is a fallback');
  assert.equal(f.effects.persist.length, 0, 'onboarding completion comes from confirmed sessions, never a client flag');
  assert.ok(f.committed.every(w => w.path.startsWith('sessions/')), 'only sessions are written');
}
function assertNoRefresh(f) {
  assert.equal(f.effects.dashboard.length, 0, 'dashboard cannot claim an unconfirmed/stale completion');
  assert.equal(f.effects.clients.length, 0, 'client list cannot claim an unconfirmed/stale completion');
}
function assertSaved(f, count = 8, planId = 'p1') {
  assert.equal(f.sessions().length, count);
  for (const [, entry] of f.sessions()) {
    assert.equal(entry.trainerId, 'trainer-a'); assert.equal(entry.clientId, 'c1');
    assert.equal(entry.planId, planId); assert.equal(entry.source, 'planned');
  }
  assertNoLegacy(f);
}
function scopeResult(result) { return result && result.status; }
function calendarButtons(f) {
  return (f.html().match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [])
    .filter(html => /scheduleClientPlanToCalendar\(/.test(html));
}

test('calendar CTA creates four weeks only after remote acknowledgement', async () => {
  const f = fixture(), before = clone(f.ctx.CL), wait = f.gate();
  const saving = f.ctx.scheduleClientPlanToCalendar('c1');
  await wait.entered.promise;
  assert.equal(f.ctx.SE.length, 0); assert.equal(f.sessions().length, 0);
  assert.equal(f.ctx.getClientOnboard(f.ctx.CL[0]).calendar, false);
  assert.deepEqual(clone(f.ctx.CL), before);
  assertNoRefresh(f); assertNoLegacy(f);
  wait.release.resolve();
  assert.equal(scopeResult(await saving), 'saved');
  assertSaved(f);
  assert.equal(f.ctx.SE.length, 8);
  assert.equal(f.ctx.getClientOnboard(f.ctx.CL[0]).calendar, true);
  assert.deepEqual(clone(f.ctx.CL), before);
  assert.deepEqual(f.effects.calendar, [['c1', { weeks: 4, planId: 'p1' }]]);
});

test('failed calendar write preserves client and sessions and offers exact retry', async () => {
  const f = fixture(), before = clone(f.ctx.CL);
  f.modes.push({ rejectBefore: true });
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'error');
  assert.equal(f.ctx.SE.length, 0); assert.equal(f.sessions().length, 0);
  assert.deepEqual(clone(f.ctx.CL), before);
  assertNoRefresh(f); assertNoLegacy(f);
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'saved');
  assertSaved(f);
  assert.equal(f.committed.length, 8);
  assert.equal(f.effects.calendar.length, 2);
  assert.equal(f.effects.calendar[1][1].planId, 'p1');
});

test('lost acknowledgement confirms existing dates without duplicating or replacing a moved session', async () => {
  const f = fixture(); f.modes.push({ rejectAfter: true });
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'error');
  assert.equal(f.ctx.SE.length, 0); assert.equal(f.sessions().length, 8);
  const first = f.sessions()[0][1]; first.date = '2026-11-20'; first.time = '17:45'; first.notes = 'Trener przełożył termin';
  const remote = clone(f.sessions()); f.advance(2 * 86400000);
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'unchanged');
  assert.deepEqual(f.sessions(), remote);
  assert.equal(f.committed.length, 8);
  assert.equal(f.ctx.SE.find(s => s.id === first.id).time, '17:45');
  assertNoLegacy(f);
});

test('both clicks share a pending operation and cannot duplicate the remote queue', async () => {
  const f = fixture(), wait = f.gate();
  const first = f.ctx.scheduleClientPlanToCalendar('c1'); await wait.entered.promise;
  const second = f.ctx.scheduleClientPlanToCalendar('c1');
  assert.equal(second, first, 'non-async wrapper returns the active promise');
  assert.equal(f.effects.calendar.length, 1);
  assert.equal(f.effects.transactions.length, 1);
  wait.release.resolve(); await first;
  assertSaved(f); assert.equal(f.committed.length, 8);
});

test('latest eligible assigned plan is selected, ignoring newer foreign and inactive plans', async () => {
  const f = fixture(), base = clone(f.ctx.PL[0]);
  f.addPlan({ ...base, id: 'valid-latest', updatedAt: '2026-09-20T09:00:00Z' });
  f.addPlan({ ...base, id: 'foreign-newer', trainerId: 'trainer-b', updatedAt: '2099-09-30' });
  f.addPlan({ ...base, id: 'archived-newer', status: 'archived', updatedAt: '2099-09-30' });
  f.addPlan({ ...base, id: 'deleted-newer', deleted: true, updatedAt: '2099-09-30' });
  f.addPlan({ ...base, id: 'wrong-client', clientId: 'c2', updatedAt: '2099-09-30' });
  f.addPlan({ ...base, id: 'rest-newer', days: [{ day: 'PON', rest: true, exercises: [] }], updatedAt: '2099-09-30' });
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'saved');
  assertSaved(f, 8, 'valid-latest');
  assert.equal(f.effects.calendar[0][1].planId, 'valid-latest');
});

test('retry keeps original plan when a newer plan appears during the failed attempt', async () => {
  const f = fixture(); f.modes.push({ rejectBefore: true });
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'error');
  f.addPlan({ ...clone(f.ctx.PL[0]), id: 'new-plan', updatedAt: '2099-10-01' });
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'saved');
  assert.deepEqual(f.effects.calendar.map(call => call[1].planId), ['p1', 'p1']);
  assertSaved(f);
});

for (const invalid of ['missing-client', 'foreign-client', 'archived-client', 'no-plan', 'foreign-plan', 'archived-plan', 'rest-only', 'signed-out', 'client-mode', 'preview-mode', 'loading']) {
  test(invalid + ' cannot create sessions or use legacy fallback', async () => {
    const f = fixture(); let cid = 'c1';
    if (invalid === 'missing-client') cid = 'missing';
    if (invalid === 'foreign-client') cid = 'foreign';
    if (invalid === 'archived-client') f.ctx.CL[0].status = 'archived';
    if (invalid === 'no-plan') f.ctx.PL = [];
    if (invalid === 'foreign-plan') f.ctx.PL[0].trainerId = 'trainer-b';
    if (invalid === 'archived-plan') f.ctx.PL[0].archived = true;
    if (invalid === 'rest-only') f.ctx.PL[0].days.forEach(d => { d.rest = true; });
    if (invalid === 'signed-out') f.ctx._uid = null;
    if (invalid === 'client-mode') f.ctx._clientAppMode = true;
    if (invalid === 'preview-mode') f.ctx._clientPreviewMode = true;
    if (invalid === 'loading') f.ctx._tenantDataReady = false;
    const before = clone(f.ctx.CL);
    assert.notEqual(scopeResult(await f.ctx.scheduleClientPlanToCalendar(cid)), 'saved');
    assert.equal(f.committed.length, 0); assert.equal(f.ctx.SE.length, 0);
    assert.deepEqual(clone(f.ctx.CL), before); assertNoLegacy(f); assertNoRefresh(f);
  });
}

for (const change of ['uid', 'generation']) {
  test('stale ' + change + ' after calendar commit cannot update the next account', async () => {
    const f = fixture(), wait = f.gate();
    const saving = f.ctx.scheduleClientPlanToCalendar('c1'); await wait.entered.promise;
    if (change === 'uid') f.ctx._uid = 'trainer-b'; else f.ctx.tenantSessionGeneration++;
    f.ctx.SE = [{ id: 'new-session-record', trainerId: f.ctx._uid }];
    f.ctx._onboardClientId = 'c2'; f.ctx.renderClientOnboardChecklist(); f.clearEffects();
    const html = f.html();
    wait.release.resolve(); await saving;
    assert.deepEqual(clone(f.ctx.SE), [{ id: 'new-session-record', trainerId: f.ctx._uid }]);
    assert.equal(f.html(), html); assert.equal(f.effects.checklist.length, 0);
    assertNoRefresh(f); assertNoLegacy(f);
  });
}

test('changing checklist client while saving does not rerender the other client', async () => {
  const f = fixture(), wait = f.gate();
  const saving = f.ctx.scheduleClientPlanToCalendar('c1'); await wait.entered.promise;
  f.ctx.openClientOnboardChecklist('c2'); f.clearEffects(); const html = f.html();
  wait.release.resolve(); await saving;
  assert.equal(f.ctx._onboardClientId, 'c2'); assert.equal(f.html(), html);
  assert.equal(f.effects.checklist.length, 0); assertNoRefresh(f); assertNoLegacy(f);
});

test('closed checklist stays closed after late acknowledgement', async () => {
  const f = fixture(), wait = f.gate();
  const saving = f.ctx.scheduleClientPlanToCalendar('c1'); await wait.entered.promise;
  f.ctx.closeM('m-client-onboard'); f.clearEffects();
  wait.release.resolve(); await saving;
  assert.equal(f.nodes['m-client-onboard'].classList.contains('show'), false);
  assert.equal(f.effects.open.length, 0); assert.equal(f.effects.checklist.length, 0);
  assertNoRefresh(f); assertNoLegacy(f);
});

test('same-client checklist reopened before acknowledgement unlocks after confirmation', async () => {
  const f = fixture(), wait = f.gate();
  const saving = f.ctx.scheduleClientPlanToCalendar('c1'); await wait.entered.promise;
  f.ctx.closeM('m-client-onboard');
  f.ctx.openClientOnboardChecklist('c1');
  assert.equal(f.nodes['m-client-onboard'].classList.contains('show'), true);
  assert.equal(f.elements('[data-onboard-calendar-client="c1"]').some(node => node.disabled), true, 'reopened checklist remains pending');
  assert.match(f.html(), /data-onboard-calendar-label="Dodaj terminy na 4 tygodnie"/, 'reopen cannot claim calendar completion before acknowledgement');
  wait.release.resolve();
  assert.equal(scopeResult(await saving), 'saved');
  assert.equal(f.nodes['m-client-onboard'].classList.contains('show'), true);
  assert.equal(/GOTOWE/.test(f.html()), true, 'confirmed completion refreshes the reopened checklist');
  assert.equal(f.elements('[data-onboard-calendar-client="c1"]').some(node => node.disabled), false, 'confirmed action is unlocked');
  assert.equal(f.effects.checklist.length > 0, true);
  assertNoLegacy(f);
});

test('missing confirmed module yields an error with no destructive fallback', async () => {
  const f = fixture(); f.ctx.refillCalendarConfirmed = undefined;
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'error');
  assert.equal(f.committed.length, 0); assert.equal(f.ctx.SE.length, 0);
  assertNoLegacy(f); assertNoRefresh(f);
});

test('remote plan conflict fails safely even if local onboarding considers it valid', async () => {
  const f = fixture(); f.records.get('plans/p1').trainerId = 'trainer-b';
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'error');
  assert.equal(f.committed.length, 0); assert.equal(f.ctx.SE.length, 0);
  assertNoLegacy(f); assertNoRefresh(f);
});

test('existing planned and logged appointments remain intact when calendar is already complete', async () => {
  const f = fixture();
  await f.ctx.scheduleClientPlanToCalendar('c1');
  const before = clone(f.sessions()), writeCount = f.committed.length;
  f.clearEffects();
  assert.equal(scopeResult(await f.ctx.scheduleClientPlanToCalendar('c1')), 'unchanged');
  assert.deepEqual(f.sessions(), before); assert.equal(f.committed.length, writeCount);
  assertNoLegacy(f);
});

async function run() {
  let failed = 0;
  for (const entry of tests) {
    try { await entry.run(); console.log('PASS ' + entry.name); }
    catch (error) { failed++; console.error('FAIL ' + entry.name); console.error(error.stack || error); }
  }
  if (failed) throw new Error(failed + '/' + tests.length + ' onboarding/calendar scenarios failed');
  console.log(tests.length + '/' + tests.length + ' onboarding/calendar integration scenarios passed');
  return { passed: tests.length, failed: 0 };
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
