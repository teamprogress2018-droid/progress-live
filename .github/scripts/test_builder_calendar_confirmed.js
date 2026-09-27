'use strict';

// Exercise the real builder -> confirmed calendar boundary with one shared Firestore model.
// Plan/calendar commits and acknowledgements are independently controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const calendarSource = fs.readFileSync(path.join(root, 'calendar-refill.js'), 'utf8');
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
  const effects = { toast: [], leave: [], navigate: [], legacy: [], calendar: [], confirm: [], onboard: [], banner: [], queries: [], transactions: [] };
  const planModes = [], calendarModes = [], hooks = {}; 
  const store = new Map(), committed = [], reads = [], timers = [];
  let transactions = 0, sequence = 0, clock = Date.parse('2026-09-27T12:00:00.000Z');
  let serial = Promise.resolve();
  const clients = [
    { id: 'client-a', trainerId: 'trainer-a', name: 'Klient A', status: 'active', preferredWeekdays: [1], preferredTrainTime: 'Rano', level: 'sredni', goal: 'masa' },
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
  const nodes = Object.fromEntries(['b-name', 'b-client', 'b-method', 'b-duration', 'b-progression', 'builder-days', 'screen-builder', 'b-save-btn', 'builder-save-status', 'builder-calendar-actions', 'b-calendar-retry', 'b-calendar-continue'].map(id => [id, element()]));
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
  const fields = () => [...['b-name', 'b-client', 'b-method', 'b-duration', 'b-progression', 'b-save-btn', 'b-calendar-retry', 'b-calendar-continue'].map(id => nodes[id]), ...rows.flatMap(r => Object.values(r.inputs)), ...days.flatMap(d => Object.values(d.controls))];
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
    maybeSchedulePlanToCalendar: (...args) => { effects.legacy.push(clone(args)); throw new Error('legacy calendar scheduler must not be called'); },
    confirm: message => { effects.confirm.push(message); return options.confirm !== false; },
    clientAccessMode: client => client.accessMode || 'standard',
    clientPackageExpired: (pkg, today) => pkg.status === 'expired' || !!(pkg.expiresDate && pkg.expiresDate < today),
    isLoggedWorkout: entry => ['live', 'client', 'sala'].includes(entry.source),
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
    const task = async () => {
      const writes = [], txReads = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'transaction reads precede all writes');
          reads.push(ref.path); txReads.push(ref.path);
          const data = clone(store.get(ref.path));
          return { exists: () => data !== undefined, data: () => clone(data), id: ref.id };
        },
        set: (ref, data, config = {}) => writes.push({ path: ref.path, data: clone(data), config })
      };
      const result = await callback(tx);
      const kind = txReads.some(key => key.startsWith('sessions/')) ? 'calendar' : 'plan';
      effects.transactions.push({ kind, reads: txReads.slice() });
      const mode = (kind === 'calendar' ? calendarModes : planModes).shift() || {};
      if (mode.gate) { mode.gate.entered.resolve(); await mode.gate.release.promise; }
      if (mode.rejectBefore) throw new Error('Network failure before commit');
      for (const write of writes) {
        store.set(write.path, write.config.merge ? { ...(store.get(write.path) || {}), ...write.data } : write.data);
        committed.push(clone(write));
      }
      if (hooks.afterCommit) hooks.afterCommit(kind, writes);
      if (mode.rejectAfter) throw new Error('Lost acknowledgement after commit');
      return result;
    };
    const result = serial.then(task);
    serial = result.catch(() => {});
    return result;
  };
  ctx._col = (db, collection) => ({ collection });
  ctx._where = (field, op, value) => ({ field, op, value });
  ctx._query = (collection, ...clauses) => ({ ...collection, clauses });
  ctx._get = async query => {
    effects.queries.push(clone(query));
    const docs = [...store.entries()].filter(([key, value]) => key.startsWith(query.collection + '/') && query.clauses.every(c => {
      assert.equal(c.op, '=='); return value[c.field] === c.value;
    })).map(([key, data]) => ({ id: key.slice(query.collection.length + 1), data: () => clone(data) }));
    if (hooks.query) await hooks.query(query);
    return { forEach: callback => docs.forEach(callback) };
  };
  vm.createContext(ctx);
  vm.runInContext(section(core, 'function withTrainer', 'window.withTrainer=withTrainer;'), ctx);
  vm.runInContext(section(source, 'function builderWeekMetaForSave', 'function builderApplyWeekLoad'), ctx);
  vm.runInContext(section(source, 'function initBuilder', 'function addDay'), ctx);
  // Helper block is kept next to savePlan, so this does not substitute its logic.
  vm.runInContext(section(source, 'function builderPlanClone', 'function planDayLabelToWeekday'), ctx);
  vm.runInContext(section(source, 'function planDayLabelToWeekday', 'function dropPlannedSessionsFrom'), ctx);
  vm.runInContext(calendarSource, ctx);
  const realCalendar = ctx.refillCalendarConfirmed;
  ctx.refillCalendarConfirmed = (...args) => { effects.calendar.push(clone(args)); return realCalendar(...args); };
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
  function gate(kind = 'plan') { const g = { entered: deferred(), release: deferred() }; (kind === 'calendar' ? calendarModes : planModes).push({ gate: g }); return g; }
  function advance(ms) {
    clock += ms;
    for (const timer of timers.splice(0)) { if (timer.at <= clock) timer.fn(); else timers.push(timer); }
  }
  open();
  return { ctx, nodes, rows, days, store, effects, committed, reads, planModes, calendarModes, hooks, previous, open, gate, advance, realCalendar,
    sessions: () => [...store.entries()].filter(([key]) => key.startsWith('sessions/')),
    planWrites: () => committed.filter(write => write.path.startsWith('plans/')),
    sessionWrites: () => committed.filter(write => write.path.startsWith('sessions/')),
    transactions: () => transactions, plans: () => [...store.entries()].filter(([key]) => key.startsWith('plans/')) };
}


