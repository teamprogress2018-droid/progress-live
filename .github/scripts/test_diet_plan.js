#!/usr/bin/env node
'use strict';
// Jadłospis z książek (diet-plan.js): makro wg baz wiedzy, gramatura, zamienniki, blokady bezpieczeństwa.
const fs = require('fs');
const path = require('path');
const { cacheAtLeast } = require('./cache-pin.js');

const root = path.join(__dirname, '../..');
const D = require(path.join(root, 'diet-plan.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name, extra || ''); failed++; }
  else console.log('OK  ', name);
}

// Makro wg książek: białko g/kg wg celu, tłuszcz 25%, reszta węglowodany.
const t = D.dietBookTargets({ weight: 80, age: 30, kcal: 2400, rmr: 1700, pal: 1.5, goal: 'redukcja' });
ok('białko redukcja 1,8 g/kg', t.protein.g === 144);
ok('tłuszcz 25% energii', t.fat.g === Math.round(2400 * 0.25 / 9));
ok('węglowodany = reszta', Math.abs(t.protein.g * 4 + t.fat.g * 9 + t.carbs.g * 4 - 2400) < 8);
ok('każda liczba ma źródło', [t.protein, t.fat, t.carbs, t.perMealProtein].every(x => x.sources.length && x.sources.every(s => s.ref && s.pages)));
ok('sila 1,7 g/kg', D.dietBookTargets({ weight: 100, kcal: 3500, goal: 'sila' }).protein.perKg === 1.7);
ok('kondycja 1,3 g/kg', D.dietBookTargets({ weight: 70, kcal: 2800, goal: 'kondycja' }).protein.perKg === 1.3);
ok('cel z deficytu gdy brak celu klienta', D.dietBookTargets({ weight: 70, kcal: 2000, goalDelta: -300 }).goal === 'redukcja');

// Blokady bezpieczeństwa.
ok('poniżej RMR = blokada', D.dietBookTargets({ weight: 70, age: 30, kcal: 1300, rmr: 1500 }).blocked);
ok('poniżej 18 lat = blokada', D.dietBookTargets({ weight: 60, age: 16, kcal: 2400, rmr: 1500 }).blocked);
ok('mało węglowodanów = ostrzeżenie', D.dietBookTargets({ weight: 90, age: 30, kcal: 1900, rmr: 1800, pal: 2.2, goal: 'redukcja' }).notes.length > 0);

// Dzień: gramatura trafia w makro (±10%), zamienniki z tej samej grupy.
[[80, 2400, 'redukcja', 1.5], [80, 3200, 'masa', 1.75], [60, 1900, 'inne', 1.5], [100, 3800, 'sila', 2.2]].forEach(([w, k, g, pal]) => {
  const tt = D.dietBookTargets({ weight: w, age: 30, kcal: k, rmr: 1300, pal, goal: g });
  [4, 5, 6].forEach(n => [0, 1, 2].forEach(v => {
    const d = D.dietBuildDay({ targets: tt, meals: n, variant: v });
    const near = (a, b) => Math.abs(a - b) <= Math.max(8, b * 0.1);
    // Najmniejsze sensowne porcje mogą podnieść białko, ale tylko do górnej granicy z książek,
    // a nadwyżkę białka oddają węglowodany (ta sama energia).
    const protOk = d.total.p >= tt.protein.g * 0.9 && d.total.p <= Math.max(tt.protein.g * 1.1, tt.protein.hi * w * 1.1);
    ok(`dzień ${w}kg ${k}kcal ${n} posiłki w${v}`, d.meals.length === n && protOk && near(d.total.p + d.total.c, tt.protein.g + tt.carbs.g) && Math.abs(d.total.f - tt.fat.g) <= Math.max(10, tt.fat.g * 0.12),
      JSON.stringify({ p: Math.round(d.total.p), c: Math.round(d.total.c), f: Math.round(d.total.f), cel: [tt.protein.g, tt.carbs.g, tt.fat.g] }));
  }));
});
const day = D.dietBuildDay({ targets: t, meals: 5, variant: 0 });
const foods = Object.fromEntries(D.DIET_FOODS.map(f => [f.id, f]));
ok('zamienniki z tej samej podgrupy', day.meals.every(m => m.items.every(it => it.swaps.every(s => foods[it.id].sub === foods[s.id].sub))));
ok('porcje nie mniejsze niż minimum', [0, 1, 2].every(v => [4, 5, 6].every(n => D.dietBuildDay({ targets: t, meals: n, variant: v }).meals.every(m =>
  m.items.every(it => it.amount >= (foods[it.id].min || 1) && it.swaps.every(s => s.amount >= (foods[s.id].min || 1)))))));
// Przypadek z wdrożenia: 96 kg, 185 cm, 43 lata, łagodna masa, PAL 1,75 — bez porcji typu „serek 3 g”.
const t96 = D.dietBookTargets({ weight: 96, age: 43, kcal: 3636, rmr: 1906, pal: 1.75, goal: 'masa' });
ok('96 kg: białko 173 g, węglowodany 509 g', t96.protein.g === 173 && t96.carbs.g === 509);
const d96 = D.dietBuildDay({ targets: t96, meals: 5, variant: 0 });
ok('96 kg: mięso co najmniej 80 g, serek co najmniej 50 g', d96.meals.every(m => m.items.every(it => it.amount >= (foods[it.id].min || 1))));
// Makro z suwaków: jadłospis liczy się z wybranych gramów, a odstępstwo od książek daje ostrzeżenie.
const tSel = D.dietBookTargets({ weight: 96, age: 43, kcal: 3636, rmr: 1906, pal: 1.75, goal: 'masa', selected: { p: 318, f: 101, c: 364 } });
ok('wybrane makro przechodzi do jadłospisu', tSel.selected && tSel.protein.g === 318 && tSel.carbs.g === 364);
ok('ostrzeżenie: białko poza zakresem książek', tSel.notes.some(n => n.text.includes('g białka na kg')));
ok('gramatura w krokach 5 g (małe co 1 g)', day.meals.every(m => m.items.every(it => foods[it.id].unit === 'szt' ? Number.isInteger(it.amount) : (it.amount < 30 || it.amount % 5 === 0))));
ok('produkty mają stronę źródła', D.DIET_FOODS.every(f => f.page && f.kcal > 0));
ok('Atwater produktów (±25%)', D.DIET_FOODS.every(f => { const a = 4 * f.p + 4 * f.c + 9 * f.f; return Math.abs(a - f.kcal) <= Math.max(6, f.kcal * 0.25); }));

const txt = D.dietPlanText(t, day);
ok('tekst dla klienta z zastrzeżeniem', txt.includes('nie zastępuje porady dietetyka'.replace('nie', 'Nie')) || txt.includes('Nie zastępuje'));
const card = D.dietRenderCard(t, day, { meals: 5 });
ok('karta pokazuje źródła', card.includes('📚') && card.includes('SN s. 230'));
ok('karta bez kolorów na sztywno', !/#[0-9a-f]{3,6}\b/i.test(card));

// Kalkulator: liczby bez źródła usunięte, PAL wg IOM.
ok('brak 7700 kcal/kg w wyniku', !/calcGoalDelta\/7700/.test(src07));
ok('brak 35 ml/kg', !src07.includes('0.035'));
ok('PAL IOM w przyciskach', ['1.25', '1.5', '1.75', '2.2'].every(v => html.includes('data-val="' + v + '"')) && !html.includes('data-val="1.375"'));
ok('karta jadłospisu w kalkulatorze', src07.includes('calcDietCardHTML({weight,age,kcal:target'));
ok('diet-plan.js przed kalkulatorem', html.indexOf('diet-plan.js') > 0 && html.indexOf('diet-plan.js') < html.indexOf('07-forms-metrics-calculator.js'));
ok('preset „Wg książek” domyślny', /calc-macro-btn active" data-books="1" onclick="setCalcMacroBooks\(\)"/.test(html));
ok('tryb książek ustawia gramy z bazy', src07.includes("calcMacroMode==='books'&&typeof DietPlan") && src07.includes('window._calcBookMacros={proteinG,fatG,carbG}'));
ok('suwaki przechodzą na tryb ręczny', /function syncSliders[\s\S]*?calcMacroMode='manual'/.test(src07));
// Tydzień: 7 dni z tym samym celem, różne zestawy posiłków, lista zakupów = suma porcji.
const wk = D.dietBuildWeek({ targets: t96, meals: 5, variant: 0 });
ok('tydzień ma 7 dni', wk.days.length === 7 && wk.days[0].name === 'Poniedziałek' && wk.days[6].name === 'Niedziela');
const sig = d => d.meals.map(m => m.items.filter(it => it.role !== 'x').map(it => it.id).join('+')).join('|');
ok('dni w tygodniu się różnią', new Set(wk.days.map(sig)).size === 7);
ok('każdy dzień trzyma makro', wk.days.every(d => d.total.p >= t96.protein.g * 0.9 && Math.abs(d.total.p + d.total.c - t96.protein.g - t96.carbs.g) <= (t96.protein.g + t96.carbs.g) * 0.1 && Math.abs(d.total.f - t96.fat.g) <= t96.fat.g * 0.12));
const shopSum = {}; wk.days.forEach(d => d.meals.forEach(m => m.items.forEach(it => { shopSum[it.id] = (shopSum[it.id] || 0) + it.amount; })));
ok('lista zakupów = suma porcji', wk.shopping.length === Object.keys(shopSum).length && wk.shopping.every(s => s.amount === shopSum[s.id]));
const wTxt = D.dietPlanText(t96, wk);
ok('tekst tygodnia z dniami i zakupami', D.WEEK_DAYS.every(n => wTxt.includes(n.toUpperCase())) && wTxt.includes('Lista zakupów'));
const wCard = D.dietRenderCard(t96, wk, { meals: 5 });
ok('karta tygodnia: 7 dni i przełącznik', (wCard.match(/class="diet-day"/g) || []).length === 7 && wCard.includes("dietSetView('tydzien')") && wCard.includes('Wyślij tydzień'));
ok('przełącznik widoku w kalkulatorze', src07.includes("function dietSetView(v)") && src07.includes('DietPlan.dietBuildWeek(opts)'));

// Kreator: wykluczenia, sposób żywienia, czas, 3 posiłki, 3 dni.
const tK = D.dietBookTargets({ weight: 80, age: 30, kcal: 2400, rmr: 1700, pal: 1.5, goal: 'redukcja' });
const used = d => d.meals.flatMap(m => m.items.map(it => it.id));
const tagOf = id => foods[id].tags;
[[{ style: 'weganska' }, ['mieso', 'ryby', 'mleko', 'jaja']], [{ style: 'wege', ex: ['gluten'] }, ['mieso', 'ryby', 'gluten']], [{ ex: ['mleko', 'ryby', 'gluten'] }, ['mleko', 'ryby', 'gluten']], [{ ex: ['orzeszki', 'soja', 'sezam', 'jaja'] }, ['orzeszki', 'soja', 'sezam', 'jaja']]].forEach(([prefs, banned]) => {
  [3, 4, 5, 6].forEach(n => [0, 1, 2].forEach(v => {
    const d = D.dietBuildDay({ targets: tK, meals: n, variant: v, prefs });
    const bad = used(d).filter(id => tagOf(id).some(t => banned.includes(t)));
    const badSwap = d.meals.flatMap(m => m.items.flatMap(it => it.swaps.map(s => s.id))).filter(id => tagOf(id).some(t => banned.includes(t)));
    ok(`bez ${banned.join('/')} ${n}p w${v}`, d.meals.length === n && d.meals.every(m => m.items.length) && !bad.length && !badSwap.length, bad.concat(badSwap).join(','));
  }));
});
const dSkip = D.dietBuildDay({ targets: tK, meals: 5, variant: 0, prefs: { skip: ['cottage', 'chleb'] } });
ok('produkty, których klient nie je, znikają', !used(dSkip).some(id => id === 'cottage' || id === 'chleb'));
ok('zamiana opisana przy posiłku', dSkip.meals.some(m => m.changes.some(ch => ch.from === 'cottage')));
const dQuick = D.dietBuildDay({ targets: tK, meals: 5, variant: 0, prefs: { maxMin: 15 } });
ok('limit 15 min: każdy posiłek w limicie', dQuick.meals.every(m => m.minutes <= 15) && !dQuick.warnings.length);
const tplOver = D.dietBuildDay({ targets: tK, meals: 4, variant: 0, prefs: { maxMin: 2 } });
ok('brak zestawu w limicie = ostrzeżenie', tplOver.warnings.some(w => w.includes('2 min')));
const d3 = D.dietBuildDay({ targets: tK, meals: 3, variant: 0 });
ok('3 posiłki trzymają makro', d3.meals.length === 3 && Math.abs(d3.total.p - tK.protein.g) <= tK.protein.g * 0.1 && Math.abs(d3.total.kcal - tK.kcal) <= tK.kcal * 0.06);
const w3 = D.dietBuildWeek({ targets: tK, meals: 5, variant: 0, days: 3, prefs: { style: 'wege' } });
ok('3 dni: nazwy, różne dni, zakupy', w3.days.length === 3 && w3.days[0].name === 'Dzień 1' && new Set(w3.days.map(sig)).size === 3 && w3.shopping.every(s => !tagOf(s.id).includes('mieso')));
const w3Txt = D.dietPlanText(tK, w3);
ok('tekst 3 dni z wykluczeniami', w3Txt.includes('na 3 dni') && w3Txt.includes('Bez: mięso, ryby'));
const vegan = D.dietBuildDay({ targets: tK, meals: 5, variant: 0, prefs: { style: 'weganska' } });
ok('mała baza = uczciwe ostrzeżenie', vegan.warnings.some(w => w.includes('Mało produktów')));
const kCard = D.dietRenderCard(tK, w3, { meals: 5 });
ok('karta: kreator i przełączniki', kCard.includes('Kreator jadłospisu') && kCard.includes("dietSetView('3dni')") && kCard.includes("dietToggleEx('gluten')") && kCard.includes('dietSetMaxMin(15)') && kCard.includes('dietSetMeals(3)'));
ok('karta kreatora bez kolorów na sztywno', !/#[0-9a-f]{3,6}\b/i.test(kCard));
ok('kalkulator: stan kreatora', /var dietPrefs=\{style:'wszystko'/.test(src07) && ['dietSetStyle', 'dietToggleEx', 'dietToggleSkip', 'dietSetMaxMin'].every(f => src07.includes('function ' + f + '(')));

// Zamiana całego posiłku: inny zestaw, ten sam cel dnia, pozostałe posiłki bez zmian w zestawach.
[[{}, 5], [{ style: 'wege' }, 4], [{ ex: ['gluten', 'mleko'] }, 6], [{}, 3]].forEach(([prefs, n]) => {
  const base = D.dietBuildDay({ targets: tK, meals: n, variant: 0, prefs });
  base.meals.forEach((m, mi) => {
    if (m.options < 2) return;
    const sw = D.dietBuildDay({ targets: tK, meals: n, variant: 0, prefs, mealShift: { ['0:' + mi]: 1 } });
    const key = x => x.items.map(it => it.id).join('+') + '|' + x.minutes;
    ok(`zamiana posiłku ${n}p #${mi} ${JSON.stringify(prefs)}`, sw.meals[mi].swapped && key(sw.meals[mi]) !== key(m) &&
      sw.meals.every((x, j) => j === mi || !x.swapped) &&
      Math.abs(sw.total.kcal - tK.kcal) <= tK.kcal * 0.06 && Math.abs(sw.total.p - tK.protein.g) <= tK.protein.g * 0.1,
      JSON.stringify({ day: [Math.round(base.total.kcal), Math.round(sw.total.kcal)], meal: [Math.round(m.total.kcal), Math.round(sw.meals[mi].total.kcal)] }));
  });
});
const wSw = D.dietBuildWeek({ targets: tK, meals: 5, variant: 0, days: 3, mealShift: { '2:1': 1 } });
ok('zamiana w tygodniu dotyczy jednego dnia', wSw.days[2].meals[1].swapped && !wSw.days[0].meals[1].swapped && !wSw.days[1].meals[1].swapped);
const swCard = D.dietRenderCard(tK, wSw, { meals: 5, openDay: 2 });
ok('karta: przycisk zamiany i otwarty dzień', swCard.includes('dietSwapMeal(2,1)') && /<details class="diet-day" style[^>]*>[\s\S]*<details class="diet-day" style[^>]*>[\s\S]*<details class="diet-day" open/.test(swCard));
ok('kalkulator: zamiana posiłku', src07.includes('function dietSwapMeal(d,m)') && src07.includes('mealShift:dietMealShift'));
ok('cache 07', cacheAtLeast(html, '07-forms-metrics-calculator.js', 50));
ok('cache diet-plan', cacheAtLeast(html, 'diet-plan.js', 5));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll diet-plan checks passed');
