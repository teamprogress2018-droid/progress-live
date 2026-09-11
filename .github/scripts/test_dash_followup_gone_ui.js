// UI: dashboard bez martwych follow-upów — treść w siatce operacyjnej.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.DASH_OPS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-dash-ops'));
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

  const ui = await page.evaluate(() => {
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
    if (typeof goTo === 'function') goTo('dashboard');
    const dead = [
      'dash-checkin-followup', 'dash-form-followup', 'dash-pay-followup',
      'dash-hw-followup', 'dash-msg-followup', 'dash-habit-followup',
      'dash-cal-refill', 'dash-photo-followup'
    ].filter((id) => document.getElementById(id));
    const att = document.getElementById('dash-ops-attention');
    const ops = document.getElementById('d-ops-attention');
    const dash = document.getElementById('screen-dashboard');
    const vis = (el) => {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden';
    };
    return {
      dead,
      hasOps: !!att && !!ops,
      dashActive: !!(dash && dash.classList.contains('active')),
      attVisible: vis(att),
      remSub: ((document.querySelector('#dash-ops-reminders .studio-sub') || {}).textContent || '').trim(),
      refresh: typeof refreshDashOps === 'function',
      aliases: typeof renderDashCheckinFollowup === 'function' && renderDashCheckinFollowup === refreshDashOps
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'dash_ops_no_followup.png') });
  ok('dead followups gone', ui.dead.length === 0, JSON.stringify(ui.dead));
  ok('ops grid', ui.hasOps && ui.dashActive && ui.attVisible, JSON.stringify(ui));
  ok('reminders subtitle packages', ui.remSub === 'Wygasające pakiety', ui.remSub);
  ok('refreshDashOps', ui.refresh && ui.aliases, JSON.stringify({ refresh: ui.refresh, aliases: ui.aliases }));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll dash follow-up-gone UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
