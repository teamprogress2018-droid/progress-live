#!/usr/bin/env node
/** Onboard pay request + client appJoined patch. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

function extract(src,name){
  const start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const src09=fs.readFileSync(path.join(__dirname,'../../09-posture-kb-invites-private.js'),'utf8');
const src05=fs.readFileSync(path.join(__dirname,'../../05-clients-builder-plans-calendar.js'),'utf8');
const src10=fs.readFileSync(path.join(__dirname,'../../10-client-app.js'),'utf8');

const msgs=[];
const persisted=[];
const sandbox={
  window:{
    PACKAGES:[
      {id:'p1',clientId:'c1',title:'10 sesji',price:1500,payStatus:'pending'},
      {id:'p2',clientId:'c1',title:'Paid',price:100,payStatus:'paid'},
      {id:'p3',clientId:'c2',title:'Wait',price:200,payStatus:'pending',paymentRequestedAt:'2026-08-01'}
    ],
    SETTINGS:{payments:{bank:'12 3456',currency:'zł'}}
  },
  PACKAGES:null,
  notify:()=>{},
  addNotification:()=>{},
  pushMsg:(id,t)=>msgs.push({id,t}),
  persistById:(col,obj)=>persisted.push({col,id:obj.id,paymentRequestedAt:obj.paymentRequestedAt}),
  renderClientOnboardChecklist:()=>{},
  paySeller:()=>({bank:'12 3456',currency:'zł'}),
  allPackages:function(){return sandbox.window.PACKAGES;},
  console
};
sandbox.PACKAGES=sandbox.window.PACKAGES;
sandbox.window.PACKAGES=sandbox.PACKAGES;

vm.runInNewContext(
  'function allPackages(){return window.PACKAGES;}\n'+
  'function paySeller(){return {bank:"12 3456",currency:"zł"};}\n'+
  extract(src09,'requestPayment')+'\n'+
  extract(src05,'clientPendingPackage')+'\n'+
  extract(src10,'clientAppJoinedPatch')+'\n'+
  'window.requestPayment=requestPayment;window.clientPendingPackage=clientPendingPackage;window.clientAppJoinedPatch=clientAppJoinedPatch;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('pending without request',sandbox.clientPendingPackage('c1')&&sandbox.clientPendingPackage('c1').id,'p1');
eq('already requested excluded',sandbox.clientPendingPackage('c2'),null);

msgs.length=0;persisted.length=0;
eq('request ok',sandbox.requestPayment('p1'),true);
eq('chat sent',msgs.length>=1,true);
eq('flag set',!!sandbox.window.PACKAGES.find(p=>p.id==='p1').paymentRequestedAt,true);
eq('persist package',persisted.some(p=>p.col==='packages'&&p.id==='p1'),true);
eq('after request no pending helper',sandbox.clientPendingPackage('c1'),null);

const patch=sandbox.clientAppJoinedPatch('2026-08-24T12:00:00.000Z');
eq('appJoined true',patch.appJoined,true);
eq('inviteSent true',patch.inviteSent,true);
eq('joined at',patch.appJoinedAt,'2026-08-24T12:00:00.000Z');

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll onboard pay / appJoined tests passed');
