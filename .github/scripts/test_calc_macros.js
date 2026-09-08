#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

let failed = 0;
function ok(name, cond) {
  if (!cond) { console.error('FAIL', name); failed++; }
  else console.log('OK  ', name);
}

ok('save button', html.includes('calcSaveToClient()') && html.includes('Zapisz w profilu'));
ok('send still present', html.includes('calcSendToClient()'));
ok('helpers', src07.includes('function calcMacrosFromInputs') && src07.includes('function applyMacrosToClient') && src07.includes('function calcSaveToClient'));

const sandbox = {
  window: { _appEvents: [] },
  persistById(col, obj) { sandbox.persisted = col + ':' + obj.id; return obj; },
  emitAppEvent(type, payload) { sandbox.window._appEvents.push({ type, payload }); },
  Math, Date, Number, String, Object, JSON, parseInt, parseFloat, console
};
sandbox.window.persistById = sandbox.persistById;
vm.runInNewContext(
  extract(src07, 'calcMacrosFromInputs') + '\n' +
  extract(src07, 'applyMacrosToClient') + '\n' +
  'window.calcMacrosFromInputs=calcMacrosFromInputs;window.applyMacrosToClient=applyMacrosToClient;',
  sandbox
);

const m = sandbox.calcMacrosFromInputs({ age: 30, weight: 80, height: 180, gender: 'M', activity: 1.375, goalDelta: 0, macroP: 35, macroF: 25, macroC: 40 });
ok('tdee number', m.tdee > 1500 && m.tdee < 4000);
ok('macros sum kcal', Math.abs((m.proteinG * 4 + m.fatG * 9 + m.carbG * 4) - m.targetKcal) < 20);

const c = { id: 'c1', name: 'Piotr' };
ok('apply writes macros', sandbox.applyMacrosToClient(c, m, { persist: true }) === true);
ok('client.macros.tdee', c.macros && c.macros.tdee === m.tdee);
ok('persist clients', sandbox.persisted === 'clients:c1');
ok('event macros.saved', sandbox.window._appEvents.some(e => e.type === 'macros.saved' && e.payload.clientId === 'c1'));

ok('cache 07', html.includes('07-forms-metrics-calculator.js?v=32'));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll calc-macros checks passed');
