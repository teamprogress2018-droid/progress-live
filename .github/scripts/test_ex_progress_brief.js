#!/usr/bin/env node
'use strict';
/** Etap 7C: brief następnej sesji — T1–T20, C0–C5. */
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
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const briefStart = coreSrc.indexOf('function composeNextSessionProgress');
const briefEnd = coreSrc.indexOf('window.composeNextSessionProgress');
const briefSrc = briefStart >= 0 && briefEnd > briefStart ? coreSrc.slice(briefStart, briefEnd) : '';
const recStart = coreSrc.indexOf('function recommendExerciseProgress');
const recEnd = coreSrc.indexOf('window.recommendExerciseProgress');
const recSrc = recStart >= 0 && recEnd > recStart ? coreSrc.slice(recStart, recEnd) : '';
const aggStart = coreSrc.indexOf('function aggregateClientProgress');
const aggEnd = coreSrc.indexOf('window.aggregateClientProgress');
const aggSrc = aggStart >= 0 && aggEnd > aggStart ? coreSrc.slice(aggStart, aggEnd) : '';
const classifySrc = coreSrc.slice(
  coreSrc.indexOf('function classifyExerciseProgress'),
  coreSrc.indexOf('window.classifyExerciseProgress')
);
const seriesSrc = coreSrc.slice(
  coreSrc.indexOf('function exerciseProgressSeries'),
  coreSrc.indexOf('window.exerciseProgressSeries')
);
const rememberSrc = coreSrc.slice(
  coreSrc.indexOf('function rememberClientExerciseProgress'),
  coreSrc.indexOf('window.rememberClientExerciseProgress')
);
const progressFn = extras.slice(extras.indexOf('function renderCPProgress'), extras.indexOf('window.renderCPProgress'));
const capFn = portal.slice(portal.indexOf('function capClientProgressScreenHTML'), portal.indexOf('window.capClientProgressScreenHTML'));

const WHY = {
  C0: 'brak poprawnych rekomendacji 7B do briefu sesji',
  C1: 'za mało wiarygodnych akcji 7B, żeby złożyć sesję',
  C2: 'sesja nie jest do dokładania — jest cięcie, deload albo COFANIE',
  C3: 'co najmniej dwie akcje 7B dokładają powt. albo kg, bez deloadu i bez COFANIE',
  C4: 'brak sesyjnego dokładania kg; trzymam kurs albo pojedyncze powtórzenia',
  C5: 'akcje 7B idą w różne strony — nie ma jednej dyrektywy sesji'
};

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=121'));
ok('CI', wf.includes('test_ex_progress_brief.js') && wf.includes('1e0z6'));
ok('brief helper', /function composeNextSessionProgress/.test(coreSrc));
ok('brief stays in core', !/function composeNextSessionProgress/.test(extras)
  && !/function composeNextSessionProgress/.test(portal)
  && !/composeNextSessionProgress/.test(client)
  && !/composeNextSessionProgress/.test(live)
  && !/composeNextSessionProgress/.test(builder)
  && !/composeNextSessionProgress/.test(html));
ok('no UI wiring', !/composeNextSessionProgress/.test(progressFn)
  && !/composeNextSessionProgress/.test(capFn)
  && !/composeNextSessionProgress/.test(rememberSrc)
  && !/composeNextSessionProgress/.test(aggSrc)
  && !/composeNextSessionProgress/.test(recSrc));
ok('does not call 6C/6D/7A/7B', !/classifyExerciseProgress/.test(briefSrc)
  && !/exerciseProgressSeries/.test(briefSrc)
  && !/aggregateClientProgress/.test(briefSrc)
  && !/recommendExerciseProgress/.test(briefSrc)
  && !/window\.SE/.test(briefSrc)
  && !/parseRepRange/.test(briefSrc)
  && !/progressWorkingSet/.test(briefSrc)
  && !/e1RM/.test(briefSrc)
  && !/bestEpley/.test(briefSrc));
