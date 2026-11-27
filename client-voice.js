/* PROGRESS VOICE 1.0 — asystent głosowy treningu klienta (aplikacja klienta live).
 *
 * Zasada: zaawansowana technologia pod spodem, maksymalna prostota na ekranie. Na ekranie treningu jest tylko mała
 * ikona głośnika (`pvMuteBtnHTML`), ustawienia są w Profilu (`pvSettingsCardHTML`).
 *
 * Architektura:
 *  - PV_LIB: 100 komunikatów (id 1–100, kategorie A–I ze specyfikacji) + komunikaty dynamiczne z polską odmianą liczebników
 *    (`pvNum*`, `pvPlural`).
 *  - Silnik zdarzeń `pvEmit(EVENT,data)`: WORKOUT_START, WARMUP_START, WARMUP_COMPLETE, EXERCISE_START, SET_COMPLETE,
 *    REST_START, REST_TICK (30/15/10 s), REST_COMPLETE, EXERCISE_COMPLETE (→ WORKOUT_HALFWAY, LAST_EXERCISE), LAST_SET,
 *    PERSONAL_RECORD (tylko gdy prToastText potwierdził rekord), MILESTONE_REACHED, WORKOUT_COMPLETE, WORKOUT_SAVED
 *    (tylko po potwierdzonej synchronizacji), COACH_NOTIFIED (tylko po potwierdzeniu wysłania), PAIN_REPORTED.
 *    Odliczanie 5…1 idzie przez `pvCountdown` (wołane z csRestSpeak) i ma najwyższy priorytet.
 *  - Kolejka: jeden komunikat naraz, priorytety, termin ważności (nieaktualne odpadają), odliczanie przerywa i czyści
 *    kolejkę, motywacja nie wchodzi w ostatnie sekundy przerwy ani w odliczanie, odstęp motywacji 4 min (standard) /
 *    3 min (rozszerzona), bez powtórzenia 5 ostatnich motywacji. Klucze zdarzeń zapisane w `cw.pvSaid` (szkic treningu
 *    w telefonie) — po odświeżeniu ekranu nic się nie powtarza. Po wyjściu z treningu i po powrocie do aplikacji kolejka
 *    jest czyszczona.
 *  - Źródła dźwięku (`pvSources`): najpierw nagranie (np. trenera lub wygenerowane wcześniej MP3 z ElevenLabs — rejestrowane
 *    przez `pvRegisterSource(fn)`; fn(msg) → URL albo null), potem synteza mowy przeglądarki (pl-PL), a dla odliczania
 *    awaryjnie krótki sygnał (csRestFinalTick). Klucze API nigdy nie trafiają do przeglądarki.
 *  - Ustawienia per klient na tym telefonie: `localStorage` `pl_pv_v1:<clientId>`.
 *  - Błąd modułu audio nigdy nie przerywa zapisu treningu: wszystkie wejścia są w try/catch.
 *
 * Bez agresywnego motywowania, zawstydzania, presji na ciężar ani zachęcania do ignorowania bólu. Bez wniosków medycznych.
 */
'use strict';

/* ---------- 1. Biblioteka 100 komunikatów ---------- */
const PV_LIB=(()=>{
  const C={
    start:['Witaj w Team Progress. Zaczynamy!','To Twój czas. Zrób dziś coś dobrego dla siebie.','Dzisiaj kolejny krok w stronę Twojego celu.','Gotowość do działania? Zaczynamy!','Najważniejsze, że tutaj jesteś.','Każdy trening przybliża Cię do celu.','Zostaw codzienne obowiązki za sobą. Teraz czas dla Ciebie.','Dzisiaj skupiamy się na Twoim postępie.','Nie potrzebujesz idealnego dnia, żeby zrobić dobry trening.','Twój czas. Twoje zdrowie. Twój Progress.'],
    warmup:['Zaczynamy od przygotowania ciała do wysiłku.','Wykonuj spokojne, kontrolowane ruchy.','Stopniowo zwiększaj intensywność.','Skup się na swobodnym oddychaniu.','Przygotuj mięśnie i stawy do pracy.','Nie spiesz się. Rozgrzewka ma znaczenie.','Zwróć uwagę na jakość ruchu.','Jeszcze chwila i przechodzimy do treningu głównego.','Rozgrzewka prawie zakończona.','Rozgrzewka zakończona. Czas na trening właściwy.'],
    exStart:['Przechodzimy do kolejnego ćwiczenia.','Przygotuj odpowiednie obciążenie.','Sprawdź ustawienie pozycji wyjściowej.','Skup się na prawidłowej technice.','Kontroluj każde powtórzenie.','Pamiętaj o oddychaniu.','Jakość ruchu jest ważniejsza niż ciężar.','Przygotuj się do pierwszej serii.','Wszystko gotowe? Zaczynamy.','Trzy, dwa, jeden. Start!'],
    setDone:['Świetna robota!','Dobra seria. Tak trzymaj!','Kolejna seria za Tobą.','Brawo! Teraz chwila odpoczynku.','Pierwsza seria zakończona.','Połowa serii tego ćwiczenia za Tobą.','Zostały jeszcze trzy serie.','Zostały jeszcze dwie serie.','Jeszcze jedna seria i kończymy to ćwiczenie.','Wszystkie serie zakończone. Dobra praca!'],
    rest:['Czas na odpoczynek.','Wyrównaj oddech i przygotuj się do kolejnej serii.','Możesz teraz napić się wody.','Wykorzystaj tę chwilę na regenerację.','Zostało trzydzieści sekund odpoczynku.','Zostało piętnaście sekund.','Jeszcze dziesięć sekund.','Przygotuj się do kolejnej serii.','Pięć, cztery, trzy, dwa, jeden.','Przerwa zakończona. Czas na kolejną serię.'],
    motiv:['Każda seria ma znaczenie.','Małe kroki prowadzą do wielkich zmian.','Nie perfekcja, lecz regularność.','Robisz to dla siebie.','Skup się na tym, co możesz zrobić dzisiaj.','Twoja konsekwencja buduje Twoją siłę.','Nie porównuj się z innymi. Liczy się Twój postęp.','Każdy trening to inwestycja w siebie.','Daj sobie czas. Efekty wymagają regularności.','Pamiętaj, dlaczego zaczynasz.','Budujesz nie tylko siłę, ale również pewność siebie.','Każdy wysiłek ma znaczenie.','Dzisiaj pracujesz na swoje jutro.','Nie musisz robić wszystkiego idealnie.','Twój wysiłek zasługuje na uznanie.','Krok po kroku. Trening po treningu.','Doceniaj to, co już udało Ci się osiągnąć.','Najważniejsze jest to, że działasz.','Budujesz nawyki, które zostaną z Tobą na dłużej.','To właśnie jest Progress.'],
    late:['Połowa treningu za Tobą.','Większość pracy już wykonana.','Zostały jeszcze trzy ćwiczenia.','Jeszcze dwa ćwiczenia do końca.','Przed Tobą ostatnie ćwiczenie.','Czas na ostatnią serię.','Dokończ trening w swoim tempie.','Pamiętaj o technice, również pod koniec treningu.','Wszystkie zaplanowane ćwiczenia zakończone.','Czas na spokojne zakończenie treningu.'],
    records:['Brawo! Nowy rekord osobisty.','Dzisiaj udało Ci się wykonać więcej powtórzeń.','Nowy rekord obciążenia w tym ćwiczeniu.','Kolejny rekord treningowy zapisany.','Twoja regularność zasługuje na uznanie.','To już piąty ukończony trening.','Dziesięć treningów za Tobą. Gratulacje!','Udało Ci się zrealizować tygodniowy cel.','Kolejny ważny etap Twojej drogi za Tobą.','Masz kolejny powód do dumy.'],
    end:['Trening ukończony. Świetna praca!','Dzisiaj udało Ci się zrobić coś dobrego dla siebie.','Czas na odpoczynek i regenerację.','Kolejny trening. Kolejny Progress.','Twój trening został zapisany.','Twój trener otrzymał podsumowanie treningu.','Pamiętaj o nawodnieniu i regeneracji.','Dziękujemy za wspólny trening.','Do zobaczenia na kolejnym treningu.','Team Progress. Razem w stronę lepszej wersji siebie.']
  };
  const order=['start','warmup','exStart','setDone','rest'];
  const out=[];let id=1;
  const push=(group,texts)=>texts.forEach(t=>out.push({id:id++,group,text:t}));
  order.forEach(g=>push(g,C[g]));push('motiv',C.motiv);push('late',C.late);push('records',C.records);push('end',C.end);
  return out;
})();
function pvMsg(id){return PV_LIB[id-1]||null;}

