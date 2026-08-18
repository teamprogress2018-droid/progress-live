// Testy %1RM → kg (bez przeglądarki). Ładuje 01-core.js w atrapie DOM.
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
  guessLiftFamily, parsePct1RM, roundToPlate, epley1RM, parsePlanExercise,
  officialLift1RMs, weightFromPct1RM, mapPlanExercisesForClient, formatPlanExerciseLine
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

eq('family squat', guessLiftFamily('Przysiad tylni'), 'squat');
eq('family goblet', guessLiftFamily('Goblet squat'), 'squat');
eq('family deadlift', guessLiftFamily('Martwy ciąg'), 'deadlift');
eq('family rdl', guessLiftFamily('RDL hantle'), 'deadlift');
eq('family ohp before bench', guessLiftFamily('Wyciskanie żołnierskie'), 'ohp');
eq('family ohp seated', guessLiftFamily('Wyciskanie hantli siedząc'), 'ohp');
eq('family bench', guessLiftFamily('Wyciskanie sztangi leżąc'), 'bench');
eq('family french not bench', guessLiftFamily('Wyciskanie francuskie'), '');
eq('pct 75%', parsePct1RM('75%'), '75');
eq('pct 75', parsePct1RM('75'), '75');
eq('round 90', roundToPlate(90), '90');
eq('round 87.4', roundToPlate(87.4), '87.5');
eq('epley 100x5', Math.round(epley1RM(100, 5)), 117);

const parsed = parsePlanExercise('Przysiad 4x8 @75%');
eq('parse name', parsed.name, 'Przysiad');
eq('parse sets', parsed.sets, '4');
eq('parse pct', parsed.pct1rm, '75');
eq('parse kg empty', parsed.kg, '');

const obj = parsePlanExercise({name: 'Martwy ciąg', sets: 3, reps: 5, kg: '80%', pct1rm: ''});
eq('obj kg as pct', obj.pct1rm, '80');
eq('obj kg cleared', obj.kg, '');

windowObj.METRIC_ENTRIES = [
  {clientId: 'c1', groupId: 'mg3', date: '2026-01-01', values: {m1: 120, m2: 145, m3: 95, m4: 72}}
];
windowObj.SE = [];
eq('official squat', officialLift1RMs('c1').squat, 120);

const w = weightFromPct1RM('c1', 'Przysiad tylni', 75);
eq('75% of 120', w.kg, '90');

const mapped = mapPlanExercisesForClient([{name: 'Przysiad', sets: '4', reps: '8', pct1rm: '75'}], 'c1');
eq('mapped kg', mapped[0].sets[0].kg, '90');
eq('mapped hint has 75', mapped[0].kgHint.indexOf('75%') >= 0, true);

windowObj.SE = [{
  clientId: 'c1', date: '2026-08-01', createdAt: 'z', exercises: [
    {name: 'Przysiad', sets: [{kg: 100, reps: 5}]}
  ]
}];
const mappedWithLast = mapPlanExercisesForClient([{name: 'Przysiad', sets: '4', reps: '8', pct1rm: '75'}], 'c1');
eq('pct beats last-load', mappedWithLast[0].sets[0].kg, '90');

const noRm = weightFromPct1RM('c2', 'Przysiad', 75);
eq('missing 1RM empty kg', noRm.kg, '');
eq('missing 1RM hint', /Siła bazowa/.test(noRm.hint), true);

eq('parse plain still works', parsePlanExercise('Wyciskanie 4x8').name, 'Wyciskanie');
eq('parse plain sets', parsePlanExercise('Wyciskanie 4x8').sets, '4');
eq('parse @kg', parsePlanExercise('RDL 4x8 @80kg').kg, '80');
eq('parse @kg no pct', parsePlanExercise('RDL 4x8 @80kg').pct1rm, '');
eq('preview line', formatPlanExerciseLine({name: 'Przysiad', sets: '4', reps: '8', pct1rm: '75'}, 'c1'), 'Przysiad 4×8 @75% → 90kg');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy %1RM przeszły.');