ok('no invented target', !/repMax/.test(briefSrc) && !/target/.test(briefSrc));
ok('C2(d) boolean', /nZmniejsz>=1&&nAdd===0/.test(briefSrc));
ok('7B body unchanged D16', /zadany strop powtórzeń osiągnięty przy RIR ≥ 2 i równych seriach/.test(recSrc)
  && /target!=null/.test(recSrc));
ok('7A body unchanged COFANIE', /nRegresSolid>=2&&nRegresSolid>nProgresSolid/.test(aggSrc));
ok('6D classifier unchanged', /consecutiveDown>=2/.test(classifySrc)
  && !/composeNextSessionProgress/.test(classifySrc)
  && !/composeNextSessionProgress/.test(seriesSrc));

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

const {
  composeNextSessionProgress,
  recommendExerciseProgress,
  aggregateClientProgress,
  classifyExerciseProgress
} = ctx;

let classifyCalls = 0, recCalls = 0, aggCalls = 0;
const origC = ctx.classifyExerciseProgress;
ctx.classifyExerciseProgress = function () { classifyCalls++; return origC.apply(this, arguments); };
windowObj.classifyExerciseProgress = ctx.classifyExerciseProgress;
const origR = ctx.recommendExerciseProgress;
ctx.recommendExerciseProgress = function () { recCalls++; return origR.apply(this, arguments); };
windowObj.recommendExerciseProgress = ctx.recommendExerciseProgress;
const origA = ctx.aggregateClientProgress;
ctx.aggregateClientProgress = function () { aggCalls++; return origA.apply(this, arguments); };
windowObj.aggregateClientProgress = ctx.aggregateClientProgress;

function rec(name, action, confidence) {
  const levers = {
    'ZA MAŁO DANYCH': { load: 'none', reps: 'none', dose: 'hold' },
    OBSERWUJ: { load: 'hold', reps: 'hold', dose: 'hold' },
    DELOAD: { load: 'deload', reps: 'hold', dose: 'hold' },
    'ZMNIEJSZ OBCIĄŻENIE': { load: 'down', reps: 'hold', dose: 'hold' },
    UTRZYMAJ: { load: 'hold', reps: 'hold', dose: 'hold' },
    'DODAJ POWTÓRZENIA': { load: 'hold', reps: 'up', dose: 'hold' },
    'DODAJ CIĘŻAR': { load: 'up', reps: 'hold', dose: 'hold' }
  }[action] || { load: 'hold', reps: 'hold', dose: 'hold' };
  return {
    name: name,
    exerciseId: '',
    action: action,
    confidence: confidence || 'medium',
    reasons: ['stub 7B ' + action],
    levers: levers
  };
}
function many(action, n, confidence, prefix) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rec((prefix || action) + (i + 1), action, confidence));
  return out;
}
function agg(trend, confidence) {
  return { trend: trend, confidence: confidence || 'medium' };
}
function gateOf(got) {
  const r0 = got && Array.isArray(got.reasons) ? got.reasons[0] : '';
  const hit = Object.keys(WHY).find(k => WHY[k] === r0);
  return hit || '?';
}
function namesOf(rows) {
  return (rows || []).map(r => r.name);
}

