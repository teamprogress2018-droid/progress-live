'use strict';
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
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
const WA_TOKEN = defineSecret('WHATSAPP_TOKEN');
const WA_PHONE_ID = defineString('WHATSAPP_PHONE_NUMBER_ID', {default: ''});
const WA_APP_SECRET = defineSecret('WHATSAPP_APP_SECRET');
const WA_VERIFY = defineSecret('WHATSAPP_VERIFY_TOKEN');

function secretValue(secret) { try { return secret.value() || ''; } catch (e) { return ''; } }
/** Które ustawienia są obecne — tylko tak/nie, wartości nie wychodzą poza tę funkcję. */
function commsConfig() {
  return comms.commsConfigStatus({
    VAPID_PUBLIC_KEY: VAPID_PUBLIC.value(), VAPID_PRIVATE_KEY: secretValue(VAPID_PRIVATE),
    WHATSAPP_TOKEN: secretValue(WA_TOKEN), WHATSAPP_PHONE_NUMBER_ID: WA_PHONE_ID.value()
  });
}

function commsProviders() {
  const p = {};
  try { if (VAPID_PUBLIC.value() && VAPID_PRIVATE.value()) p.push = comms.webPushProvider({publicKey: VAPID_PUBLIC.value(), privateKey: VAPID_PRIVATE.value(), subject: VAPID_SUBJECT.value()}); } catch (e) { logger.warn('comms-push-config'); }
  try { if (WA_TOKEN.value() && WA_PHONE_ID.value()) p.whatsapp = comms.whatsappProvider({token: WA_TOKEN.value(), phoneNumberId: WA_PHONE_ID.value()}); } catch (e) { logger.warn('comms-wa-config'); }
  return p;
}

exports.commsScheduler = onSchedule({
  schedule: 'every 5 minutes', timeZone: 'Europe/Warsaw', region: 'europe-west1',
  timeoutSeconds: 120, memory: '256MiB', maxInstances: 1, concurrency: 1, retryCount: 0,
  secrets: [VAPID_PRIVATE, WA_TOKEN]
}, async event => {
  const config = commsConfig();
  for (const [channel, c] of Object.entries(config)) {
    if (!c.configured) logger.warn('comms-config-missing', {channel, missing: c.missing}); // same nazwy ustawień
  }
  const totals = await comms.runComms(getFirestore(), {runId: String(event.scheduleTime), providers: commsProviders(), config});
  logger.info('comms-summary', totals); // tylko liczniki, bez treści i nazw klientów
});

exports.whatsappWebhook = onRequest({region: 'europe-west1', maxInstances: 2, secrets: [WA_APP_SECRET, WA_VERIFY]}, async (req, res) => {
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
