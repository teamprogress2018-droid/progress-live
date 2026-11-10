// Wywiad przed planem AI — „Poznaj klienta przed planem”.
// Trener zbiera krótki wywiad (5 kroków), widzi „Profil do planu”, a dopiero potem AI układa propozycję.
// Propozycja nigdy nie zapisuje planu: trafia do edytora, gdzie trener ją zatwierdza (aplSavePlan).
// Nie diagnozujemy — przy istotnych objawach plan jest oznaczany jako wymagający uwagi trenera.

const PIV_VERSION=1;
const PIV_STEPS=['Cel i priorytety','Doświadczenie i forma','Zdrowie i ograniczenia','Regeneracja i styl życia','Dane startowe i preferencje'];
const PIV_GOALS=[
  {v:'redukcja',l:'Redukcja'},{v:'masa',l:'Budowa masy'},{v:'sila',l:'Siła'},{v:'sprawnosc',l:'Sprawność'},
  {v:'powrot',l:'Powrót do ruchu'},{v:'zdrowie',l:'Zdrowie'},{v:'inny',l:'Inny'}];
const PIV_EXP=[{v:'0-3m',l:'0–3 mies.'},{v:'3-12m',l:'3–12 mies.'},{v:'1-3y',l:'1–3 lata'},{v:'3y+',l:'Ponad 3 lata'}];
const PIV_EQUIP=[{v:'silownia',l:'Pełna siłownia'},{v:'dom',l:'Dom'},{v:'hantle',l:'Hantle'},{v:'maszyny',l:'Maszyny'},{v:'gumy',l:'Gumy'},{v:'inny',l:'Inny'}];
const PIV_WORK=[{v:'siedzaca',l:'Siedząca'},{v:'aktywna',l:'Aktywna'},{v:'fizyczna',l:'Fizyczna'},{v:'zmianowa',l:'Zmianowa'}];
const PIV_DAYS=['Pn','Wt','Śr','Cz','Pt','Sb','Nd'];
const PIV_PREFS=[{v:'wolne',l:'Wolne ciężary'},{v:'maszyny',l:'Maszyny'},{v:'krotki',l:'Trening krótki'},{v:'roznorodnosc',l:'Większa różnorodność'},{v:'proste',l:'Proste, powtarzalne sesje'}];
const PIV_TECH=[{v:'1',l:'Uczy się podstaw'},{v:'2',l:'Częściowo pewna'},{v:'3',l:'Pewna technika'}];
// Słowa, przy których plan wymaga uwagi trenera i konsultacji — bez diagnozy.
const PIV_RED_FLAGS=/operac|zabieg|rwa|drętw|mrowien|promieniuj|ból w klatce|duszno|zawrot|omdle|kołatan|nadciśn|ciśnien|kardio|serc|przepuklin|ciąż|świeża|ostry ból|nasila się|w nocy|złamani|zerwan|dyskopat|endoproteza|cukrzyc|padaczk/i;

let PIV=null; // {clientId, step, a:{…}, extraQ:[], version}

