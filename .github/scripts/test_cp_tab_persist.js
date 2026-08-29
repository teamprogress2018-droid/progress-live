#!/usr/bin/env node
'use strict';
/** Keep CP tab when switching clients; unread dot on sidebar list. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('openClientProfile keeps tab when open', /alreadyOpen&&cpTab/.test(src07) || /alreadyOpen&&cpTab\?cpTab/.test(src07));
ok('openClientProfile uses setCPTab', /function\s+openClientProfile[\s\S]{0,1500}setCPTab\(keepTab\)/.test(src07));
ok('opts.tab force', /o\.tab\|\|/.test(src07));
ok('sidebar unread badge', src05.includes('nav-client-attn') && src05.includes('msgHasUnread'));
ok('inbox badge refreshes sidebar', /updateInboxNavBadge[\s\S]{0,200}renderSidebarClients/.test(src06));
ok('css attn dot', css.includes('.nav-client-attn'));
ok('cache', html.includes('07-forms-metrics-calculator.js?v=30') && html.includes('05-clients-builder-plans-calendar.js?v=34') && html.includes('06-inbox-exercises-ai-programs.js?v=33') && html.includes('styles.css?v=51'));
ok('CI', wf.includes('test_cp_tab_persist.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-tab-persist tests passed');
