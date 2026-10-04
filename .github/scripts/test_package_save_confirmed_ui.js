// Real DOM and real package service, with in-memory atomic transactions only.
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:process.env.LAYOUT_HEADED!=='1'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Europe/Warsaw'});page.setDefaultTimeout(20000);
  let liveRequests=0;await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());
  await page.route('**://firestore.googleapis.com/**',r=>{liveRequests++;return r.abort();});
  await page.goto('http://'+(process.env.LAYOUT_HOST||'127.0.0.1')+':'+(process.env.LAYOUT_PORT||'8080')+'/index.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof savePackageConfirmed==='function'&&typeof clearPackageSaveDrafts==='function');
  await page.evaluate(()=>{
   const clone=v=>JSON.parse(JSON.stringify(v));
   const f=window._packageUi={data:{},pending:[],transactions:[],notices:[],resume:[],unexpected:[],mode:'defer'};
   for(const method of ['persistById','_setDoc','requestPayment','pushMsg'])window[method]=()=>{f.unexpected.push(method);throw Error('Unexpected action '+method);};
   window._db={fixture:true};window._doc=(_db,col,id)=>({col,id});window._col=(_db,col)=>col;
   window._where=(key,_op,value)=>({key,value});window._query=(col,...filters)=>({col,filters});
   window._getDocsFromServer=async q=>({docs:Object.entries(f.data).filter(([key,v])=>key.startsWith(q.col+'/')&&q.filters.every(x=>v[x.key]===x.value)).map(([key,v])=>({id:key.split('/')[1],data:()=>clone(v)}))});
   window._runTransaction=async(_db,fn)=>{
    const writes=[];f.transactions.push(writes);
    const result=await fn({get:async ref=>{const value=f.data[ref.col+'/'+ref.id];return {exists:()=>!!value,data:()=>clone(value)};},set:(ref,value)=>writes.push([ref.col+'/'+ref.id,clone(value)])});
    if(!writes.length)return result;
    if(f.mode==='fail')throw Error('Fixture offline');
    if(f.mode==='defer')await new Promise((resolve,reject)=>f.pending.push({resolve,reject}));
    writes.forEach(([key,value])=>f.data[key]=value);
    if(f.mode==='lost')throw Error('Fixture lost ACK');return result;
   };
   window.notify=m=>f.notices.push(m);window.confirm=()=>false;window.maybeResumeOnboard=id=>f.resume.push(id);
   window.renderPayOverview=()=>{};window.renderPayPackages=()=>{};window.renderPayInvoices=()=>{};window.renderClients=()=>{};window.renderDash=()=>{};
   ['auth-screen','app-loading'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});document.getElementById('app-root').style.display='';
  });
  const reset=()=>page.evaluate(()=>{
   clearPackageSaveDrafts();document.querySelectorAll('.modal-ov.show').forEach(el=>el.classList.remove('show'));
   window._uid='package-fixture';window.tenantSessionGeneration=(window.tenantSessionGeneration||0)+1;
   window._tenantDataReady=true;window._clientAppMode=false;window._clientPreviewMode=false;window._onboardResumeAfterPackage=null;
   window.CL=[{id:'pkg-a',_fbId:'owned-a',trainerId:_uid,name:'Klient Alfa',status:'active'},{id:'pkg-b',trainerId:_uid,name:'Klient Beta',status:'active'}];
   window.PACKAGES=[];window.INVOICES=[];const f=_packageUi;f.data={'clients/owned-a':{...CL[0]},'clients/pkg-b':{...CL[1]}};f.pending=[];f.transactions=[];f.notices=[];f.resume=[];f.mode='defer';
  });
  const open=(id='pkg-a')=>page.evaluate(id=>openPackageForClient(id),id);
  const fill=async()=>{await page.locator('#pkg-title').fill('Pakiet potwierdzony');await page.locator('#pkg-price').fill('100.50');await page.locator('#pkg-sessions').fill('10');await page.locator('#pkg-validity').fill('90');await page.locator('#pkg-pay-status').selectOption('paid');};
  const state=()=>page.evaluate(()=>({packages:PACKAGES,invoices:INVOICES,pending:_packageUi.pending.length,notices:_packageUi.notices,resume:_packageUi.resume,writes:_packageUi.transactions.map(x=>x.length),unexpected:_packageUi.unexpected,shown:document.getElementById('m-package').classList.contains('show'),status:document.getElementById('pkg-save-status').textContent,access:typeof clientHasPackage==='function'?clientHasPackage(CL[0]):PACKAGES.length>0}));
  const start=async()=>{await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>_packageUi.pending.length===1);};
  const release=()=>page.evaluate(()=>_packageUi.pending.shift().resolve());
  await reset();await open();assert.equal(await page.locator('#pkg-pay-status').inputValue(),'pending');await fill();await start();await page.evaluate(()=>savePackage());let s=await state();assert.equal(s.pending,1);assert.equal(s.packages.length,0);assert.equal(s.invoices.length,0);assert.equal(s.access,false);assert.equal(s.resume.length,0);assert.equal(s.notices.length,0);assert.deepEqual(s.writes,[2]);assert.equal(await page.locator('#pkg-save-btn').isDisabled(),true);assert.equal(await page.locator('#pkg-price').isDisabled(),true);
  await release();await page.waitForFunction(()=>!document.getElementById('m-package').classList.contains('show'));s=await state();assert.equal(s.packages[0].price,100.5);assert.equal(s.invoices[0].amount,100.5);assert.equal(s.packages[0].invoiceDocId,s.invoices[0].id);assert.equal(s.packages[0].invoiceId,s.invoices[0].nr);assert.equal(s.resume[0],'pkg-a');assert.equal(s.notices.length,1);
  await reset();await open();await fill();await page.evaluate(()=>_packageUi.mode='fail');await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>document.getElementById('pkg-save-status').textContent.includes('Fixture offline'));const before=await page.evaluate(()=>packageSaveActive.operation.candidate);s=await state();assert.equal(s.packages.length,0);assert.equal(s.shown,true);assert.equal(s.resume.length,0);assert.equal(await page.locator('#pkg-price').inputValue(),'100.50');
  await page.evaluate(()=>closePackageModal());await open();assert.equal(await page.locator('#pkg-title').inputValue(),'Pakiet potwierdzony');await page.evaluate(()=>_packageUi.mode='ok');await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>PACKAGES.length===1);s=await state();assert.equal(s.packages[0].id,before.pkg.id);assert.equal(s.invoices[0].id,before.invoice.id);
  await reset();await open();await fill();await page.evaluate(()=>_packageUi.mode='lost');await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>document.getElementById('pkg-save-status').textContent.includes('lost ACK'));
  await page.evaluate(()=>{const pkg=Object.values(_packageUi.data).find(v=>v.packageCreateId&&v.sessions);pkg.sessionsUsed=4;pkg.payStatus='partial';_packageUi.mode='ok';});await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>PACKAGES.length===1);s=await state();assert.equal(s.packages[0].sessionsUsed,4);assert.equal(s.packages[0].payStatus,'partial');assert.equal(s.writes.filter(x=>x).length,1);
  for(const id of ['pkg-b','pkg-a']){await reset();await open();await fill();await start();await page.evaluate(()=>closePackageModal());await open(id);const resumeBefore=(await state()).resume.length;await release();await page.waitForFunction(()=>_packageUi.pending.length===0&&!packageSaveDrafts.get('pkg-a').pending);s=await state();assert.equal(s.shown,true);assert.equal(s.packages.length,0);assert.equal(s.resume.length,resumeBefore);assert.equal(s.notices.length,0);if(id==='pkg-a'){assert.equal(await page.locator('#pkg-save-btn').isDisabled(),false);await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>PACKAGES.length===1);}}
  await reset();await open('pkg-b');await fill();await page.evaluate(()=>_packageUi.mode='fail');await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>!!packageSaveActive.error);const failedId=await page.evaluate(()=>packageSaveActive.pair.pkg.id);await page.evaluate(()=>closePackageModal());await open('pkg-a');await page.locator('#pkg-client').selectOption('pkg-b');assert.equal(await page.locator('#pkg-title').inputValue(),'Pakiet potwierdzony');await page.evaluate(()=>_packageUi.mode='ok');await page.locator('#pkg-save-btn').click();await page.waitForFunction(()=>PACKAGES.length===1);assert.equal((await state()).packages[0].id,failedId);
  await reset();await open();await fill();await page.locator('#pkg-price').fill('-1');await page.locator('#pkg-save-btn').click();s=await state();assert.equal(s.writes.length,0);assert.equal(s.packages.length,0);assert.equal(s.shown,true);
  await reset();await open();await fill();await start();await page.evaluate(()=>{tenantSessionGeneration++;clearPackageSaveDrafts();});await release();await page.waitForTimeout(50);s=await state();assert.equal(s.packages.length,0);assert.equal(s.notices.length,0);assert.equal(s.resume.length,0);
  assert.deepEqual(s.unexpected,[]);assert.equal(liveRequests,0);console.log('All confirmed package DOM tests passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
