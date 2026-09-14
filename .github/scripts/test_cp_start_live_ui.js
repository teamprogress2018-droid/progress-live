// UI: profil klienta → Trening Live ładuje klienta i plan, nie pusty ekran.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '../..');
const shotDir = process.env.LIVE_START_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts')
  ? '/opt/cursor/artifacts'
  : path.join(require('os').tmpdir(), 'pl-live-start'));
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
  page.on('dialog', d => d.dismiss());
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
    const client = {
      id: 'c-rad',
      name: 'Radosław Jarząb',
      goal: 'masa',
      level: 'sredni',
      status: 'active',
      weight: 86,
      height: 178,
      age: 34
    };
    if (Array.isArray(window.CL)) window.CL.splice(0, window.CL.length, client);
    else window.CL = [client];
    window.PL = [{
      id: 'p-fb-cont',
      clientId: 'c-rad',
      name: 'Kontynuacja Fitebo — 8 tyg.',
      method: 'Własna',
      source: 'fitebo-continue',
      fromFitebo: true,
      duration: 8,
      days: [
        {
          day: 'D1 (A)',
          exercises: [
            { name: 'Ściąganie drążka wyciągu górnego do klatki', sets: '4', reps: '8', kg: '96' },
            { name: 'Wiosłowanie sztangą w opadzie tułowia', sets: '4', reps: '8', kg: '49.5' }
          ]
        }
      ]
    }];
    window.SE = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-rad');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.screenshot({ path: path.join(shotDir, 'profile_before_live.png') });
  await page.click('#cp-drawer button.btn-primary:has-text("Trening Live")');
  await page.waitForSelector('#screen-live.active');
  await page.waitForFunction(() => {
    const hid = document.getElementById('live-client-sel');
    const vis = document.getElementById('live-client-sel-search');
    const panel = document.getElementById('live-exercises-panel');
    const txt = (panel && panel.textContent) || '';
    return hid && hid.value === 'c-rad'
      && vis && /Radosław/.test(vis.value || '')
      && !/Wybierz klienta i plan/.test(txt);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(shotDir, 'live_after_profile_start.png') });

  const state = await page.evaluate(() => {
    const hid = document.getElementById('live-client-sel');
    const vis = document.getElementById('live-client-sel-search');
    const panel = document.getElementById('live-exercises-panel');
    const picker = document.getElementById('live-plan-picker');
    return {
      liveActive: !!document.getElementById('screen-live')?.classList.contains('active'),
      drawerOpen: !!document.getElementById('cp-drawer')?.classList.contains('open'),
      clientId: hid ? hid.value : '',
      clientName: vis ? vis.value : '',
      panel: (panel && panel.textContent) || '',
      picker: (picker && picker.textContent) || '',
      pending: window._livePending || null,
      startEnabled: (() => {
        const btn = document.getElementById('live-start-btn');
        return !!(btn && !btn.disabled && btn.style.display !== 'none');
      })()
    };
  });

  ok('left profile for live', state.liveActive && !state.drawerOpen);
  ok('client selected immediately', state.clientId === 'c-rad' && /Radosław/.test(state.clientName), JSON.stringify({ id: state.clientId, name: state.clientName }));
  ok('pending consumed', !state.pending);
  ok('not empty picker', /Kontynuacja Fitebo/.test(state.picker), state.picker.slice(0, 180));
  ok('not empty exercises', /Ściąganie drążka|PLAN TRENINGU|Wiosłowanie/.test(state.panel) && !/Wybierz klienta i plan/.test(state.panel), state.panel.slice(0, 180));
  ok('start enabled with plan', state.startEnabled, JSON.stringify({ startEnabled: state.startEnabled }));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-rad', { tab: 'plan' });
  });
  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cp-drawer button:has-text("Trenuj teraz")');
  await page.waitForSelector('#screen-live.active');
  await page.waitForFunction(() => (document.getElementById('live-client-sel') || {}).value === 'c-rad');
  const fromPlan = await page.evaluate(() => {
    const hid = document.getElementById('live-client-sel');
    const panel = document.getElementById('live-exercises-panel');
    return {
      clientId: hid ? hid.value : '',
      panel: (panel && panel.textContent) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_after_plan_train.png') });
  ok('plan tab Trenuj teraz keeps client', fromPlan.clientId === 'c-rad' && !/Wybierz klienta i plan/.test(fromPlan.panel));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-rad');
  });
  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cp-drawer button:has-text("Wiadomość")');
  await page.waitForSelector('#screen-inbox.active');
  await page.waitForFunction(() => /Radosław/.test((document.getElementById('msg-to') || {}).textContent || ''));
  await page.waitForTimeout(400);
  const inbox = await page.evaluate(() => ({
    to: (document.getElementById('msg-to') || {}).textContent || '',
    drawerOpen: !!document.getElementById('cp-drawer')?.classList.contains('open')
  }));
  await page.screenshot({ path: path.join(shotDir, 'inbox_after_profile_message.png') });
  ok('wiadomość opens that client chat', /Radosław/.test(inbox.to) && !inbox.drawerOpen, JSON.stringify(inbox));

  await page.evaluate(() => {
    window.confirm = () => false;
    try {
      localStorage.removeItem('pl_live_draft');
      localStorage.removeItem('pl_live_draft_b');
    } catch (e) {}
    window._livePending = null;
    const st = typeof liveRef === 'function' ? liveRef(0) : null;
    if (st) {
      st.clientId = null;
      st.planId = null;
      st.exercises = [];
      st.sessionActive = false;
      st.savedClientId = null;
    }
    if (typeof liveClientSetField === 'function') liveClientSetField('', '', true, 0);
    if (typeof renderLivePlanPicker === 'function') renderLivePlanPicker(0);
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#screen-live.active');
  const empty = await page.evaluate(() => {
    const btn = document.getElementById('live-start-btn');
    const hid = document.getElementById('live-client-sel');
    const panel = document.getElementById('live-exercises-panel');
    return {
      disabled: !!(btn && btn.disabled),
      title: (btn && btn.title) || '',
      clientId: hid ? hid.value : '',
      panel: (panel && panel.textContent) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_empty_start_disabled.png') });
  ok('empty live disables start', empty.disabled && !empty.clientId && /Wybierz klienta/.test(empty.panel + empty.title), JSON.stringify(empty));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll cp-start-live UI tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
