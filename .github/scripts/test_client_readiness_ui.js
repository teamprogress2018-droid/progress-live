#!/usr/bin/env node
'use strict';
/**
 * Progress Readiness (client-readiness.js), iPhone 390 × 844, atrapa Firebase:
 * opcjonalny check-in na „Dzisiaj” (start treningu bez dodatkowego kroku), 4 pytania + ból tylko przy zgodzie na zdrowie,
 * wynik słowem, „warto skonsultować” = wiadomość do trenera (stałe id, bez szczegółów w 1. linii),
 * odpowiedzi trafiają do planSnapshot.readiness w pierwszym zapisie sesji.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-ready';

async function boot(page, opts = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((o) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-flow' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    window._vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window._vib.push(p); return true; } }); } catch (e) {}
    const fs = {};
    window.__fs = fs; window.__offline = false;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => {
      if (window.__offline) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
      const d = fs[ref.col + '/' + ref.id];
      return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) };
    };
    window.persistById = async (col, obj) => {
      if (window.__offline) return null;
      const c = JSON.parse(JSON.stringify(obj)); delete c._fbId; fs[col + '/' + obj.id] = c; return obj;
    };
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd], injuries: 'Ból barku przy unoszeniu ręki',
      ...(o.noHealth ? { consents: { privacy: { version: '2026-01-01', at: '2026-01-01T00:00:00Z' }, health: { granted: false, at: '2026-01-01T00:00:00Z' } } } : {}) }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18), ex('Przysiad goblet', 2, 10, 16), ex('Plank', 1, 30, 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, opts);
  await page.waitForSelector('.cs-today');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  const today = await page.evaluate(() => ({ link: !!document.querySelector('.cs-today [data-cs-ready-open]'), primaries: document.querySelectorAll('.cs-today .cs-btn-primary').length,
    order: (() => { const l = document.querySelector('[data-cs-ready-open]'); const p = document.querySelector('.cs-today .cs-btn-primary'); return !!(l && p && (p.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)); })() }));
  ok('„Dzisiaj”: link „Jak się dziś czujesz?” pod treningiem, jedna główna akcja', today.link && today.primaries === 1 && today.order, JSON.stringify(today));

  await page.tap('[data-cs-ready-open]');
  await page.waitForSelector('#cs-ready');
  const sheet = await page.evaluate(() => ({ qs: document.querySelectorAll('#cs-ready [data-ready-q]').length, pain: !!document.querySelector('#cs-ready [data-ready-q="pain"]'),
    dis: document.querySelector('#cs-ready [data-ready-save]').disabled, t: document.getElementById('cs-ready').innerText,
    small: [...document.querySelectorAll('#cs-ready button')].filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.innerText) }));
  ok('arkusz: 4 pytania + ból (zgoda na zdrowie), „Zapisz” nieaktywne bez odpowiedzi', sheet.qs === 5 && sheet.pain && sheet.dis, JSON.stringify(sheet));
  ok('arkusz: informacja, że to nie badanie i kto widzi odpowiedzi', /tylko Twój trener/.test(sheet.t) && /nie jest badanie/.test(sheet.t));
  ok('przyciski ≥ 44 px', !sheet.small.length, JSON.stringify(sheet.small));

  // Dobre samopoczucie
  for (const k of ['sleep', 'energy', 'stress', 'soreness']) await page.tap(`#cs-ready [data-ready-q="${k}"] [data-ready-v="2"]`);
  let res = await page.evaluate(() => ({ t: document.querySelector('#cs-ready [data-ready-result]').innerText, dis: document.querySelector('#cs-ready [data-ready-save]').disabled,
    checked: [...document.querySelectorAll('#cs-ready [aria-checked="true"]')].length }));
  ok('wynik: „Dobre samopoczucie”, zapis aktywny, zaznaczenie przez aria-checked', /Dobre samopoczucie/.test(res.t) && !res.dis && res.checked === 4, JSON.stringify(res));
  // Ból → konsultacja
  await page.tap('#cs-ready [data-ready-q="pain"] [data-ready-v="1"]');
  res = await page.evaluate(() => document.querySelector('#cs-ready [data-ready-result]').innerText);
  ok('ból: „Warto skonsultować trening z trenerem”', /Warto skonsultować trening z trenerem/.test(res), res);
  await page.tap('#cs-ready [data-ready-q="sleep"] [data-ready-v="0"]');
  await page.tap('#cs-ready [data-ready-save]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const msgs = Object.entries(window.__fs).filter(([k]) => k.startsWith('messages/')).map(([, v]) => v);
    return { sheet: !!document.getElementById('cs-ready'), done: (document.querySelector('[data-cs-ready-done]') || {}).innerText || '', msgs, notes: window._notes.slice(-1)[0] }; });
  ok('po zapisie: arkusz zamknięty, „Samopoczucie dziś: warto porozmawiać z trenerem”', !after.sheet && /warto porozmawiać z trenerem/.test(after.done), JSON.stringify(after.done));
  const m = after.msgs[0] || {};
  ok('trener dostaje wiadomość (stałe id, 1. linia bez odpowiedzi)', after.msgs.length === 1 && /^msg_ready_c1_/.test(m.id) && /^Samopoczucie przed treningiem — warto porozmawiać/.test(m.text) && !/Sen:/.test(m.text.split('\n')[0]) && /Sen: źle/.test(m.text) && /Ból: tak/.test(m.text) && /nie został zmieniony/.test(m.text), JSON.stringify(m));
  ok('klient dostaje potwierdzenie', /trener dostał Twoje odpowiedzi/.test(after.notes || ''), after.notes);
  // Ponowny zapis tej samej konsultacji nie dubluje wiadomości
  await page.tap('[data-cs-ready-done] .cs-link');
  await page.waitForSelector('#cs-ready');
  await page.tap('#cs-ready [data-ready-save]');
  await page.waitForTimeout(300);
  ok('zmiana odpowiedzi: bez drugiej wiadomości', await page.evaluate(() => Object.keys(window.__fs).filter((k) => k.startsWith('messages/')).length === 1));

  // Start treningu — od razu ćwiczenie, odpowiedzi w pierwszym zapisie sesji
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  await page.waitForTimeout(400);
  const sess = await page.evaluate(() => { const s = Object.entries(window.__fs).find(([k]) => k.startsWith('sessions/')); return { phase: window._cw.phase, snap: s && s[1].planSnapshot && s[1].planSnapshot.readiness, cw: window._cw.readiness }; });
  ok('start: od razu ćwiczenie (bez dodatkowego ekranu)', sess.phase === 'exercise', sess.phase);
  ok('planSnapshot.readiness w zapisie sesji', sess.snap && sess.snap.level === 'consult' && sess.snap.sleep === 0 && sess.snap.pain === true && !!sess.snap.at, JSON.stringify(sess.snap));
  ok('podsumowanie dla trenera ma „Przed treningiem”', await page.evaluate(() => /Przed treningiem: Warto skonsultować trening z trenerem \(sen: źle/.test(csTrainerNoticeText(window._cw))));
  ok('okno treningu u trenera: opis słowami', await page.evaluate(() => readySummary({ sleep: 2, energy: 1, stress: 2, soreness: 2, level: 'mid' }) === 'Umiarkowane samopoczucie (sen: dobrze, energia: średnio, stres: niski, mięśnie: wypoczęte)'));
  ok('bez błędów JS', !errors.length, errors.join(' | '));

  // Bez zgody na dane o zdrowiu: brak pytania o ból
  const p2 = await ctx.newPage(); p2.setDefaultTimeout(20000);
  const err2 = []; p2.on('pageerror', (e) => err2.push(e.message));
  await boot(p2, { noHealth: true });
  await p2.waitForSelector('[data-cs-ready-open]');
  await p2.tap('[data-cs-ready-open]');
  await p2.waitForSelector('#cs-ready');
  ok('bez zgody na zdrowie: brak pytania o ból', await p2.evaluate(() => !document.querySelector('#cs-ready [data-ready-q="pain"]') && document.querySelectorAll('#cs-ready [data-ready-q]').length === 4));
  await p2.keyboard.press('Escape');
  ok('Escape zamyka arkusz', !(await p2.$('#cs-ready')));
  ok('bez błędów JS (2)', !err2.length, err2.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Readiness — OK');
})();
