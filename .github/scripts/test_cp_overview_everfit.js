#!/usr/bin/env node
'use strict';
/** Client profile Overview: Everfit-like main + right rail. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const overview = src.slice(
  src.indexOf('function renderCPOverview'),
  src.indexOf('function renderCPPlan')
);

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('layout class', overview.includes('cp-ov-layout'));
ok('main column', overview.includes('cp-ov-main'));
ok('right rail', overview.includes('cp-ov-rail'));
ok('training 7 days', overview.includes('last7') && overview.includes('Ostatnie 7 dni'));
ok('training 30 days', overview.includes('last30') && overview.includes('Ostatnie 30 dni'));
ok('training next week', overview.includes('nextWeekAssigned') && overview.includes('Następny tydzień'));
ok('last workout', overview.includes('Ostatni trening'));
ok('body metrics cards', overview.includes('Pomiary ciała') && overview.includes('cp-ov-metrics-grid'));
ok('weight metric', overview.includes("metricCard('Waga'"));
ok('metric sparklines', overview.includes('cpOvSparkSVG') || /function\s+cpOvSparkSVG/.test(src));
ok('update all metrics', overview.includes('Aktualizuj wszystkie'));
ok('goal rail', overview.includes("railCard('Cel'"));
ok('notes rail', overview.includes("railCard('Notatki'"));
ok('injuries rail', overview.includes('Ograniczenia'));
ok('photos rail', overview.includes('Zdjęcia postępu') && overview.includes('Porównaj'));
ok('updates from timeline', /function\s+cpOverviewUpdates/.test(src) && overview.includes('Aktualizacje'));
ok('no giant profile grid on overview', !overview.includes('cp-data-grid'));
ok('no food journal on overview', !/Żywienie|Meal Plan|food journal/i.test(overview));
ok('css layout', css.includes('.cp-ov-layout') && css.includes('.cp-ov-rail'));
ok('wider cp-body', /id="cp-body"[^>]*max-width:1120px|max-width:1120px[^>]*id="cp-body"/.test(html.replace(/\s+/g,' ')) || html.includes('max-width:1120px') && html.includes('id="cp-body"'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-overview-everfit tests passed');
