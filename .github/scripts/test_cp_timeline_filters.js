#!/usr/bin/env node
/** Oś czasu: agregacja istniejących zdarzeń + filtry, bez nowych kolekcji. */
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
const tl=src08.slice(src08.indexOf('function renderCPTimeline'),src08.indexOf('function ctlAddEntry'));

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

ok('collect fn',/function collectCpTimelineEvents\(clientId\)/.test(src08));
ok('filters 8',/Wszystko/.test(src08)&&/data-tl-filter/.test(src08)&&src08.includes("'trening'")&&src08.includes("'pomiar'")&&src08.includes("'checkin'")&&src08.includes("'plan'")&&src08.includes("'notatka'")&&src08.includes("'platnosc'")&&src08.includes("'rekord'"));
ok('logged only',/isLoggedWorkout/.test(src08.slice(src08.indexOf('function collectCpTimelineEvents'),src08.indexOf('window.collectCpTimelineEvents'))));
ok('limit 60/120',tl.includes('window._cpTlLimit')&&tl.includes('120')&&tl.includes('Załaduj więcej'));
ok('checkin /5',src08.includes("'/5'")||src08.includes('+"/5"')||src08.includes("+'/5'"));
ok('no /10 scale',!/function collectCpTimelineEvents[\s\S]{0,4000}\/10/.test(src08));
ok('no persist in collect',!/function collectCpTimelineEvents[\s\S]{0,5000}persistById/.test(src08));
ok('no paidAt guess',!/paidAt/.test(extract(src08,'collectCpTimelineEvents')));
ok('situation untouched',overview.includes('cpOverviewSituationHTML')&&overview.includes('Na kolejny trening')===false&&src08.includes('Wnioski'));
ok('no second timeline in overview',!overview.includes('collectCpTimelineEvents')&&!overview.includes('cp-tl-filters'));
ok('css quieter',css.includes('.cp-tl-row')&&css.includes('.cp-tl-filter')&&!/cp-tl-row\{[^}]*background:var\(--bg-card\)/.test(css.replace(/\n/g,' ')));
ok('cache 08/styles',html.includes('08-client-profile-extras.js?v=80')&&html.includes('styles.css?v=111'));
ok('ci unit',wf.includes('test_cp_timeline_filters.js'));
ok('ci ui',wf.includes('test_cp_timeline_filters_ui.js'));

