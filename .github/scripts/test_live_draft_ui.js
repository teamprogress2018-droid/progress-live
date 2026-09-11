// UI: Start Live zapisuje szkic source live-draft; 3 serie → kolejny persist.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_DRAFT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-draft'));
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
    window.__persistLog = [];
    window.persistById = async (col, o) => { window.__persistLog.push({ col, source: o && o.source, id: o && o.id, sets: ((o && o.exercises) || []).flatMap(e => e.sets || []).filter(s => s && s.done).length }); return o; };
    window.notify = () => {};
    window.confirm = () => true;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const client = { id: 'c-anna', name: 'Anna Nowak', status: 'active' };
    if (Array.isArray(window.CL)) window.CL.splice(0, window.CL.length, client);
    else window.CL = [client];
    if (Array.isArray(window.SE)) window.SE.splice(0, window.SE.length);
    else window.SE = [];
    if (Array.isArray(window.PACKAGES)) window.PACKAGES.splice(0, window.PACKAGES.length);
    if (typeof goTo === 'function') goTo('live');
    if (typeof liveClientSetField === 'function') liveClientSetField('c-anna', 'Anna Nowak', false, 0);
    const st = typeof liveRef === 'function' ? liveRef(0) : null;
    if (st) {
      st.exercises = [{
        name: 'Przysiad', done: false,
        sets: [
          { setNo: 1, kg: 40, reps: 8, done: false },
          { setNo: 2, kg: 40, reps: 8, done: false },
          { setNo: 3, kg: 40, reps: 8, done: false },
          { setNo: 4, kg: 40, reps: 8, done: false }
        ]
      }];
    }
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    if (typeof liveStartSession === 'function') liveStartSession(0);
  });
  await page.waitForTimeout(250);
  const afterStart = await page.evaluate(() => {
    const st = typeof liveRef === 'function' ? liveRef(0) : {};
    const drafts = (window.SE || []).filter(s => s && s.source === 'live-draft');
    const log = (window.__persistLog || []).filter(x => x.col === 'sessions');
    let ls = null;
    try { ls = JSON.parse(localStorage.getItem('pl_live_draft') || 'null'); } catch (e) { ls = null; }
    return {
      active: !!(st && st.sessionActive),
      draftId: st && st.draftSessionId,
      seDrafts: drafts.length,
      persistDraft: log.filter(x => x.source === 'live-draft').length,
      lsClient: ls && ls.clientId
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_draft_start.png') });
  ok('session active', afterStart.active);
  ok('ls draft', afterStart.lsClient === 'c-anna', JSON.stringify(afterStart));
  ok('firestore draft on start', afterStart.persistDraft >= 1 && afterStart.seDrafts >= 1, JSON.stringify(afterStart));

  await page.evaluate(() => {
    if (typeof liveToggleSet === 'function') {
      liveToggleSet(0, 0, 0);
      liveToggleSet(0, 1, 0);
      liveToggleSet(0, 2, 0);
    }
  });
  await page.waitForTimeout(200);
  const afterSets = await page.evaluate(() => {
    const log = (window.__persistLog || []).filter(x => x.col === 'sessions' && x.source === 'live-draft');
    const st = typeof liveRef === 'function' ? liveRef(0) : {};
    return { n: log.length, lastSets: log.length ? log[log.length - 1].sets : 0, remoteSets: st.draftRemoteSets, sameId: log.every(x => x.id === log[0].id) };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_draft_sets.png') });
  ok('persist again at 3 sets', afterSets.n >= 2 && afterSets.lastSets >= 3, JSON.stringify(afterSets));
  ok('same draft id', afterSets.sameId, JSON.stringify(afterSets));

  const calHidden = await page.evaluate(() => {
    if (typeof calVisibleSessions !== 'function') return true;
    return calVisibleSessions().every(s => s.source !== 'live-draft');
  });
  ok('calendar hides draft', calHidden);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll live-draft UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
