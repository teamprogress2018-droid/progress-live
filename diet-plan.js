// ════════════════════════════════════════
// JADŁOSPIS Z KSIĄŻEK — kalkulator TDEE → przykładowy dzień z gramaturą i zamiennikami
// Każda liczba ma źródło w bazie wiedzy (knowledge/books/*.json). Wartości produktów
// są wyliczone na 100 g z jadłospisów Bean (2009, rozdz. 15; dane brytyjskie
// McCance & Widdowson) — same jadłospisy i przepisy nie są kopiowane.
// Podział energii między posiłki i zestawy posiłków to ustawienia aplikacji.
// ════════════════════════════════════════
(function(root){
'use strict';

const REF={
  sn:'Sports Nutrition 6. wyd. (2017)',
  bean:'Bean, Complete Guide to Sports Nutrition (2009)',
  bk:'Brukner i Khan, Clinical Sports Medicine 4. wyd.',
  ads:'Dietetyka sportowa (ADS)',
  app:'ustawienie aplikacji'
};
function src(ref,pages,status){return{ref,pages:pages||'',status:status||'zrodlo'};}

/** Produkty: wartości na 100 g (albo na sztukę), wyliczone z porcji w jadłospisach Bean. */
const DIET_FOODS=[
  {id:'owsiane',name:'Płatki owsiane (suche)',group:'wegle',unit:'g',kcal:402,p:11.7,c:73.3,f:8.3,max:150,page:'204'},
  {id:'musli',name:'Musli',group:'wegle',unit:'g',kcal:367,p:10,c:66.7,f:8.3,max:120,page:'202'},
  {id:'chleb',name:'Chleb pełnoziarnisty',group:'wegle',unit:'g',kcal:218,p:8.8,c:42.5,f:2.5,max:200,page:'205'},
  {id:'makaron',name:'Makaron (suchy)',group:'wegle',unit:'g',kcal:348,p:12,c:76,f:2,max:180,page:'205'},
  {id:'ryz',name:'Ryż brązowy (suchy)',group:'wegle',unit:'g',kcal:357,p:7.1,c:81.2,f:2.4,max:180,page:'203'},
  {id:'ziemniaki',name:'Ziemniaki pieczone',group:'wegle',unit:'g',kcal:136,p:4,c:31.7,f:0.3,max:550,page:'202'},
  {id:'bataty',name:'Bataty pieczone',group:'wegle',unit:'g',kcal:115,p:1.7,c:28,f:0.3,max:550,page:'206'},
  {id:'wafle',name:'Wafle ryżowe',group:'wegle',unit:'szt',kcal:32,p:0.5,c:7.3,f:0.25,max:8,page:'204'},
  {id:'kurczak',name:'Pierś z kurczaka (grill)',group:'bialko',unit:'g',kcal:147,p:30,c:0,f:3.3,max:250,page:'202'},
  {id:'indyk',name:'Pierś z indyka',group:'bialko',unit:'g',kcal:105,p:23,c:0,f:2,max:250,page:'205'},
  {id:'losos',name:'Łosoś (grill)',group:'bialko',unit:'g',kcal:176,p:20,c:0,f:10.9,max:250,page:'203'},
  {id:'ryba',name:'Biała ryba (grill)',group:'bialko',unit:'g',kcal:96,p:21.1,c:0,f:1.1,max:300,page:'206'},
  {id:'tunczyk',name:'Tuńczyk w wodzie',group:'bialko',unit:'g',kcal:99,p:24,c:0,f:1,max:200,page:'202'},
  {id:'jajko',name:'Jajko',group:'bialko',unit:'szt',kcal:80,p:7,c:0,f:6,max:4,page:'205'},
  {id:'cottage',name:'Serek wiejski (cottage)',group:'bialko',unit:'g',kcal:98,p:14,c:2,f:4,max:300,page:'204'},
  {id:'fasola',name:'Fasola czerwona (ugotowana)',group:'bialko',unit:'g',kcal:100,p:7.1,c:17.6,f:1.2,max:300,page:'220'},
  {id:'tofu',name:'Tofu marynowane',group:'bialko',unit:'g',kcal:73,p:8,c:0.6,f:4,max:300,page:'218'},
  {id:'jogurt',name:'Jogurt naturalny chudy',group:'nabial',unit:'g',kcal:42.5,p:3.8,c:6.2,f:0,max:300,page:'202'},
  {id:'mleko',name:'Mleko odtłuszczone',group:'nabial',unit:'ml',kcal:33,p:3.5,c:5,f:0,max:400,page:'202'},
  {id:'maslo-orz',name:'Masło orzechowe',group:'tluszcz',unit:'g',kcal:605,p:25,c:7.5,f:52.5,max:40,page:'206'},
  {id:'oliwa',name:'Oliwa z oliwek',group:'tluszcz',unit:'g',kcal:900,p:0,c:0,f:100,max:30,page:'202'},
  {id:'hummus',name:'Hummus',group:'tluszcz',unit:'g',kcal:187,p:8,c:12,f:13,max:100,page:'218'},
  {id:'banan',name:'Banan',group:'owoce',unit:'szt',kcal:95,p:1,c:23,f:0,page:'205'},
  {id:'jablko',name:'Jabłko',group:'owoce',unit:'szt',kcal:47,p:0.5,c:12,f:0,page:'202'},
  {id:'pomarancza',name:'Pomarańcza',group:'owoce',unit:'szt',kcal:59,p:2,c:14,f:0,page:'202'},
  {id:'jagody',name:'Owoce jagodowe',group:'owoce',unit:'g',kcal:27,p:1,c:6,f:0,page:'205'},
  {id:'rodzynki',name:'Rodzynki',group:'owoce',unit:'g',kcal:273,p:3.3,c:70,f:0,page:'204'},
  {id:'brokul',name:'Brokuł',group:'warzywa',unit:'g',kcal:24,p:3.2,c:0.8,f:0.8,page:'202'},
  {id:'marchew',name:'Marchew',group:'warzywa',unit:'g',kcal:24,p:0.8,c:4.8,f:0.8,page:'202'},
  {id:'szpinak',name:'Szpinak',group:'warzywa',unit:'g',kcal:19,p:2.4,c:0.8,f:0.8,page:'203'},
  {id:'papryka',name:'Papryka',group:'warzywa',unit:'g',kcal:32,p:1,c:6,f:0,page:'205'},
  {id:'salata',name:'Sałata mieszana',group:'warzywa',unit:'g',kcal:12,p:0.8,c:1.6,f:0,page:'202'},
  {id:'kalafior',name:'Kalafior',group:'warzywa',unit:'g',kcal:28,p:2.4,c:2.4,f:1.2,page:'205'}
];
const FOOD=Object.create(null);
DIET_FOODS.forEach(f=>{FOOD[f.id]=f;});

/** Zestawy posiłków (ustawienie aplikacji): białko + węglowodany + tłuszcz + stałe dodatki. */
const MEAL_TEMPLATES={
  sniadanie:[
    {p:'cottage',c:'chleb',f:'maslo-orz',x:[['papryka',100]]},
    {p:'jajko',c:'chleb',f:null,x:[['szpinak',80]]},
    {p:'cottage',c:'owsiane',f:'maslo-orz',x:[['jagody',100],['mleko',200]]}
  ],
  przekaska:[
    {p:'cottage',c:'wafle',f:null,x:[['jablko',1]]},
    {p:'jogurt',c:'musli',f:null,x:[['banan',1]]},
    {p:'tunczyk',c:'chleb',f:'hummus',x:[['marchew',100]]}
  ],
  obiad:[
    {p:'kurczak',c:'ryz',f:'oliwa',x:[['brokul',150]]},
    {p:'losos',c:'ziemniaki',f:'oliwa',x:[['szpinak',100],['salata',100]]},
    {p:'indyk',c:'makaron',f:'oliwa',x:[['papryka',100],['marchew',100]]},
    {p:'ryba',c:'bataty',f:'oliwa',x:[['kalafior',150]]},
    {p:'fasola',c:'ryz',f:'oliwa',x:[['papryka',150]]}
  ],
  kolacja:[
    {p:'tunczyk',c:'chleb',f:'oliwa',x:[['salata',100],['papryka',100]]},
    {p:'jajko',c:'ziemniaki',f:'oliwa',x:[['szpinak',100]]},
    {p:'indyk',c:'chleb',f:'hummus',x:[['marchew',100]]}
  ]
};
/** Podział energii (ustawienie aplikacji, nie z książek). Białko dzielone po równo. */
const MEAL_LAYOUTS={
  4:[{name:'Śniadanie',slot:'sniadanie',share:0.30},{name:'Obiad',slot:'obiad',share:0.35},{name:'Przekąska',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.25}],
  5:[{name:'Śniadanie',slot:'sniadanie',share:0.25},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.30},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20}],
  6:[{name:'Śniadanie',slot:'sniadanie',share:0.20},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.25},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20},{name:'Przekąska wieczorna',slot:'przekaska',share:0.10}]
};

