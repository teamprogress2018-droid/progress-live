#!/usr/bin/env node
'use strict';
/** Etap 6D: UI Progress czyta wyłącznie window._cpExerciseProgress (bez ponownej klasyfikacji). */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');
const progressFn = extras.slice(extras.indexOf('function renderCPProgress'), extras.indexOf('window.renderCPProgress'));
const capFn = portal.slice(portal.indexOf('function capClientProgressScreenHTML'), portal.indexOf('window.capClientProgressScreenHTML'));
const viewSrc = coreSrc.slice(coreSrc.indexOf('function exerciseProgressClassViewHtml'), coreSrc.indexOf('window.exerciseProgressClassViewHtml'));
const readSrc = coreSrc.slice(coreSrc.indexOf('function readStoredExerciseProgress'), coreSrc.indexOf('window.readStoredExerciseProgress'));
const panelSrc = coreSrc.slice(coreSrc.indexOf('function cpExerciseProgressPanelHtml'), coreSrc.indexOf('window.cpExerciseProgressPanelHtml'));
const openSrc = coreSrc.slice(coreSrc.indexOf('function openExerciseHistory'), coreSrc.indexOf('window.openExerciseHistory'));
const classifySrc = coreSrc.slice(coreSrc.indexOf('function classifyExerciseProgress'), coreSrc.indexOf('window.classifyExerciseProgress'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=121'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=79'));
ok('cache styles', html.includes('styles.css?v=109'));
ok('CI', wf.includes('test_ex_progress_ui.js'));
ok('view helper', /function exerciseProgressClassViewHtml/.test(coreSrc)
  && /function readStoredExerciseProgress/.test(coreSrc)
  && /function cpExerciseProgressPanelHtml/.test(coreSrc));
ok('progress inserts panel', /cpExerciseProgressPanelHtml\(c\.id\)/.test(progressFn)
  && /rememberClientExerciseProgress\(c\.id\)/.test(progressFn));
ok('client portal no trainer analysis', !/cpExerciseProgressPanelHtml/.test(capFn)
  && !/exerciseProgressClassViewHtml/.test(capFn));
ok('view does not classify', !/classifyExerciseProgress/.test(viewSrc)
  && !/classifyExerciseProgress/.test(readSrc)
  && !/classifyExerciseProgress/.test(panelSrc)
  && !/classifyExerciseProgress/.test(openSrc));
ok('view reads store', /window\._cpExerciseProgress/.test(readSrc)
  && /window\._cpExerciseProgress/.test(panelSrc)
  && /readStoredExerciseProgress/.test(openSrc));
ok('view does not rebuild series', !/exerciseProgressSeries/.test(viewSrc)
  && !/exerciseProgressSeries/.test(readSrc)
  && !/exerciseProgressSeries/.test(panelSrc)
  && !/exerciseProgressSeries/.test(openSrc)
  && !/exerciseLoadHistory/.test(viewSrc)
  && !/exerciseLoadHistory/.test(panelSrc));
ok('classifier body untouched labels', /ZA MAŁO DANYCH/.test(classifySrc)
  && /PROGRES/.test(classifySrc)
  && /REGRES/.test(classifySrc)
  && /STABILNIE/.test(classifySrc));
ok('css analysis box', /\.ex-prog-box/.test(styles) && /\.ex-prog-reasons/.test(styles));

const histBody = { innerHTML: '' };
const histTitle = { textContent: '' };
const dummyEl = { classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, querySelector() { return null; }, querySelectorAll() { return []; } };
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: id => {
    if (id === 'ex-hist-body') return histBody;
    if (id === 'ex-hist-title') return histTitle;
    return dummyEl;
  },
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

const {
  classifyExerciseProgress, rememberClientExerciseProgress, readStoredExerciseProgress,
  exerciseProgressClassViewHtml, cpExerciseProgressPanelHtml, openExerciseHistory
} = ctx;

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

function has(htmlStr, re) {
  return re.test(htmlStr);
}

function assertView(name, item, checks) {
  const htmlStr = exerciseProgressClassViewHtml(item);
  checks.forEach(([title, re, want]) => {
    const got = has(htmlStr, re);
    ok(name + ' ' + title, got === want, got ? htmlStr.slice(0, 180) : 'missing ' + re);
  });
  return htmlStr;
}

windowObj.SE = [
  bench('s1', '2026-09-01', 80, 10, '2'),
  bench('s2', '2026-09-08', 82.5, 10, '2')
];
const remembered = rememberClientExerciseProgress('c1');
ok('store filled by remember', windowObj._cpExerciseProgress === remembered);
const stored = readStoredExerciseProgress('c1', 'Wyciskanie sztangi');
ok('store lookup by name', stored && stored.classification && stored.classification.label === 'PROGRES');

