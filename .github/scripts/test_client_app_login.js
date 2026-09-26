#!/usr/bin/env node
/** Invitations are fresh, expiring and only shown as saved after a confirmed write. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('node:assert/strict');

function extract(src,name){
  let start=src.indexOf('async function '+name);
  if(start<0)start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const root=path.join(__dirname,'../..');
const src10=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github/workflows/check.yml'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('invite creation supplies expiry and an unused token',/expiresAt:new Date/.test(extract(src10,'ensureClientInvite'))&&/consumedBy:null/.test(src10));
ok('no client.id as invite fallback in 09',!/encodeURIComponent\(client\.inviteToken\|\|client\.id\)/.test(src09));
ok('clear invalid invite message',src10.includes('Zaproszenie wygasło')&&src10.includes('Zaproszenie nie pasuje'));
ok('rules include linked client onboarding fields',rules.includes('appJoined')&&/match \/clients\/\{\w+\}/.test(rules));
ok('cache versions remain current',Number((html.match(/10-client-app\.js\?v=(\d+)/)||[])[1])>=42&&Number((html.match(/09-posture-kb-invites-private\.js\?v=(\d+)/)||[])[1])>=54);
ok('CI',wf.includes('test_client_app_login.js'));

const writes=[];
let tokenSequence=0;
const fakeCrypto={getRandomValues:(a)=>{tokenSequence++;for(let i=0;i<a.length;i++)a[i]=(i*17+tokenSequence)&255;return a;}};
const sandbox={
  window:{
    _db:{},
    _uid:'tr1',
    crypto:fakeCrypto,
    _doc:(db,col,id)=>({col,id}),
    _setDoc:async(ref,payload)=>{writes.push({col:ref.col,id:ref.id,payload});}
  },
  crypto:fakeCrypto,
  withTrainer:(o)=>({...o,trainerId:'tr1'}),
  getTrainerName:()=>'Trener',
  clientAppUrl:()=>'https://example.com/progress-live/',
  persistById:()=>{},
  console
};

vm.runInNewContext(
  extract(src10,'newInviteToken')+'\n'+
  extract(src10,'clientTenantError')+'\n'+
  extract(src10,'clientTenantId')+'\n'+
  extract(src10,'captureClientTenantSession')+'\n'+
  extract(src10,'requireClientTenantSession')+'\n'+
  extract(src10,'ensureClientInvite')+'\n'+
  'window.newInviteToken=newInviteToken;window.ensureClientInvite=ensureClientInvite;',
  sandbox
);

(async()=>{
  const c={id:'c1',name:'Ada',email:'ada@x.pl',inviteToken:'existingtokentokentokentoken12'};
  const link=await sandbox.ensureClientInvite(c);
  ok('legacy token is replaced',c.inviteToken!=='existingtokentokentokentokentoken12'&&c.inviteToken.length===32);
  const first=writes.find(w=>w.col==='invites'&&w.id===c.inviteToken);
  ok('writes complete new invite',first&&first.payload.clientId==='c1'&&first.payload.trainerId==='tr1'&&first.payload.emailLower==='ada@x.pl');
  ok('invite expires in seven days',first&&Math.abs(first.payload.expiresAt.getTime()-Date.now()-7*86400000)<10000);
  ok('invite is unused and not revoked',first&&first.payload.consumedBy===null&&first.payload.consumedAt===null&&first.payload.revoked===false);
  ok('link has confirmed token',link.includes('invite='+c.inviteToken));

  writes.length=0;
  const c2={id:'c2',name:'Bartek',email:'bartek@example.test',inviteToken:'c2'};
  await sandbox.ensureClientInvite(c2);
  ok('replaces id-as-token',c2.inviteToken!=='c2'&&c2.inviteToken.length===32);
  ok('wrote new invite',writes.some(w=>w.col==='invites'&&w.id===c2.inviteToken));
  const token=c2.inviteToken;
  await sandbox.ensureClientInvite(c2);
  ok('resending creates a fresh token',c2.inviteToken!==token);
  const before=c2.inviteToken;
  sandbox.window._setDoc=async()=>{throw new Error('offline');};
  await assert.rejects(sandbox.ensureClientInvite(c2),/offline/);
  ok('failed write does not advertise an unsaved token',c2.inviteToken===before);
  await assert.rejects(sandbox.ensureClientInvite({id:'missing-email'}),/client-invite-unavailable/);

  if(failed){console.error('\n'+failed+' failed');process.exit(1);}
  console.log('\nAll client-app-login tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