/** Białko g/kg wg celu (środek zgodnych zakresów książek). */
const PROTEIN_BY_GOAL={
  redukcja:{v:1.8,range:'1,6–2,0',why:'SN: ok. 1,5 i więcej przy dużym deficycie; Bean 1,6; ADS 1,6–2,4',sources:[src('sn','230','wniosek'),src('bean','120'),src('ads','104')]},
  masa:{v:1.8,range:'1,7–2,0',why:'budowa mięśni',sources:[src('sn','230')]},
  sila:{v:1.7,range:'1,6–1,7',why:'trening siłowy',sources:[src('sn','52'),src('bean','199')]},
  kondycja:{v:1.3,range:'1,2–1,4',why:'trening wytrzymałościowy',sources:[src('sn','52'),src('bean','199')]},
  inne:{v:1.6,range:'1,4–2,0',why:'osoby trenujące',sources:[src('sn','230','wniosek')]}
};
/** Węglowodany g/kg wg aktywności (Box 2.1). Klucz = współczynnik PAL kalkulatora. */
function carbRangeForActivity(pal){
  if(pal>=2)return{min:6,max:10,label:'1–3 h treningu dziennie'};
  if(pal>=1.7)return{min:5,max:7,label:'ok. 1 h treningu dziennie'};
  return{min:3,max:5,label:'lekki trening lub redukcja'};
}
const FAT_PCT=25; // SN s. 230: 25–30% energii, nigdy poniżej 20%

