// Mapa mięśni: rozpoznawanie pola `muscle` z DEF_EX, pokrycie biblioteki i rysunek SVG.
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,extra)=>{console.log((cond?'✓ ':'✗ ')+name+(extra?' — '+extra:''));if(!cond)failed++;};

const ctx={console};ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'muscle-map.js'),'utf8'),ctx);
const {parseMuscles,muscleMapHTML,muscleMapData,MUSCLE_IDS}=ctx;

const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const cases=[
  ['Piersiowy większy, triceps, przedni bark',['chest'],['triceps','delt_front']],
  ['Klatka (główna), Triceps',['chest'],['triceps']],
  ['Pompki: Klatka piersiowa, Triceps, Core',['chest'],['triceps','abs']],
  ['Triceps, Klatka (główna)',['chest'],['triceps']],
  ['Plecy (szerokie i środkowe), Biceps',['lats','upper_back'],['biceps']],
  ['Barki, triceps',['delt_front','delt_side'],['triceps']],
  ['Uda, pośladki',['quads','hamstrings'],['glutes']],
  ['Tylny akton barku, czworoboczny',['delt_rear'],['traps']],
  ['Mięsień brzuchaty łydki',['calves'],[]],
  ['Prostownicy grzbietu, pośladki',['lower_back'],['glutes']]
];
cases.forEach(([s,p,sec])=>{
  const r=parseMuscles(s);
  ok(`„${s}” → ${p.join(', ')}; ${sec.join(', ')||'—'}`,eq([...r.primary],p)&&eq([...r.secondary],sec),JSON.stringify({p:r.primary,s:r.secondary}));
});
const none=parseMuscles('Cardio, koordynacja');
ok('nieznane słowa są pomijane bez błędu',none.primary.length===0&&none.secondary.length===0&&none.unknown.length===2);
ok('brak mięśni = brak mapy',muscleMapHTML([],[])===''&&muscleMapData({name:'x',muscle:'Cardio'})===null);
ok('puste pole nie rzuca błędu',parseMuscles('').primary.length===0&&parseMuscles(null).primary.length===0);

// Rysunek i dostępność.
const html=muscleMapHTML(['quads','glutes'],['hamstrings']);
ok('SVG ma aria-label z głównymi i pomocniczymi',html.includes('aria-label="Główne: czworogłowe uda, pośladki. Pomocnicze: dwugłowe uda (tył uda)."'));
ok('lista partii pod mapą: główne i pomocnicze',/class="mm-legend"[\s\S]*główne:[\s\S]*pomocnicze:/.test(html));
ok('główne mięśnie mają klasę mm-p, pomocnicze mm-s',/class="mm-m mm-p" data-act="mm-tap" data-m="quads"/.test(html)&&/class="mm-m mm-s" data-act="mm-tap" data-m="hamstrings"/.test(html));
ok('przód i tył sylwetki',html.includes('>Przód<')&&html.includes('>Tył<')&&(html.match(/class="mm-body"/g)||[]).length===2);
ok('każdy id ma kształt na rysunku',MUSCLE_IDS.every(id=>muscleMapHTML([id],[]).includes(`data-m="${id}"`)));
const bare=muscleMapHTML(['chest'],[],{bare:true});
ok('miniatura bez dotyku i bez listy',!bare.includes('data-act')&&!bare.includes('mm-legend')&&bare.startsWith('<svg'));
ok('bez onclick w wygenerowanym HTML',!/onclick=/.test(html));

// Pokrycie biblioteki DEF_EX.
const src=fs.readFileSync(path.join(root,'06-inbox-exercises-ai-programs.js'),'utf8');
const start=src.indexOf('const DEF_EX=[')+'const DEF_EX='.length;
let depth=0,end=start;
for(;end<src.length;end++){const c=src[end];if(c==='[')depth++;else if(c===']'){depth--;if(!depth)break;}}
const DEF_EX=vm.runInNewContext(src.slice(start,end+1));
let withMap=0;const unknown={},unknownNoMap={};
DEF_EX.forEach(e=>{
  const r=parseMuscles(e.muscle);
  const has=r.primary.length>0;
  if(has)withMap++;
  r.unknown.forEach(u=>{unknown[u]=(unknown[u]||0)+1;if(!has)unknownNoMap[u]=(unknownNoMap[u]||0)+1;});
});
const pct=withMap/DEF_EX.length*100;
const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,v])=>`${k} (${v})`).join(', ');
console.log(`Mapa: ${withMap} z ${DEF_EX.length} ćwiczeń (${pct.toFixed(1)}%), bez mapy: ${DEF_EX.length-withMap}.`);
console.log('20 najczęstszych nierozpoznanych fraz: '+top(unknown));
console.log('…w ćwiczeniach bez mapy: '+top(unknownNoMap));
ok('pokrycie biblioteki co najmniej 85%',pct>=85,pct.toFixed(1)+'%');

if(failed){console.error(failed+' błąd(ów)');process.exit(1);}
console.log('Wszystkie testy mapy mięśni przeszły.');
