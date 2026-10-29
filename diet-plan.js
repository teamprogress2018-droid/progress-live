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
/** Podgrupa do zamienników (zamiennik tylko w tej samej podgrupie) i najmniejsza sensowna porcja. */
const FOOD_SUB={
  kurczak:['mieso',80],indyk:['mieso',80],losos:['mieso',80],ryba:['mieso',80],tunczyk:['mieso',60],
  jajko:['nabial',1],cottage:['nabial',50],jogurt:['nabial',100],mleko:['nabial',150],
  fasola:['roslinne',100],tofu:['roslinne',100],
  owsiane:['zboza',30],musli:['zboza',30],chleb:['zboza',35],wafle:['zboza',2],
  makaron:['skrobia',50],ryz:['skrobia',50],ziemniaki:['skrobia',150],bataty:['skrobia',150],
  'maslo-orz':['tluszcz',10],oliwa:['tluszcz',5],hummus:['tluszcz',30],
  banan:['owoce',1],jablko:['owoce',1],pomarancza:['owoce',1],jagody:['owoce',80],rodzynki:['owoce',20]
};
/** Alergeny i wykluczenia (ustawienie aplikacji: oznaczenia typowego składu, zawsze sprawdź etykietę). */
const DIET_EXCLUSIONS=[
  {id:'gluten',label:'Gluten',foods:['owsiane','musli','chleb','makaron']},
  {id:'mleko',label:'Mleko i nabiał',foods:['cottage','jogurt','mleko']},
  {id:'jaja',label:'Jaja',foods:['jajko']},
  {id:'ryby',label:'Ryby',foods:['losos','ryba','tunczyk']},
  {id:'orzeszki',label:'Orzeszki ziemne',foods:['maslo-orz']},
  {id:'soja',label:'Soja',foods:['tofu']},
  {id:'sezam',label:'Sezam',foods:['hummus']},
  {id:'mieso',label:'Mięso',foods:['kurczak','indyk']}
];
/** Sposoby żywienia = zestawy wykluczeń. */
const DIET_STYLES={
  wszystko:{label:'Bez ograniczeń',ex:[]},
  wege:{label:'Wegetariańska',ex:['mieso','ryby']},
  weganska:{label:'Wegańska',ex:['mieso','ryby','mleko','jaja']}
};
const FOOD=Object.create(null);
DIET_FOODS.forEach(f=>{FOOD[f.id]=f;const s=FOOD_SUB[f.id];f.sub=s?s[0]:f.group;f.min=s?s[1]:0;f.tags=[];});
DIET_EXCLUSIONS.forEach(e=>e.foods.forEach(id=>FOOD[id].tags.push(e.id)));

/** Zestawy posiłków (ustawienie aplikacji): białko + węglowodany + tłuszcz + stałe dodatki.
 *  min = szacowany czas przygotowania w minutach (ustawienie aplikacji, nie z książek). */