function goalKey(goal,delta){
  const g=String(goal||'').toLowerCase();
  if(PROTEIN_BY_GOAL[g])return g;
  if(g==='ksztaltowanie')return'masa';
  if(+delta<0)return'redukcja';
  if(+delta>0)return'masa';
  return'inne';
}

/**
 * Cele dnia wg książek: białko g/kg, tłuszcz 25% energii, reszta węglowodany.
 * o: {weight, age, kcal, rmr, pal, goal, goalDelta}
 */
function dietBookTargets(o){
  o=o||{};
  const weight=+o.weight||0,kcal=Math.round(+o.kcal||0),rmr=Math.round(+o.rmr||0),age=+o.age||0;
  const blocks=[];
  if(age&&age<18)blocks.push({text:'Klient poniżej 18 lat: inne potrzeby wzrostu, automat nie układa diety.',sources:[src('bk','903-904'),src('sn','258','wniosek')]});
  if(rmr&&kcal<rmr)blocks.push({text:'Cel kaloryczny poniżej spoczynkowej przemiany materii ('+rmr+' kcal). Nie schodź poniżej RMR.',sources:[src('bean','121')]});
  if(kcal&&kcal<=1000)blocks.push({text:'Dieta 1000 kcal lub mniej jest niebezpieczna.',sources:[src('bean','121')]});
  const gk=goalKey(o.goal,o.goalDelta);
  const prot=PROTEIN_BY_GOAL[gk];
  const proteinG=Math.round(prot.v*weight);
  const fatG=Math.round(kcal*FAT_PCT/100/9);
  const carbG=Math.max(0,Math.round((kcal-proteinG*4-fatG*9)/4));
  const cr=carbRangeForActivity(+o.pal||0);
  const carbPerKg=weight?Math.round(carbG/weight*10)/10:0;
  const notes=[];
  if(weight&&carbPerKg<cr.min)notes.push({text:'Węglowodanów zostaje '+carbPerKg+' g/kg, mniej niż '+cr.min+'–'+cr.max+' g/kg zalecane przy aktywności „'+cr.label+'”. Rozważ mniejszy deficyt.',sources:[src('sn','22')]});
  if(gk==='redukcja'&&weight&&carbPerKg<4)notes.push({text:'Poniżej 4 g/kg węglowodanów trening zwykle słabnie.',sources:[src('bean','120')]});
  return{
    goal:gk,kcal,rmr,weight,blocked:blocks.length>0,blocks,notes,
    protein:{g:proteinG,perKg:prot.v,range:prot.range,why:prot.why,sources:prot.sources},
    fat:{g:fatG,pct:FAT_PCT,range:'20–35%',sources:[src('sn','62-65, 230')]},
    carbs:{g:carbG,perKg:carbPerKg,range:cr.min+'–'+cr.max+' g/kg',label:cr.label,sources:[src('sn','22')]},
    perMealProtein:{g:Math.round(0.25*weight),sources:[src('sn','49, 53')]}
  };
}

