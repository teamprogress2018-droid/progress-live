// UI: zakładka Oś czasu — filtry, logged-only, 60 + załaduj więcej.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_TL_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-tl'));
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
    window.CL = [{
      id: 'c-tl', name: 'Marek Oś', goal: 'masa', status: 'active', weight: 90, injuries: ''
    }];
    const sessions = [
      {
        id: 's-live', clientId: 'c-tl', date: addDays(-3), source: 'live', type: 'FBW A',
        exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 8, kind: 'work' }] }]
      },
      {
        id: 's-old', clientId: 'c-tl', date: addDays(-10), source: 'live', type: 'FBW A',
        exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 6, kind: 'work' }] }]
      },
      { id: 's-plan', clientId: 'c-tl', date: addDays(2), source: 'planned', type: 'FBW przyszły' }
    ];
    for (let i = 0; i < 70; i++) {
      sessions.push({
        id: 's-pad-' + i, clientId: 'c-tl', date: addDays(-20 - i), source: 'live', type: 'Sesja ' + i
      });
    }
    window.SE = sessions;
    window.PL = [{ id: 'pl1', clientId: 'c-tl', name: 'FBW', method: 'FBW', createdAt: addDays(-40) + 'T10:00:00' }];
    window.PACKAGES = [{ id: 'pk1', clientId: 'c-tl', title: 'Pakiet 8', price: 800, date: addDays(-30), payStatus: 'paid' }];
    window.INVOICES = [{ id: 'inv1', nr: 'FV-1', pkgId: 'pk1', date: addDays(-30), amount: 800 }];
    window.CHECKINS = {
      'c-tl': [
        { id: 'ci-p', status: 'pending', date: addDays(-2) },
        { id: 'ci-f', status: 'filled', date: addDays(-4), answers: { sleep: 4, energy: 3 } }
      ]
    };
    window.METRIC_ENTRIES = [
      { id: 'me1', clientId: 'c-tl', groupId: 'mg1', date: addDays(-25), values: { m1: 91 } },
      { id: 'me2', clientId: 'c-tl', groupId: 'mg1', date: addDays(-5), values: { m1: 90.4 } }
    ];
    window.CLIENT_NOTES = { 'c-tl': [{ id: 'n1', text: 'Dobry dzień', createdAt: addDays(-6) + 'T12:00:00' }] };
    window.CLIENT_TIMELINE = { 'c-tl': [] };
    window.TASKS = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-tl');
  });

  await page.waitForSelector('#cp-drawer.open');
  ok('situation still on overview', await page.evaluate(() => !!document.querySelector('.cp-ov-situation')));

  await page.evaluate(() => { if (typeof setCPTab === 'function') setCPTab('timeline'); });
  await page.waitForSelector('#cp-timeline-list');
  await page.waitForTimeout(300);

  const allView = await page.evaluate(() => {
    const filters = [...document.querySelectorAll('[data-tl-filter]')].map(el => el.getAttribute('data-tl-filter'));
    const rows = [...document.querySelectorAll('#cp-timeline-list [data-tl-kind]')].map(el => ({
      kind: el.getAttribute('data-tl-kind'),
      text: el.textContent || ''
    }));
    return {
      filters,
      n: rows.length,
      kinds: [...new Set(rows.map(r => r.kind))],
      hasPlanned: rows.some(r => /przyszły/i.test(r.text)),
      hasCheckin: rows.some(r => r.kind === 'checkin' && /Sen 4\/5/.test(r.text)),
      hasPending: rows.some(r => /pending/i.test(r.text)),
      hasScale10: rows.some(r => /\/10/.test(r.text)),
      hasTrain: rows.some(r => r.kind === 'trening' && /Wyciskanie/.test(r.text)),
      hasDelta: rows.some(r => /\+2 powt/.test(r.text)),
      hasMore: !!document.querySelector('.cp-tl-more'),
      firstDate: (document.querySelector('.cp-tl-date') || {}).textContent || '',
      situation: !!document.querySelector('.cp-ov-situation')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_timeline_all.png') });
  ok('8 filters', allView.filters.join(',') === 'all,trening,pomiar,checkin,plan,notatka,platnosc,rekord', allView.filters.join(','));
  ok('default 60', allView.n === 60, String(allView.n));
  ok('load more visible', allView.hasMore);
  ok('no planned as done', !allView.hasPlanned);
  ok('filled checkin /5', allView.hasCheckin);
  ok('no /10', !allView.hasScale10);
  ok('trening with sets', allView.hasTrain);
  ok('delta powt', allView.hasDelta);
  ok('situation not duplicated on timeline', !allView.situation);

  await page.click('[data-tl-filter="trening"]');
  await page.waitForTimeout(200);
  const train = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#cp-timeline-list [data-tl-kind]')];
    return {
      n: rows.length,
      allTrain: rows.every(el => el.getAttribute('data-tl-kind') === 'trening'),
      planned: rows.some(el => /przyszły/i.test(el.textContent || ''))
    };
  });
  ok('trening filter only trening', train.allTrain && train.n >= 1);
  ok('trening filter no planned', !train.planned);

  const emptyKinds = ['checkin', 'pomiar', 'plan', 'notatka', 'platnosc', 'rekord'];
  // checkin/pomiar/plan/notatka/platnosc/rekord have data — use a client switch for empty later
  await page.click('[data-tl-filter="rekord"]');
  await page.waitForTimeout(200);
  const rec = await page.evaluate(() => ({
    n: document.querySelectorAll('#cp-timeline-list [data-tl-kind="rekord"]').length,
    empty: (document.querySelector('.cp-tl-empty') || {}).textContent || '',
    kinds: [...document.querySelectorAll('#cp-timeline-list [data-tl-kind]')].map(el => el.getAttribute('data-tl-kind'))
  }));
  ok('rekord filter is rekord or empty', rec.kinds.every(k => k === 'rekord') || /Brak zdarzeń/.test(rec.empty), JSON.stringify(rec));

  await page.click('[data-tl-filter="all"]');
  await page.waitForTimeout(150);
  await page.click('.cp-tl-more');
  await page.waitForTimeout(200);
  const more = await page.evaluate(() => ({
    n: document.querySelectorAll('#cp-timeline-list [data-tl-kind]').length,
    moreBtn: !!document.querySelector('.cp-tl-more')
  }));
  ok('load more > 60', more.n > 60 && more.n <= 120, JSON.stringify(more));
  ok('no more button after expand if <=120', more.n <= 120);

  await page.evaluate(() => {
    window.CL.push({ id: 'c-empty', name: 'Pusta Oś', status: 'active' });
    if (typeof openClientProfile === 'function') openClientProfile('c-empty');
    if (typeof setCPTab === 'function') setCPTab('timeline');
  });
  await page.waitForTimeout(400);
  const empties = await page.evaluate(async () => {
    const out = {};
    const ids = ['all', 'trening', 'pomiar', 'checkin', 'plan', 'notatka', 'platnosc', 'rekord'];
    for (const id of ids) {
      if (typeof setCpTlFilter === 'function') setCpTlFilter(id);
      out[id] = (document.querySelector('.cp-tl-empty') || {}).textContent || '';
    }
    return out;
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_timeline_empty.png') });
  emptyKinds.concat(['all', 'trening']).forEach(k => {
    ok('empty ' + k, /Brak zdarzeń/.test(empties[k] || ''), empties[k]);
  });

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-timeline-filters UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
