// Progress Live 3.0 — Etap 3b: powiadomienia ze zdarzeń (rekord, pakiet, podsumowanie miesiąca, limit dzienny).
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..','..');
const ctx={console,Intl,Date};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'comms-core.js'),'utf8'),ctx);
const C=ctx.CommsCore;
let failed=0;const ok=(n,c,x)=>{console.log((c?'✓ ':'✗ ')+n+(c||!x?'':' — '+x));if(!c)failed++;};
const iso=ms=>new Date(ms).toISOString();
const W=(d,h)=>C.warsawToMs(d,h);
const client={id:'c1',name:'Anna Kowalska',status:'active'};
const enabledAt='2026-10-01T00:00:00Z';
const sq=(kg,extra)=>({name:'Przysiad',sets:[{kind:'warmup',kg:80,reps:5},{kg,reps:5},{kg:kg-5,reps:6}],...extra});
const ses=(id,date,kg,completedAt,more)=>({id,clientId:'c1',date,source:'client',status:'done',completedAt,exercises:[sq(kg)],...more});

// G. Rekord osobisty
const old1=ses('s1','2026-11-10',60,'2026-11-10T10:00:00Z');
const old2=ses('s2','2026-11-17',62.5,'2026-11-17T10:00:00Z');
const cur=ses('s3','2026-11-24',65,'2026-11-24T17:00:00Z');
const hist=[old1,old2,cur];
ok('rekord: 65 kg > 62,5 kg wcześniej',JSON.stringify(C.sessionPRs(cur,hist))==='["przysiad"]');
ok('rozgrzewka się nie liczy (80 kg w rozgrzewce nie jest rekordem)',C.sessionPRs(ses('s4','2026-11-25',62.5,'2026-11-25T10:00:00Z'),hist.concat()).length===0);
ok('pierwszy zapis ćwiczenia to nie rekord',C.sessionPRs(old1,[old1]).length===0);
ok('bez historii nie ogłaszamy rekordu',C.sessionPRs(cur,undefined).length===0);
ok('ten sam ciężar to nie rekord',C.sessionPRs(ses('s5','2026-11-25',62.5,'2026-11-25T10:00:00Z'),[old2]).length===0);
ok('seria niezrobiona (done:false) się nie liczy',C.sessionPRs({...cur,exercises:[{name:'Przysiad',sets:[{kg:100,reps:5,done:false},{kg:60,reps:5}]}]},hist).length===0);
ok('inna jednostka (nie kg) pomijana',C.sessionPRs({...cur,exercises:[{name:'Przysiad',loadUnit:'lb',sets:[{kg:200,reps:5}]}]},hist).length===0);
const now=W('2026-11-24','20:00');
const st={clients:[client],sessions:hist,plans:[],history:{c1:hist},settings:{},enabledAt};
let jobs=C.planJobs(st,now);
const pr=jobs.find(j=>j.kind==='personal_record');
ok('G: zadanie rekordu 20 min po treningu',pr&&pr.id==='pr:s3'&&pr.dueAt===Date.parse('2026-11-24T17:20:00Z'),JSON.stringify(pr));
ok('G: id stałe przy ponownym przeliczeniu',C.planJobs(st,now+3600000).filter(j=>j.kind==='personal_record').map(j=>j.id).join()==='pr:s3');
ok('G: bez pełnej historii — brak zadania',!C.planJobs({...st,history:{}},now).some(j=>j.kind==='personal_record'));
ok('G: wyłączone w ustawieniach — brak zadania',!C.planJobs({...st,settings:{personalRecord:{on:false}}},now).some(j=>j.kind==='personal_record'));
ok('G: trening sprzed włączenia automatów — brak',!C.planJobs({...st,enabledAt:'2026-11-25T00:00:00Z'},now).some(j=>j.kind==='personal_record'));
ok('G: po 2 dniach już nie wysyłamy',!C.planJobs(st,now+3*86400000).some(j=>j.kind==='personal_record'));
ok('G: klient na przerwie — brak',!C.planJobs({...st,clients:[{...client,status:'paused'}]},now).some(j=>j.kind==='personal_record'));