const MEAL_TEMPLATES={
  sniadanie:[
    {min:5,p:'cottage',c:'chleb',f:'maslo-orz',x:[['papryka',100]]},
    {min:10,p:'jajko',c:'chleb',f:null,x:[['szpinak',80]]},
    {min:10,p:'cottage',c:'owsiane',f:'maslo-orz',x:[['jagody',100],['mleko',200]]},
    {min:3,p:'jogurt',c:'musli',f:'maslo-orz',x:[['banan',1]]}
  ],
  przekaska:[
    {min:3,p:'cottage',c:'wafle',f:null,x:[['jablko',1]]},
    {min:3,p:'jogurt',c:'musli',f:null,x:[['banan',1]]},
    {min:5,p:'tunczyk',c:'chleb',f:'oliwa',x:[['marchew',100]]},
    {min:3,p:'cottage',c:'chleb',f:null,x:[['pomarancza',1]]}
  ],
  obiad:[
    {min:30,p:'kurczak',c:'ryz',f:'oliwa',x:[['brokul',150]]},
    {min:40,p:'losos',c:'ziemniaki',f:'oliwa',x:[['szpinak',100],['salata',100]]},
    {min:25,p:'indyk',c:'makaron',f:'oliwa',x:[['papryka',100],['marchew',100]]},
    {min:35,p:'ryba',c:'bataty',f:'oliwa',x:[['kalafior',150]]},
    {min:30,p:'fasola',c:'ryz',f:'oliwa',x:[['papryka',150]]},
    {min:15,p:'tunczyk',c:'makaron',f:'oliwa',x:[['papryka',100],['szpinak',80]]}
  ],
  kolacja:[
    {min:10,p:'tunczyk',c:'chleb',f:'oliwa',x:[['salata',100],['papryka',100]]},
    {min:25,p:'jajko',c:'ziemniaki',f:'oliwa',x:[['szpinak',100]]},
    {min:10,p:'indyk',c:'chleb',f:'oliwa',x:[['marchew',100]]},
    {min:5,p:'losos',c:'chleb',f:null,x:[['salata',100],['papryka',100]]},
    {min:20,p:'tofu',c:'ryz',f:'oliwa',x:[['papryka',100],['brokul',100]]}
  ]
};
/** Podział energii (ustawienie aplikacji, nie z książek). Białko dzielone po równo. */
const MEAL_LAYOUTS={
  3:[{name:'Śniadanie',slot:'sniadanie',share:0.30},{name:'Obiad',slot:'obiad',share:0.40},{name:'Kolacja',slot:'kolacja',share:0.30}],
  4:[{name:'Śniadanie',slot:'sniadanie',share:0.30},{name:'Obiad',slot:'obiad',share:0.35},{name:'Przekąska',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.25}],
  5:[{name:'Śniadanie',slot:'sniadanie',share:0.25},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.30},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20}],
  6:[{name:'Śniadanie',slot:'sniadanie',share:0.20},{name:'II śniadanie',slot:'przekaska',share:0.15},{name:'Obiad',slot:'obiad',share:0.25},{name:'Podwieczorek',slot:'przekaska',share:0.10},{name:'Kolacja',slot:'kolacja',share:0.20},{name:'Przekąska wieczorna',slot:'przekaska',share:0.10}]
};

