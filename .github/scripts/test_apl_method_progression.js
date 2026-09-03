#!/usr/bin/env node
'use strict';
/** AI generator: Bro Split, Arnold, Smolov + auto-sync progresji z metody. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}
function eq(name, got, want) {
  if (got !== want) {
    console.error('FAIL', name, 'got', got, 'want', want);
    failed++;
  } else console.log('OK  ', name);
}

ok('apl Bro Split button', /id="apl-methods"[\s\S]*?data-val="Bro Split"[\s\S]*?Bro Split/.test(html));
ok('apl Arnold button', /id="apl-methods"[\s\S]*?data-val="Arnold"[\s\S]*?Arnold Split/.test(html));
ok('apl Smolov button', /id="apl-methods"[\s\S]*?data-val="Smolov"[\s\S]*?Smolov/.test(html));
ok('apl progression smolov', /id="apl-progression"[\s\S]*?data-val="smolov"/.test(html));
ok('apl progression hint mount', html.includes('id="apl-progression-hint"'));
ok('builder Smolov option', /id="b-method"[\s\S]*?<option value="Smolov">Smolov/.test(html));
ok('METHOD_WHY Smolov', /Smolov:\{label:'Smolov/.test(core));
ok('METHOD_WHY Bro Split', /'Bro Split':\{label:'Bro Split'/.test(core));
ok('normalize smolov', /smolov\|smol/.test(core));
ok('APL_METHOD_PROGRESSION map', src03.includes('APL_METHOD_PROGRESSION') && src03.includes("Smolov:'smolov'"));
ok('aplSyncProgressionFromMethod', /function aplSyncProgressionFromMethod/.test(src03));
ok('toggle syncs on method', /groupId==='apl-methods'[\s\S]{0,160}aplSyncProgressionFromMethod/.test(src03));
ok('init syncs progression', /function initAplangen[\s\S]{0,800}aplSyncProgressionFromMethod/.test(src03));
ok('smolov progression prompt', src03.includes("smolov:'SMOLOV"));
ok('aplPhasesForPlan smolov', /function aplPhasesForPlan[\s\S]*Smolov T1/.test(src03));
ok('BUILDER_METHOD_DAYS Smolov', /Smolov:\['Smolov T1'/.test(src05));
ok('cache bumps', html.includes('01-core.js?v=61') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('05-clients-builder-plans-calendar.js?v=35'));
ok('cache bumps', html.includes('01-core.js?v=61') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('05-clients-builder-plans-calendar.js?v=35'));
ok('CI', wf.includes('test_apl_method_progression.js'));

const start = src03.indexOf('const APL_METHOD_PROGRESSION=');
const end = src03.indexOf('window.aplPhasesForPlan=aplPhasesForPlan;') + 'window.aplPhasesForPlan=aplPhasesForPlan;'.length;
ok('slice', start >= 0 && end > start);

const dom = { querySelectorAll(sel) {
  if (sel === '#apl-progression .apl-opt') return this._progBtns || [];
  if (sel === '#apl-methods .apl-opt.active') return this._methodActive ? [this._methodActive] : [];
  return [];
}, getElementById(id) {
  if (id === 'apl-progression-hint') return this._hint || { textContent: '' };
  return null;
} };
const sandbox = { window: {}, document: dom, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src03.slice(start, end), sandbox);
const PROG = sandbox.APL_METHOD_PROGRESSION || sandbox.window.APL_METHOD_PROGRESSION;

eq('PPL → dup', PROG.PPL, 'dup');
eq('Blokowa → block', PROG.Blokowa, 'block');
eq('Smolov → smolov', PROG.Smolov, 'smolov');
eq('Bro Split → linear', PROG['Bro Split'], 'linear');

const phases = sandbox.aplPhasesForPlan || sandbox.window.aplPhasesForPlan;
const phaseMap = phases('Smolov', 8, ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8']);
ok('smolov 8w phases', phaseMap.w1 === 'Smolov T1' && phaseMap.w8 === 'Test PR');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll apl-method-progression tests passed');
