#!/usr/bin/env node
'use strict';
/** UI (Etap 5 UX): menu nowego trenera — 6 pozycji, „Więcej” z resztą ekranów, logo w jednej linii, przewijany środek. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
async function open(browser, clients, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((list) => {
    try { localStorage.removeItem('pl_sidebar_collapsed'); } catch (e) {}
    window.persistById = async (_c, o) => o;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';
    const l = document.getElementById('app-loading'); if (l) l.style.display = 'none';
    window.CL.length = 0; list.forEach((c) => window.CL.push(c));
    goTo('dashboard');
  }, clients);
  await page.waitForTimeout(250);
  return page;
}
const visibleTop = (page) => page.evaluate(() => [...document.querySelectorAll('.sidebar-nav > .nav-item, .sidebar-nav > .nav-flyout-wrap > .nav-item')]
  .filter((b) => b.offsetParent !== null).map((b) => (b.querySelector('.nav-lbl') || b).textContent.trim()));

(async () => {
  const browser = await chromium.launch();
  let page = await open(browser, []);
  const items = await visibleTop(page);
  ok('new trainer: 6 items', items.length === 6, JSON.stringify(items));
  ok('new trainer: expected items', ['Klienci', 'Pulpit', 'Biblioteka', 'Trening LIVE', 'Kalendarz', 'Więcej'].every((x) => items.includes(x)), JSON.stringify(items));
  await page.click('#nav-library-btn');
  await page.waitForTimeout(150);
  ok('Biblioteka has "Nowy plan (AI)" first', (await page.locator('#nav-library-flyout .nav-flyout-item').first().textContent()).trim() === 'Nowy plan (AI)');
  await page.mouse.move(900, 600); await page.waitForTimeout(350);
  await page.evaluate(() => closeNavFlyouts());
  await page.click('#nav-more-btn');
  await page.waitForTimeout(150);
  ok('Więcej opens', await page.locator('#nav-more-flyout').isVisible());
  await page.click('#nav-more-flyout .nav-flyout-item[data-screen="payments"]');
  await page.waitForTimeout(150);
  ok('Więcej navigates and highlights', await page.locator('#screen-payments.active').count() === 1 && await page.locator('#nav-more-btn.active').count() === 1);
  const logo = await page.$eval('.pl-logo-text', (e) => { const r = document.createRange(); r.selectNodeContents(e.firstChild); const s = e.querySelector('span').getBoundingClientRect(); return Math.abs(r.getBoundingClientRect().top - s.top) < 4; });
  ok('logo "PROGRESS LIVE" in one line', logo);
  await page.close();

  page = await open(browser, [{ id: 'u1', name: 'Anna Nowak', email: 'a@x.pl', status: 'active', goal: 'redukcja' }], { width: 1280, height: 700 });
  const full = await visibleTop(page);
  ok('with client: full menu, no Więcej', full.length >= 11 && !full.includes('Więcej'), JSON.stringify(full));
  ok('with client: human names', full.includes('Przypomnienia') && full.includes('Treningi wideo') && !full.includes('Automatyzacja') && !full.includes('On-demand'), JSON.stringify(full));
  const lay = await page.evaluate(() => {
    const nav = document.querySelector('.sidebar-nav'), logo = document.querySelector('.sidebar-logo'), end = document.querySelector('.sidebar-end');
    const lr = logo.getBoundingClientRect(), er = end.getBoundingClientRect();
    return { scrolls: nav.scrollHeight > nav.clientHeight && getComputedStyle(nav).overflowY === 'auto', logoTop: lr.top >= 0, endBottom: er.bottom <= window.innerHeight + 1 };
  });
  ok('low screen: middle scrolls, logo and account stay visible', lay.scrolls && lay.logoTop && lay.endBottom, JSON.stringify(lay));
  await page.evaluate(() => { window.CL.length = 0; goTo('clients'); });
  await page.waitForTimeout(100);
  ok('back to 0 clients: compact again', (await visibleTop(page)).length === 6);
  await page.close();
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('All new-trainer nav tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
