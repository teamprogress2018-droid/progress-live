'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../..','01-core.js'),'utf8');
function extract(name){
  const marker='function '+name+'(',at=source.indexOf(marker);
  assert.ok(at>=0,name+' exists');
  const start=source.slice(at-6,at)==='async '?at-6:at;
  return source.slice(start,source.indexOf('\nwindow.',at));
}
function setup(){
  const writes=[],notes=[],effects=[];
  const button={disabled:false};
  const elements={'sala-done-save':button,'sala-done-min':{value:'45'},'sala-done-note':{value:'Dobry trening'}};
  const planned={id:'planned-a',trainerId:'trainer-a',clientId:'client-a',date:'2026-09-25',source:'planned',planId:'plan-a',dayIdx:0,time:'18:00',type:'FBW'};
  const ctx={console,Date,window:null,_uid:'client-login',tenantSessionGeneration:1,_clientAppMode:true,_clientId:'client-a',_trainerId:'trainer-a',
    SE:[planned],CL:[{id:'client-a',name:'Anna'}],PL:[{id:'plan-a',trainerId:'trainer-a',clientId:'client-a',days:[{exercises:[{name:'Przysiad'}]}]}],
    PACKAGES:[{id:'package-a',clientId:'client-a',sessionsUsed:2}],_salaDoneId:'planned-a',_salaDoneFeedback:4,
    document:{getElementById:id=>elements[id]||null},notify:msg=>notes.push(msg),
    closeM:()=>effects.push('close'),renderClientLive:()=>effects.push('render'),
    consumeClientPackageSession:()=>{effects.push('package-write');throw Error('client must not consume a package');},
    maybeSendCheckinAfterSession:()=>effects.push('checkin-create'),
    persistById:async(col,data)=>{writes.push({col,data:{...data}});return data;}};
  ctx.window=ctx;ctx.tenantSessionIsCurrent=s=>s.uid===ctx._uid&&s.generation===ctx.tenantSessionGeneration;
  vm.createContext(ctx);
  for(const name of ['isLoggedWorkout','sessionMatchesPlanned','logClientSessionFromPlanned','logSessionFromPlanned','saveSalaDone'])vm.runInContext(extract(name),ctx);
  return {ctx,writes,notes,effects,planned,button};
}
(async()=>{
  {
    const {ctx,writes}=setup();let reads=0;
    ctx._getDoc=async()=>{reads++;throw Object.assign(Error('Missing-document GET is denied by strict rules'),{code:'permission-denied'});};
    const saved=await ctx.logSessionFromPlanned('planned-a',null,{feedback:4,duration:45});
    assert.equal(saved.id,'sala_planned-a');assert.equal(writes.length,1);
    assert.equal(reads,0,'first save must not require a GET of a missing session');
  }
  {
    const {ctx,writes,notes,effects,button}=setup();
    let release;
    ctx.persistById=async(col,data)=>{writes.push({col,data:{...data}});await new Promise(resolve=>release=resolve);return data;};
    const pending=ctx.saveSalaDone();
    assert.equal(button.disabled,true);assert.equal(ctx.SE.length,1);assert.deepEqual(effects,[]);assert.deepEqual(notes,[]);
    await ctx.saveSalaDone();assert.equal(writes.length,1,'double-click is ignored while saving');
    release();const saved=await pending;
    assert.equal(saved.id,'sala_planned-a');assert.equal(ctx.SE.length,2);
    assert.equal(writes[0].col,'sessions');assert.equal(writes[0].data.source,'sala');assert.equal(writes[0].data.plannedSessionId,'planned-a');
    assert.equal(writes[0].data.trainerId,'trainer-a');assert.equal(writes[0].data.clientId,'client-a');
    assert.equal(writes[0].data.date,'2026-09-25');assert.equal(writes[0].data.feedback,4);assert.equal(writes[0].data.duration,45);
    assert.equal('pkgTick' in writes[0].data,false);assert.equal(ctx.PACKAGES[0].sessionsUsed,2);
    assert.equal(effects.includes('package-write'),false);assert.equal(effects.includes('checkin-create'),false);
    assert.ok(notes.some(msg=>msg.startsWith('Zapisano trening na sali')));assert.equal(button.disabled,false);
    ctx.persistById=async(col,data)=>{writes.push({col,data:{...data}});return data;};
    const retry=await ctx.logSessionFromPlanned('planned-a',null,{feedback:5,duration:42});
    assert.equal(retry.id,saved.id);assert.equal(ctx.SE.length,2);assert.equal(retry.feedback,5);
  }
  for(const failure of ['null','throw']){
    const {ctx,notes,effects,button}=setup();
    ctx.persistById=async()=>{if(failure==='throw')throw Error('permission-denied');return null;};
    assert.equal(await ctx.saveSalaDone(),undefined);assert.equal(ctx.SE.length,1);assert.equal(ctx.PACKAGES[0].sessionsUsed,2);
    assert.deepEqual(effects,[]);assert.ok(notes.some(msg=>msg.startsWith('Nie udało się zapisać')));assert.equal(button.disabled,false);
  }
  for(const patch of [{clientId:'client-b'},{trainerId:'trainer-b'},{source:'live'},{date:'invalid'}]){
    const {ctx,writes,planned}=setup();Object.assign(planned,patch);
    assert.equal(await ctx.logSessionFromPlanned(planned.id,null,{feedback:4}),null);assert.equal(writes.length,0);assert.equal(ctx.SE.length,1);
  }
  {
    const {ctx,notes,effects}=setup();let release;
    ctx.persistById=async(_,data)=>{await new Promise(resolve=>release=resolve);return data;};
    const pending=ctx.saveSalaDone();ctx._uid='different-login';ctx.tenantSessionGeneration++;ctx.SE=[];
    release();await pending;
    assert.equal(ctx.SE.length,0);assert.deepEqual(notes,[]);assert.deepEqual(effects,[],'stale completion cannot render or send follow-ups');
  }
  {
    const {ctx}=setup();ctx.SE.push({id:'sala_planned-a',trainerId:'trainer-a',clientId:'client-a',date:'2026-09-25',source:'sala',planId:'plan-a',dayIdx:0,plannedSessionId:'planned-a',feedback:3,duration:40});
    ctx.persistById=async()=>null;
    assert.equal(await ctx.logSessionFromPlanned('planned-a',null,{feedback:5,duration:55}),null);
    assert.equal(ctx.SE[1].feedback,3);assert.equal(ctx.SE[1].duration,40,'failed update preserves the last confirmed record');
  }
  console.log('OK client sala: owned planned session, confirmed save, no package mutation, retry, failure and account switch');
})().catch(error=>{console.error(error);process.exitCode=1;});
