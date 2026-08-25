#!/usr/bin/env node
/** Method rationale panel: shared “why” for builder / AI / templates. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src03=fs.readFileSync(path.join(root,'03-ai-plangen-bizstats-aicoach.js'),'utf8');
const src02=fs.readFileSync(path.join(root,'02-workouts-onboarding-templates-live.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}
function eq(name,got,want){
  if(got!==want){console.error('FAIL',name,'got',got,'want',want);failed++;}
  else console.log('OK  ',name);
}

ok('buildMethodRationale exported',core.includes('function buildMethodRationale')&&core.includes('window.buildMethodRationale'));
ok('renderMethodRationaleHTML',core.includes('function renderMethodRationaleHTML'));
ok('METHOD_WHY PPL',core.includes("PPL:{label:"));
ok('GOAL_WHY masa sets',core.includes("masa:{")&&core.includes('3–4 serie'));
ok('sources educational',core.includes('NSCA')&&(core.includes('nie pobiera live PubMed')||core.includes('Brak live PubMed')));
ok('builder panel mount',html.includes('id="builder-rationale"'));
ok('apl panel mount',html.includes('id="apl-rationale"'));
ok('builder refresh hook',src05.includes('builderRefreshRationale'));
ok('method change refreshes',/builderOnMethodChange[\s\S]{0,120}builderRefreshRationale/.test(src05));
ok('aplToggle refreshes',src03.includes('aplRefreshRationale'));
ok('aplRenderPlan embeds',src03.includes('renderMethodRationaleHTML'));
ok('summary prompt longer',src03.includes('3–5 zdań dla trenera początkującego'));
ok('template rationale',src02.includes('tplcRefreshRationale')&&src02.includes('tplc-rationale'));
ok('css method-rationale',css.includes('.method-rationale'));
ok('cache bumps',html.includes('01-core.js?v=28')&&html.includes('05-clients-builder-plans-calendar.js?v=23')&&html.includes('styles.css?v=31'));

const sandbox={window:{},console};
vm.createContext(sandbox);
const start=core.indexOf('// ════════════════════════════════════════\n// UZASADNIENIE METODYCZNE');
const end=core.indexOf('window.normalizeRationaleMethod=normalizeRationaleMethod;')+'window.normalizeRationaleMethod=normalizeRationaleMethod;'.length;
ok('slice found',start>=0&&end>start);
vm.runInContext(core.slice(start,end)+'\nwindow.buildMethodRationale=buildMethodRationale;window.renderMethodRationaleHTML=renderMethodRationaleHTML;',sandbox);
const b=sandbox.buildMethodRationale({method:'PPL',goal:'masa',level:'poczatkujacy',daysPerWeek:3});
eq('PPL label',b.methodLabel,'Push / Pull / Legs');
ok('PPL tip for 3 days',b.tips.some(t=>/PPL przy 3/.test(t)));
ok('masa sets',/3–4/.test(b.sets));
ok('html render',sandbox.renderMethodRationaleHTML(b).includes('Dlaczego tak?'));
eq('normalize UL',sandbox.normalizeRationaleMethod('Upper/Lower'),'Upper Lower');

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll method-rationale tests passed');
