#!/usr/bin/env node
'use strict';
/** Etap 6B: fundament danych do analizy progresji ćwiczenia (bez scoringu / UI). */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const fitebo = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

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

ok('cache 01', html.includes('01-core.js?v=119'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=78'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=71'));
ok('cache 10', html.includes('10-client-app.js?v=41'));
ok('CI', wf.includes('test_ex_progress_history.js'));
ok('live serialize', /serializeLoggedExercise\(e,\s*\{onlyDone:\s*true\}\)/.test(live));
ok('client serialize', /serializeLoggedExercise\(e,\s*\{onlyDone:\s*true\}\)/.test(client));
ok('live swap identity', /applyExerciseIdentity\(cur\)/.test(live));
ok('fitebo log identity', /applyExerciseIdentity==='function'\?applyExerciseIdentity\(mapped\)/.test(fitebo));
ok('core helpers', /function exerciseProgressVolume\(/.test(coreSrc) && /function exerciseMatchesProgress\(/.test(coreSrc));
ok('no score helper', !/function scoreExerciseProgress/.test(coreSrc));

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
  window: windowObj,
  document,
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
  Map,
  Set,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(coreSrc, ctx);

const {
  exerciseLoadHistory, serializeLoggedExercise, serializeLoggedSet,
  exerciseProgressVolume, exerciseProgressWorkSets, exerciseProgressBestEpley,
  exerciseMatchesProgress, resolveExerciseId, applyExerciseIdentity,
  mapPlanExercisesForClient, exerciseSetVolumeKg, epley1RM, setKindOf
} = ctx;

ok('setKind missing is work', setKindOf({}) === 'work' && setKindOf({ kind: 'warmup' }) === 'warmup');

windowObj.EX = [{ id: 'ex_bench_own', name: 'Wyciskanie sztangi' }];
windowObj.DEF_EX = [{ name: 'Przysiad tylni' }];

eq('custom lib id', resolveExerciseId({ name: 'Wyciskanie sztangi' }), 'ex_bench_own');
eq('def_ex no invented id', resolveExerciseId({ name: 'Przysiad tylni' }), '');
eq('keep existing id', resolveExerciseId({ name: 'Cokolwiek', exerciseId: 'ex_keep' }), 'ex_keep');
eq('fromName ignores stale id', resolveExerciseId({ name: 'Wyciskanie sztangi', exerciseId: 'ex_old' }, { fromName: true }), 'ex_bench_own');

const saved = serializeLoggedExercise({
  name: 'Wyciskanie sztangi',
  plannedName: 'Wyciskanie sztangi',
  alts: ['Bench press'],
  loadUnit: 'kg',
  sets: [
    { setNo: 1, kg: 40, reps: 10, kind: 'warmup', rir: '', done: true },
    { setNo: 2, kg: 80, reps: 10, kind: 'work', rir: 3, done: true },
    { setNo: 3, kg: 80, reps: 10, kind: 'work', rir: '3', done: false }
  ]
}, { onlyDone: true });
eq('serialize keeps name', saved.name, 'Wyciskanie sztangi');
eq('serialize stamps custom id', saved.exerciseId, 'ex_bench_own');
eq('serialize plannedName', saved.plannedName, 'Wyciskanie sztangi');
eq('serialize alts', saved.alts, ['Bench press']);
eq('serialize only done', saved.sets.length, 2);
eq('serialize rir string', saved.sets[1].rir, '3');
eq('serialize kind warmup', saved.sets[0].kind, 'warmup');
ok('serialize no extra fields', Object.keys(saved).sort().join(',') === 'alts,exerciseId,loadUnit,name,plannedName,sets');

const sessA = {
  id: 's1', clientId: 'c1', date: '2026-09-01', source: 'live', createdAt: 'a',
  exercises: [{
    name: 'Wyciskanie sztangi',
    sets: [{ setNo: 1, kg: 80, reps: 10, kind: 'work', rir: '3' }]
  }]
};
const sessB = {
  id: 's2', clientId: 'c1', date: '2026-09-08', source: 'live', createdAt: 'b',
  exercises: [{
    name: 'Wyciskanie sztangi',
    sets: [{ setNo: 1, kg: 82.5, reps: 10, kind: 'work', rir: '3' }]
  }]
};
windowObj.SE = [sessA, sessB];
const histAB = exerciseLoadHistory('c1', 'Wyciskanie sztangi', null, { limit: 0 });
eq('A two sessions', histAB.map(h => h.date), ['2026-09-08', '2026-09-01']);
eq('A newer kg', histAB[0].workSets[0].kg, 82.5);
eq('A older kg', histAB[1].workSets[0].kg, 80);
eq('A work volume newer', histAB[0].workVolume, 825);
eq('A work set count', histAB[0].workSetCount, 1);
ok('A best epley newer > older', histAB[0].bestEpley > histAB[1].bestEpley);

windowObj.SE = [
  {
    id: 'r1', clientId: 'c1', date: '2026-09-01', source: 'live',
    exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 10, kind: 'work', rir: '3' }] }]
  },
  {
    id: 'r2', clientId: 'c1', date: '2026-09-08', source: 'client',
    exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 10, kind: 'work', rir: '1' }] }]
  }
];
const histRir = exerciseLoadHistory('c1', 'Wyciskanie sztangi', null, { limit: 0 });
eq('B rir 1 vs 3', [histRir[0].workSets[0].rir, histRir[1].workSets[0].rir], ['1', '3']);
ok('B same load different rir', histRir[0].workSets[0].kg === 80 && histRir[1].workSets[0].kg === 80);

