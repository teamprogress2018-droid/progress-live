const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const source=html.slice(html.indexOf('const TENANT_DEFAULT_SETTINGS='),html.indexOf('</script>',html.indexOf('const TENANT_DEFAULT_SETTINGS=')));
assert(source.includes('async function load('),'tenant loader source is present');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function snapshot(rows=[]){return {forEach(fn){rows.forEach(([id,data])=>fn({id,data:()=>data}));}};}
function harness(options={}){
  const calls={queries:[],writes:[],renders:0,reloads:0,loading:[],cleared:[]};
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',value:'',classList:{remove(){},add(){}}});return elements.get(id);};
  const ctx={console:{warn(){}},db:{},auth:{},Date,Math,Promise,Set,JSON,
    SETTINGS:{profile:{name:'',email:'',title:''},brand:{accentColor:'#ef3340'},clientApp:{visibleSections:{home:true}},payments:{currency:'PLN'}},
    document:{getElementById:element,body:{classList:{remove(){}}},querySelector:()=>element('sidebar'),querySelectorAll:()=>[]},
    location:{reload(){calls.reloads++;}},
    clearInterval:id=>calls.cleared.push(id),clearTimeout:id=>calls.cleared.push(id),
    onAuthStateChanged(_auth,callback){calls.authCallback=callback;},
    collection:(_db,name)=>({name}),where:(field,operator,value)=>({field,operator,value}),query:(collection,...filters)=>({collection:collection.name,filters}),
    getDocs:async q=>{calls.queries.push(q);return options.read?options.read(q):snapshot((options.rows||{})[q.collection]);},
    mapFbDoc(d,name){const data=d.data();const namespaced=['odWorkouts','odPrograms','resources','metricGroups'].includes(name)&&d.id===data.trainerId+'__'+data.id;return {...data,id:namespaced?data.id:d.id,_fbId:d.id};},
    persistById:async(collection,obj)=>{const record={collection,obj:JSON.parse(JSON.stringify(obj))};calls.writes.push(record);if(options.write)return options.write(record);obj._fbId=['odWorkouts','odPrograms','resources','metricGroups'].includes(collection)?obj.trainerId+'__'+obj.id:obj.id;return obj;},
    renderAll(){calls.renders++;},showAppLoading:value=>calls.loading.push(value),
    fetchClientAccount:async()=>null,
    ...options.globals
  };
  ctx.window=ctx;
  vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'index-tenant-loader.js'});
  function signIn(uid='trainer-a'){
    ctx._uid=uid;ctx.tenantSessionGeneration=(ctx.tenantSessionGeneration||0)+1;ctx.resetTenantRuntimeData();
    return ctx.captureTenantSession();
  }
  return {ctx,calls,element,signIn};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

