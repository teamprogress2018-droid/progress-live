#!/usr/bin/env node
'use strict';
/** Etap 7B: rekomendacja na następną sesję — A–O, kontrakt targetu, inwarianty D0–D18. */
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

const REASONS = {
  D0: 'brak poprawnego wyniku 6D do rekomendacji',
  D1: 'brak drugiej porównywalnej sesji kg',
  D2: 'niska pewność 6D albo brak RIR / mixed — nie ruszam obciążenia',
  D3: 'co najmniej 4 sesje plateau przy RIR 0–1 — zebrany limit, nie jeden ciężki dzień',
  D4: 'REGRES już zszedł z kg — zostaję na obecnym ciężarze, nie tnę dalej',
  D5: 'dwa spadki powtórzeń przy tym samym kg i RIR 0–1 — zejdź z ciężarem; to nie pełny deload',
  D6: 'REGRES sam nie każe tnąć kg — zostaję na obecnym obciążeniu',
  D7: 'jeden słabszy trening (dip) — nie deload i nie zmiana kg',
  D8: 'RIR 0 przy wzroście kg (grind) — nie dokładam; potwierdź obecny ciężar',
  D9: 'liczba serii już się zmieniła — 7B nie rusza dawki ani nie dokładam kg/powt.',
  D10: 'nearLimit bez pełnego wzorca deloadu — nie dokładam kg',
  D11: 'ostatnio poszedł ciężar — najpierw potwierdź nowy kg',
  D12: 'ostatnio spadł ciężar — najpierw potwierdź niższy kg',
  D13: 'serie nierówne przy zapasie RIR — wyrównaj powtórzenia, nie dokładaj kg',
  D14: 'brak zadanego stropu powtórzeń — sam wzrost powt. nie uprawnia +kg; potwierdź wynik',
  D15: 'zapas RIR przy tym kg — najpierw powtórzenia, nie ciężar',
  D16: 'zadany strop powtórzeń osiągnięty przy RIR ≥ 2 i równych seriach',
  D17: 'brak przesłanki do zmiany — utrzymuję obciążenie i powtórzenia',
  D18: 'brak jednoznacznej przesłanki — obserwuj, nie ruszaj obciążenia'
};

const LEVERS = {
  'ZA MAŁO DANYCH': { load: 'none', reps: 'none', dose: 'hold' },
  'OBSERWUJ': { load: 'hold', reps: 'hold', dose: 'hold' },
  DELOAD: { load: 'deload', reps: 'hold', dose: 'hold' },
  'ZMNIEJSZ OBCIĄŻENIE': { load: 'down', reps: 'hold', dose: 'hold' },
  UTRZYMAJ: { load: 'hold', reps: 'hold', dose: 'hold' },
  'DODAJ POWTÓRZENIA': { load: 'hold', reps: 'up', dose: 'hold' },
  'DODAJ CIĘŻAR': { load: 'up', reps: 'hold', dose: 'hold' }
};

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=126'));
ok('CI', wf.includes('test_ex_progress_rec.js') && wf.includes('1e0z5'));
ok('rec helper', /function recommendExerciseProgress/.test(coreSrc));
ok('rec stays in core', !/function recommendExerciseProgress/.test(extras)
  && !/function recommendExerciseProgress/.test(portal)
  && !/recommendExerciseProgress/.test(client)
  && !/recommendExerciseProgress/.test(live)
  && !/recommendExerciseProgress/.test(builder)
  && !/recommendExerciseProgress/.test(html));
ok('no UI wiring', !/recommendExerciseProgress/.test(progressFn)
  && !/recommendExerciseProgress/.test(capFn)
  && !/recommendExerciseProgress/.test(rememberSrc)
  && !/recommendExerciseProgress/.test(aggSrc));
ok('7A aggregator unchanged entry', /function aggregateClientProgress/.test(coreSrc)
  && !/recommendExerciseProgress/.test(aggSrc));
