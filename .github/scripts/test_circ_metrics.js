#!/usr/bin/env node
'use strict';
/** Obwody ciała (cm) — pełna taśma w mg2, merge grup, baseline, bez fałszywych seedów. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK  ', name);
}

const mg2 = src07.match(/\{id:'mg2',name:'Obwody ciała'[\s\S]*?\}\]/);
ok('mg2 group defined', !!mg2);
const g = mg2 ? mg2[0] : '';
const need = [
  ['m1', 'Klatka piersiowa'],
  ['m2', 'Talia'],
  ['m3', 'Biodra'],
  ['m4', 'Udo (lewe)'],
  ['m5', 'Ramię (lewe)'],
  ['m6', 'Szyja'],
  ['m7', 'Barki'],
  ['m8', 'Ramię (prawe)'],
  ['m9', 'Udo (prawe)'],
  ['m10', 'Łydka (lewa)'],
  ['m11', 'Łydka (prawa)'],
  ['m12', 'Przedramię (lewe)'],
  ['m13', 'Przedramię (prawe)']
];
need.forEach(([id, name]) => {
  ok('mg2 has ' + id + ' ' + name, g.includes("id:'" + id + "',name:'" + name + "',unit:'cm'"));
});
ok('mg2 all cm', (g.match(/unit:'cm'/g) || []).length >= 13);
ok('no fake circ seed', !/values:\{m1:88,m2:22/.test(src07) && !src07.includes("notes:'Pomiar startowy'"));
ok('migrate helper', /function migrateEnsureCircMetrics/.test(src07));
ok('allMetricGroups merges by id', /function allMetricGroups/.test(src07) && /demoIds/.test(src07));
ok('baseline circ container', html.includes('id="bl-circ-fields"') && html.includes('Obwody centymetrem'));
ok('baseline no hardcoded 5 fields', !html.includes('id="bl-chest"') && !html.includes('id="bl-arm"'));
ok('05 collects circ', /collectBaselineCircFields/.test(src05) && /renderBaselineCircFields/.test(src05));
ok('08 empty circ copy', src08.includes('Brak obwodów centymetrem'));
ok('08 uses circBarItems', src08.includes('circBarItems'));
ok('04 last circ dynamic', src04.includes('circMetricDefs'));
ok('index migrate after load', html.includes('migrateEnsureCircMetrics'));
ok('cache 07', html.includes('07-forms-metrics-calculator.js?v=30'));
ok('cache 04/05/08', html.includes('04-client-portal.js?v=36') && html.includes('05-clients-builder-plans-calendar.js?v=37') && html.includes('08-client-profile-extras.js?v=40'));
ok('CI unit', wf.includes('test_circ_metrics.js'));
ok('openMetricEntry fills after openM', /openM\('m-metric-entry'\);[\s\S]{0,500}if\(groupId\)gsel\.value=groupId/.test(src07));

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
const helperNames = ['mergeMetricDefs', 'allMetricGroups', 'metricGroupById', 'circMetricDefs', 'circMetricLabels', 'circBarItems', 'migrateEnsureCircMetrics', 'saveClientBaselineFromFields'];
const persisted = [];
const documentStub = {
  getElementById: () => null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  document: documentStub,
  METRIC_GROUPS: [],
  METRIC_ENTRIES: [],
  CL: [{ id: 'c1', name: 'Justyna' }],
  persistById: (col, o) => { persisted.push({ col, id: o && o.id }); return o; }
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, Infinity, undefined,
  METRIC_ENTRIES: windowObj.METRIC_ENTRIES,
  persistById: windowObj.persistById,
  withTrainer: (o) => o,
  newId: (p) => p + '_x',
  todayYmd: () => '2026-08-28'
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(demoBlock + '\n' + helperNames.map((n) => sliceFn(src07, n)).join('\n') + `
window.allMetricGroups=allMetricGroups;
window.circMetricDefs=circMetricDefs;
window.circBarItems=circBarItems;
window.migrateEnsureCircMetrics=migrateEnsureCircMetrics;
window.saveClientBaselineFromFields=saveClientBaselineFromFields;
`, ctx);

const groups = ctx.allMetricGroups();
const circ = groups.find((g) => g.id === 'mg2');
ok('vm mg2 13 sites', circ && circ.metrics.length === 13, circ && String(circ.metrics.length));
ok('vm all cm', circ.metrics.every((m) => m.unit === 'cm'));
ok('vm ids include szyja/lydka', circ.metrics.some((m) => m.id === 'm6') && circ.metrics.some((m) => m.id === 'm10'));

windowObj.METRIC_GROUPS = [{
  id: 'mg2', name: 'Obwody ciała', metrics: [
    { id: 'm1', name: 'Klatka piersiowa', unit: 'cm' },
    { id: 'm2', name: 'Talia', unit: 'cm' },
    { id: 'm99', name: 'Nadgarstek', unit: 'cm' }
  ]
}];
const merged = ctx.allMetricGroups().find((g) => g.id === 'mg2');
ok('merge keeps custom wrist', merged.metrics.some((m) => m.id === 'm99'));
ok('merge still has szyja', merged.metrics.some((m) => m.id === 'm6'));
ok('no duplicate mg2 nav', ctx.allMetricGroups().filter((g) => g.id === 'mg2').length === 1);

persisted.length = 0;
ok('migrate patches stored', ctx.migrateEnsureCircMetrics() === true);
const stored = windowObj.METRIC_GROUPS.find((g) => g.id === 'mg2');
ok('stored has m6 after migrate', stored.metrics.some((m) => m.id === 'm6') && stored.metrics.some((m) => m.id === 'm10'));
ok('stored keeps custom', stored.metrics.some((m) => m.id === 'm99'));
ok('migrate persisted', persisted.some((p) => p.col === 'metricGroups'));
ok('migrate idempotent', ctx.migrateEnsureCircMetrics() === false);

const created = ctx.saveClientBaselineFromFields('c1', {
  date: '2026-08-28',
  circ: { m2: 74, m6: 34, m10: 36 },
  notes: 'Pomiar startowy (baseline)'
});
ok('baseline circ entry', created.length === 1 && created[0].groupId === 'mg2');
ok('baseline values cm sites', created[0].values.m2 === 74 && created[0].values.m6 === 34 && created[0].values.m10 === 36);
const legacy = ctx.saveClientBaselineFromFields('c1', { chest: 95, waist: 70, arm: 28 });
ok('legacy chest/waist/arm', legacy[0].values.m1 === 95 && legacy[0].values.m2 === 70 && legacy[0].values.m5 === 28);

const bars = ctx.circBarItems({ values: { m1: 90, m2: 70, m6: 33 } });
ok('bars skip empty', bars.length === 3 && bars.some((b) => b.label === 'Szyja' && b.v === 33 && b.unit === 'cm'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll circ-metrics tests passed');
