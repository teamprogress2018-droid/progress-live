'use strict';

// Run the production builder and transaction helpers against controlled DOM/data.
// Commit and acknowledgement are separate, so retries exercise stored documents.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function section(text, from, to) {
  const a = text.indexOf(from), b = text.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, 'production block: ' + from);
  return text.slice(a, b);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function element(value = '') {
  const attrs = new Map();
  const classes = new Set();
  return {
    value, checked: false, disabled: false, hidden: false, textContent: '', innerHTML: '',
    dataset: {}, style: {}, isConnected: true,
    classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, force) => { if (force) classes.add(c); else classes.delete(c); } },
    setAttribute(name, val) { attrs.set(name, String(val)); if (name === 'disabled') this.disabled = true; },
    getAttribute: name => attrs.get(name) ?? null,
    removeAttribute(name) { attrs.delete(name); if (name === 'disabled') this.disabled = false; },
    hasAttribute: name => attrs.has(name),
    querySelector: () => null, querySelectorAll: () => [], focus() {}, addEventListener() {}
  };
}

function fixture(options = {}) {
  const effects = { toast: [], leave: [], navigate: [], schedule: [], onboard: [], banner: [] };
  const store = new Map(), committed = [], reads = [], modes = [], timers = [];
  let transactions = 0, sequence = 0, clock = Date.parse('2026-09-27T12:00:00.000Z');
  let serial = Promise.resolve();
  const clients = [
    { id: 'client-a', trainerId: 'trainer-a', name: 'Klient A', level: 'sredni', goal: 'masa' },
    { id: 'client-b', trainerId: 'trainer-a', name: 'Klient B', level: 'pocz', goal: 'redukcja' },
    { id: 'client-foreign', trainerId: 'trainer-b', name: 'Cudzy klient' }
  ];
  clients.forEach(c => store.set('clients/' + c.id, clone(c)));
  const previous = options.edit ? {
    id: 'plan-a', trainerId: 'trainer-a', clientId: 'client-a', clientName: 'Klient A',
    name: 'Poprzedni plan', method: 'FBW', duration: '4', progression: 'off',
    days: [{ day: 'PON', rest: false, exercises: [{ name: 'Przysiad', sets: '3', reps: '8', kg: '50' }] }],
    createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-20T12:00:00.000Z',
    source: 'manual', customMetadata: { preserve: true }, ...(typeof options.edit === 'object' ? options.edit : {})
  } : null;
  if (previous) { const data = clone(previous); delete data._fbId; store.set('plans/' + (previous._fbId || previous.id), data); }
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  const nodes = Object.fromEntries(['b-name', 'b-client', 'b-method', 'b-duration', 'b-progression', 'builder-days', 'screen-builder', 'b-save-btn', 'builder-save-status'].map(id => [id, element()]));
  Object.entries(nodes).forEach(([id, node]) => { node.id = id; });
  const title = element();
  nodes['screen-builder'].classList.add('active');
  const rows = [];
  const days = [];
  function addDay() {
    const controls = { day: element('PON'), focus: element('Nogi'), rc: element(), circ: element(), roundRest: element('120s') };
    const day = element();
    day.querySelector = sel => ({ '.rc': controls.rc, '.circ': controls.circ, '[data-f="roundRest"]': controls.roundRest, '.builder-day-select': controls.day, '.builder-day-focus': controls.focus }[sel] || null);
    day.querySelectorAll = sel => sel === '.ex-row' ? rows : sel === '.builder-day-hdr select, .builder-day-hdr input[type=text]' ? [controls.day, controls.focus] : [];
    day.controls = controls;
    days.push(day);
    return day;
  }
  function addRow(name, kg) {
    const values = { name, sets: '4', reps: '8-10', kg, rpe: '8', rir: '2', rest: '120s', tempo: '3010', note: 'Pełny zakres', video: 'https://www.youtube.com/watch?v=example', alt: 'Wariant B' };
    const inputs = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, element(value)]));
    const row = element();
    row.inputs = inputs;
    row.querySelector = sel => { const match = sel.match(/^\[data-f="([^"]+)"\]$/); return match ? inputs[match[1]] || null : null; };
    rows.push(row);
    return row;
  }
  addDay(); addRow('Przysiad', '60'); addRow('Wykroki', '20');
  const fields = () => [...['b-name', 'b-client', 'b-method', 'b-duration', 'b-progression', 'b-save-btn'].map(id => nodes[id]), ...rows.flatMap(r => Object.values(r.inputs)), ...days.flatMap(d => Object.values(d.controls))];
  nodes['screen-builder'].querySelectorAll = () => fields();
  nodes['screen-builder'].querySelector = selector => selector.includes('topbar-title') ? title : null;
  const document = {
    getElementById: id => nodes[id] || null,
    querySelector(selector) {
      if (selector === '#screen-builder' || selector === '#screen-builder.active') return selector.endsWith('.active') && !nodes['screen-builder'].classList.contains('active') ? null : nodes['screen-builder'];
      if (selector.includes('topbar-title')) return title;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.builder-day' || selector === '#builder-days .builder-day') return days;
      if (selector.includes('#screen-builder')) return fields();
      return [];
    }
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date: Clock, Promise, Map, Set,
    setTimeout: (fn, ms) => { const timer = { fn, at: clock + ms }; timers.push(timer); return timer; },
    clearTimeout: timer => { const i = timers.indexOf(timer); if (i >= 0) timers.splice(i, 1); },
    document, _uid: 'trainer-a', _db: { fixture: true }, _clientAppMode: false,
    _clientPreviewMode: false, tenantSessionGeneration: 1, _tenantDataReady: true,
    CL: clone(clients), PL: previous ? [clone(previous)] : [], SE: [], dayCount: 0,
    _builderPeriodWeek: 0, _builderReturnClientId: 'client-a', _builderReturnTab: 'plan',
    newId: prefix => prefix + '-' + (++sequence), escHtml: value => String(value ?? ''),
    normalizePlanProgression: value => value || 'double',
    updatePeriod() {}, builderRefreshRationale() {}, restoreBuilderSidebarState() {},
    notify: (...args) => effects.toast.push(clone(args)),
    builderLeaveToCaller: (...args) => effects.leave.push(clone(args)),
    goTo: (...args) => effects.navigate.push(clone(args)),
    confirm: () => true,
    refillCalendarConfirmed: async (...args) => { effects.schedule.push(clone(args)); return {status:'saved',added:4}; },
    maybeSchedulePlanToCalendar: () => { throw new Error('Legacy scheduler must not run after saving a plan'); },
    maybeResumeOnboard: (...args) => effects.onboard.push(clone(args)),
    renderOnboardBuilderBanner: (...args) => effects.banner.push(clone(args)),
    persistById: async () => { throw new Error('main builder must use confirmed transaction'); },
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: s => !!s && !!ctx._uid && s.uid === ctx._uid && s.generation === ctx.tenantSessionGeneration,
    _doc: (db, collection, id) => ({ path: collection + '/' + id, collection, id })
  };
  ctx.window = ctx;
  ctx._runTransaction = (db, callback) => {
    transactions++;
    const mode = modes.shift() || {};
    const task = async () => {
      const writes = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'transaction reads precede all writes');
          reads.push(ref.path);
          const data = clone(store.get(ref.path));
          return { exists: () => data !== undefined, data: () => clone(data), id: ref.id };
        },
        set: (ref, data, config = {}) => writes.push({ path: ref.path, data: clone(data), config })
      };
      const result = await callback(tx);
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.rejectBefore) throw new Error('Network failure before commit');
      for (const write of writes) {
        store.set(write.path, write.config.merge ? { ...(store.get(write.path) || {}), ...write.data } : write.data);
        committed.push(clone(write));
      }
      if (mode.rejectAfter) throw new Error('Lost acknowledgement after commit');
      return result;
    };
    const result = serial.then(task);
    serial = result.catch(() => {});
    return result;
  };
  vm.createContext(ctx);
  vm.runInContext(section(core, 'function withTrainer', 'window.withTrainer=withTrainer;'), ctx);
  vm.runInContext(section(source, 'function builderWeekMetaForSave', 'function builderApplyWeekLoad'), ctx);
  vm.runInContext(section(source, 'function initBuilder', 'function addDay'), ctx);
  // Helper block is kept next to savePlan, so this does not substitute its logic.
  vm.runInContext(section(source, 'function builderPlanClone', 'function planDayLabelToWeekday'), ctx);
  function open({ edit = previous, clientId = edit ? edit.clientId : 'client-a', name = 'Nowy plan' } = {}) {
    ctx.initBuilder();
    nodes['screen-builder'].classList.add('active');
    nodes['b-name'].value = name;
    nodes['b-client'].value = clientId;
    nodes['b-method'].value = 'FBW';
    nodes['b-duration'].value = '4';
    nodes['b-progression'].value = 'double';
    if (edit) { ctx._editingPlanId = edit.id; ctx._builderSaveState.base = clone(edit); }
    return ctx._builderSaveState;
  }
  function gate() { const g = { entered: deferred(), release: deferred() }; modes.push({ gate: g }); return g; }
  function advance(ms) {
    clock += ms;
    for (const timer of timers.splice(0)) { if (timer.at <= clock) timer.fn(); else timers.push(timer); }
  }
  open();
  return { ctx, nodes, rows, days, store, effects, committed, reads, modes, previous, open, gate, advance,
    transactions: () => transactions, plans: () => [...store.entries()].filter(([key]) => key.startsWith('plans/')) };
}

