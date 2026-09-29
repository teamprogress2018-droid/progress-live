#!/usr/bin/env node
'use strict';
/** Manual plan edits must not keep an AI rationale for a different prescription. */
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.join(__dirname,'../..');
const src=fs.readFileSync(path.join(root,'05-clients-builder-plans-calendar.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const wf=fs.readFileSync(path.join(root,'.github','workflows','check.yml'),'utf8');
let failed=0;
function ok(name,cond){
  if(!cond){console.error('FAIL',name);failed++;}
  else console.log('OK  ',name);
}

const start=src.indexOf('function builderPlanRationaleChanged(');
const end=src.indexOf('\nfunction builderRowWeekLoads',start);
ok('rationale helper exists',start>=0&&end>start);
const ctx={};vm.createContext(ctx);
if(start>=0&&end>start)vm.runInContext(src.slice(start,end)+'\nthis.changed=builderPlanRationaleChanged;',ctx);
const base={
  method:'FBW',duration:8,progression:'double',clientId:'client-1',level:'sredni',goal:'masa',
  days:[{day:'PON',muscles:'Nogi',rest:false,exercises:[{name:'Przysiad',sets:'4',reps:'8',kg:'60'}]}],
  rationale:{reasoning:['Dwa dni dostępne']}
};
const unchanged={...base,name:'Nowa nazwa'};
const changed={...base,days:[{...base.days[0],exercises:[{...base.days[0].exercises[0],reps:'10'}]}]};
ok('rename preserves rationale basis',ctx.changed&&ctx.changed(base,unchanged)===false);
ok('exercise edit invalidates rationale basis',ctx.changed&&ctx.changed(base,changed)===true);
ok('program change invalidates rationale basis',ctx.changed&&ctx.changed(base,{...base,progression:'linear'})===true);
ok('saved edits clear stale rationale',/if\(builderPlanRationaleChanged\(PL\[idx\],updated\)\)updated\.rationale=null/.test(src));
ok('manual edit keeps existing rationale when content unchanged',/const updated=\{\.\.\.PL\[idx\],name,method:/.test(src)&&/PL\[idx\]=updated/.test(src));
ok('builder cache bumped',html.includes('05-clients-builder-plans-calendar.js?v=82'));
ok('CI runs regression test',wf.includes('test_plan_rationale_invalidation.js'));

if(failed){console.error(failed+' failed');process.exit(1);}
console.log('\nAll plan-rationale invalidation tests passed');
