#!/usr/bin/env node
'use strict';
/** Biblioteka → plan: „+ Dodaj do planu” wstawia ćwiczenie do kreatora, puste dni nie przechodzą po cichu. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const six = read('06-inbox-exercises-ai-programs.js');
const five = read('05-clients-builder-plans-calendar.js');
const twelve = read('12-manual-plan-wizard.js');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('ci unit', wf.includes('test_lib_ex_to_plan.js'));
ok('ci ui', wf.includes('test_lib_ex_to_plan_ui.js'));
ok('cta renamed', six.includes('onclick="prefillExInBuilder(${safe})">+ Dodaj do planu</button>'));
ok('returns to library', /function prefillExInBuilder[\s\S]*?window\._builderBack='library'/.test(six));
ok('can keep open draft', /function prefillExInBuilder[\s\S]*?builderHasOpenDraft\(\)[\s\S]*?_builderPreserveOnReturn=true/.test(six));
ok('inserts row with name', /function builderInsertExercise[\s\S]*?addDay\(\)[\s\S]*?addRow\(day\.id\)[\s\S]*?builderOnExNameChange\(row\)/.test(six));
ok('save asks about empty days', /Dni bez ćwiczeń: '\+names/.test(five) && /day\.rest=true/.test(five));
ok('analysis ignores empty days', /active=\(days\|\|\[\]\)\.filter\(day=>day&&!day\.rest&&hasExercise\(day\)\)/.test(twelve));
ok('analysis warns about empty days', /result\.emptyDays&&result\.emptyDays\.length/.test(twelve));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lib → plan checks passed');