function noFollowup(f) {
  for (const key of ['leave', 'navigate', 'schedule', 'onboard', 'banner']) assert.equal(f.effects[key].length, 0, key + ' waits for successful current form');
  assert.equal(f.effects.toast.filter(args => /zapisany|zaktualizowany/i.test(args[0] || '')).length, 0, 'no premature success notification');
}
const tests = [];
const test = (name, run) => tests.push({ name, run });

for (const edit of [false, true]) {
  test((edit ? 'edit' : 'create') + ' remains unchanged until the transaction confirms', async () => {
    const f = fixture({ edit });
    const original = clone(f.ctx.PL), editingId = f.ctx._editingPlanId;
    const wait = f.gate();
    const saving = f.ctx.savePlan();
    await wait.entered.promise;
    assert.deepEqual(clone(f.ctx.PL), original);
    assert.equal(f.ctx._editingPlanId, editingId);
    assert.equal(f.ctx._builderSaveState.pending, true);
    assert.equal(f.nodes['b-save-btn'].disabled, true);
    assert.equal(f.committed.length, 0);
    noFollowup(f);
    wait.release.resolve();
    assert.ok(await saving);
    assert.equal(f.committed.length, 1);
    assert.equal(f.plans().length, 1);
    const saved = f.plans()[0][1];
    assert.equal(saved.name, 'Nowy plan');
    assert.equal(saved.trainerId, 'trainer-a');
    assert.equal(saved.clientId, 'client-a');
    assert.equal(saved.days[0].exercises.length, 2);
    assert.equal(saved.days[0].exercises[0].kg, '60');
    assert.equal(f.ctx.PL.length, 1);
    assert.equal(f.ctx.PL[0].id, saved.id);
    assert.equal(f.ctx.PL[0].name, saved.name);
    assert.equal(f.effects.schedule.length, 1);
    if (edit) {
      assert.equal(saved.id, 'plan-a');
      assert.equal(saved.createdAt, f.previous.createdAt);
      assert.deepEqual(saved.customMetadata, { preserve: true });
    } else assert.ok(f.reads.includes(f.committed[0].path), 'new plan checks whether an earlier attempt already created the document');
  });
}