(async()=>{
await test('every trainer collection is queried by owner; foreign and ownerless records are rejected',async()=>{
  const h=harness({rows:{clients:[['client-a',{trainerId:'trainer-a',name:'A'}],['client-b',{trainerId:'trainer-b'}],['ownerless',{name:'Legacy'}]],messages:[['m1',{trainerId:'trainer-a',clientId:'client-a',text:'Own'}],['m2',{trainerId:'trainer-b',clientId:'client-a',text:'Foreign'}]]}});
  const session=h.signIn();assert.equal(await h.ctx.load(session),true);
  assert.equal(h.calls.queries.length,39);
  h.calls.queries.forEach(q=>assert.deepEqual(q.filters,[{field:'trainerId',operator:'==',value:'trainer-a'}]));
  assert.deepEqual(Array.from(h.ctx.CL,c=>c.id),['client-a']);
  assert.deepEqual(Array.from(h.ctx.MSGS['client-a'],m=>m.text),['Own']);
  assert.equal(h.ctx._tenantDataReady,true);assert.equal(h.calls.renders,1);
  assert(!source.includes('migrateTrainerOwnership'));
  assert(!/getDocs\(collection\(/.test(source));
});

await test('all reads complete before publishing one coherent snapshot or seeding',async()=>{
  const gate=deferred();
  const h=harness({read:q=>q.collection==='settings'?gate.promise:snapshot(q.collection==='clients'?[['a',{trainerId:'trainer-a'}]]:[]),globals:{DEMO_RESOURCES:[{id:'res1',name:'Default'}]}});
  const session=h.signIn();const pending=h.ctx.load(session);await flush();
  assert.equal(h.ctx.CL.length,0);assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.renders,0);
  gate.resolve(snapshot());assert.equal(await pending,true);
  assert.equal(h.ctx.CL[0].id,'a');assert.equal(h.calls.writes.length,1);assert.equal(h.calls.renders,1);
});

await test('a denied collection cannot produce empty replacement data, settings fallback or seed writes',async()=>{
  const h=harness({read:q=>{if(q.collection==='tasks')throw new Error('permission-denied');return snapshot();},globals:{DEMO_RESOURCES:[{id:'res1'}]}});
  h.ctx.SETTINGS.profile.name='Previous trainer';h.ctx.SETTINGS.integrations={secret:'previous-secret'};
  const session=h.signIn('trainer-b');
  await assert.rejects(h.ctx.load(session),/permission-denied/);
  assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.ctx.SETTINGS.profile.name,'');assert.equal(h.ctx.SETTINGS.integrations,undefined);
  assert.equal(h.calls.writes.length,0);assert.equal(h.calls.renders,0);assert.equal(h.ctx.AUTOFLOWS.length,0);
});

await test('canonical owner settings win deterministically without merging another document',async()=>{
  const entries=[['z',{trainerId:'trainer-a',profile:{name:'Legacy Z'},payments:{bankAccount:'legacy'}}],['trainer-a',{trainerId:'trainer-a',profile:{name:'Canonical'}}],['a',{trainerId:'trainer-a',profile:{name:'Legacy A'}}],['foreign',{trainerId:'trainer-b',profile:{name:'Foreign'},apiKey:'secret'}],['old',{profile:{name:'No owner'}}]];
  for(const rows of [entries,[...entries].reverse()]){
    const h=harness({rows:{settings:rows,automationState:rows}});await h.ctx.load(h.signIn());
    assert.equal(h.ctx.SETTINGS.profile.name,'Canonical');assert.equal(h.ctx.SETTINGS.payments.bankAccount,undefined);assert.equal(h.ctx.SETTINGS.apiKey,undefined);
    assert.equal(h.ctx.SETTINGS.payments.currency,'PLN');assert.equal(h.ctx._settingsDocId,'trainer-a');assert.equal(h.ctx._afStateDocId,'trainer-a');
  }
  const h=harness({rows:{settings:entries.filter(([id])=>id!=='trainer-a')}});await h.ctx.load(h.signIn());
  assert.equal(h.ctx.SETTINGS.profile.name,'Legacy A');assert.equal(h.ctx._settingsDocId,'a');
});

await test('a previous account response cannot publish into the next account',async()=>{
  const gate=deferred();const h=harness({read:q=>q.collection==='clients'?gate.promise:snapshot()});
  const pending=h.ctx.load(h.signIn('trainer-a'));h.signIn('trainer-b');
  gate.resolve(snapshot([['a',{trainerId:'trainer-a'}]]));await assert.rejects(pending,/tenant-session-stale/);
  assert.equal(h.ctx.CL.length,0);assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.calls.writes.length,0);
});

await test('a new authentication generation for the same UID invalidates old reads',async()=>{
  const gate=deferred();const h=harness({read:q=>q.collection==='settings'?gate.promise:snapshot()});
  const old=h.signIn();const pending=h.ctx.load(old);const current=h.signIn();assert.notEqual(old.generation,current.generation);
  gate.resolve(snapshot([['trainer-a',{trainerId:'trainer-a',profile:{name:'Stale'}}]]));await assert.rejects(pending,/tenant-session-stale/);
  assert.equal(h.ctx.SETTINGS.profile.name,'');assert.equal(h.ctx._tenantDataReady,false);
});

await test('account lookup failure never falls through into trainer boot',async()=>{
  const h=harness({globals:{fetchClientAccount:async()=>{throw new Error('client-account-unavailable');}}});
  await assert.rejects(h.ctx.bootApp(h.signIn()),/client-account-unavailable/);
  assert.equal(h.calls.queries.length,0);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.renders,0);
});

