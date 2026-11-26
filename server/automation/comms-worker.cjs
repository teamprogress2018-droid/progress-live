'use strict';
// Wiadomości automatyczne Progress Live (przypomnienia o spotkaniach i A–F) — praca w tle po zamknięciu aplikacji.
// Logika planowania i statusów jest wspólna z aplikacją: ../../comms-core.js (kopiowany przez prepare-deploy).
// Domyślnie NIC nie jest wysyłane: trener musi mieć w prywatnej konfiguracji serwera comms.enabled === true,
// a bez comms.live === true działa tryb symulacji (statusy „Symulacja — nic nie wysłano”).
const crypto = require('node:crypto');
const Core = require('./comms-core.js');

const CONTROL_PATH = 'serverAutomation/private/trainers';
const DAY = 86400000;
const OPEN = ['scheduled', 'retry'];

function commsControl(control) {
  const c = control && control.comms;
  if (!c || c.enabled !== true || !Number.isFinite(Date.parse(c.enabledAt))) return null;
  return {enabledAt: c.enabledAt, live: c.live === true, channels: Array.isArray(c.channels) ? c.channels : ['push']};
}

async function list(db, col, trainerId, extra) {
  let q = db.collection(col).where('trainerId', '==', trainerId);
  if (extra) q = extra(q);
  const snap = await q.get();
  return snap.docs.map(d => ({...d.data(), _id: d.id}));
}

/** Wczytuje stan trenera potrzebny do zaplanowania wiadomości. */
async function loadState(db, trainerId, nowMs) {
  // 35 dni: podsumowanie miesiąca 1. dnia potrzebuje całego poprzedniego miesiąca.
  const since = new Date(nowMs - 35 * DAY).toISOString().slice(0, 10);
  const [clients, sessions, plans, prefsList, jobs, settingsDocs, packages] = await Promise.all([
    list(db, 'clients', trainerId),
    list(db, 'sessions', trainerId, q => q.where('date', '>=', since)),
    list(db, 'plans', trainerId),
    list(db, 'commsPrefs', trainerId),
    list(db, 'commsJobs', trainerId, q => q.where('dueAt', '>=', nowMs - 10 * DAY)),
    list(db, 'settings', trainerId),
    list(db, 'packages', trainerId).catch(() => [])
  ]);
  // Rekordy: pełna historia tylko klientów z treningiem ukończonym w ostatnich 2 dniach (mało odczytów).
  const recent = new Set(sessions.filter(s => s && s.clientId && s.status !== 'in_progress' &&
    (Date.parse(s.completedAt || s.updatedAt || '') || 0) > nowMs - 2 * DAY).map(s => s.clientId));
  const history = {};
  for (const cid of recent) {
    try { history[cid] = await list(db, 'sessions', trainerId, q => q.where('clientId', '==', cid)); }
    catch (e) { /* bez historii nie ogłaszamy rekordu */ }
  }
  const prefs = {};
  prefsList.forEach(p => { prefs[p.clientId] = p; });
  const settings = (settingsDocs.find(s => s.comms) || {}).comms || {};
  // W kolejce id dokumentu to skrót, a logika porównuje stabilny klucz zadania (key).
  return {clients, sessions, plans, prefs, packages, history, jobs: jobs.map(j => ({...j, id: j.key || j.id})), settings};
}

