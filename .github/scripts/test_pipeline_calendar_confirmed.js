'use strict';

// Execute production onboarding functions with independently controlled client,
// plan, and calendar acknowledgements. The calendar service has its own tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const privateSource = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function productionFunction(source, name) {
  const pattern = new RegExp('^(?:async )?function ' + name + '\\(', 'm');
  const match = pattern.exec(source);
  assert.ok(match, 'production function ' + name + ' exists');
  const start = match.index;
  const following = source.slice(start + match[0].length);
  const next = /^(?:async )?function [\w$]+\(/m.exec(following);
  const end = next ? start + match[0].length + next.index : source.length;
  return source.slice(start, end).replace(/^window\.[^\n]+$/gm, '');
}

const assignmentState = core.slice(core.indexOf('const assignedClientPlanWrites='), core.indexOf('function assignmentSession()'));
assert.ok(assignmentState.includes('new Map()'), 'production assignment retry state');
const coreCode = assignmentState + [
  'assignmentSession', 'assignmentSessionCurrent', 'assertAssignmentSession',
  'assignmentStartupState',
  'persistAssignedClientPlan', 'confirmAssignedClientCalendar',
  'assignTemplatePlanToClient', 'assignClientPipeline'
].map(name => productionFunction(core, name)).join('\n');
const flowCode = ['assignProgramPlanToClient', 'runOnboardingForClient']
  .map(name => productionFunction(privateSource, name)).join('\n');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const calls = { writes: [], calendar: [], events: [], notifications: [], messages: [], formSends: [], legacy: [] };
  const remote = new Map();
  const modes = { clients: [], plans: [], calendar: [] };
  let serial = 0;
  const client = { id: 'client-a', name: 'Anna', email: 'anna@example.test', trainerId: 'trainer-a', status: 'active', preferredWeekdays: [1, 3] };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, Date, Promise, Map, Set,
    _uid: 'trainer-a', _db: {}, tenantSessionGeneration: 1, _tenantDataReady: true,
    _clientAppMode: false, _clientPreviewMode: false,
    CL: [client], PL: [], SE: [],
    PLAN_TEMPLATES: [{ id: 'template-a', name: 'Plan szablon', method: 'FBW', weeks: 4,
      days_detail: [{ name: 'Pon', exercises: [{ n: 'Przysiad', s: 3, r: 8 }] }] }],
    ONBOARDING_FLOW: { active: false, assignEnabled: true, formsEnabled: false, msgEnabled: false,
      ondemandEnabled: false, recipesEnabled: false, programId: 'program-a', history: [] },
    captureTenantSession: () => ({ uid: ctx._uid, generation: ctx.tenantSessionGeneration }),
    tenantSessionIsCurrent: session => !!session && !!ctx._uid && session.uid === ctx._uid &&
      session.generation === ctx.tenantSessionGeneration && ctx._tenantDataReady &&
      !ctx._clientAppMode && !ctx._clientPreviewMode,
    withTrainer: entry => ({ ...entry, trainerId: ctx._uid }),
    newId: prefix => prefix + '-' + (++serial),
    clientEmailValid: email => /@/.test(email || ''),
    clientHasAssignedPlan: id => ctx.PL.some(plan => plan.clientId === id),
    clientHasCalendarOrSession: id => ctx.SE.some(session => session.clientId === id),
    clientPlanForCalendar: id => ctx.PL.find(plan => plan.clientId === id) || null,
    allPrograms: () => [{ id: 'program-a', name: 'Program A', duration: 4, method: 'FBW',
      weeks: [{ days: [{ d: 'Pon', name: 'Nogi', exercises: [{ name: 'Przysiad' }] }] }] }],
    planDaysFromProgram: () => [{ day: 'Pon', exercises: [{ name: 'Przysiad', sets: 3 }] }],
    allForms: () => [{ id: 'form-a', name: 'Ankieta startowa' }],
    createFormSend: (form, clientId) => calls.formSends.push({ formId: form.id, clientId }),
    enrollNewClientInAutoflows: () => {},
    renderOnboardHistory: () => {},
    logOnboardRun: () => {},
    confirm: () => true,
    pushMsg: (...args) => calls.messages.push(clone(args)),
    addNotification: (...args) => calls.notifications.push(clone(args)),
    fireIntEvent: () => {},
    emitAppEvent: (...args) => calls.events.push(clone(args)),
    maybeSchedulePlanToCalendar: (...args) => { calls.legacy.push(clone(args)); throw new Error('legacy scheduler'); },
    schedulePlanToCalendar: (...args) => { calls.legacy.push(clone(args)); throw new Error('legacy scheduler'); },
    _doc: (_db, collection, id) => ({ collection, id, path: collection + '/' + id }),
    _getDoc: async ref => {
      const value = clone(remote.get(ref.path));
      return { id: ref.id, exists: () => value !== undefined, data: () => clone(value) };
    },
    persistById: async (collection, entry) => {
      const mode = (modes[collection] || []).shift() || {};
      calls.writes.push({ collection, entry: clone(entry) });
      if (mode.entered) mode.entered.resolve();
      if (mode.gate) await mode.gate.promise;
      if (mode.commit !== false) remote.set(collection + '/' + (entry._fbId || entry.id), clone(entry));
      if (mode.reject) throw new Error('write rejected');
      return mode.null ? null : entry;
    },
    refillCalendarConfirmed: async (id, opts) => {
      calls.calendar.push({ id, opts: clone(opts), planPresent: remote.has('plans/' + opts.planId),
        clientPresent: remote.has('clients/' + id) });
      const mode = modes.calendar.shift() || {};
      if (mode.reject) throw new Error('calendar failed');
      return mode.result || { status: 'saved', added: 4 };
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(coreCode, ctx, { filename: '01-core-assignment.js' });
  vm.runInContext(flowCode, ctx, { filename: '09-onboarding-assignment.js' });
  return { ctx, client, calls, remote, modes };
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function noSideEffects(f) {
  assert.equal(f.calls.calendar.length, 0, 'no calendar call before required acknowledgement');
  assert.equal(f.calls.notifications.length, 0, 'no completion notification');
  assert.equal(f.calls.events.length, 0, 'no completion event');
  assert.equal(f.calls.legacy.length, 0, 'no legacy fallback');
}

test('pipeline waits for client and plan acknowledgement before calendar', async () => {
  const f = fixture(), clientGate = deferred(), clientEntered = deferred(), planGate = deferred(), planEntered = deferred();
  f.modes.clients.push({ entered: clientEntered, gate: clientGate });
  f.modes.plans.push({ entered: planEntered, gate: planGate });
  const pending = f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
  await clientEntered.promise;
  assert.deepEqual(f.calls.writes.map(write => write.collection), ['clients']);
  assert.equal(f.ctx.PL.length, 0); noSideEffects(f);
  clientGate.resolve(); await planEntered.promise;
  assert.deepEqual(f.calls.writes.map(write => write.collection), ['clients', 'plans']);
  assert.equal(f.ctx.PL.length, 0, 'plan is withheld until save acknowledgement'); noSideEffects(f);
  planGate.resolve();
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(f.calls.calendar.length, 1);
  assert.equal(f.calls.calendar[0].clientPresent, true);
  assert.equal(f.calls.calendar[0].planPresent, true);
  assert.equal(f.calls.calendar[0].opts.planId, result.plan.id);
  assert.ok(result.parts.includes('kalendarz'));
});

for (const kind of ['null', 'reject']) {
  test(kind + ' client acknowledgement stops plan, flow, and calendar', async () => {
    const f = fixture(); f.ctx.ONBOARDING_FLOW.active = true;
    f.modes.clients.push({ [kind]: true });
    const result = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a' });
    assert.equal(result.ok, false);
    assert.deepEqual(f.calls.writes.map(write => write.collection), ['clients']);
    assert.equal(f.ctx.PL.length, 0);
    assert.equal(f.calls.messages.length, 0);
    noSideEffects(f);
  });
  test(kind + ' plan acknowledgement stops calendar and preserves retry candidate', async () => {
    const f = fixture(); f.modes.plans.push({ [kind]: true });
    const first = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
    assert.equal(first.ok, false);
    assert.equal(f.ctx.PL.length, 0); noSideEffects(f);
    const firstId = f.calls.writes.find(write => write.collection === 'plans').entry.id;
    const retry = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
    assert.equal(retry.ok, true);
    assert.equal(f.ctx.PL.length, 1);
    assert.deepEqual(f.calls.writes.filter(write => write.collection === 'plans').map(write => write.entry.id), [firstId, firstId]);
    assert.equal(f.calls.calendar.length, 1);
  });
}

test('calendar failure cannot count as completion; retry reuses confirmed plan', async () => {
  const f = fixture(); f.modes.calendar.push({ result: { status: 'error', added: 0 } });
  const first = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
  assert.equal(first.ok, true);
  assert.equal(first.parts.includes('kalendarz'), false);
  assert.equal(first.calendar && first.calendar.status, 'error');
  assert.equal(f.ctx.PL.length, 1);
  const planId = f.ctx.PL[0].id;
  const retry = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
  assert.equal(retry.ok, true);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.calls.writes.filter(write => write.collection === 'plans').length, 1);
  assert.deepEqual(f.calls.calendar.map(call => call.opts.planId), [planId, planId]);
  assert.equal(f.calls.events.filter(call => call[0] === 'client.created').length, 1,
    'retry must not emit a second client.created event');
  assert.equal(f.calls.legacy.length, 0);
});

