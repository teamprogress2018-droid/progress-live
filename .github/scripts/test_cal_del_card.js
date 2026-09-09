#!/usr/bin/env node
'use strict';
/** Profil klienta → Treningi: usuwanie kart z kalendarza. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cp = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const cal = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 05 v42', html.includes('05-clients-builder-plans-calendar.js?v=48'));
ok('cache 08 v46', html.includes('08-client-profile-extras.js?v=47'));
ok('card delete btn', /class="cp-del-sess"/.test(cp) && /delCpSession\(/.test(cp));
ok('bulk clear', /function clearClientPlannedSessions/.test(cp) && /Usuń terminy planu/.test(cp));
ok('bulk in render', /clearClientPlannedSessions\(/.test(cp) && /Usuń terminy planu/.test(cp));
ok('modal delete', html.includes('id="as-del-btn"') && html.includes('delSessionFromModal()'));
ok('delSession refreshes CP', /renderCPTraining/.test(cal) && /function delSessionFromModal/.test(cal));
ok('confirm planned vs logged', /Usunąć ten termin z kalendarza/.test(cal));
ok('CI unit', wf.includes('test_cal_del_card.js'));
ok('CI ui', wf.includes('test_cal_del_card_ui.js'));

const start = cal.indexOf('function dropPlannedSessionsFrom');
const end = cal.indexOf('/** Tworzy sesje kalendarzowe');
ok('drop extract', start >= 0 && end > start);
const ctx = vm.createContext({
  window: { SE: [], _db: null },
  String, console
});
vm.runInContext(cal.slice(start, end), ctx);
ctx.window.SE = [
  { id: 'p1', clientId: 'c1', date: '2026-09-01', source: 'planned' },
  { id: 'p2', clientId: 'c1', date: '2026-09-09', source: 'planned' },
  { id: 'l1', clientId: 'c1', date: '2026-09-06', source: 'live' },
  { id: 'p3', clientId: 'c2', date: '2026-09-07', source: 'planned' }
];
const n = ctx.dropPlannedSessionsFrom('c1', '1970-01-01');
ok('drops all planned for client', n === 2, 'n=' + n);
ok('keeps live', ctx.window.SE.some(s => s.id === 'l1'));
ok('keeps other client', ctx.window.SE.some(s => s.id === 'p3'));

if (failed) process.exit(1);
console.log('\nAll cal-del-card tests passed');