/* ---------- Imię klienta (wołacz) ---------- */
/** Zwroty z imieniem — TE SAME teksty generuje serwer (server/automation/voice-names.cjs, test pilnuje zgodności). */
const PV_NAME_LINES=['Cześć, {V}!','Ostatnia seria, {V}. Dawaj!','Świetna robota, {V}!','Brawo, {V}!'];
const PV_NAME_RE=/^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż' -]{0,23}$/;
const PV_VOC={anna:'Anno',kasia:'Kasiu',basia:'Basiu',zosia:'Zosiu',asia:'Asiu',gosia:'Gosiu',ola:'Olu',ela:'Elu',ula:'Ulu',iza:'Izo',
  piotr:'Piotrze',paweł:'Pawle',michał:'Michale',rafał:'Rafale',marek:'Marku',jacek:'Jacku',bartek:'Bartku',wojtek:'Wojtku',
  tomasz:'Tomaszu',łukasz:'Łukaszu',mateusz:'Mateuszu',grzegorz:'Grzegorzu',maciej:'Macieju',andrzej:'Andrzeju',sergiusz:'Sergiuszu',
  robert:'Robercie',artur:'Arturze',piotrek:'Piotrku',jan:'Janie',adam:'Adamie',kuba:'Kubo',karol:'Karolu',kamil:'Kamilu',daniel:'Danielu',
  paulina:'Paulino',natalia:'Natalio',julia:'Julio',maria:'Mario',marysia:'Marysiu',małgorzata:'Małgorzato',agnieszka:'Agnieszko',ewa:'Ewo'};
/** Propozycja wołacza z imienia (trener może ją poprawić). Pierwsze słowo pola „imię i nazwisko”. */
function pvVocative(fullName){
  const n=String(fullName||'').trim().split(/\s+/)[0]||'';
  if(!n)return '';
  const lc=n.toLowerCase(),cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  if(PV_VOC[lc])return PV_VOC[lc];
  let v=lc;
  if(/(si|zi|ci|ni|dzi)a$/.test(lc))v=lc.slice(0,-1)+'u';
  else if(/[^aeiouyąęó]la$/.test(lc)&&lc.length<=4)v=lc.slice(0,-1)+'u';
  else if(/ia$/.test(lc))v=lc.slice(0,-1)+'o';
  else if(/a$/.test(lc))v=lc.slice(0,-1)+'o';
  else if(/ek$/.test(lc))v=lc.slice(0,-2)+'ku';
  else if(/(sz|cz|rz|ż|j|l|g|k|ch|h)$/.test(lc))v=lc+'u';
  else if(/ł$/.test(lc))v=lc.slice(0,-1)+'le';
  else if(/r$/.test(lc))v=lc+'ze';
  else if(/t$/.test(lc))v=lc.slice(0,-1)+'cie';
  else if(/d$/.test(lc))v=lc+'zie';
  else if(/[bcfmnpswz]$/.test(lc))v=lc+'ie';
  return cap(v);
}
function pvNameOk(v){return PV_NAME_RE.test(String(v||'').trim());}
/** Imię w wołaczu, jeśli trener je ustawił (pole client.voiceName). */
function pvClientName(){
  try{const c=(window.CL||[]).find(x=>x&&x.id===window._clientId);const v=c&&String(c.voiceName||'').trim();return pvNameOk(v)?v:'';}catch(e){return '';}
}
/** Zwrot z imieniem albo '' — przy głosie trenera tylko wtedy, gdy jest nagranie z imieniem tego klienta. */
function pvNameLine(i){
  const v=pvClientName();if(!v||!PV_NAME_LINES[i])return '';
  const t=PV_NAME_LINES[i].replace('{V}',v);
  if(pvSettings().voice==='trainer'&&!(PV.clientPack&&PV.clientPack[t]))return '';
  return t;
}
/** Grupy logiczne → id komunikatów (losowanie w obrębie grupy). */
const PV_POOL={
  start:[1,2,3,4,5,6,7,8,9,10], warmupGo:[11,12,13,14,15,16,17], warmupLate:[18,19], warmupDone:[20],
  exTip:[22,23,24,25,26,27,28,29], praise:[31,32,33], praiseRest:[34], firstSet:[35], halfSets:[36], allSets:[40],
  restStart:[41,42,43,44], rest30:[45], rest15:[46], rest10:[47], restReady:[48], restDone:[50],
  motiv:[51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70], lateTip:[77,78],
  halfway:[71], most:[72], ex3:[73], ex2:[74], exLast:[75], setLast:[76], allEx:[79], calmEnd:[80],
  pr:[81], prReps:[82], prLoad:[83], prAny:[84], regular:[85], m5:[86], m10:[87], week:[88], milestone:[89,90],
  done:[91,92,94], saved:[95], coach:[96], closing:[93,97,98,99,100]
};
/* Inteligentne wsparcie (sekcja 10 specyfikacji). */
const PV_SUPPORT={
  returning:'Dobrze, że wracasz. Dzisiaj pracujemy w Twoim tempie.',
  reduced:'Dostosowanie obciążenia do aktualnych możliwości to element dobrego treningu.',
  pain:'Przerwij ćwiczenie, jeśli powoduje ból. Skontaktuj się ze swoim trenerem.',
  regular:'Twoja systematyczność zasługuje na uznanie.',
  setup:'Przygotuj stanowisko. Jeśli potrzebujesz pomocy, obejrzyj film instruktażowy.'
};

