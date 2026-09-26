'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../../10-client-app.js'),'utf8');
const clone=value=>structuredClone(value);
const UID='client-auth', TID='trainer-a', CID='client-a';
const account={role:'client',uid:UID,clientId:CID,trainerId:TID,inviteToken:'token-a',trainerName:'Trener'};
function snapshot(id,data){return {id,exists:()=>data!==undefined,data:()=>clone(data)};}
function harness(){
  const docs=new Map([
    ['clientAccounts/'+UID,clone(account)],
    ['clients/'+CID,{trainerId:TID,name:'Klient',id:'spoof-profile-id'}],
    ['trainerPublicProfiles/'+TID,{trainerId:TID,profile:{name:'Trener',email:'private@example.test'},brand:{accentColor:'#FF3B30'},paymentInstructions:{bank:'PL123',name:'Trener'},apiKey:'secret'}],
  ]);
  const calls=[],writes=[],elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},textContent:'',disabled:false});return elements.get(id);};
  const ctx={console,Date,URLSearchParams,Map,Set,Promise,Object,Uint8Array,crypto:require('node:crypto').webcrypto,
    location:{search:'',hash:'',origin:'https://example.test',pathname:'/'},history:{replaceState(){}},
    document:{addEventListener(){},getElementById:element,querySelector(){return null;},querySelectorAll(){return [];},body:{classList:{add(){},remove(){}}}},
    _uid:UID,tenantSessionGeneration:1,_db:{},MSGS:{},CL:[],SETTINGS:{apiKey:'previous-secret'},
    _clientAccount:{...account,id:UID},_clientId:CID,_trainerId:TID,_clientAppMode:true,
    _doc:(_db,col,id)=>({col,id,path:col+'/'+id}),_col:(_db,col)=>({col}),
    _where:(field,op,value)=>({field,op,value}),_query:(col,...filters)=>({...col,filters}),
    _serverTimestamp:()=>({serverTime:true}),
    setTimeout(){},clearTimeout(){},clearInterval(){},notify(){},newId:p=>p+'-new',
  };
  ctx.window=ctx;
  ctx.captureTenantSession=()=>({uid:ctx._uid,generation:ctx.tenantSessionGeneration});
  ctx.tenantSessionIsCurrent=s=>!!s&&s.uid===ctx._uid&&s.generation===ctx.tenantSessionGeneration;
  ctx._getDoc=async ref=>{calls.push({type:'get',...ref});return snapshot(ref.id,docs.get(ref.path));};
  ctx._get=async q=>{
    calls.push({type:'query',...q});
    assert.ok(q.filters.length,'A broad query was attempted');
    const found=[...docs].filter(([key])=>key.startsWith(q.col+'/')&&!key.slice(q.col.length+1).includes('/'))
      .filter(([,data])=>q.filters.every(f=>f.op==='array-contains'?Array.isArray(data[f.field])&&data[f.field].includes(f.value):data[f.field]===f.value));
    return {forEach:fn=>found.forEach(([key,data])=>fn(snapshot(key.split('/').at(-1),data)))};
  };
  ctx._setDoc=async(ref,value,options)=>{writes.push({ref,value:clone(value)});docs.set(ref.path,options?.merge?{...docs.get(ref.path),...clone(value)}:clone(value));};
  ctx._runTransaction=async(_db,callback)=>{
    const staged=[];
    const result=await callback({
      get:async ref=>{assert.equal(staged.length,0,'Read after transaction writes');return snapshot(ref.id,docs.get(ref.path));},
      set:(ref,value,options)=>staged.push({ref,value,options}),
    });
    for(const {ref,value,options} of staged)await ctx._setDoc(ref,value,options);
    return result;
  };
  ctx.withTrainer=obj=>Object.assign(obj,{trainerId:ctx._clientAppMode?ctx._trainerId:ctx._uid});
  ctx.persistById=async(col,obj)=>ctx._setDoc(ctx._doc(ctx._db,col,obj.id),obj,{merge:true});
  ctx.mapFbDoc=(d,col)=>{const value=d.data();return {...value,id:['resources','metricGroups','odWorkouts','odPrograms'].includes(col)&&d.id===value.trainerId+'__'+value.id?value.id:d.id,_fbId:d.id};};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  ctx.enterClientLiveShell=()=>{ctx.entered=(ctx.entered||0)+1;};
  return {ctx,docs,calls,writes,element};
}
const tests=[];
const test=(name,run)=>tests.push({name,run});

test('private queries require both tenant IDs and reject unexpected returned documents',async()=>{
  const h=harness(),{ctx,calls}=h;
  ctx._get=async q=>{calls.push(q);return {forEach:fn=>[
    ['good',{trainerId:TID,clientId:CID,id:'spoof'}],
    ['foreign',{trainerId:'other',clientId:CID}],['other-client',{trainerId:TID,clientId:'other'}],['legacy',{clientId:CID}],
  ].forEach(([id,data])=>fn(snapshot(id,data)))};};
  const rows=await ctx.queryByClientId('plans',CID);
  assert.deepEqual(clone(calls[0].filters),[{field:'trainerId',op:'==',value:TID},{field:'clientId',op:'==',value:CID}]);
  assert.deepEqual(Array.from(rows,x=>x.id),['good']);assert.equal(rows[0]._fbId,'good');
  await assert.rejects(ctx.queryByClientId('plans','other'),/client-query-forbidden/);
  await assert.rejects(ctx.queryByTrainerId('plans',TID),/client-query-forbidden/);
  await assert.rejects(ctx.queryByTrainerId('settings',TID),/client-query-forbidden/);
  await assert.rejects(ctx.queryByTrainerId('resources','other'),/client-query-forbidden/);
});

