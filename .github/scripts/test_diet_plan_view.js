// Widok planu żywieniowego (diet-plan-view.js): model z jadłospisu i z planu klienta, kroki przygotowania,
// zmiany trenera, wydruk A4 (marginesy, stopka, karty bez dzielenia, bez fixed/sticky).
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..','..');
const ctx={console};ctx.window=ctx;ctx.globalThis=ctx;
['diet-plan.js','plan-client.js','diet-plan-view.js'].forEach(f=>vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx));
const D=ctx.DietPlan,V=ctx.DietView,PC=ctx.PlanClient;
let n=0;const ok=(name,c,x)=>{assert.ok(c,name+(x?' — '+x:''));n++;};

const anna={id:'a',name:'Anna Kowalczyk',goal:'redukcja',age:38,height:168,weight:74,gender:'K',trainingFreq:3};
const nt=PC.nutritionTargets(anna);
const week=D.dietBuildWeek({targets:nt.targets,meals:5,days:7,trainDays:[1,3,5],prep:2,people:1});
const vmW=V.fromBuilt(nt.targets,week,{client:anna.name,goalKey:'redukcja',delta:nt.delta,kcal:nt.kcal,water:nt.water,meals:5,date:'16.11.2026'});
ok('tydzień: 7 dni po 5 posiłków',vmW.days.length===7&&vmW.days.every(d=>d.meals.length===5));
ok('nagłówek: imię, cel, liczba posiłków',vmW.first==='Anna'&&vmW.goal==='Łagodna redukcja'&&vmW.mealsN===5);
ok('lista zakupów z dni',vmW.shop.length>10&&vmW.shop.every(s=>s.amount>0));

// Kroki przygotowania: 3–5 krótkich, prostych zdań dla każdego zestawu posiłków.
let all=0,bad=[];
Object.keys(D.MEAL_TEMPLATES).forEach(slot=>{});
for(let v=0;v<12;v++){
  const w=D.dietBuildWeek({targets:nt.targets,meals:5,days:7,variant:v*3});
  V.fromBuilt(nt.targets,w,{}).days.forEach(d=>d.meals.forEach(m=>{all++;const s=V.steps(m);if(s.length<3||s.length>5||s.some(x=>x.length>140))bad.push(m.dish+': '+s.length);}));
}
ok('kroki: 3–5 dla każdego posiłku',!bad.length,bad.slice(0,3).join(' | '));
ok('kroki: koktajl = blender',V.steps({dish:'Koktajl na kefirze',items:[{id:'kefir',amount:250,role:'p',swaps:[]}]})[0].includes('blendera'));
ok('kroki: bez jajek nie ma „wbij jajka”',!V.steps({dish:'Jajecznica z bułką',items:[{id:'chleb',amount:50,role:'c',swaps:[]},{id:'pomidor',amount:100,role:'x',swaps:[]}]}).join(' ').includes('jajka'));

// Plan zapisany u klienta: zdjęcia, czas, makro, zamienniki i notatka przechodzą do widoku.
const nW=PC.buildNutrition(anna,'week',{trainDays:[1,3,5]});nW.note='Pij wodę przed posiłkiem.';
const pub=PC.publicPlan(nW);
const m0=pub.days[0].m[0];
ok('publicPlan: zdjęcie, czas, tłuszcz i węglowodany',m0.img&&m0.min>0&&m0.f>=0&&m0.c>=0);
ok('publicPlan: zamienniki przy produktach',pub.days.some(d=>d.m.some(m=>m.i.some(i=>Array.isArray(i[3])&&i[3].length))));
const vmP=V.fromPublic(pub,{client:'Anna'});
ok('fromPublic: te same posiłki i notatka',vmP.days.length===7&&vmP.days[0].meals[0].slot===nW.week.days[0].meals[0].name&&vmP.note==='Pij wodę przed posiłkiem.');
ok('fromPublic: zamienniki w modelu',vmP.days[0].meals.some(m=>m.items.some(i=>i.swaps.length)));
ok('fromPublic: stary format [id, ilość] działa',V.fromPublic({kcal:1800,p:120,f:60,c:200,days:[{n:'Poniedziałek',m:[{n:'Śniadanie',d:'',k:400,i:[['jajko',2],['chleb',60]]}]}]},{}).days[0].meals[0].items.length===2);

// Zmiany trenera: posiłek z edycji liczy kcal na nowo, lista zakupów też.
const w2=JSON.parse(JSON.stringify(week));
const before=w2.shopping.find(s=>s.id==='kurczak');
V.applyEdits(w2,{'0:0':{slot:'Śniadanie',dish:'Moje śniadanie',items:[{id:'kurczak',amount:300,role:'p',swaps:[]}]}});
ok('applyEdits: nowy posiłek i kcal',w2.days[0].meals[0].dish==='Moje śniadanie'&&Math.round(w2.days[0].meals[0].total.kcal)===360&&w2.days[0].meals[0].edited);
ok('applyEdits: lista zakupów przeliczona',(w2.shopping.find(s=>s.id==='kurczak')||{}).amount>=((before&&before.amount)||0)+300);

// Wydruk A4
const html=V.printHTML(vmW,{base:'https://x.test/app/'});
ok('wydruk: A4 i marginesy 12–15 mm',/@page dpv\{size:A4 portrait;margin:14mm 13mm 16mm 13mm/.test(html));
ok('wydruk: stopka na każdej stronie',html.includes('@bottom-left{content:"Progress Live · Plan dla Anna Kowalczyk · 16.11.2026"'));
ok('wydruk: karty nie dzielą się między strony',/\.dpvp \.meal\{[^}]*break-inside:avoid/.test(html));
ok('wydruk: bez fixed i sticky w planie',/@media print\{[\s\S]*\.dpvp \*\{position:static!important\}/.test(html)&&!/position:(fixed|sticky)/.test(html.replace(/\.dpv-preview\{[^}]*\}/,'')));
ok('wydruk: czcionka min. 10 pt w treści',/\.dpvp\{[^}]*font-size:10pt/.test(html)&&/ul\.ings li\{[^}]*font-size:10pt/.test(html));
ok('wydruk: wszystkie posiłki i lista zakupów',(html.match(/class="blk meal"/g)||[]).length===35&&html.includes('Lista zakupów na tydzień'));
ok('wydruk: zdjęcia z adresu aplikacji',html.includes('<base href="https://x.test/app/">')&&html.includes('src="assets/dania/'));
ok('wydruk: podział na strony w dokumencie',html.includes(V.PAGINATE.slice(0,40)));
ok('wydruk: suma dnia pod posiłkami każdego dnia',(html.match(/class="blk daysum"/g)||[]).length===7&&html.includes('Suma dnia — Poniedziałek'));
const wk=vmW.days.reduce((s,d)=>s+d.total.kcal,0);
ok('wydruk: suma tygodnia i średnia',html.includes('Suma tygodnia')&&html.includes('Średnio dziennie')&&html.includes('<td>'+Math.round(wk)+'</td>'));
const scr=V.render('t-sum',vmW,{mode:'client'});
ok('ekran: suma dnia w zakładce Dzisiaj',scr.includes('data-dpv-daysum')&&scr.includes('Cel na dzień'));
ok('wydruk: dane escapowane',!V.printHTML(V.fromBuilt(nt.targets,week.days[0],{client:'Anna <b>'}),{}).includes('Anna <b>'));
console.log('All diet plan view tests passed ('+n+').');
