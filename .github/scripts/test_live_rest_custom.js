#!/usr/bin/env node
'use strict';
/** Timer przerwy live: 30s + własny czas (np. 35s). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 02 v27', html.includes('02-workouts-onboarding-templates-live.js?v=29'));
ok('cache styles v55', html.includes('styles.css?v=59'));
ok('30s preset', html.includes('liveStartRest(30)') && /live-rest-preset[^>]*>30s</.test(html));
ok('60s preset stays', html.includes('liveStartRest(60)'));
ok('custom input', html.includes('id="live-rest-custom"') && html.includes('placeholder="35"'));
ok('custom start', html.includes('liveStartRestCustom()'));
ok('parse helper', /function parseLiveRestCustomSec\(/.test(live));
ok('custom starter', /function liveStartRestCustom\(/.test(live));

const m = live.match(/function parseLiveRestCustomSec\(raw\)\{[\s\S]*?\n\}/);
ok('parse fn extract', !!m);
const ctx = vm.createContext({ window: {}, Number, String, Math, parseInt });
vm.runInContext(m[0], ctx);
const parse = vm.runInContext('parseLiveRestCustomSec', ctx);
ok('35s allowed', parse('35') === 35);
ok('30s allowed', parse('30') === 30);
ok('clamp high', parse('9999') === 600);
ok('clamp low', parse('2') === 5);
ok('empty is 0', parse('') === 0);
ok('junk is 0', parse('abc') === 0);

if (failed) process.exit(1);
console.log('\nAll live-rest-custom tests passed');