/* ---------- 2. Liczebniki i odmiana ---------- */
const PV_UNITS=['zero','jeden','dwa','trzy','cztery','pięć','sześć','siedem','osiem','dziewięć'];
const PV_TEENS=['dziesięć','jedenaście','dwanaście','trzynaście','czternaście','piętnaście','szesnaście','siedemnaście','osiemnaście','dziewiętnaście'];
const PV_TENS=['','','dwadzieścia','trzydzieści','czterdzieści','pięćdziesiąt','sześćdziesiąt','siedemdziesiąt','osiemdziesiąt','dziewięćdziesiąt'];
const PV_HUND=['','sto','dwieście','trzysta','czterysta','pięćset','sześćset','siedemset','osiemset','dziewięćset'];
/** Liczebnik główny 0–999 (rodzaj męskorzeczowy / mianownik): 90 → „dziewięćdziesiąt”. Większe — cyframi. */
function pvNum(n){
  n=Math.round(Number(n));if(!Number.isFinite(n)||n<0||n>999)return String(n);
  if(n<10)return PV_UNITS[n];
  const h=Math.floor(n/100),r=n%100,t=Math.floor(r/10),u=r%10;
  const parts=[];if(h)parts.push(PV_HUND[h]);
  if(r>=10&&r<20)parts.push(PV_TEENS[r-10]);
  else{if(t)parts.push(PV_TENS[t]);if(u)parts.push(PV_UNITS[u]);}
  return parts.join(' ')||PV_UNITS[0];
}
/** Liczebnik żeński (seria, sekunda, minuta): 1 → „jedna”, 2 → „dwie”, 22 → „dwadzieścia dwie”. */
function pvNumF(n){
  n=Math.round(Number(n));
  const w=pvNum(n);
  if(n===1)return 'jedna';
  if(n%10===2&&n%100!==12)return w.replace(/dwa$/,'dwie');
  return w;
}
/** Dopełniacz liczebnika („z czterech”, „z dwunastu”) 1–99. */
const PV_GEN_UNITS=['zera','jednego','dwóch','trzech','czterech','pięciu','sześciu','siedmiu','ośmiu','dziewięciu'];
const PV_GEN_TEENS=['dziesięciu','jedenastu','dwunastu','trzynastu','czternastu','piętnastu','szesnastu','siedemnastu','osiemnastu','dziewiętnastu'];
const PV_GEN_TENS=['','','dwudziestu','trzydziestu','czterdziestu','pięćdziesięciu','sześćdziesięciu','siedemdziesięciu','osiemdziesięciu','dziewięćdziesięciu'];
function pvNumGen(n){
  n=Math.round(Number(n));if(!Number.isFinite(n)||n<0||n>99)return String(n);
  if(n<10)return PV_GEN_UNITS[n];if(n<20)return PV_GEN_TEENS[n-10];
  const t=Math.floor(n/10),u=n%10;return PV_GEN_TENS[t]+(u?' '+PV_GEN_UNITS[u]:'');
}
/** Liczebnik porządkowy 1–100, rodzaj męski (trening) lub żeński (seria): 12 → „dwunasty”, 2 (f) → „druga”. */
const PV_ORD_U=['','pierwszy','drugi','trzeci','czwarty','piąty','szósty','siódmy','ósmy','dziewiąty'];
const PV_ORD_TEENS=['dziesiąty','jedenasty','dwunasty','trzynasty','czternasty','piętnasty','szesnasty','siedemnasty','osiemnasty','dziewiętnasty'];
const PV_ORD_TENS=['','','dwudziesty','trzydziesty','czterdziesty','pięćdziesiąty','sześćdziesiąty','siedemdziesiąty','osiemdziesiąty','dziewięćdziesiąty'];
function pvOrd(n,fem){
  n=Math.round(Number(n));if(!Number.isFinite(n)||n<1||n>100)return String(n)+'.';
  let w;
  if(n===100)w='setny';else if(n<10)w=PV_ORD_U[n];else if(n<20)w=PV_ORD_TEENS[n-10];
  else{const t=Math.floor(n/10),u=n%10;w=PV_ORD_TENS[t]+(u?' '+PV_ORD_U[u]:'');}
  if(!fem)return w;
  return w.split(' ').map(x=>x==='drugi'?'druga':x==='trzeci'?'trzecia':x.replace(/y$/,'a')).join(' ');
}
/** Odmiana rzeczownika po liczbie: 1 seria, 2 serie, 5 serii, 22 serie, 12 serii. */
function pvPlural(n,one,few,many){
  n=Math.abs(Math.round(Number(n)));
  if(n===1)return one;
  const u=n%10,t=n%100;
  return u>=2&&u<=4&&(t<12||t>14)?few:many;
}
/** Ciężar słownie: 20 → „dwadzieścia kilogramów”, 17,5 → „siedemnaście i pół kilograma”, 2 → „dwa kilogramy”. */
function pvKg(v){
  const x=Number.parseFloat(String(v==null?'':v).replace(',','.'));
  if(!(x>0))return '';
  if(Number.isInteger(x))return pvNum(x)+' '+pvPlural(x,'kilogram','kilogramy','kilogramów');
  if(Number.isInteger(x*2))return (Math.floor(x)?pvNum(Math.floor(x))+' i pół':'pół')+' kilograma';
  return String(x).replace('.',',')+' kilograma';
}
/** Zaokrąglenia do wartości, które mają nagranie głosem trenera: przerwa co 15 s, czas treningu co 5 min. */
function pvRestRound(s){return Math.min(300,Math.max(15,Math.round((Number(s)||0)/15)*15));}
function pvMinRound(m){return Math.min(180,Math.max(5,Math.round((Number(m)||0)/5)*5));}
function pvSeconds(n){return pvNumF(n)+' '+pvPlural(n,'sekunda','sekundy','sekund');}
function pvMinutes(n){return pvNumF(n)+' '+pvPlural(n,'minuta','minuty','minut');}
function pvReps(v){
  const x=Math.round(Number.parseFloat(String(v==null?'':v).replace(',','.')));
  if(!(x>0))return '';
  if(x===1)return 'jedno powtórzenie';
  return pvNum(x)+' '+pvPlural(x,'powtórzenie','powtórzenia','powtórzeń');
}
/** Nazwa ćwiczenia do czytania: bez nawiasów i dopisków po myślniku. */
function pvExName(name){
  return String(name||'').replace(/\([^)]*\)/g,'').split(/\s[—–-]\s/)[0].replace(/\s+/g,' ').trim();
}

/* ---------- 3. Ustawienia (per klient, na tym telefonie) ---------- */
const PV_DEFAULTS={enabled:true,voice:'trainer',style:'support',freq:'standard',volume:1,countdown:true,info:true,motivation:true,records:true,summary:true};
const PV_STYLES={calm:{label:'Progress Calm — spokojny',rate:0.95,pitch:0.95},support:{label:'Progress Support — wspierający',rate:1,pitch:1},energy:{label:'Progress Energy — energiczny',rate:1.08,pitch:1.05}};
const PV_FREQS={minimal:{label:'Minimalna',motivGap:0},standard:{label:'Standardowa',motivGap:240},extended:{label:'Rozszerzona',motivGap:180}};
function pvKey(){return 'pl_pv_v1:'+(window._clientId||'guest');}
function pvSettings(){
  let s={};
  try{const raw=localStorage.getItem(pvKey());if(raw)s=JSON.parse(raw)||{};}catch(e){}
  const out={...PV_DEFAULTS,...s};
  if(!PV_STYLES[out.style])out.style='support';
  if(!PV_FREQS[out.freq])out.freq='standard';
  out.volume=Math.max(0,Math.min(1,Number(out.volume)));if(!Number.isFinite(out.volume))out.volume=1;
  return out;
}
function pvSaveSettings(patch){
  const s={...pvSettings(),...(patch||{})};
  try{localStorage.setItem(pvKey(),JSON.stringify(s));}catch(e){}
  return s;
}

/* ---------- 4. Kolejka i odtwarzanie ---------- */
const PV={queue:[],speaking:null,lastMotivAt:0,recentMotiv:[],countdownUntil:0,sources:[],audio:null,timer:null,log:[]};
function pvRegisterSource(fn){if(typeof fn==='function')PV.sources.push(fn);}

