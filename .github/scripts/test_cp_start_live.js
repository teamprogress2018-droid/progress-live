#!/usr/bin/env node
'use strict';
/** Profile → Trening Live keeps the client after closeClientProfile(). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('pending handshake', /function liveSetPendingClient/.test(src02) && /function liveApplyPendingClient/.test(src02) && /liveApplyPendingClient\(\)/.test(src02));
ok('initLive skips recover when pending', /if\(pendingSlot==null\)\{/.test(src02) && /if\(pendingSlot===slot\)\{/.test(src02));
ok('cpStartLive captures id', /function cpStartLive/.test(src09) && /const cid=cpClientId/.test(src09) && /liveSetPendingClient\(cid/.test(src09) && !/liveClientSetField\(cpClientId/.test(src09));
ok('plan tab Live uses pending', /function liveSelectPlanForClient/.test(src08) && /liveSetPendingClient\(cid,\{clientName:c\?c\.name:''\,planId:pid\}\)/.test(src08));
ok('list / onboard Live uses pending', /liveSetPendingClient\(clientId,\{clientName:c\?c\.name:''\}\)/.test(src05) && /liveSetPendingClient\(clientId,\{clientName:clientName\|\|''\}\)/.test(src05));
ok('header button still wired', html.includes('onclick="cpStartLive()"'));
ok('wiadomość captures id', /function cpQuickMessage/.test(src09) && /const cid=cpClientId/.test(src09) && /openChat\(cid\)/.test(src09) && !/openChat\(cpClientId\)/.test(src09));
ok('start waits for client+plan', /start\.disabled=!ready/.test(src02) && /classList\.toggle\('btn-ghost',!ready\)/.test(src02) && /liveBindSessionButtons\(n\)/.test(src02));
ok('empty live has pick-client CTA', /function liveFocusClientPicker/.test(src02) && /function liveSyncClientChrome/.test(src02) && html.includes('liveFocusClientPicker(0)') && src02.includes('liveFocusClientPicker(${n})') && !src02.includes('Wybierz klienta u góry, żeby załadować'));
ok('rest timer not labeled Start', /live-rest-custom-go"[^>]*>Przerwa</.test(html) && !/live-rest-custom-go"[^>]*>Start</.test(html));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=72'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=70'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=61'));
ok('cache 09', html.includes('09-posture-kb-invites-private.js?v=48'));
ok('CI unit', wf.includes('test_cp_start_live.js'));
ok('CI ui', wf.includes('test_cp_start_live_ui.js'));

const start = src02.indexOf('function liveSetPendingClient');
const end = src02.indexOf('\nfunction initLive()');
ok('extract pending helpers', start >= 0 && end > start);

const ctx = vm.createContext({
  window: {},
  String, Object, console
});
ctx.window = ctx;
vm.runInContext(
  src02.slice(start, end) +
  '\nwindow.liveSetPendingClient=liveSetPendingClient;',
  ctx
);

ctx.liveSetPendingClient('', { clientName: 'X' });
ok('empty id clears pending', ctx.window._livePending == null);

ctx.liveSetPendingClient('c-rad', { clientName: 'Radosław Jarząb', planId: 'p1' });
ok('stores client+plan', ctx.window._livePending && ctx.window._livePending.clientId === 'c-rad' && ctx.window._livePending.planId === 'p1' && ctx.window._livePending.clientName === 'Radosław Jarząb');

let cpClientId = 'c-rad';
function closeClientProfile() { cpClientId = null; }
function cpStartLive() {
  if (!cpClientId) return;
  const cid = cpClientId;
  ctx.liveSetPendingClient(cid, { clientName: 'Radosław Jarząb' });
  closeClientProfile();
}
cpStartLive();
ok('id survives profile close', cpClientId === null && ctx.window._livePending && ctx.window._livePending.clientId === 'c-rad');

let opened = null;
cpClientId = 'c-rad';
function cpQuickMessage() {
  if (!cpClientId) return;
  const cid = cpClientId;
  closeClientProfile();
  opened = cid;
}
cpQuickMessage();
ok('wiadomość id survives close', cpClientId === null && opened === 'c-rad');

if (failed) process.exit(1);
console.log('\nAll cp-start-live tests passed');