const tests = [];
const test = (name, run) => tests.push({ name, run });
function noNavigation(f) {
  for (const key of ['leave', 'navigate', 'onboard', 'banner']) assert.equal(f.effects[key].length, 0, key + ' must wait for this confirmed form');
}
function noCalendar(f) {
  assert.equal(f.effects.calendar.length, 0);
  assert.equal(f.effects.legacy.length, 0);
  assert.equal(f.sessionWrites().length, 0);
}
function savedCalendar(f, saved, count = 4) {
  assert.equal(f.effects.legacy.length, 0, 'no legacy write path');
  assert.equal(f.sessions().length, count);
  for (const [, entry] of f.sessions()) {
    assert.equal(entry.trainerId, 'trainer-a');
    assert.equal(entry.clientId, saved.clientId);
    assert.equal(entry.planId, saved.id);
    assert.equal(entry.source, 'planned');
  }
}

test('calendar begins only after a new plan is committed and acknowledged', async () => {
  const f = fixture(), wait = f.gate();
  const saving = f.ctx.savePlan();
  await wait.entered.promise;
  assert.equal(f.plans().length, 0);
  assert.equal(f.ctx.PL.length, 0);
  noCalendar(f); noNavigation(f);
  wait.release.resolve();
  const saved = await saving;
  assert.ok(saved);
  assert.deepEqual(f.effects.transactions.map(t => t.kind), ['plan', 'calendar']);
  assert.deepEqual(f.effects.calendar, [['client-a', { planId: saved.id, weeks: 4 }]]);
  assert.equal(f.planWrites().length, 1);
  savedCalendar(f, saved);
  assert.equal(f.effects.leave.length, 1);
  assert.equal(f.ctx._builderSaveState.calendar.status, 'saved');
});

test('plan failure schedules nothing; retry confirms the frozen plan before calendar', async () => {
  const f = fixture();
  f.planModes.push({ rejectBefore: true });
  assert.equal(await f.ctx.savePlan(), null);
  noCalendar(f); noNavigation(f);
  const candidate = clone(f.ctx._builderSaveState.candidate);
  f.nodes['b-name'].value = 'Changed in DOM after failure';
  const saved = await f.ctx.savePlan();
  assert.equal(saved.id, candidate.id);
  assert.equal(saved.name, candidate.name);
  assert.equal(f.planWrites().length, 1);
  savedCalendar(f, saved);
});

