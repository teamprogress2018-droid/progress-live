#!/usr/bin/env node
'use strict';
/** Bloki 4–16 tyg. (audyt 18.10, pakiet E): klient dostaje wszystkie tygodnie (fazy, RPE, deload),
 *  ćwiczenia wypisane w programie zamiast zgadywanych, kreator programu zapisuje ćwiczenia. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const six = read('06-inbox-exercises-ai-programs.js');
const four = read('04-client-portal.js');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}
function slice(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
}

ok('ci unit', wf.includes('test_lib_bloki.js'));
ok('ci ui', wf.includes('test_lib_bloki_ui.js'));
ok('cache 01', html.includes('01-core.js?v=137'));
ok('cache 04', html.includes('04-client-portal.js?v=62'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=103'));
ok('cache styles', html.includes('styles.css?v=165'));

ok('+ Własny program opens builder', html.includes('onclick="openProgramBuilder()">+ Własny program</button>'));
ok('builder has way back', html.includes("onclick=\"goTo('programs')\">← Bloki 4–16 tyg.</button>"));
ok('edit goes to builder', /function editProgram\(id\)\{[\s\S]{0,300}openProgramBuilder\(id\)/.test(six));
ok('assign uses all weeks', /const weekMeta=programPlanWeekMeta\(p,days\);/.test(six) && /duration:weekMeta\.weekKeys\.length/.test(six));
ok('calendar for all weeks', /maybeSchedulePlanToCalendar\(newPlan\.id,\{weeks:nWeeks/.test(six) && !/maybeSchedulePlanToCalendar\(newPlan\.id,\{weeks:4\}\)/.test(six));
ok('empty program blocked', six.includes('Ten program nie ma jeszcze treningów. Otwórz go w kreatorze programu i dodaj ćwiczenia.'));
ok('builder saves exercises', /exercises:rest\?\[\]:\(d\.exercises\|\|\[\]\)\.map/.test(four) && !/days:w\.days\.map\(d=>\(\{d:d\.name\.substring\(0,3\),name:d\.rest\?'REST':d\.name\}\)\)/.test(four));
ok('builder assign uses the assign dialog', /async function pbAssign\(\)\{[\s\S]{0,400}openAssignProg\(prog\.id\)/.test(four));
ok('builder escapes names', four.includes('${escHtml(ex.name)}') && four.includes('pbAddExFromLib(${exJsArg(e.name)})'));

// --- logika ---
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(slice(six, 'const PROG_EX_ALIASES', 'window.parseProgramDayExercises'), ctx);
vm.runInContext('function sessionIsRestFocus(){return false;}function expandSessionFromDayFocus(f){return [{name:"Auto "+f,sets:"3",reps:"8-12",rest:"90s"}];}', ctx);
vm.runInContext(slice(six, 'function planDaysFromProgram', 'window.planDaysFromProgram=planDaysFromProgram;'), ctx);
vm.runInContext(slice(six, 'function programWeekAt', 'window.programWeekAt'), ctx);

const up = ctx.parseProgramDayExercises('Upper A: Wyciskanie 4×8, Podciąganie 4×8, OHP 3×10, Wiosłowanie 3×10');
ok('parses listed exercises', up && up.length === 4 && up[0].name === 'Wyciskanie sztangi leżąc' && up[0].sets === '4' && up[0].reps === '8' && up[2].name === 'Wyciskanie żołnierskie OHP', JSON.stringify(up));
const w531 = ctx.parseProgramDayExercises('Przysiad: 5×65%, 5×75%, 5+×85% + akcesoria');
ok('parses 5/3/1 day', w531 && w531.length === 1 && w531[0].name === 'Przysiad ze sztangą' && w531[0].sets === '3' && w531[0].reps === '5 @ 65% / 5 @ 75% / 5+ @ 85%', JSON.stringify(w531));
ok('generic day not parsed', ctx.parseProgramDayExercises('Push A — Klatka + Barki + Triceps') === null && ctx.parseProgramDayExercises('Barki: 5×10') === null);

const prog = {
  duration: 12,
  weeks: [
    { nr: 1, label: 'Adaptacja', rpe: 'RPE 7', days: [{ d: 'PON', name: 'FBW A — Przysiad 5×5, OHP 5×5' }, { d: 'ŚR', name: 'Push A' }, { d: 'PT', name: 'FBW A — powtórzenie' }] },
    { nr: 2, label: 'Progresja', rpe: 'RPE 7-8', days: [{ d: 'PON', name: 'FBW A' }, { d: 'ŚR', name: 'Push A' }, { d: 'PT', name: 'FBW A' }] },
    { nr: 3, label: 'DELOAD', rpe: 'RPE 6', days: [{ d: 'PON', name: 'FBW lekki' }, { d: 'ŚR', name: 'REST' }, { d: 'PT', name: 'REST' }] }
  ]
};
const days = ctx.planDaysFromProgram(prog, 0);
ok('listed day uses program exercises', days[0].exercises.map((e) => e.name + ' ' + e.sets + 'x' + e.reps).join() === 'Przysiad ze sztangą 5x5,Wyciskanie żołnierskie OHP 5x5' && !days[0].autoEx, JSON.stringify(days[0]));
ok('generic day marked auto', days[1].autoEx === true);
ok('„powtórzenie” copies earlier day', days[2].exercises.length === 2 && days[2].exercises[0].name === 'Przysiad ze sztangą' && !days[2].autoEx, JSON.stringify(days[2]));

const meta = ctx.programPlanWeekMeta(prog, days);
ok('12 week keys', meta.weekKeys.length === 12 && meta.weekKeys[11] === 'w12' && meta.currentWeek === 'w1');
ok('phases cycle with label', meta.phases.w1 === 'Adaptacja' && meta.phases.w3 === 'DELOAD' && meta.phases.w4 === 'Adaptacja · cykl 2' && meta.phases.w12 === 'DELOAD · cykl 4', JSON.stringify(meta.phases));
const sq = days[0].exercises[0];
ok('week RPE from program', sq.w1.rpe === '7' && sq.w2.rpe === '7-8', JSON.stringify([sq.w1, sq.w2]));
ok('deload halves sets', sq.w3.s === '3' && sq.w3.rpe === '6' && sq.w1.s === '5', JSON.stringify(sq.w3));
ok('cycled deload too', sq.w6.s === '3' && sq.w7.s === '5', JSON.stringify([sq.w6, sq.w7]));
ok('capped at 12', ctx.programPlanWeekCount({ duration: 16, weeks: [] }) === 12);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All Bloki checks passed');
