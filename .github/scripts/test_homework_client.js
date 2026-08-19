#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const els = {};
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: (id) => els[id] || null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild: () => {}, classList: { add() {}, remove() {} } }),
  body: { appendChild(el) { if (el && el.id) els[el.id] = el; } },
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Test Klient', status: 'active' }],
  PL: [], SE: [], EX: [], WO: [], TASKS: [],
  OD_WORKOUTS: [],
  SETTINGS: { clientApp: { visibleSections: {} }, brand: { accentColor: '#e60000' } },
  persistById: () => Promise.resolve(),
  notify() {},
  pushMsg() {},
  document,
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
  Set,
  isFinite,
  isNaN,
  encodeURIComponent,
  setTimeout: () => 0,
  clearTimeout: () => {},
  notify() {},
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const root = path.join(__dirname, '..', '..');
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
windowObj.CL = [{ id: 'c1', name: 'Test Klient', status: 'active' }];
vm.runInContext(fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8'), ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8'), ctx);
} catch (e) {
  if (!windowObj.OD_DEMO_WORKOUTS) throw e;
}

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('isHomework kind', ctx.isHomework({ kind: 'homework' }));
ok('isHomework odWorkoutId', ctx.isHomework({ odWorkoutId: 'ow2' }));
ok('isOneShot excludes homework', !ctx.isOneShot({ kind: 'homework', odWorkoutId: 'ow2' }));
ok('nav has homework', ctx.capLiveNavScreens().some((s) => s.id === 'homework'));

ctx.ensureODWorkouts();
const w = ctx.allODWorkouts().find((x) => x.id === 'ow2');
ok('ow2 structure', !!(w && w.structure && w.structure.rounds));
ok('structure text', ctx.odWorkoutStructureText(w).includes('45s'));
ok('tabata workout exists', ctx.allODWorkouts().some((x) => x.id === 'ow8' && x.format === 'tabata'));

windowObj.TASKS = [];
ctx.assignHomeworkToClient('c1', 'ow2', { notify: false });
ok('homework assigned', windowObj.TASKS.length === 1 && windowObj.TASKS[0].kind === 'homework');

const html = ctx.capScreenHTML('homework', { id: 'c1', name: 'Test' });
ok('homework breath filter', ctx.capScreenHTML('homework', { id: 'c1', name: 'Test' }).includes('Oddech'));

if (failed) {
  console.error('\nZadania domowe: ' + failed + ' FAIL');
  process.exit(1);
}
console.log('\nZadania domowe klienta: OK');
process.exit(0);
