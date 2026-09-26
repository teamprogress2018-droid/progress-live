#!/usr/bin/env node
'use strict';
/** Etap 6C: fakty progresji ćwiczenia (bez werdyktu PROGRES/PLATEAU/REGRES). */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
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

ok('cache 01', html.includes('01-core.js?v=126'));
ok('CI', wf.includes('test_ex_progress_facts.js'));
ok('no score helper', !/function scoreExerciseProgress/.test(coreSrc));
ok('series still facts-only', /function classifyExerciseProgress/.test(coreSrc));
ok('amrap is progress work', /k==='work'\|\|k==='amrap'/.test(coreSrc));
ok('no rirFromRpe in parser', /function parseProgressRir[\s\S]*?window\.parseProgressRir/.test(coreSrc)
  && !/function parseProgressRir[\s\S]{0,500}rirFromRpe/.test(coreSrc));

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
  exerciseLoadHistory, exerciseProgressSnapshot, exerciseProgressDelta, exerciseProgressSeries,
  parseProgressRir, exerciseProgressVolume, exerciseProgressWorkSets, isWorkingSet, isProgressWorkSet,
  epley1RM, exerciseSetVolumeKg, rirFromRpe
} = ctx;

function sess(id, date, exercises, extra) {
  return Object.assign({
    id, clientId: 'c1', date, source: 'live', createdAt: date + 'T10:00:00',
    exercises
  }, extra || {});
}
function work(kg, reps, rir, kind) {
  const row = { kg, reps, kind: kind || 'work' };
  if (rir != null && rir !== '') row.rir = rir;
  return row;
}

ok('working set still includes cluster', isWorkingSet({ kind: 'cluster' }) === true);
ok('progress work excludes cluster', isProgressWorkSet({ kind: 'cluster' }) === false);
ok('progress work includes amrap', isProgressWorkSet({ kind: 'amrap' }) === true);
ok('progress work includes missing kind', isProgressWorkSet({}) === true);

eq('rir 3', parseProgressRir('3'), 3);
eq('rir 0', parseProgressRir(0), 0);
eq('rir RIR 2', parseProgressRir('RIR 2'), 2);
eq('rir 2.5', parseProgressRir('2.5'), 2.5);
eq('rir empty', parseProgressRir(''), null);
eq('rir missing', parseProgressRir(null), null);
eq('rir range', parseProgressRir('2-3'), null);
eq('rir rpe label', parseProgressRir('RPE 8'), null);
eq('rir rpe number', parseProgressRir('8'), null);
eq('rir 7 leak', parseProgressRir(7), null);
ok('rpe helper still converts for plans', rirFromRpe('8') === '2');
ok('parser does not use plan conversion', parseProgressRir('RPE 8') === null && rirFromRpe('8') === '2');

windowObj.SE = [
  sess('s1', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '3')] }]),
  sess('s2', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(82.5, 10, '2')] }]),
  sess('s3', '2026-09-15', [{ name: 'Wyciskanie sztangi', sets: [work(85, 9, '1')] }])
];
const series3 = exerciseProgressSeries('c1', 'Wyciskanie sztangi');
eq('3 snaps chrono', series3.snapshots.map(s => s.sessionId), ['s1', 's2', 's3']);
eq('3 two steps', series3.steps.length, 2);
eq('3 top kg', series3.snapshots.map(s => s.topSet.kg), [80, 82.5, 85]);
eq('3 top reps', series3.snapshots.map(s => s.topSet.reps), [10, 10, 9]);
eq('3 rir', series3.snapshots.map(s => s.rir.top), [3, 2, 1]);
eq('3 e1rm', series3.snapshots.map(s => s.bestEpley), [
  Math.round(epley1RM(80, 10) * 100) / 100,
  Math.round(epley1RM(82.5, 10) * 100) / 100,
  Math.round(epley1RM(85, 9) * 100) / 100
]);
eq('3 step1 kg dir', series3.steps[0].dir.kg, 'up');
eq('3 step1 reps dir', series3.steps[0].dir.reps, 'flat');
eq('3 step1 rir dir', series3.steps[0].dir.rir, 'down');
eq('3 step2 kg dir', series3.steps[1].dir.kg, 'up');
eq('3 step2 reps dir', series3.steps[1].dir.reps, 'down');
ok('3 no verdict keys', !('verdict' in series3) && !('progress' in series3) && !series3.label);
ok('3 step delta has no class', !('progress' in series3.steps[0].delta) && !('plateau' in series3.steps[0].delta) && !('regress' in series3.steps[0].delta));
ok('3 dump has no PROGRES verdict', !/"PROGRES"|"STABILNIE"|"PLATEAU"|"REGRES"/.test(JSON.stringify(series3)));

