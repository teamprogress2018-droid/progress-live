#!/usr/bin/env node
/** Dashboard form follow-up + intake helpers. */
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
const src01=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src07=fs.readFileSync(path.join(root,'07-forms-metrics-calculator.js'),'utf8');
const src04=fs.readFileSync(path.join(root,'04-client-portal.js'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

if(!html.includes('id="dash-form-followup"')){console.error('FAIL missing dash-form-followup');process.exit(1);}
if(!src04.includes('function renderDashFormFollowup')){console.error('FAIL missing renderDashFormFollowup');process.exit(1);}
if(!src05.includes('sendClientIntakeForm')||!src05.includes('Ankieta wstępna')){console.error('FAIL onboard intake CTA missing');process.exit(1);}

const msgs=[];
const notes=[];
const persisted=[];
const sandbox={
  window:{
    CL:[{id:'c1',name:'Anna',status:'active'},{id:'c2',name:'Bartek',status:'archived'}],
    FORM_SENDS:[
      {id:'fs1',clientId:'c1',formId:'df1',formName:'Ankieta wstępna',status:'sent',sentAtIso:'2026-08-20'},
      {id:'fs2',clientId:'c1',formId:'df2',formName:'Postępy',status:'filled',sentAtIso:'2026-08-10'},
      {id:'fs3',clientId:'c2',formId:'df1',formName:'Ankieta',status:'sent',sentAtIso:'2026-08-21'}
    ],
    CUSTOM_FORMS:[],
    _onboardClientId:null
  },
  FORM_SENDS:null,
  DEMO_FORMS:[{id:'df1',name:'Ankieta wstępna',cat:'wstepna',questions:[{id:'q1',text:'Cel'}]}],
  CL:null,
  notify:()=>{},
  addNotification:(t,title,body,screen)=>notes.push({t,title,body,screen}),
  pushMsg:(id,t)=>msgs.push({id,t}),
  persistById:(col,obj)=>persisted.push({col,id:obj.id}),
  withTrainer:(o)=>o,
  newId:(p)=>p+'_x',
  snapshotFormQuestions:(f)=>(f.questions||[]).slice(),
  renderDashFormFollowup:()=>{},
  renderClientOnboardChecklist:()=>{},
  allForms:function(){return sandbox.DEMO_FORMS.concat(sandbox.window.CUSTOM_FORMS||[]);},
  console
};
sandbox.CL=sandbox.window.CL;
sandbox.FORM_SENDS=sandbox.window.FORM_SENDS;
sandbox.window.FORM_SENDS=sandbox.FORM_SENDS;
sandbox.window.CL=sandbox.CL;

vm.runInNewContext(
  'function allForms(){return DEMO_FORMS.concat(window.CUSTOM_FORMS||[]);}\n'+
  extract(src01,'pendingFormSends')+'\n'+
  extract(src01,'allPendingFormSends')+'\n'+
  extract(src01,'defaultIntakeForm')+'\n'+
  extract(src01,'clientIntakeFormState')+'\n'+
  extract(src07,'remindFormSend')+'\n'+
  extract(src07,'sendClientIntakeForm')+'\n'+
  extract(src07,'createFormSend')+'\n'+
  'window.pendingFormSends=pendingFormSends;window.allPendingFormSends=allPendingFormSends;window.defaultIntakeForm=defaultIntakeForm;window.clientIntakeFormState=clientIntakeFormState;window.remindFormSend=remindFormSend;window.sendClientIntakeForm=sendClientIntakeForm;window.createFormSend=createFormSend;',
  sandbox
);

let failed=0;
function eq(name,got,want){
  if(JSON.stringify(got)!==JSON.stringify(want)){console.error('FAIL',name,got,want);failed++;}
  else console.log('OK  ',name);
}

eq('pending for c1',sandbox.pendingFormSends('c1').map(s=>s.id),['fs1']);
eq('all pending skips archived',sandbox.allPendingFormSends().map(s=>s.id),['fs1']);
eq('default intake',sandbox.defaultIntakeForm()&&sandbox.defaultIntakeForm().id,'df1');

const st=sandbox.clientIntakeFormState('c1');
eq('intake pending',!!st.pending,true);
eq('intake not filled',st.filled,false);
eq('intake sent',st.sent,true);

msgs.length=0;notes.length=0;persisted.length=0;
eq('remind ok',sandbox.remindFormSend('fs1'),true);
eq('remind chat',msgs.length>=1,true);
eq('remind flag',!!sandbox.window.FORM_SENDS.find(s=>s.id==='fs1').remindedAt,true);

// already pending — should not duplicate
const before=sandbox.window.FORM_SENDS.length;
const again=sandbox.sendClientIntakeForm('c1');
eq('no dup send',again&&again.id,'fs1');
eq('sends unchanged',sandbox.window.FORM_SENDS.length,before);

// fresh client
sandbox.window.CL.push({id:'c3',name:'Celina',status:'active'});
sandbox.CL=sandbox.window.CL;
const created=sandbox.sendClientIntakeForm('c3');
eq('created intake',!!created&&created.formId==='df1'&&created.clientId==='c3',true);
eq('now pending includes c3',sandbox.allPendingFormSends().some(s=>s.clientId==='c3'),true);

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll dash forms follow-up tests passed');
