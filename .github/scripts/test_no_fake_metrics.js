#!/usr/bin/env node
'use strict';
/** No fake body-metric seed for empty clients (initDemoEntries removed). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('no initDemoEntries fn', !/function\s+initDemoEntries\s*\(/.test(src07));
ok('no initDemoEntries calls in 07', !src07.includes('initDemoEntries'));
ok('no initDemoEntries in 08', !src08.includes('initDemoEntries'));
ok('no initDemoEntries in 04', !src04.includes('initDemoEntries'));
ok('no fake start weight seed', !/values:\{m1:88,m2:22/.test(src07) && !src07.includes("notes:'Pomiar startowy'"));
ok('meClientSetField intact', /function\s+meClientSetField\s*\(/.test(src07));
ok('allMetricGroups once', (src07.match(/function\s+allMetricGroups\s*\(/g) || []).length === 1);
ok('DEMO_METRIC_GROUPS kept', src07.includes('DEMO_METRIC_GROUPS'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll no-fake-metrics tests passed');
