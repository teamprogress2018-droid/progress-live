#!/usr/bin/env node
'use strict';
/** Nazwa dania musi pasować do składników (np. „Jajecznica” zawsze z jajkami), a zamienniki mają zbliżone kcal i makro. */
const path = require('path');
const root = path.join(__dirname, '../..');
const D = require(path.join(root, 'diet-plan.js'));
let failed = 0, n = 0;
function ok(name, cond, extra) {
  n++;
  if (!cond) { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK  ', name);
}
const FOOD = {}; D.DIET_FOODS.forEach(f => { FOOD[f.id] = f; });
const mac = (id, a) => { const f = FOOD[id], k = f.unit === 'szt' ? a : a / 100; return { kcal: f.kcal * k, p: f.p * k, f: f.f * k, c: f.c * k }; };

// Szablony: słowa z nazwy (jajecznica, omlet, tofu, skyr…) mają swój produkt w zestawie.
const tplBad = [];
Object.entries(D.MEAL_TEMPLATES).forEach(([slot, list]) => list.forEach(t => {
  const d = (t.dish || '').toLowerCase(), ids = [t.p, t.c, t.f].concat((t.x || []).map(x => x[0]));
  D.DISH_NEEDS.forEach(([re, id]) => { if (re.test(d) && !ids.includes(id)) tplBad.push(slot + ': ' + t.dish + ' bez ' + id); });
}));
ok('szablony: produkt z nazwy jest w zestawie', !tplBad.length, tplBad.slice(0, 5).join(' | '));

// Wygenerowane jadłospisy: różne kalorie, liczba posiłków, wykluczenia i zestawy dań.
const cases = [];
[[96, 3636, 'masa'], [80, 2400, 'redukcja'], [58, 1500, 'redukcja'], [70, 2000, 'utrzymanie']].forEach(([w, kcal, goal]) => {
  const t = D.dietBookTargets({ weight: w, age: 40, kcal, rmr: kcal * 0.6, pal: 1.6, goal });
  [3, 4, 5, 6].forEach(meals => [{}, { ex: ['mleko'] }, { ex: ['gluten'] }, { style: 'wege' }, { col: ['szybkie-desery'] }, { col: ['biedra'] }, { col: ['szybkie-sniadania'] }]
    .forEach(prefs => [0, 1, 2].forEach(variant => cases.push({ t, meals, prefs, variant }))));
});
const mismatch = [], egg = [], swapBad = [];
let meals = 0, eggDishes = 0, swaps = 0;
cases.forEach(o => {
  const wk = D.dietBuildWeek({ targets: o.t, meals: o.meals, variant: o.variant, prefs: o.prefs });
  wk.days.forEach(d => d.meals.forEach(m => {
    meals++;
    const have = new Set(m.items.filter(i => i.amount > 0).map(i => i.id)), dish = (m.dish || '').toLowerCase();
    D.DISH_NEEDS.forEach(([re, id]) => {
      if (dish && re.test(dish) && !have.has(id) && !(id !== 'jajko' && !FOOD[id])) mismatch.push(m.dish + ' bez ' + id);
    });
    if (/jajeczn|omlet/.test(dish)) { eggDishes++; if (!have.has('jajko')) egg.push(m.dish + ': ' + [...have].join(',')); }
    m.items.forEach(it => (it.swaps || []).forEach(s => {
      swaps++;
      const a = mac(it.id, it.amount), b = mac(s.id, s.amount);
      const kOk = Math.abs(b.kcal - a.kcal) <= Math.max(60, a.kcal * 0.3);
      const key = it.role, mOk = Math.abs(b[key] - a[key]) <= Math.max(4, a[key] * 0.2);
      if (!kOk || !mOk) swapBad.push(it.id + ' ' + it.amount + ' → ' + s.id + ' ' + s.amount + ' (' + Math.round(a.kcal) + ' vs ' + Math.round(b.kcal) + ' kcal)');
    }));
  }));
});
ok('jadłospisy: sprawdzono dużo posiłków', meals > 2000 && eggDishes > 20, meals + ' posiłków, ' + eggDishes + ' z jajkami w nazwie');
ok('jajecznica i omlet zawsze z jajkami', !egg.length, egg.slice(0, 3).join(' | '));
ok('nazwa dania pasuje do składników', !mismatch.length, [...new Set(mismatch)].slice(0, 5).join(' | '));
ok('zamienniki: zbliżone kcal (±30% lub 60 kcal) i główne makro (±20%)', swaps > 1000 && !swapBad.length, swapBad.length + '/' + swaps + ': ' + swapBad.slice(0, 4).join(' | '));

// Bez jajek (wykluczenie): danie z jajkiem w nazwie traci nazwę.
const tE = D.dietBookTargets({ weight: 70, age: 40, kcal: 2000, rmr: 1300, pal: 1.6, goal: 'utrzymanie' });
const noEgg = D.dietBuildWeek({ targets: tE, meals: 5, variant: 0, prefs: { ex: ['jaja'], col: ['szybkie-sniadania'] } });
ok('wykluczenie jaj: brak dań z jajkiem w nazwie', noEgg.days.every(d => d.meals.every(m => !/jajeczn|omlet/i.test(m.dish || ''))));
ok('dishMatches: jajecznica bez jajek = nie pasuje', !D.dishMatches({ dish: 'Jajecznica z zapiekaną bułką', p: 'jajko', c: 'chleb' }, [{ id: 'chleb', amount: 60 }, { id: 'pomidor', amount: 100 }]));

if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('\nAll dish name tests passed (' + n + ').');
