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
ok('VOLUME_BY_LEVEL',core.includes('const VOLUME_BY_LEVEL')&&core.includes("Klatka:'6–10'")&&core.includes("Klatka:'12–20'"));
ok('collapsible guide',core.includes('<details class="method-rationale"')&&core.includes('mr-volume')&&core.includes('Serie na partię wg stażu'));
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
ok('css method-rationale',css.includes('.method-rationale')&&css.includes('.mr-vol-table')&&css.includes('.mr-volume'));
ok('sidebar no clip cards',css.includes('.builder-sidebar-scroll>.card')&&/flex-shrink:\s*0/.test(css));
ok('openMethodRationaleModal',core.includes('function openMethodRationaleModal'));
ok('full guide modal',html.includes('id="m-method-rationale"')&&html.includes('method-rationale-modal-body'));
ok('cheat sheet renderer',core.includes('function renderTrainerCheatSheetHTML')&&core.includes('function printTrainerCheatSheet'));
ok('full guide modal',html.includes('id="m-method-rationale"')&&html.includes('method-rationale-modal-body')&&html.includes('printTrainerCheatSheet'));
ok('builder topbar cheat btn',html.includes('id="builder-cheat-btn"')&&html.includes('openMethodRationaleModal()'));
ok('builder topbar print btn',html.includes('id="builder-cheat-print-btn"')&&html.includes('printTrainerCheatSheet()'));
ok('css cheat sheet',css.includes('.trainer-cheat')&&css.includes('.tch-volume')&&css.includes('#builder-cheat-btn'));
ok('print refreshes sheet',/function printTrainerCheatSheet[\s\S]*renderTrainerCheatSheetHTML/.test(core));

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
ok('volume parts beginner',b.levelVolumeParts&&b.levelVolumeParts.Klatka==='6–10'&&b.levelVolumeParts.Plecy==='8–12');
const htmlR=sandbox.renderMethodRationaleHTML(b);
ok('html render',htmlR.includes('Dlaczego tak?'));
ok('html collapsible',/<details class="method-rationale" open>/.test(htmlR)&&/mr-volume/.test(htmlR)&&/mr-vol-table/.test(htmlR));
ok('html full guide btn',/openMethodRationaleModal\(/.test(htmlR)&&(/Ściągawka/.test(htmlR)||/title="[^"]*objętość/.test(htmlR)));
ok('html highlights beginner col',/mr-vol-th is-current/.test(htmlR));
ok('clientTalk plain',b.clientTalk&&/Trenujemy/.test(b.clientTalk)&&!/MEV|MRV/.test(b.clientTalk));
eq('normalize UL',sandbox.normalizeRationaleMethod('Upper/Lower'),'Upper Lower');
const cheatHtml=sandbox.renderTrainerCheatSheetHTML(b);
ok('cheat sheet html',typeof sandbox.renderTrainerCheatSheetHTML==='function'&&/Serie robocze/.test(cheatHtml)&&/tch-rules/.test(cheatHtml)&&/trainer-cheat/.test(cheatHtml));

const adv=sandbox.buildMethodRationale({method:'PPL',goal:'redukcja',level:'zaawansowany',daysPerWeek:4});
ok('advanced chest volume',adv.levelVolumeParts.Klatka==='12–20');
ok('advanced html current col',/Zaaw\./.test(sandbox.renderMethodRationaleHTML(adv))&&/is-current/.test(sandbox.renderMethodRationaleHTML(adv)));

ok('cache bumps',html.includes('01-core.js?v=39')&&html.includes('05-clients-builder-plans-calendar.js?v=28')&&html.includes('styles.css?v=44'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll method-rationale tests passed');
