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
  prToastText, clientExercisePRs, exerciseHistoryByDay, epley1RM, superseriesToastText,
  lastLoadForExercise, formatLastSetsSummary, lastSetsBlockHtml, exerciseLoadHistory,
  exerciseHistoryModalBodyHtml, exerciseLoggedSets, exerciseHistoryTotals
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
eq('key folds diacritics', exerciseNameKey('Rumuński ciąg z kettlem'), exerciseNameKey('rumunski ciag z kettlem'));
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

windowObj.SE = sessions.concat([
  {id: 's5', clientId: 'c1', date: '2026-08-20', source: 'planned', exercises: [{name: 'Przysiad', sets: [{kg: 999, reps: 1, setNo: 1}]}]}
]);
const last = lastLoadForExercise('c1', 'Przysiad');
eq('last skips planned', last && last.date, '2026-08-10');
eq('last sets count', last && last.sets && last.sets.length, 1);
eq('last summary', formatLastSetsSummary([
  {kg: 22.5, reps: 12}, {kg: 22.5, reps: 11}, {kg: 22.5, reps: 10, rir: '2'}
]), '22.5 × 12 · 22.5 × 11 · 22.5 × 10');
const block = lastSetsBlockHtml({
  name: 'Przysiad',
  lastDate: '2026-08-10',
  lastSets: [
    {setNo: 1, kg: 80, reps: 8, rir: '3'},
    {setNo: 2, kg: 85, reps: 5, rir: '2'}
  ]
});
eq('last html widget', /live-last-sets/.test(block) && /Ostatnio:/.test(block) && /openExerciseHistory/.test(block), true);
eq('last html summary', /80 × 8/.test(block) && /85 × 5/.test(block), true);
eq('empty last html', lastSetsBlockHtml({lastSets: []}), '');
const modalOne = exerciseHistoryModalBodyHtml([{
  date: '2026-08-10', time: '21:00',
  sets: [
    {setNo: 1, kg: 80, reps: 8},
    {setNo: 2, kg: 85, reps: 5}
  ]
}]);
eq('modal table headers', /Powt/.test(modalOne) && />KG</.test(modalOne) && /Obj/.test(modalOne), true);
eq('modal stamp', /2026-08-10 21:00/.test(modalOne), true);
eq('modal volume', /640 kg/.test(modalOne) && /425 kg/.test(modalOne), true);
eq('modal totals', /Σ/.test(modalOne) && />13</.test(modalOne) && />165</.test(modalOne), true);

windowObj.SE = sessions.concat([
  {id: 's5', clientId: 'c1', date: '2026-08-20', source: 'planned', exercises: [{name: 'Przysiad', sets: [{kg: 999, reps: 1, setNo: 1}]}]},
  {id: 's6', clientId: 'c1', date: '2026-09-06', source: 'live', exercises: [{name: 'Rumuński ciąg z kettlem', sets: [{kg: '16', reps: '12', setNo: 1}]}]}
]);
const lastAscii = lastLoadForExercise('c1', 'rumunski ciag z kettlem');
eq('last matches folded name', lastAscii && lastAscii.kg, '16');
eq('last folded date', lastAscii && lastAscii.date, '2026-09-06');

windowObj.SE = [
  {id: 'f1', clientId: 'c1', date: '2026-09-01', source: 'fitebo', exercises: [{name: 'Wyciskanie hantli na skosie', kg: 22.5, reps: 12}]},
  {id: 'f2', clientId: 'c1', date: '2026-09-08', source: 'fitebo', exercises: [{name: 'Wyciskanie hantli na skosie', kg: 24.5, reps: 8}]},
  {id: 'f3', clientId: 'c1', date: '2026-09-15', source: 'planned', exercises: [{name: 'Wyciskanie hantli na skosie', kg: 99, reps: 8}]}
];
const hist = exerciseLoadHistory('c1', 'Wyciskanie hantli na skosie');
eq('load hist skips planned', hist.map(h => h.date), ['2026-09-08', '2026-09-01']);
eq('load hist latest kg', hist[0].sets[0].kg, 24.5);
eq('load hist older reps', hist[1].sets[0].reps, 12);
eq('last nSessions two logs', lastLoadForExercise('c1', 'Wyciskanie hantli na skosie').nSessions, 2);
const histBlock = lastSetsBlockHtml({
  name: 'Wyciskanie hantli na skosie',
  lastHistory: hist
});
eq('hist html two sessions', /24\.5 × 8/.test(histBlock) && /2 sesji/.test(histBlock) && /openExerciseHistory/.test(histBlock), true);
const histModal = exerciseHistoryModalBodyHtml(hist);
eq('hist modal two dates', /2026-09-08/.test(histModal) && /2026-09-01/.test(histModal), true);
eq('hist modal extra heading', /Dodatkowe/.test(exerciseHistoryModalBodyHtml([{
  date: '2026-09-07', time: '21:00',
  sets: [
    {setNo: 1, kg: 20, reps: 12},
    {setNo: 2, kg: 22.5, reps: 12},
    {setNo: 3, kg: 22.5, reps: 12},
    {setNo: 4, kg: 22.5, reps: 12, extra: true}
  ]
}])), true);
eq('incline totals', JSON.stringify(exerciseHistoryTotals([
  {kg: 20, reps: 12}, {kg: 22.5, reps: 12}, {kg: 22.5, reps: 12}, {kg: 22.5, reps: 12}
])), JSON.stringify({reps: 48, kg: 87.5, obj: 1050}));
eq('expand 3x12', exerciseLoggedSets({name: 'Hack', sets: '3', kg: 60, reps: 12}).length, 3);
eq('no expand range', exerciseLoggedSets({sets: '3', kg: 22.5, reps: '8-10'}).length, 1);
eq('builder variant class', /builder-ex-hist/.test(lastSetsBlockHtml({lastSets: [{kg: 20, reps: 10}]}, {variant: 'builder'})), true);
eq('lookup by clientId', /Ostatnio:/.test(lastSetsBlockHtml({name: 'Wyciskanie hantli na skosie', clientId: 'c1'})), true);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy rekordów OK.');
