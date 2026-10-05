// Package side actions must not overwrite a payment confirmed by the paid transaction.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const core=read('01-core.js'),mod09=read('09-posture-kb-invites-private.js');
const slice=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'missing '+start);return src.slice(a,b);};
const helperSrc=slice(core,'function persistPackageFields(','window.persistPackageFields=');
const consumeSrc=slice(core,'function clientPaidPackageForSession(','  const left=Math.max(0,(pkg.sessions||0)-pkg.sessionsUsed);')+'  return pkg;\n}';
const uiSrc=slice(mod09,'function usePackageSession(','function clientUnpaidPackages(')+slice(mod09,'var packagePaidUiStates=','function markPaid(')+slice(mod09,'function requestPayment(','function deletePackage(');

function ctx(){
  const writes=[],notices=[],messages=[];
  const c={console,Promise,Date,Map,Set,JSON,Object,String,Math,writes,notices,messages,
    PACKAGES:[{id:'p1',_fbId:'pkg-doc',trainerId:'owner',clientId:'a',clientName:'Alfa',title:'Pakiet',price:100,sessions:10,sessionsUsed:2,payStatus:'pending',status:'active',invoiceId:'INV-S-1',note:'stara'}],
    SE:[],CL:[{id:'a',name:'Alfa'}],
    persistById:(col,obj)=>{writes.push({col,obj:JSON.parse(JSON.stringify(obj))});return Promise.resolve({...obj,_fbId:obj._fbId||obj.id});},
    notify:m=>notices.push(m),pushMsg:(id,m)=>messages.push(m),paySeller:()=>({bank:'PL00',currency:'zł'}),
    renderPayPackages:()=>{},refreshPaySurfaces:()=>{},escHtml:s=>String(s||''),todayYmd:()=>'2026-10-05',
    document:{querySelectorAll:()=>[]}};
  c.window=c;c.allPackages=()=>c.PACKAGES;
  vm.createContext(c);vm.runInContext(helperSrc+consumeSrc+uiSrc+';this.packagePaidUiStates=packagePaidUiStates;',c);
  return c;
}
const flush=()=>new Promise(r=>setImmediate(r));
let n=0;const ok=m=>{n++;console.log('OK '+m);};

(async()=>{
  // 1. Request payment writes only its own field, never payStatus.
  let c=ctx();
  assert.equal(c.requestPayment('p1'),true);await flush();
  assert.equal(c.writes.length,1);
  const w=c.writes[0].obj;
  assert.equal(c.writes[0].col,'packages');assert.equal(w._fbId,'pkg-doc');assert.ok(w.paymentRequestedAt);
  for(const key of ['payStatus','status','paymentWriteId','price','sessionsUsed','note','title'])assert.ok(!(key in w),'request wrote '+key);
  ok('payment request writes only paymentRequestedAt');

  // 2. Manual session use writes only the counter.
  c=ctx();c.usePackageSession('p1');await flush();
  assert.equal(c.writes.length,1);assert.equal(c.writes[0].obj.sessionsUsed,3);
  for(const key of ['payStatus','status','paymentRequestedAt','price'])assert.ok(!(key in c.writes[0].obj),'session wrote '+key);
  ok('manual session writes only sessionsUsed');

  // 3. Automatic consumption from a paid package writes only the counter.
  c=ctx();c.PACKAGES[0].payStatus='paid';
  const used=c.consumeClientPackageSession('a',{date:'2026-10-05',notify:false});await flush();
  assert.ok(used);assert.equal(c.writes.length,1);assert.deepEqual(Object.keys(c.writes[0].obj).sort(),['_fbId','clientId','id','sessionsUsed','trainerId']);
  ok('Live/sala consumption writes only sessionsUsed');

  // 4. Even an explicit payStatus in the patch is dropped by the helper.
  c=ctx();await c.persistPackageFields(c.PACKAGES[0],{payStatus:'pending',status:'x',paymentWriteId:'y',sessionsUsed:5});
  assert.deepEqual(Object.keys(c.writes[0].obj).sort(),['_fbId','clientId','id','sessionsUsed','trainerId']);
  ok('helper refuses payment fields');

  // 5. While the paid confirmation is pending or failed, side actions are blocked.
  for(const state of [{pending:true,error:null},{pending:false,error:'Brak sieci'}]){
    c=ctx();c.packagePaidUiStates.set('p1',state);
    assert.equal(c.requestPayment('p1'),false);c.usePackageSession('p1');await flush();
    assert.equal(c.writes.length,0);assert.equal(c.messages.length,0);assert.equal(c.PACKAGES[0].sessionsUsed,2);
    assert.ok(c.notices.length>=2);
  }
  ok('pending or unconfirmed payment blocks request and session use');

  // 6. Paid package does not ask the client to pay again.
  c=ctx();c.PACKAGES[0].payStatus='paid';
  assert.equal(c.requestPayment('p1'),false);assert.equal(c.messages.length,0);assert.equal(c.writes.length,0);
  ok('paid package does not send a new payment request');

  console.log('PASS package field writes: '+n+' checks');
})().catch(e=>{console.error(e);process.exit(1);});
