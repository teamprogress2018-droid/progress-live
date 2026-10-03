'use strict';

const assert = require('node:assert/strict');
const {memoryFirestore} = require('./test-support.cjs');
const {processPendingJob, drainPending} = require('./worker.cjs');

const NOW = Date.parse('2026-09-26T10:00:00.000Z');
const OWNER = 'trainer-test';
const CONTROL = 'serverAutomation/private/trainers/' + OWNER;
const STATE = 'automationState/state-test';
const AF = 'autoflows/flow-document';
const CLIENT = 'clients/client-document';

function fixture(options = {}) {
  const afId = 'flow-1', clientId = 'client-1', si = 0;
  const mark = 'checkin.submitted:checkin-1:0';
  const step = {type: options.type || 'task', text: 'Sprawdź postęp {imie}', day: 0};
  const id = 'af_' + encodeURIComponent(JSON.stringify([OWNER, afId, clientId, mark]));
  const job = {id, owner: OWNER, afId, clientId, afDocId: 'flow-document', clientDocId: 'client-document',
    mark, si, oneShot: false, step, createdAt: new Date(NOW - 10000).toISOString(), attempts: 0,
    nextRetry: 0, status: 'pending'};
  const af = {id: afId, trainerId: OWNER, name: 'Kontrola po raporcie', trigger: 'checkin.submitted',
    status: 'active', scope: 'all', steps: [step], createdAt: '2026-09-01T10:00:00.000Z'};
  const client = {id: clientId, trainerId: OWNER, name: 'Alicja Testowa', status: 'active',
    joinDate: '2026-09-02', createdAt: '2026-09-02T10:00:00.000Z'};
  const control = {enabled: true, schemaVersion: 1, stateDocId: 'state-test',
    enabledAt: new Date(NOW - 60000).toISOString(), timeZone: 'Europe/Warsaw'};
  const state = {trainerId: OWNER, pending: {[id]: job}, afReceipts: {}, executed: {}, lastFired: {}, logs: []};
  const db = memoryFirestore({[CONTROL]: control, [STATE]: state, [AF]: af, [CLIENT]: client});
  const args = {trainerId: OWNER, stateDocId: 'state-test', jobId: id, runId: 'run-test', nowMs: NOW};
  return {db, args, job, af, client, control, state, id, ledgerPath: CONTROL + '/jobs/' + id,
    taskPath: 'tasks/' + id + '_task', messagePath: 'messages/' + id + '_msg'};
}