test('failed plan retry sends one welcome and one form only after confirmed plan', async () => {
  const f = fixture();
  Object.assign(f.ctx.ONBOARDING_FLOW, { active: true, formsEnabled: true,
    msgEnabled: true, welcomeMsg: 'Cześć {imie}' });
  f.modes.plans.push({ null: true });
  const first = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a' });
  assert.equal(first.ok, false);
  assert.equal(f.calls.messages.length, 0, 'welcome awaits plan acknowledgement');
  assert.equal(f.calls.formSends.length, 0, 'form awaits plan acknowledgement');
  const retry = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a' });
  assert.equal(retry.ok, true);
  assert.deepEqual(f.calls.messages, [['client-a', 'Cześć Anna']]);
  assert.deepEqual(f.calls.formSends, [{ formId: 'form-a', clientId: 'client-a' }]);
});

test('schedule false suppresses calendar in active onboarding flow', async () => {
  const f = fixture(); f.ctx.ONBOARDING_FLOW.active = true;
  const result = await f.ctx.assignClientPipeline(f.client, { schedule: false });
  assert.equal(result.ok, true);
  assert.equal(f.ctx.PL.length, 1, 'active flow can still assign its program');
  assert.equal(f.calls.calendar.length, 0);
  assert.equal(f.calls.legacy.length, 0);
  assert.equal(result.parts.includes('kalendarz'), false);
});

