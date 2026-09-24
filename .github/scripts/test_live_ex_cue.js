#!/usr/bin/env node
'use strict';
/**
 * Etap 9A.1: Live OSTATNIO / DZISIAJ / SUGESTIA.
 * Paint-only. 7A→7B→7C raz na slot. progressWorkingSet nie jest źródłem SUGESTIA.
 * 6C–7C frozen.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

function gitOut(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return '';
  }
}
function loadBaseCore() {
  const refs = ['origin/main', 'main'];
  if (process.env.GITHUB_BASE_REF) refs.unshift('origin/' + process.env.GITHUB_BASE_REF, process.env.GITHUB_BASE_REF);
  for (let i = 0; i < refs.length; i++) {
    const src = gitOut('git show ' + refs[i] + ':01-core.js');
    if (src && src.indexOf('function exerciseLoadHistory') >= 0) return src;
  }
  return '';
}
function branchChangedFiles() {
  const base = gitOut('git merge-base HEAD origin/main')
    || gitOut('git merge-base HEAD main')
    || gitOut('git rev-parse HEAD~1');
  const sha = String(base || '').trim().split('\n')[0];
  if (!sha) return '';
  return gitOut('git diff --name-only ' + sha + '..HEAD');
}
const mainCore = loadBaseCore();
const changed = branchChangedFiles();

function sliceFn(src, start, endMark) {
  const a = src.indexOf(start);
  const b = src.indexOf(endMark);
  return a >= 0 && b > a ? src.slice(a, b) : '';
}

const recSrc = sliceFn(coreSrc, 'function recommendExerciseProgress', 'window.recommendExerciseProgress');
const briefSrc = sliceFn(coreSrc, 'function composeNextSessionProgress', 'window.composeNextSessionProgress');
const aggSrc = sliceFn(coreSrc, 'function aggregateClientProgress', 'window.aggregateClientProgress');
const histSrc = sliceFn(coreSrc, 'function exerciseLoadHistory', 'window.exerciseLoadHistory');
const classSrc = sliceFn(coreSrc, 'function classifyExerciseProgress', 'window.classifyExerciseProgress');
const pwsSrc = sliceFn(coreSrc, 'function progressWorkingSet', 'window.progressWorkingSet');
const renderSrc = sliceFn(live, 'function renderLiveExercises', 'const LIVE_ALT_MAX');
const cardSrc = sliceFn(live, 'function liveExCard', 'window.liveExCard');
const packSrc = sliceFn(live, 'function liveExCuePack', 'window.liveExCuePack');
const stripSrc = sliceFn(live, 'function liveExCueStripHtml', 'window.liveExCueStripHtml');
const suggestSrc = sliceFn(live, 'function liveExSuggestView', 'window.liveExSuggestView');
const endSrc = sliceFn(live, 'function liveEndSession', 'window.liveEndSession');
const cueBlock = live.slice(
  live.indexOf('function liveExCueKey'),
  live.indexOf('function liveExHistoryList')
);
const callerStart = extras.indexOf('function composeClientNextSessionBrief');
const callerBind = 'window.cpNextSessionBriefHtml=cpNextSessionBriefHtml';
const callerEnd = extras.indexOf(callerBind);
const callerSrc = callerStart >= 0 && callerEnd > callerStart
  ? extras.slice(callerStart, callerEnd + callerBind.length)
  : '';

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

ok('cache 01 frozen', html.includes('01-core.js?v=121'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=79'));
ok('cache 08 frozen', html.includes('08-client-profile-extras.js?v=75'));
ok('cache styles', html.includes('styles.css?v=107'));
ok('CI 1e0z8', wf.includes('test_live_ex_cue.js') && wf.includes('1e0z8'));
ok('CSS cue', styles.includes('.live-ex-cue') && styles.includes('.live-ex-cue-k') && styles.includes('.live-ns-posture'));

ok('one pack per render', /const cue=typeof liveExCuePack/.test(renderSrc)
  && /liveExCuePack\(n\)/.test(renderSrc)
  && (renderSrc.match(/liveExCuePack/g) || []).length === 2
  && !/liveExCuePack/.test(renderSrc.slice(renderSrc.indexOf('.map('))));
ok('cards get shared cue', /liveExCard\(ex,i,n,cue\)/.test(renderSrc));
ok('session 7C banner', /liveExCueSessionHtml\(cue\)/.test(renderSrc));
ok('card paints strip even collapsed', /liveExCueStripHtml\(ex,n,cue\)/.test(cardSrc)
  && /needsName\?''/.test(cardSrc.replace(/\s+/g, '')));
ok('strip has three rows', /data-cue="last"/.test(stripSrc)
  && /data-cue="today"/.test(stripSrc)
  && /data-cue="suggest"/.test(stripSrc)
  && /OSTATNIO/.test(stripSrc) && /DZISIAJ/.test(stripSrc) && /SUGESTIA/.test(stripSrc));
ok('pack calls 8 caller once', /composeClientNextSessionBrief\(st\.clientId,opts\)/.test(packSrc)
  && (packSrc.match(/composeClientNextSessionBrief/g) || []).length === 2);
ok('pack passes planId', /if\(st\.planId\)opts\.planId=st\.planId/.test(packSrc));
ok('last sets use planId', /if\(planId\)opts\.planId=planId/.test(live)
  && /exerciseLoadHistory\(clientId,ex\.name/.test(live));

ok('7A/7B/7C not inlined in Live', !/function recommendExerciseProgress/.test(live)
  && !/recommendExerciseProgress/.test(live)
  && !/function composeNextSessionProgress/.test(live)
  && !/composeNextSessionProgress/.test(live)
  && !/function aggregateClientProgress/.test(live)
  && !/aggregateClientProgress/.test(live));
ok('SUGESTIA not from progressWorkingSet', !/progressWorkingSet/.test(cueBlock)
  && !/progressWorkingSet/.test(suggestSrc)
  && !/progHint/.test(cueBlock));
ok('inputs still from session kg', /value="\$\{s\.kg\}"/.test(cardSrc)
  && /oninput="liveSetKg/.test(cardSrc));
ok('liveEndSession present', /function liveEndSession/.test(endSrc));
ok('live save/timer/sets untouched in 9A.1 helpers', !/liveEndSession/.test(cueBlock)
  && !/liveSetKg/.test(cueBlock)
  && !/liveAddSet/.test(cueBlock)
  && !/liveRemoveSet/.test(cueBlock)
  && !/liveSkipEx/.test(cueBlock)
  && !/liveSwapEx/.test(cueBlock)
  && !/liveStartRest/.test(cueBlock));

ok('01-core.js not in branch diff', changed.indexOf('01-core.js') === -1, changed);
ok('08 extras not in branch diff', changed.indexOf('08-client-profile-extras.js') === -1, changed);
if (mainCore) {
  eq('frozen 6C body', histSrc, sliceFn(mainCore, 'function exerciseLoadHistory', 'window.exerciseLoadHistory'));
  eq('frozen 6D body', classSrc, sliceFn(mainCore, 'function classifyExerciseProgress', 'window.classifyExerciseProgress'));
  eq('frozen 7A body', aggSrc, sliceFn(mainCore, 'function aggregateClientProgress', 'window.aggregateClientProgress'));
  eq('frozen 7B body', recSrc, sliceFn(mainCore, 'function recommendExerciseProgress', 'window.recommendExerciseProgress'));
  eq('frozen 7C body', briefSrc, sliceFn(mainCore, 'function composeNextSessionProgress', 'window.composeNextSessionProgress'));
  eq('frozen progressWorkingSet', pwsSrc, sliceFn(mainCore, 'function progressWorkingSet', 'window.progressWorkingSet'));
} else {
  ok('6C–7C freeze via branch diff (no base blob)', changed.indexOf('01-core.js') === -1);
}

ok('7B still D16', /zadany strop powtórzeń osiągnięty przy RIR ≥ 2 i równych seriach/.test(recSrc));
ok('7C still C2(d)', /nZmniejsz>=1&&nAdd===0/.test(briefSrc));

const documentStub = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], DEF_EX: [], WO: [],
  METRIC_ENTRIES: [],
  document: documentStub
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document: documentStub, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Map, Set, setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(coreSrc, ctx);
vm.runInContext(callerSrc, ctx);
vm.runInContext(`
  var _liveSlot = { clientId:'', planId:'', currentDayIdx:0, exercises:[] };
  function liveN(slot){ return slot===1||slot==='1'?1:0; }
  function liveRef(){ return _liveSlot; }
  function liveNormExName(n){
    return typeof exerciseNameKey==='function'?exerciseNameKey(n):String(n||'').toLowerCase().replace(/\\s+/g,' ').trim();
  }
  function escHtml(s){
    return String(s==null?'':s).replace(/[&<>"]/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
`, ctx);
vm.runInContext(cueBlock, ctx);

const {
  serializeLoggedExercise,
  exerciseLoadHistory,
  recommendExerciseProgress,
  composeClientNextSessionBrief,
  progressWorkingSet,
  liveExLastLine,
  liveExLastWorkSets,
  liveExTodayKg,
  liveExPlannedReps,
  liveExSuggestView,
  liveExCuePack,
  liveExCueStripHtml,
  liveExMatchCueRec,
  liveExFormatKgDelta
} = ctx;

ok('helpers loaded', typeof liveExCuePack === 'function'
  && typeof liveExCueStripHtml === 'function'
  && typeof composeClientNextSessionBrief === 'function'
  && typeof recommendExerciseProgress === 'function');

eq('last line empty', liveExLastLine([]), '—');
eq('last line kg×reps + RIR', liveExLastLine([
  { kg: 60, reps: 10, rir: '2' },
  { kg: 60, reps: 8, rir: '1' }
]), '60 × 10 @2 · 60 × 8 @1');
eq('last line without RIR', liveExLastLine([{ kg: 80, reps: 5 }]), '80 × 5');

eq('today kg from current work set', liveExTodayKg({
  sets: [
    { kind: 'warmup', kg: 40, reps: 8 },
    { kind: 'work', kg: 62.5, reps: 10 }
  ]
}), 62.5);
eq('today kg empty', liveExTodayKg({ sets: [{ kg: '', reps: '10' }] }), '');

eq('format 2.5', liveExFormatKgDelta(2.5), '2,5');
eq('suggest none', liveExSuggestView(null, 82.5).label, 'ZA MAŁO DANYCH');
eq('suggest up no number', liveExSuggestView({
  action: 'DODAJ CIĘŻAR',
  levers: { load: 'up', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80 }
}, 82.5).label, '↑ DODAJ CIĘŻAR');
eq('suggest up ignores today prefill', liveExSuggestView({
  action: 'DODAJ CIĘŻAR',
  levers: { load: 'up', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80 }
}, 999).label, '↑ DODAJ CIĘŻAR');
eq('suggest up with 7B suggestKg', liveExSuggestView({
  action: 'DODAJ CIĘŻAR',
  levers: { load: 'up', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80, suggestKg: 82.5 }
}, 999).label, '↑ DODAJ 2,5 KG');
eq('suggest hold', liveExSuggestView({
  action: 'UTRZYMAJ',
  levers: { load: 'hold', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80 }
}, 82.5).label, '= UTRZYMAJ');
eq('suggest down', liveExSuggestView({
  action: 'ZMNIEJSZ OBCIĄŻENIE',
  levers: { load: 'down', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80 }
}, 80).label, '↓ ZMNIEJSZ');
eq('suggest deload', liveExSuggestView({
  action: 'DELOAD',
  levers: { load: 'deload', reps: 'hold', dose: 'hold' },
  facts: { lastKg: 80 }
}, 80).kind, 'down');
eq('suggest DODAJ POWTÓRZENIA is load hold', liveExSuggestView({
  action: 'DODAJ POWTÓRZENIA',
  levers: { load: 'hold', reps: 'up', dose: 'hold' },
  facts: { lastKg: 80 }
}, 80).label, '= UTRZYMAJ');

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

const CID = 'c-cue';
const CIDB = 'c-cue-b';
const NAME = 'Wyciskanie sztangi';
windowObj.PL = [
  {
    id: 'pl-a', clientId: CID, name: 'Plan A',
    days: [{ exercises: [{ name: NAME, sets: '4', reps: '5' }] }]
  },
  {
    id: 'pl-b', clientId: CID, name: 'Plan B',
    days: [{ exercises: [{ name: NAME, sets: '3', reps: '8-10' }] }]
  }
];
windowObj.CL = [{ id: CID, name: 'Anna' }, { id: CIDB, name: 'Bartek' }];

windowObj.SE = [
  saveLive('a1', CID, '2026-09-13', [
    liveEx(NAME, [
      Object.assign(work(95, 5, '1'), { setNo: 1, done: true }),
      Object.assign(work(95, 5, '1'), { setNo: 2, done: true })
    ])
  ], { planId: 'pl-a' }),
  saveLive('a2', CID, '2026-09-20', [
    liveEx(NAME, [
      Object.assign(work(100, 5, '1'), { setNo: 1, done: true }),
      Object.assign(work(100, 4, '0'), { setNo: 2, done: true })
    ])
  ], { planId: 'pl-a' }),
  saveLive('b1', CID, '2026-09-01', [
    liveEx(NAME, [
      Object.assign(work(55, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(55, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(55, 10, '2'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-b' }),
  saveLive('b2', CID, '2026-09-10', [
    liveEx(NAME, [
      Object.assign(work(60, 10, '2'), { setNo: 1, done: true }),
      Object.assign(work(60, 10, '2'), { setNo: 2, done: true }),
      Object.assign(work(60, 8, '1'), { setNo: 3, done: true })
    ])
  ], { planId: 'pl-b' }),
  saveLive('x1', CIDB, '2026-09-22', [
    liveEx(NAME, [
      Object.assign(work(40, 10, '3'), { setNo: 1, done: true })
    ])
  ], { planId: 'pl-b' }),
  {
    id: 'draft-999', clientId: CID, date: '2026-09-23', source: 'live-draft', planId: 'pl-b',
    exercises: [{ name: NAME, sets: [work(999, 1, '0')] }]
  }
];

const mixed = exerciseLoadHistory(CID, NAME);
ok('default 6C still mixes plans', mixed.length >= 4
  && mixed.some(h => h.sessionId === 'a2')
  && mixed.some(h => h.sessionId === 'b2'));

ctx._liveSlot.clientId = CID;
ctx._liveSlot.planId = 'pl-b';
ctx._liveSlot.currentDayIdx = 0;
ctx._liveSlot.exercises = [{
  name: NAME,
  exerciseId: '',
  sets: [
    { setNo: 1, kind: 'work', kg: '62.5', reps: '8', done: false },
    { setNo: 2, kind: 'work', kg: '62.5', reps: '8', done: false }
  ]
}];

let briefCalls = 0;
const origBrief = ctx.composeClientNextSessionBrief;
ctx.composeClientNextSessionBrief = function wrappedBrief() {
  briefCalls++;
  return origBrief.apply(this, arguments);
};
windowObj.composeClientNextSessionBrief = ctx.composeClientNextSessionBrief;

let pwsCalls = 0;
const origPws = ctx.progressWorkingSet;
ctx.progressWorkingSet = function wrappedPws() {
  pwsCalls++;
  return origPws.apply(this, arguments);
};
windowObj.progressWorkingSet = ctx.progressWorkingSet;

const packB = liveExCuePack(0);
eq('pack once per slot', briefCalls, 1);
eq('pack plan B', packB.planId, 'pl-b');
ok('SUGESTIA pack did not call progressWorkingSet', pwsCalls === 0, String(pwsCalls));

const lastB = liveExLastWorkSets(ctx._liveSlot.exercises[0], CID, 'pl-b');
eq('OSTATNIO plan B kg', lastB.map(s => s.kg), [60, 60, 60]);
eq('OSTATNIO plan B reps', lastB.map(s => s.reps), [10, 10, 8]);
ok('OSTATNIO has RIR', lastB.some(s => String(s.rir) === '1') && lastB.some(s => String(s.rir) === '2'));
ok('OSTATNIO not Plan A 100', lastB.every(s => Number(s.kg) !== 100));

const lastA = liveExLastWorkSets(ctx._liveSlot.exercises[0], CID, 'pl-a');
ok('Plan A last is 100', lastA.some(s => Number(s.kg) === 100));

const recB = liveExMatchCueRec(ctx._liveSlot.exercises[0], packB.recs);
ok('plan B rec exists', !!(recB && recB.facts));
ok('SUGESTIA lastKg is Plan B 60 not Plan A 100', recB && recB.facts && recB.facts.lastKg === 60,
  recB && recB.facts ? String(recB.facts.lastKg) : 'no rec');
ok('SUGESTIA not from Plan A lastKg 100', !(recB && recB.facts && recB.facts.lastKg === 100));

const htmlB = liveExCueStripHtml(ctx._liveSlot.exercises[0], 0, packB);
ok('strip OSTATNIO 60 × 10', /OSTATNIO[\s\S]*60 × 10 @2/.test(htmlB), htmlB);
ok('strip OSTATNIO has RIR', /@2/.test(htmlB) && /@1/.test(htmlB));
ok('strip OSTATNIO hides Plan A', !/100 ×/.test(htmlB));
ok('DZISIAJ uses session kg', /DZISIAJ[\s\S]*62\.5 kg/.test(htmlB), htmlB);
ok('DZISIAJ uses plan reps', /8-10/.test(htmlB), htmlB);
ok('SUGESTIA from 7B not empty', /SUGESTIA[\s\S]*(UTRZYMAJ|DODAJ|ZMNIEJSZ|ZA MAŁO DANYCH)/.test(htmlB), htmlB);
ok('strip does not write inputs', !/liveSetKg/.test(htmlB) && !/<input/.test(htmlB));

eq('planned reps from Plan B', liveExPlannedReps(ctx._liveSlot.exercises[0], 0), '8-10');
ctx._liveSlot.planId = 'pl-a';
eq('planned reps from Plan A', liveExPlannedReps(ctx._liveSlot.exercises[0], 0), '5');
ctx._liveSlot.planId = 'pl-b';

/* Client isolation */
ctx._liveSlot.clientId = CIDB;
ctx._liveSlot.planId = 'pl-b';
ctx._liveSlot.exercises = [{ name: NAME, sets: [{ kg: '42', reps: '10', kind: 'work' }] }];
const packOther = liveExCuePack(0);
const lastOther = liveExLastWorkSets(ctx._liveSlot.exercises[0], CIDB, 'pl-b');
eq('other client last kg 40', lastOther.map(s => s.kg), [40]);
ok('other client does not see Anna 60', lastOther.every(s => Number(s.kg) !== 60));
const htmlOther = liveExCueStripHtml(ctx._liveSlot.exercises[0], 0, packOther);
ok('other client OSTATNIO 40', /40 × 10/.test(htmlOther));
ok('other client hides Anna', !/60 × 10/.test(htmlOther) && !/100 ×/.test(htmlOther));