ok('does not reclassify or rebuild series', !/classifyExerciseProgress/.test(recSrc)
  && !/exerciseProgressSeries/.test(recSrc)
  && !/aggregateClientProgress/.test(recSrc)
  && !/exerciseProgressClass\(/.test(recSrc)
  && !/window\.SE/.test(recSrc));
ok('does not call Live plan helpers', !/parseRepRange/.test(recSrc)
  && !/progressWorkingSet/.test(recSrc)
  && !/epley1RM/.test(recSrc)
  && !/bestEpley/.test(recSrc)
  && !/deltaE1RM/.test(recSrc)
  && !/e1RM/.test(recSrc));
ok('no invented repMax defaults', !/repMax\s*=\s*10/.test(recSrc)
  && !/repMax\s*=\s*12/.test(recSrc)
  && !/target\s*=\s*10/.test(recSrc)
  && !/target\s*=\s*12/.test(recSrc)
  && /typeof raw==='number'&&Number\.isFinite\(raw\)&&raw>0/.test(recSrc));
ok('kgUp is dirKg up only', /kgUp=dirKg==='up'/.test(recSrc)
  && !/lastKind==='up'/.test(recSrc)
  && !/progressClassStepKind/.test(recSrc));
ok('D14/D16 disjoint in source', /repsUp&&!kgUp&&target==null/.test(recSrc)
  && /target!=null/.test(recSrc)
  && /atRepMax/.test(recSrc));
ok('6D classifier unchanged labels', /ZA MAŁO DANYCH/.test(classifySrc)
  && /label==='PROGRES'/.test(classifySrc)
  && /consecutiveDown>=2/.test(classifySrc)
  && /function scoreExerciseProgress/.test(coreSrc) === false);
ok('6C series still comparable kg only', /pool=snaps\.filter\(s=>s\.comparable\)/.test(seriesSrc));
ok('canonical reasons present', Object.keys(REASONS).every(k => recSrc.indexOf(REASONS[k]) >= 0));

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
  exerciseProgressSeries,
  classifyExerciseProgress,
  exerciseProgressClass,
  recommendExerciseProgress,
  aggregateClientProgress
} = ctx;

let classifyCalls = 0;
const origClassify = ctx.classifyExerciseProgress;
ctx.classifyExerciseProgress = function wrappedClassify() {
  classifyCalls++;
  return origClassify.apply(this, arguments);
};
windowObj.classifyExerciseProgress = ctx.classifyExerciseProgress;

let parseCalls = 0;
const origParse = ctx.parseRepRange;
ctx.parseRepRange = function wrappedParse() {
  parseCalls++;
  return origParse.apply(this, arguments);
};
windowObj.parseRepRange = ctx.parseRepRange;

let pwsCalls = 0;
const origPws = ctx.progressWorkingSet;
ctx.progressWorkingSet = function wrappedPws() {
  pwsCalls++;
  return origPws.apply(this, arguments);
};
windowObj.progressWorkingSet = ctx.progressWorkingSet;

