// Live SUGESTIA: konkretny ciężar i powód obok etykiety (ETAP 2 — „skąd ta liczba?”).
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const live=read('02-workouts-onboarding-templates-live.js'),core=read('01-core.js');
const slice=(src,start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'missing '+start);return src.slice(a,b);};
const c={console,Number,String,Math,Object};c.window=c;
vm.createContext(c);
vm.runInContext(slice(core,'function progressLoadStep(','window.progressLoadStep=')+
  slice(live,'function liveExFormatKgDelta(','window.liveExFormatKgDelta=')+
  slice(live,'function liveExSuggestView(','window.liveExSuggestView=')+
  slice(live,'function liveExSuggestDetail(','window.liveExSuggestDetail=')+
  slice(live,'function liveExReasonGate(','\n}')+'\n}\n'+
  'this.view=liveExSuggestView;this.detail=liveExSuggestDetail;this.gate=liveExReasonGate;',c);
let n=0;const ok=m=>{n++;console.log('OK '+m);};
const bench={name:'Wyciskanie sztangi'},db={name:'Wyciskanie hantli'};
const rec=(action,load,reps,facts,reason)=>({action,levers:{load,reps,dose:'hold'},facts:Object.assign({lastKg:80,lastReps:10,lastRir:2,rirKnown:true},facts||{}),reasons:[reason||'']});

let d=c.detail(rec('DODAJ CIĘŻAR','up','hold'),bench);
assert.equal(d.detail,'→ 82,5 kg');assert.match(d.why,/górny zakres \(10 powt\.\) przy RIR 2/);ok('DODAJ shows next kg and why');
assert.equal(c.detail(rec('DODAJ CIĘŻAR','up','hold'),db).detail,'→ 81 kg');ok('dumbbell step 1 kg');

d=c.detail(rec('DODAJ POWTÓRZENIA','hold','up',{lastReps:9}),bench);
assert.equal(c.view(rec('DODAJ POWTÓRZENIA','hold','up'),80).label,'= UTRZYMAJ');
assert.equal(d.detail,'80 kg · spróbuj dodać powtórzenie');assert.match(d.why,/RIR 2 — najpierw powtórzenia/);ok('UTRZYMAJ 80 kg + more reps (double progression)');

d=c.detail(rec('UTRZYMAJ','hold','hold',{},'ostatnio poszedł ciężar — najpierw potwierdź nowy kg'),bench);
assert.equal(d.detail,'80 kg');assert.equal(d.why,'ciężar świeżo podniesiony — najpierw go utrwal');ok('UTRZYMAJ names kg and friendly reason');

d=c.detail(rec('ZMNIEJSZ OBCIĄŻENIE','down','hold',{lastRir:0}),bench);
assert.equal(d.detail,'→ 77,5 kg');assert.match(d.why,/RIR 0/);ok('ZMNIEJSZ shows lower kg');

d=c.detail(null,bench);assert.equal(d.detail,'');assert.match(d.why,/min\. 2 porównywalne treningi/);ok('ZA MAŁO DANYCH explains what is missing');

// Every mapped gate matches the real 7B reason text, so a reworded reason fails here, not silently in the UI.
const reasons={};const re=/(D\d+):'([^']+)'/g;let m;const src=slice(core,'function recommendExerciseProgress(','window.recommendExerciseProgress=');
while((m=re.exec(src)))reasons[m[1]]=m[2];
for(const g of ['D2','D4','D6','D7','D8','D9','D10','D11','D12','D14','D17','D18'])assert.equal(c.gate(reasons[g]),g,'gate '+g);
for(const g of ['D0','D1','D3','D5','D13','D15','D16'])assert.equal(c.gate(reasons[g]),'','unexpected gate '+g);
ok('reason mapping matches 7B texts');

const todaySrc=slice(live,'function liveExTodayLine(','window.liveExTodayLine=');
const t={String,liveExTodayKg:e=>e.kg,liveExPlannedReps:e=>e.reps,exLoadUnit:()=>'kg',loadUnitSuffix:()=>'kg'};vm.createContext(t);vm.runInContext(todaySrc+'this.f=liveExTodayLine;',t);
assert.equal(t.f({kg:80,reps:'8-12'}),'80 kg · zakres 8–12 powt.');assert.equal(t.f({kg:100,reps:'5'}),'100 kg · 5 powt.');assert.equal(t.f({kg:20,reps:'AMRAP'}),'20 kg · AMRAP');
ok('DZISIAJ: range vs single reps');
const strip=slice(live,'function liveExCueStripHtml(','window.liveExCueStripHtml=');
assert.ok(!/data-cue="today" hidden/.test(strip)&&/Dzisiaj:/.test(strip),'DZISIAJ visible');
assert.match(strip,/kgUnit&&detail\.nextKg/,'KG label only for weight units');ok('DZISIAJ row visible');
console.log('PASS live suggest detail: '+n+' checks');
