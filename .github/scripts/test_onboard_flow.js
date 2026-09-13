#!/usr/bin/env node
/** Onboard checklist: invite skip resume, forms library, schedule picker, builder. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const src01 = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('invite skip handler', src09.includes('function closeInviteModal') && html.includes('closeInviteModal(true)'));
ok('invite X resumes without skip', html.includes('closeInviteModal(false)'));
ok('openInviteFromOnboard', src05.includes('function openInviteFromOnboard') && src05.includes('_onboardResumeAfterInvite'));
ok('forms library helper', src05.includes('function openFormsLibraryFromOnboard') && src05.includes("setFormNav('wstepna')"));
ok('forms banner', html.includes('id="forms-onboard-banner"') && html.includes('z-index:30') && src07.includes('function resumeOnboardFromForms'));
ok('send form prefills onboard client', src07.includes('_onboardResumeAfterForms') && src07.includes('sendFormSetClientField(resumeC.id'));
ok('schedule modal', html.includes('id="m-onboard-schedule"') && src05.includes('function saveClientScheduleFromOnboard'));
ok('builder from onboard not profile tab', src05.includes("openBuilderForClient('${id}')") && !/openClientProfile\('\$\{id\}'\);setTimeout\(\(\)=>setCPTab\('plan'\)/.test(src05));
ok('baseline ignores card weight', src01.includes('function clientOnboardHasBaseline') && !/baselineDone\|\|c\.weight/.test(src01));
ok('cache 01/05/07/09', html.includes('01-core.js?v=103') && html.includes('05-clients-builder-plans-calendar.js?v=58') && html.includes('07-forms-metrics-calculator.js?v=35') && html.includes('09-posture-kb-invites-private.js?v=42'));
ok('CI unit+ui', wf.includes('test_onboard_flow.js') && wf.includes('test_onboard_flow_ui.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll onboard flow source checks passed');