const NAME = 'Wyciskanie sztangi';
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
function equalSets(kg, reps, rir, n) {
  const count = n == null ? 3 : n;
  const sets = [];
  for (let i = 0; i < count; i++) sets.push(work(kg, reps, rir));
  return sets;
}
function bench(id, date, kg, reps, rir, setCount) {
  return sess(id, date, [{ name: NAME, sets: equalSets(kg, reps, rir, setCount == null ? 3 : setCount) }]);
}
function benchUneven(id, date, kg, repsList, rir) {
  return sess(id, date, [{ name: NAME, sets: repsList.map(r => work(kg, r, rir)) }]);
}
function itemFromSE(opts) {
  return exerciseProgressClass('c1', NAME, null, opts || {});
}
function recOf(setup, opts) {
  windowObj.SE = [];
  setup();
  const item = itemFromSE();
  const beforeC = classifyCalls;
  const beforeP = parseCalls;
  const beforeW = pwsCalls;
  const got = recommendExerciseProgress(item, opts);
  ok('7B does not call classify', classifyCalls === beforeC);
  ok('7B does not call parseRepRange', parseCalls === beforeP);
  ok('7B does not call progressWorkingSet', pwsCalls === beforeW);
  return { item, got };
}
function gateOf(got) {
  const reason = got && Array.isArray(got.reasons) ? got.reasons[0] : '';
  const hit = Object.keys(REASONS).find(k => REASONS[k] === reason);
  return hit || '?';
}
function expectRec(tag, got, want) {
  const gate = gateOf(got);
  ok(tag + ' action', got.action === want.action, got.action);
  ok(tag + ' gate ' + want.gate, gate === want.gate, gate);
  ok(tag + ' reason canon', Array.isArray(got.reasons) && got.reasons.length === 1
    && got.reasons[0] === REASONS[want.gate], JSON.stringify(got.reasons));
  ok(tag + ' confidence', got.confidence === want.confidence, got.confidence);
  eq(tag + ' levers', got.levers, LEVERS[want.action]);
  ok(tag + ' dose hold', got.levers && got.levers.dose === 'hold');
  ok(tag + ' name', got.name === NAME || want.allowEmptyName === true, got.name);
  if (want.facts) {
    Object.keys(want.facts).forEach(k => {
      eq(tag + ' facts.' + k, got.facts[k], want.facts[k]);
    });
  }
  const L = got.levers || {};
  const loadUp = L.load === 'up' ? 1 : 0;
  const repsUp = L.reps === 'up' ? 1 : 0;
  const cut = (L.load === 'deload' || L.load === 'down') ? 1 : 0;
  const hold = ((L.load === 'hold' || L.load === 'none') && (L.reps === 'hold' || L.reps === 'none')) ? 1 : 0;
  ok(tag + ' one lever', loadUp + repsUp + cut + hold === 1, JSON.stringify(L));
  return gate;
}

const ao = {};

// A / L — 80×10 → 80×11 → 80×12 @2, no target → D14
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 11, '2'),
      bench('s3', '2026-09-15', 80, 12, '2')
    ];
  });
  ok('A 6D PROGRES high', item.classification.label === 'PROGRES' && item.classification.confidence === 'high'
    && item.classification.plateau === false);
  ao.A = expectRec('A', got, {
    action: 'UTRZYMAJ', gate: 'D14', confidence: 'high',
    facts: { target: null, atRepMax: false, kgUp: false, repsUp: true, evenSets: true, reserveNow: true }
  });
  const gotL = recommendExerciseProgress(item);
  ao.L = expectRec('L', gotL, { action: 'UTRZYMAJ', gate: 'D14', confidence: 'high' });
}

// B / O — same, target.repMax=12 → D16
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 11, '2'),
      bench('s3', '2026-09-15', 80, 12, '2')
    ];
  }, { target: { repMax: 12 } });
  ok('B 6D PROGRES high', item.classification.label === 'PROGRES' && item.classification.confidence === 'high');
  ao.B = expectRec('B', got, {
    action: 'DODAJ CIĘŻAR', gate: 'D16', confidence: 'high',
    facts: { target: 12, atRepMax: true, evenSets: true, reserveNow: true, rirKnown: true, kgUp: false, kgDown: false }
  });
  const gotO = recommendExerciseProgress(item, { target: { repMax: 12 } });
  ao.O = expectRec('O', gotO, { action: 'DODAJ CIĘŻAR', gate: 'D16', confidence: 'high' });
}

// C — kgUp. Live 6D P-kg 80×10@2 → 82.5×10@2 = PROGRES medium (case 1).
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 82.5, 10, '2')
    ];
  });
  ok('C 6D PROGRES medium', item.classification.label === 'PROGRES' && item.classification.confidence === 'medium'
    && (item.classification.flags || []).length === 0);
  ao.C = expectRec('C', got, {
    action: 'UTRZYMAJ', gate: 'D11', confidence: 'medium',
    facts: { kgUp: true }
  });
}

// D / N — 12/8/8 @2 reserve → D13
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      benchUneven('s2', '2026-09-08', 80, [12, 8, 8], '2')
    ];
  });
  ok('D 6D not REGRES', item.classification.label !== 'REGRES' && item.classification.confidence !== 'low');
  ao.D = expectRec('D', got, {
    action: 'DODAJ POWTÓRZENIA', gate: 'D13', confidence: item.classification.confidence,
    facts: { evenSets: false, reserveNow: true, kgUp: false, kgDown: false }
  });
}
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 10, '2'),
      benchUneven('s3', '2026-09-15', 80, [12, 8, 8], '2')
    ];
  });
  ok('N evenSets false', got.facts.evenSets === false);
  ao.N = expectRec('N', got, {
    action: 'DODAJ POWTÓRZENIA', gate: 'D13', confidence: item.classification.confidence
  });
}

