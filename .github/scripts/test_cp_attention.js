// ETAP 4: „wymaga uwagi” — ograniczenia vs plan, ćwiczenie bez postępu, masa vs cel.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../../08-client-profile-extras.js'),'utf8');
const slice=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>=0&&j>i,'missing '+a);return src.slice(i,j);};
const code=slice('const CP_LIMIT_RULES=','function cpOverviewRecs(')+slice('function cpOverviewPl(','\n}')+'\n}\n'+
  slice('function cpOverviewDaysBetween(','\n}')+'\n}\n'+slice('function cpOverviewYmdAdd(','\n}')+'\n}\n'+'function cpOverviewTodayYmd(){return window.__today||"2026-09-30";}\n'+slice('function cpSitClip(','\n}')+'\n}\n';
let n=0;const ok=m=>{n++;console.log('OK '+m);};
function ctx(extra){const c=Object.assign({console,Date,Math,String,Number,JSON,isFinite,parseFloat,
  clientInjuriesText:x=>String(x&&(x.injuries||x.notes)||'')},extra||{});c.window=c;vm.createContext(c);vm.runInContext(code,c);return c;}

// Ograniczenia
let c=ctx();
const shoulder={id:'c',notes:'Ból barku po kontuzji'};
let hits=c.cpClientLimitConflicts(shoulder,['Wyciskanie hantli nad głowę','Wyciskanie sztangi na ławce','Arnold press','OHP']);
assert.equal(JSON.stringify(hits.map(h=>h.exercise)),JSON.stringify(['Wyciskanie hantli nad głowę','Arnold press','OHP']));assert.equal(hits[0].area,'bark');ok('shoulder: overhead lifts flagged, bench not');
assert.equal(c.cpClientLimitConflicts({injuries:'kolano — łąkotka'},['Wykroki chodzone','Przysiad goblet','Box jump']).map(h=>h.exercise).join('|'),'Wykroki chodzone|Box jump');ok('knee: lunges and jumps flagged');
assert.equal(c.cpClientLimitConflicts({notes:'brak przeciwwskazań'},['Martwy ciąg']).length,0);ok('no limit text → nothing');
assert.equal(c.cpClientLimitConflicts({notes:''},['OHP']).length,0);ok('empty notes → nothing');

// Masa vs cel
const brief=recs=>({composeClientNextSessionBrief:()=>({recs})});
const metrics=(pts)=>({cpMetricSeries:()=>pts.map(([d,v])=>({d,v}))});
c=ctx(metrics([['2026-09-07',80],['2026-09-14',79.9],['2026-09-28',79.8]]));
let m=c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'});
assert.ok(m&&/−0,2 kg w 3 tyg\. \(80 → 79,8 kg\)/.test(m.reason),JSON.stringify(m));ok('reduction stalled → flagged with numbers');
c=ctx(metrics([['2026-09-07',80],['2026-09-14',79],['2026-09-28',78.6]]));
assert.equal(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),null);ok('reduction progressing → quiet');
c=ctx(metrics([['2026-09-07',70],['2026-09-14',69.5],['2026-09-28',69.2]]));
assert.ok(/budowy/.test(c.cpOverviewMassGoalFact({id:'a',goal:'hipertrofia'}).title));ok('gain goal with dropping weight → flagged');
c=ctx(metrics([['2026-09-20',80],['2026-09-24',80],['2026-09-28',80]]));
assert.equal(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),null);ok('under 14 days → too early, quiet');
c=ctx(metrics([['2026-09-01',80],['2026-09-15',80],['2026-09-29',79.9]]));
assert.ok(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),'biweekly');ok('biweekly weigh-ins (28 days) still flagged');
c=ctx(metrics([['2026-08-21',80],['2026-09-04',80],['2026-09-18',79.9]]));
assert.ok(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),'biweekly 12 days old');ok('biweekly series with last weigh-in 12 days ago still flagged');
c=ctx(Object.assign(metrics([['2026-07-01',80],['2026-07-10',80],['2026-07-20',80]]),{}));
assert.equal(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),null);ok('stale data (last weigh-in >14 days ago) → quiet');
assert.equal(c.cpClientLimitConflicts({notes:'ból przedramienia, przedramię'},['OHP']).length,0);ok('forearm is not shoulder');
c=ctx(brief([{name:'Przysiad',action:'DODAJ POWTÓRZENIA',facts:{plateau:true,n:4}},{name:'Ławka',action:'DODAJ CIĘŻAR',facts:{plateau:true,n:3,label:'REGRES'}}]));
assert.equal(c.cpOverviewLiftFact({id:'b'}),null);ok('plateau with an add-suggestion is not flagged');
c=ctx(metrics([['2026-09-07',80],['2026-09-28',80]]));
assert.equal(c.cpOverviewMassGoalFact({id:'a',goal:'redukcja'}),null);ok('2 measurements → quiet');

// Ćwiczenie wymagające decyzji
c=ctx(brief([
  {name:'Przysiad',action:'UTRZYMAJ',facts:{plateau:true,n:3,lastKg:100,lastRir:2,rirKnown:true}},
  {name:'Wyciskanie',action:'DELOAD',facts:{plateau:true,n:4,lastKg:80,lastRir:0,rirKnown:true}},
  {name:'Wiosłowanie',action:'DODAJ CIĘŻAR',facts:{n:3}}]));
let l=c.cpOverviewLiftFact({id:'b'});
assert.ok(/^Wyciskanie: rozważ lżejszy tydzień/.test(l.title)&&/\+ 1 inne ćwiczenie/.test(l.title)&&/80 kg, RIR 0/.test(l.reason),JSON.stringify(l));ok('worst lift first (deload) with count of others');
c=ctx(brief([{name:'Wiosłowanie',action:'DODAJ CIĘŻAR',facts:{n:3}}]));
assert.equal(c.cpOverviewLiftFact({id:'b'}),null);ok('progressing lifts → quiet');

console.log('PASS cp attention: '+n+' checks');
