'use strict';
// Wiadomości automatyczne — praca serwera na danych testowych w pamięci (bez Firebase, bez sieci, bez prawdziwych klientów).
// Scenariusze: wyłączone domyślnie, symulacja, przypomnienie raz (dwie instancje naraz), zmiana i odwołanie terminu,
// brak zgody, błąd dostawcy z ponowieniem i kanałem zapasowym, wygasła subskrypcja push, statusy i odpowiedzi z WhatsApp.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
// Worker importuje ./comms-core.js (kopiowany przy wdrożeniu) — w teście wskazujemy plik z repozytorium.
const Module = require('node:module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === './comms-core.js' && parent && /comms-worker\.cjs$/.test(parent.filename)) return path.join(__dirname, '../../comms-core.js');
  return origResolve.call(this, req, parent, ...rest);
};
const W = require('./comms-worker.cjs');
const Core = require('../../comms-core.js');

let count = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); count++; };

function getPath(o, k) { return k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); }
function setPath(o, k, v) { const ps = k.split('.'); let a = o; ps.slice(0, -1).forEach(p => { a[p] = a[p] && typeof a[p] === 'object' ? a[p] : {}; a = a[p]; }); a[ps[ps.length - 1]] = v; }
function fakeDb() {
  const store = {};
  const col = name => (store[name] = store[name] || {});
  function ref(name, id) {
    return {
      id, path: name + '/' + id,
      async get() { const d = col(name)[id]; return {exists: !!d, id, data: () => d && JSON.parse(JSON.stringify(d)), ref: ref(name, id)}; },
      async set(data, opt) { col(name)[id] = opt && opt.merge ? {...(col(name)[id] || {}), ...data} : JSON.parse(JSON.stringify(data)); },
      async create(data) { if (col(name)[id]) throw new Error('6 ALREADY_EXISTS'); col(name)[id] = JSON.parse(JSON.stringify(data)); },
      async update(patch) { if (!col(name)[id]) throw new Error('NOT_FOUND'); Object.entries(patch).forEach(([k, v]) => setPath(col(name)[id], k, JSON.parse(JSON.stringify(v)))); },
      async delete() { delete col(name)[id]; }
    };
  }
  function query(name, filters = [], lim = 1e9) {
    return {
      where(f, op, v) { return query(name, filters.concat([[f, op, v]]), lim); },
      limit(n) { return query(name, filters, n); },
      async get() {
        const docs = Object.entries(col(name)).filter(([, d]) => filters.every(([f, op, v]) => {
          const x = getPath(d, f);
          return op === '==' ? x === v : op === '>=' ? x >= v : op === '<=' ? x <= v : false;
        })).slice(0, lim).map(([id, d]) => ({id, data: () => JSON.parse(JSON.stringify(d)), ref: ref(name, id)}));
        return {docs, empty: !docs.length};
      }
    };
  }
  return {
    _store: store,
    collection(name) {
      if (name.includes('/')) return {get: async () => { const docs = Object.entries(col(name)).map(([id, d]) => ({id, data: () => d, ref: ref(name, id)})); return {docs, empty: !docs.length}; }};
      return {...query(name), doc: id => ref(name, id)};
    },
    // Transakcje wykonują się jedna po drugiej (jak serializacja konfliktów w Firestore).
    _lock: Promise.resolve(),
    runTransaction(fn) {
      const run = async () => {
        const tx = {get: r => r.get(), update: (r, p) => { tx._w.push(() => r.update(p)); }, set: (r, d, o) => { tx._w.push(() => r.set(d, o)); }, _w: []};
        const out = await fn(tx);
        for (const w of tx._w) await w();
        return out;
      };
      const p = this._lock.then(run, run);
      this._lock = p.catch(() => {});
      return p;
    }
  };
}

