#!/usr/bin/env node
'use strict';
/**
 * Etap 8: integracja PLAN → zapis → historia → 6C → 6D → 7A → 7B → 7C.
 * Izolowane fixture. Nie rusza produkcyjnego Firestore.
 * E2E-10: 6C bez planId nadal miesza plany; opts.planId i caller aktywnego planu izolują.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const progressFn = extras.slice(extras.indexOf('function renderCPProgress'), extras.indexOf('window.renderCPProgress'));
const callerStart = extras.indexOf('function composeClientNextSessionBrief');
const callerBind = 'window.cpNextSessionBriefHtml=cpNextSessionBriefHtml';
const callerEnd = extras.indexOf(callerBind);
const callerSrc = callerStart >= 0 && callerEnd > callerStart
  ? extras.slice(callerStart, callerEnd + callerBind.length)
  : '';
const briefSrc = coreSrc.slice(
  coreSrc.indexOf('function composeNextSessionProgress'),
  coreSrc.indexOf('window.composeNextSessionProgress')
);
const recSrc = coreSrc.slice(
  coreSrc.indexOf('function recommendExerciseProgress'),
  coreSrc.indexOf('window.recommendExerciseProgress')
);
const pwsSrc = coreSrc.slice(
  coreSrc.indexOf('function progressWorkingSet'),
  coreSrc.indexOf('window.progressWorkingSet')
);

const POSTURES = {
  'ZA MAŁO DANYCH': 1,
  HAMUJ: 1,
  ROZWIJAJ: 1,
  'UTRZYMAJ KURS': 1,
  MIESZANE: 1
};
const ACTIONS = {
  'ZA MAŁO DANYCH': 1,
  OBSERWUJ: 1,
  DELOAD: 1,
  'ZMNIEJSZ OBCIĄŻENIE': 1,
  UTRZYMAJ: 1,
  'DODAJ POWTÓRZENIA': 1,
  'DODAJ CIĘŻAR': 1
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

ok('cache 01 frozen', html.includes('01-core.js?v=123'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=83'));
ok('CI', wf.includes('test_ex_progress_e2e.js') && wf.includes('1e0z7'));
ok('caller in 08', /function composeClientNextSessionBrief/.test(extras)
  && /function cpNextSessionBriefHtml/.test(extras));
ok('7C stays a definition in core', /function composeNextSessionProgress/.test(coreSrc)
  && !/function composeNextSessionProgress/.test(extras));
ok('7A/7B not redefined in 08', !/function aggregateClientProgress/.test(extras)
  && !/function recommendExerciseProgress/.test(extras)
  && !/function rememberClientExerciseProgress/.test(extras));
ok('progressFn does not inline 7A/7B/7C', !/composeNextSessionProgress/.test(progressFn)
  && !/recommendExerciseProgress/.test(progressFn)
  && !/aggregateClientProgress/.test(progressFn));
ok('progress paints brief', /cpNextSessionBriefHtml\(c\.id\)/.test(progressFn)
  && /rememberClientExerciseProgress\(c\.id\)/.test(progressFn)
  && /cpExerciseProgressPanelHtml\(c\.id\)/.test(progressFn));
ok('caller passes explicit plan hi', /target:\s*\{\s*repMax/.test(callerSrc)
  && /parseRepRange/.test(callerSrc)
  && /progressRecOptsForItem/.test(callerSrc));
ok('caller does not invent default repMax', !/repMax:\s*1[02]\b/.test(callerSrc)
  && !/progressWorkingSet/.test(callerSrc)
  && /amrap/.test(callerSrc));
ok('caller can scope planId', /recOpts\.planId/.test(callerSrc) && /latestClientPlan/.test(callerSrc));
ok('caller restores 6D store after plan filter', /if\(recOpts\.planId\)window\._cpExerciseProgress=prevStore/.test(callerSrc));
ok('progressWorkingSet body untouched here', /function progressWorkingSet/.test(coreSrc)
  && /normalizePlanProgression\(opts\.progression\)/.test(pwsSrc));
ok('7C body still C2(d)', /nZmniejsz>=1&&nAdd===0/.test(briefSrc));
ok('7B body still D16', /zadany strop powtórzeń osiągnięty przy RIR ≥ 2 i równych seriach/.test(recSrc));
const skipSrc = live.slice(live.indexOf('function liveSkipEx'), live.indexOf('function liveSwapEx'));
ok('Live skip follow-up (no liveSaveDraft)', /function liveSkipEx/.test(skipSrc) && !/liveSaveDraft/.test(skipSrc));

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
vm.runInContext(callerSrc, ctx);

const {
  serializeLoggedExercise,
  exerciseLoadHistory,
  exerciseProgressSeries,
  classifyExerciseProgress,
  rememberClientExerciseProgress,
  aggregateClientProgress,
  recommendExerciseProgress,
  composeNextSessionProgress,
  composeClientNextSessionBrief,
  cpNextSessionBriefHtml,
  isLoggedTrainingSession,
  progressWorkingSet
} = ctx;

ok('caller loaded', typeof composeClientNextSessionBrief === 'function'
  && typeof cpNextSessionBriefHtml === 'function');
ok('frozen helpers still on ctx', typeof composeNextSessionProgress === 'function'
  && typeof recommendExerciseProgress === 'function'
  && typeof aggregateClientProgress === 'function'
  && typeof progressWorkingSet === 'function');

function work(kg, reps, rir, extra) {
  const row = Object.assign({ kg: kg, reps: reps, kind: 'work' }, extra || {});
  if (rir != null && rir !== '') row.rir = String(rir);
  return row;
}
function liveEx(name, sets, extra) {
  return Object.assign({ name: name, sets: sets }, extra || {});
}
function saveLive(id, clientId, date, liveExercises, extra) {
  const exercises = (liveExercises || []).map(e => serializeLoggedExercise(e, { onlyDone: true }));
  return Object.assign({
    id: id,
    clientId: clientId,
    date: date,
    source: 'live',
    createdAt: date + 'T10:00:00',
    planId: extra && extra.planId,
    dayIdx: extra && extra.dayIdx != null ? extra.dayIdx : 0,
    exercises: exercises
  }, extra || {});
}

const CID = 'c-e2e';
const PID = 'pl-e2e';
windowObj.PL = [{
  id: PID,
  clientId: CID,
  name: 'E2E FBW test',
  days: [{ exercises: [{ name: 'Wyciskanie sztangi', sets: '3', reps: '8-10' }] }]
}];

function threeLive(clientId, planId) {
  return [
    saveLive('s1', clientId, '2026-09-01', [
      liveEx('Wyciskanie sztangi', [
        Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
        Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
        Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
      ])
    ], { planId: planId }),
    saveLive('s2', clientId, '2026-09-08', [
      liveEx('Wyciskanie sztangi', [
        Object.assign(work(82.5, 10, '2'), { setNo: 1, done: true }),
        Object.assign(work(82.5, 10, '2'), { setNo: 2, done: true }),
        Object.assign(work(82.5, 10, '2'), { setNo: 3, done: true })
      ])
    ], { planId: planId }),
    saveLive('s3', clientId, '2026-09-15', [
      liveEx('Wyciskanie sztangi', [
        Object.assign(work(85, 10, '2'), { setNo: 1, done: true }),
        Object.assign(work(85, 10, '2'), { setNo: 2, done: true }),
        Object.assign(work(85, 10, '2'), { setNo: 3, done: true })
      ])
    ], { planId: planId })
  ];
}

/* E2E-1: PLAN → zapis → historia → 6C → 6D → 7A → 7B → 7C */
windowObj.SE = threeLive(CID, PID);
windowObj._cpExerciseProgress = null;
const via = composeClientNextSessionBrief(CID);
const hist = exerciseLoadHistory(CID, 'Wyciskanie sztangi');
const series = exerciseProgressSeries(CID, 'Wyciskanie sztangi');
const cls = classifyExerciseProgress(series);
const pack = rememberClientExerciseProgress(CID);
const agg = aggregateClientProgress(pack);
const recs = pack.items.map(it => recommendExerciseProgress(it));
const brief = composeNextSessionProgress({ clientId: CID, recs: recs, aggregate: agg });

