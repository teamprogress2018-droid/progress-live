#!/usr/bin/env node
/** Integracje: katalog eventów webhook + fireIntEvent przy podłączonym Catch Hook. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const posts=[];
const document={
  querySelectorAll:()=>[],
  querySelector:()=>null,
  getElementById:()=>null,
  addEventListener(){},
  createElement:()=>({style:{},appendChild(){},click(){},remove(){}})
};
const fetchMock=async(url,opts)=>{
  posts.push({url,body:JSON.parse(opts.body)});
  return{ok:true,status:200};
};
const windowObj={
  addEventListener(){},
  CL:[{id:'c1',name:'Ada',email:'a@t.pl'}],
  PL:[],SE:[],EX:[],WO:[],TASKS:[],PACKAGES:[],METRIC_ENTRIES:[],CHECKINS:{},
  INT_CONNECTIONS:{},
  INT_EVENT_LOG:[],
  _uid:'tr1',
  document,
  fetch:fetchMock
};
windowObj.window=windowObj;
const ctx={
  window:windowObj,document,console,Date,Math,parseInt,parseFloat,Number,String,
  Array,Object,JSON,Set,isFinite,isNaN,Infinity,undefined,URL,encodeURIComponent,
  setTimeout,clearTimeout,Promise,notify(){},persistById:async(_c,o)=>o,
  fetch:fetchMock
};
ctx.globalThis=ctx;
vm.createContext(ctx);
const root=path.join(__dirname,'../..');
vm.runInContext(fs.readFileSync(path.join(root,'01-core.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8'),ctx);

windowObj.INT_CONNECTIONS={
  zapier:{connected:true,config:{webhook_url:'https://hooks.zapier.com/hooks/catch/1/abc'}},
  make:{connected:false,config:{}}
};
windowObj.INT_EVENT_LOG=[];
windowObj.CL=[{id:'c1',name:'Ada',email:'a@t.pl'}];

let failed=0;
function ok(name,cond,extra){
  if(!cond){console.error('FAIL',name,extra||'');failed++;}
  else console.log('OK  ',name);
}

(async()=>{
  const ev=windowObj.INT_WEBHOOK_EVENTS||ctx.INT_WEBHOOK_EVENTS;
  ok('events catalog',Array.isArray(ev)&&ev.length>=7);
  ok('has checkin',ev.some(e=>e.id==='checkin.completed'));
  ok('has form',ev.some(e=>e.id==='form.submitted'));
  ok('has invite',ev.some(e=>e.id==='invite.sent'));
  ok('has garmin',ev.some(e=>e.id==='garmin.imported'));

  posts.length=0;
  const jobs=await ctx.fireIntEvent('checkin.completed',{
    checkin:{id:'ci1',clientId:'c1',score:80},
    client:{id:'c1',name:'Ada'}
  });
  ok('posted once to zapier',posts.length===1,JSON.stringify({posts:posts.length,jobs}));
  ok('url zapier',posts[0]&&/zapier\.com/.test(posts[0].url));
  ok('event field',posts[0]&&posts[0].body.event==='checkin.completed');
  ok('payload checkin',posts[0]&&posts[0].body.checkin&&posts[0].body.checkin.id==='ci1');
  ok('source tag',posts[0]&&posts[0].body.source==='progress-live');

  posts.length=0;
  windowObj.CHECKINS={c1:[]};
  const ci={id:'ci2',clientId:'c1',date:'2026-08-24',status:'pending',answers:{}};
  windowObj.CHECKINS.c1.push(ci);
  ctx.applyCheckinAnswers(ci,{energy:4,sleep:4,stress:2,nutrition:4,workouts:3,weight:'81'},'client');
  await new Promise(r=>setTimeout(r,40));
  ok('checkin fires webhook',posts.some(p=>p.body.event==='checkin.completed'));
  ok('checkin weight in payload',posts.some(p=>p.body.checkin&&String(p.body.checkin.weight)==='81'));

  if(failed){console.error(failed+' failed');process.exit(1);}
  console.log('\nAll integrations webhook tests passed');
})().catch(e=>{console.error(e);process.exit(1);});
