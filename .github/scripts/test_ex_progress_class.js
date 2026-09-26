#!/usr/bin/env node
'use strict';
/** Etap 6D: klasyfikator progresji ćwiczenia — przypadki 1–20 ze specyfikacji. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');
const progressFn = extras.slice(extras.indexOf('function renderCPProgress'), extras.indexOf('window.renderCPProgress'));
const capFn = portal.slice(portal.indexOf('function capClientProgressScreenHTML'), portal.indexOf('window.capClientProgressScreenHTML'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=126'));
ok('CI', wf.includes('test_ex_progress_class.js'));
ok('classify helper', /function classifyExerciseProgress/.test(coreSrc));
ok('no score helper', !/function scoreExerciseProgress/.test(coreSrc));
ok('classifier stays in core', !/function classifyExerciseProgress/.test(extras)
  && !/function classifyExerciseProgress/.test(portal)
  && !/classifyExerciseProgress/.test(client)
  && !/classifyExerciseProgress/.test(live)
  && !/classifyExerciseProgress/.test(html));
ok('progress remembers classes', /rememberClientExerciseProgress\(c\.id\)/.test(extras)
  && /rememberClientExerciseProgress\(c\.id\)/.test(portal));
ok('progress paints stored analysis', /cpExerciseProgressPanelHtml\(c\.id\)/.test(progressFn));
ok('client portal still no class paint', !/effortHarder|doseIncreased|reserveAvailable/.test(capFn)
  && !/cpExerciseProgressPanelHtml/.test(capFn));

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], DEF_EX: [], WO: [],
  METRIC_ENTRIES: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Map, Set, setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(coreSrc, ctx);

const { exerciseProgressSeries, classifyExerciseProgress } = ctx;

function sess(id, date, exercises) {
  return {
    id, clientId: 'c1', date, source: 'live', createdAt: date + 'T10:00:00',
    exercises
  };
}
function work(kg, reps, rir) {
  const row = { kg, reps, kind: 'work' };
  if (rir != null && rir !== '') row.rir = String(rir);
  return row;
}
function bench(id, date, kg, reps, rir, setCount) {
  const n = setCount == null ? 1 : setCount;
  const sets = [];
  for (let i = 0; i < n; i++) sets.push(work(kg, reps, rir));
  return sess(id, date, [{ name: 'Wyciskanie sztangi', sets }]);
}
function classifyName(name) {
  const series = exerciseProgressSeries('c1', name);
  const got = classifyExerciseProgress(series);
  if (series.label || series.plateau || series.progress) failed++, console.error('FAIL series mutated');
  return got;
}
function classifyBench() {
  return classifyName('Wyciskanie sztangi');
}
function fmt(v) {
  const flags = (v.flags || []).slice().sort();
  return v.label + ' | plateau=' + v.plateau + ' | [' + flags.join(',') + '] | ' + v.confidence;
}
function flagsEq(got, want) {
  const a = (got || []).slice().sort().join(',');
  const b = (want || []).slice().sort().join(',');
  return a === b;
}

const cases = [
  {
    n: 1,
    title: '80×10 @2 → 82.5×10 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 82.5, 10, '2')
      ];
    },
    want: { label: 'PROGRES', plateau: false, flags: [], confidence: 'medium' }
  },
  {
    n: 2,
    title: '80×10 @2 → 80×12 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 80, 12, '2')
      ];
    },
    want: { label: 'PROGRES', plateau: false, flags: [], confidence: 'medium' }
  },
  {
    n: 3,
    title: '80×10 @3 → 80×10 @1',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '3'),
        bench('s2', '2026-09-08', 80, 10, '1')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['effortHarder'], confidence: 'medium' }
  },
  {
    n: 4,
    title: '80×10 @1 → 80×10 @3',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '1'),
        bench('s2', '2026-09-08', 80, 10, '3')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['effortEasier'], confidence: 'medium' }
  },
  {
    n: 5,
    title: '80×10 @2 → 85×8 @1',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 85, 8, '1')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['mixed', 'effortHarder'], confidence: 'low' }
  },
  {
    n: 6,
    title: '80×10 @2 ×3',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 80, 10, '2'),
        bench('s3', '2026-09-15', 80, 10, '2')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: [], confidence: 'medium' }
  },
  {
    n: 7,
    title: '80×10 → 82.5×10 bez RIR',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, ''),
        bench('s2', '2026-09-08', 82.5, 10, null)
      ];
    },
    want: { label: 'PROGRES', plateau: false, flags: [], confidence: 'low' }
  },
  {
    n: 8,
    title: '3×80×10 @2 → 5×80×10 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2', 3),
        bench('s2', '2026-09-08', 80, 10, '2', 5)
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['doseIncreased'], confidence: 'medium' }
  },
  {
    n: 9,
    title: '80→82.5→85→80 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 82.5, 10, '2'),
        bench('s3', '2026-09-15', 85, 10, '2'),
        bench('s4', '2026-09-22', 80, 10, '2')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['dip'], confidence: 'high' }
  },
  {
    n: 10,
    title: '80→82.5→85→82.5 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 82.5, 10, '2'),
        bench('s3', '2026-09-15', 85, 10, '2'),
        bench('s4', '2026-09-22', 82.5, 10, '2')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['dip'], confidence: 'high' }
  },
  {
    n: 11,
    title: '80×10 @2 → 82.5×10 @0',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 82.5, 10, '0')
      ];
    },
    want: { label: 'PROGRES', plateau: false, flags: ['effortHarder', 'grind'], confidence: 'medium' }
  },
  {
    n: 12,
    title: '80×10 @0 → 85×9 @0',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '0'),
        bench('s2', '2026-09-08', 85, 9, '0')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['mixed', 'grind'], confidence: 'low' }
  },
  {
    n: 13,
    title: '82.5×10 @2 → 80×10 @3',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 82.5, 10, '2'),
        bench('s2', '2026-09-08', 80, 10, '3')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['effortEasier'], confidence: 'medium' }
  },
  {
    n: 14,
    title: '80×10 → 77.5×10 → 75×10 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, ''),
        bench('s2', '2026-09-08', 77.5, 10, ''),
        bench('s3', '2026-09-15', 75, 10, '2')
      ];
    },
    want: { label: 'REGRES', plateau: false, flags: [], confidence: 'high' }
  },
  {
    n: 15,
    title: 'jedna sesja 80×10',
    setup() {
      windowObj.SE = [bench('s1', '2026-09-01', 80, 10, '2')];
    },
    want: { label: 'ZA MAŁO DANYCH', plateau: false, flags: [], confidence: 'low' }
  },
  {
    n: 16,
    title: 'deska 45s → 60s',
    setup() {
      windowObj.SE = [
        sess('pl1', '2026-09-01', [{ name: 'Deska', loadUnit: 'sec', sets: [{ kg: 45, reps: 1, kind: 'work' }] }]),
        sess('pl2', '2026-09-08', [{ name: 'Deska', loadUnit: 'sec', sets: [{ kg: 60, reps: 1, kind: 'work' }] }])
      ];
    },
    classify() { return classifyName('Deska'); },
    want: { label: 'ZA MAŁO DANYCH', plateau: false, flags: [], confidence: 'low' }
  },
  {
    n: 17,
    title: '80×10 @2 ×4',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 80, 10, '2'),
        bench('s3', '2026-09-15', 80, 10, '2'),
        bench('s4', '2026-09-22', 80, 10, '2')
      ];
    },
    want: { label: 'STABILNIE', plateau: true, flags: ['reserveAvailable'], confidence: 'high' }
  },
  {
    n: 18,
    title: '80×10 @0 ×4',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '0'),
        bench('s2', '2026-09-08', 80, 10, '0'),
        bench('s3', '2026-09-15', 80, 10, '0'),
        bench('s4', '2026-09-22', 80, 10, '0')
      ];
    },
    want: { label: 'STABILNIE', plateau: true, flags: ['nearLimit'], confidence: 'high' }
  },
  {
    n: 19,
    title: '80×10 @2 → 82.5×9 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 82.5, 9, '2')
      ];
    },
    want: { label: 'STABILNIE', plateau: false, flags: ['mixed'], confidence: 'low' }
  },
  {
    n: 20,
    title: '80×10 @2 → 80×11 @2 → 82.5×10 @2',
    setup() {
      windowObj.SE = [
        bench('s1', '2026-09-01', 80, 10, '2'),
        bench('s2', '2026-09-08', 80, 11, '2'),
        bench('s3', '2026-09-15', 82.5, 10, '2')
      ];
    },
    want: { label: 'PROGRES', plateau: false, flags: [], confidence: 'high' }
  }
];

ok('20 cases defined', cases.length === 20);

const rows = [];
cases.forEach(c => {
  windowObj.SE = [];
  c.setup();
  const got = c.classify ? c.classify() : classifyBench();
  const pass = got.label === c.want.label
    && got.plateau === c.want.plateau
    && flagsEq(got.flags, c.want.flags)
    && got.confidence === c.want.confidence
    && Array.isArray(got.reasons) && got.reasons.length > 0;
  if (!pass) {
    failed++;
    console.error('FAIL case ' + c.n + ' ' + c.title);
    console.error('  want: ' + fmt(c.want));
    console.error('  got:  ' + fmt(got));
    console.error('  reasons: ' + JSON.stringify(got.reasons));
  } else {
    console.log('OK   case ' + c.n);
  }
  rows.push({ n: c.n, title: c.title, want: c.want, got, pass });
});

console.log('\n===== 6D przypadki 1–20 =====');
console.log('nr  wynik oczekiwany                                  wynik silnika                                      PASS/FAIL');
rows.forEach(r => {
  const a = fmt(r.want);
  const b = fmt(r.got);
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(String(r.n).padStart(2) + '  ' + a.padEnd(52) + '  ' + b.padEnd(52) + '  ' + mark);
});
const nPass = rows.filter(r => r.pass).length;
console.log('\n' + nPass + '/' + rows.length + ' PASS');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nKlasyfikator progresji ćwiczenia: OK.');
process.exit(0);
