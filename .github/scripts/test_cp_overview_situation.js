#!/usr/bin/env node
/** Przegląd: nagłówek sytuacji + Na kolejny trening z faktów (bez AI). */
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
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');

const overview=src08.slice(src08.indexOf('function renderCPOverview'),src08.indexOf('function renderCPPlan'));
const sit=extract(src08,'cpOverviewSituationHTML')+'\n'+extract(src08,'cpNextSessionFocusItems');

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('helpers exist',/function cpOverviewSituationHTML\(c\)/.test(src08)&&/function cpNextSessionFocusItems\(clientId\)/.test(src08));
ok('overview calls situation',overview.includes('cpOverviewSituationHTML(c)'));
ok('pulse stays',sit.includes('cp-ov-pulse')&&/function\s+cpClientPulseStatus/.test(src08));
ok('no persist in situation',!/function cpOverviewSituationHTML[\s\S]{0,3500}persistById/.test(src08));
ok('no persist in next',!/function cpNextSessionFocusItems[\s\S]{0,2500}persistById/.test(src08));
ok('no AI in next',!/function cpNextSessionFocusItems[\s\S]{0,2500}(sendAICMsg|aplGenerate|openai)/.test(src08));
ok('load drop 85%',src08.includes('prev*0.85')||src08.includes('prev * 0.85'));
ok('empty copy',src08.includes('Brak szczególnych sygnałów — jedź planem.'));
ok('next header',src08.includes('Na kolejny trening')&&src08.includes('cp-ov-next'));
ok('kpis 7d 30d mass sleep checkin',sit.includes('Treningi 7d')&&sit.includes('Adherencja 30d')&&sit.includes('Masa')&&sit.includes('Sen')&&sit.includes('Check-in'));
ok('existing cards remain',overview.includes('Ostatnie 7 dni')&&overview.includes('Pomiary ciała')&&overview.includes('Samopoczucie (check-in)'));
ok('card targets',overview.includes('id="cp-ov-card-train"')&&overview.includes('id="cp-ov-card-metrics"')&&overview.includes('id="cp-ov-card-feel"'));
ok('tabs unchanged',html.includes('id="cpt-overview"')&&html.includes("setCPTab('overview')")&&html.includes('id="cpt-training"')&&html.includes('id="cpt-plan"'));
ok('css situation',css.includes('.cp-ov-situation')&&css.includes('.cp-ov-sit-tile-ok')&&css.includes('.cp-ov-next-watch')&&css.includes('.cp-ov-sit-tile-act'));
ok('cache 08/styles',html.includes('08-client-profile-extras.js?v=73')&&html.includes('styles.css?v=105'));
ok('ci unit',wf.includes('test_cp_overview_situation.js'));
ok('ci ui',wf.includes('test_cp_overview_situation_ui.js'));

const sandbox={
  window:{CL:[],SE:[],METRIC_ENTRIES:[]},
  CL:null,SE:null,Date,Math,Set,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,console,
  isWorkingSet:(s)=>!s||s.kind!=='warmup',
  isLoggedTrainingSession:(s)=>s&&s.source!=='planned'&&s.source!=='live-draft',
  lastLoadForExercise:(id,name)=>{
    const row=(sandbox._loads||[]).find(x=>x.name===name);
    return row||null;
  },
  clientInjuriesText:(c)=>c&&c.injuries||'',
  clientSituationSnapshot:(id)=>{
    if(id!=='c1')return null;
    return sandbox._snap;
  },
  cpMetricSeries:(id,g,m)=>{
    return (sandbox.window.METRIC_ENTRIES||[]).filter(e=>e.clientId===id&&e.groupId===g&&e.values&&e.values[m]!=null)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)))
      .map(e=>({d:e.date,v:parseFloat(e.values[m])}));
  },
  escHtml:(s)=>String(s??'')
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.window.CL=sandbox.CL;
sandbox.window.SE=sandbox.SE;

vm.runInNewContext(
  extract(src08,'cpSetsVolume')+'\n'+
  extract(src08,'cpLoadDropFacts')+'\n'+
  extract(src08,'cpSleepTrendFact')+'\n'+
  extract(src08,'cpMassDelta30Fact')+'\n'+
  extract(src08,'cpSitClip')+'\n'+
  extract(src08,'cpNextSessionFocusItems')+'\n'+
  extract(src08,'cpOverviewSitTone')+'\n'+
  extract(src08,'cpOverviewSituationHTML')+'\n'+
  'window.cpNextSessionFocusItems=cpNextSessionFocusItems;'+
  'window.cpSetsVolume=cpSetsVolume;'+
  'window.cpLoadDropFacts=cpLoadDropFacts;'+
  'window.cpMassDelta30Fact=cpMassDelta30Fact;'+
  'window.cpOverviewSituationHTML=cpOverviewSituationHTML;',
  sandbox
);

ok('volume skips warmup',sandbox.cpSetsVolume([{kg:40,reps:10,kind:'warmup'},{kg:80,reps:8},{kg:80,reps:8}])===1280);
ok('volume empty',sandbox.cpSetsVolume([])===null);

