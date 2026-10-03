// UI: drop %/kg w wierszu + obwód stacje / przejście.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.DROP_CIRC_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-drop-circ'));
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
  await page.goto('http://localhost:' + port + '/index.html?nocache=dropcirc', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr Urbaniak', status: 'active' }];
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-kind-btn.drop');
  await page.click('.ex-kind-btn.drop');
  await page.click('.ex-kind-btn.drop');
  await page.fill('.ex-row [data-f="dropStep"]', '20%');
  const drop = await page.evaluate(() => {
    const inp = document.querySelector('[data-f="dropStep"]');
    const btn = document.querySelector('.ex-kind-btn.drop');
    return {
      hidden: !!(inp && inp.hidden),
      val: inp ? inp.value : '',
      btn: btn ? btn.textContent : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_drop_step.png') });
  ok('drop step visible', drop.hidden === false && drop.val === '20%', JSON.stringify(drop));
  ok('drop count 2', /DROP\s*2/.test(drop.btn), drop.btn);

  await page.selectOption('#b-method', 'Obwodowy');
  await page.evaluate(() => { if (typeof builderOnMethodChange === 'function') builderOnMethodChange(); });
  await page.waitForTimeout(200);
  const circ = await page.evaluate(() => {
    const day = document.querySelector('.builder-day');
    const cb = day && day.querySelector('.circ');
    const badge = document.querySelector('.builder-station-badge');
    const trans = document.querySelector('[data-f="trans"]');
    const rr = document.querySelector('.builder-round-rest');
    return {
      checked: !!(cb && cb.checked),
      isCirc: !!(day && day.classList.contains('is-circuit')),
      badge: badge ? badge.textContent : '',
      badgeHidden: !!(badge && badge.hidden),
      transHidden: !!(trans && trans.hidden),
      roundHidden: !!(rr && rr.hidden)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_circuit_stations.png') });
  ok('circuit on', circ.checked && circ.isCirc, JSON.stringify(circ));
  ok('station S1', circ.badge === 'S1' && circ.badgeHidden === false, JSON.stringify(circ));
  ok('trans + round rest visible', circ.transHidden === false && circ.roundHidden === false, JSON.stringify(circ));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll drop/circuit UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
