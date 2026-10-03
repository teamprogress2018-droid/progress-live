// UI: główny kalendarz (tydzień) — ✓ Odbył się na karcie planu zapisuje sesję sala.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_WEEK_SALA_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-week-sala'));
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
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    // Signed-in tenant fixture; no production Firebase connection.
    window._uid = 'ui-trainer';
    window._clientAppMode = false;
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._db = { fixture: true };
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const today = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    window.CL = [{ id: 'c-ad', trainerId: window._uid, name: 'Adrian Ciszewski', status: 'active' }];
    window.SE = [{
      id: 'p-ad', trainerId: window._uid,
      clientId: 'c-ad',
      date: today,
      time: '08:00',
      duration: 60,
      type: 'Dzień 1 — PUSH + C',
      source: 'planned'
    }];
    window.PL = [{
      id: 'pl-ad', trainerId: window._uid, clientId: 'c-ad', name: 'PPL',
      days: [{ exercises: [{ name: 'Wyciskanie sztangi leżąc' }, { name: 'Pompki' }] }]
    }];
    window.SE[0].planId = 'pl-ad';
    window.SE[0].dayIdx = 0;
    window.PACKAGES = [{
      id: 'pk-ad', trainerId: window._uid, clientId: 'c-ad', title: '10 sesji', payStatus: 'paid',
      sessions: 10, sessionsUsed: 3, expiresDate: '2027-01-01'
    }];
    window.CHECKINS = {};
    window.calView = 'week';
    window.calCurrentDate = new Date(today + 'T12:00:00');
    if (typeof goTo === 'function') goTo('calendar');
    if (typeof renderCal === 'function') renderCal();
  });

  await page.waitForSelector('#cal-week-grid .cal-sala-done');
  const before = await page.evaluate(() => {
    const btn = document.querySelector('#cal-week-grid .cal-sala-done');
    const chip = btn && btn.closest('.cal-week-sess');
    return {
      label: btn ? (btn.textContent || '').trim() : '',
      n: document.querySelectorAll('#cal-week-grid .cal-sala-done').length,
      name: chip ? ((chip.querySelector('.cal-session-name') || {}).textContent || '').trim() : '',
      logged: (window.SE || []).filter(s => s && s.source === 'sala').length
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_week_odbył_się.png') });
  ok('week chip has Odbył się', before.n >= 1 && /Odbył się/.test(before.label), JSON.stringify(before));
  ok('week chip shows client', /Adrian/i.test(before.name), before.name);
  ok('no sala yet', before.logged === 0);

  await page.click('#cal-week-grid .cal-sala-done');
  await page.waitForSelector('#sala-done-save');
  const modal = await page.evaluate(() => {
    const m = document.getElementById('m-sala-done');
    return {
      shown: !!(m && m.classList.contains('show')),
      title: (document.getElementById('sala-done-title') || {}).textContent || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_week_sala_modal.png') });
  ok('modal from week chip', modal.shown && /Adrian/i.test(modal.title), JSON.stringify(modal));

  await page.click('.sala-rate-btn[data-rate="5"]');
  await page.fill('#sala-done-min', '50');
  await page.click('#sala-done-save');
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => {
    const sala = (window.SE || []).filter(s => s && s.source === 'sala');
    const pending = document.querySelectorAll('#cal-week-grid .cal-sala-done').length;
    const doneChip = document.querySelector('#cal-week-grid .cal-session-done');
    return {
      salaN: sala.length,
      feedback: sala[0] && sala[0].feedback,
      duration: sala[0] && sala[0].duration,
      pending,
      doneChip: !!(doneChip || pending === 0),
      pkgUsed: ((window.PACKAGES || [])[0] || {}).sessionsUsed
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cal_week_sala_logged.png') });
  ok('sala saved from week', after.salaN === 1 && after.feedback === 5 && after.duration === 50, JSON.stringify(after));
  ok('week button gone after log', after.pending === 0, JSON.stringify(after));
  ok('package ticked', after.pkgUsed === 4, JSON.stringify(after));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-week sala-done UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
