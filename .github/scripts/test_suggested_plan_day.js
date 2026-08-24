// Rotacja sugerowanego dnia planu (PPL itd.) po zakończonej sesji Live/client.
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

const { suggestedPlanDayIdx, planTrainingDayIdxs, todayYmd } = ctx;

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

const ppl = {
  id: 'plan-ppl',
  days: [
    { day: 'Push', exercises: [{ name: 'Wyciskanie' }] },
    { day: 'Pull', exercises: [{ name: 'Martwy' }] },
    { day: 'Legs', exercises: [{ name: 'Przysiad' }] }
  ]
};

eq('train idxs', planTrainingDayIdxs(ppl), [0, 1, 2]);
eq('no history → first', suggestedPlanDayIdx('c1', ppl), 0);

windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 0, source: 'live', date: '2026-08-20', createdAt: '2026-08-20T10:00:00' }
];
eq('after Push yesterday → Pull', suggestedPlanDayIdx('c1', ppl), 1);

const today = todayYmd();
windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 0, source: 'live', date: today, createdAt: today + 'T10:00:00' }
];
eq('after Push today → Pull (not same day)', suggestedPlanDayIdx('c1', ppl), 1);

windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 2, source: 'client', date: today, createdAt: today + 'T18:00:00' }
];
eq('after Legs today → wrap to Push', suggestedPlanDayIdx('c1', ppl), 0);

windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: '1', source: 'live', date: today, createdAt: today + 'T10:00:00' }
];
eq('string dayIdx still advances', suggestedPlanDayIdx('c1', ppl), 2);

const withRest = {
  id: 'plan-rest',
  days: [
    { day: 'A', exercises: [{ name: 'Squat' }] },
    { day: 'Rest', rest: true, exercises: [] },
    { day: 'B', exercises: [{ name: 'Bench' }] }
  ]
};
windowObj.SE = [
  { clientId: 'c1', planId: 'plan-rest', dayIdx: 0, source: 'live', date: today, createdAt: today + 'T10:00:00' }
];
eq('skip rest day', suggestedPlanDayIdx('c1', withRest), 2);

// Planned calendar day overrides rotation for today
windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 0, source: 'live', date: '2026-08-20', createdAt: '2026-08-20T10:00:00' },
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 2, source: 'planned', date: today, createdAt: today + 'T08:00:00' }
];
eq('planned today Legs overrides rotation', suggestedPlanDayIdx('c1', ppl), 2);

windowObj.SE = [
  { clientId: 'c1', planId: 'plan-ppl', dayIdx: 1, source: 'planned', date: today, createdAt: today + 'T08:00:00' }
];
eq('planned alone → that day', suggestedPlanDayIdx('c1', ppl), 1);

const { isLoggedWorkout, plannedSessionForDate } = ctx;
eq('planned not logged workout', isLoggedWorkout({ source: 'planned', exercises: [{ name: 'x' }] }), false);
eq('plannedSessionForDate finds', !!plannedSessionForDate('c1', 'plan-ppl', today), true);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll suggested-plan-day tests passed');