function pivEsc(s){return typeof escHtml==='function'?escHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pivClient(){return PIV&&PIV.clientId?(window.CL||[]).find(c=>c&&c.id===PIV.clientId)||null:null;}

/** Odpowiedzi startowe: najpierw zapisany wywiad, uzupełniony danymi z profilu klienta. */
function pivDefaults(c){
  const a={goal:'',goalOther:'',priority:'',success:'',deadline:'',
    exp:'',recent:'',days:'',minutes:'',prefType:'',dislikes:'',equipment:[],
    medical:'',pain:'',painMoves:'',noLimits:false,skipHealth:false,
    sleepH:'',sleepQ:'',stress:'',work:'',steps:'',sports:'',prefDays:[],
    height:'',weight:'',circ:'',strength:'',prefs:[],technique:'',notes:''};
  if(!c)return a;
  const goalMap={masa:'masa',redukcja:'redukcja',sila:'sila',kondycja:'sprawnosc',atletyzm:'sprawnosc',rehab:'powrot'};
  if(c.goal&&goalMap[c.goal])a.goal=goalMap[c.goal];
  const expMap={poczatkujacy:'0-3m',sredni:'1-3y',zaawansowany:'3y+'};
  if(c.level&&expMap[c.level])a.exp=expMap[c.level];
  const freq=typeof normalizeTrainingFreq==='function'?normalizeTrainingFreq(c.trainingFreq):parseInt(c.trainingFreq,10);
  if(freq>=2&&freq<=6)a.days=String(freq);
  const eq=typeof clientAvailableEquipment==='function'?clientAvailableEquipment(c):(c.availableEquipment||[]);
  if(Array.isArray(eq)&&eq.length){
    const s=new Set();
    eq.forEach(x=>{
      if(/sztang|wolne/i.test(x))s.add('silownia');
      if(/maszyn|wyci/i.test(x))s.add('maszyny');
      if(/hantl/i.test(x))s.add('hantle');
      if(/bez sprz/i.test(x))s.add('dom');
    });
    if(s.has('silownia')&&s.has('maszyny'))a.equipment=['silownia'];
    else a.equipment=[...s];
  }
  const lim=typeof clientCombinedLimitationsText==='function'?clientCombinedLimitationsText(c):'';
  const inj=lim||c.injuries||(typeof clientInjuriesText==='function'?clientInjuriesText(c):'')||'';
  if(inj)a.pain=String(inj);
  const w=typeof clientLatestMetricWeight==='function'?clientLatestMetricWeight(c.id):null;
  if(w!=null)a.weight=String(w);else if(c.weight)a.weight=String(c.weight);
  if(c.height)a.height=String(c.height);
  if(c.sportNotes)a.sports=String(c.sportNotes);
  return a;
}
function pivLoad(c){
  const base=pivDefaults(c);
  const saved=c&&c.planInterview&&c.planInterview.answers;
  return saved?Object.assign(base,saved):base;
}

// ── Wyliczenia profilu i rekomendacji ──
function pivLevel(a){
  let lvl=a.exp==='3y+'?'zaawansowany':a.exp==='1-3y'?'sredni':a.exp?'poczatkujacy':'';
  if(lvl==='zaawansowany'&&a.technique==='1')lvl='sredni';
  if(lvl==='sredni'&&a.technique==='1')lvl='poczatkujacy';
  return lvl;
}
const PIV_LEVEL_LABEL={poczatkujacy:'początkujący',sredni:'średnio zaawansowany',zaawansowany:'zaawansowany'};
function pivRedFlags(a){
  if(a.skipHealth||a.noLimits)return a.medical==='tak'?['zalecenia lekarza lub fizjoterapeuty']:[];
  const out=[];
  if(a.medical==='tak')out.push('zalecenia lekarza lub fizjoterapeuty');
  const txt=[a.pain,a.painMoves].join(' ');
  if(PIV_RED_FLAGS.test(txt))out.push('zgłoszone objawy wymagające oceny');
  return out;
}
function pivHasPain(a){return !a.noLimits&&!a.skipHealth&&!!String(a.pain||a.painMoves||'').trim();}
/** Realizacja poprzednich planów: zaplanowane vs odbyte w ostatnich 6 tygodniach. */
function pivAdherence(clientId){
  if(!clientId)return null;
  const today=typeof todayYmd==='function'?todayYmd():new Date().toISOString().slice(0,10);
  const from=new Date(today+'T12:00:00');from.setDate(from.getDate()-42);
  const fromY=typeof dateStrLocal==='function'?dateStrLocal(from):from.toISOString().slice(0,10);
  const all=(window.SE||[]).filter(s=>s&&s.clientId===clientId&&s.date&&s.date>=fromY&&s.date<today);
  const planned=all.filter(s=>s.source==='planned');
  if(planned.length<4)return null;
  const done=planned.filter(s=>typeof sessionHappened==='function'?sessionHappened(s,window.SE):false).length;
  return{planned:planned.length,done,ratio:done/planned.length};
}
function pivRisk(a){
  let score=0;const why=[];
  const h=parseFloat(a.sleepH);
  if((h&&h<6)||(a.sleepQ&&Number(a.sleepQ)<=2)){score++;why.push('krótki lub słaby sen');}
  if(a.stress&&Number(a.stress)>=4){score++;why.push('wysoki stres');}
  if(a.work==='fizyczna'||a.work==='zmianowa'){score++;why.push(a.work==='fizyczna'?'praca fizyczna':'praca zmianowa');}
  if(pivHasPain(a)){score++;why.push('ból lub ograniczenie');}
  if(pivLevel(a)==='poczatkujacy'&&Number(a.days)>=5){score++;why.push('dużo dni na start');}
  return{score,label:score>=2?'podwyższone':score===1?'umiarkowane':'niskie',why};
}
function pivMissing(a){
  const m=[];
  if(a.skipHealth)m.push('historia urazów i ograniczeń (pominięto pytanie)');
  if(!a.sleepH&&!a.sleepQ)m.push('sen');
  if(!a.stress)m.push('poziom stresu');
  if(!a.height||!a.weight)m.push('wzrost lub masa ciała');
  if(!a.recent)m.push('co ostatnio trenował');
  if(a.goal==='sila'&&!a.strength)m.push('ostatnie wyniki siłowe');
  if(!a.technique)m.push('pewność techniki podstawowych ćwiczeń');
  return m;
}
/** Pola obowiązkowe — minimum do bezpiecznej propozycji. */
function pivRequiredMissing(a){
  const m=[];
  if(!a.goal)m.push({step:0,label:'główny cel'});
  if(!a.exp)m.push({step:1,label:'staż treningowy'});
  if(!a.days)m.push({step:1,label:'liczba treningów w tygodniu'});
  if(!a.minutes)m.push({step:1,label:'czas jednej sesji'});
  if(!(a.equipment||[]).length)m.push({step:1,label:'dostępny sprzęt'});
  if(!a.skipHealth&&!a.noLimits&&!a.medical&&!String(a.pain||'').trim())m.push({step:2,label:'zdrowie i ograniczenia (albo „brak” / „pomiń”)'});
  return m;
}
/** Deterministyczna rekomendacja metody — AI dostaje ją jako punkt wyjścia z uzasadnieniem. */
function pivRecommend(a,clientId){
  const level=pivLevel(a)||'poczatkujacy';
  let days=Math.max(2,Math.min(6,parseInt(a.days,10)||3));
  let minutes=parseInt(a.minutes,10)||60;
  const decisions=[];
  const risk=pivRisk(a);
  const adh=pivAdherence(clientId);
  const conservative=risk.score>=2||(a.sleepQ&&Number(a.sleepQ)<=2)||(a.stress&&Number(a.stress)>=4)||(parseFloat(a.sleepH)>0&&parseFloat(a.sleepH)<6);
  if(adh&&adh.ratio<0.6){
    const before=days;
    days=Math.max(2,days-1);
    if(minutes>45)minutes=45;
    decisions.push('Krótsze sesje'+(before!==days?' i '+days+' dni zamiast '+before:'')+', bo w ostatnich 6 tygodniach klient zrobił '+adh.done+' z '+adh.planned+' zaplanowanych treningów.');
  }
  if(level==='poczatkujacy'&&days>=5){
    decisions.push('Start od 4 dni zamiast '+days+' — początkującemu wystarczą 4 sesje, a łatwiej utrzymać regularność.');
    days=4;
  }
  let method;
  if(a.goal==='powrot'||a.goal==='zdrowie'||days<=3){
    method='FBW';
    decisions.push('Wybrano FBW '+days+'×/tydzień, ponieważ klient ma '+days+' '+(days===1?'dostępny dzień':'dostępne dni')+(level==='poczatkujacy'?' i jest początkujący':'')+(a.goal==='powrot'?' i wraca do ruchu':'')+'.');
  }else if(days===4){
    method='Upper/Lower';
    decisions.push('Wybrano Upper/Lower 4×/tydzień — przy 4 dniach każda partia dostaje 2 sesje tygodniowo.');
  }else if(level==='poczatkujacy'){
    method='Upper/Lower';
    decisions.push('Upper/Lower zamiast PPL — przy stażu początkującym prostsza struktura daje częstszy trening każdej partii.');
  }else{
    method='PPL';
    decisions.push('PPL '+days+'×/tydzień, bo klient ma '+days+' dni i staż '+PIV_LEVEL_LABEL[level]+' — wtedy podział na Push/Pull/Legs ma uzasadnienie.');
  }
  if(pivHasPain(a)){
    decisions.push('Bezpieczniejsze warianty (maszyny, stabilna pozycja, kontrolowany zakres) z powodu zgłoszonego problemu: '+String(a.pain||a.painMoves).slice(0,80)+'.');
  }
  if(conservative){
    decisions.push('Objętość startowa niska–umiarkowana i RIR 3–4, ze względu na '+(risk.why.filter(w=>/sen|stres|zmian/.test(w)).join(' i ')||'regenerację')+'.');
  }
  const rir=conservative||level==='poczatkujacy'?'3–4':level==='sredni'?'2–3':'1–3';
  const flags=pivRedFlags(a);
  return{level,days,minutes,method,rir,conservative,decisions,risk,adherence:adh,needsReview:flags.length>0,flags};
}
function pivGoalLabel(a){
  const g=PIV_GOALS.find(x=>x.v===a.goal);
  const base=a.goal==='inny'&&a.goalOther?a.goalOther:(g?g.l:'—');
  return base+(a.priority?' · priorytet: '+a.priority:'');
}
function pivEquipLabel(a){return (a.equipment||[]).map(v=>(PIV_EQUIP.find(x=>x.v===v)||{l:v}).l.toLowerCase()).join(', ')||'—';}
function pivProfile(a,clientId){
  const r=pivRecommend(a,clientId);
  const limits=a.skipHealth?'pominięto — do uzupełnienia':a.noLimits?'brak zgłoszonych':([a.pain,a.painMoves?'ból przy: '+a.painMoves:''].filter(Boolean).join('; ')||(a.medical==='tak'?'zalecenia specjalisty':'brak zgłoszonych'));
  const regen=[a.sleepH?'sen '+a.sleepH+' h':'',a.sleepQ?'jakość snu '+a.sleepQ+'/5':'',a.stress?'stres '+a.stress+'/5':''].filter(Boolean).join(', ')||'brak danych';
  return{
    rows:[
      ['Cel',pivGoalLabel(a)],
      ['Poziom',PIV_LEVEL_LABEL[pivLevel(a)]||'—'],
      ['Realna dostępność',(a.days||'—')+' × '+(a.minutes||'—')+' min'],
      ['Sprzęt',pivEquipLabel(a)],
      ['Ograniczenia',limits],
      ['Regeneracja',regen],
      ['Ryzyko przeciążenia',r.risk.label+(r.risk.why.length?' ('+r.risk.why.join(', ')+')':'')]
    ],
    missing:pivMissing(a),rec:r
  };
}

// ── Otwieranie, zapis ──
function pivOpen(clientId,opts){
  const id=clientId||document.getElementById('apl-client')?.value||'';
  if(!id){if(typeof notify==='function')notify('Wybierz klienta, aby przeprowadzić wywiad');return;}
  const c=(window.CL||[]).find(x=>x&&x.id===id);
  if(!c)return;
  PIV={clientId:id,step:opts&&Number.isFinite(opts.step)?opts.step:(c.planInterview&&c.planInterview.answers?5:0),a:pivLoad(c),
    extraQ:(c.planInterview&&c.planInterview.extraQ)||[],version:(PIV&&PIV.clientId===id?PIV.version:0)};
  pivRender();
}
function pivClose(){
  const m=document.getElementById('piv-mount');
  if(m){m.hidden=true;m.innerHTML='';}
  document.getElementById('screen-aiplangen')?.classList.remove('piv-open');
}
function pivCollect(){
  const m=document.getElementById('piv-mount');if(!m||!PIV)return;
  m.querySelectorAll('[data-piv]').forEach(el=>{
    const k=el.dataset.piv;
    if(el.type==='checkbox')PIV.a[k]=el.checked;
    else PIV.a[k]=String(el.value||'').trim();
  });
  m.querySelectorAll('[data-piv-qa]').forEach(el=>{
    const i=Number(el.dataset.pivQa);
    if(PIV.extraQ[i])PIV.extraQ[i].a=String(el.value||'').trim();
  });
}
function pivSave(silent){
  pivCollect();
  const c=pivClient();if(!c)return;
  c.planInterview={v:PIV_VERSION,updatedAt:new Date().toISOString(),answers:Object.assign({},PIV.a),extraQ:PIV.extraQ.slice(0,3)};
  if(typeof persistById==='function')persistById('clients',c);
  if(!silent&&typeof notify==='function')notify('✓ Wywiad zapisany — możesz wrócić do niego później');
}
function pivSaveAndExit(){pivSave(false);pivClose();}
function pivPick(key,val,multi){
  pivCollect();
  if(multi){
    const arr=Array.isArray(PIV.a[key])?PIV.a[key].slice():[];
    const i=arr.indexOf(val);if(i>=0)arr.splice(i,1);else arr.push(val);
    PIV.a[key]=arr;
  }else PIV.a[key]=PIV.a[key]===val?'':val;
  if(key==='noLimits'||key==='skipHealth'){/* przełączniki obsługuje pivToggle */}
  pivRender();
}
function pivToggle(key){
  pivCollect();
  PIV.a[key]=!PIV.a[key];
  if(key==='noLimits'&&PIV.a.noLimits)PIV.a.skipHealth=false;
  if(key==='skipHealth'&&PIV.a.skipHealth)PIV.a.noLimits=false;
  pivRender();
}
function pivGo(step){
  pivCollect();
  PIV.step=Math.max(0,Math.min(5,step));
  pivSave(true);
  pivRender();
  const m=document.getElementById('piv-mount');if(m&&m.scrollIntoView)m.scrollIntoView({block:'start'});
}

// ── Widok ──
function pivChips(key,opts,multi){
  const cur=PIV.a[key];
  return `<div class="piv-chips">${opts.map(o=>{
    const on=multi?(cur||[]).includes(o.v):cur===o.v;
    return `<button type="button" class="piv-chip${on?' is-on':''}" aria-pressed="${on}" onclick="pivPick('${key}','${pivEsc(o.v)}',${multi?'true':'false'})">${pivEsc(o.l)}</button>`;
  }).join('')}</div>`;
}
function pivScale(key,lo,hi,labels){
  const opts=[];for(let i=lo;i<=hi;i++)opts.push({v:String(i),l:String(i)});
  return pivChips(key,opts,false)+(labels?`<div class="piv-scale-lbl"><span>${labels[0]}</span><span>${labels[1]}</span></div>`:'');
}
function pivInput(key,ph,type){
  return `<input class="form-input piv-input" data-piv="${key}" type="${type||'text'}" value="${pivEsc(PIV.a[key]||'')}" placeholder="${pivEsc(ph||'')}">`;
}
function pivArea(key,ph){return `<textarea class="form-input piv-input" data-piv="${key}" rows="2" placeholder="${pivEsc(ph||'')}">${pivEsc(PIV.a[key]||'')}</textarea>`;}
function pivQ(label,body,req,hint){
  return `<div class="piv-q"><div class="piv-q-lbl">${pivEsc(label)}${req?' <span class="piv-req" title="Wymagane do bezpiecznej propozycji">*</span>':''}</div>${hint?`<div class="piv-q-hint">${pivEsc(hint)}</div>`:''}${body}</div>`;
}
function pivStepHTML(step){
  const a=PIV.a;
  if(step===0)return pivQ('Główny cel',pivChips('goal',PIV_GOALS),true)
    +(a.goal==='inny'?pivQ('Jaki cel?',pivInput('goalOther','np. przygotowanie do biegu na 10 km')):'')
    +pivQ('Priorytetowa partia lub umiejętność',pivInput('priority','np. pośladki, podciąganie, mobilność bioder'))
    +pivQ('Jak klient pozna, że plan działa?',pivInput('success','np. wejdę na 3. piętro bez zadyszki'))
    +pivQ('Termin lub wydarzenie docelowe',pivInput('deadline','np. wesele w czerwcu (opcjonalnie)'));
  if(step===1)return pivQ('Staż treningowy',pivChips('exp',PIV_EXP),true)
    +pivQ('Co trenował ostatnio i jak regularnie?',pivInput('recent','np. siłownia 2× w tygodniu przez pół roku, przerwa 3 mies.'))
    +pivQ('Ile treningów tygodniowo realnie wykona?',pivChips('days',['2','3','4','5','6'].map(v=>({v,l:v+'×'}))),true)
    +pivQ('Ile minut ma na jedną sesję?',pivChips('minutes',['30','45','60','75','90'].map(v=>({v,l:v+' min'}))),true)
    +pivQ('Preferowany typ treningu i czego nie lubi',pivInput('prefType','np. lubi obwody')+pivInput('dislikes','ćwiczenia lub sprzęt, których nie lubi'))
    +pivQ('Dostępny sprzęt',pivChips('equipment',PIV_EQUIP,true),true);
  if(step===2){
    const quick=`<div class="piv-chips"><button type="button" class="piv-chip${a.noLimits?' is-on':''}" aria-pressed="${!!a.noLimits}" onclick="pivToggle('noLimits')">Brak ograniczeń</button><button type="button" class="piv-chip${a.skipHealth?' is-on':''}" aria-pressed="${!!a.skipHealth}" onclick="pivToggle('skipHealth')">Pomiń pytanie</button></div>`;
    const off=a.noLimits||a.skipHealth;
    const flags=pivRedFlags(a);
    return pivQ('Szybka odpowiedź',quick,true,'Zaznacz „Brak ograniczeń” albo „Pomiń pytanie”, jeśli nie ma czego opisywać.')
      +(off?'':pivQ('Czy lekarz lub fizjoterapeuta zalecił ograniczenia?',pivChips('medical',[{v:'nie',l:'Nie'},{v:'tak',l:'Tak'}]))
        +pivQ('Ból, kontuzje, operacje, obszary wymagające ostrożności',pivArea('pain','np. ból kolana przy głębokim zgięciu, operacja barku 2022'))
        +pivQ('Ruchy, które wywołują ból lub dyskomfort',pivInput('painMoves','np. przysiad poniżej równoległej, wyciskanie nad głowę')))
      +(flags.length?`<div class="piv-alert" data-piv-review="1"><b>Plan treningowy nie zastępuje konsultacji medycznej.</b> Propozycja zostanie oznaczona jako wymagająca uwagi trenera (${pivEsc(flags.join(', '))}). Nie stawiamy diagnozy.</div>`:'');
  }
  if(step===3)return pivQ('Sen',`<div class="piv-row">${pivInput('sleepH','godzin, np. 7','number')}</div>`+pivScale('sleepQ',1,5,['słaba jakość','świetna']))
    +pivQ('Stres',pivScale('stress',1,5,['niski','bardzo wysoki']))
    +pivQ('Praca',pivChips('work',PIV_WORK))
    +pivQ('Kroki lub codzienna aktywność',pivInput('steps','np. ok. 6000 kroków, dojazd rowerem'))
    +pivQ('Cardio lub inne sporty',pivInput('sports','np. bieganie 2× 5 km, padel w weekendy'))
    +pivQ('Preferowane dni treningowe',pivChips('prefDays',PIV_DAYS.map(d=>({v:d,l:d})),true));
  return pivQ('Wzrost i masa ciała',`<div class="piv-row">${pivInput('height','wzrost, cm','number')}${pivInput('weight','masa, kg','number')}</div>`)
    +pivQ('Obwody (opcjonalnie)',pivInput('circ','np. talia 92 cm, biodra 104 cm'),false,'Zdjęcia postępów dodasz w profilu klienta → Zdjęcia.')
    +pivQ('Ostatnie wyniki siłowe',pivInput('strength','np. przysiad 80 kg × 5, podciąganie 3 powt.'))
    +pivQ('Preferencje',pivChips('prefs',PIV_PREFS,true))
    +pivQ('Pewność techniki podstawowych ćwiczeń',pivChips('technique',PIV_TECH))
    +pivQ('Co trener powinien jeszcze wiedzieć, zanim ułoży plan?',pivArea('notes','np. nie lubi biegać, ma psa i dużo spaceruje'));
}
function pivSummaryHTML(){
  const p=pivProfile(PIV.a,PIV.clientId);
  const req=pivRequiredMissing(PIV.a);
  const qa=PIV.extraQ||[];
  return `<div class="piv-summary" data-piv-summary="1">
    <div class="piv-sum-hd">Profil do planu</div>
    <dl class="piv-sum-rows">${p.rows.map(([k,v])=>`<div><dt>${pivEsc(k)}</dt><dd${k==='Ryzyko przeciążenia'&&p.rec.risk.score>=2?' class="is-watch"':''}>${pivEsc(v)}</dd></div>`).join('')}
      <div><dt>Brakujące dane</dt><dd data-piv-missing>${p.missing.length?pivEsc(p.missing.join(', ')):'brak — komplet'}</dd></div>
    </dl>
    ${p.rec.needsReview?`<div class="piv-alert" data-piv-review="1"><b>Wymaga uwagi trenera.</b> Plan treningowy nie zastępuje konsultacji medycznej — przed startem warto skonsultować ograniczenia ze specjalistą.</div>`:''}
    <div class="piv-sum-rec"><div class="piv-sum-sub">Punkt wyjścia dla AI</div><ul>${p.rec.decisions.map(d=>`<li>${pivEsc(d)}</li>`).join('')}</ul></div>
    ${qa.length?`<div class="piv-sum-rec" data-piv-extra><div class="piv-sum-sub">Dodatkowe pytania AI</div>${qa.map((q,i)=>`<div class="piv-q"><div class="piv-q-lbl">${pivEsc(q.q)}</div>${q.why?`<div class="piv-q-hint">${pivEsc(q.why)}</div>`:''}<input class="form-input piv-input" data-piv-qa="${i}" value="${pivEsc(q.a||'')}" placeholder="Odpowiedź (opcjonalnie)"></div>`).join('')}</div>`:''}
    ${req.length?`<div class="piv-alert piv-alert-info" data-piv-required>Uzupełnij przed generowaniem: ${req.map(r=>`<button type="button" class="piv-link" onclick="pivGo(${r.step})">${pivEsc(r.label)}</button>`).join(', ')}.</div>`:''}
    <div class="piv-actions">
      <button type="button" class="btn btn-ghost" onclick="pivGo(0)">Edytuj wywiad</button>
      <button type="button" class="btn btn-ghost" id="piv-ask-btn" onclick="pivAskAi()"${qa.length>=3?' disabled':''}>Zadaj AI dodatkowe pytania</button>
      <button type="button" class="btn btn-primary" data-piv-generate onclick="pivGenerate()"${req.length?' disabled':''}>Wygeneruj propozycję planu</button>
    </div>
  </div>`;
}
function pivRender(){
  const m=document.getElementById('piv-mount');
  if(!m||!PIV)return;
  const c=pivClient();
  const step=PIV.step;
  const pct=step>=5?100:Math.round(step/5*100);
  m.hidden=false;
  document.getElementById('screen-aiplangen')?.classList.add('piv-open');
  m.innerHTML=`<div class="piv">
    <div class="piv-hd">
      <div><div class="piv-kicker">Poznaj klienta przed planem</div><div class="piv-title">${pivEsc(c?c.name:'Klient')}</div></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="pivSaveAndExit()">Zapisz wywiad i wróć później</button>
    </div>
    <div class="piv-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
    <div class="piv-steps">${PIV_STEPS.map((s,i)=>`<button type="button" class="piv-step${i===step?' is-cur':i<step?' is-done':''}" onclick="pivGo(${i})">${i+1}. ${pivEsc(s)}</button>`).join('')}<button type="button" class="piv-step${step===5?' is-cur':''}" onclick="pivGo(5)">Podsumowanie</button></div>
    ${step<5?`<div class="piv-body" data-piv-step="${step}">
      <div class="piv-step-title">Krok ${step+1} z 5: ${pivEsc(PIV_STEPS[step])}</div>
      ${pivStepHTML(step)}
      <div class="piv-nav">
        ${step>0?`<button type="button" class="btn btn-ghost" onclick="pivGo(${step-1})">Wstecz</button>`:'<span></span>'}
        <button type="button" class="btn btn-primary" data-piv-next onclick="pivGo(${step+1})">${step===4?'Podsumowanie':'Dalej'}</button>
      </div>
    </div>`:pivSummaryHTML()}
  </div>`;
}

// ── Dodatkowe pytania AI (maks. 3, tylko gdy zmieniają dobór planu) ──
function pivRuleQuestions(a){
  const q=[];
  if(pivHasPain(a)&&!a.painMoves)q.push({q:'Przy jakich ruchach pojawia się ból?',why:'Od tego zależy, które warianty ćwiczeń zastąpić.'});
  if(a.goal==='sila'&&!a.strength)q.push({q:'Jakie są ostatnie wyniki w głównych bojach?',why:'Pozwoli ustawić ciężary startowe i progresję.'});
  if(!a.recent)q.push({q:'Kiedy ostatnio trenował regularnie i jak długo trwała przerwa?',why:'Wpływa na objętość startową.'});
  if(Number(a.days)>=5&&pivLevel(a)==='poczatkujacy')q.push({q:'Czy 5+ treningów jest realne przez najbliższe 2 miesiące?',why:'Decyduje o podziale planu.'});
  return q.slice(0,3);
}
async function pivAskAi(){
  pivCollect();
  const a=PIV.a;
  const btn=document.getElementById('piv-ask-btn');
  if(btn){btn.disabled=true;btn.textContent='AI analizuje wywiad…';}
  let qs=[];
  try{
    if(typeof aplAnthropicRequest!=='function')throw new Error('AI niedostępne');
    const p=pivProfile(a,PIV.clientId);
    const data=await aplAnthropicRequest({model:'claude-sonnet-4-20250514',max_tokens:600,
      system:'Jesteś doświadczonym trenerem personalnym. Na podstawie wywiadu zadaj MAKSYMALNIE 3 krótkie pytania do klienta — TYLKO takie, których odpowiedź realnie zmieni dobór planu (metoda, liczba dni, objętość, dobór ćwiczeń, bezpieczeństwo). Jeśli niczego nie brakuje, zwróć pustą listę. Nie diagnozuj. Odpowiedz wyłącznie JSON: {"questions":[{"q":"pytanie","why":"co zmieni w planie"}]}',
      messages:[{role:'user',content:'WYWIAD:\n'+JSON.stringify(a)+'\nPROFIL:\n'+p.rows.map(r=>r.join(': ')).join('\n')+'\nBRAKUJĄCE: '+p.missing.join(', ')}]},1);
    const raw=data?.content?.[0]?.text||'';
    const obj=typeof aplExtractJsonObject==='function'?JSON.parse(aplExtractJsonObject(raw)):JSON.parse(raw);
    qs=(obj&&Array.isArray(obj.questions)?obj.questions:[]).filter(x=>x&&x.q).map(x=>({q:String(x.q).slice(0,200),why:String(x.why||'').slice(0,160)}));
  }catch(e){
    qs=pivRuleQuestions(a);
  }
  const have=new Set((PIV.extraQ||[]).map(x=>x.q));
  PIV.extraQ=(PIV.extraQ||[]).concat(qs.filter(x=>!have.has(x.q))).slice(0,3);
  if(!qs.length&&typeof notify==='function')notify('AI nie ma dodatkowych pytań — dane wystarczą do propozycji');
  pivSave(true);
  pivRender();
}

// ── Przekazanie do generatora ──
function pivSetOpt(groupId,val){
  const root=document.getElementById(groupId);if(!root)return;
  root.querySelectorAll('.apl-opt').forEach(b=>b.classList.toggle('active',b.dataset.val===String(val)));
}
function pivApplyToForm(a,rec){
  const goalMap={redukcja:'redukcja',masa:'masa',sila:'sila',sprawnosc:'kondycja',powrot:'kondycja',zdrowie:'kondycja',inny:'kondycja'};
  pivSetOpt('apl-goals',goalMap[a.goal]||'kondycja');
  pivSetOpt('apl-levels',rec.level);
  pivSetOpt('apl-methods',rec.method);
  pivSetOpt('apl-days',String(rec.days));
  const dur=[45,60,75,90].find(d=>d>=rec.minutes)||90;
  pivSetOpt('apl-duration',String(dur));
  const eq=new Set();
  (a.equipment||[]).forEach(v=>{
    if(v==='silownia')['Sztanga i wolne ciężary','Maszyny siłowe','Wyciągi i linki','Hantle','Drążek i poręcze'].forEach(x=>eq.add(x));
    if(v==='maszyny'){eq.add('Maszyny siłowe');eq.add('Wyciągi i linki');}
    if(v==='hantle')eq.add('Hantle');
    if(v==='dom'||v==='gumy')eq.add('Bez sprzętu');
  });
  if(eq.size&&typeof aplSetEquipment==='function')aplSetEquipment([...eq]);
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==''&&v!=null)el.value=v;};
  set('apl-weight',a.weight);set('apl-height',a.height);
  const inj=a.skipHealth?'':a.noLimits?'':[a.pain,a.painMoves?'ból przy: '+a.painMoves:''].filter(Boolean).join('; ');
  const injEl=document.getElementById('apl-injuries');if(injEl)injEl.value=inj;
  const sl=document.getElementById('apl-sleep');if(sl&&a.sleepQ)sl.value=a.sleepQ;
  const st=document.getElementById('apl-stress');if(st&&a.stress)st.value=a.stress;
  const jobMap={siedzaca:'praca siedząca (biuro, komputer)',aktywna:'praca stojąca lub mieszana',fizyczna:'praca fizyczna (aktywna)',zmianowa:'praca stojąca lub mieszana'};
  set('apl-job',jobMap[a.work]||'');
  if(rec.conservative)['Drop-sety','Rest-pause','Myo-reps','Serie gigant'].forEach(v=>{
    const b=document.querySelector('#apl-intensify .apl-opt[data-val="'+v+'"]');if(b)b.classList.remove('active');
  });
}
async function pivGenerate(){
  pivCollect();
  if(pivRequiredMissing(PIV.a).length){pivRender();return;}
  pivSave(true);
  const c=pivClient();
  const sel=document.getElementById('apl-client');
  if(sel&&c&&sel.value!==c.id){sel.value=c.id;window._pivSkipAutoOpen=true;if(typeof aplFillFromClient==='function')aplFillFromClient();window._pivSkipAutoOpen=false;}
  const rec=pivRecommend(PIV.a,PIV.clientId);
  pivApplyToForm(PIV.a,rec);
  window._pivActive={clientId:PIV.clientId,a:Object.assign({},PIV.a),extraQ:(PIV.extraQ||[]).slice(),rec,version:PIV.version||0,prevExercises:window._pivActive&&window._pivActive.clientId===PIV.clientId?window._pivActive.prevExercises:[]};
  pivClose();
  pivShowPending();
  if(typeof aplGenerate==='function')await aplGenerate();
}
function pivAnotherVersion(){
  const act=window._pivActive;if(!act)return;
  const plan=typeof aplLastPlan!=='undefined'?aplLastPlan:null;
  act.prevExercises=plan?[].concat(...(plan.days||[]).map(d=>(d.exercises||[]).map(e=>e.name))).filter(Boolean).slice(0,40):[];
  act.version=(act.version||0)+1;
  pivShowPending();
  return typeof aplGenerate==='function'?aplGenerate():null;
}
function pivBackToInterview(){
  const act=window._pivActive;
  pivHideProposal(false);
  pivOpen(act?act.clientId:'',{step:5});
}

