// UI: szablony Nordic walking, piłka nożna i bieganie z listą ćwiczeń.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SPORT_TPL_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-sport-tpl'));
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
    window.CL = [{ id: 'c-anna', name: 'Anna Nowak' }];
    window.SE = [];
    window.PL = [];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('templates');
  });
  await page.waitForSelector('#tpl-grid .tpl-card');

  await page.click('#tplf-kondycja');
  await page.waitForTimeout(200);

  const cards = await page.evaluate(() => {
    return [...document.querySelectorAll('#tpl-grid .tpl-card')].map((el) => (el.innerText || '').split('\n')[0].trim());
  });
  await page.screenshot({ path: path.join(shotDir, 'tpl_kondycja.png') });
  ok('nordic card', cards.some((n) => /Nordic walking/i.test(n)), cards.join(' | '));
  ok('football card', cards.some((n) => /Piłka nożna/i.test(n)), cards.join(' | '));
  ok('running card', cards.some((n) => /Bieganie/i.test(n)), cards.join(' | '));

  async function openAndRead(id) {
    await page.evaluate((tid) => {
      if (typeof openTplDetail === 'function') openTplDetail(tid);
    }, id);
    await page.waitForTimeout(250);
    return page.evaluate(() => (document.getElementById('tpl-detail') || {}).innerText || '');
  }

  const nw = await openAndRead('t25');
  await page.screenshot({ path: path.join(shotDir, 'tpl_nordic.png') });
  ok('nordic detail title', /Nordic walking/.test(nw));
  ok('nordic has Marsz', /Marsz/.test(nw));
  ok('nordic has RDL', /Martwy ciąg RDL/.test(nw));
  ok('nordic three days', /Nordic walking — łatwy/.test(nw) && /siła pod kije/.test(nw) && /dłuższy/.test(nw));

  const fn = await openAndRead('t26');
  await page.screenshot({ path: path.join(shotDir, 'tpl_football.png') });
  ok('football detail title', /Piłka nożna/.test(fn));
  ok('football copenhagen', /Deska kopenhaska/.test(fn));
  ok('football adductor kick', /Przywodzenie piłkarskie z taśmą/.test(fn));
  ok('football nordic curl', /Uginanie nordyckie/.test(fn));

  const run = await openAndRead('t27');
  await page.screenshot({ path: path.join(shotDir, 'tpl_running.png') });
  ok('running detail title', /Bieganie/.test(run));
  ok('running A-skip', /A-skip/.test(run));
  ok('running Bieg', /Bieg/.test(run));
  ok('running strength day', /Siła biegacza/.test(run) && /Uginanie nordyckie/.test(run));

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll sport template UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
