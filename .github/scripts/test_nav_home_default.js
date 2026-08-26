#!/usr/bin/env node
'use strict';
/** Panel główny = domyślny ekran; bez mini-listy klientów w sidebarze. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

const navStart = html.indexOf('sidebar-nav');
const moreStart = html.indexOf('nav-more-items');
const primary = html.slice(navStart, moreStart);
const more = html.slice(moreStart, html.indexOf('</nav>', moreStart));

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('dashboard default screen', /class="screen active" id="screen-dashboard"/.test(html));
ok('clients not default', !/class="screen active" id="screen-clients"/.test(html));
ok('dashboard first in primary nav', primary.indexOf('data-screen="dashboard"') < primary.indexOf('data-screen="clients"'));
ok('dashboard active nav', /nav-item active" data-screen="dashboard"/.test(primary));
ok('no sidebar client panel', !html.includes('id="nav-clients-panel"'));
ok('dashboard not under Więcej', !more.includes('data-screen="dashboard"'));
ok('moreScreens without dashboard', /moreScreens=\[[^\]]*ondemand/.test(core) && !/moreScreens=\[[^\]]*dashboard/.test(core));
ok('CI step', wf.includes('test_nav_home_default.js'));

ok('cache bump core v34', html.includes('01-core.js?v=40'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll nav-home-default tests passed');