/* Paczka nagrań głosem trenera (assets/voice/pv/manifest.json, generowana raz przez .github/workflows/voice-pack.yml).
 * Komunikat gra z nagrania, gdy cały tekst (albo każde jego zdanie) jest w manifeście; inaczej synteza mowy.
 * Pliki trafiają do pamięci podręcznej service workera przy pierwszym odtworzeniu (potem działają offline). */
const PV_PACK_DIR='assets/voice/pv/';
function pvLoadPack(){
  if(PV.packLoading||PV.pack)return PV.packLoading;
  if(typeof fetch!=='function')return null;
  PV.packLoading=fetch(PV_PACK_DIR+'manifest.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(m=>{
    PV.pack=m&&m.items&&typeof m.items==='object'?m.items:null;
    PV.packLc=null;
    // Odliczanie musi grać od razu — pobieramy je z góry (5 krótkich plików).
    if(PV.pack)['pięć','cztery','trzy','dwa','jeden'].forEach(t=>{const f=PV.pack[t];if(f)fetch(PV_PACK_DIR+f).catch(()=>{});});
    return PV.pack;
  }).catch(()=>null);
  return PV.packLoading;
}
/** Prywatne nagrania z imieniem klienta: Firestore clientVoice/{clientId} {items:{tekst:plik}} + Storage client-voice/{trainerId}/{clientId}/plik.
 *  Pliki pobieramy przez getBlob (zalogowane żądanie) do adresów blob: w pamięci — bez publicznych linków. */
function pvLoadClientPack(){
  const cid=window._clientId,tid=window._trainerId;
  if(!cid||!tid||PV.clientPackFor===cid)return PV.clientPackLoading||null;
  if(typeof window._getDoc!=='function'||typeof window._doc!=='function'||!window._db)return null;
  PV.clientPackFor=cid;
  PV.clientPackLoading=(async()=>{
    try{
      const snap=await window._getDoc(window._doc(window._db,'clientVoice',cid));
      const d=snap&&snap.exists&&snap.exists()?snap.data():null;
      if(!d||!d.items||d.trainerId!==tid)return null;
      const out={};
      for(const [text,file] of Object.entries(d.items)){
        if(!/^n_[a-f0-9]{16}\.mp3$/.test(String(file)))continue;
        try{const blob=await window._getBlob(window._storageRef(window._storage,'client-voice/'+tid+'/'+cid+'/'+file));out[text]=URL.createObjectURL(blob);}catch(e){}
      }
      PV.clientPack=out;return out;
    }catch(e){PV.clientPackFor=null;return null;}
  })();
  return PV.clientPackLoading;
}
function pvPackSource(item){
  const s=pvSettings();
  if(s.voice!=='trainer'||!PV.pack||!item||!item.text)return null;
  // Nazwy ćwiczeń w planach mają różną wielkość liter („Przysiad goblet”) — szukamy też bez niej.
  if(!PV.packLc||PV.packLcOf!==PV.pack){PV.packLc={};Object.keys(PV.pack).forEach(k=>{PV.packLc[k.toLowerCase()]=PV.pack[k];});PV.packLcOf=PV.pack;}
  // Pełny adres: wspólna paczka (assets/voice/pv/) albo prywatne nagranie z imieniem klienta (blob: z getBlob).
  const get=t=>{if(PV.clientPack&&PV.clientPack[t])return PV.clientPack[t];const f=PV.pack[t]||PV.packLc[String(t).toLowerCase()];return f?PV_PACK_DIR+f:'';};
  const whole=get(item.text);
  if(whole)return whole;
  // Zdania osobno; zdanie „Nagłówek: reszta.” także z dwóch nagrań („Następne ćwiczenie:” + „Przysiad goblet.”).
  const files=[];
  String(item.text).split(/(?<=[.!?])\s+/).filter(Boolean).forEach(p=>{
    if(get(p)){files.push(get(p));return;}
    const i=p.indexOf(': ');
    if(i>0){const head=get(p.slice(0,i+1)),tail=get(p.slice(i+2));if(head&&tail){files.push(head,tail);return;}}
    files.push(null);
  });
  // Głos trenera: brakujące zdanie pomijamy, resztę mówimy (zamiast milczeć o całym komunikacie).
  const have=files.filter(Boolean);
  if(!have.length)return null;
  if(have.length<files.length)PV.partial=(PV.partial||0)+1;
  return have;
}
pvRegisterSource(pvPackSource);
/* iPhone gra dźwięk z tego samego elementu <audio>, który raz zagrał po dotknięciu — odblokowujemy go przy starcie treningu. */
function pvSilentWav(){
  const b=new Uint8Array(46);const v=new DataView(b.buffer);const w=(o,t)=>{for(let i=0;i<t.length;i++)b[o+i]=t.charCodeAt(i);};
  w(0,'RIFF');v.setUint32(4,38,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,8000,true);v.setUint32(28,8000,true);v.setUint16(32,1,true);v.setUint16(34,8,true);w(36,'data');v.setUint32(40,2,true);b[44]=128;b[45]=128;
  let str='';b.forEach(x=>{str+=String.fromCharCode(x);});return 'data:audio/wav;base64,'+btoa(str);
}
function pvAudioEl(){
  if(PV.el||typeof Audio==='undefined')return PV.el||null;
  try{PV.el=new Audio();PV.el.preload='auto';}catch(e){PV.el=null;}
  return PV.el;
}
function pvUnlockAudio(){
  try{
    pvLoadPack();pvLoadClientPack();
    const a=pvAudioEl();if(!a||PV.unlocked)return;
    a.src=pvSilentWav();a.volume=0;
    const p=a.play();
    if(p&&p.then)p.then(()=>{PV.unlocked=true;}).catch(()=>{});else PV.unlocked=true;
  }catch(e){}
}
function pvNow(){return Date.now();}
/** Czy asystent ma teraz mówić: włączony + trwa trening (albo ekran podsumowania) + aplikacja na wierzchu. */
function pvActive(){
  const s=pvSettings();if(!s.enabled)return false;
  if(!(window._cw||window._cwDone))return false;
  if(typeof document!=='undefined'&&document.visibilityState==='hidden')return false;
  return true;
}
function pvSaid(key){const cw=window._cw;return !!(key&&cw&&cw.pvSaid&&cw.pvSaid[key]);}
function pvMark(key){const cw=window._cw;if(!key||!cw)return;cw.pvSaid=cw.pvSaid||{};cw.pvSaid[key]=1;}
function pvPick(pool,avoidRecent){
  const ids=(PV_POOL[pool]||[]).filter(id=>!(avoidRecent&&PV.recentMotiv.includes(id)));
  const list=ids.length?ids:(PV_POOL[pool]||[]);
  if(!list.length)return null;
  return pvMsg(list[Math.floor(Math.random()*list.length)%list.length]);
}
function pvStyleText(text){
  const st=pvSettings().style;
  return st==='calm'?String(text).replace(/!/g,'.'):String(text);
}
/** Dodaje komunikat do kolejki. item: {text,msgId?,prio,ttl(ms),kind,key?}. */
function pvEnqueue(item){
  if(!item||!item.text)return false;
  if(item.key){if(pvSaid(item.key))return false;pvMark(item.key);}
  PV.queue.push({prio:50,ttl:8000,kind:'info',...item,at:pvNow()});
  PV.queue.sort((a,b)=>b.prio-a.prio||a.at-b.at);
  pvProcess();
  return true;
}
function pvProcess(){
  if(PV.speaking)return;
  const now=pvNow();
  PV.queue=PV.queue.filter(x=>now-x.at<=x.ttl);
  if(!PV.queue.length)return;
  if(PV.countdownUntil>now){clearTimeout(PV.timer);PV.timer=setTimeout(pvProcess,PV.countdownUntil-now+50);return;}
  // Ostatnie sekundy przerwy należą do odliczania — nic dłuższego tam nie wchodzi.
  const cw=window._cw;
  if(cw&&cw.phase==='rest'&&window._cwRestTimer&&(cw.restLeft|0)>0&&(cw.restLeft|0)<=7){
    PV.queue=PV.queue.filter(x=>x.kind==='countdown'||x.kind==='safety');
    if(!PV.queue.length)return;
  }
  if(!pvActive()){PV.queue=[];return;}
  const item=PV.queue.shift();
  pvPlay(item);
}
function pvDone(item){
  if(PV.speaking===item)PV.speaking=null;
  clearTimeout(PV.timer);PV.timer=null;
  setTimeout(pvProcess,250);
}
/** Odtwarza jeden komunikat: nagranie (jeśli zarejestrowane) → synteza mowy. Nigdy nie rzuca. */
function pvPlay(item){
  PV.speaking=item;
  PV.log.push({t:item.text,kind:item.kind,at:pvNow()});if(PV.log.length>50)PV.log.shift();
  const s=pvSettings();
  let url=null;
  try{for(const fn of PV.sources){url=fn(item);if(url)break;}}catch(e){url=null;}
  const urls=url?(Array.isArray(url)?url:[url]):[];
  const a=urls.length?pvAudioEl():null;
  if(a){
    let i=0;
    // Głos trenera: gdy nagranie nie zagra, milczymy — nigdy nie przechodzimy na głos telefonu (inny, np. kobiecy).
    const fallback=()=>{if(PV.speaking!==item)return;a.onended=a.onerror=null;PV.audio=null;if(i===0&&s.voice!=='trainer')pvSpeak(item,s);else pvDone(item);};
    const next=()=>{
      if(PV.speaking!==item)return;
      if(i>=urls.length){a.onended=a.onerror=null;PV.audio=null;pvDone(item);return;}
      try{
        a.onended=()=>{i++;next();};a.onerror=fallback;
        a.src=urls[i];a.volume=s.volume;PV.audio=a;
        const p=a.play();if(p&&p.catch)p.catch(fallback);
      }catch(e){fallback();}
    };
    next();
    clearTimeout(PV.timer);PV.timer=setTimeout(()=>{try{a.pause();}catch(e){}if(PV.speaking===item){PV.audio=null;pvDone(item);}},20000);
    return;
  }
  // Głos trenera bez nagrania tego zdania (albo paczka jeszcze się nie wczytała) — pomijamy, bez głosu telefonu.
  if(s.voice==='trainer'){PV.skipped=(PV.skipped||0)+1;pvDone(item);return;}
  pvSpeak(item,s);
}
function pvPlVoice(syn,want){
  try{
    const vs=(syn.getVoices?syn.getVoices():[]).filter(v=>String(v.lang||'').toLowerCase().indexOf('pl')===0);
    return (want&&vs.find(v=>v.voiceURI===want||v.name===want))||vs[0]||null;
  }catch(e){return null;}
}
function pvSpeak(item,s){
  try{
    const syn=window.speechSynthesis;
    if(!syn||typeof syn.speak!=='function'||typeof SpeechSynthesisUtterance==='undefined'){pvDone(item);return;}
    const u=new SpeechSynthesisUtterance(pvStyleText(item.text));
    const st=PV_STYLES[s.style]||PV_STYLES.support;
    u.lang='pl-PL';u.rate=item.kind==='countdown'?1.05:st.rate;u.pitch=st.pitch;u.volume=s.volume;
    const v=pvPlVoice(syn,s.voice==='trainer'||s.voice==='system'?'':s.voice);if(v)u.voice=v;
    u.onend=u.onerror=()=>pvDone(item);
    syn.speak(u);
    // iPhone czasem nie wysyła „onend” — bezpiecznik, żeby kolejka nie stanęła.
    PV.timer=setTimeout(()=>pvDone(item),Math.min(12000,1500+String(item.text).length*85));
  }catch(e){pvDone(item);}
}
/** Zatrzymuje wszystko (wyjście z treningu, wyciszenie, powrót do aplikacji). */
function pvStop(){
  PV.queue=[];PV.countdownUntil=0;
  clearTimeout(PV.timer);PV.timer=null;PV.speaking=null;
  try{if(PV.audio){PV.audio.onended=PV.audio.onerror=null;PV.audio.pause();PV.audio=null;}}catch(e){}
  try{window.speechSynthesis&&window.speechSynthesis.cancel();}catch(e){}
}
/** Odliczanie 5…1 (z csRestSpeak): najwyższy priorytet, przerywa bieżący komunikat i czyści kolejkę z mniej ważnych.
 *  Zwraca true, gdy powiedziane (wtedy bez sygnału awaryjnego). 0 („start”) obsługuje REST_COMPLETE. */
