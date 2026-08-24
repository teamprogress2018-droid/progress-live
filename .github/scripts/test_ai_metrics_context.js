// Testy kontekstu pomiarów dla generatora AI.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [],
  METRIC_ENTRIES: [],
  METRIC_GROUPS: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);

const src = fs.readFileSync(path.join(__dirname, '..', '..', '07-forms-metrics-calculator.js'), 'utf8');
const m = src.match(/\/\*\* Ostatnie pomiary[\s\S]*?window\.clientLatestMetricWeight=clientLatestMetricWeight;/);
if (!m) {
  console.error('Could not extract clientMetricsContextForAI');
  process.exit(1);
}
vm.runInContext(m[0], ctx);

const { clientMetricsContextForAI, clientLatestMetricWeight } = ctx;

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL ' + name); failed++; }
  else console.log('OK   ' + name);
}

ok('empty without entries', clientMetricsContextForAI('c1') === '');

windowObj.METRIC_ENTRIES = [
  { id: 'a', clientId: 'c1', groupId: 'mg1', date: '2026-07-01', values: { m1: 88, m2: 22, m3: 58, m4: 27.2 } },
  { id: 'b', clientId: 'c1', groupId: 'mg1', date: '2026-08-24', values: { m1: 83, m2: 18.8, m3: 61, m4: 25.6 } },
  { id: 'c', clientId: 'c1', groupId: 'mg2', date: '2026-08-24', values: { m1: 98, m2: 84, m3: 97 } },
  { id: 'd', clientId: 'c1', groupId: 'mg3', date: '2026-08-20', values: { m1: 120, m3: 95 } },
  { id: 'e', clientId: 'c2', groupId: 'mg1', date: '2026-08-24', values: { m1: 70 } }
];

const txt = clientMetricsContextForAI('c1');
ok('includes section header', txt.includes('POMIARY KLIENTA'));
ok('latest mass 83', txt.includes('masa 83'));
ok('bf trend', txt.includes('BF% 18.8') && txt.includes('-3.2'));
ok('history has older', txt.includes('88 kg'));
ok('obwody', txt.includes('klatka 98') && txt.includes('talia 84'));
ok('1RM', txt.includes('przysiad 1RM 120') && txt.includes('wyciskanie 1RM 95'));
ok('other client ignored', !txt.includes('70'));
ok('latest weight helper', clientLatestMetricWeight('c1') === 83);
ok('no weight other', clientLatestMetricWeight('c9') == null);

if (failed) process.exit(1);
console.log('\nAll AI metrics context tests passed');
