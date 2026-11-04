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
kb.BOOK_VISUALS.filter((v) => !v.html).forEach((v) => ok('plik istnieje: ' + v.id, fs.existsSync(path.join(root, kb.bookVisualSrc(v)))));
/* Strefy intensywności: rysowane w HTML, każda strefa ma źródła, bez RPE tam, gdzie książki go nie podają. */
const iz = kb.intensityZonesHTML();
ok('strefy: 4 cele', kb.INTENSITY_ZONES.map((z) => z.goal).join('|') === 'Siła maksymalna|Siła|Hipertrofia|Wytrzymałość siłowa');
ok('strefy: każda ma źródło ze stronami', kb.INTENSITY_ZONES.every((z) => /s\. \d/.test(z.src)));
ok('strefy: wytrzymałość bez RPE', kb.INTENSITY_ZONES.find((z) => z.id === 'end').rpe === null && /książki nie podają RPE/.test(iz));
ok('strefy: skala RPE↔RIR', /RPE a powtórzenia w zapasie/.test(iz) && kb.RPE_RIR.length === 5);
ok('strefy: w HTML, bez <img>', /data-book-visual="strefy-intensywnosci"><div class="book-visual-html">/.test(kb.bookVisualsHTML()));
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
  ok('Akademia: 3 grafiki SVG wczytane', (await imagesLoaded(page, '.academy-visuals')) === 3);
  ok('Akademia: strefy intensywności narysowane', (await page.$$eval('.academy-visuals .iz-zone', (els) => els.length)) === 4);
  await page.locator('.academy-visuals [data-book-visual="strefy-intensywnosci"]').screenshot({ path: path.join(shotDir, 'strefy-komputer.png') });
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
  ok('Podgląd planu: 3 grafiki SVG + strefy', (await imagesLoaded(page, '[data-apl-visuals]')) === 3 && (await page.$$('[data-apl-visuals] .iz-zone')).length === 4);
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
  const izCols = await mobile.page.$eval('.academy-visuals .iz-zones', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  ok('Telefon: strefy jedna pod drugą', izCols === 1, String(izCols));
  const pctSize = await mobile.page.$eval('.iz-pct b', (el) => parseFloat(getComputedStyle(el).fontSize));
  ok('Telefon: duże cyfry % 1RM', pctSize >= 36, String(pctSize));
  await mobile.page.locator('.academy-visuals [data-book-visual="strefy-intensywnosci"]').screenshot({ path: path.join(shotDir, 'strefy-telefon.png') });

  const errs = errors.concat(mobile.errors).filter((e) => !/firebase|gstatic/i.test(e));
  ok('bez błędów JS', errs.length === 0, errs.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' błędów'); process.exit(1); }
  console.log('Wszystko OK. Zrzuty: ' + shotDir);
})().catch((e) => { console.error(e); process.exit(1); });