function pvCountdown(left){
  try{
    const s=pvSettings();
    if(!s.enabled||!s.countdown||!pvActive())return false;
    const words={5:'pięć',4:'cztery',3:'trzy',2:'dwa',1:'jeden'};
    if(!words[left])return left===0;
    PV.queue=PV.queue.filter(x=>x.kind==='safety');
    try{if(PV.audio){PV.audio.pause();PV.audio=null;}}catch(e){}
    try{window.speechSynthesis&&window.speechSynthesis.cancel();}catch(e){}
    clearTimeout(PV.timer);PV.speaking=null;
    PV.countdownUntil=pvNow()+900;
    const item={text:words[left],kind:'countdown',prio:100,ttl:1500,at:pvNow()};
    pvPlay(item);
    return true;
  }catch(e){return false;}
}

/* ---------- 5. Zdarzenia ---------- */
function pvFreq(){return pvSettings().freq;}
function pvMotivationAllowed(){
  const s=pvSettings();
  if(!s.motivation||s.freq==='minimal')return false;
  const gap=(PV_FREQS[s.freq]||PV_FREQS.standard).motivGap*1000;
  return !PV.lastMotivAt||pvNow()-PV.lastMotivAt>=gap;
}
function pvSayMotivation(pool){
  if(!pvMotivationAllowed())return false;
  const m=pvPick(pool||'motiv',true);if(!m)return false;
  PV.lastMotivAt=pvNow();
  PV.recentMotiv.push(m.id);while(PV.recentMotiv.length>5)PV.recentMotiv.shift();
  return pvEnqueue({text:m.text,msgId:m.id,prio:20,ttl:6000,kind:'motiv'});
}
function pvLib(pool,opts){const m=pvPick(pool);return m?{text:m.text,msgId:m.id,...(opts||{})}:null;}
/** Szczegóły „Seria druga z czterech”. */
function pvSetLine(setNo,total){return 'Seria '+pvOrd(setNo,true)+' z '+pvNumGen(total)+'.';}
function pvPlanLine(st,unit){
  if(!st)return '';
  const reps=String(st.reps||'');
  const sec=unit==='sec';
  const r=sec?(Number.parseFloat(reps)>0?pvSeconds(Math.round(Number.parseFloat(reps))):''):(/[-–]/.test(reps)?'':pvReps(reps));
  const kg=!sec&&(typeof isWeightLoadUnit!=='function'||isWeightLoadUnit(unit||'kg'))?pvKg(st.kg):'';
  return [r?'Zaplanowano '+r+'.':'',kg?'Zaplanowane obciążenie: '+kg+'.':''].filter(Boolean).join(' ');
}
const PV_HANDLERS={
  WORKOUT_START(d){
    pvUnlockAudio();
    const s=pvSettings();
    const hi=pvNameLine(0);
    if(d.returning&&s.motivation)pvEnqueue({text:(hi?hi+' ':'')+PV_SUPPORT.returning,prio:60,kind:'support',key:'ws'});
    else if(s.motivation&&s.freq!=='minimal'){const m=pvLib('start',{prio:60,kind:'motiv',key:'ws'});if(m){if(hi)m.text=hi+' '+m.text;pvEnqueue(m);PV.lastMotivAt=pvNow();}}
    else if(hi)pvEnqueue({text:hi,prio:60,kind:'support',key:'ws'});
  },
  WARMUP_START(){
    const s=pvSettings();if(!s.info||s.freq==='minimal')return;
    const m=pvLib('warmupGo',{prio:50,kind:'info',key:'wu'});if(m)pvEnqueue(m);
  },
  WARMUP_COMPLETE(){
    const s=pvSettings();if(!s.info)return;
    pvEnqueue({...pvLib('warmupDone'),prio:55,kind:'info',key:'wud'});
  },
  EXERCISE_START(d){
    const s=pvSettings();if(!s.info||!d||d.exIdx==null)return;
    const name=pvExName(d.name);
    const lines=[];
    if(name)lines.push((d.first?'Pierwsze ćwiczenie: ':'Następne ćwiczenie: ')+name+'.');
    if(s.freq!=='minimal'&&d.sets){const w=pvNumF(d.sets);lines.push(w.charAt(0).toUpperCase()+w.slice(1)+' '+pvPlural(d.sets,'seria','serie','serii')+'.');}
    if(s.freq!=='minimal')lines.push(pvPlanLine(d.set,d.unit));
    // Progress Guide: przed pierwszą serią nowego ćwiczenia — najpierw stanowisko (raz na ćwiczenie, klucz ex:idx).
    if(s.freq!=='minimal')lines.push(PV_SUPPORT.setup);
    if(s.freq==='extended'){const t=pvPick('exTip');if(t)lines.push(t.text);}
    const text=lines.filter(Boolean).join(' ');
    if(text)pvEnqueue({text,prio:65,ttl:10000,kind:'info',key:'ex:'+d.exIdx});
  },
  SET_COMPLETE(d){
    const s=pvSettings();if(!d)return;
    const key='set:'+d.exIdx+':'+d.setIdx;
    if(pvSaid(key))return;pvMark(key);
    if(d.isPR&&s.records){const m=pvLib('pr');const nm=pvNameLine(2);if(m&&nm)m.text=nm+' '+m.text;pvEnqueue({...m,prio:75,kind:'record'});}
    if(d.reducedLoad&&s.motivation&&!pvSaid('reduced')){pvMark('reduced');pvEnqueue({text:PV_SUPPORT.reduced,prio:45,kind:'support'});}
    if(d.setsLeft===0)return; // EXERCISE_COMPLETE mówi o końcu ćwiczenia.
    if(!s.info&&!s.motivation)return;
    if(s.freq==='minimal')return;
    let text='';
    if(d.setIdx===0&&d.setsTotal>=2)text=pvMsg(35).text;
    else if(d.setsLeft===1){const nm=!pvSaid('nm:last')&&pvNameLine(1);if(nm){pvMark('nm:last');text=nm;}else text=pvMsg(39).text;}
    else if(s.freq==='extended'&&d.setsLeft>=2&&d.setsLeft<=9)text=(d.setsLeft===2?pvMsg(38).text:d.setsLeft===3?pvMsg(37).text:'Zostały jeszcze '+pvNumF(d.setsLeft)+' '+pvPlural(d.setsLeft,'seria','serie','serii')+'.');
    else if(s.freq==='extended'||Math.random()<0.5)text=(pvPick('praise')||{}).text||'';
    if(text)pvEnqueue({text,prio:40,ttl:5000,kind:'praise'});
  },
  REST_START(d){
    const s=pvSettings();if(!d||!d.restKey)return;
    if(pvSaid('rs:'+d.restKey))return;pvMark('rs:'+d.restKey);
    // Po zapisie serii: ile odpoczywamy (standard i rozszerzona; rozszerzona dokłada zdanie o regeneracji).
    if(s.info&&s.freq!=='minimal'&&d.seconds>=20){
      const m=s.freq==='extended'?pvPick('restStart'):null;
      pvEnqueue({text:'Odpoczynek: '+pvSeconds(pvRestRound(d.seconds))+'.'+(m?' '+m.text:''),prio:35,ttl:6000,kind:'info'});
    }
    // Motywacja w przerwie (≥ 45 s), z odstępem 3–4 min; pod koniec treningu — wskazówka o technice.
    if(d.seconds>=45)pvSayMotivation(d.late&&Math.random()<0.5?'lateTip':'motiv');
  },
  REST_TICK(d){
    const s=pvSettings();if(!d||!s.info||s.freq==='minimal')return;
    const total=d.total|0,left=d.left|0;
    // Jeden próg na przerwę: 30 s przy długiej, 15 s przy średniej (rozszerzona), 10 s przy krótkiej (rozszerzona).
    let at=0,pool='';
    if(total>=90){at=30;pool='rest30';}
    else if(s.freq==='extended'&&total>=45){at=15;pool='rest15';}
    else if(s.freq==='extended'&&total>=25){at=10;pool='rest10';}
    if(!at||left!==at)return;
    const m=pvLib(pool);if(m)pvEnqueue({...m,prio:55,ttl:3000,kind:'info',key:'rt:'+d.restKey});
  },
  REST_COMPLETE(d){
    const s=pvSettings();if(!d||!d.restKey)return;
    let text='';
    if(d.lastSet&&d.setsTotal>=2)text=pvMsg(76).text;
    else if(d.changeEx&&d.name){text='Następne ćwiczenie: '+pvExName(d.name)+'. '+pvSetLine(d.setNo||1,d.setsTotal||1);if(d.exIdx!=null)pvMark('ex:'+d.exIdx);}
    else if(s.freq!=='minimal'&&d.setNo&&d.setsTotal)text=pvSetLine(d.setNo,d.setsTotal);
    else text=pvMsg(50).text;
    if(!s.info&&!s.countdown)return;
    pvEnqueue({text,prio:85,ttl:5000,kind:'info',key:'rc:'+d.restKey});
  },
  EXERCISE_COMPLETE(d){
    const s=pvSettings();if(!d)return;
    const key='exd:'+d.exIdx;if(pvSaid(key))return;pvMark(key);
    if(!s.info&&!s.motivation)return;
    let id=0;
    if(d.left===0)id=79;
    else if(d.left===1)id=75;
    else if(d.left===2)id=74;
    else if(d.left===3&&d.total>=6)id=73;
    else if(d.total>=4&&d.done*2>=d.total&&!pvSaid('half')){pvMark('half');id=71;}
    else if(s.freq!=='minimal')id=40;
    if(id)pvEnqueue({text:pvMsg(id).text,msgId:id,prio:58,ttl:8000,kind:'info'});
  },
  WORKOUT_COMPLETE(d){
    const s=pvSettings();if(!d||pvSaid('wc'))return;pvMark('wc');
    if(!s.summary&&!s.records)return;
    const lines=[];
    if(s.summary){
      const nm=pvNameLine(3);if(nm)lines.push(nm);
      lines.push((pvPick('done')||pvMsg(91)).text);
      if(s.freq!=='minimal'&&d.exDone)lines.push('Dzisiaj ukończono '+pvNum(d.exDone)+' '+pvPlural(d.exDone,'ćwiczenie','ćwiczenia','ćwiczeń')+'.');
      if(s.freq!=='minimal'&&d.minutes)lines.push('Twój trening trwał '+pvMinutes(pvMinRound(d.minutes))+'.');
    }
    if(s.records){
      const n=d.totalWorkouts|0;
      if(n===5)lines.push(pvMsg(86).text);
      else if(n===10)lines.push(pvMsg(87).text);
      else if([25,50,75,100].includes(n))lines.push('To już '+pvOrd(n)+' ukończony trening. '+pvMsg(89).text);
      if(d.weekGoal)lines.push(pvMsg(88).text);
      else if(d.regular)lines.push(PV_SUPPORT.regular);
      if(s.freq==='extended'&&d.monthCount>=2&&d.monthCount<=100)lines.push('To Twój '+pvOrd(d.monthCount)+' trening w tym miesiącu.');
    }
    if(lines.length)pvEnqueue({text:lines.join(' '),prio:70,ttl:15000,kind:'summary'});
  },
  WORKOUT_SAVED(){
    const s=pvSettings();if(!s.summary||s.freq==='minimal')return;
    pvEnqueue({text:pvMsg(95).text,prio:60,ttl:15000,kind:'summary',key:'saved'});
  },
  COACH_NOTIFIED(){
    const s=pvSettings();if(!s.summary)return;
    const closing=s.freq==='minimal'?'':' '+((pvPick('closing')||{}).text||'');
    pvEnqueue({text:pvMsg(96).text+closing,prio:60,ttl:20000,kind:'summary',key:'coach'});
  },
  PAIN_REPORTED(){
    // Bezpieczeństwo: zawsze, gdy asystent jest włączony (bez względu na częstotliwość).
    pvEnqueue({text:PV_SUPPORT.pain,prio:95,ttl:10000,kind:'safety'});
  }
};
/** Jedyne wejście z treningu. Nigdy nie rzuca — błąd modułu audio nie może zatrzymać zapisu serii. */
function pvEmit(ev,data){
  try{
    if(!pvSettings().enabled)return false;
    if(ev!=='WORKOUT_COMPLETE'&&ev!=='WORKOUT_SAVED'&&ev!=='COACH_NOTIFIED'&&!window._cw)return false;
    const h=PV_HANDLERS[ev];if(!h)return false;
    h(data||{});
    return true;
  }catch(e){return false;}
}

