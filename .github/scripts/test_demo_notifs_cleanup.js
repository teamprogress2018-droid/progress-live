#!/usr/bin/env node
'use strict';
/** Dead DEMO_NOTIFS seed removed — notifications come from Firestore only. */
const fs = require('fs');
const path = require('path');

const portal = fs.readFileSync(path.join(__dirname, '../..', '04-client-portal.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('no DEMO_NOTIFS const', !/DEMO_NOTIFS\s*=/.test(portal));
ok('no DEMO_NOTIFS refs', !portal.includes('DEMO_NOTIFS'));
ok('clearAllNotifs uses NOTIFICATIONS', /function clearAllNotifs\(/.test(portal) && portal.includes('window.NOTIFICATIONS=[]'));
ok('addNotification still present', /function addNotification\(/.test(portal));
ok('allNotifs from NOTIFICATIONS', portal.includes('function allNotifs(){return window.NOTIFICATIONS||[];}'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll demo-notifs-cleanup tests passed');
