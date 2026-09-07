// UI: Live dual — dwie osoby, niezależne serie / przerwa / zapis.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_DUAL_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-dual'));
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
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.confirm = () => true;
    window.notify = () => {};
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [
      { id: 'c1', name: 'Justyna Chylińska' },
      { id: 'c2', name: 'Anna Kowalska' }
    ];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-dual-btn');

  const before = await page.evaluate(() => {
    const pane = document.getElementById('live-pane-1');
    const sc = document.getElementById('screen-live');
    return {
      dual: sc && sc.classList.contains('live-dual'),
      paneDisplay: pane ? getComputedStyle(pane).display : 'missing',
      btn: (document.getElementById('live-dual-btn') || {}).textContent
    };
  });
  ok('solo hides pane 2', before.paneDisplay === 'none' && !before.dual, JSON.stringify(before));

  await page.click('#live-dual-btn');
  await page.waitForTimeout(100);

  const dualOn = await page.evaluate(() => {
    const pane = document.getElementById('live-pane-1');
    const sc = document.getElementById('screen-live');
    return {
      dual: !!(sc && sc.classList.contains('live-dual')),
      paneDisplay: pane ? getComputedStyle(pane).display : 'missing',
      btn: (document.getElementById('live-dual-btn') || {}).textContent,
      pressed: (document.getElementById('live-dual-btn') || {}).getAttribute('aria-pressed'),
      searchB: !!(document.getElementById('live-b-client-sel-search'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_dual_on.png') });
  ok('dual class + pane 2', dualOn.dual && dualOn.paneDisplay === 'flex', JSON.stringify(dualOn));
  ok('button says 1 osoba', /1 osoba/.test(dualOn.btn || '') && dualOn.pressed === 'true');

  const afterSets = await page.evaluate(() => {
    if (typeof liveClientSetField === 'function') {
      liveClientSetField('c1', 'Justyna Chylińska', true, 0);
      liveClientSetField('c2', 'Anna Kowalska', true, 1);
    }
    const blocked = { ok: true };
    const prevNotify = window.notify;
    window.notify = (msg) => { blocked.msg = msg; };
    if (typeof liveClientSetField === 'function') liveClientSetField('c1', 'Justyna Chylińska', true, 1);
    window.notify = prevNotify;
    const ex = (name, kg) => ({
      name,
      done: false,
      collapsed: false,
      sets: [
        { setNo: 1, kg, reps: '10', done: false },
        { setNo: 2, kg, reps: '10', done: false }
      ]
    });
    window.liveExercises = [ex('Przysiad', '40')];
    if (window.liveB) window.liveB.exercises = [ex('Martwy ciąg', '50')];
    if (typeof renderLiveExercises === 'function') {
      renderLiveExercises(0);
      renderLiveExercises(1);
    }
    const named = {
      name: 'Przysiad na suwnicy (Hack Squat / maszyna)',
      gif: 'assets/ex/gifs/przysiad-hack-maszyna.gif',
      note: 'PRIORYTET czworogłowe+pośladki. Stopy wysoko — odciąża lędźwie.',
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '60', reps: '10', done: false }]
    };
    window.liveExercises = [named];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const card = document.getElementById('live-ex-0');
    const cap = card && card.querySelector('.cw-technique-cap');
    const media = {
      titleCount: card ? (card.textContent.match(/Przysiad na suwnicy/gi) || []).length : 0,
      capCount: card ? card.querySelectorAll('.cw-technique-cap').length : -1,
      capDisplay: cap ? getComputedStyle(cap).display : 'none',
      noteVisible: !!(card && /PRIORYTET czworogłowe/.test(card.textContent))
    };
    window.liveExercises = [ex('Przysiad', '40')];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    liveToggleSet(0, 0);
    liveToggleSet(0, 0, 1);
    liveStartRest(30);
    liveStartRest(90, 1);
    return {
      aEx: document.getElementById('live-ex-done').textContent,
      bEx: document.getElementById('live-b-ex-done').textContent,
      aSets: document.getElementById('live-sets-done').textContent,
      bSets: document.getElementById('live-b-sets-done').textContent,
      aRest: document.getElementById('live-rest-timer').textContent,
      bRest: document.getElementById('live-b-rest-timer').textContent,
      aClient: window.liveClientId,
      bClient: window.liveB && window.liveB.clientId,
      blocked: blocked.msg || '',
      sameGuard: /drugim ekranie/.test(blocked.msg || ''),
      media
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_dual_sets.png') });
  ok('independent set ticks', afterSets.aSets === '1' && afterSets.bSets === '1', JSON.stringify(afterSets));
  ok('rest timers differ', afterSets.aRest !== afterSets.bRest && /30/.test(afterSets.aRest) && /90/.test(afterSets.bRest), JSON.stringify({ a: afterSets.aRest, b: afterSets.bRest }));
  ok('clients A/B', afterSets.aClient === 'c1' && afterSets.bClient === 'c2', JSON.stringify(afterSets));
  ok('same client blocked', afterSets.sameGuard, afterSets.blocked);
  ok('live gif has no caption overlay', afterSets.media && afterSets.media.capCount === 0 && afterSets.media.titleCount === 1, JSON.stringify(afterSets.media));
  ok('coach note still visible', afterSets.media && afterSets.media.noteVisible, JSON.stringify(afterSets.media));

  const saved = await page.evaluate(() => {
    if (typeof liveStartSession === 'function') {
      liveStartSession(0);
      liveStartSession(1);
    }
    if (typeof liveEndSession === 'function') {
      liveEndSession(0);
      liveEndSession(1);
    }
    const se = window.SE || [];
    return {
      n: se.length,
      ids: se.map(s => s.clientId).sort().join(','),
      sources: se.map(s => s.source).join(','),
      sets: se.map(s => (s.exercises || []).reduce((n, e) => n + ((e.sets || []).length), 0))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_dual_saved.png') });
  ok('two live sessions saved', saved.n === 2 && saved.ids === 'c1,c2' && saved.sources === 'live,live', JSON.stringify(saved));
  ok('each saved 1 set', saved.sets[0] === 1 && saved.sets[1] === 1, JSON.stringify(saved.sets));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-dual UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
