const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../10-client-app.js'),'utf8');
function extract(name){
  const start=source.indexOf('async function '+name+'(');assert(start>=0,name+' exists');
  const rest=source.slice(start+1),next=rest.search(/\n(?:async )?function /);
  return next<0?source.slice(start):source.slice(start,start+1+next);
}
const code=['clientConfirmWrite','clientCompleteHomework','cwFinish','ppSave'].map(extract).join('\n');
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(options={}){
  let sequence=0;const docs=new Map(),calls={writes:[],messages:[],notifications:[],notices:[],next:0,renders:0,closed:0,cleared:0};
  const wrap={hidden:false};
  const ctx={console,Date,Math,JSON,Promise,parseInt,parseFloat,
    _db:{},_uid:'login-a',_clientId:'client-a',_trainerId:'trainer-a',_clientAppMode:true,tenantSessionGeneration:1,
    CL:[{id:'client-a',name:'Anna Kowalska',trainerId:'trainer-a'}],TASKS:[],SE:[],PROGRESS_PHOTOS:[],
    document:{getElementById:()=>wrap,body:{classList:{remove(){}}}},
    captureClientTenantSession(){return {uid:ctx._uid,generation:ctx.tenantSessionGeneration};},
    requireClientTenantSession(session){if(!session||session.uid!==ctx._uid||session.generation!==ctx.tenantSessionGeneration)throw new Error('client-session-changed');},
    clientTenantError:code=>new Error(code),
    _doc:(_db,col,id)=>({col,id}),
    _getDoc:async ref=>{
      if(options.read)return options.read(ref,docs);
      const value=docs.get(ref.col+'/'+ref.id);return {id:ref.id,exists:()=>!!value,data:()=>clone(value)};
    },
    persistById:async(col,entry)=>{
      const payload=clone(entry);delete payload._fbId;const ref={col,id:entry._fbId||entry.id};
      calls.writes.push({ref,payload});
      const commit=()=>docs.set(col+'/'+ref.id,payload);
      if(options.write)return options.write({col,entry,payload,ref,commit,calls,docs});
      commit();entry._fbId=ref.id;return entry;
    },
    withTrainer(entry){if(entry.trainerId&&entry.trainerId!==ctx._trainerId)throw new Error('owner');return {...entry,trainerId:ctx._trainerId};},
    newId:prefix=>prefix+'_'+(++sequence),todayYmd:()=>'2026-09-26',
    homeworkRpeToFeedback:rpe=>Math.max(0,Math.min(5,Math.round(Number(rpe)/2))),
    notify:text=>calls.notices.push(text),pushClientMsg:text=>calls.messages.push(text),addNotification:(...args)=>calls.notifications.push(args),
    maybeScheduleNextHomework:()=>calls.next++,closeODPlayer:()=>calls.closed++,renderClientLive:()=>calls.renders++,cwClearTimers:()=>calls.cleared++,
    setCPTab:()=>calls.renders++
  };
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'client-confirmed-writes.js'});
  function homework(extra={}){
    const task={id:'task-a',trainerId:'trainer-a',clientId:'client-a',kind:'homework',title:'Mobilność',desc:'Plan',status:'open',odWorkoutId:'ow1',due:'2026-09-26',repeatLeft:2,...extra};
    ctx.TASKS=[task];docs.set('tasks/'+task.id,clone(task));return task;
  }
  function workout(){const cw={rating:4,elapsed:600,dayName:'A',planId:'plan-a',dayIdx:0,note:'OK',exercises:[{name:'Przysiad',sets:[{done:true,kg:20,reps:8,setNo:1}]}]};ctx._cw=cw;return cw;}
  function photos(){const draft={front:'data:image/jpeg;base64,front',side:'',back:'',weight:'70',note:'Kontrola',open:true};ctx._ppDraft=draft;return draft;}
  return {ctx,calls,docs,homework,workout,photos,wrap};
}
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
const confirmed={confirmed:true,rpe:8,duration:15};

(async()=>{
await test('failed homework session write leaves assignment open with no downstream effects',async()=>{
  const h=harness({write:async()=>null}),task=h.homework();
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),false);
  assert.equal(task.status,'open');assert.equal(task.doneAt,undefined);assert.equal(h.ctx.SE.length,0);
  assert.deepEqual(h.calls.writes.map(w=>w.ref.col),['sessions']);assert.equal(h.docs.get('tasks/task-a').status,'open');
  assert.equal(h.calls.messages.length,0);assert.equal(h.calls.notifications.length,0);assert.equal(h.calls.next,0);assert.equal(h.calls.closed,0);
  assert(!h.calls.notices.some(x=>x.startsWith('✓')));
});