const T = 'trainer-1', C = 'client-1';
const now = Core.warsawToMs('2026-11-22', '18:00'); // dzień przed spotkaniem 23.11 18:00
const iso = ms => new Date(ms).toISOString();
function seed(db, extra = {}) {
  const s = db._store;
  s['serverAutomation/private/trainers'] = {[T]: {comms: {enabled: true, enabledAt: '2026-11-01T00:00:00Z', live: extra.live === true, channels: ['push', 'whatsapp']}}};
  s.clients = {[C]: {id: C, trainerId: T, name: 'Anna', status: extra.status || 'active'}};
  s.sessions = {s1: {id: 's1', trainerId: T, clientId: C, date: '2026-11-23', time: '18:00', source: 'planned', ...(extra.session || {})}};
  s.plans = {};
  s.commsPrefs = extra.prefs === null ? {} : {[C]: {id: C, trainerId: T, clientId: C, channel: 'whatsapp',
    whatsapp: {optIn: true, phone: '48600100200'}, push: {subscribed: true}, ...(extra.prefs || {})}};
  s.pushSubscriptions = {sub1: {id: 'sub1', trainerId: T, clientId: C, endpoint: 'https://push.example.test/1', keys: {p256dh: 'k', auth: 'a'}}};
  s.settings = {};
  return db;
}
const jobs = db => Object.values(db._store.commsJobs || {});
const reminder = db => jobs(db).find(j => j.kind === 'meeting_reminder');

