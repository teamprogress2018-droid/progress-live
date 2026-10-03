'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../..','04-client-portal.js'),'utf8');
const start=source.indexOf('async function persistForumPostEngagement(');
assert.ok(start>=0,'engagement writer is asynchronous');
const helper=source.slice(start,source.indexOf('\nfunction reactToPost(',start));
function setup(clientMode=true){
  const warnings=[],writes=[];
  let stored={id:'old-payload-id',trainerId:'trainer-a',title:'Treść pozostaje bez zmian',
    reactions:{like:1,heart:1},reactedBy:{'client-a':'like','client-b':'heart'},likes:2,views:5,comments:3};
  const ctx={window:null,console:{warn(){}},_clientAppMode:clientMode,_uid:clientMode?'client-a':'trainer-a',
    _trainerId:'trainer-a',_db:{},tenantSessionGeneration:1,
    _doc:(_,collection,id)=>({collection,id}),persistWarn:message=>warnings.push(message),
    _setDoc:()=>{throw Error('engagement must never create a post or merge nested maps');},
    persistById:()=>{throw Error('trainer engagement must also replace map fields');},
    _updateDoc:async(ref,patch)=>{
      writes.push({ref,patch:JSON.parse(JSON.stringify(patch))});
      if(!stored)throw Error('not-found');
      // Firestore updateDoc replaces top-level maps; no omitted nested keys survive.
      stored={...stored,...JSON.parse(JSON.stringify(patch))};
    }};
  ctx.window=ctx;ctx.tenantSessionIsCurrent=s=>s.uid===ctx._uid&&s.generation===ctx.tenantSessionGeneration;
  vm.createContext(ctx);vm.runInContext(helper,ctx);
  return {ctx,warnings,writes,getStored:()=>stored,removePost:()=>{stored=null;}};
}
(async()=>{
  for(const clientMode of [true,false]){
    const {ctx,writes,getStored}=setup(clientMode);
    const post={id:'post-a',trainerId:'trainer-a',reactions:{heart:1},reactedBy:{'client-b':'heart'},likes:1,views:5,comments:3};
    assert.equal(await ctx.persistForumPostEngagement(post),true);
    assert.equal(writes.length,1);assert.equal(writes[0].ref.collection,'forumPosts');assert.equal(writes[0].ref.id,'post-a');
    assert.deepEqual(getStored().reactions,{heart:1});assert.deepEqual(getStored().reactedBy,{'client-b':'heart'},'removing my reaction preserves the other actor');
    assert.equal(getStored().id,'old-payload-id','legacy payload ID is not rewritten');
    assert.equal(getStored().trainerId,'trainer-a');assert.equal(getStored().title,'Treść pozostaje bez zmian');
    assert.equal('id' in writes[0].patch,false);assert.equal('trainerId' in writes[0].patch,false);
    assert.deepEqual(Object.keys(writes[0].patch).sort(),['comments','likes','reactedBy','reactions','views']);
    post.reactions={};post.reactedBy={};post.likes=0;
    assert.equal(await ctx.persistForumPostEngagement(post),true);
    assert.deepEqual(getStored().reactions,{});assert.deepEqual(getStored().reactedBy,{});
  }
  {
    const {ctx,warnings,removePost,getStored}=setup();removePost();
    assert.equal(await ctx.persistForumPostEngagement({id:'missing',trainerId:'trainer-a'}),false);
    assert.equal(getStored(),null);assert.equal(warnings.length,1,'missing post reports failure without creating it');
  }
  {
    const {ctx,warnings,writes}=setup();
    assert.equal(await ctx.persistForumPostEngagement({id:'foreign',trainerId:'trainer-b'}),false);assert.equal(writes.length,0);
    ctx._updateDoc=async()=>{throw Error('permission-denied');};
    const p={id:'denied',trainerId:'trainer-a'};
    assert.equal(await ctx.persistForumPostEngagement(p),false);assert.equal(p._fbId,undefined);assert.equal(warnings.length,2);
  }
  {
    const {ctx}=setup();let release;
    ctx._updateDoc=()=>new Promise(resolve=>release=resolve);
    const p={id:'delayed',trainerId:'trainer-a'};const pending=ctx.persistForumPostEngagement(p);
    assert.equal(p._fbId,undefined);ctx._uid='another-login';ctx.tenantSessionGeneration++;
    release();assert.equal(await pending,false);assert.equal(p._fbId,undefined,'stale completion cannot mutate prior-account state');
  }
  console.log('OK forum reaction persistence: map removal, other actors, trainer/client parity, legacy IDs, no recreation, errors and stale save');
})().catch(error=>{console.error(error);process.exitCode=1;});