ok('E2E-1 history from saved live', hist.length === 3 && hist.every(h => h.sessionId));
eq('E2E-1 series snaps', series.snapshots.map(s => s.sessionId), ['s1', 's2', 's3']);
ok('E2E-1 6D label', !!cls.label && ['PROGRES', 'STABILNIE', 'REGRES', 'ZA MAŁO DANYCH'].indexOf(cls.label) >= 0);
ok('E2E-1 7A trend', !!agg.trend);
ok('E2E-1 7B action', recs.length >= 1 && !!ACTIONS[recs[0].action]);
ok('E2E-1 7C posture', brief && !!POSTURES[brief.posture]);
eq('E2E-1 caller matches manual pipeline', via.brief && via.brief.posture, brief.posture);
eq('E2E-1 caller rec action', via.recs[0] && via.recs[0].action, recs[0].action);
ok('E2E-1 no done flag in log', windowObj.SE[0].exercises[0].sets.every(s => !('done' in s)));

let recOpts = 'unset';
const origRec = ctx.recommendExerciseProgress;
ctx.recommendExerciseProgress = function (item, opts) {
  recOpts = opts;
  return origRec.apply(this, arguments);
};
windowObj.recommendExerciseProgress = ctx.recommendExerciseProgress;
composeClientNextSessionBrief(CID);
ok('E2E-1 without planId no target', recOpts == null || recOpts.target == null);
composeClientNextSessionBrief(CID, { planId: PID });
ok('E2E-1 with planId passes hi 10', recOpts && recOpts.target && recOpts.target.repMax === 10);
ctx.recommendExerciseProgress = origRec;
windowObj.recommendExerciseProgress = origRec;

