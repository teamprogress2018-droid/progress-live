'use strict';
// Isolated browser fixture: no Firebase login or real client data is used.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{
    let data=fs.readFileSync(file);
    if(relative==='index.html')data=Buffer.from(data.toString().replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/<script[^>]*src="https?:[^>]*><\/script>/g,''));
    res.setHeader('Content-Type',relative.endsWith('.js')?'text/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
  }catch(e){res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.GWB_BROWSER?{executablePath:process.env.GWB_BROWSER}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:1000},serviceWorkers:'block'});
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load'});
    await page.waitForFunction(()=>typeof gwbAdapt==='function');
    await page.evaluate(()=>{
      document.getElementById('auth-screen').style.display='none';
      document.getElementById('app-root').style.display='';
      document.getElementById('app-loading')?.remove();
      document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
      document.getElementById('screen-apl')?.classList.add('active');
      const result=document.getElementById('apl-result');
      for(let el=result;el;el=el.parentElement){el.style.display='block';el.hidden=false;}
      window._uid='test-trainer';window._clientAppMode=false;window.SETTINGS={};window._aplAmateurIntake=null;
      window.CL=[{id:'test-client',name:'Klient testowy',trainerId:'test-trainer'}];
      document.getElementById('apl-client').innerHTML='<option value="test-client">Klient testowy</option>';
      window._gwbWrites=[];window._gwbAttemptIds=[];window.persistById=async(c,p)=>{window._gwbAttemptIds.push(p.id);if(window._gwbFailNext){window._gwbFailNext=false;return null;}window._gwbWrites.push(JSON.parse(JSON.stringify(p)));return p;};
      window.persistSettingsDoc=async()=>true;
      window.maybeSchedulePlanToCalendar=()=>{};window.addNotification=()=>{};window.maybeResumeOnboard=()=>{};
      window.aplLastPlan={planName:'Plan testowy',method:'FBW',daysPerWeek:2,weeks:2,sessionDuration:45,weekKeys:['w1','w2'],currentWeek:'w2',phases:{w1:'Baza',w2:'Baza'},days:[{dayName:'A',focus:'Klatka',exercises:[{name:'Wyciskanie sztangi leżąc',cat:'Klatka piersiowa',sets:'3',reps:'8-10',kg:'80',rir:'2',rest:'90s',w1:{s:'3',r:'8-10',kg:'80',rir:'2'},w2:{s:'3',r:'8-10',kg:'85',rir:'2'}}]},{dayName:'B',focus:'Nogi',exercises:[{name:'Przysiad ze sztangą',cat:'Nogi',sets:'3',reps:'8-10',kg:'60',rir:'2',rest:'90s'}]}]};
      aplLastClient=window.CL[0];
      window.exerciseProgressClass=()=>({});window.recommendExerciseProgress=()=>({action:'DODAJ CIĘŻAR',confidence:'high',reasons:['Potwierdzone wyniki testowe'],facts:{lastKg:80,avgReps:10}});
      aplRerenderCurrent();
    });
    await page.getByRole('button',{name:'Dopasuj do wyników',exact:true}).click();
    await page.getByRole('button',{name:'Zatwierdź propozycję',exact:true}).click();
    assert.equal(await page.evaluate(()=>aplLastPlan.days[0].exercises[0].w2.kg),'82.5');
    assert.equal(await page.evaluate(()=>window._gwbWrites.length),0);
    await page.evaluate(()=>{window._gwbFailNext=true;});
    await page.locator('#apl-save-btn').click();
    assert.equal(await page.evaluate(()=>window._gwbWrites.length),0,'failed write not recorded as saved');
    await page.locator('#apl-save-btn').click();
    await page.waitForFunction(()=>window._gwbWrites.length===1);
    assert.equal(await page.evaluate(()=>_gwbAttemptIds[0]===_gwbAttemptIds[1]),true,'retry reuses plan ID');
    await page.locator('#apl-save-btn').click();
    assert.equal(await page.evaluate(()=>window._gwbWrites.length),1,'double-save remains idempotent');
    await page.getByRole('button',{name:'Historia wersji',exact:true}).click();
    assert.ok(await page.getByRole('button',{name:'Podgląd przywrócenia',exact:true}).count()>=1);
    await page.getByRole('button',{name:'Podgląd przywrócenia',exact:true}).first().click();
    await page.getByRole('button',{name:'Zatwierdź propozycję',exact:true}).click();
    assert.equal(await page.evaluate(()=>aplLastPlan.days[0].exercises[0].w2.kg),'85');
    await page.getByRole('button',{name:'Wariant awaryjny',exact:true}).click();
    await page.locator('#gwb-minutes').fill('25');await page.locator('#gwb-skip').selectOption('1');
    await page.getByRole('button',{name:'Pokaż wariant',exact:true}).click();
    await page.getByRole('button',{name:'Zatwierdź propozycję',exact:true}).click();
    assert.equal(await page.evaluate(()=>aplLastPlan.days.length),1);
    await page.locator('#apl-save-btn').click();
    await page.waitForFunction(()=>window._gwbWrites.length===2);
    assert.notEqual(await page.evaluate(()=>_gwbWrites[0].id),await page.evaluate(()=>_gwbWrites[1].id),'emergency is a separate plan');
    assert.equal(await page.evaluate(()=>_gwbWrites[1].duration),1);
    await page.locator('#gwb-controls > summary').click();
    await page.locator('#gwb-rules summary').click();
    await page.locator('#gwb-maxIncreasePct').fill('4');
    await page.getByRole('button',{name:'Zapisz zasady',exact:true}).click();
    assert.equal(await page.evaluate(()=>SETTINGS.generatorRules.maxIncreasePct),4);
    await page.locator('#gwb-saved-plan').selectOption(await page.evaluate(()=>_gwbWrites[0].id));
    await page.getByRole('button',{name:'Otwórz kopię do rozwoju',exact:true}).click();
    assert.equal(await page.evaluate(()=>aplLastPlan.sourcePlanId),await page.evaluate(()=>_gwbWrites[0].id));
    assert.equal(await page.evaluate(()=>aplLastPlan.days.length),2,'original plan untouched by emergency');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#gwb-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'workbench fits mobile');
    console.log('Generator UI: propose → approve → save → retry → restore → emergency → separate save OK');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
