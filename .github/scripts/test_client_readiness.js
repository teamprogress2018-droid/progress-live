// Progress Readiness (3.0, etap 2): poziom samopoczucia z odpowiedzi, opis dla trenera, wiadomość bez szczegółów w 1. linii,
// punkty zaczepienia (karta na „Dzisiaj”, planSnapshot.readiness, okno treningu trenera, push trenera).
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('client-readiness.js','utf8');
const js=fs.readFileSync('client-simple.js','utf8');const app=fs.readFileSync('10-client-app.js','utf8');
const tr=fs.readFileSync('05-clients-builder-plans-calendar.js','utf8');const worker=fs.readFileSync('server/automation/comms-worker.cjs','utf8');
const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};
const ctx={window:{},localStorage:{_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=String(v);}},document:{}};
vm.createContext(ctx);vm.runInContext(src,ctx);
const L=ctx.window.readyLevel;
const a=(s,e,st,so,pain)=>({sleep:s,energy:e,stress:st,soreness:so,...(pain===undefined?{}:{pain})});
ok('brak odpowiedzi = brak wyniku', L({})===''&&L(a(2,2,2))==='');
ok('wszystko dobrze = dobre', L(a(2,2,2,2))==='good');
ok('suma 6 z jedną najgorszą = umiarkowane', L(a(2,2,2,0))==='mid');
ok('średnio wszędzie = umiarkowane', L(a(1,1,1,1))==='mid');
ok('suma ≤ 3 = konsultacja', L(a(1,1,1,0))==='consult'&&L(a(0,0,0,0))==='consult');
ok('ból = konsultacja nawet przy dobrych odpowiedziach', L(a(2,2,2,2,true))==='consult');
ok('„nie boli” nie zmienia wyniku', L(a(2,2,2,2,false))==='good');
ok('wartości spoza 0–2 odrzucone', L(a(3,2,2,2))===''&&L(a(-1,2,2,2))==='');
const S=ctx.window.readySummary;
ok('opis dla trenera słowami', S({...a(0,1,2,2,true),level:'consult'})==='Warto skonsultować trening z trenerem (sen: źle, energia: średnio, stres: niski, mięśnie: wypoczęte, ból: tak)',S({...a(0,1,2,2,true),level:'consult'}));
ok('nieznany poziom = pusto', S({level:'x'})===''&&S(null)==='');
const T=ctx.window.readyTrainerText({...a(0,0,1,2,true),level:'consult'});
const first=T.split('\n')[0];
ok('wiadomość: 1. linia bez odpowiedzi (ekran blokady)', /^Samopoczucie przed treningiem/.test(first)&&!/(źle|ból|Sen)/i.test(first.replace('Samopoczucie',''))&&first.length>=80,first);
ok('wiadomość: odpowiedzi i plan bez zmian', /Sen: źle · Energia: mało · Stres: średni · Mięśnie: wypoczęte · Ból: tak/.test(T)&&/Plan treningu nie został zmieniony/.test(T),T);
// zaczepienia
ok('karta na „Dzisiaj” pod kartą treningu', /\$\{csTodayCardHTML\(c,st\)\}\s*\$\{typeof readyTodayHTML==='function'\?readyTodayHTML\(c,st\):''\}/.test(js));
ok('dołączenie do treningu przy starcie (bez dodatkowego ekranu)', /if\(fresh&&typeof cwReadyAttach==='function'\)cwReadyAttach\(cw\);/.test(js)&&!/phase='readiness'/.test(src+js+app));
ok('planSnapshot.readiness w zapisie sesji', /\.\.\.\(cw\.readiness\?\{readiness:cw\.readiness\}:\{\}\)/.test(app));
ok('podsumowanie „Zrobiłem trening” ma „Przed treningiem”', /'Przed treningiem: '\+readySummary\(cw\.readiness\)/.test(js));
ok('okno treningu trenera pokazuje samopoczucie', /data-recorded-readiness/.test(tr)&&/readySummary\(rd\)/.test(tr));
ok('push trenera bez odpowiedzi klienta', /Samopoczucie przed treningiem — warto porozmawiać, otwórz czat/.test(worker));
ok('pytanie o ból tylko przy zgodzie na zdrowie', /const pain=readyHealthAllowed\(\)\?/.test(src));
ok('wyłącznik modułu', /window\.CS_READINESS_OFF/.test(src));
ok('skrypt w index.html', /<script src="client-readiness\.js\?v=\d+"><\/script>/.test(html));
if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Readiness (logika): OK');
