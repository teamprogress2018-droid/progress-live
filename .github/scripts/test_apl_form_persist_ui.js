// UI: generator zapamiętuje płeć Mężczyzna oraz Hantle / Drążek.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-apl'));
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
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{
      id: 'c-man',
      name: 'Piotr Test',
      age: 43,
      gender: 'M',
      weight: 100,
      height: 185,
      goal: 'masa',
      level: 'sredni',
      availableEquipment: ['Sztanga i wolne ciężary', 'Maszyny siłowe', 'Wyciągi i linki', 'Hantle', 'Drążek i poręcze']
    }];
  });

  await page.evaluate(() => { if (typeof goTo === 'function') goTo('aiplangen'); });
  await page.waitForTimeout(400);

  const filled = await page.evaluate(() => {
    const sel = document.getElementById('apl-client');
    if (sel) sel.value = 'c-man';
    if (typeof aplFillFromClient === 'function') aplFillFromClient();
    const chips = [...document.querySelectorAll('#apl-equipment .apl-opt-multi')].map((b) => ({
      val: b.dataset.val,
      on: b.classList.contains('active')
    }));
    return {
      gender: (document.getElementById('apl-gender') || {}).value || '',
      age: (document.getElementById('apl-age') || {}).value || '',
      hantle: chips.find((c) => c.val === 'Hantle'),
      drazek: chips.find((c) => c.val === 'Drążek i poręcze'),
      sztanga: chips.find((c) => c.val === 'Sztanga i wolne ciężary')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'apl_form_persist.png') });
  ok('gender mężczyzna from M', filled.gender === 'mężczyzna', JSON.stringify(filled));
  ok('age filled', filled.age === '43');
  ok('hantle active', !!(filled.hantle && filled.hantle.on));
  ok('drążek active', !!(filled.drazek && filled.drazek.on));
  ok('sztanga still on', !!(filled.sztanga && filled.sztanga.on));

  await page.evaluate(() => { if (typeof goTo === 'function') goTo('dash'); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { if (typeof goTo === 'function') goTo('aiplangen'); });
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#apl-equipment .apl-opt-multi')].map((b) => ({
      val: b.dataset.val,
      on: b.classList.contains('active')
    }));
    return {
      client: (document.getElementById('apl-client') || {}).value || '',
      gender: (document.getElementById('apl-gender') || {}).value || '',
      hantle: !!(chips.find((c) => c.val === 'Hantle') || {}).on,
      drazek: !!(chips.find((c) => c.val === 'Drążek i poręcze') || {}).on
    };
  });
  ok('keeps client after nav', back.client === 'c-man', JSON.stringify(back));
  ok('keeps mężczyzna after nav', back.gender === 'mężczyzna');
  ok('keeps hantle after nav', back.hantle);
  ok('keeps drążek after nav', back.drazek);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll apl-form-persist UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
