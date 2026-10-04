// Offline VM tests load the real service and UI; all writes are a staged in-memory transaction.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.join(__dirname,'../..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const core=read('01-core.js'),ui=read('09-posture-kb-invites-private.js');
const authSource=core.slice(core.indexOf('function assignmentSession(){'),core.indexOf('// Retry bookkeeping',core.indexOf('function assignmentSession(){')));
function fixture(shared){
 const data=shared?shared.data:new Map(),versions=shared?shared.versions:new Map(),calls=[],pending=[],notices=[],resume=[],els={};
 const clone=v=>JSON.parse(JSON.stringify(v));
 for(const key of ['title','type','sessions','price','validity','client','date','pay-status','notes','save-btn','save-status'])els['pkg-'+key]={value:'',disabled:false,textContent:'',style:{}};
 let shown=true;els['m-package']={classList:{contains:()=>shown,add:()=>{shown=true;},remove:()=>{shown=false;}}};
 const c={console,crypto:webcrypto,Date,Map,Set,Uint8Array,Promise,setTimeout,clearTimeout,_uid:'owner',tenantSessionGeneration:1,_tenantDataReady:true,_db:{},CL:[{id:'a',_fbId:'remote-a',trainerId:'owner',status:'active',name:'Alfa'},{id:'b',trainerId:'owner',status:'active',name:'Beta'}],PACKAGES:[],INVOICES:[],payTab:'none',escHtml:String,notify:m=>notices.push(m),confirm:()=>false,maybeResumeOnboard:id=>resume.push(id),clearPackageOnboardBanner:()=>{},nextInvoiceNr:()=>{throw Error('Local invoice numbering must not be called');},renderDash:()=>{},renderClients:()=>{},document:{getElementById:id=>els[id]},_doc:(_db,col,id)=>({col,id}),_col:(_db,col)=>col,_where:(key,_op,val)=>({key,val}),_query:(col,...filters)=>({col,filters})};
 c.window=c;data.set('clients/remote-a',clone(c.CL[0]));data.set('clients/b',clone(c.CL[1]));
 c._getDocsFromServer=async q=>({docs:[...data].filter(([key,v])=>key.startsWith(q.col+'/')&&q.filters.every(f=>v[f.key]===f.val)).map(([key,v])=>({id:key.split('/')[1],data:()=>clone(v)}))});
 // Optimistic transactions read versioned snapshots and rerun on a real conflict.
 c.conflicts=0;c.commits=0;
 c._runTransaction=async(_db,fn)=>{
  for(let attempt=0;attempt<5;attempt++){
   const staged=[],reads=new Map();calls.push(staged);
   const result=await fn({get:async ref=>{const key=ref.col+'/'+ref.id,v=data.get(key);reads.set(key,versions.get(key)||0);const snapshot=v&&clone(v);return {exists:()=>!!snapshot,data:()=>clone(snapshot)};},set:(ref,v)=>{if(c.mode==='secondfail'&&staged.length===1||c.mode==='thirdfail'&&staged.length===2)throw Error('write rejected');staged.push([ref.col+'/'+ref.id,clone(v)]);}});
   if(!staged.length)return result;
   if(c.mode==='null')return null;
   if(c.mode==='fail')throw Error('offline');
   if(c.mode==='defer')await new Promise((resolve,reject)=>pending.push({resolve,reject}));
   if([...reads].some(([key,version])=>(versions.get(key)||0)!==version)){c.conflicts++;continue;}
   staged.forEach(([key,v])=>{data.set(key,v);versions.set(key,(versions.get(key)||0)+1);});c.commits++;
   if(c.mode==='lost')throw Error('lost ACK');return result;
  }
  throw Error('transaction contention limit');
 };
 vm.createContext(c);vm.runInContext(authSource,c);vm.runInContext(read('package-save.js'),c);
 vm.runInContext(ui.slice(ui.indexOf('// Drafts retain'),ui.indexOf("var odTab=",ui.indexOf('// Drafts retain'))),c);
 c.closeM=()=>{c.leavePackageSaveModal();shown=false;};
 function pair(){const pkg={id:c.newPackageSaveId('pkg'),title:'Pakiet',type:'sessions',sessions:10,sessionsUsed:0,price:100.5,validity:90,clientId:'a',trainerId:'owner',payStatus:'paid',date:'2026-10-04',expiresDate:'2027-01-02',invoiceId:'INV-1001',invoiceDocId:c.newPackageSaveId('inv')};return {pkg,invoice:{id:pkg.invoiceDocId,nr:'INV-1001',pkgId:pkg.id,clientId:pkg.clientId,pkgTitle:pkg.title,date:pkg.date,amount:pkg.price,status:pkg.payStatus,trainerId:'owner'}};}
 function operation(){return {auth:c.assignmentSession(),client:clone(c.CL[0])};}
 function open(client='a'){shown=true;c._packageOpenClient=client;c._onboardResumeAfterPackage=client;c.initPackageSaveModal();if(!c.packageSaveActive)Object.assign(els['pkg-title'],{value:'Pakiet'});if(!c.packageSaveActive){els['pkg-price'].value='100.50';els['pkg-sessions'].value='10';els['pkg-validity'].value='90';}}
 return {c,data,calls,pending,notices,resume,els,pair,operation,open,shown:()=>shown};
}
async function tick(){for(let i=0;i<12;i++)await Promise.resolve();}
async function main(){
 let f=fixture(),p=f.pair(),op=f.operation();f.c.mode='defer';const one=f.c.savePackageConfirmed(p,op),two=f.c.savePackageConfirmed(p,op);assert.equal(one,two);await tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].length,3);assert.equal(f.data.size,2);assert.equal(f.c.packageSaveRecordVisible(op.candidate.pkg),false);f.pending.shift().resolve();await one;assert.equal(f.data.size,5);assert.equal(f.c.packageSaveRecordVisible(op.candidate.pkg),true);await f.c.savePackageConfirmed(p,op);assert.equal(f.calls.length,1);
 for(const mode of ['fail','null','secondfail','thirdfail']){f=fixture();f.c.mode=mode;p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.data.size,2);f.c.mode='ok';const saved=await f.c.savePackageConfirmed(p,op);assert.equal(saved.pkg.id,p.pkg.id);assert.equal(saved.invoice.id,p.invoice.id);assert.equal(f.data.size,5);}
 f=fixture();f.c.mode='lost';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));f.data.get('packages/'+p.pkg.id).sessionsUsed=3;f.data.get('packages/'+p.pkg.id).payStatus='partial';f.data.get('invoices/'+p.invoice.id).status='partial';f.c.mode='ok';const recovered=await f.c.savePackageConfirmed(p,op);assert.equal(recovered.pkg.sessionsUsed,3);assert.equal(recovered.invoice.status,'partial');assert.equal(f.calls.filter(x=>x.length).length,1);
 f=fixture();f.c.mode='lost';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));f.data.get('clients/remote-a').archived=true;f.c.mode='ok';await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.calls.filter(x=>x.length).length,1);
 for(const damage of ['partial','receipt','title']){f=fixture();f.c.mode='lost';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));if(damage==='partial')f.data.delete('invoices/'+p.invoice.id);else f.data.get('packages/'+p.pkg.id)[damage==='receipt'?'packageCreateId':'title']='other';f.c.mode='ok';await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.calls.filter(x=>x.length).length,1);}
 for(const mutate of [f=>f.c.CL[0].trainerId='other',f=>f.c.CL[0].archived=true,f=>f.data.get('clients/remote-a').archived=true,f=>f.c.tenantSessionGeneration++,f=>f.c.CL[0]._fbId='different']){f=fixture();p=f.pair();op=f.operation();mutate(f);await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.data.size,2);}
 for(const values of [{price:-1},{price:1.234},{price:NaN},{sessions:1.5},{validity:0},{date:'2026-02-30'},{type:'bad'}]){f=fixture();p=f.pair();Object.assign(p.pkg,values);await assert.rejects(f.c.savePackageConfirmed(p,f.operation()));assert.equal(f.calls.length,0);}
 f=fixture();f.c.mode='defer';f.open();assert.equal(f.els['pkg-pay-status'].value,'pending');const save=f.c.savePackage();f.c.savePackage();await tick();assert.equal(f.pending.length,1);assert.equal(f.els['pkg-save-btn'].disabled,true);assert.equal(f.els['pkg-price'].value,'100.50');assert.equal(f.c.PACKAGES.length,0);assert.equal(f.resume.length,0);assert.equal(f.notices.length,0);f.pending.shift().resolve();await save;assert.equal(f.shown(),false);assert.equal(f.resume[0],'a');assert.equal(f.c.PACKAGES[0].price,100.5);assert.equal(f.c.INVOICES[0].nr,'INV-S-1');assert.notEqual(f.c.INVOICES[0].id,'INV-1001');
 f=fixture();f.c.mode='fail';f.open();await f.c.savePackage();const candidate=f.c.packageSaveActive.operation.candidate;assert.equal(f.shown(),true);assert.equal(f.c.PACKAGES.length,0);assert.equal(f.resume.length,0);assert.match(f.els['pkg-save-status'].textContent,/offline/);f.c.closeM();f.open();assert.equal(f.els['pkg-price'].value,'100.50');f.c.mode='ok';await f.c.savePackage();assert.equal(f.c.PACKAGES[0].id,candidate.pkg.id);
 for(const next of ['b','a']){f=fixture();f.c.mode='defer';f.open();const pendingSave=f.c.savePackage();await tick();f.c.closeM();f.open(next);f.pending.shift().resolve();await pendingSave;assert.equal(f.shown(),true);assert.equal(f.c.PACKAGES.length,0);assert.equal(f.resume.length,0);assert.equal(f.notices.length,0);if(next==='a'){assert.equal(f.els['pkg-save-btn'].disabled,false);await f.c.savePackage();assert.equal(f.shown(),false);}}
 f=fixture();f.c.mode='defer';f.open();const late=f.c.savePackage();await tick();f.c.tenantSessionGeneration++;f.c.clearPackageSaveDrafts();f.pending.shift().resolve();await late;assert.equal(f.c.PACKAGES.length,0);assert.equal(f.resume.length,0);assert.equal(f.notices.length,0);
 assert.equal(f.c.packageSaveRecordVisible({id:'existing',payStatus:'paid'},{hasPendingWrites:true}),true);
 f=fixture();f.c.mode='fail';f.open('b');await f.c.savePackage();const beforeSwitch=f.c.packageSaveActive.pair;f.c.closeM();f.open('a');f.els['pkg-client'].value='b';f.c.changePackageSaveClient();f.c.mode='ok';await f.c.savePackage();assert.equal(f.c.PACKAGES[0].id,beforeSwitch.pkg.id);
 // Two tabs share only their versioned server; both initially read last=0.
 const shared={data:new Map(),versions:new Map()},left=fixture(shared),right=fixture(shared),leftPair=left.pair(),rightPair=right.pair(),leftOp=left.operation(),rightOp=right.operation();
 const concurrent=await Promise.all([left.c.savePackageConfirmed(leftPair,leftOp),right.c.savePackageConfirmed(rightPair,rightOp)]);
 assert.deepEqual(concurrent.map(x=>x.invoice.numberSequence).sort(),[1,2]);assert.equal(left.c.conflicts+right.c.conflicts,1);assert.equal(left.c.commits+right.c.commits,2);
 assert.equal(shared.data.get('invoiceCounters/owner').last,2);assert.equal(shared.data.size,7);
 assert.equal(leftOp.candidate.invoice.nr,'INV-1001');assert.equal(rightOp.candidate.invoice.nr,'INV-1001');assert.equal(Object.isFrozen(leftOp.candidate.invoice),true);
 // The distinct new series preserves historical invoice documents and numbers.
 f=fixture();f.data.set('invoices/legacy',{id:'legacy',trainerId:'owner',nr:'INV-1001',amount:50});p=f.pair();delete p.invoice.nr;delete p.pkg.invoiceId;const numbered=await f.c.savePackageConfirmed(p,f.operation());assert.equal(numbered.invoice.nr,'INV-S-1');assert.equal(f.data.get('invoices/legacy').nr,'INV-1001');
 // Counter validation fails closed, with no writes committed or number consumed.
 for(const counter of [{trainerId:'other',last:1},{trainerId:'owner',last:-1},{trainerId:'owner',last:1.5},{trainerId:'owner',last:'1'},{trainerId:'owner',last:Number.MAX_SAFE_INTEGER},{trainerId:'owner'}]){
  f=fixture();f.data.set('invoiceCounters/owner',counter);await assert.rejects(f.c.savePackageConfirmed(f.pair(),f.operation()));assert.deepEqual(f.data.get('invoiceCounters/owner'),counter);assert.equal(f.c.commits,0);assert.equal(f.data.size,3);
 }
 f=fixture();f.data.set('invoiceCounters/owner',{trainerId:'owner',last:7,invoiceDocId:'old'});f.c.mode='thirdfail';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.data.get('invoiceCounters/owner').last,7);assert.equal(f.c.commits,0);f.c.mode='ok';const rollback=await f.c.savePackageConfirmed(p,op);assert.equal(rollback.invoice.nr,'INV-S-8');assert.equal(f.data.get('invoiceCounters/owner').last,8);
 // A lost ACK recovers its own number after another tab advances the counter.
 const sharedLost={data:new Map(),versions:new Map()},lost=fixture(sharedLost),other=fixture(sharedLost),lostPair=lost.pair(),lostOp=lost.operation();lost.c.mode='lost';await assert.rejects(lost.c.savePackageConfirmed(lostPair,lostOp));await other.c.savePackageConfirmed(other.pair(),other.operation());lost.c.mode='ok';const lostResult=await lost.c.savePackageConfirmed(lostPair,lostOp);assert.equal(lostResult.invoice.nr,'INV-S-1');assert.equal(sharedLost.data.get('invoiceCounters/owner').last,2);assert.equal(lost.c.commits,1);
 for(const tamper of ['numberSequence','numberSeries','numberPrefix','nr','invoiceId']){f=fixture();f.c.mode='lost';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));const invoice=f.data.get('invoices/'+p.invoice.id),pkg=f.data.get('packages/'+p.pkg.id);if(tamper==='invoiceId')pkg.invoiceId='INV-S-999';else invoice[tamper]=tamper==='numberSequence'?0:'invalid';f.c.mode='ok';await assert.rejects(f.c.savePackageConfirmed(p,op));assert.equal(f.data.get('invoiceCounters/owner').last,1);assert.equal(f.c.commits,1);}
 f=fixture();f.c.SETTINGS={company:{invoice_prefix:'FV2026'}};f.c.mode='defer';p=f.pair();op=f.operation();const configured=f.c.savePackageConfirmed(p,op);await tick();f.c.SETTINGS.company.invoice_prefix='OTHER';f.pending.shift().resolve();const prefixed=await configured;assert.equal(prefixed.invoice.nr,'FV2026-S-1');assert.equal(prefixed.invoice.numberPrefix,'FV2026');assert.equal(op.candidate.invoice.numberPrefix,'FV2026');assert.equal(op.candidate.invoice.nr,'INV-1001');f.c.mode='ok';const nextPrefix=await f.c.savePackageConfirmed(f.pair(),f.operation());assert.equal(nextPrefix.invoice.nr,'OTHER-S-2');
 f=fixture();f.c.SETTINGS={company:{invoice_prefix:'CUSTOM'}};f.c.mode='lost';p=f.pair();op=f.operation();await assert.rejects(f.c.savePackageConfirmed(p,op));f.c.SETTINGS.company.invoice_prefix='CHANGED';f.c.mode='ok';const prefixRecovered=await f.c.savePackageConfirmed(p,op);assert.equal(prefixRecovered.invoice.nr,'CUSTOM-S-1');assert.equal(f.data.get('invoiceCounters/owner').last,1);
 for(const invalidPrefix of [' BAD','BAD ','<img>','FV\"2026',"FV'2026",'FV\n2026','FV\u00002026','A'.repeat(41),4]){f=fixture();f.c.SETTINGS={company:{invoice_prefix:invalidPrefix}};await assert.rejects(f.c.savePackageConfirmed(f.pair(),f.operation()),/prefiks faktur/);assert.equal(f.calls.length,0);assert.equal(f.data.size,2);}
 for(const prefix of ['FV/2026','PL-FV','INV-','FV_2026','FV.2026','ŁÓDŹ2026','発票２０２６','A'.repeat(40)]){f=fixture();f.c.SETTINGS={company:{invoice_prefix:prefix}};const safePrefix=await f.c.savePackageConfirmed(f.pair(),f.operation());assert.equal(safePrefix.invoice.nr,prefix+'-S-1');assert.equal(safePrefix.invoice.numberPrefix,prefix);}
 const profile=read('08-client-profile-extras.js');assert.match(profile,/viewInvoice\([^\n]*p\.invoiceDocId\|\|p\.invoiceId/);
 console.log('All confirmed package service and UI VM tests passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
