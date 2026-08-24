#!/usr/bin/env node
/**
 * Archive / restore / permanent delete client helpers.
 */
'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');

const confirms=[];
const notifies=[];
const dels=[];
const persisted=[];

const windowObj={
  CL:[
    {id:'c1',name:'Ada',status:'active'},
    {id:'c2',name:'Bartek',status:'active'},
    {id:'c3',name:'Celina',status:'archived'}
  ],
  _db:{},
  _del:(ref)=>Promise.resolve(dels.push(ref)),
  _doc:(_db,col,id)=>({col,id})
};
windowObj.CL=windowObj.CL;

const sandbox={
  window:windowObj,
  CL:windowObj.CL,
  console,
  persistById:(col,obj)=>{persisted.push({col,id:obj.id,status:obj.status});return obj;},
  confirm:(msg)=>{confirms.push(String(msg));return true;},
  notify:(msg)=>notifies.push(String(msg)),
  renderClients:()=>{},
  renderClientFilters:()=>{},
  closeClientProfile:()=>{},
  refreshClientProfileRemoveActions:()=>{},
  document:{getElementById:()=>({textContent:'',style:{}})},
  cpClientId:null
};
sandbox.window=windowObj;
Object.defineProperty(sandbox,'CL',{
  get(){return windowObj.CL;},
  set(v){windowObj.CL=v;}
});

// Extract only the client remove helpers from the big file via vm + eval of sliced functions is fragile.
// Instead: load the function bodies by matching and evaluating them in sandbox.
const names=['archiveClient','restoreClient','deleteClientPermanently','refreshClientProfileRemoveActions'];
for(const name of names){
  const re=new RegExp('function '+name+'\\([\\s\\S]*?\\n\\}\\n(?=function |var |window\\.|$)');
  const m=src.match(re);
  if(!m){
    // try looser: function name(...) { ... } before next function
    const start=src.indexOf('function '+name+'(');
    if(start<0)throw new Error('missing '+name);
    let i=start,depth=0,started=false;
    for(;i<src.length;i++){
      const ch=src[i];
      if(ch==='{'){depth++;started=true;}
      else if(ch==='}'){depth--;if(started&&depth===0){i++;break;}}
    }
    vm.runInNewContext(src.slice(start,i),sandbox);
  }else{
    vm.runInNewContext(m[0],sandbox);
  }
}

function eq(label,a,b){
  const ok=JSON.stringify(a)===JSON.stringify(b);
  if(!ok){
    console.error('FAIL',label,a,b);
    process.exit(1);
  }
  console.log('OK  ',label);
}

// archive
sandbox.archiveClient('c1');
eq('archived status',windowObj.CL.find(c=>c.id==='c1').status,'archived');
eq('persist archive',persisted.some(p=>p.id==='c1'&&p.status==='archived'),true);
eq('confirm archive',confirms.length>=1,true);

// restore
sandbox.restoreClient('c1');
eq('restored status',windowObj.CL.find(c=>c.id==='c1').status,'active');

// permanent delete (double confirm — both true)
const before=windowObj.CL.length;
sandbox.deleteClientPermanently('c2');
eq('deleted from CL',windowObj.CL.find(c=>c.id==='c2'),undefined);
eq('length -1',windowObj.CL.length,before-1);
eq('firestore delete',dels.some(d=>d.col==='clients'&&d.id==='c2'),true);

// cancel path
confirms.length=0;
sandbox.confirm=()=>{confirms.push('n');return false;};
const len=windowObj.CL.length;
sandbox.deleteClientPermanently('c1');
eq('cancel keeps client',windowObj.CL.length,len);

console.log('\nAll client delete/archive tests passed');
