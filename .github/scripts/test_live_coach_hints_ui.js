// UI: Live pokazuje przerwę/tempo i harmonogram periodyzacji z planu.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_COACH_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-coach'));
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
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Ewelina', level: 'sredni', weight: 62, height: 168, age: 29, goal: 'redukcja' }];
    window.SE = [];
    window.PL = [{
      id: 'p-hiit',
      clientId: 'c1',
      name: 'HIIT + Siła A',
      level: 'sredni',
      progression: 'double',
      createdAt: '2026-08-25T10:00:00.000Z',
      days: [{
        day: 'PON',
        exercises: [
          { name: 'Przysiad Goblet', sets: '4', reps: '10', rest: '90s', tempo: '3-1-1-0', rpe: '8', kg: '16' },
          { name: 'Wyciskanie hantli leżąc', sets: '3', reps: '10', rest: '90s', tempo: '3-1-1-0', rpe: '8', kg: '12' }
        ]
      }]
    }];
    if (typeof goTo === 'function') goTo('live');
    const st = typeof liveRef === 'function' ? liveRef(0) : window.liveA;
    if (st) {
      st.clientId = 'c1';
      st.planId = 'p-hiit';
      st.currentDayIdx = 0;
      st.exercises = typeof liveMapPlanExercises === 'function' ? liveMapPlanExercises(window.PL[0].days[0].exercises, 0) : [];
    }
    if (typeof liveClientSetField === 'function') liveClientSetField('c1', 'Ewelina', true, 0);
    if (typeof renderLivePlanPicker === 'function') renderLivePlanPicker(0);
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
  });

  await page.waitForSelector('.live-ex-card');
  const info = await page.evaluate(() => {
    const card = document.querySelector('.live-ex-card');
    const chips = [...document.querySelectorAll('.live-coach-chip')].map((el) => (el.textContent || '').trim());
    const week = (document.querySelector('.live-week-hint') || {}).textContent || '';
    const period = document.getElementById('live-period-card');
    const rows = [...document.querySelectorAll('#live-period-sched .live-period-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
    const hint = (document.getElementById('live-rest-plan-hint') || {}).textContent || '';
    const planBtn = (document.getElementById('live-rest-plan-btn') || {}).textContent || '';
    return {
      chips,
      week,
      periodHidden: !!(period && period.hidden),
      rows,
      hint,
      planBtn,
      cardText: (card && card.innerText) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_coach_hints.png') });

  ok('przerwa chip', info.chips.some((c) => /Przerwa 90/.test(c)), JSON.stringify(info.chips));
  ok('praca chip', info.chips.some((c) => /Praca 50/.test(c)), JSON.stringify(info.chips));
  ok('tempo chip', info.chips.some((c) => /Tempo 3-1-1-0/.test(c)), JSON.stringify(info.chips));
  ok('week hint', /Tydz\.|DUP|Intensyfikacja|Akumulacja|Szczyt/.test(info.week), info.week);
  ok('period visible', !info.periodHidden);
  ok('4 weeks listed', info.rows.length === 4, JSON.stringify(info.rows));
  ok('akumulacja row', info.rows.some((r) => /Akumulacja/.test(r)), JSON.stringify(info.rows));
  ok('rest hint from plan', /90/.test(info.hint) || /90/.test(info.planBtn), info.hint + ' | ' + info.planBtn);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-coach-hints UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
