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
const code=['clientConfirmWrite','clientCompleteHomework','cwFinish','ppSave','clientSubmitCheckin'].map(extract).join('\n');
const portalSource=fs.readFileSync(path.resolve(__dirname,'../../04-client-portal.js'),'utf8');
const rules=fs.readFileSync(path.resolve(__dirname,'../../firestore.rules'),'utf8');
const checkinRules=rules.slice(rules.indexOf('match /checkins/'),rules.indexOf('function taskContinuation'));
const checkinCreateKeys=[...checkinRules.match(/keys\(\)\.hasOnly\(\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const checkinUpdateKeys=[...checkinRules.match(/clientUpdate\(\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
function portalFunction(name){
  const at=portalSource.indexOf('function '+name+'(');assert(at>=0,name+' exists');
  const start=portalSource.slice(at-6,at)==='async '?at-6:at;
  const next=portalSource.slice(at+1).search(/\n(?:async )?function /);
  let end=next<0?portalSource.length:at+1+next;
  const exportAt=portalSource.indexOf('\nwindow.',at);if(exportAt>=0&&exportAt<end)end=exportAt;
  return portalSource.slice(start,end);
}
const checkinHelpers=['ensureCheckins','persistCheckin','pendingCheckin','filledThisWeek','scoreCheckinAnswers','checkinChatText','ensurePendingCheckin','clientEligibleForWeeklyCheckin','needsWeeklyCheckin','maybeSendCheckinAfterSession'].map(portalFunction).join('\n');
const clone=x=>JSON.parse(JSON.stringify(x));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(options={}){
  let sequence=0;const docs=new Map(),calls={writes:[],messages:[],trainerMessages:[],notifications:[],notices:[],events:[],synced:[],next:0,renders:0,closed:0,cleared:0};
  const wrap={hidden:false};
  const ctx={console,Date,Math,JSON,Promise,parseInt,parseFloat,
    _db:{},_uid:'login-a',_clientId:'client-a',_trainerId:'trainer-a',_clientAppMode:true,tenantSessionGeneration:1,
    CL:[{id:'client-a',name:'Anna Kowalska',trainerId:'trainer-a'}],TASKS:[],SE:[],PROGRESS_PHOTOS:[],CHECKINS:{},SETTINGS:{notifications:{weeklyCheckin:true}},PL:[{id:'plan-a',clientId:'client-a'}],
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
      if(col==='checkins'){
        assert.equal(payload.trainerId,'trainer-a');assert.equal(payload.clientId,'client-a');
        const old=docs.get(col+'/'+ref.id);
        if(old){
          assert.equal(payload.status,'filled');assert.equal(payload.filledBy,'client');
          const changed=Object.keys({...old,...payload}).filter(key=>JSON.stringify(old[key])!==JSON.stringify(payload[key]));
          assert.deepEqual(changed.filter(key=>!checkinUpdateKeys.includes(key)),[],'existing check-in preserves immutable fields from actual rules');
        }else{
          assert.equal(payload.id,ref.id);
          assert.deepEqual(Object.keys(payload).filter(key=>!checkinCreateKeys.includes(key)),[],'check-in create uses actual rule allowlist');
        }
      }
      calls.writes.push({ref,payload});
      const commit=()=>docs.set(col+'/'+ref.id,payload);
      if(options.write)return options.write({col,entry,payload,ref,commit,calls,docs});
      commit();entry._fbId=ref.id;return entry;
    },
    withTrainer(entry){if(entry.trainerId&&entry.trainerId!==ctx._trainerId)throw new Error('owner');entry.trainerId=ctx._trainerId;return entry;},
    newId:prefix=>prefix+'_'+(++sequence),todayYmd:()=>'2026-09-26',
    dateStr:date=>date.toISOString().slice(0,10),
    syncClientFromCheckin:ci=>calls.synced.push(clone(ci)),fireIntEvent:(...args)=>calls.events.push(args),emitAppEvent:(...args)=>calls.events.push(args),
    pushMsg:(...args)=>calls.trainerMessages.push(args),
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
  function checkin(pending=null,persisted=true){
    vm.runInContext(checkinHelpers,ctx,{filename:'checkin-portal-helpers.js'});
    ctx._cliveCheckin={energy:4,sleep:3,stress:2,nutrition:4,workouts:3,weight:'70',notes:'Dobra regeneracja'};
    if(pending){ctx.CHECKINS['client-a']=[pending];if(persisted){const stored=clone(pending);delete stored._fbId;docs.set('checkins/'+(pending._fbId||pending.id),stored);}}
    return ctx._cliveCheckin;
  }
  return {ctx,calls,docs,homework,workout,photos,checkin,wrap};
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

await test('check-in write failure retains answers and pending status without success effects; retry reuses ID',async()=>{
  let fail=true;
  const h=harness({write:async({entry,commit})=>{if(fail)return null;commit();return entry;}});
  const pending={id:'ci-pending',clientId:'client-a',trainerId:'trainer-a',date:'2026-09-26',createdAt:'2026-09-26T10:00:00.000Z',status:'pending',answers:{},score:null};
  const draft=h.checkin(pending);
  assert.equal(await h.ctx.clientSubmitCheckin(),false);
  assert.equal(h.ctx._cliveCheckin,draft);assert.equal(draft.notes,'Dobra regeneracja');assert.equal(draft.saving,false);
  assert.equal(pending.status,'pending');assert.deepEqual(pending.answers,{});assert.equal(h.docs.get('checkins/ci-pending').status,'pending');
  assert.equal(h.calls.messages.length,0);assert.equal(h.calls.synced.length,0);assert.equal(h.calls.events.length,0);assert.equal(h.calls.notifications.length,0);
  assert(!h.calls.notices.some(text=>text.startsWith('✓')));
  draft.notes='Odpowiedź poprawiona po błędzie';fail=false;
  assert.equal(await h.ctx.clientSubmitCheckin(),true);
  assert.equal(pending.status,'filled');assert.equal(pending.answers.notes,draft.notes);assert.equal(h.calls.synced.length,1);
  assert.equal(h.calls.messages.length,1);assert.equal(h.calls.events.length,2);assert.equal(h.calls.renders,1);
  assert(h.calls.writes.every(write=>write.ref.id==='ci-pending'));assert.equal([...h.docs.keys()].filter(key=>key.startsWith('checkins/')).length,1);
});

await test('unsaved legacy pending check-in creates only allowed client fields and removes stale local source',async()=>{
  const h=harness();
  const pending={id:'ci-local',clientId:'client-a',trainerId:'trainer-a',date:'2026-09-26',status:'pending',answers:{},source:'session',trainerOnly:'old local metadata'};
  h.checkin(pending,false);
  assert.equal(await h.ctx.clientSubmitCheckin(),true);
  const saved=h.docs.get('checkins/ci-local');assert.equal(saved.source,undefined);assert.equal(saved.trainerOnly,undefined);
  assert.equal(pending.source,undefined);assert.equal(pending.trainerOnly,undefined);assert.equal(pending.status,'filled');
});

await test('persisted trainer check-in keeps immutable source and original legacy payload ID',async()=>{
  const h=harness();
  const pending={id:'ci-document',_fbId:'ci-document',clientId:'client-a',trainerId:'trainer-a',source:'manual',date:'2026-09-26',status:'pending',answers:{}};
  h.checkin(pending);h.docs.get('checkins/ci-document').id='old-payload-id';
  assert.equal(await h.ctx.clientSubmitCheckin(),true);
  assert.equal(h.docs.get('checkins/ci-document').source,'manual');assert.equal(h.docs.get('checkins/ci-document').id,'old-payload-id');
  assert.equal(pending.id,'ci-document');assert.equal(pending._fbId,'ci-document');assert.equal(pending.source,'manual');
});

await test('check-in lost acknowledgement recovers the committed answers and executes effects once',async()=>{
  const h=harness({write:async({commit})=>{commit();return null;}});h.checkin();
  assert.equal(await h.ctx.clientSubmitCheckin(),true);assert.equal(h.ctx.CHECKINS['client-a'].length,1);
  assert.equal(h.calls.messages.length,1);assert.equal(h.calls.synced.length,1);assert.equal(h.calls.writes.length,1);
  assert.equal(await h.ctx.clientSubmitCheckin(),false);assert.equal(h.calls.messages.length,1);assert.equal(h.calls.writes.length,1);
});

await test('workout completion creates a permitted pending check-in that the client can actually submit',async()=>{
  const h=harness();h.checkin();h.workout();
  assert.equal(await h.ctx.cwFinish(),true);
  const pending=h.ctx.pendingCheckin('client-a');assert(pending);assert.equal(pending.source,undefined);
  assert.equal(h.calls.trainerMessages.length,0,'client completion cannot impersonate an outgoing trainer message');
  assert.equal(h.docs.get('checkins/'+pending.id).status,'pending');
  assert.equal(await h.ctx.clientSubmitCheckin(),true);
  assert.equal(h.docs.get('checkins/'+pending.id).status,'filled');assert.equal(h.docs.get('checkins/'+pending.id).answers.energy,4);
  assert.equal(h.ctx.CHECKINS['client-a'].length,1);assert.equal(h.calls.synced.length,1);assert.equal(h.calls.trainerMessages.length,0);
});

await test('check-in missing document read denial permits allowed create but unavailable reads keep the form',async()=>{
  const h=harness({read:async(ref,docs)=>{
    const stored=docs.get(ref.col+'/'+ref.id);
    if(!stored)throw Object.assign(new Error('Missing resource cannot prove owner'),{code:'permission-denied'});
    return {id:ref.id,exists:()=>true,data:()=>clone(stored)};
  }});h.checkin();assert.equal(await h.ctx.clientSubmitCheckin(),true);assert.equal(h.calls.synced.length,1);
  const offline=harness({read:async()=>{throw new Error('offline');}}),draft=offline.checkin();
  assert.equal(await offline.ctx.clientSubmitCheckin(),false);assert.equal(offline.ctx._cliveCheckin,draft);assert.equal(offline.calls.writes.length,0);assert.equal(offline.calls.synced.length,0);
});

await test('check-in rejects a foreign existing document and cannot execute effects after an account switch',async()=>{
  const foreign=harness();foreign.checkin();foreign.docs.set('checkins/ci_1',{id:'ci_1',trainerId:'other',clientId:'other',status:'pending',answers:{}});
  assert.equal(await foreign.ctx.clientSubmitCheckin(),false);assert.equal(foreign.calls.writes.length,0);assert.equal(foreign.calls.messages.length,0);
  const gate=deferred();let entered;const seen=new Promise(resolve=>{entered=resolve;});
  const h=harness({write:async({entry,commit})=>{entered();await gate.promise;commit();return entry;}});h.checkin();
  const saving=h.ctx.clientSubmitCheckin();await seen;
  assert.equal(await h.ctx.clientSubmitCheckin(),false,'double-click does not duplicate an in-flight request');
  h.ctx.tenantSessionGeneration++;h.ctx._uid='login-b';h.ctx._cliveCheckin={};h.ctx.CHECKINS={};gate.resolve();
  assert.equal(await saving,false);assert.equal(Object.keys(h.ctx.CHECKINS).length,0);assert.equal(h.calls.messages.length,0);assert.equal(h.calls.synced.length,0);assert.equal(h.calls.events.length,0);
});

console.log('\n'+count+' confirmed-write scenarios passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