for (const mode of ['rejectBefore']) {
  for (const edit of [false, true]) {
    test((edit ? 'edit' : 'create') + ' ' + mode + ' preserves the draft and retries its frozen candidate', async () => {
      const f = fixture({ edit });
      const original = clone(f.ctx.PL), editingId = f.ctx._editingPlanId;
      f.modes.push({ [mode]: true });
      assert.ok(!(await f.ctx.savePlan()));
      assert.deepEqual(clone(f.ctx.PL), original);
      assert.equal(f.ctx._editingPlanId, editingId);
      assert.equal(f.nodes['b-name'].value, 'Nowy plan');
      assert.equal(f.ctx._builderSaveState.pending, false);
      assert.equal(f.nodes['b-save-btn'].disabled, false, 'retry button remains available');
      assert.equal(f.nodes['b-name'].disabled, true, 'unconfirmed candidate is frozen');
      assert.ok(f.ctx._builderSaveState.candidate);
      const candidate = clone(f.ctx._builderSaveState.candidate);
      noFollowup(f);
      f.advance(60000);
      // A programmatic form change must not alter an already submitted candidate.
      f.nodes['b-name'].value = 'Changed after failure';
      f.rows[0].inputs.kg.value = '999';
      assert.ok(await f.ctx.savePlan());
      const saved = f.plans()[0][1];
      assert.equal(saved.id, candidate.id);
      assert.equal(saved.name, 'Nowy plan');
      assert.equal(saved.days[0].exercises[0].kg, '60');
      assert.equal(saved.createdAt, candidate.createdAt);
      assert.equal(saved.updatedAt, candidate.updatedAt);
      assert.equal(f.plans().length, 1);
      assert.equal(f.effects.schedule.length, 1);
    });
  }
}