await test('parent failure retries the same confirmed history record and only then runs effects once',async()=>{
  let failTask=true;
  const h=harness({write:async({col,entry,commit})=>{if(col==='tasks'&&failTask)return null;commit();return entry;}}),task=h.homework();
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),false);
  assert.equal(h.docs.get('sessions/hw_task-a').taskId,'task-a');assert.equal(task.status,'open');assert.equal(h.ctx.SE.length,0);assert.equal(h.calls.next,0);
  failTask=false;
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);
  assert.equal(task.status,'done');assert.equal(h.ctx.SE.length,1);assert.equal(h.ctx.SE[0].id,'hw_task-a');
  assert.equal(h.calls.writes.filter(w=>w.ref.col==='sessions').length,1);assert.equal(h.calls.messages.length,1);assert.equal(h.calls.next,1);
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);assert.equal(h.calls.next,1);assert.equal(h.calls.messages.length,1);
});

await test('a reloaded task after parent failure reuses deterministic history instead of duplicating it',async()=>{
  let failTask=true;
  const h=harness({write:async({col,entry,commit})=>{if(col==='tasks'&&failTask)return null;commit();return entry;}}),task=h.homework();
  await h.ctx.clientCompleteHomework(task.id,confirmed);
  h.ctx.TASKS=[clone(h.docs.get('tasks/task-a'))];h.ctx.SE=[];failTask=false;
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);
  assert.equal([...h.docs.keys()].filter(key=>key.startsWith('sessions/')).length,1);assert.equal(h.calls.writes.filter(w=>w.ref.col==='sessions').length,1);
});

await test('legacy done assignment without history is repaired under the deterministic session ID',async()=>{
  const h=harness(),task=h.homework({status:'done',doneAt:'2026-09-25T12:00:00.000Z'});
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);
  assert.equal(h.ctx.SE[0].id,'hw_task-a');assert.equal(h.ctx.SE[0].date,'2026-09-25');
});

await test('lost acknowledgement is recovered by a matching remote record before homework effects',async()=>{
  const h=harness({write:async({commit})=>{commit();return null;}}),task=h.homework();
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);assert.equal(h.ctx.SE.length,1);assert.equal(h.calls.next,1);assert.equal(h.calls.messages.length,1);
});

await test('failed workout write retains sets and draft, with no optimistic history or message',async()=>{
  let fail=true;
  const h=harness({write:async({entry,commit})=>{if(fail)return null;commit();return entry;}}),cw=h.workout();
  assert.equal(await h.ctx.cwFinish(),false);assert.equal(h.ctx._cw,cw);assert.equal(cw.exercises[0].sets[0].done,true);
  assert.equal(h.ctx.SE.length,0);assert.equal(h.calls.messages.length,0);assert.equal(h.calls.cleared,0);assert.equal(h.wrap.hidden,false);
  const id=cw.saveRecord.id;fail=false;assert.equal(await h.ctx.cwFinish(),true);
  assert.equal(h.ctx.SE.length,1);assert.equal(h.ctx.SE[0].id,id);assert.equal(h.ctx._cw,null);assert.equal(h.calls.messages.length,1);assert.equal(h.wrap.hidden,true);
  assert(h.calls.writes.every(w=>w.ref.id===id));
});

await test('photo failure preserves the draft and retry uses one immutable record',async()=>{
  let fail=true;const h=harness({write:async({entry,commit})=>{if(fail)return null;commit();return entry;}}),draft=h.photos();
  assert.equal(await h.ctx.ppSave('client-a'),false);assert.equal(h.ctx._ppDraft,draft);assert.equal(h.ctx.PROGRESS_PHOTOS.length,0);assert.equal(h.calls.messages.length,0);
  const id=draft.saveRecord.id;draft.side='data:image/jpeg;base64,side';fail=false;assert.equal(await h.ctx.ppSave('client-a'),true);
  assert.equal(h.ctx._ppDraft,null);assert.equal(h.ctx.PROGRESS_PHOTOS.length,1);assert.equal(h.ctx.PROGRESS_PHOTOS[0].id,id);assert.equal(h.calls.messages.length,1);
  assert.equal(h.ctx.PROGRESS_PHOTOS[0].photos.side,'data:image/jpeg;base64,side');
  assert(h.calls.writes.every(w=>w.ref.id===id));
});

