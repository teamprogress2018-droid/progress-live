/* Plan klienta: trening + odżywianie — wspólna logika danych (bez DOM).
   „Co wiemy o kliencie”: 11 pól z profilu i wywiadu (plan-interview.js), wagi braków,
   pewność dopasowania i bramka zdrowia. Ładowany po plan-interview.js; testy: test_plan_client.js. */
(function(root){
  'use strict';
  const txt=x=>String(x==null?'':x).trim();
  const num=x=>{const n=parseFloat(String(x==null?'':x).replace(',','.'));return Number.isFinite(n)?n:null;};
  const PL=()=>root.PLIV||null;
  const lbl=(list,v)=>{const p=PL();return p&&p[list]?p.label(p[list],v):'';};

  const HEALTH_STOP='Plan wymaga konsultacji z lekarzem lub dietetykiem klinicznym.';
  // Słowa w notatkach zdrowia, przy których AI nie układa odżywiania. Nie diagnozujemy, tylko kierujemy do specjalisty.
  const HEALTH_RX=/ciąż|karmi(ę|e) piersią|karmienie|cukrzy|insulin|tarczyc|hashimoto|lewotyroks|euthyrox|steryd|kortykoster|zaburzeni[aem] odżywiania|anoreks|bulimi|napad\w* objadania|nerek|nerki|dializ|niewydolno|zawał|serc|arytmi|omdle|ból w klatce|duszno|nowotw|chemioter|brak miesiączki/i;

  /* Pola panelu. w = waga przy liczeniu braków (3 — zmienia bezpieczeństwo planu, 1 — wygodę). */
  const FIELDS=[
    {k:'goal',l:'Cel',w:3},
    {k:'trainings',l:'Realne treningi w tygodniu',w:3},
    {k:'limits',l:'Ograniczenia, kontuzje, ból',w:3},
    {k:'body',l:'Wzrost i masa ciała',w:2},
    {k:'age',l:'Wiek',w:2},
    {k:'allergies',l:'Alergie i produkty wykluczone',w:2},
    {k:'activity',l:'Aktywność dzienna',w:2},
    {k:'meals',l:'Liczba posiłków',w:1},
    {k:'foodPrefs',l:'Preferencje żywieniowe',w:1},
    {k:'cooking',l:'Czas na gotowanie',w:1},
    {k:'budget',l:'Budżet',w:1}
  ];
  /* Pola widoczne od razu; reszta po „Pokaż wszystko”. */
  const TOP=['goal','trainings','limits','body','allergies','activity'];
  const CLIENT_GOALS={redukcja:'Redukcja',masa:'Budowa masy',sila:'Siła',kondycja:'Kondycja',atletyzm:'Atletyzm',rehab:'Powrót do ruchu',zdrowie:'Zdrowie'};
  const ACTIVITY={sedentary:'Mało ruchu na co dzień',moderate:'Umiarkowana',active:'Aktywny tryb życia'};

  /** Wywiad klienta uzupełniony profilem (ten sam prefill co w generatorze). */
  function interviewOf(c){
    const p=PL();
    if(p&&p.prefill)return p.prefill(c||{},c&&c.planInterview);
    return Object.assign({},c&&c.planInterview||{});
  }
  function ageOf(c){
    const a=parseInt(c&&c.age,10);if(a>0&&a<120)return a;
    const b=c&&(c.birthDate||c.dob);if(!b)return null;
    const t=Date.parse(b);if(!isFinite(t))return null;
    const y=Math.floor((Date.now()-t)/(365.25*86400000));return y>0&&y<120?y:null;
  }

  /** Wartość każdego pola jako krótki tekst; '' = brak danych. */
  function facts(c){
    c=c||{};
    const d=interviewOf(c),v={};
    v.goal=d.goal==='inny'&&txt(d.goalOther)?txt(d.goalOther):(lbl('GOALS',d.goal)||CLIENT_GOALS[c.goal]||txt(c.goal));
    const days=parseInt(d.days,10);
    v.trainings=days?days+' × '+(parseInt(d.minutes,10)?parseInt(d.minutes,10)+' min':'w tygodniu'):'';
    const lim=[];
    if(d.medical==='yes')lim.push('zalecenia: '+(txt(d.medicalText)||'bez szczegółów'));
    if(d.pain==='yes')lim.push(txt(d.painText)||'zgłoszony ból');
    v.limits=lim.length?lim.join('; '):(d.pain==='none'&&d.medical==='none'?'Brak':'');
    const h=num(d.height)||num(c.height),w=num(d.weight)||num(c.weight);
    v.body=h&&w?h+' cm · '+w+' kg':'';
    const age=ageOf(c);v.age=age?age+' lat':'';
    const ex=(d.foodExclusions||[]).map(x=>lbl('FOOD_EX',x)).filter(Boolean);
    // „Brak” tylko wtedy, gdy trener przeszedł krok Jedzenie (wybrał sposób odżywiania), a nie zaznaczył wykluczeń.
    v.allergies=ex.length?ex.join(', '):(d.foodStyle?'Brak':'');
    const steps={low:'< 5 tys. kroków',mid:'5–8 tys. kroków',high:'8–12 tys. kroków',vhigh:'> 12 tys. kroków'}[d.steps]||'';
    const job={sitting:'praca siedząca',active:'praca stojąca lub mieszana',physical:'praca fizyczna',shift:'praca zmianowa'}[d.job]||'';
    v.activity=[job,steps].filter(Boolean).join(', ')||ACTIVITY[c.activityLevel]||'';
    v.activity=v.activity?v.activity.charAt(0).toUpperCase()+v.activity.slice(1):'';
    v.meals=parseInt(d.mealsPerDay,10)?parseInt(d.mealsPerDay,10)+' dziennie':'';
    const fp=[d.foodStyle?lbl('FOOD_STYLE',d.foodStyle):'',txt(d.foodLikes)?'lubi: '+txt(d.foodLikes):'',txt(d.foodDislikes)?'nie lubi: '+txt(d.foodDislikes):''].filter(Boolean);
    v.foodPrefs=fp.join(' · ');
    const prep=d.mealPrep&&d.mealPrep!=='0'?', gotuje na '+d.mealPrep+' dni':'';
    v.cooking=d.cookingTime?lbl('COOKING',d.cookingTime)+prep:'';
    v.budget=d.foodBudget?lbl('BUDGET',d.foodBudget):'';
    return FIELDS.map(f=>({k:f.k,l:f.l,w:f.w,top:TOP.includes(f.k),v:v[f.k]||''}));
  }

  /** Brakujące pola od najważniejszych; max = ile pokazać (domyślnie 3). */
  function missing(list,max){
    const m=(list||[]).filter(f=>!f.v).sort((a,b)=>b.w-a.w||FIELDS.findIndex(x=>x.k===a.k)-FIELDS.findIndex(x=>x.k===b.k));
    return max==null?m.slice(0,3):m.slice(0,max);
  }
  /** Pewność dopasowania: suma wag brakujących pól. Nie blokuje szkicu. */
  function confidence(list){
    const lost=(list||[]).filter(f=>!f.v).reduce((s,f)=>s+f.w,0);
    if(lost===0)return{level:3,label:'wysoka',lost};
    if(lost<=4)return{level:2,label:'średnia',lost};
    return{level:1,label:'niska',lost};
  }

  /**
   * Bramka zdrowia: stany z wywiadu (healthFlags) albo słowa w notatkach zdrowia.
   * stop → komunikat HEALTH_STOP, bez AI dla odżywiania i kompletu; trening dopiero po potwierdzeniu zgody lekarza (c.healthAck).
   */
  function healthGate(c,extraTexts){
    c=c||{};
    const d=interviewOf(c),p=PL();
    const flags=p&&p.healthStops?p.healthStops(d).map(v=>p.label(p.HEALTH,v)):[];
    const texts=[c.health,c.healthNotes,c.injuries,c.limitations,d.medicalText,d.painText,d.extra].concat(extraTexts||[]).map(txt).filter(Boolean);
    const hits=texts.filter(t=>HEALTH_RX.test(t)).map(t=>t.length>80?t.slice(0,77)+'…':t);
    const stop=flags.length>0||hits.length>0;
    const ack=c.healthAck&&c.healthAck.at?c.healthAck:null;
    return{stop,message:stop?HEALTH_STOP:'',flags,hits,
      nutritionAllowed:!stop,trainingAllowed:!stop||!!ack,needsAck:stop&&!ack,ack};
  }

  /** Preferencje do kreatora diety (DietPlan.dietPrefsNorm) z wywiadu. */
  function dietPrefsFrom(c){
    const d=interviewOf(c);
    const t=parseInt(d.cookingTime,10)||0;
    return{
      prefs:{style:d.foodStyle||'wszystko',ex:(d.foodExclusions||[]).slice(),skip:[],like:[],maxMin:t>=45?0:t,col:[]},
      meals:parseInt(d.mealsPerDay,10)||null,
      prep:parseInt(d.mealPrep,10)||0,
      people:Math.max(1,Math.min(8,parseInt(d.householdSize,10)||1))
    };
  }

  const api={FIELDS,TOP,HEALTH_STOP,HEALTH_RX,facts,missing,confidence,healthGate,dietPrefsFrom,interviewOf};
  root.PlanClient=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