/* ---------- 6. Dane do zdarzeń (z treningu) ---------- */
function pvExOpen(e){return !!(e&&!e.skipped&&(e.sets||[]).some(s=>!s.done));}
function pvExStartData(cw,idx,first){
  const ex=(cw&&cw.exercises||[])[idx];if(!ex)return null;
  const set=(ex.sets||[]).find(s=>!s.done)||(ex.sets||[])[0]||null;
  const unit=typeof exLoadUnit==='function'?exLoadUnit(ex):(ex.loadUnit||'kg');
  return {exIdx:idx,name:ex.name,sets:(ex.sets||[]).length,set,unit,first:!!first};
}
/** Po zatwierdzeniu serii (cwCheckSet): seria, rekord, zmniejszony ciężar, koniec ćwiczenia. */
function pvAfterSet(cw,exIdx,setIdx,prMsg){
  try{
    const ex=cw.exercises[exIdx];if(!ex)return;
    const st=ex.sets[setIdx]||{};
    const left=(ex.sets||[]).filter(s=>!s.done).length;
    const origKg=st._orig?Number.parseFloat(String(st._orig.kg==null?'':st._orig.kg).replace(',','.')):NaN;
    const kg=Number.parseFloat(String(st.kg==null?'':st.kg).replace(',','.'));
    pvEmit('SET_COMPLETE',{exIdx,setIdx,setsTotal:(ex.sets||[]).length,setsLeft:left,isPR:!!prMsg,reducedLoad:origKg>0&&kg>=0&&kg<origKg});
    if(left===0){
      const n=cw.exercises.length,open=cw.exercises.filter(pvExOpen).length;
      pvEmit('EXERCISE_COMPLETE',{exIdx,left:open,total:n,done:n-open});
    }
  }catch(e){}
}
/** Dane końca przerwy: która seria teraz, czy ostatnia, czy zmiana ćwiczenia. */
function pvRestCompleteData(cw){
  const ex=cw.exercises[cw.exIdx]||{};const sets=ex.sets||[];
  const ni=sets.findIndex(s=>!s.done);
  const prevEx=cw.lastSaved?cw.lastSaved.exIdx:cw.exIdx;
  return {restKey:String(cw.restId||cw.restEndsAt||''),exIdx:cw.exIdx,setNo:ni>=0?ni+1:0,setsTotal:sets.length,lastSet:ni>=0&&ni===sets.length-1,changeEx:prevEx!==cw.exIdx,name:ex.name||''};
}
function pvWorkoutStats(cw){
  const c=(window.CL||[]).find(x=>x&&x.id===window._clientId);
  const done=c&&typeof csDoneSessions==='function'?csDoneSessions(c):[];
  const ids=new Set(done.map(s=>s.id));
  const total=done.length+(cw&&cw.sessionId&&!ids.has(cw.sessionId)?1:0);
  const month=(typeof csToday==='function'?csToday():new Date().toISOString().slice(0,10)).slice(0,7);
  const monthCount=done.filter(s=>String(s.date||'').slice(0,7)===month).length+(cw&&cw.sessionId&&!ids.has(cw.sessionId)?1:0);
  let weekGoal=false,regular=false;
  try{
    const plan=(window.PL||[]).find(p=>p&&p.id===(cw&&cw.planId));
    const target=c&&typeof csWeekTarget==='function'?csWeekTarget(c,plan):0;
    const wd=c&&typeof csWeekDone==='function'?csWeekDone(c):0;
    weekGoal=target>0&&wd>=target;
    regular=!weekGoal&&total>=8&&monthCount>=6;
  }catch(e){}
  return {totalWorkouts:total,monthCount,weekGoal,regular};
}
/** Klient wraca po ≥ 14 dniach bez treningu (i ma za sobą co najmniej jeden trening). */
function pvReturning(){
  try{
    const c=(window.CL||[]).find(x=>x&&x.id===window._clientId);
    const done=c&&typeof csDoneSessions==='function'?csDoneSessions(c):[];
    if(!done.length)return false;
    const last=done.map(s=>String(s.date||'')).sort().pop();
    const days=(Date.parse((typeof csToday==='function'?csToday():new Date().toISOString().slice(0,10))+'T12:00:00')-Date.parse(last+'T12:00:00'))/864e5;
    return days>=14;
  }catch(e){return false;}
}

