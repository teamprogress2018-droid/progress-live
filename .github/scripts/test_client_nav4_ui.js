#!/usr/bin/env node
'use strict';
/**
 * Dolny pasek klienta w 4 pozycjach (Progress Clean): Dzisiaj · Trening · Postępy · Trener, bez „Więcej”.
 * Ekran „Trener”: ostatnia wiadomość trenera + jedna główna akcja (czat), lista dawnych ekranów „Więcej”,
 * „Wyloguj się” z potwierdzeniem (nie w nagłówku). Podekrany mają „‹ Trener”, a na pasku świeci „Trener”.
 * Kropka nieprzeczytanej wiadomości / płatności jest na „Trener”. Atrapa danych, bez sieci.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=nav4';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.type() === 'confirm' ? d.dismiss() : d.accept(); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = {}; window.notify = () => {};
    window.persistById = async (c, o) => o; window._signedOut = 0; window.doSignOut = () => { window._signedOut++; };
    const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd] }];
    window.PL = []; window.SE = []; window.TASKS = []; window.PACKAGES = []; window.METRIC_ENTRIES = [];
    MSGS.c1 = [{ id: 'x1', clientId: 'c1', trainerId: 'cs-trainer', out: true, text: 'Cześć Aniu! Świetny trening [film:v_abcdefgh.mp4]', createdAt: new Date().toISOString() }];
    window.SETTINGS = { profile: { name: 'Piotr' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today');

  const nav = await page.evaluate(() => [...document.querySelectorAll('#clive-nav .clive-nav-btn')].map((b) => b.innerText.split('\n')[0].trim()));
  ok('pasek ma 4 pozycje: Dzisiaj, Trening, Postępy, Trener', JSON.stringify(nav) === JSON.stringify(['Dzisiaj', 'Trening', 'Postępy', 'Trener']), JSON.stringify(nav));
  ok('bez przycisku „Więcej” i bez arkusza', await page.evaluate(() => !document.getElementById('clive-bn-more') && document.getElementById('clive-more-sheet').hidden));
  ok('nagłówek bez „Wyloguj”', await page.evaluate(() => !/Wyloguj/.test(document.querySelector('.clive-top').innerText)));
  ok('kropka nowej wiadomości na „Trener”', await page.evaluate(() => { const d = document.querySelector('#clive-bn-trainer .clive-nav-badge'); return !!d && d.style.display !== 'none' && /nowe/.test(d.textContent); }));
  const h = await page.evaluate(() => Math.min(...[...document.querySelectorAll('#clive-nav .clive-nav-btn')].map((b) => b.getBoundingClientRect().height)));
  ok('przyciski paska ≥ 44 px', h >= 44, String(h));

  await page.click('#clive-bn-trainer');
  await page.waitForSelector('.cs-hub');
  const hub = await page.evaluate(() => ({
    text: document.querySelector('.cs-hub').innerText,
    primaries: document.querySelectorAll('.cs-hub .cs-btn-primary').length,
    rows: [...document.querySelectorAll('[data-cs-hub-row]')].map((b) => b.dataset.csHubRow),
    active: document.querySelector('#clive-bn-trainer').getAttribute('aria-current')
  }));
  ok('Trener: ostatnia wiadomość trenera bez znacznika filmu', /NOWA WIADOMOŚĆ/.test(hub.text) && /Świetny trening/.test(hub.text) && !/\[film:/.test(hub.text), hub.text);
  ok('Trener: jedna główna akcja (czat)', hub.primaries === 1 && /Otwórz czat/.test(hub.text));
  ok('Trener: dawne „Więcej” jako lista, Kontakt pierwszy', hub.rows[0] === 'contact' && ['plan', 'notify', 'profile'].every((x) => hub.rows.includes(x)), JSON.stringify(hub.rows));
  ok('Trener podświetlony na pasku', hub.active === 'page');

  await page.click('[data-cs-hub-row="notify"]');
  await page.waitForTimeout(150);
  const sub = await page.evaluate(() => ({ back: !!document.querySelector('[data-cs-back-trainer]'), active: document.querySelector('#clive-bn-trainer').getAttribute('aria-current'), notify: !!document.querySelector('.comms-notify') }));
  ok('podekran (Powiadomienia): „‹ Trener” i podświetlony Trener', sub.back && sub.active === 'page' && sub.notify, JSON.stringify(sub));
  await page.click('[data-cs-back-trainer]');
  ok('„‹ Trener” wraca na ekran Trener', await page.isVisible('.cs-hub'));

  await page.click('[data-cs-hub-chat] .cs-btn-primary');
  await page.waitForTimeout(150);
  ok('czat otwiera się z Trenera i ma powrót', await page.evaluate(() => !!document.querySelector('[data-cs-back-trainer]') && window._clientLiveScreen === 'messages'));
  ok('po otwarciu czatu kropka znika', await page.evaluate(() => { const d = document.querySelector('#clive-bn-trainer .clive-nav-badge'); return !d || d.style.display === 'none'; }));

  await page.click('[data-cs-back-trainer]');
  await page.click('[data-cs-logout]');
  ok('Wyloguj pyta o potwierdzenie; „Anuluj” nie wylogowuje', dialogs.some((m) => /Wylogować się/.test(m)) && (await page.evaluate(() => window._signedOut)) === 0);

  await page.click('#clive-bn-home');
  ok('Dzisiaj działa jak wcześniej', await page.isVisible('.cs-today'));

  ok('brak błędów strony', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' FAILED'); process.exit(1); }
  console.log('client nav 4: all OK');
})().catch((e) => { console.error(e); process.exit(1); });
