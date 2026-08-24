// Testy edycji pomiarów — helpery w 07 (atrpa DOM).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const els = {};
function makeEl(id) {
  if (els[id]) return els[id];
  const el = {
    id,
    value: '',
    innerHTML: '',
    textContent: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  els[id] = el;
  return el;
}

const document = {
  getElementById: (id) => makeEl(id),
  querySelector: (sel) => {
    if (sel === '#m-metric-entry .modal-title') return makeEl('me-title');
    return null;
  },
  querySelectorAll: () => [],
  addEventListener() {},
  createElement() { return makeEl('x' + Math.random()); }
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Test' }],
  PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [
    { id: 'me1', clientId: 'c1', groupId: 'mg1', date: '2026-08-20', values: { m1: 80 }, notes: '' }
  ],
  METRIC_GROUPS: [],
  SETTINGS: {},
  document,
  notify() {},
  persistById() {},
  withTrainer: (o) => o,
  newId: (p) => p + '_new',
  openM() {},
  closeM() {},
  todayYmd: () => '2026-08-24'
};
windowObj.window = windowObj;
windowObj.METRIC_ENTRIES = windowObj.METRIC_ENTRIES;

const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, setTimeout, clearTimeout, isNaN, Infinity, undefined,
  METRIC_ENTRIES: windowObj.METRIC_ENTRIES,
  CL: windowObj.CL,
  notify: windowObj.notify,
  persistById: windowObj.persistById,
  withTrainer: windowObj.withTrainer,
  newId: windowObj.newId,
  openM: windowObj.openM,
  closeM: windowObj.closeM,
  todayYmd: windowObj.todayYmd
};
ctx.globalThis = ctx;
vm.createContext(ctx);

// Load only the metric helpers we need by running 07 with stubs for missing deps
vm.runInContext(`
  var DEMO_METRIC_GROUPS=[
    {id:'mg1',name:'Masa i BMI',icon:'⚖️',color:'var(--accent)',metrics:[
      {id:'m1',name:'Masa ciała',unit:'kg',type:'number'},
      {id:'m2',name:'% tkanki tłuszczowej',unit:'%',type:'number'}
    ]}
  ];
  function allMetricGroups(){return DEMO_METRIC_GROUPS.concat(window.METRIC_GROUPS||[]);}
  var metricActiveGroup=null;
  function renderMetrics(){}
  function renderMetricData(){}
`, ctx);

const src = fs.readFileSync(path.join(__dirname, '..', '..', '07-forms-metrics-calculator.js'), 'utf8');
// Extract openMetricEntryForClient + edit + saveMetricEntry + refresh + del
const chunks = [];
for (const re of [
  /function refreshClientProfileMetrics[\s\S]*?window\.editMetricEntry=editMetricEntry;/,
  /async function saveMetricEntry\(\)\{[\s\S]*?\n\}/
]) {
  const m = src.match(re);
  if (m) chunks.push(m[0]);
}
if (chunks.length < 2) {
  console.error('Could not extract metric edit functions');
  process.exit(1);
}
vm.runInContext(chunks.join('\n') + '\nfunction updateMetricEntryForm(){}', ctx);

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('OK   ' + name);
}

ok('editMetricEntry exported', typeof ctx.editMetricEntry === 'function');
ok('openMetricEntryForClient exported', typeof ctx.openMetricEntryForClient === 'function');

ctx.openMetricEntryForClient('c1', 'mg1', 'me1');
ok('sets editing id', windowObj._editingMetricId === 'me1');
ok('title edit', makeEl('me-title').textContent === 'EDYTUJ POMIAR');
ok('date filled', makeEl('me-date').value === '2026-08-20');

ctx.openMetricEntryForClient('c1', 'mg1');
ok('new clears edit id', windowObj._editingMetricId == null);
ok('title new', makeEl('me-title').textContent === 'NOWY POMIAR');

if (failed) process.exit(1);
console.log('\nAll cp-metrics edit tests passed');