/* ---------- 7. Ikona głośnika na ekranie treningu ---------- */
const PV_ICON_ON='<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
const PV_ICON_OFF='<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>';
function pvIcon(on){return `<svg class="cs-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${on?PV_ICON_ON:PV_ICON_OFF}</svg>`;}
function pvMuteBtnHTML(){
  const on=pvSettings().enabled;
  return `<button type="button" class="pv-mute" data-pv-mute aria-pressed="${on?'false':'true'}" aria-label="${on?'Wycisz asystenta głosowego':'Włącz asystenta głosowego'}" onclick="pvToggleMute()">${pvIcon(on)}</button>`;
}
function pvToggleMute(){
  const s=pvSaveSettings({enabled:!pvSettings().enabled});
  if(!s.enabled)pvStop();
  else if(typeof csRestUnlockVoice==='function')try{csRestUnlockVoice();}catch(e){}
  document.querySelectorAll('[data-pv-mute]').forEach(b=>{b.setAttribute('aria-pressed',s.enabled?'false':'true');b.setAttribute('aria-label',s.enabled?'Wycisz asystenta głosowego':'Włącz asystenta głosowego');b.innerHTML=pvIcon(s.enabled);});
  if(typeof notify==='function')notify(s.enabled?'Asystent głosowy włączony':'Asystent głosowy wyciszony');
}

