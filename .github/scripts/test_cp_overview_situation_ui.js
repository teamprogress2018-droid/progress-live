// UI: Przegląd — nagłówek sytuacji i „Na kolejny trening” z faktów.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_SIT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-sit'));
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
    window.CL = [
      {
        id: 'c-sit',
        name: 'Jarosław Test',
        goal: 'masa',
        level: 'sredni',
        status: 'active',
        injuries: 'prawe kolano',
        weight: 82.4,
        height: 178,
        trainingFreq: 3
      },
      {
        id: 'c-ok',
        name: 'Anna Spokojna',
        goal: 'redukcja',
        status: 'active',
        injuries: '',
        weight: 62
      }
    ];
    window.SE = [
      {
        id: 's-old', clientId: 'c-sit', date: addDays(-12), source: 'live', type: 'FBW',
        exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 8, kind: 'work' }, { kg: 80, reps: 8, kind: 'work' }] }]
      },
      {
        id: 's-new', clientId: 'c-sit', date: addDays(-3), source: 'live', type: 'FBW',
        exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 60, reps: 6, kind: 'work' }] }]
      },
      { id: 's-plan1', clientId: 'c-sit', date: addDays(-5), source: 'planned', type: 'FBW' },
      { id: 's-plan2', clientId: 'c-sit', date: addDays(-2), source: 'planned', type: 'FBW' },
      { id: 's-ok1', clientId: 'c-ok', date: addDays(-1), source: 'live', type: 'FBW' }
    ];
    window.PL = [
      { id: 'pl-sit', clientId: 'c-sit', clientName: 'Jarosław Test', name: 'FBW', method: 'FBW', duration: 8, days: [{ day: 'A' }, { day: 'B' }] },
      { id: 'pl-ok', clientId: 'c-ok', clientName: 'Anna Spokojna', name: 'FBW' }
    ];
    window.PACKAGES = [{
      id: 'pk-sit', clientId: 'c-sit', clientName: 'Jarosław Test', title: 'Pakiet 8',
      expiresDate: addDays(3), status: 'active', payStatus: 'paid'
    }];
    window.CHECKINS = {
      'c-sit': [{ id: 'ci1', clientId: 'c-sit', status: 'pending', date: addDays(-10) }],
      'c-ok': [{ id: 'ci2', clientId: 'c-ok', status: 'filled', date: addDays(-1), score: 82, answers: { energy: 4, sleep: 4, stress: 2, nutrition: 4 } }]
    };
    window.TASKS = [{ id: 't1', clientId: 'c-sit', kind: 'homework', status: 'open', due: addDays(-4), title: 'Spacer' }];
    window.METRIC_ENTRIES = [
      { id: 'm1', clientId: 'c-sit', groupId: 'mg1', date: addDays(-28), values: { m1: 81.0 } },
      { id: 'm2', clientId: 'c-sit', groupId: 'mg1', date: ymd, values: { m1: 82.4 } },
      { id: 'm3', clientId: 'c-sit', groupId: 'mg5', date: addDays(-8), values: { m2: 7.4 } },
      { id: 'm4', clientId: 'c-sit', groupId: 'mg5', date: addDays(-1), values: { m2: 5.1 } }
    ];
    window.CLIENT_NOTES = window.CLIENT_NOTES || {};
    if (typeof openClientProfile === 'function') openClientProfile('c-sit');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('.cp-ov-situation');
  const busy = await page.evaluate(() => {
    const sit = document.querySelector('.cp-ov-situation');
    const next = [...document.querySelectorAll('[data-cp-next]')].map(el => ({
      kind: el.getAttribute('data-cp-next'),
      text: el.textContent || '',
      tone: [...el.classList].find(c => c.startsWith('cp-ov-next-') && c !== 'cp-ov-next-item') || ''
    }));
    const tiles = [...document.querySelectorAll('[data-cp-sit]')].map(el => ({
      id: el.getAttribute('data-cp-sit'),
      n: (el.querySelector('.cp-ov-sit-n') || {}).textContent || '',
      lbl: (el.querySelector('.cp-ov-sit-lbl') || {}).textContent || ''
    }));
    const train = document.getElementById('cp-ov-card-train');
    const metrics = document.getElementById('cp-ov-card-metrics');
    const tabs = [...document.querySelectorAll('.cp-tab')].map(el => (el.textContent || '').trim());
    return {
      hasSit: !!sit,
      title: (document.querySelector('.cp-ov-situation-title') || {}).textContent || '',
      kicker: (document.querySelector('.cp-ov-situation-kicker') || {}).textContent || '',
      pulse: !!document.querySelector('.cp-ov-situation .cp-ov-pulse'),
      nextHd: (document.querySelector('.cp-ov-next-hd') || {}).textContent || '',
      next,
    tiles,
    checkinHint: ((document.querySelector('[data-cp-sit="checkin"] .cp-ov-sit-hint') || {}).textContent || ''),
    hasTrain: !!(train && /Ostatnie 7 dni/.test(train.textContent || '')),
      hasMetrics: !!(metrics && /Pomiary ciała/.test((metrics.querySelector('.cp-ov-card-title') || {}).textContent || '')),
      tabs,
      editCta: !!document.querySelector('.cp-ov-edit-cta')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_overview_situation_signals.png'), fullPage: false });
  ok('situation visible', busy.hasSit);
  ok('kicker Sytuacja', busy.kicker === 'Sytuacja', busy.kicker);
  ok('title name + goal', /Jarosław Test/.test(busy.title) && /masy/i.test(busy.title), busy.title);
  ok('pulse inside situation', busy.pulse);
  ok('next header', /Na kolejny trening/.test(busy.nextHd), busy.nextHd);
  ok('injury bullet', busy.next.some(x => x.kind === 'injury' && /kolano/.test(x.text)), JSON.stringify(busy.next));
  ok('load drop bullet', busy.next.some(x => x.kind === 'load' && /volume/.test(x.text)), JSON.stringify(busy.next));
  ok('sleep bullet', busy.next.some(x => x.kind === 'sleep'), JSON.stringify(busy.next));
  ok('max 5 next', busy.next.length <= 5, String(busy.next.length));
  ok('no empty copy when signals', !busy.next.some(x => x.kind === 'ok'));
  ok('kpi tiles 5', busy.tiles.length === 5 && busy.tiles[0].id === 'train' && busy.tiles[2].id === 'mass', JSON.stringify(busy.tiles));
  ok('overdue checkin hint', /przeterminowany/.test(busy.checkinHint), busy.checkinHint);
  ok('existing train card', busy.hasTrain);
  ok('existing metrics card', busy.hasMetrics);
  ok('edit CTA remains', busy.editCta);
  ok('tabs still have Przegląd', busy.tabs.some(t => /Przegląd/i.test(t)), busy.tabs.join(','));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-ok');
  });
  await page.waitForTimeout(400);
  const calm = await page.evaluate(() => {
    const next = [...document.querySelectorAll('[data-cp-next]')].map(el => ({
      kind: el.getAttribute('data-cp-next'),
      text: el.textContent || ''
    }));
    return {
      title: (document.querySelector('.cp-ov-situation-title') || {}).textContent || '',
      next,
      hasSit: !!document.querySelector('.cp-ov-situation'),
      hasTrain: !!document.getElementById('cp-ov-card-train')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_overview_situation_ok.png') });
  ok('calm client situation', calm.hasSit && /Anna Spokojna/.test(calm.title));
  ok('calm jedź planem', calm.next.length === 1 && calm.next[0].kind === 'ok' && /jedź planem/.test(calm.next[0].text), JSON.stringify(calm.next));
  ok('calm still has train card', calm.hasTrain);

  await page.click('[data-cp-sit="train"]');
  await page.waitForTimeout(400);
  const focused = await page.evaluate(() => {
    const el = document.getElementById('cp-ov-card-train');
    return !!(el && el.classList.contains('dash-section-focus'));
  });
  ok('tile focuses train card', focused);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-overview-situation UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