const mixSets = [
  { setNo: 1, kg: 40, reps: 10, kind: 'warmup' },
  { setNo: 2, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 3, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 4, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 5, kg: 60, reps: 8, kind: 'drop' },
  { setNo: 6, kg: 70, reps: 6, kind: 'cluster' }
];
eq('C progress volume 2400', exerciseProgressVolume(mixSets), 2400);
eq('C work set count 3', exerciseProgressWorkSets(mixSets).length, 3);
eq('C missing kind counts as work', exerciseProgressVolume([{ kg: 80, reps: 10 }, { kg: 40, reps: 10, kind: 'warmup' }]), 800);
const liveLike = [
  { name: 'Wyciskanie sztangi', sets: mixSets.map(s => Object.assign({ done: true }, s)) }
];
ok('C session KPI still includes warmup', exerciseSetVolumeKg(liveLike) === 2400 + 400 + 480 + 420);

windowObj.SE = [{
  id: 's-vol', clientId: 'c1', date: '2026-09-01', source: 'live',
  exercises: [{ name: 'Wyciskanie sztangi', sets: mixSets }]
}];
const histVol = exerciseLoadHistory('c1', 'Wyciskanie sztangi')[0];
eq('C hist workVolume', histVol.workVolume, 2400);
eq('C hist keeps all logged sets', histVol.sets.length, 6);
eq('C hist workSets only work', histVol.workSets.map(s => s.kind), ['work', 'work', 'work']);

windowObj.SE = [
  {
    id: 'old', clientId: 'c1', date: '2026-09-01', source: 'live', createdAt: 'a',
    exercises: [{ name: 'Wyciskanie sztangi', sets: [{ kg: 80, reps: 10, kind: 'work', rir: '3' }] }]
  },
  {
    id: 'neu', clientId: 'c1', date: '2026-09-08', source: 'live', createdAt: 'b',
    exercises: [{ exerciseId: 'ex_bench_own', name: 'Wyciskanie sztangi', sets: [{ kg: 82.5, reps: 10, kind: 'work', rir: '3' }] }]
  }
];
const histName = exerciseLoadHistory('c1', 'Wyciskanie sztangi', null, { limit: 0 });
eq('D fallback by name finds both', histName.map(h => h.sessionId), ['neu', 'old']);
const histId = exerciseLoadHistory('c1', 'Wyciskanie sztangi', null, { limit: 0, exerciseId: 'ex_bench_own' });
eq('D query with id still finds old nameless', histId.map(h => h.sessionId), ['neu', 'old']);
eq('D newer has exerciseId', histId[0].exerciseId, 'ex_bench_own');
eq('D older empty exerciseId', histId[1].exerciseId, '');

