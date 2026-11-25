#!/usr/bin/env node
'use strict';
/**
 * Karta pakietów na „Dzisiaj” (csPayCardHTML) i potwierdzenie „Zapłaciłem” (csConfirmPaid), iPhone 390 × 844:
 * opłacony pakiet w użyciu („Zostało X z Y”) jest osobno od nieopłaconych (każdy z kwotą i słowem „nieopłacony”,
 * suma przy kilku); „Zapłaciłem” najpierw pyta (Anuluj nic nie wysyła, Potwierdź wysyła jedną wiadomość do trenera).
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=paycard';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const boot = (pk) => page.evaluate((pk) => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = {}; window.notify = () => {}; window.persistById = async (c, o) => o;
    window._sent = []; window.pushClientMsg = (m) => window._sent.push(m); window.addNotification = () => {};
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active' }];
    window.PL = []; window.SE = []; window.TASKS = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.PACKAGES = pk;
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell(); setClientLiveScreen('home');
  }, pk);
  const P = (id, o) => Object.assign({ id, clientId: 'c1', title: 'Pakiet ' + id, sessions: 12, sessionsUsed: 0, price: 500, status: 'active' }, o);

  await boot([P('p1', { payStatus: 'paid', sessionsUsed: 4 }), P('p2', { payStatus: 'pending', price: 600 }), P('p3', { payStatus: 'pending', price: 400, sessions: 8 })]);
  await page.waitForSelector('.cs-pay');
  const card = await page.evaluate(() => ({ t: document.querySelector('.cs-pay').innerText, act: document.querySelector('[data-cs-pay-active]') && document.querySelector('[data-cs-pay-active]').innerText, due: document.querySelector('[data-cs-pay-due]').innerText, btns: document.querySelectorAll('.cs-pay [data-cs-paid]').length, primary: document.querySelectorAll('.cs-pay .cs-btn-primary').length }));
  ok('opłacony pakiet w użyciu osobno: „Zostało 8 z 12”', /Opłacony pakiet w użyciu/i.test(card.act || '') && /Zostało\s*8 z 12/.test(card.act || ''), JSON.stringify(card));
  ok('nieopłacone osobno: 2 pakiety, razem 1 000 zł, każdy „nieopłacony”', /Do opłacenia: 2 pakiety · razem 1[\s ]?000 zł/i.test(card.due) && (card.due.match(/nieopłacony/g) || []).length === 2 && !/Zostało/.test(card.due), card.due);
  ok('„Zapłaciłem” przy każdym nieopłaconym, bez czerwonego przycisku w karcie', card.btns === 2 && card.primary === 0, JSON.stringify(card));

  await page.tap('[data-cs-paid="p2"]');
  await page.waitForTimeout(100);
  const dlg = await page.evaluate(() => { const d = document.getElementById('cs-paid-confirm'); return d && { t: d.innerText, role: d.getAttribute('role'), focus: document.activeElement && document.activeElement.innerText }; });
  ok('potwierdzenie: pytanie, pakiet i kwota, fokus na „Anuluj”', dlg && /Czy na pewno chcesz zgłosić opłacenie pakietu\?/.test(dlg.t) && /Pakiet p2/.test(dlg.t) && /600 zł/.test(dlg.t) && dlg.role === 'alertdialog' && /Anuluj/.test(dlg.focus || ''), JSON.stringify(dlg));
  await page.tap('#cs-paid-confirm [data-cs-paid-cancel]');
  ok('„Anuluj”: okno znika, nic nie wysłane', !(await page.$('#cs-paid-confirm')) && (await page.evaluate(() => window._sent.length)) === 0);
  await page.tap('[data-cs-paid="p3"]');
  await page.tap('#cs-paid-confirm [data-cs-paid-ok]');
  const sent = await page.evaluate(() => window._sent);
  ok('„Potwierdź”: jedna wiadomość do trenera o właściwym pakiecie', sent.length === 1 && /Pakiet p3/.test(sent[0]) && /400/.test(sent[0]), JSON.stringify(sent));

  await boot([P('p9', { payStatus: 'pending', sessions: 8, price: 960 })]);
  await page.waitForSelector('.cs-pay');
  const only = await page.evaluate(() => document.querySelector('.cs-pay').innerText);
  ok('tylko nieopłacony: „Pakiet czeka na opłacenie”, bez „Zostało 8 z 8”', /Pakiet do opłacenia/.test(only) && /Pakiet czeka na opłacenie/i.test(only) && /8 treningów · 960 zł · nieopłacony/.test(only) && !/Zostało/.test(only), only);
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Karta pakietów i potwierdzenie wpłaty — OK');
})();
