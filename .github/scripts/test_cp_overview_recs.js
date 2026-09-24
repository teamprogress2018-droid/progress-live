#!/usr/bin/env node
/** Przegląd: 5 reguł rekomendacji — bez sprzeczności z danymi. */
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

const root=path.join(__dirname,'../..');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('recs helper',/function cpOverviewRecs\(c\)/.test(src08));
ok('no shorten label',!/Skróć plan/.test(src08)&&src08.includes('Otwórz plan'));
ok('ok line',src08.includes('Wszystko w porządku — brak pilnych działań.'));
ok('early copy',src08.includes('Wiarygodną analizę pokażemy po 4 tygodniach lub 4 pomiarach.'));
ok('ci workflow',wf.includes('test_cp_overview_recs.js'));
ok('cache',html.includes('08-client-profile-extras.js?v=83'));
ok('invite not a rec',!/kind:'invite'/.test(extract(src08,'cpOverviewRecs')));

const sandbox={
  window:{CL:[],SE:[],METRIC_ENTRIES:[],CHECKINS:{}},
  Date,Math,Set,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  todayYmd:()=>'2026-09-24',
  dashTodayYmd:()=>'2026-09-24',
  clientAdherenceStats:(id,days)=>sandbox._adh||{assigned:0,logged:0,pct:0},
  completedWorkouts:(id,sessions)=>(sessions||sandbox.window.SE||[]).filter(s=>s&&s.clientId===id&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework')),
  homeworkCompletions:()=>[],
  cpAssignmentSessions:(id)=>sandbox.window.SE.filter(s=>s&&s.clientId===id),
  cpMetricSeries:(id,g,m)=>(sandbox.window.METRIC_ENTRIES||[]).filter(e=>e.clientId===id&&e.groupId===g&&e.values&&e.values[m]!=null)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
    .map(e=>({d:e.date,v:parseFloat(e.values[m])})),
  latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id).slice(-1)[0]||null,
  escHtml:(s)=>String(s??'')
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;

const names=[
  'cpOverviewTodayYmd','cpOverviewDaysBetween','cpOverviewDateLabel','cpOverviewPl',
  'cpOverviewWeekBounds','cpOverviewMeasureCount','cpOverviewCoopWeeks','cpOverviewWeightCount30',
  'cpOverviewLastCheckin','cpOverviewHasSessionToday','cpOverviewSleepRecFact','cpOverviewThisWeekAdh',
  'cpOverviewHasApp','cpOverviewTrainWord','cpOverviewWeekFreq','cpOverviewRecs',
  'cpOverviewStatusIsEarly','cpOverviewStatusHeadline','cpOverviewStatusSteps',
  'cpOverviewParsePlanDay','cpOverviewStripDupDayPrefix','cpOverviewParseWeekdayToken',
  'cpOverviewPlanTitle','cpOverviewYmdAdd','cpOverviewWeekdayYmd','cpOverviewPlanStartYmd',
  'cpOverviewLoggedDates','cpOverviewHasLoggedSincePlan','cpOverviewPlannedDates',
  'cpOverviewAdhWindow','cpOverviewAdhReason','cpOverviewPlanDayAccent','cpOverviewPlanDayStatus',
  'cpOverviewPackageCaption'
];
vm.runInNewContext(names.map(n=>extract(src08,n)).join('\n')+'\nwindow.cpOverviewRecs=cpOverviewRecs;window.cpOverviewParsePlanDay=cpOverviewParsePlanDay;window.cpOverviewPlanTitle=cpOverviewPlanTitle;window.cpOverviewStatusHeadline=cpOverviewStatusHeadline;window.cpOverviewStatusSteps=cpOverviewStatusSteps;',sandbox);

function client(extra){
  return Object.assign({id:'c1',name:'Jan Kowalski',trainingFreq:3},extra||{});
}

sandbox._adh={assigned:2,logged:2,pct:100};
sandbox.window.SE.length=0;
sandbox.window.METRIC_ENTRIES.length=0;
sandbox.window.CHECKINS={};
let recs=sandbox.cpOverviewRecs(client());
ok('2/2 no adherence rec',!recs.some(x=>x.kind==='adherence'),JSON.stringify(recs.map(x=>x.kind)));
ok('2/2 no invite rec',!recs.some(x=>x.kind==='invite'));

recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('2/2 invited no shorten',!recs.some(x=>x.kind==='adherence')&&recs.every(x=>x.cta&&x.cta.label!=='Skróć plan'));

sandbox._adh={assigned:4,logged:1,pct:25};
sandbox.window.PL=[{id:'p4',clientId:'c1',days:[{},{},{},{}]}];
sandbox.window.SE=[
  {id:'l1',clientId:'c1',date:'2026-09-18',source:'live',type:'A'},
  {id:'p1',clientId:'c1',date:'2026-09-15',source:'planned',type:'A'},
  {id:'p2',clientId:'c1',date:'2026-09-17',source:'planned',type:'B'},
  {id:'p3',clientId:'c1',date:'2026-09-20',source:'planned',type:'C'},
  {id:'p4s',clientId:'c1',date:'2026-09-22',source:'planned',type:'D'}
];
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('4 planned 1 done shows plan rec',recs.some(x=>x.kind==='adherence'&&x.cta.label==='Otwórz plan'&&/1 z 4/.test(x.reason)&&/4 treningi/.test(x.title)),JSON.stringify(recs));
sandbox.window.PL=[];
sandbox.window.SE.length=0;
sandbox._adh={assigned:5,logged:4,pct:80};
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('80% never plan rec',!recs.some(x=>x.kind==='adherence'));

sandbox.window.SE.push({id:'t',clientId:'c1',date:'2026-09-24',source:'planned',type:'FBW'});
sandbox.window.CHECKINS={};
recs=sandbox.cpOverviewRecs(client());
ok('no app checkin is note not poproś',recs.some(x=>x.kind==='checkin'&&x.cta.label==='Dodaj notatkę')&&!recs.some(x=>x.cta&&/Poproś/.test(x.cta.label)),JSON.stringify(recs.map(x=>x.kind+':'+(x.cta&&x.cta.label))));
ok('no invite rec without app',!recs.some(x=>x.kind==='invite'));
ok('max 3',recs.length<=3,String(recs.length));
ok('every rec has reason',recs.every(x=>x.reason&&x.reason.length>8),JSON.stringify(recs.map(x=>x.reason)));

recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('with app poproś checkin',recs.some(x=>x.kind==='checkin'&&x.cta.label==='Poproś o check-in'));
ok('no invite rec when has app',!recs.some(x=>x.kind==='invite'));

sandbox.window.CHECKINS={c1:[{status:'filled',date:'2026-09-23'}]};
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('fresh checkin hides checkin rec',!recs.some(x=>x.kind==='checkin'));

sandbox.window.CHECKINS={};
sandbox.window.METRIC_ENTRIES=[{clientId:'c1',groupId:'mg1',date:'2026-09-20',values:{m1:57}}];
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('1 weight rec',recs.some(x=>x.kind==='mass'&&/^1 pomiar/.test(x.reason)),JSON.stringify(recs.filter(x=>x.kind==='mass')));
sandbox.window.METRIC_ENTRIES.push({clientId:'c1',groupId:'mg1',date:'2026-09-10',values:{m1:56.5}});
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('2 weights hide mass rec',!recs.some(x=>x.kind==='mass'));

sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg5',date:'2026-09-20',values:{m2:7.5}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-21',values:{m2:5.0}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-22',values:{m2:5.0}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-23',values:{m2:4.5}}
];
recs=sandbox.cpOverviewRecs(client({inviteSent:true}));
ok('low sleep rec',recs.some(x=>x.kind==='sleep'&&/\/10/.test(x.reason)&&x.cta.label==='Otwórz trening'),JSON.stringify(recs.filter(x=>x.kind==='sleep')));