/** Przelicza kolejkę: tworzy brakujące zadania (tylko jeśli nie istnieją), anuluje nieaktualne. */
async function syncJobs(db, trainerId, state, control, nowMs) {
  const desired = Core.planJobs({...state, enabledAt: control.enabledAt}, nowMs);
  const diff = Core.reconcile(state.jobs, desired);
  const iso = new Date(nowMs).toISOString();
  for (const job of diff.create) {
    const ref = db.collection('commsJobs').doc(safeId(job.id));
    // create() zawodzi, gdy dokument już istnieje — druga instancja nie utworzy duplikatu.
    try {
      await ref.create({...job, id: safeId(job.id), key: job.id, trainerId, createdAt: iso, history: [{at: iso, status: 'scheduled'}]});
    } catch (e) { if (!/already exists|ALREADY_EXISTS/i.test(String(e && e.message))) throw e; }
  }
  for (const c of diff.cancel) {
    await db.runTransaction(async tx => {
      const ref = db.collection('commsJobs').doc(safeId(c.id));
      const snap = await tx.get(ref);
      if (!snap.exists || !OPEN.includes(snap.data().status)) return;
      tx.update(ref, {status: 'cancelled', cancelReason: c.reason, history: snap.data().history.concat({at: iso, status: 'cancelled', note: c.reason})});
    });
  }
  for (const u of diff.update) await db.collection('commsJobs').doc(safeId(u.id)).update({dueAt: u.dueAt});
  return {created: diff.create.length, cancelled: diff.cancel.length};
}
function safeId(key) { return 'cj_' + crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 40); }

/** Zajęcie zadania transakcją: tylko jedna instancja zmieni „zaplanowano” na „wysyłanie”. */
async function claim(db, jobId, runId, nowMs) {
  return db.runTransaction(async tx => {
    const ref = db.collection('commsJobs').doc(jobId);
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const j = snap.data();
    if (!OPEN.includes(j.status) || j.dueAt > nowMs) return null;
    tx.update(ref, {status: 'sending', runId, claimedAt: new Date(nowMs).toISOString()});
    return {...j, _ref: ref};
  });
}

/** Wysyła zadania, których termin minął. providers: {push, whatsapp} (patrz providers niżej). */
async function dispatchDue(db, trainerId, state, control, providers, {runId, nowMs, max = 50}) {
  const counts = {sent: 0, simulated: 0, failed: 0, retry: 0, inapp: 0, task: 0};
  const due = state.jobs.filter(j => OPEN.includes(j.status) && j.dueAt <= nowMs).slice(0, max);
  // Dzienny limit automatów do klienta: wysłane w ostatniej dobie (z kolejki) + wysłane w tym przebiegu.
  const maxPerDay = Core.settingsOf(state.settings).maxPerDay;
  const sentAt = {};
  state.jobs.forEach(j => {
    if (!j.clientId || j.audience === 'trainer' || !['handed_over', 'delivered', 'simulated'].includes(j.status)) return;
    const h = (j.history || []).slice().reverse().find(x => ['handed_over', 'delivered', 'simulated'].includes(x.status));
    const t = Date.parse(h && h.at || '');
    if (Number.isFinite(t) && !['meeting_reminder', 'meeting_change', 'meeting_cancel'].includes(j.kind)) (sentAt[j.clientId] = sentAt[j.clientId] || []).push(t);
  });
  counts.postponed = 0;
  for (const d of due) {
    if (Core.overDailyLimit(d, sentAt[d.clientId], nowMs, maxPerDay)) {
      // Przesuń na jutro 10:00 (poza ciszą nocną) zamiast zasypywać klienta.
      const next = Core.warsawToMs(Core.addDaysYmd(Core.warsawParts(nowMs).ymd, 1), '10:00');
      await db.collection('commsJobs').doc(d._id).update({dueAt: next,
        history: (d.history || []).concat({at: new Date(nowMs).toISOString(), status: 'scheduled', note: 'limit wiadomości na dobę — przesunięte'})});
      counts.postponed++; continue;
    }
    const job = await claim(db, d._id, runId, nowMs);
    if (!job) continue;
    const iso = new Date(nowMs).toISOString();
    const pref = state.prefs[job.clientId] || {};
    let channel = job.channel || Core.pickChannel(pref, job);
    // Na żywo: pierwszy kanał klienta, który serwer naprawdę obsługuje (np. push, gdy WhatsApp nie jest jeszcze włączony).
    if (!job.channel && control.live) {
      const ready = Core.channelsFor(pref, job).find(ch => control.channels.includes(ch) && providers[ch]);
      if (ready) channel = ready;
    }
    const done = (patch, status, extra = {}) => job._ref.update({...patch, status, channel,
      attempts: (job.attempts || 0) + 1, history: (job.history || []).concat({at: iso, status, channel, ...extra})});
    if (channel === 'trainer_task') {
      // F: zadanie kontaktu trafia do „Do odpowiedzi” trenera, nie do klienta.
      const caseId = 'case_' + job._id;
      await db.collection('commsCases').doc(caseId).set({id: caseId, trainerId, clientId: job.clientId, type: 'trainer_contact',
        status: 'new', source: 'system', text: 'Brak aktywności mimo przypomnienia. Skontaktuj się z klientem.', createdAt: iso}, {merge: true});
      await done({}, 'delivered', {note: 'zadanie dla trenera'}); counts.task++; continue;
    }
    if (channel === 'inapp') { await done({}, 'inapp', {note: 'brak zgody lub kanału — widoczne tylko w aplikacji'}); counts.inapp++; continue; }
    const text = Core.texts(job, {studio: (state.settings && state.settings.studioName) || 'Progress'});
    if (!control.live || !control.channels.includes(channel) || !providers[channel]) {
      await done({}, 'simulated', {note: control.live ? 'kanał nie jest skonfigurowany' : 'tryb symulacji'}); counts.simulated++;
      (sentAt[job.clientId] = sentAt[job.clientId] || []).push(nowMs); continue;
    }
    const res = await providers[channel].send({job, pref, text, template: Core.whatsappTemplate(job), db, trainerId});
    if (res && res.ok) {
      await done({providerId: res.providerId || null, handedAt: iso}, 'handed_over'); counts.sent++;
      (sentAt[job.clientId] = sentAt[job.clientId] || []).push(nowMs);
      continue;
    }
    const attemptJob = {...job, channel, attempts: (job.attempts || 0) + 1};
    const next = Core.nextAfterFailure(attemptJob, pref, state.settings, nowMs, !!(res && res.permanent));
    if (next.status === 'retry') {
      await job._ref.update({status: 'retry', channel: next.channel, dueAt: next.dueAt, attempts: next.attempts != null ? next.attempts : attemptJob.attempts,
        fallbackUsed: !!(next.fallbackUsed || job.fallbackUsed), lastError: res && res.code || 'error',
        history: (job.history || []).concat({at: iso, status: 'failed', channel, code: res && res.code || 'error'})});
      counts.retry++;
    } else { await done({lastError: res && res.code || 'error'}, 'failed', {code: res && res.code || 'error'}); counts.failed++; }
  }
  return counts;
}