test('account detection returns null only for confirmed absence; invalid and failed reads stop boot',async()=>{
  const h=harness(),{ctx,docs}=h;
  docs.delete('clientAccounts/'+UID);assert.equal(await ctx.fetchClientAccount(UID),null);
  docs.set('clientAccounts/'+UID,{...account,trainerId:''});
  await assert.rejects(ctx.fetchClientAccount(UID),/client-account-invalid/);
  docs.set('clientAccounts/'+UID,{...account,uid:'different'});
  await assert.rejects(ctx.fetchClientAccount(UID),/client-account-invalid/);
  docs.set('clientAccounts/'+UID,account);const loaded=await ctx.fetchClientAccount(UID);
  assert.equal(loaded.id,UID);assert.ok(Object.isFrozen(loaded));
  docs.set('clientAccounts/'+UID,{...account,trainerId:'changed'});
  await assert.rejects(ctx.fetchClientAccount(UID),/client-account-link-changed/);
  ctx._getDoc=async()=>{throw new Error('offline');};
  await assert.rejects(ctx.fetchClientAccount(UID),/offline/);
});

test('account switch during account lookup rejects a delayed response',async()=>{
  const {ctx}=harness();let resolve;
  ctx._getDoc=()=>new Promise(r=>{resolve=r;});
  const pending=ctx.fetchClientAccount(UID);
  ctx._uid='new-user';ctx.tenantSessionGeneration++;
  resolve(snapshot(UID,account));await assert.rejects(pending,/client-session-changed/);
  assert.equal(ctx._clientTenantBinding,undefined);
});

test('complete client load includes forms, safe profile and only permitted forum groups',async()=>{
  const {ctx,docs,calls}=harness();
  docs.set('formSends/form-a',{trainerId:TID,clientId:CID,questions:[{id:'q'}]});
  docs.set('resources/'+TID+'__res-a',{trainerId:TID,id:'res-a',name:'Biblioteka'});
  docs.set('metricGroups/'+TID+'__mg2',{trainerId:TID,id:'mg2',name:'Moje obwody',metrics:[{id:'custom',name:'Nadgarstek'}]});
  docs.set('exerciseGifs/gif1',{trainerId:TID,exerciseName:'Przysiad',gifUrl:'assets/squat.gif'});
  docs.set('forumGroups/public',{trainerId:TID,privacy:'public',memberIds:[]});
  docs.set('forumGroups/mine',{trainerId:TID,privacy:'private',memberIds:[CID]});
  docs.set('forumGroups/hidden',{trainerId:TID,privacy:'private',memberIds:['other-client']});
  docs.set('forumPosts/p1',{trainerId:TID,groupId:'public'});docs.set('forumPosts/p2',{trainerId:TID,groupId:'hidden'});
  docs.set('forumComments/c1',{trainerId:TID,postId:'p1'});docs.set('forumComments/c2',{trainerId:TID,postId:'p2'});
  await ctx.loadClientApp({...account,id:UID});
  assert.equal(ctx.entered,1);assert.equal(ctx.CL[0].id,CID);
  assert.equal(ctx.FORM_SENDS[0].id,'form-a');assert.equal(ctx.USER_RESOURCES[0].id,'res-a');
  assert.equal(ctx.USER_RESOURCES[0]._fbId,TID+'__res-a');
  assert.equal(ctx.METRIC_GROUPS[0].id,'mg2');assert.equal(ctx.METRIC_GROUPS[0].metrics[0].name,'Nadgarstek');
  assert.equal(ctx.EX_GIF_REMOTE.przysiad,'assets/squat.gif');
  assert.equal(ctx.SETTINGS.apiKey,undefined);assert.equal(ctx.SETTINGS.profile.email,undefined);
  assert.equal(ctx.SETTINGS.payments.bankAccount,'PL123');
  assert.deepEqual(Array.from(ctx.FORUM_GROUPS,g=>g.id).sort(),['mine','public']);
  assert.deepEqual(Array.from(ctx.FORUM_POSTS,p=>p.id),['p1']);assert.equal(ctx.FORUM_COMMENTS.p1[0].id,'c1');
  assert.ok(!calls.some(c=>c.col==='settings'));
  assert.ok(calls.filter(c=>c.type==='query').every(c=>c.filters.some(f=>f.field==='trainerId'&&f.value===TID)));
  assert.ok(calls.filter(c=>c.col==='forumPosts').every(c=>c.filters.some(f=>f.field==='groupId')));
  assert.ok(calls.filter(c=>c.col==='forumComments').every(c=>c.filters.some(f=>f.field==='postId')));
});