/** Białko g/kg wg celu (środek zgodnych zakresów książek). */
const PROTEIN_BY_GOAL={
  redukcja:{v:1.8,lo:1.6,hi:2.0,range:'1,6–2,0',why:'SN: ok. 1,5 i więcej przy dużym deficycie; Bean 1,6; ADS 1,6–2,4',sources:[src('sn','230','wniosek'),src('bean','120'),src('ads','104')]},
  masa:{v:1.8,lo:1.7,hi:2.0,range:'1,7–2,0',why:'budowa mięśni',sources:[src('sn','230')]},
  sila:{v:1.7,lo:1.6,hi:1.7,range:'1,6–1,7',why:'trening siłowy',sources:[src('sn','52'),src('bean','199')]},
  kondycja:{v:1.3,lo:1.2,hi:1.4,range:'1,2–1,4',why:'trening wytrzymałościowy',sources:[src('sn','52'),src('bean','199')]},
  inne:{v:1.6,lo:1.4,hi:2.0,range:'1,4–2,0',why:'osoby trenujące',sources:[src('sn','230','wniosek')]}
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
  // Makro wybrane w kalkulatorze (suwaki) albo wg książek: białko g/kg, tłuszcz 25%, reszta węglowodany.
  const sel=o.selected&&+o.selected.p>0?o.selected:null;
  const proteinG=sel?Math.round(+sel.p):Math.round(prot.v*weight);
  const fatG=sel?Math.round(+sel.f):Math.round(kcal*FAT_PCT/100/9);
  const carbG=sel?Math.round(+sel.c):Math.max(0,Math.round((kcal-proteinG*4-fatG*9)/4));
  const fatPct=kcal?Math.round(fatG*9/kcal*100):FAT_PCT;
  const protPerKg=weight?Math.round(proteinG/weight*10)/10:prot.v;
  const cr=carbRangeForActivity(+o.pal||0);
  const carbPerKg=weight?Math.round(carbG/weight*10)/10:0;
  const notes=[];
  const pl=v=>String(v).replace('.',',');
  if(sel&&weight&&(protPerKg<prot.lo-0.05||protPerKg>prot.hi+0.05))notes.push({text:'Wybrany podział daje '+pl(protPerKg)+' g białka na kg, a książki dla tego celu podają '+prot.range+' g/kg. Kliknij „📚 Wg książek”, żeby to wyrównać.',sources:prot.sources});
  if(sel&&kcal&&(fatPct<20||fatPct>35))notes.push({text:'Tłuszcz to '+fatPct+'% energii, poza zakresem 20–35%.',sources:[src('sn','62-65, 230')]});
  if(sel&&weight&&carbPerKg>cr.max)notes.push({text:'Węglowodanów jest '+pl(carbPerKg)+' g/kg, więcej niż '+cr.min+'–'+cr.max+' g/kg przy tej aktywności.',sources:[src('sn','22')]});
  if(weight&&carbPerKg<cr.min)notes.push({text:'Węglowodanów zostaje '+carbPerKg+' g/kg, mniej niż '+cr.min+'–'+cr.max+' g/kg zalecane przy aktywności „'+cr.label+'”. Rozważ mniejszy deficyt.',sources:[src('sn','22')]});
  if(gk==='redukcja'&&weight&&carbPerKg<4)notes.push({text:'Poniżej 4 g/kg węglowodanów trening zwykle słabnie.',sources:[src('bean','120')]});
  return{
    goal:gk,kcal,rmr,weight,blocked:blocks.length>0,blocks,notes,
    selected:!!sel,
    protein:{g:proteinG,perKg:protPerKg,lo:prot.lo,hi:prot.hi,range:prot.range,why:prot.why,sources:prot.sources},
    fat:{g:fatG,pct:fatPct,range:'20–35%',sources:[src('sn','62-65, 230')]},
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
function unitOf(f){return f.unit==='szt'?1:100;}
/** Porcja w granicach [min, max]; tłuszcz może zniknąć, gdy wychodzi go mniej niż pół porcji. */
function clampAmount(food,x,role){
  if(role==='f'&&x<Math.max(3,food.min/2))return 0;
  const lo=food.min||0,hi=food.max||9999;
  const v=food.unit==='szt'?Math.round(x):round5(x);
  return Math.max(lo,Math.min(hi,v));
}

/** Gramatura jednego posiłku: dopasowanie węglowodanów, białka i tłuszczu w kilku przebiegach,
 *  z najmniejszą sensowną porcją każdego produktu. Gdy limit porcji obcina składnik,
 *  dochodzi drugi produkt z pasującej podgrupy (owoc do węglowodanów, nabiał do białka). */
function solveMeal(tpl,target,allow){
  allow=allow||(()=>true);
  const items=[];
  items.push({id:tpl.c,amount:0,role:'c'});
  items.push({id:tpl.p,amount:0,role:'p'});
  if(tpl.f)items.push({id:tpl.f,amount:0,role:'f'});
  (tpl.x||[]).forEach(([id,amt])=>items.push({id,amount:amt,role:'x'}));
  const fit=i=>{
    const it=items[i],f=FOOD[it.id],key=it.role;
    if(!f[key])return;
    it.amount=clampAmount(f,(target[key]-sumItems(items,i)[key])/f[key]*unitOf(f),key);
  };
  for(let pass=0;pass<6;pass++){
    items.forEach((it,i)=>{if(it.role!=='x')fit(i);});
    if(pass===1){
      [['c',['banan','jablko','rodzynki']],['p',['jogurt','cottage','jajko']]].forEach(([key,fill])=>{
        const miss=target[key]-sumItems(items)[key];
        if(miss<=Math.max(8,target[key]*0.1))return;
        const id=fill.find(x=>allow(FOOD[x])&&!items.some(it=>it.id===x));
        if(id)items.push({id,amount:0,role:key});
      });
    }
  }
  return items.filter(it=>it.amount>0);
}

/** Zamienniki: produkty z tej samej podgrupy (mięso i ryby, nabiał, zboża, skrobia, owoce, tłuszcze),
 *  w ilości dającej tyle samo głównego składnika; bez porcji mniejszych niż sensowne minimum. */
function swapsFor(item,allow){
  allow=allow||(()=>true);
  const food=FOOD[item.id];
  const key=item.role;
  if(key!=='p'&&key!=='c'&&key!=='f')return[];
  const amountMain=itemMacros(food,item.amount)[key];
  if(amountMain<=0)return[];
  return DIET_FOODS.filter(f=>f.id!==food.id&&f.sub===food.sub&&f[key]>0&&allow(f))
    .map(f=>({id:f.id,raw:amountMain/f[key]*unitOf(f)}))
    .filter(s=>{const f=FOOD[s.id];return s.raw>=f.min*0.75&&s.raw<=(f.max||9999);})
    .map(s=>({id:s.id,amount:clampAmount(FOOD[s.id],s.raw)}))
    .slice(0,3);
}

/** Preferencje kreatora: {style, ex: [id wykluczeń], skip: [id produktów], maxMin: minuty na posiłek (0 = bez limitu)}. */
function dietPrefsNorm(p){
  p=p||{};
  const style=DIET_STYLES[p.style]?p.style:'wszystko';
  const ex=[...new Set([].concat(DIET_STYLES[style].ex,(p.ex||[]).filter(id=>DIET_EXCLUSIONS.some(e=>e.id===id))))];
  const skip=(p.skip||[]).filter(id=>FOOD[id]);
  return{style,ex,skip,maxMin:Math.max(0,+p.maxMin||0)};
}
function dietAllow(prefs){
  const ex=new Set(prefs.ex),skip=new Set(prefs.skip);
  return f=>!!f&&!skip.has(f.id)&&!f.tags.some(t=>ex.has(t));
}
// Zastępstwo dla produktu, którego klient nie je: najpierw ta sama podgrupa, potem produkt
// z tym samym głównym składnikiem (białko: mięso, ryby, nabiał, rośliny; węglowodany: zboża i skrobia).
const ROLE_GROUPS={p:['bialko','nabial'],c:['wegle'],f:['tluszcz']};
// Produkty obiadowe (do gotowania na ciepło): w śniadaniu i przekąsce zamiennik z nich tylko w ostateczności.
const MAIN_DISH=new Set(['kurczak','indyk','losos','ryba','fasola','makaron','ryz','ziemniaki','bataty']);
// Produkty już użyte tego dnia idą na koniec kolejki, żeby zamiennik nie powtarzał się w każdym posiłku.
function replacementFor(id,role,allow,used,today,light){
  today=today||new Set();
  const f=FOOD[id];
  const ok=g=>g.id!==id&&allow(g)&&g[role]>0&&!used.includes(g.id);
  const ratio=g=>g[role]*(role==='f'?9:4)/g.kcal;
  const pool=DIET_FOODS.filter(g=>ok(g)&&(g.sub===f.sub||ROLE_GROUPS[role].includes(g.group)));
  const other=g=>g.sub===f.sub?0:1;
  const heavy=g=>light&&MAIN_DISH.has(g.id)?1:0;
  return pool.sort((a,b)=>(heavy(a)-heavy(b))||(today.has(a.id)-today.has(b.id))||(other(a)-other(b))||(ratio(b)-ratio(a)))[0]||null;
}
/** Zestaw dopasowany do wykluczeń; null, gdy nie ma czym zastąpić białka albo węglowodanów. */
function adaptTemplate(tpl,allow,today,light){
  const out={min:tpl.min,p:tpl.p,c:tpl.c,f:tpl.f,x:(tpl.x||[]).filter(([id])=>allow(FOOD[id])),changes:[]};
  for(const role of['p','c','f']){
    const id=out[role];
    if(!id||allow(FOOD[id]))continue;
    const r=replacementFor(id,role,allow,[out.p,out.c,out.f].concat(out.x.map(x=>x[0])),today,light);
    if(!r&&role!=='f')return null;
    out.changes.push({from:id,to:r?r.id:null});
    out[role]=r?r.id:null;
  }
  return out;
}
/** Zestawy dla jednego rodzaju posiłku: najpierw pełne zgodne z preferencjami, potem przerobione;
 *  limit czasu odpuszczany dopiero, gdy nic się w nim nie mieści (z ostrzeżeniem). */
function slotTemplates(slot,prefs,allow,today){
  const light=slot==='sniadanie'||slot==='przekaska';
  const all=MEAL_TEMPLATES[slot].map(t=>adaptTemplate(t,allow,today,light)).filter(Boolean);
  const inTime=prefs.maxMin?all.filter(t=>t.min<=prefs.maxMin):all;
  const pick=list=>{const clean=list.filter(t=>!t.changes.length);return clean.length>=2?clean:list;};
  if(inTime.length)return{list:pick(inTime),overTime:false};
  return{list:pick(all),overTime:!!all.length};
}

/**
 * Przykładowy dzień: o = {targets (z dietBookTargets), meals: 3–6, variant: liczba, prefs (kreator)}
 */
function dietBuildDay(o){
  const t=o.targets;
  const layout=MEAL_LAYOUTS[o.meals]||MEAL_LAYOUTS[5];
  const variant=Math.max(0,+o.variant||0);
  const n=layout.length;
  const slotCount={};
  const prefs=dietPrefsNorm(o.prefs);
  const allow=dietAllow(prefs);
  const warnings=[];
  const today=new Set();
  // Cel posiłku liczony z tego, co zostało na resztę dnia: nadwyżka z najmniejszych porcji
  // w jednym posiłku zmniejsza kolejne, więc suma dnia trzyma się celu.
  let done=ZERO,shareLeft=1;
  const meals=layout.map((m,mi)=>{
    const st=slotTemplates(m.slot,prefs,allow,today);
    const list=st.list;
    const seen=slotCount[m.slot]=(slotCount[m.slot]||0)+1;
    if(!list.length){warnings.push(m.name+': przy tych wykluczeniach nie ma z czego ułożyć posiłku.');return{name:m.name,share:m.share,items:[],total:ZERO,minutes:0};}
    if(st.overTime&&seen===1)warnings.push(m.name+': żaden zestaw nie mieści się w '+prefs.maxMin+' min, wybrany najszybszy możliwy.');
    const tpl=list[(variant+seen-1)%list.length];
    const k=m.share/shareLeft;
    const target={p:Math.max(0,(t.protein.g-done.p)/(n-mi)),c:Math.max(0,(t.carbs.g-done.c-Math.max(0,done.p-t.protein.g*mi/n))*k),f:Math.max(0,(t.fat.g-done.f)*k)};
    shareLeft-=m.share;
    const items=solveMeal(tpl,target,allow).map(it=>Object.assign(it,{swaps:swapsFor(it,allow)}));
    const tot=sumItems(items);
    done=addM(done,tot);
    items.forEach(it=>{if(it.role!=='x')today.add(it.id);});
    return{name:m.name,share:m.share,items,total:tot,minutes:tpl.min,changes:tpl.changes};
  });
  const total=meals.reduce((s,m)=>addM(s,m.total),ZERO);
  const reps={};
  meals.forEach(m=>(m.changes||[]).forEach(ch=>{if(ch.to)reps[ch.to]=(reps[ch.to]||0)+1;}));
  Object.keys(reps).filter(id=>reps[id]>=3).forEach(id=>warnings.push('Mało produktów przy tych wykluczeniach: '+FOOD[id].name.toLowerCase()+' zastępuje inne produkty w '+reps[id]+' posiłkach. Urozmaicić ręcznie albo poczekać na większą bazę produktów.'));
  if(Math.abs(total.f-t.fat.g)>Math.max(10,t.fat.g*0.15))warnings.push('Tłuszcz wychodzi '+Math.round(total.f)+' g zamiast '+t.fat.g+' g (produkty dostępne przy tych wykluczeniach). Sprawdź jadłospis przed wysłaniem.');
  if(total.p<t.protein.g*0.9)warnings.push('Przy tych wykluczeniach brakuje ok. '+Math.round(t.protein.g-total.p)+' g białka (limity porcji). Trener powinien dobrać produkty ręcznie.');
  return{meals,total,diffKcal:Math.round(total.kcal-t.kcal),warnings,prefs};
}

const WEEK_DAYS=['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela'];
/** Kilka dni (o.days: 2–7, domyślnie tydzień) z tymi samymi celami, każdy dzień z innym zestawem posiłków, plus lista zakupów. */
function dietBuildWeek(o){
  const base=Math.max(0,+o.variant||0);
  const count=Math.min(7,Math.max(2,+o.days||7));
  const names=count===7?WEEK_DAYS:Array.from({length:count},(_,i)=>'Dzień '+(i+1));
  const days=names.map((name,d)=>Object.assign({name},dietBuildDay({targets:o.targets,meals:o.meals,variant:base+d,prefs:o.prefs})));
  const shop={};
  days.forEach(day=>day.meals.forEach(m=>m.items.forEach(it=>{shop[it.id]=(shop[it.id]||0)+it.amount;})));
  const shopping=Object.keys(shop).map(id=>({id,amount:shop[id]}))
    .sort((a,b)=>DIET_FOODS.indexOf(FOOD[a.id])-DIET_FOODS.indexOf(FOOD[b.id]));
  return{days,shopping,warnings:[...new Set([].concat(...days.map(d=>d.warnings)))],prefs:days[0].prefs};
}

function fmtAmount(food,amount){return food.unit==='szt'?amount+' szt.':amount+' '+food.unit;}
function srcLabel(s){return(REF[s.ref]||s.ref)+(s.pages?', s. '+s.pages:'')+(s.status&&s.status!=='zrodlo'?' ('+s.status.replace('_',' ')+')':'');}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);}
function srcTag(sources){return'<span class="diet-src" title="'+esc(sources.map(srcLabel).join('; '))+'">📚 '+esc(sources.map(s=>(s.ref==='sn'?'SN':s.ref==='bean'?'Bean':s.ref==='bk'?'Brukner':s.ref.toUpperCase())+(s.pages?' s. '+s.pages:'')).join(', '))+'</span>';}

