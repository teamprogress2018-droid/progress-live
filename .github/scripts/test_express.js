// Progress Express (express.js): warianty skrócony/express tylko wg reguły trenera, super-serie w całości,
// wariant w zapisie treningu (planSnapshot.variant), opis dla trenera, punkty zaczepienia.
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('express.js','utf8');
const js=fs.readFileSync('client-simple.js','utf8');const app=fs.readFileSync('10-client-app.js','utf8');
const tr=fs.readFileSync('05-clients-builder-plans-calendar.js','utf8');const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};
const ctx={window:{},document:{getElementById:()=>null,querySelectorAll:()=>[]},console};
ctx.window.parsePlanExercise=r=>r;ctx.window.parseRestSeconds=r=>parseInt(r,10)||0;
ctx.parsePlanExercise=ctx.window.parsePlanExercise;ctx.parseRestSeconds=ctx.window.parseRestSeconds;
ctx.cwPlanSnapshot=ex=>ex.map(e=>({name:e.name,sets:e.sets}));
vm.createContext(ctx);vm.runInContext(src,ctx);
const W=ctx.window;

const day={exercises:[{name:'Przysiad',sets:'4',rest:'120'},{name:'Wyciskanie',sets:'4',rest:'90'},{name:'Wiosłowanie A',sets:'3',rest:'60',ss:'A'},{name:'Pompki A',sets:'3',rest:'60',ss:'A'},{name:'Plank',sets:'3',rest:'45'},{name:'Łydki',sets:'3',rest:'45'}]};
const off={id:'c1'};const on={id:'c1',express:{on:true,short:{ex:3,sets:0},express:{ex:2,sets:2}}};
ok('domyślnie wyłączone', W.xpCfg(off).on===false&&W.xpCfg(off).express.ex===2&&W.xpCfg(off).express.sets===2&&W.xpCfg(off).short.ex===4);
ok('granice konfiguracji', W.xpCfg({express:{on:true,short:{ex:99,sets:-3},express:{ex:0,sets:9}}}).short.ex===8&&W.xpCfg({express:{short:{ex:99,sets:-3},express:{ex:0,sets:9}}}).express.ex===1);
ok('super-seria nie jest rozcinana', W.xpCount(day.exercises,3)===4&&W.xpCount(day.exercises,2)===2&&W.xpCount(day.exercises,4)===4);
const s=W.xpVariantForDay(day,on,'short');
ok('skrócony: pierwsze 3 → 4 (cała super-seria), pełne serie', s.items.map(i=>i.name).join('|')==='Przysiad|Wyciskanie|Wiosłowanie A|Pompki A'&&s.items[0].sets===4&&s.omitted.join('|')==='Plank|Łydki',s);
const e=W.xpVariantForDay(day,on,'express');
ok('express: 2 ćwiczenia × maks. 2 serie, krótszy od skróconego', e.items.length===2&&e.items.every(i=>i.sets===2)&&e.estMin<s.estMin&&e.estMin>=5,e);
const f=W.xpVariantForDay(day,on,'full');
ok('pełny: wszystko', f.items.length===6&&f.omitted.length===0&&f.estMin>s.estMin);
ok('wariant przydatny tylko, gdy coś skraca', W.xpUseful(e,f)&&!W.xpUseful(W.xpVariantForDay({exercises:[{name:'X',sets:'2',rest:'60'}]},on,'express'),W.xpVariantForDay({exercises:[{name:'X',sets:'2',rest:'60'}]},on,'full')));

// zastosowanie do treningu
const mk=()=>({planId:'p1',dayIdx:0,exIdx:0,exercises:day.exercises.map(x=>({name:x.name,ss:x.ss||'',restSec:Number(x.rest),sets:[{kind:'warmup',setNo:0},...Array.from({length:Number(x.sets)},(_,i)=>({setNo:i+1,kind:'work'}))]}))});
let cw=mk();
ok('bez zgody trenera nic się nie zmienia', W.xpApply(cw,off,'express')===false&&cw.exercises.length===6&&!cw.variant);
cw=mk();
ok('express: zastosowany przed pierwszym zapisem', W.xpApply(cw,on,'express')===true&&cw.exercises.length===2&&cw.exercises[0].sets.length===3&&cw.exercises[0].sets[0].kind==='warmup',cw.exercises[0].sets);
ok('wariant w treningu: rodzaj, czas, pominięte, limit serii', cw.variant.kind==='express'&&cw.variant.label==='Progress Express'&&cw.variant.omitted.length===4&&cw.variant.setsCap===2&&cw.variant.kept===2&&cw.variant.estMin>0&&cw.planSnapshot.length===2);
ok('nie dwa razy / nie po starcie', W.xpApply(cw,on,'short')===false&&W.xpApply({...mk(),began:true},on,'express')===false);
cw=mk();W._xpPending={planId:'p1',dayIdx:0,kind:'short'};W._clientId='c1';W.CL=[on];ctx.CL=W.CL;
ok('wybór z „Dzisiaj” trafia do treningu (raz)', W.xpApplyPending(cw)===true&&cw.variant.kind==='short'&&W._xpPending===null&&cw.exercises.length===4);
cw=mk();W._xpPending={planId:'p2',dayIdx:0,kind:'short'};
ok('inny plan/dzień → bez zmian', W.xpApplyPending(cw)===false&&cw.exercises.length===6);
const sum=W.xpSummary({kind:'express',label:'Progress Express',estMin:15,setsCap:2,omitted:['Plank','Łydki']});
ok('opis dla trenera', sum==='Progress Express (ok. 15 min) · maks. 2 serie na ćwiczenie · pominięte zgodnie z ustaleniem trenera: Plank, Łydki',sum);
ok('pełny trening bez opisu', W.xpSummary({kind:'full'})===''&&W.xpSummary(null)==='');

// zaczepienia
ok('cwStartFlow: wariant przed readiness i powitaniem', /if\(fresh&&typeof xpApplyPending==='function'\)xpApplyPending\(cw\);\s*if\(fresh&&typeof cwReadyAttach/.test(js));
ok('„Dzisiaj”: link tylko z xpTodayHTML', /\$\{typeof xpTodayHTML==='function'\?xpTodayHTML\(c,st\):''\}/.test(js));
ok('zapis treningu: planSnapshot.variant', /\.\.\.\(cw\.variant\?\{variant:cw\.variant\}:\{\}\)/.test(app));
ok('wiadomość „Zrobiłem trening”: „Wariant: …”', /'Wariant: '\+xpSummary\(cw\.variant\)/.test(js));
ok('okno treningu trenera: wariant', /data-recorded-variant/.test(tr));
ok('karta trenera pod rozgrzewką (renderCPPlan)', /window\.renderCPPlan=wrapped/.test(src)&&/insertAdjacentHTML\('afterend',xpCardHTML\(c\)\)/.test(src));
ok('skrypt po warmup.js', /<script src="warmup\.js\?v=1"><\/script>\s*<script src="express\.js\?v=\d+"><\/script>/.test(html));
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Express (logika): OK');