(async () => {
  // 1. Domyślnie wyłączone: brak konfiguracji = nic się nie dzieje.
  let db = fakeDb(); seed(db); db._store['serverAutomation/private/trainers'][T].comms.enabled = false;
  let r = await W.runComms(db, {runId: 'r1', nowMs: now});
  ok(r.trainers === 0 && !jobs(db).length, 'disabled by default');

  // 2. Symulacja: zadanie tworzone i oznaczone „symulacja”, żaden dostawca nie jest wywołany.
  db = seed(fakeDb());
  let calls = 0;
  const spy = {send: async () => { calls++; return {ok: true, providerId: 'wamid.X'}; }};
  r = await W.runComms(db, {runId: 'r2', nowMs: now, providers: {whatsapp: spy, push: spy}});
  ok(reminder(db) && reminder(db).status === 'simulated' && calls === 0, 'simulation sends nothing');
  ok(/symulacji/.test(reminder(db).history.slice(-1)[0].note), 'simulation is labelled in history');

  // 3. Na żywo, dwie instancje naraz: jedno wysłanie, status „przekazano do dostawcy”.
  db = seed(fakeDb(), {live: true}); calls = 0;
  await Promise.all([W.runComms(db, {runId: 'a', nowMs: now, providers: {whatsapp: spy}}), W.runComms(db, {runId: 'b', nowMs: now, providers: {whatsapp: spy}})]);
  ok(calls === 1, 'no double send with concurrent runs (calls=' + calls + ')');
  ok(reminder(db).status === 'handed_over' && reminder(db).channel === 'whatsapp' && reminder(db).providerId === 'wamid.X', 'handed over to WhatsApp');
  await W.runComms(db, {runId: 'c', nowMs: now + 5 * 60000, providers: {whatsapp: spy}});
  ok(calls === 1, 'next run does not resend');

  // 4. Statusy z WhatsApp: dostarczono, odczytano; spóźnione „sent” nie cofa.
  const st = s => ({entry: [{changes: [{value: {statuses: [{id: 'wamid.X', status: s}]}}]}]});
  await W.handleWhatsAppWebhook(db, st('delivered'), now + 60000);
  await W.handleWhatsAppWebhook(db, st('read'), now + 120000);
  await W.handleWhatsAppWebhook(db, st('sent'), now + 130000);
  ok(reminder(db).status === 'read', 'delivery and read statuses from provider');

  // 5. Odpowiedź klienta przyciskiem „Potwierdzam” → sprawa zakończona; „STOP” → rezygnacja z WhatsApp.
  const msg = (id, extra) => ({entry: [{changes: [{value: {messages: [{id, from: '48600100200', ...extra}]}}]}]});
  await W.handleWhatsAppWebhook(db, msg('m1', {type: 'button', button: {text: 'Potwierdzam'}}), now);
  await W.handleWhatsAppWebhook(db, msg('m1', {type: 'button', button: {text: 'Potwierdzam'}}), now); // ponowiony webhook
  let cases = Object.values(db._store.commsCases || {});
  ok(cases.length === 1 && cases[0].type === 'meeting_confirm' && cases[0].status === 'done' && cases[0].source === 'whatsapp', 'button confirm creates one case');
  await W.handleWhatsAppWebhook(db, msg('m2', {type: 'text', text: {body: 'Czy możemy przełożyć na czwartek?'}}), now);
  cases = Object.values(db._store.commsCases);
  ok(cases.some(c => c.type === 'message' && c.status === 'new'), 'free text reply goes to „Do odpowiedzi”');
  await W.handleWhatsAppWebhook(db, msg('m3', {type: 'text', text: {body: 'STOP'}}), now);
  ok(db._store.commsPrefs[C].whatsapp.optIn === false && db._store.commsPrefs[C].whatsapp.optOutAt, 'STOP opts out');
  const unknown = await W.handleWhatsAppWebhook(db, {entry: [{changes: [{value: {messages: [{id: 'x', from: '48999', text: {body: 'hej'}}]}}]}]}, now);
  ok(unknown.unknown === 1, 'message from unknown number is not attached to any client');

  // 6. Zmiana terminu po zaplanowaniu: stare przypomnienie anulowane, nowe na nowy termin + informacja o zmianie.
  db = seed(fakeDb());
  await W.runComms(db, {runId: 'x', nowMs: now - 26 * 3600000}); // dzień wcześniej: przypomnienie jeszcze zaplanowane
  ok(reminder(db).status === 'scheduled', 'reminder scheduled in advance');
  db._store.sessions.s1 = {...db._store.sessions.s1, date: '2026-11-24', time: '07:30', changedAt: iso(now - 25 * 3600000)};
  await W.runComms(db, {runId: 'y', nowMs: now - 25 * 3600000 + 60000});
  const all = jobs(db);
  ok(all.some(j => j.kind === 'meeting_reminder' && j.status === 'cancelled' && j.key.endsWith('2026-11-23T18:00')), 'old reminder cancelled after move');
  ok(all.some(j => j.kind === 'meeting_reminder' && j.status === 'scheduled' && j.key.endsWith('2026-11-24T07:30')), 'new reminder for new time');
  ok(all.some(j => j.kind === 'meeting_change'), 'change notice created');

  // 7. Odwołanie: przypomnienie anulowane, informacja o odwołaniu.
  db = seed(fakeDb());
  await W.runComms(db, {runId: 'x', nowMs: now - 26 * 3600000});
  db._store.sessions.s1 = {...db._store.sessions.s1, status: 'cancelled', changedAt: iso(now - 25 * 3600000)};
  await W.runComms(db, {runId: 'y', nowMs: now - 25 * 3600000 + 60000});
  ok(jobs(db).some(j => j.kind === 'meeting_reminder' && j.status === 'cancelled') && jobs(db).some(j => j.kind === 'meeting_cancel'), 'cancel removes reminder and informs');

  // 8. Brak zgody: tylko w aplikacji, nic nie wychodzi na zewnątrz.
  db = seed(fakeDb(), {live: true, prefs: {whatsapp: {optIn: false, phone: '48600100200'}, push: {subscribed: false}}}); calls = 0;
  await W.runComms(db, {runId: 'z', nowMs: now, providers: {whatsapp: spy, push: spy}});
  ok(calls === 0 && reminder(db).status === 'inapp', 'no consent → in-app only');
  db = seed(fakeDb(), {live: true, prefs: null}); calls = 0;
  await W.runComms(db, {runId: 'z', nowMs: now, providers: {whatsapp: spy, push: spy}});
  ok(calls === 0 && reminder(db).status === 'inapp', 'no preferences → in-app only');

  // 9. Błąd dostawcy: ponowienie za 5 min, po 3 próbach kanał zapasowy (push), potem błąd.
  db = seed(fakeDb(), {live: true});
  const bad = {send: async () => ({ok: false, code: 'wa-500'})};
  let pushCalls = 0; const pushBad = {send: async () => { pushCalls++; return {ok: false, code: 'push-500'}; }};
  await W.runComms(db, {runId: 'e1', nowMs: now, providers: {whatsapp: bad, push: pushBad}});
  ok(reminder(db).status === 'retry' && reminder(db).channel === 'whatsapp' && reminder(db).dueAt === now + 5 * 60000, 'retry same channel after 5 min');
  await W.runComms(db, {runId: 'e2', nowMs: now + 5 * 60000, providers: {whatsapp: bad, push: pushBad}});
  await W.runComms(db, {runId: 'e3', nowMs: now + 30 * 60000, providers: {whatsapp: bad, push: pushBad}});
  ok(reminder(db).status === 'retry' && reminder(db).channel === 'push' && reminder(db).fallbackUsed, 'fallback to push after 3 WhatsApp attempts');
  for (let k = 0; k < 4; k++) await W.runComms(db, {runId: 'p' + k, nowMs: now + (2 + k) * 3600000, providers: {whatsapp: bad, push: pushBad}});
  ok(reminder(db).status === 'failed' && pushCalls === 3, 'after fallback attempts: failed (push calls=' + pushCalls + ')');
  ok(reminder(db).history.filter(h => h.status === 'failed').length >= 6, 'every attempt in history');

  // 10. Błąd trwały (numer bez WhatsApp): od razu kanał zapasowy.
  db = seed(fakeDb(), {live: true}); calls = 0;
  await W.runComms(db, {runId: 'q', nowMs: now, providers: {whatsapp: {send: async () => ({ok: false, permanent: true, code: 'wa-131026'})}, push: spy}});
  ok(reminder(db).channel === 'push' && reminder(db).status === 'retry', 'permanent error → fallback immediately');
  await W.runComms(db, {runId: 'q2', nowMs: now + 60000, providers: {push: spy}});
  ok(reminder(db).status === 'handed_over' && reminder(db).channel === 'push', 'fallback push handed over');

  // 11. Web Push: wygasła subskrypcja (410) jest usuwana.
  db = seed(fakeDb());
  const fakeWebPush = {setVapidDetails() {}, sendNotification: async () => { const e = new Error('gone'); e.statusCode = 410; throw e; }};
  const pushP = W.webPushProvider({publicKey: 'p', privateKey: 'k', subject: 'mailto:x@y.z'}, fakeWebPush);
  const res = await pushP.send({job: {clientId: C, kind: 'meeting_reminder', id: 'j'}, text: {title: 't', body: 'b', url: '/'}, db, trainerId: T});
  ok(!res.ok && res.permanent && !db._store.pushSubscriptions.sub1, 'expired push subscription removed');

  // 12. Przerwa w treningach: brak wiadomości.
  db = seed(fakeDb(), {live: true, status: 'paused'}); calls = 0;
  await W.runComms(db, {runId: 'pp', nowMs: now, providers: {whatsapp: spy}});
  ok(calls === 0 && !reminder(db), 'paused client gets nothing');

  // 13. Podpis webhooka WhatsApp.
  const body = Buffer.from('{"x":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  ok(W.verifyWhatsAppSignature(body, sig, 'secret') && !W.verifyWhatsAppSignature(body, sig, 'other') && !W.verifyWhatsAppSignature(body, '', 'secret'), 'webhook signature check');

  // 14. Treść wysyłana przez WhatsApp: szablon, bez danych zdrowotnych.
  let sent;
  const wa = W.whatsappProvider({token: 't', phoneNumberId: '123'}, async (url, o) => { sent = {url, body: JSON.parse(o.body)}; return {ok: true, status: 200, json: async () => ({messages: [{id: 'wamid.Y'}]})}; });
  const out = await wa.send({job: {id: 'j1', kind: 'meeting_reminder', meetingAt: Core.warsawToMs('2026-11-23', '18:00')}, pref: {whatsapp: {phone: '+48 600 100 200'}}, template: Core.whatsappTemplate({kind: 'meeting_reminder', meetingAt: Core.warsawToMs('2026-11-23', '18:00')})});
  ok(out.ok && sent.body.type === 'template' && sent.body.to === '48600100200' && sent.body.template.name === 'progress_przypomnienie_spotkanie', 'WhatsApp template request');
  ok(/graph\.facebook\.com\/v\d+\.\d+\/123\/messages/.test(sent.url), 'Cloud API endpoint');

  // 14b. Klient woli WhatsApp, ale serwer ma włączony tylko push — wiadomość idzie pushem, nie „symulacją”.
  db = seed(fakeDb(), {live: true}); calls = 0;
  db._store['serverAutomation/private/trainers'][T].comms.channels = ['push'];
  await W.runComms(db, {runId: 'pw', nowMs: now, providers: {push: spy}});
  ok(reminder(db).status === 'handed_over' && reminder(db).channel === 'push' && calls === 1, 'falls back to live push when WhatsApp is not enabled');
  db = seed(fakeDb(), {live: true, prefs: {push: {subscribed: false}}}); calls = 0;
  db._store['serverAutomation/private/trainers'][T].comms.channels = ['push'];
  await W.runComms(db, {runId: 'pw2', nowMs: now, providers: {push: spy}});
  ok(reminder(db).status === 'simulated' && calls === 0, 'no push subscription and WhatsApp off: nothing pretends to be sent');

  // 15. Stan dla panelu trenera (commsStatus): symulacja / wymaga konfiguracji / działa — bez treści i danych klientów.
  const stOf = db0 => db0._store.commsStatus && db0._store.commsStatus[T];
  db = seed(fakeDb());
  await W.runComms(db, {runId: 's1', nowMs: now, providers: {whatsapp: spy, push: spy}});
  ok(stOf(db) && stOf(db).channels.whatsapp.mode === 'simulation' && stOf(db).channels.push.mode === 'simulation' && stOf(db).lastRunAt === iso(now), 'status: simulation');
  db = seed(fakeDb(), {live: true});
  const cfgNone = W.commsConfigStatus({});
  await W.runComms(db, {runId: 's2', nowMs: now, providers: {}, config: cfgNone});
  ok(stOf(db).channels.whatsapp.mode === 'needs_config' && stOf(db).channels.push.mode === 'needs_config', 'status: needs configuration when keys are missing');
  ok(stOf(db).channels.whatsapp.missing.join() === 'WHATSAPP_TOKEN,WHATSAPP_PHONE_NUMBER_ID' && reminder(db).status === 'simulated', 'missing names listed; nothing pretends to be sent');
  db = seed(fakeDb(), {live: true});
  const cfgWa = W.commsConfigStatus({WHATSAPP_TOKEN: 'x', WHATSAPP_PHONE_NUMBER_ID: '1'});
  await W.runComms(db, {runId: 's3', nowMs: now, providers: {whatsapp: spy}, config: cfgWa});
  ok(stOf(db).channels.whatsapp.mode === 'live' && stOf(db).channels.push.mode === 'needs_config', 'status: WhatsApp live, push needs configuration');
  const raw = JSON.stringify(stOf(db));
  ok(!/Anna|48600100200|x"|spotkani/i.test(raw) && !raw.includes('"x"'), 'status has no client data, message text or secret values');
  ok(!/48600|token/i.test(JSON.stringify(W.commsConfigStatus({WHATSAPP_TOKEN: 'tajny-token-48600'}))), 'config status never contains values');

  console.log('comms worker: ' + count + ' checks passed');
})().catch(e => { console.error(e); process.exit(1); });