// E — 3×80×10 @2 → D15
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 10, '2'),
      bench('s3', '2026-09-15', 80, 10, '2')
    ];
  });
  ok('E 6D STABILNIE medium', item.classification.label === 'STABILNIE' && item.classification.confidence === 'medium'
    && item.classification.plateau === false);
  ao.E = expectRec('E', got, {
    action: 'DODAJ POWTÓRZENIA', gate: 'D15', confidence: 'medium',
    facts: { evenSets: true, reserveNow: true, atRepMax: false }
  });
}

// F — grind RIR 0 → D8
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 82.5, 10, '0')
    ];
  });
  ok('F 6D grind', item.classification.label === 'PROGRES'
    && (item.classification.flags || []).indexOf('grind') >= 0
    && item.classification.confidence === 'medium');
  ao.F = expectRec('F', got, { action: 'UTRZYMAJ', gate: 'D8', confidence: 'medium' });
}

// G — REGRES kgDown → D4
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, ''),
      bench('s2', '2026-09-08', 77.5, 10, ''),
      bench('s3', '2026-09-15', 75, 10, '2')
    ];
  });
  ok('G 6D REGRES high', item.classification.label === 'REGRES' && item.classification.confidence === 'high');
  ao.G = expectRec('G', got, {
    action: 'UTRZYMAJ', gate: 'D4', confidence: 'high',
    facts: { kgAlreadyDropped: true, kgDown: true }
  });
}

// H — plateau nearLimit → D3
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '0'),
      bench('s2', '2026-09-08', 80, 10, '0'),
      bench('s3', '2026-09-15', 80, 10, '0'),
      bench('s4', '2026-09-22', 80, 10, '0')
    ];
  });
  ok('H 6D plateau nearLimit', item.classification.label === 'STABILNIE' && item.classification.plateau === true
    && (item.classification.flags || []).indexOf('nearLimit') >= 0
    && item.classification.confidence === 'high');
  ao.H = expectRec('H', got, { action: 'DELOAD', gate: 'D3', confidence: 'high' });
}

// I — no RIR → D2
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, ''),
      bench('s2', '2026-09-08', 82.5, 10, null)
    ];
  });
  ok('I 6D PROGRES low', item.classification.label === 'PROGRES' && item.classification.confidence === 'low');
  ao.I = expectRec('I', got, { action: 'OBSERWUJ', gate: 'D2', confidence: 'low' });
}

// J — B data + COFANIE → D17
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 11, '2'),
      bench('s3', '2026-09-15', 80, 12, '2')
    ];
  }, { target: { repMax: 12 }, aggregate: { trend: 'COFANIE' } });
  ok('J 6D same as B', item.classification.label === 'PROGRES' && item.classification.confidence === 'high');
  ao.J = expectRec('J', got, {
    action: 'UTRZYMAJ', gate: 'D17', confidence: 'high',
    facts: { cofanie: true, atRepMax: true, target: 12 }
  });
}

// K — doseIncreased → D9
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2', 3),
      bench('s2', '2026-09-08', 80, 10, '2', 5)
    ];
  });
  ok('K 6D doseIncreased', item.classification.label === 'STABILNIE'
    && (item.classification.flags || []).indexOf('doseIncreased') >= 0
    && item.classification.confidence === 'medium');
  ao.K = expectRec('K', got, { action: 'UTRZYMAJ', gate: 'D9', confidence: 'medium' });
}

