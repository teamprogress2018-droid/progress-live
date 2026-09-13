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
ok('kb default note',html.includes('value="note">Notatka</option>')&&src09.includes("p.kind||'note'"));
ok('kbContext no leftover dump',!src09.includes('POZOSTAŁE NOTATKI TRENERA')&&src09.includes('planningEvidenceContext(3500)'));
ok('note+evidence first-class',core.includes("kind==='note'||kind==='evidence'||kind==='principle'"));
ok('user notes before builtins',core.includes('user.map(mapUser).concat(builtins.map'));
ok('kbContext uses planning',/function kbContextForAI[\s\S]{0,400}planningEvidenceContext/.test(src09));
ok('aplGenerate uses kb context',src03.includes('kbContextForAI()'));
ok('askAI safety+watch', /clientSafetyContextForAI/.test(src06) && /clientMonitorContextForAI/.test(src06));
ok('copy notes+evidence',html.includes('notatki i badania'));

const sandbox={window:{KB:[]},console};
vm.createContext(sandbox);
const start=core.indexOf('const BUILTIN_PLANNING_EVIDENCE=');
const end=core.indexOf('window.normalizeKbKind=normalizeKbKind;')+'window.normalizeKbKind=normalizeKbKind;'.length;
ok('evidence slice',start>=0&&end>start);
vm.runInContext(core.slice(start,end),sandbox);

const list=sandbox.getPlanningEvidenceEntries();
ok('builtins present',list.length>=5);
ok('context header notes+evidence',sandbox.planningEvidenceContext(2000).includes('BADANIA I NOTATKI TRENERA'));
ok('note uses planning',sandbox.kbEntryUsesInPlanning({kind:'note',title:'x',text:'y'})===true);
ok('evidence uses planning',sandbox.kbEntryUsesInPlanning({kind:'evidence',title:'x',text:'y'})===true);
ok('off note skipped',sandbox.kbEntryUsesInPlanning({kind:'note',title:'x',text:'y',useInPlanning:false})===false);

sandbox.window.KB=[
  {id:'n1',kind:'note',title:'ZZZ sen 7h',text:'Przy słabym śnie tnij objętość.',useInPlanning:true},
  {id:'n2',kind:'note',title:'Tajemnica gabinetu',text:'Nie do AI.',useInPlanning:false},
  {id:'e1',kind:'evidence',title:'Pełny ROM',text:'Dłuższy zakres przy hipertrofii.',useInPlanning:true,citation:'Schoenfeld'}
];
const mixed=sandbox.getPlanningEvidenceEntries();
ok('user note in planning',mixed.some(e=>e.title==='ZZZ sen 7h'));
ok('user evidence in planning',mixed.some(e=>e.title==='Pełny ROM'));
ok('off note not in planning',!mixed.some(e=>e.title==='Tajemnica gabinetu'));
const ctx=sandbox.planningEvidenceContext(8000);
ok('ctx has note',ctx.includes('ZZZ sen 7h'));
ok('ctx has evidence',ctx.includes('Pełny ROM'));
ok('ctx skips off note',!ctx.includes('Tajemnica gabinetu'));
ok('user note before builtin',ctx.indexOf('ZZZ sen 7h')<ctx.indexOf('Częstotliwość'));

ok('cache bumps',html.includes('01-core.js?v=103')&&html.includes('09-posture-kb-invites-private.js?v=42'));
const wf=fs.readFileSync(path.join(root,'.github/workflows/check.yml'),'utf8');
ok('CI ui',wf.includes('test_kb_notes_evidence_ui.js'));
ok('cache bumps',html.includes('01-core.js?v=103')&&html.includes('09-posture-kb-invites-private.js?v=42'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll evidence-base tests passed');
