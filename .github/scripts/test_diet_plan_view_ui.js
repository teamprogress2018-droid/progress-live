#!/usr/bin/env node
'use strict';
/** UI: widok planu żywieniowego — telefon i komputer bez poziomego przewijania, treść max ok. 960 px,
 *  wydruk A4: nic nie wychodzi poza lewą ani prawą krawędź, stopka, Ctrl+P drukuje tylko plan (bez menu aplikacji). */
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=dpv';

async function open(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const c = { id: 'c1', name: 'Anna Kowalczyk', goal: 'redukcja', weight: 74, height: 168, age: 38, gender: 'K', trainingFreq: 3 };
    const nt = PlanClient.nutritionTargets(c);
    const w = DietPlan.dietBuildWeek({ targets: nt.targets, meals: 5, days: 7, trainDays: [1, 3, 5], prep: 2, people: 1 });
    window.__vm = DietView.fromBuilt(nt.targets, w, { client: c.name, goalKey: 'redukcja', delta: nt.delta, kcal: nt.kcal, water: nt.water, meals: 5 });
    const host = document.createElement('div'); host.id = 'dpv-test'; host.style.padding = '16px';
    document.body.prepend(host);
    DietView.mount(host, window.__vm, { mode: 'trainer', onSend: () => {} });
  });
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    let { ctx, page, errors } = await open(browser, { width: 390, height: 844 });
    ok('telefon: 5 kart posiłków na dziś', await page.locator('#dpv-test .dpv-meal').count() === 5);
    ok('telefon: bez poziomego przewijania planu', await page.evaluate(() => { const r = document.getElementById('dpv-test').getBoundingClientRect(); return [...document.querySelectorAll('#dpv-test *')].every(el => { const b = el.getBoundingClientRect(); return !b.width || (b.left >= r.left - 1 && b.right <= r.right + 1); }); }));
    ok('telefon: zdjęcie małe, tekst obok', await page.evaluate(() => { const img = document.querySelector('#dpv-test .dpv-img'); return !img || img.getBoundingClientRect().width <= 80; }));
    const t44 = await page.evaluate(() => [...document.querySelectorAll('#dpv-test .dpv-btn, #dpv-test .dpv-tab, #dpv-test .dpv-day, #dpv-test .dpv-link, #dpv-test .dpv-swaps summary')].filter(b => b.getClientRects().length).every(b => b.getBoundingClientRect().height >= 43.5) || [...document.querySelectorAll('#dpv-test .dpv-btn, #dpv-test .dpv-tab, #dpv-test .dpv-day, #dpv-test .dpv-link, #dpv-test .dpv-swaps summary')].filter(b => b.getClientRects().length && b.getBoundingClientRect().height < 43.5).map(b => b.className + ':' + b.getBoundingClientRect().height).join(','));
    ok('telefon: przyciski min. 44 px', t44 === true, String(t44));
    ok('bez błędów JS (telefon)', !errors.length, errors.join(' | '));
    await ctx.close();

    ({ ctx, page, errors } = await open(browser, { width: 1440, height: 900 }));
    ok('komputer: treść max ok. 960 px', await page.evaluate(() => document.querySelector('#dpv-test .dpv').getBoundingClientRect().width <= 961));
    // Ctrl+P: przed drukiem plan trafia do osobnego kontenera, reszta aplikacji jest ukryta.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => {
      const host = document.getElementById('dpv-print-host'); const side = document.querySelector('.sidebar');
      const W = document.documentElement.clientWidth;
      const out = [...host.querySelectorAll('.dpvp *')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > W + 1); }).length;
      return { host: !!host && getComputedStyle(host).display !== 'none', side: !side || getComputedStyle(side).display === 'none', out, left: host.querySelector('.dpvp').getBoundingClientRect().left };
    });
    ok('Ctrl+P: drukuje się tylko plan, bez menu', pr.host && pr.side, JSON.stringify(pr));
    ok('Ctrl+P: nic nie wychodzi poza lewą ani prawą krawędź', pr.out === 0 && pr.left <= 1, JSON.stringify(pr));
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    ok('po druku aplikacja wraca', await page.evaluate(() => !document.getElementById('dpv-print-host') && !document.body.classList.contains('dpv-printing')));
    // Podgląd wydruku i PDF A4
    await page.evaluate(() => document.querySelector('#dpv-test [data-dpv-tact="preview"]').click());
    await page.waitForSelector('#dpv-preview iframe');
    await page.waitForTimeout(500);
    const html = await page.evaluate(() => document.querySelector('#dpv-preview iframe').srcdoc);
    const pv = await page.evaluate(() => { const d = document.querySelector('#dpv-preview iframe').contentDocument; return { pages: +d.querySelector('.dpvp').getAttribute('data-paged'), sheets: d.querySelectorAll('.sheet').length }; });
    ok('podgląd: kartki A4', pv.pages >= 7 && pv.sheets === pv.pages, JSON.stringify(pv));
    const p2 = await ctx.newPage();
    await p2.setContent(html.replace('<base href="', '<base data-x="'), { waitUntil: 'load' });
    await p2.emulateMedia({ media: 'print' });
    const cut = await p2.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('.dpvp *')].filter(el => { const b = el.getBoundingClientRect(); return b.width && (b.left < -1 || b.right > W + 1); }).length; });
    ok('wydruk z podglądu: nic nie ucięte po bokach', cut === 0, String(cut));
    const pdf = await p2.pdf({ preferCSSPageSize: true });
    const pagesPdf = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok('PDF: tyle stron, ile kartek w podglądzie', pagesPdf === pv.pages, pagesPdf + ' vs ' + pv.pages);
    ok('PDF: format A4', /\/MediaBox\s*\[\s*0 0 59[45]\.\d+ 841\.\d+/.test(pdf.toString('latin1')));
    await page.evaluate(() => document.querySelector('[data-dpv-pclose]').click());
    ok('bez błędów JS (komputer)', !errors.length, errors.join(' | '));
    await ctx.close();
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' diet plan view UI test(s) failed'); process.exit(1); }
  console.log('All diet plan view UI tests passed.');
})();
