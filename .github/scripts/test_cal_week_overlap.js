#!/usr/bin/env node
'use strict';
/** Widok tygodnia: zachodzące sesje w kolumnach obok siebie. */
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

ok('cache 05 v48', html.includes('05-clients-builder-plans-calendar.js?v=62'));
ok('cache styles v74', html.includes('styles.css?v=80'));
ok('ci unit', wf.includes('test_cal_week_overlap.js'));
ok('ci ui', wf.includes('test_cal_week_overlap_ui.js'));
ok('layout helper', /function calWeekOverlapLayout/.test(cal) && /function calSessionStartMin/.test(cal));
ok('week uses day lanes', /cal-week-day-lane/.test(cal) && /data-cal-sess/.test(cal));
ok('week not hour-cell stacking', !/cellSessions=SE\.filter/.test(cal));
ok('css day lane', /\.cal-week-day-lane/.test(css) && /pointer-events:\s*none/.test(css));

const start = cal.indexOf('function calSessionStartMin');
const end = cal.indexOf('function renderCalWeek');
ok('extract layout', start >= 0 && end > start);
const ctx = vm.createContext({ window: {}, String, Math, isFinite, parseInt });
vm.runInContext(cal.slice(start, end), ctx);

const a = { id: 'a', time: '08:00', duration: 60 };
const b = { id: 'b', time: '08:59', duration: 60 };
const c = { id: 'c', time: '09:00', duration: 60 };
const chain = ctx.calWeekOverlapLayout([a, b, c]);
const byId = Object.fromEntries(chain.map(x => [x.s.id, x]));
ok('chain cols=2', chain.every(x => x.cols === 2), JSON.stringify(chain.map(x => ({ id: x.s.id, col: x.col, cols: x.cols }))));
ok('a and c share a column', byId.a.col === byId.c.col && byId.a.col !== byId.b.col);
ok('b in other column', byId.b.col !== byId.a.col);

const same = ctx.calWeekOverlapLayout([
  { id: 'm', time: '08:00', duration: 60 },
  { id: 'o', time: '08:00', duration: 60 },
  { id: 'ad', time: '08:00', duration: 60 }
]);
ok('same-slot 3 columns', same.length === 3 && same.every(x => x.cols === 3));
ok('same-slot unique cols', new Set(same.map(x => x.col)).size === 3);

const apart = ctx.calWeekOverlapLayout([
  { id: 'x', time: '08:00', duration: 60 },
  { id: 'y', time: '10:00', duration: 60 }
]);
ok('non-overlap single col', apart.every(x => x.cols === 1 && x.col === 0));
ok('start min 8:59', ctx.calSessionStartMin({ time: '08:59' }) === 8 * 60 + 59);
ok('end default 60', ctx.calSessionEndMin({ time: '08:00' }) === 9 * 60);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cal-week-overlap tests passed');
