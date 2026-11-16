// Plan klienta: pola „Co wiemy o kliencie”, maks. 3 braki, pewność dopasowania, bramka zdrowia, krok „Jedzenie”.
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..','..');
const ctx={console};ctx.window=ctx;ctx.globalThis=ctx;
vm.runInNewContext(fs.readFileSync(path.join(root,'plan-interview.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(root,'diet-plan.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(root,'plan-client.js'),'utf8'),ctx);
const PC=ctx.PlanClient,P=ctx.PLIV;
const val=(list,k)=>list.find(f=>f.k===k).v;

// Krok „Jedzenie” jest szósty i nie ma pól wymaganych.
assert.strictEqual(P.STEP_DEFS.length,6);
assert.ok(/Jedzenie/.test(P.STEP_DEFS[5].title));
assert.deepStrictEqual(Array.from(P.stepErrors(P.emptyInterview(),6)),[],'krok Jedzenie opcjonalny');
assert.ok(P.STEP_DEFS[2].fields.some(f=>f.k==='healthFlags'),'stany zdrowia w kroku Zdrowie');

// Pełny klient: 11 pól, wszystkie wypełnione, pewność wysoka.
const anna={id:'a',name:'Anna',goal:'redukcja',age:42,height:168,weight:74,planInterview:{goal:'redukcja',exp:'3-12m',days:'3',minutes:'60',equipment:['gym'],
  medical:'none',pain:'yes',painText:'prawe kolano przy głębokim przysiadzie',job:'sitting',steps:'mid',mealsPerDay:'4',foodStyle:'wszystko',
  foodExclusions:['orzechy'],foodLikes:'owsianka',foodDislikes:'makrela',foodBudget:'sredni',cookingTime:'30',mealPrep:'3',householdSize:'2'}};
const fa=PC.facts(anna);
assert.strictEqual(fa.length,11);
assert.strictEqual(fa.filter(f=>f.top).length,6,'6 pól widocznych od razu');
assert.strictEqual(val(fa,'goal'),'Redukcja');
assert.strictEqual(val(fa,'trainings'),'3 × 60 min');
assert.strictEqual(val(fa,'body'),'168 cm · 74 kg');
assert.strictEqual(val(fa,'age'),'42 lat');
assert.strictEqual(val(fa,'allergies'),'Orzechy');
assert.strictEqual(val(fa,'activity'),'Praca siedząca, 5–8 tys. kroków');
assert.strictEqual(val(fa,'meals'),'4 dziennie');
assert.ok(/lubi: owsianka.*nie lubi: makrela/.test(val(fa,'foodPrefs')));
assert.strictEqual(val(fa,'cooking'),'Do 30 min, gotuje na 3 dni');
assert.strictEqual(val(fa,'budget'),'Średni');
assert.ok(/kolano/.test(val(fa,'limits')));
assert.strictEqual(PC.missing(fa).length,0);
assert.strictEqual(PC.confidence(fa).label,'wysoka');

// Braki: maks. 3, najpierw te o największej wadze; pewność spada, ale nic nie blokuje.
const tomasz={id:'t',goal:'masa',age:35,height:182,weight:88,planInterview:{goal:'masa',days:'3',minutes:'75',medical:'none',pain:'none',mealsPerDay:'4',foodStyle:'wszystko'}};
const ft=PC.facts(tomasz),mt=PC.missing(ft);
assert.strictEqual(val(ft,'limits'),'Brak');
assert.strictEqual(val(ft,'allergies'),'Brak','krok Jedzenie przejrzany bez wykluczeń');
assert.deepStrictEqual(Array.from(mt.map(f=>f.k)),['activity','cooking','budget']);
assert.strictEqual(PC.confidence(ft).label,'średnia');
const empty=PC.facts({id:'e'});
assert.strictEqual(PC.missing(empty).length,3,'zawsze maks. 3');
assert.deepStrictEqual(Array.from(PC.missing(empty).map(f=>f.k)),['goal','trainings','limits']);
assert.strictEqual(PC.confidence(empty).label,'niska');
assert.strictEqual(val(empty,'allergies'),'','bez kroku Jedzenie alergie są brakiem, nie „Brak”');

// Profil bez wywiadu też zasila panel.
const fp=PC.facts({id:'p',goal:'sila',age:30,height:180,weight:80,trainingFreq:4,activityLevel:'active'});
assert.strictEqual(val(fp,'goal'),'Siła');assert.strictEqual(val(fp,'trainings'),'4 w tygodniu');assert.ok(/kroków|Aktywny/.test(val(fp,'activity')));

// Bramka zdrowia: stany z wywiadu albo słowa w notatkach.
let g=PC.healthGate(anna);
assert.strictEqual(g.stop,false,'ból kolana nie blokuje odżywiania');
assert.ok(g.nutritionAllowed&&g.trainingAllowed);
g=PC.healthGate({id:'m',health:'Ciąża, 18. tydzień'});
assert.ok(g.stop&&!g.nutritionAllowed&&!g.trainingAllowed&&g.needsAck);
assert.strictEqual(g.message,'Plan wymaga konsultacji z lekarzem lub dietetykiem klinicznym.');
g=PC.healthGate({id:'m',health:'Ciąża',healthAck:{at:'2026-11-15',by:'trener'}});
assert.ok(g.stop&&!g.nutritionAllowed&&g.trainingAllowed,'po zgodzie lekarza tylko trening');
g=PC.healthGate({id:'d',planInterview:{healthFlags:['cukrzyca','leki']}});
assert.ok(g.stop&&g.flags.length===2,JSON.stringify(g.flags));
assert.strictEqual(PC.healthGate({id:'n',planInterview:{healthFlags:['none']}}).stop,false);
['biorę euthyrox','insulina','w przeszłości anoreksja','choroba nerek','omdlenia po wysiłku'].forEach(t=>assert.ok(PC.healthGate({id:'x',healthNotes:t}).stop,t));
['bóle kolana','bez uwag','alergia na orzechy'].forEach(t=>assert.ok(!PC.healthGate({id:'x',healthNotes:t}).stop,t));

// Wywiad: stany zdrowia oznaczają plan do uwagi trenera; komunikat trafia do ostrzeżeń.
const iv=Object.assign(P.emptyInterview(),{goal:'zdrowie',exp:'1-3y',days:'2',minutes:'45',equipment:['dumbbells'],medical:'none',pain:'none',healthFlags:['ciaza']});
const r=P.recommend(iv);
assert.ok(r.needsTrainerReview);
assert.ok(r.warnings.some(w=>/Plan wymaga konsultacji z lekarzem lub dietetykiem klinicznym\. \(ciąża\)/.test(w)),r.warnings.join('|'));
assert.ok(/Zdrowie .*Ciąża/.test(P.notesBlock(iv,r)));

// Jedzenie z ostatniego planu diety wypełnia wywiad; wywiad zasila kreator diety.
const d=P.prefill({id:'q',dietPlan:{meals:5,prefs:{style:'wege',ex:['gluten','pieczywo'],maxMin:20}}},null);
assert.strictEqual(d.foodStyle,'wege');assert.deepStrictEqual(Array.from(d.foodExclusions),['gluten'],'pieczywo to wybór, nie alergia');
assert.strictEqual(d.cookingTime,'30');assert.strictEqual(d.mealsPerDay,'5');
const dp=PC.dietPrefsFrom(anna);
assert.strictEqual(dp.prefs.style,'wszystko');assert.deepStrictEqual(Array.from(dp.prefs.ex),['orzechy']);
assert.strictEqual(dp.prefs.maxMin,30);assert.strictEqual(dp.meals,4);assert.strictEqual(dp.prep,3);assert.strictEqual(dp.people,2);
assert.strictEqual(PC.dietPrefsFrom({id:'z',planInterview:{cookingTime:'45'}}).prefs.maxMin,0,'45+ min = bez limitu');

// Odżywianie: orientacyjny cel (Mifflin × PAL, cel), podłoga kcal, trzy formy planu, porcje domowe.
const ntA=PC.nutritionTargets(Object.assign({gender:'K'},anna));
assert.ok(ntA.ok,'cel dla Anny');
assert.ok(ntA.kcal>=1600&&ntA.kcal<=2000,'kcal '+ntA.kcal);
assert.strictEqual(ntA.delta,-300,'redukcja −300 kcal');
assert.ok(ntA.targets.protein.g>=110,'białko '+ntA.targets.protein.g);
assert.strictEqual(ntA.water.length,2);
const tiny=PC.nutritionTargets({gender:'K',age:60,height:150,weight:45,goal:'redukcja',planInterview:{goal:'redukcja',steps:'low'}});
assert.ok(tiny.kcal>=1200&&tiny.kcal>=tiny.bmr,'nie mniej niż BMR i 1200 kcal: '+tiny.kcal);
assert.deepStrictEqual(Array.from(PC.nutritionTargets({id:'x'}).missing),['masa ciała','wzrost','wiek']);
const week=PC.buildNutrition(anna,'week',{trainDays:[1,3,5]});
assert.ok(week.ok&&week.week.days.length===7&&week.shopping.length>5&&week.shopDays===7);
assert.ok(!week.week.days.some(d=>d.meals.some(m=>m.items.some(it=>/orzech/i.test(it.id)))),'bez orzechów');
const flex=PC.buildNutrition(anna,'flex');
Object.keys(flex.flex).forEach(slot=>{const k=flex.flex[slot].map(m=>m.total.kcal);assert.ok(k.length>=1&&k.length<=3);if(k.length>1)assert.ok(Math.max(...k)-Math.min(...k)<=150,slot+': rozrzut '+k.join('/'));});
const hab=PC.buildNutrition(anna,'habits');
assert.strictEqual(hab.habits.length,3);assert.ok(hab.shopping.length>5&&!hab.shopping.some(s=>/orzech/.test(s.id)));
assert.strictEqual(hab.kcal,week.kcal,'ten sam cel w każdej formie');
assert.strictEqual(PC.homePortion('owsiane',75),'ok. 7 ½ łyżki');
assert.strictEqual(PC.homePortion('twarog',250),'ok. 1 kostka');
assert.strictEqual(PC.homePortion('nieznany',100),'');
assert.strictEqual(PC.healthGate({id:'h',health:'insulina'}).nutritionAllowed,false);

// Jadłospis dla klienta i przegląd postępów.
const pub=PC.publicPlan(week);
assert.strictEqual(pub.days.length,7);assert.ok(pub.shop.length>5&&Array.isArray(pub.shop[0]));
assert.ok(!('notes' in pub)&&!('assumptions' in pub),'tylko dane dla klienta');
assert.strictEqual(PC.nutritionTargets(anna,{delta:-400}).delta,-400,'zmiana kcal z postępów');
ctx.CHECKINS={a:[{status:'filled',date:'2026-11-20',answers:{sleep:1,energy:2,hunger:4,nutrition:4,workouts:3,hardest:'słodycze'}},{status:'pending',date:'2026-11-27',answers:{}}]};
const rv=PC.progressReview(anna,{since:'2026-11-15',plannedWorkouts:3,today:'2026-11-21'});
assert.strictEqual(rv.checkins.length,1,'tylko wypełnione');
assert.ok(rv.suggestions.some(s=>s.kind==='glod')&&rv.suggestions.some(s=>s.kind==='trening'&&s.apply&&s.apply.type==='sets'));
assert.strictEqual(rv.hardest[0].text,'słodycze');
assert.ok(rv.suggestions.length<=3);
assert.strictEqual(PC.progressReview(anna,{since:'2026-12-01'}).checkins.length,0,'check-iny sprzed publikacji pominięte');

console.log('All plan client tests passed.');
