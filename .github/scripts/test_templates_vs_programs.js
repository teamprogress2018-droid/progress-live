#!/usr/bin/env node
'use strict';
/** Szablony = mikrocykle (1 tydz.); Programy = makrocykle z periodyzacją; brak dublujących nazw. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const tplBlock = src02.slice(src02.indexOf('const PLAN_TEMPLATES=['), src02.indexOf('];', src02.indexOf('const PLAN_TEMPLATES=[')) + 2);
const progBlock = src06.slice(src06.indexOf('const DEMO_PROGRAMS=['), src06.indexOf('function allPrograms'));

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('templates are microcycles (weeks:1)', /weeks:1/.test(tplBlock) && !/weeks:[2-9]/.test(tplBlock) && !/weeks:1[0-9]/.test(tplBlock));
ok('no Stronglifts/5x5 in templates', !/Stronglifts|StrongLifts|5×5|5x5/.test(tplBlock));
ok('no Wendler 5/3/1 template', !/Wendler|5\/3\/1/.test(tplBlock));
ok('no Texas/Starting Strength/nSuns/GZCLP templates', !/Texas Method|Starting Strength|Nsuns|nSuns|GZCLP|GZCLP/.test(tplBlock));
ok('templates named as schemat/mikrocykl', /Schemat /.test(tplBlock) && /mikrocykl/.test(tplBlock));
ok('card shows 1 tydz schemat', src02.includes('1 tydz. · schemat') && src02.includes('Mikrocykl (1 tydzień)'));
ok('5x5 lives in programs', /5×5|5x5/.test(progBlock));
ok('5/3/1 lives in programs', /5\/3\/1|Wendler/.test(progBlock));
ok('moved systems in programs', /GZCLP/.test(progBlock) && /Texas Method/.test(progBlock) && /Starting Strength/.test(progBlock) && /nSuns/.test(progBlock));
ok('UI copy templates micro', html.includes('mikrocykle') || html.includes('mikrocykle') || html.includes('schematy tygodnia'));
ok('UI copy programs macro', html.includes('makrocykle') || html.includes('periodyzac'));
ok('nav labels', html.includes('Szablony (mikrocykle)') && html.includes('Programy (makrocykle)'));
ok('create form defaults 1 week', /id="tplc-weeks"[^>]*value="1"/.test(src02) || /tplc-weeks'\)\.value=existing\?\.weeks\|\|1/.test(src02));
ok('cache bumps', html.includes('02-workouts-onboarding-templates-live.js?v=30') && html.includes('06-inbox-exercises-ai-programs.js?v=62'));
ok('CI', wf.includes('test_templates_vs_programs.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll templates-vs-programs tests passed');