// H. Pakiet
const pkg={id:'p1',clientId:'c1',expiresDate:'2026-11-30',sessions:10,sessionsUsed:6,status:'active',payStatus:'paid'};
const pst={clients:[client],sessions:[],plans:[],packages:[pkg],settings:{},enabledAt};
jobs=C.planJobs(pst,W('2026-11-24','08:00'));
const pe=jobs.find(j=>j.kind==='package_ending');
ok('H: 5 dni przed końcem (25.11) o 10:00',pe&&pe.id==='pkgend:p1:2026-11-30'&&pe.dueAt===W('2026-11-25','10:00'),JSON.stringify(pe));
ok('H: termin stały w kolejnych przebiegach',C.planJobs(pst,W('2026-11-26','12:00')).find(j=>j.kind==='package_ending').dueAt===W('2026-11-25','10:00'));
ok('H: za wcześnie (10 dni przed) — brak',!C.planJobs(pst,W('2026-11-20','08:00')).some(j=>j.kind==='package_ending'));
ok('H: po dacie końca — brak',!C.planJobs(pst,W('2026-12-01','12:00')).some(j=>j.kind==='package_ending'));
ok('H: pakiet wygasły — brak',!C.planJobs({...pst,packages:[{...pkg,status:'expired'}]},W('2026-11-26','12:00')).some(j=>j.kind==='package_ending'));
const renewed={...pst,packages:[pkg,{id:'p2',clientId:'c1',expiresDate:'2026-12-31',sessions:10,sessionsUsed:0,status:'active'}]};
const r=C.reconcile(C.reconcile([],C.planJobs(pst,W('2026-11-24','08:00'))).create,C.planJobs(renewed,W('2026-11-24','09:00')));
ok('H: przedłużony pakiet → zaplanowane przypomnienie anulowane',r.cancel.some(x=>x.id==='pkgend:p1:2026-11-30'),JSON.stringify(r.cancel));
const lastPkg={...pkg,expiresDate:'2027-01-31',sessionsUsed:9,updatedAt:'2026-11-24T18:00:00Z'};
const pl=C.planJobs({...pst,packages:[lastPkg]},W('2026-11-24','20:00')).find(j=>j.kind==='package_last');
ok('H: ostatni trening w pakiecie',pl&&pl.id==='pkglast:p1:10',JSON.stringify(pl));
ok('H: kategoria zgody „plan”',C.categoryOf('package_ending')==='plan'&&C.categoryOf('package_last')==='plan');

// I. Podsumowanie miesiąca
const ms={clients:[client],sessions:[ses('m1','2026-11-12',60,'2026-11-12T10:00:00Z')],plans:[],settings:{},enabledAt};
const mj=C.planJobs(ms,W('2026-12-01','09:00')).find(j=>j.kind==='monthly_summary');
ok('I: 1 grudnia o 18:00 za listopad',mj&&mj.id==='month:c1:2026-11'&&mj.dueAt===W('2026-12-01','18:00'),JSON.stringify(mj));
ok('I: brak treningów w poprzednim miesiącu — brak',!C.planJobs({...ms,sessions:[]},W('2026-12-01','09:00')).some(j=>j.kind==='monthly_summary'));
ok('I: w środku miesiąca — brak',!C.planJobs(ms,W('2026-11-15','09:00')).some(j=>j.kind==='monthly_summary'));
ok('I: styczeń → za grudzień poprzedniego roku',C.planJobs({...ms,sessions:[ses('m2','2026-12-20',60,'2026-12-20T10:00:00Z')]},W('2027-01-01','09:00')).some(j=>j.id==='month:c1:2026-12'));

// Treści — bez zdrowia, liczb i nazwiska na zablokowanym ekranie
['personal_record','package_ending','package_last','monthly_summary'].forEach(kind=>{
  const t=C.texts({kind,clientId:'c1',expires:'2026-11-30'},{studio:'Progress'});
  const all=JSON.stringify(t);
  ok(`tekst ${kind}: jest tytuł i link`,t&&t.title&&/^\?cs=/.test(t.url));
  ok(`tekst ${kind}: bez nazwiska i kg`,!/Anna|Kowalska|kg/.test(all),all);
  ok(`kategoria ${kind} dozwolona w regułach`,['meetings','plan','checkins'].includes(C.categoryOf(kind)));
  ok(`szablon WhatsApp ${kind}`,!!C.whatsappTemplate({kind,expires:'2026-11-30'}));
});
ok('data końca pakietu po polsku',/30 listopada/.test(C.texts({kind:'package_ending',expires:'2026-11-30'},{}).body));

// Limit dzienny
const n0=W('2026-11-24','12:00');
ok('limit: 2 wysłane w dobie → trzecia czeka',C.overDailyLimit({kind:'personal_record',clientId:'c1'},[n0-3600000,n0-7200000],n0,2)===true);
ok('limit: wysyłki sprzed doby się nie liczą',C.overDailyLimit({kind:'personal_record',clientId:'c1'},[n0-25*3600000,n0-26*3600000],n0,2)===false);
ok('limit: spotkania nie są blokowane',C.overDailyLimit({kind:'meeting_reminder',clientId:'c1'},[n0-1,n0-2,n0-3],n0,2)===false);
ok('limit: zadania trenera nie są blokowane',C.overDailyLimit({kind:'trainer_contact',audience:'trainer',clientId:'c1'},[n0-1,n0-2],n0,2)===false);
ok('domyślny limit = 2',C.settingsOf({}).maxPerDay===2);

if(failed){console.error(failed+' test(ów) nie przeszło');process.exit(1);}
console.log('Wszystkie testy zdarzeń przeszły.');