/** Brakujące ustawienia kanałów (same NAZWY zmiennych, nigdy wartości). env: {NAZWA: wartość|''}. */
const CHANNEL_CONFIG = {
  push: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
  whatsapp: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']
};
function commsConfigStatus(env = {}) {
  const out = {};
  for (const [channel, names] of Object.entries(CHANNEL_CONFIG)) {
    const missing = names.filter(n => !String(env[n] || '').trim());
    out[channel] = {configured: missing.length === 0, missing};
  }
  return out;
}

/** Stan kanału dla panelu trenera: działa / symulacja / wymaga konfiguracji / wyłączony. */
function channelMode(control, config, providers, channel) {
  if (!control.channels.includes(channel)) return 'off';
  if (!providers[channel] || !(config[channel] && config[channel].configured !== false)) return 'needs_config';
  return control.live ? 'live' : 'simulation';
}

/** Dokument commsStatus/{trainerId}: dowód, że serwer pracuje, i stan kanałów. Bez treści wiadomości i danych klientów. */
async function writeStatus(db, trainerId, control, config, providers, counts, nowMs) {
  const iso = new Date(nowMs).toISOString();
  const channels = {};
  for (const ch of Object.keys(CHANNEL_CONFIG)) {
    channels[ch] = {mode: channelMode(control, config, providers, ch), missing: (config[ch] && config[ch].missing) || []};
  }
  await db.collection('commsStatus').doc(trainerId).set({id: trainerId, trainerId, lastRunAt: iso, live: control.live,
    channels, counts: {sent: counts.sent, simulated: counts.simulated, failed: counts.failed, retry: counts.retry}}, {merge: false});
}

