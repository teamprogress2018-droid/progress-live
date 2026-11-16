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
    ok('Moje jedzenie: nagłówek z imieniem, celem i makro', await page.evaluate(() => { const h = document.querySelector('[data-dpv-head]'); return !!h && /Anna/.test(h.textContent) && /Łagodna redukcja/.test(h.textContent) && /białko/.test(h.textContent) && /korzystaj z zamienników/.test(h.textContent); }));
    ok('Moje jedzenie: domyślnie zakładka Dzisiaj', await page.getAttribute('[data-dpv-tab="today"]', 'aria-selected') === 'true');
    ok('Moje jedzenie: 7 dni do wyboru', await page.locator('[data-dpv-day]').count() === 7);
    ok('Moje jedzenie: posiłki z porcjami domowymi', await page.locator('.dpv-meal').count() >= 3 && /ok\. /.test(await page.textContent('[data-pkc-food]')));
    ok('Moje jedzenie: dziś zaznaczone', /\(dziś\)/.test(await page.textContent('[data-dpv-dayname]')));
    ok('karta posiłku: makro w jednej linii', /\d+ kcal · B: \d+ g · T: \d+ g · W: \d+ g/.test(await page.textContent('.dpv-meal .dpv-macros')));
    await page.click('.dpv-meal >> nth=0 >> [data-dpv-prep]');
    const steps = await page.locator('.dpv-meal >> nth=0 >> .dpv-steps li').count();
    ok('Pokaż przygotowanie: 3–5 kroków', steps >= 3 && steps <= 5 && await page.isVisible('.dpv-meal >> nth=0 >> .dpv-prep'), String(steps));
    await page.click('.dpv-meal >> nth=0 >> .dpv-swaps summary');
    ok('zamienniki jako kafelki z kcal i makro', await page.locator('.dpv-meal >> nth=0 >> .dpv-swaps .dpv-tile').count() >= 2 && /kcal · B \d+/.test(await page.textContent('.dpv-meal >> nth=0 >> .dpv-swaps .dpv-tile >> nth=1')));
    await page.click('[data-dpv-day="6"]');
    ok('zmiana dnia', /Niedziela/.test(await page.textContent('[data-dpv-dayname]')));
    await page.click('[data-dpv-swapmeal="6-0"]');
    const alts = await page.locator('[data-dpv-alt] .dpv-tile-btn').count();
    if (alts) {
      await page.click('[data-dpv-alt] .dpv-tile-btn >> nth=0');
      ok('Zamień posiłek: posiłek z innego dnia, zapamiętany', /z dnia:/.test(await page.textContent('[data-dpv-meal="6-0"]')) && await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('pkc-choice:'))));
    } else ok('Zamień posiłek: informacja, gdy brak podobnego', /nie ma innego posiłku/.test(await page.textContent('[data-dpv-alt]')));
    await page.click('[data-dpv-tab="week"]');
    ok('Cały tydzień: 7 dni', await page.locator('[data-dpv-wday]').count() === 7);
    await page.click('[data-dpv-tab="swaps"]');
    ok('Zamienniki: grupy produktów', await page.locator('.dpv-swapgroup').count() >= 2);
    await page.click('[data-dpv-tab="tips"]');
    ok('Wskazówki: woda i nawyk', /Woda/.test(await page.textContent('[data-dpv-body]')) && /Najważniejszy nawyk/.test(await page.textContent('[data-dpv-body]')));
    await page.click('[data-dpv-tab="shop"]');
    ok('Lista zakupów w planie: grupy i odhaczanie', await page.locator('.dpv-shopgroup').count() >= 3 && await page.locator('[data-dpv-item]').count() > 5);
    ok('telefon: plan bez poziomego przewijania', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.evaluate(() => capGoScreen('food'));
    await page.waitForSelector('[data-pkc-food="week"]');
    await page.evaluate(() => capGoScreen('shopping'));
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
