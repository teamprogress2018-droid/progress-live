#!/usr/bin/env node
'use strict';
/** Kalendarz: Zapisz edytuje, quick-add nie gubi godziny, nowa sesja wymaga klienta. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const cal = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01/05', html.includes('01-core.js?v=113') && html.includes('05-clients-builder-plans-calendar.js?v=78'));
ok('ci unit', wf.includes('test_cal_session_save.js'));
ok('ci ui', wf.includes('test_cal_session_save_ui.js'));

const openM = core.slice(core.indexOf('function openM(id)'), core.indexOf('function closeM(id)'));
ok('openM resets session form', /as-client/.test(openM) && /as-notes/.test(openM) && /as-duration/.test(openM) && /_editingSessionId=null/.test(openM));

const quick = cal.slice(cal.indexOf('function quickAddSession'), cal.indexOf('function openSessDetail'));
ok('quickAdd after openM', quick.indexOf("openM('m-session')") < quick.indexOf("as-date") && /as-time/.test(quick));

const save = cal.slice(cal.indexOf('async function saveSess'), cal.indexOf('function calJumpTo') > 0 ? cal.length : cal.length);
ok('save requires client', /Wybierz klienta/.test(save));
ok('save updates existing', /_editingSessionId/.test(save) && /Sesja zapisana/.test(save) && /existing\.date=date/.test(save));
ok('edit loads duration', /as-duration/.test(cal.slice(cal.indexOf('function editSession'), cal.indexOf('function delSessionFromModal'))));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll calendar session-save source checks passed');
