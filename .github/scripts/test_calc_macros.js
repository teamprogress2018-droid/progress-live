#!/usr/bin/env node
'use strict';
const { cacheAtLeast } = require('./cache-pin.js');
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
  (src07.match(/const CALC_KCAL_MIN=\{[^}]*\};/) || [''])[0] + '\n' +
  extract(src07, 'calcKcalFloor') + '\n' + extract(src07, 'calcApplyKcalFloor') + '\n' +
  extract(src07, 'calcMacrosFromInputs') + '\n' +
  extract(src07, 'applyMacrosToClient') + '\n' +
  'window.calcMacrosFromInputs=calcMacrosFromInputs;window.applyMacrosToClient=applyMacrosToClient;',
  sandbox
);

const m = sandbox.calcMacrosFromInputs({ age: 30, weight: 80, height: 180, gender: 'M', activity: 1.375, goalDelta: 0, macroP: 35, macroF: 25, macroC: 40 });
ok('tdee number', m.tdee > 1500 && m.tdee < 4000);
ok('macros sum kcal', Math.abs((m.proteinG * 4 + m.fatG * 9 + m.carbG * 4) - m.targetKcal) < 20);

// Twarde minimum (audyt 8.11.2026): max(BMR, 1200 kcal kobiety / 1500 kcal mężczyźni).
// Kobieta 50 kg / 160 cm / 30 lat, mała aktywność, agresywna redukcja: TDEE − 500 = ok. 927 kcal.
const low = sandbox.calcMacrosFromInputs({ age: 30, weight: 50, height: 160, gender: 'K', activity: 1.2, goalDelta: -500, macroP: 30, macroF: 25, macroC: 45 });
ok('50 kg / 160 cm / 30 lat: TDEE − 500 would be ~927 kcal', low.tdee - 500 >= 920 && low.tdee - 500 <= 935);
ok('50 kg / 160 cm / 30 lat: target raised to at least 1200 kcal and BMR', low.targetKcal >= 1200 && low.targetKcal >= 1189 && low.kcalFloorApplied === true && low.kcalFloor === 1200);
const man = sandbox.calcMacrosFromInputs({ age: 60, weight: 55, height: 160, gender: 'M', activity: 1.2, goalDelta: -500, macroP: 30, macroF: 25, macroC: 45 });
ok('man: target never below 1500 kcal', man.targetKcal === 1500 && man.kcalFloorApplied === true);
const big = sandbox.calcMacrosFromInputs({ age: 25, weight: 120, height: 190, gender: 'M', activity: 1.2, goalDelta: -500, macroP: 30, macroF: 25, macroC: 45 });
ok('BMR above 1500: floor = BMR', big.kcalFloor > 1500 && big.targetKcal >= big.kcalFloor);
ok('normal deficit untouched', m.kcalFloorApplied === false && m.targetKcal === m.tdee);
const fl = sandbox.calcApplyKcalFloor(900, 'K', 1100);
ok('floor helper reports raw, floor and applied', fl.raw === 900 && fl.kcal === 1200 && fl.applied === true && fl.bmr === 1100);
ok('calculator shows the trainer that the minimum worked', src07.includes('Minimum zadziałało') && src07.includes('kcalFloor.applied?calcKcalFloorNoticeHTML(kcalFloor)') && !src07.includes('belowBmr'));

const c = { id: 'c1', name: 'Piotr' };
ok('apply writes macros', sandbox.applyMacrosToClient(c, m, { persist: true }) === true);
ok('client.macros.tdee', c.macros && c.macros.tdee === m.tdee);
ok('persist clients', sandbox.persisted === 'clients:c1');
ok('event macros.saved', sandbox.window._appEvents.some(e => e.type === 'macros.saved' && e.payload.clientId === 'c1'));

ok('cache 07', cacheAtLeast(html, '07-forms-metrics-calculator.js', 45));
ok('cache diet-plan', cacheAtLeast(html, 'diet-plan.js', 1));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll calc-macros checks passed');
