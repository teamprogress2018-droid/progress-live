#!/usr/bin/env node
'use strict';
/** Import Fitebo → plan + kontynuacja AI z progresją. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const planTab = src08.slice(src08.indexOf('function renderCPPlan'), src08.indexOf('async function delPlanFromProfile'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 08 v48', html.includes('08-client-profile-extras.js?v=48'));
ok('cache 03 v31', html.includes('03-ai-plangen-bizstats-aicoach.js?v=31'));
ok('ci unit', wf.includes('test_fitebo_continue.js'));
ok('ci ui', wf.includes('test_fitebo_continue_ui.js'));
ok('plan tab CTA', planTab.includes('cpContinueFiteboPlan') && planTab.includes('Kontynuuj plan z Fitebo'));
ok('empty state hint', /Brak planów treningowych[\s\S]{0,400}Kontynuuj plan z Fitebo/.test(planTab));
ok('import extracts exercises', /planDays/.test(src08) && /sessions\.exercises/.test(src08) && /source:'fitebo'/.test(src08));
ok('match existing client', /function fbFindClientByName/.test(src08));
ok('AI continue context', /KONTYNUACJA PLANU Z FITEBO/.test(src03) && /function aplSetVal/.test(src03));

const start = src08.indexOf('function fbNormName');
const end = src08.indexOf('function fbFileLoad');
ok('extract helpers', start >= 0 && end > start);
const ctx = vm.createContext({
  window: {
    CL: [{ id: 'c-rad', name: 'RAdosław Jarząb' }],
    PL: [],
    SE: []
  },
  String, Math, Map
});
vm.runInContext(src08.slice(start, end), ctx);

ok('name match ignores case/diacritics', ctx.fbFindClientByName('Radosław Jarząb') && ctx.fbFindClientByName('Radosław Jarząb').id === 'c-rad');
ok('name miss', !ctx.fbFindClientByName('Ola Kowalska'));

const days = ctx.fbPlanDaysFromClientPayload({
  sessions: [
    { type: 'Push', exercises: [{ name: 'Wyciskanie hantli', sets: 4, reps: '4-6', kg: 22.5 }] },
    { type: 'Pull', exercises: [{ name: 'Ściąganie drążka', sets: 4, reps: '6-8', kg: 50 }] },
    { type: 'Legs', exercises: [{ name: 'Hack squat', sets: 4, reps: '6-8', kg: 60 }] }
  ]
});
ok('3 plan days from sessions', days.length === 3 && days[0].exercises[0].name === 'Wyciskanie hantli');
ok('infer PPL', ctx.inferFiteboMethod(days) === 'PPL');

ctx.window.PL = [{ id: 'p1', clientId: 'c-rad', source: 'fitebo', method: 'PPL', days }];
ctx.window.SE = [{
  clientId: 'c-rad', source: 'fitebo', date: '2026-09-01', type: 'Push',
  notes: 'Zaimportowano z Fitebo',
  exercises: [{ name: 'Wyciskanie hantli', kg: 22.5 }]
}];
const ai = ctx.fiteboWorkoutsForAI('c-rad');
ok('AI context has loads', /Wyciskanie hantli/.test(ai) && /22\.5/.test(ai));
ok('has fitebo workouts', ctx.clientHasFiteboWorkouts('c-rad'));
ok('other client empty', !ctx.clientHasFiteboWorkouts('c-other'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll fitebo-continue tests passed');
