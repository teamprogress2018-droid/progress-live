'use strict';

// Real Storage rules evaluation (with the cross-service trainerRoles check) on loopback emulators only.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const path = require('node:path');
const PROJECT = 'demo-progress-autoflow';
const BUCKET = PROJECT + '.appspot.com';
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
const ST_HOST = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || '').replace(/^https?:\/\//, '');
for (const host of [FS_HOST, ST_HOST]) {
  if (!/^(localhost|127\.0\.0\.1|\[::1\]):([0-9]+)$/.test(host)) {
    throw new Error('Loopback Firestore and Storage emulators required; production access is forbidden.');
  }
}
const runtimeRequire = createRequire(path.join(__dirname, '.runtime', 'package.json'));
const {initializeApp, deleteApp} = runtimeRequire('firebase-admin/app');
const {getFirestore} = runtimeRequire('firebase-admin/firestore');
const app = initializeApp({projectId: PROJECT}, 'storage-test-' + randomUUID());
const db = getFirestore(app);
db.settings({host: FS_HOST, ssl: false});
const run = 'storage-' + Date.now() + '-' + randomUUID().slice(0, 6);
let count = 0;

function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({alg: 'none', typ: 'JWT'}) + '.' + encode({
    iss: 'https://securetoken.google.com/' + PROJECT, aud: PROJECT, iat: now, exp: now + 3600,
    auth_time: now, sub: uid, user_id: uid, email: uid + '@example.test', email_verified: false,
    firebase: {sign_in_provider: 'password', identities: {}},
  }) + '.';
}
async function upload(uid, objectPath, contentType = 'video/mp4') {
  // Same multipart request the Firebase JS SDK sends (metadata carries contentType).
  const url = 'http://' + ST_HOST + '/v0/b/' + BUCKET + '/o?name=' + encodeURIComponent(objectPath);
  const boundary = 'b' + randomUUID().replace(/-/g, '');
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=utf-8\r\n\r\n'
      + JSON.stringify({name: objectPath, contentType}) + '\r\n--' + boundary
      + '\r\nContent-Type: ' + contentType + '\r\n\r\n'),
    Buffer.from('test-media'), Buffer.from('\r\n--' + boundary + '--'),
  ]);
  const response = await fetch(url, {
    method: 'POST', body,
    headers: {'Content-Type': 'multipart/related; boundary=' + boundary, 'X-Goog-Upload-Protocol': 'multipart',
      ...(uid ? {Authorization: 'Firebase ' + token(uid)} : {})},
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (process.env.STORAGE_DEBUG) console.log(response.status, text.slice(0, 200));
  return response.status;
}
function allowed(status, label) { assert.equal(status, 200, label + ' (status ' + status + ')'); count++; }
function denied(status, label) { assert.equal(status, 403, label + ' (status ' + status + ')'); count++; }

(async () => {
  const trainer = run + '-trainer', fresh = run + '-fresh', disabled = run + '-disabled';
  await db.doc('trainerRoles/' + trainer).set({uid: trainer, role: 'trainer', enabled: true});
  await db.doc('trainerRoles/' + disabled).set({uid: disabled, role: 'trainer', enabled: false});
  for (const prefix of ['exercise-media/{uid}/batch-1/clip.mp4', 'exercise-gifs/{uid}/clip.mp4']) {
    const p = uid => prefix.replace('{uid}', uid);
    allowed(await upload(trainer, p(trainer)), prefix + ': granted trainer uploads own media');
    denied(await upload(fresh, p(fresh)), prefix + ': self-registered account without role cannot upload');
    denied(await upload(disabled, p(disabled)), prefix + ': disabled role cannot upload');
    denied(await upload(null, p(trainer).replace('clip', 'anon')), prefix + ': anonymous upload');
    denied(await upload(fresh, p(trainer).replace('clip', 'foreign')), prefix + ': upload into another trainer folder');
    denied(await upload(trainer, p(trainer).replace('clip.mp4', 'page.html'), 'text/html'), prefix + ': non-media type');
  }
  console.log(count + ' storage rule assertions; failures: 0');
})().catch(error => { console.error(error.stack); process.exitCode = 1; })
  .finally(async () => { await db.terminate(); await deleteApp(app); });
