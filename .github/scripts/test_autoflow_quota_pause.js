#!/usr/bin/env node
'use strict';
/** Real Autoflow queue/transactions: a per-trainer quota circuit breaker must stop the whole drain. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
function section(text, first, next) {
  const a = text.indexOf('function ' + first), b = text.indexOf('function ' + next, a + 1);
  assert(a >= 0 && b > a, 'Missing real source section: ' + first);
  return text.slice(a, b);
}
const trainerStart = core.indexOf('function withTrainer(');
const trainerEnd = core.indexOf('window.withTrainer', trainerStart);
assert(trainerStart >= 0 && trainerEnd > trainerStart);
const bundle = core.slice(trainerStart, trainerEnd)
  + section(core, 'emitAppEvent', 'assignTemplatePlanToClient')
  + section(source, 'ensureReminderAutoflowsFromSettings', 'setAutoTab')
  + section(source, 'ensureAfState', 'enrollScopeClients')
  + section(source, 'logAF', 'runAutoflowsCheck')
  + section(source, 'runAutoflowsCheck', 'notify');
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function merge(target, value) {
  for (const [key, item] of Object.entries(value)) {
    target[key] = item && typeof item === 'object' && !Array.isArray(item)
      ? merge(target[key] && typeof target[key] === 'object' ? target[key] : {}, item)
      : clone(item);
  }
  return target;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function quotaError(code = 'resource-exhausted') {
  return Object.assign(new Error('Quota exceeded.'), { code });
}
function storage() {
  const map = new Map();
  return {
    map, get length() { return map.size; },
    key: index => Array.from(map.keys())[index] ?? null,
    getItem: key => map.has(String(key)) ? map.get(String(key)) : null,
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: key => { map.delete(String(key)); }
  };
}
function emptyState(owner) {
  return { trainerId: owner, enrollments: {}, executed: {}, lastFired: {}, logs: [], pending: {}, eventOnce: {} };
}
function fixture(options = {}) {
  const owner = options.owner || 'trainer-a';
  const clock = options.clock || { now: Date.parse('2026-09-23T10:00:00.000Z') };
  const sharedStorage = options.storage || storage();
  const remote = options.remote || new Map();
  const calls = { sets: [], transactions: [], reads: [], committed: [], notices: [] };
  const hooks = {};
  const state = clone(options.state || emptyState(owner));
  const client = { id: 'c1', trainerId: owner, name: 'Anna Nowak', status: 'active' };
  const flow = { id: 'af1', trainerId: owner, name: 'Raport', status: 'active', type: 'trigger', trigger: 'checkin.submitted', scope: 'all', steps: [{ type: 'task', text: 'Sprawdź raport {imie}', day: 0 }] };
  class ControlledDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const document = {
    querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
    dispatchEvent: () => true, addEventListener() {},
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }),
    documentElement: { style: { setProperty() {} } }, body: { appendChild() {} }
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, document,
    Date: ControlledDate, Math, JSON, Number, String, Object, Array, Set, Map,
    encodeURIComponent, decodeURIComponent, isFinite, isNaN, parseInt, parseFloat,
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    addEventListener() {}, removeEventListener() {},
    localStorage: sharedStorage,
    CustomEvent: function(type, init) { this.type = type; this.detail = init && init.detail; },
    _uid: owner, tenantSessionGeneration: 1, _clientAppMode: false,
    _afStateReady: true, _afStateDocId: owner, _db: {},
    AF_STATE: state, AUTOFLOWS: [flow], CL: [client], TASKS: [], MSGS: {}, FORM_SENDS: [], SE: [], PACKAGES: [], SETTINGS: {},
    renderAutoflows() {}, renderAutoflowLog() {},
    notify: (...args) => calls.notices.push(args),
    formatClientActivity: () => ({ days: 0 }),
    newId: prefix => prefix + '_' + clock.now,
    _doc: (_db, collection, id) => collection + '/' + id
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx._setDoc = async (ref, data, opts) => {
    const call = { ref, data: clone(data), opts: clone(opts) };
    calls.sets.push(call);
    if (hooks.beforeSet) await hooks.beforeSet(call, calls.sets.length);
    remote.set(ref, opts && opts.merge ? merge(clone(remote.get(ref) || {}), call.data) : clone(call.data));
    if (hooks.afterSet) await hooks.afterSet(call, calls.sets.length);
  };
  let transactionTail = Promise.resolve();
  ctx._runTransaction = (_db, callback, options) => {
    const call = { options: clone(options), writes: [], reads: [] };
    calls.transactions.push(call);
    const work = transactionTail.then(async () => {
      if (hooks.beforeTransaction) await hooks.beforeTransaction(call, calls.transactions.length);
      let writing = false;
      const result = await callback({
        get: async ref => {
          assert.equal(writing, false, 'Firestore transaction reads must precede writes');
          calls.reads.push(ref); call.reads.push(ref);
          const value = clone(remote.get(ref));
          return { exists: () => value !== undefined, data: () => clone(value) };
        },
        set: (ref, data, opts) => { writing = true; call.writes.push({ ref, data: clone(data), opts: clone(opts) }); }
      });
      for (const write of call.writes) {
        remote.set(write.ref, write.opts && write.opts.merge ? merge(clone(remote.get(write.ref) || {}), write.data) : clone(write.data));
        calls.committed.push(clone(write));
      }
      if (hooks.afterTransaction) await hooks.afterTransaction(call, result);
      return result;
    });
    transactionTail = work.catch(() => {});
    return work;
  };
  if (!remote.has('automationState/' + owner)) remote.set('automationState/' + owner, clone(state));
  if (!remote.has('clients/c1')) remote.set('clients/c1', clone(client));
  if (!remote.has('autoflows/af1')) remote.set('autoflows/af1', clone(flow));
  vm.createContext(ctx);
  vm.runInContext(bundle, ctx, { filename: 'real-autoflow-functions.js' });
  ctx.renderAutoflows = () => {}; ctx.renderAutoflowLog = () => {};
  return {
    ctx, state, owner, client, flow, clock, storage: sharedStorage, remote, calls, hooks,
    queue(mark = 'report-1') {
      assert.equal(ctx.queueAFStep(flow.steps[0], client, flow, mark, 0, false), true, 'fixture queue accepted');
      return state.pending[Object.keys(state.pending).find(id => state.pending[id] && state.pending[id].mark === mark)];
    },
    effects() { return [...remote.entries()].filter(([key]) => ['tasks/','messages/','formSends/'].some(prefix => key.startsWith(prefix))); },
    counts() { return { sets: calls.sets.length, transactions: calls.transactions.length, effects: this.effects().length }; }
  };
}
async function settle(f) {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    if (f.ctx._afRetryRunning) await f.ctx._afRetryRunning;
    if (f.ctx._afQueueRunning) await f.ctx._afQueueRunning;
  }
}
async function until(predicate) {
  for (let i = 0; i < 60; i++) { if (predicate()) return; await Promise.resolve(); }
  assert.fail('fixture awaited operation did not start');
}
async function pauseWithTransactionQuota(f) {
  f.hooks.beforeTransaction = () => { throw quotaError(); };
  const job = f.queue();
  await f.ctx.drainAFQueue();
  assert(f.ctx.afQuotaPauseUntil() > f.clock.now, 'quota pause recorded');
  return job;
}
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }


test('only explicit Firestore quota codes open the circuit', async () => {
  const f = fixture();
  assert.equal(f.ctx.afIsQuotaError(quotaError()), true);
  assert.equal(f.ctx.afIsQuotaError(quotaError('firestore/resource-exhausted')), true);
  for (const error of [new Error('Quota exceeded'), { code: 'permission-denied' }, { code: 'unavailable' }, null]) {
    assert.equal(f.ctx.afIsQuotaError(error), false);
    assert.equal(f.ctx.afPauseForQuota(error, f.ctx.afQueueSession()), false);
  }
  assert.equal(f.ctx.afQuotaPauseUntil(), 0);
});

test('one quota transaction stops a large drain without touching later jobs', async () => {
  const f = fixture();
  f.hooks.beforeTransaction = () => { throw quotaError(); };
  const jobs = Array.from({ length: 30 }, (_, i) => f.queue('report-' + i));
  const untouched = jobs.slice(1).map(clone);
  await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), { sets: 1, transactions: 1, effects: 0 });
  assert.equal(f.ctx.afQuotaPauseUntil(), f.clock.now + 15 * 60000);
  assert.equal(jobs[0].attempts, 0);
  assert.equal(jobs[0].status, 'pending');
  assert.equal(jobs[0].nextRetry, f.ctx.afQuotaPauseUntil());
  assert.equal(jobs[0].errorCode, 'autoflow-quota');
  assert.deepEqual(jobs.slice(1).map(clone), untouched);
  assert.equal(Object.keys(f.state.executed).length, 0);
  assert.equal(f.state.logs.length, 0, 'quota must not create one failed-attempt log per job');
});

test('quota in the intent write makes exactly one network call and no transaction', async () => {
  const f = fixture();
  f.hooks.beforeSet = () => { throw quotaError('firestore/resource-exhausted'); };
  const jobs = Array.from({ length: 12 }, (_, i) => f.queue('intent-' + i));
  const untouched = jobs.slice(1).map(clone);
  await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), { sets: 1, transactions: 0, effects: 0 });
  assert.equal(jobs[0].attempts, 0);
  assert.equal(jobs[0].status, 'pending');
  assert.deepEqual(jobs.slice(1).map(clone), untouched);
});

test('manual, timer and save calls during pause make no further network requests', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f);
  const paused = clone(job), before = f.counts();
  for (let i = 0; i < 10; i++) {
    await f.ctx.drainAFQueue();
    await f.ctx.retryAutoflowFailures();
    f.ctx.runAutoflowsCheck(i % 2 === 0);
    assert.equal(await f.ctx.saveAutomationState(false), false);
    await assert.rejects(f.ctx.saveAutomationState(true), error => error.code === 'autoflow-quota-paused');
  }
  await settle(f);
  assert.deepEqual(f.counts(), before);
  assert.deepEqual(clone(job), paused);
  assert.equal(f.ctx.afQuotaPauseUntil(), f.clock.now + 15 * 60000, 'polling must not extend the pause');
});

test('manual retry cannot reset an exhausted job while quota is paused', async () => {
  const f = fixture();
  await pauseWithTransactionQuota(f);
  const job = f.queue('exhausted');
  Object.assign(job, { status: 'error', attempts: 5, nextRetry: f.clock.now + 30000, retryRequestId: 'original' });
  f.state.serverStatus = { [job.id]: { status: 'exhausted' } };
  const before = clone(job), counts = f.counts();
  assert.equal(await f.ctx.retryAutoflowFailures(), false);
  assert.deepEqual(clone(job), before);
  assert.deepEqual(f.counts(), counts);
});

test('new jobs accepted during pause survive reloading the same trainer', async () => {
  const f = fixture();
  const first = await pauseWithTransactionQuota(f);
  const second = f.queue('queued-while-paused');
  const before = f.counts();
  await settle(f);
  assert.deepEqual(f.counts(), before);
  const reloaded = fixture({ storage: f.storage, clock: f.clock });
  reloaded.ctx.ensureAfState();
  assert.deepEqual(clone(reloaded.state.pending[first.id]), clone(first));
  assert.deepEqual(clone(reloaded.state.pending[second.id]), clone(second));
  await reloaded.ctx.drainAFQueue();
  assert.deepEqual(reloaded.counts(), { sets: 0, transactions: 0, effects: 0 });
});

test('a second open tab observes the shared pause without a storage event', async () => {
  const shared = storage(), clock = { now: Date.parse('2026-09-23T10:00:00Z') };
  const a = fixture({ storage: shared, clock }), b = fixture({ storage: shared, clock });
  assert.equal(b.ctx.afQuotaPaused(), false);
  await pauseWithTransactionQuota(a);
  b.queue('other-tab');
  await b.ctx.drainAFQueue();
  assert.equal(b.ctx.afQuotaPauseUntil(), a.ctx.afQuotaPauseUntil());
  assert.deepEqual(b.counts(), { sets: 0, transactions: 0, effects: 0 });
});

test('quota and the durable outbox are isolated between trainers', async () => {
  const shared = storage();
  const a = fixture({ storage: shared });
  const aJob = await pauseWithTransactionQuota(a);
  const b = fixture({ owner: 'trainer-b', storage: shared, clock: a.clock });
  b.ctx.ensureAfState();
  assert.equal(b.ctx.afQuotaPaused(), false);
  assert.equal(b.state.pending[aJob.id], undefined);
  const bJob = b.queue('own-report');
  await b.ctx.drainAFQueue();
  assert.equal(b.effects().length, 1);
  assert.equal(b.effects()[0][1].trainerId, 'trainer-b');
  assert.equal(b.state.pending[bJob.id], null);
  assert(a.state.pending[aJob.id]);
});

test('expiry retries the waiting job once and clears its durable copy after receipt', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f);
  f.hooks.beforeTransaction = null;
  f.clock.now = f.ctx.afQuotaPauseUntil() - 1;
  await f.ctx.drainAFQueue();
  assert.equal(f.calls.transactions.length, 1);
  f.clock.now++;
  await f.ctx.drainAFQueue();
  assert.equal(f.calls.transactions.length, 2);
  assert.equal(f.effects().length, 1);
  assert.equal(f.state.pending[job.id], null);
  assert.equal(f.state.executed.af1.c1[job.mark], true);
  const reloaded = fixture({ storage: f.storage, clock: f.clock });
  reloaded.ctx.ensureAfState();
  assert.equal(reloaded.state.pending[job.id], undefined, 'acknowledged job must be removed from the local outbox');
  const before = f.counts();
  await f.ctx.drainAFQueue(); await f.ctx.retryAutoflowFailures();
  assert.deepEqual(f.counts(), before);
});

test('a quota-shaped lost acknowledgement recovers the receipt without overwriting a completed task', async () => {
  const f = fixture();
  let failAck = true;
  f.hooks.afterTransaction = () => { if (failAck) { failAck = false; throw quotaError(); } };
  const job = f.queue();
  await f.ctx.drainAFQueue();
  const key = 'tasks/' + job.id + '_task';
  assert.equal(f.effects().length, 1);
  f.remote.get(key).status = 'done';
  f.remote.get(key).title = 'Zmienione przez trenera';
  const preserved = clone(f.remote.get(key));
  f.clock.now = f.ctx.afQuotaPauseUntil();
  await f.ctx.drainAFQueue();
  assert.equal(f.calls.transactions.length, 2);
  assert.deepEqual(f.remote.get(key), preserved);
  assert.equal(f.calls.committed.filter(write => write.ref === key).length, 1);
  assert.equal(f.state.pending[job.id], null);
  assert.equal(f.state.executed.af1.c1[job.mark], true);
});

test('quota after a confirmed effect never resurrects the completed job', async () => {
  const f = fixture();
  f.hooks.beforeSet = (_call, count) => { if (count === 2) throw quotaError(); };
  const job = f.queue();
  await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), { sets: 2, transactions: 1, effects: 1 });
  assert.equal(f.ctx.afQuotaPaused(), true);
  assert.equal(f.state.pending[job.id], null);
  assert.equal(f.state.executed.af1.c1[job.mark], true);
  assert.equal(f.ctx.TASKS.length, 1);
  assert.equal(f.remote.get('automationState/' + f.owner).logs.length, 0, 'quota prevented the final history save');
  f.hooks.beforeSet = null;
  f.clock.now = f.ctx.afQuotaPauseUntil();
  await f.ctx.drainAFQueue();
  assert.equal(f.calls.transactions.length, 1);
  assert.equal(f.effects().length, 1);
  assert.equal(f.calls.sets.length, 3, 'resume confirms only the previously unsaved history');
  assert.deepEqual(f.remote.get('automationState/' + f.owner).logs, clone(f.state.logs));
  assert.equal(f.remote.get('automationState/' + f.owner).executed.af1.c1[job.mark], true);
  const reloaded = fixture({ storage: f.storage, clock: f.clock });
  reloaded.ctx.ensureAfState();
  assert.equal(reloaded.state.pending[job.id], undefined);
});

test('a failed response from an old session cannot pause or mutate the next trainer', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.beforeTransaction = () => gate.promise;
  f.queue();
  const active = f.ctx.drainAFQueue();
  await until(() => f.calls.transactions.length === 1);
  const nextState = emptyState('trainer-b');
  f.ctx._uid = 'trainer-b'; f.ctx.tenantSessionGeneration++;
  f.ctx.AF_STATE = nextState; f.ctx._afStateDocId = 'trainer-b';
  const expected = clone(nextState);
  gate.reject(quotaError());
  await active;
  assert.equal(f.ctx.afQuotaPauseUntil('trainer-b'), 0);
  assert.equal(f.ctx.afQuotaPauseUntil('trainer-a'), 0);
  assert.deepEqual(nextState, expected);
  assert.equal(f.calls.sets.length, 1);
  assert.equal(f.effects().length, 0);
});

test('same-UID reauthentication cannot send a stale queued effect', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.beforeTransaction = () => gate.promise;
  f.queue();
  const active = f.ctx.drainAFQueue();
  await until(() => f.calls.transactions.length === 1);
  f.ctx.tenantSessionGeneration++;
  const nextState = emptyState(f.owner); f.ctx.AF_STATE = nextState;
  gate.resolve(); await active;
  assert.equal(f.effects().length, 0);
  assert.equal(f.ctx.TASKS.length, 0);
  assert.deepEqual(nextState, emptyState(f.owner));
});

test('an effect acknowledged after a session change has no local or follow-up effects', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.afterTransaction = () => gate.promise;
  f.queue();
  const active = f.ctx.drainAFQueue();
  await until(() => f.effects().length === 1);
  f.ctx.tenantSessionGeneration++;
  const nextState = emptyState(f.owner); f.ctx.AF_STATE = nextState;
  gate.resolve(); await active;
  assert.equal(f.effects().length, 1, 'already committed remote transaction remains acknowledged remotely');
  assert.equal(f.ctx.TASKS.length, 0);
  assert.equal(f.calls.sets.length, 1, 'old session must not issue the follow-up state save');
  assert.deepEqual(nextState, emptyState(f.owner));
});

test('quota does not consume pre-existing retry attempts', async () => {
  const f = fixture();
  f.hooks.beforeTransaction = () => { throw quotaError(); };
  const job = f.queue(); job.attempts = 4;
  await f.ctx.drainAFQueue();
  assert.equal(job.attempts, 4);
  assert.equal(job.status, 'pending');
  f.hooks.beforeTransaction = null;
  f.clock.now = f.ctx.afQuotaPauseUntil();
  await f.ctx.drainAFQueue();
  assert.equal(f.effects().length, 1);
  assert.equal(f.state.pending[job.id], null);
});

test('ordinary connection failure retains per-job backoff without opening the quota circuit', async () => {
  const f = fixture();
  f.hooks.beforeTransaction = () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); };
  const job = f.queue();
  await f.ctx.drainAFQueue();
  assert.equal(f.ctx.afQuotaPaused(), false);
  assert.equal(job.status, 'error');
  assert.equal(job.attempts, 1);
  assert.equal(job.nextRetry, f.clock.now + 60000);
  assert.equal(f.calls.transactions.length, 1);
  assert.equal(f.calls.sets.length, 2, 'ordinary failure still records its per-job outcome');
});

test('all effect transactions explicitly disable automatic SDK retries', async () => {
  const f = fixture();
  await pauseWithTransactionQuota(f);
  f.hooks.beforeTransaction = null; f.clock.now = f.ctx.afQuotaPauseUntil();
  await f.ctx.drainAFQueue();
  assert.equal(f.calls.transactions.length, 2);
  for (const call of f.calls.transactions) assert.deepEqual(call.options, { maxAttempts: 1 });
});

test('coalesced state saves cannot fan out a quota failure into repeated writes', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.beforeSet = () => gate.promise;
  const results = Array.from({ length: 20 }, () => f.ctx.saveAutomationState(false));
  await until(() => f.calls.sets.length === 1);
  gate.reject(quotaError());
  assert((await Promise.all(results)).every(result => result === false));
  assert.deepEqual(f.counts(), { sets: 1, transactions: 0, effects: 0 });
  assert.equal(f.ctx.afQuotaPaused(), true);
  await f.ctx.saveAutomationState(false);
  assert.equal(f.calls.sets.length, 1);
});

test('coalesced state saves capture the latest state after the in-flight write', async () => {
  const f = fixture(), gate = deferred();
  f.hooks.beforeSet = (_call, count) => count === 1 ? gate.promise : undefined;
  const first = f.ctx.saveAutomationState(true);
  await until(() => f.calls.sets.length === 1);
  f.state.eventOnce.newEvent = true;
  const second = f.ctx.saveAutomationState(true);
  gate.resolve();
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(f.calls.sets.length, 2);
  assert.equal(f.remote.get('automationState/' + f.owner).eventOnce.newEvent, true);
  await f.ctx.saveAutomationState(true);
  assert.equal(f.calls.sets.length, 2, 'unchanged state must not be rewritten');
});

test('remote pending null and receipts override stale durable copies', async () => {
  const f = fixture();
  const first = await pauseWithTransactionQuota(f), second = f.queue('receipt-job');
  const remoteState = emptyState(f.owner);
  remoteState.pending[first.id] = null;
  remoteState.afReceipts = { [second.id]: second.createdAt };
  const reloaded = fixture({ storage: f.storage, clock: f.clock, state: remoteState });
  reloaded.ctx.ensureAfState();
  assert.equal(reloaded.state.pending[first.id], null);
  assert.equal(reloaded.state.pending[second.id], undefined);
  const cleanReload = fixture({ storage: f.storage, clock: f.clock });
  cleanReload.ctx.ensureAfState();
  assert.equal(Object.keys(cleanReload.state.pending).length, 0, 'authoritative tombstones must also clean durable copies');
});

test('remote pending job wins over an older durable version', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f);
  const remoteState = emptyState(f.owner);
  remoteState.pending[job.id] = { ...clone(job), attempts: 3, nextRetry: f.clock.now + 500000, status: 'error', retryRequestId: 'server-newer' };
  const reloaded = fixture({ storage: f.storage, clock: f.clock, state: remoteState });
  reloaded.ctx.ensureAfState();
  assert.deepEqual(clone(reloaded.state.pending[job.id]), remoteState.pending[job.id]);
});

test('corrupt, foreign-owner and mismatched-id durable jobs are ignored', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f);
  const prefix = f.ctx.afPendingStoragePrefix(f.owner);
  f.storage.setItem(prefix + 'broken-json', '{');
  f.storage.setItem(prefix + encodeURIComponent(job.id + '-foreign'), JSON.stringify({ ...clone(job), id: job.id + '-foreign', owner: 'trainer-b' }));
  f.storage.setItem(prefix + encodeURIComponent(job.id + '-bad-id'), JSON.stringify({ ...clone(job), id: job.id + '-bad-id' }));
  const reloaded = fixture({ storage: f.storage, clock: f.clock });
  reloaded.ctx.ensureAfState();
  assert.deepEqual(Object.keys(reloaded.state.pending), [job.id]);
});

test('blocked localStorage still pauses the current tab and retains jobs in memory', async () => {
  const blocked = { get length() { throw new Error('storage disabled'); }, key() { throw new Error('storage disabled'); }, getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('storage disabled'); }, removeItem() { throw new Error('storage disabled'); } };
  const f = fixture({ storage: blocked });
  const job = await pauseWithTransactionQuota(f);
  assert.equal(f.ctx._afPendingStorageFailed, true);
  assert.equal(f.ctx.afQuotaPauseUntil(), f.clock.now + 15 * 60000);
  assert.equal(f.state.pending[job.id], job);
  const before = f.counts();
  await f.ctx.retryAutoflowFailures(); await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), before);
});

test('a healthy drain handles at most five jobs per pass and eventually completes all jobs', async () => {
  const f = fixture();
  const jobs = Array.from({ length: 12 }, (_, i) => f.queue('batch-' + i));
  await f.ctx.drainAFQueue();
  assert.equal(f.effects().length, 5);
  assert.equal(jobs.filter(job => f.state.pending[job.id]).length, 7);
  assert(jobs.slice(5).every(job => job.attempts === 0));
  await f.ctx.drainAFQueue(); assert.equal(f.effects().length, 10);
  await f.ctx.drainAFQueue(); assert.equal(f.effects().length, 12);
  assert(jobs.every(job => f.state.pending[job.id] === null));
  assert.equal(new Set(f.effects().map(([key]) => key)).size, 12);
});


test('Web Locks prevents a second tab from starting the same drain before quota is observed', async () => {
  const shared = storage(), remote = new Map(), requests = [];
  let held = false;
  const locks = { async request(name, options, callback) {
    requests.push({ name, options: clone(options) });
    if (held) return callback(null);
    held = true;
    try { return await callback({ name }); } finally { held = false; }
  } };
  const a = fixture({ storage: shared, remote }), b = fixture({ storage: shared, remote, clock: a.clock });
  a.ctx.navigator = b.ctx.navigator = { locks };
  const gate = deferred();
  a.hooks.beforeTransaction = () => gate.promise;
  a.queue('same-event');
  const active = a.ctx.drainAFQueue();
  await until(() => a.calls.transactions.length === 1);
  b.ctx.ensureAfState();
  const restored = Object.values(b.state.pending).find(Boolean), before = clone(restored);
  assert(restored, 'second tab sees the durable pending intent');
  await b.ctx.drainAFQueue();
  assert.deepEqual(b.counts(), { sets: 0, transactions: 0, effects: 0 });
  assert.deepEqual(clone(restored), before);
  assert(requests.length >= 2);
  assert(requests.every(request => request.name === 'progress-live-autoflow:' + a.owner && request.options.ifAvailable === true));
  gate.reject(quotaError()); await active;
  await b.ctx.drainAFQueue();
  assert.equal(b.ctx.afQuotaPaused(), true);
  assert.deepEqual(b.counts(), { sets: 0, transactions: 0, effects: 0 });
});

test('an intent rejected by quota can be restored after reload and committed exactly once', async () => {
  const f = fixture();
  f.hooks.beforeSet = () => { throw quotaError(); };
  const job = f.queue('durable-intent');
  await f.ctx.drainAFQueue();
  assert.equal(f.remote.get('automationState/' + f.owner).pending[job.id], undefined, 'intent never reached Firestore');
  const reloaded = fixture({ storage: f.storage, clock: f.clock, remote: f.remote });
  reloaded.ctx.ensureAfState();
  assert(reloaded.state.pending[job.id]);
  reloaded.clock.now = reloaded.ctx.afQuotaPauseUntil();
  await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.effects().length, 1);
  assert.equal(reloaded.effects()[0][1].id, job.id + '_task');
  assert.equal(reloaded.state.pending[job.id], null);
  assert.equal(reloaded.remote.get('automationState/' + f.owner).afReceipts[job.id], job.createdAt);
  await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.calls.transactions.length, 1);
});

test('direct effect execution is quota-gated as well as the queue entry point', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f), before = f.counts();
  await assert.rejects(f.ctx.execAFStep(job.step, f.client, f.flow, job), error => error.code === 'autoflow-quota-paused');
  assert.deepEqual(f.counts(), before);
});

test('quota while saving an ordinary failure still stops later jobs without repeated error writes', async () => {
  const f = fixture();
  f.hooks.beforeTransaction = () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); };
  f.hooks.beforeSet = (_call, count) => { if (count === 2) throw quotaError(); };
  const jobs = Array.from({ length: 8 }, (_, i) => f.queue('failure-' + i));
  const untouched = jobs.slice(1).map(clone);
  await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), { sets: 2, transactions: 1, effects: 0 });
  assert.equal(f.ctx.afQuotaPaused(), true);
  assert.equal(jobs[0].attempts, 1, 'the real non-quota failure remains an attempted delivery');
  assert.deepEqual(jobs.slice(1).map(clone), untouched);
});

test('reloading remote pending after transaction quota does not spend a retry attempt', async () => {
  const f = fixture();
  const job = await pauseWithTransactionQuota(f);
  const remoteState = clone(f.remote.get('automationState/' + f.owner));
  assert.equal(remoteState.pending[job.id].attempts, 0, 'intent written before quota must not increment attempts');
  const reloaded = fixture({ storage: f.storage, clock: f.clock, remote: f.remote, state: remoteState });
  reloaded.ctx.ensureAfState();
  assert.equal(reloaded.state.pending[job.id].attempts, 0);
  await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.calls.transactions.length, 0);
  reloaded.clock.now = reloaded.ctx.afQuotaPauseUntil();
  await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.effects().length, 1);
  assert.equal(reloaded.state.pending[job.id], null);
});

test('a new system definition rejected by quota gets the same ID after reload and resumes its queued event', async () => {
  const f = fixture();
  f.ctx.AUTOFLOWS = [];
  f.ctx.SETTINGS = { notifications: { sessionReminder: false, inactiveClient: false, checkinThanks: true } };
  f.hooks.beforeSet = () => { throw quotaError(); };
  assert.equal(f.ctx.ensureReminderAutoflowsFromSettings(), true);
  const firstFlow = f.ctx.AUTOFLOWS.find(flow => flow.systemKey === 'pl-checkin-submitted');
  assert(firstFlow);
  assert.equal(f.ctx.queueAFStep(firstFlow.steps[0], f.client, firstFlow, 'checkin.submitted:c1:ci1:0', 0, false), true);
  const job = Object.values(f.state.pending).find(Boolean);
  await f.ctx.flushAFDefinitions(); await f.ctx.drainAFQueue();
  assert.deepEqual(f.counts(), { sets: 1, transactions: 0, effects: 0 });
  assert.equal(f.remote.has('autoflows/' + firstFlow.id), false);
  const before = f.counts();
  f.ctx.ensureReminderAutoflowsFromSettings(); await f.ctx.flushAFDefinitions();
  assert.deepEqual(f.counts(), before);
  const reloaded = fixture({ storage: f.storage, clock: f.clock, remote: f.remote, state: f.remote.get('automationState/' + f.owner) });
  reloaded.ctx.AUTOFLOWS = [];
  reloaded.ctx.SETTINGS = clone(f.ctx.SETTINGS);
  reloaded.ctx.ensureAfState();
  assert(reloaded.state.pending[job.id]);
  reloaded.clock.now = reloaded.ctx.afQuotaPauseUntil();
  assert.equal(reloaded.ctx.ensureReminderAutoflowsFromSettings(), true);
  const restoredFlow = reloaded.ctx.AUTOFLOWS.find(flow => flow.systemKey === 'pl-checkin-submitted');
  assert.equal(restoredFlow.id, firstFlow.id);
  await reloaded.ctx.flushAFDefinitions(); await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.remote.get('autoflows/' + firstFlow.id).trainerId, f.owner);
  assert.equal(reloaded.effects().length, 1);
  assert.equal(reloaded.effects()[0][1].id, job.id + '_msg');
  assert.equal(reloaded.state.pending[job.id], null);
  await reloaded.ctx.drainAFQueue();
  assert.equal(reloaded.calls.transactions.length, 1);
});

test('executed event and one-shot markers prevent stale local jobs from returning', async () => {
  const f = fixture();
  const eventJob = await pauseWithTransactionQuota(f);
  const onceFlow = { ...f.flow, id: 'once-flow', trigger: 'new_client' };
  f.ctx.AUTOFLOWS.push(onceFlow);
  assert.equal(f.ctx.queueAFStep(onceFlow.steps[0], f.client, onceFlow, 'new_client:c1:0', 0, true), true);
  const onceJob = Object.values(f.state.pending).find(job => job && job.oneShot);
  const remoteState = emptyState(f.owner);
  remoteState.executed = { af1: { c1: { [eventJob.mark]: true } }, 'once-flow': { c1: { 0: true } } };
  const reloaded = fixture({ storage: f.storage, clock: f.clock, state: remoteState });
  reloaded.ctx.ensureAfState();
  assert.equal(reloaded.state.pending[eventJob.id], undefined);
  assert.equal(reloaded.state.pending[onceJob.id], undefined);
  const cleanReload = fixture({ storage: f.storage, clock: f.clock });
  cleanReload.ctx.ensureAfState();
  assert.equal(Object.keys(cleanReload.state.pending).length, 0);
});

async function run() {
  let passed = 0;
  for (const { name, fn } of tests) {
    try { await fn(); passed++; console.log('OK   ' + name); }
    catch (error) { error.message = name + ': ' + error.message; throw error; }
  }
  console.log('PASS ' + passed + '/' + tests.length + ' Autoflow quota regression scenarios');
  return { passed, total: tests.length };
}
module.exports = { run };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
