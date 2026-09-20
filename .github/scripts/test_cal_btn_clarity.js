#!/usr/bin/env node
'use strict';
/** Kalendarz: wyraziste ghost / Dziś / aktywny widok tygodnia. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache styles v82', html.includes('styles.css?v=98'));
ok('ci unit', wf.includes('test_cal_btn_clarity.js'));
ok('ci ui', wf.includes('test_cal_btn_clarity_ui.js'));
ok('ghost border beats btn none', /\.btn\.btn-ghost/.test(css) && /border:1px solid var\(--border-default\)/.test(css));
ok('today stronger than ghost', css.includes('.topbar-actions .cal-nav-today') && html.includes('cal-nav-today'));
ok('view toggle group', html.includes('class="cal-view-toggle"') && css.includes('.cal-view-toggle .auto-tab-btn.active'));
ok('active view uses accent', /cal-view-toggle \.auto-tab-btn\.active\{[\s\S]*?background:var\(--accent-red\)/.test(css));
ok('week month list ids kept', html.includes('id="calv-week"') && html.includes('id="calv-month"') && html.includes('id="calv-list"'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll calendar button clarity source checks passed');
