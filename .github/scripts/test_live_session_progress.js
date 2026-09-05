#!/usr/bin/env node
'use strict';
/** Live dock Postęp + zapis sesji → adherencja / Progress. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 02 v30', html.includes('02-workouts-onboarding-templates-live.js?v=30'));
ok('cache 01 v73', html.includes('01-core.js?v=73'));
ok('dock Postęp ids', html.includes('id="live-ex-done"') && html.includes('id="live-sets-done"') && html.includes('id="live-volume"'));
ok('dock hint', html.includes('id="live-progress-hint"'));
ok('end warns empty sets', /Nie odhaczono żadnej serii/.test(live));
ok('end uses todayYmd', /date:\(typeof todayYmd===/.test(live));
ok('CI unit', wf.includes('test_live_session_progress.js'));
ok('CI ui', wf.includes('test_live_progress_ui.js'));

const m = live.match(/function liveProgressStats\(exercises\)\{[\s\S]*?\n\}/);
ok('stats fn extract', !!m);
const ctx = vm.createContext({ window: {}, Number, String, Math, parseFloat, parseInt, Array, Object });
vm.runInContext(m[0] + '\nwindow.liveProgressStats=liveProgressStats;', ctx);
const stats = ctx.liveProgressStats || ctx.window.liveProgressStats;

const plan = [
  { name: 'Przysiad Goblet', done: false, sets: [
    { setNo: 1, kg: 6, reps: 12, done: false },
    { setNo: 2, kg: 6, reps: 12, done: false },
    { setNo: 3, kg: 6, reps: 12, done: false },
    { setNo: 4, kg: 6, reps: 12, done: false }
  ]},
  { name: 'Wyciskanie', done: false, sets: [
    { setNo: 1, kg: 20, reps: 10, done: false }
  ]}
];
const empty = stats(plan);
ok('unchecked is 0/2 ćw', empty.doneCnt === 0 && empty.total === 2, JSON.stringify(empty));
ok('unchecked 0 serii', empty.setsDone === 0);
ok('unchecked 0 kg', empty.volume === 0);

const oneSet = JSON.parse(JSON.stringify(plan));
oneSet[0].sets[0].done = true;
const mid = stats(oneSet);
ok('one set: still 0 ćw', mid.doneCnt === 0 && mid.setsDone === 1);
ok('one set volume 72', mid.volume === 72);

const allGoblet = JSON.parse(JSON.stringify(plan));
allGoblet[0].sets.forEach(s => { s.done = true; });
allGoblet[0].done = true;
const gob = stats(allGoblet);
ok('goblet done: 1/2 ćw', gob.doneCnt === 1 && gob.setsDone === 4);
ok('goblet volume 288', gob.volume === 288);

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const win = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], TASKS: [], METRIC_ENTRIES: [], document };
win.window = win;
const coreCtx = { window: win, document, console, Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON, setTimeout, clearTimeout, isNaN, Infinity, undefined };
coreCtx.globalThis = coreCtx;
vm.createContext(coreCtx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), coreCtx);
const { clientAdherenceStats, isLoggedWorkout, todayYmd } = coreCtx;
const today = todayYmd();
win.SE = [{
  id: 's-live-1', clientId: 'c1', date: today, source: 'live',
  exercises: [{ name: 'Przysiad Goblet', sets: [{ kg: 6, reps: 12 }] }]
}];
ok('live is logged workout', isLoggedWorkout(win.SE[0]) === true);
const adh = clientAdherenceStats('c1', 30);
ok('saved live counts in Progress', adh.logged === 1, JSON.stringify(adh));

const plannedOnly = {
  id: 's-pl', clientId: 'c1', date: today, source: 'planned', exercises: []
};
win.SE = [plannedOnly];
ok('planned is not logged', isLoggedWorkout(plannedOnly) === false);
ok('planned does not fill Progress', clientAdherenceStats('c1', 30).logged === 0);

if (failed) process.exit(1);
console.log('\nAll live-session-progress tests passed');
