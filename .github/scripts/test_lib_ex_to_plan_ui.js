// UI: „+ Dodaj do planu” z biblioteki ćwiczeń wstawia ćwiczenie do kreatora,
// dokłada do rozpoczętego planu, a „Anuluj” wraca do Biblioteki.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  const dialogs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Anna Kowalska' }];
  });

  const names = () => page.evaluate(() => [...document.querySelectorAll('#builder-days .ex-row [data-f="name"]')].map((i) => i.value));

  // 1. Nowy plan z ćwiczeniem z biblioteki.
  await page.evaluate(() => { goTo('library'); openExDetail('Przysiad Goblet'); });
  const cta = page.locator('#exd-panel-preview .exd-preview-cta');
  ok('cta label', /Dodaj do planu/.test(await cta.textContent()));
  await cta.click();
  await page.waitForTimeout(300);
  let active = await page.evaluate(() => (document.querySelector('.screen.active') || {}).id);
  ok('opens builder', active === 'screen-builder', active);
  let n = await names();
  ok('exercise inserted into first day', n.length === 1 && n[0] === 'Przysiad Goblet', JSON.stringify(n));

  // 2. Kolejne ćwiczenie trafia do tego samego planu.
  await page.evaluate(() => { window._builderNavigationConfirmed = true; goTo('library'); openExDetail('Wiosłowanie hantlą jednorącz'); });
  const second = await page.evaluate(() => document.getElementById('exd-title').textContent);
  await cta.click();
  await page.waitForTimeout(300);
  n = await names();
  ok('asked to keep open plan', dialogs.some((m) => /otwarty w kreatorze/.test(m)), dialogs.join(' | '));
  ok('second exercise added to same plan', n.length === 2 && n[0] === 'Przysiad Goblet' && n[1] === second, JSON.stringify(n));

  // 3. Anuluj wraca do Biblioteki.
  await page.click('#screen-builder .topbar-actions button:has-text("Anuluj")');
  await page.waitForTimeout(300);
  active = await page.evaluate(() => (document.querySelector('.screen.active') || {}).id);
  ok('cancel returns to library', active === 'screen-library', active);

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All lib → plan UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