test('pipeline leaves an existing live session calendar alone', async () => {
  const f = fixture();
  f.ctx.SE.push({ id: 'live-a', clientId: f.client.id, source: 'live', date: '2026-10-01' });
  const result = await f.ctx.assignClientPipeline(f.client,
    { templateId: 'template-a', runFlow: false });
  assert.equal(result.ok, true);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.calls.calendar.length, 0, 'automatic pipeline must respect the existing-session guard');
  assert.equal(f.ctx.SE.length, 1);
  assert.equal(f.calls.legacy.length, 0);
});

test('stale account after client acknowledgement cannot assign, schedule, or notify', async () => {
  const f = fixture(), gate = deferred(), entered = deferred();
  f.modes.clients.push({ entered, gate });
  const pending = f.ctx.assignClientPipeline(f.client, { templateId: 'template-a' });
  await entered.promise;
  f.ctx._uid = 'trainer-b'; f.ctx.tenantSessionGeneration++;
  gate.resolve();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(f.ctx.PL.length, 0);
  assert.deepEqual(f.calls.writes.map(write => write.collection), ['clients']);
  noSideEffects(f);
});

test('stale account after plan acknowledgement cannot schedule or notify the next account', async () => {
  const f = fixture(), gate = deferred(), entered = deferred();
  f.modes.plans.push({ entered, gate });
  const pending = f.ctx.assignClientPipeline(f.client, { templateId: 'template-a', runFlow: false });
  await entered.promise;
  f.ctx.tenantSessionGeneration++;
  f.ctx.PL = [{ id: 'other-plan', trainerId: 'trainer-b', clientId: 'other-client' }];
  gate.resolve();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.deepEqual(f.ctx.PL.map(plan => plan.id), ['other-plan']);
  noSideEffects(f);
});

