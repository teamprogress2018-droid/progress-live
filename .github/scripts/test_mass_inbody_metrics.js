#!/usr/bin/env node
'use strict';
/** Masa i BMI: wiek metaboliczny, nawodnienie, ocena fizyczności. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK  ', name);
}

const mg1 = src07.match(/\{id:'mg1',name:'Masa i BMI'[\s\S]*?\}\]/);
ok('mg1 group defined', !!mg1);
const g = mg1 ? mg1[0] : '';
ok('mg1 has metabolic age', g.includes("id:'m5',name:'Wiek metaboliczny',unit:'lat'"));
ok('mg1 has hydration', g.includes("id:'m6',name:'Nawodnienie',unit:'%'"));
ok('mg1 has physique', g.includes("id:'m7',name:'Ocena fizyczności'"));
ok('mg1 keeps mass/bf/muscle/bmi', g.includes("id:'m1',name:'Masa ciała'") && g.includes("id:'m2',name:'% tkanki tłuszczowej'") && g.includes("id:'m3',name:'Masa mięśniowa'") && g.includes("id:'m4',name:'BMI'"));
ok('form hint tanita', /Tanita \/ InBody/.test(src07));
ok('migrate mass helper', /function migrateEnsureMassMetrics/.test(src07) && /function migrateEnsureMetricGroups/.test(src07));
ok('trend helper', /function metricDeltaIsGoodDown/.test(src07) && /better==='up'/.test(src07));
ok('ai context extra fields', /wiek metaboliczny/.test(src07) && /nawodnienie/.test(src07) && /ocena fizyczności/.test(src07));
ok('progress tiles', /Wiek met\./.test(src08) && /Nawodn\./.test(src08) && /Fizyczność/.test(src08));
ok('index migrate groups', html.includes('migrateEnsureMetricGroups'));
ok('cache 07', html.includes('07-forms-metrics-calculator.js?v=33'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=53'));
ok('cache 04', html.includes('04-client-portal.js?v=45'));
ok('CI unit', wf.includes('test_mass_inbody_metrics.js'));
ok('CI ui', wf.includes('test_mass_inbody_ui.js'));

function sliceFn(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const demoBlock = src07.slice(src07.indexOf('const DEMO_METRIC_GROUPS='), src07.indexOf('window.DEMO_METRIC_GROUPS=DEMO_METRIC_GROUPS;') + 'window.DEMO_METRIC_GROUPS=DEMO_METRIC_GROUPS;'.length);
const helperNames = ['mergeMetricDefs', 'allMetricGroups', 'metricGroupById', 'migrateEnsureDemoGroupMetrics', 'migrateEnsureMassMetrics', 'migrateEnsureMetricGroups', 'metricDeltaIsGoodDown'];
const persisted = [];
const documentStub = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const windowObj = {
  addEventListener() {},
  document: documentStub,
  METRIC_GROUPS: [],
  persistById: (col, o) => { persisted.push({ col, id: o && o.id }); return o; }
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document: documentStub, console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, Infinity, undefined,
  persistById: windowObj.persistById
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(demoBlock + '\n' + helperNames.map((n) => sliceFn(src07, n)).join('\n') + `
window.allMetricGroups=allMetricGroups;
window.migrateEnsureMassMetrics=migrateEnsureMassMetrics;
window.metricDeltaIsGoodDown=metricDeltaIsGoodDown;
`, ctx);

const mass = ctx.allMetricGroups().find((x) => x.id === 'mg1');
ok('vm mg1 has 7 metrics', mass && mass.metrics.length === 7, mass && String(mass.metrics.length));
ok('vm m5-m7 names', mass.metrics.some((m) => m.id === 'm5' && m.name === 'Wiek metaboliczny') && mass.metrics.some((m) => m.id === 'm6') && mass.metrics.some((m) => m.id === 'm7'));
ok('hydration up is good', ctx.metricDeltaIsGoodDown('mg1', { better: 'up' }) === false);
ok('age down is good', ctx.metricDeltaIsGoodDown('mg1', { better: 'down' }) === true);

windowObj.METRIC_GROUPS = [{
  id: 'mg1', name: 'Masa i BMI', metrics: [
    { id: 'm1', name: 'Masa ciała', unit: 'kg' },
    { id: 'm2', name: '% tkanki tłuszczowej', unit: '%' }
  ]
}];
ok('allMetricGroups still has m5 from demo', ctx.allMetricGroups().find((x) => x.id === 'mg1').metrics.some((m) => m.id === 'm5'));
ok('migrate mass patches stored', ctx.migrateEnsureMassMetrics() === true);
const stored = windowObj.METRIC_GROUPS.find((x) => x.id === 'mg1');
ok('stored has m5 m6 m7', stored.metrics.some((m) => m.id === 'm5') && stored.metrics.some((m) => m.id === 'm6') && stored.metrics.some((m) => m.id === 'm7'));
ok('stored keeps m1', stored.metrics.some((m) => m.id === 'm1'));
ok('migrate mass idempotent', ctx.migrateEnsureMassMetrics() === false);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll mass/inbody metric tests passed');
