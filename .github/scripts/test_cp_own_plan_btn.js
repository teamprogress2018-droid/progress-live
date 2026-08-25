#!/usr/bin/env node
/** Client profile Plan tab: own plan builder button next to template / AI. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');

const planTab=src08.slice(src08.indexOf('function renderCPPlan'),src08.indexOf('async function delPlanFromProfile'));

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('openBuilderForClient helper',src05.includes('function openBuilderForClient'));
ok('exports openBuilderForClient',src05.includes('window.openBuilderForClient=openBuilderForClient'));
ok('prefills b-client',/openBuilderForClient[\s\S]{0,400}b-client/.test(src05));
ok('plan tab header button',planTab.includes("openBuilderForClient('${c.id}')")&&planTab.includes('Stwórz własny plan'));
ok('empty state three actions',planTab.includes('Przypisz szablon')&&planTab.includes('Generuj plan AI')&&planTab.includes('openBuilderForClient'));
ok('overview empty own plan',src08.includes("openBuilderForClient('${c.id}')")&&src08.includes('Własny plan'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll cp-own-plan-btn tests passed');
