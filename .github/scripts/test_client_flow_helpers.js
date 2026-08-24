// Testy priorytetu sylwetkowego, kontuzji, mapowania dni planu → kalendarz oraz sync ankiety.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement(){return{style:{},classList:{toggle(){},contains(){return false}},querySelector(){return null},querySelectorAll(){return[]}};},
  documentElement:{style:{setProperty(){}}}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [],
  SETTINGS: {},
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
  Map,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

// schedule helpers live in 05 — load helpers from file text
const src05 = fs.readFileSync(path.join(__dirname, '..', '..', '05-clients-builder-plans-calendar.js'), 'utf8');
const m = src05.match(/function planDayLabelToWeekday[\s\S]*?window\.scheduleTimeFromClient=scheduleTimeFromClient;/);
if (m) vm.runInContext(m[0], ctx);
else {
  const m2 = src05.match(/function planDayLabelToWeekday[\s\S]*?window\.planDayLabelToWeekday=planDayLabelToWeekday;/);
  if (m2) vm.runInContext(m2[0], ctx);
}

const {
  normalizePhysiquePriority, physiquePriorityLabel, clientInjuriesText,
  clientPhysiquePriorityForAI, planDayLabelToWeekday,
  normalizeTrainingFreq, normalizePreferredWeekdays, mapGoalFromIntakeText,
  mapLevelFromIntakeChoice, syncClientFromIntakeForm, resolvePlanDayWeekday,
  scheduleTimeFromClient, defaultWeekdaysForFreq, preferredWeekdaysLabels
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

eq('normalize filters unknown', normalizePhysiquePriority(['upper_chest','nope','side_delts']), ['upper_chest','side_delts']);
eq('label side delts', physiquePriorityLabel('side_delts'), 'Boczny bark');
eq('injuries prefers dedicated', clientInjuriesText({injuries:'kolano',notes:'prywatne'}), 'kolano');
eq('injuries fallback notes', clientInjuriesText({notes:'bark'}), 'bark');
eq('AI priority line includes label', clientPhysiquePriorityForAI({physiquePriority:['upper_chest']}).includes('Góra klatki'), true);
eq('weekday PON', planDayLabelToWeekday('PON',0), 1);
eq('weekday ŚR', planDayLabelToWeekday('ŚR',0), 3);
eq('weekday Dzień 1 fallback Mon', planDayLabelToWeekday('Dzień 1 — Push',0), 1);
eq('weekday Dzień 2 fallback Wed', planDayLabelToWeekday('Dzień 2 — Pull',1), 3);

eq('freq clamp', normalizeTrainingFreq('3'), 3);
eq('freq invalid', normalizeTrainingFreq(''), 0);
eq('weekdays labels', normalizePreferredWeekdays(['PON','ŚR','PT']), [1,3,5]);
eq('goal masa', mapGoalFromIntakeText('chcę budować masę mięśniową'), 'masa');
eq('goal redukcja', mapGoalFromIntakeText('schudnąć 8 kg'), 'redukcja');
eq('level 1-3', mapLevelFromIntakeChoice('1-3 lata'), 'sredni');

windowObj.CL = [{id:'c1',name:'Test',goal:'kondycja',level:'poczatkujacy'}];
const synced = syncClientFromIntakeForm({
  formId:'df1',formName:'Ankieta wstępna',clientId:'c1',
  answers:{q1:'hipertrofia i sylwetka',q2:'1-3 lata',q3:'tak',q4:'kolano prawe',q5:'3',q6:'Wieczór (18-22)'}
});
eq('intake sync ok', !!(synced && synced.changed), true);
eq('intake summary has freq', !!(synced && synced.summary && synced.summary.includes('3×')), true);
eq('intake goal', windowObj.CL[0].goal, 'masa');
eq('intake level', windowObj.CL[0].level, 'sredni');
eq('intake injuries', windowObj.CL[0].injuries, 'kolano prawe');
eq('intake freq', windowObj.CL[0].trainingFreq, 3);
eq('intake time', windowObj.CL[0].preferredTrainTime, 'Wieczór (18-22)');
eq('intake weekdays default', windowObj.CL[0].preferredWeekdays, [1, 3, 5]);
eq('defaultWeekdays 3', defaultWeekdaysForFreq(3), [1, 3, 5]);
eq('defaultWeekdays 4', defaultWeekdaysForFreq(4), [1, 2, 4, 5]);
eq('weekday labels', preferredWeekdaysLabels([1, 3, 5]), ['Pon', 'Śr', 'Pt']);

if (typeof resolvePlanDayWeekday === 'function') {
  eq('resolve preferred first', resolvePlanDayWeekday('Dzień 1', 0, [2,4,6]), 2);
  eq('resolve preferred second', resolvePlanDayWeekday('Dzień 2', 1, [2,4,6]), 4);
  eq('resolve fallback label', resolvePlanDayWeekday('PON', 0, []), 1);
}
if (typeof scheduleTimeFromClient === 'function') {
  eq('time evening', scheduleTimeFromClient({preferredTrainTime:'Wieczór (18-22)'}), '18:00');
  eq('time morning', scheduleTimeFromClient({preferredTrainTime:'Rano (6-10)'}), '08:00');
}

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll client-flow helper tests passed');
