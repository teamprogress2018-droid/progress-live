// Progress Voice 1.0 (client-voice.js): biblioteka 100 komunikatów, polska odmiana liczebników, silnik zdarzeń i kolejka
// (priorytety, odliczanie, odstępy motywacji, brak powtórek, nic po wyjściu z treningu, rekord tylko potwierdzony,
// „zapisano”/„trener otrzymał” tylko po potwierdzeniu), punkty zaczepienia w treningu.
'use strict';
const fs=require('fs');const vm=require('vm');
const src=fs.readFileSync('client-voice.js','utf8');
const js=fs.readFileSync('client-simple.js','utf8');const app=fs.readFileSync('10-client-app.js','utf8');
const pain=fs.readFileSync('client-pain.js','utf8');const portal=fs.readFileSync('04-client-portal.js','utf8');
const html=fs.readFileSync('index.html','utf8');
let fails=0;const ok=(n,c,x)=>{console.log((c?'OK   ':'FAIL ')+n+(c||x===undefined?'':' — '+JSON.stringify(x)));if(!c)fails++;};

function makeCtx(opts){
  opts=opts||{};
  const spoken=[];let now=opts.now||1_000_000;
  const store={};
  // Testy silnika słuchają syntezy mowy, więc domyślnie „głos telefonu”; ścieżka nagrań trenera ma opts.trainerVoice.
  if(!opts.trainerVoice)store['pl_pv_v1:c1']=JSON.stringify({voice:'system'});
  const ctx={
    window:{},console,
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},
    document:{visibilityState:'visible',addEventListener(){},querySelectorAll:()=>[]},
    Date:{now:()=>now,parse:Date.parse},Math:Object.create(Math),
    setTimeout:(f,ms)=>{ctx.__timers.push({f,ms});return ctx.__timers.length;},clearTimeout:()=>{},
    SpeechSynthesisUtterance:function(t){this.text=t;},
    __timers:[]
  };
  ctx.Math.random=opts.random||(()=>0);
  ctx.window.speechSynthesis={speak:(u)=>{spoken.push(u.text);ctx.__last=u;},cancel:()=>{ctx.__cancels=(ctx.__cancels||0)+1;},getVoices:()=>[]};
  ctx.window._clientId='c1';
  vm.createContext(ctx);vm.runInContext(src,ctx);
  const W=ctx.window;
  W.speechSynthesis=ctx.window.speechSynthesis;
  ctx.speechSynthesis=W.speechSynthesis;
  // window.* w module to te same funkcje (skrypt bez modułów) — w vm podpinamy globalne.
  return {ctx,W,spoken,advance:(ms)=>{now+=ms;},
    finish:()=>{const u=ctx.__last;if(u&&u.onend)u.onend();ctx.__timers.splice(0).forEach(t=>{if(t.ms<=1000)t.f();});},
    store};
}

// --- biblioteka ---
let t=makeCtx();
const L=t.W.PV_LIB;
ok('biblioteka: dokładnie 100 komunikatów, id 1–100', L.length===100&&L[0].id===1&&L[99].id===100&&L[0].text==='Witaj w Team Progress. Zaczynamy!'&&L[99].text==='Team Progress. Razem w stronę lepszej wersji siebie.');
ok('biblioteka: kluczowe pozycje na swoich numerach', L[29].text==='Trzy, dwa, jeden. Start!'&&L[49].text==='Przerwa zakończona. Czas na kolejną serię.'&&L[80].text==='Brawo! Nowy rekord osobisty.'&&L[95].text==='Twój trener otrzymał podsumowanie treningu.');
ok('pule: każdy id istnieje', Object.values(t.W.PV_POOL).flat().every(id=>id>=1&&id<=100));
ok('bez agresji i zawstydzania (słowa zakazane)', !L.some(m=>/(słab|leniw|wstyd|ból nie|przeć|nie poddawaj|mocniej|więcej ciężaru)/i.test(m.text)));

