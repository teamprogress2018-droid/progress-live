#!/usr/bin/env node
/** Client profile: plan CTAs only in Plan tab header — no duplicates. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const src05=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

const overview=src08.slice(src08.indexOf('function renderCPOverview'),src08.indexOf('function renderCPPlan'));
const planTab=src08.slice(src08.indexOf('function renderCPPlan'),src08.indexOf('async function delPlanFromProfile'));

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('openBuilderForClient helper',src05.includes('function openBuilderForClient'));
ok('plan tab header actions',planTab.includes('Stwórz własny plan')&&planTab.includes('Przypisz szablon')&&planTab.includes('Generuj plan AI'));
ok('empty state no duplicate buttons',planTab.includes('Brak planów treningowych')&&!/Brak planów treningowych[\s\S]{0,280}openBuilderForClient/.test(planTab));
ok('overview just brak planu',overview.includes('Brak planu')&&!overview.includes('Własny plan')&&!overview.includes('Plan AI'));
ok('overview links to plan tab',/Brak planu[\s\S]{0,200}setCPTab\('plan'\)/.test(overview)||overview.includes("onclick=\"setCPTab('plan')\""));

ok('cache bump',html.includes('08-client-profile-extras.js?v=32'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll cp-plan-dedupe tests passed');
