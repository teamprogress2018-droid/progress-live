// UI: widok tygodnia — sesje w godzinach w dół (jak miesiąc), nie w wąskich kolumnach.
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
    const today = typeof todayYmd === 'function' ? todayYmd() : '2026-09-14';
    window.CL = [
      { id: 'c-mal', name: 'Małgosia', status: 'active' },
      { id: 'c-ola', name: 'Ola Kowalska', status: 'active' },
      { id: 'c-ad', name: 'Adrian', status: 'active' },
      { id: 'c-ag', name: 'Agnieszka', status: 'active' }
    ];
    window.SE = [
      { id: 's-mal', clientId: 'c-mal', date: today, time: '08:00', duration: 60, type: 'Dzień B — FBW' },
      { id: 's-ola', clientId: 'c-ola', date: today, time: '08:00', duration: 60, type: 'FBW' },
      { id: 's-ag', clientId: 'c-ag', date: today, time: '08:00', duration: 45, type: 'Siła' },
      { id: 's-ad', clientId: 'c-ad', date: today, time: '12:00', duration: 60, type: 'Siła' }
    ];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('calendar');
    else if (typeof renderCal === 'function') renderCal();
  });

  await page.waitForSelector('.cal-session-block');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const eight = document.querySelector('.cal-hour-label[data-cal-hour="8"]');
    const scroll = document.getElementById('cal-week-scroll');
    if (eight && scroll) scroll.scrollTop = Math.max(0, eight.offsetTop - 8);
  });
  await page.waitForTimeout(80);

  const info = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.cal-session-block')].map(el => {
      const r = el.getBoundingClientRect();
      const cell = el.closest('.cal-cell');
      return {
        id: el.getAttribute('data-cal-sess'),
        name: ((el.querySelector('.cal-session-name') || {}).textContent || '').trim(),
        hour: cell ? cell.getAttribute('data-cal-hour') : '',
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height
      };
    });
    const eight = document.querySelector('.cal-cell[data-cal-hour="8"] .cal-session-block');
    const noon = document.querySelector('.cal-cell[data-cal-hour="12"] .cal-session-block');
    return {
      n: blocks.length,
      names: blocks.map(b => b.name),
      lanes: document.querySelectorAll('.cal-week-day-lane').length,
      eightCount: document.querySelectorAll('.cal-cell[data-cal-hour="8"] .cal-session-block').length,
      twelveCount: document.querySelectorAll('.cal-cell[data-cal-hour="12"] .cal-session-block').length,
      eightTop: eight ? eight.getBoundingClientRect().top : 0,
      noonTop: noon ? noon.getBoundingClientRect().top : 0,
      blocks
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'cal_week_hours.png') });
  ok('four session cards', info.n === 4, JSON.stringify(info.names));
  ok('no day lanes', info.lanes === 0);
  ok('names visible', /Małgosia/.test(info.names.join(' ')) && /Ola/.test(info.names.join(' ')) && /Adrian/.test(info.names.join(' ')), info.names.join(','));
  ok('three at 08:00', info.eightCount === 3, String(info.eightCount));
  ok('one at 12:00', info.twelveCount === 1, String(info.twelveCount));
  ok('cards wide like month chips', info.blocks.every(b => b.width >= 90), JSON.stringify(info.blocks.map(b => b.width)));
  ok('noon below morning', info.noonTop > info.eightTop + 20, JSON.stringify({ eight: info.eightTop, noon: info.noonTop }));

  const morning = info.blocks.filter(b => b.hour === '8').sort((a, b) => a.top - b.top);
  ok('morning stacked down', morning.length === 3 && morning[0].top < morning[1].top && morning[1].top < morning[2].top, JSON.stringify(morning.map(b => b.top)));
  ok('morning same column', morning.every(b => Math.abs(b.left - morning[0].left) < 8), JSON.stringify(morning.map(b => b.left)));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-week-hours UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