/* E2E-2: 3 kolejne sesje */
ok('E2E-2 three comparable snaps', series.snapshots.length === 3);
ok('E2E-2 last kg 85', series.snapshots[2].topSet && series.snapshots[2].topSet.kg === 85);
ok('E2E-2 6D not empty-label', cls.label !== '');
ok('E2E-2 brief lists the lift', [].concat(brief.change || [], brief.hold || [], brief.watch || [])
  .some(r => r && r.name === 'Wyciskanie sztangi'));

/* E2E-3: reload — wyczyść RAM, odbuduj z SE */
const before = JSON.stringify({
  posture: via.brief.posture,
  conf: via.brief.confidence,
  actions: via.recs.map(r => r.action)
});
windowObj._cpExerciseProgress = null;
const afterReload = composeClientNextSessionBrief(CID);
const after = JSON.stringify({
  posture: afterReload.brief.posture,
  conf: afterReload.brief.confidence,
  actions: afterReload.recs.map(r => r.action)
});
eq('E2E-3 reload brief', after, before);
ok('E2E-3 store rebuilt from SE', windowObj._cpExerciseProgress && windowObj._cpExerciseProgress.clientId === CID);

const htmlBrief = cpNextSessionBriefHtml(CID);
ok('E2E-3 UI has posture', htmlBrief.indexOf('data-ns-posture="') >= 0 && htmlBrief.indexOf(brief.posture) >= 0);
ok('E2E-3 UI last and now', htmlBrief.indexOf('Co teraz') >= 0 && htmlBrief.indexOf('Co ostatnio') >= 0);

/* E2E-4: częściowo wykonany trening */
windowObj.SE = [
  saveLive('part', CID, '2026-09-20', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: false })
    ]),
    liveEx('Przysiad', [
      Object.assign(work(100, 5, '2'), { setNo: 1, done: false })
    ])
  ], { planId: PID })
];
windowObj._cpExerciseProgress = null;
const partSess = windowObj.SE[0];
eq('E2E-4 only done sets saved', partSess.exercises[0].sets.map(s => s.kg), [80]);
eq('E2E-4 skipped-in-progress squat empty', partSess.exercises[1].sets.length, 0);
const partHist = exerciseLoadHistory(CID, 'Przysiad');
eq('E2E-4 empty exercise not in 6C', partHist.length, 0);
ok('E2E-4 bench still in 6C', exerciseLoadHistory(CID, 'Wyciskanie sztangi').length === 1);

/* E2E-5: pominięte ćwiczenie */
windowObj.SE = [
  saveLive('skip-ex', CID, '2026-09-21', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true })
    ]),
    liveEx('Martwy ciąg', [
      Object.assign(work(120, 5, '2'), { setNo: 1, done: false })
    ])
  ], { planId: PID })
];
eq('E2E-5 skipped lift has no sets', windowObj.SE[0].exercises[1].sets.length, 0);
eq('E2E-5 skipped not in history', exerciseLoadHistory(CID, 'Martwy ciąg').length, 0);