// Małe ilości (oliwa, masło orzechowe) co 1 g, reszta co 5 g.
function round5(x){return x<30?Math.max(0,Math.round(x)):Math.round(x/5)*5;}
function itemMacros(food,amount){
  const k=food.unit==='szt'?amount:amount/100;
  return{kcal:food.kcal*k,p:food.p*k,c:food.c*k,f:food.f*k};
}
function addM(a,b){return{kcal:a.kcal+b.kcal,p:a.p+b.p,c:a.c+b.c,f:a.f+b.f};}
const ZERO={kcal:0,p:0,c:0,f:0};
function sumItems(items,skip){return items.reduce((s,it,i)=>i===skip?s:addM(s,itemMacros(FOOD[it.id],it.amount)),ZERO);}
function clampAmount(food,x){
  if(food.unit==='szt')return Math.max(food.group==='bialko'?1:0,Math.min(food.max||99,Math.round(x)));
  return Math.min(food.max||9999,round5(x));
}

/** Gramatura jednego posiłku: kilka przebiegów dopasowania białka, węglowodanów i tłuszczu. */
function solveMeal(tpl,target){
  const items=[];
  const iP=items.push({id:tpl.p,amount:0,role:'p'})-1;
  const iC=items.push({id:tpl.c,amount:0,role:'c'})-1;
  const iF=tpl.f?items.push({id:tpl.f,amount:0,role:'f'})-1:-1;
  (tpl.x||[]).forEach(([id,amt])=>items.push({id,amount:amt,role:'x'}));
  for(let pass=0;pass<4;pass++){
    const pf=FOOD[tpl.p],cf=FOOD[tpl.c];
    const unit=f=>f.unit==='szt'?1:100;
    items[iC].amount=Math.max(0,(target.c-sumItems(items,iC).c)/cf.c*unit(cf));
    items[iP].amount=Math.max(0,(target.p-sumItems(items,iP).p)/pf.p*unit(pf));
    if(iF>=0){const ff=FOOD[tpl.f];items[iF].amount=Math.max(0,(target.f-sumItems(items,iF).f)/ff.f*unit(ff));}
  }
  items.forEach(it=>{if(it.role!=='x')it.amount=clampAmount(FOOD[it.id],it.amount);});
  // Limit porcji obciął składnik: dobierz drugi produkt na brakującą resztę.
  [['c',['banan','rodzynki']],['p',['cottage','jogurt']],['f',['oliwa','maslo-orz']]].forEach(([key,fill])=>{
    const miss=target[key]-sumItems(items)[key];
    if(miss<=Math.max(3,target[key]*0.08))return;
    const id=fill.find(x=>!items.some(it=>it.id===x));
    if(!id)return;
    const ff=FOOD[id];
    const amt=clampAmount(ff,miss/ff[key]*(ff.unit==='szt'?1:100));
    if(amt>0)items.push({id,amount:amt,role:key});
  });
  return items.filter(it=>it.amount>0);
}

