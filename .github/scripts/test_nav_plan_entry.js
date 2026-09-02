#!/usr/bin/env node
/** Nav: plan creation only via client Plan tab — not under Więcej. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'01-core.js'),'utf8');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');

const more=html.slice(html.indexOf('id="nav-more-items"'), html.indexOf('</nav>'));
const planTab=src08.slice(src08.indexOf('function renderCPPlan'),src08.indexOf('async function delPlanFromProfile'));

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('no Generator AI in Więcej',!/data-screen="aiplangen"/.test(more));
ok('no Kreator in Więcej',!/data-screen="builder"/.test(more));
ok('moreScreens without plan tools',!/moreScreens=\[[^\]]*(aiplangen|builder)/.test(core));
ok('screens still exist',html.includes('id="screen-builder"')&&html.includes('id="screen-aiplangen"'));
ok('plan tab keeps CTAs',planTab.includes('Stwórz własny plan')&&planTab.includes('Generuj plan AI')&&planTab.includes('Przypisz szablon'));
ok('openBuilderForClient + openAiPlanForClient',src05.includes('function openBuilderForClient')&&src05.includes('function openAiPlanForClient'));
ok('plans library points to clients',html.includes('Utwórz z profilu klienta')&&src05.includes("goTo('clients')")&&src05.includes('zakładka Plan'));
ok('builder cancel uses back',html.includes("_builderBack||'clients'"));

ok('cache bumps',html.includes('01-core.js?v=57')&&html.includes('05-clients-builder-plans-calendar.js?v=34'));
ok('onboard plan doneExtra',/doneExtra.*Nowy plan AI/.test(src05));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll nav-plan-entry tests passed');
