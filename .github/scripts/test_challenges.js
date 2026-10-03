// Testy wyzwań (termin + pasek). Ładuje 01-core.js w atrapie DOM.
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
  isHabit, isChallenge, isOneShot, parseChallengeDays, parseChallengeTarget,
  challengeProgress, challengeCanCheck, toggleChallengeDay, challengeStatusText,
  challengeVisible, ymdAdd, habitDoneOn
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
const ch = {
  kind: 'challenge',
  start: '2026-08-18',
  days: 21,
  target: 21,
  doneDates: []
};

eq('isChallenge on', isChallenge(ch), true);
eq('isChallenge habit off', isChallenge({kind: 'habit'}), false);
eq('isHabit challenge off', isHabit(ch), false);
eq('isHabit challenge+repeat off', isHabit({kind: 'challenge', repeat: 'daily'}), false);
eq('isOneShot task', isOneShot({kind: 'task'}), true);
eq('isOneShot habit', isOneShot({kind: 'habit'}), false);
eq('isOneShot challenge', isOneShot(ch), false);

eq('days 21', parseChallengeDays(21), 21);
eq('days 7', parseChallengeDays('7'), 7);
eq('days bad', parseChallengeDays('x'), 21);
eq('target default', parseChallengeTarget({days: 14}), 14);
eq('target cap', parseChallengeTarget({days: 21, target: 40}), 21);
eq('target 15 of 21', parseChallengeTarget({days: 21, target: 15}), 15);

let p = challengeProgress(ch, today);
eq('prog start', p.start, '2026-08-18');
eq('prog end', p.end, '2026-09-07');
eq('prog done 0', p.done, 0);
eq('prog active', p.active, true);
eq('prog left 21', p.left, 21);
eq('can today', challengeCanCheck(ch, today, today), true);
eq('cannot tomorrow', challengeCanCheck(ch, '2026-08-19', today), false);
eq('cannot before start', challengeCanCheck({...ch, start: '2026-08-20'}, today, today), false);

let t = {...ch, doneDates: []};
t = toggleChallengeDay(t, today, today);
eq('toggle on', habitDoneOn(t, today), true);
eq('toggle stays challenge', t.kind, 'challenge');
p = challengeProgress(t, today);
eq('prog done 1', p.done, 1);
eq('status running', challengeStatusText(t, today).indexOf('1/21') >= 0, true);

t = toggleChallengeDay(t, today, today);
eq('toggle off', habitDoneOn(t, today), false);

const outside = toggleChallengeDay({...ch}, '2026-07-01', today);
eq('toggle outside no-op', (outside.doneDates || []).length, 0);

const wonDates = [];
for (let i = 0; i < 21; i++) wonDates.push(ymdAdd(ch.start, i));
p = challengeProgress({...ch, doneDates: wonDates}, today);
eq('won', p.won, true);
eq('pct 100', p.pct, 100);

p = challengeProgress({...ch, target: 10, doneDates: wonDates.slice(0, 10)}, today);
eq('early win', p.won, true);
eq('early target', p.target, 10);

const after = '2026-09-10';
p = challengeProgress({...ch, doneDates: []}, after);
eq('lost after end', p.lost, true);
eq('not active after', p.active, false);
eq('cannot after end', challengeCanCheck(ch, after, after), false);

eq('visible during', challengeVisible(ch, today), true);
eq('hidden long after', challengeVisible(ch, '2026-12-01'), false);
eq('visible 7d after', challengeVisible(ch, '2026-09-14'), true);

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy wyzwań OK.');
