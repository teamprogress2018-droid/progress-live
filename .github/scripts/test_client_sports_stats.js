// Wcześniejsze sporty (planowanie) + rozbudowany panel postępów klienta.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const els = {};
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: (id) => els[id] || null,
  addEventListener() {},
  createElement: (tag) => ({
    id: '', innerHTML: '', style: {}, appendChild() {}, classList: { add() {}, remove() {} }
  }),
  body: { appendChild(el) { if (el && el.id) els[el.id] = el; } }
};
const windowObj = {
  addEventListener() {},
  document
};
windowObj.CL = [{ id: 'c-run', name: 'Biegacz', priorSports: ['running'], activityLevel: 'active', weight: 72 }];
windowObj.PL = [];
windowObj.SE = [];
windowObj.METRIC_ENTRIES = [];
windowObj.CHECKINS = {};
windowObj.TASKS = [];
windowObj.PACKAGES = [];
windowObj.SETTINGS = { brand: { accentColor: '#e60000' } };
windowObj.persistById = async (_c, o) => o;
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  CL: windowObj.CL,
  PL: windowObj.PL,
  SE: windowObj.SE,
  METRIC_ENTRIES: windowObj.METRIC_ENTRIES,
  CHECKINS: windowObj.CHECKINS,
  TASKS: windowObj.TASKS,
  PACKAGES: windowObj.PACKAGES,
  SETTINGS: windowObj.SETTINGS,
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
  isFinite,
  undefined,
  URL,
  encodeURIComponent,
  setTimeout,
  clearTimeout,
  notify() {}
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const root = path.join(__dirname, '..', '..');
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8'), ctx);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const runner = { priorSports: ['running'], activityLevel: 'active' };
const lifter = { priorSports: ['gym'], activityLevel: 'moderate' };
const prRun = ctx.clientSportProfile(runner);
const prLift = ctx.clientSportProfile(lifter);
ok('runner endurance bias', prRun.bias === 'endurance', 'bias=' + prRun.bias);
ok('runner high endurance', prRun.endurance >= 8, 'e=' + prRun.endurance);
ok('lifter strength bias', prLift.bias === 'strength', 'bias=' + prLift.bias);
ok('lifter high strength', prLift.strength >= 8, 's=' + prLift.strength);
ok('ai context mentions wytrzymalosc', /wytrzymałościow/i.test(ctx.clientSportProfileForAI(runner)));
ok('ai context mentions silowa', /siłow/i.test(ctx.clientSportProfileForAI(lifter)));

windowObj.SE = [
  {
    id: 's1', clientId: 'c-run', date: '2026-08-01', source: 'client', feedback: 4,
    volume: 4200,
    exercises: [{ name: 'Przysiad', sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }] }]
  },
  {
    id: 's2', clientId: 'c-run', date: '2026-08-08', source: 'client', feedback: 5,
    volume: 5100,
    exercises: [{ name: 'Martwy', sets: [{ kg: 100, reps: 5 }] }]
  }
];
windowObj.METRIC_ENTRIES = [
  { id: 'm1', clientId: 'c-run', groupId: 'mg1', date: '2026-07-01', values: { m1: 74 } },
  { id: 'm2', clientId: 'c-run', groupId: 'mg1', date: '2026-08-01', values: { m1: 72 } },
  { id: 'm3', clientId: 'c-run', groupId: 'mg2', date: '2026-08-01', values: { m1: 98, m2: 78, m3: 96 } }
];
windowObj.CHECKINS = {
  'c-run': [
    { status: 'filled', date: '2026-07-20', answers: { energy: 4, sleep: 4, stress: 2, nutrition: 4 } },
    { status: 'filled', date: '2026-08-10', answers: { energy: 5, sleep: 5, stress: 2, nutrition: 4 } }
  ]
};

const vol = ctx.capWeeklyVolume('c-run', 4);
ok('weekly volume buckets', vol.length === 4 && vol.some((w) => w.vol > 0));
ok('sparkline svg', /<svg/.test(ctx.capSparklineSVG([{ d: '2026-07-01', v: 74 }, { d: '2026-08-01', v: 72 }], '#e60000')));
ok('bar chart svg', /<rect/.test(ctx.capBarChartSVG([{ l: 'T1', v: 100 }], '#e60000')));

ctx.SE = windowObj.SE;
ctx.METRIC_ENTRIES = windowObj.METRIC_ENTRIES;
ctx.CHECKINS = windowObj.CHECKINS;

const client = ctx.CL[0];
const progressHtml = ctx.capScreenHTML('progress', client);
ok('progress panel title', /MOJE POSTĘPY/i.test(progressHtml));
ok('progress tonaz kpi', /Tonaż/i.test(progressHtml));
ok('progress serie kpi', /Serie/i.test(progressHtml));
ok('progress weight trend', /Trend masy/i.test(progressHtml));
ok('progress weekly volume chart', /Tonaż tygodniowy/i.test(progressHtml));
ok('progress pr bars', /Rekordy siłowe/i.test(progressHtml));
ok('progress measurements', /Obwody/i.test(progressHtml));
ok('progress svg charts', (progressHtml.match(/cap-chart-svg/g) || []).length >= 2);

const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
ok('ai prompt sport background', /TŁO SPORTOWE/i.test(src03));
ok('ai form sport fields', /apl-sport-notes/.test(src03) && /apl-activity/.test(src03));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nSporty + statystyki klienta: OK');
