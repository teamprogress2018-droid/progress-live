// UI: nieopłacony pakiet blokuje Live; Trial odblokowuje.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.PKG_GATE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-pkg-gate'));
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
    const client = { id: 'c-anna', name: 'Anna Nowak', status: 'active', goal: 'redukcja', level: 'sredni' };
    if (Array.isArray(window.CL)) {
      window.CL.splice(0, window.CL.length, client);
    } else window.CL = [client];
    Object.keys(window.PACKAGES || {}).forEach(() => {});
    window.PACKAGES = window.PACKAGES || [];
    if (Array.isArray(window.PACKAGES)) {
      window.PACKAGES.splice(0, window.PACKAGES.length, {
        id: 'pk-unpaid', clientId: 'c-anna', title: '10 sesji', price: 1500, payStatus: 'pending', sessions: 10, sessionsUsed: 0
      });
    }
    window.SE = window.SE || [];
    window.PL = [{ id: 'pl-anna', clientId: 'c-anna', name: 'PPL', days: [{ exercises: [{ name: 'Przysiad' }] }] }];
    if (typeof openClientProfile === 'function') openClientProfile('c-anna');
  });

  await page.waitForSelector('#cp-drawer.open');
  const ov = await page.evaluate(() => ({
    gate: !!document.querySelector('.cp-pay-gate'),
    text: (document.getElementById('cp-body') || {}).innerText || '',
    blocked: typeof clientHasPaidAccess === 'function' && !clientHasPaidAccess('c-anna').ok
  }));
  await page.screenshot({ path: path.join(shotDir, 'pkg_gate_overview.png') });
  ok('overview gate', ov.gate && /nieopłacon/i.test(ov.text), ov.text.slice(0, 300));
  ok('access blocked', ov.blocked);

  await page.evaluate(() => { if (typeof setCPTab === 'function') setCPTab('payments'); });
  await page.waitForSelector('.cp-access-mode');
  const pay = await page.evaluate(() => ({
    modes: [...document.querySelectorAll('.cp-access-mode')].map(b => b.getAttribute('data-mode')),
    text: (document.getElementById('cp-body') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'pkg_gate_payments.png') });
  ok('payments modes', pay.modes.join(',') === 'standard,trial,guest', JSON.stringify(pay.modes));

  const nameOnly = await page.evaluate(() => {
    (window.PACKAGES || []).push({
      id: 'pk-name-collision', clientId: 'c-other', clientName: 'Anna Nowak',
      title: 'Cudzy pakiet', price: 1, payStatus: 'paid', sessions: 1, sessionsUsed: 0
    });
    if (typeof renderCPPayments === 'function') renderCPPayments(window.CL[0]);
    const text = (document.getElementById('cp-body') || {}).innerText || '';
    const ids = typeof packagesForClient === 'function' ? packagesForClient('c-anna').map(p => p.id) : [];
    return { text, ids };
  });
  ok('payments lists own package', /10 sesji/.test(nameOnly.text), nameOnly.text.slice(0, 250));
  ok('payments skips same-name other client', !/Cudzy pakiet/.test(nameOnly.text) && nameOnly.ids.join(',') === 'pk-unpaid', JSON.stringify(nameOnly.ids));

  await page.click('.cp-access-mode[data-mode="trial"]');
  await page.waitForTimeout(200);
  const afterTrial = await page.evaluate(() => {
    const r = typeof clientHasPaidAccess === 'function' ? clientHasPaidAccess('c-anna') : {};
    const n = typeof schedulePlanToCalendar === 'function' ? schedulePlanToCalendar('pl-anna', { weeks: 1 }) : -1;
    return { ok: r.ok, reason: r.reason, scheduled: n };
  });
  await page.screenshot({ path: path.join(shotDir, 'pkg_gate_trial.png') });
  ok('trial allows schedule', afterTrial.ok && afterTrial.reason === 'trial' && afterTrial.scheduled > 0, JSON.stringify(afterTrial));

  await page.evaluate(() => {
    setClientAccessMode('c-anna', 'standard');
    if (typeof goTo === 'function') goTo('live');
    if (typeof liveClientSetField === 'function') liveClientSetField('c-anna', 'Anna Nowak', false, 0);
    const st = typeof liveRef === 'function' ? liveRef(0) : (window.LIVE && window.LIVE[0]);
    if (st) {
      st.exercises = [{ name: 'Przysiad', sets: [{ setNo: 1, kg: 40, reps: 8, done: false }] }];
    }
    if (typeof renderLiveClientCard === 'function') renderLiveClientCard(0);
    if (typeof liveBindSessionButtons === 'function') liveBindSessionButtons(0);
    if (typeof liveStartSession === 'function') liveStartSession(0);
  });
  await page.waitForTimeout(300);
  const liveBlocked = await page.evaluate(() => {
    const st = typeof liveRef === 'function' ? liveRef(0) : null;
    const gate = !!document.querySelector('.live-pay-gate');
    const btn = document.getElementById('live-start-btn');
    return { active: !!(st && st.sessionActive), gate, disabled: !!(btn && btn.disabled) };
  });
  await page.screenshot({ path: path.join(shotDir, 'pkg_gate_live.png') });
  ok('live blocked unpaid', !liveBlocked.active && liveBlocked.gate && liveBlocked.disabled, JSON.stringify(liveBlocked));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll pkg-gate UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
