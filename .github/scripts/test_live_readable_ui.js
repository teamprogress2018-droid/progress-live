'use strict';
// Browser layout gate: run against local server, with Chromium installed.
const {chromium}=require('playwright');
const assert=require('assert');
const fs=require('fs'),path=require('path'),os=require('os');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const shots=process.env.LIVE_READABLE_SHOT_DIR||path.join(os.tmpdir(),'live-readable');
 fs.mkdirSync(shots,{recursive:true});
 try{
  const page=await browser.newPage();
  for(const [width,height] of [[1366,768],[1024,768],[390,844]]){
   await page.setViewportSize({width,height});
   await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
   await page.goto('http://127.0.0.1:'+(process.env.LAYOUT_PORT||8080)+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof renderLiveExercises==='function');
   await page.evaluate(()=>{
    // Signed-in tenant fixture; no production Firebase connection.
    window._uid = 'ui-trainer';
    window._clientAppMode = false;
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._db = { fixture: true };
    window.persistById=async(_c,o)=>o;window.notify=()=>{};
    const auth=document.getElementById('auth-screen');if(auth)auth.style.display='none';
    const app=document.getElementById('app-root');if(app)app.style.display='';
    const loading=document.getElementById('app-loading');if(loading)loading.style.display='none';
    window.CL=[{id:'readable',trainerId:window._uid,name:'Klient testowy'}];window.SE=[];
    window.PL=[{id:'readable-plan',trainerId:window._uid,clientId:'readable',name:'Plan testowy',days:Array.from({length:4},(_,i)=>({day:'Dzień '+(i+1),exercises:[]}))}];
    goTo('live');liveClientSetField('readable','Klient testowy',true,0);
    window.livePlanId='readable-plan';window.liveSessionActive=false;window.liveCurrentDayIdx=0;
    window.liveExercises=[4,2,6].map((count,i)=>({name:'Wyciskanie na maszynie — pełna nazwa ćwiczenia '+i,reps:'8–12',rir:'2',restSec:90,note:'Kontroluj ruch',done:false,sets:Array.from({length:count},(_,si)=>({setNo:si+1,kg:'40',reps:'10',rir:'',done:false}))}));
    renderLiveClientCard(0);renderLivePlanPicker(0);renderLiveExercises(0);
   });
   const first=page.locator('#live-ex-0');
   assert.equal(await page.locator('.live-prep-board').first().getAttribute('open'),null);
   const row=await first.locator('.live-set-row').first().boundingBox();
   assert(row&&row.y>=0&&row.y+row.height<=height,`first set visible at ${width}`);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   assert(!overflow,`no horizontal page overflow at ${width}`);
   assert.equal(await first.locator('.live-rir-input').first().inputValue(),'');
   assert((await first.locator('.live-rir-target').innerText()).includes('Cel RIR 2'));
   assert((await first.locator('.live-ex-collapsed-meta').innerText()).includes('przerwa'));
   assert(!(await first.locator('.live-swap-open').isVisible()),'secondary actions initially hidden');
   assert(await first.locator('.live-ex-todo').isVisible(),'todo visible without opening details');
   assert.equal(await first.locator('.live-ex-note').inputValue(),'Kontroluj ruch');
   await first.locator('.live-ex-actions-menu summary').click();
   assert(await first.locator('.live-swap-open').isVisible());
   await first.locator('.live-ex-actions-menu summary').click();
   await first.locator('.live-ex-details summary').click();
   await page.screenshot({path:path.join(shots,`live-ready-${width}.png`),fullPage:true});
   await page.evaluate(()=>{window.liveSessionActive=true;renderLiveExercises(0);});
   assert.equal(await first.locator('[aria-current="step"]').count(),1);
   await first.locator('.live-rir-input').first().fill('1');
   await first.locator('.live-set-check').first().click();
   assert.equal(await first.locator('.live-rir-input').first().inputValue(),'1');
   assert.equal(await first.locator('.live-set-row').nth(1).getAttribute('aria-current'),'step');
   const kg=first.locator('.live-set-row input').first();
   await kg.fill('55');
   assert.equal(await kg.inputValue(),'55');
   assert(await kg.evaluate(el=>el===document.activeElement),'typing keeps focus');
   await page.locator('#live-ex-1 .live-expand-btn').click();
   assert(await page.locator('#live-ex-1 .live-set-row').first().isVisible(),'next exercise can be opened during training');
   await page.screenshot({path:path.join(shots,`live-active-${width}.png`),fullPage:true});
  }
  console.log('Live readable viewport checks passed; screenshots: '+shots);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
