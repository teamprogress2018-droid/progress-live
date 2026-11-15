#!/usr/bin/env node
'use strict';
/** UI (Etap 11 UX): kolumny kafelków na stronie startowej — bez pułapki dla klawiatury.
 *  Telefon: kolumna przewijana jest regionem z nazwą i przystankiem Tab. Komputer: bez przystanku.
 *  Animacja: jedna pętla, a przy „ogranicz ruch” stoi (oba tory). */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function open(browser, width, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width, height: width < 500 ? 844 : 800 } }, opts || {}));
  const page = await ctx.newPage();
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=land-tiles', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#auth-screen .pl-land-track .pl-land-stat');
  await page.waitForTimeout(300);
  return { ctx, page };
}
const cols = (page) => page.$$eval('#auth-screen .pl-land-col', (els) => els.map((c) => {
  const s = getComputedStyle(c); const t = getComputedStyle(c.querySelector('.pl-land-track'));
  return { role: c.getAttribute('role'), label: c.getAttribute('aria-label') || '', tab: c.getAttribute('tabindex'),
    scrolls: c.scrollWidth > c.clientWidth + 1 && /(auto|scroll)/.test(s.overflowX), anim: t.animationName, iter: t.animationIterationCount };
}));

(async () => {
  const browser = await chromium.launch();
  try {
    let { ctx, page } = await open(browser, 390);
    let c = await cols(page);
    ok('phone: two tile columns', c.length === 2, JSON.stringify(c));
    ok('phone: scrollable columns are named regions reachable by Tab', c.every((x) => x.scrolls && x.role === 'region' && /Przykładowe postępy klienta/.test(x.label) && x.tab === '0'), JSON.stringify(c));
    ok('phone: region names are unique', new Set(c.map((x) => x.label)).size === c.length, JSON.stringify(c.map((x) => x.label)));
    ok('phone: tiles do not move', c.every((x) => x.anim === 'none'), JSON.stringify(c));
    const focused = await page.evaluate(() => { const col = document.querySelector('#auth-screen .pl-land-col'); col.focus(); return document.activeElement === col; });
    ok('phone: column takes keyboard focus', focused);
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    ok('phone: arrow keys scroll the column', await page.$eval('#auth-screen .pl-land-col', (e) => e.scrollLeft > 0));
    const outline = await page.$eval('#auth-screen .pl-land-col', (e) => getComputedStyle(e).outlineStyle);
    ok('phone: focus is visible', outline !== 'none', outline);
    await ctx.close();

    ({ ctx, page } = await open(browser, 1280));
    c = await cols(page);
    ok('desktop: no Tab stop on columns that do not scroll', c.every((x) => !x.scrolls && x.tab === null), JSON.stringify(c));
    ok('desktop: both tracks animate exactly one loop', c.every((x) => x.anim !== 'none' && x.iter === '1'), JSON.stringify(c));
    await ctx.close();

    ({ ctx, page } = await open(browser, 1280, { reducedMotion: 'reduce' }));
    c = await cols(page);
    ok('reduced motion: both tracks stand still', c.every((x) => x.anim === 'none'), JSON.stringify(c));
    await ctx.close();
  } catch (e) {
    console.error('FAIL exception — ' + (e && e.stack || e));
    failed++;
  } finally {
    await browser.close();
  }
  if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
  console.log('\nAll landing tiles tests passed');
})();