windowObj.SE = [
  {
    id: 'ida', clientId: 'c1', date: '2026-09-01', source: 'live',
    exercises: [{ exerciseId: 'ex_a', name: 'Hack squat', sets: [{ kg: 100, reps: 8, kind: 'work' }] }]
  },
  {
    id: 'idb', clientId: 'c1', date: '2026-09-08', source: 'live',
    exercises: [{ exerciseId: 'ex_b', name: 'Hack squat', sets: [{ kg: 40, reps: 12, kind: 'work' }] }]
  }
];
eq('no merge different ids', exerciseLoadHistory('c1', 'Hack squat', null, { exerciseId: 'ex_a' }).map(h => h.sessionId), ['ida']);
eq('other id isolated', exerciseLoadHistory('c1', 'Hack squat', null, { exerciseId: 'ex_b' }).map(h => h.sessionId), ['idb']);

windowObj.SE = [
  {
    id: 'hist-keep', clientId: 'c1', date: '2026-09-01', source: 'live',
    exercises: [{ name: 'Przysiad', sets: [{ kg: 80, reps: 5, kind: 'work', rir: '2' }] }]
  }
];
windowObj.PL = [{
  id: 'p1', clientId: 'c1', days: [{ rest: false, exercises: [{ name: 'Przysiad', sets: '3', reps: '5' }] }]
}];
const beforePlan = exerciseLoadHistory('c1', 'Przysiad');
windowObj.PL[0].days[0].exercises = [{ name: 'Martwy ciąg', sets: '3', reps: '5' }];
const afterPlan = exerciseLoadHistory('c1', 'Przysiad');
eq('E plan change keeps history', afterPlan.map(h => h.sessionId), beforePlan.map(h => h.sessionId));
eq('E still 80 kg', afterPlan[0].workSets[0].kg, 80);
const remapped = mapPlanExercisesForClient(windowObj.PL[0].days[0].exercises, 'c1', windowObj.PL[0]);
eq('E new plan name', remapped[0].name, 'Martwy ciąg');
eq('E squat history still there', exerciseLoadHistory('c1', 'Przysiad').length, 1);

ok('match prefers id both sides', exerciseMatchesProgress(
  { exerciseId: 'ex_a', name: 'Hack squat' },
  { exerciseId: 'ex_a', name: 'Inna nazwa' }
) === true);
ok('match rejects other id even same name', exerciseMatchesProgress(
  { exerciseId: 'ex_b', name: 'Hack squat' },
  { exerciseId: 'ex_a', name: 'Hack squat' }
) === false);
ok('alias fallback', exerciseMatchesProgress(
  { name: 'Bench', plannedName: 'Wyciskanie sztangi', alts: ['Wyciskanie sztangi'] },
  { name: 'Wyciskanie sztangi' }
) === true);

const ser = serializeLoggedSet({ kg: '82.5', reps: '10', rir: 1, kind: 'work' }, 0);
eq('set fields', Object.keys(ser).sort(), ['kg', 'kind', 'reps', 'rir', 'setNo'].sort());
eq('set rir kept', ser.rir, '1');
eq('set kg', ser.kg, 82.5);

ok('epley still available', epley1RM(80, 10) > 80);
ok('best epley from work only', exerciseProgressBestEpley(mixSets) === epley1RM(80, 10));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nHistoria progresji ćwiczenia: OK.');
process.exit(0);
