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
      { name: 'Przysiad Goblet', done: false, collapsed: false,
        lastDate: '2026-08-10',
        lastSets: [
          { setNo: 1, kg: '20', reps: '12', rir: '2' },
          { setNo: 2, kg: '22.5', reps: '10', rir: '1' }
        ],
        sets: [
        { setNo: 1, kg: '6', reps: '12', rir: '2', done: false },
        { setNo: 2, kg: '6', reps: '12', rir: '2', done: false },
        { setNo: 3, kg: '6', reps: '12', rir: '2', done: false },
        { setNo: 4, kg: '6', reps: '12', rir: '3', done: false }
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
  const rirUi = await page.evaluate(() => {
    const head = document.querySelector('#live-ex-0 .live-set-head');
    const inp = document.querySelector('#live-ex-0 .live-rir-input');
    return { head: head ? head.innerText : '', val: inp ? inp.value : '', n: document.querySelectorAll('#live-ex-0 .live-rir-input').length };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_rir_column.png') });
  ok('rir column in live', /RIR/.test(rirUi.head) && rirUi.n === 4 && rirUi.val === '2', JSON.stringify(rirUi));
  const lastUi = await page.evaluate(() => {
    const box = document.querySelector('#live-ex-0 .live-last-sets');
    const sum = box && box.querySelector('summary');
    const rows = box ? box.querySelectorAll('.live-last-row').length : 0;
    return { has: !!box, text: sum ? sum.innerText : '', rows };
  });
  ok('last sets preview', lastUi.has && /20 × 12/.test(lastUi.text) && /22\.5 × 10/.test(lastUi.text) && lastUi.rows === 2, JSON.stringify(lastUi));
  const delUi = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('#live-ex-0 .live-set-del')];
    return { n: btns.length, disabled: btns.filter(b => b.disabled).length };
  });
  ok('delete buttons on sets', delUi.n === 4 && delUi.disabled === 0, JSON.stringify(delUi));
  await page.evaluate(() => { if (typeof liveRemoveSet === 'function') liveRemoveSet(0, 3); });
  const afterDel = await page.evaluate(() => ({
    rows: document.querySelectorAll('#live-ex-0 .live-set-row').length,
    sets: (window.liveExercises[0].sets || []).map(s => s.setNo)
  }));
  await page.screenshot({ path: path.join(shotDir, 'live_set_deleted.png') });
  ok('removed last set → 3', afterDel.rows === 3 && JSON.stringify(afterDel.sets) === '[1,2,3]', JSON.stringify(afterDel));
  await page.evaluate(() => {
    if (typeof liveRemoveSet === 'function') {
      liveRemoveSet(0, 0);
      liveRemoveSet(0, 0);
    }
  });
  const lastSet = await page.evaluate(() => {
    if (typeof liveRemoveSet === 'function') liveRemoveSet(0, 0);
    const btns = [...document.querySelectorAll('#live-ex-0 .live-set-del')];
    return {
      n: (window.liveExercises[0].sets || []).length,
      disabled: btns.length > 0 && btns.every(b => b.disabled)
    };
  });
  ok('cannot drop last set', lastSet.n === 1 && lastSet.disabled === true, JSON.stringify(lastSet));
  await page.evaluate(() => {
    window.liveExercises[0].sets = [
      { setNo: 1, kg: '6', reps: '12', rir: '2', done: false },
      { setNo: 2, kg: '6', reps: '12', rir: '2', done: false },
      { setNo: 3, kg: '6', reps: '12', rir: '2', done: false },
      { setNo: 4, kg: '6', reps: '12', rir: '3', done: false }
    ];
    window.liveExercises[0].done = false;
    window.liveExercises[0].collapsed = false;
    if (typeof renderLiveExercises === 'function') renderLiveExercises();
  });

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
      logged: adh && adh.logged,
      rir: liveSess && liveSess.exercises && liveSess.exercises[0] && liveSess.exercises[0].sets && liveSess.exercises[0].sets[0] && liveSess.exercises[0].sets[0].rir
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_progress_saved.png') });
  ok('session saved as live', saved.source === 'live' && saved.n >= 1, JSON.stringify(saved));
  ok('saved 4 sets / 288 kg', saved.sets === 4 && saved.volume === 288, JSON.stringify(saved));
  ok('Progress logged day = 1', saved.logged === 1, JSON.stringify(saved));
  ok('saved rir', saved.rir === '2', JSON.stringify(saved));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-progress UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