function effects(db) {
  return db.entries().filter(([path]) => /^(tasks|messages|formSends)\//.test(path));
}

const tests = [];
function test(name, fn) { tests.push({name, fn}); }

test('a valid queued task commits the same receipt used by the browser', async () => {
  const f = fixture();
  const result = await processPendingJob(f.db, f.args);
  assert.equal(result.status, 'done');
  const task = f.db.read(f.taskPath);
  assert.equal(task.trainerId, OWNER);
  assert.equal(task.clientId, f.client.id);
  assert.equal(task.title, 'Sprawdź postęp Alicja');
  assert.equal(task.status, 'open');
  assert.equal(effects(f.db).length, 1);
  const state = f.db.read(STATE);
  assert.ok(state.afReceipts[f.id]);
  assert.equal(state.pending[f.id], null);
  assert.equal(state.executed[f.af.id][f.client.id][f.job.mark], true);
  assert.ok(state.lastFired[f.af.id][f.client.id][0]);
  assert.equal(state.serverStatus[f.id].status, 'done');
  assert.equal(state.serverStatus[f.id].attempts, 1);
  assert.equal(f.db.read(f.ledgerPath).status, 'done');
  assert.equal(f.db.read(f.ledgerPath).attempts, 1);
});

test('two simultaneous server invocations create only one client-visible effect', async () => {
  const f = fixture();
  const results = await Promise.all([
    processPendingJob(f.db, {...f.args, runId: 'server-a'}),
    processPendingJob(f.db, {...f.args, runId: 'server-b'}),
  ]);
  assert.equal(results.filter(result => result.status === 'done').length, 1);
  assert.equal(effects(f.db).length, 1);
  assert.equal(f.db.commits.flat().filter(write => write.path === f.taskPath).length, 1);
});

test('a browser receipt prevents rewriting a task subsequently completed by the client', async () => {
  const f = fixture();
  f.state.afReceipts[f.id] = f.job.createdAt;
  f.db.seed(STATE, f.state);
  const completed = {id: f.id + '_task', trainerId: OWNER, clientId: f.client.id,
    title: 'Edytowane przez trenera', status: 'done', completedAt: new Date(NOW).toISOString()};
  f.db.seed(f.taskPath, completed);
  const result = await processPendingJob(f.db, f.args);
  assert.equal(result.status, 'already-done');
  assert.deepEqual(f.db.read(f.taskPath), completed);
  assert.equal(f.db.commits.flat().filter(write => write.path === f.taskPath).length, 0);
});

test('disabled, missing, mismatched and unsupported controls never execute', async () => {
  for (const mutate of [
    f => { f.control.enabled = false; f.db.seed(CONTROL, f.control); },
    f => f.db.remove(CONTROL),
    f => { f.control.stateDocId = 'another-state'; f.db.seed(CONTROL, f.control); },
    f => { f.control.schemaVersion = 99; f.db.seed(CONTROL, f.control); },
  ]) {
    const f = fixture(); mutate(f);
    const result = await processPendingJob(f.db, f.args);
    assert.notEqual(result.status, 'done');
    assert.equal(effects(f.db).length, 0);
    assert.equal(f.db.read(STATE).afReceipts[f.id], undefined);
  }
});

test('paused flow, archived client and out-of-scope client are blocked', async () => {
  for (const mutate of [
    f => { f.af.status = 'paused'; f.db.seed(AF, f.af); },
    f => { f.client.status = 'archived'; f.db.seed(CLIENT, f.client); },
    f => { f.af.scope = 'select'; f.af.clientIds = ['someone-else']; f.db.seed(AF, f.af); },
    f => { f.af.scope = 'new'; f.af.createdAt = '2026-09-20T00:00:00Z'; f.db.seed(AF, f.af); },
  ]) {
    const f = fixture(); mutate(f);
    assert.equal((await processPendingJob(f.db, f.args)).status, 'blocked');
    assert.equal(effects(f.db).length, 0);
  }
});

test('foreign owner in state, queue, flow or client cannot produce an effect', async () => {
  for (const mutate of [
    f => { f.state.trainerId = 'foreign'; f.db.seed(STATE, f.state); },
    f => { f.job.owner = 'foreign'; f.db.seed(STATE, f.state); },
    f => { f.af.trainerId = 'foreign'; f.db.seed(AF, f.af); },
    f => { f.client.trainerId = 'foreign'; f.db.seed(CLIENT, f.client); },
  ]) {
    const f = fixture(); mutate(f);
    const result = await processPendingJob(f.db, f.args);
    assert.notEqual(result.status, 'done');
    assert.equal(effects(f.db).length, 0);
  }
});

test('owned document references must still match the logical flow and client IDs', async () => {
  for (const mutate of [
    f => { f.af.id = 'different-flow'; f.db.seed(AF, f.af); },
    f => { f.client.id = 'different-client'; f.db.seed(CLIENT, f.client); },
  ]) {
    const f = fixture(); mutate(f);
    const result = await processPendingJob(f.db, f.args);
    assert.notEqual(result.status, 'done');
    assert.equal(effects(f.db).length, 0);
  }
});

test('an existing effect without a receipt is preserved for manual reconciliation', async () => {
  for (const trainerId of [OWNER, 'foreign-trainer']) {
    const f = fixture();
    const existing = {id: f.id + '_task', trainerId, clientId: f.client.id,
      title: 'Zachowaj zapisany wynik', status: 'done'};
    f.db.seed(f.taskPath, existing);
    const result = await processPendingJob(f.db, f.args);
    assert.notEqual(result.status, 'done');
    assert.deepEqual(f.db.read(f.taskPath), existing);
    assert.equal(f.db.read(STATE).afReceipts[f.id], undefined);
  }
});

test('forged queue ID, invalid step index and forged document paths are rejected', async () => {
  for (const mutate of [
    f => { f.job.id = 'forged'; f.db.seed(STATE, f.state); },
    f => { f.job.si = 100; f.db.seed(STATE, f.state); },
    f => { f.job.afDocId = 'outside/collection'; f.db.seed(STATE, f.state); },
    f => { f.job.clientDocId = '../clients'; f.db.seed(STATE, f.state); },
  ]) {
    const f = fixture(); mutate(f);
    const result = await processPendingJob(f.db, f.args);
    assert.notEqual(result.status, 'done');
    assert.equal(effects(f.db).length, 0);
  }
});

test('editing any material step field after queuing prevents an outdated action', async () => {
  for (const change of [{text: 'Inna wiadomość'}, {type: 'message'}, {day: 7}]) {
    const f = fixture();
    f.af.steps = [{...f.af.steps[0], ...change}];
    f.db.seed(AF, f.af);
    assert.equal((await processPendingJob(f.db, f.args)).status, 'step-changed');
    assert.equal(effects(f.db).length, 0);
  }
});

test('forms remain queued for the browser without pretending to send a form', async () => {
  const f = fixture({type: 'form'});
  assert.equal((await processPendingJob(f.db, f.args)).status, 'browser-required');
  assert.equal(effects(f.db).length, 0);
  assert.ok(f.db.read(STATE).pending[f.id]);
  assert.equal(f.db.read(STATE).afReceipts[f.id], undefined);
});

test('messages resolve the name placeholder and preserve ownership', async () => {
  const f = fixture({type: 'message'});
  assert.equal((await processPendingJob(f.db, f.args)).status, 'done');
  const message = f.db.read(f.messagePath);
  assert.equal(message.text, 'Sprawdź postęp Alicja');
  assert.equal(message.trainerId, OWNER);
  assert.equal(message.clientId, f.client.id);
  assert.equal(message.kind, 'system');
  assert.equal(message.out, true);
});

test('jobs created before enablement or older than 24 hours are not replayed', async () => {
  for (const [createdAt, enabledAt, status] of [
    [NOW - 120000, NOW - 60000, 'before-enable'],
    [NOW - 86400001, NOW - 90000000, 'expired'],
  ]) {
    const f = fixture();
    f.job.createdAt = new Date(createdAt).toISOString();
    f.control.enabledAt = new Date(enabledAt).toISOString();
    f.db.seed(STATE, f.state); f.db.seed(CONTROL, f.control);
    assert.equal((await processPendingJob(f.db, f.args)).status, status);
    assert.equal(effects(f.db).length, 0);
  }
});

test('session reminders expire after 30 minutes', async () => {
  const f = fixture();
  f.af.trigger = 'session_today';
  f.job.createdAt = new Date(NOW - 1800001).toISOString();
  f.control.enabledAt = new Date(NOW - 3600000).toISOString();
  f.db.seed(AF, f.af); f.db.seed(STATE, f.state); f.db.seed(CONTROL, f.control);
  assert.equal((await processPendingJob(f.db, f.args)).status, 'expired');
  assert.equal(effects(f.db).length, 0);
});

test('precommit failure retains intent, enforces backoff and succeeds on retry', async () => {
  const f = fixture(); f.db.failNext('before');
  assert.equal((await processPendingJob(f.db, f.args)).status, 'error');
  assert.equal(effects(f.db).length, 0);
  let ledger = f.db.read(f.ledgerPath);
  assert.equal(ledger.attempts, 1);
  assert.ok(ledger.nextRetry >= NOW + 60000);
  assert.equal(f.db.read(STATE).serverStatus[f.id].status, 'error');
  assert.equal(f.db.read(STATE).serverStatus[f.id].attempts, ledger.attempts);
  assert.equal(f.db.read(STATE).serverStatus[f.id].nextRetry, ledger.nextRetry);
  assert.ok(f.db.read(STATE).pending[f.id]);
  assert.equal((await processPendingJob(f.db, {...f.args, nowMs: NOW + 1000})).status, 'backoff');
  assert.equal(f.db.read(f.ledgerPath).attempts, 1);
  assert.equal((await processPendingJob(f.db, {...f.args, nowMs: ledger.nextRetry + 1})).status, 'done');
  assert.equal(effects(f.db).length, 1);
});

test('five failed attempts exhaust retries, even if stale browser state resets attempts', async () => {
  const f = fixture();
  let nowMs = NOW;
  for (let attempt = 1; attempt <= 5; attempt++) {
    f.db.failNext('before');
    assert.equal((await processPendingJob(f.db, {...f.args, nowMs, runId: 'attempt-' + attempt})).status,
      attempt === 5 ? 'exhausted' : 'error');
    const ledger = f.db.read(f.ledgerPath);
    assert.equal(ledger.attempts, attempt);
    assert.ok(ledger.nextRetry >= nowMs + 60000 * (2 ** (attempt - 1)));
    nowMs = ledger.nextRetry + 1;
  }
  f.state.pending[f.id].attempts = 0;
  f.state.pending[f.id].nextRetry = 0;
  f.db.seed(STATE, f.state);
  assert.equal((await processPendingJob(f.db, {...f.args, nowMs})).status, 'exhausted');
  assert.equal(effects(f.db).length, 0);
  assert.equal(f.db.read(f.ledgerPath).attempts, 5);
});

test('an explicit new retry generation can resume an exhausted job', async () => {
  const f = fixture();
  f.db.seed(f.ledgerPath, {status: 'exhausted', attempts: 5, nextRetry: NOW + 3600000,
    retryRequestId: '', lastRunId: 'previous-run'});
  assert.equal((await processPendingJob(f.db, f.args)).status, 'exhausted');
  f.job.retryRequestId = 'retry-generation-2';
  f.job.attempts = 0; f.job.nextRetry = 0;
  f.db.seed(STATE, f.state);
  assert.equal((await processPendingJob(f.db, {...f.args, runId: 'explicit-retry'})).status, 'done');
  assert.equal(f.db.read(f.ledgerPath).attempts, 1);
  assert.equal(f.db.read(f.ledgerPath).retryRequestId, 'retry-generation-2');
  assert.equal(effects(f.db).length, 1);
});

test('a retry generation never reopens an expired intent', async () => {
  const f = fixture();
  f.job.createdAt = new Date(NOW - 86400001).toISOString();
  f.control.enabledAt = new Date(NOW - 90000000).toISOString();
  f.job.retryRequestId = 'retry-stale';
  f.db.seed(STATE, f.state); f.db.seed(CONTROL, f.control);
  assert.equal((await processPendingJob(f.db, f.args)).status, 'expired');
  assert.equal(effects(f.db).length, 0);
});

test('a lost response after commit does not cause duplicate effects or a false error receipt', async () => {
  const f = fixture(); f.db.failNext('after');
  const result = await processPendingJob(f.db, f.args);
  assert.ok(['done', 'already-done'].includes(result.status));
  assert.equal(effects(f.db).length, 1);
  assert.ok(f.db.read(STATE).afReceipts[f.id]);
  assert.equal(f.db.read(f.ledgerPath).status, 'done');
  assert.equal(f.db.read(STATE).pending[f.id], null);
  await processPendingJob(f.db, {...f.args, runId: 'retry-after-timeout'});
  assert.equal(f.db.commits.flat().filter(write => write.path === f.taskPath).length, 1);
});

test('private control fields and arbitrary queued fields do not leak to effects or ledger', async () => {
  const f = fixture();
  f.control.privateToken = 'PRIVATE-CONTROL-SENTINEL';
  f.job.privateNotes = 'PRIVATE-JOB-SENTINEL';
  f.job.step.extra = 'PRIVATE-STEP-SENTINEL';
  f.db.seed(CONTROL, f.control); f.db.seed(STATE, f.state);
  assert.equal((await processPendingJob(f.db, f.args)).status, 'done');
  const output = JSON.stringify([...effects(f.db), f.db.read(f.ledgerPath), f.db.read(STATE).serverStatus]);
  assert.equal(output.includes('PRIVATE-'), false);
});

test('drain processes only enabled trainers and honors the job limit', async () => {
  const f = fixture();
  const secondId = 'af_' + encodeURIComponent(JSON.stringify([OWNER, f.af.id, f.client.id, 'checkin.submitted:checkin-2:0']));
  f.state.pending[secondId] = {...f.job, id: secondId, mark: 'checkin.submitted:checkin-2:0'};
  f.db.seed(STATE, f.state);
  await drainPending(f.db, {runId: 'drain-limited', nowMs: NOW, maxJobs: 1});
  assert.equal(effects(f.db).length, 1);
  await drainPending(f.db, {runId: 'drain-rest', nowMs: NOW, maxJobs: 100});
  assert.equal(effects(f.db).length, 2);
  const disabled = fixture();
  disabled.control.enabled = false; disabled.db.seed(CONTROL, disabled.control);
  await drainPending(disabled.db, {runId: 'drain-disabled', nowMs: NOW});
  assert.equal(effects(disabled.db).length, 0);
});

test('drain reaches runnable jobs after more than one batch of skipped intents', async () => {
  const f = fixture();
  f.state.pending = {};
  for (let i = 0; i <= 100; i++) {
    const mark = 'checkin.submitted:batch-' + String(i).padStart(3, '0') + ':0';
    const id = 'af_' + encodeURIComponent(JSON.stringify([OWNER, f.af.id, f.client.id, mark]));
    f.state.pending[id] = {...f.job, id, mark,
      createdAt: new Date(NOW - (i < 100 ? 120000 : 10000)).toISOString()};
  }
  f.db.seed(STATE, f.state);
  for (let i = 0; i < 3 && !effects(f.db).length; i++) {
    await drainPending(f.db, {runId: 'batch-' + i, nowMs: NOW, maxJobs: 100});
  }
  assert.equal(effects(f.db).length, 1, 'Skipped jobs must not starve later runnable work');
});

test('drain visits trainers beyond the first control query page', async () => {
  const f = fixture();
  for (let i = 0; i < 100; i++) {
    const trainerId = 'a-trainer-' + String(i).padStart(3, '0');
    const stateDocId = 'state-' + trainerId;
    f.db.seed('serverAutomation/private/trainers/' + trainerId, {...f.control, stateDocId});
    f.db.seed('automationState/' + stateDocId, {trainerId, pending: {}});
  }
  for (let i = 0; i < 3 && !effects(f.db).length; i++) {
    await drainPending(f.db, {runId: 'page-' + i, nowMs: NOW});
  }
  assert.equal(effects(f.db).length, 1, 'Enabled trainers past query limit must get processed');
});

(async () => {
  let failures = 0;
  for (const {name, fn} of tests) {
    try { await fn(); console.log('PASS ' + name); }
    catch (error) { failures++; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  if (failures) process.exitCode = 1;
  else console.log('All ' + tests.length + ' server automation tests passed.');
})();
