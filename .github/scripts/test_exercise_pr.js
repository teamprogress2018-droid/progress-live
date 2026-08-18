// Testy rekordów i historii ćwiczenia (bez przeglądarki). Ładuje 01-core.js w atrapie DOM.
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
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

const {
  exerciseNameKey, formatSetLoad, loggedSetRows, exercisePR, setBeatsPR,
  prToastText, clientExercisePRs, exerciseHistoryByDay, epley1RM, superseriesToastText
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

eq('key trim', exerciseNameKey('  Przysiad  tylni '), 'przysiad tylni');
eq('format', formatSetLoad(80, 8), '80 kg × 8');

const sessions = [
  {id: 's1', clientId: 'c1', date: '2026-08-01', createdAt: 'a', exercises: [{name: 'Przysiad', sets: [{kg: 80, reps: 8, setNo: 1}, {kg: 85, reps: 5, setNo: 2}]}]},
  {id: 's2', clientId: 'c1', date: '2026-08-10', createdAt: 'b', exercises: [{name: 'Przysiad', sets: [{kg: 90, reps: 5, setNo: 1}]}]},
  {id: 's3', clientId: 'c1', date: '2026-08-11', createdAt: 'c', exercises: [{name: 'Martwy ciąg', sets: [{kg: 140, reps: 3, setNo: 1}]}]},
  {id: 's4', clientId: 'c2', date: '2026-08-10', exercises: [{name: 'Przysiad', sets: [{kg: 200, reps: 1}]}]}
];

eq('history count', loggedSetRows('c1', 'Przysiad', sessions).length, 3);
eq('newest first', loggedSetRows('c1', 'Przysiad', sessions)[0].date, '2026-08-10');
eq('pr kg', exercisePR('c1', 'Przysiad', sessions).kg, 90);
eq('pr reps', exercisePR('c1', 'Przysiad', sessions).reps, 5);
eq('80x8 epley under 90x5', epley1RM(80, 8) < epley1RM(90, 5), true);
eq('beats 100x5', setBeatsPR(exercisePR('c1', 'Przysiad', sessions), 100, 5), true);
eq('no beat 80x5', setBeatsPR(exercisePR('c1', 'Przysiad', sessions), 80, 5), false);
eq('first log not toast', setBeatsPR(null, 100, 5), false);
eq('toast has name', prToastText('c1', 'Przysiad', 100, 5, sessions).indexOf('Przysiad') > 0, true);
eq('no toast weaker', prToastText('c1', 'Przysiad', 80, 5, sessions), '');
eq('superset toast combines pr', superseriesToastText({name: 'Wiosło', ssLabel: 'A2'},{prMsg: '🏆 Rekord: Przysiad · 100 kg × 5'}), '🏆 Rekord: Przysiad · 100 kg × 5 · Super-seria → A2 Wiosło');
eq('superset toast no-rest', superseriesToastText({name: 'Wiosło', ssLabel: 'A2'},{noRest:true}), 'Super-seria → A2 Wiosło (bez przerwy)');
eq('two lifts', clientExercisePRs('c1', sessions).length, 2);
eq('strongest first', clientExercisePRs('c1', sessions)[0].name, 'Martwy ciąg');
eq('days', exerciseHistoryByDay('c1', 'Przysiad', sessions).length, 2);
eq('other client isolated', !!exercisePR('c2', 'Przysiad', sessions), true);
eq('missing empty', exercisePR('c1', 'OHP', sessions), null);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy rekordów OK.');
