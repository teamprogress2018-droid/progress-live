#!/usr/bin/env node
'use strict';
/** Biblioteka – pilne błędy z audytu 18.10: pole klienta, checkboxy, menu na telefonie,
 *  „Usuń duplikaty”, duplikaty nazw, cudzysłów w nazwie, escapowanie, animacja kart. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const core = read('01-core.js');
const six = read('06-inbox-exercises-ai-programs.js');
const seven = read('07-forms-metrics-calculator.js');
const two = read('02-workouts-onboarding-templates-live.js');
const css = read('styles.css');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('ci unit', wf.includes('test_lib_pilne_bledy.js'));

// --- clientPickSync + exJsArg (01-core.js) ---
function slice(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
}
const coreSlice = slice(core, '/** Escape HTML', '/** Stabilne ID');
ok('core slice', !!coreSlice);
const fields = {};
const ctx = {
  window: {},
  document: { getElementById: (id) => fields[id] || null }
};
ctx.window.CL = [
  { id: 'c1', name: 'Anna Kowalska' },
  { id: 'c2', name: 'Jan Nowak' },
  { id: 'c3', name: 'Jan  Nowak', status: 'archived' }
];
vm.createContext(ctx);
vm.runInContext(coreSlice, ctx);
fields.hid = { value: 'c1' };
fields.vis = { value: 'Anna Kowalska' };
ok('keeps picked client', ctx.clientPickSync('hid', 'vis') === 'c1');
fields.vis.value = 'Jan Nowak';
ok('retyped name switches to that client', ctx.clientPickSync('hid', 'vis') === 'c2' && fields.hid.value === 'c2');
fields.vis.value = 'Jan';
ok('partial text clears stale id', ctx.clientPickSync('hid', 'vis') === '' && fields.hid.value === '');
fields.vis.value = '  anna   kowalska ';
ok('full name without click picks client', ctx.clientPickSync('hid', 'vis') === 'c1');
fields.vis.value = '';
ok('empty text clears id', ctx.clientPickSync('hid', 'vis') === '');

const arg = ctx.exJsArg('Box jump 30" Farmer\'s <b>');
ok('exJsArg has no raw quotes', !/["<>]/.test(arg), arg);
const decoded = arg.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
ok('exJsArg round-trips', JSON.parse(decoded) === 'Box jump 30" Farmer\'s <b>');

// --- pickers wired ---
['assign-prog-client', 'task-client'].forEach((id) => ok('06 syncs ' + id, six.includes("clientPickSync('" + id + "'")));
['send-form-client', 'me-client', 'metric-client-sel'].forEach((id) => ok('07 syncs ' + id, seven.includes("clientPickSync('" + id + "'")));
ok('task blocks typed-but-unpicked client', /Wybierz klienta z listy albo wyczyść pole klienta/.test(six));
ok('picker rows use data attributes', !/onclick="\w+\('\$\{c\.id\}','\$\{c\.name/.test(six + seven));

// --- CSS ---
ok('checkboxes not hidden globally', !/(^|[}\n])input\[type=checkbox\]\{display:none;?\}/.test(css));
ok('toggle checkbox still hidden', css.includes('.osc-toggle input[type=checkbox]{display:none;}'));
ok('mobile flyout above sidebar', /\.nav-flyout\{[^}]*z-index:600;/.test(css));

// --- Ćwiczenia ---
ok('no raw name in exercise onclick', !/openExDetail\('\$\{e\.name/.test(six) && !/delEx\('\$\{e\.name/.test(six));
ok('card escapes name', /ex-card-name">\$\{escHtml\(e\.name\)\}/.test(six));
ok('animation delay capped', /animation-delay:\$\{Math\.min\(i\|\|0,12\)\*0\.025\}s/.test(six) && !/animation-delay:\$\{i\*0\.02\}s/.test(six));
ok('openExDetail does not rebuild grid', !/play\.play\(\)[\s\S]{0,200}\n  renderLib\(\);\n\}/.test(six) && /dataset\.exName===name/.test(six));
ok('saveEx blocks duplicate names', /już jest w '\+\(own\?'Twoich ćwiczeniach':'bibliotece'\)/.test(six));
ok('saveEx rejects bad media link', /Link do animacji \/ grafiki jest nieprawidłowy/.test(six));
ok('dedupe asks with list', /dryRun:true/.test(six) && /Jeśli któraś z nich to Twoje własne ćwiczenie/.test(six));

const isCopySrc = slice(six, 'function isImportedCatalogCopy', 'window.isImportedCatalogCopy');
const c2 = {};
vm.createContext(c2);
vm.runInContext(isCopySrc, c2);
const card = { name: 'Przysiad bułgarski', tip: 'Kolano nad stopą' };
ok('bare import is a copy', c2.isImportedCatalogCopy({ name: 'Przysiad bułgarski (2)' }, card));
ok('copy with catalog tip is a copy', c2.isImportedCatalogCopy({ name: 'przysiad bułgarski', tip: 'Kolano nad stopą' }, card));
ok('own description is kept', !c2.isImportedCatalogCopy({ name: 'Przysiad bułgarski', desc: 'Moja wersja z pauzą' }, card));

// --- inne podstrony ---
ok('metrics empty state has no literal template', !seven.includes("opacity:0.3;\">${group.icon}</div>"));
ok('metric group name escaped', seven.includes('<span>${escHtml(g.name)}</span>'));
ok('forms escaped', seven.includes('form-card-title">${escHtml(f.name)}'));
ok('programs escaped', six.includes('prog-card-title">${escHtml(p.name)}'));
ok('tasks escaped', six.includes('${escHtml(t.title)}'));
ok('templates escaped', two.includes('${escHtml(t.name)}') && two.includes('${escHtml(ex.n)}'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lib urgent-bug checks passed');
