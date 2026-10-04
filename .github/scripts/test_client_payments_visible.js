#!/usr/bin/env node
/** Client + dashboard payment visibility helpers and confirmed mark-paid flow. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {webcrypto}=require('node:crypto');

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

const read=file=>fs.readFileSync(path.join(__dirname,'../..',file),'utf8');
const src01=read('01-core.js'),src09=read('09-posture-kb-invites-private.js');
const src04=read('04-client-portal.js'),src10=read('10-client-app.js'),html=read('index.html');
const srcSave=read('package-save.js');
if(html.includes('id="dash-pay-followup"'))throw new Error('dead dash-pay-followup should be gone');
if(!src04.includes('function refreshDashOps'))throw new Error('missing refreshDashOps');
if(!src04.includes('clientNotifyPaid')||!src04.includes('copyPackageTransfer'))throw new Error('client home pay banner wiring missing');
if(!src10.includes("q.get('pay')")&&!src10.includes('wantPay'))throw new Error('?pay= deep link missing');

const authStart=src01.indexOf('function assignmentSession(){');
const authEnd=src01.indexOf('// Retry bookkeeping',authStart);
if(authStart<0||authEnd<0)throw new Error('assignment session helpers missing');
const authSource=src01.slice(authStart,authEnd);

function fixture(){
  const data=new Map(),versions=new Map(),messages=[],notes=[],events=[],notices=[],pending=[],stagedCalls=[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const client={id:'c1',_fbId:'remote-c1',trainerId:'owner',name:'Anna',status:'active'};
  const pkg={id:'p1',_fbId:'remote-p1',trainerId:'owner',clientId:'c1',clientName:'Anna',title:'10 sesji',price:1500,payStatus:'pending',invoiceId:'INV-1',invoiceDocId:'remote-i1',sessions:10,sessionsUsed:2};
  const inv={id:'remote-i1',trainerId:'owner',clientId:'c1',pkgId:'p1',nr:'INV-1',amount:1500,status:'pending'};
  const other=[
    {id:'p2',trainerId:'owner',clientId:'c1',clientName:'Anna',title:'Paid',price:100,payStatus:'paid'},
    {id:'p3',trainerId:'owner',clientId:'c2',clientName:'Bartek',title:'Wait',price:200,payStatus:'pending',paymentRequestedAt:'2026-08-01'},
    {id:'p4',trainerId:'owner',clientId:'c3',clientName:'Celina',title:'Gone',price:50,payStatus:'pending',status:'expired'},
    {id:'p5',trainerId:'owner',clientId:'c9',clientName:'Arch',title:'Old',price:99,payStatus:'pending'}
  ];
  data.set('clients/remote-c1',clone(client));
  data.set('packages/remote-p1',clone(pkg));data.set('invoices/remote-i1',clone(inv));
  for(const p of other)data.set('packages/'+p.id,clone(p));
  const c={console,crypto:webcrypto,Date,Map,Set,Uint8Array,Promise,setTimeout,clearTimeout,
    _uid:'owner',tenantSessionGeneration:1,_tenantDataReady:true,_clientAppMode:false,_clientPreviewMode:false,_db:{},
    CL:[client,{id:'c2',_fbId:'remote-c2',trainerId:'owner',name:'Bartek',status:'active'},{id:'c3',trainerId:'owner',name:'Celina',status:'active'},{id:'c9',trainerId:'owner',name:'Arch',status:'archived'}],
    PACKAGES:[pkg,...other],INVOICES:[inv],SETTINGS:{payments:{bankAccount:'12 3456 7890',currency:'zł'}},payTab:'packages',
    escHtml:String,notify:m=>notices.push(m),addNotification:(t,title,body,screen)=>notes.push({t,title,body,screen}),
    pushClientMsg:t=>messages.push(t),pushMsg:()=>{},fireIntEvent:(...args)=>{events.push(args);return Promise.resolve([]);},
    renderPayPackages:()=>{},renderPayOverview:()=>{},renderPayInvoices:()=>{},renderDashPayFollowup:()=>{},renderClientLive:()=>{},
    updateClientLiveNavBadges:()=>{},renderClientOnboardChecklist:()=>{},navigator:{clipboard:null},
    document:{getElementById:()=>null,querySelectorAll:()=>[]},
    _doc:(_db,col,id)=>({col,id}),_col:(_db,col)=>col,_where:(key,_op,val)=>({key,val}),
    _query:(col,...filters)=>({col,filters}),mode:'ok',pending,stagedCalls,commits:0,
    _getDocsFromServer:async q=>({metadata:{hasPendingWrites:false},docs:[...data].filter(([key,row])=>key.startsWith(q.col+'/')&&q.filters.every(f=>row[f.key]===f.val)).map(([key,row])=>({id:key.slice(q.col.length+1),data:()=>clone(row)}))}),
    _runTransaction:async(_db,fn)=>{
      for(let attempt=0;attempt<5;attempt++){
        const staged=[],reads=new Map();stagedCalls.push(staged);
        const result=await fn({
          get:async ref=>{const key=ref.col+'/'+ref.id;reads.set(key,versions.get(key)||0);const value=data.get(key),snapshot=value&&clone(value);return{exists:()=>!!snapshot,data:()=>clone(snapshot)};},
          update:(ref,patch)=>staged.push([ref.col+'/'+ref.id,clone(patch)])
        });
        if(c.mode==='fail')throw new Error('offline');
        if(c.mode==='defer')await new Promise((resolve,reject)=>pending.push({resolve,reject}));
        if([...reads].some(([key,version])=>(versions.get(key)||0)!==version)){c.conflicts=(c.conflicts||0)+1;continue;}
        staged.forEach(([key,patch])=>{data.set(key,{...data.get(key),...patch});versions.set(key,(versions.get(key)||0)+1);});c.commits++;
        if(c.mode==='lost')throw new Error('lost ACK');
        return result;
      }
      throw new Error('transaction contention limit');
    }
  };
  c.window=c;
  const segment=src09.slice(src09.indexOf('function clientUnpaidPackages'),src09.indexOf('function requestPayment'));
  vm.createContext(c);vm.runInContext(authSource,c);vm.runInContext(srcSave,c);
  vm.runInContext(
    'function allPackages(){return window.PACKAGES;}\n'+
    'function paySeller(){const pay=(window.SETTINGS&&window.SETTINGS.payments)||{};return{bank:pay.bankAccount||"",currency:pay.currency||"zł"};}\n'+segment+
    'window.clientUnpaidPackages=clientUnpaidPackages;window.packagesAwaitingPayment=packagesAwaitingPayment;window.payTransferText=payTransferText;window.clientNotifyPaid=clientNotifyPaid;window.markPaid=markPaid;',c);
  return {c,data,messages,notes,events,notices,pending,stagedCalls,client,pkg,inv};
}

async function waitFor(check){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,0));}throw new Error('timed out waiting for payment test state');}
async function main(){
  if(!src09.includes('function payClientsFromPackages'))throw new Error('payment client helper missing');
  const f=fixture(),s=f.c;
  let failed=0;
  function eq(name,got,want){
    if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
    else console.log('OK  ',name);
  }

  eq('unpaid only pending',s.clientUnpaidPackages('c1').map(p=>p.id),['p1']);
  eq('awaiting excludes expired',s.packagesAwaitingPayment().map(p=>p.id).sort(),['p1','p3']);
  eq('awaiting excludes archived',s.packagesAwaitingPayment().some(p=>p.id==='p5'),false);

  const text=s.payTransferText(s.PACKAGES[0]);
  eq('transfer has bank',text.includes('12 3456 7890'),true);
  eq('transfer has amount',text.includes('1\u00a0500')||text.includes('1500'),true);
  eq('transfer has title',text.includes('Anna INV-1'),true);

  f.messages.length=0;f.notes.length=0;
  eq('notify paid ok',s.clientNotifyPaid('p1'),true);
  eq('client chat msg',f.messages.length,1);
  eq('trainer notification',f.notes.length>=1,true);

  // Hold the transaction before commit: local status and payment event must wait for ACK,
  // while the loader mask preserves the existing row and its unrelated fields.
  s.mode='defer';const first=s.markPaid('p1'),duplicate=s.markPaid('p1');
  eq('duplicate click shares pending UI operation',first===duplicate,true);
  await waitFor(()=>f.pending.length===1);eq('only one transaction while pending',f.stagedCalls.length,1);
  eq('pending keeps local package unpaid',f.pkg.payStatus,'pending');
  eq('pending emits no webhook',f.events.filter(e=>e[0]==='package.paid').length,0);
  const masked=s.packagePaymentConfirmedRecord({id:'p1',trainerId:'owner',payStatus:'paid',sessionsUsed:7},'packages');
  eq('pending package remains visible with prior status',masked.payStatus,'pending');
  eq('pending package preserves unrelated fields',masked.sessionsUsed,7);
  const maskedInvoice=s.packagePaymentConfirmedRecord({id:'remote-i1',_fbId:'remote-i1',trainerId:'owner',status:'paid',amount:1500},'invoices');
  eq('pending invoice retains prior status',maskedInvoice.status,'pending');
  f.pending.shift().resolve();const paid=await first;s.mode='ok';
  eq('mark paid clears unpaid after ACK',s.clientUnpaidPackages('c1').length,0);
  eq('awaiting after paid',s.packagesAwaitingPayment().map(p=>p.id),['p3']);
  eq('package paid confirmed in memory and storage',f.pkg.payStatus==='paid'&&f.data.get('packages/remote-p1').payStatus==='paid',true);
  eq('UUID-linked invoice paid confirmed in memory and storage',f.inv.status==='paid'&&f.data.get('invoices/remote-i1').status==='paid',true);
  eq('one event after confirmed transition',f.events.filter(e=>e[0]==='package.paid').length,1);
  eq('invoice document id resolved',paid.invoice.id,'remote-i1');

  // A later stale invocation confirms the current paid state without emitting again.
  await s.markPaid('p1');
  eq('repeat paid invocation does not duplicate webhook',f.events.filter(e=>e[0]==='package.paid').length,1);

  // A failed transaction must leave both local statuses unchanged and emit no event.
  const failedFlow=fixture();failedFlow.c.mode='fail';const failedResult=await failedFlow.c.markPaid('p1');
  eq('failed payment returns no success result',failedResult,null);
  eq('failed payment keeps package pending',failedFlow.pkg.payStatus,'pending');
  eq('failed payment keeps invoice pending',failedFlow.inv.status,'pending');
  eq('failed payment emits no event',failedFlow.events.filter(e=>e[0]==='package.paid').length,0);

  // Lost ACK recovery reuses the same operation and emits only after a successful retry.
  const lost=fixture();lost.c.mode='lost';eq('lost ACK does not report success',await lost.c.markPaid('p1'),null);
  eq('lost ACK emitted no event before retry',lost.events.filter(e=>e[0]==='package.paid').length,0);
  lost.c.mode='ok';await lost.c.markPaid('p1');
  eq('lost ACK retry emits one transition event',lost.events.filter(e=>e[0]==='package.paid').length,1);
  eq('lost ACK retry confirms invoice',lost.inv.status,'paid');

  eq('history not by name',/p\.clientName===hcf/.test(src09),false);
  eq('chips not unique names',src09.includes("new Set(all.map(p=>p.clientName))"),false);
  eq('helper present',src09.includes('function payClientsFromPackages'),true);
  eq('card data-client-id',src09.includes('data-client-id=')&&src09.includes('filterPkgByClient(this.dataset.clientId'),true);
  eq('cache 09',html.includes('09-posture-kb-invites-private.js?v=54'),true);
  const wf=read('.github/workflows/check.yml');eq('CI ui',wf.includes('test_pay_hist_id_ui.js'),true);

  vm.runInContext(extract(src09,'payClientsFromPackages')+'\nwindow.payClientsFromPackages=payClientsFromPackages;',s);
  s.CL=[{id:'c-a1',name:'Anna Kowalska'},{id:'c-a2',name:'Anna Nowak'}];s.window.CL=s.CL;
  const coll=[{id:'x1',clientId:'c-a1',clientName:'Anna Nowak'},{id:'x2',clientId:'c-a2',clientName:'Anna Nowak'},{id:'x3',clientId:'c-a1',clientName:'Anna Nowak'},{id:'x4',clientName:'Ghost'}];
  eq('two ids same name',s.payClientsFromPackages(coll).map(c=>c.id).sort(),['c-a1','c-a2']);
  eq('live name wins',s.payClientsFromPackages(coll).find(c=>c.id==='c-a1').name,'Anna Kowalska');
  eq('skips no id',s.payClientsFromPackages(coll).some(c=>c.name==='Ghost'),false);

  if(failed){console.error(failed+' failed');process.exit(1);}
  console.log('\nAll client payments visibility and confirmed payment tests passed');
}
let completed=false;
const watchdog=setTimeout(()=>{if(!completed){console.error('FAIL payment visibility test timed out before final assertion');process.exit(1);}},15000);
main().then(()=>{completed=true;clearTimeout(watchdog);}).catch(error=>{completed=true;clearTimeout(watchdog);console.error(error);process.exitCode=1;});
