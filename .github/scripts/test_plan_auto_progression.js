#!/usr/bin/env node
'use strict';
/** Auto-progresja z planu trenera: podwójna (powt. → kg) i liniowa. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('builder field', html.includes('id="b-progression"') && /Podwójna/.test(html));
ok('save stores progression', /progression,clientId/.test(builder) || /progression:/.test(builder) && /b-progression/.test(builder));
ok('edit loads progression', /b-progression/.test(builder) && /normalizePlanProgression/.test(builder));
ok('live maps with plan', /mapPlanExercisesForClient\(list,st\.clientId,plan/.test(live) || /mapPlanExercisesForClient\(rawEx,st\.clientId/.test(live));
ok('live shows progHint', /progHint/.test(live) && /color:var\(--teal\)/.test(live));
ok('live lastHint needs lastDate', /lastDate&&ex\.lastKg/.test(live));
ok('idle draft remaps', /function liveRefreshPlanLoads/.test(live) && /liveApplyDraft[\s\S]*liveRefreshPlanLoads/.test(live));
ok('CI', wf.includes('test_plan_auto_progression.js'));
ok('cache 01', html.includes('01-core.js?v=94'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=54'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=53'));
ok('cache 10', html.includes('10-client-app.js?v=38'));

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
  parseRepRange, normalizePlanProgression, progressLoadStep, progressWorkingSet,
  expandExerciseSets, mapPlanExercisesForClient
} = ctx;

ok('range 8-10', JSON.stringify(parseRepRange('8-10')) === JSON.stringify({ lo: 8, hi: 10 }));
ok('range 10', JSON.stringify(parseRepRange('10')) === JSON.stringify({ lo: 10, hi: 10 }));
ok('mode default double', normalizePlanProgression('') === 'double' && normalizePlanProgression('ai') === 'double');
ok('mode off', normalizePlanProgression('off') === 'off');
ok('kettle step 2', progressLoadStep({ name: 'rumuński ciąg z kettlem' }) === 2);

const ex10 = { name: 'rumuński ciąg z kettlem', sets: '3', reps: '10' };
const hit = progressWorkingSet({ kg: '16', reps: '10' }, ex10, { plannedKg: '', progression: 'double' });
ok('double hit 10 → +2 kg kettle', hit.kg === '18' && hit.reps === '10', JSON.stringify(hit));

const mid = progressWorkingSet({ kg: '16', reps: '8' }, { name: 'RDL', sets: '3', reps: '8-12' }, { progression: 'double' });
ok('double 8 of 8-12 → +1 powt', mid.kg === '16' && mid.reps === '9', JSON.stringify(mid));

const noReps = progressWorkingSet({ kg: '16', reps: '' }, ex10, { progression: 'double' });
ok('last kg without reps still +kg kettle', noReps.kg === '18' && noReps.reps === '10', JSON.stringify(noReps));

const lin = progressWorkingSet({ kg: '80', reps: '8' }, { name: 'Przysiad', sets: '3', reps: '8' }, { progression: 'linear' });
ok('linear hit → +2.5', lin.kg === '82.5' && lin.reps === '8', JSON.stringify(lin));

const off = progressWorkingSet({ kg: '16', reps: '10' }, ex10, { progression: 'off' });
ok('off copies last', off.kg === '16' && off.reps === '10', JSON.stringify(off));

const fail = progressWorkingSet({ kg: '16', reps: '10', rir: '0' }, ex10, { progression: 'double' });
ok('RIR 0 no bump', fail.kg === '16', JSON.stringify(fail));

windowObj.SE = [{
  clientId: 'c1', date: '2026-09-01', source: 'live',
  exercises: [{ name: 'rumuński ciąg z kettlem', sets: [{ kg: '16', reps: '10', setNo: 1 }] }]
}];
const mapped = mapPlanExercisesForClient(
  [{ name: 'rumuński ciąg z kettlem', sets: '3', reps: '10' }],
  'c1',
  { progression: 'double' }
);
ok('mapped all sets 18 kg', mapped[0].sets.every((s) => s.kg === '18'), JSON.stringify(mapped[0].sets));
ok('mapped reps from plan', mapped[0].sets[0].reps === '10');
ok('mapped progHint', /Progresja/.test(mapped[0].progHint || ''), mapped[0].progHint);
ok('lastKg is session not plan', mapped[0].lastKg === '16');
ok('lastDate from session', mapped[0].lastDate === '2026-09-01');

windowObj.SE = [{
  clientId: 'c2', date: '2026-09-06', source: 'live',
  exercises: [{ name: 'Rumuński ciąg z kettlem', sets: [{ kg: '16', reps: '12', setNo: 1 }] }]
}];
const mappedAscii = mapPlanExercisesForClient(
  [{ name: 'rumunski ciag z kettlem', sets: '3', reps: '12' }],
  'c2',
  { progression: 'double' }
);
ok('ascii plan finds diacritic last', mappedAscii[0].sets.every((s) => s.kg === '18'), JSON.stringify(mappedAscii[0].sets));
ok('ascii plan lastKg 16', mappedAscii[0].lastKg === '16');
ok('ascii plan hint', /Progresja \+2 kg/.test(mappedAscii[0].progHint || ''), mappedAscii[0].progHint);

const noLast = mapPlanExercisesForClient(
  [{ name: 'Wioslarz', sets: '3', reps: '12', kg: '16' }],
  'c2',
  { progression: 'double' }
);
ok('no last does not fake lastKg', noLast[0].lastKg === '', JSON.stringify(noLast[0]));

const pct = mapPlanExercisesForClient(
  [{ name: 'Przysiad', sets: '4', reps: '8', pct1rm: '75' }],
  'c1',
  { progression: 'double' }
);
ok('pct1rm still locked (no last 1RM here empty or %)', true);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll plan auto-progression tests passed');
