// UI: generator bierze wiek/wagę/płeć/aktywność z karty i chowa duplikaty.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-apl-autofill'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function vis(el) {
  if (!el) return 'missing';
  const st = (el.style && el.style.display) || '';
  return st;
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
    if (app) app.style.display = 'flex';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{
      id: 'c-anna',
      name: 'Anna Kowalska',
      age: 32,
      gender: 'K',
      weight: 62,
      height: 168,
      activityLevel: 'moderate',
      sportNotes: 'półmaraton',
      priorSports: ['running'],
      goal: 'redukcja',
      level: 'sredni',
      trainingFreq: 3
    }, {
      id: 'c-other',
      name: 'Inny Klient',
      age: 40,
      gender: 'M',
      weight: 90
    }];
    window.cpClientId = 'c-anna';
  });

  await page.evaluate(() => { if (typeof goTo === 'function') goTo('aiplangen'); });
  await page.waitForTimeout(500);

  const auto = await page.evaluate(() => {
    const sports = document.getElementById('apl-client-dup-sports');
    const body = document.getElementById('apl-client-dup-body');
    const card = document.getElementById('apl-client-from-card');
    const hint = document.getElementById('apl-client-pick-hint');
    return {
      client: (document.getElementById('apl-client') || {}).value || '',
      lastId: window._aplLastClientId || '',
      age: (document.getElementById('apl-age') || {}).value || '',
      gender: (document.getElementById('apl-gender') || {}).value || '',
      weight: (document.getElementById('apl-weight') || {}).value || '',
      activity: (document.getElementById('apl-activity') || {}).value || '',
      sportsDisplay: sports ? sports.style.display : '',
      bodyDisplay: body ? body.style.display : '',
      hintDisplay: hint ? hint.style.display : '',
      cardDisplay: card ? card.style.display : '',
      cardText: (card && card.textContent) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'apl_client_autofill_from_profile.png'), fullPage: false });
  ok('auto-selects open client', auto.client === 'c-anna', JSON.stringify(auto));
  ok('remembers last client', auto.lastId === 'c-anna');
  ok('age/weight/gender from card', auto.age === '32' && auto.weight === '62' && auto.gender === 'kobieta', JSON.stringify(auto));
  ok('activity from card', auto.activity === 'moderate');
  ok('hides duplicate sports/activity', auto.sportsDisplay === 'none');
  ok('hides duplicate body fields', auto.bodyDisplay === 'none');
  ok('shows card summary', auto.cardDisplay === 'block' && /Z karty klienta/.test(auto.cardText) && /Anna Kowalska/.test(auto.cardText));
  ok('summary has age weight gender activity', /32 lat/.test(auto.cardText) && /62 kg/.test(auto.cardText) && /Kobieta/.test(auto.cardText) && /Umiarkowana/.test(auto.cardText));
  ok('pick hint hidden', auto.hintDisplay === 'none');

  const manual = await page.evaluate(() => {
    const sel = document.getElementById('apl-client');
    if (sel) sel.value = '';
    if (typeof aplFillFromClient === 'function') aplFillFromClient();
    const sports = document.getElementById('apl-client-dup-sports');
    const body = document.getElementById('apl-client-dup-body');
    const card = document.getElementById('apl-client-from-card');
    const hint = document.getElementById('apl-client-pick-hint');
    return {
      client: sel ? sel.value : '',
      sportsDisplay: sports ? sports.style.display : '',
      bodyDisplay: body ? body.style.display : '',
      cardDisplay: card ? card.style.display : '',
      hintDisplay: hint ? hint.style.display : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'apl_client_autofill_manual.png'), fullPage: false });
  ok('nowy shows sports form', manual.client === '' && manual.sportsDisplay !== 'none');
  ok('nowy shows body form', manual.bodyDisplay === 'grid' || manual.bodyDisplay === '');
  ok('nowy hides card', manual.cardDisplay === 'none');
  ok('nowy shows pick hint', manual.hintDisplay !== 'none');

  const back = await page.evaluate(() => {
    const sel = document.getElementById('apl-client');
    if (sel) sel.value = 'c-anna';
    if (typeof aplFillFromClient === 'function') aplFillFromClient();
    return {
      age: (document.getElementById('apl-age') || {}).value || '',
      hidden: (document.getElementById('apl-client-dup-body') || {}).style.display === 'none'
    };
  });
  ok('reselect still fills hidden inputs', back.age === '32' && back.hidden);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll apl-client-autofill UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
