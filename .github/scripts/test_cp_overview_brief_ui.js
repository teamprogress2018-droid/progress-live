// UI: Przegląd — Brief przed treningiem nad SYTUACJĄ.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_BRIEF_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-brief'));
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
        id: 'c-brief',
        name: 'Anna Brief',
        goal: 'masa',
        status: 'active',
        injuries: 'kolano P — bez przysiadu ze sztangą',
        notes: 'prywatna uwaga nie do briefu'
      },
      { id: 'c-new', name: 'Nowy Klient', goal: '', status: 'active', injuries: '', notes: 'ukryte notes' }
    ];
    window.PL = [{ id: 'pl1', clientId: 'c-brief', name: 'PPL siła', method: 'PPL', createdAt: addDays(-40) + 'T10:00:00' }];
    window.SE = [
      { id: 's-today', clientId: 'c-brief', date: ymd, time: '18:00', source: 'planned', type: 'Dzień B — Push', planId: 'pl1' },
      {
        id: 's-live', clientId: 'c-brief', date: addDays(-3), source: 'live', type: 'FBW A',
        exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 8, kind: 'work' }] }]
      },
      { id: 's-gar', clientId: 'c-brief', date: addDays(-1), source: 'garmin', type: 'Bieg 8 km' },
      { id: 's-draft', clientId: 'c-brief', date: ymd, source: 'live-draft', type: 'Szkic Live' }
    ];
    window.CHECKINS = {
      'c-brief': [
        { id: 'ci-p', status: 'pending', date: addDays(-1), answers: { energy: 1 } },
        { id: 'ci-f', status: 'filled', date: addDays(-2), answers: { sleep: 3, energy: 2, stress: 4 } }
      ],
      'c-new': []
    };
    window.CLIENT_NOTES = {
      'c-brief': [{ id: 'n1', text: 'Nie schodzić poniżej 90°', createdAt: addDays(-3) + 'T12:00:00' }],
      'c-new': []
    };
    window.TASKS = [{ id: 't1', clientId: 'c-brief', kind: 'homework', status: 'open', due: addDays(-5), title: 'Spacer 40 min' }];
    window.METRIC_ENTRIES = [];
    window.CLIENT_TIMELINE = { 'c-brief': [], 'c-new': [] };
    window.PACKAGES = [];
    window.INVOICES = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-brief');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('.cp-ov-brief');
  await page.waitForTimeout(200);

  const view = await page.evaluate(() => {
    const brief = document.querySelector('.cp-ov-brief');
    const sit = document.querySelector('.cp-ov-situation');
    const rows = [...document.querySelectorAll('.cp-ov-brief [data-cp-brief]')].map(el => ({
      kind: el.getAttribute('data-cp-brief'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim()
    }));
    const br = brief ? brief.getBoundingClientRect() : null;
    const sr = sit ? sit.getBoundingClientRect() : null;
    return {
      rows,
      kinds: rows.map(r => r.kind),
      briefBeforeSit: !!(br && sr && br.bottom <= sr.top + 2),
      sitKpis: !!document.querySelector('.cp-ov-sit-tile'),
      next: !!document.querySelector('.cp-ov-next'),
      briefTiles: brief ? brief.querySelectorAll('.cp-ov-sit-tile').length : -1,
      y: br && br.top
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_brief_nad_sytuacja.png') });

  ok('brief above situation', view.briefBeforeSit, JSON.stringify({ y: view.y, kinds: view.kinds }));
  ok('situation still there', view.sitKpis && view.next);
  ok('no kpi tiles in brief', view.briefTiles === 0);
  ok('order session then injury', view.kinds[0] === 'session' && view.kinds[1] === 'injury', view.kinds.join(','));
  ok('brief only session+injury', view.kinds.every(k => k === 'session' || k === 'injury'), view.kinds.join(','));
  ok('today session', view.rows.some(r => r.kind === 'session' && /Dzień B/.test(r.text) && /18:00/.test(r.text)));
  ok('injury visible', view.rows.some(r => r.kind === 'injury' && /kolano/.test(r.text)));
  ok('notes not injury', !view.rows.some(r => /prywatna uwaga/.test(r.text)));
  ok('checkin not duplicated in brief', !view.kinds.includes('checkin'));
  ok('workout not duplicated in brief', !view.kinds.includes('workout'));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-new');
  });
  await page.waitForTimeout(400);
  const empty = await page.evaluate(() => {
    const el = document.querySelector('.cp-ov-brief');
    const rows = [...document.querySelectorAll('.cp-ov-brief [data-cp-brief]')].map(n => n.getAttribute('data-cp-brief'));
    return {
      empty: (document.querySelector('.cp-ov-brief-empty') || {}).textContent || '',
      wrap: el ? el.getAttribute('data-cp-brief') : '',
      rows,
      sit: !!document.querySelector('.cp-ov-situation'),
      notesLeak: !!(el && /ukryte notes/.test(el.textContent || ''))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_brief_nowy_klient.png') });
  ok('new client one empty', /Brak danych do briefu/.test(empty.empty) && empty.wrap === 'empty' && empty.rows.length === 0, JSON.stringify(empty));
  ok('new client no notes leak', !empty.notesLeak);
  ok('situation remains for new', empty.sit);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-overview-brief UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