// --- liczebniki ---
const W=t.W;
ok('liczebniki: 90 → dziewięćdziesiąt, 45, 12, 0', W.pvNum(90)==='dziewięćdziesiąt'&&W.pvNum(45)==='czterdzieści pięć'&&W.pvNum(12)==='dwanaście'&&W.pvNum(0)==='zero'&&W.pvNum(120)==='sto dwadzieścia');
ok('sekundy: dziewięćdziesiąt sekund / dwie sekundy / jedna sekunda / dwadzieścia dwie sekundy', W.pvSeconds(90)==='dziewięćdziesiąt sekund'&&W.pvSeconds(2)==='dwie sekundy'&&W.pvSeconds(1)==='jedna sekunda'&&W.pvSeconds(22)==='dwadzieścia dwie sekundy'&&W.pvSeconds(12)==='dwanaście sekund');
ok('minuty: czterdzieści pięć minut', W.pvMinutes(45)==='czterdzieści pięć minut'&&W.pvMinutes(3)==='trzy minuty');
ok('kilogramy: 20 / 2 / 17,5 / 0,5 / 22', W.pvKg(20)==='dwadzieścia kilogramów'&&W.pvKg(2)==='dwa kilogramy'&&W.pvKg('17,5')==='siedemnaście i pół kilograma'&&W.pvKg(0.5)==='pół kilograma'&&W.pvKg(22)==='dwadzieścia dwa kilogramy'&&W.pvKg(1)==='jeden kilogram',[W.pvKg(20),W.pvKg('17,5'),W.pvKg(22)]);
ok('powtórzenia: dwanaście powtórzeń / dwa powtórzenia / jedno powtórzenie', W.pvReps(12)==='dwanaście powtórzeń'&&W.pvReps(2)==='dwa powtórzenia'&&W.pvReps(1)==='jedno powtórzenie');
ok('porządkowe: dwunasty, dwudziesty pierwszy, druga, trzecia, dwudziesta pierwsza', W.pvOrd(12)==='dwunasty'&&W.pvOrd(21)==='dwudziesty pierwszy'&&W.pvOrd(2,true)==='druga'&&W.pvOrd(3,true)==='trzecia'&&W.pvOrd(21,true)==='dwudziesta pierwsza'&&W.pvOrd(100)==='setny');
ok('dopełniacz: z czterech / z dwunastu / z dwudziestu dwóch', W.pvNumGen(4)==='czterech'&&W.pvNumGen(12)==='dwunastu'&&W.pvNumGen(22)==='dwudziestu dwóch');
ok('odmiana: 5 serii, 22 serie, 12 serii', W.pvPlural(5,'seria','serie','serii')==='serii'&&W.pvPlural(22,'seria','serie','serii')==='serie'&&W.pvPlural(12,'seria','serie','serii')==='serii');
ok('nazwa ćwiczenia bez dopisków', W.pvExName('Przysiad z hantlem (goblet) — wolno')==='Przysiad z hantlem');

// --- silnik ---
function withWorkout(tt){tt.W._cw={exercises:[{name:'Przysiad goblet',sets:[{reps:'12',kg:'20'},{reps:'12',kg:'20'},{reps:'12',kg:'20'},{reps:'12',kg:'20'}]},{name:'Wiosłowanie',sets:[{reps:'10',kg:'16'},{reps:'10',kg:'16'}]}],exIdx:0,phase:'exercise'};}
t=makeCtx();withWorkout(t);
t.W.pvEmit('EXERCISE_START',t.W.pvExStartData(t.W._cw,0,true));
ok('ćwiczenie: nazwa, liczba serii, plan słownie', t.spoken[0]==='Pierwsze ćwiczenie: Przysiad goblet. Cztery serie. Zaplanowano dwanaście powtórzeń. Zaplanowane obciążenie: dwadzieścia kilogramów.',t.spoken[0]);
t.W.pvEmit('EXERCISE_START',t.W.pvExStartData(t.W._cw,0,true));t.finish();
ok('po odświeżeniu ten sam komunikat się nie powtarza (cw.pvSaid)', t.spoken.length===1&&t.W._cw.pvSaid['ex:0']===1);

// kolejka: jeden naraz
t=makeCtx();withWorkout(t);
t.W.pvEnqueue({text:'A',prio:40});t.W.pvEnqueue({text:'B',prio:60});
ok('nie mówi dwóch rzeczy naraz', t.spoken.length===1&&t.spoken[0]==='A');
t.finish();
ok('po zakończeniu — następny według priorytetu', t.spoken[1]==='B',t.spoken);