/** Jedno uruchomienie harmonogramu dla wszystkich trenerów z włączonymi wiadomościami.
    config: wynik commsConfigStatus — brak ustawień kanału oznacza „wymaga konfiguracji”, nigdy pozorną wysyłkę. */
async function runComms(db, {runId, nowMs = Date.now(), providers = {}, config = null} = {}) {
  if (!config) config = Object.fromEntries(Object.keys(CHANNEL_CONFIG).map(ch => [ch, {configured: !!providers[ch], missing: providers[ch] ? [] : CHANNEL_CONFIG[ch]}]));
  const totals = {trainers: 0, created: 0, cancelled: 0, sent: 0, simulated: 0, failed: 0, retry: 0, inapp: 0, task: 0};
  const snap = await db.collection(CONTROL_PATH).get();
  for (const doc of snap.docs) {
    const control = commsControl(doc.data());
    if (!control) continue;
    const trainerId = doc.id;
    totals.trainers++;
    let state = await loadState(db, trainerId, nowMs);
    const s = await syncJobs(db, trainerId, state, control, nowMs);
    totals.created += s.created; totals.cancelled += s.cancelled;
    state = {...state, jobs: (await list(db, 'commsJobs', trainerId, q => q.where('dueAt', '<=', nowMs))).map(j => ({...j, id: j.key || j.id}))};
    const c = await dispatchDue(db, trainerId, state, control, providers, {runId, nowMs});
    Object.keys(c).forEach(k => { totals[k] += c[k]; });
    await writeStatus(db, trainerId, control, config, providers, c, nowMs);
  }
  return totals;
}

// ---------- dostawcy ----------
/** Web Push (VAPID). Brak potwierdzenia dostarczenia — status zostaje „przekazano do dostawcy”. */
function webPushProvider({publicKey, privateKey, subject}, webpush = require('web-push')) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return {
    async send({job, text, db, trainerId}) {
      const subs = await db.collection('pushSubscriptions').where('trainerId', '==', trainerId).where('clientId', '==', job.clientId).get();
      if (subs.empty) return {ok: false, permanent: true, code: 'no-subscription'};
      let any = false, last = 'error', gone = 0;
      for (const s of subs.docs) {
        const sub = s.data();
        try {
          await webpush.sendNotification({endpoint: sub.endpoint, keys: sub.keys},
            JSON.stringify({title: text.title, body: text.body, url: text.url, tag: job.kind, jobId: job.id}), {TTL: 6 * 3600, urgency: 'normal'});
          any = true;
        } catch (e) {
          last = String(e && e.statusCode || 'error');
          // 404/410 = subskrypcja wygasła (np. usunięta aplikacja, zmiana przeglądarki) — usuwamy ją.
          if (e && (e.statusCode === 404 || e.statusCode === 410)) { await s.ref.delete(); gone++; }
        }
      }
      // Wszystkie telefony klienta wygasły: panel trenera nie może dalej pokazywać „powiadomienia włączone”.
      // Bez pola „off” — po ponownym otwarciu aplikacji (zgoda nadal jest) telefon zapisze się sam.
      if (gone && gone === subs.docs.length) await markPushGone(db, trainerId, job.clientId);
      return any ? {ok: true} : {ok: false, permanent: last === '404' || last === '410', code: 'push-' + last};
    }
  };
}

async function markPushGone(db, trainerId, clientId) {
  try {
    const ref = db.collection('commsPrefs').doc(clientId);
    const snap = await ref.get();
    const p = snap.exists ? snap.data() : null;
    if (!p || p.trainerId !== trainerId || !p.push || !p.push.subscribed) return;
    await ref.update({'push.subscribed': false, 'push.at': new Date().toISOString()});
  } catch (e) { /* stan w panelu to tylko informacja — błąd nie zatrzymuje wysyłki */ }
}