sandbox.window.SE.length=0;
sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg1',date:'2026-09-01',values:{m1:80}},
  {clientId:'c1',groupId:'mg1',date:'2026-09-15',values:{m1:80}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-20',values:{m2:8}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-22',values:{m2:8}}
];
sandbox.window.CHECKINS={c1:[{status:'filled',date:'2026-09-24'}]};
sandbox._adh={assigned:4,logged:4,pct:100};
recs=sandbox.cpOverviewRecs(client({inviteSent:true,createdAt:'2026-01-01'}));
ok('all clear ok empty',recs.length===0,JSON.stringify(recs));
const steps=sandbox.cpOverviewStatusSteps(client({inviteSent:true,createdAt:'2026-01-01'}));
ok('ok copy',steps.length===1&&steps[0].kind==='ok'&&/Wszystko w porządku/.test(steps[0].text));

const early=sandbox.cpOverviewStatusHeadline(client({createdAt:'2026-09-10'}));
ok('early by weeks',early.early&&early.title==='Za wcześnie na ocenę'&&/4 tygodniach/.test(early.sub));
sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg1',date:'2026-08-01',values:{m1:1}},
  {clientId:'c1',groupId:'mg1',date:'2026-08-08',values:{m1:1}},
  {clientId:'c1',groupId:'mg1',date:'2026-08-15',values:{m1:1}},
  {clientId:'c1',groupId:'mg1',date:'2026-08-22',values:{m1:1}}
];
const ready=sandbox.cpOverviewStatusHeadline(client({createdAt:'2026-01-01',inviteSent:true}));
ok('enough data not forced early',!ready.early,JSON.stringify(ready));

