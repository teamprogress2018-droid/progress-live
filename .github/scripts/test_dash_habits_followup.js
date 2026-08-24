#!/usr/bin/env node
/** Dashboard habits/challenges follow-up helpers. */
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

if(!html.includes('id="dash-habit-followup"')){console.error('FAIL missing dash-habit-followup');process.exit(1);}
if(!src04.includes('function renderDashHabitFollowup')){console.error('FAIL missing renderDashHabitFollowup');process.exit(1);}
if(!src04.includes('renderDashHabitFollowup()')){console.error('FAIL renderDash missing habit call');process.exit(1);}
if(!src10.includes("setBadge('clive-bn-home'")){console.error('FAIL home habit badge missing');process.exit(1);}
if(!src09.includes('function remindHabit')){console.error('FAIL missing remindHabit');process.exit(1);}

const msgs=[];
const notes=[];
const sandbox={
  window:{
    CL:[
      {id:'c1',name:'Anna',status:'active'},
      {id:'c2',name:'Bartek',status:'active'},
      {id:'c3',name:'Arch',status:'archived'}
    ],
    TASKS:[
      {id:'h1',clientId:'c1',kind:'habit',title:'Woda',doneDates:['2026-08-22','2026-08-23']},
      {id:'h2',clientId:'c1',kind:'habit',title:'Sen',doneDates:['2026-08-24']},
      {id:'h3',clientId:'c3',kind:'habit',title:'Archived',doneDates:[]},
      {id:'ch1',clientId:'c2',kind:'challenge',title:'21 dni',start:'2026-08-10',days:21,target:21,doneDates:['2026-08-10','2026-08-11']},
      {id:'ch2',clientId:'c2',kind:'challenge',title:'Done today',start:'2026-08-20',days:7,target:7,doneDates:['2026-08-24']},
      {id:'hw1',clientId:'c1',kind:'homework',title:'HIIT',status:'open'}
    ]
  },
  TASKS:null,
  CL:null,
  notify:()=>{},
  addNotification:(t,title,body,screen)=>notes.push({t,title,body,screen}),
  pushMsg:(id,t)=>msgs.push({id,t}),
  persistById:()=>{},
  renderDashHabitFollowup:()=>{},
  todayYmd:()=>'2026-08-24',
  console,
  Set
};
sandbox.CL=sandbox.window.CL;
sandbox.TASKS=sandbox.window.TASKS;
sandbox.window.TASKS=sandbox.TASKS;
sandbox.window.CL=sandbox.CL;

const helpers=[
  'ymdAdd','isHabit','isChallenge','isHomework','habitDoneOn','habitStreak',
  'parseChallengeDays','parseChallengeTarget','challengeBounds','challengeProgress',
  'pendingHabitTasks','pendingChallengeTasks','clientPendingHabits'
].map(n=>extract(src01,n)).join('\n');

vm.runInNewContext(
  helpers+'\n'+
  extract(src09,'remindHabit')+'\n'+
  'window.isHabit=isHabit;window.isChallenge=isChallenge;window.habitDoneOn=habitDoneOn;'+
  'window.habitStreak=habitStreak;window.challengeProgress=challengeProgress;'+
  'window.pendingHabitTasks=pendingHabitTasks;window.pendingChallengeTasks=pendingChallengeTasks;'+
  'window.clientPendingHabits=clientPendingHabits;window.remindHabit=remindHabit;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('pending habits skip done+archived',sandbox.pendingHabitTasks(null,'2026-08-24').map(t=>t.id),['h1']);
eq('pending challenges',sandbox.pendingChallengeTasks(null,'2026-08-24').map(t=>t.id),['ch1']);
eq('client pending both',sandbox.clientPendingHabits('c1').map(t=>t.id),['h1']);
eq('client c2 challenge',sandbox.clientPendingHabits('c2').map(t=>t.id),['ch1']);

msgs.length=0;notes.length=0;
eq('remind habit ok',sandbox.remindHabit('h1'),true);
eq('remind chat',msgs.length>=1&&msgs[0].id==='c1',true);
eq('remind done blocked',sandbox.remindHabit('h2'),false);
eq('remind challenge ok',sandbox.remindHabit('ch1'),true);
eq('remind challenge done blocked',sandbox.remindHabit('ch2'),false);
eq('remind homework blocked',sandbox.remindHabit('hw1'),false);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll dash habits follow-up tests passed');
