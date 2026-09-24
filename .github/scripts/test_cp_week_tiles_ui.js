// UI: Treningi — stany kafelków, bez czerwieni planu, bez przycisku na przyszłym dniu.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_LOG_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-week-tiles'));
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
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const today = typeof todayYmd === 'function' ? todayYmd() : '';
    const yest = typeof ymdAdd === 'function' ? ymdAdd(today, -1) : today;
    const tom = typeof ymdAdd === 'function' ? ymdAdd(today, 1) : today;
    const dow = ymd => new Date(ymd + 'T12:00:00').getDay();
    window.CL = [{
      id: 'c-urbaniak',
      name: 'Piotr Urbaniak',
      goal: 'masa',
      level: 'sredni',
      age: 43,
      status: 'active',
      preferredWeekdays: [1, 3, 5, 0]
    }];
    window.PL = [{
      id: 'pl-fbw',
      clientId: 'c-urbaniak',
      name: 'FBW Siła 4×/tydzień — Piotr Urbaniak',
      days: [
        { day: 'FBW A', weekday: dow(yest), muscles: 'całe ciało', exercises: [{ name: 'Przysiad' }] },
        { day: 'FBW B', weekday: dow(today), muscles: 'całe ciało', exercises: [{ name: 'Wyciskanie' }] },
        { day: 'FBW C', weekday: dow(tom), muscles: 'całe ciało', exercises: [{ name: 'Wiosłowanie' }] }
      ]
    }];
    window.SE = [
      { id: 'p-y', clientId: 'c-urbaniak', date: yest, time: '18:00', source: 'planned', type: 'FBW A', planId: 'pl-fbw', dayIdx: 0 },
      { id: 'p-t', clientId: 'c-urbaniak', date: today, time: '18:00', source: 'planned', type: 'FBW B', planId: 'pl-fbw', dayIdx: 1 },
      { id: 'p-f', clientId: 'c-urbaniak', date: tom, time: '18:00', source: 'planned', type: 'FBW C', planId: 'pl-fbw', dayIdx: 2 }
    ];
    window.PACKAGES = [];
    window.CHECKINS = {};
    if (typeof openClientProfile === 'function') openClientProfile('c-urbaniak');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-training');
  await page.waitForSelector('.cp-week-tile');
  const ui = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.cp-week-tile')].map(el => ({
      name: (el.querySelector('.cp-week-tile-name') || {}).textContent || '',
      st: (el.querySelector('.cp-week-tile-st') || {}).textContent || '',
      cls: [...el.classList].join(' '),
      btns: [...el.querySelectorAll('button')].map(b => (b.textContent || '').trim()),
      color: getComputedStyle(el).borderTopColor
    }));
    const body = (document.getElementById('cp-body') || {}).innerText || '';
    const range = ((document.querySelector('.cp-mp-range') || {}).innerText || '');
    return {
      tiles,
      tabs: ((document.querySelector('.cp-mp-tabs') || {}).innerText || ''),
      banner: ((document.querySelector('.cp-nolog-banner') || {}).innerText || ''),
      stats: ((document.querySelector('.cp-train-stats') || {}).innerText || ''),
      range,
      hasAssignment: /Assignment/.test(body),
      hasPlanLabel: tiles.some(t => /\bPLAN\b/.test(t.name) || /\bPLAN\b/.test(t.st)),
      more: !!document.getElementById('cp-mp-more-btn'),
      legend: /Czerwone karty/.test(body)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_week_tiles.png') });

  ok('plan historia tabs', /Plan/.test(ui.tabs) && /Historia/.test(ui.tabs) && !ui.hasAssignment, ui.tabs);
  ok('no client name in range', !/Piotr Urbaniak/.test(ui.range), ui.range);
  ok('short names no caps dump', ui.tiles.every(t => !/DZIEŃ/.test(t.name)), JSON.stringify(ui.tiles.map(t => t.name)));
  ok('no PLAN label', !ui.hasPlanLabel);
  ok('no color legend', !ui.legend);
  const nolog = ui.tiles.filter(t => /\bis-nolog\b/.test(t.cls));
  const todayT = ui.tiles.filter(t => /\bis-today\b/.test(t.cls));
  const fut = ui.tiles.filter(t => /\bis-future\b/.test(t.cls));
  ok('nolog orange copy', !nolog.length || (nolog.every(t => t.st === 'Niezapisany' && t.btns.includes('Odbył się') && t.btns.includes('Nie odbył się'))), JSON.stringify(nolog));
  ok('today live', todayT.length >= 1 && todayT.every(t => t.btns.includes('Rozpocznij Live') && t.btns.includes('Odbył się')), JSON.stringify(todayT));
  ok('future no odbył', fut.length >= 1 && fut.every(t => t.st === 'Zaplanowany' && !t.btns.includes('Odbył się')), JSON.stringify(fut));
  ok('no red planned', [...nolog, ...fut].every(t => !/rgb\(255,\s*59,\s*48\)/.test(t.color) && !/rgb\(230,\s*0,\s*0\)/.test(t.color)), JSON.stringify(ui.tiles.map(t => t.color)));
  if (nolog.length) ok('banner past unlogged', /bez zapisu — uzupełnij/.test(ui.banner), ui.banner);
  else ok('no legend without nolog', !ui.legend);
  ok('stats two numbers', /Ten tydzień/.test(ui.stats) && /Ostatnie 30 dni/.test(ui.stats), ui.stats);
  ok('more menu', ui.more);

  if (nolog.length) {
    await page.click('.cp-mark-skip');
    await page.waitForTimeout(300);
    const skipped = await page.evaluate(() => {
      const tile = document.querySelector('.cp-week-tile.is-skip');
      const s = (window.SE || []).find(x => x && x.status === 'opuszczony');
      return {
        cls: tile ? [...tile.classList].join(' ') : '',
        name: tile ? ((tile.querySelector('.cp-week-tile-name') || {}).textContent || '') : '',
        status: s && s.status
      };
    });
    await page.screenshot({ path: path.join(shotDir, 'cp_week_skipped.png') });
    ok('skipped status', skipped.status === 'opuszczony' && /is-skip/.test(skipped.cls), JSON.stringify(skipped));
  } else {
    ok('skip path not required on monday', true);
  }

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll cp-week-tiles UI tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
