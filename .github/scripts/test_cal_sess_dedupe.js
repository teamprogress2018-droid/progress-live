#!/usr/bin/env node
'use strict';
/** Kalendarz: jedna karta na klienta+godzinę; plan nie dubluje zapisu Live/sala. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cal = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=76'));
ok('ci unit', wf.includes('test_cal_sess_dedupe.js'));
ok('ci ui', wf.includes('test_cal_sess_dedupe_ui.js'));
ok('helpers', /function calDedupeVisibleSessions/.test(cal) && /function calSessionTimeKey/.test(cal));
ok('visible uses dedupe', /function calVisibleSessions[\s\S]*calDedupeVisibleSessions/.test(cal));

const start = cal.indexOf('function calSessionTimeKey');
const end = cal.indexOf('function calSessionStartMin');
ok('extract dedupe', start >= 0 && end > start);
const ctx = vm.createContext({
  window: {},
  String, Math, parseInt, isFinite, Object, Set,
  isLoggedWorkout: (s) => !!(s && (s.source === 'live' || s.source === 'sala' || s.source === 'client' || s.source === 'homework'))
});
vm.runInContext(cal.slice(start, end), ctx);

const day = '2026-09-15';
const plannedLive = ctx.calDedupeVisibleSessions([
  { id: 'p1', clientId: 'c-ad', date: day, time: '08:00', source: 'planned', type: 'Dzień 1 — Push' },
  { id: 'l1', clientId: 'c-ad', date: day, time: '08:00', source: 'live', type: 'Live' }
]);
ok('planned hidden when live same day', plannedLive.length === 1 && plannedLive[0].id === 'l1', JSON.stringify(plannedLive.map(s => s.id)));

const clones = ctx.calDedupeVisibleSessions([
  { id: 'a1', clientId: 'c-ad', date: day, time: '08:00', source: 'planned', type: 'FBW' },
  { id: 'a2', clientId: 'c-ad', date: day, time: '08:00', source: 'planned', type: 'FBW kopia' }
]);
ok('two planned same slot become one', clones.length === 1 && clones[0].id === 'a1', JSON.stringify(clones.map(s => s.id)));

const twoClients = ctx.calDedupeVisibleSessions([
  { id: 'm1', clientId: 'c-mal', date: day, time: '08:00', source: 'planned', type: 'FBW' },
  { id: 'o1', clientId: 'c-ola', date: day, time: '08:00', source: 'planned', type: 'FBW' }
]);
ok('two clients same hour stay', twoClients.length === 2, JSON.stringify(twoClients.map(s => s.clientId)));

const ghosts = ctx.calDedupeVisibleSessions([
  { id: 'g1', date: day, time: '12:00', source: 'planned', type: 'Sesja B — Push + Legs + Core' },
  { id: 'g2', date: day, time: '12:00', source: 'planned', type: 'Sesja B — Push + Legs + Core' },
  { id: 'g3', date: day, time: '12:00', source: 'planned', type: 'Sesja B — Push + Legs + Core' }
]);
ok('anon same type collapses', ghosts.length === 1 && ghosts[0].id === 'g1', JSON.stringify(ghosts.map(s => s.id)));

const draft = ctx.calDedupeVisibleSessions([
  { id: 'd1', clientId: 'c-ad', date: day, time: '08:00', source: 'live-draft', type: 'draft' },
  { id: 'p1', clientId: 'c-ad', date: day, time: '08:00', source: 'planned', type: 'Plan' }
]);
ok('live-draft hidden', draft.length === 1 && draft[0].id === 'p1');

const laterLive = ctx.calDedupeVisibleSessions([
  { id: 'p1', clientId: 'c-ag', date: day, time: '08:00', source: 'planned', type: 'FBW' },
  { id: 'l1', clientId: 'c-ag', date: day, time: '12:00', source: 'sala', type: 'Sala' }
]);
ok('planned hidden when logged later same day', laterLive.length === 1 && laterLive[0].id === 'l1', JSON.stringify(laterLive.map(s => s.id)));

ok('time key pads hour', ctx.calSessionTimeKey({ time: '8:00' }) === '08:00');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cal-sess-dedupe tests passed');
