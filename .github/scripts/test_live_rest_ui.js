// UI: timer przerwy live — 30s i własny czas (35s).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_REST_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-rest'));
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
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-rest-timer');

  const presets = await page.evaluate(() =>
    [...document.querySelectorAll('.live-rest-preset')].map((b) => b.textContent.trim())
  );
  ok('has 30s preset', presets.includes('30s'), JSON.stringify(presets));
  ok('keeps 60s', presets.includes('60s'));
  ok('custom field present', await page.locator('#live-rest-custom').count() === 1);

  await page.click('.live-rest-preset:text("30s")');
  await page.waitForTimeout(80);
  const after30 = await page.locator('#live-rest-timer').textContent();
  ok('30s starts countdown', /30s|29s/.test(after30 || ''), after30);

  await page.fill('#live-rest-custom', '35');
  await page.click('.live-rest-custom-go');
  await page.waitForTimeout(80);
  const after35 = await page.locator('#live-rest-timer').textContent();
  ok('35s custom starts countdown', /35s|34s/.test(after35 || ''), after35);

  await page.screenshot({ path: path.join(shotDir, 'live_rest_custom_35.png') });

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-rest UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
