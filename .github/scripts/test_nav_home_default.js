#!/usr/bin/env node
'use strict';
/** Ekran startowy = lista klientów (jak we wzorze); dawny panel główny to „Pulpit”. */
const { cacheAtLeast } = require('./cache-pin.js');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

const navStart = html.indexOf('sidebar-nav');
const moreStart = html.indexOf('</nav>', navStart);
const primary = html.slice(navStart, moreStart);
const more = html.slice(html.indexOf('class="sidebar-utility"'), html.indexOf('</aside>'));

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('clients default screen', /class="screen active" id="screen-clients"/.test(html));
ok('dashboard not default', !/class="screen active" id="screen-dashboard"/.test(html) && (html.match(/class="screen active"/g) || []).length === 1);
ok('clients first, Pulpit right after', primary.indexOf('data-screen="clients"') < primary.indexOf('data-screen="dashboard"') && /data-screen="dashboard"[^>]*>[\s\S]{0,400}?Pulpit</.test(primary));
ok('clients active nav', /nav-item nav-flyout-trigger active" id="nav-clients-btn"/.test(primary) && !/nav-item active" data-screen="dashboard"/.test(primary));
ok('no sidebar client panel', !html.includes('id="nav-clients-panel"'));
ok('dashboard not in account area', !more.includes('data-screen="dashboard"'));
ok('nav groups without dashboard', /navGroupScreens=\{[^}]*ondemand/.test(core) && !/navGroupScreens=\{[^}]*dashboard/.test(core));
ok('CI step', wf.includes('test_nav_home_default.js'));

ok('cache bump core v34', cacheAtLeast(html, '01-core.js', 137));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll nav-home-default tests passed');
