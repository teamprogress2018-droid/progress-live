#!/usr/bin/env node
/** Panel operacyjny trenera: alerty, raporty, aktywność, wygasające pakiety. */
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
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const src01=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('kpi row',html.includes('id="d-kpi-row"')&&html.includes('id="d-reports"')&&html.includes('id="d-expiring"'));
ok('ops sections',html.includes('id="dash-ops-attention"')&&html.includes('id="dash-ops-reports"')&&html.includes('id="dash-ops-activity"')&&html.includes('id="dash-ops-pay"')&&html.includes('id="dash-ops-reminders"'));
ok('today plan',html.includes('Dzisiejszy plan')&&html.includes('id="d-today-sessions"'));
ok('quick actions',html.includes('id="dash-qa-btn"')&&html.includes('id="dash-qa-menu"')&&html.includes("openM('m-broadcast')")&&html.includes("openM('m-invite')"));
ok('ops css',css.includes('.dash-ops-grid')&&css.includes('.dash-qa-menu')&&css.includes('.dash-kpi-row'));
ok('helpers',src04.includes('function dashOpsAttentionItems')&&src04.includes('function dashOpsRecentReports')&&src04.includes('function dashOpsExpiringPackages')&&src04.includes('function dashOpsRecentActivity')&&src04.includes('function renderDashOps'));
ok('list collapse',src04.includes('function dashListSection')&&src04.includes('DASH_LIST_PREVIEW=2')&&src04.includes('function toggleDashListExpand')&&css.includes('.dash-list-more'));
ok('legacy followups stubbed',/function renderDashCheckinFollowup\(\)\{[\s\S]*?el\.style\.display='none'/.test(src04)&&src04.includes("'dash-checkin':renderDashCheckinFollowup"));
ok('kpi first + dense css',html.indexOf('id="d-kpi-row"')<html.indexOf('id="dash-client-pipeline"')&&css.includes('.dash-kpi-body')&&css.includes('#screen-dashboard .dash-content'));
ok('renderDash wires ops',src04.includes('renderDashOps()')&&src04.includes('dashOpsRecentReports()')&&src04.includes('dashOpsExpiringPackages(7)'));
ok('cache bumps',html.includes('04-client-portal.js?v=32')&&html.includes('styles.css?v=41'));

const today=new Date();
today.setHours(12,0,0,0);
function ymd(d){
  const x=new Date(d);
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
}
const d0=ymd(today);
const d3=ymd(new Date(today.getTime()+3*86400000));
const dPast=ymd(new Date(today.getTime()-3*86400000));
const dPast10=ymd(new Date(today.getTime()-10*86400000));

const sandbox={
  window:{
    CL:[
      {id:'c1',name:'Anna',status:'active'},
      {id:'c2',name:'Bartek',status:'active'},
      {id:'c3',name:'Arch',status:'archived'}
    ],
    SE:[
      {id:'s1',clientId:'c1',date:dPast,source:'planned'},
      {id:'s2',clientId:'c1',date:dPast10,source:'planned'},
      {id:'s3',clientId:'c1',date:d0,source:'client',exercises:[{name:'Squat',kg:100,sets:[{kg:100}]}]},
      {id:'s4',clientId:'c2',date:dPast,source:'planned'},
      {id:'s5',clientId:'c2',date:dPast,source:'client',exercises:[{name:'Press',sets:3}]}
    ],
    PACKAGES:[
      {id:'pk1',clientId:'c1',clientName:'Anna',title:'Pakiet 8',price:800,expiresDate:d3,status:'active'},
      {id:'pk2',clientId:'c2',clientName:'Bartek',title:'Stary',price:100,expiresDate:dPast10,status:'expired'},
      {id:'pk3',clientId:'c3',clientName:'Arch',title:'Arch pkg',price:50,expiresDate:d3,status:'active'}
    ],
    CHECKINS:{
      c1:[{id:'ci1',clientId:'c1',status:'filled',date:d0,score:80,answers:{weight:70,energy:4,sleep:3,notes:'ok'}}],
      c2:[{id:'ci2',clientId:'c2',status:'pending',date:dPast10}]
    },
    FORM_SENDS:[
      {id:'fs1',clientId:'c1',formId:'df3',formName:'Raport tygodniowy',status:'filled',filledAt:d0}
    ]
  },
  CL:null,SE:null,
  ensureCheckins:()=>{},
  escHtml:(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  console
};
sandbox.CL=sandbox.window.CL;
sandbox.SE=sandbox.window.SE;
sandbox.window.CL=sandbox.CL;
sandbox.window.SE=sandbox.SE;
sandbox.window.PACKAGES=sandbox.window.PACKAGES;
sandbox.window.CHECKINS=sandbox.window.CHECKINS;
sandbox.window.FORM_SENDS=sandbox.window.FORM_SENDS;

vm.runInNewContext(
  extract(src01,'isLoggedWorkout')+'\n'+
  extract(src01,'completedWorkouts')+'\n'+
  'function allPackages(){return window.PACKAGES||[];}\n'+
  extract(src05,'clientTrainingWindowStats')+'\n'+
  extract(src04,'getCIStatus')+'\n'+
  extract(src04,'dashOpsLiveClients')+'\n'+
  extract(src04,'dashOpsExpiringPackages')+'\n'+
  extract(src04,'dashOpsRecentReports')+'\n'+
  extract(src04,'dashOpsAttentionItems')+'\n'+
  extract(src04,'dashOpsRecentActivity')+'\n'+
  extract(src04,'dashOpsReminders')+'\n'+
  'window.isLoggedWorkout=isLoggedWorkout;window.completedWorkouts=completedWorkouts;'+
  'window.clientTrainingWindowStats=clientTrainingWindowStats;window.getCIStatus=getCIStatus;'+
  'window.dashOpsLiveClients=dashOpsLiveClients;window.dashOpsExpiringPackages=dashOpsExpiringPackages;'+
  'window.dashOpsRecentReports=dashOpsRecentReports;window.dashOpsAttentionItems=dashOpsAttentionItems;'+
  'window.dashOpsRecentActivity=dashOpsRecentActivity;window.dashOpsReminders=dashOpsReminders;',
  sandbox
);

const exp=sandbox.dashOpsExpiringPackages(7);
ok('expiring only live window',exp.length===1&&exp[0].id==='pk1');

const reps=sandbox.dashOpsRecentReports();
ok('reports include checkin',reps.some(r=>r.kind==='checkin'&&r.clientId==='c1'));
ok('reports include form',reps.some(r=>r.kind==='form'&&r.formName==='Raport tygodniowy'));

const att=sandbox.dashOpsAttentionItems();
ok('attention overdue report',att.some(a=>a.clientId==='c2'&&/Raport|zaleg/.test(a.tag)));
ok('attention low plan or missed',att.some(a=>a.clientId==='c1'&&(/<70%|Opuszczone/.test(a.tag))));

const acts=sandbox.dashOpsRecentActivity();
ok('activity logged only',acts.length>=1&&acts.every(s=>s.source==='client'||s.source==='live'||(s.exercises&&s.exercises.length)));
ok('activity skips planned',!acts.some(s=>s.id==='s1'||s.id==='s2'||s.id==='s4'));

const rem=sandbox.dashOpsReminders();
ok('reminders has package',rem.some(r=>/Pakiet/.test(r.txt)&&/Anna/.test(r.txt)));
ok('reminders has report deadline',rem.some(r=>/raport/i.test(r.txt)&&/Bartek/.test(r.txt)));

vm.runInNewContext(
  extract(src04,'dashListExpanded')+'\n'+
  extract(src04,'dashListSection')+'\n'+
  'var DASH_LIST_PREVIEW=2;window._dashListExpanded={};'+
  'const html=dashListSection("t",[1,2,3,4,5],x=>"<i>"+x+"</i>","");'+
  'const collapsed=!window._dashListExpanded.t&&html.includes("Pokaż więcej (3)")&&html.includes("<i>1</i>")&&html.includes("<i>2</i>")&&!html.includes("<i>3</i>");'+
  'window._dashListExpanded.t=true;'+
  'const expanded=dashListSection("t",[1,2,3,4,5],x=>"<i>"+x+"</i>","");'+
  'const expandedOk=expanded.includes("Zwiń listę")&&expanded.includes("<i>5</i>");'+
  'if(!collapsed||!expandedOk)throw new Error("dashListSection collapse failed");',
  {console,DASH_LIST_PREVIEW:2,window:{_dashListExpanded:{}}}
);
ok('dashListSection preview 2','manual');

if(failed){console.error('\n'+failed+' failed');process.exit(1);}
console.log('\nAll dash ops panel checks passed');
