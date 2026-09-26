'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
const checkinRules=rules.slice(rules.indexOf('match /checkins/'),rules.indexOf('function taskContinuation'));
const clientCreateKeys=[...checkinRules.match(/keys\(\)\.hasOnly\(\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
function extract(name){
  const at=source.indexOf('function '+name+'(');assert.ok(at>=0,name+' exists');
  const start=source.slice(at-6,at)==='async '?at-6:at;
  let opened=false,depth=0;
  for(let i=at;i<source.length;i++){
    if(source[i]==='{'){depth++;opened=true;}
    else if(source[i]==='}'&&--depth===0&&opened)return source.slice(start,i+1);
  }
  throw Error('Unclosed function '+name);
}
function setup(clientMode){
  const writes=[],trainerMessages=[],notifications=[];
  let next=0;
  const ctx={window:null,Date,console,_clientAppMode:clientMode,_uid:clientMode?'client-login':'trainer-a',_trainerId:'trainer-a',_clientId:'client-a',
    CL:[{id:'client-a',name:'Anna',status:'active'}],PL:[{id:'plan-a',clientId:'client-a'}],CHECKINS:{},SETTINGS:{notifications:{weeklyCheckin:true}},
    clientHasAssignedPlan:id=>id==='client-a',newId:prefix=>prefix+'_'+(++next),dateStr:d=>d.toISOString().slice(0,10),
    pushMsg:(...args)=>trainerMessages.push(args),addNotification:(...args)=>notifications.push(args),
    withTrainer:data=>Object.assign(data,{trainerId:'trainer-a'}),
    persistById:async(collection,record)=>{
      if(clientMode){
        assert.equal(record.clientId,'client-a');assert.equal(record.trainerId,'trainer-a');
        assert.deepEqual(Object.keys(record).filter(key=>!clientCreateKeys.includes(key)),[],'client pending uses the actual rule allowlist');
        assert.ok(['pending','filled'].includes(record.status));assert.equal(typeof record.answers,'object');
      }
      writes.push({collection,record:JSON.parse(JSON.stringify(record))});return record;
    }};
  ctx.window=ctx;vm.createContext(ctx);
  for(const name of ['ensureCheckins','persistCheckin','pendingCheckin','filledThisWeek','checkinChatText','ensurePendingCheckin','clientEligibleForWeeklyCheckin','needsWeeklyCheckin','maybeSendCheckinAfterSession'])vm.runInContext(extract(name),ctx);
  return {ctx,writes,trainerMessages,notifications};
}
(async()=>{
  {
    const {ctx,writes,trainerMessages,notifications}=setup(true);
    const pending=ctx.maybeSendCheckinAfterSession('client-a');
    assert.equal(pending.status,'pending');assert.equal(pending.source,undefined);assert.equal(writes.length,1);
    assert.equal(writes[0].collection,'checkins');assert.equal(writes[0].record.trainerId,'trainer-a');
    assert.equal(trainerMessages.length,0,'client must not send an outgoing message as the trainer');assert.equal(notifications.length,1);
    assert.equal(ctx.maybeSendCheckinAfterSession('client-a'),null);assert.equal(writes.length,1,'repeated session callback reuses the pending check-in');
    assert.equal(ctx.ensurePendingCheckin('client-b',{source:'manual'}),null);assert.equal(writes.length,1);
    assert.equal(await ctx.persistCheckin(pending),pending,'awaited success reaches the caller');
    ctx.persistById=async()=>null;assert.equal(await ctx.persistCheckin(pending),null,'failed persistence is not reported as success');
  }
  {
    const {ctx,writes,trainerMessages}=setup(false);
    const pending=ctx.maybeSendCheckinAfterSession('client-a');
    assert.equal(pending.source,'session');assert.equal(writes.length,1);assert.equal(trainerMessages.length,1,'trainer reminders remain enabled');
  }
  {
    const {ctx,writes,trainerMessages}=setup(true);
    const existing={id:'existing-trainer-checkin',clientId:'client-a',trainerId:'trainer-a',source:'manual',status:'pending',answers:{}};
    ctx.CHECKINS['client-a']=[existing];
    assert.equal(ctx.ensurePendingCheckin('client-a',{source:'session'}),existing,'a real trainer-created pending record is not reconstructed');
    assert.equal(existing.source,'manual');assert.equal(writes.length,0);assert.equal(trainerMessages.length,0);
    ctx.CHECKINS['client-a']=[{id:'filled',clientId:'client-a',status:'filled',date:new Date().toISOString().slice(0,10)}];
    assert.equal(ctx.maybeSendCheckinAfterSession('client-a'),null);assert.equal(writes.length,0,'filled check-in is not sent again');
  }
  console.log('OK check-in permissions: actual client payload, no trainer impersonation, idempotent pending, existing trainer record and save outcome');
})().catch(error=>{console.error(error);process.exitCode=1;});