test('failed collection read cannot display partial data or substitute a broad/demo fetch',async()=>{
  const {ctx,calls}=harness(),read=ctx._get;
  ctx.DEMO_RESOURCES=[{name:'not a recovery path'}];
  ctx._get=async q=>{if(q.col==='resources')throw new Error('permission-denied');return read(q);};
  await assert.rejects(ctx.loadClientApp({...account,id:UID}),/permission-denied/);
  assert.equal(ctx.entered,undefined);assert.equal(ctx.CL.length,0);assert.equal(ctx.USER_RESOURCES.length,0);
  assert.ok(calls.filter(c=>c.type==='query').every(c=>c.filters.length));
});

test('delayed client data cannot replace the next authenticated account snapshot',async()=>{
  const {ctx}=harness(),read=ctx._get;let release;
  ctx._get=async q=>q.col==='plans'?new Promise(r=>{release=()=>r({forEach(){}});}):read(q);
  const loading=ctx.loadClientApp({...account,id:UID});
  ctx._uid='new-user';ctx.tenantSessionGeneration++;ctx.CL=[{id:'new-user-client'}];ctx.SETTINGS={profile:{name:'Next trainer'}};
  release();await assert.rejects(loading,/client-session-changed/);
  assert.equal(ctx.CL[0].id,'new-user-client');assert.equal(ctx.SETTINGS.profile.name,'Next trainer');assert.equal(ctx.entered,undefined);
});

test('invitation page does not read names or addresses before sign-in',async()=>{
  const {ctx,calls,element}=harness();ctx._uid=null;ctx.location.search='?invite=token-a';
  ctx.prepareAuthForInvite();
  assert.equal(calls.length,0);assert.equal(element('auth-reg-token').value,'token-a');
  assert.equal(element('auth-reg-email').readOnly,false);
});

function inviteFixture(){
  const h=harness();h.docs.delete('clientAccounts/'+UID);
  h.docs.set('invites/token-a',{trainerId:TID,clientId:CID,emailLower:'client@example.test',clientName:'Klient',trainerName:'Trener',
    expiresAt:new Date(Date.now()+86400000),consumedBy:null,consumedAt:null,revoked:false});
  return h;
}
test('invite linking atomically creates an immutable account and consumes exactly its token',async()=>{
  const {ctx,docs,writes}=inviteFixture();
  const linked=await ctx.acceptClientInvite('token-a','CLIENT@example.test',UID);
  assert.equal(linked.trainerId,TID);assert.equal(linked.clientId,CID);
  assert.equal(docs.get('clientAccounts/'+UID).inviteToken,'token-a');
  assert.equal(docs.get('invites/token-a').consumedBy,UID);
  assert.deepEqual(docs.get('invites/token-a').consumedAt,{serverTime:true});assert.equal(writes.length,2);
  await ctx.acceptClientInvite('token-a','client@example.test',UID);assert.equal(writes.length,2,'Recovery rewrote the account');
});
test('expired, legacy, revoked and mismatched invitations cannot create accounts',async()=>{
  for(const patch of [{expiresAt:new Date(0)},{expiresAt:undefined},{revoked:true},{emailLower:'other@example.test'},{consumedBy:'another-user'}]){
    const {ctx,docs,writes}=inviteFixture();docs.set('invites/token-a',{...docs.get('invites/token-a'),...patch});
    await assert.rejects(ctx.acceptClientInvite('token-a','client@example.test',UID));
    assert.equal(docs.has('clientAccounts/'+UID),false);assert.equal(writes.length,0);
  }
  const {ctx,docs,writes}=inviteFixture();docs.set('clientAccounts/'+UID,{...account,trainerId:'different'});
  await assert.rejects(ctx.acceptClientInvite('token-a','client@example.test',UID),/client-account-link-changed/);assert.equal(writes.length,0);
});

test('registration blocks role detection until the account transaction commits',async()=>{
  const {ctx,element,docs}=inviteFixture();
  element('auth-reg-token').value='token-a';element('auth-reg-email').value='client@example.test';
  element('auth-reg-password').value='password123';element('auth-reg-password2').value='password123';
  let release,gate;
  ctx._createUser=async()=>{gate=ctx._clientRegistrationPromise;assert.ok(gate);return {user:{uid:UID}};};
  const transact=ctx._runTransaction;
  ctx._runTransaction=async(...args)=>{await new Promise(r=>{release=r;});return transact(...args);};
  const registering=ctx.doClientRegister();await Promise.resolve();await Promise.resolve();
  let ready=false;gate.then(()=>{ready=true;});await Promise.resolve();assert.equal(ready,false);
  assert.equal(docs.has('clientAccounts/'+UID),false);
  release();await registering;assert.equal(ready,true);assert.equal(docs.get('clientAccounts/'+UID).trainerId,TID);
});

(async()=>{for(const {name,run} of tests){await run();console.log('PASS '+name);}console.log('All '+tests.length+' client tenant access checks passed.');})().catch(e=>{console.error(e);process.exitCode=1;});
