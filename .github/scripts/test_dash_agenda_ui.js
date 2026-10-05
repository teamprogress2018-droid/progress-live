// ETAP 8: agenda dnia na pulpicie — kolejność godzin, ostatni trening, uwaga, START TRENINGU → Live z planem.
'use strict';
const path = require('path'), os = require('os'), fs = require('fs');
const { chromium } = require('playwright');
const shotDir = path.join(os.tmpdir(), 'pl-dash-agenda'); fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-06T05:30:00'));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderDashToday === 'function' && typeof dashClientBrief === 'function');
  const rows = await page.evaluate(() => {
    window._uid = 'dash-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window.tenantSessionGeneration = 1; window._db = { fixture: 1 };
    window.persistById = async (_c, o) => o; window.notify = () => {}; window.confirm = () => false;
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    const T = window._uid;
    window.CL = [
      { id: 'k', trainerId: T, name: 'Jan Kowalski', status: 'active' },
      { id: 'n', trainerId: T, name: 'Ewa Nowak', status: 'active', injuries: 'ból barku' },
      { id: 'w', trainerId: T, name: 'Ola Wiśniewska', status: 'active' }];
    window.PL = [
      { id: 'pk', trainerId: T, clientId: 'k', name: 'FBW', days: [{ day: 'A', exercises: [{ name: 'Przysiad', sets: '3', reps: '8-10', kg: '100' }] }, { day: 'B', exercises: [{ name: 'Martwy ciąg', sets: '3', reps: '5', kg: '120' }] }] },
      { id: 'pn', trainerId: T, clientId: 'n', name: 'Góra', days: [{ day: 'Góra', exercises: [{ name: 'Wyciskanie żołnierskie OHP', sets: '3', reps: '8', kg: '30' }] }] }];
    window.SE = [
      { id: 's17', trainerId: T, clientId: 'n', date: '2026-10-06', time: '17:00', source: 'planned', planId: 'pn', dayIdx: 0, type: 'Trening personalny' },
      { id: 's06', trainerId: T, clientId: 'k', date: '2026-10-06', time: '06:00', source: 'planned', planId: 'pk', dayIdx: 1, type: 'Trening personalny' },
      { id: 's13', trainerId: T, clientId: 'w', date: '2026-10-06', time: '13:00', source: 'planned', type: 'Trening personalny' },
      { id: 'h1', trainerId: T, clientId: 'k', date: '2026-10-02', source: 'live', planId: 'pk', dayIdx: 0, createdAt: '2026-10-02T06:50:00',
        exercises: [{ name: 'Przysiad', sets: [{ kg: '100', reps: '10', kind: 'work', done: true }, { kg: '102.5', reps: '8', kind: 'work', done: true }] }, { name: 'Wiosłowanie', sets: [{ kg: '60', reps: '10', done: true }] }] }];
    window.TASKS = []; window.PACKAGES = []; window.CHECKINS = {}; window.METRIC_ENTRIES = [];
    if (typeof goTo === 'function') goTo('dashboard');
    renderDashToday();
    return [...document.querySelectorAll('#d-today-sessions .dash-today-row')].map(r => ({
      name: (r.querySelector('.dash-today-name') || {}).innerText || '', meta: (r.querySelector('.dash-today-meta') || {}).innerText || '',
      last: (r.querySelector('[data-dash-last]') || {}).innerText || '', attn: (r.querySelector('[data-dash-attn]') || {}).innerText || '',
      start: !!r.querySelector('[data-dash-start]') }));
  });
  await page.screenshot({ path: path.join(shotDir, 'dash_agenda.png') });
  console.log(JSON.stringify(rows));
  ok('agenda ordered by time 06:00 → 13:00 → 17:00', rows.length === 3 && /06:00/.test(rows[0].meta) && /13:00/.test(rows[1].meta) && /17:00/.test(rows[2].meta), JSON.stringify(rows.map(r => r.meta)));
  ok('Kowalski: last workout with top set', /Ostatnio \(.*\): Przysiad 102,5×8 · \+1 ćw\./.test(rows[0].last), rows[0].last);
  ok('Wiśniewska: no history shown as first workout', rows[1].last === 'Pierwszy trening', rows[1].last);
  ok('Nowak: shoulder limit vs plan shown on the agenda', /ograniczeniem \(bark\)/.test(rows[2].attn), rows[2].attn);
  ok('every today row has START TRENINGU', rows.every(r => r.start));
  await page.click('#d-today-sessions .dash-today-row:first-child [data-dash-start]');
  await page.waitForTimeout(300);
  const live = await page.evaluate(() => ({ client: window.liveClientId, plan: window.livePlanId, day: window.liveCurrentDayIdx,
    ex: (window.liveExercises || []).map(e => e.name) }));
  ok('Start opens Live with client, plan and the calendar day (B: Martwy ciąg)', live.client === 'k' && live.plan === 'pk' && live.day === 1 && live.ex[0] === 'Martwy ciąg', JSON.stringify(live));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll dash agenda checks passed');
})().catch(e => { console.error(e); process.exit(1); });