for (const edit of [false, true]) {
  test((edit ? 'edit' : 'create') + ' lost acknowledgement retries the same persisted document', async () => {
    const f = fixture({ edit });
    f.modes.push({ rejectAfter: true });
    assert.ok(!(await f.ctx.savePlan()));
    assert.equal(f.committed.length, 1);
    const first = clone(f.plans()[0]);
    noFollowup(f);
    f.advance(20000);
    assert.ok(await f.ctx.savePlan());
    assert.equal(f.plans().length, 1);
    assert.deepEqual(f.plans()[0], first);
    assert.equal(f.committed.length, 1, 'identical retry confirms the stored candidate without another write');
    assert.equal(f.ctx.PL.length, 1);
    assert.equal(f.effects.schedule.length, 1);
  });
}

test('double-click stays blocked beyond the old 1500ms timeout', async () => {
  const f = fixture();
  const wait = f.gate();
  const first = f.ctx.savePlan();
  await wait.entered.promise;
  f.advance(5000);
  const second = f.ctx.savePlan();
  assert.equal(f.transactions(), 1);
  wait.release.resolve();
  await Promise.all([first, second]);
  assert.equal(f.plans().length, 1);
  assert.equal(f.committed.length, 1);
  assert.equal(f.effects.schedule.length, 1);
});

for (const change of ['uid', 'generation']) {
  test('stale ' + change + ' cannot mutate the next trainer session', async () => {
    const f = fixture({ edit: true });
    const wait = f.gate();
    const saving = f.ctx.savePlan();
    await wait.entered.promise;
    if (change === 'uid') f.ctx._uid = 'trainer-b';
    else f.ctx.tenantSessionGeneration++;
    f.ctx.PL = [{ id: 'new-session-plan', trainerId: f.ctx._uid }];
    const newer = f.open({ edit: null, name: 'New session form' });
    wait.release.resolve();
    assert.ok(!(await saving));
    assert.equal(f.ctx.PL[0].id, 'new-session-plan');
    assert.equal(f.ctx._builderSaveState, newer);
    assert.equal(f.nodes['b-name'].value, 'New session form');
    assert.equal(newer.pending, false);
    noFollowup(f);
  });
}

test('opening another builder while saving preserves the new client and draft', async () => {
  const f = fixture();
  const wait = f.gate();
  const saving = f.ctx.savePlan();
  await wait.entered.promise;
  const newer = f.open({ edit: null, clientId: 'client-b', name: 'Plan klienta B' });
  wait.release.resolve();
  await saving;
  assert.equal(f.plans().length, 1);
  assert.equal(f.plans()[0][1].clientId, 'client-a');
  assert.equal(f.ctx._builderSaveState, newer);
  assert.equal(f.nodes['b-name'].value, 'Plan klienta B');
  assert.equal(f.nodes['b-client'].value, 'client-b');
  assert.equal(newer.candidate, null);
  noFollowup(f);
});