for (const mode of ['null', 'reject']) {
  test('direct active flow stops on ' + mode + ' program acknowledgement', async () => {
    const f = fixture(); f.ctx.ONBOARDING_FLOW.active = true;
    f.modes.plans.push({ [mode]: true });
    await assert.rejects(f.ctx.runOnboardingForClient(f.client));
    assert.equal(f.ctx.PL.length, 0);
    assert.equal(f.calls.calendar.length, 0);
    assert.equal(f.calls.notifications.length, 0);
    assert.equal(f.calls.legacy.length, 0);
  });
}

test('trainer session is required before any client or plan write', async () => {
  for (const change of ['signed-out', 'not-ready', 'client-mode', 'foreign-client']) {
    const f = fixture();
    if (change === 'signed-out') f.ctx._uid = null;
    if (change === 'not-ready') f.ctx._tenantDataReady = false;
    if (change === 'client-mode') f.ctx._clientAppMode = true;
    if (change === 'foreign-client') f.client.trainerId = 'trainer-b';
    const result = await f.ctx.assignClientPipeline(f.client, { templateId: 'template-a' });
    assert.equal(result.ok, false, change);
    assert.equal(f.calls.writes.length, 0, change);
    noSideEffects(f);
  }
});

test('direct active flow only schedules after confirmed program plan', async () => {
  const f = fixture(), gate = deferred(), entered = deferred();
  f.ctx.ONBOARDING_FLOW.active = true;
  f.modes.plans.push({ entered, gate });
  const pending = f.ctx.runOnboardingForClient(f.client);
  await entered.promise;
  assert.equal(f.ctx.PL.length, 0);
  assert.equal(f.calls.calendar.length, 0);
  gate.resolve();
  const parts = await pending;
  assert.ok(parts.includes('program'));
  assert.ok(parts.includes('kalendarz'));
  assert.equal(f.calls.calendar.length, 1);
  assert.equal(f.calls.calendar[0].planPresent, true);
  assert.equal(f.calls.legacy.length, 0);
});

test('rerunning active flow does not repeat welcome, form, or onboarding notification', async () => {
  const f = fixture();
  Object.assign(f.ctx.ONBOARDING_FLOW, { active: true, formsEnabled: true,
    msgEnabled: true, welcomeMsg: 'Cześć {imie}' });
  await f.ctx.runOnboardingForClient(f.client);
  f.ctx.SE.push({ id: 'planned-a', clientId: f.client.id, source: 'planned' });
  await f.ctx.runOnboardingForClient(f.client);
  assert.deepEqual(f.calls.messages, [['client-a', 'Cześć Anna']]);
  assert.deepEqual(f.calls.formSends, [{ formId: 'form-a', clientId: 'client-a' }]);
  assert.equal(f.calls.notifications.filter(call => call[1] === 'Onboarding uruchomiony').length, 1);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.calls.calendar.length, 1);
});

test('concurrent program assignment shares one unacknowledged plan candidate', async () => {
  const f = fixture(), gate = deferred(), entered = deferred();
  f.modes.plans.push({ entered, gate });
  const first = f.ctx.assignProgramPlanToClient('program-a', f.client);
  await entered.promise;
  const second = f.ctx.assignProgramPlanToClient('program-a', f.client);
  assert.equal(f.calls.writes.filter(write => write.collection === 'plans').length, 1);
  assert.equal(f.ctx.PL.length, 0);
  gate.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.id, b.id);
  assert.equal(f.ctx.PL.length, 1);
  assert.equal(f.calls.writes.filter(write => write.collection === 'plans').length, 1);
});

(async () => {
  for (const { name, fn } of tests) {
    await fn();
    console.log('PASS ' + name);
  }
  console.log('Pipeline calendar confirmation tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