let classifyCalls = 0;
const origClassify = ctx.classifyExerciseProgress;
ctx.classifyExerciseProgress = function wrappedClassify() {
  classifyCalls++;
  return origClassify.apply(this, arguments);
};
windowObj.classifyExerciseProgress = ctx.classifyExerciseProgress;

const progresHtml = exerciseProgressClassViewHtml(stored);
ok('view after store does not classify', classifyCalls === 0);
ok('progres label', has(progresHtml, />PROGRES</) && has(progresHtml, /data-ex-prog-class="PROGRES"/));
ok('progres confidence', has(progresHtml, /Pewność: średnia/));
ok('progres reasons list', has(progresHtml, /<ul class="ex-prog-reasons">/) && has(progresHtml, /<li>/));
ok('progres no plateau', !/Plateau:/.test(progresHtml));
ok('progres no flags row', !/Flagi:/.test(progresHtml));

const panel = cpExerciseProgressPanelHtml('c1');
ok('panel reads store', classifyCalls === 0);
ok('panel compact badge', /Analiza ćwiczeń/.test(panel) && /cp-ex-prog-row/.test(panel) && />PROGRES</.test(panel));
ok('panel wrong client empty', /Brak analizy/.test(cpExerciseProgressPanelHtml('other')));

histBody.innerHTML = '';
openExerciseHistory({ clientId: 'c1', name: 'Wyciskanie sztangi', history: [{ date: '2026-09-08', sets: [{ kg: 82.5, reps: 10, kind: 'work' }] }] });
ok('modal uses store without classify', classifyCalls === 0);
ok('modal prepends analysis', histBody.innerHTML.trimStart().indexOf('<div class="ex-prog-box"') === 0 && /data-ex-prog-class="PROGRES"/.test(histBody.innerHTML));
ok('modal keeps history tables', /ex-hist-table/.test(histBody.innerHTML) || /ex-hist-sess/.test(histBody.innerHTML) || /82\.5/.test(histBody.innerHTML));

windowObj.SE = [
  bench('s1', '2026-09-01', 80, 10, '2'),
  bench('s2', '2026-09-08', 80, 10, '2'),
  bench('s3', '2026-09-15', 80, 10, '2'),
  bench('s4', '2026-09-22', 80, 10, '2')
];
rememberClientExerciseProgress('c1');
const stable = readStoredExerciseProgress('c1', 'Wyciskanie sztangi');
const stableHtml = assertView('stabilnie', stable, [
  ['label', />STABILNIE</, true],
  ['plateau', /Plateau: tak/, true],
  ['confidence', /Pewność: wysoka/, true],
  ['flags', /Flagi: zapas RIR/, true],
  ['reasons', /<ul class="ex-prog-reasons">/, true]
]);

windowObj.SE = [
  bench('s1', '2026-09-01', 80, 10, ''),
  bench('s2', '2026-09-08', 77.5, 10, ''),
  bench('s3', '2026-09-15', 75, 10, '2')
];
rememberClientExerciseProgress('c1');
const regres = readStoredExerciseProgress('c1', 'Wyciskanie sztangi');
const regresHtml = assertView('regres', regres, [
  ['label', />REGRES</, true],
  ['no plateau', /Plateau:/, false],
  ['confidence', /Pewność: wysoka/, true],
  ['reasons', /<ul class="ex-prog-reasons">/, true]
]);

windowObj.SE = [bench('s1', '2026-09-01', 80, 10, '2')];
rememberClientExerciseProgress('c1');
const thin = readStoredExerciseProgress('c1', 'Wyciskanie sztangi');
const thinHtml = assertView('za malo', thin, [
  ['label', />ZA MAŁO DANYCH</, true],
  ['no plateau', /Plateau:/, false],
  ['confidence', /Pewność: niska/, true],
  ['no flags', /Flagi:/, false],
  ['reasons', /<ul class="ex-prog-reasons">/, true]
]);

ok('direct classify still works', classifyExerciseProgress({ snapshots: [] }).label === 'ZA MAŁO DANYCH');

console.log('\n===== Przykłady renderowania =====');
console.log('\n--- PROGRES ---\n' + progresHtml);
console.log('\n--- STABILNIE ---\n' + stableHtml);
console.log('\n--- REGRES ---\n' + regresHtml);
console.log('\n--- ZA MAŁO DANYCH ---\n' + thinHtml);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nUI klasyfikacji w Progress: OK.');
process.exit(0);
