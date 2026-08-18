// Testy super-serii (grupowanie A1/A2 i kolejność rund).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
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
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

const {
  parsePlanExercise, applySsLabels, ssNextAfterSet, ssAdvanceIdx,
  mapPlanExercisesForClient, formatDayExerciseLines
} = ctx;

let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

eq('parse ss', parsePlanExercise({name: 'RDL', ss: 'A'}).ss, 'A');

const labeled = applySsLabels([
  {name: 'Przysiad', ss: 'x'},
  {name: 'Wiosłowanie', ss: 'x'},
  {name: 'Facepull', ss: ''},
  {name: 'Uginanie', ss: 'y'},
  {name: 'Prostowanie', ss: 'y'}
]);
eq('A1', labeled[0].ssLabel, 'A1');
eq('A2', labeled[1].ssLabel, 'A2');
eq('solo empty', labeled[2].ssLabel, '');
eq('B1', labeled[3].ssLabel, 'B1');
eq('B2', labeled[4].ssLabel, 'B2');

const orphan = applySsLabels([{name: 'Solo', ss: 'A'}]);
eq('orphan cleared', orphan[0].ss, '');

function fake(name, ss, n) {
  return {name, ss, sets: Array.from({length: n}, () => ({done: false}))};
}
const A = fake('Przysiad', 'g', 2);
const B = fake('Wiosłowanie', 'g', 2);
applySsLabels([A, B]);
A.sets[0].done = true;
eq('after A1 → partner B', ssNextAfterSet([A, B], 0), {kind: 'partner', exIdx: 1});
B.sets[0].done = true;
eq('after B1 → rest A', ssNextAfterSet([A, B], 1), {kind: 'rest', exIdx: 0});
A.sets[1].done = true;
eq('after A2 → partner B', ssNextAfterSet([A, B], 0), {kind: 'partner', exIdx: 1});
B.sets[1].done = true;
eq('after B2 → advance', ssNextAfterSet([A, B], 1), {kind: 'advance'});
eq('advance idx after group', ssAdvanceIdx([A, B], 0), -1);

const C = fake('Facepull', '', 2);
C.sets[0].done = true;
eq('normal rest', ssNextAfterSet([C], 0), {kind: 'rest', exIdx: 0});
C.sets[1].done = true;
eq('normal advance', ssNextAfterSet([C], 0), {kind: 'advance'});

const mapped = mapPlanExercisesForClient([
  {name: 'Przysiad', sets: '3', reps: '8', ss: 'A'},
  {name: 'Wiosłowanie', sets: '3', reps: '10', ss: 'A'}
], 'c1');
eq('mapped A1', mapped[0].ssLabel, 'A1');
eq('mapped A2', mapped[1].ssLabel, 'A2');

eq(
  'preview join',
  formatDayExerciseLines([
    {name: 'Przysiad', sets: '4', reps: '8', ss: 'A'},
    {name: 'Wiosłowanie', sets: '4', reps: '10', ss: 'A'}
  ], 'c1'),
  'A1 Przysiad 4×8 + A2 Wiosłowanie 4×10'
);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy super-serii przeszły.');
