'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const core=fs.readFileSync('01-core.js','utf8'),ui=fs.readFileSync('08-client-profile-extras.js','utf8');
const ctx={window:{SE:[],PL:[]},console,latestClientPlan:()=>({id:'B'}),cpOverviewWeekBounds:()=>({from:'2026-09-21',to:'2026-09-27'}),newId:()=> 'saved-b'};
vm.createContext(ctx);
const load=(src,name)=>{const f=src.match(new RegExp('function '+name+'\\([^]*?\\n}'));assert(f,name);vm.runInContext(f[0],ctx);};
for(const f of ['isLoggedWorkout','sessionIsRecorded','sessionIsSkipped','sessionMatchesPlanned','sessionHappened','logSessionFromPlanned'])load(core,f);
for(const f of ['cpBriefIsLogged','cpAssignmentSessions','cpCollapseDaySessions','cpOverviewPlanDayStatus'])load(ui,f);
const p={id:'p-b',clientId:'c1',planId:'B',dayIdx:0,date:'2026-09-21',source:'planned'};
const a={id:'a',clientId:'c1',planId:'A',dayIdx:0,date:p.date,source:'live',feedback:2};
ctx.window.SE=[p,a];
assert.equal(ctx.sessionHappened(p),false);
assert(ctx.cpAssignmentSessions('c1').some(s=>s.id==='p-b'),'A must not hide B');
assert.equal(ctx.cpOverviewPlanDayStatus('c1',{},0,{weekday:1,name:'A'},'2026-09-24','B'),'Niezapisany');
const b={...a,id:'b',planId:'B'};
assert(ctx.sessionMatchesPlanned(p,b));
for(const other of [{...b,clientId:'c2'},{...b,planId:'A'},{...b,planId:null},{...b,dayIdx:1},{...b,date:'2026-09-22'},{...b,source:'live-draft'},{...b,plannedSessionId:'another'}])assert.equal(ctx.sessionMatchesPlanned(p,other),false);
const saved=ctx.logSessionFromPlanned(p.id,ctx.window.SE,{feedback:5,duration:40,skipPackage:true});
assert.equal(saved.planId,'B');assert.equal(saved.plannedSessionId,p.id);assert.equal(a.feedback,2,'do not edit A');
assert.equal(ctx.logSessionFromPlanned(p.id,ctx.window.SE,{feedback:4,skipPackage:true}).id,saved.id,'repeat save idempotent');
assert.equal(ctx.window.SE.length,3);assert(ctx.sessionHappened(p));
assert(!ctx.cpAssignmentSessions('c1').some(s=>s.id===p.id),'matched B hides its planned tile');
assert.equal(ctx.cpOverviewPlanDayStatus('c1',{},0,{weekday:1,name:'A'},'2026-09-24','B'),'Wykonany');
assert.equal(ctx.cpCollapseDaySessions([{...p,type:'FBW'},{...a,type:'FBW'}]).groups.length,2,'different plans do not share tile');
Object.assign(ctx,{c:{id:'c1'},allSessions:ctx.window.SE,logged:[a,saved,{...a,id:'free',date:'2026-09-22',planId:null}],weekFrom:'2026-09-21',weekTo:'2026-09-27',todayStr:'2026-09-24'});
const start=ui.indexOf('  const datesIn=list=>',ui.indexOf('function renderCPTraining'));
const end=ui.indexOf('  const nologN=',start);
vm.runInContext(ui.slice(start,end)+';this.counts=[doneWeek.size,plannedToToday.length,extraWeek,done30.size,planned30.length,extra30];',ctx);
assert.equal(JSON.stringify(ctx.counts),'[1,1,2,1,1,2]');
console.log('Profile plan isolation, matching, save and counter regressions passed');
// Production Progress template: empty workouts must not hide independent measurements.
const body={innerHTML:''};let rows=[];let briefCalls=0;
Object.assign(ctx,{
 document:{getElementById:()=>body},completedWorkouts:()=>rows,clientWeeklyVolumeStats:()=>[],
 cpClientAdherence:()=>({assigned:0,logged:0,pct:0}),cpSortedMetricEntries:x=>x,
 cpMetricPoints:()=>[],cpCheckinTrendPoints:()=>[],cpHabitAdherenceWeekly:()=>[],
 escHtml:x=>String(x??''),setCPProgressPanel:()=>{},cpWeeklyDualChart:()=>'<svg></svg>',
 cpRatingTrendChart:()=>'',cpPrBarChart:()=>'',cpHorizontalBars:()=>'<div>strength-values</div>',
 cpNextSessionBriefHtml:()=>{briefCalls++;return '<div>next-session</div>';},cpExerciseProgressPanelHtml:()=>'<div>exercise-analysis</div>'
});
ctx.window.METRIC_ENTRIES=[{clientId:'c1',groupId:'mg1',date:'2026-09-24',values:{m1:100}},{clientId:'c1',groupId:'mg3',date:'2026-09-24',values:{m1:80}}];
load(ui,'renderCPProgress');ctx.renderCPProgress({id:'c1'});
assert(body.innerHTML.includes('cp-progress-empty'));assert(body.innerHTML.includes('Rozpocznij trening'));
assert(!body.innerHTML.includes('Tonaż tygodniowy'));assert(!body.innerHTML.includes('Rekordy z treningów'));assert.equal(briefCalls,0);
assert(body.innerHTML.includes('100'));assert(body.innerHTML.includes('strength-values'),'strength measurements remain visible');
rows=[{id:'real',clientId:'c1',source:'live'}];ctx.renderCPProgress({id:'c1'});
assert(!body.innerHTML.includes('cp-progress-empty'));assert(body.innerHTML.includes('Tonaż tygodniowy'));assert.equal(briefCalls,1);
console.log('Empty/recorded Progress rendering and independent measurement checks passed');