const sandbox={
  window:{CL:[],SE:[],PL:[],METRIC_ENTRIES:[],CHECKINS:{},CLIENT_NOTES:{},CLIENT_TIMELINE:{},PACKAGES:[],INVOICES:[]},
  Date,Math,Set,JSON,parseInt,parseFloat,Number,String,Array,Object,isFinite,isNaN,console,
  isLoggedWorkout:(s)=>s&&s.source!=='planned'&&s.source!=='live-draft'&&s.source!=='garmin',
  sessionTitle:(s)=>s.type||'Trening',
  exerciseLoggedSets:(ex)=>Array.isArray(ex.sets)?ex.sets:[],
  isWorkingSet:(s)=>!s||s.kind!=='warmup',
  formatSetLoad:(kg,reps)=>kg+' kg × '+reps,
  isWeightLoadUnit:()=>true,
  exLoadUnit:()=>'kg',
  exerciseLoadHistory:(id,name)=>{
    return (sandbox._hist&&sandbox._hist[name])||[];
  },
  loggedSetRows:(id,name,sessions)=>{
    const rows=[];
    (sessions||[]).forEach(s=>(s.exercises||[]).forEach(ex=>{
      if(ex.name!==name)return;
      (ex.sets||[]).forEach(st=>rows.push({date:s.date,sessionId:s.id,name,kg:st.kg,reps:st.reps,epley:(st.kg||0)*(1+st.reps/30),setNo:st.setNo||1,createdAt:s.createdAt||''}));
    }));
    return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  },
  setBeatsPR:(best,kg,reps)=>kg*(1+reps/30)>(best.epley||0)+0.05,
  allMetricGroups:()=>[{id:'mg1',name:'Masa i BMI',metrics:[{id:'m1',name:'Masa ciała',unit:'kg'}]}],
  packagesForClient:(id)=>(sandbox.window.PACKAGES||[]).filter(p=>p.clientId===id)
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.PL=sandbox.window.PL;
['CL','SE','PL','METRIC_ENTRIES','CHECKINS','CLIENT_NOTES','CLIENT_TIMELINE','PACKAGES','INVOICES'].forEach(k=>{
  sandbox[k]=sandbox.window[k];
  sandbox.window[k]=sandbox[k];
});

vm.runInNewContext(
  extract(src08,'cpTlYmd')+'\n'+
  extract(src08,'cpTlDayLabel')+'\n'+
  extract(src08,'cpTlSortKey')+'\n'+
  extract(src08,'cpTlClip')+'\n'+
  extract(src08,'cpTlDeltaStr')+'\n'+
  extract(src08,'cpTlSessionHighlight')+'\n'+
  extract(src08,'cpTlRecordEvents')+'\n'+
  extract(src08,'collectCpTimelineEvents')+'\n'+
  'window.collectCpTimelineEvents=collectCpTimelineEvents;',
  sandbox
);

ok('day label',sandbox.cpTlDayLabel('2026-09-18')==='18.09');

sandbox.SE.push(
  {id:'s-plan',clientId:'c1',date:'2026-09-20',source:'planned',type:'FBW B'},
  {id:'s-draft',clientId:'c1',date:'2026-09-19',source:'live-draft',type:'Draft'},
  {id:'s-live',clientId:'c1',date:'2026-09-18',source:'live',type:'FBW A',
    exercises:[{name:'Wyciskanie sztangi',sets:[{kg:80,reps:8,kind:'work'}]}]},
  {id:'s-old',clientId:'c1',date:'2026-09-11',source:'live',type:'FBW A',
    exercises:[{name:'Wyciskanie sztangi',sets:[{kg:80,reps:6,kind:'work'}]}]}
);
sandbox._hist={
  'Wyciskanie sztangi':[
    {sessionId:'s-live',date:'2026-09-18',sets:[{kg:80,reps:8,kind:'work'}]},
    {sessionId:'s-old',date:'2026-09-11',sets:[{kg:80,reps:6,kind:'work'}]}
  ]
};
sandbox.PL.push({id:'p1',clientId:'c1',name:'FBW',method:'FBW',createdAt:'2026-09-01T10:00:00'});
sandbox.METRIC_ENTRIES.push(
  {id:'m1',clientId:'c1',groupId:'mg1',date:'2026-09-01',values:{m1:100}},
  {id:'m2',clientId:'c1',groupId:'mg1',date:'2026-09-15',values:{m1:99.4}}
);
sandbox.CHECKINS.c1=[
  {id:'ci-p',status:'pending',date:'2026-09-17',answers:{}},
  {id:'ci-f',status:'filled',date:'2026-09-17',answers:{sleep:5,energy:3}}
];
sandbox.CLIENT_NOTES.c1=[{id:'n1',text:'Kolano OK',createdAt:'2026-09-16T12:00:00'}];
sandbox.PACKAGES.push({id:'pk1',clientId:'c1',title:'Pakiet 8',price:800,date:'2026-09-02',payStatus:'paid'});
sandbox.INVOICES.push({id:'inv1',nr:'FV-1',pkgId:'pk1',date:'2026-09-02',amount:800,status:'paid'});

const all=sandbox.collectCpTimelineEvents('c1');
ok('no planned',!all.some(e=>/FBW B|s-plan/.test(e.id+e.fact)));
ok('no draft',!all.some(e=>/Draft|s-draft/.test(e.id+e.fact)));
ok('logged trening',all.some(e=>e.kind==='trening'&&/Wyciskanie/.test(e.fact)));
ok('trening delta powt',all.some(e=>e.kind==='trening'&&e.extra==='+2 powt.'),JSON.stringify(all.filter(e=>e.kind==='trening')));
ok('checkin filled only',all.filter(e=>e.kind==='checkin').length===1);
ok('checkin /5',all.some(e=>e.kind==='checkin'&&/Sen 5\/5/.test(e.fact)&&/Energia 3\/5/.test(e.fact)&&!/\/10/.test(e.fact)));
ok('mass delta vs prev',all.some(e=>e.kind==='pomiar'&&/99\.4/.test(String(e.fact))&&e.extra==='-0.6 kg'),JSON.stringify(all.filter(e=>e.kind==='pomiar')));
ok('plan',all.some(e=>e.kind==='plan'&&/FBW/.test(e.fact)));
ok('note',all.some(e=>e.kind==='notatka'&&/Kolano/.test(e.fact)));
ok('pay no paidAt',all.some(e=>e.kind==='platnosc'&&/Pakiet 8/.test(e.fact))&&!all.some(e=>/opłacon/i.test(e.fact+e.extra)));
ok('sort newest first',all.length>=2&&String(sandbox.cpTlSortKey(all[0].date))>=String(sandbox.cpTlSortKey(all[1].date)));
ok('record beaten',all.some(e=>e.kind==='rekord'&&/Wyciskanie/.test(e.fact)),JSON.stringify(all.filter(e=>e.kind==='rekord')));

const empty=sandbox.collectCpTimelineEvents('nobody');
ok('unknown client empty',empty.length===0);

sandbox.SE.length=0;
sandbox.SE.push({id:'s-bare',clientId:'c2',date:'2026-09-10',source:'live',type:'FBW'});
const bare=sandbox.collectCpTimelineEvents('c2');
ok('trening without sets is simple',bare.some(e=>e.kind==='trening'&&e.fact==='FBW'&&!e.extra));
ok('rekordy empty without two sets',!bare.some(e=>e.kind==='rekord'));

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll cp-timeline-filters checks passed');
