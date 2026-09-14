// UI: klik godziny zostawia wybraną datę/czas; Zapisz edycji nie duplikuje karty.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_SESS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-sess'));
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
    window.CL = [{ id: 'c-ola', name: 'Ola Kowalska', status: 'active' }];
    window.SE = [{
      id: 's-ola', clientId: 'c-ola', date: '2026-09-14', time: '08:00', duration: 45,
      type: 'Dzień 1 — FBW A', notes: 'Priorytet: przysiad', source: 'planned'
    }];
    window.PL = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('calendar');
  });

  await page.waitForSelector('.cal-session-block');
  const quick = await page.evaluate(() => {
    if (typeof quickAddSession === 'function') quickAddSession('2026-09-16', '07:00');
    return {
      date: (document.getElementById('as-date') || {}).value,
      time: (document.getElementById('as-time') || {}).value,
      client: (document.getElementById('as-client') || {}).value,
      open: !!(document.getElementById('m-session') && document.getElementById('m-session').classList.contains('show'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_quick_add_time.png') });
  ok('quick add keeps clicked slot', quick.open && quick.date === '2026-09-16' && quick.time === '07:00' && quick.client === '', JSON.stringify(quick));

  const edited = await page.evaluate(async () => {
    if (typeof closeM === 'function') closeM('m-session');
    if (typeof editSession === 'function') editSession('s-ola');
    const before = (window.SE || []).length;
    const dur = (document.getElementById('as-duration') || {}).value;
    const type = (document.getElementById('as-type') || {}).value;
    const notes = (document.getElementById('as-notes') || {}).value;
    const d = document.getElementById('as-date');
    if (d) d.value = '2026-09-15';
    if (typeof saveSess === 'function') await saveSess();
    const s = (window.SE || []).find(x => x.id === 's-ola');
    return {
      before, after: (window.SE || []).length,
      dur, type, notes,
      date: s && s.date, time: s && s.time, duration: s && s.duration
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_edit_save_no_dup.png') });
  ok('edit loads duration and plan type', edited.dur === '45' && /FBW A/.test(edited.type) && /przysiad/.test(edited.notes), JSON.stringify(edited));
  ok('save updates instead of duplicating', edited.before === 1 && edited.after === 1 && edited.date === '2026-09-15', JSON.stringify(edited));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll calendar session-save UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