// odliczanie przerywa i czyści motywację
t=makeCtx();withWorkout(t);t.W._cw.phase='rest';
t.W.pvEnqueue({text:'Długa motywacja',prio:20,kind:'motiv'});t.W.pvEnqueue({text:'Inna motywacja',prio:20,kind:'motiv'});
const said=t.W.pvCountdown(5);
ok('odliczanie: „pięć” od razu, kolejka motywacji wyczyszczona', said===true&&t.spoken.slice(-1)[0]==='pięć'&&t.W.PV.queue.length===0&&t.ctx.__cancels>=1,t.spoken);
ok('odliczanie 0 = obsługuje REST_COMPLETE (bez „start”)', t.W.pvCountdown(0)===true&&t.spoken.slice(-1)[0]==='pięć');
t.W.pvSaveSettings({countdown:false});
ok('odliczanie wyłączone → false (zostaje sygnał awaryjny)', t.W.pvCountdown(3)===false);

// motywacja: odstęp i brak powtórek
t=makeCtx({random:()=>0});withWorkout(t);t.W._cw.phase='rest';
t.W.pvEmit('REST_START',{seconds:90,restKey:'r1'});t.finish();
const m1=t.spoken.length;
t.advance(60_000);t.W.pvEmit('REST_START',{seconds:90,restKey:'r2'});t.finish();
ok('motywacja: najwyżej raz na 4 min (standard)', m1===1&&t.spoken.length===1,t.spoken);
t.advance(241_000);t.W.pvEmit('REST_START',{seconds:90,restKey:'r3'});t.finish();
ok('motywacja po 4 min: inna niż ostatnie', t.spoken.length===2&&t.spoken[0]!==t.spoken[1],t.spoken);
const recent=new Set();t=makeCtx({random:()=>0});withWorkout(t);
for(let i=0;i<6;i++){t.advance(300_000);t.W.pvEmit('REST_START',{seconds:90,restKey:'k'+i});t.finish();}
ok('brak powtórzenia 5 ostatnich motywacji', (()=>{for(let i=5;i<t.spoken.length;i++){if(t.spoken.slice(i-5,i).includes(t.spoken[i]))return false;}return t.spoken.length===6;})(),t.spoken);
t=makeCtx();withWorkout(t);t.W.pvSaveSettings({freq:'minimal'});t.W.pvEmit('REST_START',{seconds:120,restKey:'x'});
ok('minimalna: bez motywacji', t.spoken.length===0);

// próg czasowy: jeden na przerwę
t=makeCtx();withWorkout(t);t.W._cw.phase='rest';t.W.pvSaveSettings({freq:'extended'});
[45,30,15,10].forEach(l=>{t.W.pvEmit('REST_TICK',{left:l,total:120,restKey:'q'});t.finish();});
ok('długa przerwa: tylko „trzydzieści sekund”', t.spoken.length===1&&/trzydzieści sekund/.test(t.spoken[0]),t.spoken);
t=makeCtx();withWorkout(t);t.W._cw.phase='rest';t.W.pvSaveSettings({freq:'extended'});
[30,15,10].forEach(l=>{t.W.pvEmit('REST_TICK',{left:l,total:60,restKey:'q2'});t.finish();});
ok('średnia przerwa (rozszerzona): tylko 15 s', t.spoken.length===1&&/piętnaście/.test(t.spoken[0]),t.spoken);
t=makeCtx();withWorkout(t);t.W._cw.phase='rest';
[30,15,10].forEach(l=>{t.W.pvEmit('REST_TICK',{left:l,total:60,restKey:'q3'});t.finish();});
ok('standard, krótka przerwa: bez progów', t.spoken.length===0,t.spoken);

