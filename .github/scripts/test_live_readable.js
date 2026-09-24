'use strict';
// Run production render functions with DOM/storage boundaries stubbed.
const fs=require('fs'), vm=require('vm'), assert=require('assert');
const src=fs.readFileSync('02-workouts-onboarding-templates-live.js','utf8');
const slots=[0,1].map(n=>({clientId:'c'+n,planId:'p'+n,currentDayIdx:0,sessionActive:false,exercises:[]}));
const nodes=new Map();
let calls=0;
const ctx={window:{},console,PL:slots.map((s,n)=>({id:s.planId,clientId:s.clientId,name:'Plan '+n,days:[{day:'Dzień A'},{day:'Dzień B'}]})),
  liveN:n=>n===1?1:0,liveRef:n=>slots[n||0],liveSlotArg:n=>n===1?',1':'',
  liveEl:(id,n)=>{const k=id+n;if(!nodes.has(k))nodes.set(k,{innerHTML:'',style:{}});return nodes.get(k);},
  escHtml:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  liveExPlannedReps:()=> '8–12',liveExHistoryList:()=>[],liveExLastWorkSets:()=>[],liveExLastSummary:()=>'',
  liveExTitleHtml:ex=>'<div class="live-ex-title">'+ex.name+'</div>',livePolishCoachNote:s=>s,
  liveExTargetLine:()=> '4 × 8–12 · przerwa 90 s',liveExCuePack:()=>{calls++;return {};},liveExCueStripHtml:()=>'',
  liveAltsHtml:()=>'<div>Zamienniki</div>',renderLivePeriod:()=>{},liveSyncRestRecommend:()=>{},liveSaveDraft:()=>{}
};
vm.createContext(ctx);
for(const name of ['renderLivePlanPicker','renderLiveExercises','liveExCard','liveToggleCollapse','liveToggleSwap','liveSkipEx']){
 const m=src.match(new RegExp('function '+name+'\\([^]*?\\n}'));
 assert(m,name);vm.runInContext(m[0],ctx);
}
function ex(count){return {name:'Wyciskanie na maszynie — długa nazwa ćwiczenia',note:'Kontroluj ruch',done:false,sets:Array.from({length:count},(_,i)=>({setNo:i+1,kg:'40',reps:'10',rir:'2',done:false}))};}
slots[0].exercises=[ex(4),ex(2),ex(6)];slots[1].exercises=[ex(2)];
ctx.renderLivePlanPicker(0);
let picker=ctx.liveEl('live-plan-picker',0).innerHTML;
assert(picker.includes('Dzień A')&&picker.includes('3 ćwiczeń'));
assert(!/<details class="live-prep-board" open/.test(picker),'ready picker collapsed');
ctx.renderLiveExercises(0);
let markup=ctx.liveEl('live-exercises-panel',0).innerHTML;
assert.equal(calls,1,'one shared cue pack per render');
assert(markup.includes('4 serie × 8–12 powt.')&&markup.includes('6 serii × 8–12 powt.'));
assert.equal((markup.match(/class="live-set-row/g)||[]).length,4,'first exercise rows visible before start');
assert(markup.includes('Wykonano 0/4'));
assert(/<details class="live-ex-details"><summary>/.test(markup),'notes closed by default');
slots[0].sessionActive=true;
ctx.renderLiveExercises(0);ctx.liveToggleCollapse(1,0);ctx.renderLiveExercises(0);
assert.equal(slots[0].exercises[1].collapsed,false,'manually opened next exercise stays open');
ctx.liveToggleCollapse(1,0);ctx.renderLiveExercises(0);
assert.equal(slots[0].exercises[1].collapsed,true,'manual close persists');
ctx.liveToggleSwap(1,0);
assert.equal(slots[0].exercises[1].collapsed,false,'swap opens collapsed exercise');
ctx.liveSkipEx(1,0);assert.equal(slots[0].exercises[1].collapsed,true,'skip closes manually opened card');
ctx.renderLiveExercises(1);ctx.liveToggleCollapse(0,1);
assert.equal(slots[0].exercises[0].collapsed,false,'slot B actions do not change slot A');
assert.equal(slots[0].exercises[0].sets[0].kg,'40','render preserves load');
slots[0].exercises=[];ctx.renderLivePlanPicker(0);
assert(/<details class="live-prep-board" open/.test(ctx.liveEl('live-plan-picker',0).innerHTML),'empty day keeps picker open');
console.log('Live readable render/state regression checks passed');
