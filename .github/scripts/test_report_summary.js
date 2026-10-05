// ETAP 7: podsumowanie raportu — liczby z zapisanych treningów i pomiarów.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../../04-client-portal.js'),'utf8');
const a=src.indexOf('function repYmdAdd('),b=src.indexOf('window.clientReportSummaryHTML=');
assert.ok(a>=0&&b>a,'summary source');
const live=fs.readFileSync(path.join(__dirname,'../../02-workouts-onboarding-templates-live.js'),'utf8');
let n=0;const ok=m=>{n++;console.log('OK '+m);};
const sess=(date,ex)=>({clientId:'c',date,source:'live',exercises:ex.map(([name,kg])=>({name,sets:[{kg:String(kg),reps:'8',kind:'work'}]}))});
const c={Math,Number,String,Date,JSON,parseFloat,console,
  SE:[sess('2026-09-05',[['Przysiad',100],['Ławka',80],['Wiosłowanie',60]]),sess('2026-09-25',[['Przysiad',70],['Ławka',82.5],['Wiosłowanie',62.5]]),
      {clientId:'c',date:'2026-09-12',source:'planned'},{clientId:'c',date:'2026-09-05',source:'planned'}],
  METRIC_ENTRIES:[{clientId:'c',groupId:'mg1',date:'2026-08-30',values:{m1:96.2}},{clientId:'c',groupId:'mg1',date:'2026-09-28',values:{m1:94.8}}],
  completedWorkouts:(id,list)=>list.filter(s=>s.source==='live'),latestClientPlan:()=>null,exLoadUnit:()=>'kg',exerciseNameKey:s=>s.toLowerCase()};
c.window=c;vm.createContext(c);vm.runInContext(src.slice(a,b),c);
const s=c.clientReportSummary('c','2026-09-01','2026-09-28');
assert.equal(s.training.text,'2/2 wykonanych');ok('training vs planned days');
assert.equal(s.mass.from,96.2);assert.equal(s.mass.to,94.8);assert.equal(s.mass.delta,-1.4);ok('mass uses last weigh-in before the period as start');
assert.equal(s.strength[0].name,'Przysiad');assert.equal(s.strength[0].delta,-30);ok('largest change first, even a loss');
assert.equal(s.strength.length,3);ok('top 3 lifts');
const html=c.clientReportSummaryHTML(s,{});
assert.match(html,/96,2 → 94,8 kg/);assert.match(html,/−1,4 kg/);assert.match(html,/Przysiad −30 kg/);ok('html shows signed values with Polish decimals');
assert.match(live,/kind==='custom'[\s\S]*rep-date-from/);assert.match(live,/kind==='progress'/);ok('client-facing summary follows the selected report period');
console.log('PASS report summary: '+n+' checks');
