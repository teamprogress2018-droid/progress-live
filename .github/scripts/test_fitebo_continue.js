#!/usr/bin/env node
'use strict';
/** Fitebo: kopia ćwiczeń + tygodnie adaptacja → hipertrofia. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const planTab = src08.slice(src08.indexOf('function renderCPPlan'), src08.indexOf('async function delPlanFromProfile'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 08 v50', html.includes('08-client-profile-extras.js?v=84'));
ok('ci unit', wf.includes('test_fitebo_continue.js'));
ok('ci ui', wf.includes('test_fitebo_continue_ui.js'));
ok('plan tab CTA', planTab.includes('cpContinueFiteboPlan') && planTab.includes('Kontynuuj plan z Fitebo') && planTab.includes('showContinueFitebo'));
ok('plan tab edit from profile', planTab.includes('editPlanFromProfile') && planTab.includes('type="button"') && !/editPlan\('\$\{p\.id\}'\);closeClientProfile/.test(planTab));
ok('week switcher in plan tab', /cpSetPlanWeek/.test(planTab) && /cpExWeekView/.test(planTab));
ok('no AI generate on continue', !/aplGenerate\(\)/.test(src08.slice(src08.indexOf('async function cpContinueFiteboPlan'), src08.indexOf('window.fbNormName'))));
ok('copy builder', /function buildFiteboContinuationPlan/.test(src08));

const start = src08.indexOf('function fbNormName');
const end = src08.indexOf('function fbFileLoad');
ok('extract helpers', start >= 0 && end > start);
const ctx = vm.createContext({
  window: {
    CL: [{ id: 'c-rad', name: 'RAdosław Jarząb' }],
    PL: [],
    SE: []
  },
  String, Math, Map, parseInt, isFinite, parseFloat, Array, Number, Boolean, Object,
  aplPhasesForPlan: function (_m, n, keys) {
    const t = {
      8: { w1: 'Adaptacja', w2: 'Adaptacja', w3: 'Hipertrofia I', w4: 'Hipertrofia I', w5: 'Hipertrofia II', w6: 'Siła', w7: 'Deload', w8: 'Szczyt' }
    };
    return t[n] || keys.reduce((o, k, i) => { o[k] = 'Tydzień ' + (i + 1); return o; }, {});
  }
});
vm.runInContext(src08.slice(start, end), ctx);

ok('name match', ctx.fbFindClientByName('Radosław Jarząb') && ctx.fbFindClientByName('Radosław Jarząb').id === 'c-rad');

const srcDays = ctx.fbPlanDaysFromClientPayload({
  sessions: [
    { type: 'Push', exercises: [{ name: 'Wyciskanie hantli', sets: 3, reps: '12', kg: 24.5 }] },
    { type: 'Pull', exercises: [{ name: 'Ściąganie drążka', sets: 3, reps: '12', kg: 50 }] },
    { type: 'Legs', exercises: [{ name: 'Hack squat', sets: 3, reps: '12', kg: 60 }] }
  ]
});
ctx.window.PL = [{ id: 'p1', clientId: 'c-rad', source: 'fitebo', method: 'PPL', days: srcDays }];
const plan = ctx.buildFiteboContinuationPlan('c-rad', 8);
const names = plan.days.flatMap(d => d.exercises.map(e => e.name));
ok('copied exactly 3 days', plan.days.length === 3);
ok('same exercise names only', names.join('|') === 'Wyciskanie hantli|Ściąganie drążka|Hack squat');
ok('8 week keys skip adapt', plan.weekKeys.length === 8 && /Hipertrofia/.test(plan.phases.w1) && /Hipertrofia/.test(plan.phases.w3) && !/Adaptacja/.test(Object.values(plan.phases).join(' ')));
ok('starts at week 3 eight reps', plan.currentWeek === 'w3' && plan.continueFromWeek === 3, JSON.stringify({ w: plan.currentWeek, from: plan.continueFromWeek }));
const ex = plan.days[0].exercises[0];
ok('w1 is 12 reps', String(ex.w1.r) === '12', JSON.stringify(ex.w1));
ok('w3 is 8 reps current', String(ex.w3.r) === '8' && String(ex.reps) === '8', JSON.stringify({ w3: ex.w3, reps: ex.reps }));
ok('form uses week 3 load', String(ex.kg) === String(ex.w3.kg));
ok('w1 vs w3 differ', ex.w1.r !== ex.w3.r, JSON.stringify({ w1: ex.w1, w3: ex.w3, w5: ex.w5 }));
ok('w3 vs deload differ', ex.w3.rpe !== ex.w7.rpe || ex.w3.kg !== ex.w7.kg);
ok('no extra invented name', !names.some(n => /rozpiętki|face.?pull|plank/i.test(n)));
ok('builder 8-week schedule helper', /function builderPeriodSchedule/.test(fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8')));

ctx.window.SE = [{
  clientId: 'c-rad', source: 'fitebo', type: 'Push',
  exercises: [{ name: 'Wyciskanie hantli', sets: '4', reps: '4-6', kg: '22.5' }]
}];
const polluted = { day: 'Trening B (Push)', exercises: [
  { name: 'Burpees', sets: '4', reps: '8', rest: '45s' },
  { name: 'Mountain climbers', sets: '3', reps: '30s', rest: '30s' }
]};
const resolved = ctx.fiteboResolveDayExercises('c-rad', { source: 'fitebo', fromFitebo: true }, polluted);
ok('live replaces template with fitebo session', resolved && resolved[0] && resolved[0].name === 'Wyciskanie hantli', JSON.stringify(resolved));
ok('template detector', ctx.fiteboExercisesLookLikeTemplate(polluted.exercises) && !ctx.fiteboExercisesLookLikeTemplate(srcDays[0].exercises));

const logged = ctx.fbMapExercises([{
  name: 'Wyciskanie na ławce skośnej w górę',
  sets: '3',
  reps: '12',
  kg: '22.5',
  log: [
    {setNo: 1, reps: 12, kg: 20},
    {setNo: 2, reps: 12, kg: 22.5},
    {setNo: 3, reps: 12, kg: 22.5},
    {setNo: 4, reps: 12, kg: 22.5, extra: true}
  ]
}], 'log');
ok('session log keeps 4 sets', logged[0] && logged[0].sets.length === 4, JSON.stringify(logged[0] && logged[0].sets));
ok('session log extra', logged[0] && logged[0].sets[3] && logged[0].sets[3].kind === 'extra');
ok('plan mode still count string', ctx.fbMapExercises([{name: 'X', sets: 4, reps: '8-10', kg: 20}])[0].sets === '4');
ok('import prompt has log[]', /"log"/.test(src08) && /Dodatkowe/.test(src08));
ok('import uses log mode', /fbMapExercises\(s\.exercises,'log'\)/.test(src08));
ok('hist modal markup', html.includes('id="m-ex-hist"') && html.includes('id="ex-hist-body"'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll fitebo-continue tests passed');
