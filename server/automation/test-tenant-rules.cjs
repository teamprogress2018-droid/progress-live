'use strict';

// Real Firestore rules evaluation, deliberately restricted to a loopback emulator.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const path = require('node:path');
const PROJECT = 'demo-progress-autoflow';
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
const address = /^(localhost|127\.0\.0\.1|\[::1\]):([0-9]+)$/.exec(HOST);
if (!address || +address[2] < 1024 || +address[2] > 65535) {
  throw new Error('Loopback Firestore emulator required; production access is forbidden.');
}
for (const key of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[key] && process.env[key] !== PROJECT) throw new Error('Demo project required.');
}
const runtimeRequire = createRequire(path.join(__dirname, '.runtime', 'package.json'));
const {initializeApp, deleteApp} = runtimeRequire('firebase-admin/app');
const {getFirestore} = runtimeRequire('firebase-admin/firestore');
const app = initializeApp({projectId: PROJECT}, 'tenant-test-' + randomUUID());
const db = getFirestore(app);
db.settings({host: HOST, ssl: false});
const run = 'tenant-' + Date.now() + '-' + randomUUID().slice(0, 6);
const trainerA = run + '-trainer-a', trainerB = run + '-trainer-b';
const clientA = run + '-client-a', clientSibling = run + '-client-sibling', clientB = run + '-client-b';
const userA = {uid: run + '-user-a', email: 'a@example.test'};
const sibling = {uid: run + '-user-sibling', email: 'sibling@example.test'};
const userB = {uid: run + '-user-b', email: 'b@example.test'};
const ownerA = {uid: trainerA, email: 'trainer-a@example.test'};
const ownerB = {uid: trainerB, email: 'trainer-b@example.test'};
const OWNED = ['clients', 'plans', 'sessions', 'exercises', 'exerciseGifs', 'coachVideos',
  'workouts', 'tasks', 'kb', 'metricEntries', 'progressPhotos', 'metricGroups', 'messages',
  'packages', 'invoices', 'formSends', 'reportHistory', 'forms', 'programs', 'checkins',
  'clientNotes', 'clientDocs', 'onboardingFlows', 'planTemplates', 'settings', 'notifications',
  'integrationConfigs', 'forumGroups', 'forumPosts', 'forumComments', 'odWorkouts', 'odPrograms',
  'odProgress', 'onboardingActive', 'clientGroups', 'resources', 'automationState', 'autoflows'];
const PRIVATE = ['plans', 'sessions', 'tasks', 'packages', 'invoices', 'metricEntries',
  'progressPhotos', 'odProgress', 'messages', 'checkins', 'formSends'];
const SHARED = ['exercises', 'exerciseGifs', 'coachVideos', 'resources', 'odWorkouts', 'odPrograms', 'metricGroups'];
const OWNER_ONLY = OWNED.filter(col => ![...PRIVATE, ...SHARED, 'clients', 'forumGroups', 'forumPosts', 'forumComments'].includes(col));
const base = 'http://' + HOST + '/v1/projects/' + PROJECT + '/databases/(default)/documents';
const fullName = p => 'projects/' + PROJECT + '/databases/(default)/documents/' + p;
let count = 0;