windowObj.SE = [
  sess('a', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '3')] }]),
  sess('b', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '1')] }])
];
const sameLoad = exerciseProgressDelta(
  exerciseProgressSnapshot(exerciseLoadHistory('c1', 'Wyciskanie sztangi')[1]),
  exerciseProgressSnapshot(exerciseLoadHistory('c1', 'Wyciskanie sztangi')[0])
);
eq('same kg', sameLoad.deltaKg, 0);
eq('same reps', sameLoad.deltaReps, 0);
eq('same e1rm', sameLoad.deltaE1RM, 0);
eq('rir harder', sameLoad.deltaRir, -2);
eq('rir available', sameLoad.rirAvailable, true);
ok('same load not named progres', !('progress' in sameLoad));

windowObj.SE = [
  sess('x', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '3')] }]),
  sess('y', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(85, 9, '0')] }])
];
const grind = exerciseProgressSeries('c1', 'Wyciskanie sztangi');
const gd = grind.steps[0].delta;
ok('grind kg up', gd.deltaKg > 0);
ok('grind reps down', gd.deltaReps < 0);
ok('grind e1rm up', gd.deltaE1RM > 0);
ok('grind volume down', gd.deltaVolume < 0);
eq('grind rir to 0', gd.deltaRir, -3);
ok('grind not progres', !/"PROGRES"/.test(JSON.stringify(grind)) && !('progress' in gd));
eq('grind dirs', [grind.steps[0].dir.kg, grind.steps[0].dir.reps, grind.steps[0].dir.rir], ['up', 'down', 'down']);

windowObj.SE = [
  sess('n1', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '')] }]),
  sess('n2', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(82.5, 10)] }])
];
const noRir = exerciseProgressSeries('c1', 'Wyciskanie sztangi');
eq('missing rir still kg up', noRir.steps[0].dir.kg, 'up');
eq('missing rir not available', noRir.steps[0].delta.rirAvailable, false);
eq('missing rir delta null', noRir.steps[0].delta.deltaRir, null);

windowObj.SE = [
  sess('u1', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '2'), work(80, 10, '2'), work(80, 10, '2')] }]),
  sess('u2', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '2'), work(80, 10, '2'), work(80, 10, '2'), work(80, 8, '1'), work(80, 8, '1')] }])
];
const uneven = exerciseProgressSeries('c1', 'Wyciskanie sztangi');
eq('uneven counts', [uneven.snapshots[0].workSetCount, uneven.snapshots[1].workSetCount], [3, 5]);
eq('uneven delta count', uneven.steps[0].delta.deltaWorkSetCount, 2);
ok('uneven volume up', uneven.steps[0].delta.deltaVolume > 0);

const mix = [
  { setNo: 1, kg: 40, reps: 10, kind: 'warmup' },
  { setNo: 2, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 3, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 4, kg: 80, reps: 10, kind: 'work', rir: '2' },
  { setNo: 5, kg: 80, reps: 12, kind: 'amrap', rir: '0' },
  { setNo: 6, kg: 60, reps: 8, kind: 'drop' },
  { setNo: 7, kg: 70, reps: 6, kind: 'cluster' },
  { setNo: 8, kg: 70, reps: 5, kind: 'restpause' }
];
eq('wu excluded volume', exerciseProgressVolume(mix), 80 * 10 * 3 + 80 * 12);
eq('amrap counted', exerciseProgressWorkSets(mix).map(s => s.kind), ['work', 'work', 'work', 'amrap']);
eq('specials out', exerciseProgressWorkSets(mix).some(s => /drop|cluster|restpause|warmup/.test(s.kind)), false);
windowObj.SE = [sess('mix', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: mix }])];
const mixSnap = exerciseProgressSnapshot(exerciseLoadHistory('c1', 'Wyciskanie sztangi')[0]);
eq('mix work count', mixSnap.workSetCount, 4);
eq('mix volume', mixSnap.workVolume, 80 * 10 * 3 + 80 * 12);
eq('mix top is amrap epley', mixSnap.topSet.kind, 'amrap');
eq('mix top reps 12', mixSnap.topSet.reps, 12);

