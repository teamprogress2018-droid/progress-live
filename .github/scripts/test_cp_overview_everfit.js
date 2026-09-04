#!/usr/bin/env node
'use strict';
/** Client profile Overview: Everfit-like main + right rail (display-only). */
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

ok('bmi/watch banner', overview.includes('cp-bmi-banner') && overview.includes('Asystent trenera'));
ok('main column', overview.includes('cp-ov-main'));
ok('right rail', overview.includes('cp-ov-rail'));
ok('training 7 days', overview.includes('last7') && overview.includes('Ostatnie 7 dni'));
ok('training 30 days', overview.includes('last30') && overview.includes('Ostatnie 30 dni'));
ok('training next week', overview.includes('nextWeekAssigned') && overview.includes('Następny tydzień'));
ok('last workout', overview.includes('Ostatni trening'));
ok('body metrics cards', overview.includes('Pomiary ciała') && overview.includes('cp-ov-metrics-grid'));
ok('weight metric', overview.includes("metricCard('Waga'"));
ok('metric sparklines', overview.includes('cpOvSparkSVG') || /function\s+cpOvSparkSVG/.test(src));
ok('metrics link to progress', overview.includes("setCPTab('progress')") && overview.includes('Aktualizuj pomiary'));
ok('goal rail', overview.includes("railCard('Cel'"));
ok('notes rail', overview.includes("railCard('Notatki'"));
ok('injuries rail', overview.includes('Ograniczenia'));
ok('photos rail clickable', overview.includes('Zdjęcia postępu') && overview.includes("setCPTab('photos')"));
ok('pulse status', overview.includes('cp-ov-pulse') && /function\s+cpClientPulseStatus/.test(src));
ok('physique card', overview.includes('Aktualna sylwetka') && overview.includes('cp-ov-physique'));
ok('feel + garmin 7d', overview.includes('Samopoczucie (check-in)') && overview.includes('Garmin · 7 dni'));
ok('train icons', overview.includes('cpTrainIconRow') && /function\s+cpTrainIconRow/.test(src));
ok('remind in overview', overview.includes("cpRemindClient('") && overview.includes('Przypomnij'));
ok('no updates rail', !overview.includes('Aktualizacje') && !/function\s+cpOverviewUpdates/.test(src));
ok('cache 08', html.includes('08-client-profile-extras.js?v=40'));
ok('overview edit CTA', overview.includes('cp-ov-edit-cta') && overview.includes('Dane osobowe'));
ok('profil rail shows name', overview.includes('Imię i nazwisko'));
ok('rail cards clickable not button spam', overview.includes('cp-ov-rail-card clickable') && !overview.includes('>Edytuj</button>'));
ok('no duplicate message in profile rail', !/WhatsApp|mailto:/.test(overview));
ok('no giant profile grid on overview', !overview.includes('cp-data-grid'));
ok('no food journal on overview', !/Żywienie|Meal Plan|food journal/i.test(overview));
ok('css layout', css.includes('.cp-ov-layout') && css.includes('.cp-ov-rail'));
ok('css pulse physique metrics', css.includes('.cp-ov-pulse') && css.includes('.cp-ov-physique') && css.includes('.cp-metrics-head'));
ok('wider cp-body',
  (html.includes('max-width:1120px') && html.includes('id="cp-body"')) ||
  (css.includes('.cp-body-inner') && css.includes('max-width:1120px') && html.includes('id="cp-body"'))
);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-overview-everfit tests passed');
