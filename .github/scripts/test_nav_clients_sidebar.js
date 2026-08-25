#!/usr/bin/env node
'use strict';
/** Everfit point 4: mini client list + search in sidebar. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('panel markup under clients', /data-screen="clients"[\s\S]*?id="nav-clients-panel"[\s\S]*?nav-library-wrap/.test(html));
ok('search input', html.includes('id="nav-client-search"') && html.includes('filterSidebarClients()'));
ok('list + wszyscy link', html.includes('id="nav-clients-list"') && /Wszyscy klienci/.test(html));
ok('renderSidebarClients', /function\s+renderSidebarClients/.test(src05) && /function\s+openClientFromSidebar/.test(src05));
ok('renderClients refreshes sidebar', /renderSidebarClients\(\)/.test(src05));
ok('profile open/close refreshes', /openClientProfile[\s\S]{0,1800}renderSidebarClients/.test(src07) && /closeClientProfile[\s\S]{0,400}renderSidebarClients/.test(src07));
ok('css panel', css.includes('.nav-clients-panel') && css.includes('.nav-client-item') && css.includes('.nav-clients-search'));
ok('cache bumps', html.includes('styles.css?v=35') && html.includes('05-clients-builder-plans-calendar.js?v=28') && html.includes('07-forms-metrics-calculator.js?v=25'));
ok('CI', wf.includes('test_nav_clients_sidebar.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll nav-clients-sidebar tests passed');
