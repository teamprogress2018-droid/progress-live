#!/usr/bin/env node
'use strict';
/** Brama pakietu: kalendarz / Live bez opłaty — Trial / Gość. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=103'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=61'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=60'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=55'));
ok('helpers', /function clientHasPaidAccess/.test(core) && /function setClientAccessMode/.test(core) && /function assertClientPaidAccess/.test(core));
ok('schedule gate', /assertClientPaidAccess\(plan\.clientId\)/.test(src05));
ok('maybe schedule gate', src05.slice(src05.indexOf('function maybeSchedulePlanToCalendar')).includes('assertClientPaidAccess(plan.clientId)'));
ok('live start gate', /assertClientPaidAccess\(st\.clientId\)/.test(live));
ok('live decrement paid only', /consumeClientPackageSession\(st\.clientId/.test(live) && /payStatus==='paid'/.test(core));
ok('live banner', /live-pay-gate/.test(live) && /setClientAccessMode/.test(live));
ok('cp payments modes', /cp-access-mode/.test(src08) && /Trial/.test(src08) && /Gość/.test(src08));
ok('overview banner', /cp-pay-gate/.test(src08));
ok('CI unit', wf.includes('test_pkg_gate.js'));
ok('CI ui', wf.includes('test_pkg_gate_ui.js'));

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, querySelector() { return null; }, querySelectorAll() { return []; } }; },
  documentElement: { style: { setProperty() {} } },
  body: { appendChild() {} }
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Anna' }, { id: 'c2', name: 'Bartek', packageSkipped: true }, { id: 'c3', name: 'Celina' }],
  PACKAGES: [],
  persistById() {},
  notify() {},
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Set, isFinite, isNaN,
  persistById() {}, notify() {},
  setTimeout: () => 0, clearTimeout() {}
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);
windowObj.CL = ctx.window.CL.length ? windowObj.CL : ctx.window.CL;
ctx.window.CL = [
  { id: 'c1', name: 'Anna' },
  { id: 'c2', name: 'Bartek', packageSkipped: true },
  { id: 'c3', name: 'Celina' }
];
ctx.window.PACKAGES = [];
ctx.window.persistById = () => {};
ctx.persistById = () => {};
ctx.notify = () => {};

function acc(id) { return ctx.clientHasPaidAccess(id); }

ok('no package open', acc('c1').ok && acc('c1').reason === 'no-package');
ok('skipped is guest', acc('c2').ok && acc('c2').reason === 'guest');

ctx.window.PACKAGES = [{ id: 'p1', clientId: 'c1', payStatus: 'pending', status: 'active', title: '10 sesji' }];
ok('unpaid blocks', !acc('c1').ok && acc('c1').reason === 'unpaid');
ok('assert unpaid false', ctx.assertClientPaidAccess('c1') === false);

ctx.window.PACKAGES = [{ id: 'p1', clientId: 'c1', payStatus: 'paid', status: 'active' }];
ok('paid allows', acc('c1').ok && acc('c1').reason === 'paid');

ctx.window.PACKAGES = [{ id: 'p1', clientId: 'c1', payStatus: 'paid', status: 'active', expiresDate: '2020-01-01' }];
ok('expired blocks', !acc('c1').ok && acc('c1').reason === 'expired');

ctx.window.PACKAGES = [{ id: 'p1', clientId: 'c1', payStatus: 'pending' }];
ctx.setClientAccessMode('c1', 'trial');
ok('trial bypass', acc('c1').ok && acc('c1').reason === 'trial');
ctx.setClientAccessMode('c1', 'guest');
ok('guest bypass', acc('c1').ok && acc('c1').reason === 'guest');
ctx.setClientAccessMode('c1', 'standard');
ok('standard back to unpaid', !acc('c1').ok && acc('c1').reason === 'unpaid');
ok('mode labels', ctx.clientPaidAccessLabel({ reason: 'unpaid' }).indexOf('nieopłacon') >= 0);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll pkg-gate tests passed');
