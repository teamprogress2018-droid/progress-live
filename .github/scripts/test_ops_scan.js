#!/usr/bin/env node
/** Ops scan: dashboard collectOpsEvents also fills the bell; 60s clock instead of cron. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github/workflows/check.yml'),'utf8');
const audit=fs.readFileSync(path.join(root,'docs/system-audit.md'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('generate uses ops',src04.includes('collectOpsEvents(false)')&&/channel==='attention'/.test(src04));
ok('ops notif key',src04.includes('function opsEventNotifKey')&&src04.includes('auto_ops_'));
ok('scan clock',src04.includes('function startOpsScanClock')&&src04.includes('60000')&&src04.includes('visibilitychange'));
ok('load starts clock',html.includes('startOpsScanClock()'));
ok('cache 04',html.includes('04-client-portal.js?v=51'));
ok('CI',wf.includes('test_ops_scan.js'));
ok('audit notes scan',/startOpsScanClock|jeden skan/.test(audit));

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

const sandbox={window:{},console};
vm.createContext(sandbox);
vm.runInContext(extract(src04,'opsEventNotifKey')+'\nwindow.opsEventNotifKey=opsEventNotifKey;',sandbox);
const k1=sandbox.opsEventNotifKey({channel:'attention',clientId:'c2',tag:'Raport zaległy'});
const k2=sandbox.opsEventNotifKey({channel:'attention',clientId:'c2',tag:'Raport zaległy'});
const k3=sandbox.opsEventNotifKey({channel:'attention',clientId:'c1',tag:'Brak planu'});
ok('stable key',k1===k2&&k1.indexOf('auto_ops_')===0);
ok('distinct clients',k1!==k3);

const notes=[];
vm.runInContext(
  'function allNotifs(){return window.NOTIFICATIONS||[];}\n'+
  'function allPackages(){return window.PACKAGES||[];}\n'+
  'function dateStr(){return "2099-01-01";}\n'+
  'function collectOpsEvents(){return [{channel:"attention",pri:0,clientId:"c2",name:"Bartek",tag:"Raport zaległy",meta:"Spóźniony check-in",cta:"sendCheckinTo(\'c2\')"}];}\n'+
  'function addNotification(type,title,body,action,id){notes.push({type,title,body,action,id});window.NOTIFICATIONS.push({id,type,title,body,autoKey:id});}\n'+
  'function dashOpsExpiringPackages(){return [];}\n'+
  'function updateNotifBadge(){}\n'+
  extract(src04,'opsEventNotifKey')+'\n'+
  extract(src04,'generateAutoNotifs')+'\n'+
  'generateAutoNotifs();',
  vm.createContext({
    window:{
      SE:[{id:'s-today',clientId:'c1',date:'2099-01-01',source:'planned',type:'Siła',time:'08:00'}],
      CL:[{id:'c1',name:'Anna',status:'active'},{id:'c2',name:'Bartek',status:'active'}],
      PACKAGES:[],
      TASKS:[],
      NOTIFICATIONS:[]
    },
    notes,
    console, Date, Math, String
  })
);
ok('session today still fires',notes.some(n=>n.id==='auto_sess_s-today'&&n.type==='session'));
ok('attention to bell',notes.some(n=>n.title==='Raport zaległy'&&/Bartek/.test(n.body)&&n.type==='alert'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll ops-scan tests passed');