// rekord tylko potwierdzony
t=makeCtx();withWorkout(t);t.W._cw.exercises[0].sets[0].done=true;
t.W.pvAfterSet(t.W._cw,0,0,'');t.finish();
ok('bez potwierdzonego rekordu: brak „rekord”', !t.spoken.some(x=>/rekord/i.test(x)),t.spoken);
t=makeCtx();withWorkout(t);t.W._cw.exercises[0].sets[0].done=true;
t.W.pvAfterSet(t.W._cw,0,0,'🏆 Rekord: Przysiad');t.finish();t.finish();
ok('rekord potwierdzony przez prToastText → „Nowy rekord osobisty”', t.spoken[0]==='Brawo! Nowy rekord osobisty.',t.spoken);
// zmniejszony ciężar
t=makeCtx();withWorkout(t);const s0=t.W._cw.exercises[0].sets[0];s0.done=true;s0._orig={kg:'20',reps:'12'};s0.kg='15';
t.W.pvAfterSet(t.W._cw,0,0,'');t.finish();
ok('zmniejszony ciężar → wsparcie (raz)', t.spoken.includes(t.W.PV_SUPPORT.reduced),t.spoken);
// koniec ćwiczenia → „przed Tobą ostatnie ćwiczenie”
t=makeCtx();withWorkout(t);t.W._cw.exercises[0].sets.forEach(s=>s.done=true);
t.W.pvAfterSet(t.W._cw,0,3,'');t.finish();
ok('ostatnia seria ćwiczenia → „Przed Tobą ostatnie ćwiczenie.”', t.spoken.includes('Przed Tobą ostatnie ćwiczenie.'),t.spoken);

// REST_COMPLETE: seria druga z czterech / ostatnia seria
t=makeCtx();withWorkout(t);t.W._cw.exercises[0].sets[0].done=true;t.W._cw.restId='r9';t.W._cw.lastSaved={exIdx:0};
t.W.pvEmit('REST_COMPLETE',t.W.pvRestCompleteData(t.W._cw));
ok('koniec przerwy: „Seria druga z czterech.”', t.spoken[0]==='Seria druga z czterech.',t.spoken);
t=makeCtx();withWorkout(t);[0,1,2].forEach(i=>t.W._cw.exercises[0].sets[i].done=true);t.W._cw.restId='r10';t.W._cw.lastSaved={exIdx:0};
t.W.pvEmit('REST_COMPLETE',t.W.pvRestCompleteData(t.W._cw));
ok('koniec przerwy przed ostatnią serią: „Czas na ostatnią serię.”', t.spoken[0]==='Czas na ostatnią serię.',t.spoken);

// podsumowanie, zapis, trener
t=makeCtx();t.W._cwDone={};t.W._cw=null;
t.W.pvEmit('WORKOUT_COMPLETE',{exDone:6,minutes:45,totalWorkouts:10,monthCount:12,weekGoal:true});
ok('podsumowanie: ukończono sześć ćwiczeń, czterdzieści pięć minut, dziesięć treningów, cel tygodnia', /Dzisiaj ukończono sześć ćwiczeń\./.test(t.spoken[0])&&/trwał czterdzieści pięć minut/.test(t.spoken[0])&&/Dziesięć treningów za Tobą/.test(t.spoken[0])&&/tygodniowy cel/.test(t.spoken[0]),t.spoken[0]);
ok('„zapisano” i „trener otrzymał” wołane tylko z potwierdzeń (hooki)', /if\(cw\.syncState==='synced'\)pvEmit\('WORKOUT_SAVED'\)/.test(js)&&/if\(r==='sent'&&typeof pvEmit==='function'\)pvEmit\('COACH_NOTIFIED'\)/.test(js));

