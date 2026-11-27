'use strict';
/**
 * Progress Voice — imię klienta głosem trenera (ElevenLabs), wywoływane przez trenera z profilu klienta.
 *
 * - Wejście: {clientId}. Imię w wołaczu bierze z karty klienta (clients/{clientId}.voiceName, ustawia trener).
 * - Tylko trener z rolą (trainerRoles/{uid}) i tylko dla własnego klienta. Limit 30 wywołań na trenera na dobę.
 * - Nagrywa zwroty VOICE_NAME_LINES (te same teksty co PV_NAME_LINES w client-voice.js) do PRYWATNEJ ścieżki
 *   Storage client-voice/{trainerId}/{clientId}/n_<hash>.mp3 i zapisuje spis w Firestore clientVoice/{clientId}.
 *   Odczyt: tylko ten klient i ten trener (firestore.rules, storage.rules). Zapis: tylko serwer.
 * - Klucz ElevenLabs wyłącznie w sekrecie Firebase ELEVENLABS_API_KEY.
 */
const crypto = require('node:crypto');

const VOICE_ID = 'ktn1ayYhp3s7pvGT1Y3H';
const MODEL = 'eleven_v4';
const TONE = '[energetic, motivating coach voice] ';
const VOICE_NAME_LINES = ['Cześć, {V}!', 'Ostatnia seria, {V}. Dawaj!', 'Świetna robota, {V}!', 'Brawo, {V}!'];
const NAME_RE = /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż' -]{0,23}$/;
const MAX_DAILY = 30;

function nameOk(v) { return NAME_RE.test(String(v || '').trim()); }
function linesFor(name) { return VOICE_NAME_LINES.map(t => t.replace('{V}', String(name).trim())); }
function fileFor(text) { return 'n_' + crypto.createHash('sha1').update(VOICE_ID + '|' + MODEL + '|' + text).digest('hex').slice(0, 16) + '.mp3'; }
function storagePath(trainerId, clientId, file) { return 'client-voice/' + trainerId + '/' + clientId + '/' + file; }

class VoiceError extends Error { constructor(code, message) { super(message); this.code = code; } }

async function elevenTts(apiKey, text, fetchImpl) {
  const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID + '?output_format=mp3_44100_64';
  const r = await (fetchImpl || fetch)(url, {method: 'POST', headers: {'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg'},
    body: JSON.stringify({text: TONE + text, model_id: MODEL})});
  if (!r.ok) throw new VoiceError('unavailable', 'ElevenLabs nie nagrał zwrotu (' + r.status + ').');
  return Buffer.from(await r.arrayBuffer());
}

/**
 * Główna logika (testowalna bez Firebase): db = Firestore (admin), bucket = Storage bucket (admin).
 * Zwraca {name, count, generated}.
 */
async function recordClientName({db, bucket, trainerId, clientId, apiKey, fetchImpl, now}) {
  if (!trainerId) throw new VoiceError('unauthenticated', 'Zaloguj się jako trener.');
  if (!/^[A-Za-z0-9_.:@-]{1,200}$/.test(String(clientId || ''))) throw new VoiceError('invalid-argument', 'Nieprawidłowy klient.');
  const role = await db.collection('trainerRoles').doc(trainerId).get();
  const r = role.exists ? role.data() : null;
  if (!r || r.role !== 'trainer' || r.enabled !== true) throw new VoiceError('permission-denied', 'Ta funkcja jest tylko dla trenera.');
  const cSnap = await db.collection('clients').doc(clientId).get();
  const client = cSnap.exists ? cSnap.data() : null;
  if (!client || client.trainerId !== trainerId) throw new VoiceError('permission-denied', 'To nie jest Twój klient.');
  const name = String(client.voiceName || '').trim();
  if (!nameOk(name)) throw new VoiceError('failed-precondition', 'Najpierw zapisz, jak asystent ma się zwracać do klienta (np. „Anno”).');
  if (!apiKey) throw new VoiceError('failed-precondition', 'Brak klucza ElevenLabs na serwerze (sekret ELEVENLABS_API_KEY).');
  const day = new Date(now || Date.now()).toISOString().slice(0, 10);
  const quotaRef = db.collection('voiceNameQuota').doc(trainerId + '_' + day);
  const q = await quotaRef.get();
  const used = Number(q.exists ? q.data().calls || 0 : 0);
  if (used >= MAX_DAILY) throw new VoiceError('resource-exhausted', 'Dzisiejszy limit nagrań imion jest wykorzystany. Spróbuj jutro.');
  await quotaRef.set({trainerId, day, calls: used + 1}, {merge: true});

  const ref = db.collection('clientVoice').doc(clientId);
  const old = await ref.get();
  const oldItems = old.exists && old.data().trainerId === trainerId ? old.data().items || {} : {};
  const items = {};
  let generated = 0;
  for (const text of linesFor(name)) {
    const file = fileFor(text);
    const f = bucket.file(storagePath(trainerId, clientId, file));
    let exists = false;
    if (oldItems[text] === file) { try { [exists] = await f.exists(); } catch (e) { exists = false; } }
    if (!exists) {
      const buf = await elevenTts(apiKey, text, fetchImpl);
      await f.save(buf, {contentType: 'audio/mpeg', resumable: false, metadata: {cacheControl: 'private, max-age=31536000'}});
      generated++;
    }
    items[text] = file;
  }
  // Stare nagrania (np. po zmianie formy imienia) usuwamy.
  const keep = new Set(Object.values(items));
  for (const file of Object.values(oldItems)) {
    if (!keep.has(file) && /^n_[a-f0-9]{16}\.mp3$/.test(String(file))) { try { await bucket.file(storagePath(trainerId, clientId, file)).delete(); } catch (e) {} }
  }
  await ref.set({trainerId, clientId, name, items, voiceId: VOICE_ID, model: MODEL, updatedAt: new Date(now || Date.now()).toISOString()});
  return {name, count: Object.keys(items).length, generated};
}

function voiceNameClipsFunction() {
  const {onCall, HttpsError} = require('firebase-functions/v2/https');
  const {defineSecret} = require('firebase-functions/params');
  const {getFirestore} = require('firebase-admin/firestore');
  const {getStorage} = require('firebase-admin/storage');
  const key = defineSecret('ELEVENLABS_API_KEY');
  return onCall({
    region: 'europe-west1', timeoutSeconds: 120, memory: '256MiB', maxInstances: 2,
    cors: ['https://teamprogress2018-droid.github.io', 'http://localhost:8080'], secrets: [key]
  }, async request => {
    try {
      let apiKey = ''; try { apiKey = key.value() || ''; } catch (e) { apiKey = ''; }
      return await recordClientName({db: getFirestore(), bucket: getStorage().bucket(), trainerId: request.auth && request.auth.uid,
        clientId: request.data && request.data.clientId, apiKey});
    } catch (e) {
      if (e instanceof VoiceError) throw new HttpsError(e.code, e.message);
      throw new HttpsError('internal', 'Nie udało się nagrać imienia. Spróbuj ponownie.');
    }
  });
}

module.exports = {VOICE_NAME_LINES, NAME_RE, nameOk, linesFor, fileFor, storagePath, recordClientName, voiceNameClipsFunction, VoiceError, MAX_DAILY};
