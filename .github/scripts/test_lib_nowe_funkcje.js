#!/usr/bin/env node
'use strict';
/** Biblioteka – nowe funkcje (audyt 18.10, pakiet F): ulubione ćwiczenia, ostatnio używane, duplikuj plan. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const six = read('06-inbox-exercises-ai-programs.js');
const five = read('05-clients-builder-plans-calendar.js');
const css = read('styles.css');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}
function slice(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
}

ok('ci unit', wf.includes('test_lib_nowe_funkcje.js'));
ok('ci ui', wf.includes('test_lib_nowe_funkcje_ui.js'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=106'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=103'));
ok('cache styles', html.includes('styles.css?v=165'));

ok('star on card and list row', six.includes('${exFavBtnHtml(e)}') && (six.match(/\$\{exFavBtnHtml\(e\)\}/g) || []).length === 3);
ok('favourites saved in settings', /window\.SETTINGS\.favoriteExercises=/.test(six) && /persistSettingsDoc/.test(slice(six, 'function toggleFavEx', 'function exFavPaint')));
ok('nav has Ulubione and Ostatnio używane', six.includes("['__fav','★ Ulubione'") && six.includes("['__recent','🕘 Ostatnio używane'"));
ok('recent keeps recency order', six.includes("if(exCatFilter==='__recent')filtered.sort((a,b)=>recent.indexOf(a.name)-recent.indexOf(b.name));"));
ok('star styles', css.includes('.ex-fav-btn.is-on{color:#FFD60A;}'));
ok('duplicate button on plan', five.includes("onclick=\"event.stopPropagation();duplicatePlan('${id}')\""));

// Ostatnio używane – z planów, od najnowszego, bez powtórzeń, tylko ćwiczenia z biblioteki.
const ctx = {
  window: {},
  allExercises: () => [{ name: 'Przysiad ze sztangą' }, { name: 'Wyciskanie sztangi leżąc' }, { name: 'Wiosłowanie sztangą' }],
  libExerciseByName: (n) => (/^wiosłowanie/i.test(n) ? { name: 'Wiosłowanie sztangą' } : null)
};
vm.createContext(ctx);
vm.runInContext(slice(six, 'function recentExNames', 'window.recentExNames'), ctx);
ctx.window.PL = [
  { createdAt: '2026-10-01', days: [{ exercises: [{ name: 'Przysiad ze sztangą' }, { name: 'Nieznane ćwiczenie' }] }] },
  { createdAt: '2026-10-10', days: [{ exercises: [{ name: 'Wyciskanie sztangi leżąc' }, { name: 'Przysiad ze sztangą' }] }, { rest: true, exercises: [] }, { exercises: ['Wiosłowanie'] }] }
];
const r = ctx.recentExNames(10);
ok('recent newest first, unique, library only', r.join('|') === 'Wyciskanie sztangi leżąc|Przysiad ze sztangą|Wiosłowanie sztangą', r.join('|'));
ok('recent limit', ctx.recentExNames(1).length === 1);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lib new-feature checks passed');