const old=sandbox.cpOverviewParsePlanDay({day:'Dzień 1 — Dzień A · całe ciało (priorytet: góra pleców, triceps, pośladki)'},0);
ok('old name split',old.name==='Dzień A · całe ciało'&&old.priority==='góra pleców, triceps, pośladki'&&!/Dzień 1/.test(old.name),JSON.stringify(old));
const pon=sandbox.cpOverviewParsePlanDay({day:'Pon',muscles:'Całe ciało'},0);
ok('weekday chip',pon.weekday===1&&pon.weekdayLabel==='pn'&&pon.name==='Całe ciało',JSON.stringify(pon));
const dayA=sandbox.cpOverviewParsePlanDay({day:'A'},0);
ok('letter day not weekday',dayA.name==='A'&&!dayA.weekdayLabel&&dayA.weekday==null,JSON.stringify(dayA));
const titled=sandbox.cpOverviewPlanTitle({name:'Jan Kowalski — FBW Siła',duration:8,clientName:'Jan Kowalski'},client());
ok('plan title drops client',titled==='FBW Siła · 8 tygodni',titled);

sandbox.window.METRIC_ENTRIES=[];
sandbox.window.CHECKINS={c1:[{status:'filled',date:'2026-09-24'}]};
sandbox.window.PL=[{id:'p4',clientId:'c1',createdAt:'2026-09-13',days:[{},{},{},{}]}];
sandbox.window.SE=[
  {id:'p1',clientId:'c1',date:'2026-09-15',source:'planned',type:'A'},
  {id:'p2',clientId:'c1',date:'2026-09-17',source:'planned',type:'B'},
  {id:'p3',clientId:'c1',date:'2026-09-20',source:'planned',type:'C'},
  {id:'p4s',clientId:'c1',date:'2026-09-22',source:'planned',type:'D'}
];
sandbox._adh={assigned:4,logged:0,pct:0};
recs=sandbox.cpOverviewRecs(client({inviteSent:true,createdAt:'2026-09-13'}));
ok('empty log no adherence rec',!recs.some(x=>x.kind==='adherence'),JSON.stringify(recs));
ok('empty log add workout rec',recs.some(x=>x.kind==='nolog'&&x.cta&&x.cta.label==='Przejdź do Treningów'&&/Nie ma zapisanych treningów/.test(x.title)),JSON.stringify(recs));
const adhInc=sandbox.cpOverviewAdhWindow('c1',14);
ok('incomplete from plan start',adhInc.incomplete&&adhInc.planStart==='2026-09-13'&&adhInc.assigned===4&&adhInc.logged===0,JSON.stringify(adhInc));
ok('incomplete copy',sandbox.cpOverviewAdhReason(adhInc)==='0 z 4 zaplanowanych od 13.09',sandbox.cpOverviewAdhReason(adhInc));
ok('freq from 4-day plan',sandbox.cpOverviewWeekFreq(client({trainingFreq:3}))===4);
const acc=sandbox.cpOverviewPlanDayAccent({name:'FBW Siła',priority:'Klatka, Triceps, Czworogłowe',rest:false});
ok('accent label',acc==='Akcent: klatka, triceps, czworogłowe',acc);
ok('past day niezapisany',sandbox.cpOverviewPlanDayStatus('c1',{day:'Pon'},0,{weekday:1,name:'A',rest:false},'2026-09-24')==='Niezapisany');
ok('today day Dziś',sandbox.cpOverviewPlanDayStatus('c1',{day:'Czw'},0,{weekday:4,name:'A',rest:false},'2026-09-24')==='Dziś');
ok('future day Zaplanowany',sandbox.cpOverviewPlanDayStatus('c1',{day:'Pt'},0,{weekday:5,name:'A',rest:false},'2026-09-24')==='Zaplanowany');

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-recs checks passed');
