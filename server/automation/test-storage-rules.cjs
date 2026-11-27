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
async function upload(uid, objectPath, contentType = 'video/mp4', payload = Buffer.from('test-media')) {
  // Same multipart request the Firebase JS SDK sends (metadata carries contentType).
  const url = 'http://' + ST_HOST + '/v0/b/' + BUCKET + '/o?name=' + encodeURIComponent(objectPath);
  const boundary = 'b' + randomUUID().replace(/-/g, '');
  const body = Buffer.concat([
    Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=utf-8\r\n\r\n'
      + JSON.stringify({name: objectPath, contentType}) + '\r\n--' + boundary
      + '\r\nContent-Type: ' + contentType + '\r\n\r\n'),
    payload, Buffer.from('\r\n--' + boundary + '--'),
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
async function readObject(uid, objectPath) {
  const url = 'http://' + ST_HOST + '/v0/b/' + BUCKET + '/o/' + encodeURIComponent(objectPath) + '?alt=media';
  const response = await fetch(url, {headers: uid ? {Authorization: 'Firebase ' + token(uid)} : {}, signal: AbortSignal.timeout(15000)});
  await response.arrayBuffer();
  return response.status;
}
async function listPrefix(uid, prefix) {
  const url = 'http://' + ST_HOST + '/v0/b/' + BUCKET + '/o?prefix=' + encodeURIComponent(prefix) + '&delimiter=%2F';
  const response = await fetch(url, {headers: uid ? {Authorization: 'Firebase ' + token(uid)} : {}, signal: AbortSignal.timeout(15000)});
  await response.text();
  return response.status;
}
async function removeObject(uid, objectPath) {
  const url = 'http://' + ST_HOST + '/v0/b/' + BUCKET + '/o/' + encodeURIComponent(objectPath);
  const response = await fetch(url, {method: 'DELETE', headers: uid ? {Authorization: 'Firebase ' + token(uid)} : {}, signal: AbortSignal.timeout(15000)});
  await response.text();
  return response.status === 204 ? 200 : response.status;
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
  // Odczyt: plik techniki znany z adresu jest publiczny (tak ma być), ale nikt obcy nie wylistuje folderu trenera.
  const client = run + '-client';
  await db.doc('clientAccounts/' + client).set({uid: client, role: 'client', trainerId: trainer, clientId: 'c1'});
  const media = 'exercise-media/' + trainer + '/batch-1/clip.mp4';
  allowed(await readObject(null, media), 'exercise media: anonymous GET of a known file (public technique media)');
  allowed(await readObject(client, media), 'exercise media: assigned client GET');
  denied(await listPrefix(null, 'exercise-media/' + trainer + '/batch-1/'), 'exercise media: anonymous cannot list a trainer folder');
  denied(await listPrefix(client, 'exercise-media/' + trainer + '/batch-1/'), 'exercise media: client cannot list the trainer folder');
  denied(await listPrefix(fresh, 'exercise-media/' + trainer + '/batch-1/'), 'exercise media: other account cannot list the trainer folder');
  allowed(await listPrefix(trainer, 'exercise-media/' + trainer + '/batch-1/'), 'exercise media: owner trainer lists own folder');
  denied(await listPrefix(null, 'exercise-gifs/' + trainer + '/'), 'legacy gifs: anonymous cannot list');
  // Klient (konto klienta bez roli trenera) nie wgrywa nic, a ścieżki spoza mediów ćwiczeń są zamknięte dla wszystkich.
  denied(await upload(client, 'exercise-media/' + client + '/b/x.mp4'), 'client account cannot upload exercise media');
  for (const priv of ['progress-photos/' + trainer + '/c1/front.jpg', 'clients/' + trainer + '/c1/doc.png', 'uploads/x.png']) {
    denied(await upload(trainer, priv, 'image/png'), priv + ': trainer upload outside exercise media denied');
    denied(await upload(client, priv, 'image/png'), priv + ': client upload outside exercise media denied');
    denied(await readObject(null, priv), priv + ': anonymous read denied');
    denied(await readObject(client, priv), priv + ': client read denied');
  }
  denied(await listPrefix(null, ''), 'anonymous cannot list the bucket root');

  // Film techniki klienta → przypisany trener (prywatny).
  const trainer2 = run + '-trainer2', client2 = run + '-client2', clientOther = run + '-client-other';
  await db.doc('trainerRoles/' + trainer2).set({uid: trainer2, role: 'trainer', enabled: true});
  await db.doc('clientAccounts/' + client2).set({uid: client2, role: 'client', trainerId: trainer, clientId: 'c2'});
  await db.doc('clientAccounts/' + clientOther).set({uid: clientOther, role: 'client', trainerId: trainer2, clientId: 'c9'});
  const vid = name => 'client-videos/' + trainer + '/c1/' + name;
  allowed(await upload(client, vid('v_abc12345.mp4')), 'client video: client uploads to own trainer folder');
  allowed(await upload(client, vid('v_iphone123.mov'), 'video/quicktime'), 'client video: iPhone .mov (video/quicktime)');
  allowed(await upload(client, vid('v_webm12345.webm'), 'video/webm'), 'client video: webm');
  denied(await upload(client, 'client-videos/' + trainer2 + '/c1/v_foreign01.mp4'), 'client video: client cannot upload to another trainer');
  denied(await upload(client, 'client-videos/' + trainer + '/c2/v_foreign02.mp4'), 'client video: client cannot upload as another client');
  denied(await upload(trainer, vid('v_trainer01.mp4')), 'client video: trainer cannot upload into client folder');
  denied(await upload(null, vid('v_anon00001.mp4')), 'client video: anonymous upload');
  denied(await upload(fresh, vid('v_fresh0001.mp4')), 'client video: account without client link');
  denied(await upload(client, vid('v_html00001.mp4'), 'text/html'), 'client video: non-video type');
  denied(await upload(client, vid('v_image0001.mp4'), 'image/png'), 'client video: image type');
  denied(await upload(client, vid('../evil.mp4')), 'client video: bad file name');
  denied(await upload(client, vid('v_avi000001.avi'), 'video/x-msvideo'), 'client video: unsupported format');
  denied(await upload(client, vid('v_big0000001.mp4'), 'video/mp4', Buffer.alloc(75 * 1024 * 1024 + 16)), 'client video: larger than 75 MB');
  denied(await upload(client, vid('v_abc12345.mp4')), 'client video: existing file cannot be replaced');
  allowed(await readObject(client, vid('v_abc12345.mp4')), 'client video: client reads own video');
  allowed(await readObject(trainer, vid('v_abc12345.mp4')), 'client video: assigned trainer reads');
  denied(await readObject(trainer2, vid('v_abc12345.mp4')), 'client video: another trainer cannot read');
  denied(await readObject(client2, vid('v_abc12345.mp4')), 'client video: another client of the same trainer cannot read');
  denied(await readObject(clientOther, vid('v_abc12345.mp4')), 'client video: client of another trainer cannot read');
  denied(await readObject(fresh, vid('v_abc12345.mp4')), 'client video: unrelated account cannot read');
  denied(await readObject(null, vid('v_abc12345.mp4')), 'client video: anonymous cannot read or download');
  denied(await listPrefix(trainer, 'client-videos/' + trainer + '/c1/'), 'client video: even the trainer cannot list');
  denied(await listPrefix(client, 'client-videos/' + trainer + '/c1/'), 'client video: client cannot list');
  denied(await listPrefix(null, 'client-videos/'), 'client video: anonymous cannot list');
  denied(await removeObject(trainer2, vid('v_abc12345.mp4')), 'client video: another trainer cannot delete');
  denied(await removeObject(client2, vid('v_abc12345.mp4')), 'client video: another client cannot delete');
  denied(await removeObject(null, vid('v_abc12345.mp4')), 'client video: anonymous cannot delete');
  allowed(await removeObject(client, vid('v_abc12345.mp4')), 'client video: client deletes own video');
  denied(await readObject(trainer, vid('v_abc12345.mp4')).then(s => s === 404 ? 403 : s), 'client video: deleted video is gone');
  allowed(await removeObject(trainer, vid('v_iphone123.mov')), 'client video: assigned trainer deletes');

  // Progress Voice: zwroty z imieniem klienta — zapisuje tylko serwer (tu: upload odrzucony dla wszystkich).
  const vn = 'client-voice/' + trainer + '/c1/n_0123456789abcdef.mp3';
  denied(await upload(trainer, vn, 'audio/mpeg'), 'voice name: trainer cannot upload (server only)');
  denied(await upload(client, vn, 'audio/mpeg'), 'voice name: client cannot upload');
  denied(await readObject(trainer2, vn).then(s => s === 404 ? 403 : s), 'voice name: another trainer cannot read');
  denied(await readObject(null, vn).then(s => s === 404 ? 403 : s), 'voice name: anonymous cannot read');
  denied(await listPrefix(client, 'client-voice/' + trainer + '/c1/'), 'voice name: client cannot list');
  await db.doc('clientAccounts/' + client).set({uid: client, role: 'client', trainerId: trainer2, clientId: 'c1'});
  denied(await readObject(client, vid('v_webm12345.webm')), 'client video: client moved to another trainer loses access');
  console.log(count + ' storage rule assertions; failures: 0');
})().catch(error => { console.error(error.stack); process.exitCode = 1; })
  .finally(async () => { await db.terminate(); await deleteApp(app); });
