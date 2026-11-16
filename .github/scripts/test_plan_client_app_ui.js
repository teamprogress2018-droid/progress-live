#!/usr/bin/env node
'use strict';
/** UI: Plan klienta w aplikacji klienta — karta jedzenia na „Dzisiaj”, „Moje jedzenie” i „Lista zakupów” w „Więcej”,
 *  dodatkowe pytania check-inu (nastrój, głód, najtrudniejsza rzecz). Bez planu nic z tego się nie pokazuje. */
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

async function open(browser, withPlan) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=pk-client', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate((withPlan) => {
    window._uid = 'pk-client'; window._trainerId = 'pk-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'pk-client' };
    window.persistById = async (_c, x) => x; window.__notes = []; window.notify = m => window.__notes.push(m);
    try { localStorage.clear(); } catch (e) {}
    const c = { id: 'c1', trainerId: 'pk-trainer', name: 'Anna Kowalczyk', status: 'active', goal: 'redukcja', weight: 74, height: 168, age: 38, gender: 'K', trainingFreq: 3 };
    if (withPlan) {
      const n = PlanClient.buildNutrition(c, 'week', { trainDays: [1, 3, 5], people: 2 });
      c.dietPlan = { status: 'zatwierdzony', source: 'plan-klienta', approvedAt: '2026-11-15T10:00:00Z', kcal: n.kcal, plan: PlanClient.publicPlan(n), text: 'x' };
      c.clientPlanPublished = '2026-11-15T10:00:00Z';
    }
    window.CL = [c]; window.PL = []; window.SE = []; window.TASKS = []; window.MSGS = { c1: [] }; window.PACKAGES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} } };
    enterClientLiveShell();
  }, withPlan);
  await page.waitForSelector('.cs-today');
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    let { ctx, page, errors } = await open(browser, true);
    ok('Dzisiaj: karta jedzenia na dziś', await page.locator('[data-pkc-today]').count() === 1 && /kcal/.test(await page.textContent('[data-pkc-today]')));
    const more = await page.evaluate(() => capLiveMoreScreens().map(s => s.label));
    ok('Więcej: Moje jedzenie i Lista zakupów', more.includes('Moje jedzenie') && more.includes('Lista zakupów'), more.join(','));
    await page.click('[data-pkc-today] >> text=Moje jedzenie');
    await page.waitForSelector('[data-pkc-food="week"]');
    ok('Moje jedzenie: 7 dni do wyboru', await page.locator('[data-pkc-day]').count() === 7);
    ok('Moje jedzenie: posiłki z porcjami domowymi', await page.locator('.pkc-meal').count() >= 3 && /ok\. /.test(await page.textContent('[data-pkc-food]')));
    ok('Moje jedzenie: dziś zaznaczone', /\(dziś\)/.test(await page.textContent('[data-pkc-food] .cs-card-title')));
    await page.click('[data-pkc-day="6"]');
    ok('zmiana dnia', /Niedziela/.test(await page.textContent('[data-pkc-food] .cs-card-title')));
    await page.click('[data-pkc-food] >> text=Lista zakupów');
    await page.waitForSelector('[data-pkc-shop]');
    ok('Lista zakupów dla 2 osób', /dla 2 osób/.test(await page.textContent('[data-pkc-shop] .cs-lead')) && await page.locator('[data-pkc-item]').count() > 5);
    const first = await page.getAttribute('[data-pkc-item]', 'data-pkc-item');
    await page.click('[data-pkc-item="' + first + '"]');
    ok('odhaczanie produktu zostaje po odświeżeniu ekranu', await page.evaluate(id => { capGoScreen('shopping'); return document.querySelector('[data-pkc-item="' + id + '"]').checked; }, first));
    await page.evaluate(() => capGoScreen('checkin'));
    await page.waitForTimeout(150);
    const ci = await page.textContent('#clive-content, body');
    ok('check-in: nastrój, głód i najtrudniejsza rzecz', /Nastrój/.test(ci) && /Głód/.test(ci) && /Co było najtrudniejsze w tym tygodniu\?/.test(ci));
    await page.evaluate(() => { window._cliveCheckin = { energy: 3, sleep: 3, stress: 2, nutrition: 4 }; return clientSubmitCheckin(); });
    ok('check-in: nastrój i głód obowiązkowe', await page.evaluate(() => (window.__notes.pop() || '').includes('nastrój') && window._cliveCheckin.missing.includes('hunger')));
    ok('telefon: bez poziomego przewijania', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    ok('bez błędów JS', !errors.length, errors.join(' | '));
    await ctx.close();

    ({ ctx, page, errors } = await open(browser, false));
    ok('bez planu: brak karty jedzenia', await page.locator('[data-pkc-today]').count() === 0);
    ok('bez planu: brak pozycji w Więcej', await page.evaluate(() => !capLiveMoreScreens().some(s => s.id === 'food' || s.id === 'shopping')));
    await page.evaluate(() => capGoScreen('checkin'));
    await page.waitForTimeout(150);
    ok('bez planu: check-in bez nowych pytań', !/Co było najtrudniejsze/.test(await page.textContent('body')));
    await ctx.close();
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' plan client app UI test(s) failed'); process.exit(1); }
  console.log('All plan client app UI tests passed.');
})();