/** Blok promptu: wywiad jako główne źródło dopasowania + dodatkowe pola odpowiedzi. */
function pivPromptBlock(){
  const act=window._pivActive;if(!act)return'';
  const a=act.a,rec=act.rec,p=pivProfile(a,act.clientId);
  const lines=[
    'Cel: '+pivGoalLabel(a)+(a.success?' — klient pozna, że plan działa, gdy: '+a.success:'')+(a.deadline?' — termin: '+a.deadline:''),
    'Staż: '+((PIV_EXP.find(x=>x.v===a.exp)||{}).l||'—')+(a.recent?' — ostatnio: '+a.recent:'')+(a.technique?' — pewność techniki: '+((PIV_TECH.find(x=>x.v===a.technique)||{}).l||''):''),
    'Realna dostępność: '+a.days+' × '+a.minutes+' min'+(rec.days!==Number(a.days)||rec.minutes!==Number(a.minutes)?' (rekomendacja: '+rec.days+' × '+rec.minutes+' min)':'')+((a.prefDays||[]).length?' — preferowane dni: '+a.prefDays.join(', '):''),
    'Sprzęt: '+pivEquipLabel(a),
    a.prefType||a.dislikes?'Preferencje: '+[a.prefType,a.dislikes?'NIE LUBI: '+a.dislikes:''].filter(Boolean).join('; '):'',
    (a.prefs||[]).length?'Styl: '+a.prefs.map(v=>(PIV_PREFS.find(x=>x.v===v)||{l:v}).l).join(', '):'',
    'Zdrowie: '+p.rows.find(r=>r[0]==='Ograniczenia')[1]+(a.medical==='tak'?' — specjalista zalecił ograniczenia':''),
    'Regeneracja: '+p.rows.find(r=>r[0]==='Regeneracja')[1]+(a.work?' — praca '+((PIV_WORK.find(x=>x.v===a.work)||{}).l||'').toLowerCase():'')+(a.steps?' — aktywność: '+a.steps:'')+(a.sports?' — sporty: '+a.sports:''),
    a.strength?'Wyniki siłowe: '+a.strength:'',
    a.circ?'Obwody: '+a.circ:'',
    a.notes?'Uwagi trenera: '+a.notes:'',
    ...(act.extraQ||[]).filter(x=>x.a).map(x=>'Dodatkowo: '+x.q+' → '+x.a),
    rec.adherence?'Realizacja poprzednich planów: '+rec.adherence.done+' z '+rec.adherence.planned+' treningów w 6 tyg.':'',
    'Ryzyko przeciążenia: '+rec.risk.label,
    p.missing.length?'Brakujące dane: '+p.missing.join(', '):''
  ].filter(Boolean);
  return `

=== WYWIAD PRZED PLANEM (NAJWAŻNIEJSZE ŹRÓDŁO DOPASOWANIA) ===
Plan ma wynikać z danych tej osoby — NIE jest szablonem z podmienionym imieniem. Każda kluczowa decyzja musi wskazywać fakt z wywiadu albo regułę z książki.
${lines.map(l=>'- '+l).join('\n')}

REKOMENDACJA WSTĘPNA (punkt wyjścia; zmień tylko z uzasadnieniem w "decisions"): metoda ${rec.method}, ${rec.days} dni, ${rec.minutes} min, RIR ${rec.rir}.
${rec.decisions.map(d=>'- '+d).join('\n')}
ZASADY DOPASOWANIA: 2–3 dni i początkujący → FBW; 4 dni → Upper/Lower, jeśli pasuje do celu; PPL tylko gdy częstotliwość i staż to uzasadniają — nigdy domyślnie. Ból/ograniczenie → bezpieczniejszy wariant z podanym powodem${rec.needsReview?' i zalecenie konsultacji ze specjalistą':''}. Słaby sen/wysoki stres → mniejsza objętość startowa, konserwatywne RIR/RPE, prostszy plan. Słaba frekwencja → krótsze sesje, mniej dni, prostsza struktura. Ćwiczeń, których klient nie lubi, nie wstawiaj. Nie stawiaj diagnoz i nie dawaj zaleceń medycznych.${rec.minutes<45?` Sesja ma trwać ${rec.minutes} min — dopasuj liczbę ćwiczeń do tego czasu.`:''}
${act.version&&act.prevExercises&&act.prevExercises.length?`INNA WERSJA (nr ${act.version+1}): zaproponuj wyraźnie inny dobór ćwiczeń niż poprzednio (${act.prevExercises.slice(0,24).join(', ')}), przy tych samych zasadach bezpieczeństwa.\n`:''}
DODATKOWE POLA JSON (tylko w odpowiedzi z pełną strukturą planu; w odpowiedzi {"days":[...]} pomiń):
"decisions": [{"decision":"np. FBW 3×/tydzień","reason":"fakt z wywiadu albo reguła [K…]"}] — 3–6 kluczowych decyzji,
"weeklySetsPerPart": {"klatka":"10","plecy":"12",…},
"rirRange": "np. RIR 2–3",
"cardio": "zalecenie cardio z uzasadnieniem albo pusty string, jeśli nie ma uzasadnienia",
"knowledge": [{"source":"tytuł książki / rozdział lub temat (tylko z dostarczonych reguł [K…])","tip":"krótka wskazówka własnymi słowami, maks. 20 słów, bez cytatu"}] — maks. 3; jeśli w bibliotece brak odpowiedzi, zwróć pustą listę,
"warnings": ["ostrzeżenia dla trenera"],
"missingData": ["dane, których brakuje i które mogą zmienić plan"].
W KAŻDYM ćwiczeniu dodaj "alternative": "zamiennik o podobnym wzorcu, zgodny ze sprzętem i ograniczeniami" oraz w "notes" krótką wskazówkę techniczną.`;
}

