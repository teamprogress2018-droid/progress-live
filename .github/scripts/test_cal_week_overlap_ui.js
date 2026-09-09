// UI: widok tygodnia — 3 nachodzące sesje obok siebie, nie w stosie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_OVERLAP_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-overlap'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
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
    const today = typeof todayYmd === 'function' ? todayYmd() : '2026-09-09';
    window.CL = [
      { id: 'c-mal', name: 'Małgosia', status: 'active' },
      { id: 'c-ola', name: 'Ola Kowalska', status: 'active' },
      { id: 'c-ad', name: 'Adrian', status: 'active' }
    ];
    window.SE = [
      { id: 's-mal', clientId: 'c-mal', date: today, time: '08:00', duration: 60, type: 'Dzień B — FBW' },
      { id: 's-ola', clientId: 'c-ola', date: today, time: '08:59', duration: 60, type: 'FBW' },
      { id: 's-ad', clientId: 'c-ad', date: today, time: '09:00', duration: 60, type: 'Siła' }
    ];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('calendar');
    else if (typeof renderCal === 'function') renderCal();
  });

  await page.waitForSelector('.cal-session-block');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const scroll = document.getElementById('cal-week-scroll');
    if (scroll) scroll.scrollTop = 0;
  });
  await page.waitForTimeout(80);

  const info = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.cal-session-block')].map(el => {
      const r = el.getBoundingClientRect();
      return {
        id: el.getAttribute('data-cal-sess'),
        name: ((el.querySelector('.cal-session-name') || {}).textContent || '').trim(),
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height
      };
    });
    return {
      n: blocks.length,
      names: blocks.map(b => b.name),
      lanes: document.querySelectorAll('.cal-week-day-lane').length,
      blocks
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'cal_week_overlap.png') });
  ok('three session cards', info.n === 3, JSON.stringify(info.names));
  ok('seven day lanes', info.lanes === 7);
  ok('names visible', /Małgosia/.test(info.names.join(' ')) && /Ola/.test(info.names.join(' ')) && /Adrian/.test(info.names.join(' ')), info.names.join(','));
  ok('cards wide enough', info.blocks.every(b => b.width >= 40), JSON.stringify(info.blocks.map(b => b.width)));

  const pairs = [
    [info.blocks[0], info.blocks[1]],
    [info.blocks[0], info.blocks[2]],
    [info.blocks[1], info.blocks[2]]
  ];
  const overlaps = pairs.map(([a, b]) => overlapArea(a, b));
  ok('no stacked deck overlap', overlaps.every(a => a < 80), JSON.stringify(overlaps));

  const mal = info.blocks.find(b => b.id === 's-mal');
  const ola = info.blocks.find(b => b.id === 's-ola');
  ok('malgosia left of ola', mal && ola && mal.right <= ola.left + 4, JSON.stringify({ mal, ola }));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-week-overlap UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
