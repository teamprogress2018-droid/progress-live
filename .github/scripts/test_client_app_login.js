#!/usr/bin/env node
/** Zaproszenia klienta: ensureClientInvite zawsze zapisuje invites/{token}. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

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

ok('ensure upserts existing token',/if\(!token\|\|token===client\.id\)/.test(src10)&&/updatedAt/.test(extract(src10,'ensureClientInvite')));
ok('no client.id as invite fallback in 09',!/encodeURIComponent\(client\.inviteToken\|\|client\.id\)/.test(src09));
ok('clear invalid invite message',src10.includes('Kod z linku zaproszenia jest nieważny'));
ok('rules allow client appJoined',/hasOnly\(\['appJoined'/.test(rules));
ok('cache bumps',html.includes('10-client-app.js?v=26')&&html.includes('09-posture-kb-invites-private.js?v=34'));
ok('CI',wf.includes('test_client_app_login.js'));

const writes=[];
const fakeCrypto={getRandomValues:(a)=>{for(let i=0;i<a.length;i++)a[i]=(i*17+3)&255;return a;}};
const sandbox={
  window:{
    _db:{},
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
  extract(src10,'ensureClientInvite')+'\n'+
  'window.newInviteToken=newInviteToken;window.ensureClientInvite=ensureClientInvite;',
  sandbox
);

(async()=>{
  const c={id:'c1',name:'Ada',email:'ada@x.pl',inviteToken:'existingtokentokentokentoken12'};
  const link=await sandbox.ensureClientInvite(c);
  ok('keeps existing token',c.inviteToken==='existingtokentokentokentoken12');
  ok('writes invites doc',writes.some(w=>w.col==='invites'&&w.id==='existingtokentokentokentoken12'&&w.payload.clientId==='c1'));
  ok('link has token',link.includes('invite=existingtokentokentokentoken12'));

  writes.length=0;
  const c2={id:'c2',name:'Bartek',inviteToken:'c2'}; // token === id → regenerate
  await sandbox.ensureClientInvite(c2);
  ok('replaces id-as-token',c2.inviteToken!=='c2'&&c2.inviteToken.length===32);
  ok('wrote new invite',writes.some(w=>w.col==='invites'&&w.id===c2.inviteToken));

  if(failed){console.error('\n'+failed+' failed');process.exit(1);}
  console.log('\nAll client-app-login tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