sandbox.CL.splice(0,sandbox.CL.length,{id:'c1',name:'Jarosław',goal:'masa',injuries:''});
sandbox.SE.splice(0,sandbox.SE.length);
sandbox._loads=[];
sandbox._snap={
  facts:{
    adh7:{assigned:3,logged:3,pct:100},
    adh30:{assigned:12,logged:11,pct:92},
    checkinStatus:'done',
    lastCheckin:{daysSince:2,score:80},
    mass:{value:82.4},
    sleep:{value:7.2},
    package:{daysLeft:20,title:'Pakiet 8'},
    homework:{open:0,late:0}
  },
  pulse:{tone:'good',label:'Na czas',hint:'Ostatni wpis 2 d. temu'},
  signals:{monitor:{verdict:'progres'}}
};
sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg1',date:'2026-08-22',values:{m1:81.8}},
  {clientId:'c1',groupId:'mg1',date:'2026-09-21',values:{m1:82.4}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-18',values:{m2:7.0}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-21',values:{m2:7.2}}
];
const empty=sandbox.cpNextSessionFocusItems('c1');
ok('empty next is jedź planem',empty.length===1&&empty[0].kind==='ok'&&/jedź planem/.test(empty[0].text),JSON.stringify(empty));

sandbox.CL[0].injuries='prawe kolano — bez przysiadu ze sztangą';
sandbox.SE.push({
  id:'s1',clientId:'c1',source:'live',date:'2026-09-18',
  exercises:[{name:'Wyciskanie sztangi'}]
});
sandbox._loads=[{
  name:'Wyciskanie sztangi',
  history:[
    {sets:[{kg:60,reps:6},{kg:60,reps:6}]},
    {sets:[{kg:80,reps:8},{kg:80,reps:8}]}
  ]
}];
sandbox._snap.facts.checkinStatus='overdue';
sandbox._snap.facts.homework={open:1,late:1};
sandbox._snap.facts.package={daysLeft:3,title:'Pakiet 8'};
sandbox._snap.facts.adh7={assigned:3,logged:0,pct:0};
sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg5',date:'2026-09-14',values:{m2:7.5}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-21',values:{m2:5.2}}
];
const busy=sandbox.cpNextSessionFocusItems('c1');
ok('injury first',busy[0]&&busy[0].kind==='injury'&&/kolano/.test(busy[0].text));
ok('load drop listed',busy.some(x=>x.kind==='load'&&/volume −/.test(x.text)));
ok('sleep down listed',busy.some(x=>x.kind==='sleep'&&/Sen spada/.test(x.text)));
ok('checkin overdue listed',busy.some(x=>x.kind==='checkin'&&x.tone==='act'));
ok('max 5 bullets',busy.length===5,JSON.stringify(busy.map(x=>x.kind)));
ok('homework in first 5',busy.some(x=>x.kind==='homework'));
const htmlBusy=sandbox.cpOverviewSituationHTML(sandbox.CL[0]);
ok('overdue checkin tile',/przeterminowany/.test(htmlBusy)&&/data-cp-sit="checkin"/.test(htmlBusy));
ok('monitor verdict cap',/Progres/.test(htmlBusy));

sandbox._loads=[{
  name:'Wyciskanie sztangi',
  history:[
    {sets:[{kg:80,reps:8}]},
    {sets:[{kg:80,reps:8}]}
  ]
}];
sandbox.CL[0].injuries='';
sandbox._snap.facts.checkinStatus='done';
sandbox._snap.facts.homework={open:0,late:0};
sandbox._snap.facts.package={daysLeft:20};
sandbox._snap.facts.adh7={assigned:3,logged:3,pct:100};
sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg5',date:'2026-09-14',values:{m2:7.0}},
  {clientId:'c1',groupId:'mg5',date:'2026-09-21',values:{m2:7.1}}
];
const noDrop=sandbox.cpNextSessionFocusItems('c1');
ok('no drop at 100% volume',noDrop.length===1&&noDrop[0].kind==='ok');

sandbox._loads=[{
  name:'Wyciskanie sztangi',
  history:[
    {sets:[{kg:68,reps:8}]},
    {sets:[{kg:80,reps:8}]}
  ]
}];
const drop=sandbox.cpLoadDropFacts('c1');
ok('drop at 85% threshold',drop.length===1&&drop[0].pct>=15,JSON.stringify(drop));

sandbox._loads=[{
  name:'Wyciskanie sztangi',
  history:[
    {sets:[{kg:69,reps:8}]},
    {sets:[{kg:80,reps:8}]}
  ]
}];
ok('no drop above 85%',sandbox.cpLoadDropFacts('c1').length===0);

sandbox.window.METRIC_ENTRIES=[
  {clientId:'c1',groupId:'mg1',date:'2026-08-22',values:{m1:80}},
  {clientId:'c1',groupId:'mg1',date:'2026-09-21',values:{m1:81.2}}
];
const mass=sandbox.cpMassDelta30Fact('c1');
ok('mass +1.2 / 30d',mass&&mass.value===81.2&&mass.delta===1.2,JSON.stringify(mass));

const htmlSit=sandbox.cpOverviewSituationHTML(sandbox.CL[0]);
ok('situation html kicker',/Sytuacja/.test(htmlSit)&&/Jarosław/.test(htmlSit)&&/Budowa masy/.test(htmlSit));
ok('situation html pulse',/cp-ov-pulse/.test(htmlSit));
ok('situation html next',/Na kolejny trening/.test(htmlSit));
ok('situation html tiles',/data-cp-sit="train"/.test(htmlSit)&&/data-cp-sit="adh"/.test(htmlSit)&&/data-cp-sit="mass"/.test(htmlSit));

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-overview-situation checks passed');
