// Podgląd planu: długie nazwy dni (AI FBW) nie mogą nachodzić na listę ćwiczeń.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const screenshotPath = process.env.PLAN_PREVIEW_SHOT || path.join(require('os').tmpdir(), 'plan-preview-layout.png');
const expectOverlap = process.env.PLAN_PREVIEW_EXPECT_OVERLAP === '1';

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');

if (!expectOverlap) {
  ok('day name is not 34px wide', !/\.plan-day-name\{[^}]*width:\s*34px/.test(css));
  ok('plan-day-row is block', /\.plan-day-row\{display:\s*block/.test(css));
  ok('plan-ex-line exists', css.includes('.plan-ex-line'));
  ok('expanded card spans grid', css.includes('.plan-card.is-open'));
  ok('preview helper exists', builder.includes('function planDayPreviewHtml'));
  ok('toggle adds is-open', /classList\.toggle\('is-open'/.test(builder));
}

if (!expectOverlap) {
  const documentStub = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [],
  document: documentStub
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date,
  Math,
  parseInt,
  parseFloat,
  Number,
  String,
  Array,
  Object,
  JSON,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

const { formatDayExerciseParts, formatDayExerciseLines } = ctx;

eqArray(
  'parts stay stacked',
  formatDayExerciseParts([
    { name: 'Przysiad ze sztangą', sets: 4, reps: '8-10' },
    { name: 'Wyciskanie sztangi leżąc', sets: 4, reps: '8-10' }
  ]),
  ['Przysiad ze sztangą 4×8-10', 'Wyciskanie sztangi leżąc 4×8-10']
);
ok(
  'legacy join still uses middot',
  formatDayExerciseLines([
    { name: 'Przysiad ze sztangą', sets: 4, reps: '8-10' },
    { name: 'Wyciskanie sztangi leżąc', sets: 4, reps: '8-10' }
  ]) === 'Przysiad ze sztangą 4×8-10 · Wyciskanie sztangi leżąc 4×8-10'
);
}

function eqArray(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got));
}

const SAMPLE_PLAN = {
  id: 'plan-fbw-rado',
  name: 'FBW Masa – Radosław 8 tygodni',
  clientId: 'c-rado',
  clientName: 'Radosław',
  method: 'FBW',
  duration: 8,
  updatedAt: '2026-08-18T12:00:00.000Z',
  days: [
    {
      day: 'Dzień A – Full Body (siła + hipertrofia)',
      muscles: 'Dzień A – Full Body (siła + hipertrofia)',
      exercises: [
        { name: 'Przysiad ze sztangą', sets: 4, reps: '8-10' },
        { name: 'Wyciskanie sztangi leżąc', sets: 4, reps: '8-10' },
        { name: 'Wiosłowanie sztangą w opadzie', sets: 4, reps: '8-10' },
        { name: 'Wyciskanie żołnierskie', sets: 3, reps: '10-12' },
        { name: 'Uginanie ramion ze sztangą', sets: 3, reps: '10-12' },
        { name: 'Prostowanie ramion na wyciągu', sets: 3, reps: '12-15' }
      ]
    },
    {
      day: 'Dzień B – Full Body (objętość + tył)',
      muscles: 'Dzień B – Full Body (objętość + tył)',
      exercises: [
        { name: 'Martwy ciąg rumuński', sets: 4, reps: '8-10' },
        { name: 'Wykroki ze sztangą', sets: 3, reps: '10' },
        { name: 'Podciąganie / ściąganie drążka', sets: 4, reps: '8-10' },
        { name: 'Wyciskanie hantli na skosie', sets: 3, reps: '10-12' },
        { name: 'Face pull', sets: 3, reps: '15' }
      ]
    }
  ]
};

(async () => {
  const port = process.env.PLAN_PREVIEW_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.PLAN_PREVIEW_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  await page.evaluate((plan) => {
    window.persistById = async (_col, obj) => obj;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c-rado', name: 'Radosław' }];
    window.PL = [
      plan,
      { id: 'plan-ppl', name: 'PPL 3x – Budowa masy', clientId: 'c-rado', method: 'PPL', duration: 6, days: [{ day: 'Push' }, { day: 'Pull' }, { day: 'Legs' }] },
      { id: 'plan-hiit', name: 'HIIT Spalacz', clientId: 'c-rado', method: 'HIIT', duration: 4, days: [{ day: 'HIIT A' }, { day: 'HIIT B' }] }
    ];
    goTo('plans');
  }, SAMPLE_PLAN);

  await page.waitForSelector('#plan-toggle-plan-fbw-rado');
  await page.click('#plan-toggle-plan-fbw-rado');
  await page.waitForSelector('#plan-detail-plan-fbw-rado >> .plan-day-row');
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const overlap = (a, b) => !(a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5 || a.right <= b.left + 0.5 || a.left >= b.right - 0.5);
    const card = document.getElementById('plan-card-plan-fbw-rado');
    const detail = document.getElementById('plan-detail-plan-fbw-rado');
    const rows = [...document.querySelectorAll('#plan-detail-plan-fbw-rado .plan-day-row')];
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        height: r.height,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        overflow: el.scrollWidth > el.clientWidth + 1
      };
    };
    const overlaps = [];
    const boxes = rows.map((row, ri) => {
      const name = row.querySelector('.plan-day-name');
      const nameBox = box(name);
      const lines = [...row.querySelectorAll('.plan-ex-line')].map(box);
      const others = [...row.querySelectorAll('div, span')].filter((el) => el !== name && !name.contains(el) && !el.contains(name));
      others.forEach((el) => {
        const b = box(el);
        if (!b || b.width < 2 || b.height < 2) return;
        if (nameBox && overlap(nameBox, b)) overlaps.push('day ' + ri + ': "' + nameBox.text + '" overlaps "' + b.text + '"');
      });
      if (nameBox && nameBox.overflow) overlaps.push('day ' + ri + ' title overflows its box');
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].top + 0.5 < lines[i - 1].bottom) overlaps.push('day ' + ri + ' exercise lines are not stacked');
      }
      return { name: nameBox, lines, focus: box(row.querySelector('.plan-day-focus')) };
    });
    return {
      open: !!(card && card.classList.contains('is-open')),
      button: (document.getElementById('plan-toggle-plan-fbw-rado') || {}).textContent,
      visibleText: (detail || {}).innerText || '',
      boxes,
      overlaps
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: false });
  await browser.close();

  const overlaps = metrics.overlaps || [];

  if (expectOverlap) {
    ok('pre-fix overlap reproduced', overlaps.length > 0, JSON.stringify(overlaps));
  } else {
    ok('expanded card is open', metrics.open);
    ok('button says Ukryj', /Ukryj/.test(metrics.button || ''));
    ok('day A title visible', metrics.visibleText.includes('Dzień A – Full Body'));
    ok('squat line visible', metrics.visibleText.includes('Przysiad ze sztangą'));
    ok('bench line visible', metrics.visibleText.includes('Wyciskanie sztangi leżąc'));
    ok('day B title visible', metrics.visibleText.includes('Dzień B – Full Body'));
    ok('two day rows', metrics.boxes.length >= 2);
    ok('day A has stacked exercises', (metrics.boxes[0].lines || []).length >= 4);
    ok('no overlapping preview text', overlaps.length === 0, overlaps.join('; '));
  }

  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nPodgląd planu: layout OK. Screenshot: ' + screenshotPath);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
