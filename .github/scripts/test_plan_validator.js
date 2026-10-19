#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.join(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'12-plan-validator.js'),'utf8');
const sandbox={window:{},console,Date,Object,Array,Number,String,Math};
vm.createContext(sandbox);vm.runInContext(src,sandbox);
let failed=0;
function ok(name,cond){if(!cond){failed++;console.error('FAIL',name);}else console.log('OK  ',name);}
const valid={days:[{dayName:'A',exercises:[{name:'Przysiad',muscleGroup:'Quady',sets:'3',reps:'6–8',rest:'120 s',rir:'2'},{name:'Wyciskanie',muscleGroup:'Klatka',sets:'3',reps:'8-10',rest:'90s',rir:'2'}]}],weekKeys:['w1','w2','w3'],phases:{w1:'Akumulacja',w2:'Pik',w3:'Deload'}};
valid.days[0].exercises[0].w1={s:'3',kg:'80'};valid.days[0].exercises[0].w2={s:'3',kg:'85'};valid.days[0].exercises[0].w3={s:'2',kg:'80'};
valid.days[0].exercises[1].w1={s:'3',kg:'60'};valid.days[0].exercises[1].w2={s:'3',kg:'62.5'};valid.days[0].exercises[1].w3={s:'2',kg:'60'};
const report=sandbox.window.plValidatePlan(valid,{source:'test'});
ok('exports validator',typeof sandbox.window.plValidatePlan==='function'&&typeof sandbox.window.plRenderPlanValidation==='function');
ok('exports immutable default policy',sandbox.window.PL_DEFAULT_PLAN_POLICY&&sandbox.window.PL_DEFAULT_PLAN_POLICY.version==='2026.1'&&typeof sandbox.window.plPlanPolicy==='function');
ok('unknown exercise warning',report.issues.some(x=>x.code==='EXERCISE_UNKNOWN'));
sandbox.window.allExercises=()=>[{id:'bench-1',name:'Wyciskanie sztangi leżąc',aka:'Bench press',cat:'Klatka',muscle:'Klatka, Triceps',eq:'Sztanga'}];
const resolved=sandbox.window.plResolveExercise('Bench press');
ok('catalog resolves aliases',resolved&&resolved.id==='bench-1'&&resolved.equipment==='Sztanga');
const known=sandbox.window.plValidatePlan({days:[{exercises:[{name:'Bench press',sets:'3',reps:'8',rir:'2'}]}]});
ok('catalog resolves muscle and removes unknown warning',known.computed.weeklyVolume.klatka===3&&!known.issues.some(x=>x.code==='EXERCISE_UNKNOWN'));
ok('catalog counts secondary muscle fraction',known.computed.weeklyVolume.triceps===1.5);
sandbox.window.volumeGuideForLevel=()=>({label:'Średni',note:'Zakres orientacyjny.',parts:{Klatka:'10–16',Plecy:'12–18',Barki:'12–18',Biceps:'8–12',Triceps:'8–12',Quady:'12–18','Tył uda':'10–16',Pośladki:'10–14',Brzuch:'6–10',Łydki:'8–14'}});
const guided=sandbox.window.plValidatePlan(valid,{client:{level:'sredni',physiquePriority:['upper_chest']}});
ok('priority volume below guide is a warning, not a block',guided.valid&&guided.issues.some(x=>x.code==='PRIORITY_VOLUME_BELOW_GUIDE'));
ok('client level guide is included in computed output',guided.computed.volumeGuide&&guided.computed.volumeGuide.level==='sredni');
const excessive=sandbox.window.plValidatePlan({days:[{exercises:[{name:'Bench press',sets:'20',reps:'8',rir:'2'}]}]},{client:{level:'sredni'}});
ok('volume over client level guide warns',excessive.issues.some(x=>x.code==='VOLUME_ABOVE_LEVEL_GUIDE'));
const longDay=sandbox.window.plValidatePlan({days:[{dayName:'FBW',exercises:Array.from({length:6},(_,i)=>({name:'Ćwiczenie '+i,muscleGroup:'Klatka',sets:'6',reps:'8',rir:'2'}))}]});
ok('overloaded training day is surfaced as a warning',longDay.computed.dayWorkSets[0].sets===36&&longDay.issues.some(x=>x.code==='DAY_VOLUME_HIGH'));
sandbox.window.SE=[
  {clientId:'c-live',source:'live',date:'2026-10-18',exercises:[{sets:[{rir:'0',done:true},{rir:'1',done:true},{rir:'0',done:true}]}]},
  {clientId:'c-live',source:'live',date:'2026-10-16',exercises:[{sets:[{rir:'1',done:true},{rir:'1',done:true},{rir:'1',done:true}]}]}
];
const fatigued=sandbox.window.plValidatePlan(valid,{client:{id:'c-live',level:'sredni'}});
ok('Live RIR trend is surfaced as a non-blocking warning',fatigued.valid&&fatigued.computed.liveEffort&&fatigued.issues.some(x=>x.code==='LIVE_EFFORT_HIGH'));
const limitations=sandbox.window.plValidatePlan({days:[{exercises:[{name:'Martwy ciąg RDL',sets:'3',reps:'8',rir:'2'}]}]},{client:{injuries:'Ból kręgosłupa lędźwiowego'}});
ok('reported limitation asks for trainer review, without blocking save',limitations.valid&&limitations.computed.limitationReviews.length===1&&limitations.issues.some(x=>x.code==='LIMITATION_REVIEW_REQUIRED'));
ok('high-risk warnings set explicit trainer-review status',limitations.requiresTrainerReview&&fatigued.requiresTrainerReview);
ok('valid plan accepted',report.valid===true&&report.summary.errors===0);
ok('counts direct weekly volume',report.computed.weeklyVolume.quady===3&&report.computed.weeklyVolume.klatka===3);
ok('phase volume exists',report.computed.phaseVolume.w3.quady===2);
ok('deload is lower',!report.issues.some(x=>x.code==='DELOAD_VOLUME_NOT_REDUCED'));
const broken={days:[{exercises:[{name:'',sets:'0',reps:'0',rir:'14'},{name:'',sets:'3',reps:'10'}]}]};
const bad=sandbox.window.plValidatePlan(broken);
ok('invalid structure blocked',bad.valid===false&&bad.summary.errors>=3);
ok('unclassified volume warns',bad.issues.some(x=>x.code==='MUSCLE_UNCLASSIFIED'));
const jump=JSON.parse(JSON.stringify(valid));jump.days[0].exercises[0].w2.kg='120';
ok('large load jump warns',sandbox.window.plValidatePlan(jump).issues.some(x=>x.code==='LOAD_CHANGE_HIGH'));
const tolerant=sandbox.window.plValidatePlan(jump,{policy:{version:'test-policy',maxWeeklyLoadChange:1}});
ok('approved policy override is local and versioned',tolerant.policyVersion==='test-policy'&&!tolerant.issues.some(x=>x.code==='LOAD_CHANGE_HIGH'));
const withRest={days:[{rest:true,exercises:[]},{dayName:'B',exercises:[{name:'Wiosłowanie',muscleGroup:'Plecy',sets:'3',reps:'8',rir:'2'}]}]};
ok('rest day does not require exercises',sandbox.window.plValidatePlan(withRest).valid===true);
ok('html report is deterministic surface',/Plan Health/.test(sandbox.window.plRenderPlanValidation(report))&&/Objętość wyliczona/.test(sandbox.window.plRenderPlanValidation(report))&&/Ostatnie sesje Live/.test(sandbox.window.plRenderPlanValidation(fatigued))&&/Zakres poziomu/.test(sandbox.window.plRenderPlanValidation(guided))&&/Potwierdzenie trenera wymagane/.test(sandbox.window.plRenderPlanValidation(limitations)));
if(failed){console.error(failed+' failed');process.exit(1);}console.log('Plan validator tests passed');