/** Produkty używane w danym posiłku w danej roli (żeby zamiennik pasował do pory dnia). */
function slotPool(slot,role){
  const ids=new Set();
  (MEAL_TEMPLATES[slot]||[]).forEach(tpl=>{if(tpl[role])ids.add(tpl[role]);});
  return ids;
}
/** Zamienniki: inne produkty z tej samej grupy, w ilości dającej tyle samo głównego składnika. */
function swapsFor(item,slot){
  const food=FOOD[item.id];
  const key=item.role==='p'?'p':item.role==='c'?'c':item.role==='f'?'f':null;
  if(!key)return[];
  const groups=item.role==='p'?['bialko']:item.role==='c'?['wegle']:['tluszcz'];
  const amountMain=itemMacros(food,item.amount)[key];
  if(amountMain<=0)return[];
  const pool=slotPool(slot,item.role);
  return DIET_FOODS.filter(f=>f.id!==food.id&&groups.includes(f.group)&&f[key]>0&&(key!=='p'||f.p>=7))
    .sort((a,b)=>(pool.has(b.id)?1:0)-(pool.has(a.id)?1:0))
    .map(f=>({id:f.id,amount:clampAmount(f,amountMain/f[key]*(f.unit==='szt'?1:100))}))
    .filter(s=>s.amount>0&&s.amount<(FOOD[s.id].max||9999))
    .slice(0,3);
}

/**
 * Przykładowy dzień: o = {targets (z dietBookTargets), meals: 4|5|6, variant: liczba}
 */
function dietBuildDay(o){
  const t=o.targets;
  const layout=MEAL_LAYOUTS[o.meals]||MEAL_LAYOUTS[5];
  const variant=Math.max(0,+o.variant||0);
  const n=layout.length;
  const slotCount={};
  const meals=layout.map((m,mi)=>{
    const list=MEAL_TEMPLATES[m.slot];
    const seen=slotCount[m.slot]=(slotCount[m.slot]||0)+1;
    const tpl=list[(variant+seen-1)%list.length];
    const target={p:t.protein.g/n,c:t.carbs.g*m.share,f:t.fat.g*m.share};
    const items=solveMeal(tpl,target).map(it=>Object.assign(it,{swaps:swapsFor(it,m.slot)}));
    const tot=sumItems(items);
    return{name:m.name,share:m.share,items,total:tot};
  });
  const total=meals.reduce((s,m)=>addM(s,m.total),ZERO);
  return{meals,total,diffKcal:Math.round(total.kcal-t.kcal)};
}

function fmtAmount(food,amount){return food.unit==='szt'?amount+' szt.':amount+' '+food.unit;}
function srcLabel(s){return(REF[s.ref]||s.ref)+(s.pages?', s. '+s.pages:'')+(s.status&&s.status!=='zrodlo'?' ('+s.status.replace('_',' ')+')':'');}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);}
function srcTag(sources){return'<span class="diet-src" title="'+esc(sources.map(srcLabel).join('; '))+'">📚 '+esc(sources.map(s=>(s.ref==='sn'?'SN':s.ref==='bean'?'Bean':s.ref==='bk'?'Brukner':s.ref.toUpperCase())+(s.pages?' s. '+s.pages:'')).join(', '))+'</span>';}

/** Tekst jadłospisu do wiadomości dla klienta. */
function dietPlanText(t,day){
  const r=v=>Math.round(v);
  const lines=['🍽 Przykładowy jadłospis ('+t.kcal+' kcal)','Białko '+t.protein.g+' g · Tłuszcz '+t.fat.g+' g · Węglowodany '+t.carbs.g+' g',''];
  day.meals.forEach(m=>{
    lines.push(m.name+' (~'+r(m.total.kcal)+' kcal, B '+r(m.total.p)+' g)');
    m.items.forEach(it=>{
      const f=FOOD[it.id];
      const sw=it.swaps.length?' (albo: '+it.swaps.map(s=>FOOD[s.id].name.toLowerCase()+' '+fmtAmount(FOOD[s.id],s.amount)).join(', ')+')':'';
      lines.push('• '+f.name+' '+fmtAmount(f,it.amount)+sw);
    });
    lines.push('');
  });
  lines.push('Produkty suche (ryż, makaron, płatki) waży się przed gotowaniem.');
  lines.push('To przykładowy plan z zasad z książek o żywieniu w sporcie. Nie zastępuje porady dietetyka ani lekarza.');
  return lines.join('\n');
}