const cases = [];
function expectCase(n, title, input, want) {
  const beforeC = classifyCalls, beforeR = recCalls, beforeA = aggCalls;
  const got = composeNextSessionProgress(input);
  ok('T' + n + ' no 6D call', classifyCalls === beforeC);
  ok('T' + n + ' no 7B call', recCalls === beforeR);
  ok('T' + n + ' no 7A call', aggCalls === beforeA);
  const gate = gateOf(got);
  const pass = got.posture === want.posture
    && gate === want.gate
    && got.confidence === want.confidence
    && Array.isArray(got.reasons) && got.reasons[0] === WHY[want.gate]
    && (want.reasons1 == null
      ? got.reasons.length === 1
      : got.reasons.length === 2 && got.reasons[1] === want.reasons1);
  if (!pass) {
    failed++;
    console.error('FAIL T' + n + ' ' + title);
    console.error('  want: ' + want.gate + ' ' + want.posture + ' ' + want.confidence);
    console.error('  got:  ' + gate + ' ' + got.posture + ' ' + got.confidence + ' ' + JSON.stringify(got.reasons));
  } else console.log('OK   T' + n + ' ' + want.gate + ' ' + want.posture);
  if (want.change) {
    const gotChange = namesOf(got.change);
    ok('T' + n + ' change', JSON.stringify(gotChange) === JSON.stringify(want.change), JSON.stringify(gotChange));
  }
  if (want.hold) ok('T' + n + ' hold', JSON.stringify(namesOf(got.hold)) === JSON.stringify(want.hold), JSON.stringify(namesOf(got.hold)));
  if (want.watch) ok('T' + n + ' watch', JSON.stringify(namesOf(got.watch)) === JSON.stringify(want.watch), JSON.stringify(namesOf(got.watch)));
  if (want.changeAction) {
    ok('T' + n + ' change action kept', (got.change || []).some(r => r.action === want.changeAction));
  }
  ok('T' + n + ' no nextKg', !('nextKg' in got) && !('nextReps' in got));
  ok('T' + n + ' disjoint lists', (() => {
    const a = namesOf(got.change), b = namesOf(got.hold), c = namesOf(got.watch);
    const s = a.concat(b, c);
    return s.length === new Set(s).size;
  })());
  cases.push({ n: n, title: title, want: want, got: got, gate: gate, pass: pass });
  return got;
}

expectCase(1, 'zły input', null, {
  posture: 'ZA MAŁO DANYCH', gate: 'C0', confidence: 'low'
});
expectCase(1, 'recs nie-tablica', { clientId: 'c1', recs: {}, aggregate: agg('WZROST', 'high') }, {
  posture: 'ZA MAŁO DANYCH', gate: 'C0', confidence: 'low'
});

expectCase(2, 'recs=[]', { clientId: 'c1', recs: [], aggregate: agg('WZROST', 'high') }, {
  posture: 'ZA MAŁO DANYCH', gate: 'C1', confidence: 'low', change: [], hold: [], watch: []
});
expectCase(2, 'recs=[] COFANIE still C1', { clientId: 'c1', recs: [], aggregate: agg('COFANIE', 'high') }, {
  posture: 'ZA MAŁO DANYCH', gate: 'C1', confidence: 'low'
});

expectCase(3, '3× ZA MAŁO', {
  clientId: 'c1',
  recs: many('ZA MAŁO DANYCH', 3, 'low', 'Z'),
  aggregate: agg('ZA MAŁO DANYCH', 'low')
}, { posture: 'ZA MAŁO DANYCH', gate: 'C1', confidence: 'low' });

expectCase(4, '1× UTRZYMAJ + 2× ZA MAŁO, 7A ZA MAŁO', {
  clientId: 'c1',
  recs: [rec('Hold', 'UTRZYMAJ', 'high')].concat(many('ZA MAŁO DANYCH', 2, 'low', 'Z')),
  aggregate: agg('ZA MAŁO DANYCH', 'low')
}, { posture: 'ZA MAŁO DANYCH', gate: 'C1', confidence: 'low' });

expectCase(5, '1× DELOAD + 3× UTRZYMAJ', {
  clientId: 'c1',
  recs: [rec('Hack', 'DELOAD', 'high')].concat(many('UTRZYMAJ', 3, 'high', 'U')),
  aggregate: agg('STABILNIE', 'high')
}, {
  posture: 'HAMUJ', gate: 'C2', confidence: 'high',
  change: ['Hack'], hold: ['U1', 'U2', 'U3']
});

expectCase(6, 'same UTRZYMAJ, COFANIE', {
  clientId: 'c1',
  recs: many('UTRZYMAJ', 4, 'high', 'U'),
  aggregate: agg('COFANIE', 'high')
}, {
  posture: 'HAMUJ', gate: 'C2', confidence: 'high',
  change: [], hold: ['U1', 'U2', 'U3', 'U4'],
  reasons1: 'agregat 7A: COFANIE — 7C nie zamienia sesji w dokładanie kg'
});