test('leaving the builder while saving does not navigate back or schedule implicitly', async () => {
  const f = fixture();
  const wait = f.gate();
  const saving = f.ctx.savePlan();
  await wait.entered.promise;
  f.nodes['screen-builder'].classList.remove('active');
  wait.release.resolve();
  await saving;
  assert.equal(f.plans().length, 1);
  noFollowup(f);
});

test('a session change after helper confirmation is still checked by the save caller', async () => {
  const f = fixture();
  const persist = f.ctx.persistBuilderPlan;
  f.ctx.persistBuilderPlan = async (...args) => {
    const saved = await persist(...args);
    // Model an auth/session continuation between the helper and its caller.
    f.ctx.tenantSessionGeneration++;
    f.ctx.PL = [{ id: 'next-session-plan', trainerId: 'trainer-a' }];
    return saved;
  };
  assert.ok(!(await f.ctx.savePlan()));
  assert.deepEqual(clone(f.ctx.PL), [{ id: 'next-session-plan', trainerId: 'trainer-a' }]);
  noFollowup(f);
});

test('unassigned library plan is allowed and never schedules a client', async () => {
  const f = fixture();
  f.nodes['b-client'].value = '';
  assert.ok(await f.ctx.savePlan());
  assert.equal(f.plans()[0][1].clientId, '');
  assert.deepEqual(f.reads, [f.committed[0].path], 'template reads only its target plan, not a client');
  assert.equal(f.effects.schedule.length, 0);
});

for (const invalid of ['empty-name', 'no-days', 'missing-client', 'foreign-client', 'signed-out', 'client-mode', 'preview-mode', 'offline', 'missing-edit', 'foreign-edit']) {
  test(invalid + ' makes no plan write and cannot silently become create', async () => {
    const f = fixture({ edit: invalid === 'missing-edit' || invalid === 'foreign-edit' });
    if (invalid === 'empty-name') f.nodes['b-name'].value = '   ';
    if (invalid === 'no-days') f.days.length = 0;
    if (invalid === 'missing-client') f.nodes['b-client'].value = 'missing';
    if (invalid === 'foreign-client') f.nodes['b-client'].value = 'client-foreign';
    if (invalid === 'signed-out') f.ctx._uid = null;
    if (invalid === 'client-mode') f.ctx._clientAppMode = true;
    if (invalid === 'preview-mode') f.ctx._clientPreviewMode = true;
    if (invalid === 'offline') f.ctx._db = null;
    if (invalid === 'missing-edit') { f.ctx.PL = []; f.ctx._builderSaveState.base = null; }
    if (invalid === 'foreign-edit') { f.ctx.PL[0].trainerId = 'trainer-b'; f.ctx._builderSaveState.base.trainerId = 'trainer-b'; }
    const original = clone(f.ctx.PL);
    assert.ok(!(await f.ctx.savePlan()));
    assert.equal(f.committed.length, 0);
    assert.deepEqual(clone(f.ctx.PL), original);
    noFollowup(f);
  });
}

for (const changed of ['missing', 'foreign-owner', 'content']) {
  test('remote edit ' + changed + ' is not overwritten', async () => {
    const f = fixture({ edit: true });
    if (changed === 'missing') f.store.delete('plans/plan-a');
    if (changed === 'foreign-owner') f.store.get('plans/plan-a').trainerId = 'trainer-b';
    if (changed === 'content') f.store.get('plans/plan-a').days[0].exercises[0].kg = '77';
    const before = clone(f.store.get('plans/plan-a'));
    assert.ok(!(await f.ctx.savePlan()));
    assert.equal(f.committed.length, 0);
    assert.deepEqual(f.store.get('plans/plan-a'), before);
    assert.equal(f.ctx._editingPlanId, 'plan-a');
    noFollowup(f);
  });
}

