#!/usr/bin/env node
'use strict';
/** Client app visible sections: rows match nav + calendar sub-screen is gated. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const app = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

const customize = portal.slice(
  portal.indexOf('function renderCapCustomize'),
  portal.indexOf('function saveCapAppSettings')
);
const navFn = portal.slice(
  portal.indexOf('function capLiveNavScreens'),
  portal.indexOf('function capOdMsgId')
);

ok('customize has forum', customize.includes("['forum'") || customize.includes('["forum"'));
ok('customize has profile', customize.includes("['profile'") || customize.includes('["profile"'));
ok('customize calendar labeled as from Progress', customize.includes('Kalendarz (z Postępów)'));
ok('nav has forum', navFn.includes("id:'forum'"));
ok('nav has no calendar tab', !/id:'calendar'/.test(navFn));
ok('progress button gated', portal.includes("capClientSectionVisible('calendar')") && portal.includes("capGoScreen('calendar')"));
ok('calendar screen redirects when off', /if\(scr==='calendar'\)\{[\s\S]*?capClientSectionVisible\('calendar'\)[\s\S]*?capScreenHTML\('progress'/.test(portal));
ok('live app gates calendar', app.includes("scr==='calendar'") && app.includes("capClientSectionVisible('calendar')"));
ok('calendar not in free subScreens bypass', !/subScreens=\[[^\]]*calendar/.test(app));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cap-nav-sections tests passed');
