#!/usr/bin/env node
/** Przegląd: liczby z planu, pusty rejestr ≠ nieobecność, statusy dni, etykiety. */
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
const src02=fs.readFileSync(path.join(root,'02-workouts-onboarding-templates-live.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');
const overview=src08.slice(src08.indexOf('function renderCPOverview'),src08.indexOf('function renderCPPlan'));

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('ci unit',wf.includes('test_cp_overview_logs.js'));
ok('ci ui',wf.includes('test_cp_overview_logs_ui.js'));
ok('cache 08/styles/02',html.includes('08-client-profile-extras.js?v=84')&&html.includes('styles.css?v=118')&&html.includes('02-workouts-onboarding-templates-live.js?v=87'));
ok('empty wo copy',overview.includes('Brak zapisanych treningów')&&overview.includes('Dodaj trening')&&!/Same terminy w kalendarzu/.test(overview));
ok('no remind on empty',!/assigned7&&last7===0/.test(overview));
ok('notes copy',overview.includes('Widoczna tylko dla Ciebie')&&!overview.includes('Krótka notatka zostaje przy Tobie.'));
ok('ask all',src08.includes('Poproś o wszystko')&&src08.includes('function cpRemindAllMissing'));
ok('has-app heading',src08.includes('Uzupełni klient')&&src08.includes('Poproś o wszystko'));
ok('nolog rec',src08.includes("kind:'nolog'")&&src08.includes('Nie ma zapisanych treningów — jeśli się odbyły, zapisz je')&&src08.includes('Przejdź do Treningów'));
ok('live package label',src02.includes("Pakiet: '+pkg.sessions+' sesji")||src02.includes('Pakiet: '));
ok('today frame css',css.includes('.cp-ov-week-day.is-today')&&/box-shadow:0 0 0 1px/.test(css));
ok('accent helper',/function cpOverviewPlanDayAccent/.test(src08));
ok('adh window helper',/function cpOverviewAdhWindow/.test(src08)&&src08.includes('zaplanowanych od'));

const sandbox={
  window:{CL:[],SE:[],PL:[],PACKAGES:[],METRIC_ENTRIES:[],CHECKINS:{},TASKS:[]},
  Date,Math,Set,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  todayYmd:()=>'2026-09-24',
  dashTodayYmd:()=>'2026-09-24',
  clientAdherenceStats:(id,days)=>sandbox._adh||{assigned:0,logged:0,pct:0},
  completedWorkouts:(id,sessions)=>(sessions||sandbox.window.SE||[]).filter(s=>s&&s.clientId===id&&(s.source==='live'||s.source==='client'||s.source==='sala'||s.source==='homework')),
  homeworkCompletions:()=>[],
  homeworkDoneYmd:(t)=>String((t&&t.doneAt)||'').slice(0,10),
  cpAssignmentSessions:(id)=>sandbox.window.SE.filter(s=>s&&s.clientId===id),
  latestClientPlan:(id)=>(sandbox.window.PL||[]).filter(p=>p&&p.clientId===id).slice(-1)[0]||null,
  planStartYmd:(plan)=>plan?String(plan.startDate||plan.createdAt||'').slice(0,10):'',
  getClientOnboard:(c)=>sandbox._ob||{invite:true,baseline:false,schedule:true,plan:true,calendar:true,session:true,package:true,done:5,total:6,complete:false},
  clientSituationSnapshot:()=>sandbox._snap||{facts:{adh7:{assigned:4,logged:0,pct:0},adh30:{assigned:0,logged:0,pct:0},checkinStatus:'none'}},
  cpMetricLatest:()=>null,
  cpMetricSeries:()=>[],
  cpMassDelta30Fact:()=>({value:null,delta:null}),
  cpSleepTrendFact:()=>null,
  cpOverviewStatusHeadline:()=>({title:'Za wcześnie na ocenę',badge:'',tone:'info',sub:'',early:true}),
  escHtml:(s)=>String(s??'')
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.PL=sandbox.window.PL;
sandbox.PACKAGES=sandbox.window.PACKAGES;
vm.runInNewContext(
  'const CP_OV_ADH_MIN=4;const CP_OV_SLEEP_MIN=4;const CP_OV_MASS_TREND_MIN=2;\n'+
  [
    'cpOverviewTodayYmd','cpOverviewDaysBetween','cpOverviewDateLabel','cpOverviewPl',
    'cpOverviewWeekBounds','cpOverviewYmdAdd','cpOverviewWeekdayYmd','cpOverviewPlanStartYmd',
    'cpOverviewLoggedDates','cpOverviewHasLoggedSincePlan','cpOverviewPlannedDates',
    'cpOverviewAdhWindow','cpOverviewAdhReason','cpOverviewThisWeekAdh','cpOverviewHasApp',
    'cpOverviewTrainWord','cpOverviewWeekFreq','cpOverviewLastCheckin','cpOverviewHasSessionToday',
    'cpOverviewWeightCount30','cpOverviewSleepRecFact','cpOverviewRecs','cpOverviewSitTone',
    'cpOverviewParseWeekdayToken','cpOverviewStripDupDayPrefix','cpOverviewParsePlanDay',
    'cpOverviewPlanDayAccent','cpOverviewPlanDayStatus','cpOverviewPackageCaption',
    'cpOverviewFirstName','cpOverviewHasLastName','cpOverviewAlertHTML','cpOverviewMissingItems','cpOverviewMissingHTML',
    'cpClientHasPlanDays','cpAdhSampleOk','cpClientStatusTruth','cpOverviewStatusSteps'
  ].map(n=>extract(src08,n)).join('\n')+'\n'+
  'window.cpOverviewRecs=cpOverviewRecs;window.cpOverviewAdhWindow=cpOverviewAdhWindow;'+
  'window.cpOverviewAdhReason=cpOverviewAdhReason;window.cpOverviewWeekFreq=cpOverviewWeekFreq;'+
  'window.cpOverviewPlanDayAccent=cpOverviewPlanDayAccent;window.cpOverviewPlanDayStatus=cpOverviewPlanDayStatus;'+
  'window.cpOverviewSitTone=cpOverviewSitTone;window.cpOverviewAlertHTML=cpOverviewAlertHTML;'+
  'window.cpOverviewMissingHTML=cpOverviewMissingHTML;window.cpOverviewHasLoggedSincePlan=cpOverviewHasLoggedSincePlan;'+
  'window.cpOverviewThisWeekAdh=cpOverviewThisWeekAdh;window.cpOverviewPackageCaption=cpOverviewPackageCaption;',
  sandbox
);

const c={id:'c1',name:'Jan Kowalski',trainingFreq:3,inviteSent:true,createdAt:'2026-09-13'};
sandbox.window.PL.push({id:'p4',clientId:'c1',createdAt:'2026-09-13',days:[
  {day:'Pon',muscles:'Klatka, Triceps, Czworogłowe'},
  {day:'Wt',muscles:'Plecy'},
  {day:'Czw',muscles:'Nogi'},
  {day:'Pt',muscles:'Barki'}
]});
sandbox.window.SE.push(
  {id:'a',clientId:'c1',date:'2026-09-15',source:'planned'},
  {id:'b',clientId:'c1',date:'2026-09-17',source:'planned'},
  {id:'c',clientId:'c1',date:'2026-09-20',source:'planned'},
  {id:'d',clientId:'c1',date:'2026-09-22',source:'planned'}
);
ok('freq prefers plan 4 not client 3',sandbox.cpOverviewWeekFreq(c)===4);
ok('no logs since plan',sandbox.cpOverviewHasLoggedSincePlan('c1')===false);
const recsEmpty=sandbox.cpOverviewRecs(c);
ok('empty log rec not plan-realism',recsEmpty.some(x=>x.kind==='nolog')&&!recsEmpty.some(x=>x.kind==='adherence'),JSON.stringify(recsEmpty.map(x=>x.kind)));
const adh=sandbox.cpOverviewAdhWindow('c1',14);
ok('14d planned units clipped',adh.assigned===4&&adh.logged===0&&adh.incomplete,JSON.stringify(adh));
ok('14d copy od 13.09',sandbox.cpOverviewAdhReason(adh)==='0 z 4 zaplanowanych od 13.09');
ok('week empty not red',sandbox.cpOverviewSitTone('train',{facts:{adh7:{assigned:4,logged:0,pct:0}}},null,null,{emptyLog:true,weekOpen:true})==='info');
ok('in-week incomplete orange',sandbox.cpOverviewSitTone('train',{facts:{adh7:{assigned:4,logged:1,pct:25}}},null,null,{emptyLog:false,weekOpen:true})==='watch');
ok('ended week incomplete red',sandbox.cpOverviewSitTone('train',{facts:{adh7:{assigned:4,logged:1,pct:25}}},null,null,{emptyLog:false,weekOpen:false})==='act');

sandbox.window.SE.push({id:'l1',clientId:'c1',date:'2026-09-18',source:'live'});
ok('has log after add',sandbox.cpOverviewHasLoggedSincePlan('c1')===true);
const recsLog=sandbox.cpOverviewRecs(c);
ok('with logs can compare plan',recsLog.some(x=>x.kind==='adherence'&&/4 treningi/.test(x.title)&&!/3 treningi/.test(x.title)),JSON.stringify(recsLog));

const parsed=sandbox.cpOverviewParsePlanDay({day:'Pon',muscles:'Klatka, Triceps, Czworogłowe'},0);
ok('accent from muscles',sandbox.cpOverviewPlanDayAccent(Object.assign({muscles:parsed.name},parsed))==='Akcent: klatka, triceps, czworogłowe',JSON.stringify(parsed)+sandbox.cpOverviewPlanDayAccent(parsed));
ok('status past',sandbox.cpOverviewPlanDayStatus('c1',{day:'Pon'},0,{weekday:1,name:'A',rest:false})==='Niezapisany');
ok('status today',sandbox.cpOverviewPlanDayStatus('c1',{day:'Czw'},0,{weekday:4,name:'A',rest:false})==='Dziś');
ok('status future',sandbox.cpOverviewPlanDayStatus('c1',{day:'Pt'},0,{weekday:5,name:'A',rest:false})==='Zaplanowany');
ok('status done only with log',sandbox.cpOverviewPlanDayStatus('c1',{day:'Czw'},0,{weekday:4,name:'A',rest:false},'2026-09-18')!=='Wykonany');
sandbox.window.SE.push({id:'l2',clientId:'c1',planId:'p4',date:'2026-09-22',source:'live',dayIdx:0});
ok('status wykonany with log',sandbox.cpOverviewPlanDayStatus('c1',{day:'Pn'},0,{weekday:1,name:'A',rest:false},'2026-09-24')==='Wykonany');

sandbox.window.PACKAGES=[{id:'pk',clientId:'c1',sessions:16,sessionsUsed:0,payStatus:'paid'}];
ok('package caption',sandbox.cpOverviewPackageCaption(c)==='Pakiet: 16 sesji');

sandbox.window.CHECKINS={};
const miss=sandbox.cpOverviewMissingHTML(c);
ok('missing ask all',/Poproś o wszystko/.test(miss)&&/Uzupełni klient/.test(miss)&&!/po zaproszeniu/.test(miss)&&!/>Poproś</.test(miss));
sandbox._ob={invite:true,intake:true,baseline:false,schedule:true,plan:true,calendar:true,session:true,package:true,done:6,total:7,complete:false};
sandbox.window.METRIC_ENTRIES=[];
const alert=sandbox.cpOverviewAlertHTML(c);
ok('hide onboard when only measurements',alert==='',alert);

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-logs checks passed');
