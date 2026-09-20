#!/usr/bin/env node
/** KB tags bind MEV/RIR/muscle notes to builder days and exercises. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src09=fs.readFileSync(path.join(root,'09-posture-kb-invites-private.js'),'utf8');
const src06=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github/workflows/check.yml'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('tag defs',core.includes('const KB_TAG_DEFS=')&&core.includes("id:'mev'")&&core.includes("id:'klatka'"));
ok('builder collect',src05.includes('function builderCollectKbTags')&&src05.includes('function builderRefreshKbHits'));
ok('day strip',src05.includes('builder-day-kb')&&html.includes('id="builder-kb-hits"')&&html.includes('id="kb-tag-picker"'));
ok('save tags',src09.includes('kbReadTagPicker')&&/useInPlanning,\s*tags/.test(src09));
ok('askAI tags',src06.includes('preferTags')&&src06.includes('builderCollectKbTags'));
ok('css tags',css.includes('.kb-tag-btn.is-on')&&css.includes('.builder-kb-hit'));
ok('cache pins',html.includes('01-core.js?v=111')&&html.includes('05-clients-builder-plans-calendar.js?v=79')&&html.includes('09-posture-kb-invites-private.js?v=51')&&html.includes('styles.css?v=98'));
ok('CI unit',wf.includes('test_kb_builder_tags.js'));
ok('CI ui',wf.includes('test_kb_builder_tags_ui.js'));

const sandbox={window:{KB:[]},console};
vm.createContext(sandbox);
const start=core.indexOf('const BUILTIN_PLANNING_EVIDENCE=');
const end=core.indexOf('window.kbEntriesForBuilder=kbEntriesForBuilder;')+'window.kbEntriesForBuilder=kbEntriesForBuilder;'.length;
ok('slice',start>=0&&end>start);
vm.runInContext(core.slice(start,end),sandbox);

ok('infer rir',sandbox.kbTagsFromText('trzymaj RIR 2').includes('rir'));
ok('infer quady',sandbox.kbTagsFromText('Hack squat na czworogłowe').includes('quady'));
sandbox.window.KB=[
  {id:'k1',kind:'note',title:'Klatka stretch',text:'Pauza w rozciągnięciu.',tags:['klatka','mev'],useInPlanning:true},
  {id:'k2',kind:'note',title:'Tylko quady',text:'Hack.',tags:['quady'],useInPlanning:true},
  {id:'k3',kind:'note',title:'Sen',text:'Tnij objętość.',useInPlanning:true}
];
const push=sandbox.kbEntriesForBuilder(['klatka','mev','rir'],{limit:12});
ok('muscle match',push.some(h=>h.entry.id==='k1'));
ok('other muscle hidden',!push.some(h=>h.entry.id==='k2'));
ok('muscle outranks landmark',push[0]&&push[0].entry.id==='k1');
ok('untagged general allowed',push.some(h=>h.entry.id==='k3')||push.some(h=>h.entry.id==='bev_vol'));
ok('prefer chest first',(()=>{const c=sandbox.planningEvidenceContext(2500,{preferTags:['klatka']});return c.indexOf('Klatka stretch')>=0&&(c.indexOf('Tylko quady')<0||c.indexOf('Klatka stretch')<c.indexOf('Tylko quady'));})());

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll kb-builder-tags tests passed');
