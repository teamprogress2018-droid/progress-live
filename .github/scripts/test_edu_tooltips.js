#!/usr/bin/env node
/** Educational tooltips on sets / RPE / method fields. */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src02=fs.readFileSync(path.join(root,'02-workouts-onboarding-templates-live.js'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('EDU_TIPS map',core.includes('const EDU_TIPS=')&&core.includes('sets:')&&core.includes('rpe:'));
ok('eduTipMark helper',core.includes('function eduTipMark')&&core.includes('window.eduTipMark'));
ok('hydrateEduTips',core.includes('function hydrateEduTips'));
ok('css edu-tip',css.includes('.edu-tip')&&css.includes('attr(data-tip)'));
ok('builder method tip',html.includes('b-method-tip-btn')&&html.includes('b-method-hint'));
ok('builder headers tips',src05.includes("tip('sets')")&&src05.includes("tip('rpe')")&&src05.includes("tip('rir')"));
ok('addRow titles',src05.includes("t('sets')")&&src05.includes("t('rpe')"));
ok('apl method tip',html.includes('data-edu="method"')&&html.includes('data-edu="days"'));
ok('template tips',src02.includes('data-edu="goal"')&&src02.includes('data-edu="method"'));

const sandbox={window:{escHtml:s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')},console};
vm.createContext(sandbox);
const start=core.indexOf('const EDU_TIPS=');
const end=core.indexOf('window.eduLbl=eduLbl;')+'window.eduLbl=eduLbl;'.length;
ok('slice',start>=0&&end>start);
// Need METHOD_WHY for dynamic method tips — pull minimal stubs
vm.runInContext(`
const METHOD_WHY={PPL:{label:'Push / Pull / Legs',why:'Test why PPL.',best:'4-6 dni'}};
const GOAL_WHY={masa:{sets:'3–4 serie',reps:'6-10',rpe:'RPE 7-9',why:'Test masa why.',rest:'90s',volume:'10-18'}};
function normalizeRationaleMethod(m){return m||'PPL';}
`+core.slice(start,end),sandbox);

ok('sets tip length',sandbox.eduTipText('sets').length>40);
ok('rpe mentions RIR',/RIR|RPE/.test(sandbox.eduTipText('rpe')));
ok('method dynamic',sandbox.eduTipText('method',{method:'PPL'}).includes('Push'));
ok('mark has data-tip',sandbox.eduTipMark('sets').includes('data-tip=')&&sandbox.eduTipMark('sets').includes('edu-tip'));

ok('cache bumps',html.includes('01-core.js?v=39')&&html.includes('05-clients-builder-plans-calendar.js?v=28')&&html.includes('styles.css?v=43'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll edu-tooltips tests passed');