await test('client registration is awaited before role routing, and registration failure blocks boot',async()=>{
  const gate=deferred();let lookedUp=0,clientLoaded=0;
  const h=harness({globals:{fetchClientAccount:async()=>{lookedUp++;return {clientId:'c',trainerId:'owner'};},loadClientApp:async(acc,session)=>{assert.equal(acc.clientId,'c');assert.equal(session.uid,'client-user');clientLoaded++;return true;}}});
  const session=h.signIn('client-user');h.ctx._clientRegistrationPromise=gate.promise;
  const pending=h.ctx.bootApp(session);await flush();assert.equal(lookedUp,0);assert.equal(h.calls.queries.length,0);
  gate.resolve();assert.equal(await pending,true);assert.equal(lookedUp,1);assert.equal(clientLoaded,1);assert.equal(h.calls.queries.length,0);
  h.ctx._clientRegistrationPromise=Promise.reject(new Error('registration-failed'));h.ctx._clientRegistrationPromise.catch(()=>{});
  await assert.rejects(h.ctx.bootApp(session),/registration-failed/);assert.equal(lookedUp,1);
});

await test('runtime reset clears private arrays, map aliases, settings, live state and timers',async()=>{
  const live=[{timerInterval:31,restInterval:32,clientId:'old'},{clientId:'old2'}];
  const h=harness({globals:{liveRef:slot=>live[slot],liveNewSlotState:()=>({timerInterval:null,restInterval:null,clientId:null})}});h.signIn();
  const messages=h.ctx.MSGS,notes=h.ctx.CLIENT_NOTES,clients=h.ctx.CL;
  messages.old=[{text:'private'}];notes.old=[{text:'private'}];clients.push({id:'old'});
  h.ctx.SETTINGS.profile.name='Old';h.ctx.SETTINGS.apiKey='secret';h.ctx._trainerId='old';h.ctx._clientId='c';h.ctx._clientAccount={trainerId:'old'};
  h.ctx._kbLastPlanningContext='private';h.ctx._opsScanClock=123;h.ctx._clientRegistrationPromise=Promise.resolve();const registration=h.ctx._clientRegistrationPromise;
  h.ctx.resetTenantRuntimeData();
  assert.equal(h.ctx.MSGS,messages);assert.equal(h.ctx.CLIENT_NOTES,notes);assert.equal(h.ctx.CL,clients);
  assert.equal(Object.keys(messages).length,0);assert.equal(Object.keys(notes).length,0);assert.equal(clients.length,0);
  assert.equal(h.ctx.SETTINGS.profile.name,'');assert.equal(h.ctx.SETTINGS.apiKey,undefined);
  assert.equal(h.ctx._clientId,null);assert.equal(h.ctx._trainerId,null);assert.equal(h.ctx._clientAccount,null);assert.equal(h.ctx._kbLastPlanningContext,null);
  assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.ctx._afStateReady,false);assert(h.calls.cleared.includes(123));
  assert.equal(live[0].clientId,null);assert.equal(live[1].clientId,null);assert.equal(h.ctx._clientRegistrationPromise,registration);
});

await test('built-in storage namespaces preserve logical IDs and references',async()=>{
  const h=harness({rows:{odWorkouts:[['trainer-a__ow1',{id:'ow1',trainerId:'trainer-a',name:'Owned workout'}]],odPrograms:[['trainer-a__op1',{id:'op1',trainerId:'trainer-a',workoutIds:['ow1']}]],metricGroups:[['trainer-a__mg1',{id:'mg1',trainerId:'trainer-a'}]]}});
  await h.ctx.load(h.signIn());assert.equal(h.ctx.OD_WORKOUTS[0].id,'ow1');assert.equal(h.ctx.OD_WORKOUTS[0]._fbId,'trainer-a__ow1');
  assert.equal(h.ctx.OD_PROGRAMS[0].workoutIds[0],h.ctx.OD_WORKOUTS[0].id);assert.equal(h.ctx.METRIC_GROUPS[0].id,'mg1');assert.equal(h.calls.writes.length,0);
});

