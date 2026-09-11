// UI: zakładka Plan — Trening A/B/C jako osobne kafelki z obramowaniem.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.PLAN_TILE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-plan-tiles'));
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

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c-ewa', name: 'Ewelina', goal: 'masa', level: 'poczatkujacy', status: 'active' }];
    const day = (label, extra) => ({
      day: 'HIIT + Siła',
      name: 'Trening ' + label,
      muscles: 'Trening ' + label,
      exercises: [
        { name: 'Przysiad Goblet', sets: '3', reps: '10-12' },
        { name: 'Wyciskanie hantli leżąc', sets: '3', reps: extra || '10-12' },
        { name: 'Wiosłowanie hantlem', sets: '3', reps: '10-12' }
      ]
    });
    window.PL = [{
      id: 'pl-hiit',
      clientId: 'c-ewa',
      name: 'Schemat HIIT + Siła 3×',
      method: 'FBW',
      duration: 1,
      days: [day('A'), day('B', '10-12'), day('C', '12-15')]
    }];
    window.SE = [];
    window.TASKS = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-ewa');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-plan');
  await page.waitForSelector('.cp-plan-day-tile');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shotDir, 'cp_plan_day_tiles.png') });

  const metrics = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.cp-plan-day-tile')];
    const boxes = tiles.map((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return {
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        border: st.borderTopWidth + ' ' + st.borderTopStyle,
        radius: st.borderRadius,
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      };
    });
    const gaps = [];
    for (let i = 1; i < boxes.length; i++) gaps.push(boxes[i].top - boxes[i - 1].bottom);
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    return { n: tiles.length, boxes, gaps, body: body.slice(0, 400) };
  });

  ok('three training tiles', metrics.n === 3, 'n=' + metrics.n);
  ok('list still shows exercises', /Przysiad Goblet/.test(metrics.body) && /Trening A/.test(metrics.body) && /Trening C/.test(metrics.body));
  ok('each tile has border', metrics.boxes.every((b) => parseFloat(b.border) >= 1), JSON.stringify(metrics.boxes.map((b) => b.border)));
  ok('tiles are separated', metrics.gaps.every((g) => g >= 6), JSON.stringify(metrics.gaps));
  ok('not one merged block', metrics.boxes[0] && metrics.boxes[2] && metrics.boxes[2].top > metrics.boxes[0].bottom + 8);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-plan-day-tiles UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