// M — atRepMax + classConf low + mixed → D2
{
  windowObj.SE = [
    bench('s1', '2026-09-01', 80, 10, '2'),
    bench('s2', '2026-09-08', 85, 8, '1')
  ];
  const liveMixed = itemFromSE();
  ok('M live 6D mixed low', liveMixed.classification.confidence === 'low'
    && (liveMixed.classification.flags || []).indexOf('mixed') >= 0);
  const item = {
    name: NAME,
    exerciseId: '',
    series: {
      snapshots: [
        { comparable: true, topSet: { kg: 80, reps: 10 }, rir: { available: true, top: 2 }, workSetCount: 3, totalWorkReps: 30 },
        { comparable: true, topSet: { kg: 85, reps: 12 }, rir: { available: true, top: 2 }, workSetCount: 3, totalWorkReps: 36 }
      ],
      steps: [{ dir: { kg: 'up', reps: 'up' } }]
    },
    classification: { label: 'STABILNIE', plateau: false, flags: ['mixed'], confidence: 'low', reasons: ['stub mixed'] }
  };
  const got = recommendExerciseProgress(item, { target: { repMax: 12 } });
  ao.M = expectRec('M', got, { action: 'OBSERWUJ', gate: 'D2', confidence: 'low' });
}

console.log('\n===== 7B scenariusze A–O =====');
console.log('nr  D#   akcja                pewność');
'A,B,C,D,E,F,G,H,I,J,K,L,M,N,O'.split(',').forEach(k => {
  console.log(k + '   ' + String(ao[k] || '?').padEnd(4) + ' (patrz testy wyżej)');
});

// Target contract edges on A/B series
windowObj.SE = [
  bench('s1', '2026-09-01', 80, 10, '2'),
  bench('s2', '2026-09-08', 80, 11, '2'),
  bench('s3', '2026-09-15', 80, 12, '2')
];
const itemAB = itemFromSE();
function targetCase(title, opts, wantTarget, wantGate) {
  const got = recommendExerciseProgress(itemAB, opts);
  eq('target ' + title + ' facts.target', got.facts.target, wantTarget);
  ok('target ' + title + ' gate', gateOf(got) === wantGate, gateOf(got));
}
targetCase('missing opts', undefined, null, 'D14');
targetCase('missing target', {}, null, 'D14');
targetCase('repMax undefined', { target: {} }, null, 'D14');
targetCase('string 12', { target: { repMax: '12' } }, null, 'D14');
targetCase('range 8-12', { target: { repMax: '8-12' } }, null, 'D14');
targetCase('NaN', { target: { repMax: NaN } }, null, 'D14');
targetCase('+Inf', { target: { repMax: Infinity } }, null, 'D14');
targetCase('0', { target: { repMax: 0 } }, null, 'D14');
targetCase('-1', { target: { repMax: -1 } }, null, 'D14');
targetCase('number 12', { target: { repMax: 12 } }, 12, 'D16');
targetCase('12.0', { target: { repMax: 12.0 } }, 12, 'D16');
targetCase('8 below lastReps still atRepMax', { target: { repMax: 8 } }, 8, 'D16');
targetCase('15 belowRepMax', { target: { repMax: 15 } }, 15, 'D15');
ok('belowRepMax 15', recommendExerciseProgress(itemAB, { target: { repMax: 15 } }).facts.belowRepMax === true
  && recommendExerciseProgress(itemAB, { target: { repMax: 15 } }).facts.atRepMax === false);

// D0
expectRec('D0 null', recommendExerciseProgress(null), {
  action: 'ZA MAŁO DANYCH', gate: 'D0', confidence: 'low', allowEmptyName: true
});
expectRec('D0 unknown label', recommendExerciseProgress({
  name: NAME, exerciseId: '', classification: { label: 'FOO', confidence: 'high', flags: [], plateau: false }
}), { action: 'ZA MAŁO DANYCH', gate: 'D0', confidence: 'low' });

// D1
{
  const { item, got } = recOf(() => {
    windowObj.SE = [bench('s1', '2026-09-01', 80, 10, '2')];
  });
  ok('D1 6D ZA MAŁO', item.classification.label === 'ZA MAŁO DANYCH');
  expectRec('D1', got, { action: 'ZA MAŁO DANYCH', gate: 'D1', confidence: 'low' });
}

