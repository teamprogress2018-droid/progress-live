// Testy mapowania programu → plan z ćwiczeniami (Automatyzacja / assign).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement(){return{style:{},classList:{toggle(){},contains(){return false}}};}
};
const windowObj = { addEventListener() {}, CL: [], PL: [], SE: [], document };
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat,
  Number, String, Array, Object, JSON, Set, Map, setTimeout, clearTimeout,
  isNaN, Infinity, undefined, RegExp
};
ctx.globalThis = ctx;
vm.createContext(ctx);

// Load only the helpers we need from 06 (avoid full file DOM deps)
const src = fs.readFileSync(path.join(__dirname, '..', '..', '06-inbox-exercises-ai-programs.js'), 'utf8');
const m1 = src.match(/function expandSessionFromDayFocus[\s\S]*?window\.expandSessionFromDayFocus=expandSessionFromDayFocus;/);
const m2 = src.match(/function planDaysFromProgram[\s\S]*?window\.planDaysFromProgram=planDaysFromProgram;/);
if (!m1 || !m2) {
  console.error('FAIL helpers not found in 06');
  process.exit(1);
}
vm.runInContext(m1[0] + '\n' + m2[0], ctx);

const { expandSessionFromDayFocus, planDaysFromProgram } = ctx;

let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}
function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('OK   ' + name);
}

const push = expandSessionFromDayFocus('Push A — Klatka + Barki + Triceps');
ok('push expands >1', push.length >= 4);
ok('push has chest press', push.some(e => /wycisk|klatk/i.test(e.name)));

const pull = expandSessionFromDayFocus('Pull B — Martwy ciąg');
ok('pull expands', pull.length >= 4);

const restProg = {
  weeks: [{
    days: [
      { d: 'PON', name: 'Push A — Klatka' },
      { d: 'ŚR', name: 'REST' },
      { d: 'PT', name: 'Pull A — Plecy' }
    ]
  }]
};
const days = planDaysFromProgram(restProg, 0);
eq('day count', days.length, 3);
eq('day0 label', days[0].day, 'PON');
ok('day0 has exercises', days[0].exercises.length >= 3);
eq('rest empty', days[1].exercises.length, 0);
eq('rest flag', days[1].rest, true);
ok('pull day exercises', days[2].exercises.length >= 3);

const withEx = {
  weeks: [{
    days: [{ d: 'PON', name: 'Custom', exercises: [{ name: 'Przysiad', sets: 4, reps: '5' }] }]
  }]
};
const d2 = planDaysFromProgram(withEx, 0);
eq('keeps explicit ex', d2[0].exercises[0].name, 'Przysiad');
eq('keeps sets', d2[0].exercises[0].sets, '4');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll program→plan tests passed');
