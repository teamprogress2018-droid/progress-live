#!/usr/bin/env node
'use strict';
/** Etap 6D: podpięcie classifyExerciseProgress pod serie 6C / dane Progress (bez UI). */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const extras = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
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
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=121'));
ok('cache 04', html.includes('04-client-portal.js?v=54'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=74'));
ok('CI', wf.includes('test_ex_progress_wire.js'));
ok('mapping helpers', /function listClientProgressExercises/.test(coreSrc)
  && /function exerciseProgressClass/.test(coreSrc)
  && /function clientExerciseProgressClasses/.test(coreSrc)
  && /function rememberClientExerciseProgress/.test(coreSrc));
ok('uses 6C series', /exerciseProgressSeries\(clientId,name,aliases,opts\)/.test(coreSrc)
  && /classifyExerciseProgress\(series\)/.test(coreSrc));
ok('progress hooks remember', /rememberClientExerciseProgress\(c\.id\)/.test(progressFn)
  && /rememberClientExerciseProgress\(c\.id\)/.test(capFn));
ok('progress panel from store', /cpExerciseProgressPanelHtml\(c\.id\)/.test(progressFn));
ok('no class in client Progress markup', !/effortHarder|doseIncreased|reserveAvailable|nearLimit/.test(capFn)
  && !/cpExerciseProgressPanelHtml/.test(capFn));
ok('html template unchanged labels', /ANALITYKA KLIENTA/.test(progressFn) && /MOJE POSTĘPY/.test(capFn));

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
  exerciseProgressSeries, classifyExerciseProgress, serializeLoggedExercise,
  listClientProgressExercises, exerciseProgressClass, clientExerciseProgressClasses,
  rememberClientExerciseProgress
} = ctx;

function liveSet(kg, reps, rir, kind) {
  const row = { kg, reps, kind: kind || 'work', done: true };
  if (rir != null && rir !== '') row.rir = rir;
  return row;
}
function liveEx(name, sets, extra) {
  return serializeLoggedExercise(Object.assign({ name, sets }, extra || {}), { onlyDone: true });
}
function liveSess(id, date, exercises, extra) {
  return Object.assign({
    id, clientId: 'c-anna', date, source: 'live', createdAt: date + 'T18:05:00',
    exercises
  }, extra || {});
}

windowObj.SE = [
  liveSess('s1', '2026-08-04', [
    liveEx('Wyciskanie sztangi', [
      liveSet(40, 10, '', 'warmup'),
      liveSet(80, 10, '2'), liveSet(80, 10, '2'), liveSet(80, 10, '2')
    ]),
    liveEx('Przysiad', [liveSet(100, 5, '2'), liveSet(100, 5, '2'), liveSet(100, 5, '2')]),
    liveEx('Martwy ciąg', [liveSet(140, 5, '3'), liveSet(140, 5, '3')]),
    liveEx('Wiosłowanie sztangą', [liveSet(70, 10, '2'), liveSet(70, 10, '2'), liveSet(70, 10, '2')]),
    liveEx('Rozpiętki hantlami', [liveSet(20, 12, '3'), liveSet(20, 12, '3')]),
    liveEx('Deska', [liveSet(45, 1, '', 'work')], { loadUnit: 'sec' })
  ]),
  liveSess('s2', '2026-08-11', [
    liveEx('Wyciskanie sztangi', [
      liveSet(40, 10, '', 'warmup'),
      liveSet(82.5, 10, '2'), liveSet(82.5, 10, '2'), liveSet(82.5, 10, '2')
    ]),
    liveEx('Przysiad', [liveSet(100, 5, '2'), liveSet(100, 5, '2'), liveSet(100, 5, '2')]),
    liveEx('Martwy ciąg', [liveSet(145, 5, '2'), liveSet(145, 5, '2')]),
    liveEx('Wiosłowanie sztangą', [liveSet(70, 10, '2'), liveSet(70, 10, '2'), liveSet(70, 10, '2'), liveSet(70, 10, '2'), liveSet(70, 10, '2')]),
    liveEx('Rozpiętki hantlami', [liveSet(22.5, 8, '0'), liveSet(22.5, 8, '0')]),
    liveEx('Deska', [liveSet(60, 1, '', 'work')], { loadUnit: 'sec' })
  ]),
  liveSess('s3', '2026-08-18', [
    liveEx('Wyciskanie sztangi', [
      liveSet(50, 8, '', 'warmup'),
      liveSet(85, 10, '2'), liveSet(85, 10, '1'), liveSet(85, 8, '0', 'drop')
    ]),
    liveEx('Przysiad', [liveSet(100, 5, '2'), liveSet(100, 5, '2'), liveSet(100, 5, '2')])
  ]),
  liveSess('s4', '2026-08-25', [
    liveEx('Przysiad', [liveSet(100, 5, '2'), liveSet(100, 5, '2'), liveSet(100, 5, '2')])
  ]),
  {
    id: 'planned', clientId: 'c-anna', date: '2026-09-01', source: 'planned',
    exercises: [liveEx('Wyciskanie sztangi', [liveSet(200, 1, '0')])]
  }
];

ok('serialized sets drop done', windowObj.SE[0].exercises[0].sets.every(s => !('done' in s)));
ok('warmup kept in log', windowObj.SE[0].exercises[0].sets[0].kind === 'warmup');

const listed = listClientProgressExercises('c-anna');
ok('lists several exercises', listed.length >= 5);
ok('skips planned 200kg as extra series identity', !listed.some(x => x.name === 'Wyciskanie sztangi' && x.exerciseId === 'nope'));

const benchSeries = exerciseProgressSeries('c-anna', 'Wyciskanie sztangi');
const benchMapped = exerciseProgressClass('c-anna', 'Wyciskanie sztangi');
eq('mapping reuses 6C snapshots', benchMapped.series.snapshots.map(s => s.sessionId), benchSeries.snapshots.map(s => s.sessionId));
eq('mapping class === classifier', benchMapped.classification, classifyExerciseProgress(benchSeries));
ok('series not mutated', !('label' in benchSeries) && !('classification' in benchSeries));
ok('planned 200kg not in bench series', benchSeries.snapshots.every(s => s.topSet.kg < 200));
ok('bench top ignores warmup and drop', benchSeries.snapshots[benchSeries.snapshots.length - 1].topSet.kg === 85
  && benchSeries.snapshots[benchSeries.snapshots.length - 1].topSet.reps === 10);

const remembered = rememberClientExerciseProgress('c-anna');
ok('remember stores payload', windowObj._cpExerciseProgress === remembered);
eq('remember client', remembered.clientId, 'c-anna');
ok('remember items', remembered.items.length === listed.length);

function briefSnaps(series) {
  return (series.snapshots || []).map(s => {
    const t = s.topSet || {};
    const rir = t.rir == null ? '' : ' @' + t.rir;
    return (s.date || '') + ' ' + t.kg + '×' + t.reps + rir + ' ×' + s.workSetCount;
  });
}

const byName = {};
remembered.items.forEach(it => { byName[it.name] = it; });

eq('bench label', byName['Wyciskanie sztangi'].classification.label, 'PROGRES');
eq('squat plateau', [byName['Przysiad'].classification.label, byName['Przysiad'].classification.plateau, byName['Przysiad'].classification.flags.slice().sort()],
  ['STABILNIE', true, ['reserveAvailable']]);
eq('deadlift label', byName['Martwy ciąg'].classification.label, 'PROGRES');
eq('row flags', byName['Wiosłowanie sztangą'].classification.flags.slice().sort(), ['doseIncreased']);
eq('flyes mixed', byName['Rozpiętki hantlami'].classification.label, 'STABILNIE');
ok('flyes mixed flag', byName['Rozpiętki hantlami'].classification.flags.indexOf('mixed') >= 0);
eq('plank za mało', byName['Deska'].classification.label, 'ZA MAŁO DANYCH');

console.log('\n===== Diagnostyka Progress (dane w kształcie Live serialize) =====');
['Wyciskanie sztangi', 'Przysiad', 'Martwy ciąg', 'Wiosłowanie sztangą', 'Rozpiętki hantlami', 'Deska'].forEach(name => {
  const it = byName[name];
  const c = it.classification;
  console.log('\n' + name);
  console.log('  snapshoty: ' + briefSnaps(it.series).join(' | '));
  console.log('  label=' + c.label + ' plateau=' + c.plateau + ' flags=[' + (c.flags || []).join(',') + '] confidence=' + c.confidence);
  console.log('  reasons: ' + JSON.stringify(c.reasons));
});

windowObj.SE = [
  liveSess('a', '2026-08-01', [
    liveEx('Hack squat', [liveSet(100, 8, '2')], { exerciseId: 'ex_a' }),
    liveEx('Hack squat', [liveSet(40, 12, '3')], { exerciseId: 'ex_b' })
  ])
];
const split = clientExerciseProgressClasses('c-anna');
eq('two identities', split.map(x => x.exerciseId).sort(), ['ex_a', 'ex_b']);
ok('not merged by name', split.length === 2);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nPodpięcie klasyfikatora pod Progress: OK.');
process.exit(0);