// nic po wyjściu z treningu
t=makeCtx();t.W._cw=null;t.W._cwDone=null;
t.W.pvEmit('SET_COMPLETE',{exIdx:0,setIdx:0,setsTotal:3,setsLeft:2});t.W.pvEnqueue({text:'X'});
ok('bez treningu: cisza', t.spoken.length===0);
t=makeCtx();withWorkout(t);t.W.pvSaveSettings({enabled:false});t.W.pvEmit('EXERCISE_START',t.W.pvExStartData(t.W._cw,0,true));
ok('wyciszony: cisza', t.spoken.length===0);
t=makeCtx();withWorkout(t);t.ctx.document.visibilityState='hidden';t.W.pvEnqueue({text:'Y'});
ok('aplikacja w tle: cisza', t.spoken.length===0);
// nieaktualne odpadają
t=makeCtx();withWorkout(t);t.W.pvEnqueue({text:'A',prio:50});t.W.pvEnqueue({text:'stary',prio:10,ttl:3000});t.advance(5000);t.finish();
ok('nieaktualny komunikat nie jest odtwarzany', t.spoken.length===1&&t.spoken[0]==='A',t.spoken);
// ból
t=makeCtx();withWorkout(t);t.W.pvSaveSettings({freq:'minimal',motivation:false,info:false});t.W.pvEmit('PAIN_REPORTED');
ok('ból: komunikat bezpieczeństwa zawsze (bez diagnozy)', t.spoken[0]==='Przerwij ćwiczenie, jeśli powoduje ból. Skontaktuj się ze swoim trenerem.');
// styl spokojny bez wykrzykników
t=makeCtx();withWorkout(t);t.W.pvSaveSettings({style:'calm'});t.W.pvEnqueue({text:'Świetna robota!'});
ok('styl Calm: spokojna intonacja (bez „!”) i wolniej', t.spoken[0]==='Świetna robota.'&&t.ctx.__last.rate<1);
// błąd audio nie przerywa
t=makeCtx();withWorkout(t);t.W.speechSynthesis.speak=()=>{throw new Error('boom');};
let threw=false;try{t.W.pvEmit('EXERCISE_START',t.W.pvExStartData(t.W._cw,0,true));}catch(e){threw=true;}
ok('błąd syntezy nie rzuca dalej', !threw);
// źródło nagrań
ok('architektura nagrań/ElevenLabs: pvRegisterSource, bez kluczy w kodzie', /function pvRegisterSource/.test(src)&&!/xi-api-key|ELEVEN.*KEY|sk_[a-z0-9]{10}/i.test(src));
// ustawienia per klient
t=makeCtx();t.W.pvSaveSettings({style:'energy'});
ok('ustawienia zapisane per klient', JSON.parse(t.store['pl_pv_v1:c1']).style==='energy'&&t.W.pvSettings().freq==='standard');

