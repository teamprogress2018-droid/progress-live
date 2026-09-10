// UI: zadanie domowe bez YouTube (timer) + RPE/czas do Postępów.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.HW_GUIDE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-hw-guide'));
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
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html?nocache=hwguide', { waitUntil: 'domcontentloaded' });
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
    window.CL = [{ id: 'c1', name: 'Piotr Urbaniak', status: 'active' }];
    window.TASKS = [];
    window.SE = [];
    if (typeof ensureODWorkouts === 'function') ensureODWorkouts();
    if (typeof goTo === 'function') goTo('ondemand');
  });

  await page.waitForSelector('#odw-rounds', { state: 'attached' });
  const form = await page.evaluate(() => ({
    rounds: !!document.getElementById('odw-rounds'),
    work: !!document.getElementById('odw-work'),
    title: ((document.querySelector('#m-od-workout .modal-title') || {}).textContent || '')
  }));
  ok('trainer form has rounds', form.rounds && form.work, JSON.stringify(form));
  ok('modal title not youtube-only', /NOWY TRENING/i.test(form.title), form.title);

  await page.evaluate(() => {
    if (typeof openODWorkout === 'function') openODWorkout('ow21');
  });
  await page.waitForSelector('#od-guide');
  await page.waitForTimeout(200);
  const guide = await page.evaluate(() => {
    const g = document.getElementById('od-guide');
    const start = document.getElementById('od-guide-start');
    return {
      shown: !!g,
      text: g ? g.innerText : '',
      start: start ? start.textContent : '',
      iframe: !!document.querySelector('#od-guide iframe, #od-player-frame')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'hw_guide_player.png') });
  ok('guide player shown', guide.shown && /Bez filmu/i.test(guide.text), guide.text.slice(0, 120));
  ok('guide has start', /Start/i.test(guide.start), guide.start);
  ok('guide has no youtube iframe', !guide.iframe);

  await page.click('#od-guide-start');
  await page.waitForTimeout(300);
  const running = await page.evaluate(() => {
    const clock = document.getElementById('od-guide-clock');
    const phase = (document.getElementById('od-guide-phase') || {}).textContent || '';
    return { work: !!(clock && clock.classList.contains('is-work')), phase };
  });
  await page.screenshot({ path: path.join(shotDir, 'hw_guide_running.png') });
  ok('timer running work', running.work && /Praca/i.test(running.phase), JSON.stringify(running));

  await page.evaluate(() => {
    if (typeof closeODPlayer === 'function') closeODPlayer();
    if (typeof assignHomeworkToClient === 'function') assignHomeworkToClient('c1', 'ow21', { notify: false });
    window._clientAppMode = true;
    window._clientId = 'c1';
    window._clientLiveScreen = 'homework';
    document.body.classList.add('client-app-mode');
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const live = document.getElementById('screen-clientlive');
    if (live) live.classList.add('active');
    if (typeof renderClientLive === 'function') renderClientLive();
  });
  await page.waitForSelector('#clive-bn-homework');
  const hwCard = await page.evaluate(() => (document.getElementById('clive-screen-content') || {}).innerText || '');
  await page.screenshot({ path: path.join(shotDir, 'hw_client_card.png') });
  ok('client homework card', /HIIT 16 min/i.test(hwCard) && /RPE i czas/i.test(hwCard), hwCard.slice(0, 200));

  await page.evaluate(() => {
    const t = (window.TASKS || [])[0];
    if (t && typeof clientCompleteHomework === 'function') clientCompleteHomework(t.id);
  });
  await page.waitForSelector('#m-hw-done.show, #m-hw-done.modal-ov.show, #hw-done-min');
  await page.evaluate(() => {
    if (typeof pickHomeworkRpe === 'function') pickHomeworkRpe(8);
    const min = document.getElementById('hw-done-min');
    if (min) min.value = '16';
    if (typeof saveHomeworkDone === 'function') saveHomeworkDone();
  });
  await page.waitForTimeout(400);
  const done = await page.evaluate(() => {
    const t = (window.TASKS || [])[0];
    const sess = (window.SE || []).find((s) => s && s.source === 'homework');
    const text = (document.getElementById('clive-screen-content') || {}).innerText || '';
    return {
      status: t && t.status,
      rpe: t && t.rpe,
      sess: !!(sess && sess.rpe === '8' && sess.duration === 16),
      progress: /Zadania domowe/i.test(text) && /RPE 8/.test(text)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'hw_progress_rpe.png') });
  ok('task marked done', done.status === 'done' && done.rpe === '8', JSON.stringify(done));
  ok('session in SE', done.sess);
  ok('progress shows rpe', done.progress, JSON.stringify(done));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll homework-guide UI checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
