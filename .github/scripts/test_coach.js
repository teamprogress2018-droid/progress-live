// Progress Coach (coach.js): sygnały ból / samopoczucie / film / nagroda / rekord z istniejących danych,
// znikają po odpowiedzi trenera albo „Rozwiązane” (wracają przy nowym zdarzeniu), kolejność priorytetów, zaczepienia.
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('coach.js','utf8');
const t05=fs.readFileSync('05-clients-builder-plans-calendar.js','utf8');const t04=fs.readFileSync('04-client-portal.js','utf8');const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};
const NOW=Date.parse('2026-11-26T10:00:00Z');const iso=h=>new Date(NOW-h*3600e3).toISOString();
function make(o){
  o=o||{};
  const ctx={window:{},console,document:{getElementById:()=>null},Date:class extends Date{static now(){return NOW;}}};
  ctx.CLIENT_ISSUES={regres:{},expired:{},report:{},noplan:{},noworkout:{},expiring:{},noemail:{},onboard:{},checkin:{},measure:{}};
  ctx.CLIENT_ISSUE_ORDER=['regres','expired','report','noplan','noworkout','expiring','noemail','onboard','checkin','measure'];
  ctx.window.clientIssues=c=>(o.base||[]).slice();ctx.clientIssues=ctx.window.clientIssues;
  ctx.window.clientDoAction=(e,id,k)=>{ctx.__base=[id,k];};
  ctx.window.MSGS=o.msgs||{};
  ctx.window.pjBadges=()=>o.badges||[];ctx.pjBadges=ctx.window.pjBadges;
  ctx.window.pjData=()=>({prDates:o.prs||[]});ctx.pjData=ctx.window.pjData;
  ctx.attnAgoText=t=>Math.round((NOW-t)/3600e3)+' h temu';
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return ctx;
}
let X=make();
ok('nowe sprawy w kolejności priorytetu', X.CLIENT_ISSUE_ORDER.join(',')==='regres,expired,pain,report,feel,video,noplan,noworkout,expiring,reward,record,noemail,onboard,checkin,measure',X.CLIENT_ISSUE_ORDER.join(','));
ok('ból = pilne, nagroda/rekord = informacja, wszystkie liczą się do „Wymaga uwagi”', X.CLIENT_ISSUES.pain.sev==='urgent'&&X.CLIENT_ISSUES.record.sev==='info'&&['pain','feel','video','reward','record'].every(k=>X.CLIENT_ISSUES[k].counts));
const c={id:'c1',status:'active'};
X=make({msgs:{c1:[
  {out:false,text:'Zgłoszenie bólu: Kolano · mocno (7–10)\nPrzysiad',createdAt:iso(5)},
  {out:false,text:'Samopoczucie przed treningiem — warto porozmawiać…\nSen: źle',createdAt:iso(3)},
  {out:false,text:'🎥 Film techniki: Przysiad goblet\nTrening: Dzień 1\n[film:v_1.mp4]',createdAt:iso(2)}]},
  badges:[{earned:true,prize:'Koszulka Team Progress',givenAt:'',name:'Regularność',at:'2026-11-24'}],prs:['2026-11-25']});
let sig=X.window.coachSignals(c);
ok('5 sygnałów z danych', sig.map(s=>s.key).sort().join()==='feel,pain,record,reward,video',sig.map(s=>s.key));
ok('ból: obszar w opisie', sig.find(s=>s.key==='pain').label==='Zgłoszony ból — Kolano',sig.find(s=>s.key==='pain').label);
ok('film: ćwiczenie w opisie', sig.find(s=>s.key==='video').label==='Film do obejrzenia: Przysiad goblet');
ok('nagroda: co i za co', /Koszulka Team Progress/.test(sig.find(s=>s.key==='reward').label)&&/„Regularność”/.test(sig.find(s=>s.key==='reward').reason));
ok('clientIssues: sygnały dołączone i posortowane', X.window.clientIssues(c).map(i=>i.key).join()==='pain,feel,video,reward,record');
ok('archiwalny klient: bez sygnałów', X.window.clientIssues({...c,status:'archived'}).length===0);
// odpowiedź trenera zamyka ból/samopoczucie/film/rekord
X.window.MSGS.c1.push({out:true,text:'Odpisuję',createdAt:iso(1)});
sig=X.window.coachSignals(c);
ok('odpowiedź trenera: zostaje tylko nagroda', sig.map(s=>s.key).join()==='reward',sig.map(s=>s.key));
// stare zdarzenia nie wracają
X=make({msgs:{c1:[{out:false,text:'Zgłoszenie bólu: Bark · lekko (1–3)',createdAt:iso(24*8)},{out:false,text:'Samopoczucie przed treningiem — …',createdAt:iso(24*4)}]},prs:['2026-11-10']});
ok('starsze niż 7 dni (ból), 3 dni (samopoczucie), 7 dni (rekord): brak', X.window.coachSignals(c).length===0);
// Rozwiązane
X=make({msgs:{c1:[{out:false,text:'Zgłoszenie bólu: Kolano · lekko (1–3)',createdAt:iso(5)}]}});
const resolved={...c,coachResolved:{pain:iso(1)}};
ok('„Rozwiązane” ukrywa sprawę', X.window.coachSignals(resolved).length===0);
X.window.MSGS.c1.push({out:false,text:'Zgłoszenie bólu: Plecy · średnio (4–6)',createdAt:iso(0.5)});
ok('nowe zdarzenie po „Rozwiązane” wraca', X.window.coachSignals(resolved).map(s=>s.label).join()==='Zgłoszony ból — Plecy');
ok('nagroda nie ma „Rozwiązane” (zamyka ją „wręczona”)', X.window.coachResolvable('reward')===false&&X.window.coachResolvable('pain')===true&&X.window.coachResolveBtnHTML('c1','noplan')==='');
// działania
X.window.clientDoAction(null,'c1','noplan');
ok('inne sprawy: dotychczasowe działanie', JSON.stringify(X.__base)==='["c1","noplan"]');
ok('zaczepienia: przycisk „Rozwiązane” w liście i na pulpicie', /coachResolveBtnHTML\(c\.id,top\.key\)/.test(t05)&&/coachResolveBtnHTML\(it\.clientId,it\.issue\)/.test(t04));
ok('skrypt po 05 (CLIENT_ISSUES gotowe)', html.indexOf('<script src="coach.js')>html.indexOf('05-clients-builder-plans-calendar.js'));
ok('bez automatycznych wiadomości i ocen ryzyka', !/pushMsg\(|sendMsg\(|ryzyko zdrow/i.test(src));
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Coach (logika): OK');
