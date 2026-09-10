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

ok('cache 08 v49', html.includes('08-client-profile-extras.js?v=49'));
ok('ci unit', wf.includes('test_fitebo_continue.js'));
ok('ci ui', wf.includes('test_fitebo_continue_ui.js'));
ok('plan tab CTA', planTab.includes('cpContinueFiteboPlan') && planTab.includes('Kontynuuj plan z Fitebo'));
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
  String, Math, Map, parseInt, isFinite, parseFloat,
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
    { type: 'Push', exercises: [{ name: 'Wyciskanie hantli', sets: 4, reps: '4-6', kg: 22.5 }] },
    { type: 'Pull', exercises: [{ name: 'Ściąganie drążka', sets: 4, reps: '6-8', kg: 50 }] },
    { type: 'Legs', exercises: [{ name: 'Hack squat', sets: 4, reps: '6-8', kg: 60 }] }
  ]
});
ctx.window.PL = [{ id: 'p1', clientId: 'c-rad', source: 'fitebo', method: 'PPL', days: srcDays }];
const plan = ctx.buildFiteboContinuationPlan('c-rad', 8);
const names = plan.days.flatMap(d => d.exercises.map(e => e.name));
ok('copied exactly 3 days', plan.days.length === 3);
ok('same exercise names only', names.join('|') === 'Wyciskanie hantli|Ściąganie drążka|Hack squat');
ok('8 week keys', plan.weekKeys.length === 8 && plan.phases.w1 === 'Adaptacja' && /Hipertrofia/.test(plan.phases.w3));
const ex = plan.days[0].exercises[0];
ok('w1 vs hipertrophy sets/reps differ', ex.w1.s !== ex.w3.s || ex.w1.r !== ex.w3.r, JSON.stringify({ w1: ex.w1, w3: ex.w3, w5: ex.w5 }));
ok('w3 vs w5 differ', ex.w3.s !== ex.w5.s || ex.w3.r !== ex.w5.r);
ok('no extra invented name', !names.some(n => /rozpiętki|face.?pull|plank/i.test(n)));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll fitebo-continue tests passed');
