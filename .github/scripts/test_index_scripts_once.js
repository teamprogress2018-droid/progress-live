#!/usr/bin/env node
'use strict';
/** index.html must load each app script once (duplicate const → redeclaration in browser). */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
const idx = html.lastIndexOf('<script src="ex-gif-manifest.js');
const tail = idx >= 0 ? html.slice(idx) : html;
const names = [...tail.matchAll(/<script src="([^"?]+\.js)\?v=\d+"><\/script>/g)].map((m) => m[1]);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK  ', name);
}

ok('has app scripts', names.length >= 10);
const seen = new Set();
const dups = [];
for (const n of names) {
  if (seen.has(n)) dups.push(n);
  seen.add(n);
}
ok('no duplicate script src', dups.length === 0, dups.join(','));
ok('includes 04-client-portal.js', seen.has('04-client-portal.js'));
ok('includes 07-forms-metrics-calculator.js', seen.has('07-forms-metrics-calculator.js'));
ok('includes 08-client-profile-extras.js', seen.has('08-client-profile-extras.js'));
ok('includes 10-client-app.js', seen.has('10-client-app.js'));
ok('07 loaded once', names.filter((n) => n === '07-forms-metrics-calculator.js').length === 1);
ok('08 loaded once', names.filter((n) => n === '08-client-profile-extras.js').length === 1);

const root = path.join(__dirname, '../..');
ok('no leftover trener_ai_v2.html', !fs.existsSync(path.join(root, 'trener_ai_v2.html')));
ok('no leftover fix_progress_live.py', !fs.existsSync(path.join(root, 'fix_progress_live.py')));
ok('no leftover sprawdz_duplikaty.py', !fs.existsSync(path.join(root, 'sprawdz_duplikaty.py')));

const dupCheck = fs.readFileSync(path.join(root, '.github/scripts/check_duplicates.py'), 'utf8');
ok('dupe scan includes 10-*.js', dupCheck.includes('NN-*.js') && dupCheck.includes('\\d{2}'));

const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
ok('saveWorkout guards missing form', /function saveWorkout[\s\S]{0,400}if\(!nameEl\)return/.test(src02));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll index-scripts-once tests passed');
