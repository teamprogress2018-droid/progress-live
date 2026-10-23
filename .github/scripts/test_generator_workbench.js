'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const api=require(path.join(root,'generator-workbench.js'));
const clone=x=>JSON.parse(JSON.stringify(x));
function plan(){return {planName:'Plan A',weekKeys:['w1','w2'],currentWeek:'w2',weeks:2,days:[{dayName:'A',exercises:[{name:'Wyciskanie sztangi',cat:'Klatka',sets:'3',reps:'8-10',rest:'90s',kg:'80',w1:{s:'3',r:'8-10',kg:'80'},w2:{s:'3',r:'8-10',kg:'100'}}]},{dayName:'B',exercises:[{name:'Przysiad',cat:'Nogi',sets:'3',reps:'8',kg:'60'}]}]};}
function rec(action,confidence='high',lastKg=80){return {action,confidence,reasons:['Historia klienta'],facts:{lastKg,avgReps:8}};}
const r=api.rules();
assert.throws(()=>api.rules({maxIncreasePct:99}));
assert.throws(()=>api.rules({preferred:'Przysiad',excluded:'przysiad'}));
let p=plan(),before=JSON.stringify(p);
let proposal=api.proposeAdapt(p,r,()=>rec('DODAJ CIĘŻAR'));
assert.equal(JSON.stringify(p),before,'proposal never mutates source');
assert.equal(proposal.candidate.days[0].exercises[0].w2.kg,'82.5','increase based on actual result, not scheduled 100');
assert.equal(proposal.candidate.days[0].exercises[0].w1.kg,'80','previous week preserved');
assert.equal(api.proposeAdapt(p,r,()=>rec('DODAJ CIĘŻAR','low')).changes.length,0);
assert.equal(api.proposeAdapt(p,api.rules({maxIncreasePct:0}),()=>rec('DODAJ CIĘŻAR')).changes.length,0);
assert.equal(api.proposeAdapt(p,r,()=>rec('DELOAD')).changes.length,0,'deload not automatically invented');
assert.equal(api.proposeAdapt({...p,phases:{w2:'Deload'}},r,()=>rec('DODAJ CIĘŻAR')).changes.length,0,'planned deload preserved');
assert.equal(api.proposeAdapt(p,r,()=>rec('DODAJ POWTÓRZENIA')).candidate.days[0].exercises[0].w2.r,'9–10','keep upper bound of rep range');
p.days[0].exercises[0].w2.kg='75% 1RM';
assert.equal(api.proposeAdapt(p,r,()=>rec('DODAJ CIĘŻAR')).candidate.days[0].exercises[0].w2.kg,'75% 1RM');
global.exLoadUnit=()=> 's';
assert.equal(api.proposeAdapt(plan(),r,()=>rec('DODAJ CIĘŻAR')).changes.length,0,'timed activities never get kg');
delete global.exLoadUnit;
const lib=[{name:'Wyciskanie sztangi',cat:'Klatka',eq:'Sztanga'},{name:'Wyciskanie hantli',cat:'Klatka',eq:'Hantle'},{name:'Wyciskanie barków',cat:'Klatka',eq:'Hantle'},{name:'Przysiad',cat:'Nogi',eq:'Hantle'}];
const swaps=api.rankSwaps(lib[0],lib,r,'Hantle');
assert.equal(swaps.length,1);assert.equal(swaps[0].exercise.name,'Wyciskanie hantli');
assert.equal(api.rankSwaps(lib[0],lib,api.rules({excluded:'Wyciskanie hantli'}),'Hantle').length,0);
p=plan();const emergency=api.emergency(p,r,{skipDay:1,minutes:15});
assert.equal(emergency.candidate.days.length,1);assert.equal(emergency.candidate.weeks,1);
assert.deepEqual(emergency.candidate.weekKeys,['w2']);assert.equal(p.days.length,2);
assert.ok(!emergency.candidate.days[0].exercises[0].w1);
assert.ok(Number(emergency.candidate.days[0].exercises[0].w2.s)>=1);
assert.throws(()=>api.emergency({days:[{exercises:[]}]},r,{skipDay:0}));
assert.throws(()=>api.emergency(p,r,{skipDay:-1,minutes:1}));
for(let i=0;i<9;i++)p.generatorHistory=api.addRevision(p,'v'+i);
assert.equal(p.generatorHistory.length,5);
assert.ok(p.generatorHistory.every(v=>!v.snapshot.generatorHistory),'no recursive histories');
assert.equal(api.audit(plan(),api.rules({maxWeeklySets:2})).issues.length,2);