/** Tekst jadłospisu do wiadomości dla klienta. */
function mealsText(day,lines){
  const r=v=>Math.round(v);
  day.meals.forEach(m=>{
    lines.push(m.name+' (~'+r(m.total.kcal)+' kcal, B '+r(m.total.p)+' g)');
    m.items.forEach(it=>{
      const f=FOOD[it.id];
      const sw=it.swaps.length?' (albo: '+it.swaps.map(s=>FOOD[s.id].name.toLowerCase()+' '+fmtAmount(FOOD[s.id],s.amount)).join(', ')+')':'';
      lines.push('• '+f.name+' '+fmtAmount(f,it.amount)+sw);
    });
    lines.push('');
  });
}
function fmtShop(food,amount){
  if(food.unit==='szt')return amount+' szt.';
  return amount>=1000?(Math.round(amount/100)/10).toString().replace('.',',')+(food.unit==='ml'?' l':' kg'):amount+' '+food.unit;
}
/** Tekst dla klienta: jeden dzień albo tydzień (obiekt z dietBuildWeek) z listą zakupów. */
function dietPlanText(t,plan){
  const week=plan&&plan.days;
  const span=week?(plan.days.length===7?' na tydzień':' na '+plan.days.length+' dni'):'';
  const lines=['🍽 Przykładowy jadłospis'+span+' ('+t.kcal+' kcal dziennie)','Białko '+t.protein.g+' g · Tłuszcz '+t.fat.g+' g · Węglowodany '+t.carbs.g+' g',''];
  if(week){
    plan.days.forEach(day=>{lines.push('📅 '+day.name.toUpperCase(),'');mealsText(day,lines);});
    lines.push('🛒 Lista zakupów'+span+':');
    plan.shopping.forEach(s=>{const f=FOOD[s.id];lines.push('• '+f.name+' '+fmtShop(f,s.amount));});
    lines.push('');
  }else mealsText(plan,lines);
  const pr=plan&&plan.prefs;
  if(pr&&(pr.ex.length||pr.skip.length))lines.push('Bez: '+pr.ex.map(id=>DIET_EXCLUSIONS.find(e=>e.id===id).label.toLowerCase()).concat(pr.skip.map(id=>FOOD[id].name.toLowerCase())).join(', ')+'. Sprawdzaj skład na etykiecie.');
  lines.push('Produkty suche (ryż, makaron, płatki) waży się przed gotowaniem.');
  lines.push('To przykładowy plan z zasad z książek o żywieniu w sporcie. Nie zastępuje porady dietetyka ani lekarza.');
  return lines.join('\n');
}

