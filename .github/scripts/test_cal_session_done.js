#!/usr/bin/env node
'use strict';
/** Kalendarz i profil klienta: odbyte treningi (✓, tooltip, klasa done). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const cal = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const cp = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01 v71', html.includes('01-core.js?v=95'));
ok('cache 05 v37', html.includes('05-clients-builder-plans-calendar.js?v=55'));
ok('cache 08 v38', html.includes('08-client-profile-extras.js?v=53'));
ok('cache styles v56', html.includes('styles.css?v=79'));
ok('ci unit', wf.includes('test_cal_session_done.js'));
ok('ci ui log done', wf.includes('test_cal_log_done_ui.js'));
ok('helpers in core', /function sessionHappened/.test(core) && /function sessionHappenedTip/.test(core) && /function sessionIsRecorded/.test(core));
ok('cal helper', /function calSessionDoneBits/.test(cal));
ok('week uses done class', /cal-session-block\$\{bits\.cls\}/.test(cal));
ok('month uses done class', /cal-month-sess\$\{bits\.cls\}/.test(cal));
ok('list uses done class', /cal-list-sess\$\{bits\.cls\}/.test(cal));
ok('week tooltip', /bits\.tip/.test(cal) && /odbył się/.test(cal));
ok('mini has-done', /has-done/.test(cal));
ok('sidebar odbyte kpi', /Odbyte/.test(cal) && /sessionIsRecorded/.test(cal));
ok('sidebar odbyte no pair double-count', !/weekSess\.filter\(s=>typeof sessionHappened/.test(cal));
ok('css done block', /\.cal-session-block\.cal-session-done/.test(css));
ok('css month done', /\.cal-month-sess\.cal-session-done/.test(css));
ok('css list done', /\.cal-list-sess\.cal-session-done/.test(css));
ok('css mini done', /\.cal-mini-day\.has-done/.test(css));
ok('profile hover title', /title="\$\{escHtml\(tip\)\}"/.test(cp));
ok('profile checkmark', /happened\?'✓ ':''/.test(cp) || /happened\?'✓ '/.test(cp));
ok('profile done class', /cp-sess-done/.test(cp) && /\.cp-sess-done/.test(css));
ok('log from planned in core', /function logSessionFromPlanned/.test(core) && /source:'sala'/.test(core));
ok('sala done modal', /function openSalaDoneModal/.test(core) && /function saveSalaDone/.test(core) && /Wybierz ocenę 1–5/.test(core));
ok('mark done opens modal', /openSalaDoneModal/.test(cp) && /cp-mark-done/.test(cp) && /Odbył się/.test(cp));
ok('no one-click confirm', !/Oznaczyć trening/.test(cp));
ok('session modal sala bar', html.includes('id="as-sala-done"') && /openSalaDoneModal/.test(cal));
ok('cal list sala btn', /cal-sala-done/.test(cal));
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
ok('client calendar sala', /clientMarkSalaDone/.test(src04) && /function clientMarkSalaDone/.test(src10) && /Byłem na sali/.test(src04));
ok('calendar local ymd', /cellYmd/.test(cp) && /todayYmd/.test(cp));
ok('no-logged banner', /cp-no-logged-banner/.test(cp) && /Brak zapisu treningu/.test(cp));
ok('history skips planned', /sessionIsRecorded/.test(cp) && /historyList/.test(cp));
ok('assignment hides planned when logged', /loggedDates/.test(cp));
ok('adherence keeps fulfilled plan', /keepPlanned:true/.test(core) && /opts&&opts\.keepPlanned/.test(cp));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll calendar done-mark tests passed');