/* Empty history fallback */
ctx._liveSlot.clientId = CID;
ctx._liveSlot.planId = 'pl-b';
ctx._liveSlot.exercises = [{
  name: 'Nowe bez historii XYZ',
  sets: [{ kg: '20', reps: '12', kind: 'work' }]
}];
const packEmpty = liveExCuePack(0);
const htmlEmpty = liveExCueStripHtml(ctx._liveSlot.exercises[0], 0, packEmpty);
ok('empty OSTATNIO em dash', /data-cue="last"[\s\S]*—/.test(htmlEmpty), htmlEmpty);
ok('empty SUGESTIA fallback', /SUGESTIA[\s\S]*ZA MAŁO DANYCH/.test(htmlEmpty), htmlEmpty);
ok('empty DZISIAJ still session kg', /DZISIAJ[\s\S]*20 kg/.test(htmlEmpty), htmlEmpty);

/* Reload / draft do not change recommendation */
ctx._liveSlot.exercises = [{
  name: NAME,
  sets: [{ kg: '62.5', reps: '8', kind: 'work' }]
}];
windowObj._cpExerciseProgress = null;
briefCalls = 0;
const packReload1 = liveExCuePack(0);
const rec1 = liveExMatchCueRec(ctx._liveSlot.exercises[0], packReload1.recs);
windowObj._cpExerciseProgress = null;
const packReload2 = liveExCuePack(0);
const rec2 = liveExMatchCueRec(ctx._liveSlot.exercises[0], packReload2.recs);
eq('reload same action', rec1 && rec1.action, rec2 && rec2.action);
eq('reload same lastKg', rec1 && rec1.facts && rec1.facts.lastKg, rec2 && rec2.facts && rec2.facts.lastKg);
ok('draft 999 not in last sets', liveExLastWorkSets(ctx._liveSlot.exercises[0], CID, 'pl-b').every(s => Number(s.kg) !== 999));
ok('draft 999 not in rec lastKg', rec1 && rec1.facts && rec1.facts.lastKg !== 999);

const pws = progressWorkingSet(
  { kg: '60', reps: '10' },
  { name: NAME, sets: '3', reps: '8-10' },
  { progression: 'double' }
);
ok('progressWorkingSet still prefills separately', pws && pws.kg && String(pws.kg) !== '60', JSON.stringify(pws));
ok('SUGESTIA label ≠ progHint', liveExSuggestView(rec1, pws && pws.kg).label.indexOf(String(pws && pws.hint || 'Progresja')) === -1);

ok('7B helper still works', recommendExerciseProgress(null).action === 'ZA MAŁO DANYCH');

if (failed) {
  console.error('\n' + failed + ' live-ex-cue checks failed');
  process.exit(1);
}
console.log('\nAll live-ex-cue tests passed');
