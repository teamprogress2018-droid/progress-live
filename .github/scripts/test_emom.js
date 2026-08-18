// Testy EMOM (przerwa do pełnej minuty). Ładuje 01-core.js w atrapie DOM.
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
  parsePlanExercise, isEmomFlag, isEmomExercise, emomRestSec,
  formatPlanExerciseLine, mapPlanExercisesForClient
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

eq('parse emom true', parsePlanExercise({name: 'Burpee', emom: true}).emom, true);
eq('parse emom 1', parsePlanExercise({name: 'Burpee', emom: '1'}).emom, true);
eq('parse default', parsePlanExercise({name: 'Burpee'}).emom, false);
eq('flag ss off', isEmomExercise({emom: true, ss: 'A'}), false);
eq('flag on', isEmomExercise({emom: true}), true);
eq('rest first set 12s', emomRestSec(1, 12), 48);
eq('overtime', emomRestSec(1, 70), 0);
eq('second set 75s', emomRestSec(2, 75), 45);
eq('exact minute', emomRestSec(1, 60), 0);
eq('line', formatPlanExerciseLine({name: 'Burpee', sets: 10, reps: 5, emom: true}), 'Burpee 10×5 EMOM');
eq('line no emom with ss', formatPlanExerciseLine({name: 'Burpee', sets: 10, reps: 5, emom: true, ss: 'A'}), 'Burpee 10×5');

const mapped = mapPlanExercisesForClient([{name: 'Burpee', sets: '8', reps: '5', emom: true}], 'c1');
eq('mapped emom', mapped[0].emom, true);
eq('mapped kind', mapped[0].sets[0].kind, 'emom');
eq('mapped rounds', mapped[0].sets.length, 8);

const ssMap = mapPlanExercisesForClient([
  {name: 'Burpee', sets: '3', reps: '5', emom: true, ss: 'A'},
  {name: 'Squat', sets: '3', reps: '5', ss: 'A'}
], 'c1');
eq('ss disables emom', ssMap[0].emom, false);
eq('ss kind work', ssMap[0].sets[0].kind, 'work');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy EMOM OK.');