/** WhatsApp Cloud API — wiadomość szablonowa (poza 24-godzinnym oknem dozwolone są tylko zatwierdzone szablony). */
function whatsappProvider({token, phoneNumberId, apiVersion = 'v23.0'}, fetchImpl = fetch) {
  const PERMANENT = new Set([131026, 131050, 131051, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 470]);
  return {
    async send({job, pref, template}) {
      const to = String(pref && pref.whatsapp && pref.whatsapp.phone || '').replace(/\D/g, '');
      if (!template || !to) return {ok: false, permanent: true, code: 'no-template-or-phone'};
      const body = {messaging_product: 'whatsapp', to, type: 'template', biz_opaque_callback_data: job.id,
        template: {name: template.name, language: {code: template.lang},
          components: template.vars.length ? [{type: 'body', parameters: template.vars.map(t => ({type: 'text', text: t}))}] : []}};
      const r = await fetchImpl(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST', headers: {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.messages && json.messages[0]) return {ok: true, providerId: json.messages[0].id};
      const code = json.error && json.error.code;
      return {ok: false, permanent: PERMANENT.has(code) || r.status === 400, code: 'wa-' + (code || r.status)};
    }
  };
}

/** Webhook WhatsApp: weryfikacja podpisu i obsługa statusów oraz odpowiedzi klientów. */
function verifyWhatsAppSignature(rawBody, header, appSecret) {
  if (!header || !appSecret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const WA_STATUS = {sent: 'handed_over', delivered: 'delivered', read: 'read', failed: 'failed'};
const STOP = /^\s*(stop|rezygnuj[eę]?|wypisz|nie chc[eę])\b/i;
async function handleWhatsAppWebhook(db, payload, nowMs = Date.now()) {
  const out = {statuses: 0, messages: 0, optOuts: 0, unknown: 0};
  const iso = new Date(nowMs).toISOString();
  for (const entry of (payload && payload.entry) || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    for (const st of v.statuses || []) {
      const q = await db.collection('commsJobs').where('providerId', '==', st.id).limit(1).get();
      if (q.empty) { out.unknown++; continue; }
      const ref = q.docs[0].ref;
      await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const next = Core.applyProviderEvent(snap.data(), {status: WA_STATUS[st.status], at: iso, channel: 'whatsapp',
          code: st.errors && st.errors[0] && st.errors[0].code});
        tx.update(ref, {status: next.status, history: next.history, ...(next.error ? {lastError: next.error} : {}), ...(next.warning ? {warning: next.warning} : {})});
      });
      out.statuses++;
    }
    for (const m of v.messages || []) {
      const from = String(m.from || '').replace(/\D/g, '');
      const pq = await db.collection('commsPrefs').where('whatsapp.phone', '==', from).limit(1).get();
      if (pq.empty) { out.unknown++; continue; }
      const pref = pq.docs[0].data();
      const text = (m.text && m.text.body) || (m.button && m.button.text) || (m.interactive && m.interactive.button_reply && m.interactive.button_reply.title) || '';
      if (STOP.test(text)) {
        await pq.docs[0].ref.update({'whatsapp.optIn': false, 'whatsapp.optOutAt': iso, updatedAt: iso});
        out.optOuts++;
      }
      const type = /^potwierdzam/i.test(text) ? 'meeting_confirm' : /zmian/i.test(text) && m.button ? 'meeting_change' : 'message';
      const caseId = 'wa_' + crypto.createHash('sha256').update(String(m.id)).digest('hex').slice(0, 32);
      await db.collection('commsCases').doc(caseId).set({id: caseId, trainerId: pref.trainerId, clientId: pref.clientId, type,
        status: type === 'meeting_confirm' ? 'done' : 'new', source: 'whatsapp', text: String(text).slice(0, 2000), createdAt: iso,
        providerMessageId: m.id}, {merge: true});
      out.messages++;
    }
  }
  return out;
}

// ---------- Powiadomienia dla TRENERA o aktywności klienta ----------
// Wyzwalacz: nowa wiadomość w czacie (messages) od klienta (out !== true). Trzy rodzaje:
//  video   — „🎥 Film techniki: …” ze znacznikiem [film:…] (client-video.js),
//  workout — „Zrobiłem trening: …” (podsumowanie po treningu),
//  message — każda inna wiadomość klienta.
// Urządzenia trenera: trainerPushSubscriptions (tylko jego, z wybranymi rodzajami). Na ekranie blokady
// pokazujemy imię klienta i krótki opis — bez notatek, ocen samopoczucia ani pełnej treści dłuższych wiadomości.
const TRAINER_PUSH_KINDS = ['message', 'video', 'workout'];
function trainerPushKind(text) {
  const t = String(text || '');
  if (/\[film:[^\]]+\]/.test(t)) return 'video';
  if (/^Zrobiłem trening/.test(t)) return 'workout';
  return 'message';
}
function trainerPushText(msg, clientName) {
  const raw = String(msg && msg.text || '');
  const kind = trainerPushKind(raw);
  const first = String(clientName || '').trim().split(/\s+/)[0] || 'Klient';
  const clean = raw.replace(/\[[a-z]+:[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim();
  let body;
  if (kind === 'video') {
    const m = /Film techniki:\s*([^\n]+)/.exec(raw);
    body = '🎥 Wysłał(a) film techniki' + (m ? ': ' + m[1].trim().slice(0, 80) : '');
  } else if (kind === 'workout') {
    const m = /^Zrobiłem trening:\s*([^\n]+)/.exec(raw);
    body = '✅ Skończył(a) trening' + (m ? ': ' + m[1].trim().slice(0, 80) : '');
  } else if (/^Samopoczucie przed treningiem/.test(raw)) {
    // Progress Readiness (client-readiness.js): bez odpowiedzi klienta na ekranie blokady.
    body = '💬 Samopoczucie przed treningiem — warto porozmawiać, otwórz czat';
  } else if (/^Zgłoszenie bólu/.test(raw)) {
    // Zgłoszenie bólu z treningu (client-pain.js): na ekranie blokady bez szczegółów zdrowotnych.
    body = '⚠️ Zgłosił(a) ból podczas treningu — otwórz czat';
  } else {
    body = clean.length > 80 ? clean.slice(0, 79) + '…' : (clean || 'Nowa wiadomość');
  }
  return {kind, title: 'Progress · ' + first, body,
    url: '?tchat=' + String(msg.clientId || '').replace(/[^A-Za-z0-9_.:@-]/g, '').slice(0, 200), tag: 'tchat-' + String(msg.clientId || '').slice(0, 60)};
}
/** Wysyła push do urządzeń trenera. Zwraca liczniki bez treści i bez danych klientów. */
async function notifyTrainerOfMessage(db, msg, {webpush} = {}) {
  const out = {sent: 0, skipped: 0, removed: 0, failed: 0};
  if (!msg || msg.out === true || !msg.trainerId || !msg.clientId) { out.skipped++; return out; }
  if (!webpush) { out.skipped++; return out; }
  const subs = await db.collection('trainerPushSubscriptions').where('trainerId', '==', msg.trainerId).get();
  if (subs.empty) { out.skipped++; return out; }
  let name = '';
  try { const c = await db.collection('clients').doc(String(msg.clientId)).get(); if (c.exists && c.data().trainerId === msg.trainerId) name = c.data().name || ''; } catch (e) { name = ''; }
  const n = trainerPushText(msg, name);
  for (const s of subs.docs) {
    const sub = s.data();
    const kinds = Array.isArray(sub.kinds) && sub.kinds.length ? sub.kinds : TRAINER_PUSH_KINDS;
    if (!kinds.includes(n.kind)) { out.skipped++; continue; }
    try {
      await webpush.sendNotification({endpoint: sub.endpoint, keys: sub.keys},
        JSON.stringify({title: n.title, body: n.body, url: n.url, tag: n.tag}), {TTL: 24 * 3600, urgency: 'normal'});
      out.sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await s.ref.delete(); out.removed++; } else out.failed++;
    }
  }
  return out;
}

module.exports = {TRAINER_PUSH_KINDS, trainerPushKind, trainerPushText, notifyTrainerOfMessage, commsControl, commsConfigStatus, channelMode, CHANNEL_CONFIG, loadState, syncJobs, dispatchDue, runComms, safeId, webPushProvider, whatsappProvider,
  verifyWhatsAppSignature, handleWhatsAppWebhook};
