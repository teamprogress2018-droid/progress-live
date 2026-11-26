#!/usr/bin/env node
'use strict';
/**
 * Poprawki po teście na iPhonie (3.0): zakładka „Dieta” na dolnym pasku (jadłospis z kalkulatora rozbity na dni i posiłki),
 * karta „Pakiet wkrótce się kończy” na „Dzisiaj”, przyklejony przycisk zamknięcia w oknie Progress AI.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-fixes';
const DIET_TEXT = ['🍽 Przykładowy jadłospis na 2 dni (2500 kcal dziennie)', 'Białko 180 g · Tłuszcz 70 g · Węglowodany 280 g', '',
  '📅 PONIEDZIAŁEK', '', 'Śniadanie: Owsianka z owocami (~600 kcal, B 30 g)', '• Płatki owsiane 80 g', '• Jogurt naturalny 200 g', '',
  'Obiad: Kurczak z ryżem (~800 kcal, B 55 g)', '• Pierś z kurczaka 180 g', '• Ryż 90 g', '',
  '📅 WTOREK', '', 'Śniadanie: Jajecznica (~550 kcal, B 32 g)', '• Jajka 3 szt.', '',
  '🛒 Lista zakupów na 2 dni:', '• Płatki owsiane 160 g', '• Jajka 6 szt.', '',
  'Produkty suche (ryż, makaron, płatki) waży się przed gotowaniem.'].join('\n');

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
      ...(o.diet ? { dietPlan: o.diet } : {}), ...(o.ai ? { aiCoach: { on: true, limit: 10 } } : {}) }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18), ex('Przysiad goblet', 2, 10, 16), ex('Plank', 1, 30, 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = o.packages || []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, opts);
  await page.waitForSelector('.cs-today');
}


(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  // Bez diety: 4 zakładki
  await boot(page);
  ok('bez diety: 4 zakładki, bez „Dieta”', await page.evaluate(() => document.querySelectorAll('#clive-nav .clive-nav-btn').length === 4 && !document.getElementById('clive-bn-food')));

  // Dieta z kalkulatora
  await boot(page, { diet: { status: 'zatwierdzony', kcal: 2500, protein: 180, fat: 70, carbs: 280, text: DIET_TEXT, updatedAt: '2026-11-17T10:00:00Z' } });
  const nav = await page.evaluate(() => { const n = document.getElementById('clive-nav'); const b = [...n.querySelectorAll('.clive-nav-btn')];
    return { labels: b.map((x) => x.innerText.trim()), fits: n.scrollWidth <= n.clientWidth + 1, small: b.filter((x) => x.getBoundingClientRect().width < 44 || x.getBoundingClientRect().height < 44).length }; });
  ok('320 px: 5 zakładek z „Dieta” przed „Trener”, mieszczą się, ≥ 44 px', JSON.stringify(nav.labels) === JSON.stringify(['Dzisiaj', 'Trening', 'Postępy', 'Dieta', 'Trener']) && nav.fits && !nav.small, JSON.stringify(nav));
  await page.tap('#clive-bn-food');
  await page.waitForSelector('[data-pkc-food="text"]');
  const d = await page.evaluate(() => { const s = document.querySelector('[data-pkc-food="text"]');
    return { t: s.innerText, days: [...s.querySelectorAll('[data-pkc-tday]')].map((x) => [x.querySelector('summary').innerText, x.open]),
      meals: [...s.querySelectorAll('.pkc-tmeal h2')].map((h) => h.innerText), shop: !!s.querySelector('[data-pkc-tshop]'),
      active: document.getElementById('clive-bn-food').classList.contains('active'), back: !!document.querySelector('[data-cs-back-trainer]') }; });
  ok('Dieta: kcal i makro w nagłówku', /2500 kcal · białko 180 g · tłuszcz 70 g · węglowodany 280 g/.test(d.t), d.t.slice(0, 200));
  ok('Dieta: dni jako rozwijane sekcje (pierwszy otwarty)', JSON.stringify(d.days) === JSON.stringify([['Poniedziałek', true], ['Wtorek', false]]), JSON.stringify(d.days));
  ok('Dieta: posiłki jako karty + lista zakupów', d.meals.length === 4 && /^Śniadanie: Owsianka/.test(d.meals[0]) && d.shop, JSON.stringify(d.meals));
  ok('Dieta: zakładka podświetlona, bez „‹ Trener”', d.active && !d.back, JSON.stringify(d));
  ok('Dieta: uwagi i „Zapytaj trenera o dietę”', /waży się przed gotowaniem/.test(d.t) && /Zapytaj trenera o dietę/.test(d.t));
  ok('„Moje jedzenie” zniknęło z listy w „Trener”', await page.evaluate(() => { setClientLiveScreen('trainer'); return !/Moje jedzenie/.test(document.getElementById('clive-screen-content').innerText); }));

  // Pakiet się kończy
  const today = await page.evaluate(() => todayYmd());
  const plus = (n) => { const x = new Date(today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  await boot(page, { packages: [{ id: 'pk1', clientId: 'c1', title: 'Pakiet 10', sessions: 10, sessionsUsed: 8, payStatus: 'paid', status: 'active', expiresDate: plus(30) }] });
  const p1 = await page.evaluate(() => { const s = document.querySelector('.cs-pay'); return s ? { t: s.innerText, end: s.hasAttribute('data-cs-pay-ending') } : null; });
  ok('„Dzisiaj”: 2 treningi do końca → „Pakiet wkrótce się kończy” + Napisz do trenera', p1 && p1.end && /Pakiet wkrótce się kończy/.test(p1.t) && /Zostały Ci 2 treningi/.test(p1.t) && /Napisz do trenera/.test(p1.t), JSON.stringify(p1));
  await boot(page, { packages: [{ id: 'pk1', clientId: 'c1', title: 'Pakiet 10', sessions: 10, sessionsUsed: 2, payStatus: 'paid', status: 'active', expiresDate: plus(3) }] });
  const p2 = await page.evaluate(() => (document.querySelector('.cs-pay') || {}).innerText || '');
  ok('„Dzisiaj”: 3 dni ważności → ostrzeżenie', /ważny jeszcze 3 dni/.test(p2), p2);
  await boot(page, { packages: [{ id: 'pk1', clientId: 'c1', title: 'Pakiet 10', sessions: 10, sessionsUsed: 2, payStatus: 'paid', status: 'active', expiresDate: plus(30) }] });
  const p3 = await page.evaluate(() => { const s = document.querySelector('.cs-pay'); return s ? { t: s.innerText, end: s.hasAttribute('data-cs-pay-ending') } : null; });
  ok('„Dzisiaj”: pakiet daleko od końca → zwykła karta', p3 && !p3.end && /Twój pakiet/.test(p3.t), JSON.stringify(p3));

  // Progress AI: przycisk zamknięcia przyklejony u góry
  await boot(page, { ai: true });
  await page.evaluate(() => paiOpen());
  await page.waitForSelector('#pai-sheet');
  const x = await page.evaluate(() => { const top = document.querySelector('.pai-top'); const b = document.querySelector('.pai-x').getBoundingClientRect(); const gate = getComputedStyle(document.getElementById('pai-sheet'));
    return { pos: getComputedStyle(top).position, h: b.height, w: b.width, topY: b.top, padTop: gate.paddingTop }; });
  ok('Progress AI: pasek z „×” przyklejony (sticky), × ≥ 44 px, w oknie', x.pos === 'sticky' && x.h >= 44 && x.w >= 44 && x.topY >= 0, JSON.stringify(x));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Poprawki klienta — OK');
})();
