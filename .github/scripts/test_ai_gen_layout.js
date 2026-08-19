// Layout generatora / kalkulatora: treść od lewej, kalkulator na pełną szerokość.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('apl-layout class', css.includes('.apl-layout{display:flex'));
ok('apl-result no 820 cap', !html.includes('max-width:820px;margin:0 auto'));
ok('calc-results no 1180 cap', !/#calc-results\{[^}]*max-width:\s*1180px/.test(css));
ok('generator uses apl-layout', html.includes('class="apl-layout"'));
ok('workout library screen removed', !html.includes('id="screen-workout-library"'));
ok('workout library nav removed', !html.includes('data-screen="workout-library"'));

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const shotDir = process.env.LAYOUT_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-layout');
  fs.mkdirSync(shotDir, { recursive: true });
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
  });

  await page.evaluate(() => goTo('aiplangen'));
  await page.waitForTimeout(400);
  const gen = await page.evaluate(() => {
    const layout = document.querySelector('.apl-layout');
    const sidebar = document.querySelector('.sidebar');
    const wrap = document.getElementById('apl-result-wrap');
    const result = document.getElementById('apl-result');
    const lr = layout.getBoundingClientRect();
    const sr = sidebar.getBoundingClientRect();
    const rr = result.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    return {
      gapFromSidebar: Math.round(lr.left - sr.right),
      layoutWidth: Math.round(lr.width),
      resultWidth: Math.round(rr.width),
      wrapWidth: Math.round(wr.width),
      resultLeft: Math.round(rr.left - wr.left),
      mainWidth: Math.round(document.querySelector('.main').getBoundingClientRect().width)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ai_generator.png') });
  ok('generator flush to sidebar', gen.gapFromSidebar <= 8, 'gap=' + gen.gapFromSidebar);
  ok('generator uses main width', gen.layoutWidth > gen.mainWidth * 0.9, JSON.stringify(gen));
  ok('generator result fills column', gen.resultWidth > gen.wrapWidth * 0.9, JSON.stringify(gen));
  ok('generator result not centered cap', gen.resultLeft <= 28, 'resultLeft=' + gen.resultLeft);

  await page.evaluate(() => goTo('calculator'));
  await page.waitForTimeout(400);
  const calc = await page.evaluate(() => {
    if (typeof calcTDEE === 'function') calcTDEE();
    const layout = document.querySelector('.calc-layout');
    const results = document.getElementById('calc-results');
    const area = document.querySelector('.calc-results-area');
    const sidebar = document.querySelector('.sidebar');
    const lr = layout.getBoundingClientRect();
    const sr = sidebar.getBoundingClientRect();
    const rr = results.getBoundingClientRect();
    const ar = area.getBoundingClientRect();
    return {
      gapFromSidebar: Math.round(lr.left - sr.right),
      layoutWidth: Math.round(lr.width),
      resultsWidth: Math.round(rr.width),
      areaWidth: Math.round(ar.width),
      mainWidth: Math.round(document.querySelector('.main').getBoundingClientRect().width)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'calculator.png') });
  ok('calculator flush to sidebar', calc.gapFromSidebar <= 8, 'gap=' + calc.gapFromSidebar);
  ok('calculator layout full main', calc.layoutWidth > calc.mainWidth * 0.9, JSON.stringify(calc));
  ok('calculator results fill area', calc.resultsWidth > calc.areaWidth * 0.9, JSON.stringify(calc));

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nLayout generatora/kalkulatora OK. Shots: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
