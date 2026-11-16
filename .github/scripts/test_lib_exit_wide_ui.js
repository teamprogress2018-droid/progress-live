// Biblioteka w trybie pełnego ekranu: widoczny przycisk „☰ Menu” i Escape przywracają menu aplikacji.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const vis = sel => page.evaluate(s => { const e = document.querySelector(s); return !!e && e.offsetHeight > 0; }, sel);
  await page.evaluate(() => {
    ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    window._uid = 't1'; window.CL = [];
    localStorage.setItem('pl_library_wide_v1', '1'); goTo('library');
  });
  ok('pełny ekran: menu schowane, przycisk „Menu” widoczny', !(await vis('#app-sidebar')) && await vis('#lib-exit-wide'));
  await page.click('#lib-exit-wide');
  ok('„Menu” przywraca menu aplikacji i zapamiętuje', await vis('#app-sidebar') && !(await vis('#lib-exit-wide')) && await page.evaluate(() => localStorage.getItem('pl_library_wide_v1') === '0'));
  await page.evaluate(() => setLibraryWide(true));
  await page.mouse.click(700, 500);
  await page.keyboard.press('Escape');
  ok('Escape też wraca do menu', await vis('#app-sidebar'));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll library exit-wide checks passed');
})().catch(e => { console.error(e); process.exit(1); });