// D5 — REGRES reps down same kg, hardNow
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '1'),
      bench('s2', '2026-09-08', 80, 8, '1'),
      bench('s3', '2026-09-15', 80, 6, '0')
    ];
  });
  ok('D5 6D REGRES high', item.classification.label === 'REGRES' && item.classification.confidence === 'high');
  expectRec('D5', got, {
    action: 'ZMNIEJSZ OBCIĄŻENIE', gate: 'D5', confidence: 'high',
    facts: { kgDown: false, repsCollapsedSameKg: true, hardNow: true }
  });
}

// D6 — REGRES same kg, RIR≥2
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 80, 8, '2'),
      bench('s3', '2026-09-15', 80, 6, '2')
    ];
  });
  ok('D6 6D REGRES high', item.classification.label === 'REGRES' && item.classification.confidence === 'high');
  expectRec('D6', got, { action: 'UTRZYMAJ', gate: 'D6', confidence: 'high' });
}

// D7 — dip
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      bench('s2', '2026-09-08', 82.5, 10, '2'),
      bench('s3', '2026-09-15', 85, 10, '2'),
      bench('s4', '2026-09-22', 80, 10, '2')
    ];
  });
  ok('D7 6D dip', (item.classification.flags || []).indexOf('dip') >= 0);
  expectRec('D7', got, { action: 'UTRZYMAJ', gate: 'D7', confidence: item.classification.confidence });
}

// D10 — nearLimit leftover, lastRir=2 so not D3
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '0'),
      bench('s2', '2026-09-08', 80, 10, '0'),
      bench('s3', '2026-09-15', 80, 10, '0'),
      bench('s4', '2026-09-22', 80, 10, '2')
    ];
  });
  ok('D10 6D nearLimit plateau', item.classification.plateau === true
    && (item.classification.flags || []).indexOf('nearLimit') >= 0);
  expectRec('D10', got, { action: 'UTRZYMAJ', gate: 'D10', confidence: item.classification.confidence });
}

// D12 — kgDown without REGRES
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 82.5, 10, '2'),
      bench('s2', '2026-09-08', 80, 10, '3')
    ];
  });
  ok('D12 not REGRES', item.classification.label !== 'REGRES');
  expectRec('D12', got, {
    action: 'UTRZYMAJ', gate: 'D12', confidence: item.classification.confidence,
    facts: { kgDown: true }
  });
}

// D18 — plateau without RIR
{
  const { item, got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, ''),
      bench('s2', '2026-09-08', 80, 10, ''),
      bench('s3', '2026-09-15', 80, 10, ''),
      bench('s4', '2026-09-22', 80, 10, '')
    ];
  });
  ok('D18 6D plateau no RIR', item.classification.plateau === true && item.classification.confidence === 'high');
  expectRec('D18', got, { action: 'OBSERWUJ', gate: 'D18', confidence: 'low' });
}

// evenSets trap: 10/10/8 is evenSets true (avg 9.33 >= 9)
{
  const { got } = recOf(() => {
    windowObj.SE = [
      bench('s1', '2026-09-01', 80, 10, '2'),
      benchUneven('s2', '2026-09-08', 80, [10, 10, 8], '2')
    ];
  });
  ok('trap 10/10/8 evenSets true', got.facts.evenSets === true);
  ok('trap 10/10/8 not D13', gateOf(got) !== 'D13');
}

// Invariants
ok('D16 requires target', gateOf(recommendExerciseProgress(itemAB)) !== 'D16');
ok('D16 with target', gateOf(recommendExerciseProgress(itemAB, { target: { repMax: 12 } })) === 'D16');
ok('WZROST does not force D16', gateOf(recommendExerciseProgress(itemAB, {
  aggregate: { trend: 'WZROST' }
})) !== 'D16');
ok('COFANIE does not set D3 on healthy B', gateOf(recommendExerciseProgress(itemAB, {
  target: { repMax: 12 }, aggregate: { trend: 'COFANIE' }
})) === 'D17');
ok('7A helper still works', aggregateClientProgress({ clientId: 'c1', items: [] }).trend === 'ZA MAŁO DANYCH');
ok('7B not in 6D body', !/recommendExerciseProgress/.test(classifySrc));
ok('7B not in 6C body', !/recommendExerciseProgress/.test(seriesSrc));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nRekomendacja 7B: OK.');
process.exit(0);
