// Progress Nawyki: biblioteka + przypisywanie pakietu w panelu trenera.
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const src01=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src06=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('habit library',/const HABIT_LIBRARY=\[/.test(src01)&&src01.includes("id:'m1'")&&src01.includes("phase:'evening'"));
ok('assign helper',src01.includes('function assignHabitLibraryToClient')&&src01.includes('function habitTaskFromLibrary'));
ok('xp helpers',src01.includes('function clientHabitXpTotal')&&src01.includes('function habitXpOf'));
ok('modal html',html.includes('id="m-habit-pack"')&&html.includes('habit-pack-list'));
ok('trainer button',html.includes('openHabitPackModal()')&&/Progress Nawyki/.test(html));
ok('pack js',src06.includes('function openHabitPackModal')&&src06.includes('function confirmHabitPackAssign')&&src06.includes('habitPackBannerHTML'));
ok('banner css',css.includes('.habit-pack-banner')&&css.includes('.habit-pack-row'));
ok('client phases',/clientHabitXpTotal/.test(src04)&&/HABIT_PHASE_ORDER/.test(src04));

const document={
  querySelectorAll:()=>[],
  getElementById:()=>null,
  addEventListener(){}
};
const windowObj={
  addEventListener(){},
  CL:[{id:'c1',name:'Anna'}],
  TASKS:[],
  PL:[],SE:[],EX:[],WO:[],
  METRIC_ENTRIES:[],
  document
};
windowObj.window=windowObj;
const ctx={
  window:windowObj,
  document,
  console,
  Date,Math,parseInt,parseFloat,Number,String,Array,Object,JSON,Set,
  setTimeout,clearTimeout,isNaN,Infinity,undefined
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src01,ctx);

ok('library size',(windowObj.HABIT_LIBRARY||[]).length>=12);

const task=ctx.habitTaskFromLibrary('m2','c1');
ok('task from lib',!!(task&&task.kind==='habit'&&task.libId==='m2'&&task.xp===5&&task.phase==='morning'));

(async()=>{
  windowObj.TASKS=[];
  const n=await ctx.assignHabitLibraryToClient('c1',['m1','m2','mv1']);
  ok('assign 3',n===3&&windowObj.TASKS.length===3);
  const n2=await ctx.assignHabitLibraryToClient('c1',['m1','m2']);
  ok('assign skip dupes',n2===0&&windowObj.TASKS.length===3);
  windowObj.TASKS[0].doneDates=['2026-08-01','2026-08-02'];
  const xp=ctx.clientHabitXpTotal('c1');
  ok('xp total',xp===30); // m1=15 * 2 days
  ok('cache bumps',html.includes('01-core.js?v=46')&&html.includes('06-inbox-exercises-ai-programs.js?v=33')&&html.includes('04-client-portal.js?v=34')&&html.includes('styles.css?v=51'));
  ok('cache bumps',html.includes('01-core.js?v=47')&&html.includes('06-inbox-exercises-ai-programs.js?v=33')&&html.includes('04-client-portal.js?v=35')&&html.includes('styles.css?v=51'));

  if(failed){console.error('\n'+failed+' failed');process.exit(1);}
  console.log('\nAll progress-nawyki port tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
