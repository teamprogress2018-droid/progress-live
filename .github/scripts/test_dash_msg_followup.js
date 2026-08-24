#!/usr/bin/env node
/** Dashboard unread-messages follow-up helpers. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

function extract(src,name){
  const start=src.indexOf('function '+name);
  if(start<0)throw new Error('missing '+name);
  let i=start,depth=0,begun=false;
  for(;i<src.length;i++){
    if(src[i]==='{'){depth++;begun=true;}
    else if(src[i]==='}'){depth--;if(begun&&depth===0){i++;break;}}
  }
  return src.slice(start,i);
}

const root=path.join(__dirname,'../..');
const src06=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src10=fs.readFileSync(path.join(root,'10-client-app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

if(!html.includes('id="dash-msg-followup"')){console.error('FAIL missing dash-msg-followup');process.exit(1);}
if(!html.includes('id="nb-inbox"')){console.error('FAIL missing nb-inbox badge');process.exit(1);}
if(!src04.includes('function renderDashMsgFollowup')){console.error('FAIL missing renderDashMsgFollowup');process.exit(1);}
if(!src04.includes('renderDashMsgFollowup()')){console.error('FAIL renderDash does not call msg followup');process.exit(1);}
if(!src06.includes('function clientsWithUnreadMsgs')){console.error('FAIL missing clientsWithUnreadMsgs');process.exit(1);}
if(!src10.includes('renderDashMsgFollowup')){console.error('FAIL client send missing dash refresh');process.exit(1);}

const store={};
const sandbox={
  window:{
    CL:[
      {id:'c1',name:'Anna',status:'active'},
      {id:'c2',name:'Bartek',status:'active'},
      {id:'c3',name:'Archived',status:'archived'}
    ],
    MSGS:{
      c1:[
        {text:'stara',out:false,createdAt:'2026-08-20T10:00:00.000Z',time:'10:00'},
        {text:'nowa od Anny',out:false,createdAt:'2026-08-24T12:00:00.000Z',time:'12:00'}
      ],
      c2:[
        {text:'od trenera',out:true,createdAt:'2026-08-24T11:00:00.000Z',time:'11:00'},
        {text:'od Bartka',out:false,createdAt:'2026-08-24T11:30:00.000Z',time:'11:30'}
      ],
      c3:[
        {text:'z archiwum',out:false,createdAt:'2026-08-24T13:00:00.000Z',time:'13:00'}
      ]
    }
  },
  CL:null,
  MSGS:null,
  localStorage:{
    getItem:k=>store[k]||null,
    setItem:(k,v)=>{store[k]=String(v);}
  },
  document:{getElementById:()=>null},
  console
};
sandbox.CL=sandbox.window.CL;
sandbox.MSGS=sandbox.window.MSGS;
sandbox.window.CL=sandbox.CL;
sandbox.window.MSGS=sandbox.MSGS;

vm.runInNewContext(
  extract(src06,'msgGetLastRead')+'\n'+
  extract(src06,'msgSetLastRead')+'\n'+
  extract(src06,'msgHasUnread')+'\n'+
  extract(src06,'clientsWithUnreadMsgs')+'\n'+
  extract(src06,'unreadMsgCount')+'\n'+
  'window.msgGetLastRead=msgGetLastRead;window.msgSetLastRead=msgSetLastRead;'+
  'window.msgHasUnread=msgHasUnread;window.clientsWithUnreadMsgs=clientsWithUnreadMsgs;'+
  'window.unreadMsgCount=unreadMsgCount;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('unread both active',sandbox.clientsWithUnreadMsgs().map(r=>r.client.id),['c1','c2']);
eq('count',sandbox.unreadMsgCount(),2);
eq('has unread c1',sandbox.msgHasUnread('c1'),true);

sandbox.msgSetLastRead('c1');
eq('read clears c1',sandbox.msgHasUnread('c1'),false);
eq('only c2 left',sandbox.clientsWithUnreadMsgs().map(r=>r.client.id),['c2']);
eq('preview text',sandbox.clientsWithUnreadMsgs()[0].last.text,'od Bartka');
eq('archived skipped',sandbox.clientsWithUnreadMsgs().some(r=>r.client.id==='c3'),false);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll dash msg follow-up tests passed');