await test('immutable photo lost-ack recovery compares maps independent of Firestore field order',async()=>{
  const h=harness({write:async({commit,docs,ref})=>{commit();const row=docs.get(ref.col+'/'+ref.id);row.photos={back:row.photos.back,side:row.photos.side,front:row.photos.front};return null;}});h.photos();
  assert.equal(await h.ctx.ppSave('client-a'),true);assert.equal(h.calls.writes.length,1);assert.equal(h.ctx.PROGRESS_PHOTOS.length,1);
});

await test('double-click during confirmation cannot create duplicate writes or completion effects',async()=>{
  const gate=deferred();let entered;
  const seen=new Promise(resolve=>{entered=resolve;});
  const h=harness({write:async({entry,commit})=>{entered();await gate.promise;commit();return entry;}});h.workout();
  const first=h.ctx.cwFinish();await seen;assert.equal(await h.ctx.cwFinish(),false);gate.resolve();
  assert.equal(await first,true);assert.equal(h.calls.writes.length,1);assert.equal(h.ctx.SE.length,1);assert.equal(h.calls.messages.length,1);
});

await test('an account change during save suppresses all old-account runtime effects',async()=>{
  const gate=deferred();let entered;const seen=new Promise(resolve=>{entered=resolve;});
  const h=harness({write:async({entry,commit})=>{entered();await gate.promise;commit();return entry;}});h.photos();
  const pending=h.ctx.ppSave('client-a');await seen;h.ctx._uid='login-b';h.ctx.tenantSessionGeneration++;h.ctx._ppDraft=null;
  gate.resolve();assert.equal(await pending,false);assert.equal(h.ctx.PROGRESS_PHOTOS.length,0);assert.equal(h.calls.messages.length,0);assert.equal(h.calls.notifications.length,0);assert.equal(h.calls.notices.length,0);
});

await test('foreign or conflicting existing documents cannot be overwritten as retry recovery',async()=>{
  const h=harness(),task=h.homework();h.docs.set('sessions/hw_task-a',{id:'hw_task-a',trainerId:'other',clientId:'other',source:'homework',taskId:'task-a'});
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),false);assert.equal(h.calls.writes.length,0);assert.equal(task.status,'open');assert.equal(h.calls.next,0);
  const photo=harness();photo.photos();photo.docs.set('progressPhotos/pp_1',{id:'pp_1',trainerId:'trainer-a',clientId:'client-a',photos:{front:'different'}});
  assert.equal(await photo.ctx.ppSave('client-a'),false);assert.equal(photo.calls.writes.length,0);assert.equal(photo.ctx.PROGRESS_PHOTOS.length,0);
});

await test('an unavailable confirmation read leaves draft retryable and does not attempt blind writes',async()=>{
  const h=harness({read:async()=>{throw new Error('offline');}}),cw=h.workout();
  assert.equal(await h.ctx.cwFinish(),false);assert.equal(h.ctx._cw,cw);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.messages.length,0);
});

await test('owner-only missing-document read denial still permits a confirmed authorized create',async()=>{
  const h=harness({read:async(ref,docs)=>{
    const value=docs.get(ref.col+'/'+ref.id);
    if(!value)throw Object.assign(new Error('Missing resource cannot prove owner'),{code:'permission-denied'});
    return {id:ref.id,exists:()=>true,data:()=>clone(value)};
  }}),task=h.homework();
  assert.equal(await h.ctx.clientCompleteHomework(task.id,confirmed),true);assert.equal(h.ctx.SE.length,1);
  h.photos();assert.equal(await h.ctx.ppSave('client-a'),true);assert.equal(h.ctx.PROGRESS_PHOTOS.length,1);
  h.workout();assert.equal(await h.ctx.cwFinish(),true);assert.equal(h.ctx.SE.length,2);
});

await test('a missing-document denial after account change cannot initiate an old-account write',async()=>{
  let rejectRead;const gate=new Promise((_resolve,reject)=>{rejectRead=reject;});
  const h=harness({read:()=>gate});h.photos();const pending=h.ctx.ppSave('client-a');
  h.ctx.tenantSessionGeneration++;h.ctx._uid='login-b';h.ctx._ppDraft=null;
  rejectRead(Object.assign(new Error('denied'),{code:'permission-denied'}));
  assert.equal(await pending,false);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.messages.length,0);
});

console.log('\n'+count+' confirmed-write scenarios passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
