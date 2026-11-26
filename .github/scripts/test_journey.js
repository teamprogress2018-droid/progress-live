// Progress Journey + Rewards (journey.js): kamienie milowe i odznaki liczone z zapisanych treningów (bez podwójnego
// naliczania), rekordy jako zdarzenia, tygodnie z rzędu, nagrody trenera widoczne dopiero po zdobyciu odznaki.
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('journey.js','utf8');const prog=fs.readFileSync('client-progress.js','utf8');const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};
const TODAY='2026-11-26';
const add=(y,n)=>{const d=new Date(y+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const mon=y=>{const d=new Date(y+'T12:00:00Z');const w=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-w);return d.toISOString().slice(0,10);};
function make(sessions,extra){
  const ctx={window:{},console,document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}};
  const W=ctx.window;
  Object.assign(ctx,{csToday:()=>TODAY,csAddDays:add,csMonday:mon,csPlural:(n,a,b,c)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?b:c),
    cpgDate:y=>y,csIcon:()=>'',csEsc:s=>String(s),
    csDoneSessions:()=>sessions,
    csStrengthSeries:()=>{const out={};sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>(s.ex||[]).forEach(([n,kg])=>{(out[n]=out[n]||[]).push({date:s.date,kg,reps:8});}));return out;}});
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return {W,c:{id:'c1',...(extra||{})}};
}
// 12 treningów, co tydzień 1 (12 tygodni z rzędu), rekordy w przysiadzie: 40 → 45 → 50 → 55
const S=[];for(let i=0;i<12;i++){const d=add(TODAY,-7*(11-i));S.push({id:'s'+i,date:d,ex:[['Przysiad',i<3?40:i<6?45:i<9?50:55]],planSnapshot:i<10?{readiness:{level:'good'}}:{}});}
let {W,c}=make(S);
const d=W.pjData(c);
ok('dane: 12 treningów, start = pierwszy trening', d.total===12&&d.start===S[0].date);
ok('rekordy jako zdarzenia (pierwszy wpis to nie rekord)', d.prDates.length===3&&d.prDates[0]===S[3].date,d.prDates);
ok('tygodnie z rzędu: data 4. tygodnia', d.streakAt(4)===S[3].date&&d.streakAt(8)===S[7].date&&d.streakAt(13)==='');
const ms=W.pjMilestones(c,d);
const at=k=>ms.find(m=>m.key===k).at;
ok('kamienie: pierwszy trening, 10 treningów (data 10.), pierwszy rekord', at('first')===S[0].date&&at('w10')===S[9].date&&at('pr1')===S[3].date);
ok('kamienie dniowe: tydzień i miesiąc od startu, 100 dni jeszcze nie', at('d7')===add(S[0].date,7)&&at('d30')===add(S[0].date,30)&&at('d100')==='');
ok('30 treningów: postęp 12 z 30', ms.find(m=>m.key==='w30').progress===12&&ms.find(m=>m.key==='w30').at==='');
const b=W.pjBadges(c,d);const bg=id=>b.find(x=>x.id===id);
ok('odznaki: pierwszy krok, regularność, konsekwencja, rekordzista, zdrowe nawyki', bg('first_step').earned&&bg('regularity').at===S[3].date&&bg('consistency').at===S[7].date&&bg('record').at===S[9].date&&bg('habits').at===S[9].date);
ok('odznaki niezdobyte z podpowiedzią bez wyrzutów', !bg('perseverance').earned&&bg('perseverance').left==='Jeszcze 13 treningów'&&!bg('elite').earned);
ok('ponowne liczenie daje to samo (brak podwójnego naliczania)', JSON.stringify(W.pjBadges(c))===JSON.stringify(W.pjBadges(c))&&W.pjBadges(c).filter(x=>x.earned).length===5);
ok('bez nagród za objętość/ból (brak takich odznak)', !W.PJ_BADGES.some(x=>/obj|ból|kg|tona/i.test(x.how+x.name)));
// nagrody trenera
({W,c}=make(S,{rewards:{regularity:{prize:'Koszulka Team Progress'},elite:{prize:'Bonus do pakietu'},record:{prize:'Analiza techniki',givenAt:'2026-11-20'}}}));
const html1=W.pjBadgesHTML(c);
ok('klient: nagroda za zdobytą odznakę (nieodebraną)', /Nagroda od trenera: Koszulka Team Progress/.test(html1)&&/Za odznakę „Regularność”/.test(html1));
ok('klient: nagroda za niezdobytą odznakę jest ukryta', !/Bonus do pakietu/.test(html1));
ok('klient: odebrana nagroda', /Odebrano: Analiza techniki/.test(html1)&&!/Nagroda od trenera: [^<]*Analiza/.test(html1));
ok('trener: „Do wręczenia”', /Do wręczenia \(1\):<\/b> Koszulka Team Progress — „Regularność”/.test(W.pjTrainerCardHTML(c)));
// cel trenera
({W,c}=make(S,{journeyGoal:{text:'10 pompek bez kolan',reachedAt:'2026-11-25'}}));
ok('cel ustalony z trenerem na drodze (osiągnięty)', W.pjMilestones(c).find(m=>m.key==='goal').at==='2026-11-25'&&/Twój cel: 10 pompek bez kolan/.test(W.pjJourneyHTML(c)));
// brak treningów
({W,c}=make([]));
ok('bez treningów: karty ukryte', W.pjJourneyHTML(c)===''&&W.pjBadgesHTML(c)==='');
// zaczepienia
ok('Postępy: droga i odznaki', /pjJourneyHTML\(c\)/.test(prog)&&/pjBadgesHTML\(c\)/.test(prog));
ok('skrypt po express.js', /<script src="express\.js\?v=1"><\/script>\s*<script src="journey\.js\?v=\d+"><\/script>/.test(html));
ok('karta trenera po Express (renderCPPlan)', /window\.renderCPPlan=wrapped/.test(src)&&/getElementById\('xp-card'\)/.test(src));
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Journey + Rewards (logika): OK');
