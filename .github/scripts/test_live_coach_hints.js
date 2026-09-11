#!/usr/bin/env node
'use strict';
/** Live: przerwa / tempo (czas pracy) + harmonogram periodyzacji. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=99'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=59'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=56'));
ok('cache 10', html.includes('10-client-app.js?v=39'));
ok('cache styles', html.includes('styles.css?v=80'));
ok('live period card', html.includes('id="live-period-card"') && html.includes('id="live-b-period-card"'));
ok('live plan rest btn', html.includes('liveStartRestFromPlan()') && html.includes('id="live-rest-plan-hint"'));
ok('live maps tempo', /tempo:ex\.tempo/.test(core));
ok('live card chips', /exerciseCoachHintsHtml/.test(live) && /live-week-hint/.test(live));
ok('client chips', /exerciseCoachHintsHtml/.test(client));
ok('builder uses shared schedule', /periodScheduleForLevel/.test(builder) && /periodWeekModel/.test(builder));
ok('CI unit', wf.includes('test_live_coach_hints.js'));
ok('CI ui', wf.includes('test_live_coach_hints_ui.js'));

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

const {
  parseTempoSeconds, plannedWorkSeconds, exerciseCoachHints, exerciseCoachHintsHtml,
  periodScheduleForLevel, periodWeekModel, periodWeekDeltaLabel, planPeriodWeekIndex,
  mapPlanExercisesForClient, planPhaseSchedule, exerciseForPlanWeek, isFiteboLikePlan
} = ctx;

ok('tempo 3-1-1-0 = 5s', parseTempoSeconds('3-1-1-0') === 5);
ok('work 10 × tempo = 50s', plannedWorkSeconds({ tempo: '3-1-1-0', reps: '10' }) === 50);
ok('HIIT 20s work', plannedWorkSeconds({ reps: '20s' }) === 20);
ok('range 8-12 uses lo', plannedWorkSeconds({ tempo: '2-0-2', reps: '8-12' }) === 32);

const goblet = exerciseCoachHints({ rest: '90s', tempo: '3-1-1-0', reps: '10', rpe: '8' });
ok('goblet rest 90', goblet.restSec === 90 && goblet.restLabel === '90 s', JSON.stringify(goblet));
ok('goblet work 50', goblet.workSec === 50 && goblet.workLabel === '50 s', JSON.stringify(goblet));
ok('html chips', /Praca 50 s/.test(exerciseCoachHintsHtml({ rest: '90s', tempo: '3-1-1-0', reps: '10', rpe: '8' }))
  && /Przerwa 90 s/.test(exerciseCoachHintsHtml({ rest: '90s', tempo: '3-1-1-0', reps: '10' }))
  && /Tempo 3-1-1-0/.test(exerciseCoachHintsHtml({ rest: '90s', tempo: '3-1-1-0', reps: '10' })));
ok('empty ex no fake rest', exerciseCoachHints(null).restSec === 0);

ok('sredni 4 weeks', periodScheduleForLevel('sredni').length === 4 && /Akumulacja/.test(periodScheduleForLevel('sredni')[0].cel));
ok('week2 intensyfikacja RPE 8', periodWeekModel('sredni', 1).rpe === '8');
ok('week1 is base label', /wartości z planu/.test(periodWeekDeltaLabel(periodWeekModel('sredni', 0), true)));

windowObj.CL = [{ id: 'c1', name: 'Ewelina', level: 'sredni' }];
windowObj.SE = [];
const plan = { id: 'p1', clientId: 'c1', level: 'sredni', createdAt: '2026-08-25T10:00:00.000Z' };
ok('week idx after 14d', planPeriodWeekIndex('c1', plan, Date.parse('2026-09-08T12:00:00.000Z')) === 2);

const fbSch = planPhaseSchedule({ source: 'fitebo', fromFitebo: true }, { level: 'poczatkujacy' });
ok('fitebo skips beginner adapt', /Hipertrofia/.test(fbSch[0].cel) && !/Adaptacja/.test(fbSch[0].cel), JSON.stringify(fbSch[0]));
ok('fitebo week rir 2', fbSch[0].rir === '2' && /RPE 8/.test(fbSch[0].rpe));
ok('fitebo like', isFiteboLikePlan({ source: 'fitebo-continue' }));
ok('fitebo week idx not adapt', planPeriodWeekIndex('c1', { id: 'pf', source: 'fitebo', fromFitebo: true, createdAt: '2026-08-25T10:00:00.000Z' }, Date.parse('2026-09-08T12:00:00.000Z')) === 0);

const weekEx = exerciseForPlanWeek({ name: 'Wyciskanie hantli', sets: '4', reps: '8-10' }, { source: 'fitebo' }, 0);
ok('fitebo week rpe/rir', String(weekEx.rpe) === '8' && String(weekEx.rir) === '2', JSON.stringify(weekEx));

const fbMapped = mapPlanExercisesForClient([weekEx], 'c1', { source: 'fitebo' });
ok('mapped fitebo rir 2 on sets', fbMapped[0].rir === '2' && fbMapped[0].sets.some(s => String(s.rir) === '2'), JSON.stringify(fbMapped[0].sets[0]));

const mapped = mapPlanExercisesForClient(
  [{ name: 'Przysiad Goblet', sets: '4', reps: '10', rest: '90s', tempo: '3-1-1-0', rpe: '8', kg: '16' }],
  'c1',
  plan
);
ok('mapped tempo', mapped[0].tempo === '3-1-1-0');
ok('mapped restSec 90', mapped[0].restSec === 90);
ok('mapped rpe', mapped[0].rpe === '8');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll live-coach-hints tests passed');