// --- paczka nagrań głosem trenera ---
t=makeCtx({trainerVoice:true});withWorkout(t);
t.W.PV.pack={'Świetna robota!':'a.mp3','Seria druga z czterech.':'b.mp3','Czas na odpoczynek.':'c.mp3'};
ok('nagranie: cały tekst z manifestu', t.W.pvPackSource({text:'Świetna robota!'})==='assets/voice/pv/a.mp3');
ok('nagranie: zdania po kolei, gdy każde jest w manifeście', JSON.stringify(t.W.pvPackSource({text:'Seria druga z czterech. Czas na odpoczynek.'}))===JSON.stringify(['assets/voice/pv/b.mp3','assets/voice/pv/c.mp3']));
ok('nagranie: brak jednego zdania → mówimy resztę (bez głosu telefonu)', JSON.stringify(t.W.pvPackSource({text:'Seria druga z czterech. Następne ćwiczenie: X.'}))===JSON.stringify(['assets/voice/pv/b.mp3']));
ok('nagranie: brak wszystkich zdań → nic', t.W.pvPackSource({text:'Coś zupełnie innego.'})===null);
t.W.PV.pack={'Następne ćwiczenie:':'h.mp3','Przysiad Goblet.':'n.mp3','Zaplanowane obciążenie:':'z.mp3','sześćdziesiąt dwa i pół kilograma.':'k.mp3'};
ok('nagranie: „Nagłówek: reszta.” z dwóch nagrań, nazwa ćwiczenia bez względu na wielkość liter', JSON.stringify(t.W.pvPackSource({text:'Następne ćwiczenie: Przysiad goblet. Zaplanowane obciążenie: sześćdziesiąt dwa i pół kilograma.'}))===JSON.stringify(['assets/voice/pv/h.mp3','assets/voice/pv/n.mp3','assets/voice/pv/z.mp3','assets/voice/pv/k.mp3']));
ok('zaokrąglenia do nagrań: przerwa co 15 s, trening co 5 min', t.W.pvRestRound(85)===90&&t.W.pvRestRound(5)===15&&t.W.pvMinRound(47)===45&&t.W.pvMinRound(2)===5);
t.W.pvSaveSettings({voice:'system'});
ok('głos telefonu wybrany → bez nagrań', t.W.pvPackSource({text:'Świetna robota!'})===null);
ok('domyślnie głos trenera', makeCtx({trainerVoice:true}).W.pvSettings().voice==='trainer');
// odtwarzanie z nagrania (atrapa <audio>)
t=makeCtx({trainerVoice:true});withWorkout(t);t.W.PV.pack={'Świetna robota!':'a.mp3'};
const played=[];t.ctx.Audio=function(){this.play=()=>{played.push(this.src);return {catch(){}}};this.pause=()=>{};};
t.W.pvEnqueue({text:'Świetna robota!'});
ok('nagranie gra zamiast syntezy', played.includes('assets/voice/pv/a.mp3')&&!t.spoken.includes('Świetna robota!'),played);
const a=t.W.PV.el;a.onended&&a.onended();t.finish();
t.W.pvEnqueue({text:'Kolejna seria za Tobą.'});
ok('głos trenera: tekst spoza paczki → pominięty, bez głosu telefonu', !t.spoken.length&&t.W.PV.skipped===1,t.spoken);
t.W.pvSaveSettings({voice:'system'});t.finish();t.W.pvEnqueue({text:'Kolejna seria za Tobą.',key:'x2'});
ok('głos telefonu wybrany → synteza mowy', t.spoken.includes('Kolejna seria za Tobą.'),t.spoken);
// błąd nagrania → synteza
t=makeCtx({trainerVoice:true});withWorkout(t);t.W.PV.pack={'Świetna robota!':'a.mp3'};
t.ctx.Audio=function(){this.play=()=>({catch(f){f(new Error('NotAllowed'));}});this.pause=()=>{};};
t.W.pvEnqueue({text:'Świetna robota!'});
ok('głos trenera: odtwarzanie zablokowane (iPhone) → cisza, bez głosu telefonu', !t.spoken.length,t.spoken);
// generator paczki
const dry=require('child_process').spawnSync('node',['.github/scripts/build_voice_pack.js','--dry'],{encoding:'utf8'});
ok('generator: 144 stałe linie + zdania z liczbami i nazwami ćwiczeń (454), bez klucza w trybie próbnym', dry.status===0&&/Linii: 454/.test(dry.stdout)&&/do wygenerowania: 310/.test(dry.stdout),dry.stdout+dry.stderr);
const gen=fs.readFileSync('.github/scripts/build_voice_pack.js','utf8');
ok('generator: klucz tylko z sekretu, pomija gotowe pliki', /process\.env\.ELEVENLABS_API_KEY/.test(gen)&&/existsSync\(path\.join\(OUT,man\.items/.test(gen)&&!/sk_[a-z0-9]{10}/i.test(gen));

// --- zaczepienia ---
ok('start treningu → WORKOUT_START (raz)', /pvEmit\('WORKOUT_START'/.test(js));
ok('rozgrzewka → WARMUP_START / WARMUP_COMPLETE', /pvEmit\('WARMUP_START'\)/.test(js)&&/pvEmit\('WARMUP_COMPLETE'\)/.test(js));
ok('ćwiczenie → EXERCISE_START (cwBegin, cwGoEx)', (app.match(/pvEmit\('EXERCISE_START'/g)||[]).length===2);
ok('seria → pvAfterSet z prMsg', /pvAfterSet\(cw,cw\.exIdx,setIdx,prMsg\)/.test(app));
ok('przerwa → REST_START / REST_TICK / REST_COMPLETE', /pvEmit\('REST_START'/.test(app)&&/pvEmit\('REST_TICK'/.test(app)&&/pvEmit\('REST_COMPLETE',rc\)/.test(app));
ok('odliczanie przez Progress Voice', /if\(typeof pvCountdown==='function'&&typeof pvSettings==='function'&&pvSettings\(\)\.enabled\)return pvCountdown\(left\);/.test(js));
ok('wyjście z treningu → pvStop', /pvStop\(\);\s*window\._cw=null;/.test(app)&&/csDoneClose\(\)\{\s*window\._cwDone=null;\s*if\(typeof pvStop==='function'\)pvStop\(\);/.test(js));
ok('ból → PAIN_REPORTED po walidacji', /Zaznacz, jak mocno boli\.';painRender\(\);return;\}\s*\/\/[^\n]*\n\s*if\(typeof pvEmit==='function'\)pvEmit\('PAIN_REPORTED'\)/.test(pain));
ok('ikona głośnika na ekranie ćwiczenia i przerwy', (js.match(/pvMuteBtnHTML\(\)/g)||[]).length===2);
ok('ustawienia w Profilu', /pvSettingsCardHTML\(c\)/.test(portal));
ok('skrypt w index.html', /<script src="client-voice\.js\?v=\d+"><\/script>/.test(html));

if(fails){console.log(fails+' failed');process.exit(1);}console.log('Progress Voice (logika): OK');
