#!/usr/bin/env node
/** Client + dashboard payment visibility helpers. */
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
const src04=fs.readFileSync(path.join(__dirname,'../../04-client-portal.js'),'utf8');
const src10=fs.readFileSync(path.join(__dirname,'../../10-client-app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');

if(!html.includes('id="dash-pay-followup"')){
  console.error('FAIL missing dash-pay-followup in index.html');
  process.exit(1);
}
if(!src04.includes('function renderDashPayFollowup')){
  console.error('FAIL missing renderDashPayFollowup');
  process.exit(1);
}
if(!src04.includes('clientNotifyPaid')||!src04.includes('copyPackageTransfer')){
  console.error('FAIL client home pay banner wiring missing');
  process.exit(1);
}
if(!src10.includes("q.get('pay')")&&!src10.includes('wantPay')){
  console.error('FAIL ?pay= deep link missing');
  process.exit(1);
}

const msgs=[];
const notes=[];
const sandbox={
  window:{
    PACKAGES:[
      {id:'p1',clientId:'c1',clientName:'Anna',title:'10 sesji',price:1500,payStatus:'pending',invoiceId:'INV-1'},
      {id:'p2',clientId:'c1',clientName:'Anna',title:'Paid',price:100,payStatus:'paid'},
      {id:'p3',clientId:'c2',clientName:'Bartek',title:'Wait',price:200,payStatus:'pending',paymentRequestedAt:'2026-08-01'},
      {id:'p4',clientId:'c3',clientName:'Celina',title:'Gone',price:50,payStatus:'pending',status:'expired'}
    ],
    SETTINGS:{payments:{bankAccount:'12 3456 7890',currency:'zł'}},
    CL:[{id:'c1',name:'Anna'}],
    _clientAppMode:false
  },
  PACKAGES:null,
  notify:()=>{},
  addNotification:(t,title,body,screen)=>notes.push({t,title,body,screen}),
  pushClientMsg:(t)=>msgs.push(t),
  pushMsg:()=>{},
  persistById:()=>{},
  renderPayPackages:()=>{},
  renderPayOverview:()=>{},
  fireIntEvent:()=>{},
  renderDashPayFollowup:()=>{},
  renderClientLive:()=>{},
  updateClientLiveNavBadges:()=>{},
  renderClientOnboardChecklist:()=>{},
  navigator:{clipboard:null},
  console
};
sandbox.PACKAGES=sandbox.window.PACKAGES;
sandbox.window.PACKAGES=sandbox.PACKAGES;

vm.runInNewContext(
  'function allPackages(){return window.PACKAGES;}\n'+
  'function paySeller(){const pay=(window.SETTINGS&&window.SETTINGS.payments)||{};return{bank:pay.bankAccount||"",currency:pay.currency||"zł"};}\n'+
  extract(src09,'clientUnpaidPackages')+'\n'+
  extract(src09,'packagesAwaitingPayment')+'\n'+
  extract(src09,'payTransferText')+'\n'+
  extract(src09,'clientNotifyPaid')+'\n'+
  extract(src09,'refreshPaySurfaces')+'\n'+
  extract(src09,'markPaid')+'\n'+
  'window.clientUnpaidPackages=clientUnpaidPackages;window.packagesAwaitingPayment=packagesAwaitingPayment;window.payTransferText=payTransferText;window.clientNotifyPaid=clientNotifyPaid;window.markPaid=markPaid;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

const unpaid=sandbox.clientUnpaidPackages('c1');
eq('unpaid only pending',unpaid.map(p=>p.id),['p1']);
eq('awaiting excludes expired',sandbox.packagesAwaitingPayment().map(p=>p.id).sort(),['p1','p3']);

const text=sandbox.payTransferText(sandbox.window.PACKAGES[0]);
eq('transfer has bank',text.includes('12 3456 7890'),true);
eq('transfer has amount',text.includes('1\u00a0500')||text.includes('1500'),true);
eq('transfer has title',text.includes('Anna INV-1'),true);

msgs.length=0;notes.length=0;
eq('notify paid ok',sandbox.clientNotifyPaid('p1'),true);
eq('client chat msg',msgs.length,1);
eq('trainer notification',notes.length>=1,true);

sandbox.markPaid('p1');
eq('mark paid clears unpaid',sandbox.clientUnpaidPackages('c1').length,0);
eq('awaiting after paid',sandbox.packagesAwaitingPayment().map(p=>p.id),['p3']);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll client payments visibility tests passed');
