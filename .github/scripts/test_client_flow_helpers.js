// Testy priorytetu sylwetkowego, kontuzji i mapowania dni planu → kalendarz.
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

// schedule helpers live in 05 — load minimal stubs then eval just the two functions from file text
const src05 = fs.readFileSync(path.join(__dirname, '..', '..', '05-clients-builder-plans-calendar.js'), 'utf8');
const m = src05.match(/function planDayLabelToWeekday[\s\S]*?window\.planDayLabelToWeekday=planDayLabelToWeekday;/);
if (m) vm.runInContext(m[0], ctx);

const {
  normalizePhysiquePriority, physiquePriorityLabel, clientInjuriesText,
  clientPhysiquePriorityForAI, planDayLabelToWeekday
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

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll client-flow helper tests passed');
