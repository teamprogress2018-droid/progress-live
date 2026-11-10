/* Generator planu AI — wywiad przed planem („Poznaj klienta przed planem”).
   Przepływ: wywiad (5 kroków) → Profil do planu (+ maks. 3 pytania AI) → Propozycja Progress AI → edytor.
   Wywiad nie zapisuje ani nie publikuje planu: plan trafia do edytora generatora, gdzie trener go zatwierdza.
   Logika (profil, ryzyko, dobór metody) jest deterministyczna i testowalna bez DOM. Nie diagnozujemy. */
(function(root){
  'use strict';
  const doc=()=>root.document||null;
  const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const txt=x=>String(x==null?'':x).trim();
  const num=x=>{const n=parseFloat(String(x==null?'':x).replace(',','.'));return Number.isFinite(n)?n:null;};

  const GOALS=[
    {v:'redukcja',l:'Redukcja',apl:'redukcja'},
    {v:'masa',l:'Budowa masy',apl:'masa'},
    {v:'sila',l:'Siła',apl:'sila'},
    {v:'sprawnosc',l:'Sprawność',apl:'kondycja'},
    {v:'powrot',l:'Powrót do ruchu',apl:'kondycja'},
    {v:'zdrowie',l:'Zdrowie',apl:'kondycja'},
    {v:'inny',l:'Inny',apl:'kondycja'}
  ];
  const EXP=[{v:'0-3m',l:'0–3 mies.'},{v:'3-12m',l:'3–12 mies.'},{v:'1-3y',l:'1–3 lata'},{v:'3y+',l:'ponad 3 lata'}];
  const DAYS=[{v:'1',l:'1'},{v:'2',l:'2'},{v:'3',l:'3'},{v:'4',l:'4'},{v:'5',l:'5'},{v:'6',l:'6'}];
  const MINUTES=[{v:'30',l:'30 min'},{v:'45',l:'45 min'},{v:'60',l:'60 min'},{v:'75',l:'75 min'},{v:'90',l:'90 min'}];
  const EQUIP=[
    {v:'gym',l:'Pełna siłownia',apl:['Sztanga i wolne ciężary','Maszyny siłowe','Wyciągi i linki','Hantle','Drążek i poręcze']},
    {v:'home',l:'Dom',apl:['Bez sprzętu']},
    {v:'dumbbells',l:'Hantle',apl:['Hantle']},
    {v:'machines',l:'Maszyny',apl:['Maszyny siłowe','Wyciągi i linki']},
    {v:'bands',l:'Gumy',apl:['Bez sprzętu']},
    {v:'other',l:'Inny',apl:[]}
  ];
  const YESNO=[{v:'none',l:'Brak'},{v:'yes',l:'Tak'},{v:'skip',l:'Pomiń'}];
  const JOB=[{v:'sitting',l:'Siedząca',apl:'praca siedząca (biuro, komputer)'},{v:'active',l:'Aktywna',apl:'praca stojąca lub mieszana'},
    {v:'physical',l:'Fizyczna',apl:'praca fizyczna (aktywna)'},{v:'shift',l:'Zmianowa',apl:'praca stojąca lub mieszana'}];
  const STEPS=[{v:'low',l:'< 5 tys. kroków'},{v:'mid',l:'5–8 tys.'},{v:'high',l:'8–12 tys.'},{v:'vhigh',l:'> 12 tys.'}];
  const WEEKDAYS=[{v:'1',l:'Pn'},{v:'2',l:'Wt'},{v:'3',l:'Śr'},{v:'4',l:'Cz'},{v:'5',l:'Pt'},{v:'6',l:'So'},{v:'0',l:'Nd'}];
  const PREFS=[{v:'free',l:'Wolne ciężary'},{v:'machines',l:'Maszyny'},{v:'short',l:'Trening krótki'},{v:'variety',l:'Większa różnorodność'},{v:'simple',l:'Proste, powtarzalne sesje'}];
  const label=(list,v)=>(list.find(x=>x.v===String(v))||{}).l||'';

  /* Kroki: pole z gwiazdką (req) jest niezbędne do bezpiecznej propozycji. Reszta — opcjonalna. */
  const STEP_DEFS=[
    {title:'Cel i priorytety',fields:[
      {k:'goal',t:'chips',l:'Główny cel',opts:GOALS,req:true},
      {k:'goalOther',t:'text',l:'Jaki cel?',ph:'np. przygotowanie do biegu na 10 km',when:d=>d.goal==='inny'},
      {k:'priority',t:'text',l:'Priorytetowa partia lub umiejętność',ph:'np. pośladki, podciąganie, mobilność bioder'},
      {k:'successSign',t:'text',l:'Jak klient pozna, że plan działa?',ph:'np. wejdzie w spodnie sprzed 2 lat, przebiegnie 5 km'},
      {k:'target',t:'text',l:'Termin lub wydarzenie docelowe',ph:'np. wesele 20.06, opcjonalnie'}
    ]},
    {title:'Doświadczenie i aktualna forma',fields:[
      {k:'exp',t:'chips',l:'Staż treningowy',opts:EXP,req:true},
      {k:'recent',t:'text',l:'Co trenował ostatnio i jak regularnie?',ph:'np. siłownia 2× w tyg. do wakacji, potem przerwa'},
      {k:'days',t:'chips',l:'Ile treningów tygodniowo realnie wykona?',opts:DAYS,req:true},
      {k:'minutes',t:'chips',l:'Ile minut ma na jedną sesję?',opts:MINUTES,req:true},
      {k:'prefType',t:'text',l:'Preferowany typ treningu',ph:'np. siłowy, obwodowy, z elementami cardio'},
      {k:'dislikes',t:'text',l:'Ćwiczenia lub sprzęt, których nie lubi',ph:'np. burpees, bieżnia, martwy ciąg'},
      {k:'equipment',t:'multi',l:'Dostępny sprzęt',opts:EQUIP,req:true},
      {k:'equipmentOther',t:'text',l:'Jaki inny sprzęt?',ph:'np. kettlebell 16 kg, TRX',when:d=>(d.equipment||[]).includes('other')}
    ]},
    {title:'Zdrowie i ograniczenia',fields:[
      {k:'medical',t:'chips',l:'Czy lekarz lub fizjoterapeuta zalecił ograniczenia?',opts:YESNO,req:true},
      {k:'medicalText',t:'text',l:'Jakie zalecenia?',ph:'np. bez dźwigania nad głową do marca',when:d=>d.medical==='yes'},
      {k:'pain',t:'chips',l:'Ból, kontuzje, operacje, obszary wymagające ostrożności',opts:YESNO,req:true},
      {k:'painText',t:'text',l:'Co i gdzie?',ph:'np. kolano prawe, operacja łąkotki 2023',when:d=>d.pain==='yes'},
      {k:'painMoves',t:'text',l:'Ruchy, które wywołują ból lub dyskomfort',ph:'np. głęboki przysiad, wyciskanie nad głowę',when:d=>d.pain==='yes'||d.medical==='yes'}
    ]},
    {title:'Regeneracja i styl życia',fields:[
      {k:'sleepH',t:'number',l:'Sen — ile godzin?',ph:'np. 6.5',min:3,max:12,step:0.5},
      {k:'sleepQ',t:'scale',l:'Jakość snu (1 — bardzo słaba, 5 — świetna)'},
      {k:'stress',t:'scale',l:'Stres (1 — niski, 5 — bardzo wysoki)'},
      {k:'job',t:'chips',l:'Praca',opts:JOB},
      {k:'steps',t:'chips',l:'Codzienna aktywność',opts:STEPS},
      {k:'cardio',t:'text',l:'Cardio lub inne sporty',ph:'np. rower 2× w tyg., piłka w niedzielę'},
      {k:'prefDays',t:'multi',l:'Preferowane dni treningowe',opts:WEEKDAYS}
    ]},
    {title:'Dane startowe i preferencje',fields:[
      {k:'height',t:'number',l:'Wzrost (cm)',ph:'np. 178',min:120,max:230},
      {k:'weight',t:'number',l:'Masa ciała (kg)',ph:'np. 82',min:30,max:300,step:0.1},
      {k:'circ',t:'text',l:'Obwody (opcjonalnie)',ph:'np. talia 92, biodra 101'},
      {k:'strength',t:'text',l:'Ostatnie wyniki siłowe, jeśli klient je zna',ph:'np. przysiad 80×5, podciąganie 3×'},
      {k:'prefs',t:'multi',l:'Preferencje',opts:PREFS},
      {k:'technique',t:'scale',l:'Pewność techniki podstawowych ćwiczeń (1 — nowa, 5 — pewna)'},
      {k:'extra',t:'textarea',l:'Co trener powinien jeszcze wiedzieć, zanim ułoży plan?',ph:'Wszystko, co zmienia dobór planu'}
    ]}
  ];

  /* Słowa, przy których plan oznaczamy jako wymagający uwagi trenera (bez diagnozowania). */
  const RED_FLAGS=/operac|zabieg|drętw|mrowien|promieniuj|klatk|serc|zawrot|omdle|duszno|ostry|nasila|w nocy|ciąż|nadciśn|cukrzy|przepuklin|dyskopat|zwyrodn|endoprotez|zerwan|złaman/i;

  function emptyInterview(){
    return {v:1,status:'draft',step:1,goal:'',goalOther:'',priority:'',successSign:'',target:'',exp:'',recent:'',days:'',minutes:'',
      prefType:'',dislikes:'',equipment:[],equipmentOther:'',medical:'',medicalText:'',pain:'',painText:'',painMoves:'',
      sleepH:'',sleepQ:'',stress:'',job:'',steps:'',cardio:'',prefDays:[],height:'',weight:'',circ:'',strength:'',prefs:[],technique:'',extra:'',
      aiQuestions:[],updatedAt:''};
  }

  /** Dane z profilu klienta uzupełniają wywiad; zapisany wywiad ma pierwszeństwo (trener mógł je poprawić). */
  function prefill(client,saved){
    const c=client||{},d=emptyInterview();
    const goalMap={masa:'masa',sila:'sila',redukcja:'redukcja',kondycja:'sprawnosc',atletyzm:'sprawnosc',rehab:'powrot',zdrowie:'zdrowie'};
    if(goalMap[c.goal])d.goal=goalMap[c.goal];
    const lvl={poczatkujacy:'0-3m',sredni:'1-3y',zaawansowany:'3y+'};
    if(lvl[c.level])d.exp=lvl[c.level];
    const freq=parseInt(c.trainingFreq,10);
    if(freq>=1&&freq<=6)d.days=String(freq);
    const inj=txt(c.injuries||c.limitations||'');
    if(inj&&!/^(brak|nie|-|—|none)$/i.test(inj)){d.pain='yes';d.painText=inj;}
    if(num(c.weight))d.weight=String(num(c.weight));
    if(num(c.height))d.height=String(num(c.height));
    const eq=Array.isArray(c.availableEquipment)?c.availableEquipment.join(' '):String(c.equipment||'');
    if(/sztang|wolne|siłown|gym/i.test(eq))d.equipment.push('gym');
    else{
      if(/hantl/i.test(eq))d.equipment.push('dumbbells');
      if(/maszyn|wyciąg/i.test(eq))d.equipment.push('machines');
      if(/bez sprzętu|dom/i.test(eq))d.equipment.push('home');
    }
    if(Array.isArray(c.preferredWeekdays))d.prefDays=c.preferredWeekdays.map(String);
    if(c.activityLevel==='sedentary')d.steps='low';else if(c.activityLevel==='active')d.steps='high';
    if(saved&&typeof saved==='object'){
      Object.keys(d).forEach(k=>{if(saved[k]!==undefined&&saved[k]!==null&&saved[k]!=='')d[k]=Array.isArray(d[k])?(Array.isArray(saved[k])?saved[k].slice():d[k]):saved[k];});
      if(Array.isArray(saved.aiQuestions))d.aiQuestions=saved.aiQuestions.map(q=>({q:txt(q.q),why:txt(q.why),a:txt(q.a)})).slice(0,3);
    }
    return d;
  }

  function visibleFields(step,d){return STEP_DEFS[step-1].fields.filter(f=>!f.when||f.when(d));}

  function stepErrors(d,step){
    const out=[];
    visibleFields(step,d).forEach(f=>{
      if(!f.req)return;
      const v=d[f.k];
      if(Array.isArray(v)?!v.length:!txt(v))out.push(f.l);
    });
    if(step===3){
      if(d.medical==='yes'&&!txt(d.medicalText))out.push('Opisz zalecenia lekarza lub fizjoterapeuty');
      if(d.pain==='yes'&&!txt(d.painText))out.push('Opisz, co boli lub wymaga ostrożności');
    }
    return out;
  }

  function levelOf(d){
    if(d.exp==='0-3m')return'poczatkujacy';
    if(d.exp==='3-12m')return num(d.technique)>=4?'sredni':'poczatkujacy';
    if(d.exp==='1-3y')return'sredni';
    if(d.exp==='3y+')return num(d.technique)!=null&&num(d.technique)<=2?'sredni':'zaawansowany';
    return'';
  }

  /** Realizacja poprzednich planów: odbyte / zaplanowane sesje z ostatnich 8 tygodni. */
  function attendance(clientId,sessions,now){
    const list=(sessions||[]).filter(s=>s&&s.clientId===clientId&&s.date);
    const t=(now||new Date()).getTime(),from=t-56*86400000;
    let planned=0,done=0;
    list.forEach(s=>{
      const ts=new Date(String(s.date).slice(0,10)+'T12:00:00').getTime();
      if(!(ts>=from&&ts<=t))return;
      if(s.source==='planned'){planned++;if(s.status==='done'||s.done)done++;}
      else if(s.source!=='garmin')done++;
    });
    if(planned<3)return null;
    return{planned,done,rate:Math.min(1,done/planned)};
  }

  function medicalFlags(d){
    const flags=[];
    if(d.medical==='yes')flags.push('Zalecenia lekarza lub fizjoterapeuty: '+(txt(d.medicalText)||'bez szczegółów'));
    if(d.pain==='yes'&&RED_FLAGS.test([d.painText,d.painMoves].join(' ')))flags.push('Zgłoszone objawy wymagają oceny trenera przed startem');
    return flags;
  }

  function overloadRisk(d){
    const why=[];
    const sh=num(d.sleepH),sq=num(d.sleepQ),st=num(d.stress);
    if((sh!=null&&sh<6.5)||(sq!=null&&sq<=2))why.push('słaby sen');
    if(st!=null&&st>=4)why.push('wysoki stres');
    if(d.job==='physical'||d.job==='shift')why.push(d.job==='shift'?'praca zmianowa':'praca fizyczna');
    if(d.pain==='yes'||d.medical==='yes')why.push('ból lub ograniczenia');
    if(levelOf(d)==='poczatkujacy'&&(parseInt(d.days,10)||0)>=5)why.push('dużo sesji przy krótkim stażu');
    if(/codzienn|maraton|triathlon|[4-7]\s*[×x]\s*w\s*tyg|piłk|mecz/i.test(d.cardio||''))why.push('dużo innych sportów');
    const level=why.length>=2?'podwyższone':why.length===1?'umiarkowane':'niskie';
    return{level,why};
  }

  /** Braki, które realnie zmieniają dobór planu (pokazywane trenerowi i jako podstawa pytań AI). */
  function missingData(d){
    const m=[];
    if(!d.exp)m.push('staż treningowy');
    if(!d.days)m.push('realna liczba treningów w tygodniu');
    if(!d.minutes)m.push('czas jednej sesji');
    if(!(d.equipment||[]).length)m.push('dostępny sprzęt');
    if(d.medical==='skip'||!d.medical)m.push('informacja o zaleceniach lekarza lub fizjoterapeuty');
    if(d.pain==='skip'||!d.pain)m.push('historia urazów i bólu');
    if(d.pain==='yes'&&!txt(d.painMoves))m.push('ruchy wywołujące ból');
    if(!txt(d.sleepH)&&!txt(d.sleepQ))m.push('sen');
    if(!txt(d.stress))m.push('poziom stresu');
    if(!txt(d.weight))m.push('masa ciała');
    if(!txt(d.technique)&&(d.exp==='3-12m'||d.exp==='3y+'))m.push('pewność techniki');
    return m;
  }

  /**
   * Rekomendacja przed generowaniem. Reguły:
   * 2–3 dni lub początkujący → FBW; 4 dni → Upper/Lower; PPL tylko 6 dni (albo 5 dni u zaawansowanego) i nie dla początkujących;
   * słaby sen / wysoki stres → mniejsza objętość i zachowawcze RIR; słaba frekwencja → mniej dni, krótsze sesje.
   */
  function recommend(d,ctx){
    ctx=ctx||{};
    const reasons=[],warnings=[];
    const level=levelOf(d)||'poczatkujacy';
    const lvlWord={poczatkujacy:'początkujący',sredni:'średnio zaawansowany',zaawansowany:'zaawansowany'}[level];
    let days=Math.max(1,Math.min(6,parseInt(d.days,10)||3));
    let minutes=parseInt(d.minutes,10)||60;
    const att=ctx.attendance||null;
    if(att&&att.rate<0.6){
      const nd=Math.max(2,days-1);
      if(nd<days){reasons.push('Zmniejszono liczbę dni z '+days+' do '+nd+', bo w ostatnich 8 tygodniach odbyło się '+att.done+' z '+att.planned+' zaplanowanych treningów.');days=nd;}
      if(minutes>45){minutes=45;reasons.push('Krótsze sesje (45 min) i prostsza struktura ze względu na słabą frekwencję.');}
    }
    const risk=overloadRisk(d);
    const pain=d.pain==='yes'||d.medical==='yes';
    let method;
    if(days<=3){
      method='FBW';
      reasons.push('Wybrano FBW '+days+'×/tydzień, ponieważ klient ma '+days+' '+(days===1?'dostępny dzień':'dostępne dni')+(level==='poczatkujacy'?' i jest początkujący':'')+' — każda partia pracuje kilka razy w tygodniu.');
    }else if(days===4){
      method='Upper/Lower';
      reasons.push('Wybrano Upper/Lower 4×/tydzień: każda partia 2× w tygodniu przy krótszych sesjach niż FBW.');
    }else if(level==='poczatkujacy'||risk.level==='podwyższone'){
      method=days>=5?'Upper/Lower':'FBW';
      reasons.push('Bez PPL mimo '+days+' dni: '+(level==='poczatkujacy'?'krótki staż':'podwyższone ryzyko przeciążenia')+' — Upper/Lower daje prostszą strukturę i więcej odpoczynku między sesjami.');
    }else if(days===6||(days===5&&level==='zaawansowany')){
      method='PPL';
      reasons.push('PPL uzasadnione: '+days+' dni w tygodniu i poziom '+lvlWord+' — każda partia nadal 2× w tygodniu.');
    }else{
      method='Upper/Lower';
      reasons.push('Upper/Lower przy '+days+' dniach: PPL wymagałoby 6 sesji, żeby utrzymać częstotliwość 2× na partię.');
    }
    // Objętość tygodniowa na partię (serie robocze) i intensywność.
    // Punkt wyjścia z książek: początkujący ok. 10–12 serii, ogólnie 10–20 (Helms, Schoenfeld); start w dolnej części zakresu.
    let lo={poczatkujacy:8,sredni:10,zaawansowany:12}[level],hi={poczatkujacy:12,sredni:16,zaawansowany:20}[level];
    let rir={poczatkujacy:'3',sredni:'2–3',zaawansowany:'1–2'}[level];
    let rpe={poczatkujacy:'6–7',sredni:'7–8',zaawansowany:'8–9'}[level];
    const recoveryLow=risk.why.includes('słaby sen')||risk.why.includes('wysoki stres');
    if(recoveryLow){
      lo=Math.max(4,lo-2);hi=Math.max(lo+2,hi-4);
      rir=level==='zaawansowany'?'2–3':'3–4';rpe=level==='zaawansowany'?'7–8':'6–7';
      reasons.push('Objętość startowa jest niska–umiarkowana ('+lo+'–'+hi+' serii na partię tygodniowo) ze względu na '+risk.why.filter(w=>w==='słaby sen'||w==='wysoki stres').join(' i ')+'; RIR '+rir+'.');
    }else{
      reasons.push('Objętość '+lo+'–'+hi+' serii na partię tygodniowo i RIR '+rir+' — dopasowane do poziomu: '+lvlWord+'.');
    }
    if(pain){
      reasons.push('Przy zgłoszonym '+(d.pain==='yes'?'dyskomforcie ('+txt(d.painText).slice(0,60)+')':'zaleceniu specjalisty')+' — stabilne warianty (maszyny, wyciągi), kontrolowany zakres ruchu i bez ćwiczeń wywołujących ból'+(txt(d.painMoves)?' ('+txt(d.painMoves).slice(0,60)+')':'')+'.');
      warnings.push('Plan treningowy nie zastępuje konsultacji medycznej. Przy nasilającym się bólu skieruj klienta do lekarza lub fizjoterapeuty.');
    }
    const flags=medicalFlags(d);
    flags.forEach(f=>warnings.push(f));
    if(risk.level==='podwyższone')warnings.push('Ryzyko przeciążenia podwyższone ('+risk.why.join(', ')+') — obserwuj regenerację w pierwszych 2 tygodniach.');
    // Długość bloku: termin docelowy skraca blok; początkujący — krótszy pierwszy blok.
    let weeks=level==='poczatkujacy'?6:8;
    const tw=String(d.target||'').match(/(\d{1,2})\s*(tyg|tydz)/i);
    if(tw)weeks=Math.max(4,Math.min(12,parseInt(tw[1],10)));
    const weeksOpt=[4,6,8,12].reduce((a,b)=>Math.abs(b-weeks)<Math.abs(a-weeks)?b:a,8);
    const progression=level==='poczatkujacy'||recoveryLow?'double':(d.goal==='sila'?'wave':'double');
    const goal=(GOALS.find(g=>g.v===d.goal)||{}).apl||'kondycja';
    const cardioNeeded=['redukcja','sprawnosc','zdrowie','powrot'].includes(d.goal)||d.steps==='low';
    const cardio=cardioNeeded?(d.steps==='low'?'2–3× 20–30 min spokojnego cardio (strefa 2) i stopniowe zwiększanie kroków':'1–2× 20–30 min spokojnego cardio po treningu lub w dni wolne'):'';
    if(cardio)reasons.push('Cardio: '+cardio+' — '+(d.steps==='low'?'mała codzienna aktywność':'wspiera cel ('+label(GOALS,d.goal).toLowerCase()+')')+'.');
    if(minutes<45)reasons.push('Sesje '+minutes+' min: mniej ćwiczeń, superserie antagonistyczne zamiast dodatkowych dni.');
    return{method,days,minutes,weeks:String(weeksOpt),level,goal,progression,rir,rpe,setsLo:lo,setsHi:hi,
      warmup:'5–8 min: rozgrzewka ogólna + 2–3 ćwiczenia mobilizacyjne pod pierwsze ćwiczenie sesji',cardio,
      reasons,warnings,risk,needsTrainerReview:flags.length>0,missing:missingData(d)};
  }

  /** Karta „Profil do planu”. */
  function profile(d,rec){
    const r=rec||recommend(d);
    const eq=(d.equipment||[]).map(v=>label(EQUIP,v)).filter(Boolean);
    if((d.equipment||[]).includes('other')&&txt(d.equipmentOther))eq.push(txt(d.equipmentOther));
    const goal=d.goal==='inny'&&txt(d.goalOther)?txt(d.goalOther):label(GOALS,d.goal);
    const limits=[];
    if(d.medical==='yes')limits.push('zalecenia: '+(txt(d.medicalText)||'bez szczegółów'));
    if(d.pain==='yes')limits.push(txt(d.painText)+(txt(d.painMoves)?' — dyskomfort: '+txt(d.painMoves):''));
    const recovery=[txt(d.sleepH)?'sen '+txt(d.sleepH)+' h':'',txt(d.sleepQ)?'jakość snu '+txt(d.sleepQ)+'/5':'',txt(d.stress)?'stres '+txt(d.stress)+'/5':''].filter(Boolean).join(', ');
    return [
      {k:'goal',l:'Cel',v:[goal,txt(d.priority)?'priorytet: '+txt(d.priority):''].filter(Boolean).join(' · ')||'—'},
      {k:'level',l:'Poziom',v:{poczatkujacy:'początkujący',sredni:'średnio zaawansowany',zaawansowany:'zaawansowany'}[r.level]+(d.exp?' ('+label(EXP,d.exp)+')':'')},
      {k:'avail',l:'Realna dostępność',v:(d.days&&d.minutes)?d.days+' × '+d.minutes+' min':'—'},
      {k:'equip',l:'Sprzęt',v:eq.join(', ')||'—'},
      {k:'limits',l:'Ograniczenia',v:limits.join('; ')||(d.pain==='none'&&d.medical==='none'?'brak zgłoszonych':'nie podano')},
      {k:'recovery',l:'Regeneracja',v:recovery||'nie podano'},
      {k:'risk',l:'Ryzyko przeciążenia',v:r.risk.level+(r.risk.why.length?' ('+r.risk.why.join(', ')+')':''),tone:r.risk.level==='podwyższone'?'warn':r.risk.level==='umiarkowane'?'watch':'ok'},
      {k:'missing',l:'Brakujące dane',v:r.missing.length?r.missing.join(', '):'brak',tone:r.missing.length?'watch':'ok'}
    ];
  }

  /** Pytania zapasowe (bez AI): tylko braki, które zmieniają dobór planu. Maks. 3. */
  function fallbackQuestions(d){
    const q=[];
    if(d.pain==='skip'||!d.pain)q.push({q:'Czy klient miał w ostatnich 2 latach kontuzję, operację lub ból, który wraca przy ćwiczeniach?',why:'Decyduje o doborze wariantów ćwiczeń i zakresie ruchu.'});
    if(d.pain==='yes'&&!txt(d.painMoves))q.push({q:'Przy jakich ruchach pojawia się dyskomfort i jak jest silny (0–10)?',why:'Pozwala zastąpić tylko problematyczne ćwiczenia, a nie całą partię.'});
    if(d.medical==='skip'||!d.medical)q.push({q:'Czy lekarz lub fizjoterapeuta zalecił jakiekolwiek ograniczenia aktywności?',why:'Bez tej informacji plan musi być bardziej zachowawczy.'});
    if(!d.exp)q.push({q:'Jak długo i jak regularnie klient trenował siłowo?',why:'Ustala objętość startową i metodę planu.'});
    if(!txt(d.sleepH)&&!txt(d.stress))q.push({q:'Ile klient średnio śpi i jak ocenia stres w ostatnich tygodniach?',why:'Słaba regeneracja obniża objętość startową.'});
    return q.slice(0,3);
  }

  /** Blok dla promptu generatora: wywiad + decyzje algorytmu (mają pierwszeństwo przed domyślnymi ustawieniami). */
  function notesBlock(d,rec){
    const r=rec||recommend(d);
    const line=(l,v)=>txt(v)?'- '+l+': '+txt(v):'';
    const eq=(d.equipment||[]).map(v=>label(EQUIP,v)).concat((d.equipment||[]).includes('other')?[txt(d.equipmentOther)]:[]).filter(Boolean).join(', ');
    const qa=(d.aiQuestions||[]).filter(x=>txt(x.a)).map(x=>'- '+x.q+' → '+x.a);
    return [
      '=== WYWIAD TRENERA Z KLIENTEM (podstawa planu — plan ma wynikać z tych danych, nie z szablonu) ===',
      line('Cel',d.goal==='inny'?d.goalOther:label(GOALS,d.goal)),
      line('Priorytet',d.priority),line('Po czym klient pozna, że plan działa',d.successSign),line('Termin / wydarzenie',d.target),
      line('Staż',label(EXP,d.exp)),line('Ostatnie treningi',d.recent),line('Realna dostępność',d.days&&d.minutes?d.days+'× w tygodniu po '+d.minutes+' min':''),
      line('Preferowany typ treningu',d.prefType),line('NIE LUBI (nie dawaj tych ćwiczeń ani sprzętu)',d.dislikes),line('Sprzęt',eq),
      line('Zalecenia specjalisty',d.medical==='yes'?d.medicalText:(d.medical==='none'?'brak':'')),
      line('Ból / kontuzje',d.pain==='yes'?d.painText:(d.pain==='none'?'brak':'')),line('Ruchy z dyskomfortem (omijaj albo zastąp bezpieczniejszym wariantem)',d.painMoves),
      line('Sen',[txt(d.sleepH)?d.sleepH+' h':'',txt(d.sleepQ)?'jakość '+d.sleepQ+'/5':''].filter(Boolean).join(', ')),line('Stres',txt(d.stress)?d.stress+'/5':''),
      line('Praca',label(JOB,d.job)),line('Codzienna aktywność',label(STEPS,d.steps)),line('Cardio / inne sporty',d.cardio),
      line('Preferowane dni',(d.prefDays||[]).map(v=>label(WEEKDAYS,v)).join(', ')),
      line('Wyniki siłowe',d.strength),line('Obwody',d.circ),line('Preferencje',(d.prefs||[]).map(v=>label(PREFS,v)).join(', ')),
      line('Pewność techniki',txt(d.technique)?d.technique+'/5':''),line('Uwagi trenera',d.extra),
      qa.length?'Odpowiedzi na dodatkowe pytania:\n'+qa.join('\n'):'',
      '=== DECYZJE ALGORYTMU PROGRESS (obowiązkowe; uzasadnij je w "rationale.reasoning") ===',
      '- Metoda: '+r.method+', '+r.days+' dni, sesja '+r.minutes+' min, '+r.weeks+' tyg.',
      '- Objętość startowa: '+r.setsLo+'–'+r.setsHi+' serii roboczych na główną partię tygodniowo (ma pierwszeństwo przed domyślną objętością aplikacji).',
      '- Intensywność: RIR '+r.rir+' (RPE '+r.rpe+'); bez serii do upadku na starcie.',
      '- Rozgrzewka: '+r.warmup+'.',
      r.cardio?'- Cardio: '+r.cardio+'.':'',
      '- Dla każdego ćwiczenia dodaj pole "alt" z jednym bezpieczniejszym lub prostszym zamiennikiem z tej samej partii, dostępnym przy podanym sprzęcie.',
      '- Każde ćwiczenie ma w "notes" jedną krótką wskazówkę techniczną.',
      '- Nie stawiaj diagnoz i nie dawaj zaleceń medycznych. Jeśli wiedza z książek nie rozstrzyga decyzji, zapisz w "rationale.uncertainties": „Brak wystarczającej wiedzy w bibliotece — decyzja wymaga oceny trenera.”',
      ...r.reasons.map(x=>'- Uzasadnienie: '+x)
    ].filter(Boolean).join('\n');
  }

  /* ───────────── Stan sesji i zapis ───────────── */
  const S={clientId:null,data:null,state:'pick',step:1,rec:null,proposal:null,askBusy:false,genError:null,variant:0};
  root._plivSession=null;

  function client(){return(root.CL||[]).find(c=>c&&c.id===S.clientId)||null;}
  function refreshRec(){
    const c=client();
    S.rec=recommend(S.data,{attendance:c?attendance(c.id,root.SE,new Date()):null});
    return S.rec;
  }
  function save(status){
    const c=client();if(!c||!S.data)return;
    S.data.updatedAt=new Date().toISOString();
    if(status)S.data.status=status;
    S.data.step=S.step;
    c.planInterview=JSON.parse(JSON.stringify(S.data));
    if(typeof root.persistById==='function')root.persistById('clients',c);
  }

  function start(clientId,opts){
    opts=opts||{};
    const c=(root.CL||[]).find(x=>x&&x.id===clientId);
    if(!c){S.clientId=null;S.data=null;S.state='pick';render();return;}
    S.clientId=c.id;
    S.data=prefill(c,c.planInterview);
    S.step=Math.max(1,Math.min(5,parseInt(opts.step||S.data.step,10)||1));
    S.state=opts.state||(S.data.status==='done'?'summary':'interview');
    S.proposal=null;S.genError=null;
    refreshRec();
    root._plivSession={clientId:c.id};
    const sel=doc()&&doc().getElementById('apl-client');
    if(sel&&sel.value!==c.id){sel.value=c.id;if(typeof root.aplFillFromClient==='function'){S._filling=true;try{root.aplFillFromClient();}finally{S._filling=false;}}}
    render();
  }
  function exit(toManual){
    S.state=toManual?'manual':'pick';S.proposal=null;root._plivSession=toManual?null:root._plivSession;
    render();
  }

  /* ───────────── Formularz: odczyt i render ───────────── */
  function readStep(){
    const d=doc();if(!d||!S.data)return;
    visibleFields(S.step,S.data).forEach(f=>{
      if(f.t==='chips'||f.t==='multi'||f.t==='scale')return; // ustawiane kliknięciem
      const el=d.getElementById('pliv-f-'+f.k);if(el)S.data[f.k]=el.value;
    });
  }
  function pick(k,v){
    readStep();
    const f=STEP_DEFS.flatMap(s=>s.fields).find(x=>x.k===k);if(!f)return;
    if(f.t==='multi'){
      const arr=Array.isArray(S.data[k])?S.data[k]:[];
      S.data[k]=arr.includes(v)?arr.filter(x=>x!==v):arr.concat([v]);
      if(k==='equipment'&&v==='gym'&&S.data[k].includes('gym'))S.data[k]=S.data[k].filter(x=>x==='gym'||x==='other');
    }else S.data[k]=String(S.data[k])===String(v)?'':String(v);
    refreshRec();render();
  }
  function fieldHTML(f){
    const v=S.data[f.k];
    const req=f.req?' <span class="pliv-req" title="Potrzebne do bezpiecznej propozycji">*</span>':'';
    const head=`<label class="pliv-lbl" for="pliv-f-${f.k}">${esc(f.l)}${req}</label>`;
    if(f.t==='chips'||f.t==='multi'){
      const sel=f.t==='multi'?(Array.isArray(v)?v:[]):[String(v)];
      return `<div class="pliv-field" data-pliv-field="${f.k}">${head}<div class="pliv-chips" role="group" aria-label="${esc(f.l)}">${f.opts.map(o=>`<button type="button" class="pliv-chip${sel.includes(o.v)?' is-on':''}" aria-pressed="${sel.includes(o.v)}" onclick="plivPick('${f.k}','${o.v}')">${esc(o.l)}</button>`).join('')}</div></div>`;
    }
    if(f.t==='scale'){
      return `<div class="pliv-field" data-pliv-field="${f.k}">${head}<div class="pliv-chips pliv-scale">${[1,2,3,4,5].map(n=>`<button type="button" class="pliv-chip${String(v)===String(n)?' is-on':''}" aria-pressed="${String(v)===String(n)}" onclick="plivPick('${f.k}','${n}')">${n}</button>`).join('')}</div></div>`;
    }
    if(f.t==='textarea')return `<div class="pliv-field">${head}<textarea id="pliv-f-${f.k}" class="form-input pliv-input" rows="3" placeholder="${esc(f.ph||'')}">${esc(v)}</textarea></div>`;
    const type=f.t==='number'?'number':'text';
    const extra=f.t==='number'?` inputmode="decimal"${f.min!=null?` min="${f.min}"`:''}${f.max!=null?` max="${f.max}"`:''}${f.step?` step="${f.step}"`:''}`:'';
    return `<div class="pliv-field">${head}<input id="pliv-f-${f.k}" type="${type}" class="form-input pliv-input" value="${esc(v)}" placeholder="${esc(f.ph||'')}"${extra}></div>`;
  }
  function medicalNoticeHTML(){
    const d=S.data;if(!d||(d.pain!=='yes'&&d.medical!=='yes'))return'';
    const strong=medicalFlags(d).length>0;
    return `<div class="pliv-medical${strong?' is-strong':''}" data-pliv-medical role="note"><b>Plan treningowy nie zastępuje konsultacji medycznej.</b> ${strong?'Plan zostanie oznaczony jako wymagający uwagi trenera.':'Uwzględnimy to w doborze ćwiczeń — bez diagnozowania.'}</div>`;
  }
  function profileHTML(compact){
    const rows=profile(S.data,S.rec);
    return `<div class="pliv-profile${compact?' is-compact':''}" data-pliv-profile>
      <div class="pliv-card-kicker">Profil do planu</div>
      <dl class="pliv-rows">${rows.map(r=>`<div class="pliv-row${r.tone?' is-'+r.tone:''}" data-pliv-row="${r.k}"><dt>${esc(r.l)}</dt><dd>${esc(r.v)}</dd></div>`).join('')}</dl>
    </div>`;
  }
  function interviewHTML(){
    const def=STEP_DEFS[S.step-1];
    const c=client();
    const bar=STEP_DEFS.map((s,i)=>`<button type="button" class="pliv-seg${i+1<S.step?' is-done':''}${i+1===S.step?' is-now':''}" onclick="plivGo(${i+1})" aria-label="Krok ${i+1}: ${esc(s.title)}"></button>`).join('');
    return `<div class="pliv-grid">
      <section class="pliv-card pliv-wizard" data-pliv-step="${S.step}">
        <div class="pliv-head">
          <div><div class="pliv-card-kicker">Poznaj klienta przed planem</div><h2 class="pliv-title">${esc(c?c.name:'Klient')}</h2></div>
          <button type="button" class="pliv-link" onclick="plivSaveLater()">Zapisz wywiad i wróć później</button>
        </div>
        <div class="pliv-bar" aria-label="Postęp wywiadu">${bar}</div>
        <div class="pliv-step-lbl">Krok ${S.step} z ${STEP_DEFS.length} · ${esc(def.title)}</div>
        ${S.step===1?'<div class="pliv-hint">Dane z profilu klienta są już wpisane — popraw je, jeśli się zmieniły. Pola z * są potrzebne do bezpiecznej propozycji.</div>':''}
        <div class="pliv-fields">${visibleFields(S.step,S.data).map(fieldHTML).join('')}</div>
        ${S.step===3?medicalNoticeHTML():''}
        <div class="pliv-errors" id="pliv-errors" role="alert"></div>
        <div class="pliv-nav">
          ${S.step>1?'<button type="button" class="btn btn-ghost" onclick="plivBack()">Wstecz</button>':'<span></span>'}
          <button type="button" class="btn btn-primary" onclick="plivNext()">${S.step<STEP_DEFS.length?'Dalej':'Podsumowanie'}</button>
        </div>
      </section>
      <aside class="pliv-side">${profileHTML(true)}</aside>
    </div>`;
  }
  function recHTML(){
    const r=S.rec;
    return `<div class="pliv-rec" data-pliv-rec>
      <div class="pliv-card-kicker">Wstępna rekomendacja</div>
      <div class="pliv-rec-main"><b>${esc(r.method)}</b> · ${r.days}× ${r.minutes} min · ${esc(r.weeks)} tyg. · RIR ${esc(r.rir)} · ${r.setsLo}–${r.setsHi} serii/partię/tydz.</div>
      <ul class="pliv-why">${r.reasons.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    </div>`;
  }
  function questionsHTML(){
    const qs=S.data.aiQuestions||[];
    if(S.askBusy)return '<div class="pliv-ask is-busy" data-pliv-ask>Progress AI sprawdza, czego brakuje do wyboru planu…</div>';
    if(!qs.length)return S.askDone?'<div class="pliv-ask" data-pliv-ask>Progress AI nie ma dodatkowych pytań — dane wystarczą do propozycji.</div>':'';
    return `<div class="pliv-ask" data-pliv-ask>
      <div class="pliv-card-kicker">Dodatkowe pytania (${qs.length})</div>
      ${qs.map((q,i)=>`<div class="pliv-field"><label class="pliv-lbl" for="pliv-q-${i}">${esc(q.q)}</label>${q.why?`<div class="pliv-hint">${esc(q.why)}</div>`:''}<input id="pliv-q-${i}" class="form-input pliv-input" value="${esc(q.a||'')}" onchange="plivAnswer(${i},this.value)"></div>`).join('')}
    </div>`;
  }
  function summaryHTML(){
    const c=client();
    return `<section class="pliv-card pliv-summary" data-pliv-summary>
      <div class="pliv-head"><div><div class="pliv-card-kicker">Wywiad gotowy</div><h2 class="pliv-title">${esc(c?c.name:'Klient')}</h2></div>
        <button type="button" class="pliv-link" onclick="plivSaveLater()">Zapisz i wróć później</button></div>
      ${medicalNoticeHTML()}
      ${profileHTML(false)}
      ${recHTML()}
      ${questionsHTML()}
      <div class="pliv-actions">
        <button type="button" class="btn btn-ghost" onclick="plivEdit()">Edytuj wywiad</button>
        <button type="button" class="btn btn-ghost" onclick="plivAsk()" ${S.askBusy?'disabled':''}>Zadaj AI dodatkowe pytania</button>
        <button type="button" class="btn btn-primary" data-pliv-generate onclick="plivGenerate()">Wygeneruj propozycję planu</button>
      </div>
    </section>`;
  }
  function pickHTML(){
    const list=(root.CL||[]).filter(c=>c&&c.status!=='archived').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pl'));
    return `<section class="pliv-card pliv-pick" data-pliv-pick>
      <div class="pliv-card-kicker">Generator planu AI</div>
      <h2 class="pliv-title">Poznaj klienta przed planem</h2>
      <p class="pliv-hint">Krótki wywiad (5 kroków) — plan powstanie z danych klienta i wiedzy z Twoich książek, nie z szablonu.</p>
      <div class="pliv-pick-row">
        <select class="form-select" id="pliv-client" aria-label="Klient"><option value="">Wybierz klienta…</option>${list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.planInterview&&c.planInterview.status?' · wywiad '+(c.planInterview.status==='done'?'gotowy':'zaczęty'):''}</option>`).join('')}</select>
        <button type="button" class="btn btn-primary" onclick="plivStartFromPick()">Rozpocznij wywiad</button>
      </div>
      <button type="button" class="pliv-link" onclick="plivManual()">Bez klienta — parametry ręczne</button>
    </section>`;
  }

  /* ───────────── Propozycja ───────────── */
  function rirRange(plan){
    const wk=plan&&(plan.currentWeek||(plan.weekKeys||[])[0]);
    const vals=[];
    (plan.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>{const w=(wk&&e[wk])||{};const n=parseFloat(w.rir!=null&&w.rir!==''?w.rir:e.rir);if(Number.isFinite(n)&&n<=6)vals.push(n);}));
    if(!vals.length)return'';
    const lo=Math.min(...vals),hi=Math.max(...vals);
    return lo===hi?String(lo):lo+'–'+hi;
  }
  function altFor(e,used){
    if(txt(e.alt))return txt(String(e.alt).split(',')[0]);
    const list=typeof root.altsForExercise==='function'?root.altsForExercise(e.name)||[]:[];
    return txt(list.find(n=>!used.has(String(n).toLowerCase()))||'');
  }
  function bookHints(plan){
    const rules=((plan&&plan.bookRules)||[]).filter(r=>r&&r.topic!=='żywienie');
    const seen=new Set(),out=[];
    rules.forEach(r=>{
      const book=String(r.cite||'').replace(/, s\. .*$/,'');
      const key=(r.topic||'')+'|'+book;
      if(seen.has(key)||out.length>=3)return;
      seen.add(key);
      const first=String(r.text||'').split(/(?<=[.!?])\s/)[0];
      out.push({topic:r.topic||'zasada treningowa',source:r.cite||book,tip:first.length>110?first.slice(0,107).replace(/\s+\S*$/,'')+'…':first});
    });
    return out;
  }
  function proposalHTML(){
    const p=S.proposal;if(!p)return'';
    const r=S.rec,c=client();
    const used=new Set();(p.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>used.add(String(e.name||'').toLowerCase())));
    const wk=p.currentWeek||(p.weekKeys||[])[0];
    const vol=Object.entries(p.weeklyVolume||{}).map(([k,v])=>`<li><b>${esc(k)}</b> ${esc(String(v).split(' · ')[0])}</li>`).join('');
    const hints=bookHints(p);
    const aiReasons=((p.rationale&&p.rationale.reasoning)||[]).slice(0,3);
    const missing=r.missing.concat(((p.rationale&&p.rationale.uncertainties)||[]).slice(0,3));
    const warn=r.warnings.slice();
    if(p.incompleteDays)warn.push('AI wygenerowało mniej dni niż zaplanowano ('+p.incompleteDays+' brak) — uzupełnij w edytorze.');
    const days=(p.days||[]).map((d,di)=>`<details class="pliv-day"${di===0?' open':''}>
        <summary><b>${esc(d.dayName||('Dzień '+(di+1)))}</b>${d.focus?` <span>${esc(d.focus)}</span>`:''}</summary>
        <ol class="pliv-ex">${(d.exercises||[]).map(e=>{
          const w=(wk&&e[wk])||{};
          const alt=altFor(e,used);
          return `<li data-pliv-ex><div class="pliv-ex-name">${esc(e.name)}</div>
            <div class="pliv-ex-meta">${esc(w.s||e.sets||'3')} × ${esc(w.r||e.reps||'10')} · przerwa ${esc(w.rest||e.rest||'90s')}${(w.rir||e.rir)?' · RIR '+esc(w.rir||e.rir):''}</div>
            ${txt(e.notes||e.note)?`<div class="pliv-ex-tip">${esc(txt(e.notes||e.note).slice(0,160))}</div>`:''}
            ${alt?`<div class="pliv-ex-alt" data-pliv-alt>Alternatywa: ${esc(alt)}</div>`:''}</li>`;}).join('')}</ol>
      </details>`).join('');
    return `<section class="pliv-card pliv-proposal" data-pliv-proposal>
      <div class="pliv-head"><div><div class="pliv-card-kicker">Propozycja Progress AI${S.variant?' · wersja '+(S.variant+1):''}</div><h2 class="pliv-title">${esc(p.planName||'Plan treningowy')}</h2>
        <div class="pliv-sub">${esc(c?c.name:'')} · propozycja nie jest zapisana — zatwierdzasz ją w edytorze</div></div></div>
      ${r.needsTrainerReview?'<div class="pliv-medical is-strong" data-pliv-review><b>Plan wymaga uwagi trenera.</b> Plan treningowy nie zastępuje konsultacji medycznej.</div>':''}
      <dl class="pliv-facts">
        <div><dt>Metoda i dni</dt><dd>${esc(p.method||r.method)} · ${(p.days||[]).length} ${(p.days||[]).length===1?'dzień':'dni'} w tygodniu</dd></div>
        <div><dt>Czas trwania</dt><dd>${esc(p.weeks||r.weeks)} tyg. · sesja ok. ${esc(p.sessionDuration||r.minutes)} min</dd></div>
        <div><dt>Intensywność</dt><dd>RIR ${esc(rirRange(p)||r.rir)} (RPE ${esc(r.rpe)})</dd></div>
        <div><dt>Rozgrzewka</dt><dd>${esc(txt(p.warmup).slice(0,140)||r.warmup)}</dd></div>
        ${r.cardio?`<div><dt>Cardio</dt><dd>${esc(r.cardio)}</dd></div>`:''}
      </dl>
      ${vol?`<div class="pliv-block"><div class="pliv-block-hd">Serie na partię tygodniowo</div><ul class="pliv-vol">${vol}</ul></div>`:''}
      <div class="pliv-block"><div class="pliv-block-hd">Dni treningowe</div>${days}</div>
      <div class="pliv-block" data-pliv-why><div class="pliv-block-hd">Dlaczego tak</div><ul class="pliv-why">${r.reasons.concat(aiReasons).slice(0,6).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="pliv-block" data-pliv-books><div class="pliv-block-hd">Na podstawie wiedzy</div>${hints.length?`<ul class="pliv-books">${hints.map(h=>`<li><b>${esc(h.topic)}</b> — ${esc(h.tip)} <span class="pliv-src">${esc(h.source)}</span></li>`).join('')}</ul>`:'<p class="pliv-hint" data-pliv-nobooks>Brak wystarczającej wiedzy w bibliotece — decyzja wymaga oceny trenera.</p>'}</div>
      ${warn.length||missing.length?`<div class="pliv-block" data-pliv-warn><div class="pliv-block-hd">Ostrzeżenia i brakujące dane</div><ul class="pliv-warn">${warn.map(x=>`<li class="is-warn">${esc(x)}</li>`).join('')}${missing.length?`<li>Brakuje: ${esc(missing.slice(0,6).join('; '))}</li>`:''}</ul></div>`:''}
      <div class="pliv-actions">
        <button type="button" class="btn btn-ghost" onclick="plivBackToInterview()">Wróć do wywiadu</button>
        <button type="button" class="btn btn-ghost" onclick="plivRegenerate()">Wygeneruj inną wersję</button>
        <button type="button" class="btn btn-ghost" onclick="plivManualEdit()">Edytuj ręcznie</button>
        <button type="button" class="btn btn-primary" data-pliv-apply onclick="plivApply()">Zastosuj propozycję do edytora</button>
      </div>
    </section>`;
  }
  function generatingHTML(){
    const c=client();
    if(S.genError)return `<section class="pliv-card pliv-gen is-error" data-pliv-gen-error><div class="pliv-card-kicker">Propozycja Progress AI</div><h2 class="pliv-title">${esc(S.genError.title)}</h2><p class="pliv-hint">${esc(S.genError.hint)}</p>
      <div class="pliv-actions"><button type="button" class="btn btn-ghost" onclick="plivBackToInterview()">Wróć do wywiadu</button><button type="button" class="btn btn-primary" onclick="plivGenerate()">Spróbuj ponownie</button></div></section>`;
    return `<section class="pliv-card pliv-gen" data-pliv-generating><div class="pliv-card-kicker">Propozycja Progress AI</div><h2 class="pliv-title">Układam plan dla: ${esc(c?c.name:'klient')}</h2>
      <p class="pliv-hint" id="pliv-gen-status">${esc(S.rec.method)} · ${S.rec.days}× ${S.rec.minutes} min — dobieram ćwiczenia na podstawie wywiadu i książek. Zwykle 60–90 s.</p><div class="pliv-dots"><span></span><span></span><span></span></div></section>`;
  }
  function appliedHTML(){
    const c=client();
    return `<div class="pliv-strip" data-pliv-applied><span>Propozycja w edytorze${c?' · '+esc(c.name):''} — sprawdź i zapisz plan.${S.rec&&S.rec.needsTrainerReview?' <b>Plan wymaga uwagi trenera.</b>':''}</span>
      <span class="pliv-strip-actions"><button type="button" class="pliv-link" onclick="plivShowProposal()">Pokaż propozycję</button><button type="button" class="pliv-link" onclick="plivBackToInterview()">Wróć do wywiadu</button></span></div>`;
  }

  /* Widoczność starego układu generatora: formularz + wynik (edytor). */
  function layout(mode){
    const d=doc();if(!d)return;
    const lay=d.querySelector('#screen-aiplangen .apl-layout');
    if(!lay)return;
    lay.hidden=mode==='hidden';
    lay.classList.toggle('pliv-editor-only',mode==='editor');
  }
  function render(){
    const d=doc();if(!d)return;
    const mount=d.getElementById('pliv-mount');if(!mount)return;
    let html='';
    if(S.state==='pick'){html=pickHTML();layout('hidden');}
    else if(S.state==='interview'){html=interviewHTML();layout('hidden');}
    else if(S.state==='summary'){html=summaryHTML();layout('hidden');}
    else if(S.state==='generating'){html=generatingHTML();layout('hidden');}
    else if(S.state==='proposal'){html=proposalHTML();layout('hidden');}
    else if(S.state==='applied'){html=appliedHTML();layout('editor');}
    else{html=`<div class="pliv-strip" data-pliv-manual><span>Parametry ręczne — bez wywiadu.</span><span class="pliv-strip-actions"><button type="button" class="pliv-link" onclick="plivOpen()">Poznaj klienta przed planem</button></span></div>`;layout('full');}
    mount.innerHTML=html;
    mount.dataset.plivState=S.state;
  }

  /* ───────────── Akcje ───────────── */
  function showErrors(list){
    const el=doc()&&doc().getElementById('pliv-errors');
    if(el)el.innerHTML=list.length?'Uzupełnij: '+list.map(esc).join(', ')+'.':'';
    return !list.length;
  }
  function next(){
    readStep();
    if(!showErrors(stepErrors(S.data,S.step)))return false;
    refreshRec();
    if(S.step<STEP_DEFS.length){S.step++;save();render();scrollTop();return true;}
    S.state='summary';save('done');render();scrollTop();return true;
  }
  function back(){readStep();if(S.step>1)S.step--;render();scrollTop();}
  function go(n){
    readStep();
    n=Math.max(1,Math.min(STEP_DEFS.length,n));
    // Do przodu tylko przez kroki bez braków w polach obowiązkowych.
    for(let i=S.step;i<n;i++){if(stepErrors(S.data,i).length){S.step=i;render();showErrors(stepErrors(S.data,i));return;}}
    S.step=n;render();
  }
  function scrollTop(){const m=doc()&&doc().getElementById('pliv-mount');if(m&&m.scrollIntoView)try{m.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){}}
  function saveLater(){
    if(S.state==='interview')readStep();
    save();
    if(typeof root.notify==='function')root.notify('Wywiad zapisany — wrócisz do niego po wybraniu klienta.');
    S.state='pick';S.clientId=null;S.data=null;root._plivSession=null;render();
  }
  function firstIncompleteStep(){for(let i=1;i<=STEP_DEFS.length;i++)if(stepErrors(S.data,i).length)return i;return 0;}

  async function ask(){
    if(S.askBusy||!S.data)return;
    S.askBusy=true;S.askDone=false;render();
    let qs=null;
    try{
      if(typeof root.aplAnthropicRequest==='function'){
        const payload={model:'claude-sonnet-4-20250514',max_tokens:700,
          system:'Jesteś asystentem trenera personalnego. Na podstawie profilu klienta zadaj MAKSYMALNIE 3 krótkie pytania, ale TYLKO o informacje, których brak realnie zmieniłby dobór planu treningowego (metoda, liczba dni, objętość, dobór ćwiczeń, bezpieczeństwo). Nie pytaj o rzeczy już podane. Nie diagnozuj. Jeśli nic istotnego nie brakuje, zwróć pustą listę. Odpowiedz TYLKO JSON: {"questions":[{"q":"pytanie","why":"jak odpowiedź zmieni plan"}]}',
          messages:[{role:'user',content:notesBlock(S.data,S.rec)+'\nBrakujące dane wg aplikacji: '+(S.rec.missing.join(', ')||'brak')}]};
        const res=await root.aplAnthropicRequest(payload,1);
        const raw=((res&&res.content)||[]).map(x=>x&&x.text||'').join('');
        const m=raw.match(/\{[\s\S]*\}/);
        const parsed=m?JSON.parse(m[0]):null;
        if(parsed&&Array.isArray(parsed.questions))qs=parsed.questions.map(x=>({q:txt(x&&x.q),why:txt(x&&x.why),a:''})).filter(x=>x.q).slice(0,3);
      }
    }catch(e){qs=null;}
    if(!qs)qs=fallbackQuestions(S.data).map(x=>Object.assign({a:''},x));
    const prev=S.data.aiQuestions||[];
    S.data.aiQuestions=qs.map(q=>{const old=prev.find(p=>p.q===q.q);return old?Object.assign(q,{a:old.a}):q;});
    S.askBusy=false;S.askDone=true;save();render();
  }
  function answer(i,v){if(S.data&&S.data.aiQuestions[i]){S.data.aiQuestions[i].a=txt(v);save();}}
  function readAnswers(){const d=doc();if(!d||!S.data)return;(S.data.aiQuestions||[]).forEach((q,i)=>{const el=d.getElementById('pliv-q-'+i);if(el)q.a=txt(el.value);});}

  /** Przenosi wywiad i decyzje algorytmu do formularza generatora (ten sam silnik, reguły z książek i kontrola planu). */
  function applyToForm(variantHint){
    const d=doc();if(!d)return;
    const r=S.rec,iv=S.data;
    const set=(g,v)=>{if(typeof root.aplSetVal==='function')root.aplSetVal(g,v);};
    set('apl-goals',r.goal);set('apl-levels',r.level);set('apl-methods',r.method);set('apl-days',String(r.days));
    set('apl-duration',String(r.minutes));set('apl-weeks',r.weeks);set('apl-progression',r.progression);
    const eq=[];(iv.equipment||[]).forEach(v=>((EQUIP.find(x=>x.v===v)||{}).apl||[]).forEach(a=>{if(!eq.includes(a))eq.push(a);}));
    if(eq.length)d.querySelectorAll('#apl-equipment .apl-opt-multi').forEach(b=>b.classList.toggle('active',eq.includes(b.dataset.val)));
    d.querySelectorAll('#apl-intensify .apl-opt-multi').forEach(b=>b.classList.remove('active'));
    const val=(id,v)=>{const el=d.getElementById(id);if(el&&v!=null&&v!=='')el.value=v;};
    val('apl-weight',txt(iv.weight));val('apl-height',txt(iv.height));
    const inj=[iv.medical==='yes'?'Zalecenia: '+txt(iv.medicalText):'',iv.pain==='yes'?txt(iv.painText):'',txt(iv.painMoves)?'Dyskomfort przy: '+txt(iv.painMoves):''].filter(Boolean).join('; ');
    const injEl=d.getElementById('apl-injuries');if(injEl)injEl.value=inj;
    if(txt(iv.sleepQ))val('apl-sleep',String(iv.sleepQ));
    if(txt(iv.stress))val('apl-stress',String(iv.stress));
    const job=(JOB.find(x=>x.v===iv.job)||{}).apl;if(job)val('apl-job',job);
    const notes=d.getElementById('apl-notes');
    if(notes){
      const own=String(notes.value||'').replace(/=== WYWIAD TRENERA[\s\S]*?=== KONIEC WYWIADU ===\n?/g,'').trim();
      notes.value=[notesBlock(iv,r)+(variantHint?'\n- '+variantHint:'')+'\n=== KONIEC WYWIADU ===',own].filter(Boolean).join('\n\n');
    }
  }
  async function generate(variantHint){
    if(S.state==='summary')readAnswers();
    const miss=firstIncompleteStep();
    if(miss){S.state='interview';S.step=miss;render();showErrors(stepErrors(S.data,miss));return;}
    refreshRec();save('done');
    applyToForm(variantHint);
    S.state='generating';S.genError=null;S.proposal=null;render();scrollTop();
    root._plivSession={clientId:S.clientId,volume:{lo:S.rec.setsLo,hi:S.rec.setsHi},rec:S.rec};
    const gen=typeof root.aplGenerate==='function'?root.aplGenerate:null;
    if(!gen){S.genError={title:'Generator niedostępny',hint:'Odśwież aplikację i spróbuj ponownie.'};render();return;}
    await gen();
  }
  function regenerate(){
    S.variant++;
    const prev=[];(S.proposal&&S.proposal.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>prev.push(e.name)));
    generate('INNA WERSJA (nr '+(S.variant+1)+'): te same decyzje algorytmu, ale inne warianty ćwiczeń niż poprzednio'+(prev.length?' (poprzednio: '+prev.slice(0,14).join(', ')+')':'')+'.');
  }
  /** Wywoływane przez aplGenerate po zbudowaniu planu — zamiast od razu pokazać edytor, pokazujemy propozycję. */
  function onPlanReady(plan){
    if(!root._plivSession||S.state!=='generating')return false;
    S.proposal=plan;
    if(plan&&S.rec){
      plan.planInterview={clientId:S.clientId,at:new Date().toISOString(),method:S.rec.method,needsTrainerReview:!!S.rec.needsTrainerReview};
      // Start zachowawczy: RIR w 1. tygodniu nie niżej niż w rekomendacji (np. 3 przy słabym śnie).
      const minRir=parseFloat(String(S.rec.rir).split(/[–-]/)[0]);
      const wk1=(plan.weekKeys||[])[0];
      (plan.days||[]).forEach(d=>(d.exercises||[]).forEach(e=>{
        if(!txt(e.alt)){const a=altFor(e,new Set());if(a)e.alt=a;}
        if(Number.isFinite(minRir)){
          const fix=o=>{if(!o)return;const n=parseFloat(o.rir);if(Number.isFinite(n)&&n<minRir)o.rir=String(minRir);};
          fix(e);if(wk1&&e[wk1]&&typeof e[wk1]==='object')fix(e[wk1]);
        }
      }));
    }
    S.state='proposal';render();scrollTop();return true;
  }
  function onPlanError(title,hint){
    if(!root._plivSession||S.state!=='generating')return false;
    S.genError={title:title||'Błąd generowania planu',hint:hint||'Spróbuj ponownie za chwilę.'};render();return true;
  }
  function progress(msg){const el=doc()&&doc().getElementById('pliv-gen-status');if(el&&msg)el.textContent=msg;}
  /** Objętość z rekomendacji zastępuje domyślny cel objętości generatora (np. niższa przy słabym śnie). */
  function volumeOverride(vt){
    const s=root._plivSession;
    if(!s||!s.volume||!vt)return vt;
    vt.weekly=s.volume.lo+'–'+s.volume.hi;vt.weeklyMin=s.volume.lo;vt.weeklyMax=s.volume.hi;
    if(s.rec&&s.rec.minutes<45){vt.exMin=Math.max(3,vt.exMin-1);vt.exMax=Math.max(vt.exMin,vt.exMax-1);}
    return vt;
  }
  function apply(){if(typeof root.aplRerenderCurrent==='function')try{root.aplRerenderCurrent();}catch(e){}S.state='applied';render();const r=doc()&&doc().getElementById('apl-result');if(r&&r.scrollIntoView)try{r.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){}}
  function manualEdit(){S.state='manual';root._plivSession=null;render();if(typeof root.notify==='function')root.notify('Parametry z wywiadu są w formularzu — zmień je i wygeneruj plan albo edytuj propozycję.');}

  function open(){
    const sel=doc()&&doc().getElementById('apl-client');
    const cid=sel&&sel.value;
    if(cid)start(cid);else{S.state='pick';render();}
  }

  /** Wejście na ekran generatora: z wybranym klientem od razu wywiad, bez klienta — wybór klienta. */
  function onScreenOpen(cid){
    if(['generating','proposal','applied','manual'].includes(S.state)){render();return;}
    if(cid&&S.clientId===cid&&S.data){render();return;}
    if(cid)start(cid);else{S.state='pick';render();}
  }
  /** Zmiana klienta w formularzu generatora (np. „Generuj plan AI” z profilu klienta). */
  function onClientPicked(cid){
    if(S._filling||!cid)return;
    if(S.state==='manual'||S.state==='generating')return;
    if(S.clientId===cid&&S.data&&S.state!=='pick'){render();return;}
    start(cid);
  }
  // Tryby, które budują plan bez wywiadu, przełączają ekran na parametry ręczne.
  ['aplCreateBlankPlan','aplAmateurOpen','aplProOpen'].forEach(n=>{
    const f=root[n];
    if(typeof f!=='function'||f._pliv)return;
    const w=function(){exit(true);return f.apply(this,arguments);};
    w._pliv=true;root[n]=w;
  });

  const api={GOALS,EXP,EQUIP,STEP_DEFS,emptyInterview,prefill,stepErrors,levelOf,attendance,medicalFlags,overloadRisk,missingData,recommend,profile,
    fallbackQuestions,notesBlock,bookHints,render,start,exit,onPlanReady,onPlanError,progress,volumeOverride,state:()=>S};
  root.PLIV=api;
  Object.assign(root,{
    plivPick:pick,plivNext:next,plivBack:back,plivGo:go,plivSaveLater:saveLater,plivEdit:()=>{S.state='interview';S.step=1;render();scrollTop();},
    plivAsk:ask,plivAnswer:answer,plivGenerate:()=>generate(''),plivRegenerate:regenerate,plivApply:apply,plivManualEdit:manualEdit,
    plivBackToInterview:()=>{root._plivSession={clientId:S.clientId};S.state='summary';render();scrollTop();},
    plivShowProposal:()=>{if(S.proposal){S.state='proposal';render();scrollTop();}},
    plivStartFromPick:()=>{const el=doc()&&doc().getElementById('pliv-client');if(el&&el.value)start(el.value);else if(typeof root.notify==='function')root.notify('Wybierz klienta.');},
    plivManual:()=>exit(true),plivOpen:open,plivOnPlanReady:onPlanReady,plivOnScreenOpen:onScreenOpen,plivOnClientPicked:onClientPicked,plivOnPlanError:onPlanError,plivProgress:progress,plivVolumeOverride:volumeOverride
  });
})(typeof window!=='undefined'?window:globalThis);
