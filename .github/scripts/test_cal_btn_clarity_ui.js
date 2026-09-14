// UI: topbar kalendarza — ramka ghost, mocniejsze Dziś, czerwony aktywny widok.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_BTN_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-btn'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function rgb(str) {
  const m = String(str || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}
function lum([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
    window.CL = [{ id: 'c1', name: 'Ada Nowak', status: 'active' }];
    window.SE = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('calendar');
  });

  await page.waitForSelector('#screen-calendar.screen.active, #calv-week');
  await page.waitForTimeout(200);

  const styles = await page.evaluate(() => {
    const cs = el => el ? getComputedStyle(el) : {};
    const back = document.querySelector('#screen-calendar .topbar-actions .btn-ghost:not(.cal-nav-today)');
    const today = document.querySelector('#screen-calendar .cal-nav-today');
    const week = document.getElementById('calv-week');
    const month = document.getElementById('calv-month');
    const add = document.querySelector('#screen-calendar .topbar-actions .btn-primary');
    return {
      backBorder: back ? cs(back).borderTopWidth : '0px',
      backColor: back ? cs(back).color : '',
      backBg: back ? cs(back).backgroundColor : '',
      todayBg: today ? cs(today).backgroundColor : '',
      todayWeight: today ? cs(today).fontWeight : '',
      weekBg: week ? cs(week).backgroundColor : '',
      weekColor: week ? cs(week).color : '',
      monthColor: month ? cs(month).color : '',
      addBg: add ? cs(add).backgroundColor : '',
      weekActive: !!(week && week.classList.contains('active'))
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'cal_topbar_buttons.png') });

  ok('ghost has visible border', parseFloat(styles.backBorder) >= 1, JSON.stringify(styles));
  ok('today fill brighter than wstecz', lum(rgb(styles.todayBg)) > lum(rgb(styles.backBg)), JSON.stringify(styles));
  ok('week tab active red', styles.weekActive && rgb(styles.weekBg)[0] > 200 && rgb(styles.weekBg)[1] < 90, JSON.stringify(styles));
  ok('week tab white label', rgb(styles.weekColor)[0] > 240 && rgb(styles.weekColor)[1] > 240, JSON.stringify(styles));
  ok('add session still primary red', rgb(styles.addBg)[0] > 200 && rgb(styles.addBg)[1] < 90, JSON.stringify(styles));

  await page.click('#calv-month');
  await page.waitForTimeout(120);
  const afterMonth = await page.evaluate(() => {
    const week = document.getElementById('calv-week');
    const month = document.getElementById('calv-month');
    const cs = el => getComputedStyle(el);
    return {
      weekActive: week.classList.contains('active'),
      monthActive: month.classList.contains('active'),
      monthBg: cs(month).backgroundColor,
      weekBg: cs(week).backgroundColor
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_topbar_month.png') });
  ok('switching month paints month red', afterMonth.monthActive && !afterMonth.weekActive && rgb(afterMonth.monthBg)[0] > 200, JSON.stringify(afterMonth));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll calendar button clarity UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
