#!/usr/bin/env node
'use strict';
/** Autoflow: package.expired i checkin.submitted idą przez emitAppEvent. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=103'));
ok('cache 04', html.includes('04-client-portal.js?v=50'));
ok('cache 09', html.includes('09-posture-kb-invites-private.js?v=44'));
ok('html triggers', html.includes('value="package.expired"') && html.includes('value="checkin.submitted"'));
ok('bus wires autoflow', /autoflowOnAppEvent/.test(core) && /emitAppEvent/.test(core));
ok('checkin emits', /emitAppEvent\('checkin.submitted'/.test(src04));
ok('scan expired', /function scanAndEmitPackageExpired/.test(src09));
ok('event map', /function autoflowTriggerForEvent/.test(src09) && /package\.expired/.test(src09) && /checkin\.submitted/.test(src09));
ok('poll skips events', /kind==='package.expired'\|\|kind==='checkin.submitted'/.test(src09));
ok('CI unit', wf.includes('test_autoflow_events.js'));
ok('CI ui', wf.includes('test_autoflow_events_ui.js'));

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  dispatchEvent() { return true; },
  createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }; },
  documentElement: { style: { setProperty() {} } },
  body: { appendChild() {} }
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Anna Nowak', status: 'active' }],
  PACKAGES: [{ id: 'pk1', clientId: 'c1', title: '10 sesji', payStatus: 'expired', expiresDate: '2020-01-01' }],
  AUTOFLOWS: [],
  AF_STATE: { enrollments: {}, executed: {}, lastFired: {}, logs: [] },
  TASKS: [],
  persistById() {},
  notify() {},
  document,
  CustomEvent: function(n, o) { this.type = n; this.detail = o && o.detail; }
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Set, isFinite, isNaN, CustomEvent: windowObj.CustomEvent,
  persistById() {}, notify() {},
  setTimeout: () => 0, clearTimeout() {}
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);
ctx.window.CL = [{ id: 'c1', name: 'Anna Nowak', status: 'active' }];
ctx.window.PACKAGES = [{ id: 'pk1', clientId: 'c1', title: '10 sesji', payStatus: 'expired', expiresDate: '2020-01-01' }];
ctx.window.AUTOFLOWS = [];
ctx.window.AF_STATE = { enrollments: {}, executed: {}, lastFired: {}, logs: [] };
ctx.window.TASKS = [];
ctx.CL = ctx.window.CL;
ctx.PACKAGES = ctx.window.PACKAGES;
function sliceFn(src, startName, nextName) {
  const a = src.indexOf('function ' + startName);
  const b = src.indexOf('function ' + nextName);
  if (a < 0 || b < 0 || b <= a) throw new Error('slice ' + startName);
  return src.slice(a, b);
}
const bundle = sliceFn(src09, 'ensureAfState', 'enrollScopeClients')
  + sliceFn(src09, 'logAF', 'runAutoflowsCheck')
  + sliceFn(src09, 'execAFStep', 'notify');
vm.runInContext(bundle, ctx);
['autoflowOnAppEvent','autoflowTriggerForEvent','scanAndEmitPackageExpired','fireAutoflowTrigger','logAF','execAFStep','enrollClientInAutoflow','ensureAfState'].forEach((n) => {
  if (typeof ctx[n] === 'function') ctx.window[n] = ctx[n];
});
function clientMsgs(cid) {
  const bag = (ctx.window.MSGS && ctx.window.MSGS[cid]) || [];
  return bag;
}
function clearMsgs() {
  const bag = ctx.window.MSGS || {};
  Object.keys(bag).forEach((k) => { delete bag[k]; });
}

ok('helpers on ctx', typeof ctx.autoflowOnAppEvent === 'function' && typeof ctx.logAF === 'function' && bundle.includes('function logAF'));
ok('map package', ctx.autoflowTriggerForEvent('package.expired') === 'package.expired');
ok('map checkin', ctx.autoflowTriggerForEvent('checkin.submitted') === 'checkin.submitted');
ok('map alias', ctx.autoflowTriggerForEvent('onCheckInSubmitted') === 'checkin.submitted');
ok('map client', ctx.autoflowTriggerForEvent('client.created') === 'new_client');
ok('map other empty', ctx.autoflowTriggerForEvent('macros.saved') === '');

ctx.window.AUTOFLOWS = [{
  id: 'af1', status: 'active', type: 'trigger', trigger: 'package.expired', scope: 'all',
  name: 'Pakiet wygasł',
  steps: [{ type: 'message', day: 1, text: '{imie}, pakiet wygasł' }]
}];
clearMsgs();
const n = ctx.scanAndEmitPackageExpired('2026-09-11');
ok('scan emits once', n === 1, 'n=' + n);
ok('msg to client', clientMsgs('c1').length === 1 && /pakiet wygasł/.test(clientMsgs('c1')[0].text), JSON.stringify(clientMsgs('c1')));
const n2 = ctx.scanAndEmitPackageExpired('2026-09-11');
ok('scan no double', n2 === 0 && clientMsgs('c1').length === 1, 'n2=' + n2 + ' msgs=' + clientMsgs('c1').length);

ctx.window.PACKAGES = [
  { id: 'pk2', clientId: 'c1', title: '8 sesji', payStatus: 'expired', expiresDate: '2020-01-01' },
  { id: 'pk3', clientId: 'c1', title: '12 sesji', payStatus: 'expired', expiresDate: '2020-02-01' }
];
clearMsgs();
const n3 = ctx.scanAndEmitPackageExpired('2026-09-11');
ok('scan two packages', n3 === 2 && clientMsgs('c1').length === 2, 'n3=' + n3 + ' msgs=' + clientMsgs('c1').length);

ctx.window.AUTOFLOWS = [{
  id: 'af2', status: 'active', type: 'trigger', trigger: 'checkin.submitted', scope: 'all',
  name: 'Thanks',
  steps: [{ type: 'message', day: 1, text: 'Dzięki, {imie}' }]
}];
clearMsgs();
const ran = ctx.autoflowOnAppEvent('checkin.submitted', { clientId: 'c1', checkinId: 'ci1' });
ok('checkin fires', ran === 1 && clientMsgs('c1').length === 1 && /Dzięki/.test(clientMsgs('c1')[0].text), JSON.stringify(clientMsgs('c1')) + ' ran=' + ran);
const ran2 = ctx.autoflowOnAppEvent('checkin.submitted', { clientId: 'c1', checkinId: 'ci1' });
ok('checkin no double same id', ran2 === 0 && clientMsgs('c1').length === 1);
const ran3 = ctx.autoflowOnAppEvent('checkin.submitted', { clientId: 'c1', checkinId: 'ci2' });
ok('checkin again new id', ran3 === 1 && clientMsgs('c1').length === 2);

if (failed) process.exit(1);
console.log('\nAll autoflow-events tests passed');
