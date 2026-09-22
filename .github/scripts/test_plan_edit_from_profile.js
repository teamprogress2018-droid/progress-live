#!/usr/bin/env node
'use strict';
/** Plan tab Edytuj opens the builder with Fitebo day labels (D1 A/B). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const planTab = src08.slice(src08.indexOf('function renderCPPlan'), src08.indexOf('async function delPlanFromProfile'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('edit from profile helper', /function editPlanFromProfile/.test(src05) && /window.editPlanFromProfile=editPlanFromProfile/.test(src05));
ok('plan tab clicks helper', planTab.includes("editPlanFromProfile('${p.id}','${c.id}')"));
ok('plan tab buttons are type=button', /type="button"[^>]*editPlanFromProfile/.test(planTab) && /type="button"[^>]*liveSelectPlanForClient/.test(planTab));
ok('no close-after-edit race', !/editPlan\('\$\{p\.id\}'\);closeClientProfile/.test(planTab));
ok('keeps custom day labels', /function builderSetDayHeader/.test(src05) && /function builderEnsureSelectValue/.test(src05));
ok('Custom maps to Własna', /v==='Custom'\)v='Własna'/.test(src05));
ok('fitebo method not Custom', /return 'Własna'/.test(src08) && !/return 'Custom'/.test(src08));
ok('return to client after save', /function builderLeaveToCaller/.test(src05) && /builderLeaveToCaller\(\{saved:true\}\)/.test(src05));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=78'));
ok('cache 08', html.includes('08-client-profile-extras.js?v=70'));
ok('CI unit', wf.includes('test_plan_edit_from_profile.js'));
ok('CI ui', wf.includes('test_plan_edit_from_profile_ui.js'));

const start = src05.indexOf('function builderEnsureSelectValue');
const end = src05.indexOf('\nfunction editPlan(id)');
ok('extract helpers', start >= 0 && end > start);
const ctx = vm.createContext({
  window: {},
  document: {
    createElement(tag) {
      return { tagName: String(tag).toUpperCase(), value: '', textContent: '', options: [] };
    }
  },
  console,
  String, Array, Object
});
ctx.window = ctx;
vm.runInContext(
  src05.slice(start, end) +
  '\nwindow.builderEnsureSelectValue=builderEnsureSelectValue;window.builderSetDayHeader=builderSetDayHeader;',
  ctx
);

function fakeSelect(values) {
  const opts = values.map(v => ({ value: v, textContent: v }));
  const sel = {
    options: opts,
    value: values[0] || '',
    appendChild(o) { opts.push(o); }
  };
  Object.defineProperty(sel, 'options', { get() { return opts; } });
  return sel;
}

const sel = fakeSelect(['PON', 'WT', 'ŚR']);
ctx.builderEnsureSelectValue(sel, 'D1 (A)', 'D1 (A)');
ok('adds D1 (A) option', sel.options.some(o => o.value === 'D1 (A)') && sel.value === 'D1 (A)');

const method = fakeSelect(['PPL', 'FBW', 'Własna']);
ctx.builderEnsureSelectValue(method, 'Custom');
ok('Custom → Własna', method.value === 'Własna');

const dayEl = {
  querySelector(q) {
    if (q === '.builder-day-select') return sel;
    if (q === '.builder-day-focus') return { value: '' };
    return null;
  }
};
const focus = { value: '' };
dayEl.querySelector = q => q === '.builder-day-select' ? sel : (q === '.builder-day-focus' ? focus : null);
ctx.builderSetDayHeader(dayEl, { day: 'D1 (B)', muscles: 'Plecy' });
ok('day header D1 (B)', sel.value === 'D1 (B)' && focus.value === 'Plecy');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll plan-edit-from-profile tests passed');