/** Kreator: sposób żywienia, alergie i wykluczenia, produkty, których klient nie je, czas przygotowania. */
function dietWizardHTML(p,skipOpen){
  p=dietPrefsNorm(p);
  const chip=(on,click,label)=>'<button type="button" class="btn btn-sm'+(on?' btn-primary':'')+'" style="font-size:11.5px;padding:4px 10px;min-height:0;" aria-pressed="'+(on?'true':'false')+'" onclick="'+click+'">'+esc(label)+'</button>';
  const row=(title,body)=>'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;"><span style="font-size:11.5px;color:var(--muted);flex-basis:100%;">'+title+'</span>'+body+'</div>';
  const styleEx=DIET_STYLES[p.style].ex;
  return'<div class="diet-wizard" style="border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin:8px 0;">'+
    '<div style="font-size:12px;font-weight:700;margin-bottom:4px;">Kreator jadłospisu</div>'+
    row('Sposób żywienia',Object.keys(DIET_STYLES).map(k=>chip(p.style===k,'dietSetStyle(\''+k+'\')',DIET_STYLES[k].label)).join(''))+
    row('Bez (alergie)',DIET_EXCLUSIONS.filter(e=>!styleEx.includes(e.id)).map(e=>chip(p.ex.includes(e.id),'dietToggleEx(\''+e.id+'\')',e.label)).join(''))+
    row('Czas na posiłek',[[0,'Bez limitu'],[15,'do 15 min'],[30,'do 30 min']].map(([v,l])=>chip(p.maxMin===v,'dietSetMaxMin('+v+')',l)).join(''))+
    '<details class="diet-skip"'+(skipOpen?' open':'')+' style="margin-top:4px;"><summary style="cursor:pointer;font-size:11.5px;color:var(--muted);">Produkty, których klient nie je'+(p.skip.length?' ('+p.skip.length+')':'')+'</summary><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;">'+
      DIET_FOODS.map(f=>chip(p.skip.includes(f.id),'dietToggleSkip(\''+f.id+'\')',f.name)).join('')+'</div></details>'+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:4px;">Oznaczenia alergenów i czasy przygotowania to ustawienia aplikacji. Przy alergii zawsze sprawdzaj etykietę; przy chorobach skieruj klienta do dietetyka lub lekarza.</div>'+
    '</div>';
}

