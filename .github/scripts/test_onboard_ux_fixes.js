#!/usr/bin/env node
/** UX fixes: ankieta, plan CTAs, package save, WhatsApp copy, live client, homework names, PDF print. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('profile edit no duplicate intake buttons', src08.includes('Ankieta wstępna — tylko w Formularzach') && src08.includes("setCPTab('forms')") && !src08.includes("printFormPdf('df1')") && !src08.includes("sendClientIntakeForm('${escHtml(c.id)}');cancelCPEdit()"));
ok('plan tab CTAs gated on empty', src08.includes('const showCreate=!plans.length') && src08.includes('showContinueFitebo') && src08.includes('Generuj plan AI'));
ok('onboard does not push extra plan CTAs when done', !/doneExtra:`<div[\s\S]*Nowy plan AI/.test(src05) && src05.includes("cta:'⚡ Plan AI'"));
ok('apl back auto-saves generated plan', src05.includes('function resumeOnboardFromApl') && src05.includes('aplSavePlan()'));
ok('package save requires client and persists after close', src09.includes("notify('Wybierz klienta')") && src09.includes("closeM('m-package')") && src09.includes("await persistById('packages',pkg)") && src09.indexOf("closeM('m-package')") < src09.indexOf("await persistById('packages',pkg)"));
ok('whatsapp copies instead of forcing app', src09.includes('Kopiuj wiadomość') && src09.includes('function copyInviteMessage') && src09.includes('function openInviteWhatsApp') && html.includes('id="inv-open-wa-btn"') && !/whatsapp[\s\S]{0,200}window\.open\(href/.test(src09));
ok('live clears other client plan', src02.includes('p.clientId!==st.clientId') && src02.includes('st.exercises=[]') && src02.includes('st.planId=null'));
ok('homework lists all client names', src06.includes('Klienci: ${hwNames.map(esc).join') && src09.includes('function ahwRenderClientList') && src09.includes('ahw-client-search') && !src06.includes('.slice(0,8)'));
ok('print overlay not clipped', css.includes('#report-overlay{') && css.includes('position:static!important') && css.includes('overflow:visible!important'));
ok('cache pins', html.includes('02-workouts-onboarding-templates-live.js?v=77') && html.includes('05-clients-builder-plans-calendar.js?v=77') && html.includes('06-inbox-exercises-ai-programs.js?v=82') && html.includes('08-client-profile-extras.js?v=62') && html.includes('09-posture-kb-invites-private.js?v=51') && html.includes('styles.css?v=98'));
ok('CI', wf.includes('test_onboard_ux_fixes.js') && wf.includes('test_onboard_ux_fixes_ui.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll onboard UX fix source checks passed');