await test('default seeds are confirmed, owner-scoped and use persistById for namespace support',async()=>{
  const h=harness({globals:{DEMO_METRIC_GROUPS:[{id:'mg1'}],OD_DEMO_WORKOUTS:[{id:'ow1'}],OD_DEMO_PROGRAMS:[{id:'op1',workoutIds:['ow1']}],DEMO_RESOURCES:[{id:'res1'}],DEMO_AUTOFLOWS:[{id:'afdemo',status:'active'}],DEMO_FORUM_GROUPS:[{id:'fgdemo',memberIds:['old-client']}],newId:prefix=>prefix+'_unique'}});
  await h.ctx.load(h.signIn());assert.equal(h.calls.writes.length,6);
  h.calls.writes.forEach(w=>assert.equal(w.obj.trainerId,'trainer-a'));
  assert.equal(h.ctx.OD_WORKOUTS[0]._fbId,'trainer-a__ow1');assert.equal(h.ctx.USER_RESOURCES[0]._fbId,'trainer-a__res1');
  assert.equal(h.ctx.AUTOFLOWS[0].status,'inactive');assert.notEqual(h.ctx.AUTOFLOWS[0].id,'afdemo');assert.equal(h.ctx.FORUM_GROUPS[0].memberIds.length,0);
  const failed=harness({globals:{DEMO_RESOURCES:[{id:'res1'}]},write:async()=>null});await failed.ctx.load(failed.signIn());
  assert.equal(failed.calls.writes.length,1);assert.equal(failed.ctx.USER_RESOURCES.length,0);
});

await test('account switch during seed acknowledgement cannot insert old defaults or write later seeds',async()=>{
  const gate=deferred();const h=harness({globals:{DEMO_RESOURCES:[{id:'res1'},{id:'res2'}]},write:()=>gate.promise});
  const pending=h.ctx.load(h.signIn());await flush();assert.equal(h.calls.writes.length,1);
  h.signIn('trainer-b');gate.resolve({id:'res1',trainerId:'trainer-a',_fbId:'trainer-a__res1'});
  assert.equal(await pending,false);assert.equal(h.ctx.USER_RESOURCES.length,0);assert.equal(h.calls.writes.length,1);assert.equal(h.ctx._tenantDataReady,false);
});

await test('authenticated account changes after boot hide and reset data before reloading',async()=>{
  const h=harness();h.signIn();h.ctx.CL.push({id:'private'});h.ctx._tenantBootComplete=true;
  h.calls.authCallback({uid:'trainer-b',email:'b@example.test'});await flush();
  assert.equal(h.calls.reloads,1);assert.equal(h.ctx.CL.length,0);assert.equal(h.element('app-root').style.display,'none');
  assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.calls.queries.length,0);
});

await test('boot errors keep private app hidden and never mark the session ready',async()=>{
  const h=harness({globals:{fetchClientAccount:async()=>{throw new Error('denied');}}});
  h.calls.authCallback({uid:'trainer-a',email:'a@example.test'});await flush();
  assert.equal(h.element('app-root').style.display,'none');assert.equal(h.element('auth-screen').style.display,'flex');
  assert.match(h.element('auth-error').textContent,/wczytać danych konta/);assert.equal(h.ctx._tenantDataReady,false);assert.equal(h.ctx._tenantBootComplete,false);
  assert.equal(h.calls.queries.length,0);assert.equal(h.calls.writes.length,0);
});

await test('public trainer projection is synchronized only after an owned settings snapshot',async()=>{
  let projectionCalls=0;
  const h=harness({rows:{settings:[['trainer-a',{trainerId:'trainer-a',profile:{name:'Own'}}]]},globals:{syncTrainerPublicProfile:async session=>{projectionCalls++;assert.equal(session.uid,'trainer-a');assert.equal(h.ctx.SETTINGS.profile.name,'Own');assert.equal(h.ctx._tenantDataReady,true);return true;}}});
  await h.ctx.load(h.signIn());assert.equal(projectionCalls,1);
});
console.log('\n'+passed+' tenant-loader scenarios passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
