// UI: tydzień nie pokazuje planu i zapisu Live jako dwóch kart o tej samej godzinie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_DEDUPE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-dedupe'));
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const ymd = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    if (typeof goTo === 'function') goTo('calendar');
    const base = (typeof calCurrentDate !== 'undefined' && calCurrentDate) ? new Date(calCurrentDate) : new Date();
    const ws = typeof getWeekStart === 'function' ? getWeekStart(base) : base;
    const mon = ymd(ws);
    const tueDt = new Date(ws); tueDt.setDate(ws.getDate() + 1);
    const tue = ymd(tueDt);
    window.CL = [
      { id: 'c-ad', name: 'Adrian', status: 'active' },
      { id: 'c-ola', name: 'Ola Kowalska', status: 'active' }
    ];
    window.SE = [
      { id: 'p-ad', clientId: 'c-ad', date: mon, time: '08:00', duration: 60, source: 'planned', type: 'Dzień 1 — Push' },
      { id: 'l-ad', clientId: 'c-ad', date: mon, time: '08:00', duration: 60, source: 'live', type: 'Live' },
      { id: 'p-ola', clientId: 'c-ola', date: mon, time: '08:00', duration: 60, source: 'planned', type: 'FBW' },
      { id: 'g1', date: tue, time: '12:00', duration: 60, source: 'planned', type: 'Sesja B — Push + Legs + Core' },
      { id: 'g2', date: tue, time: '12:00', duration: 60, source: 'planned', type: 'Sesja B — Push + Legs + Core' },
      { id: 'g3', date: tue, time: '12:00', duration: 60, source: 'planned', type: 'Sesja B — Push + Legs + Core' }
    ];
    window.TASKS = [];
    if (typeof renderCal === 'function') renderCal();
  });

  await page.waitForSelector('.cal-session-block');
  await page.waitForTimeout(150);

  const info = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('#cal-week-grid .cal-session-block')].map(el => ({
      id: el.getAttribute('data-cal-sess'),
      name: ((el.querySelector('.cal-session-name') || {}).textContent || '').trim(),
      day: el.closest('.cal-cell') ? el.closest('.cal-cell').getAttribute('data-cal-day') : '',
      hour: el.closest('.cal-cell') ? el.closest('.cal-cell').getAttribute('data-cal-hour') : ''
    }));
    const eight = chips.filter(c => c.hour === '8');
    const noon = chips.filter(c => c.hour === '12');
    const adrian = eight.filter(c => /Adrian/.test(c.name));
    const ola = eight.filter(c => /Ola/.test(c.name));
    return { chips, eightN: eight.length, noonN: noon.length, adrianN: adrian.length, olaN: ola.length, names: chips.map(c => c.name) };
  });

  await page.screenshot({ path: path.join(shotDir, 'cal_week_dedupe.png') });
  ok('adrian once at 08:00', info.adrianN === 1, JSON.stringify(info.names));
  ok('ola still shown', info.olaN === 1, JSON.stringify(info.names));
  ok('two clients at 08:00', info.eightN === 2, String(info.eightN));
  ok('anon noon collapsed', info.noonN === 1, JSON.stringify(info.chips.filter(c => c.hour === '12')));
  ok('no planned+live pair', !info.chips.some(c => c.id === 'p-ad'), JSON.stringify(info.chips));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-sess-dedupe UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
