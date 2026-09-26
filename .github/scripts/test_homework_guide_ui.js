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
  // This feature test supplies authenticated storage below. A real auth observer
  // must not replace the fixture session or send test records to production.
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://localhost:' + port + '/index.html?nocache=hwguide', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window._uid = 'hw-ui-trainer';
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._clientAppMode = false;
    window._db = { fixture: 'homework-guide' };
    window.__hwGuideDocs = new Map();
    window._doc = (_db, collection, id) => ({ collection, id });
    window._getDoc = async ref => {
      const data = window.__hwGuideDocs.get(ref.collection + '/' + ref.id);
      const owner = window._clientAppMode ? window._trainerId : window._uid;
      if (!data || data.trainerId !== owner || (window._clientAppMode && data.clientId !== window._clientId)) {
        throw Object.assign(new Error('Document is not visible to this account'), { code: 'permission-denied' });
      }
      return { id: ref.id, exists: () => true, data: () => JSON.parse(JSON.stringify(data)) };
    };
    window.persistById = async (collection, entry) => {
      withTrainer(entry);
      const owner = window._clientAppMode ? window._trainerId : window._uid;
      if (!owner || entry.trainerId !== owner || (window._clientAppMode && entry.clientId !== window._clientId)) return null;
      const id = typeof tenantDocumentId === 'function' ? tenantDocumentId(collection, entry, owner) : (entry._fbId || entry.id);
      const data = JSON.parse(JSON.stringify(entry));
      delete data._fbId;
      window.__hwGuideDocs.set(collection + '/' + id, data);
      entry._fbId = id;
      return entry;
    };
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', trainerId: 'hw-ui-trainer', name: 'Piotr Urbaniak', status: 'active' }];
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
    window._uid = 'hw-ui-client';
    window.tenantSessionGeneration++;
    window._clientAppMode = true;
    window._clientId = 'c1';
    window._trainerId = 'hw-ui-trainer';
    window._clientAccount = { uid: 'hw-ui-client', role: 'client', clientId: 'c1', trainerId: 'hw-ui-trainer' };
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
  await page.waitForFunction(() => (window.TASKS || []).some(t => t.kind === 'homework' && t.status === 'done'));
  const done = await page.evaluate(() => {
    const t = (window.TASKS || [])[0];
    const sess = (window.SE || []).find((s) => s && s.source === 'homework');
    const text = (document.getElementById('clive-screen-content') || {}).innerText || '';
    return {
      status: t && t.status,
      rpe: t && t.rpe,
      sess: !!(sess && sess.rpe === '8' && sess.duration === 16),
      persisted: !!(t && sess && window.__hwGuideDocs.get('tasks/' + t.id)?.status === 'done' && window.__hwGuideDocs.get('sessions/' + sess.id)?.rpe === '8'),
      ownership: !!(t && sess && t.trainerId === 'hw-ui-trainer' && sess.trainerId === 'hw-ui-trainer' && sess.clientId === 'c1'),
      progress: /Zadania domowe/i.test(text) && /RPE 8/.test(text)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'hw_progress_rpe.png') });
  ok('task marked done', done.status === 'done' && done.rpe === '8', JSON.stringify(done));
  ok('session in SE', done.sess);
  ok('task and history confirmed in owned storage', done.persisted && done.ownership, JSON.stringify(done));
  ok('progress shows rpe', done.progress, JSON.stringify(done));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll homework-guide UI checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
