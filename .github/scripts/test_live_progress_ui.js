// UI: Live Postęp 0 bez odhaczeń → po seriach i zapisie wchodzi do Progress.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_PROGRESS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-progress'));
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
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.confirm = () => true;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Justyna Chylińska' }];
    window.SE = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-ex-done');

  await page.evaluate(() => {
    window.liveClientId = 'c1';
    window.liveExercises = [
      { name: 'Przysiad Goblet', done: false, collapsed: false, sets: [
        { setNo: 1, kg: '6', reps: '12', done: false },
        { setNo: 2, kg: '6', reps: '12', done: false },
        { setNo: 3, kg: '6', reps: '12', done: false },
        { setNo: 4, kg: '6', reps: '12', done: false }
      ]}
    ];
    window.liveSessionActive = false;
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });

  const before = await page.evaluate(() => ({
    ex: document.getElementById('live-ex-done').textContent,
    total: document.getElementById('live-ex-total').textContent,
    sets: document.getElementById('live-sets-done').textContent,
    vol: document.getElementById('live-volume').textContent,
    hint: (document.getElementById('live-progress-hint') || {}).textContent || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_progress_unchecked.png') });
  ok('unchecked 0/1 ćw', before.ex === '0' && before.total === '1', JSON.stringify(before));
  ok('unchecked 0 serii / 0 kg', before.sets === '0' && before.vol === '0');
  ok('hint says check sets', /Odhacz serie/.test(before.hint), before.hint);

  await page.evaluate(() => {
    if (typeof liveToggleSet === 'function') {
      liveToggleSet(0, 0);
      liveToggleSet(0, 1);
      liveToggleSet(0, 2);
      liveToggleSet(0, 3);
    }
  });

  const afterSets = await page.evaluate(() => ({
    ex: document.getElementById('live-ex-done').textContent,
    sets: document.getElementById('live-sets-done').textContent,
    vol: document.getElementById('live-volume').textContent
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_progress_checked.png') });
  ok('all sets → 1 ćw', afterSets.ex === '1', JSON.stringify(afterSets));
  ok('4 serie', afterSets.sets === '4');
  ok('volume 288', afterSets.vol === '288');

  await page.evaluate(() => {
    if (typeof liveStartSession === 'function') liveStartSession();
    if (typeof liveEndSession === 'function') liveEndSession();
  });

  const saved = await page.evaluate(() => {
    const se = (window.SE || []).filter(s => s && s.clientId === 'c1');
    const liveSess = se.find(s => s.source === 'live') || se[0] || null;
    const adh = typeof clientAdherenceStats === 'function' ? clientAdherenceStats('c1', 30) : null;
    return {
      n: se.length,
      source: liveSess && liveSess.source,
      sets: liveSess && (liveSess.exercises || []).reduce((n, e) => n + ((e.sets || []).length), 0),
      volume: liveSess && liveSess.volume,
      logged: adh && adh.logged
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_progress_saved.png') });
  ok('session saved as live', saved.source === 'live' && saved.n >= 1, JSON.stringify(saved));
  ok('saved 4 sets / 288 kg', saved.sets === 4 && saved.volume === 288, JSON.stringify(saved));
  ok('Progress logged day = 1', saved.logged === 1, JSON.stringify(saved));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-progress UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
