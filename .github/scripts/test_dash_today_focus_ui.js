// UI: pasek DZISIAJ na dashboardzie — kafelki prowadzą do istniejących sekcji.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.DASH_TODAY_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-dash-today'));
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

  const seeded = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const saver = document.getElementById('screensaver');
    if (saver) saver.style.display = 'none';
    const ymd = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    const addDays = n => {
      const d = new Date(ymd + 'T12:00:00');
      d.setDate(d.getDate() + n);
      const p = x => String(x).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };
    window.CL = [
      { id: 'c1', name: 'Anna Test', status: 'active', goal: 'masa' },
      { id: 'c2', name: 'Bartek Test', status: 'active' }
    ];
    window.SE = [
      { id: 's-today', clientId: 'c1', date: ymd, time: '10:00', duration: 60, type: 'FBW', source: 'planned' },
      { id: 's-miss1', clientId: 'c2', date: addDays(-3), source: 'planned' },
      { id: 's-miss2', clientId: 'c2', date: addDays(-5), source: 'planned' }
    ];
    window.PL = [{ id: 'p1', clientId: 'c1', name: 'FBW' }];
    window.PACKAGES = [{
      id: 'pk1', clientId: 'c1', clientName: 'Anna Test', title: 'Pakiet 8',
      price: 800, expiresDate: addDays(3), status: 'active', payStatus: 'paid'
    }];
    window.CHECKINS = {
      c1: [{ id: 'ci1', clientId: 'c1', status: 'filled', date: ymd, score: 80, answers: { energy: 4, sleep: 3 } }],
      c2: [{ id: 'ci2', clientId: 'c2', status: 'pending', date: addDays(-10) }]
    };
    window.TASKS = [];
    if (typeof invalidateOpsEventsCache === 'function') invalidateOpsEventsCache();
    if (typeof goTo === 'function') goTo('dashboard');
    if (typeof renderDash === 'function') renderDash();
    const strip = document.getElementById('dash-today-focus');
    const tiles = [...document.querySelectorAll('#dash-today-focus [data-dash-focus]')].map(el => ({
      id: el.getAttribute('data-dash-focus'),
      n: (el.querySelector('.dash-today-tile-n') || {}).textContent,
      lbl: (el.querySelector('.dash-today-tile-lbl') || {}).textContent,
      tone: [...el.classList].find(c => c.startsWith('dash-today-tile-') && c !== 'dash-today-tile') || '',
      top: strip && el.compareDocumentPosition(strip)
    }));
    const order = [
      'dash-today-focus', 'd-kpi-row', 'dash-ops-attention', 'dash-ops-today',
      'dash-ops-reports', 'dash-getting-started', 'dash-ops-activity'
    ].map(id => {
      const el = document.getElementById(id);
      return { id, top: el ? el.getBoundingClientRect().top : null };
    });
    const kpiVal = document.getElementById('d-reports');
    const kpiColor = kpiVal ? getComputedStyle(kpiVal).color : '';
    const sessTone = (document.querySelector('[data-dash-focus="sessions"]') || {}).className || '';
    return {
      hasStrip: !!strip && strip.children.length > 0,
      tiles,
      order,
      stats: typeof dashTodayFocusStats === 'function' ? dashTodayFocusStats() : null,
      snap: typeof clientSituationSnapshot === 'function' ? clientSituationSnapshot('c1') : null,
      sessHasRed: /dash-today-tile-act/.test(sessTone),
      kpiIsAccent: /255,\s*59,\s*48|255,\s*77,\s*77/.test(kpiColor)
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'dash_today_focus.png'), fullPage: false });
  ok('strip rendered', seeded.hasStrip, JSON.stringify(seeded.tiles));
  ok('four tiles', seeded.tiles.length === 4 && seeded.tiles.every(t => t.id), JSON.stringify(seeded.tiles));
  const byId = Object.fromEntries(seeded.tiles.map(t => [t.id, t]));
  ok('sessions count', byId.sessions && Number(byId.sessions.n) >= 1, JSON.stringify(byId.sessions));
  ok('attention count', byId.attention && Number(byId.attention.n) >= 1, JSON.stringify(byId.attention));
  ok('checkins count', byId.checkins && Number(byId.checkins.n) >= 1, JSON.stringify(byId.checkins));
  ok('packages count', byId.packages && Number(byId.packages.n) >= 1, JSON.stringify(byId.packages));
  ok('sessions not red', !seeded.sessHasRed, byId.sessions && byId.sessions.tone);
  ok('kpi not accent red', !seeded.kpiIsAccent, 'kpi color');
  ok('snapshot wired', seeded.snap && seeded.snap.clientId === 'c1' && seeded.snap.facts, JSON.stringify(seeded.snap && seeded.snap.facts));
  const tops = seeded.order.filter(o => o.top != null).map(o => o.top);
  ok('visual order today then kpi then attention', tops.length >= 3 && tops[0] <= tops[1] && tops[1] <= tops[2], JSON.stringify(seeded.order));

  await page.click('[data-dash-focus="attention"]');
  await page.waitForTimeout(400);
  const afterAtt = await page.evaluate(() => {
    const el = document.getElementById('dash-ops-attention');
    return {
      focused: !!(el && el.classList.contains('dash-section-focus')),
      expanded: !!(window._dashListExpanded && window._dashListExpanded['dash-attention'])
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'dash_today_focus_attention.png') });
  ok('attention click focuses section', afterAtt.focused && afterAtt.expanded, JSON.stringify(afterAtt));

  await page.click('[data-dash-focus="sessions"]');
  await page.waitForTimeout(400);
  const afterSess = await page.evaluate(() => {
    const el = document.getElementById('dash-ops-today');
    return !!(el && el.classList.contains('dash-section-focus'));
  });
  ok('sessions click focuses today plan', afterSess);

  await page.click('[data-dash-focus="checkins"]');
  await page.waitForTimeout(400);
  const afterCi = await page.evaluate(() => document.getElementById('dash-ops-reports') && document.getElementById('dash-ops-reports').classList.contains('dash-section-focus'));
  ok('checkins click focuses reports', afterCi);

  await page.click('[data-dash-focus="packages"]');
  await page.waitForTimeout(400);
  const afterPay = await page.evaluate(() => document.getElementById('dash-ops-pay') && document.getElementById('dash-ops-pay').classList.contains('dash-section-focus'));
  await page.screenshot({ path: path.join(shotDir, 'dash_today_focus_packages.png') });
  ok('packages click focuses pay', afterPay);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll dash today-focus UI checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