test('lost plan acknowledgement is recovered without writing or scheduling another plan', async () => {
  const f = fixture();
  f.planModes.push({ rejectAfter: true });
  assert.equal(await f.ctx.savePlan(), null);
  assert.equal(f.plans().length, 1);
  noCalendar(f); noNavigation(f);
  const original = clone(f.plans()[0]);
  const saved = await f.ctx.savePlan();
  assert.deepEqual(f.plans()[0], original);
  assert.equal(f.planWrites().length, 1, 'identical acknowledged replay does not overwrite');
  assert.equal(f.effects.calendar.length, 1);
  savedCalendar(f, saved);
});

test('calendar pending keeps confirmed plan locked and does not announce calendar success', async () => {
  const f = fixture(), wait = f.gate('calendar');
  const saving = f.ctx.savePlan();
  await wait.entered.promise;
  const state = f.ctx._builderSaveState;
  assert.equal(state.saved, true);
  assert.equal(f.planWrites().length, 1);
  assert.equal(f.sessionWrites().length, 0);
  assert.equal(state.calendar.status, 'pending');
  assert.match(f.nodes['builder-save-status'].textContent, /^Plan zapisany\./);
  assert.doesNotMatch(f.nodes['builder-save-status'].textContent, /Kalendarz uzupełniony/);
  assert.equal(f.nodes['b-name'].disabled, true);
  assert.equal(f.nodes['b-save-btn'].disabled, true);
  assert.equal(f.nodes['b-calendar-retry'].disabled, true);
  assert.equal(f.nodes['b-calendar-continue'].disabled, true);
  f.ctx.builderFinishSavedPlan(); noNavigation(f);
  wait.release.resolve();
  savedCalendar(f, await saving);
  assert.equal(f.effects.leave.length, 1);
});

test('calendar error retains a confirmed plan and retries only exact saved plan and options', async () => {
  const f = fixture();
  f.nodes['b-duration'].value = '8';
  f.calendarModes.push({ rejectBefore: true });
  const saved = await f.ctx.savePlan(), state = f.ctx._builderSaveState;
  assert.ok(saved); assert.equal(state.saved, true);
  assert.equal(state.calendar.status, 'error');
  assert.equal(f.plans().length, 1); assert.equal(f.sessions().length, 0);
  assert.match(f.nodes['builder-save-status'].textContent, /^Plan zapisany\./);
  assert.equal(f.nodes['builder-calendar-actions'].hidden, false);
  assert.equal(f.nodes['b-calendar-retry'].disabled, false);
  assert.equal(f.nodes['b-name'].disabled, true);
  noNavigation(f);
  f.nodes['b-client'].value = 'client-b'; f.nodes['b-duration'].value = '12';
  f.nodes['b-name'].value = 'Must not be resaved';
  assert.equal(await f.ctx.savePlan(), null);
  assert.equal((await f.ctx.builderRetryCalendar()).status, 'saved');
  assert.equal(f.planWrites().length, 1);
  assert.equal(f.plans()[0][1].name, 'Nowy plan');
  assert.deepEqual(f.effects.calendar, [
    ['client-a', { planId: saved.id, weeks: 8 }], ['client-a', { planId: saved.id, weeks: 8 }]
  ]);
  savedCalendar(f, saved, 8);
  assert.equal(f.effects.leave.length, 1);
});

test('lost calendar acknowledgement retries the same dates and preserves a moved appointment', async () => {
  const f = fixture();
  f.calendarModes.push({ rejectAfter: true });
  const saved = await f.ctx.savePlan();
  assert.equal(f.ctx._builderSaveState.calendar.status, 'error');
  assert.equal(f.ctx.SE.length, 0, 'unacknowledged remote commit is not locally announced');
  const first = f.sessions()[0];
  first[1].date = '2026-12-24'; first[1].time = '10:45'; first[1].notes = 'Moved by trainer';
  const before = clone(f.sessions());
  f.advance(2 * 86400000);
  const result = await f.ctx.builderRetryCalendar();
  assert.equal(result.status, 'unchanged');
  assert.deepEqual(f.sessions(), before);
  assert.equal(f.sessionWrites().length, 4);
  assert.equal(f.planWrites().length, 1);
  assert.equal(f.ctx.SE.find(s => s.id === first[1].id).time, '10:45');
  savedCalendar(f, saved);
});

