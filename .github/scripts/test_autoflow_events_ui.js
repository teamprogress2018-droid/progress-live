// UI: Autoflow ma triggery pakiet wygasł / check-in.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.AF_EVENT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-af-events'));
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
  await page.waitForTimeout(600);

  const ui = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    if (typeof goTo === 'function') goTo('automation');
    if (typeof setAutoTab === 'function') setAutoTab('autoflow');
    const sel = document.getElementById('af-trigger');
    const opts = sel ? [...sel.options].map(o => o.value) : [];
    const map = typeof autoflowTriggerForEvent === 'function' ? {
      pkg: autoflowTriggerForEvent('package.expired'),
      ci: autoflowTriggerForEvent('checkin.submitted')
    } : {};
    return { opts, map, hasSel: !!sel };
  });
  await page.screenshot({ path: path.join(shotDir, 'autoflow_triggers.png') });
  ok('trigger options', ui.opts.indexOf('package.expired') >= 0 && ui.opts.indexOf('checkin.submitted') >= 0, JSON.stringify(ui.opts));
  ok('event map', ui.map.pkg === 'package.expired' && ui.map.ci === 'checkin.submitted', JSON.stringify(ui.map));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll autoflow-events UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
