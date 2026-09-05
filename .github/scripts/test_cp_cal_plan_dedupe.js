#!/usr/bin/env node
'use strict';
/** Grafik Assignment: jeden aktywny plan, bez kopii na tym samym dniu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 05 v38', html.includes('05-clients-builder-plans-calendar.js?v=40'));
ok('cache 08 v42', html.includes('08-client-profile-extras.js?v=43'));
ok('ci unit', wf.includes('test_cp_cal_plan_dedupe.js'));
ok('assignment helper', /function cpAssignmentSessions/.test(src08));
ok('drop helper', /function dropPlannedSessionsFrom/.test(src05));
ok('no weekday wrap helper', /function uniqueWeekdaysForTrainDays/.test(src05));
ok('schedule uses trainI', /trainDays\.forEach\(\(\{d,i\},trainI\)/.test(src05));
ok('render uses assignment sessions', /cpAssignmentSessions\(c\.id\)/.test(src08));

const windowObj = {
  SE: [],
  PL: [
    { id: 'ppl', clientId: 'c1', name: 'PPL', updatedAt: '2026-08-01', days: [] },
    { id: 'fbw', clientId: 'c1', name: 'FBW', updatedAt: '2026-09-01', days: [] }
  ]
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  Date, Math, Number, String, isFinite, parseFloat, console,
  latestClientPlan: (id) => windowObj.PL.filter((p) => p.clientId === id)
    .slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0],
  sessionTitle: (s) => s.type || s.title || 'Sesja'
};
ctx.globalThis = ctx;
vm.createContext(ctx);

const start = src08.indexOf('function cpCollapseDaySessions');
const end = src08.indexOf('function renderCPOverview');
ok('08 helper slice', start > 0 && end > start);
vm.runInContext(src08.slice(start, end), ctx);

windowObj.SE = [
  { id: 'a1', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'ppl', dayIdx: 0, type: 'DZIEŃ A — PULL + L' },
  { id: 'a2', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'ppl', dayIdx: 0, type: 'DZIEŃ A — PULL + L' },
  { id: 'f1', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'fbw', dayIdx: 0, type: 'DZIEŃ 1 — FULL BODY' },
  { id: 'f2', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'fbw', dayIdx: 0, type: 'DZIEŃ 1 — FULL BODY' },
  { id: 'f3', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'fbw', dayIdx: 0, type: 'DZIEŃ 1 — FULL BODY' },
  { id: 'c1x', clientId: 'c1', date: '2026-09-07', source: 'planned', planId: 'ppl', dayIdx: 2, type: 'DZIEŃ C — LEGS' },
  { id: 'live', clientId: 'c1', date: '2026-09-07', source: 'live', type: 'Live' }
];
const assign = ctx.cpAssignmentSessions('c1');
const planned = assign.filter((s) => s.source === 'planned');
ok('one planned on monday', planned.length === 1, 'n=' + planned.length);
ok('active FBW not PPL', planned[0] && planned[0].planId === 'fbw' && planned[0].type.indexOf('DZIEŃ 1') === 0);
ok('keeps live session', assign.some((s) => s.source === 'live'));

const dropSrc = src05.slice(
  src05.indexOf('function dropPlannedSessionsFrom'),
  src05.indexOf('/** Tworzy sesje kalendarzowe')
);
vm.runInContext(dropSrc, ctx);
windowObj.SE.push({ id: 'old', clientId: 'c1', date: '2026-08-01', source: 'planned', planId: 'ppl', dayIdx: 0, type: 'old' });
const n = ctx.dropPlannedSessionsFrom('c1', '2026-09-01');
ok('drops future planned', n >= 6 && !windowObj.SE.some((s) => s.source === 'planned' && s.date >= '2026-09-01'));
ok('keeps past planned', windowObj.SE.some((s) => s.id === 'old'));
ok('keeps live after drop', windowObj.SE.some((s) => s.source === 'live'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-cal-plan-dedupe tests passed');
