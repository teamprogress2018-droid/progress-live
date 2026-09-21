#!/usr/bin/env node
'use strict';
/** Katalog programów: filtry 4–16 tyg., chipy data-dur, bez tygodniówek. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const chips = html.slice(html.indexOf('id="prog-dur-chips"'), html.indexOf('id="prog-equip-fil"'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=84'));
ok('cache styles', html.includes('styles.css?v=103'));
ok('CI', wf.includes('test_prog_catalog.js'));
ok('CI ui', wf.includes('test_prog_catalog_ui.js'));
ok('title 4-16', html.includes('>Bloki 4–16 tygodni<'));
ok('nav 4-16', html.includes('>Bloki 4–16 tyg.<'));
ok('subtitle 4-16', /bloki 4–16 tygodni/.test(html));
ok('no 1-tyg chip', !/setProgDurFilter\('1'\)/.test(chips) && !/>1 tyg\.</.test(chips));
ok('chips data-dur', /data-dur=""/.test(chips) && /data-dur="4"/.test(chips) && /data-dur="6"/.test(chips) && /data-dur="8"/.test(chips) && /data-dur="10\+"/.test(chips));
ok('chip highlight from data-dur', /getAttribute\('data-dur'\)/.test(src06));
ok('no stale 4-chip index map', !/\['','4','8','12'\]/.test(src06));
ok('week more css', css.includes('.prog-week-more'));
ok('no Cardio Start week', !/id:'dp21'/.test(src06) && !/Cardio Start — 1 tydzień/.test(src06));

const m = src06.match(/function progDurationMatches\(duration,filter\)\{[\s\S]*?\n\}/);
ok('extract matcher', !!m);
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(m[0] + '\nwindow.progDurationMatches=progDurationMatches;', sandbox);
const match = sandbox.progDurationMatches;
ok('empty filter keeps 4', match(4, '') && match(12, ''));
ok('exact 4', match(4, '4') && !match(6, '4') && !match(8, '4'));
ok('exact 6', match(6, '6') && !match(4, '6'));
ok('exact 8', match(8, '8') && !match(12, '8'));
ok('10+ includes 10/12/16', match(10, '10+') && match(12, '10+') && match(16, '10+'));
ok('10+ excludes 8', !match(8, '10+') && !match(6, '10+'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll prog-catalog tests passed');
