// Testy warmup / drop / AMRAP (bez przeglądarki). Ładuje 01-core.js w atrapie DOM.
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
  parsePlanExercise, expandExerciseSets, skipRestBeforeSet, restSecAfterSet,
  formatSetKindTag, formatPlanExerciseLine, isWorkingSet, setKindBadge,
  mapPlanExercisesForClient
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

eq('parse wu', parsePlanExercise({name: 'Przysiad', wu: 2, drop: 1, amrap: true}).wu, 2);
eq('parse drop', parsePlanExercise({name: 'Przysiad', drop: '2'}).drop, 2);
eq('parse amrap', parsePlanExercise({name: 'Przysiad', amrap: '1'}).amrap, true);
eq('parse amrap false', parsePlanExercise({name: 'Przysiad'}).amrap, false);
eq('wu cap 2', parsePlanExercise({name: 'X', wu: 9}).wu, 2);

const expanded = expandExerciseSets(
  {name: 'Przysiad', sets: '3', reps: '8', wu: 2, drop: 2, amrap: true, kg: '100'},
  {plannedKg: '100'}
);
eq('len 2wu+3+2drop', expanded.length, 7);
eq('first warmup', expanded[0].kind, 'warmup');
eq('warmup kg 50%', expanded[0].kg, '50');
eq('second warmup 70%', expanded[1].kg, '70');
eq('first work', expanded[2].kind, 'work');
eq('last work amrap', expanded[4].kind, 'amrap');
eq('amrap reps empty', expanded[4].reps, '');
eq('drop1', expanded[5].kind, 'drop');
eq('drop1 kg 80%', expanded[5].kg, '80');
eq('drop2 kg 60%', expanded[6].kg, '60');

eq('skip rest before drop', skipRestBeforeSet(expanded[5]), true);
eq('no skip before work', skipRestBeforeSet(expanded[2]), false);
eq('rest after warmup', restSecAfterSet({restSec: 90}, expanded[0], expanded[1]), 45);
eq('rest 0 before drop', restSecAfterSet({restSec: 90}, expanded[4], expanded[5]), 0);
eq('rest after work', restSecAfterSet({restSec: 90}, expanded[2], expanded[3]), 90);

eq('tag', formatSetKindTag({wu: 2, drop: 1, amrap: true}), 'WU2 AMRAP DROP1');
eq('line', formatPlanExerciseLine({name: 'Przysiad', sets: 4, reps: 8, wu: 1, amrap: true}), 'Przysiad 4×8 WU1 AMRAP');
eq('badge W', setKindBadge('warmup'), 'W');
eq('working amrap', isWorkingSet({kind: 'amrap'}), true);
eq('not working wu', isWorkingSet({kind: 'warmup'}), false);
eq('legacy working', isWorkingSet({kg: 80}), true);

const ssExp = expandExerciseSets(
  {name: 'Przysiad', sets: '3', reps: '8', wu: 2, drop: 2, ss: 'A', kg: '100'},
  {plannedKg: '100'}
);
eq('ss skips wu/drop', ssExp.length, 3);
eq('ss all work', ssExp.every(s => s.kind === 'work'), true);
eq('ss tag no wu/drop', formatSetKindTag({name: 'X', wu: 2, drop: 1, ss: 'A', amrap: true}), 'AMRAP');

const mapped = mapPlanExercisesForClient([{name: 'Przysiad', sets: '3', reps: '8', wu: 1, amrap: true, kg: '80'}], 'c1');
eq('mapped has warmup', mapped[0].sets[0].kind, 'warmup');
eq('mapped last amrap', mapped[0].sets[mapped[0].sets.length - 1].kind, 'amrap');
eq('mapped amrap reps empty', mapped[0].sets[mapped[0].sets.length - 1].reps, '');

const ssMapped = mapPlanExercisesForClient([{name: 'Burpee', sets: '3', reps: '5', wu: 2, drop: 1, ss: 'A', amrap: true}], 'c1');
eq('ss mapped wu 0', ssMapped[0].wu, 0);
eq('ss mapped drop 0', ssMapped[0].drop, 0);
eq('ss mapped keeps amrap', ssMapped[0].amrap, true);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy warmup/drop/AMRAP OK.');
