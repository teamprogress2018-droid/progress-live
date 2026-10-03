// UI: Płatności — chipy i historia filtrują po clientId, nie po imieniu.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.PAY_HIST_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-pay-hist'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const host = process.env.LAYOUT_HOST || '127.0.0.1';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const a1 = { id: 'c-a1', name: 'Anna Nowak', status: 'active' };
    const a2 = { id: 'c-a2', name: 'Anna Nowak', status: 'active' };
    if (Array.isArray(window.CL)) window.CL.splice(0, window.CL.length, a1, a2);
    else window.CL = [a1, a2];
    const pkgs = [
      { id: 'pk-a1', clientId: 'c-a1', clientName: 'Anna Nowak', title: 'Pakiet A', price: 100, payStatus: 'paid', sessions: 8, sessionsUsed: 1, type: 'personal' },
      { id: 'pk-a2', clientId: 'c-a2', clientName: 'Anna Nowak', title: 'Pakiet B', price: 200, payStatus: 'paid', sessions: 8, sessionsUsed: 0, type: 'personal' }
    ];
    if (Array.isArray(window.PACKAGES)) window.PACKAGES.splice(0, window.PACKAGES.length, ...pkgs);
    else window.PACKAGES = pkgs;
    if (typeof goTo === 'function') goTo('payments');
    if (typeof setPayTab === 'function') setPayTab('packages');
  });

  await page.waitForSelector('#ptab-packages-view');
  const chips = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#pkg-client-filter-bar [data-client-id]')].map((b) => b.getAttribute('data-client-id'));
    const vis = [...document.querySelectorAll('#pay-pkg-grid .pkg-card')]
      .filter((c) => c.style.display !== 'none')
      .map((c) => c.getAttribute('data-pkg-id'));
    return { ids, vis };
  });
  await page.screenshot({ path: path.join(shotDir, 'pay_pkg_all.png') });
  ok('two chips same name', chips.ids.includes('c-a1') && chips.ids.includes('c-a2') && chips.ids.filter((id) => id === 'c-a1' || id === 'c-a2').length === 2, JSON.stringify(chips.ids));
  ok('packages show both', chips.vis.includes('pk-a1') && chips.vis.includes('pk-a2'), JSON.stringify(chips.vis));

  await page.click('#pkg-client-filter-bar [data-client-id="c-a1"]');
  await page.waitForTimeout(150);
  const filtered = await page.evaluate(() => [...document.querySelectorAll('#pay-pkg-grid .pkg-card')]
    .filter((c) => c.style.display !== 'none')
    .map((c) => c.getAttribute('data-pkg-id')));
  await page.screenshot({ path: path.join(shotDir, 'pay_pkg_filtered.png') });
  ok('chip keeps own package', filtered.includes('pk-a1'), JSON.stringify(filtered));
  ok('chip hides same-name other client', !filtered.includes('pk-a2'), JSON.stringify(filtered));

  await page.evaluate(() => { if (typeof setPayTab === 'function') setPayTab('history'); });
  await page.waitForSelector('#hist-client-fil');
  const histOpts = await page.evaluate(() => [...document.querySelector('#hist-client-fil').options].map((o) => ({ v: o.value, t: (o.textContent || '').trim() })));
  ok('history two id options', histOpts.filter((o) => o.v === 'c-a1' || o.v === 'c-a2').length === 2, JSON.stringify(histOpts));
  ok('history options same label', histOpts.filter((o) => o.t === 'Anna Nowak').length === 2, JSON.stringify(histOpts));

  await page.selectOption('#hist-client-fil', 'c-a1');
  await page.waitForTimeout(150);
  const hist = await page.evaluate(() => [...document.querySelectorAll('#pay-history-list .pay-hist-row')].map((r) => r.getAttribute('data-pkg-id')));
  await page.screenshot({ path: path.join(shotDir, 'pay_hist_filtered.png') });
  ok('history lists own', hist.includes('pk-a1'), JSON.stringify(hist));
  ok('history skips same-name other', !hist.includes('pk-a2'), JSON.stringify(hist));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll pay-hist clientId UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
