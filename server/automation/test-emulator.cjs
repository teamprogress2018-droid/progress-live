'use strict';

// Integration checks only. Refuse every host except an explicitly configured
// loopback emulator, and use a demo project plus a local emulator credential.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const path = require('node:path');

const PROJECT = 'demo-progress-autoflow';
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const address = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]+)$/.exec(emulatorHost);
if (!address || Number(address[2]) < 1024 || Number(address[2]) > 65535) {
  throw new Error('A loopback FIRESTORE_EMULATOR_HOST with port 1024–65535 is required; no production access is permitted.');
}
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name] && process.env[name] !== PROJECT) {
    throw new Error(name + ' must equal ' + PROJECT + ' for this emulator-only test.');
  }
}

const runtimeRequire = createRequire(path.join(__dirname, '.runtime', 'package.json'));
const {initializeApp, deleteApp} = runtimeRequire('firebase-admin/app');
const {getFirestore} = runtimeRequire('firebase-admin/firestore');
const {processPendingJob} = require('./worker.cjs');
const app = initializeApp({
  projectId: PROJECT,
  credential: {getAccessToken: async () => ({access_token: 'owner', expires_in: 3600})},
}, 'autoflow-emulator-' + randomUUID());
const db = getFirestore(app);
db.settings({host: emulatorHost, ssl: false});
const runPrefix = 'test-' + Date.now() + '-' + randomUUID().slice(0, 8);
let sequence = 0;

async function fixture() {
  const suffix = runPrefix + '-' + (++sequence);
  const owner = 'trainer-' + suffix;
  const stateDocId = 'state-' + suffix;
  const afId = 'flow-' + suffix;
  const clientId = 'client-' + suffix;
  const afDocId = 'flow-doc-' + suffix;
  const clientDocId = 'client-doc-' + suffix;
  const nowMs = Date.now();
  const mark = 'checkin.submitted:checkin-' + suffix + ':0';
  const step = {type: 'task', text: 'Sprawdź postęp {imie}', day: 1};
  const id = 'af_' + encodeURIComponent(JSON.stringify([owner, afId, clientId, mark]));
  const job = {id, owner, afId, clientId, afDocId, clientDocId, mark, si: 0,
    oneShot: false, step, createdAt: new Date(nowMs - 10000).toISOString(),
    attempts: 0, nextRetry: 0, status: 'pending'};
  const controlRef = db.doc('serverAutomation/private/trainers/' + owner);
  const stateRef = db.doc('automationState/' + stateDocId);
  const flowRef = db.doc('autoflows/' + afDocId);
  const clientRef = db.doc('clients/' + clientDocId);
  const taskRef = db.doc('tasks/' + id + '_task');
  const batch = db.batch();
  batch.set(controlRef, {enabled: true, schemaVersion: 1, stateDocId,
    enabledAt: new Date(nowMs - 60000).toISOString(), timeZone: 'Europe/Warsaw'});
  batch.set(stateRef, {trainerId: owner, pending: {[id]: job}, afReceipts: {},
    executed: {}, lastFired: {}, logs: []});
  batch.set(flowRef, {id: afId, trainerId: owner, name: 'Kontrola po raporcie',
    trigger: 'checkin.submitted', status: 'active', scope: 'all', steps: [step],
    createdAt: new Date(nowMs - 86400000).toISOString()});
  batch.set(clientRef, {id: clientId, trainerId: owner, name: 'Alicja Testowa', status: 'active'});
  await batch.commit();
  return {owner, clientId, id, job, controlRef, stateRef, flowRef, clientRef, taskRef,
    args: {trainerId: owner, stateDocId, jobId: id, runId: suffix, nowMs}};
}

async function assertNoEffects(f) {
  // Private ledger/shared serverStatus writes are diagnostic outcomes, not
  // client-visible effects. Only delivery collections and receipts are checked.
  for (const collection of ['tasks', 'messages', 'formSends']) {
    const result = await db.collection(collection).where('trainerId', '==', f.owner).get();
    assert.equal(result.size, 0, 'Unexpected client-visible effect in ' + collection);
  }
  assert.equal((await f.stateRef.get()).data().afReceipts[f.id], undefined);
}