// Run the real DOM-facing handlers and existing saved-plan serializer together.
const nodes={};
for(const id of ['gwb-panel','gwb-preview','gwb-rules','gwb-saved-plan','apl-client'])nodes[id]={value:id==='apl-client'?'client-a':'',innerHTML:'',scrollIntoView(){}};
const messages=[],dbWrites=[];
const context={console,Date,Math,JSON,Map,Set,WeakMap,document:{getElementById:id=>nodes[id]||null,addEventListener(){}},
  _uid:'trainer-a',tenantSessionGeneration:1,_clientAppMode:false,SETTINGS:{},
  notify:m=>messages.push(m),aplLastPlan:plan(),aplLastClient:{id:'client-a'},
  aplRerenderCurrent(){context.gwbRender(context.aplLastPlan,context.aplLastClient);},
  exerciseProgressClass:()=>({}),recommendExerciseProgress:()=>rec('DODAJ CIĘŻAR'),
  allExercises:()=>lib,withTrainer:x=>({...x,trainerId:'trainer-a'}),
  persistSettingsDoc:async()=>false,PL:[],CL:[],persistById:async(c,x)=>{dbWrites.push(clone(x));return x;}};
context.window=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'generator-workbench.js'),'utf8'),context);
const src=fs.readFileSync(path.join(root,'03-ai-plangen-bizstats-aicoach.js'),'utf8');
vm.runInContext(src.slice(src.indexOf('function aplBuildSavedPlan('),src.indexOf('window.aplBuildSavedPlan=') ),context);
context.gwbRender(context.aplLastPlan,context.aplLastClient);
context.gwbAdapt();assert.equal(dbWrites.length,0);
assert.match(nodes['gwb-preview'].innerHTML,/82.5/);
const old=context.aplLastPlan;
nodes['apl-client'].value='client-b';context.gwbApprove();assert.equal(context.aplLastPlan,old,'client switch blocks approval');
nodes['apl-client'].value='client-a';context.gwbAdapt();context.aplLastPlan.days[0].exercises[0].kg='90';
context.gwbApprove();assert.equal(context.aplLastPlan,old,'stale draft blocked');
context.gwbAdapt();context.gwbApprove();assert.notEqual(context.aplLastPlan,old);
assert.equal(context.aplLastPlan.days[0].exercises[0].w2.kg,'82.5');
assert.ok(context.aplLastPlan.generatorHistory.length);
let metadata=context.gwbSaveMetadata(context.aplLastPlan);
assert.deepEqual(clone(context.gwbSaveMetadata(context.aplLastPlan)),clone(metadata),'stable metadata for idempotent retry');
const saved=context.aplBuildSavedPlan(context.aplLastPlan,'client-a',{name:'A'},'plan-a');
assert.equal(saved.days[0].exercises[0].w2.kg,'82.5');assert.ok(saved.generatorHistory.length);
context.gwbAfterSave(context.aplLastPlan,saved);
assert.deepEqual(clone(context.gwbSaveMetadata(context.aplLastPlan)),clone(metadata),'history does not change save signature');
assert.equal(context.gwbBeforeSave(context.aplLastPlan),true);
context.gwbSwap(0,0);context.gwbPickSwap(0);context.gwbApprove();
assert.equal(context.aplLastPlan.days[0].exercises[0].name,'Wyciskanie hantli');
assert.equal(context.aplLastPlan.days[0].exercises[0].w2.kg,'','new exercise clears old load');
assert.equal(context.aplLastPlan.days[0].exercises[0].kg,'');
const swapSaved=context.aplBuildSavedPlan(context.aplLastPlan,'client-a',{name:'A'},'plan-b');
assert.equal(swapSaved.days[0].exercises[0].kg,'');
context._uid='trainer-b';assert.equal(context.gwbBeforeSave(context.aplLastPlan),false);
context._uid='trainer-a';
context.SETTINGS.generatorRules={instructions:'old'};
for(const [k,v] of Object.entries({...r,instructions:'new'}))nodes['gwb-'+k]={value:v};
(async()=>{
  await context.gwbSaveRules();assert.equal(context.SETTINGS.generatorRules.instructions,'old','failed settings write rolled back');
  context.persistSettingsDoc=async()=>true;await context.gwbSaveRules();assert.equal(context.SETTINGS.generatorRules.instructions,'new');
  context.gwbReset();assert.equal(nodes['gwb-panel'].innerHTML,'');assert.equal(nodes['gwb-rules'].innerHTML,'');
  console.log('Generator workbench: algorithms, approval, isolation, history, save retry and failed writes OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
