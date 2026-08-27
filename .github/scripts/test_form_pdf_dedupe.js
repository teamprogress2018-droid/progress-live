#!/usr/bin/env node
/** Forms: PDF/print helpers + profile no longer duplicates intake fields. */
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
const src07=fs.readFileSync(path.join(root,'07-forms-metrics-calculator.js'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');

if(!src07.includes('function buildFormPrintHtml')||!src07.includes('function printFormPdf')){
  console.error('FAIL missing print helpers');process.exit(1);
}
if(!src07.includes("printFormPdf('")&&!src07.includes('printFormPdf("${')){
  // button wiring
}
if(!src07.includes('printFormPdf')){console.error('FAIL printFormPdf not wired');process.exit(1);}
if(!src08.includes('Ankieta wstępna — tylko w Formularzach')){console.error('FAIL profile edit missing intake banner');process.exit(1);}
if(src08.includes("id=\"cpe-goal\"")){console.error('FAIL profile edit still has cpe-goal duplicate');process.exit(1);}
if(src08.includes("id=\"cpe-injuries\"")){console.error('FAIL profile edit still has cpe-injuries duplicate');process.exit(1);}
if(!src09.includes('wyłącznie z Ankiety wstępnej')&&!src09.includes('cpe-goal')){
  // saveCPEdit should guard missing fields
}
if(!src09.includes('if(goalEl)c.goal=goalEl.value')){console.error('FAIL saveCPEdit not tolerant of removed fields');process.exit(1);}
if(!src07.includes('intakePendingId')||!src07.includes('listSends')){console.error('FAIL renderCPForms missing intake list dedupe');process.exit(1);}

const sandbox={
  window:{},
  escHtml:s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  formatFormAnswer:(q,v)=>v==null||v===''?'—':String(v),
  getTrainerName:()=>'Trener Test',
  console
};

vm.runInNewContext(extract(src07,'buildFormPrintHtml')+'\nwindow.buildFormPrintHtml=buildFormPrintHtml;',sandbox);

const form={
  name:'Ankieta wstępna',
  desc:'Test',
  questions:[
    {id:'q1',type:'text',text:'Cel?',required:true},
    {id:'q3',type:'yesno',text:'Kontuzje?',required:true},
    {id:'q5',type:'number',text:'Dni?',required:true}
  ]
};

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

const blank=sandbox.buildFormPrintHtml(form,{filled:false});
ok('blank has title',blank.includes('Ankieta wstępna'));
ok('blank has checkboxes',blank.includes('☐ Tak')&&blank.includes('☐ Nie'));
ok('blank has lines',blank.includes('blank line'));
ok('blank auto print',blank.includes('window.print()'));

const filled=sandbox.buildFormPrintHtml(form,{
  filled:true,
  answers:{q1:'Redukcja',q3:'tak',q5:'4'},
  clientName:'Piotr Urbaniak'
});
ok('filled shows answer',filled.includes('Redukcja'));
ok('filled client',filled.includes('Piotr Urbaniak'));
ok('filled flag',filled.includes('WYPEŁNIONE'));

ok('list excludes intake pending',/listSends=intakePendingId\?sends\.filter\(s=>s\.id!==intakePendingId\)/.test(src07));
ok('cp forms maps listSends',/listSends\.map\(s=>/.test(src07)&&!/[^a-zA-Z]sends\.map\(s=>/.test(src07.slice(src07.indexOf('function renderCPForms'),src07.indexOf('function renderCPMetrics'))));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll form PDF / intake dedupe tests passed');