/* E2E-6: pominięta seria */
windowObj.SE = [
  saveLive('skip-set', CID, '2026-09-22', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 8, '0'), { setNo: 3, done: false })
    ])
  ], { planId: PID })
];
eq('E2E-6 two sets persisted', windowObj.SE[0].exercises[0].sets.length, 2);
eq('E2E-6 workSetCount', exerciseLoadHistory(CID, 'Wyciskanie sztangi')[0].workSetCount, 2);

/* E2E-7: ręczna zmiana kg/reps względem planu */
windowObj.SE = [
  saveLive('manual', CID, '2026-09-23', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(90, 8, '2'), { setNo: 1, done: true })
    ])
  ], { planId: PID })
];
const manual = exerciseLoadHistory(CID, 'Wyciskanie sztangi')[0];
eq('E2E-7 user kg', manual.sets[0].kg, 90);
eq('E2E-7 user reps', manual.sets[0].reps, 8);

/* E2E-8: dwóch klientów */
const CIDB = 'c-e2e-b';
windowObj.SE = threeLive(CID, PID).concat([
  saveLive('b1', CIDB, '2026-09-01', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(40, 10, '3'), { setNo: 1, done: true })
    ])
  ], { planId: 'pl-b' })
]);
windowObj._cpExerciseProgress = null;
const briefA = composeClientNextSessionBrief(CID);
const briefB = composeClientNextSessionBrief(CIDB);
const histA = exerciseLoadHistory(CID, 'Wyciskanie sztangi');
const histB = exerciseLoadHistory(CIDB, 'Wyciskanie sztangi');
eq('E2E-8 A sessions', histA.map(h => h.sessionId), ['s3', 's2', 's1']);
eq('E2E-8 B only own session', histB.map(h => h.sessionId), ['b1']);
eq('E2E-8 B last kg 40', histB[0].sets[0].kg, 40);
ok('E2E-8 A last kg not 40', histA[0].sets[0].kg !== 40);
ok('E2E-8 briefs isolated', briefA.brief.clientId === CID && briefB.brief.clientId === CIDB);

/* E2E-9: planned / live-draft nie zasilają 6C */
windowObj.SE = [
  {
    id: 'draft', clientId: CID, date: '2026-09-24', source: 'live-draft', planId: PID,
    exercises: [{ name: 'Wyciskanie sztangi', sets: [work(999, 1, '0')] }]
  },
  {
    id: 'plan', clientId: CID, date: '2026-09-25', source: 'planned', planId: PID,
    exercises: [{ name: 'Wyciskanie sztangi', sets: [work(888, 1, '0')] }]
  },
  saveLive('real', CID, '2026-09-26', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true })
    ])
  ], { planId: PID })
];
ok('E2E-9 draft not logged', isLoggedTrainingSession(windowObj.SE[0]) === false);
ok('E2E-9 planned not logged', isLoggedTrainingSession(windowObj.SE[1]) === false);
eq('E2E-9 only real live in 6C', exerciseLoadHistory(CID, 'Wyciskanie sztangi').map(h => h.sessionId), ['real']);

/* E2E-10: 6C bez planId miesza; opts.planId i caller izolują */
windowObj.SE = [
  saveLive('p1s', CID, '2026-09-01', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true })
    ])
  ], { planId: 'pl-a' }),
  saveLive('p2s', CID, '2026-09-08', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(100, 5, '2'), { setNo: 1, done: true })
    ])
  ], { planId: 'pl-b' })
];
const mixed = exerciseLoadHistory(CID, 'Wyciskanie sztangi');
ok('E2E-10 default 6C mixes both plans', mixed.length === 2
  && mixed.some(h => h.sessionId === 'p1s')
  && mixed.some(h => h.sessionId === 'p2s'), JSON.stringify(mixed.map(h => h.sessionId)));
