#!/usr/bin/env node
/** Audit polish: check-in dash refresh, badges, habits off tasks widget. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src06=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');
const src10=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('sendCheckinTo refreshes dash',/function sendCheckinTo[\s\S]*?renderDashCheckinFollowup/.test(src04));
ok('saveCheckinFill refreshes dash',/function saveCheckinFill[\s\S]*?renderDashCheckinFollowup/.test(src04));
ok('clientSubmitCheckin refreshes dash',/function clientSubmitCheckin[\s\S]*?renderDashCheckinFollowup/.test(src10));
ok('packages filter archived',src09.includes('status!==\'archived\'')&&/function packagesAwaitingPayment[\s\S]*?archived/.test(src09));
ok('messages badge not forms',src10.includes("setBadge('clive-bn-messages',pendChat)")&&!src10.includes("setBadge('clive-bn-messages',pendForms)"));
ok('home badge forms or habits',src10.includes("setBadge('clive-bn-home',pendHab||pendForms)"));
ok('client unread helper',src06.includes('function clientHasUnreadFromTrainer'));
ok('open chat marks read on inbound',src10.includes('msgSetLastRead')&&src10.includes('curChat===clientId'));
ok('inbox skips archived',src06.includes("status!=='archived'")&&/function renderInbox[\s\S]*?archived/.test(src06));
ok('dash tasks skip habits comment',src04.includes('dash-habit-followup')&&src04.includes('isHabit(t))return false'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll audit polish tests passed');
