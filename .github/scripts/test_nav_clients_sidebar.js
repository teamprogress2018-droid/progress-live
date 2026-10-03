#!/usr/bin/env node
'use strict';
/** Sidebar: mini-lista klientów usunięta — klienci tylko na ekranie Wszyscy klienci. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('no sidebar client panel', !html.includes('id="nav-clients-panel"') && !html.includes('nav-clients-list'));
ok('clients nav item remains', html.includes('data-screen="clients"') && html.includes('id="screen-clients"'));
ok('renderSidebarClients safe without mount', /function\s+renderSidebarClients/.test(src05) && /getElementById\('nav-clients-list'\)/.test(src05));
ok('CI', wf.includes('test_nav_clients_sidebar.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll nav-clients-sidebar tests passed');