windowObj.SE = [sess('dup', '2026-09-01', [
  { name: 'Przysiad', sets: [work(80, 5, '2')] },
  { name: 'Przysiad', sets: [work(85, 4, '1')] }
])];
const merged = exerciseLoadHistory('c1', 'Przysiad');
eq('merge one session row', merged.length, 1);
eq('merge set count', merged[0].workSetCount, 2);
eq('merge volume', merged[0].workVolume, 80 * 5 + 85 * 4);

windowObj.SE = [
  sess('old', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '3')] }]),
  sess('neu', '2026-09-08', [{ exerciseId: 'ex_bench_own', name: 'Wyciskanie sztangi', sets: [work(82.5, 10, '2')] }])
];
windowObj.EX = [{ id: 'ex_bench_own', name: 'Wyciskanie sztangi' }];
const compat = exerciseProgressSeries('c1', 'Wyciskanie sztangi', null, { exerciseId: 'ex_bench_own' });
eq('old+new both in series', compat.snapshots.map(s => s.sessionId), ['old', 'neu']);
eq('compat kg up', compat.steps[0].dir.kg, 'up');

windowObj.SE = [sess('ids', '2026-09-01', [
  { exerciseId: 'ex_a', name: 'Hack squat', sets: [work(100, 8, '2')] },
  { exerciseId: 'ex_b', name: 'Hack squat', sets: [work(40, 12, '3')] }
])];
eq('name query two identities', exerciseLoadHistory('c1', 'Hack squat').map(h => h.exerciseId).sort(), ['ex_a', 'ex_b']);
eq('id query isolated', exerciseLoadHistory('c1', 'Hack squat', null, { exerciseId: 'ex_a' }).map(h => h.exerciseId), ['ex_a']);
eq('id a volume', exerciseLoadHistory('c1', 'Hack squat', null, { exerciseId: 'ex_a' })[0].workVolume, 800);

windowObj.SE = [
  sess('pl1', '2026-09-01', [{ name: 'Deska', loadUnit: 'sec', sets: [{ kg: 45, reps: 1, kind: 'work' }] }]),
  sess('pl2', '2026-09-08', [{ name: 'Deska', loadUnit: 'sec', sets: [{ kg: 60, reps: 1, kind: 'work' }] }])
];
const plankHist = exerciseLoadHistory('c1', 'Deska');
const plankSnap = exerciseProgressSnapshot(plankHist[0]);
eq('plank unit', plankSnap.loadUnit, 'sec');
eq('plank not comparable', plankSnap.comparable, false);
eq('plank no epley', plankSnap.bestEpley, null);
eq('plank no volume kg', plankSnap.workVolume, null);
const plankSeries = exerciseProgressSeries('c1', 'Deska');
eq('plank excluded from comparable window', plankSeries.snapshots.length, 0);

windowObj.SE = [
  sess('wuonly', '2026-09-01', [{ name: 'Wyciskanie sztangi', sets: [{ kg: 40, reps: 10, kind: 'warmup' }] }]),
  sess('real', '2026-09-08', [{ name: 'Wyciskanie sztangi', sets: [work(80, 10, '2')] }])
];
const skipped = exerciseProgressSeries('c1', 'Wyciskanie sztangi');
eq('zero work not in trend', skipped.snapshots.map(s => s.sessionId), ['real']);
eq('zero work still in raw hist', exerciseLoadHistory('c1', 'Wyciskanie sztangi').length, 2);

const liveLike = [{ name: 'X', sets: mix.map(s => Object.assign({ done: true }, s)) }];
ok('session KPI still counts warmup', exerciseSetVolumeKg(liveLike) > exerciseProgressVolume(mix));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nFakty progresji ćwiczenia: OK.');
process.exit(0);