function token(user) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({alg: 'none', typ: 'JWT'}) + '.' + encode({
    iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, iat: now,
    exp: now + 3600, auth_time: now, sub: user.uid, user_id: user.uid,
    email: user.email, email_verified: false,
    firebase: {sign_in_provider: 'custom', identities: {}},
  }) + '.';
}
function value(v) {
  if (v === null) return {nullValue: null};
  if (v instanceof Date) return {timestampValue: v.toISOString()};
  if (v && typeof v.toDate === 'function') return {timestampValue: v.toDate().toISOString()};
  if (Array.isArray(v)) return {arrayValue: {values: v.map(value)}};
  if (typeof v === 'string') return {stringValue: v};
  if (typeof v === 'boolean') return {booleanValue: v};
  if (typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  return {mapValue: {fields: fields(v)}};
}
function fields(data) { return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, value(v)])); }
async function request(suffix, user, method = 'GET', body) {
  const response = await fetch(base + suffix, {
    method, headers: {...(user ? {Authorization: 'Bearer ' + token(user)} : {}),
      ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(15000),
  });
  return {status: response.status, body: await response.json()};
}
function read(p, user) { return request('/' + p.split('/').map(encodeURIComponent).join('/'), user); }
function write(p, data, user) {
  return request('/' + p.split('/').map(encodeURIComponent).join('/'), user, 'PATCH', {fields: fields(data)});
}
function remove(p, user) { return request('/' + p.split('/').map(encodeURIComponent).join('/'), user, 'DELETE'); }
async function patch(p, update, user) {
  const existing = (await db.doc(p).get()).data();
  return write(p, {...existing, ...update}, user);
}
async function query(col, user, filters = [], parent = '') {
  const expressions = filters.map(([field, op, val]) => ({
    fieldFilter: {field: {fieldPath: field}, op, value: value(val)},
  }));
  const structuredQuery = {from: [{collectionId: col}], ...(expressions.length ? {
    where: expressions.length === 1 ? expressions[0] : {compositeFilter: {op: 'AND', filters: expressions}},
  } : {})};
  return request((parent ? '/' + parent : '') + ':runQuery', user, 'POST', {structuredQuery});
}
function ok(result, message) {
  assert.equal(result.status, 200, message + ': ' + JSON.stringify(result.body).slice(0, 500)); count++;
}
function denied(result, message) {
  assert.equal(result.status, 403, message + ': ' + JSON.stringify(result.body).slice(0, 500)); count++;
}
async function seed(p, data) { await db.doc(p).set(data); }
function clientData(extra = {}) { return {trainerId: trainerA, clientId: clientA, ...extra}; }
const tests = [];
function test(name, fn) { tests.push({name, fn}); }

async function setup() {
  const batch = db.batch();
  for (const [u, trainerId, clientId] of [[userA, trainerA, clientA], [sibling, trainerA, clientSibling], [userB, trainerB, clientB]]) {
    batch.set(db.doc('clientAccounts/' + u.uid), {role: 'client', uid: u.uid, trainerId, clientId, email: u.email, inviteToken: 'legacy'});
    batch.set(db.doc('clients/' + clientId), {id: clientId, trainerId, name: clientId, status: 'active'});
  }
  await batch.commit();
}
test('all trainer collections isolate CRUD, query ownership and immutable trainerId', async () => {
  for (const col of OWNED) {
    const id = run + '-owned-' + col, p = col + '/' + id;
    const data = {id, trainerId: trainerA, clientId: clientA, name: 'Owned fixture'};
    ok(await write(p, data, ownerA), col + ' own create');
    ok(await read(p, ownerA), col + ' own read');
    ok(await query(col, ownerA, [['trainerId', 'EQUAL', trainerA]]), col + ' scoped list');
    denied(await query(col, ownerA), col + ' broad list');
    denied(await read(p, ownerB), col + ' foreign trainer read');
    denied(await read(p, userB), col + ' foreign client read');
    denied(await read(p, null), col + ' anonymous read');
    denied(await patch(p, {trainerId: trainerB}, ownerA), col + ' ownership transfer');
    denied(await patch(p, {name: 'Hacked'}, ownerB), col + ' foreign update');
    denied(await remove(p, ownerB), col + ' foreign delete');
    ok(await patch(p, {name: 'Updated'}, ownerA), col + ' own update');
    ok(await remove(p, ownerA), col + ' own delete');
  }
});
test('unknown collections and descendants never inherit a trainer allow', async () => {
  for (const p of ['unknown/' + run, 'settings/' + run + '/private/nested',
    'automationState/' + run + '/private/nested', 'serverAutomation/private/trainers/' + trainerA]) {
    await seed(p, {trainerId: trainerA, clientId: clientA});
    for (const user of [ownerA, userA, ownerB, null]) {
      denied(await read(p, user), p + ' read');
      denied(await write(p, {trainerId: trainerA}, user), p + ' write');
      denied(await remove(p, user), p + ' delete');
    }
  }
});
test('linked clients see only their records and explicitly shared libraries', async () => {
  for (const col of PRIVATE) {
    const p = col + '/' + run + '-private';
    await seed(p, clientData({id: run + '-private'}));
    ok(await read(p, userA), col + ' linked read');
    denied(await read(p, sibling), col + ' sibling read');
    ok(await query(col, userA, [['trainerId', 'EQUAL', trainerA], ['clientId', 'EQUAL', clientA]]), col + ' both-key list');
    denied(await query(col, userA, [['trainerId', 'EQUAL', trainerA]]), col + ' all trainer clients list');
    denied(await query(col, userA, [['clientId', 'EQUAL', clientA]]), col + ' missing tenant query');
  }
  for (const col of SHARED) {
    const p = col + '/' + run + '-shared'; await seed(p, {trainerId: trainerA});
    ok(await read(p, userA), col + ' shared read');
    ok(await query(col, userA, [['trainerId', 'EQUAL', trainerA]]), col + ' shared list');
    denied(await write(p, {trainerId: trainerA}, userA), col + ' shared mutation');
  }
  for (const col of OWNER_ONLY) {
    const p = col + '/' + run + '-secret'; await seed(p, clientData({secret: 'private'}));
    denied(await read(p, userA), col + ' private trainer data');
  }
  ok(await read('clients/' + clientA, userA), 'own client profile');
  denied(await read('clients/' + clientSibling, userA), 'sibling profile');
  ok(await patch('clients/' + clientA, {weight: 75, baselineDone: true, baselineAt: '2026-09-26'}, userA), 'client measurement sync');
  denied(await patch('clients/' + clientA, {status: 'archived'}, userA), 'client cannot archive itself');
});
test('account binding cannot be rebound or forged by any trainer', async () => {
  const p = 'clientAccounts/' + userA.uid;
  ok(await read(p, userA), 'self account');
  ok(await read(p, ownerA), 'own linked account');
  denied(await read(p, ownerB), 'foreign linked account');
  denied(await patch(p, {trainerId: trainerB}, userA), 'self rebind trainer');
  denied(await patch(p, {clientId: clientSibling}, userA), 'self rebind client');
  denied(await patch(p, {role: 'trainer'}, userA), 'self role escalation');
  denied(await patch(p, {inviteToken: 'different'}, userA), 'self invite replacement');
  denied(await write('clientAccounts/' + run + '-victim', {uid: run + '-victim', role: 'client', trainerId: trainerA, clientId: clientA}, ownerA), 'trainer cannot claim arbitrary UID');
  const missing = await read('clientAccounts/' + trainerA, ownerA);
  assert.equal(missing.status, 404, 'unbound self account returns not-found'); count++;
});
function inviteData(id, email, overrides = {}) {
  return {id, trainerId: trainerA, clientId: clientA, clientName: 'Klient', trainerName: 'Trener',
    email, emailLower: email.toLowerCase(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000), consumedBy: null, consumedAt: null, revoked: false, ...overrides};
}
function register(inviteId, user, overrides = {}) {
  const accountData = {role: 'client', uid: user.uid, trainerId: trainerA, clientId: clientA,
    inviteToken: inviteId, email: user.email, clientName: 'Klient', trainerName: 'Trener',
    createdAt: new Date().toISOString(), ...overrides};
  return request(':commit', user, 'POST', {writes: [
    {update: {name: fullName('clientAccounts/' + user.uid), fields: fields(accountData)}, currentDocument: {exists: false}},
    {update: {name: fullName('invites/' + inviteId), fields: fields({consumedBy: user.uid})},
      updateMask: {fieldPaths: ['consumedBy']}, currentDocument: {exists: true},
      updateTransforms: [{fieldPath: 'consumedAt', setToServerValue: 'REQUEST_TIME'}]},
  ]});
}
test('invites require authenticated matching email, expiry and atomic one-use redemption', async () => {
  const id = run + '-invite', user = {uid: run + '-new-user', email: 'new@example.test'};
  ok(await write('invites/' + id, inviteData(id, user.email), ownerA), 'owner creates current invite');
  denied(await read('invites/' + id, null), 'anonymous invite PII');
  denied(await read('invites/' + id, ownerB), 'wrong email invite');
  ok(await read('invites/' + id, user), 'recipient reads invite');
  denied(await write('clientAccounts/' + user.uid, {role: 'client', uid: user.uid,
    trainerId: trainerA, clientId: clientA, inviteToken: id, email: user.email}, user), 'non-atomic registration');
  denied(await register(id, user, {trainerId: trainerB}), 'mismatched tenant registration');
  assert.equal((await db.doc('invites/' + id).get()).data().consumedBy, null);
  ok(await register(id, user), 'atomic registration');
  assert.equal((await db.doc('invites/' + id).get()).data().consumedBy, user.uid); count++;
  ok(await read('invites/' + id, user), 'own redemption recovery');
  denied(await register(id, {uid: run + '-replay-user', email: user.email}), 'invite replay');
  for (const [suffix, overrides] of [['expired', {expiresAt: new Date(Date.now() - 1000)}],
    ['revoked', {revoked: true}], ['wrong-email', {emailLower: 'someone-else@example.test'}],
    ['legacy', {expiresAt: null}]]) {
    const inviteId = run + '-invite-' + suffix;
    const blockedUser = {uid: run + '-blocked-' + suffix, email: 'blocked@example.test'};
    await seed('invites/' + inviteId, inviteData(inviteId, blockedUser.email, overrides));
    denied(await register(inviteId, blockedUser), suffix + ' redemption');
    assert.equal((await db.doc('clientAccounts/' + blockedUser.uid).get()).exists, false); count++;
  }
});
test('concurrent invite redemption creates exactly one binding', async () => {
  const id = run + '-race-invite', email = 'race@example.test';
  await seed('invites/' + id, inviteData(id, email));
  const results = await Promise.all([
    register(id, {uid: run + '-race-a', email}), register(id, {uid: run + '-race-b', email}),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 403]); count++;
});
test('public profile projection excludes settings secrets and supports missing projection', async () => {
  const p = 'trainerPublicProfiles/' + trainerA;
  assert.equal((await read(p, userA)).status, 404); count++;
  const profile = {trainerId: trainerA, schemaVersion: 1, updatedAt: new Date().toISOString(),
    profile: {name: 'Trener', title: '', avatar: 'T', avatarUrl: null},
    brand: {accentColor: '#ff0000', theme: 'dark', appName: 'Progress', logo: null, font: 'Inter'},
    clientApp: {appName: 'Progress', visibleSections: {home: true, calendar: false}},
    paymentInstructions: {name: 'Trener', bank: 'PL00', currency: 'PLN', footer: ''}};
  ok(await write(p, profile, ownerA), 'owner safe projection');
  ok(await read(p, userA), 'linked safe projection');
  denied(await read(p, userB), 'foreign projection');
  denied(await read(p, null), 'anonymous projection');
  denied(await patch(p, {apiKey: 'secret'}, ownerA), 'secret top-level projection');
  denied(await patch(p, {profile: {...profile.profile, email: 'private@example.test'}}, ownerA), 'secret nested projection');
  denied(await patch(p, {paymentInstructions: {...profile.paymentInstructions, apiKey: 'secret'}}, ownerA), 'secret payment projection');
  denied(await write('trainerPublicProfiles/' + trainerB, profile, ownerA), 'foreign profile path');
});
test('client submission actions preserve assignment, authority and other clients', async () => {
  const taskId = run + '-task', taskPath = 'tasks/' + taskId;
  await seed(taskPath, clientData({id: taskId, status: 'open', kind: 'task', title: 'Zadanie', due: '2026-09-26'}));
  ok(await patch(taskPath, {status: 'done', updatedAt: new Date().toISOString()}, userA), 'complete own task');
  denied(await patch(taskPath, {title: 'Changed by client'}, userA), 'rewrite assigned task');
  denied(await patch(taskPath, {clientId: clientSibling}, userA), 'move task to sibling');
  denied(await patch(taskPath, {status: 'done'}, sibling), 'complete sibling task');
  const formId = run + '-form', formPath = 'formSends/' + formId;
  await seed(formPath, clientData({id: formId, formId: 'df1', status: 'sent', questions: [{id: 'q1'}], answers: {}}));
  denied(await patch(formPath, {questions: []}, userA), 'rewrite sent form questions');
  ok(await patch(formPath, {status: 'filled', answers: {q1: 'Odpowiedź'}, filledAt: new Date().toISOString()}, userA), 'submit assigned form');
  denied(await patch(formPath, {answers: {q1: 'Changed'}}, userA), 'rewrite completed form');
  const messageId = run + '-message';
  const msg = clientData({id: messageId, text: 'Moja wiadomość', out: false, kind: 'direct', createdAt: new Date().toISOString()});
  ok(await write('messages/' + messageId, msg, userA), 'client message');
  denied(await write('messages/' + messageId + '-forged', {...msg, id: messageId + '-forged', out: true}, userA), 'impersonated trainer message');
  denied(await patch('messages/' + messageId, {text: 'Changed'}, userA), 'rewrite message');
  const ciId = run + '-checkin';
  ok(await write('checkins/' + ciId, clientData({id: ciId, date: '2026-09-26', status: 'filled', score: 80,
    answers: {energy: 4}, filledBy: 'client', filledAt: new Date().toISOString(), createdAt: new Date().toISOString()}), userA), 'client checkin');
  denied(await patch('checkins/' + ciId, {filledBy: 'trainer'}, userA), 'impersonated trainer checkin');
  const metricId = run + '-metric';
  ok(await write('metricEntries/' + metricId, clientData({id: metricId, groupId: 'mg1',
    date: '2026-09-26', values: {m1: 75}, notes: 'Check-in', createdAt: new Date().toISOString()}), userA), 'client metric');
  const photoId = run + '-photo';
  ok(await write('progressPhotos/' + photoId, clientData({id: photoId, source: 'client', photos: {front: 'data:test'},
    date: '2026-09-26', weight: '', note: '', createdAt: new Date().toISOString()}), userA), 'client photo');
  ok(await remove('progressPhotos/' + photoId, userA), 'delete own client photo');
  const odId = run + '-od-progress';
  ok(await write('odProgress/' + odId, clientData({id: odId, programId: 'program-1', done: [], updatedAt: new Date().toISOString()}), userA), 'client on-demand progress');
  ok(await patch('odProgress/' + odId, {done: ['program-1:0:0']}, userA), 'complete on-demand day');
  denied(await patch('odProgress/' + odId, {programId: 'other-program'}, userA), 'rebind on-demand program');
});
test('public profile fields reject nested structures that could carry secret configuration', async () => {
  const p = 'trainerPublicProfiles/' + trainerA;
  const previous = (await db.doc(p).get()).data();
  denied(await patch(p, {profile: {...previous.profile, name: {apiKey: 'secret'}}}, ownerA), 'name must be text');
  denied(await patch(p, {paymentInstructions: {...previous.paymentInstructions, bank: {token: 'secret'}}}, ownerA), 'bank must be text');
  denied(await patch(p, {clientApp: {...previous.clientApp, visibleSections: {home: {apiKey: 'secret'}}}}, ownerA), 'visibility must be boolean');
  denied(await patch(p, {clientApp: {...previous.clientApp, visibleSections: {calendar: 'yes'}}}, ownerA), 'calendar visibility must be boolean');
  denied(await patch(p, {updatedAt: {token: 'secret'}}, ownerA), 'timestamp cannot hide a map');
});
test('client sessions are tied to assigned plans or homework', async () => {
  const planId = run + '-assigned-plan', sessionId = run + '-session';
  await seed('plans/' + planId, clientData({id: planId}));
  const data = clientData({id: sessionId, date: '2026-09-26', source: 'client', planId,
    duration: 30, exercises: [], volume: 0, feedback: 4, note: '', createdAt: new Date().toISOString()});
  ok(await write('sessions/' + sessionId, data, userA), 'logged own plan session');
  denied(await write('sessions/' + sessionId + '-foreign', {...data, id: sessionId + '-foreign', clientId: clientSibling}, userA), 'sibling session');
  denied(await write('sessions/' + sessionId + '-planned', {...data, id: sessionId + '-planned', source: 'planned'}, userA), 'client calendar scheduling');
  denied(await patch('sessions/' + sessionId, {source: 'live'}, userA), 'impersonated live source');
});
test('homework continuation is bounded and cannot replay under another ID', async () => {
  const parentId = run + '-parent', nextId = parentId + '_next';
  const parent = clientData({id: parentId, kind: 'homework', status: 'done', repeatLeft: 3,
    odWorkoutId: 'workout-1', title: 'Mobilność', desc: '', repeatWeekdays: [1], due: '2026-09-21'});
  await seed('tasks/' + parentId, parent);
  const next = {...parent, id: nextId, status: 'open', parentTaskId: parentId, repeatLeft: 2,
    repeatWeeks: 2, cat: 'trening', priority: 'medium', due: '2026-09-28', createdAt: new Date().toISOString()};
  ok(await write('tasks/' + nextId, next, userA), 'authorized continuation');
  denied(await write('tasks/' + nextId + '-replay', {...next, id: nextId + '-replay'}, userA), 'different ID duplicate');
  denied(await patch('tasks/' + nextId, {repeatLeft: 100}, userA), 'increase assigned recurrence');
});

test('client sala completion validates its planned parent and never changes packages', async () => {
  const parentId = run + '-sala-planned', id = 'sala_' + parentId;
  const parent = clientData({id: parentId, source: 'planned', date: '2026-09-26', time: '18:00',
    type: 'Trening personalny', planId: run + '-assigned-plan', dayIdx: 0});
  await seed('sessions/' + parentId, parent);
  const packageId = run + '-sala-package';
  const packageData = clientData({id: packageId, used: 2, total: 12, status: 'paid'});
  await seed('packages/' + packageId, packageData);
  const data = clientData({id, date: parent.date, time: parent.time, type: parent.type,
    duration: 60, exercises: [{name: 'Przysiad', sets: []}], source: 'sala', plannedSessionId: parentId,
    planId: parent.planId, dayIdx: parent.dayIdx, feedback: 4, note: 'Oznaczone z kalendarza (trening na sali)',
    createdAt: new Date().toISOString()});
  denied(await write('sessions/' + id, {...data, pkgTick: true}, userA), 'client may not claim a package debit');
  denied(await write('sessions/' + id, {...data, date: '2026-09-27'}, userA), 'different date from scheduled session');
  denied(await write('sessions/' + id, {...data, planId: 'foreign-plan'}, userA), 'different plan from scheduled session');
  denied(await write('sessions/' + id + '-duplicate', {...data, id: id + '-duplicate'}, userA), 'noncanonical sala ID');
  const foreignParentId = parentId + '-foreign';
  await seed('sessions/' + foreignParentId, {...parent, id: foreignParentId, clientId: clientSibling});
  const foreignId = 'sala_' + foreignParentId;
  denied(await write('sessions/' + foreignId, {...data, id: foreignId, plannedSessionId: foreignParentId}, userA), 'foreign planned parent');
  ok(await write('sessions/' + id, data, userA), 'actual client sala record');
  ok(await patch('sessions/' + id, {feedback: 5, duration: 45, note: 'Aktualizacja', updatedAt: new Date().toISOString()}, userA), 'update sala feedback');
  denied(await patch('sessions/' + id, {plannedSessionId: foreignParentId}, userA), 'rebind sala parent');
  denied(await patch('sessions/' + id, {feedback: 6}, userA), 'out of range sala feedback');
  denied(await patch('sessions/' + id, {pkgTick: true}, userA), 'update cannot add package debit');
  denied(await patch('packages/' + packageId, {used: 3}, userA), 'client cannot debit package');
  assert.deepEqual((await db.doc('packages/' + packageId).get()).data(), packageData); count++;
});
test('forum queries honor public groups and actual private membership', async () => {
  const publicId = run + '-public-group', memberId = run + '-member-group', hiddenId = run + '-hidden-group';
  for (const [id, privacy, memberIds] of [[publicId, 'public', []], [memberId, 'private', [clientA]], [hiddenId, 'private', [clientSibling]]]) {
    await seed('forumGroups/' + id, {id, trainerId: trainerA, privacy, memberIds});
  }
  ok(await query('forumGroups', userA, [['trainerId', 'EQUAL', trainerA], ['privacy', 'EQUAL', 'public']]), 'public forum groups query');
  ok(await query('forumGroups', userA, [['trainerId', 'EQUAL', trainerA], ['privacy', 'EQUAL', 'private'], ['memberIds', 'ARRAY_CONTAINS', clientA]]), 'member forum groups query');
  denied(await query('forumGroups', userA, [['trainerId', 'EQUAL', trainerA]]), 'all trainer forum groups');
  denied(await read('forumGroups/' + hiddenId, userA), 'hidden private group');
  const publicPost = run + '-public-post', hiddenPost = run + '-hidden-post';
  for (const [id, groupId] of [[publicPost, publicId], [hiddenPost, hiddenId]]) {
    await seed('forumPosts/' + id, {id, trainerId: trainerA, groupId, authorRole: 'trener',
      title: 'Post', body: 'Treść', reactedBy: {}, reactions: {}, likes: 0, views: 0, comments: 0});
  }
  ok(await query('forumPosts', userA, [['trainerId', 'EQUAL', trainerA], ['groupId', 'EQUAL', publicId]]), 'visible group posts');
  denied(await read('forumPosts/' + hiddenPost, userA), 'private post');
  denied(await query('forumPosts', userA, [['trainerId', 'EQUAL', trainerA]]), 'all trainer posts');
  denied(await patch('forumPosts/' + publicPost, {authorRole: 'klient', clientId: clientA}, userA), 'take over trainer post');
  denied(await patch('forumPosts/' + publicPost, {reactedBy: {[sibling.uid]: 'fire'}}, userA), 'forge sibling reaction');
  ok(await patch('forumPosts/' + publicPost, {reactedBy: {[userA.uid]: 'fire'}, reactions: {fire: 1}, likes: 1}, userA), 'own reaction');
  const commentId = run + '-comment';
  const comment = clientData({id: commentId, postId: publicPost, authorRole: 'klient', authorName: 'Klient',
    body: 'Komentarz', date: '2026-09-26', createdAt: new Date().toISOString(), likes: 0});
  ok(await write('forumComments/' + commentId, comment, userA), 'comment in accessible group');
  ok(await query('forumComments', userA, [['trainerId', 'EQUAL', trainerA], ['postId', 'EQUAL', publicPost]]), 'visible post comments');
  denied(await write('forumComments/' + commentId + '-hidden', {...comment, id: commentId + '-hidden', postId: hiddenPost}, userA), 'comment on hidden group');
  denied(await remove('forumComments/' + commentId, sibling), 'delete sibling comment');
  ok(await remove('forumComments/' + commentId, userA), 'delete own comment');
});

(async () => {
  let failed = 0;
  try {
    await setup();
    for (const {name, fn} of tests) {
      try { await fn(); console.log('PASS ' + name); }
      catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
    }
    console.log(count + ' rule assertions across ' + tests.length + ' scenarios; failures: ' + failed);
    if (failed) process.exitCode = 1;
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
