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

const fn = ctx.window.sessionExercisesForFocus;
ok('expander push', fn('Push A — Klatka').length >= 5);
ok('expander arnold', fn('Klatka + Plecy — Wyciskanie').length >= 4);
ok('expander rest empty', fn('REST lub spacer').length === 0);
ok('expander gvt', fn('Klatka + Plecy: 10×10').some(e => e.s === '10'));
ok('expander trening A', fn('Trening A').length >= 4);

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

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll template-ready-session tests passed');
