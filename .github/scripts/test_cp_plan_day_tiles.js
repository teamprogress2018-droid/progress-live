#!/usr/bin/env node
'use strict';
/** Profil → Plan: dni jako osobne kafelki z obramowaniem, nie jedna czarna apla. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
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

ok('cache 08', html.includes('08-client-profile-extras.js?v=55'));
ok('cache styles', html.includes('styles.css?v=80'));
ok('ci unit', wf.includes('test_cp_plan_day_tiles.js'));
ok('ci ui', wf.includes('test_cp_plan_day_tiles_ui.js'));

ok('plan tab uses tile class', /class="cp-plan-days"/.test(planTab) && /cp-plan-day-tile/.test(planTab));
ok('no continuous day stack without class', !/flex-direction:column;gap:5px/.test(planTab));
ok('exercise rows use tile class', /cp-plan-day-ex-row/.test(planTab));

ok('tile css border', /\.cp-plan-day-tile\{[^}]*border:\s*1px solid/.test(css));
ok('tile css radius', /\.cp-plan-day-tile\{[^}]*border-radius/.test(css));
ok('days list gap', /\.cp-plan-days\{[^}]*gap:\s*10px/.test(css));
ok('library preview tiles', /\.plan-day-row\{[^}]*border:\s*1px solid/.test(css) && /\.plan-day-row\{[^}]*border-radius/.test(css) && /\.plan-day-row\{[^}]*margin-bottom:\s*10px/.test(css));
ok('preview detail not black wash', !/\.plan-card-detail\{[^}]*rgba\(0,\s*0,\s*0,\s*0\.15\)/.test(css));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-plan-day-tiles tests passed');
