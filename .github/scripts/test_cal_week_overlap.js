#!/usr/bin/env node
'use strict';
/** Widok tygodnia: karty w komórkach godzin, jedna pod drugą jak w miesiącu. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cal = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 05 v71', html.includes('05-clients-builder-plans-calendar.js?v=78'));
ok('cache styles v86', html.includes('styles.css?v=99'));
ok('ci unit', wf.includes('test_cal_week_overlap.js'));
ok('ci ui', wf.includes('test_cal_week_overlap_ui.js'));
ok('layout helper', /function calWeekHourBucket/.test(cal) && /function calSessionStartMin/.test(cal));
ok('week chips in hour cells', /data-cal-hour/.test(cal) && /calWeekSessChip/.test(cal) && /data-cal-sess/.test(cal));
ok('no overlap lanes', !/cal-week-day-lane/.test(cal) && !/calWeekOverlapLayout/.test(cal));
ok('css hour cells grow', /grid-auto-rows:minmax\(60px,auto\)/.test(css) && /flex-direction:\s*column/.test(css));
ok('css chips in flow', /\.cal-session-block\{[^}]*position:relative/.test(css));
ok('seven equal day columns', /grid-template-columns:60px repeat\(7,minmax\(0,1fr\)\)/.test(css));
ok('js forces equal week cols', /gridTemplateColumns='60px repeat\(7,minmax\(0,1fr\)\)'/.test(cal));
ok('week cells clip chips', /\.cal-cell\{[^}]*overflow:hidden/.test(css) && /#cal-week-scroll\{[^}]*overflow-x:hidden/.test(css));
ok('week hides long type meta', /#cal-week-grid \.cal-session-meta\{display:none/.test(css));
ok('chip tooltip keeps type', /typeBit/.test(cal) && /title="\$\{tip\}"/.test(cal));
const chipSrc=cal.slice(cal.indexOf('function calWeekSessChip'), cal.indexOf('window.calSessionStartMin'));
ok('week chip has no type line', chipSrc.length>80 && !/cal-session-meta/.test(chipSrc));

const start = cal.indexOf('function calSessionStartMin');
const end = cal.indexOf('function renderCalWeek');
ok('extract layout', start >= 0 && end > start);
const ctx = vm.createContext({
  window: {},
  String, Math, isFinite, parseInt,
  CAL_WEEK_H0: 6,
  CAL_WEEK_H1: 23
});
vm.runInContext(cal.slice(start, end), ctx);

ok('08:00 bucket', ctx.calWeekHourBucket({ time: '08:00' }, 6, 23) === 8);
ok('08:59 stays in 8', ctx.calWeekHourBucket({ time: '08:59' }, 6, 23) === 8);
ok('12:00 bucket', ctx.calWeekHourBucket({ time: '12:00' }, 6, 23) === 12);
ok('before grid clamps to h0', ctx.calWeekHourBucket({ time: '05:00' }, 6, 23) === 6);
ok('after grid clamps to last hour', ctx.calWeekHourBucket({ time: '23:30' }, 6, 23) === 22);
ok('start min 8:59', ctx.calSessionStartMin({ time: '08:59' }) === 8 * 60 + 59);
ok('end default 60', ctx.calSessionEndMin({ time: '08:00' }) === 9 * 60);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cal-week-hours tests passed');
