#!/usr/bin/env node
'use strict';
/** Live draft: LS + IndexedDB + Firestore source live-draft (co 3 serie). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
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
ok('cache 04', html.includes('04-client-portal.js?v=49'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=59'));
ok('helpers', /function liveShouldPersistDraftRemote/.test(live) && /function livePersistDraftRemote/.test(live) && /function liveDraftIdbPut/.test(live));
ok('start persist', /liveSaveDraft\(n,\{remote:true,force:true\}\)/.test(live));
ok('toggle persist', /liveSaveDraft\(n,\{remote:true\}\)/.test(live));
ok('end keeps id', /id:draftId\|\|newId\('s'\)/.test(live) && /keepRemote:true/.test(live));
ok('source live-draft', /source:'live-draft'/.test(live));
ok('cal hides draft', /function calVisibleSessions/.test(src05) && /calVisibleSessions\(\)/.test(src05));
ok('dash hides draft', /s\.source!=='live-draft'/.test(src04));
ok('logged skips draft', /source==='live-draft'/.test(core));
ok('CI unit', wf.includes('test_live_draft.js'));
ok('CI ui', wf.includes('test_live_draft_ui.js'));

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  createElement() { return { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } }; },
  documentElement: { style: { setProperty() {} } },
  body: { appendChild() {} }
};
const windowObj = { addEventListener() {}, CL: [], SE: [], persistById() {}, notify() {}, document };
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

ok('draft not logged', ctx.isLoggedWorkout({ source: 'live-draft', exercises: [{ name: 'X' }] }) === false);
ok('live is logged', ctx.isLoggedWorkout({ source: 'live', exercises: [{ name: 'X' }] }) === true);
ok('completed skips draft', ctx.completedWorkouts('c1', [
  { id: 'a', clientId: 'c1', source: 'live-draft', date: '2026-09-11', exercises: [{}] },
  { id: 'b', clientId: 'c1', source: 'live', date: '2026-09-11', exercises: [{}] }
]).length === 1);

const m = live.match(/function liveShouldPersistDraftRemote\(setsDone,lastPersisted,force\)\{[\s\S]*?\n\}/);
ok('throttle fn', !!m);
const tctx = vm.createContext({ Number, LIVE_DRAFT_REMOTE_EVERY: 3 });
vm.runInContext(m[0], tctx);
ok('force always', tctx.liveShouldPersistDraftRemote(0, 0, true) === true);
ok('start last -1', tctx.liveShouldPersistDraftRemote(0, -1, false) === true);
ok('skip 1-2', tctx.liveShouldPersistDraftRemote(1, 0, false) === false && tctx.liveShouldPersistDraftRemote(2, 0, false) === false);
ok('every 3', tctx.liveShouldPersistDraftRemote(3, 0, false) === true);
ok('every 6', tctx.liveShouldPersistDraftRemote(6, 3, false) === true);

if (failed) process.exit(1);
console.log('\nAll live-draft tests passed');