test('a newer different plan in PL cannot replace exact just-saved plan selection', async () => {
  const f = fixture();
  f.hooks.afterCommit = (kind, writes) => {
    if (kind !== 'plan') return;
    const other = { ...clone(writes[0].data), id: 'newer-unrelated-plan', name: 'Do not schedule me', updatedAt: '2099-01-01T00:00:00Z' };
    f.ctx.PL.push(other); f.store.set('plans/' + other.id, clone(other));
  };
  const saved = await f.ctx.savePlan();
  assert.notEqual(saved.id, 'newer-unrelated-plan');
  savedCalendar(f, saved);
  assert.equal(f.effects.calendar[0][1].planId, saved.id);
});

test('double-click during plan confirmation cannot create a second plan or calendar', async () => {
  const f = fixture(), wait = f.gate();
  const first = f.ctx.savePlan(); await wait.entered.promise;
  f.advance(10000);
  assert.equal(await f.ctx.savePlan(), null);
  assert.equal(f.transactions(), 1);
  wait.release.resolve();
  const saved = await first;
  assert.equal(f.planWrites().length, 1);
  assert.equal(f.effects.calendar.length, 1);
  savedCalendar(f, saved);
});

test('repeated calendar retries share the pending promise; save and exit cannot bypass it', async () => {
  const f = fixture();
  f.calendarModes.push({ rejectBefore: true });
  const saved = await f.ctx.savePlan();
  const wait = f.gate('calendar');
  const first = f.ctx.builderRetryCalendar();
  await wait.entered.promise;
  const second = f.ctx.builderRetryCalendar();
  assert.equal(second, first);
  assert.equal(await f.ctx.savePlan(), null);
  f.ctx.builderFinishSavedPlan(); noNavigation(f);
  assert.equal(f.effects.calendar.length, 2, 'initial attempt plus one retry');
  wait.release.resolve(); await first;
  assert.equal(f.planWrites().length, 1);
  savedCalendar(f, saved);
  assert.equal(f.effects.leave.length, 1);
});

for (const change of ['uid', 'generation']) {
  test('stale ' + change + ' while saving plan prevents all calendar work', async () => {
    const f = fixture(), wait = f.gate();
    const saving = f.ctx.savePlan(); await wait.entered.promise;
    if (change === 'uid') f.ctx._uid = 'trainer-b'; else f.ctx.tenantSessionGeneration++;
    f.ctx.PL = [{ id: 'new-session', trainerId: f.ctx._uid }];
    const newState = f.open({ edit: null, clientId: '', name: 'New trainer draft' });
    wait.release.resolve();
    assert.equal(await saving, null);
    assert.equal(f.ctx._builderSaveState, newState);
    assert.deepEqual(clone(f.ctx.PL), [{ id: 'new-session', trainerId: f.ctx._uid }]);
    assert.equal(f.nodes['b-name'].value, 'New trainer draft');
    noCalendar(f); noNavigation(f);
  });
  test('stale ' + change + ' during calendar acknowledgement cannot affect next session', async () => {
    const f = fixture(), wait = f.gate('calendar');
    const saving = f.ctx.savePlan(); await wait.entered.promise;
    if (change === 'uid') f.ctx._uid = 'trainer-b'; else f.ctx.tenantSessionGeneration++;
    f.ctx.SE = [{ id: 'new-session-only', trainerId: f.ctx._uid }];
    const newState = f.open({ edit: null, clientId: '', name: 'New session draft' });
    const status = f.nodes['builder-save-status'].textContent;
    wait.release.resolve(); await saving;
    assert.equal(f.ctx._builderSaveState, newState);
    assert.deepEqual(clone(f.ctx.SE), [{ id: 'new-session-only', trainerId: f.ctx._uid }]);
    assert.equal(f.nodes['builder-save-status'].textContent, status);
    assert.equal(f.nodes['b-name'].value, 'New session draft');
    noNavigation(f);
  });
}

