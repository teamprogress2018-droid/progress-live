// Progress Wrapped (wrapped.js): okresy (miesiąc/kwartał/rok), liczby z zapisanych treningów, regularność i realizacja planu,
// rekordy/postęp w okresie, wiadomość trenera, kolejny cel, brak danych prywatnych na grafice, punkty zaczepienia.
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('wrapped.js','utf8');const prog=fs.readFileSync('client-progress.js','utf8');const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};
const TODAY='2026-11-26';
function make(sessions,c,o){
  o=o||{};
  const ctx={window:{},console,document:{getElementById:()=>null,querySelectorAll:()=>[]}};
  Object.assign(ctx,{csToday:()=>o.today||TODAY,csPlural:(n,a,b,cc)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:cc),cpgNum:v=>String(v).replace('.',','),
    csDoneSessions:()=>sessions,capClientPlan:()=>({}),csWeekTarget:()=>o.target||0,
    csStrengthSeries:()=>{const out={};sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>(s.ex||[]).forEach(([n,kg])=>{(out[n]=out[n]||[]).push({date:s.date,kg,reps:8});}));return out;},
    pjMilestones:()=>o.ms||[],pjBadges:()=>o.badges||[]});
  vm.createContext(ctx);vm.runInContext(src,ctx);return ctx.window;
}
let W=make([],{});
const m=W.pwPeriod('month','2026-11-26'),q=W.pwPeriod('quarter','2026-11-26'),y=W.pwPeriod('year','2026-11-26'),f=W.pwPeriod('month','2026-02-10');
ok('okresy: miesiąc, kwartał, rok, luty', m.key==='2026-11'&&m.label==='Listopad 2026'&&m.to==='2026-11-30'&&q.key==='2026-Q4'&&q.label==='4. kwartał 2026'&&q.from==='2026-10-01'&&q.to==='2026-12-31'&&y.label==='Rok 2026'&&f.to==='2026-02-28');
ok('domyślnie bieżący miesiąc; w pierwszych 5 dniach poprzedni', W.pwDefaultRef().slice(0,7)==='2026-11'&&make([],{},{today:'2026-12-03'}).pwDefaultRef().slice(0,7)==='2026-11');
const S=[
  {date:'2026-10-28',duration:'50',ex:[['Przysiad',40]]},
  {date:'2026-11-03',duration:'45',ex:[['Przysiad',42.5]]},
  {date:'2026-11-05',duration:'50',ex:[['Przysiad',45]]},
  {date:'2026-11-12',duration:'55',ex:[['Przysiad',45]]},
  {date:'2026-11-12',duration:'10',ex:[]},
  {date:'2026-11-24',duration:'60',ex:[['Przysiad',50]]}
];
W=make(S,{},{target:2,ms:[{title:'10 treningów',at:'2026-11-24'},{title:'30 treningów',at:'',progress:5,of:30,unit:'treningi'}],badges:[{name:'Regularność',at:'2026-11-12'},{name:'Wytrwałość',at:''}]});
const c={id:'c1',name:'Anna Nowak',wrappedNotes:{'2026-11':'Świetny miesiąc!'}};
const s=W.pwStats(c,W.pwPeriod('month','2026-11-26'));
ok('treningi = dni z treningiem w okresie (bez października)', s.workouts===4,s.workouts);
ok('czas aktywności = suma minut', s.minutes===220,s.minutes);
ok('regularność: tygodnie z treningiem do dziś', s.weeks===5&&s.weeksOn===3,[s.weeks,s.weeksOn]);
ok('realizacja planu: 4 z 10 (cel 2 × 5 tyg.)', s.planPct===40,s.planPct);
ok('rekordy w okresie (42,5 → 45 → 50; pierwszy wpis to nie rekord)', s.prs.length===3,s.prs);
ok('największy postęp w okresie', s.best&&s.best.n==='Przysiad'&&s.best.from===42.5&&s.best.to===50);
ok('etapy i odznaki z okresu', s.milestones.join()==='10 treningów'&&s.badges.join()==='Regularność');
ok('wiadomość trenera i kolejny cel', s.trainerMsg==='Świetny miesiąc!'&&s.next==='30 treningów (5 z 30)',s.next);
const facts=W.pwFacts(s).map(x=>x.big+' '+x.label);
ok('fakty słownie', facts.join(' | ')==='4 treningi | 3,7 h czasu aktywności | 3 z 5 tygodni z treningiem | 40% realizacji planu | 3 rekordy osobiste',facts);
ok('cel trenera ma pierwszeństwo jako kolejny cel', W.pwStats({...c,journeyGoal:{text:'10 pompek'}},W.pwPeriod('month','2026-11-26')).next==='10 pompek');
const sheet=W.pwSheetHTML(c,'month');
ok('okno: okres, liczby, wiadomość, zapis grafiki, bez danych prywatnych', /Listopad 2026/.test(sheet)&&/Świetny miesiąc!/.test(sheet)&&/data-pw-save/.test(sheet)&&!/kg masy|obw|zdjęcie sylwetki|ból/i.test(sheet.replace('Na grafice nie ma masy ciała, pomiarów ani zdjęć.','')));
const W2=make([],{});
ok('pusty okres: bez zapisu grafiki', !/data-pw-save/.test(W2.pwSheetHTML({id:'c1'},'month'))&&/nie ma jeszcze zapisanych treningów/.test(W2.pwSheetHTML({id:'c1'},'month')));
ok('grafika: rysowana bez masy/pomiarów/zdjęć (źródło pwDraw)', !/weight|metric|photo|readiness|pain/i.test(src.slice(src.indexOf('function pwDraw'),src.indexOf('function pwBlob'))));
ok('udostępnianie tylko przez Web Share z plikiem (dobrowolne)', /navigator\.canShare\(\{files:\[file\]\}\)/.test(src));
ok('Postępy: przycisk w karcie podsumowania', /pwOpenBtnHTML\(c\)/.test(prog));
ok('skrypt po journey.js', /<script src="journey\.js\?v=1"><\/script>\s*<script src="wrapped\.js\?v=\d+"><\/script>/.test(html));
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Wrapped (logika): OK');
