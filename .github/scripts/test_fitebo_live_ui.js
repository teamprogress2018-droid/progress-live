// UI: Live z planem Fitebo pokazuje ćwiczenia z importu i hipertrofię RIR 2.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.FITEBO_LIVE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-fitebo-live'));
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
    window.CL = [{
      id: 'c-rad',
      name: 'Radosław Jarząb',
      goal: 'masa',
      level: 'poczatkujacy',
      status: 'active',
      weight: 82,
      height: 178,
      age: 34
    }];
    window.PL = [{
      id: 'p-fb',
      clientId: 'c-rad',
      name: 'Plan z Fitebo',
      method: 'PPL',
      source: 'fitebo',
      fromFitebo: true,
      duration: 4,
      days: [
        {
          day: 'Trening B (Push)',
          muscles: 'Push',
          exercises: [
            { name: 'Burpees', sets: '4', reps: '8', rest: '45s' },
            { name: 'Mountain climbers', sets: '3', reps: '30s', rest: '30s' },
            { name: 'Deska', sets: '3', reps: '40s', rest: '30s' }
          ]
        }
      ]
    }];
    window.SE = [{
      id: 's-fb', clientId: 'c-rad', date: '2026-09-08', type: 'Trening B (Push)', source: 'fitebo',
      notes: 'Zaimportowano z Fitebo',
      exercises: [
        { name: 'Wyciskanie hantli', sets: '4', reps: '8-10', kg: 22.5 },
        { name: 'Wyciskanie na maszynie skos+', sets: '4', reps: '8-10', kg: 40 }
      ]
    }];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('live');
    if (typeof liveClientSetField === 'function') liveClientSetField('c-rad', 'Radosław Jarząb', true, 0);
    if (typeof liveSelectPlan === 'function') liveSelectPlan('p-fb', 0);
    if (typeof renderLivePlanPicker === 'function') renderLivePlanPicker(0);
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
  });

  await page.waitForSelector('.live-ex-card');
  await page.screenshot({ path: path.join(shotDir, 'live_fitebo_hyp.png') });

  const info = await page.evaluate(() => {
    const panel = (document.getElementById('live-exercises-panel') || {}).innerText || '';
    const names = [...document.querySelectorAll('.live-ex-card')].map(el => (el.innerText || '').split('\n').slice(0, 4).join(' | '));
    const week = (document.querySelector('.live-week-hint') || {}).textContent || '';
    const rows = [...document.querySelectorAll('#live-period-sched .live-period-row')].map(el => (el.textContent || '').replace(/\s+/g, ' ').trim());
    const rir = [...document.querySelectorAll('.live-rir-input')].map(el => el.value || el.getAttribute('placeholder') || '');
    return { names, week, rows, rir, panel: panel.slice(0, 800) };
  });

  ok('fitebo press not burpees', /Wyciskanie hantli/.test(info.panel) && !/Burpees/i.test(info.panel), JSON.stringify(info.names) + ' | ' + info.panel.slice(0, 300));
  ok('period is hypertrophy', /Hipertrofia/.test(info.week + info.rows.join(' ')) && !/Adaptacja — nauka wzorców/.test(info.week + info.rows.join(' ')), info.week + ' | ' + info.rows[0]);
  ok('rir 2 on sets', info.rir.some(v => String(v).trim() === '2'), JSON.stringify(info.rir.slice(0, 6)));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll fitebo-live UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