expectCase(7, '1× DODAJ CIĘŻAR + 3× UTRZYMAJ, COFANIE', {
  clientId: 'c1',
  recs: [rec('Bench', 'DODAJ CIĘŻAR', 'high')].concat(many('UTRZYMAJ', 3, 'high', 'U')),
  aggregate: agg('COFANIE', 'high')
}, {
  posture: 'HAMUJ', gate: 'C2', confidence: 'high',
  change: ['Bench'], changeAction: 'DODAJ CIĘŻAR',
  reasons1: 'agregat 7A: COFANIE — 7C nie zamienia sesji w dokładanie kg'
});

expectCase(8, '2× DODAJ POWTÓRZENIA + 2× UTRZYMAJ, WZROST', {
  clientId: 'c1',
  recs: many('DODAJ POWTÓRZENIA', 2, 'high', 'P').concat(many('UTRZYMAJ', 2, 'high', 'U')),
  aggregate: agg('WZROST', 'high')
}, { posture: 'ROZWIJAJ', gate: 'C3', confidence: 'high' });

expectCase(9, '2× DODAJ CIĘŻAR + 2× UTRZYMAJ, WZROST', {
  clientId: 'c1',
  recs: many('DODAJ CIĘŻAR', 2, 'high', 'K').concat(many('UTRZYMAJ', 2, 'high', 'U')),
  aggregate: agg('WZROST', 'high')
}, { posture: 'ROZWIJAJ', gate: 'C3', confidence: 'high' });

expectCase(10, '5× UTRZYMAJ, WZROST', {
  clientId: 'c1',
  recs: many('UTRZYMAJ', 5, 'high', 'U'),
  aggregate: agg('WZROST', 'high')
}, { posture: 'UTRZYMAJ KURS', gate: 'C4', confidence: 'high', change: [] });

expectCase(11, '1× DODAJ POWTÓRZENIA + 4× UTRZYMAJ, WZROST', {
  clientId: 'c1',
  recs: [rec('Row', 'DODAJ POWTÓRZENIA', 'high')].concat(many('UTRZYMAJ', 4, 'high', 'U')),
  aggregate: agg('WZROST', 'high')
}, { posture: 'UTRZYMAJ KURS', gate: 'C4', confidence: 'high', change: ['Row'] });

expectCase(12, '1× DODAJ CIĘŻAR + 4× UTRZYMAJ, WZROST', {
  clientId: 'c1',
  recs: [rec('Squat', 'DODAJ CIĘŻAR', 'high')].concat(many('UTRZYMAJ', 4, 'high', 'U')),
  aggregate: agg('WZROST', 'high')
}, { posture: 'MIESZANE', gate: 'C5', confidence: 'high', change: ['Squat'] });

expectCase(13, '1× ZMNIEJSZ + 3× UTRZYMAJ, STABILNIE', {
  clientId: 'c1',
  recs: [rec('Curl', 'ZMNIEJSZ OBCIĄŻENIE', 'high')].concat(many('UTRZYMAJ', 3, 'high', 'U')),
  aggregate: agg('STABILNIE', 'high')
}, { posture: 'HAMUJ', gate: 'C2', confidence: 'high', change: ['Curl'] });

expectCase(14, '1× ZMNIEJSZ + 1× DODAJ CIĘŻAR, NIERÓWNY', {
  clientId: 'c1',
  recs: [
    rec('Down', 'ZMNIEJSZ OBCIĄŻENIE', 'high'),
    rec('Up', 'DODAJ CIĘŻAR', 'high')
  ],
  aggregate: agg('NIERÓWNY', 'high')
}, { posture: 'MIESZANE', gate: 'C5', confidence: 'high' });

