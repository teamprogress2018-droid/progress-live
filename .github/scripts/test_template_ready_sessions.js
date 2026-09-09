#!/usr/bin/env node
'use strict';
/** Mikrocykle (szablony) i makrocykle (programy) mają kompletne sesje ćwiczeń. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

const start = src02.indexOf('function tplEx(');
const endMarker = 'window.fillReadyTemplateSessions=fillReadyTemplateSessions;';
const end = src02.indexOf(endMarker);
ok('session helper present', start >= 0 && end > start);
if (start < 0 || end < 0) {
  console.error('cannot extract template session helpers');
  process.exit(1);
}
const slice = src02.slice(start, end + endMarker.length);

const windowObj = {};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, console, String, Array, Object, JSON, RegExp, Math, Number, parseInt, parseFloat
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(slice, ctx);

const templates = ctx.window.PLAN_TEMPLATES || [];
ok('PLAN_TEMPLATES loaded', templates.length >= 15);

function isCardioDay(name) {
  return /cardio|liss|hiit|bieg|wod|tabata|emom|amrap/i.test(String(name || ''));
}

templates.forEach(t => {
  const days = t.days_detail || [];
  ok(t.id + ' days_detail >= days', days.length >= (t.days || 1));
  days.forEach((d, i) => {
    const n = (d.exercises || []).length;
    const min = isCardioDay(d.name) ? 3 : 4;
    ok(t.id + ' day' + i + ' exercises>=' + min, n >= min);
    ok(t.id + ' day' + i + ' named', !!(d.name && d.exercises[0] && d.exercises[0].n));
  });
});

ok('empty days_detail gone', !/days_detail:\s*\[\]\s*\}/.test(src02) || templates.every(t => (t.days_detail || []).length));
ok('t02 filled 6 days', (templates.find(t => t.id === 't02') || {}).days_detail.length === 6);
ok('t12 has legs B', (templates.find(t => t.id === 't12') || {}).days_detail.length >= 3);

const t25 = templates.find(t => t.id === 't25') || { days_detail: [] };
const t26 = templates.find(t => t.id === 't26') || { days_detail: [] };
const t27 = templates.find(t => t.id === 't27') || { days_detail: [] };
ok('t25 nordic walking', /Nordic walking/.test(t25.name || '') && t25.days_detail.length === 3);
ok('t25 has Marsz', (t25.days_detail[0]?.exercises || []).some(e => e.n === 'Marsz'));
ok('t25 strength has RDL', (t25.days_detail[1]?.exercises || []).some(e => e.n === 'Martwy ciąg RDL'));
ok('t26 pilka nozna', /Piłka nożna/.test(t26.name || '') && t26.days_detail.length === 4);
ok('t26 copenhagen', (t26.days_detail[0]?.exercises || []).some(e => e.n === 'Deska kopenhaska'));
ok('t26 soccer adductor', (t26.days_detail[0]?.exercises || []).some(e => e.n === 'Przywodzenie piłkarskie z taśmą'));
ok('t26 nordic curl', (t26.days_detail[0]?.exercises || []).some(e => e.n === 'Uginanie nordyckie'));
ok('t27 bieganie', /Bieganie/.test(t27.name || '') && t27.days_detail.length === 3);
ok('t27 A-skip', (t27.days_detail[0]?.exercises || []).some(e => e.n === 'A-skip'));
ok('t27 Bieg', (t27.days_detail[0]?.exercises || []).some(e => e.n === 'Bieg'));
ok('t27 strength nordic', (t27.days_detail[1]?.exercises || []).some(e => e.n === 'Uginanie nordyckie'));

const t28 = templates.find(t => t.id === 't28') || { days_detail: [] };
const t29 = templates.find(t => t.id === 't29') || { days_detail: [] };
const t30 = templates.find(t => t.id === 't30') || { days_detail: [] };
ok('t28 sila nordic', /Siła — Nordic walking/.test(t28.name || '') && t28.days_detail.length === 3);
ok('t28 gym no Marsz', !(t28.days_detail || []).some(d => (d.exercises || []).some(e => e.n === 'Marsz')));
ok('t28 has RDL and face pull', (t28.days_detail[0]?.exercises || []).some(e => e.n === 'Martwy ciąg RDL') && (t28.days_detail[0]?.exercises || []).some(e => e.n === 'Ściąganie do twarzy (face pull)'));
ok('t29 sila pilka', /Siła — Piłka nożna/.test(t29.name || '') && t29.days_detail.length === 3);
ok('t29 gym no Bieg', !(t29.days_detail || []).some(d => (d.exercises || []).some(e => e.n === 'Bieg')));
ok('t29 hamstring adductor', (t29.days_detail[0]?.exercises || []).some(e => e.n === 'Uginanie nordyckie') && (t29.days_detail[0]?.exercises || []).some(e => e.n === 'Deska kopenhaska'));
ok('t30 sila biegacz', /Siła — Biegacz/.test(t30.name || '') && t30.days_detail.length === 3);
ok('t30 gym no Bieg', !(t30.days_detail || []).some(d => (d.exercises || []).some(e => e.n === 'Bieg')));
ok('t30 nordic and bulgarian', (t30.days_detail[0]?.exercises || []).some(e => e.n === 'Uginanie nordyckie') && (t30.days_detail[1]?.exercises || []).some(e => e.n === 'Przysiad bułgarski'));

const fn = ctx.window.sessionExercisesForFocus;
ok('expander push', fn('Push A — Klatka').length >= 5);
ok('expander arnold', fn('Klatka + Plecy — Wyciskanie').length >= 4);
ok('expander rest empty', fn('REST lub spacer').length === 0);
ok('expander gvt', fn('Klatka + Plecy: 10×10').some(e => e.s === '10'));
ok('expander trening A', fn('Trening A').length >= 4);
const hiitDay = fn('HIIT: 8× (20s max + 40s przerwa)');
ok('hiit has burpees', hiitDay.some(e => e.n === 'Burpees'));
ok('hiit rest 40s', hiitDay.filter(e => e.n === 'Burpees').every(e => e.rest === '40s'));
ok('hiit reps max', hiitDay.some(e => e.n === 'Burpees' && e.r === 'max'));
ok('hiit 8 work rounds', hiitDay.filter(e => !/rozgrzewka|cool-down/i.test(e.n)).reduce((a, e) => a + (parseInt(e.s, 10) || 0), 0) === 8);
ok('expander nordic', fn('Nordic walking — łatwy').some(e => e.n === 'Marsz') && fn('Nordic walking — łatwy').length >= 4);
ok('expander nordic strength', fn('Nordic walking — siła pod kije').some(e => e.n === 'Martwy ciąg RDL'));
ok('expander football prev', fn('Piłka — prewencja urazów').some(e => e.n === 'Deska kopenhaska'));
ok('expander football pitch', fn('Piłka — kondycja boiskowa').some(e => e.n === 'Bieg'));
ok('expander run easy skips', fn('Bieg łatwy + skipy').some(e => e.n === 'A-skip'));
ok('expander run strength', fn('Siła biegacza').some(e => e.n === 'Uginanie nordyckie'));
ok('expander run intervals', fn('Bieg — interwały').some(e => e.n === 'Bieg' && e.s === '8'));
ok('expander sila nordic gym', fn('Siła Nordic — łańcuch tylny i kije').some(e => e.n === 'Wypychanie bioder (hip thrust)') && !fn('Siła Nordic — łańcuch tylny i kije').some(e => e.n === 'Marsz'));
ok('expander sila pilka gym', fn('Siła piłka — dwugłowe i pachwiny').some(e => e.n === 'Deska kopenhaska') && !fn('Siła piłka — moc').some(e => e.n === 'Bieg'));
ok('expander sila biegacz gym', fn('Siła biegacza — łańcuch tylny').some(e => e.n === 'Martwy ciąg RDL') && fn('Siła biegacza — łańcuch tylny').every(e => e.n !== 'Bieg'));
ok('expander sila biegacz still mixed', fn('Siła biegacza').some(e => e.n === 'Uginanie nordyckie'));

const m1 = src06.match(/function expandSessionFromDayFocus[\s\S]*?window\.expandSessionFromDayFocus=expandSessionFromDayFocus;/);
const m2 = src06.match(/function planDaysFromProgram[\s\S]*?window\.planDaysFromProgram=planDaysFromProgram;/);
ok('06 helpers', !!(m1 && m2));
const ctx6 = { window: { window: {} }, console, String, Array, Object, JSON, RegExp };
ctx6.window.window = ctx6.window;
ctx6.globalThis = ctx6;
vm.createContext(ctx6);
vm.runInContext(m1[0] + '\n' + m2[0], ctx6);
ok('06 arnold chest+back', ctx6.expandSessionFromDayFocus('Klatka + Plecy').length >= 4);
ok('06 gvt not dummy', ctx6.expandSessionFromDayFocus('Klatka + Plecy: 10×10').length >= 3);
ok('06 trening A', ctx6.expandSessionFromDayFocus('Trening A').length >= 4);
const restDays = ctx6.planDaysFromProgram({
  weeks: [{ days: [{ d: 'WT', name: 'REST lub spacer' }, { d: 'ŚR', name: 'Push A' }] }]
}, 0);
ok('REST lub spacer is rest', restDays[0].rest === true && restDays[0].exercises.length === 0);
ok('push still expands', restDays[1].exercises.length >= 4);

ok('detail lists all days', src02.includes('Dni treningowe ('));
ok('CI', wf.includes('test_template_ready_sessions.js'));
ok('CI sport ui', wf.includes('test_sport_templates_ui.js'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll template-ready-session tests passed');
