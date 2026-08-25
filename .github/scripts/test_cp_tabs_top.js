#!/usr/bin/env node
'use strict';
/** Client profile: Everfit-style horizontal top tabs. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');

const drawer = html.slice(html.indexOf('id="cp-drawer"'), html.indexOf('NOTIFICATIONS PANEL'));

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('horizontal tabs bar', drawer.includes('cp-tabs-bar'));
ok('no vertical tab sidebar width', !/width:200px[\s\S]*cpt-overview/.test(drawer.replace(/\s+/g, ' ')));
ok('top tabs order-ish', /cpt-overview[\s\S]*cpt-training[\s\S]*cpt-plan[\s\S]*cpt-tasks[\s\S]*cpt-progress[\s\S]*cpt-metrics[\s\S]*cpt-documents/.test(drawer));
ok('more dropdown', drawer.includes('cp-tabs-more-menu') && drawer.includes('cpt-features'));
ok('settings in more as Ustawienia', /cpt-features[\s\S]*Ustawienia/.test(drawer));
ok('css horizontal bar', css.includes('.cp-tabs-bar') && css.includes('.cp-main'));
ok('setCPTab more list updated', src07.includes("moreTabs=['notes'") || /moreTabs=\['notes'/.test(src07));
ok('toggleCpMoreNav hidden attr', /setAttribute\('hidden'/.test(src09) && /function\s+toggleCpMoreNav/.test(src09));
ok('cp-tab-v not used in drawer', !/cp-tab-v/.test(drawer));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-tabs-top tests passed');