function dietRenderCard(t,day,opts){
  opts=opts||{};
  const r=v=>Math.round(v);
  const head='<div style="font-family:\'Bebas Neue\',sans-serif;font-size:14px;letter-spacing:1px;color:var(--accent);margin-bottom:10px;">PRZYKŁADOWY JADŁOSPIS Z KSIĄŻEK</div>';
  if(t.blocked){
    return'<div class="calc-result-card diet-card" id="diet-card">'+head+t.blocks.map(b=>'<div class="calc-tip" style="border-left:3px solid var(--danger);">⚠ '+esc(b.text)+' '+srcTag(b.sources)+'</div>').join('')+'</div>';
  }
  const mealsHTML=d=>d.meals.map((m,mi)=>'<div class="calc-meal-card">'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><div style="font-size:12px;font-weight:700;">'+esc(m.name)+(m.minutes?' <span style="font-weight:400;color:var(--muted);">⏱ ~'+m.minutes+' min</span>':'')+'</div>'+
    '<div style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+r(m.total.kcal)+' kcal · B '+r(m.total.p)+' · T '+r(m.total.f)+' · W '+r(m.total.c)+'</div></div>'+
    m.items.map(it=>{const f=FOOD[it.id];return'<div style="font-size:12px;padding:2px 0;">'+esc(f.name)+' <strong>'+esc(fmtAmount(f,it.amount))+'</strong>'+
      (it.swaps.length?'<div style="font-size:10.5px;color:var(--muted);">zamiennik: '+it.swaps.map(s=>esc(FOOD[s.id].name.toLowerCase())+' '+esc(fmtAmount(FOOD[s.id],s.amount))).join(' · ')+'</div>':'')+'</div>';}).join('')+
    ((m.changes||[]).length?'<div style="font-size:10.5px;color:var(--muted);margin-top:3px;">zmienione przez wykluczenia: '+m.changes.map(ch=>esc(FOOD[ch.from].name.toLowerCase())+' → '+(ch.to?esc(FOOD[ch.to].name.toLowerCase()):'bez zamiennika')).join(' · ')+'</div>':'')+
    '</div>').join('');
  const info=[
    '<strong>Białko</strong> '+t.protein.g+' g ('+String(t.protein.perKg).replace('.',',')+' g/kg, zakres '+t.protein.range+' g/kg) '+srcTag(t.protein.sources),
    '<strong>Tłuszcz</strong> '+t.fat.g+' g ('+t.fat.pct+'% energii, nie mniej niż 20%) '+srcTag(t.fat.sources),
    '<strong>Węglowodany</strong> '+t.carbs.g+' g ('+String(t.carbs.perKg).replace('.',',')+' g/kg; przy aktywności „'+esc(t.carbs.label)+'” '+t.carbs.range+') '+srcTag(t.carbs.sources),
    '<strong>Białko w posiłku</strong> ok. '+t.perMealProtein.g+' g (0,25 g/kg), rozłożone po równo '+srcTag(t.perMealProtein.sources)
  ].map(x=>'<div class="calc-tip">'+x+'</div>').join('');
  const notes=t.notes.map(nt=>'<div class="calc-tip" style="border-left:3px solid var(--warning);">⚠ '+esc(nt.text)+' '+srcTag(nt.sources)+'</div>').join('');
  // day: jeden dzień albo tydzień ({days, shopping}).
  const week=!!(day&&day.days);
  const days=week?day.days:[day];
  const off=days.filter(d=>Math.abs(d.diffKcal)>Math.max(60,t.kcal*0.05));
  const warns=((week?day.warnings:day.warnings)||[]).map(w=>'<div class="calc-tip" style="border-left:3px solid var(--warning);">⚠ '+esc(w)+'</div>').join('');
  const diff=off.length?'<div class="calc-tip" style="border-left:3px solid var(--warning);">'+(week?'Dni: '+off.map(d=>esc(d.name)).join(', ')+' różnią się od celu o więcej niż 5%':'Jadłospis różni się od celu o '+day.diffKcal+' kcal')+' (limity porcji). Zmień liczbę posiłków albo wariant.</div>':'';
  const r0=v=>Math.round(v);
  const dayHead=d=>'<span style="font-weight:700;">'+esc(d.name)+'</span> <span style="font-size:11px;color:var(--muted);font-family:\'DM Mono\',monospace;">'+r0(d.total.kcal)+' kcal · B '+r0(d.total.p)+' · T '+r0(d.total.f)+' · W '+r0(d.total.c)+'</span>';
  const meals=week
    ?day.days.map((d,i)=>'<details class="diet-day"'+(i===0?' open':'')+' style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-size:13px;">'+dayHead(d)+'</summary>'+mealsHTML(d)+'</details>').join('')+
      '<details class="diet-shop" style="border-top:1px solid var(--border);padding:8px 0;"><summary style="cursor:pointer;font-size:13px;font-weight:700;">🛒 Lista zakupów '+(day.days.length===7?'na tydzień':'na '+day.days.length+' dni')+'</summary><div style="columns:2;column-gap:18px;font-size:12px;margin-top:6px;">'+
      day.shopping.map(s=>{const f=FOOD[s.id];return'<div>'+esc(f.name)+' <strong>'+esc(fmtShop(f,s.amount))+'</strong></div>';}).join('')+'</div></details>'
    :mealsHTML(day);
  const mealsN=opts.meals||5;
  const nDays=week?day.days.length:1;
  const ctrl=dietWizardHTML(day&&day.prefs,opts.skipOpen)+'<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px;">'+
    '<button class="btn btn-sm'+(nDays===1?' btn-primary':'')+'" onclick="dietSetView(\'dzien\')">1 dzień</button>'+
    '<button class="btn btn-sm'+(nDays===3?' btn-primary':'')+'" onclick="dietSetView(\'3dni\')">3 dni</button>'+
    '<button class="btn btn-sm'+(nDays===7?' btn-primary':'')+'" onclick="dietSetView(\'tydzien\')">📅 Cały tydzień</button>'+
    [3,4,5,6].map(k=>'<button class="btn btn-sm'+(k===mealsN?' btn-primary':'')+'" onclick="dietSetMeals('+k+')">'+k+' posiłki</button>').join('')+
    '<button class="btn btn-sm" onclick="dietNextVariant()">🔄 Inny wariant</button>'+
    (t.selected?'<button class="btn btn-sm" onclick="dietUseBookMacros()">📚 Ustaw makro z książek</button>':'')+
    '<button class="btn btn-sm" onclick="dietSendToClient()">📤 Wyślij '+(nDays===7?'tydzień':'jadłospis')+'</button></div>';
  return'<div class="calc-result-card diet-card" id="diet-card">'+head+
    '<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px;">'+(t.selected?'Jadłospis liczony z makro wybranego w kalkulatorze. Zakresy obok to zalecenia książek.':'Makro wg książek: białko g/kg wg celu, tłuszcz 25% energii, reszta węglowodany (te same liczby co w podziale makro).')+' Liczba posiłków: 3 posiłki + 2–3 przekąski '+srcTag([src('sn','230')])+'.</div>'+
    info+notes+diff+warns+ctrl+meals+
    '<div style="font-size:10.5px;color:var(--muted2);margin-top:8px;line-height:1.5;">Wartości produktów wyliczone z porcji w jadłospisach Bean (rozdz. 15, dane brytyjskie), status: wniosek. Zestawy posiłków i podział energii między posiłki to ustawienia aplikacji. Produkty suche waż przed gotowaniem. Ciąża, cukrzyca, zaburzenia odżywiania lub brak miesiączki: nie używaj automatu, skieruj do lekarza lub dietetyka '+srcTag([src('sn','377, 414, 443'),src('bk','917-919')])+'. To przykładowy plan, nie zastępuje dietetyka.</div>'+
    '</div>';
}

const api={DIET_FOODS,DIET_EXCLUSIONS,DIET_STYLES,dietPrefsNorm,MEAL_TEMPLATES,MEAL_LAYOUTS,PROTEIN_BY_GOAL,REF,WEEK_DAYS,dietBookTargets,dietBuildDay,dietBuildWeek,dietPlanText,dietRenderCard,carbRangeForActivity};
root.DietPlan=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