// ── Propozycja Progress AI (przed edytorem) ──
function pivShowPending(){
  const box=pivProposalBox();if(!box)return;
  box.hidden=false;
  box.innerHTML=`<div class="piv-prop piv-prop-pending"><div class="piv-kicker">Propozycja Progress AI</div><div class="piv-prop-sub">AI układa propozycję na podstawie wywiadu i biblioteki książek…</div></div>`;
  const res=document.getElementById('apl-result');if(res)res.hidden=true;
}
function pivProposalBox(){
  let box=document.getElementById('apl-proposal');
  const res=document.getElementById('apl-result');
  if(!box&&res&&res.parentNode){
    box=document.createElement('div');box.id='apl-proposal';box.hidden=true;
    res.parentNode.insertBefore(box,res);
  }
  return box;
}
function pivHideProposal(showEditor){
  const box=document.getElementById('apl-proposal');if(box){box.hidden=true;box.innerHTML='';}
  const res=document.getElementById('apl-result');if(res)res.hidden=false;
  if(showEditor&&res&&res.scrollIntoView)res.scrollIntoView({block:'start',behavior:'smooth'});
}
function pivAfterGenerate(plan){
  const act=window._pivActive;
  const box=pivProposalBox();
  if(!act||!box)return;
  const res=document.getElementById('apl-result');
  if(!plan||!(plan.days||[]).length){if(res)res.hidden=false;box.hidden=true;return;}
  plan.interview={clientId:act.clientId,needsReview:act.rec.needsReview,flags:act.rec.flags,at:new Date().toISOString()};
  if(res)res.hidden=true;
  box.hidden=false;
  box.innerHTML=pivProposalHTML(plan,act);
  if(box.scrollIntoView)box.scrollIntoView({block:'start'});
}
function pivProposalHTML(plan,act){
  const e=pivEsc,rec=act.rec;
  const decisions=(Array.isArray(plan.decisions)&&plan.decisions.length?plan.decisions.map(d=>typeof d==='string'?d:(d.decision?d.decision+(d.reason?' — '+d.reason:''):'')):rec.decisions).filter(Boolean).slice(0,6);
  // Serie liczone z ćwiczeń w planie (aplComputeWeeklyVolume) — deklaracja AI tylko gdy liczenia brak.
  const computed=plan.weeklyVolume&&typeof plan.weeklyVolume==='object'?Object.entries(plan.weeklyVolume).filter(([,v])=>/×\/tydz/.test(String(v))):[];
  const setsTxt=computed.length
    ?computed.map(([k,v])=>{const m=String(v).match(/^(\d+)\D+·\s*(\d+)×/);return k+' '+(m?m[1]+' ('+m[2]+'×)':v);}).join(' · ')
    :Object.entries(plan.weeklySetsPerPart&&typeof plan.weeklySetsPerPart==='object'?plan.weeklySetsPerPart:{}).map(([k,v])=>k+' '+v).join(' · ');
  const rir=plan.rirRange||('RIR '+rec.rir);
  const warm=plan.warmup||'';
  const cardio=plan.cardio||'';
  // Na podstawie wiedzy: wskazówki od AI (tylko z dostarczonych reguł) albo zweryfikowane reguły z planu.
  let know=(Array.isArray(plan.knowledge)?plan.knowledge:[]).filter(k=>k&&k.tip&&k.source).slice(0,3).map(k=>({src:String(k.source),tip:String(k.tip).split(/\s+/).slice(0,24).join(' ')}));
  if(!know.length&&Array.isArray(plan.bookRules))know=plan.bookRules.slice(0,3).map(r=>({src:String(r.cite||r.label||''),tip:String(r.text||'').split(/\s+/).slice(0,18).join(' ')+'…'}));
  const warnings=[].concat(rec.needsReview?['Wymaga uwagi trenera: plan treningowy nie zastępuje konsultacji medycznej.']:[],Array.isArray(plan.warnings)?plan.warnings:[]).filter(Boolean);
  const missing=Array.from(new Set([].concat(Array.isArray(plan.missingData)?plan.missingData:[],pivMissing(act.a)))).filter(Boolean);
  const rest=x=>x?String(x).replace(/s$/,' s'):'';
  return `<div class="piv-prop" data-piv-proposal="1">
    <div class="piv-prop-hd">
      <div><div class="piv-kicker">Propozycja Progress AI</div><div class="piv-title">${e(plan.planName||'Plan treningowy')}</div>
      <div class="piv-prop-sub">Nic nie zostało zapisane. Sprawdź propozycję i przenieś ją do edytora.</div></div>
    </div>
    ${rec.needsReview?`<div class="piv-alert" data-piv-review="1"><b>Wymaga uwagi trenera.</b> Plan treningowy nie zastępuje konsultacji medycznej.</div>`:''}
    <div class="piv-prop-facts">
      <div><span>Metoda</span><b>${e(plan.method||rec.method)} · ${e(String(plan.daysPerWeek||(plan.days||[]).length))} dni</b></div>
      <div><span>Czas</span><b>${e(String(plan.sessionDuration||rec.minutes))} min · ${e(String(plan.weeks||''))} tyg.</b></div>
      <div><span>Intensywność</span><b>${e(rir)}</b></div>
      ${setsTxt?`<div class="piv-prop-wide"><span>Serie na partię tygodniowo</span><b>${e(setsTxt)}</b></div>`:''}
      ${warm?`<div class="piv-prop-wide"><span>Rozgrzewka</span><b>${e(String(warm).slice(0,220))}</b></div>`:''}
      ${cardio?`<div class="piv-prop-wide"><span>Cardio</span><b>${e(String(cardio).slice(0,220))}</b></div>`:''}
    </div>
    <div class="piv-prop-sec"><div class="piv-sum-sub">Dlaczego tak</div><ul data-piv-decisions>${decisions.map(d=>`<li>${e(d)}</li>`).join('')}</ul></div>
    <div class="piv-prop-sec" data-piv-knowledge><div class="piv-sum-sub">Na podstawie wiedzy</div>
      ${know.length?`<ul>${know.map(k=>`<li><b>${e(k.src)}</b> — ${e(k.tip)}</li>`).join('')}</ul>`:'<p class="piv-muted">Brak wystarczającej wiedzy w bibliotece — decyzja wymaga oceny trenera.</p>'}
    </div>
    <div class="piv-prop-sec"><div class="piv-sum-sub">Dni treningowe</div>
      ${(plan.days||[]).map((d,di)=>`<details class="piv-day"${di===0?' open':''}><summary>${e(d.dayName||('Dzień '+(di+1)))}<span>${(d.exercises||[]).length} ćw.</span></summary>
        <table class="piv-ex"><thead><tr><th>Ćwiczenie</th><th>Serie × powt.</th><th>Przerwa</th><th>Alternatywa</th></tr></thead><tbody>
        ${(d.exercises||[]).map(x=>`<tr><td><b>${e(x.name)}</b>${x.notes?`<div class="piv-muted">${e(String(x.notes).slice(0,140))}</div>`:''}</td><td>${e(String(x.sets||''))} × ${e(String(x.reps||''))}${x.rir?` <span class="piv-muted">RIR ${e(String(x.rir))}</span>`:''}</td><td>${e(rest(x.rest))}</td><td>${e(x.alternative||x.alt||'—')}</td></tr>`).join('')}
        </tbody></table></details>`).join('')}
    </div>
    ${warnings.length?`<div class="piv-prop-sec"><div class="piv-sum-sub">Ostrzeżenia</div><ul>${warnings.map(w=>`<li>${e(w)}</li>`).join('')}</ul></div>`:''}
    ${missing.length?`<div class="piv-prop-sec"><div class="piv-sum-sub">Brakujące dane</div><p class="piv-muted" data-piv-prop-missing>${e(missing.join(', '))}</p></div>`:''}
    <div class="piv-actions">
      <button type="button" class="btn btn-primary" data-piv-apply onclick="pivHideProposal(true)">Zastosuj propozycję do edytora</button>
      <button type="button" class="btn btn-ghost" onclick="pivManual()">Edytuj ręcznie</button>
      <button type="button" class="btn btn-ghost" onclick="pivAnotherVersion()">Wygeneruj inną wersję</button>
      <button type="button" class="btn btn-ghost" onclick="pivBackToInterview()">Wróć do wywiadu</button>
    </div>
  </div>`;
}
function pivManual(){
  pivHideProposal(false);
  if(typeof aplCreateBlankPlan==='function')aplCreateBlankPlan();
}

/** Wybór klienta w generatorze otwiera wywiad (chyba że trener go zamknął). */
function pivOnClientPicked(cid){
  if(window._pivSkipAutoOpen||!cid)return;
  pivOpen(cid);
}

window.pivOpen=pivOpen;window.pivClose=pivClose;window.pivGo=pivGo;window.pivPick=pivPick;window.pivToggle=pivToggle;
window.pivSaveAndExit=pivSaveAndExit;window.pivAskAi=pivAskAi;window.pivGenerate=pivGenerate;window.pivAnotherVersion=pivAnotherVersion;
window.pivBackToInterview=pivBackToInterview;window.pivPromptBlock=pivPromptBlock;window.pivAfterGenerate=pivAfterGenerate;
window.pivHideProposal=pivHideProposal;window.pivManual=pivManual;window.pivOnClientPicked=pivOnClientPicked;
window.pivRecommend=pivRecommend;window.pivProfile=pivProfile;window.pivRequiredMissing=pivRequiredMissing;window.pivRedFlags=pivRedFlags;
