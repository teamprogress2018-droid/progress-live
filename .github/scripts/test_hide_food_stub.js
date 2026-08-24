#!/usr/bin/env node
/** Hide food journal stub + honest documents/settings. */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src08=fs.readFileSync(path.join(root,'08-client-profile-extras.js'),'utf8');
const src07=fs.readFileSync(path.join(root,'07-forms-metrics-calculator.js'),'utf8');

let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('food tab hidden',/id="cpt-food"[^>]*style="display:none;"/.test(html)||html.includes('id="cpt-food"')&&html.includes('display:none')&&html.includes('cpt-food'));
ok('food stub message',src08.includes('Dziennik żywieniowy w przygotowaniu'));
ok('no prompt food entry',!src08.includes("prompt('Nazwa posiłku"));
ok('no foodJournal toggle in settings',!src08.includes("key:'foodJournal'")&&!src08.includes('key:"foodJournal"'));
ok('no macros toggle',!src08.includes("key:'macros'"));
ok('no mealPlan toggle',!src08.includes("key:'mealPlan'"));
ok('coming soon section',src08.includes('W PRZYGOTOWANIU'));
ok('docs honesty',src08.includes('Upload plików')&&src08.includes('w przygotowaniu'));
ok('food tab redirects',src07.includes("t==='food'")&&src07.includes("setCPTab('overview')"));
ok('toggle respects defaults',src08.includes('const defaults=')&&src08.includes('progressPhoto:true'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll hide-food-stub tests passed');