ok('E2E-10 not a false isolation pass', mixed.length !== 1);
const mixedSeries = exerciseProgressSeries(CID, 'Wyciskanie sztangi');
ok('E2E-10 series sees both loads', mixedSeries.snapshots.length === 2
  && mixedSeries.snapshots.some(s => s.topSet && s.topSet.kg === 80)
  && mixedSeries.snapshots.some(s => s.topSet && s.topSet.kg === 100));
eq('E2E-10 opt planId a', exerciseLoadHistory(CID, 'Wyciskanie sztangi', null, { planId: 'pl-a' }).map(h => h.sessionId), ['p1s']);
eq('E2E-10 opt planId b', exerciseLoadHistory(CID, 'Wyciskanie sztangi', null, { planId: 'pl-b' }).map(h => h.sessionId), ['p2s']);

windowObj._cpExerciseProgress = { clientId: CID, items: [{ name: 'career-store' }] };
const viaA = composeClientNextSessionBrief(CID, { planId: 'pl-a' });
const viaB = composeClientNextSessionBrief(CID, { planId: 'pl-b' });
function lastKg(built) {
  const it = built && built.pack && (built.pack.items || []).find(x => x && x.name === 'Wyciskanie sztangi');
  const snaps = it && it.series && it.series.snapshots || [];
  const last = snaps.length ? snaps[snaps.length - 1] : null;
  return last && last.topSet ? last.topSet.kg : null;
}
eq('E2E-10 caller plan a last kg', lastKg(viaA), 80);
eq('E2E-10 caller plan b last kg', lastKg(viaB), 100);
ok('E2E-10 6D store not clobbered', windowObj._cpExerciseProgress
  && windowObj._cpExerciseProgress.items
  && windowObj._cpExerciseProgress.items[0]
  && windowObj._cpExerciseProgress.items[0].name === 'career-store');

ctx.latestClientPlan = function (id) {
  return id === CID ? { id: 'pl-b', clientId: CID } : null;
};
const viaAuto = composeClientNextSessionBrief(CID);
eq('E2E-10 auto latest plan last kg', lastKg(viaAuto), 100);
delete ctx.latestClientPlan;

const CID16 = 'c-e2e-d16';
windowObj.PL = windowObj.PL.concat([{
  id: 'pl-e2e-d16', clientId: CID16, name: 'D16',
  days: [{ exercises: [{ name: 'Wyciskanie sztangi', sets: '3', reps: '8-10' }] }]
}, {
  id: 'pl-e2e-amrap', clientId: CID16, name: 'AMRAP',
  days: [{ exercises: [{ name: 'Wyciskanie sztangi', sets: '3', reps: 'AMRAP' }] }]
}]);
windowObj.SE = windowObj.SE.concat([
  saveLive('d16a', CID16, '2026-09-01', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-d16' }),
  saveLive('d16b', CID16, '2026-09-08', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-d16' }),
  saveLive('d16c', CID16, '2026-09-15', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-d16' }),
  saveLive('amrapa', CID16, '2026-09-01', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-amrap' }),
  saveLive('amrapb', CID16, '2026-09-08', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-amrap' }),
  saveLive('amrapc', CID16, '2026-09-15', [
    liveEx('Wyciskanie sztangi', [
      Object.assign(work(80, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(80, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-e2e-amrap' })
]);
const viaD16 = composeClientNextSessionBrief(CID16, { planId: 'pl-e2e-d16' });
const recD16 = (viaD16.recs || []).find(r => r && r.name === 'Wyciskanie sztangi');
ok('E2E D16 DODAJ CIĘŻAR via caller', recD16 && recD16.action === 'DODAJ CIĘŻAR', recD16 ? recD16.action + ' ' + JSON.stringify(recD16.reasons) : 'no rec');
eq('E2E D16 target from plan hi', recD16 && recD16.facts && recD16.facts.target, 10);
const viaAmrap = composeClientNextSessionBrief(CID16, { planId: 'pl-e2e-amrap' });
const recAmrap = (viaAmrap.recs || []).find(r => r && r.name === 'Wyciskanie sztangi');
ok('E2E AMRAP no invented target', recAmrap && recAmrap.facts && recAmrap.facts.target == null);

if (failed) {
  console.error('\n' + failed + ' E2E checks failed');
  process.exit(1);
}
console.log('\nAll ex-progress E2E checks passed');