test('opening another builder during plan save does not schedule or navigate the new form', async () => {
  const f = fixture(), wait = f.gate();
  const saving = f.ctx.savePlan(); await wait.entered.promise;
  const next = f.open({ clientId: 'client-b', name: 'Plan klienta B' });
  wait.release.resolve(); await saving;
  assert.equal(f.ctx._builderSaveState, next);
  assert.equal(f.nodes['b-name'].value, 'Plan klienta B');
  assert.equal(next.saved, false); noCalendar(f); noNavigation(f);
});

test('another form opened during calendar save retains its own controls and status', async () => {
  const f = fixture(), wait = f.gate('calendar');
  const saving = f.ctx.savePlan(); await wait.entered.promise;
  const next = f.open({ clientId: 'client-b', name: 'Plan klienta B' });
  wait.release.resolve(); await saving;
  assert.equal(f.ctx._builderSaveState, next);
  assert.equal(f.nodes['b-client'].value, 'client-b');
  assert.equal(f.nodes['b-name'].disabled, false);
  assert.equal(f.nodes['builder-save-status'].textContent, '');
  assert.equal(f.nodes['builder-calendar-actions'].hidden, true);
  noNavigation(f);
});

test('leaving while calendar is pending does not navigate back after acknowledgement', async () => {
  const f = fixture(), wait = f.gate('calendar');
  const saving = f.ctx.savePlan(); await wait.entered.promise;
  f.nodes['screen-builder'].classList.remove('active');
  wait.release.resolve(); await saving;
  noNavigation(f);
  assert.equal(f.effects.legacy.length, 0);
});

test('unassigned template saves normally without querying calendar', async () => {
  const f = fixture(); f.nodes['b-client'].value = '';
  const saved = await f.ctx.savePlan();
  assert.equal(saved.clientId, ''); noCalendar(f);
  assert.equal(f.effects.queries.length, 0);
  assert.equal(f.effects.leave.length, 1);
  assert.equal(f.nodes['b-name'].disabled, false);
});

test('rest-only plan saves normally without scheduling empty training', async () => {
  const f = fixture(); f.days[0].controls.rc.checked = true;
  const saved = await f.ctx.savePlan();
  assert.equal(saved.days[0].rest, true); noCalendar(f);
  assert.equal(f.effects.queries.length, 0);
  assert.equal(f.effects.leave.length, 1);
});

for (const accepted of [true, false]) {
  test('missing preferred days ' + (accepted ? 'accepts' : 'declines') + ' explicit calendar confirmation', async () => {
    const f = fixture({ confirm: accepted });
    f.ctx.CL[0].preferredWeekdays = [];
    f.store.get('clients/client-a').preferredWeekdays = [];
    f.nodes['b-duration'].value = '8';
    const saved = await f.ctx.savePlan();
    assert.equal(f.effects.confirm.length, 1);
    assert.match(f.effects.confirm[0], /8 tygodni/);
    if (accepted) savedCalendar(f, saved, 8); else noCalendar(f);
    assert.equal(f.effects.leave.length, 1);
  });
}

for (const duration of ['4', '8', '12', '16']) {
  test('calendar horizon preserves plan duration ' + duration + ' with 12-week safety cap', async () => {
    const f = fixture(); f.nodes['b-duration'].value = duration;
    const saved = await f.ctx.savePlan(), weeks = duration === '4' ? 4 : Math.min(12, Number(duration));
    assert.equal(saved.duration, duration);
    assert.deepEqual(f.effects.calendar[0], ['client-a', { planId: saved.id, weeks }]);
    savedCalendar(f, saved, weeks);
  });
}

test('edited plan keeps its exact ID, metadata, client time and existing appointment', async () => {
  const f = fixture({ edit: true });
  const existing = { id: 'existing-appointment', trainerId: 'trainer-a', clientId: 'client-a', source: 'planned', planId: 'plan-a', dayIdx: 0, date: '2026-09-28', time: '15:15', notes: 'Preserve manually changed session' };
  f.store.set('sessions/' + existing.id, clone(existing));
  const saved = await f.ctx.savePlan();
  assert.equal(saved.id, 'plan-a');
  assert.deepEqual(clone(saved.customMetadata), { preserve: true });
  assert.equal(f.plans().length, 1);
  assert.deepEqual(f.store.get('sessions/' + existing.id), existing);
  assert.equal(f.sessionWrites().length, 3);
  for (const write of f.sessionWrites()) {
    assert.equal(write.data.time, '08:00');
    assert.equal(write.data.duration, 60);
    assert.equal(write.data.dayIdx, 0);
    assert.equal(write.data.type, 'PON — Nogi');
    assert.equal(write.data.notes, 'Z planu: Nowy plan · Nogi');
  }
  savedCalendar(f, saved);
});

