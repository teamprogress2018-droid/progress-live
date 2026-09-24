// UI: Przegląd — zapisy vs plan, statusy dni, etykiety.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_LOGS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-logs'));
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
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const saver = document.getElementById('screensaver');
    if (saver) saver.style.display = 'none';
    const ymd = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    const addDays = n => {
      const d = new Date(ymd + 'T12:00:00');
      d.setDate(d.getDate() + n);
      const p = x => String(x).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };
    const start = addDays(-11);
    window.CL = [{
      id: 'c-logs',
      name: 'Piotr Plan',
      goal: 'sila',
      level: 'sredni',
      status: 'active',
      trainingFreq: 3,
      inviteSent: true,
      createdAt: start,
      lastName: 'Plan',
      phone: '500100200',
      age: 34,
      height: 180
    }];
    window.PL = [{
      id: 'pl-4x',
      clientId: 'c-logs',
      clientName: 'Piotr Plan',
      name: 'FBW Siła',
      method: 'FBW',
      duration: 8,
      createdAt: start + 'T10:00:00',
      days: [
        { day: 'Pon', muscles: 'Klatka, Triceps, Czworogłowe' },
        { day: 'Wt', muscles: 'Plecy, Biceps' },
        { day: 'Czw', muscles: 'Nogi' },
        { day: 'Pt', muscles: 'Barki' }
      ]
    }];
    window.SE = [
      { id: 'p1', clientId: 'c-logs', date: addDays(-9), source: 'planned', type: 'A', planId: 'pl-4x', dayIdx: 0 },
      { id: 'p2', clientId: 'c-logs', date: addDays(-8), source: 'planned', type: 'B', planId: 'pl-4x', dayIdx: 1 },
      { id: 'p3', clientId: 'c-logs', date: addDays(-6), source: 'planned', type: 'C', planId: 'pl-4x', dayIdx: 2 },
      { id: 'p4', clientId: 'c-logs', date: addDays(-5), source: 'planned', type: 'D', planId: 'pl-4x', dayIdx: 3 }
    ];
    window.PACKAGES = [{ id: 'pk16', clientId: 'c-logs', title: 'Pakiet 16', sessions: 16, sessionsUsed: 0, payStatus: 'paid', status: 'active' }];
    window.CHECKINS = { 'c-logs': [{ id: 'ci1', status: 'pending', date: addDays(-12) }] };
    window.METRIC_ENTRIES = [];
    window.TASKS = [];
    window.CLIENT_NOTES = { 'c-logs': [] };
    window.getClientOnboard = () => ({
      invite: true, baseline: false, schedule: true, plan: true, calendar: true, session: true, package: true,
      done: 5, total: 6, complete: false
    });
    if (typeof openClientProfile === 'function') openClientProfile('c-logs');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('.cp-ov-situation');
  const empty = await page.evaluate(() => {
    const next = [...document.querySelectorAll('[data-cp-next]')].map(el => ({
      kind: el.getAttribute('data-cp-next'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim()
    }));
    const train = document.querySelector('[data-cp-sit="train"]');
    const checkin = document.querySelector('[data-cp-sit="checkin"]');
    const days = [...document.querySelectorAll('.cp-ov-week-day')].map(el => ({
      wd: (el.querySelector('.cp-ov-week-wd') || {}).textContent || '',
      name: (el.querySelector('.cp-ov-week-name') || {}).textContent || '',
      st: (el.querySelector('.cp-ov-week-st') || {}).textContent || '',
      today: el.classList.contains('is-today'),
      nolog: el.classList.contains('is-nolog')
    }));
    const wo = document.getElementById('cp-ov-card-train');
    const missing = document.querySelector('[data-cp-missing]');
    const note = document.querySelector('.cp-ov-rail-card');
    const notes = [...document.querySelectorAll('.cp-ov-rail-card')].map(el => el.textContent || '');
    return {
      next,
      trainN: ((train || {}).querySelector && (train.querySelector('.cp-ov-sit-n') || {}).textContent) || '',
      trainHint: ((train || {}).querySelector && (train.querySelector('.cp-ov-sit-hint') || {}).textContent) || '',
      trainTone: train ? [...train.classList].filter(c => c.startsWith('cp-ov-sit-tile-')).join(' ') : '',
      checkinLbl: ((checkin || {}).querySelector && (checkin.querySelector('.cp-ov-sit-lbl') || {}).textContent) || '',
      checkinHint: ((checkin || {}).querySelector && (checkin.querySelector('.cp-ov-sit-hint') || {}).textContent) || '',
      days,
      woText: (wo && wo.textContent) || '',
      addWo: !!(wo && [...wo.querySelectorAll('button')].some(b => /Dodaj trening/.test(b.textContent || ''))),
      remind: !!(wo && /Przypomnij o treningu/.test(wo.textContent || '')),
      askAll: !!(missing && /Poproś o wszystko/.test(missing.textContent || '')),
      fivePopros: missing ? (missing.textContent.match(/Poproś/g) || []).length : 0,
      hasAppCopy: missing ? /Uzupełni klient/.test(missing.textContent || '') && !/po zaproszeniu/.test(missing.textContent || '') : false,
      notesCopy: notes.some(t => /Widoczna tylko dla Ciebie/.test(t)),
      onboard: (document.querySelector('[data-cp-alert="onboard"]') || null) && (document.querySelector('[data-cp-alert="onboard"]').textContent || ''),
      pkg: ((document.querySelector('[data-cp-pkg="1"]') || {}).textContent || '')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_overview_logs_empty.png') });

  ok('nolog rec shown', empty.next.some(x => x.kind === 'nolog' && /Nie ma zapisanych treningów/.test(x.text)), JSON.stringify(empty.next));
  ok('no 3x rec', !empty.next.some(x => /3 treningi/.test(x.text)) && !empty.next.some(x => x.kind === 'adherence'), JSON.stringify(empty.next));
  ok('no red 0/4', !/0\/4/.test(empty.trainN) && empty.trainTone !== 'cp-ov-sit-tile-act', empty.trainN + ' ' + empty.trainTone);
  ok('train hint empty log', /brak zapisanych/.test(empty.trainHint), empty.trainHint);
  ok('add workout in list', empty.addWo);
  ok('no remind jargon', !empty.remind && !/Live, apka/.test(empty.woText));
  ok('check-in copy', /Check-in/.test(empty.checkinLbl) && /brak od/.test(empty.checkinHint), empty.checkinLbl + ' ' + empty.checkinHint);
  ok('accent titles', empty.days.some(d => /akcent: klatka/.test((d.name || '').toLowerCase())), JSON.stringify(empty.days));
  ok('weekday line', empty.days.every(d => d.wd), JSON.stringify(empty.days));
  ok('today framed', empty.days.filter(d => d.today).every(d => d.st === 'Dziś') && empty.days.some(d => d.today), JSON.stringify(empty.days));
  ok('past not done without log', empty.days.filter(d => d.nolog).every(d => d.st === 'Niezapisany'), JSON.stringify(empty.days));
  ok('ask all once', empty.askAll && empty.fivePopros <= 1, String(empty.fivePopros));
  ok('has app no invite wording', empty.hasAppCopy);
  ok('notes private', empty.notesCopy);
  ok('onboard hidden or measurements', !empty.onboard || /Brakuje pomiarów/.test(empty.onboard), empty.onboard || '');
  ok('package labeled', /16 sesji/.test(empty.pkg), empty.pkg);

  await page.evaluate(() => {
    const ymd = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    const d = new Date(ymd + 'T12:00:00');
    d.setDate(d.getDate() - 3);
    const p = x => String(x).padStart(2, '0');
    const past = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    window.SE.push({ id: 'live1', clientId: 'c-logs', date: past, source: 'live', type: 'A', planId: 'pl-4x', dayIdx: 0 });
    if (typeof openClientProfile === 'function') openClientProfile('c-logs');
  });
  await page.waitForTimeout(400);
  const withLog = await page.evaluate(() => {
    const next = [...document.querySelectorAll('[data-cp-next]')].map(el => ({
      kind: el.getAttribute('data-cp-next'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim()
    }));
    const train = document.querySelector('[data-cp-sit="train"]');
    return {
      next,
      trainTone: train ? [...train.classList].filter(c => c.startsWith('cp-ov-sit-tile-')).join(' ') : '',
      trainN: ((train || {}).querySelector && (train.querySelector('.cp-ov-sit-n') || {}).textContent) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_overview_logs_with_log.png') });
  ok('adh rec uses 4 not 3', !withLog.next.some(x => /3 treningi/.test(x.text)), JSON.stringify(withLog.next));
  ok('in-week not red', withLog.trainTone !== 'cp-ov-sit-tile-act', withLog.trainTone + ' ' + withLog.trainN);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-overview-logs UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
