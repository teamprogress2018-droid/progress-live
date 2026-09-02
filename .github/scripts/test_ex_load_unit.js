#!/usr/bin/env node
/** Load column: kg vs sec (liny, deska, izometrie). */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=59'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=35'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=41'));
ok('builder apply helper', src05.includes('function builderApplyLoadUnit'));
ok('builder header KG/S', src05.includes('KG/S'));
ok('save loadUnit', src05.includes("loadUnit:typeof exLoadUnit==='function'?exLoadUnit(n):'kg'"));
ok('liny tagged sec', /name:'Liny treningowe'[\s\S]{0,280}load:'sec'/.test(six));
ok('deska tagged sec', /name:'Deska',aka:'Plank[^']*'[\s\S]{0,240}load:'sec'/.test(six));
ok('taps not tagged', !/name:'Deska z unoszeniem ramienia'[^}]*load:'sec'/.test(six));
ok('wioslarz tagged min', /name:'Wioślarz'[^}]*load:'min'/.test(six));
ok('airbike tagged min', /name:'Airbike'[^}]*load:'min'/.test(six));
ok('rower tagged min', /name:'Rower stacjonarny'[^}]*load:'min'/.test(six));
ok('ham curl not min', !/name:'Uginanie ud na wioślarzu'[^}]*load:'min'/.test(six));

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
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
  Map,
  Set,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

const {
  exLoadUnit, formatSetLoad, formatPlanExerciseLine, formatPlanLoadSuffix,
  parsePlanExercise, loadUnitPlaceholder, loadUnitSuffix, loadUnitColumnLabel,
  loadUnitShortLabel, exerciseSetVolumeKg, loggedSetRows
} = ctx;

eq('goblet kg', exLoadUnit('Przysiad Goblet'), 'kg');
eq('liny sec', exLoadUnit('Liny treningowe'), 'sec');
eq('liny aka', exLoadUnit('Battle ropes'), 'sec');
eq('deska sec', exLoadUnit('Deska'), 'sec');
eq('deska taps stay kg', exLoadUnit('Deska z unoszeniem ramienia'), 'kg');
eq('wall sit sec', exLoadUnit('Przysiad przy ścianie'), 'sec');
eq('dead hang sec', exLoadUnit('Zwisy na drążku'), 'sec');
eq('leg raises kg', exLoadUnit('Zwisy nóg drążek'), 'kg');
eq('wioslarz min', exLoadUnit('Wioślarz'), 'min');
eq('airbike min', exLoadUnit('Airbike'), 'min');
eq('assault aka min', exLoadUnit('Assault bike'), 'min');
eq('rower stacjonarny min', exLoadUnit('Rower stacjonarny'), 'min');
eq('orbitrek min', exLoadUnit('Orbitrek'), 'min');
eq('db row stays kg', exLoadUnit('Wiosłowanie hantlem'), 'kg');
eq('ham curl on rower kg', exLoadUnit('Uginanie ud na wioślarzu'), 'kg');
eq('stored unit wins', exLoadUnit({name: 'Przysiad', loadUnit: 'sec'}), 'sec');
eq('stale kg on rower becomes min', exLoadUnit({name: 'Wioślarz', loadUnit: 'kg'}), 'min');
eq('stored meters on rower kept', exLoadUnit({name: 'Wioślarz', loadUnit: 'm'}), 'm');
eq('placeholder sec', loadUnitPlaceholder('sec'), 'sec');
eq('placeholder min', loadUnitPlaceholder('min'), 'min');
eq('placeholder kg', loadUnitPlaceholder('kg'), 'kg');
eq('suffix s', loadUnitSuffix('sec'), 's');
eq('suffix min', loadUnitSuffix('min'), 'min');
eq('column czas min', loadUnitColumnLabel('min'), 'Czas (min)');
eq('short min', loadUnitShortLabel('min'), 'Min');
eq('format default kg', formatSetLoad(80, 8), '80 kg × 8');
eq('format liny', formatSetLoad(35, 12, 'Liny treningowe'), '35 s × 12');
eq('format wioslarz', formatSetLoad(20, 1, 'Wioślarz'), '20 min × 1');
eq('plan suffix liny', formatPlanLoadSuffix({name: 'Liny treningowe', kg: '35'}), ' @35s');
eq('plan suffix wioslarz', formatPlanLoadSuffix({name: 'Wioślarz', kg: '20'}), ' @20min');
eq('plan line liny', formatPlanExerciseLine({name: 'Liny treningowe', sets: '4', reps: '30', kg: '35'}), 'Liny treningowe 4×30 @35s');
eq('parse @35s', parsePlanExercise('Liny treningowe 4x30 @35s').kg, '35');
eq('parse @35s unit', parsePlanExercise('Liny treningowe 4x30 @35s').loadUnit, 'sec');
eq('parse @20min', parsePlanExercise('Wioślarz 3x1 @20min').kg, '20');
eq('parse @20min unit', parsePlanExercise('Wioślarz 3x1 @20min').loadUnit, 'min');

const vol = exerciseSetVolumeKg([
  {name: 'Przysiad', sets: [{done: true, kg: 80, reps: 8}]},
  {name: 'Liny treningowe', sets: [{done: true, kg: 35, reps: 12}]},
  {name: 'Wioślarz', sets: [{done: true, kg: 20, reps: 1}]}
]);
eq('volume skips timed', vol, 80 * 8);

const timedSessions = [
  {id: 's1', clientId: 'c1', date: '2026-08-01', exercises: [{name: 'Liny treningowe', sets: [{kg: 35, reps: 12, setNo: 1}]}]}
];
eq('no fake PR from liny', loggedSetRows('c1', 'Liny treningowe', timedSessions).length, 0);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all ok');
