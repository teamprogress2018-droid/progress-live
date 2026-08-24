#!/usr/bin/env node
/** Dashboard homework follow-up helpers. */
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
const src01=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src10=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

if(!html.includes('id="dash-hw-followup"')){console.error('FAIL missing dash-hw-followup');process.exit(1);}
if(!src04.includes('function renderDashHwFollowup')){console.error('FAIL missing renderDashHwFollowup');process.exit(1);}
if(!src10.includes("setBadge('clive-bn-homework'")&&!src10.includes('clive-bn-homework')){console.error('FAIL homework badge missing');process.exit(1);}

const msgs=[];
const notes=[];
const persisted=[];
const sandbox={
  window:{
    CL:[{id:'c1',name:'Anna',status:'active'},{id:'c2',name:'Bartek',status:'archived'}],
    TASKS:[
      {id:'t1',clientId:'c1',kind:'homework',odWorkoutId:'ow1',title:'HIIT 20',status:'open',due:'2026-08-01'},
      {id:'t2',clientId:'c1',kind:'homework',odWorkoutId:'ow2',title:'Mobility',status:'done',due:'2026-08-20'},
      {id:'t3',clientId:'c2',kind:'homework',odWorkoutId:'ow3',title:'Archived client',status:'open',due:'2026-08-10'},
      {id:'t4',clientId:'c1',kind:'habit',title:'Woda',status:'open'}
    ]
  },
  TASKS:null,
  CL:null,
  notify:()=>{},
  addNotification:(t,title,body,screen)=>notes.push({t,title,body,screen}),
  pushMsg:(id,t)=>msgs.push({id,t}),
  persistById:(col,obj)=>persisted.push({col,id:obj&&obj.id}),
  renderDashHwFollowup:()=>{},
  todayYmd:()=>'2026-08-24',
  console
};
sandbox.CL=sandbox.window.CL;
sandbox.TASKS=sandbox.window.TASKS;
sandbox.window.TASKS=sandbox.TASKS;
sandbox.window.CL=sandbox.CL;

vm.runInNewContext(
  extract(src01,'isHomework')+'\n'+
  extract(src01,'openHomeworkTasks')+'\n'+
  extract(src01,'clientOpenHomework')+'\n'+
  extract(src09,'remindHomework')+'\n'+
  'window.isHomework=isHomework;window.openHomeworkTasks=openHomeworkTasks;window.clientOpenHomework=clientOpenHomework;window.remindHomework=remindHomework;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('isHomework',sandbox.isHomework({kind:'homework'}),true);
eq('open skips done+archived',sandbox.openHomeworkTasks().map(t=>t.id),['t1']);
eq('client open',sandbox.clientOpenHomework('c1').map(t=>t.id),['t1']);
eq('overdue first',sandbox.openHomeworkTasks()[0].due,'2026-08-01');

msgs.length=0;notes.length=0;persisted.length=0;
eq('remind ok',sandbox.remindHomework('t1'),true);
eq('remind chat',msgs.length>=1&&msgs[0].id==='c1',true);
eq('remind flag',!!sandbox.window.TASKS.find(t=>t.id==='t1').remindedAt,true);
eq('remind done blocked',sandbox.remindHomework('t2'),false);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll dash homework follow-up tests passed');
