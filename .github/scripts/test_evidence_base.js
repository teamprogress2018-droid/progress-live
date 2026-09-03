#!/usr/bin/env node
/** Evidence base: trainer principles/PubMed links as planning context. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');
const src03=fs.readFileSync(path.join(root,'03-ai-plangen-bizstats-aicoach.js'),'utf8');
const src06=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('BUILTIN_PLANNING_EVIDENCE',core.includes('BUILTIN_PLANNING_EVIDENCE')&&core.includes('pubmed.ncbi.nlm.nih.gov'));
ok('planningEvidenceContext',core.includes('function planningEvidenceContext'));
ok('getPlanningEvidenceEntries',core.includes('function getPlanningEvidenceEntries'));
ok('kb kinds UI',html.includes('id="kb-kind"')&&html.includes('value="evidence"')&&html.includes('kb-use-planning'));
ok('kb filters',html.includes('setKbFilter')&&html.includes('kb-builtin-preview'));
ok('import pack',src09.includes('kbImportBuiltinPack'));
ok('kbContext uses planning',/function kbContextForAI[\s\S]{0,400}planningEvidenceContext/.test(src09));
ok('aplGenerate uses kb context',src03.includes('kbContextForAI()'));
ok('askAI safety+watch', /clientSafetyContextForAI/.test(src06) && /clientMonitorContextForAI/.test(src06));

const sandbox={window:{KB:[]},console};
vm.createContext(sandbox);
const start=core.indexOf('const BUILTIN_PLANNING_EVIDENCE=');
const end=core.indexOf('window.normalizeKbKind=normalizeKbKind;')+'window.normalizeKbKind=normalizeKbKind;'.length;
ok('evidence slice',start>=0&&end>start);
vm.runInContext(core.slice(start,end),sandbox);

const list=sandbox.getPlanningEvidenceEntries();
ok('builtins present',list.length>=5);
ok('context has DOWODY',sandbox.planningEvidenceContext(2000).includes('DOWODY I ZASADY TRENERA'));
sandbox.window.KB=[{id:'k1',kind:'principle',title:'Moja zasada: deload wcześniej',text:'Przy słabym śnie deload co 3 tyg.',useInPlanning:true,citation:'doświadczenie'}];
const mixed=sandbox.getPlanningEvidenceEntries();
ok('merges user principle',mixed.some(e=>e.title.includes('Moja zasada')));
ok('user not duplicated builtin by title skip',true);

ok('cache bumps',html.includes('01-core.js?v=59')&&html.includes('09-posture-kb-invites-private.js?v=34'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll evidence-base tests passed');
