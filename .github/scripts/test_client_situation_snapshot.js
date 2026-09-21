#!/usr/bin/env node
/** Read-model clientSituationSnapshot: fakty + sygnały, bez AI i bez nowych kolekcji. */
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
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('snapshot fn',/function clientSituationSnapshot\(clientId\)/.test(src04));
ok('no firestore write in snapshot',!/function clientSituationSnapshot[\s\S]{0,2500}persistById/.test(src04));
ok('no AI call in snapshot',!/function clientSituationSnapshot[\s\S]{0,2500}(sendAICMsg|aplGenerate)/.test(src04));
ok('cache 04',html.includes('04-client-portal.js?v=53'));

const today=new Date();today.setHours(12,0,0,0);
function ymd(d){
  const x=new Date(d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
}
const d0=ymd(today);
const d3ago=ymd(new Date(today.getTime()-3*86400000));
const d10ago=ymd(new Date(today.getTime()-10*86400000));
const d7=ymd(new Date(today.getTime()+7*86400000));

const sandbox={
  window:{
    CL:[{id:'c1',name:'Jarosław',goal:'masa',status:'active',weight:82.4}],
    SE:[
      {id:'s1',clientId:'c1',date:d3ago,source:'live',type:'FBW A'},
      {id:'s2',clientId:'c1',date:d0,source:'planned',type:'FBW B'}
    ],
    PACKAGES:[{id:'pk1',clientId:'c1',title:'Pakiet 8',expiresDate:d7,status:'active',payStatus:'paid'}],
    CHECKINS:{c1:[{id:'ci1',clientId:'c1',status:'filled',date:d3ago,score:72,answers:{sleep:4,energy:3,stress:2}}]},
    METRIC_ENTRIES:[
      {id:'m1',clientId:'c1',groupId:'mg1',date:d10ago,values:{m1:81.8}},
      {id:'m2',clientId:'c1',groupId:'mg1',date:d0,values:{m1:82.4}},
      {id:'m3',clientId:'c1',groupId:'mg5',date:d0,values:{m2:6.2}}
    ],
    TASKS:[{id:'t1',clientId:'c1',kind:'homework',status:'open',due:d10ago}]
  },
  CL:null,SE:null,Date,Math,Set,JSON,parseInt,Number,String,Array,Object,console,
  todayYmd:()=>d0,
  clientAdherenceStats:(id,days)=>({assigned:3,logged:days===7?2:8,pct:days===7?67:87}),
  completedWorkouts:(id)=>sandbox.window.SE.filter(s=>s.clientId===id&&s.source==='live'),
  isLoggedWorkout:(s)=>s&&s.source==='live',
  sessionTitle:(s)=>(s&&s.type)||'Trening',
  getCIStatus:()=>'done',
  scoreCheckinAnswers:(a)=>72,
  cpMetricLatest:(id,g,m)=>{
    const list=sandbox.window.METRIC_ENTRIES.filter(e=>e.clientId===id&&e.groupId===g&&e.values&&e.values[m]!=null)
      .sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    return list[0]||null;
  },
  cpMetricDeltaPct:()=>0.7,
  clientOpenHomework:(id)=>sandbox.window.TASKS.filter(t=>t.clientId===id),
  allPackages:()=>sandbox.window.PACKAGES,
  buildMonitorVerdict:(c)=>({verdict:'progres',verdictTone:'good',score:4,next:['Utrzymaj volume']}),
  cpClientPulseStatus:()=>({tone:'good',label:'Na czas',days:3}),
  dashOpsAttentionItems:()=>[{clientId:'c1',tag:'<70% planu',pri:2,meta:'Trening 7 dni'}],
  escHtml:(s)=>String(s??'')
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.window.CL=sandbox.CL;
sandbox.window.SE=sandbox.SE;
sandbox.window.PACKAGES=sandbox.window.PACKAGES;
sandbox.window.CHECKINS=sandbox.window.CHECKINS;
sandbox.window.METRIC_ENTRIES=sandbox.window.METRIC_ENTRIES;
sandbox.window.TASKS=sandbox.window.TASKS;

vm.runInNewContext(
  extract(src04,'dashTodayYmd')+'\n'+
  extract(src04,'dashDaysBetween')+'\n'+
  extract(src04,'clientSituationSnapshot')+'\n'+
  'window.clientSituationSnapshot=clientSituationSnapshot;',
  sandbox
);

ok('unknown client null',sandbox.clientSituationSnapshot('nope')===null);
ok('empty id null',sandbox.clientSituationSnapshot('')===null);

const snap=sandbox.clientSituationSnapshot('c1');
ok('identity',snap&&snap.clientId==='c1'&&snap.name==='Jarosław'&&snap.goal==='masa');
ok('adh facts',snap.facts.adh7.pct===67&&snap.facts.adh30.pct===87);
ok('last workout',snap.facts.lastWorkout&&snap.facts.lastWorkout.date===d3ago&&snap.facts.lastWorkout.daysSince===3);
ok('checkin',snap.facts.checkinStatus==='done'&&snap.facts.lastCheckin&&snap.facts.lastCheckin.score===72);
ok('mass from metrics',snap.facts.mass.value===82.4&&snap.facts.mass.deltaPct===0.7);
ok('sleep',snap.facts.sleep.value===6.2);
ok('package days',snap.facts.package&&snap.facts.package.title==='Pakiet 8'&&snap.facts.package.daysLeft===7);
ok('late homework',snap.facts.homework.open===1&&snap.facts.homework.late===1);
ok('signals not AI',snap.signals.monitor&&snap.signals.monitor.verdict==='progres'&&!('interpretation'in snap));
ok('attention passthrough',snap.signals.attention.some(a=>a.tag==='<70% planu'));
ok('pulse',snap.pulse&&snap.pulse.tone==='good');

sandbox.buildMonitorVerdict=undefined;
const noMon=sandbox.clientSituationSnapshot('c1');
ok('monitor optional',noMon&&noMon.signals.monitor===null);

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll clientSituationSnapshot checks passed');