expectCase(15, '2× ZMNIEJSZ + 1× DODAJ POWTÓRZENIA, NIERÓWNY', {
  clientId: 'c1',
  recs: many('ZMNIEJSZ OBCIĄŻENIE', 2, 'high', 'Z').concat([rec('P', 'DODAJ POWTÓRZENIA', 'high')]),
  aggregate: agg('NIERÓWNY', 'high')
}, { posture: 'HAMUJ', gate: 'C2', confidence: 'high' });

expectCase(16, '1× DELOAD + 3× DODAJ CIĘŻAR, WZROST', {
  clientId: 'c1',
  recs: [rec('Dl', 'DELOAD', 'high')].concat(many('DODAJ CIĘŻAR', 3, 'high', 'K')),
  aggregate: agg('WZROST', 'high')
}, { posture: 'HAMUJ', gate: 'C2', confidence: 'high', change: ['Dl', 'K1', 'K2', 'K3'] });

expectCase(17, '4× OBSERWUJ, NIERÓWNY', {
  clientId: 'c1',
  recs: many('OBSERWUJ', 4, 'low', 'O'),
  aggregate: agg('NIERÓWNY', 'medium')
}, { posture: 'UTRZYMAJ KURS', gate: 'C4', confidence: 'medium' });

expectCase(18, '2× DODAJ POWTÓRZENIA + 1× ZMNIEJSZ', {
  clientId: 'c1',
  recs: many('DODAJ POWTÓRZENIA', 2, 'high', 'P').concat([rec('Z', 'ZMNIEJSZ OBCIĄŻENIE', 'high')]),
  aggregate: agg('NIERÓWNY', 'high')
}, { posture: 'ROZWIJAJ', gate: 'C3', confidence: 'high' });

expectCase(19, '2× DODAJ POWTÓRZENIA + 2× ZMNIEJSZ', {
  clientId: 'c1',
  recs: many('DODAJ POWTÓRZENIA', 2, 'high', 'P').concat(many('ZMNIEJSZ OBCIĄŻENIE', 2, 'high', 'Z')),
  aggregate: agg('NIERÓWNY', 'high')
}, { posture: 'HAMUJ', gate: 'C2', confidence: 'high' });

expectCase(20, '≥2× UTRZYMAJ medium, STABILNIE high', {
  clientId: 'c1',
  recs: many('UTRZYMAJ', 3, 'medium', 'U'),
  aggregate: agg('STABILNIE', 'high')
}, { posture: 'UTRZYMAJ KURS', gate: 'C4', confidence: 'high' });

ok('7A helper still works', aggregateClientProgress({ clientId: 'c1', items: [] }).trend === 'ZA MAŁO DANYCH');
ok('7B helper still works', recommendExerciseProgress(null).action === 'ZA MAŁO DANYCH');
ok('6D helper still works', classifyExerciseProgress({ snapshots: [], steps: [] }).label === 'ZA MAŁO DANYCH');
ok('WZROST does not force ROZWIJAJ', composeNextSessionProgress({
  recs: many('UTRZYMAJ', 4, 'high', 'U'),
  aggregate: agg('WZROST', 'high')
}).posture === 'UTRZYMAJ KURS');

console.log('\n===== 7C przypadki T1–T20 =====');
console.log('nr  brama  postawa');
const seen = {};
cases.forEach(r => {
  if (seen[r.n]) return;
  seen[r.n] = r;
});
for (let i = 1; i <= 20; i++) {
  const r = seen[i];
  if (!r) {
    console.log(String(i).padStart(2) + '  BRAK');
    continue;
  }
  const mark = r.pass ? 'PASS' : 'FAIL';
  console.log(String(i).padStart(2) + '  ' + r.gate.padEnd(4) + ' ' + r.got.posture.padEnd(16) + '  ' + mark);
}
const nPass = Object.keys(seen).filter(k => seen[k].pass).length;
console.log('\n' + nPass + '/20 unikalnych T PASS');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nBrief 7C: OK.');
process.exit(0);
