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
    v.trainings=days?(parseInt(d.minutes,10)?days+' × '+parseInt(d.minutes,10)+' min':days+' w tygodniu'):'';
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

  /* ───────── Odżywianie: cele, trzy formy planu, lista zakupów, porcje domowe ───────── */
  const KCAL_MIN={K:1200,M:1500};
  const GOAL_DELTA={redukcja:-300,masa:300};
  const STEPS_PAL={low:1.4,mid:1.5,high:1.65,vhigh:1.8};
  const ACT_PAL={sedentary:1.4,light:1.5,moderate:1.6,active:1.75};
  /**
   * Orientacyjny cel kaloryczny (Mifflin-St Jeor × PAL + zmiana pod cel, nie mniej niż BMR i 1200/1500 kcal)
   * i makro wg książek (DietPlan.dietBookTargets). Zwraca też założenia, jeśli czegoś brakowało.
   */
  function nutritionTargets(c){
    c=c||{};
    const d=interviewOf(c),assumptions=[];
    const weight=num(d.weight)||num(c.weight),height=num(d.height)||num(c.height),age=ageOf(c);
    const miss=[!weight&&'masa ciała',!height&&'wzrost',!age&&'wiek'].filter(Boolean);
    if(miss.length)return{ok:false,missing:miss,assumptions};
    const sex=c.gender==='M'?'M':'K';
    if(c.gender!=='M'&&c.gender!=='K')assumptions.push('płeć: kobieta (do obliczenia BMR)');
    const bmr=10*weight+6.25*height-5*age+(sex==='M'?5:-161);
    let pal=STEPS_PAL[d.steps]||ACT_PAL[c.activityLevel]||0;
    if(!pal){pal=1.5;assumptions.push('aktywność dzienna: niska (PAL 1,5)');}
    if(d.job==='physical')pal+=0.15;
    const days=parseInt(d.days,10)||parseInt(c.trainingFreq,10)||0;
    if(days>=4)pal+=0.1;
    pal=Math.round(pal*100)/100;
    const goalKey=d.goal||c.goal||'';
    const delta=GOAL_DELTA[goalKey]||0;
    const raw=Math.round(bmr*pal+delta);
    const floor=Math.max(Math.round(bmr),KCAL_MIN[sex]);
    const kcal=Math.max(raw,floor);
    const DP=root.DietPlan;
    if(!DP)return{ok:false,missing:[],assumptions,error:'Brak modułu diety'};
    const t=DP.dietBookTargets({weight,age,kcal,rmr:Math.round(bmr),pal,goal:goalKey==='sprawnosc'?'kondycja':goalKey,goalDelta:delta});
    const water=[Math.round(weight*0.030*10)/10,Math.round(weight*0.035*10)/10];
    return{ok:!t.blocked,blocked:t.blocked,blocks:t.blocks,targets:t,kcal,bmr:Math.round(bmr),pal,delta,floorApplied:raw<floor,water,assumptions,weight};
  }

  const SLOT_ORDER=['Śniadanie','II śniadanie','Obiad','Podwieczorek','Przekąska','Kolacja'];
  /** Elastyczny plan: do 3 różnych propozycji na posiłek, w granicach ±75 kcal od mediany tego posiłku. */
  function flexOptions(t,meals,prefs){
    const DP=root.DietPlan,by={};
    for(let v=0;v<12;v++){
      const day=DP.dietBuildDay({targets:t,meals,variant:v*3+1,prefs});
      day.meals.forEach(m=>{(by[m.name]=by[m.name]||[]);if(m.items.length&&!by[m.name].some(x=>x.dish&&x.dish===m.dish&&m.dish))by[m.name].push(m);});
    }
    const out={};
    Object.keys(by).sort((a,b)=>SLOT_ORDER.indexOf(a)-SLOT_ORDER.indexOf(b)).forEach(slot=>{
      const list=by[slot];
      const kc=list.map(m=>m.total.kcal).sort((a,b)=>a-b),med=kc[Math.floor(kc.length/2)];
      const near=list.filter(m=>Math.abs(m.total.kcal-med)<=75);
      out[slot]=(near.length>=2?near:list).slice(0,3);
    });
    return out;
  }
  function sumShop(meals){
    const DP=root.DietPlan,F={};DP.DIET_FOODS.forEach(f=>{F[f.id]=f;});
    const m={};meals.forEach(ml=>(ml.items||[]).forEach(it=>{m[it.id]=(m[it.id]||0)+it.amount;}));
    return Object.keys(m).map(id=>({id,amount:F[id].unit==='szt'?Math.ceil(m[id]):Math.round(m[id]/10)*10}))
      .sort((a,b)=>DP.DIET_FOODS.indexOf(F[a.id])-DP.DIET_FOODS.indexOf(F[b.id]));
  }
  // „Cele i nawyki”: lista bazowa na tydzień (bez jadłospisu), z pominięciem wykluczeń.
  const BASE_SHOP=[['kurczak',1000],['jajko',10],['skyr',600],['twarog',500],['owsiane',500],['chleb-zytni',600],['kasza-gryczana',400],['ziemniaki',1500],['brokul',1000],['papryka',600],['pomidor',600],['jablko',7],['maliny',500],['oliwa',100]];
  function baseShop(prefs){
    const DP=root.DietPlan,F={};DP.DIET_FOODS.forEach(f=>{F[f.id]=f;});
    const p=DP.dietPrefsNorm(prefs),ex=new Set(p.ex);
    return BASE_SHOP.filter(([id])=>F[id]&&!F[id].tags.some(t=>ex.has(t))).map(([id,amount])=>({id,amount}));
  }
  const DEFAULT_HABITS=['Białko w każdym posiłku: porcja wielkości dłoni','Pół talerza warzyw do obiadu i kolacji','Woda: butelka zawsze pod ręką'];
  /**
   * Szkic odżywiania w jednej z trzech form: habits | flex | week. Ten sam cel i makro w każdej formie;
   * zmiana formy nie liczy celu od nowa. trainDays = dni tygodnia z planu treningowego (1 = pon … 0 = nd).
   */
  function buildNutrition(c,form,opts){
    opts=opts||{};
    const nt=nutritionTargets(c);
    if(!nt.ok)return Object.assign({form},nt);
    const dp=dietPrefsFrom(c);
    const meals=dp.meals||4;
    const assumptions=nt.assumptions.slice();
    if(!dp.meals)assumptions.push('4 posiłki dziennie');
    const DP=root.DietPlan,t=nt.targets;
    const out={ok:true,form,targets:t,kcal:nt.kcal,water:nt.water,meals,prefs:dp.prefs,people:dp.people,prep:dp.prep,assumptions,habits:(opts.habits||DEFAULT_HABITS).slice(0,3)};
    if(form==='flex'){out.flex=flexOptions(t,meals,dp.prefs);out.shopping=sumShop([].concat(...Object.values(out.flex)));out.shopDays=3;}
    else if(form==='week'){
      // Trener może zmienić gotowanie na zapas i liczbę osób w szkicu (opts), bez zmiany wywiadu.
      const prep=opts.prep!=null?+opts.prep:(dp.prep||2),people=opts.people!=null?+opts.people:dp.people;
      out.prep=prep;out.people=people;
      const w=DP.dietBuildWeek({targets:t,meals,variant:opts.variant||0,prefs:dp.prefs,days:7,prep,people,trainDays:opts.trainDays,mealShift:opts.mealShift||{}});
      out.week=w;out.shopping=w.shopping;out.shopDays=7;out.warnings=w.warnings;
    }else{out.form='habits';out.shopping=baseShop(dp.prefs);out.shopDays=7;}
    return out;
  }

  /* Porcje domowe: gramy na 1 miarę i odmiana [1, 2–4, 5+]. Przybliżone, do pokazania obok gramów. */
  const HOME={
    'chleb':[35,'kromka','kromki','kromek'],'chleb-zytni':[40,'kromka','kromki','kromek'],'pita':[60,'pita','pity','pit'],
    'owsiane':[10,'łyżka','łyżki','łyżek'],'musli':[10,'łyżka','łyżki','łyżek'],'kasza-gryczana':[100,'woreczek','woreczki','woreczków'],
    'ryz':[100,'woreczek','woreczki','woreczków'],'ryz-bialy':[100,'woreczek','woreczki','woreczków'],'kasza-jaglana':[100,'woreczek','woreczki','woreczków'],
    'ziemniaki':[100,'średni ziemniak','średnie ziemniaki','średnich ziemniaków'],'makaron':[100,'szklanka suchego','szklanki suchego','szklanek suchego'],'makaron-razowy':[100,'szklanka suchego','szklanki suchego','szklanek suchego'],
    'twarog':[250,'kostka','kostki','kostek'],'cottage':[200,'opakowanie','opakowania','opakowań'],'skyr':[150,'kubeczek','kubeczki','kubeczków'],'jogurt-grecki':[25,'łyżka','łyżki','łyżek'],'jogurt':[150,'kubeczek','kubeczki','kubeczków'],
    'mleko':[250,'szklanka','szklanki','szklanek'],'mleko-2':[250,'szklanka','szklanki','szklanek'],'kefir':[250,'szklanka','szklanki','szklanek'],'mozzarella':[125,'kulka','kulki','kulek'],'gouda':[15,'plaster','plastry','plastrów'],'feta':[200,'kostka','kostki','kostek'],'parmezan':[7,'łyżka','łyżki','łyżek'],
    'wedlina':[10,'plaster','plastry','plastrów'],'kurczak':[200,'pierś','piersi','piersi'],'indyk':[200,'pierś','piersi','piersi'],'losos':[125,'płat','płaty','płatów'],'ryba':[150,'filet','filety','filetów'],'tunczyk':[120,'puszka','puszki','puszek'],
    'tofu':[180,'kostka','kostki','kostek'],'fasola':[15,'łyżka','łyżki','łyżek'],'ciecierzyca':[15,'łyżka','łyżki','łyżek'],'soczewica':[15,'łyżka','łyżki','łyżek'],'hummus':[15,'łyżka','łyżki','łyżek'],
    'oliwa':[10,'łyżka','łyżki','łyżek'],'olej-rzepakowy':[10,'łyżka','łyżki','łyżek'],'maslo':[5,'łyżeczka','łyżeczki','łyżeczek'],'maslo-orz':[15,'łyżka','łyżki','łyżek'],'miod':[10,'łyżeczka','łyżeczki','łyżeczek'],'awokado':[70,'połówka','połówki','połówek'],
    'maliny':[70,'garść','garście','garści'],'truskawki':[70,'garść','garście','garści'],'borowki':[70,'garść','garście','garści'],'szpinak':[30,'garść','garście','garści'],'salata':[30,'garść','garście','garści'],
    'pomidor':[120,'pomidor','pomidory','pomidorów'],'marchew':[80,'marchewka','marchewki','marchewek'],'ogorek':[150,'ogórek','ogórki','ogórków'],'papryka':[150,'papryka','papryki','papryk'],'cebula':[100,'cebula','cebule','cebul'],'cukinia':[250,'cukinia','cukinie','cukinii'],'buraki':[100,'burak','buraki','buraków'],'brokul':[90,'szklanka różyczek','szklanki różyczek','szklanek różyczek'],'pieczarki':[20,'pieczarka','pieczarki','pieczarek'],'pomidory-puszka':[400,'puszka','puszki','puszek']
  };
  function fracTxt(x){const w=Math.floor(x),r=x-w;const s=r<0.13?'':r<0.38?'¼':r<0.63?'½':r<0.88?'¾':'';const W=r>=0.88?w+1:w;return((W?String(W):'')+(s?(W?' ':'')+s:''))||'¼';}
  function plForm(n,f){if(n!==Math.floor(n))return f[2];if(n===1)return f[1];const d=n%10,dd=n%100;return d>=2&&d<=4&&(dd<12||dd>14)?f[2]:f[3];}
  /** „ok. 7½ łyżki” dla 75 g płatków; '' gdy brak miary albo produkt liczony w sztukach. */
  function homePortion(id,amount){
    const h=HOME[id];if(!h||!(amount>0))return'';
    const q=h[1]==='kostka'?Math.max(0.25,Math.round(amount/h[0]*4)/4):(Math.round(amount/h[0]*2)/2||0.5);
    return'ok. '+fracTxt(q)+' '+plForm(q,h);
  }

  const api={FIELDS,TOP,HEALTH_STOP,HEALTH_RX,facts,missing,confidence,healthGate,dietPrefsFrom,interviewOf,
    nutritionTargets,buildNutrition,flexOptions,homePortion,DEFAULT_HABITS};
  root.PlanClient=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