// Unsigned identity tokens are accepted by the local Firestore emulator only.
// Never send these tokens to a non-loopback endpoint.
function emulatorUserToken(uid) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({alg: 'none', typ: 'JWT'}) + '.' + encode({
    iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT,
    iat: now, exp: now + 3600, auth_time: now, sub: uid, user_id: uid,
    firebase: {sign_in_provider: 'custom', identities: {}},
  }) + '.';
}

async function rulesRequest(documentPath, {uid, method = 'GET', fields} = {}) {
  const encoded = documentPath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch('http://' + emulatorHost + '/v1/projects/' + PROJECT +
    '/databases/(default)/documents/' + encoded, {
    method,
    headers: {
      ...(uid ? {Authorization: 'Bearer ' + emulatorUserToken(uid)} : {}),
      ...(fields ? {'Content-Type': 'application/json'} : {}),
    },
    ...(fields ? {body: JSON.stringify({fields})} : {}),
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  return {status: response.status, body};
}

const tests = [];
const test = (name, execute) => tests.push({name, execute});

test('concurrent real transactions commit one task and one shared receipt', async () => {
  const f = await fixture();
  const results = await Promise.all([
    processPendingJob(db, {...f.args, runId: f.args.runId + '-a'}),
    processPendingJob(db, {...f.args, runId: f.args.runId + '-b'}),
  ]);
  assert.deepEqual(results.map(value => value.status).sort(), ['already-done', 'done']);
  const tasks = await db.collection('tasks').where('trainerId', '==', f.owner).get();
  assert.equal(tasks.size, 1);
  assert.equal(tasks.docs[0].id, f.id + '_task');
  assert.equal(tasks.docs[0].data().title, 'Sprawdź postęp Alicja');
  const state = (await f.stateRef.get()).data();
  assert.equal(state.afReceipts[f.id], f.job.createdAt);
  assert.equal(state.pending[f.id], null);
  assert.equal(state.executed[f.job.afId][f.clientId][f.job.mark], true);

  // A later replay must preserve the user's edits, even after the flow is paused.
  await f.taskRef.update({status: 'done', title: 'Zmienione po wykonaniu'});
  await f.flowRef.update({status: 'paused'});
  const before = await f.taskRef.get();
  assert.equal((await processPendingJob(db, {...f.args, runId: f.args.runId + '-replay'})).status, 'already-done');
  const after = await f.taskRef.get();
  assert.deepEqual(after.data(), before.data());
  assert.ok(after.updateTime.isEqual(before.updateTime), 'Replay rewrote the existing effect');
});

test('remote paused flow and archived client block all effects', async () => {
  for (const reason of ['paused', 'archived']) {
    const f = await fixture();
    await (reason === 'paused' ? f.flowRef : f.clientRef).update({status: reason});
    assert.equal((await processPendingJob(db, f.args)).status, 'blocked');
    await assertNoEffects(f);
  }
});

test('foreign state, flow and client cannot generate effects', async () => {
  for (const target of ['stateRef', 'flowRef', 'clientRef']) {
    const f = await fixture();
    await f[target].update({trainerId: 'foreign-' + f.owner});
    assert.equal((await processPendingJob(db, f.args)).status, 'foreign');
    await assertNoEffects(f);
  }
});

test('an existing task without a receipt is never overwritten', async () => {
  for (const foreign of [false, true]) {
    const f = await fixture();
    const task = {id: f.id + '_task', trainerId: foreign ? 'foreign-' + f.owner : f.owner,
      clientId: f.clientId, title: 'Zachowaj wynik', status: 'done'};
    await f.taskRef.set(task);
    const before = await f.taskRef.get();
    assert.notEqual((await processPendingJob(db, f.args)).status, 'done');
    const after = await f.taskRef.get();
    assert.deepEqual(after.data(), task);
    assert.ok(after.updateTime.isEqual(before.updateTime));
    assert.equal((await f.stateRef.get()).data().afReceipts[f.id], undefined);
  }
});

test('rules deny private server controls to unauthenticated, trainer and client requests', async () => {
  const f = await fixture();
  const clientUid = 'login-' + f.clientId;
  await db.doc('clientAccounts/' + clientUid).set({
    role: 'client', trainerId: f.owner, clientId: f.clientId,
  });
  // Positive controls verify that emulator authentication works before testing denials.
  assert.equal((await rulesRequest(f.clientRef.path, {uid: f.owner})).status, 200);
  assert.equal((await rulesRequest('clientAccounts/' + clientUid, {uid: clientUid})).status, 200);
  const before = await f.controlRef.get();
  for (const [identity, uid] of [undefined, f.owner, clientUid].entries()) {
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const result = await rulesRequest(f.controlRef.path, {uid, method,
        ...(method === 'PATCH' ? {fields: {
          enabled: {booleanValue: true}, trainerId: {stringValue: f.owner},
          clientId: {stringValue: f.clientId}, schemaVersion: {integerValue: '1'},
        }} : {}),
      });
      assert.equal(result.status, 403, 'Private controls unexpectedly accessible: ' + method);
      assert.equal(result.body.error?.status, 'PERMISSION_DENIED');
    }
    const createPath = f.controlRef.path + '-forged-' + identity;
    const create = await rulesRequest(createPath, {uid, method: 'PATCH', fields: {
      enabled: {booleanValue: true}, trainerId: {stringValue: f.owner},
      clientId: {stringValue: f.clientId}, schemaVersion: {integerValue: '1'},
    }});
    assert.equal(create.status, 403, 'Private control creation unexpectedly permitted');
    assert.equal(create.body.error?.status, 'PERMISSION_DENIED');
    assert.equal((await db.doc(createPath).get()).exists, false);
  }
  const after = await f.controlRef.get();
  assert.deepEqual(after.data(), before.data());
  assert.ok(after.updateTime.isEqual(before.updateTime));
});

test('automation state and flow rules allow only the owning trainer', async () => {
  const f = await fixture();
  const clientUid = 'login-' + f.clientId;
  const otherTrainerUid = 'other-' + f.owner;
  await db.doc('clientAccounts/' + clientUid).set({
    role: 'client', trainerId: f.owner, clientId: f.clientId,
  });
  assert.equal((await rulesRequest('clientAccounts/' + clientUid, {uid: clientUid})).status, 200);
  for (const reference of [f.stateRef, f.flowRef]) {
    // The real queue and flow have no clientId: this catches the old generic
    // isLinkedClient fallback that treated these trainer documents as shared.
    const before = await reference.get();
    assert.equal(before.data().clientId, undefined);
    const fields = {
      trainerId: {stringValue: f.owner}, clientId: {stringValue: f.clientId},
      probe: {stringValue: 'unauthorized-write'},
    };
    for (const [identity, uid] of [clientUid, otherTrainerUid].entries()) {
      for (const method of ['GET', 'PATCH', 'DELETE']) {
        const result = await rulesRequest(reference.path, {uid, method,
          ...(method === 'PATCH' ? {fields} : {}),
        });
        assert.equal(result.status, 403, reference.path + ' unexpectedly permits ' + method + ' by ' + uid);
        assert.equal(result.body.error?.status, 'PERMISSION_DENIED');
      }
      // PATCH to a missing document is a create in the Firestore REST API.
      const createPath = reference.path + '-forged-' + identity;
      const create = await rulesRequest(createPath, {uid, method: 'PATCH', fields});
      assert.equal(create.status, 403, 'Unauthorized creation in ' + reference.parent.id);
      assert.equal(create.body.error?.status, 'PERMISSION_DENIED');
      assert.equal((await db.doc(createPath).get()).exists, false);
    }
    const afterDenied = await reference.get();
    assert.deepEqual(afterDenied.data(), before.data());
    assert.ok(afterDenied.updateTime.isEqual(before.updateTime));

    assert.equal((await rulesRequest(reference.path, {uid: f.owner})).status, 200);
    const update = await rulesRequest(reference.path, {uid: f.owner, method: 'PATCH', fields: {
      trainerId: {stringValue: f.owner}, probe: {stringValue: 'trainer-update'},
    }});
    assert.equal(update.status, 200, 'Owning trainer cannot update ' + reference.parent.id);
    assert.equal((await reference.get()).data().probe, 'trainer-update');
  }
});

(async () => {
  try {
    for (const {name, execute} of tests) {
      await execute();
      console.log('PASS: ' + name);
    }
    console.log('Passed ' + tests.length + ' Firestore emulator integration checks.');
  } finally {
    // The emulator process owns lifecycle cleanup. Unique fixture IDs ensure
    // parallel runs cannot delete or mutate one another's fixtures.
    await db.terminate();
    await deleteApp(app);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
