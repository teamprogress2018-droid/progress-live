#!/usr/bin/env node
/** Forum enroll: public + private groups get memberIds. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const src=fs.readFileSync(path.join(__dirname,'../../04-client-portal.js'),'utf8');
function extract(name){
  const start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const msgs=[];
const persisted=[];
const sandbox={
  window:{
    FORUM_GROUPS:[
      {id:'g-pub',name:'Ogólna',privacy:'public',memberIds:[]},
      {id:'g-priv',name:'VIP',privacy:'private',memberIds:['c-old']},
      {id:'g-miss',name:'X',privacy:'private',memberIds:[]}
    ],
    CL:[{id:'c1',name:'Ada'},{id:'c2',name:'Bartek'}],
    _clientAppMode:false,
    _clientId:null
  },
  persistById:(col,obj)=>persisted.push({col,id:obj.id,members:(obj.memberIds||[]).slice()}),
  pushMsg:(cid,t)=>msgs.push({cid,t}),
  console
};
sandbox.window.FORUM_GROUPS=sandbox.window.FORUM_GROUPS;
vm.runInNewContext(
  extract('allForumGroups')+'\n'+
  extract('forumCanSeeGroup')+'\n'+
  extract('visibleForumGroups')+'\n'+
  extract('isClientInForumGroup')+'\n'+
  extract('enrollClientInForumGroup')+'\n'+
  'window.allForumGroups=allForumGroups;window.forumCanSeeGroup=forumCanSeeGroup;'+
  'window.visibleForumGroups=visibleForumGroups;window.isClientInForumGroup=isClientInForumGroup;'+
  'window.enrollClientInForumGroup=enrollClientInForumGroup;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

const {enrollClientInForumGroup,isClientInForumGroup,forumCanSeeGroup}=sandbox;

eq('not enrolled yet',isClientInForumGroup('c1','g-pub'),false);
const r1=enrollClientInForumGroup('c1','g-pub',{notify:true});
eq('public enroll ok',r1.ok,true);
eq('public enroll added',r1.added,true);
eq('public memberIds',sandbox.window.FORUM_GROUPS[0].memberIds,['c1']);
eq('public enrolled flag',isClientInForumGroup('c1','g-pub'),true);
eq('chat notify',msgs.some(m=>m.cid==='c1'&&/Ogólna/.test(m.t)),true);

const r2=enrollClientInForumGroup('c1','g-pub',{notify:true});
eq('idempotent added false',r2.added,false);
eq('no second notify',msgs.filter(m=>m.cid==='c1').length,1);

const r3=enrollClientInForumGroup('c2','g-priv',{notify:true});
eq('private enroll',r3.added,true);
eq('private members',sandbox.window.FORUM_GROUPS[1].memberIds,['c-old','c2']);
eq('persist called',persisted.some(p=>p.id==='g-priv'&&p.members.indexOf('c2')>=0),true);

sandbox.window._clientAppMode=true;
sandbox.window._clientId='c2';
eq('client sees private when member',forumCanSeeGroup(sandbox.window.FORUM_GROUPS[1]),true);
sandbox.window._clientId='c1';
eq('client blocked private non-member',forumCanSeeGroup(sandbox.window.FORUM_GROUPS[1]),false);
eq('client sees public',forumCanSeeGroup(sandbox.window.FORUM_GROUPS[0]),true);

eq('missing group',enrollClientInForumGroup('c1','nope').ok,false);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll forum enroll tests passed');
