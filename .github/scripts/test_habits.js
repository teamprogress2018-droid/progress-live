// Testy nawyków i streaku (bez przeglądarki). Ładuje 01-core.js w atrapie DOM.
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
  ymdAdd, isHabit, habitDoneOn, habitStreak, toggleHabitDay, habitWeek
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

const today = '2026-08-18';
eq('ymdAdd +1', ymdAdd(today, 1), '2026-08-19');
eq('ymdAdd -1', ymdAdd(today, -1), '2026-08-17');
eq('ymdAdd month', ymdAdd('2026-01-31', 1), '2026-02-01');

eq('isHabit kind', isHabit({kind: 'habit'}), true);
eq('isHabit repeat', isHabit({repeat: 'daily'}), true);
eq('isHabit task', isHabit({kind: 'task', status: 'open'}), false);
eq('isHabit empty', isHabit({}), false);

eq('done empty', habitDoneOn({doneDates: []}, today), false);
eq('done today', habitDoneOn({doneDates: [today]}, today), true);

eq('streak empty', habitStreak({doneDates: []}, today), 0);
eq('streak today only', habitStreak({doneDates: [today]}, today), 1);

let t = {kind: 'habit', doneDates: []};
t = toggleHabitDay(t, today);
eq('toggle on today', habitDoneOn(t, today), true);
eq('toggle streak 1', habitStreak(t, today), 1);
eq('toggle stays open', t.status, 'open');
eq('toggle clears due', t.due, '');

t = toggleHabitDay(t, ymdAdd(today, -1));
eq('toggle streak 2', habitStreak(t, today), 2);

t = toggleHabitDay(t, today);
eq('toggle off today keeps yesterday streak', habitStreak(t, today), 1);
eq('toggle off today not done', habitDoneOn(t, today), false);

eq('broken streak', habitStreak({doneDates: [ymdAdd(today, -2)]}, today), 0);
eq('yesterday only', habitStreak({doneDates: [ymdAdd(today, -1)]}, today), 1);

const week = habitWeek({doneDates: [today, ymdAdd(today, -2)]}, today);
eq('week length', week.length, 7);
eq('week last is today', week[6].ymd, today);
eq('week today flag', week[6].today, true);
eq('week today done', week[6].done, true);
eq('week -2 done', week[4].done, true);
eq('week -1 not', week[5].done, false);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy nawyków OK.');
