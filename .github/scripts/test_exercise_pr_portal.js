// Regressions for PR #24 portal rendering.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const makeNode = () => ({
  style: {},
  classList: { add() {}, remove() {}, toggle() {} },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  appendChild() {},
  insertBefore() {},
  addEventListener() {},
  set innerHTML(v) { this._html = v; },
  get innerHTML() { return this._html || ''; }
});

const document = {
  getElementById: () => makeNode(),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => makeNode(),
  addEventListener() {}
};

const windowObj = {
  addEventListener() {},
  CL: [],
  PL: [],
  SE: [],
  EX: [],
  WO: [],
  TASKS: [],
  PACKAGES: [],
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
ctx.CL = windowObj.CL;
ctx.PL = windowObj.PL;
ctx.SE = windowObj.SE;
ctx.TASKS = windowObj.TASKS;
ctx.PACKAGES = windowObj.PACKAGES;
ctx.getTrainerName = () => 'Trener Testowy';
ctx.todayYmd = () => '2026-08-18';
ctx.ppLatestWeight = () => '80';

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '04-client-portal.js'), 'utf8'), ctx);

const { capScreenHTML } = ctx;

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL ' + name);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

windowObj.CL = [{ id: 'c1', name: 'Jan Testowy', weight: 80 }];
windowObj.SE = [{
  id: 's1',
  clientId: 'c1',
  date: '2026-08-18',
  source: 'client',
  type: 'Push',
  exercises: [{ name: `O'Hara Press`, sets: [{ kg: 100, reps: 5 }] }]
}];
ctx.CL = windowObj.CL;
ctx.SE = windowObj.SE;

const html = capScreenHTML('progress', windowObj.CL[0]);
ok('onclick uses escaped quotes', html.includes('onclick="clientOpenExercise(&quot;O&#39;Hara Press&quot;)"'));
ok('name still visible', html.includes(`O&#39;Hara Press`) || html.includes(`O'Hara Press`));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy portalu rekordów OK.');
