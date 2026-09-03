// UI: picking Liny treningowe switches the KG field to sec.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LOAD_UNIT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-load-unit'));
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
    window.CL = [{ id: 'c1', name: 'Justyna' }];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-row [data-f="name"]');

  const kgBefore = await page.locator('.ex-row [data-f="kg"]').first().getAttribute('placeholder');
  ok('empty row kg placeholder', kgBefore === 'kg', kgBefore);

  const input = page.locator('.ex-row [data-f="name"]').first();
  await input.fill('liny');
  await page.waitForTimeout(250);
  await page.locator('.ex-row .ex-ac-item').filter({ hasText: 'Liny treningowe' }).first().click();
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    const kg = row && row.querySelector('[data-f="kg"]');
    const name = row && row.querySelector('[data-f="name"]');
    const pct = row && row.querySelector('[data-f="pct1rm"]');
    return {
      name: name ? name.value : '',
      ph: kg ? kg.placeholder : '',
      title: kg ? kg.title : '',
      unit: kg ? kg.dataset.loadUnit : '',
      rowUnit: row ? row.dataset.loadUnit : '',
      pctDisabled: pct ? !!pct.disabled : false,
      helper: typeof exLoadUnit === 'function' ? exLoadUnit('Liny treningowe') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_liny_sec.png') });
  ok('pick fills Liny treningowe', after.name === 'Liny treningowe', JSON.stringify(after));
  ok('placeholder sec', after.ph === 'sec', JSON.stringify(after));
  ok('title czas', /czas|sec|\(s\)/i.test(after.title), after.title);
  ok('data-load-unit sec', after.unit === 'sec' && after.rowUnit === 'sec', JSON.stringify(after));
  ok('%1RM disabled for timed', after.pctDisabled, JSON.stringify(after));
  ok('exLoadUnit helper', after.helper === 'sec', after.helper);

  await input.fill('');
  await input.fill('Przysiad Goblet');
  await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    if (typeof builderOnExNameChange === 'function') builderOnExNameChange(row);
  });
  await page.waitForTimeout(150);
  const squat = await page.evaluate(() => {
    const kg = document.querySelector('.ex-row [data-f="kg"]');
    const pct = document.querySelector('.ex-row [data-f="pct1rm"]');
    return { ph: kg ? kg.placeholder : '', unit: kg ? kg.dataset.loadUnit : '', pctDisabled: pct ? !!pct.disabled : true };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_goblet_kg.png') });
  ok('goblet back to kg', squat.ph === 'kg' && squat.unit === 'kg', JSON.stringify(squat));
  ok('%1RM enabled for kg', squat.pctDisabled === false, JSON.stringify(squat));

  await input.fill('');
  await input.fill('wioślarz');
  await page.waitForTimeout(250);
  await page.locator('.ex-row .ex-ac-item .ex-ac-name').filter({ hasText: /^Wioślarz$/ }).click();
  await page.waitForTimeout(200);
  const rower = await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    const kg = row && row.querySelector('[data-f="kg"]');
    const name = row && row.querySelector('[data-f="name"]');
    const pct = row && row.querySelector('[data-f="pct1rm"]');
    return {
      name: name ? name.value : '',
      ph: kg ? kg.placeholder : '',
      title: kg ? kg.title : '',
      unit: kg ? kg.dataset.loadUnit : '',
      pctDisabled: pct ? !!pct.disabled : false,
      helper: typeof exLoadUnit === 'function' ? exLoadUnit('Wioślarz') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_wioslarz_min.png') });
  ok('pick fills Wioślarz', rower.name === 'Wioślarz', JSON.stringify(rower));
  ok('placeholder min', rower.ph === 'min', JSON.stringify(rower));
  ok('title czas min', /czas|min/i.test(rower.title), rower.title);
  ok('data-load-unit min', rower.unit === 'min', JSON.stringify(rower));
  ok('%1RM disabled for min', rower.pctDisabled, JSON.stringify(rower));
  ok('exLoadUnit wioslarz', rower.helper === 'min', rower.helper);

  await input.fill('');
  await input.fill('airbike');
  await page.waitForTimeout(250);
  await page.locator('.ex-row .ex-ac-item .ex-ac-name').filter({ hasText: /^Airbike$/ }).click();
  await page.waitForTimeout(200);
  const air = await page.evaluate(() => {
    const kg = document.querySelector('.ex-row [data-f="kg"]');
    return { ph: kg ? kg.placeholder : '', unit: kg ? kg.dataset.loadUnit : '' };
  });
  ok('airbike placeholder min', air.ph === 'min' && air.unit === 'min', JSON.stringify(air));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('live');
    window.liveClientId = 'c1';
    window.liveExercises = [{
      name: 'Wioślarz',
      loadUnit: 'kg',
      sets: [{ setNo: 1, kg: '', reps: '', done: false, kind: 'work' }],
      done: false,
      collapsed: false
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });
  await page.waitForSelector('#live-ex-0');
  const liveCard = await page.evaluate(() => {
    const head = document.querySelector('#live-ex-0 .live-set-head');
    const input = document.querySelector('#live-ex-0 .live-kg-input');
    return {
      head: head ? head.innerText : '',
      ph: input ? input.getAttribute('placeholder') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_wioslarz_czas.png') });
  ok('live header czas min', /czas/i.test(liveCard.head) && /min/i.test(liveCard.head), liveCard.head);
  ok('live placeholder min', liveCard.ph === 'min', JSON.stringify(liveCard));
  ok('live not ciezar kg', !/ciężar/i.test(liveCard.head), liveCard.head);

  await browser.close();
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