function dietRenderCard(t,day,opts){
  opts=opts||{};
  const r=v=>Math.round(v);
  const head='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:10px;">PRZYKŁADOWY JADŁOSPIS Z KSIĄŻEK</div>';
  if(t.blocked){
    return'<div class="calc-result-card diet-card" id="diet-card">'+head+t.blocks.map(b=>'<div class="calc-tip" style="border-left:3px solid var(--danger);">⚠ '+esc(b.text)+' '+srcTag(b.sources)+'</div>').join('')+'</div>';
  }
  const meals=day.meals.map((m,mi)=>'<div class="calc-meal-card">'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;">'+esc(m.name)+'</div>'+
    '<div style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+r(m.total.kcal)+' kcal · B '+r(m.total.p)+' · T '+r(m.total.f)+' · W '+r(m.total.c)+'</div></div>'+
    m.items.map(it=>{const f=FOOD[it.id];return'<div style="font-size:12px;padding:2px 0;">'+esc(f.name)+' <strong>'+esc(fmtAmount(f,it.amount))+'</strong>'+
      (it.swaps.length?'<div style="font-size:10.5px;color:var(--muted);">zamiennik: '+it.swaps.map(s=>esc(FOOD[s.id].name.toLowerCase())+' '+esc(fmtAmount(FOOD[s.id],s.amount))).join(' · ')+'</div>':'')+'</div>';}).join('')+
    '</div>').join('');
  const info=[
    '<strong>Białko</strong> '+t.protein.g+' g ('+String(t.protein.perKg).replace('.',',')+' g/kg, zakres '+t.protein.range+' g/kg) '+srcTag(t.protein.sources),
    '<strong>Tłuszcz</strong> '+t.fat.g+' g ('+t.fat.pct+'% energii, nie mniej niż 20%) '+srcTag(t.fat.sources),
    '<strong>Węglowodany</strong> '+t.carbs.g+' g ('+String(t.carbs.perKg).replace('.',',')+' g/kg; przy aktywności „'+esc(t.carbs.label)+'” '+t.carbs.range+') '+srcTag(t.carbs.sources),
    '<strong>Białko w posiłku</strong> ok. '+t.perMealProtein.g+' g (0,25 g/kg), rozłożone po równo '+srcTag(t.perMealProtein.sources)
  ].map(x=>'<div class="calc-tip">'+x+'</div>').join('');
  const notes=t.notes.map(nt=>'<div class="calc-tip" style="border-left:3px solid var(--warning);">⚠ '+esc(nt.text)+' '+srcTag(nt.sources)+'</div>').join('');
  const diff=Math.abs(day.diffKcal)>Math.max(60,t.kcal*0.05)?'<div class="calc-tip" style="border-left:3px solid var(--warning);">Jadłospis różni się od celu o '+day.diffKcal+' kcal (limity porcji). Zmień liczbę posiłków albo wariant.</div>':'';
  const mealsN=opts.meals||5;
  const ctrl='<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px;">'+
    [4,5,6].map(k=>'<button class="btn btn-sm'+(k===mealsN?' btn-primary':'')+'" onclick="dietSetMeals('+k+')">'+k+' posiłki'+(k>4?'':'')+'</button>').join('')+
    '<button class="btn btn-sm" onclick="dietNextVariant()">🔄 Inny wariant</button>'+
    '<button class="btn btn-sm" onclick="dietUseBookMacros()">Ustaw makro z książek</button>'+
    '<button class="btn btn-sm" onclick="dietSendToClient()">📤 Wyślij jadłospis</button></div>';
  return'<div class="calc-result-card diet-card" id="diet-card">'+head+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;">Makro liczone wg książek (białko g/kg, tłuszcz % energii, reszta węglowodany), niezależnie od suwaków. Liczba posiłków: 3 posiłki + 2–3 przekąski '+srcTag([src('sn','230')])+'.</div>'+
    info+notes+diff+ctrl+meals+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:8px;line-height:1.5;">Wartości produktów wyliczone z porcji w jadłospisach Bean (rozdz. 15, dane brytyjskie), status: wniosek. Zestawy posiłków i podział energii między posiłki to ustawienia aplikacji. Produkty suche waż przed gotowaniem. Ciąża, cukrzyca, zaburzenia odżywiania lub brak miesiączki: nie używaj automatu, skieruj do lekarza lub dietetyka '+srcTag([src('sn','377, 414, 443'),src('bk','917-919')])+'. To przykładowy plan, nie zastępuje dietetyka.</div>'+
    '</div>';
}

const api={DIET_FOODS,MEAL_TEMPLATES,MEAL_LAYOUTS,PROTEIN_BY_GOAL,REF,dietBookTargets,dietBuildDay,dietPlanText,dietRenderCard,carbRangeForActivity};
root.DietPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
