'use strict';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {defineSecret, defineString} = require('firebase-functions/params');
const {logger} = require('firebase-functions');
const {drainPending} = require('./worker.cjs');
const {youtubeCurationSuggest} = require('./youtube-curation.cjs');
const comms = require('./comms-worker.cjs');
initializeApp();

exports.continuePendingAutoflow = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Europe/Warsaw', region: 'europe-west1',
  timeoutSeconds: 120, memory: '256MiB', maxInstances: 1, concurrency: 1,
  retryCount: 0
}, async event => {
  const counts = await drainPending(getFirestore(), {runId: String(event.scheduleTime), maxJobs: 100});
  logger.info('autoflow-pending-summary', counts);
});

exports.youtubeCurationSuggest = youtubeCurationSuggest;

// ---------- Wiadomości automatyczne (przypomnienia o spotkaniach i A–F) ----------
// Sekrety ustawia administrator: firebase functions:secrets:set NAZWA. Bez nich kanał nie wysyła (symulacja).
const VAPID_PUBLIC = defineString('VAPID_PUBLIC_KEY', {default: ''});
const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', {default: 'mailto:kontakt@teamprogress.pl'});
// WhatsApp jest włączany osobno: dopiero gdy w .env.<projekt> jest COMMS_WHATSAPP=on (po założeniu konta Meta
// i ustawieniu sekretów). Bez tego sekrety WhatsApp nie są deklarowane, więc wdrożenie push ich nie wymaga.
const WA_ON = process.env.COMMS_WHATSAPP === 'on';
const WA_TOKEN = WA_ON ? defineSecret('WHATSAPP_TOKEN') : null;
const WA_PHONE_ID = WA_ON ? defineString('WHATSAPP_PHONE_NUMBER_ID', {default: ''}) : null;
const WA_APP_SECRET = WA_ON ? defineSecret('WHATSAPP_APP_SECRET') : null;
const WA_VERIFY = WA_ON ? defineSecret('WHATSAPP_VERIFY_TOKEN') : null;

function secretValue(secret) { try { return (secret && secret.value()) || ''; } catch (e) { return ''; } }
/** Które ustawienia są obecne — tylko tak/nie, wartości nie wychodzą poza tę funkcję. */
function commsConfig() {
  return comms.commsConfigStatus({
    VAPID_PUBLIC_KEY: VAPID_PUBLIC.value(), VAPID_PRIVATE_KEY: secretValue(VAPID_PRIVATE),
    WHATSAPP_TOKEN: secretValue(WA_TOKEN), WHATSAPP_PHONE_NUMBER_ID: secretValue(WA_PHONE_ID)
  });
}

function commsProviders() {
  const p = {};
  try { if (VAPID_PUBLIC.value() && VAPID_PRIVATE.value()) p.push = comms.webPushProvider({publicKey: VAPID_PUBLIC.value(), privateKey: VAPID_PRIVATE.value(), subject: VAPID_SUBJECT.value()}); } catch (e) { logger.warn('comms-push-config'); }
  try { if (WA_ON && WA_TOKEN.value() && WA_PHONE_ID.value()) p.whatsapp = comms.whatsappProvider({token: WA_TOKEN.value(), phoneNumberId: WA_PHONE_ID.value()}); } catch (e) { logger.warn('comms-wa-config'); }
  return p;
}

exports.commsScheduler = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Europe/Warsaw', region: 'europe-west1',
  timeoutSeconds: 120, memory: '256MiB', maxInstances: 1, concurrency: 1, retryCount: 0,
  // WhatsApp dojdzie później: jego sekrety dopisać tutaj dopiero po założeniu konta Meta (wdrożenie wymaga istnienia sekretów).
  secrets: [VAPID_PRIVATE]
}, async event => {
  const config = commsConfig();
  for (const [channel, c] of Object.entries(config)) {
    if (!c.configured) logger.warn('comms-config-missing', {channel, missing: c.missing}); // same nazwy ustawień
  }
  const totals = await comms.runComms(getFirestore(), {runId: String(event.scheduleTime), providers: commsProviders(), config});
  logger.info('comms-summary', totals); // tylko liczniki, bez treści i nazw klientów
});

// ---------- Powiadomienia dla trenera: nowa wiadomość / film / koniec treningu od klienta ----------
// Te same klucze VAPID co przypomnienia klientów. Bez kluczy nic nie wysyła (licznik skipped).
let trainerWebpush = null;
function trainerPushClient() {
  if (trainerWebpush) return trainerWebpush;
  try {
    if (!VAPID_PUBLIC.value() || !VAPID_PRIVATE.value()) return null;
    const wp = require('web-push');
    wp.setVapidDetails(VAPID_SUBJECT.value(), VAPID_PUBLIC.value(), VAPID_PRIVATE.value());
    trainerWebpush = wp;
    return wp;
  } catch (e) { logger.warn('trainer-push-config'); return null; }
}
exports.trainerMessagePush = onDocumentCreated({
  document: 'messages/{messageId}', region: 'europe-west1', maxInstances: 5, retry: false,
  timeoutSeconds: 30, memory: '256MiB', secrets: [VAPID_PRIVATE]
}, async event => {
  const msg = event.data && event.data.data();
  if (!msg || msg.out === true) return;
  const res = await comms.notifyTrainerOfMessage(getFirestore(), msg, {webpush: trainerPushClient()});
  logger.info('trainer-push', res); // tylko liczniki
});

if (WA_ON) exports.whatsappWebhook = onRequest({region: 'europe-west1', maxInstances: 2, secrets: [WA_APP_SECRET, WA_VERIFY]}, async (req, res) => {
  if (req.method === 'GET') {
    const ok = req.query['hub.mode'] === 'subscribe' && WA_VERIFY.value() && req.query['hub.verify_token'] === WA_VERIFY.value();
    res.status(ok ? 200 : 403).send(ok ? String(req.query['hub.challenge'] || '') : 'forbidden');
    return;
  }
  if (req.method !== 'POST' || !comms.verifyWhatsAppSignature(req.rawBody, req.get('x-hub-signature-256'), WA_APP_SECRET.value())) {
    res.status(401).send('bad signature'); return;
  }
  const out = await comms.handleWhatsAppWebhook(getFirestore(), req.body);
  logger.info('whatsapp-webhook', out);
  res.status(200).send('ok');
});

// ---------- Progress Voice: imię klienta głosem trenera (ElevenLabs) ----------
// Wdrażana osobno (pilot.sh voice) — wymaga sekretu ELEVENLABS_API_KEY.
exports.voiceNameClips = require('./voice-names.cjs').voiceNameClipsFunction();
