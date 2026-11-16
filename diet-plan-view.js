/* Widok planu żywieniowego dla klienta (DietView): nagłówek z celem, zakładki Dzisiaj / Cały tydzień / Zamienniki /
   Lista zakupów / Wskazówki, karta posiłku ze zdjęciem, przygotowaniem i zamiennikami, akcje trenera i wydruk A4.
   Jedno źródło wyglądu dla: aplikacji klienta („Moje jedzenie”), ekranu trenera „Plan klienta” i wydruku / PDF.
   Dane: dzień albo tydzień z DietPlan.dietBuildDay/Week (fromBuilt) albo zapisany plan klienta (fromPublic).
   Kroki przygotowania układa aplikacja z rodzaju składników (przepisów z książek nie kopiujemy); trener może je zmienić. */
(function(root){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  const DP=()=>root.DietPlan;
  const PC=()=>root.PlanClient;
  const r=v=>Math.round(v||0);
  const doc=()=>root.document;

  /* ───────── Produkty ───────── */
  let FMAP=null;
  function food(id){const D=DP();if(!D)return{id,name:id,unit:'g',kcal:0,p:0,c:0,f:0};if(!FMAP){FMAP={};D.DIET_FOODS.forEach(f=>{FMAP[f.id]=f;});}return FMAP[id]||{id,name:id,unit:'g',kcal:0,p:0,c:0,f:0};}
  function macros(id,a){const f=food(id),k=f.unit==='szt'?a:a/100;return{kcal:(f.kcal||0)*k,p:(f.p||0)*k,c:(f.c||0)*k,f:(f.f||0)*k};}
  const add=(x,y)=>({kcal:x.kcal+y.kcal,p:x.p+y.p,c:x.c+y.c,f:x.f+y.f});
  const ZERO={kcal:0,p:0,c:0,f:0};
  // Nazwa bez dopisku „(surowa)” / „(suchy)” — w karcie i na liście zakupów prościej; waga przed obróbką jest w uwagach.
  const shortName=f=>String(f.name||'').replace(/\s*\((surow[aey]?|such[aye]?|odsączony|ugotowan[aey])\)\s*$/i,'');
  function amt(id,a){const f=food(id);return f.unit==='szt'?a+' szt.':a+' '+(f.unit||'g');}
  function shopAmt(id,a){const f=food(id);if(f.unit==='szt')return a+' szt.';return a>=1000?(Math.round(a/100)/10).toString().replace('.',',')+(f.unit==='ml'?' l':' kg'):a+' '+(f.unit||'g');}
  function home(id,a){const P=PC();return P&&P.homePortion?P.homePortion(id,a):'';}
  function roundAmt(id,a){const f=food(id);if(f.unit==='szt')return Math.max(1,Math.round(a));const v=Math.round(a/5)*5;return Math.max(5,v);}
  const macroLine=m=>`${r(m.kcal)} kcal · B: ${r(m.p)} g · T: ${r(m.f)} g · W: ${r(m.c)} g`;
  const macroShort=m=>`${r(m.kcal)} kcal · B ${r(m.p)} · T ${r(m.f)} · W ${r(m.c)}`;
  const plNum=v=>String(v).replace('.',',');

  const GOAL_LBL={redukcja:'Łagodna redukcja',masa:'Spokojny wzrost masy',sila:'Więcej siły',kondycja:'Lepsza kondycja',sprawnosc:'Lepsza sprawność',zdrowie:'Zdrowie i dobre samopoczucie',utrzymanie:'Utrzymanie wagi'};
  function goalLabel(key,delta){if(GOAL_LBL[key])return GOAL_LBL[key];if(delta<0)return'Łagodna redukcja';if(delta>0)return'Spokojny wzrost masy';return'Utrzymanie wagi';}
  const WD_SHORT=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  const WD_NAMES=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
  const todayIdx=()=>(new Date().getDay()+6)%7;

  /* ───────── Model widoku ───────── */
  function mealModel(src){
    const items=(src.items||[]).map(it=>({id:it.id,amount:+it.amount||0,role:it.role||'x',swaps:(it.swaps||[]).map(s=>({id:s.id,amount:+s.amount||0}))}));
    const m={slot:src.slot||'',dish:src.dish||'',img:src.img||'',min:+src.min||0,items,steps:Array.isArray(src.steps)&&src.steps.length?src.steps.slice(0,5):null,edited:!!src.edited,swapped:!!src.swapped};
    m.total=items.reduce((s,it)=>add(s,macros(it.id,it.amount)),ZERO);
    return m;
  }
  function dayModel(d,i,n){
    const name=d.name||(n===7?WD_NAMES[i]:'Dzień '+(i+1));
    const meals=(d.meals||[]).map(mealModel);
    return{name,short:n===7?WD_SHORT[i]:String(i+1),type:d.type||'',kcalTarget:d.kcalTarget||0,meals,total:meals.reduce((s,m)=>add(s,m.total),ZERO)};
  }
  /** Suma produktów z dni × liczba osób, zaokrąglona jak lista zakupów jadłospisu. */
  function shoppingOf(days,people){
    const m={};
    days.forEach(d=>d.meals.forEach(ml=>ml.items.forEach(it=>{m[it.id]=(m[it.id]||0)+it.amount*(people||1);})));
    return Object.keys(m).map(id=>({id,amount:food(id).unit==='szt'?Math.ceil(m[id]):Math.max(10,Math.round(m[id]/10)*10)}));
  }
  function finish(vm,ctx){
    ctx=ctx||{};
    vm.client=String(ctx.client||'').trim();
    vm.first=vm.client.split(/\s+/)[0]||'';
    vm.goal=ctx.goal||goalLabel(ctx.goalKey,ctx.delta||0);
    vm.period=ctx.period||'tydzień 1';
    vm.date=ctx.date||new Date().toLocaleDateString('pl-PL');
    vm.water=ctx.water||null;
    vm.habit=ctx.habit||'Zjedz białko w każdym posiłku';
    vm.note=String(ctx.note||'').trim();
    vm.people=Math.max(1,+ctx.people||+vm.people||1);
    vm.mealsN=ctx.meals||(vm.days[0]?vm.days[0].meals.length:0);
    vm.shop=shoppingOf(vm.days,vm.people);
    vm.shopDays=vm.days.length;
    vm.isWeek=vm.days.length>1;
    vm.today=vm.days.length===7?todayIdx():0;
    return vm;
  }
  /** Z jadłospisu policzonego przez DietPlan: t = cele (dietBookTargets), plan = dzień ({meals}) albo tydzień ({days}). */
  function fromBuilt(t,plan,ctx){
    ctx=ctx||{};
    const raw=plan&&plan.days?plan.days:[plan||{meals:[]}];
    const days=raw.map((d,i)=>dayModel({name:plan&&plan.days?d.name:(ctx.dayName||'Przykładowy dzień'),type:d.dayType||'',kcalTarget:d.kcalTarget||0,
      meals:(d.meals||[]).map(m=>({slot:m.name,dish:m.dish,img:m.img,min:m.minutes!=null?m.minutes:m.min,items:m.items,steps:m.steps,edited:m.edited,swapped:m.swapped}))},i,raw.length));
    return finish({kcal:ctx.kcal||t.kcal,p:t.protein.g,f:t.fat.g,c:t.carbs.g,days,people:plan&&plan.people},ctx);
  }
  /** Z planu zapisanego u klienta (PlanClient.publicPlan): pozycje [id, ilość, rola, [[zamiennik, ilość], …]]. */
  function fromPublic(p,ctx){
    ctx=Object.assign({water:p.water,meals:p.meals,people:p.people,note:p.note,habit:(p.habits||[])[0]},ctx||{});
    const it=list=>(list||[]).map(x=>({id:x[0],amount:x[1],role:x[2]||'x',swaps:(x[3]||[]).map(s=>({id:s[0],amount:s[1]}))}));
    const days=(p.days||[]).map((d,i,a)=>dayModel({name:d.n,type:d.t,meals:(d.m||[]).map(m=>({slot:m.n,dish:m.d,img:m.img,min:m.min,items:it(m.i),steps:m.st}))},i,a.length));
    return finish({kcal:p.kcal,p:p.p,f:p.f,c:p.c,days},ctx);
  }

  /* ───────── Nazwa i przygotowanie ───────── */
  function mealTitle(m){
    if(m.dish)return m.dish;
    const main=m.items.filter(it=>it.role!=='x').concat(m.items.filter(it=>it.role==='x')).slice(0,3).map(it=>shortName(food(it.id)).toLowerCase());
    if(!main.length)return m.slot||'Posiłek';
    const s=main.length>1?main.slice(0,-1).join(', ')+' i '+main[main.length-1]:main[0];
    return s.charAt(0).toUpperCase()+s.slice(1);
  }
  const MEAT=new Set(['kurczak','indyk','wolowina','schab']);
  const FISH=new Set(['losos','ryba','makrela','pstrag']);
  const BOIL=new Set(['makaron','makaron-razowy','makaron-ryzowy','ryz','ryz-bialy','kasza-gryczana','kasza-jaglana','kasza-jeczmienna','komosa','kuskus','bulgur']);
  const BREAD=new Set(['chleb','chleb-zytni','pita','wafle']);
  const SPOON=new Set(['twarog','skyr','jogurt','jogurt-grecki','cottage','kefir','mleko','mleko-2']);
  /** 3–5 prostych kroków z rodzaju składników (ustawienie aplikacji, nie przepis z książki). */
  function steps(m){
    if(m.steps&&m.steps.length)return m.steps.slice(0,5);
    const ids=m.items.map(it=>it.id),has=id=>ids.includes(id),any=set=>ids.find(id=>set.has(id));
    const nm=id=>shortName(food(id)).toLowerCase();
    const veg=m.items.filter(it=>food(it.id).group==='warzywa').map(it=>it.id);
    const fruit=m.items.filter(it=>food(it.id).group==='owoce').map(it=>it.id);
    const fat=m.items.find(it=>food(it.id).sub==='oleje');
    const nuts=m.items.find(it=>['orzechy','nasiona'].includes(food(it.id).sub));
    const dish=String(m.dish||'').toLowerCase();
    if(/koktajl|smoothie|shake/.test(dish))return['Wrzuć wszystkie składniki do blendera.','Zmiksuj na gładko.','Przelej do szklanki i od razu wypij.'];
    const DISH=[[/tost/,'Roztrzep jajka z odrobiną mleka, namocz w tym pieczywo i usmaż z obu stron na złoto.',1],
      [/omlet/,'Roztrzep jajka, wlej na rozgrzaną patelnię i smaż pod przykryciem 3–4 minuty.',1],
      [/jajecznic|tofucznic/,'Wbij jajka (albo pokruszone tofu) na patelnię i mieszaj, aż się zetną.',1],
      [/plack|pancake|naleśnik/,'Wymieszaj składniki ciasta i smaż małe placki z obu stron po 2–3 minuty.',1],
      [/wrap|tortill/,'Rozłóż placek, ułóż na nim składniki i zwiń.',0],
      [/kanapk|grzank|bułk/,'Posmaruj pieczywo i ułóż na nim dodatki.',0],
      [/sałatk/,'Pokrój składniki i wymieszaj je w dużej misce.',0]];
    const dm=DISH.find(([re,,egg])=>re.test(dish)&&(!egg||has('jajko')||(has('tofu')&&/tofucznic/.test(dish))));
    const S=[];
    const boil=any(BOIL);
    if(boil)S.push(`Ugotuj ${nm(boil)} według opisu na opakowaniu.`);
    if(has('ziemniaki')||has('bataty'))S.push(`Ugotuj albo upiecz ${has('bataty')?'bataty':'ziemniaki'} (ok. 20 minut).`);
    const meat=any(MEAT),fish=any(FISH);
    if(meat)S.push(`Dopraw ${nm(meat)} solą, pieprzem i ziołami. Upiecz albo usmaż${fat?' na odrobinie tłuszczu':''}, aż w środku nie będzie różowe.`);
    else if(fish)S.push(`Dopraw rybę i upiecz ją w 180°C przez ok. 15 minut.`);
    if(veg.length)S.push(`Umyj i pokrój warzywa${veg.length===1?' ('+nm(veg[0])+')':''}.${has('jajko')||meat||has('tofu')?'':' Możesz je krótko podsmażyć albo podać na surowo.'}`);
    if(dm)S.push(dm[1]);
    if(has('jajko')&&!(dm&&dm[2]))S.push(veg.length?'Podsmaż warzywa, wlej roztrzepane jajka i smaż 3–4 minuty pod przykryciem.':'Usmaż jajka albo ugotuj je na twardo (ok. 9 minut).');
    if(has('tofu'))S.push('Pokrój tofu w kostkę i podsmaż na złoto.');
    if(['fasola','soczewica','ciecierzyca'].some(has))S.push('Odcedź i przepłucz strączki.');
    if(has('owsiane')||has('musli'))S.push(`Zalej ${has('owsiane')?'płatki':'musli'} mlekiem albo gorącą wodą i odstaw na 5 minut.`);
    const sp=any(SPOON);
    if(sp&&!has('owsiane'))S.push(`Przełóż ${nm(sp)} do miseczki.`);
    if(fruit.length)S.push(`Dodaj owoce${fruit.length===1?' ('+nm(fruit[0])+')':''}.`);
    if(nuts)S.push(`Posyp ${nm(nuts.id)}.`);
    const bread=any(BREAD);
    if(!(dm&&/kanapk|grzank|bułk|tost|wrap/.test(dish)))S.push(bread?`Podawaj z pieczywem (${nm(bread)}).`:dm&&/sałatk/.test(dish)?'Dopraw do smaku i podawaj.':'Połącz wszystko na talerzu i dopraw do smaku.');
    const out=S.length<3?['Przygotuj składniki według listy.'].concat(S):S;
    if(out.length>5)return out.slice(0,4).concat(out[out.length-1]);
    return out;
  }

  /* ───────── Stan widoków ───────── */
  const REG={};
  let seq=0;
  function register(id,vm,opts){
    opts=opts||{};
    const prev=REG[id];
    const st=prev?prev.st:{tab:opts.tab||'today',day:opts.day!=null?opts.day:vm.today,edit:'',choice:Object.assign({},opts.choice||{})};
    st.day=Math.min(Math.max(0,st.day),Math.max(0,vm.days.length-1));
    // Wybory klienta („Zamień posiłek”) dotyczą tylko tego planu: po zmianie planu znikają, gdy wskazują nieistniejący posiłek.
    Object.keys(st.choice).forEach(k=>{const[a,b]=String(st.choice[k]).split(':').map(Number);if(!(vm.days[a]&&vm.days[a].meals[b]))delete st.choice[k];});
    REG[id]={vm,opts,st,get el(){const d=doc();return d?d.querySelector('[data-dpv-id="'+id+'"]'):null;}};
    return REG[id];
  }
  /** Wstawia widok do elementu (stan zakładek zostaje przy kolejnych wywołaniach z tym samym data-dpv-id). */
  function mount(el,vm,opts){
    if(!el)return null;
    const id=el.getAttribute('data-dpv-id')||('dpv'+(++seq));
    el.setAttribute('data-dpv-id',id);
    register(id,vm,opts);
    el.innerHTML=html(id);
    return id;
  }
  /** HTML widoku jako tekst (dla ekranów renderowanych z tekstu); akcje znajdą element po data-dpv-id. */
  function render(id,vm,opts){register(id,vm,opts);return`<div class="dpv-host" data-dpv-id="${esc(id)}">${html(id)}</div>`;}
  function rerender(id){const R=REG[id];const el=R&&R.el;if(el)el.innerHTML=html(id);}

  const TABS=[['today','Dzisiaj'],['week','Cały tydzień'],['swaps','Zamienniki'],['shop','Lista zakupów'],['tips','Wskazówki']];
  function html(id){
    const R=REG[id],vm=R.vm,st=R.st,o=R.opts;
    const tabs=TABS.filter(([k])=>k!=='week'||vm.isWeek);
    if(!tabs.some(([k])=>k===st.tab))st.tab='today';
    const tablist=`<div class="dpv-tabs" role="tablist" aria-label="Plan żywieniowy">${tabs.map(([k,l])=>`<button type="button" role="tab" class="dpv-tab${st.tab===k?' is-on':''}" aria-selected="${st.tab===k}" data-dpv-tab="${k}" onclick="dpvTab('${id}','${k}')">${l==='Dzisiaj'&&!vm.isWeek?'Jadłospis':l}</button>`).join('')}</div>`;
    const body={today:todayHTML,week:weekHTML,swaps:swapsHTML,shop:shopHTML,tips:tipsHTML}[st.tab](id);
    return`<div class="dpv${o.mode==='trainer'?' dpv-trainer':''}" data-dpv-mode="${esc(o.mode||'client')}">${headHTML(vm)}${o.mode==='trainer'?trainerBarHTML(id):''}${tablist}<div class="dpv-body" role="tabpanel" data-dpv-body="${st.tab}">${body}</div></div>`;
  }
  function headHTML(vm){
    const tiles=[[r(vm.kcal),'kcal'],[vm.p+' g','białko'],[vm.f+' g','tłuszcze'],[vm.c+' g','węglowodany']];
    return`<header class="dpv-head" data-dpv-head>
      <div class="dpv-eyebrow">Plan żywieniowy — ${esc(vm.period)}</div>
      <h1 class="dpv-title">${vm.first?esc(vm.first):'Twój plan'}</h1>
      <div class="dpv-goal"><span class="dpv-goal-lbl">Cel</span> ${esc(vm.goal)}</div>
      <div class="dpv-targets" data-dpv-targets>${tiles.map(([v,l])=>`<div class="dpv-target"><b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>
      <div class="dpv-meta"><span>${vm.mealsN} ${vm.mealsN>=5?'posiłków':'posiłki'} dziennie</span>${vm.water?`<span>Woda ${plNum(vm.water[0])}–${plNum(vm.water[1])} l</span>`:''}</div>
      <p class="dpv-flexnote">Plan jest elastyczny — korzystaj z zamienników.</p>
    </header>`;
  }
  function trainerBarHTML(id){
    const o=REG[id].opts;
    const b=(act,l,extra)=>`<button type="button" class="dpv-btn dpv-btn-sm" data-dpv-tact="${act}" onclick="dpvAct('${id}','${act}')"${extra||''}>${l}</button>`;
    return`<div class="dpv-tbar" data-dpv-tbar role="toolbar" aria-label="Akcje trenera">${b('shop','Wygeneruj listę zakupów')}${b('preview','Podgląd wydruku')}${b('print','Drukuj / Zapisz PDF')}${o.onSend?b('send','Wyślij do klienta'):''}</div>`;
  }
  function dayChips(id){
    const R=REG[id],vm=R.vm,st=R.st;
    if(vm.days.length<2)return'';
    return`<div class="dpv-days" role="group" aria-label="Dzień">${vm.days.map((d,i)=>`<button type="button" class="dpv-day${i===st.day?' is-on':''}" aria-pressed="${i===st.day}" data-dpv-day="${i}" onclick="dpvDay('${id}',${i})">${esc(d.short)}${i===vm.today&&vm.days.length===7?'<span class="dpv-dot" aria-label="dziś"></span>':''}</button>`).join('')}</div>`;
  }
  function dayLabel(vm,d,i){
    const t=d.type==='trening'?'dzień treningowy':d.type==='wolny'?'dzień bez treningu':'';
    return`${esc(d.name)}${i===vm.today&&vm.days.length===7?' (dziś)':''}${t?' · '+t:''}`;
  }
  function todayHTML(id){
    const R=REG[id],vm=R.vm,st=R.st;
    const d=vm.days[st.day];
    if(!d)return'<p class="dpv-muted">Brak posiłków w planie.</p>';
    return`${dayChips(id)}<div class="dpv-dayhead"><h2 class="dpv-h2" data-dpv-dayname>${dayLabel(vm,d,st.day)}</h2><span class="dpv-muted">${macroShort(d.total)}</span></div>
      <div class="dpv-meals">${d.meals.map((m,mi)=>mealHTML(id,st.day,mi)).join('')}</div>${dayTipsHTML(vm,d)}`;
  }
  function shownMeal(id,di,mi){
    const R=REG[id],d=R.vm.days[di],ch=R.st.choice[di+':'+mi];
    if(ch){const[a,b]=ch.split(':').map(Number);const alt=R.vm.days[a]&&R.vm.days[a].meals[b];if(alt)return{m:alt,from:R.vm.days[a].name};}
    return{m:d.meals[mi],from:''};
  }
  function mealHTML(id,di,mi){
    const R=REG[id],o=R.opts,{m,from}=shownMeal(id,di,mi);
    const key=di+'-'+mi,title=mealTitle(m);
    const img=m.img?`<img class="dpv-img" src="${esc((o.base||'')+'assets/dania/'+m.img)}" alt="${esc(title)}" loading="lazy" width="88" height="88">`:'';
    const items=`<ul class="dpv-ings">${m.items.map(it=>{const f=food(it.id),h=home(it.id,it.amount);return`<li><span class="dpv-ing-n">${esc(shortName(f))}</span><span class="dpv-ing-a"><b>${esc(amt(it.id,it.amount))}</b>${h?`<span class="dpv-home">${esc(h)}</span>`:''}</span></li>`;}).join('')}</ul>`;
    const sw=m.items.filter(it=>it.swaps.length);
    const swaps=sw.length?`<details class="dpv-swaps" data-dpv-swaps="${key}"><summary>Zamienniki produktów <span class="dpv-muted">(${sw.length})</span></summary>${sw.map(it=>swapRowHTML(it)).join('')}</details>`:'';
    const stepsList=steps(m);
    const trainer=o.mode==='trainer';
    const acts=`<div class="dpv-acts"><button type="button" class="dpv-btn" aria-expanded="false" aria-controls="dpv-prep-${id}-${key}" data-dpv-prep="${key}" onclick="dpvTogglePrep(this)">Pokaż przygotowanie</button><button type="button" class="dpv-btn" data-dpv-swapmeal="${key}" onclick="dpvSwapMeal('${id}',${di},${mi})">Zamień posiłek</button></div>`;
    const prep=`<div class="dpv-prep" id="dpv-prep-${id}-${key}" hidden><ol class="dpv-steps">${stepsList.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`;
    const tacts=trainer?`<div class="dpv-tacts" role="group" aria-label="Edycja posiłku">${[['edit','Edytuj posiłek'],['item','Zmień składnik'],['addswap','Dodaj zamiennik'],['kcal','Zmień kaloryczność'],['copy','Skopiuj posiłek na inny dzień']].map(([k,l])=>`<button type="button" class="dpv-link" data-dpv-edit="${k}" onclick="dpvEdit('${id}',${di},${mi},'${k}')">${l}</button>`).join('')}</div>`:'';
    const editor=trainer&&R.st.edit&&R.st.edit.key===key?editorHTML(id,di,mi):'';
    const alt=R.st.altOpen===key?altHTML(id,di,mi):'';
    return`<article class="dpv-meal${img?'':' no-img'}" data-dpv-meal="${key}">
      <div class="dpv-meal-main">
        <div class="dpv-slot">${mi+1}. ${esc(m.slot||'Posiłek')}${m.edited||m.swapped?' <span class="dpv-tag">zmieniony</span>':''}${from?` <span class="dpv-tag">z dnia: ${esc(from)}</span>`:''}</div>
        <h3 class="dpv-name">${esc(title)}</h3>
        <div class="dpv-info">${m.min?`<span class="dpv-time">${m.min} min</span>`:''}<span class="dpv-macros">${macroLine(m.total)}</span></div>
      </div>${img}
      <div class="dpv-meal-rest">${items}${acts}${prep}${alt}${swaps}${tacts}${editor}</div>
    </article>`;
  }
  function swapRowHTML(it){
    const f=food(it.id),m0=macros(it.id,it.amount);
    const tile=(id,a,cur)=>{const mm=macros(id,a);return`<div class="dpv-tile${cur?' is-cur':''}"><b>${esc(shortName(food(id)))} <span class="dpv-nw">${esc(amt(id,a))}</span></b><span>${macroShort(mm)}</span></div>`;};
    return`<div class="dpv-swaprow"><div class="dpv-swapfor">Zamiast: ${esc(shortName(f).toLowerCase())}</div><div class="dpv-tiles">${tile(it.id,it.amount,true)}${it.swaps.map(s=>tile(s.id,s.amount)).join('')}</div>${m0?'':''}</div>`;
  }
  /** „Zamień posiłek” u klienta: ten sam posiłek z innych dni tygodnia, o podobnej kaloryczności. */
  function alternatives(id,di,mi){
    const vm=REG[id].vm,base=vm.days[di].meals[mi];
    const out=[],seen=new Set([mealTitle(base)]);
    vm.days.forEach((d,a)=>d.meals.forEach((m,b)=>{
      if(a===di||m.slot!==base.slot)return;
      const t=mealTitle(m);if(seen.has(t))return;
      if(Math.abs(m.total.kcal-base.total.kcal)>Math.max(80,base.total.kcal*0.15))return;
      seen.add(t);out.push({a,b,m,day:d.name});
    }));
    return out.sort((x,y)=>Math.abs(x.m.total.kcal-base.total.kcal)-Math.abs(y.m.total.kcal-base.total.kcal)).slice(0,4);
  }
  function altHTML(id,di,mi){
    const list=alternatives(id,di,mi),cur=REG[id].st.choice[di+':'+mi];
    if(!list.length)return`<div class="dpv-alt" data-dpv-alt><p class="dpv-muted">W tym tygodniu nie ma innego posiłku o podobnej kaloryczności. Możesz zamienić produkty (niżej) albo napisać do trenera.</p></div>`;
    return`<div class="dpv-alt" data-dpv-alt><div class="dpv-lbl">Wybierz inny posiłek o podobnej kaloryczności</div><div class="dpv-tiles">${list.map(x=>`<button type="button" class="dpv-tile dpv-tile-btn${cur===x.a+':'+x.b?' is-cur':''}" onclick="dpvPickAlt('${id}',${di},${mi},'${x.a}:${x.b}')"><b>${esc(mealTitle(x.m))}</b><span>${macroShort(x.m.total)} · ${esc(x.day)}</span></button>`).join('')}${cur?`<button type="button" class="dpv-tile dpv-tile-btn" onclick="dpvPickAlt('${id}',${di},${mi},'')"><b>Wróć do planu</b><span>posiłek od trenera</span></button>`:''}</div></div>`;
  }
  function dayTipsHTML(vm,d){
    const move=d.type==='trening'?'Trening według planu i krótki spacer':d.type==='wolny'?'Spacer 20–30 minut':'Spacer 20 minut';
    const rows=[['Woda',vm.water?`Cel: ${plNum(vm.water[0])}–${plNum(vm.water[1])} l`:'Cel: 2–2,5 l'],['Ruch',move],['Najważniejszy nawyk',vm.habit]];
    if(vm.note)rows.push(['Notatka trenera',vm.note]);
    return`<section class="dpv-daytips" data-dpv-daytips aria-label="Wskazówki na dzień"><h3 class="dpv-h3">Wskazówki na dziś</h3><dl class="dpv-tipgrid">${rows.map(([k,v])=>`<div class="dpv-tipcell"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
  }
  function weekHTML(id){
    const vm=REG[id].vm,o=REG[id].opts;
    return`<div class="dpv-week">${vm.days.map((d,i)=>`<section class="dpv-wday${i===vm.today&&vm.days.length===7?' is-today':''}" data-dpv-wday="${i}">
      <div class="dpv-wday-h"><h2 class="dpv-h3">${dayLabel(vm,d,i)}</h2><span class="dpv-muted">${r(d.total.kcal)} kcal</span></div>
      <ol class="dpv-wlist">${d.meals.map((m,mi)=>`<li>${m.img?`<img src="${esc((o.base||'')+'assets/dania/'+m.img)}" alt="" loading="lazy" width="40" height="40">`:'<span class="dpv-noimg" aria-hidden="true"></span>'}<span class="dpv-wl-t"><span class="dpv-muted">${mi+1}. ${esc(m.slot)}</span><b>${esc(mealTitle(m))}</b></span><span class="dpv-wl-k">${r(m.total.kcal)} kcal</span></li>`).join('')}</ol>
      <button type="button" class="dpv-btn dpv-btn-sm" onclick="dpvOpenDay('${id}',${i})">Otwórz dzień</button></section>`).join('')}</div>`;
  }
  /** Zamienniki: każdy produkt z planu raz, z porcją z pierwszego posiłku i zamiennikami o tym samym głównym składniku. */
  function swapsHTML(id){
    const vm=REG[id].vm,seen={};
    vm.days.forEach(d=>d.meals.forEach(m=>m.items.forEach(it=>{if(it.swaps.length&&!seen[it.id])seen[it.id]=it;})));
    const groups=[['p','Źródła białka','Zamiennik daje tyle samo białka.'],['c','Węglowodany','Zamiennik daje tyle samo węglowodanów.'],['f','Tłuszcze','Zamiennik daje tyle samo tłuszczu.'],['x','Dodatki','']];
    const list=Object.values(seen);
    if(!list.length)return'<p class="dpv-muted">W tym planie nie ma zamienników.</p>';
    return`<p class="dpv-lead">Możesz zamienić produkt na inny z tej samej grupy. Ilości dotyczą przykładowej porcji z planu.</p>${groups.map(([role,l,d])=>{const g=list.filter(it=>(it.role||'x')===role);return g.length?`<section class="dpv-swapgroup"><h3 class="dpv-h3">${l}</h3>${d?`<p class="dpv-muted">${d}</p>`:''}${g.map(swapRowHTML).join('')}</section>`:'';}).join('')}`;
  }
  const SHOP_SECTIONS=[['Mięso, wędliny i ryby',['mieso','wedlina','ryby']],['Nabiał, jaja i sery',['nabial','ser']],['Strączki i tofu',['roslinne']],['Pieczywo i płatki',['zboza']],['Kasze, ryż, makaron, ziemniaki',['skrobia']],['Tłuszcze, orzechy, nasiona',['orzechy','nasiona','oleje','pasty']],['Owoce',['owoce']],['Warzywa',['warzywa']],['Inne',['dodatki']]];
  function shopGroups(vm){
    const used=new Set();
    const out=SHOP_SECTIONS.map(([l,subs])=>{const items=vm.shop.filter(s=>subs.includes(food(s.id).sub));items.forEach(s=>used.add(s.id));return{l,items};}).filter(g=>g.items.length);
    const rest=vm.shop.filter(s=>!used.has(s.id));if(rest.length)out.push({l:'Inne',items:rest});
    return out;
  }
  function shopHTML(id){
    const R=REG[id],vm=R.vm,o=R.opts;
    const done=new Set(o.shopDone?o.shopDone():[]);
    const span=vm.shopDays===7?'na tydzień':vm.shopDays===1?'na 1 dzień':'na '+vm.shopDays+' dni';
    return`<div class="dpv-shop" data-dpv-shop><p class="dpv-lead">Lista ${span}${vm.people>1?', dla '+vm.people+' osób':''}. ${o.onShopToggle?'Odhacz, co już masz.':''}</p>
      ${shopGroups(vm).map(g=>`<section class="dpv-shopgroup"><h3 class="dpv-h3">${esc(g.l)}</h3><ul class="dpv-shoplist">${g.items.map(s=>{const on=done.has(s.id);return`<li>${o.onShopToggle?`<label class="dpv-check${on?' is-on':''}"><input type="checkbox" data-dpv-item="${esc(s.id)}"${on?' checked':''} onchange="dpvShop('${id}','${esc(s.id)}',this.checked)">`:'<span class="dpv-check">'}<span class="dpv-shop-n">${esc(shortName(food(s.id)))}</span><b class="dpv-shop-a">${esc(shopAmt(s.id,s.amount))}</b>${o.onShopToggle?'</label>':'</span>'}</li>`;}).join('')}</ul></section>`).join('')}
      <p class="dpv-muted">Ilości orientacyjne. Ryż, makaron, kasze i płatki liczone na sucho, mięso i ryby na surowo.</p></div>`;
  }
  function tipsHTML(id){
    const R=REG[id],vm=R.vm,o=R.opts;
    const note=o.mode==='trainer'&&o.onNote?`<label class="dpv-lbl" for="dpv-note-${id}">Notatka trenera dla klienta</label><textarea class="dpv-input" id="dpv-note-${id}" rows="3" data-dpv-note placeholder="Np. w weekend możesz zjeść obiad na mieście, wybierz danie z mięsem i warzywami">${esc(vm.note)}</textarea><div class="dpv-acts"><button type="button" class="dpv-btn" onclick="dpvSaveNote('${id}')">Zapisz notatkę</button></div>`
      :vm.note?`<div class="dpv-tipcard"><b>Notatka trenera</b><p>${esc(vm.note)}</p></div>`:'';
    const tips=[
      ['Woda',vm.water?`Pij ${plNum(vm.water[0])}–${plNum(vm.water[1])} l dziennie. Butelka pod ręką bardzo pomaga.`:'Pij 2–2,5 l dziennie. Butelka pod ręką bardzo pomaga.'],
      ['Ruch','W dni bez treningu idź na spacer 20–30 minut.'],
      ['Najważniejszy nawyk',vm.habit+'.'],
      ['Zamienniki','Nie masz produktu? Weź zamiennik z karty posiłku albo z zakładki „Zamienniki”.'],
      ['Ważenie','Ryż, makaron, kasze i płatki waż na sucho, mięso i ryby na surowo.'],
      ['Gorszy dzień','Jeden zjedzony inaczej posiłek nic nie psuje. Wróć do planu przy następnym.']
    ];
    return`<div class="dpv-tips">${note}${tips.map(([k,v])=>`<div class="dpv-tipcard"><b>${k}</b><p>${esc(v)}</p></div>`).join('')}<p class="dpv-muted">To orientacyjny plan od trenera. Jeśli coś nie pasuje, napisz na czacie.</p></div>`;
  }

  /* ───────── Edycja trenera ───────── */
  function editorHTML(id,di,mi){
    const R=REG[id],m=R.vm.days[di].meals[mi],focus=R.st.edit.focus;
    const D=DP(),all=D?D.DIET_FOODS:[];
    const opts=(cur,same)=>all.filter(f=>!same||f.group===food(cur).group||f.sub===food(cur).sub).map(f=>`<option value="${esc(f.id)}"${f.id===cur?' selected':''}>${esc(shortName(f))}</option>`).join('');
    const rows=m.items.map((it,k)=>`<div class="dpv-erow" data-dpv-erow="${k}"><select class="dpv-input" data-dpv-eitem="${k}" aria-label="Składnik ${k+1}" onchange="dpvEditItem('${id}',${k},this.value)">${opts(it.id,true)}</select><input class="dpv-input dpv-num" type="number" min="0" step="${food(it.id).unit==='szt'?1:5}" value="${it.amount}" data-dpv-eamt="${k}" aria-label="Ilość ${k+1}"><span class="dpv-unit">${esc(food(it.id).unit==='szt'?'szt.':food(it.id).unit||'g')}</span><button type="button" class="dpv-x" aria-label="Usuń składnik" onclick="dpvEditRemove('${id}',${k})">✕</button></div>`).join('');
    const days=R.vm.days.map((d,i)=>i===di?'':`<option value="${i}">${esc(d.name)}</option>`).join('');
    const sec=(k,l,body)=>`<fieldset class="dpv-fs${focus===k?' is-focus':''}" data-dpv-fs="${k}"><legend>${l}</legend>${body}</fieldset>`;
    return`<div class="dpv-editor" data-dpv-editor role="region" aria-label="Edycja posiłku">
      ${sec('edit','Nazwa posiłku',`<input class="dpv-input" data-dpv-ename value="${esc(m.dish||'')}" placeholder="${esc(mealTitle(m))}" aria-label="Nazwa posiłku">`)}
      ${sec('item','Składniki i ilości',rows+`<button type="button" class="dpv-link" onclick="dpvEditAddItem('${id}')">+ Dodaj składnik</button><p class="dpv-muted">Zmiana składnika dobiera ilość tak, żeby dawał tyle samo białka, węglowodanów albo tłuszczu.</p>`)}
      ${sec('addswap','Dodaj zamiennik',`<div class="dpv-erow"><select class="dpv-input" data-dpv-sfor aria-label="Dla składnika">${m.items.map((it,k)=>`<option value="${k}">${esc(shortName(food(it.id)))}</option>`).join('')}</select><select class="dpv-input" data-dpv-sprod aria-label="Zamiennik">${opts('',false)}</select><button type="button" class="dpv-btn dpv-btn-sm" onclick="dpvEditAddSwap('${id}')">Dodaj</button></div>`)}
      ${sec('kcal','Kaloryczność posiłku',`<div class="dpv-erow"><input class="dpv-input dpv-num" type="number" min="50" step="10" value="${r(m.total.kcal)}" data-dpv-ekcal aria-label="Kalorie posiłku"><span class="dpv-unit">kcal</span><button type="button" class="dpv-btn dpv-btn-sm" onclick="dpvEditKcal('${id}')">Przelicz ilości</button></div><p class="dpv-muted">Ilości wszystkich składników zmienią się w tej samej proporcji.</p>`)}
      ${sec('steps','Przygotowanie (jeden krok w wierszu, najwyżej 5)',`<textarea class="dpv-input" rows="4" data-dpv-esteps aria-label="Kroki przygotowania">${esc(steps(m).join('\n'))}</textarea>`)}
      ${sec('copy','Skopiuj posiłek na inny dzień',R.vm.days.length>1?`<div class="dpv-erow"><select class="dpv-input" data-dpv-copyday aria-label="Dzień">${days}</select><button type="button" class="dpv-btn dpv-btn-sm" onclick="dpvEditCopy('${id}')">Skopiuj</button></div><p class="dpv-muted">Zastąpi ${esc(m.slot||'ten posiłek').toLowerCase()} w wybranym dniu.</p>`:'<p class="dpv-muted">Plan ma jeden dzień.</p>')}
      <div class="dpv-acts"><button type="button" class="dpv-btn dpv-btn-primary" data-dpv-esave onclick="dpvEditSave('${id}')">Zapisz posiłek</button><button type="button" class="dpv-btn" onclick="dpvEditCancel('${id}')">Anuluj</button>${m.edited?`<button type="button" class="dpv-link" onclick="dpvEditReset('${id}')">Przywróć automatyczny</button>`:''}</div>
    </div>`;
  }
  /** Ilość nowego produktu, która daje tyle samo głównego składnika (rola p / c / f, inaczej kcal). */
  function matchAmount(fromId,fromAmt,toId,role){
    const k={p:'p',c:'c',f:'f'}[role]||'kcal';
    const have=macros(fromId,fromAmt)[k],per=macros(toId,food(toId).unit==='szt'?1:100)[k];
    if(!(per>0))return food(toId).unit==='szt'?1:fromAmt;
    const raw=food(toId).unit==='szt'?have/per:have/per*100;
    return roundAmt(toId,raw);
  }
  function readForm(id){
    const R=REG[id],el=R.el,m=R.vm.days[R.st.edit.di].meals[R.st.edit.mi];
    const q=s=>el.querySelector(s);
    const items=m.items.map((it,k)=>{const a=q(`[data-dpv-eamt="${k}"]`);return Object.assign({},it,{amount:a?Math.max(0,+a.value||0):it.amount});}).filter(it=>it.amount>0);
    const st=q('[data-dpv-esteps]'),nm=q('[data-dpv-ename]');
    const stepsV=st?st.value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,5):m.steps;
    const auto=steps(Object.assign({},m,{steps:null}));
    return{slot:m.slot,dish:nm?nm.value.trim():m.dish,img:m.img,min:m.min,items,steps:stepsV&&stepsV.join('\n')!==auto.join('\n')?stepsV:null};
  }
  function setDraft(id,snap){const R=REG[id],m=mealModel(Object.assign({},snap,{edited:true}));R.vm.days[R.st.edit.di].meals[R.st.edit.mi]=m;}
  // Zapis posiłku jako proste dane (bez makro), żeby szkic w kliencie był mały.
  const snapOf=m=>({slot:m.slot,dish:m.dish||'',img:m.img||'',min:m.min||0,items:m.items.map(it=>({id:it.id,amount:it.amount,role:it.role,swaps:it.swaps.map(s=>({id:s.id,amount:s.amount}))})),steps:m.steps||null});
  function commit(id,key,snap){const o=REG[id].opts;if(typeof o.onEdit==='function')o.onEdit(key,snap);}

  /* ───────── Wydruk A4 ───────── */
  const PRINT_CSS=`
.dpvp{font-family:Inter,Arial,Helvetica,sans-serif;color:#1f2328;font-size:10pt;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.dpvp *{box-sizing:border-box}
.dpvp .sheet{width:210mm;min-height:297mm;margin:0 auto 10mm;padding:14mm 13mm 18mm;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18);position:relative}
.dpvp .sheet-foot{position:absolute;left:13mm;right:13mm;bottom:7mm;font-size:8pt;color:#6b7280;display:flex;justify-content:space-between;border-top:.3mm solid #e5e7eb;padding-top:1.5mm}
.dpvp h1{font-size:17pt;margin:0 0 .5mm;line-height:1.15}
.dpvp .eyebrow{font-size:8.5pt;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;font-weight:700}
.dpvp .goal{font-size:10.5pt;margin:0 0 2mm}
.dpvp .targets{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;margin:0 0 2mm}
.dpvp .targets div{border:.3mm solid #e5e7eb;border-radius:2mm;padding:1.2mm 2.5mm;background:#fafafa}
.dpvp .targets b{display:block;font-size:12pt}
.dpvp .targets span{font-size:8.5pt;color:#4b5563}
.dpvp .flexnote{font-size:10pt;color:#374151;margin:0 0 3mm}
.dpvp h2{font-size:13pt;margin:0 0 2mm;padding-bottom:1mm;border-bottom:.4mm solid #d1d5db;break-after:avoid;page-break-after:avoid;display:flex;justify-content:space-between;align-items:baseline;gap:4mm}
.dpvp h2 small{font-size:9pt;font-weight:400;color:#4b5563}
.dpvp .blk{margin-top:0}
.dpvp .newpage{break-before:page;page-break-before:always}
.dpvp .sheet .newpage:first-child{break-before:auto;page-break-before:auto}
.dpvp .meal{border:.3mm solid #e5e7eb;border-radius:2.5mm;padding:2mm 3mm;margin:0 0 2mm;background:#fff;break-inside:avoid;page-break-inside:avoid}
.dpvp .mtop{display:flex;gap:3mm;justify-content:space-between;align-items:flex-start}
.dpvp .mtop img{width:20mm;height:15mm;object-fit:cover;border-radius:1.5mm;flex:0 0 auto}
.dpvp .slot{font-size:8.5pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
.dpvp .mname{font-size:11pt;font-weight:700;margin:.2mm 0 .3mm}
.dpvp .mk{font-size:9pt;color:#374151}
.dpvp .mcols{display:grid;grid-template-columns:1.05fr 1fr;gap:4mm;margin-top:1mm}
.dpvp ul.ings{list-style:none;margin:0;padding:0}
.dpvp ul.ings li{display:flex;justify-content:space-between;gap:2mm;border-bottom:.2mm dotted #d1d5db;padding:.15mm 0;font-size:10pt}
.dpvp ul.ings li b{white-space:nowrap}
.dpvp ol.steps{margin:0;padding-left:4.5mm;font-size:10pt;color:#374151}
.dpvp ol.steps li{margin:0 0 .2mm}
.dpvp .sw{margin-top:1mm;font-size:9pt;color:#4b5563}
.dpvp .sw span{display:inline-block;border:.25mm solid #e5e7eb;border-radius:1.2mm;padding:0 1.4mm;margin:.3mm 1mm 0 0;background:#fafafa}
.dpvp .daytips{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:0 0 5mm;font-size:10pt;break-inside:avoid}
.dpvp .daytips div{border-left:.8mm solid #d1d5db;padding:.6mm 2mm}
.dpvp .daytips b{display:block;font-size:8.5pt;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
.dpvp .shop{columns:3;column-gap:6mm;margin-bottom:2mm}
.dpvp .shop section{break-inside:avoid;margin:0 0 3mm}
.dpvp .shop h3{font-size:9.5pt;margin:0 0 1mm;color:#374151}
.dpvp .shop ul{list-style:none;margin:0;padding:0}
.dpvp .shop li{font-size:9.5pt;display:flex;justify-content:space-between;gap:2mm;border-bottom:.2mm dotted #d1d5db;padding:.4mm 0}
.dpvp .shop li::before{content:"";flex:0 0 3mm;height:3mm;border:.3mm solid #6b7280;border-radius:.6mm;margin-top:.6mm}
.dpvp .shop li span{flex:1}
.dpvp .note{border:.3mm solid #e5e7eb;border-radius:2mm;padding:2mm 3mm;margin-top:3mm;font-size:9.5pt}
.dpvp .small{font-size:8.5pt;color:#6b7280;margin-top:3mm}
@media print{
  @page dpv{size:A4 portrait;margin:14mm 13mm 16mm 13mm;@bottom-left{content:var(--dpv-foot-text);font-family:Arial,sans-serif;font-size:8pt;color:#6b7280}@bottom-right{content:"str. " counter(page);font-family:Arial,sans-serif;font-size:8pt;color:#6b7280}}
  html,body{background:#fff!important;margin:0!important;padding:0!important}
  .dpvp{page:dpv;width:100%!important;max-width:none!important;margin:0!important}
  .dpvp .sheet{width:auto!important;min-height:0!important;margin:0!important;padding:0!important;box-shadow:none!important;break-after:page;page-break-after:always}
  .dpvp .sheet:last-child{break-after:auto;page-break-after:auto}
  .dpvp .sheet-foot{display:none!important}
  .dpvp img{max-width:22mm}
  .dpvp *{position:static!important}
  .dpv-noprint{display:none!important}
}`;
  function printMealHTML(m,i,base){
    const title=mealTitle(m);
    const sw=m.items.filter(it=>it.swaps.length&&it.role!=='x').slice(0,2);
    return`<div class="blk meal"><div class="mtop"><div><div class="slot">${i+1}. ${esc(m.slot)}${m.min?' · '+m.min+' min':''}</div><div class="mname">${esc(title)}</div><div class="mk">${macroLine(m.total)}</div></div>${m.img?`<img src="${esc((base||'')+'assets/dania/'+m.img)}" alt="">`:''}</div>
      <div class="mcols"><ul class="ings">${m.items.map(it=>{const h=home(it.id,it.amount);return`<li><span>${esc(shortName(food(it.id)))}</span><b>${esc(amt(it.id,it.amount))}${h?` <span style="font-weight:400;color:#6b7280">(${esc(h)})</span>`:''}</b></li>`;}).join('')}</ul>
      <ol class="steps">${steps(m).map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>
      ${sw.length?`<div class="sw">Zamienniki: ${sw.map(it=>`<span>${esc(shortName(food(it.id)).toLowerCase())} → ${it.swaps.slice(0,2).map(s=>esc(shortName(food(s.id)).toLowerCase())+' '+esc(amt(s.id,s.amount))).join(' / ')}</span>`).join('')}</div>`:''}</div>`;
  }
  function footText(vm){return`Progress Live · Plan dla ${vm.client||'klienta'} · ${vm.date}`;}
  /** Treść wydruku (bez <html>): kartki A4, każdy dzień od nowej strony, na końcu lista zakupów i wskazówki. */
  function printBody(vm,opts){
    opts=opts||{};
    const base=opts.base||'';
    const foot=footText(vm);
    const head=`<div class="eyebrow">Plan żywieniowy — ${esc(vm.period)}</div><h1>${esc(vm.client||'Plan żywieniowy')}</h1><p class="goal">Cel: <b>${esc(vm.goal)}</b></p>
      <div class="targets"><div><b>${r(vm.kcal)}</b><span>kcal dziennie</span></div><div><b>${vm.p} g</b><span>białko</span></div><div><b>${vm.f} g</b><span>tłuszcze</span></div><div><b>${vm.c} g</b><span>węglowodany</span></div><div><b>${vm.mealsN}</b><span>posiłków dziennie</span></div></div>
      <p class="flexnote">Plan jest elastyczny — korzystaj z zamienników.</p>`;
    const move=d=>d.type==='trening'?'Trening według planu':d.type==='wolny'?'Spacer 20–30 minut':'Spacer 20 minut';
    const blocks=[`<div class="blk head">${head}</div>`];
    vm.days.forEach((d,i)=>{
      blocks.push(`<h2 class="blk" data-dpvp-day="${i}">${esc(d.name)}${d.type?` · ${d.type==='trening'?'dzień treningowy':'dzień bez treningu'}`:''}<small>${macroShort(d.total)}</small></h2>`);
      d.meals.forEach((m,mi)=>blocks.push(printMealHTML(m,mi,base)));
      blocks.push(`<div class="blk daytips"><div><b>Woda</b>${vm.water?`${plNum(vm.water[0])}–${plNum(vm.water[1])} l`:'2–2,5 l'}</div><div><b>Ruch</b>${move(d)}</div><div><b>Nawyk</b>${esc(vm.habit)}</div></div>`);
    });
    const span=vm.shopDays===7?'na tydzień':vm.shopDays===1?'na 1 dzień':'na '+vm.shopDays+' dni';
    blocks.push(`<h2 class="blk newpage" data-dpvp-shop>Lista zakupów ${span}${vm.people>1?' dla '+vm.people+' osób':''}</h2>`);
    blocks.push(`<div class="blk shop">${shopGroups(vm).map(g=>`<section><h3>${esc(g.l)}</h3><ul>${g.items.map(s=>`<li><span>${esc(shortName(food(s.id)))}</span><b>${esc(shopAmt(s.id,s.amount))}</b></li>`).join('')}</ul></section>`).join('')}</div>`);
    if(vm.note)blocks.push(`<div class="blk note"><b>Notatka trenera:</b> ${esc(vm.note)}</div>`);
    blocks.push(`<div class="blk note"><b>Wskazówki:</b> ryż, makaron, kasze i płatki waż na sucho, mięso i ryby na surowo. Nie masz produktu? Weź zamiennik z karty posiłku. Jeden posiłek zjedzony inaczej nic nie psuje.</div>`);
    blocks.push(`<p class="blk small">Orientacyjny plan od trenera, liczony z wartości produktów z bazy USDA. Nie zastępuje porady lekarza ani dietetyka.</p>`);
    return`<div class="dpvp" data-foot="${esc(foot)}"><section class="sheet flow">${blocks.join('')}</section></div>`;
  }
  /* Podział na strony A4 w dokumencie wydruku: te same kartki w podglądzie i na wydruku.
     Bloki (nagłówek, karta posiłku, wskazówki) nie dzielą się; tytuł dnia zostaje z pierwszym posiłkiem.
     Wysokość treści strony: 297 mm − marginesy 14 + 16 mm, z zapasem 3 mm. */
  const PAGINATE=`(function(){
    var root=document.querySelector('.dpvp'),flow=root&&root.querySelector('.flow');if(!flow||root.getAttribute('data-paged'))return;
    var PX=96/25.4,H=264,blocks=[].slice.call(flow.children),hs=blocks.map(function(b){var cs=getComputedStyle(b);return(b.getBoundingClientRect().height+parseFloat(cs.marginTop)+parseFloat(cs.marginBottom))/PX;});
    var pages=[[]],used=0;
    for(var i=0;i<blocks.length;i++){var b=blocks[i],h=hs[i],need=h;if(b.tagName==='H2'&&i+1<blocks.length)need+=hs[i+1];
      if(pages[pages.length-1].length&&(b.classList.contains('newpage')||used+need>H)){pages.push([]);used=0;}
      pages[pages.length-1].push(b);used+=h;}
    var foot=root.getAttribute('data-foot')||'';root.innerHTML='';
    pages.forEach(function(list,n){var s=document.createElement('section');s.className='sheet';s.setAttribute('data-page',n+1);list.forEach(function(b){s.appendChild(b);});
      var f=document.createElement('div');f.className='sheet-foot dpv-noprint';var a=document.createElement('span');a.textContent=foot;var c=document.createElement('span');c.textContent='str. '+(n+1);f.appendChild(a);f.appendChild(c);s.appendChild(f);root.appendChild(s);});
    root.setAttribute('data-paged',String(pages.length));
  })();`;
  /** Osobny dokument HTML do wydruku / PDF. opts: {base, autoprint}. */
  function printHTML(vm,opts){
    opts=opts||{};
    const foot=footText(vm).replace(/["\\<>]/g,'');
    // Treść stopki jako tekst w @page (zmienne CSS nie działają w polach strony we wszystkich przeglądarkach).
    const css=PRINT_CSS.replace('content:var(--dpv-foot-text)','content:"'+foot+'"');
    return'<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+(opts.base?'<base href="'+esc(opts.base)+'">':'')+
      '<title>Plan żywieniowy'+(vm.client?' – '+esc(vm.client):'')+'</title><style>body{margin:0;background:#e5e7eb;padding:8mm 0}'+css+'@media print{body{padding:0!important;background:#fff!important}}</style></head><body>'+
      printBody(vm,{base:''})+'<script>'+PAGINATE+'<\/script>'+(opts.autoprint?'<script>window.addEventListener("load",function(){setTimeout(function(){try{window.print();}catch(e){}},400);});<\/script>':'')+'</body></html>';
  }
  function baseURL(){try{return String(root.location.href).split('#')[0].split('?')[0].replace(/[^/]*$/,'');}catch(e){return'';}}
  /** Podgląd wydruku: okno z dokładnie tym dokumentem, który pójdzie do drukarki / PDF. */
  function preview(vm,opts){
    opts=opts||{};
    const d=doc();if(!d)return null;
    close();
    const ov=d.createElement('div');
    ov.id='dpv-preview';ov.className='dpv-preview';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Podgląd wydruku');
    ov.innerHTML=`<div class="dpv-preview-bar"><b>Podgląd wydruku · A4</b><span class="dpv-muted">Tak będzie wyglądać wydruk i PDF.</span><span class="dpv-grow"></span><button type="button" class="dpv-btn dpv-btn-primary" data-dpv-pprint>Drukuj / Zapisz PDF</button><button type="button" class="dpv-btn" data-dpv-pclose>Zamknij</button></div><iframe class="dpv-preview-frame" title="Podgląd wydruku planu"></iframe>`;
    d.body.appendChild(ov);
    const fr=ov.querySelector('iframe');
    fr.srcdoc=printHTML(vm,{base:opts.base||baseURL()});
    ov.querySelector('[data-dpv-pclose]').onclick=close;
    ov.querySelector('[data-dpv-pprint]').onclick=()=>{try{fr.contentWindow.focus();fr.contentWindow.print();}catch(e){}};
    const key=e=>{if(e.key==='Escape'){close();}};
    d.addEventListener('keydown',key);ov._key=key;
    setTimeout(()=>{const b=ov.querySelector('[data-dpv-pprint]');if(b)b.focus();},0);
    if(opts.print)fr.addEventListener('load',()=>{try{fr.contentWindow.focus();fr.contentWindow.print();}catch(e){}},{once:true});
    return ov;
  }
  function close(){const d=doc(),ov=d&&d.getElementById('dpv-preview');if(ov){if(ov._key)d.removeEventListener('keydown',ov._key);ov.remove();}}

  /* Ctrl+P na ekranie z planem: drukuje się tylko plan (bez menu, paska i przycisków aplikacji). */
  function visibleRoot(){
    const d=doc();if(!d)return null;
    const els=[...d.querySelectorAll('[data-dpv-id]')].filter(el=>el.offsetParent!==null||el.getClientRects().length);
    return els.length?REG[els[0].getAttribute('data-dpv-id')]:null;
  }
  function beforePrint(){
    const d=doc();if(!d||d.getElementById('dpv-preview'))return;
    const R=visibleRoot();if(!R)return;
    let host=d.getElementById('dpv-print-host');
    if(!host){host=d.createElement('div');host.id='dpv-print-host';d.body.appendChild(host);}
    const foot=footText(R.vm).replace(/["\\<>]/g,'');
    host.innerHTML='<style>'+PRINT_CSS.replace('content:var(--dpv-foot-text)','content:"'+foot+'"')+'</style>'+printBody(R.vm,{base:R.opts.base||''});
    d.body.classList.add('dpv-printing');
  }
  function afterPrint(){const d=doc();if(!d)return;d.body.classList.remove('dpv-printing');const h=d.getElementById('dpv-print-host');if(h)h.remove();}
  if(root.addEventListener){root.addEventListener('beforeprint',beforePrint);root.addEventListener('afterprint',afterPrint);}

  /* ───────── Akcje (onclick) ───────── */
  const G={
    dpvTab:(id,t)=>{const R=REG[id];if(!R)return;R.st.tab=t;R.st.edit='';rerender(id);},
    dpvDay:(id,i)=>{const R=REG[id];if(!R)return;R.st.day=i;R.st.edit='';R.st.altOpen='';rerender(id);if(R.opts.onDay)R.opts.onDay(i);},
    dpvOpenDay:(id,i)=>{const R=REG[id];if(!R)return;R.st.day=i;R.st.tab='today';rerender(id);if(R.opts.onDay)R.opts.onDay(i);},
    dpvTogglePrep:btn=>{const p=doc().getElementById(btn.getAttribute('aria-controls'));if(!p)return;const open=p.hidden;p.hidden=!open;btn.setAttribute('aria-expanded',String(open));btn.textContent=open?'Ukryj przygotowanie':'Pokaż przygotowanie';},
    dpvSwapMeal:(id,di,mi)=>{const R=REG[id];if(!R)return;if(R.opts.mode==='trainer'&&typeof R.opts.onSwapMeal==='function'){R.opts.onSwapMeal(di,mi);return;}const k=di+'-'+mi;R.st.altOpen=R.st.altOpen===k?'':k;rerender(id);},
    dpvPickAlt:(id,di,mi,v)=>{const R=REG[id];if(!R)return;if(v)R.st.choice[di+':'+mi]=v;else delete R.st.choice[di+':'+mi];R.st.altOpen='';rerender(id);if(R.opts.onChoice)R.opts.onChoice(R.st.choice);},
    dpvShop:(id,item,on)=>{const R=REG[id];if(!R||!R.opts.onShopToggle)return;R.opts.onShopToggle(item,on);const el=R.el.querySelector('[data-dpv-item="'+item+'"]');if(el&&el.parentNode)el.parentNode.classList.toggle('is-on',!!on);},
    dpvAct:(id,a)=>{const R=REG[id];if(!R)return;const o=R.opts;
      if(a==='shop'){if(o.onShop)o.onShop();R.st.tab='shop';rerender(id);}
      else if(a==='preview')preview(R.vm,{base:o.base});
      else if(a==='print')preview(R.vm,{base:o.base,print:true});
      else if(a==='send'&&o.onSend)o.onSend();},
    dpvSaveNote:id=>{const R=REG[id];if(!R)return;const t=R.el.querySelector('[data-dpv-note]');if(t&&R.opts.onNote)R.opts.onNote(t.value.trim());},
    dpvEdit:(id,di,mi,focus)=>{const R=REG[id];if(!R)return;R.st.edit={key:di+'-'+mi,di,mi,focus,orig:snapOf(R.vm.days[di].meals[mi])};rerender(id);
      const fs=R.el.querySelector('[data-dpv-fs="'+(focus==='edit'?'edit':focus)+'"]');if(fs){if(fs.scrollIntoView)fs.scrollIntoView({block:'nearest'});const f=fs.querySelector('input,select,textarea');if(f)f.focus();}},
    dpvEditItem:(id,k,val)=>{const R=REG[id];if(!R)return;const cur=readForm(id),it=cur.items[k]||R.vm.days[R.st.edit.di].meals[R.st.edit.mi].items[k];if(!it)return;
      const next=Object.assign({},it,{id:val,amount:matchAmount(it.id,it.amount,val,it.role),swaps:it.swaps.filter(s=>s.id!==val)});
      if(it.id!==val&&!next.swaps.some(s=>s.id===it.id))next.swaps.unshift({id:it.id,amount:it.amount});
      next.swaps=next.swaps.slice(0,4);cur.items[k]=next;setDraft(id,cur);rerender(id);},
    dpvEditRemove:(id,k)=>{const cur=readForm(id);cur.items.splice(k,1);setDraft(id,cur);rerender(id);},
    dpvEditAddItem:id=>{const cur=readForm(id);cur.items.push({id:'pomidor',amount:100,role:'x',swaps:[]});setDraft(id,cur);REG[id].st.edit.focus='item';rerender(id);},
    dpvEditAddSwap:id=>{const R=REG[id];const k=+R.el.querySelector('[data-dpv-sfor]').value,p=R.el.querySelector('[data-dpv-sprod]').value;const cur=readForm(id),it=cur.items[k];if(!it||!p||p===it.id)return;
      it.swaps=it.swaps.filter(s=>s.id!==p);it.swaps.push({id:p,amount:matchAmount(it.id,it.amount,p,it.role)});setDraft(id,cur);R.st.edit.focus='addswap';rerender(id);},
    dpvEditKcal:id=>{const R=REG[id];const target=+R.el.querySelector('[data-dpv-ekcal]').value;const cur=readForm(id);const now=cur.items.reduce((s,it)=>s+macros(it.id,it.amount).kcal,0);
      if(!(target>0)||!(now>0))return;const k=target/now;cur.items=cur.items.map(it=>Object.assign({},it,{amount:roundAmt(it.id,it.amount*k),swaps:it.swaps.map(s=>({id:s.id,amount:roundAmt(s.id,s.amount*k)}))}));setDraft(id,cur);R.st.edit.focus='kcal';rerender(id);},
    dpvEditCopy:id=>{const R=REG[id];const to=+R.el.querySelector('[data-dpv-copyday]').value;const cur=readForm(id);const e=R.st.edit;
      const tgt=R.vm.days[to]&&R.vm.days[to].meals.findIndex(m=>m.slot===cur.slot);const mi=tgt>=0?tgt:e.mi;
      commit(id,to+':'+mi,Object.assign({},cur,{slot:(R.vm.days[to].meals[mi]||{}).slot||cur.slot}));
      if(typeof root.notify==='function')root.notify('Posiłek skopiowany na: '+R.vm.days[to].name);},
    dpvEditSave:id=>{const R=REG[id];const e=R.st.edit;const cur=readForm(id);R.st.edit='';commit(id,e.di+':'+e.mi,cur);},
    dpvEditCancel:id=>{const R=REG[id];const e=R.st.edit;if(e&&e.orig){R.vm.days[e.di].meals[e.mi]=mealModel(e.orig);}R.st.edit='';rerender(id);},
    dpvEditReset:id=>{const R=REG[id];const e=R.st.edit;R.st.edit='';commit(id,e.di+':'+e.mi,null);}
  };
  Object.assign(root,G);

  /** Zmiany trenera (edits: {'dzień:posiłek': posiłek}) nałożone na policzony tydzień DietPlan (zmienia obiekt). */
  function applyEdits(week,edits){
    if(!week||!edits)return week;
    const days=week.days||[week];
    Object.keys(edits).forEach(k=>{
      const[d,m]=k.split(':').map(Number),e=edits[k],day=days[d];
      if(!e||!day||!day.meals||!day.meals[m])return;
      const items=(e.items||[]).map(it=>({id:it.id,amount:+it.amount||0,role:it.role||'x',swaps:(it.swaps||[]).map(s=>({id:s.id,amount:+s.amount||0,m:macros(s.id,+s.amount||0)}))}));
      const total=items.reduce((s,it)=>add(s,macros(it.id,it.amount)),ZERO);
      day.meals[m]=Object.assign({},day.meals[m],{name:day.meals[m].name,dish:e.dish||'',img:e.img||'',minutes:e.min||day.meals[m].minutes,items,total,steps:e.steps||null,edited:true});
    });
    days.forEach(day=>{day.total=day.meals.reduce((s,m)=>add(s,m.total),ZERO);});
    if(week.days)week.shopping=shoppingOf(days.map(d=>({meals:d.meals.map(m=>({items:m.items}))})),week.people||1);
    return week;
  }

  const api={PAGINATE,fromBuilt,fromPublic,mount,render,html:id=>html(id),printHTML,printBody,preview,close,steps,mealTitle,applyEdits,shoppingOf,goalLabel,PRINT_CSS,_reg:REG,baseURL,beforePrint,afterPrint};
  root.DietView=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
