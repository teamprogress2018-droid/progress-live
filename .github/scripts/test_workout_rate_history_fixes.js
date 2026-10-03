// Regressions for PR #23: progress count and escaped calendar snippets.
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
ctx.METRIC_ENTRIES = windowObj.METRIC_ENTRIES;
ctx.getTrainerName = () => 'Trener Testowy';
ctx.todayYmd = () => '2026-08-18';
ctx.mondayYmd = () => '2026-08-18';
ctx.ppLatestWeight = () => '80';
ctx.ppFeatureOn = () => false;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '04-client-portal.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '08-client-profile-extras.js'), 'utf8'), ctx);

const { capScreenHTML, safeEscSnippet } = ctx;

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

windowObj.CL = [{ id: 'c1', name: 'Jan Testowy', weight: 80 }];
windowObj.SE = [{ id: 'book1', clientId: 'c1', date: '2026-08-18', type: 'Sesja na sali', source: 'gym' }];
ctx.CL = windowObj.CL;
ctx.SE = windowObj.SE;

const progressHtml = capScreenHTML('progress', windowObj.CL[0]);
const sessionsBlock = progressHtml.match(/🏋️ Sesje(?: \(30 dni\))?<\/div>\s*<div[^>]*>(\d+)<\/div>/)
  || progressHtml.match(/Sesje \(30 dni\)[\s\S]*?<div[^>]*font-size:28px[^>]*>(\d+)<\/div>/);
eq('progress count ignores booked sessions', sessionsBlock && sessionsBlock[1], '0');
eq('progress html has sesje label', /Sesje \(30 dni\)/.test(progressHtml), true);

eq('safe snippet keeps amp entity whole', safeEscSnippet('A&B', 3), 'A&amp;B');
eq('safe snippet keeps lt entity whole', safeEscSnippet('<ABC>', 2), '&lt;A');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy poprawek historii treningów OK.');
