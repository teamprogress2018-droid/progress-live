// Testy warstwy klienta: wybór aktywnego planu i render coach media.
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
  TASKS: [],
  PACKAGES: [],
  DEF_EX: [
    { name: 'Przysiad ze sztangą', tip: 'Kolana w kierunku palców.', video: 'https://youtu.be/abcdefghijk' }
  ],
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
ctx.escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
ctx.getTrainerName = () => 'Trener Testowy';
ctx.todayYmd = () => '2026-08-18';
ctx.mondayYmd = () => '2026-08-17';
ctx.planTrainingDayIdxs = (plan) => (plan.days || []).map((d, i) => ({ d, i })).filter(x => x.d && !x.d.rest && (x.d.exercises || []).length).map(x => x.i);
ctx.suggestedPlanDayIdx = () => 0;
ctx.notify = () => {};
ctx.CL = windowObj.CL;
ctx.PL = windowObj.PL;
ctx.SE = windowObj.SE;
ctx.TASKS = windowObj.TASKS;
ctx.PACKAGES = windowObj.PACKAGES;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '04-client-portal.js'), 'utf8'), ctx);

const { capClientPlan, capTodayExercises, capScreenHTML } = ctx;

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
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL ' + name);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

windowObj.CL = [{ id: 'c1', name: 'Jan Kowalski' }];
windowObj.PL = [
  {
    id: 'p-old',
    clientId: 'c1',
    name: 'Stary plan',
    createdAt: '2026-08-01T08:00:00.000Z',
    days: [{ day: 'Pon', exercises: [{ name: 'Przysiad ze sztangą', sets: '3', reps: '5' }] }]
  },
  {
    id: 'p-new',
    clientId: 'c1',
    name: 'Nowy plan',
    updatedAt: '2026-08-18T07:00:00.000Z',
    days: [{ day: 'Wt', exercises: [{ name: 'Przysiad ze sztangą', sets: '4', reps: '8', note: 'Łopatki ściągnięte' }] }]
  }
];
windowObj.SE = [];
windowObj.TASKS = [];
windowObj.PACKAGES = [];
ctx.CL = windowObj.CL;
ctx.PL = windowObj.PL;
ctx.SE = windowObj.SE;
ctx.TASKS = windowObj.TASKS;
ctx.PACKAGES = windowObj.PACKAGES;

const client = windowObj.CL[0];
eq('latest plan selected', capClientPlan(client).id, 'p-new');

const todayExercises = capTodayExercises(client);
eq('today uses newest plan sets', todayExercises[0].sets, '4×8');
eq('today keeps plan note', todayExercises[0].note, 'Łopatki ściągnięte');
eq('today keeps lib video fallback', todayExercises[0].video, 'https://youtu.be/abcdefghijk');
eq('today icons include note and video', todayExercises[0].icons, ' 💡 ▶️');

const homeHtml = capScreenHTML('home', client);
ok('home shows coach note text', homeHtml.includes('Łopatki ściągnięte'));
ok('home shows film link', homeHtml.includes('Film techniki'));
ok('home shows newest plan name', homeHtml.includes('Nowy plan'));

const planHtml = capScreenHTML('plan', client);
ok('plan shows exercise row', planHtml.includes('Przysiad ze sztangą'));
ok('plan shows coach note', planHtml.includes('Łopatki ściągnięte'));
ok('plan shows film link', planHtml.includes('Film techniki'));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy client portal coach media OK.');
