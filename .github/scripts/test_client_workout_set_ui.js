// Ekran serii klienta (dane demo, bez prawdziwych klientów): krótka nazwa, cel + zapas „około 2–3”, jeden przycisk „Zapisz serię”,
// zmiana 15 → 17,5 kg, zapis bez zapasu, podwójne dotknięcie, cofnięcie, przerwa i jej pominięcie, ostatnia seria → następne ćwiczenie,
// powrót do poprzedniego, „Technika” i „Zamień ćwiczenie”, klawiatura, wyniki po odświeżeniu. Szerokości 360 / 390 / 430 px.
'use strict';
const { chromium } = require('playwright');
const fs=require('fs');const out=process.env.CLIENT_SET_SHOT_DIR||require('path').join(require('os').tmpdir(),'pl-client-set');fs.mkdirSync(out,{recursive:true});
const PORT=process.env.LAYOUT_PORT||'8080';
let fails=0;let W=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+W+' px: '+n+(x!==undefined?' — '+JSON.stringify(x):''));if(!c)fails++;};
(async()=>{
  const b=await chromium.launch();
  for(const [w,H] of [[360,740],[390,844],[430,932]]){
  W=w;
  const ctx=await b.newContext({viewport:{width:W,height:H},hasTouch:true,isMobile:true});
  let page;const errs=[];
  const boot=async(clear,tag)=>{page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.dismiss());
   await page.route('https://www.gstatic.com/firebasejs/**',r=>r.abort());
   await page.goto('http://localhost:'+PORT+'/index.html?nocache=cw-set'+tag,{waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
   await page.evaluate(clear=>{document.documentElement.style.setProperty('--cs-sat','47px');document.documentElement.style.setProperty('--cs-sab','34px');
    window._uid='demo-client';window._trainerId='demo-trainer';window._clientId='demo1';window._clientAppMode=true;
    window.tenantSessionGeneration=1;window._tenantDataReady=true;window._db={fixture:'flow'};window.persistById=async(_c,o)=>o;window._notes=[];window.notify=m=>window._notes.push(m);
    if(clear)try{localStorage.clear();}catch(e){}
    const today=todayYmd(),wd=new Date().getDay();
    window.CL=[{id:'demo1',trainerId:'demo-trainer',name:'Klient Demo',status:'active',preferredWeekdays:[wd]}];
    window.PL=[{id:'p1',clientId:'demo1',trainerId:'demo-trainer',name:'Demo',weekKeys:['w1'],currentWeek:'w1',startDate:today,
      days:[{day:'Dzień 1',exercises:[
        {name:'Unoszenie bokiem na maszynie (siedząc, z podparciem klatki)',sets:'3',reps:'10-12',kg:'15',rest:'90s',rir:'2.5',rpe:'7.5',tempo:'3-0-1-0',alt:'Unoszenie bokiem z hantlami, Unoszenie bokiem na wyciągu',note:'PRIORYTET: boczny bark — maszyna stabilizuje tułów. Prowadź łokcie lekko przed tułowiem.'},
        {name:'Wiosłowanie hantlem w podporze',sets:'2',reps:'10',kg:'22',rest:'60s',note:'WAŻNE: bez szarpania, plecy proste.'},
        {name:'Plank',sets:'2',reps:'40',rest:'45s',loadUnit:'sec'}]}]}];
    window.SE=[];window.TASKS=[];window.PACKAGES=[];window.MSGS={demo1:[]};
    window.SETTINGS={profile:{name:'Trener'},brand:{},clientApp:{visibleSections:{}},contact:{}};
    enterClientLiveShell();},clear);
   await page.waitForSelector('.cs-today');await page.click('.cs-today .cs-btn-primary');await page.waitForSelector('.cs-ex');};
  const st=()=>page.evaluate(()=>{const cw=window._cw;return{phase:cw.phase,exIdx:cw.exIdx,sets:cw.exercises.map(e=>e.sets.map(s=>(s.done?'✓':'·')+s.reps+'x'+s.kg+(s.rirReported?'@'+s.rir:'')))};});
  const vis=sel=>page.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return false;const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.height>0;},sel);
  await boot(true,'a');
  const t=await page.evaluate(()=>document.querySelector('.cs-ex').innerText);
  ok('krótka nazwa', /Unoszenie bokiem na maszynie\n/.test(t)&&!/siedząc/.test(t));
  ok('brak PRIORYTET/tempo/RPE/wariantów na ekranie', !/PRIORYTET|Tempo|RPE|warianty/i.test(t));
  ok('cel 10–12 · 15 kg + około 2–3', /10–12 powt\. · 15 kg/.test(t)&&/około 2–3 powtórzeń w zapasie/i.test(t));
  ok('jeden przycisk w stopce', await page.evaluate(()=>document.querySelectorAll('.cs-ex-foot button').length)===1);
  for(const s of ['.cs-set-grid','[data-cs-primary="save"]','.cs-tech-btn','.cs-rir-opts']) ok('widoczne bez przewijania: '+s, await vis(s));
  // ? zapasu
  await page.click('.cs-q');ok('„?” pokazuje wyjaśnienie', await page.isVisible('#cs-rir-help'));await page.click('.cs-q');
  // Technika
  await page.click('.cs-tech-btn');const tech=await page.evaluate(()=>document.querySelector('.cs-sheet').innerText);
  ok('Technika: pełna nazwa, tempo, priorytet, bez RPE', /siedząc/.test(tech)&&/opuszczanie 3 s/.test(tech)&&/Priorytet w planie: boczny bark/.test(tech)&&!/RPE/.test(tech), tech.slice(0,200));
  await page.screenshot({path:`${out}/${W}-technika.png`});
  await page.click('.cs-sheet .cs-btn-secondary');
  // 1. 15 → 17,5 (przycisk +), 10 powt., zapis bez zapasu
  await page.click('.cs-step:last-child');
  const kgv=await page.inputValue('.cs-kg-row input');ok('+ zmienia 15 → 17,5', kgv==='17,5', kgv);
  await page.fill('.cs-set-grid input >> nth=0','10');
  await page.screenshot({path:`${out}/${W}-1-wpisane.png`});
  await page.tap('[data-cs-primary="save"]');await page.waitForTimeout(100);
  let s1=await st();ok('zapis 17,5 × 10 bez zapasu (raz)', s1.sets[0][0]==='✓10x17.5'&&s1.sets[0][1].startsWith('·'), s1.sets[0]);
  ok('ciężar przeszedł na następną serię', s1.sets[0][1]==='·10x17.5', s1.sets[0][1]);
  ok('przerwa po zapisie', s1.phase==='rest');
  const rest=await page.evaluate(()=>document.querySelector('.cs-rest-scr').innerText);
  ok('przerwa: licznik + następna seria z parametrami', /1:30/.test(rest)&&/Seria 2 z 3 · 10–12 powt\. · 17,5 kg/.test(rest), rest);
  ok('przerwa: „Cofnij” i „Pomiń przerwę” na dole', await vis('.cs-ex-foot .cs-saved-undo')&&await vis('.cs-ex-foot .cs-rest-skip'));
  await page.screenshot({path:`${out}/${W}-2-przerwa.png`});
  // cofnięcie
  await page.click('.cs-saved-undo');await page.waitForTimeout(100);
  s1=await st();ok('cofnięcie zapisu', s1.phase==='exercise'&&s1.sets[0][0].startsWith('·'), s1.sets[0]);
  // podwójne dotknięcie zapisu
  await page.dblclick('[data-cs-primary="save"]');await page.waitForTimeout(150);
  s1=await st();ok('podwójne dotknięcie = jedna seria', s1.sets[0].filter(x=>x[0]==='✓').length===1&&s1.phase==='rest', s1);
  await page.waitForTimeout(750);
  await page.click('.cs-rest-skip');await page.waitForTimeout(100);
  s1=await st();ok('pominięcie przerwy', s1.phase==='exercise');
  // seria 2 z zapasem 2
  await page.waitForTimeout(750);await page.click('.cs-rir-opts [data-rir="2"]');await page.click('[data-cs-primary="save"]');await page.waitForTimeout(750);await page.click('.cs-rest-skip');await page.waitForTimeout(750);
  s1=await st();ok('seria 2 z zapasem 2', s1.sets[0][1]==='✓10x17.5@2', s1.sets[0]);
  await page.waitForTimeout(750);
  // ostatnia seria: podwójne dotknięcie nie przeskakuje
  await page.dblclick('[data-cs-primary="save"]');await page.waitForTimeout(200);
  s1=await st();ok('ostatnia seria: zostaje na „Ćwiczenie ukończone”', s1.exIdx===0&&s1.sets[0].every(x=>x[0]==='✓'), s1);
  const nb=await page.innerText('[data-cs-primary]');ok('jednoznaczne przejście', /^Następne ćwiczenie: Wiosłowanie hantlem w podporze →$/.test(nb), nb);
  await page.screenshot({path:`${out}/${W}-3-ukonczone.png`});
  await page.waitForTimeout(750);await page.click('[data-cs-primary="next"]');await page.waitForTimeout(100);
  s1=await st();ok('przejście do ćwiczenia 2', s1.exIdx===1);
  const t2=await page.evaluate(()=>document.querySelector('.cs-ex').innerText);ok('ważna uwaga trenera widoczna', /Uwaga trenera: bez szarpania/.test(t2));
  // powrót do poprzedniego (menu)
  await page.click('.cs-more-btn');const menu=await page.evaluate(()=>document.querySelector('.cs-sheet').innerText);
  ok('menu: poprzednie, pomiń osobno', /Poprzednie ćwiczenie/.test(menu)&&/Pomiń ćwiczenie/.test(menu), menu);
  await page.click('text=← Poprzednie ćwiczenie');await page.waitForTimeout(100);
  s1=await st();ok('powrót do ćwiczenia 1 z zapisanymi wynikami', s1.exIdx===0&&s1.sets[0].every(x=>x[0]==='✓'));
  // Zamień ćwiczenie w menu
  await page.click('.cs-more-btn');ok('menu: Zamień ćwiczenie (warianty od trenera)', await page.isVisible('text=Zamień ćwiczenie'));
  await page.click('text=Zamień ćwiczenie');const sw=await page.evaluate(()=>document.querySelector('.cs-sheet').innerText);ok('lista wariantów', /z hantlami/.test(sw)&&/na wyciągu/.test(sw));
  await page.click('.cs-sheet-x');
  // klawiatura: ćw. 2, fokus na powtórzeniach, ekran 55% wysokości
  await page.click('.cs-more-btn');await page.click('text=Lista ćwiczeń');await page.click('.cs-ov-row >> nth=1');
  await page.focus('.cs-set-grid input >> nth=0');
  await page.evaluate(h=>{const p=document.getElementById('clive-player');p.classList.add('cw-kb');p.style.setProperty('--cw-vvh',h+'px');},Math.round(H*0.55));
  await page.waitForTimeout(500);
  const kb=await page.evaluate(()=>{const a=document.activeElement.getBoundingClientRect();const p=document.querySelector('[data-cs-primary]').getBoundingClientRect();return{field:[a.top|0,a.bottom|0],save:[p.top|0,p.bottom|0]};});
  const lim=Math.round(H*0.55);ok('klawiatura: pole i „Zapisz” w widocznej części', kb.field[0]>=0&&kb.field[1]<=lim&&kb.save[1]<=lim+1, {kb,lim});
  await page.screenshot({path:`${out}/${W}-4-klawiatura.png`});
  await page.evaluate(()=>{const p=document.getElementById('clive-player');p.classList.remove('cw-kb');p.style.removeProperty('--cw-vvh');document.activeElement.blur();});
  // odświeżenie
  const before=await st();await page.close();await boot(false,'b');
  const after=await st();ok('wyniki po odświeżeniu', JSON.stringify(after.sets)===JSON.stringify(before.sets), after.sets[0]);
  ok('brak błędów JS', !errs.length, errs);
  await ctx.close();
  }
  console.log(fails?`\n${fails} niezaliczone`:'\nwszystko zaliczone');
  await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
