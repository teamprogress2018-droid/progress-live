#!/usr/bin/env node
/** Builder: day focus auto-filled from plan method (Push/Pull/Legs, FBW, …). */
'use strict';
const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

let failed=0;
function eq(name,got,want){
  if(got!==want){console.error('FAIL',name,'got',got,'want',want);failed++;}
  else console.log('OK  ',name);
}
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

ok('BUILDER_METHOD_DAYS map',src.includes('BUILDER_METHOD_DAYS')&&src.includes("PPL:['Push','Pull','Legs']")&&src.includes("Obwodowy:['Obwód A'"));
ok('builderDayFocusLabel helper',src.includes('function builderDayFocusLabel'));
ok('builderRefreshAllDayFocus',src.includes('function builderRefreshAllDayFocus'));
ok('addDay refreshes focus',src.includes('builderRefreshAllDayFocus()'));
ok('toggleR refreshes focus',/function toggleR\(id\).{0,200}builderRefreshAllDayFocus/.test(src));
ok('placeholder updated',src.includes('placeholder="Push, Pull, FBW…"'));
ok('b-method onchange wired',html.includes('id="b-method" onchange="builderOnMethodChange()"'));
ok('cache bump v28',html.includes('05-clients-builder-plans-calendar.js?v=39'));

const BUILDER_METHOD_DAYS={
  PPL:['Push','Pull','Legs'],
  FBW:['FBW'],
  'Upper Lower':['Upper','Lower'],
  Obwodowy:['Obwód A','Obwód B','Obwód C'],
  Arnold:['Arnold A','Arnold B','Arnold C'],
  'Bro Split':['Bro 1','Bro 2','Bro 3','Bro 4','Bro 5'],
  'Własna':null
};
function builderDayFocusLabel(method,workoutDayIndex){
  const labels=BUILDER_METHOD_DAYS[method];
  if(!labels||!labels.length)return '';
  return labels[((workoutDayIndex%labels.length)+labels.length)%labels.length];
}

eq('PPL day 0',builderDayFocusLabel('PPL',0),'Push');
eq('PPL day 1',builderDayFocusLabel('PPL',1),'Pull');
eq('PPL day 2',builderDayFocusLabel('PPL',2),'Legs');
eq('PPL day 3 cycles',builderDayFocusLabel('PPL',3),'Push');
eq('FBW always',builderDayFocusLabel('FBW',4),'FBW');
eq('Upper/Lower alt',builderDayFocusLabel('Upper Lower',1),'Lower');
eq('Obwodowy day 0',builderDayFocusLabel('Obwodowy',0),'Obwód A');
eq('Obwodowy day 3 cycles',builderDayFocusLabel('Obwodowy',3),'Obwód A');
eq('Własna empty',builderDayFocusLabel('Własna',0),'');

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll builder day-method tests passed');
