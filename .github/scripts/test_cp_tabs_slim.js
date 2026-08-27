#!/usr/bin/env node
'use strict';
/** Client profile tabs: slim primary + Analityka hub (Everfit roadmap point 3). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const drawer = html.slice(html.indexOf('id="cp-drawer"'), html.indexOf('NOTIFICATIONS PANEL'));
const tabsInner = drawer.slice(drawer.indexOf('cp-tabs-inner'), drawer.indexOf('cp-more-items'));
const moreMenu = drawer.slice(drawer.indexOf('cp-more-items'), drawer.indexOf('cp-body-scroll'));

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('primary slim order', /cpt-overview[\s\S]*cpt-training[\s\S]*cpt-plan[\s\S]*cpt-progress[\s\S]*cpt-metrics/.test(tabsInner));
ok('tasks not primary', !/id="cpt-tasks"/.test(tabsInner));
ok('documents not primary', !/id="cpt-documents"/.test(tabsInner));
ok('tasks documents in more', /cpt-tasks[\s\S]*Zadania/.test(moreMenu) && /cpt-documents[\s\S]*Dokumenty/.test(moreMenu));
ok('analytics in more not psycho/sfr/posture tabs', /cpt-analytics[\s\S]*Analityka/.test(moreMenu) && !/id="cpt-psycho"/.test(moreMenu) && !/id="cpt-sfr"/.test(moreMenu) && !/id="cpt-posture"/.test(moreMenu));
ok('moreTabs list', /moreTabs=\[[^\]]*tasks[^\]]*analytics[^\]]*documents/.test(src07) || /moreTabs=\['tasks'/.test(src07));
ok('legacy psycho→analytics', /t==='psycho'\|\|t==='sfr'\|\|t==='posture'/.test(src07) && /t='analytics'/.test(src07));
ok('renderCPAnalytics + sub nav', /function\s+renderCPAnalytics/.test(src07) && /cpAnalyticsNavHTML/.test(src07) && /setCPAnalyticsSub/.test(src07));
ok('withAnalyticsShell wraps specialty', /withAnalyticsShell/.test(src08) && /withAnalyticsShell/.test(src09));
ok('css analytics chips', css.includes('.cp-analytics-nav') && css.includes('.cp-analytics-chip'));
ok('CI step', wf.includes('test_cp_tabs_slim.js'));

ok('cache bumps', html.includes('07-forms-metrics-calculator.js?v=26') && html.includes('08-client-profile-extras.js?v=32') && html.includes('09-posture-kb-invites-private.js?v=33') && html.includes('styles.css?v=48'));
ok('cache bumps', html.includes('07-forms-metrics-calculator.js?v=27') && html.includes('08-client-profile-extras.js?v=31') && html.includes('09-posture-kb-invites-private.js?v=33') && html.includes('styles.css?v=48'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-tabs-slim tests passed');
