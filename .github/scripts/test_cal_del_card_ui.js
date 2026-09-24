// UI: profil klienta → Treningi — × usuwa kartę planu z kalendarza.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_DEL_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-del'));
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
  page.on('dialog', d => d.accept());
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const today = typeof todayYmd === 'function' ? todayYmd() : '';
    const d = new Date();
    const dow = d.getDay();
    const mondayOff = dow === 0 ? -6 : 1 - dow;
    const mon = typeof ymdAdd === 'function' ? ymdAdd(today, mondayOff) : today;
    const wed = typeof ymdAdd === 'function' ? ymdAdd(mon, 2) : today;
    const thu = typeof ymdAdd === 'function' ? ymdAdd(mon, 3) : today;
    window.CL = [{ id: 'c-ola', name: 'Ola', goal: 'redukcja', status: 'active' }];
    window.PL = [{ id: 'pl-ola', clientId: 'c-ola', name: 'FBW', days: [{ exercises: [{ name: 'Przysiad' }] }] }];
    window.SE = [
      { id: 'p-mon', clientId: 'c-ola', date: mon, source: 'planned', type: 'PON PLAN', planId: 'pl-ola', dayIdx: 0 },
      { id: 'p-wed', clientId: 'c-ola', date: wed, source: 'planned', type: 'ŚR PLAN', planId: 'pl-ola', dayIdx: 0 },
      { id: 'live-keep', clientId: 'c-ola', date: thu, source: 'live', type: 'Live', exercises: [{ name: 'Przysiad', sets: [{ kg: 40, reps: 8 }] }] }
    ];
    window.TASKS = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-ola');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-training');
  await page.waitForSelector('.cp-week-tile');

  const before = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.cp-week-tile').length,
    planned: (window.SE || []).filter(s => s.source === 'planned').length,
    more: !!document.getElementById('cp-mp-more-btn')
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_cal_del_before.png') });
  ok('plan tiles shown', before.tiles >= 1 && before.planned >= 2, JSON.stringify(before));
  ok('more menu for bulk', before.more);

  await page.click('#cp-mp-more-btn');
  await page.waitForSelector('#cp-mp-more-menu button');
  await page.click('#cp-mp-more-menu button');
  await page.waitForTimeout(300);
  const afterAll = await page.evaluate(() => ({
    planned: (window.SE || []).filter(s => s.source === 'planned').length,
    live: (window.SE || []).filter(s => s.source === 'live').length,
    tiles: document.querySelectorAll('.cp-week-tile').length,
    body: (document.getElementById('cp-body') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_cal_del_cleared.png') });
  ok('all planned gone', afterAll.planned === 0, JSON.stringify(afterAll));
  ok('live still there', afterAll.live === 1);
  ok('no plan cards left', afterAll.tiles === 0 || !/PON PLAN|ŚR PLAN/.test(afterAll.body));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll cal-del-card UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