/* ---------- 8. Ustawienia klienta (Profil) ---------- */
function pvEsc(s){return typeof csEsc==='function'?csEsc(s):String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function pvVoiceOptions(sel){
  let vs=[];
  try{vs=(window.speechSynthesis&&window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[]).filter(v=>String(v.lang||'').toLowerCase().indexOf('pl')===0);}catch(e){}
  const opts=[`<option value="trainer"${sel==='trainer'?' selected':''}>Głos Twojego trenera</option>`,`<option value="system"${sel==='system'||sel===''?' selected':''}>Głos telefonu</option>`].concat(vs.map(v=>`<option value="${pvEsc(v.voiceURI||v.name)}"${(v.voiceURI||v.name)===sel?' selected':''}>${pvEsc(v.name)}</option>`));
  return opts.join('');
}
function pvSettingsCardHTML(){
  const s=pvSettings();
  const sw=(key,label,hint)=>`<label class="pv-row"><span><b>${label}</b>${hint?`<small>${hint}</small>`:''}</span><input type="checkbox" role="switch" data-pv-set="${key}" ${s[key]?'checked':''} onchange="pvSetFromUI(this)"></label>`;
  const sel=(key,label,opts)=>`<label class="pv-row pv-row-sel"><span><b>${label}</b></span><select data-pv-set="${key}" onchange="pvSetFromUI(this)">${opts}</select></label>`;
  return `<section class="cs-card pv-card" aria-labelledby="pv-card-h" data-pv-settings>
    <h2 id="pv-card-h" class="pv-h">Progress Voice</h2>
    <p class="pv-lead">Asystent głosowy prowadzi Cię przez trening: przerwy, kolejne ćwiczenia i krótkie wsparcie.</p>
    ${sw('enabled','Asystent głosowy','Na ekranie treningu możesz go szybko wyciszyć ikoną głośnika.')}
    ${sel('voice','Głos',pvVoiceOptions(s.voice))}
    ${sel('style','Styl',Object.entries(PV_STYLES).map(([k,v])=>`<option value="${k}"${s.style===k?' selected':''}>${pvEsc(v.label)}</option>`).join(''))}
    ${sel('freq','Częstotliwość komunikatów',Object.entries(PV_FREQS).map(([k,v])=>`<option value="${k}"${s.freq===k?' selected':''}>${pvEsc(v.label)}</option>`).join(''))}
    <label class="pv-row pv-row-sel"><span><b>Głośność</b></span><input type="range" min="0.2" max="1" step="0.1" value="${s.volume}" data-pv-set="volume" aria-label="Głośność asystenta" onchange="pvSetFromUI(this)"></label>
    ${sw('countdown','Odliczanie przerw','Ostatnie 5 sekund przerwy.')}
    ${sw('info','Informacje treningowe','Ćwiczenie, serie, obciążenie.')}
    ${sw('motivation','Komunikaty motywacyjne','Najwyżej raz na kilka minut.')}
    ${sw('records','Rekordy i osiągnięcia','Tylko prawdziwe rekordy z Twoich wyników.')}
    ${sw('summary','Podsumowanie treningu','')}
    <button type="button" class="cs-btn cs-btn-ghost pv-test" onclick="pvTest()">Odsłuchaj przykładowy komunikat</button>
    <p class="pv-note">Ustawienia zapisują się na tym telefonie. Głos działa, gdy aplikacja jest otwarta; po zablokowaniu ekranu telefon może go wyciszyć.</p>
  </section>`;
}
function pvSetFromUI(el){
  if(!el||!el.dataset)return;
  const k=el.dataset.pvSet;let v;
  if(el.type==='checkbox')v=!!el.checked;
  else if(k==='volume')v=Number(el.value);
  else v=String(el.value||'');
  const s=pvSaveSettings({[k]:v});
  if(k==='enabled'&&!s.enabled)pvStop();
}
/** Przykład: działa poza treningiem (dotknięcie = odblokowanie głosu na iPhonie). */
function pvTest(){
  const s=pvSettings();
  const m=pvPick('motiv')||pvMsg(91);
  pvStop();
  const item={text:'Seria '+pvOrd(2,true)+' z '+pvNumGen(4)+'. '+m.text,kind:'test',prio:90,ttl:5000,at:pvNow()};
  pvUnlockAudio();
  if(PV.pack&&s.voice==='trainer'){
    const t=pvPick('motiv');const it={text:'Seria druga z czterech. '+(t?t.text:''),kind:'test',prio:90,ttl:5000,at:pvNow()};
    pvPlay(it);return;
  }
  PV.speaking=item;pvSpeak(item,{...s,enabled:true});
}

/* ---------- 9. Cykl życia ---------- */
if(typeof document!=='undefined'&&document.addEventListener){
  // Po powrocie do aplikacji stare komunikaty są nieaktualne.
  document.addEventListener('visibilitychange',()=>{try{if(document.visibilityState!=='visible')pvStop();else PV.queue=[];}catch(e){}});
}

window.PV=PV;window.PV_LIB=PV_LIB;window.PV_POOL=PV_POOL;window.PV_SUPPORT=PV_SUPPORT;window.PV_DEFAULTS=PV_DEFAULTS;
window.pvNum=pvNum;window.pvNumF=pvNumF;window.pvNumGen=pvNumGen;window.pvOrd=pvOrd;window.pvPlural=pvPlural;window.pvKg=pvKg;window.pvSeconds=pvSeconds;window.pvMinutes=pvMinutes;window.pvReps=pvReps;window.pvExName=pvExName;window.PV_NAME_LINES=PV_NAME_LINES;window.pvVocative=pvVocative;window.pvNameOk=pvNameOk;window.pvNameLine=pvNameLine;window.pvClientName=pvClientName;window.pvLoadClientPack=pvLoadClientPack;
if(typeof window.addEventListener==='function')window.addEventListener('load',()=>setTimeout(()=>{try{if(window._clientAppMode)pvLoadClientPack();}catch(e){}},4000));window.pvRestRound=pvRestRound;window.pvMinRound=pvMinRound;
window.pvSettings=pvSettings;window.pvSaveSettings=pvSaveSettings;window.pvEmit=pvEmit;window.pvEnqueue=pvEnqueue;window.pvStop=pvStop;window.pvCountdown=pvCountdown;window.pvRegisterSource=pvRegisterSource;
window.pvUnlockAudio=pvUnlockAudio;window.pvLoadPack=pvLoadPack;window.pvPackSource=pvPackSource;window.pvAfterSet=pvAfterSet;window.pvExStartData=pvExStartData;window.pvRestCompleteData=pvRestCompleteData;window.pvWorkoutStats=pvWorkoutStats;window.pvReturning=pvReturning;
window.pvMuteBtnHTML=pvMuteBtnHTML;window.pvToggleMute=pvToggleMute;window.pvSettingsCardHTML=pvSettingsCardHTML;window.pvSetFromUI=pvSetFromUI;window.pvTest=pvTest;
