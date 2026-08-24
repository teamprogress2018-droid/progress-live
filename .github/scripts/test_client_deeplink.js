#!/usr/bin/env node
/** Client app deep-link: pending check-in / form on enter. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const src=fs.readFileSync(path.join(__dirname,'../../10-client-app.js'),'utf8');
const start=src.indexOf('function clientTryOpenPendingDeepLink');
if(start<0){console.error('missing clientTryOpenPendingDeepLink');process.exit(1);}
let i=start,depth=0,begun=false;
for(;i<src.length;i++){
  if(src[i]==='{'){depth++;begun=true;}
  else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
}
const fnSrc=src.slice(start,i)+'\nwindow.clientTryOpenPendingDeepLink=clientTryOpenPendingDeepLink;';

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

function runCase(label,opts){
  const calls=[];
  const sandbox={
    window:{
      _clientId:'c1',
      CL:[{id:'c1'}],
      _clientPendingDeepLinkDone:opts.alreadyDone||false
    },
    location:{search:opts.search||''},
    setTimeout:(fn)=>fn(),
    pendingCheckin:()=>opts.pendingCi||null,
    pendingFormSends:()=>opts.pendingForms||[],
    setClientLiveScreen:(s)=>calls.push(['screen',s]),
    clientOpenForm:(id)=>calls.push(['form',id]),
    URLSearchParams
  };
  sandbox.window=Object.assign(sandbox.window,{});
  vm.runInNewContext(fnSrc+'\nclientTryOpenPendingDeepLink();',sandbox);
  eq(label,calls,opts.expect);
  return sandbox;
}

runCase('url checkin',{search:'?checkin=1',expect:[['screen','checkin']]});
runCase('url form',{search:'?form=fs1',expect:[['form','fs1']]});
runCase('auto pending checkin',{search:'',pendingCi:{id:'ci1'},expect:[['screen','checkin']]});
runCase('auto pending form',{search:'',pendingForms:[{id:'fs9'}],expect:[['form','fs9']]});
runCase('no pending',{search:'',expect:[]});
const again=runCase('once only first',{search:'',pendingCi:{id:'ci1'},expect:[['screen','checkin']]});
// second call with same flag should no-op auto path
again.window._clientPendingDeepLinkDone=true;
const calls2=[];
again.setClientLiveScreen=(s)=>calls2.push(s);
again.pendingCheckin=()=>({id:'ci1'});
vm.runInNewContext('clientTryOpenPendingDeepLink();',again);
eq('second enter no auto',calls2,[]);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll client deep-link tests passed');
