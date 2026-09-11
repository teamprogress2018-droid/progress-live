#!/usr/bin/env node
'use strict';
/** Live: plan Fitebo ładuje te same ćwiczenia i hipertrofię RIR 2 (bez adaptacji). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01 v89', html.includes('01-core.js?v=100'));
ok('cache 02 v49', html.includes('02-workouts-onboarding-templates-live.js?v=59'));
ok('cache 08 v50', html.includes('08-client-profile-extras.js?v=54'));
ok('ci unit', wf.includes('test_fitebo_live.js'));
ok('ci ui', wf.includes('test_fitebo_live_ui.js'));
ok('live uses planPhaseSchedule', /planPhaseSchedule/.test(live) && /fiteboResolveDayExercises/.test(live));
ok('live prefers continue', /function livePreferredPlan/.test(live) && /fitebo-continue/.test(live));

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = { addEventListener() {}, CL: [], PL: [], SE: [], EX: [], WO: [], METRIC_ENTRIES: [], document };
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Map, Set, setTimeout, clearTimeout, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);

const sch = ctx.planPhaseSchedule({ source: 'fitebo', fromFitebo: true }, { level: 'poczatkujacy' });
ok('no adapt for beginner fitebo', /Hipertrofia/.test(sch[0].cel) && sch[0].rir === '2');
ok('beginner level still has adapt', /Adaptacja/.test(ctx.periodScheduleForLevel('poczatkujacy')[0].cel));

const start = src08.indexOf('function fbNormName');
const end = src08.indexOf('function fbFileLoad');
ok('08 helpers extract', start >= 0 && end > start);
const ctx8 = vm.createContext({
  window: {
    CL: [{ id: 'c-rad', name: 'Radosław Jarząb', level: 'poczatkujacy' }],
    PL: [],
    SE: [{
      clientId: 'c-rad', source: 'fitebo', type: 'Trening B (Push)',
      exercises: [{ name: 'Wyciskanie hantli', sets: '4', reps: '8-10', kg: '22.5' }]
    }]
  },
  String, Math, Map, parseInt, isFinite, parseFloat
});
vm.runInContext(src08.slice(start, end), ctx8);
const resolved = ctx8.fiteboResolveDayExercises('c-rad', { source: 'fitebo', fromFitebo: true }, {
  day: 'Trening B (Push)',
  exercises: [
    { name: 'Burpees', sets: '4', reps: '8', rest: '45s' },
    { name: 'Mountain climbers', sets: '3', reps: '30s' }
  ]
});
ok('burpees replaced by fitebo press', resolved && resolved[0] && /Wyciskanie hantli/.test(resolved[0].name), JSON.stringify(resolved));

const week = ctx.exerciseForPlanWeek({ name: 'Wyciskanie hantli', sets: '4', reps: '8-10' }, { source: 'fitebo' }, 0);
const mapped = ctx.mapPlanExercisesForClient([week], 'c-rad', { source: 'fitebo' });
ok('sets prefilled rir 2', mapped[0] && mapped[0].sets.some(s => String(s.rir) === '2'), JSON.stringify(mapped[0] && mapped[0].sets[0]));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll fitebo-live tests passed');