for (const changed of ['missing', 'foreign-owner']) {
  test('remote selected client ' + changed + ' blocks a locally valid form', async () => {
    const f = fixture();
    if (changed === 'missing') f.store.delete('clients/client-a');
    else f.store.get('clients/client-a').trainerId = 'trainer-b';
    assert.ok(!(await f.ctx.savePlan()));
    assert.equal(f.committed.length, 0);
    noFollowup(f);
  });
}

test('actual _fbId paths are used for client and edited plan without persisting mapping metadata', async () => {
  const f = fixture({ edit: { _fbId: 'actual-plan' } });
  f.ctx.CL[0]._fbId = 'actual-client';
  f.store.set('clients/actual-client', f.store.get('clients/client-a'));
  f.store.delete('clients/client-a');
  assert.ok(await f.ctx.savePlan());
  assert.deepEqual(f.reads, ['clients/actual-client', 'plans/actual-plan']);
  assert.equal(f.committed[0].path, 'plans/actual-plan');
  assert.ok(!('_fbId' in f.committed[0].data));
  assert.equal(f.ctx.PL[0]._fbId, 'actual-plan');
  assert.equal(f.store.has('plans/plan-a'), false);
});

test('periodized edit retains all weeks and saves the selected week plus metadata', async () => {
  const f = fixture({ edit: { weekKeys: ['w1', 'w2', 'w3', 'w4'], currentWeek: 'w3', phases: { w1: 'base', w3: 'build' }, continueFromWeek: 'w2' } });
  f.ctx._builderPeriodWeek = 2;
  f.rows[0].dataset.weekLoads = JSON.stringify({ w1: { s: '3', r: '8', kg: '50' }, w2: { s: '4', r: '8', kg: '55' } });
  assert.ok(await f.ctx.savePlan());
  const saved = f.plans()[0][1];
  assert.deepEqual(saved.weekKeys, ['w1', 'w2', 'w3', 'w4']);
  assert.equal(saved.currentWeek, 'w3');
  assert.equal(saved.days[0].exercises[0].w1.kg, '50');
  assert.equal(saved.days[0].exercises[0].w2.kg, '55');
  assert.equal(saved.days[0].exercises[0].w3.kg, '60');
  assert.deepEqual(saved.phases, { w1: 'base', w3: 'build' });
  assert.deepEqual(saved.customMetadata, { preserve: true });
});

test('a fresh builder resets a failed candidate and restores editable fields', async () => {
  const f = fixture();
  f.modes.push({ rejectBefore: true });
  assert.ok(!(await f.ctx.savePlan()));
  const failed = f.ctx._builderSaveState;
  assert.ok(failed.candidate);
  const newer = f.open({ edit: null, clientId: 'client-b', name: 'Nowy formularz' });
  assert.notEqual(newer, failed);
  assert.equal(newer.pending, false);
  assert.equal(newer.candidate, null);
  assert.equal(f.nodes['b-name'].disabled, false);
  assert.ok(await f.ctx.savePlan());
  assert.equal(f.plans()[0][1].clientId, 'client-b');
  assert.notEqual(f.plans()[0][1].id, failed.candidate.id);
});

test('transaction callback re-execution preserves the same new plan payload', async () => {
  const f = fixture();
  const original = f.ctx._runTransaction;
  let first;
  f.ctx._runTransaction = (db, callback) => original(db, async tx => {
    await callback({ get: tx.get, set: (ref, data) => { first = { path: ref.path, data: clone(data) }; } });
    f.advance(20000);
    return callback(tx);
  });
  assert.ok(await f.ctx.savePlan());
  assert.equal(f.committed.length, 1);
  assert.equal(f.committed[0].path, first.path);
  assert.deepEqual(f.committed[0].data, first.data);
});

