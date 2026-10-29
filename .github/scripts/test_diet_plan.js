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
    ok(`dzień ${w}kg ${k}kcal ${n} posiłki w${v}`, d.meals.length === n && near(d.total.p, tt.protein.g) && near(d.total.c, tt.carbs.g) && near(d.total.f, tt.fat.g),
      JSON.stringify({ p: Math.round(d.total.p), c: Math.round(d.total.c), f: Math.round(d.total.f), cel: [tt.protein.g, tt.carbs.g, tt.fat.g] }));
  }));
});
const day = D.dietBuildDay({ targets: t, meals: 5, variant: 0 });
const foods = Object.fromEntries(D.DIET_FOODS.map(f => [f.id, f]));
ok('zamienniki z tej samej grupy', day.meals.every(m => m.items.every(it => it.swaps.every(s => {
  const a = foods[it.id].group, b = foods[s.id].group;
  return a === b || (a === 'nabial' && b === 'bialko');
}))));
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
ok('cache 07', cacheAtLeast(html, '07-forms-metrics-calculator.js', 46));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll diet-plan checks passed');