test('actual mapped document paths are preserved from builder into calendar', async () => {
  const f = fixture({ edit: { _fbId: 'actual-plan' } });
  f.ctx.CL[0]._fbId = 'actual-client';
  f.store.set('clients/actual-client', f.store.get('clients/client-a'));
  f.store.delete('clients/client-a');
  const saved = await f.ctx.savePlan();
  assert.equal(saved._fbId, 'actual-plan');
  assert.equal(f.effects.calendar[0][1].planId, 'plan-a');
  assert.ok(f.reads.includes('plans/actual-plan'));
  assert.ok(f.reads.includes('clients/actual-client'));
  assert.ok(!f.reads.includes('plans/plan-a'));
  savedCalendar(f, saved);
});

test('explicit continue after calendar failure exits once without another save', async () => {
  const f = fixture();
  f.calendarModes.push({ rejectBefore: true });
  await f.ctx.savePlan(); noNavigation(f);
  f.ctx.builderFinishSavedPlan(); f.ctx.builderFinishSavedPlan();
  assert.equal(f.effects.leave.length, 1);
  assert.equal(f.effects.onboard.length, 1);
  assert.equal(f.nodes['builder-calendar-actions'].hidden, true);
  assert.equal(f.planWrites().length, 1);
  assert.equal(f.sessionWrites().length, 0);
  assert.equal(await f.ctx.builderRetryCalendar(), null);
});

test('missing calendar module leaves confirmed plan with an honest recoverable error', async () => {
  const f = fixture(); f.ctx.refillCalendarConfirmed = undefined;
  const saved = await f.ctx.savePlan();
  assert.ok(saved); assert.equal(f.planWrites().length, 1);
  assert.equal(f.ctx._builderSaveState.calendar.status, 'error');
  assert.match(f.nodes['builder-save-status'].textContent, /^Plan zapisany\./);
  assert.match(f.nodes['builder-save-status'].textContent, /niedostępny/);
  assert.equal(f.nodes['builder-calendar-actions'].hidden, false);
  noNavigation(f); noCalendar(f);
});

test('client ownership changed after plan commit prevents calendar mutation', async () => {
  const f = fixture();
  f.hooks.afterCommit = kind => { if (kind === 'plan') f.store.get('clients/client-a').trainerId = 'trainer-b'; };
  const saved = await f.ctx.savePlan();
  assert.ok(saved); assert.equal(f.planWrites().length, 1);
  assert.equal(f.sessions().length, 0);
  assert.equal(f.ctx._builderSaveState.calendar.status, 'error');
  noNavigation(f);
});

test('calendar failure does not resume onboarding until retry confirms, and only once', async () => {
  const f = fixture(); f.ctx._onboardResumeAfterBuilder = 'client-a';
  f.calendarModes.push({ rejectBefore: true });
  await f.ctx.savePlan();
  assert.equal(f.ctx._onboardResumeAfterBuilder, 'client-a'); noNavigation(f);
  await f.ctx.builderRetryCalendar(); f.ctx.builderFinishSavedPlan();
  assert.equal(f.ctx._onboardResumeAfterBuilder, null);
  assert.equal(f.effects.banner.length, 1);
  assert.deepEqual(f.effects.onboard, [['client-a']]);
  assert.equal(f.effects.leave.length, 1);
});

async function run() {
  let failed = 0;
  for (const entry of tests) {
    try { await entry.run(); console.log('PASS ' + entry.name); }
    catch (error) { failed++; console.error('FAIL ' + entry.name); console.error(error.stack || error); }
  }
  if (failed) throw new Error(failed + '/' + tests.length + ' builder/calendar scenarios failed');
  console.log(tests.length + '/' + tests.length + ' builder/calendar integration scenarios passed');
  return { passed: tests.length, failed: 0 };
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { run };