test('calendar failure after commit does not make the plan save repeatable', async () => {
  const f = fixture();
  f.ctx.refillCalendarConfirmed = async (...args) => { f.effects.schedule.push(clone(args)); throw new Error('Calendar unavailable'); };
  const saved = await f.ctx.savePlan();
  assert.ok(saved);
  assert.equal(f.plans().length, 1);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.ctx._builderSaveState.saved, true);
  assert.equal(f.nodes['b-save-btn'].disabled, true);
  const attempts = f.transactions();
  assert.ok(!(await f.ctx.savePlan()));
  assert.equal(f.transactions(), attempts);
  assert.equal(f.committed.length, 1);
  assert.equal(f.effects.schedule.length, 1);
});

test('successful save cannot be replayed by a queued click after confirmation', async () => {
  const f = fixture();
  const saved = await f.ctx.savePlan();
  assert.ok(saved);
  assert.ok(!(await f.ctx.savePlan()));
  assert.equal(f.transactions(), 1);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.effects.schedule.length, 1);
});

for (const legacy of ['missing-id', 'stale-id']) {
  test('canonical document paths support legacy client and plan payloads: ' + legacy, async () => {
    const f = fixture({ edit: true });
    const client = f.store.get('clients/client-a');
    const plan = f.store.get('plans/plan-a');
    if (legacy === 'missing-id') { delete client.id; delete plan.id; }
    else { client.id = 'obsolete-client-id'; plan.id = 'obsolete-plan-id'; }
    assert.ok(await f.ctx.savePlan());
    assert.deepEqual(f.reads, ['clients/client-a', 'plans/plan-a']);
    assert.equal(f.committed.length, 1);
    assert.equal(f.committed[0].path, 'plans/plan-a');
    assert.equal(f.plans()[0][1].id, 'plan-a');
    assert.equal(f.plans()[0][1].clientId, 'client-a');
    assert.equal(f.plans()[0][1].trainerId, 'trainer-a');
    assert.equal(f.ctx.PL[0].id, 'plan-a');
  });
}

test('new plan lost acknowledgement followed by another edit must not overwrite that edit on retry', async () => {
  const f = fixture();
  f.modes.push({ rejectAfter: true });
  assert.ok(!(await f.ctx.savePlan()));
  assert.equal(f.committed.length, 1);
  assert.equal(f.ctx.PL.length, 0);
  const candidate = clone(f.ctx._builderSaveState.candidate);
  const [docPath, remote] = f.plans()[0];
  remote.name = 'Zmieniony w innym oknie';
  remote.days[0].exercises[0].kg = '82.5';
  remote.updatedAt = '2026-09-27T12:01:00.000Z';
  const authoritative = clone(remote);
  f.advance(120000);
  assert.ok(!(await f.ctx.savePlan()));
  assert.equal(f.committed.length, 1);
  assert.deepEqual(f.store.get(docPath), authoritative);
  assert.deepEqual(clone(f.ctx._builderSaveState.candidate), candidate);
  assert.equal(f.ctx.PL.length, 0, 'unconfirmed stale candidate is not published locally');
  assert.equal(f.nodes['b-save-btn'].disabled, false);
  assert.equal(f.nodes['b-name'].disabled, true);
  noFollowup(f);
});

test('a new plan ID collision cannot claim an existing non-identical document', async () => {
  const f = fixture();
  const occupied = { id: 'p-1', trainerId: 'trainer-a', clientId: 'client-b', name: 'Istniejący plan', days: [], createdAt: '2026-09-01' };
  f.store.set('plans/p-1', clone(occupied));
  assert.ok(!(await f.ctx.savePlan()));
  assert.equal(f.committed.length, 0);
  assert.deepEqual(f.store.get('plans/p-1'), occupied);
  assert.equal(f.ctx.PL.length, 0);
  noFollowup(f);
});

async function run() {
  let passed = 0;
  for (const item of tests) {
    let timer;
    try {
      await Promise.race([item.run(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('scenario timed out')), 5000); })]);
      passed++; console.log('PASS ' + item.name);
    } catch (error) { error.message = item.name + ': ' + error.message; throw error; }
    finally { clearTimeout(timer); }
  }
  console.log(passed + ' trainer plan confirmed-write scenarios passed');
  return { passed };
}
module.exports = { run };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
