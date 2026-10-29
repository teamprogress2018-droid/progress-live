// Własne grafiki z książek (knowledge/visuals/svg): podgląd planu z generatora i zakładka Akademii „Grafiki z książek”.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.BOOK_VISUALS_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-book-visuals');
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name);
}

/* Logika doboru bez przeglądarki. */
const kb = require(path.join(root, 'books-kb.js'));
ok('4 grafiki w BOOK_VISUALS', kb.BOOK_VISUALS.length === 4);
kb.BOOK_VISUALS.forEach((v) => ok('plik istnieje: ' + v.id, fs.existsSync(path.join(root, kb.bookVisualSrc(v)))));
ok('ograniczenia klienta → FMS pierwsze', kb.bookVisualsForPlan('masa', { limits: true })[0].id === 'fms-swiatla');
ok('siła bez ograniczeń → fazy siły pierwsze', kb.bookVisualsForPlan('sila', {})[0].id === 'bompa-fazy-sily');
ok('zawody w opisie → rozładowanie pasuje', kb.bookVisualsForPlan('kondycja', { text: 'start w zawodach 12.05' }).find((v) => v.id === 'bompa-rozladowanie').match === true);
ok('zawsze wszystkie 4', kb.bookVisualsForPlan('rehab', {}).length === 4);
ok('HTML ma podpis „Opracowanie własne”', /Opracowanie własne na podstawie/.test(kb.bookVisualsHTML()));

async function openApp(browser, viewport) {
  const port = process.env.BOOK_VISUALS_PORT || '8080';
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window._uid = 'ui-trainer';
    window._clientAppMode = false;
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._db = { fixture: true };
    window.persistById = async (c, o) => ({ ...o, _fbId: o.id });
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c-anna', trainerId: 'ui-trainer', name: 'Anna Nowak' }];
    window.KB = [];
  });
  return { page, errors };
}

async function imagesLoaded(page, sel) {
  await page.waitForFunction((s) => Array.from(document.querySelectorAll(s + ' img')).every((i) => i.complete && i.naturalWidth > 0), sel);
  return page.$$eval(sel + ' img', (els) => els.length);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

  /* 1. Akademia → Grafiki z książek. */
  const { page, errors } = await openApp(browser, { width: 1440, height: 1000 });
  await page.evaluate(() => goTo('academy'));
  await page.click('.academy-tab:has-text("Grafiki z książek")');
  await page.waitForSelector('.academy-visuals .book-visual');
  ok('Akademia: 4 grafiki wczytane', (await imagesLoaded(page, '.academy-visuals')) === 4);
  await page.screenshot({ path: path.join(shotDir, 'akademia-grafiki.png'), fullPage: true });

  /* 2. Podgląd planu z generatora. */
  await page.evaluate(() => {
    goTo('aiplangen');
    const inj = document.getElementById('apl-injuries');
    if (inj) inj.value = 'Słaby wynik ASLR po lewej';
    const plan = {
      planName: 'Siła — blok 8 tyg.', daysPerWeek: 3, weeks: 8, method: 'Upper/Lower', weekKeys: ['w1'], phases: { w1: 'Tydzień 1' },
      rationale: { clientData: ['Staż 2 lata'], reasoning: ['Blok siły maksymalnej po adaptacji'], uncertainties: [], reviewTriggers: [], sources: [] },
      days: [{ name: 'Dzień A', exercises: [{ name: 'Przysiad', sets: '4', reps: '5', rest: '180s', rir: '2', weeks: { w1: { sets: '4', reps: '5', weight: '' } } }] }]
    };
    aplRenderPlan(plan, window.CL[0], 'sila', 'Upper/Lower', 3, 8);
    const d = document.querySelector('[data-apl-visuals]');
    if (d) d.open = true;
  });
  await page.waitForSelector('[data-apl-visuals] .book-visual');
  ok('Podgląd planu: 4 grafiki wczytane', (await imagesLoaded(page, '[data-apl-visuals]')) === 4);
  const first = await page.$eval('[data-apl-visuals] .book-visual', (el) => el.getAttribute('data-book-visual'));
  ok('Podgląd planu: przy ograniczeniach FMS pierwsze', first === 'fms-swiatla', first);
  const visuals = await page.$('[data-apl-visuals]');
  await visuals.scrollIntoViewIfNeeded();
  await visuals.screenshot({ path: path.join(shotDir, 'podglad-planu-grafiki.png') });

  /* 3. Telefon: jedna kolumna, bez poziomego przewijania. */
  const mobile = await openApp(browser, { width: 390, height: 844 });
  await mobile.page.evaluate(() => { goTo('academy'); academySetLevel('visuals'); });
  await mobile.page.waitForSelector('.academy-visuals .book-visual');
  await imagesLoaded(mobile.page, '.academy-visuals');
  const cols = await mobile.page.$eval('.academy-visuals .book-visuals', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  ok('Telefon: jedna kolumna', cols === 1, String(cols));
  const overflow = await mobile.page.$eval('.academy-visuals', (el) => el.scrollWidth - el.clientWidth);
  ok('Telefon: bez poziomego przewijania', overflow <= 1, String(overflow));
  await mobile.page.screenshot({ path: path.join(shotDir, 'akademia-grafiki-telefon.png'), fullPage: false });

  const errs = errors.concat(mobile.errors).filter((e) => !/firebase|gstatic/i.test(e));
  ok('bez błędów JS', errs.length === 0, errs.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' błędów'); process.exit(1); }
  console.log('Wszystko OK. Zrzuty: ' + shotDir);
})().catch((e) => { console.error(e); process.exit(1); });
