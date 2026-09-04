// Testy oceny treningu i historii sesji (bez przeglądarki). Ładuje 01-core.js w atrapie DOM.
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
  sessionRatingEmoji, sessionRatingLabel, isLoggedWorkout, completedWorkouts,
  sessionSetsCount, avgSessionRating, sessionTitle, sessionSourceLabel,
  sessionIsRecorded, sessionHappened, sessionHappenedTip
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

eq('emoji 1', sessionRatingEmoji(1), '😓');
eq('emoji 5', sessionRatingEmoji(5), '🔥');
eq('emoji 0 empty', sessionRatingEmoji(0), '');
eq('emoji string 4', sessionRatingEmoji('4'), '💪');
eq('label 3', sessionRatingLabel(3), '🙂 OK');
eq('label missing', sessionRatingLabel(9), '');

eq('logged client', isLoggedWorkout({source: 'client'}), true);
eq('logged live', isLoggedWorkout({source: 'live'}), true);
eq('logged exercises', isLoggedWorkout({exercises: [{name: 'Przysiad'}]}), true);
eq('booked not logged', isLoggedWorkout({source: 'gym', type: 'Sesja'}), false);
eq('empty not logged', isLoggedWorkout({}), false);
eq('null not logged', isLoggedWorkout(null), false);

const sessions = [
  {id: 'a', clientId: 'c1', date: '2026-08-10', createdAt: '2026-08-10T10:00:00', source: 'client', feedback: 5, type: 'Push'},
  {id: 'b', clientId: 'c1', date: '2026-08-12', createdAt: '2026-08-12T10:00:00', source: 'live', feedback: 4, type: 'Trening personalny'},
  {id: 'c', clientId: 'c1', date: '2026-08-11', createdAt: '2026-08-11T10:00:00', type: 'booked'},
  {id: 'd', clientId: 'c2', date: '2026-08-12', source: 'client', feedback: 5},
  {id: 'e', clientId: 'c1', date: '2026-08-12', createdAt: '2026-08-12T18:00:00', source: 'client', feedback: 2, type: 'Wieczór'}
];
const done = completedWorkouts('c1', sessions);
eq('logged count', done.length, 3);
eq('sort newest date first', done[0].id, 'e');
eq('sort same date by createdAt', done[1].id, 'b');
eq('excludes booked', done.some(s => s.id === 'c'), false);
eq('excludes other client', done.some(s => s.id === 'd'), false);

eq('avg skip zeros', avgSessionRating([{feedback: 5}, {feedback: 0}, {feedback: 4}]), 4.5);
eq('avg empty', avgSessionRating([]), 0);
eq('avg only invalid', avgSessionRating([{feedback: 0}, {feedback: 9}]), 0);
eq('avg one', avgSessionRating([{feedback: 3}]), 3);

eq('sets array objects', sessionSetsCount({exercises: [{sets: [{}, {}]}, {sets: [{}]}]}), 3);
eq('sets numeric string', sessionSetsCount({exercises: [{sets: '3'}]}), 3);
eq('sets missing', sessionSetsCount({}), 0);

eq('title prefers type', sessionTitle({type: 'Push', title: 'Sesja'}), 'Push');
eq('title fallback', sessionTitle({title: 'Sesja'}), 'Sesja');
eq('title default', sessionTitle({}), 'Trening');
eq('source client', sessionSourceLabel({source: 'client'}), 'Klient');
eq('source live', sessionSourceLabel({source: 'live'}), 'Live');
eq('source sala', sessionSourceLabel({type: 'personalny'}), 'Sala');

eq('happened live', sessionHappened({source: 'live'}), true);
eq('happened garmin', sessionHappened({source: 'garmin'}), true);
eq('planned not happened alone', sessionHappened({id: 'p1', clientId: 'c1', date: '2026-08-10', source: 'planned'}), false);
const pair = [
  {id: 'p1', clientId: 'c1', date: '2026-08-10', source: 'planned', type: 'Push'},
  {id: 'l1', clientId: 'c1', date: '2026-08-10', source: 'client', type: 'Push'}
];
eq('planned happened when same-day log', sessionHappened(pair[0], pair), true);
eq('other client planned not happened', sessionHappened({id: 'p2', clientId: 'c9', date: '2026-08-10', source: 'planned'}, pair), false);
eq('recorded live', sessionIsRecorded({source: 'live'}), true);
eq('recorded garmin', sessionIsRecorded({source: 'garmin'}), true);
eq('recorded planned false', sessionIsRecorded({source: 'planned'}), false);
eq('kpi skips planned pair', pair.filter(sessionIsRecorded).length, 1);
eq('kpi two logs same day', [
  {id: 'a', source: 'live'},
  {id: 'b', source: 'client'}
].filter(sessionIsRecorded).length, 2);
eq('tip logged has check', /Odbył się/.test(sessionHappenedTip({source: 'live', type: 'TP', time: '18:00'})), true);
eq('tip planned says zaplanowany', /zaplanowany/.test(sessionHappenedTip({source: 'planned', type: 'Push'})), true);
eq('tip planned fulfilled', /odbył się/.test(sessionHappenedTip(pair[0], pair)), true);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy historii sesji OK.');
