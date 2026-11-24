#!/usr/bin/env node
'use strict';
/**
 * Powiadomienia dla trenera (panel „Spotkania i powiadomienia”, Chromium, atrapa Firestore i Push — bez sieci):
 * zgoda tylko po dotknięciu, zapis urządzenia trenera (trainerPushSubscriptions) z wybranymi rodzajami,
 * zmiana rodzajów = usuń + utwórz, wyłączenie, jasne stany (brak obsługi / zablokowane / serwer nie działa),
 * link z powiadomienia ?tchat=<klient> otwiera rozmowę. Treść powiadomień i wysyłkę sprawdza test serwera
 * (server/automation/test-comms-worker.cjs), reguły dostępu — emulator (test-tenant-rules.cjs).
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html';

const INIT = () => {
  window.__perm = 'default';
  window.Notification = class { static get permission() { return window.__perm; } static async requestPermission() { window.__permAsked = (window.__permAsked || 0) + 1; window.__perm = window.__permAnswer || 'granted'; return window.__perm; } };
  const sub = { endpoint: 'https://push.example.test/trainer-device', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'pk', auth: 'au' } }; }, unsubscribe: async () => { window.__unsub = true; return true; } };
  const reg = { pushManager: { getSubscription: async () => window.__sub || null, subscribe: async () => { window.__sub = sub; return sub; } },
    showNotification: async (t, o) => { window.__shown = { t, o }; }, addEventListener() {}, update() {}, unregister: async () => true };
  try { Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), register: async () => reg, getRegistration: async () => reg, getRegistrations: async () => [], addEventListener() {}, controller: null } }); } catch (e) {}
};

async function boot(page, query) {
  await page.goto(BASE + (query || '?nocache=tpush'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    window._uid = 't1'; window._clientAppMode = false;
    window._notes = []; window.notify = (m) => window._notes.push(m);
    const fs = {}; window.__fs = fs; window.__ops = [];
    window._db = {}; window._doc = (_d, c, id) => ({ col: c, id });
    window._setDoc = async (ref, data) => { const k = ref.col + '/' + ref.id; if (fs[k]) { const e = new Error('denied'); e.code = 'permission-denied'; throw e; } fs[k] = JSON.parse(JSON.stringify(data)); window.__ops.push('set'); };
    window._del = async (ref) => { const k = ref.col + '/' + ref.id; if (!fs[k]) { const e = new Error('denied'); e.code = 'permission-denied'; throw e; } delete fs[k]; window.__ops.push('del'); };
    window.persistById = async (c, o) => o;
    window.CL.splice(0, window.CL.length, { id: 'c1', trainerId: 't1', name: 'Anna Nowak', status: 'active' });
    window.MSGS.c1 = [{ id: 'm1', clientId: 'c1', trainerId: 't1', out: false, text: 'Cześć', createdAt: '2026-11-24T05:00:00.000Z' }];
    window._tenantDataReady = true;
  });
}
const panel = (page) => page.evaluate(() => { openCommsPanel(); return document.querySelector('.comms-tp').innerText; });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(INIT);
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await boot(page);

  let t = await panel(page);
  ok('panel: sekcja „Powiadomienia dla Ciebie” z trzema rodzajami', /Powiadomienia dla Ciebie/.test(t) && /Nowe wiadomości od klientów/.test(t) && /Filmy z techniką ćwiczenia/.test(t) && /Zakończone treningi/.test(t), t);
  ok('panel: wyłączone + uczciwy stan serwera (bez statusu = nie działa)', /Wyłączone na tym urządzeniu/.test(t) && /Serwer powiadomień jeszcze nie działa/.test(t), t);
  ok('panel: ekran blokady bez notatek i samopoczucia (opis)', /bez notatek i samopoczucia/.test(t));
  ok('zgoda nie jest proszona bez dotknięcia', await page.evaluate(() => !window.__permAsked));

  await page.click('.comms-tp [data-tp-kind="workout"]');
  await page.click('[data-act="tp-on"]');
  await page.waitForSelector('[data-tp-state="on"]');
  const doc = await page.evaluate(() => Object.entries(window.__fs).find(([k]) => k.startsWith('trainerPushSubscriptions/')));
  ok('włączenie: zgoda po dotknięciu, zapis urządzenia trenera z wybranymi rodzajami', doc && doc[1].trainerId === 't1' && doc[1].kinds.join() === 'message,video' && doc[1].endpoint.startsWith('https://') && /^tps_/.test(doc[1].id) && await page.evaluate(() => window.__permAsked === 1), JSON.stringify(doc));
  ok('włączenie: tylko pola dozwolone w regułach', doc && Object.keys(doc[1]).every((k) => ['id', 'trainerId', 'endpoint', 'keys', 'device', 'kinds', 'createdAt'].includes(k)));
  t = await page.evaluate(() => document.querySelector('.comms-tp').innerText);
  ok('stan: „Włączone na tym urządzeniu” + próbne powiadomienie', /Włączone na tym urządzeniu/.test(t) && await page.locator('[data-act="tp-test"]').count() === 1, t);

  await page.evaluate(() => { window.__ops = []; });
  await page.click('.comms-tp [data-tp-kind="workout"]');
  await page.waitForTimeout(150);
  const changed = await page.evaluate(() => ({ ops: window.__ops.join(), kinds: Object.entries(window.__fs).find(([k]) => k.startsWith('trainerPushSubscriptions/'))[1].kinds }));
  ok('zmiana rodzajów: usuń + utwórz (wpis niezmienny), nowe rodzaje', changed.ops === 'del,set' && changed.kinds.join() === 'message,video,workout', JSON.stringify(changed));

  await page.click('[data-act="tp-test"]');
  await page.waitForTimeout(100);
  ok('próbne powiadomienie: lokalne, z jasnym opisem', await page.evaluate(() => window.__shown && /Progress/.test(window.__shown.t)) && await page.evaluate(() => window._notes.some((n) => /nic nie wysłano z serwera/.test(n))));

  await page.click('[data-act="tp-off"]');
  await page.waitForSelector('[data-tp-state="default"], [data-tp-state="granted"]');
  ok('wyłączenie: wpis usunięty, subskrypcja przeglądarki zostaje (urządzenie może być też klientem)', await page.evaluate(() => !Object.keys(window.__fs).some((k) => k.startsWith('trainerPushSubscriptions/')) && !window.__unsub));

  await page.evaluate(() => { window.__perm = 'denied'; });
  t = await panel(page);
  ok('zablokowane w ustawieniach: jasny komunikat, bez przycisku włączania', /zablokowane/.test(t) && await page.locator('[data-act="tp-on"]').count() === 0, t);
  await page.evaluate(() => { window.__perm = 'default'; window.__permAnswer = 'denied'; });
  await panel(page);
  await page.click('[data-act="tp-on"]');
  await page.waitForTimeout(150);
  ok('odmowa zgody: nic nie zapisane', await page.evaluate(() => !Object.keys(window.__fs).some((k) => k.startsWith('trainerPushSubscriptions/'))));

  // ---------- Link z powiadomienia ----------
  await boot(page, '?tchat=c1');
  await page.waitForTimeout(700);
  ok('link ?tchat=c1 otwiera rozmowę z klientem i czyści adres', await page.evaluate(() => curChat === 'c1' && !/tchat/.test(location.search)));
  await boot(page, '?tchat=' + encodeURIComponent('c1"><img'));
  await page.waitForTimeout(500);
  ok('niebezpieczny link ?tchat jest ignorowany', await page.evaluate(() => curChat !== 'c1"><img'));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Powiadomienia dla trenera (panel, link z powiadomienia) — OK');
})().catch((e) => { console.error(e); process.exit(1); });
