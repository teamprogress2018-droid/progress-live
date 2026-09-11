#!/usr/bin/env node
'use strict';
/** UX audit: zadania domowe, nav 5+Więcej, Nowy plan, nazwy blok/tydzień, głos PL, klaster. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const aic = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const portal = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src06 = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK  ', name);
}

ok('flyout homework', html.includes("goToHomeworkQueue()") && html.includes('Zadania domowe'));
ok('flyout week/block names', html.includes('Bloki 8–16 tyg.') && html.includes('Gotowy tydzień'));
ok('dash QA homework+plan', html.includes("goToHomeworkQueue()") && html.includes('openNewPlanPicker()'));
ok('plans CTA picker', /id="screen-plans"[\s\S]{0,500}openNewPlanPicker\(\)/.test(html));
ok('tasks homework filter', html.includes('id="tn-homework"') && html.includes('id="t-hw"'));
ok('tasks homework CTA', html.includes("openAssignHomeworkModal('')"));
ok('int default daily', /class="auto-tab-btn active" id="int-tab-daily"/.test(html));
ok('int catalog not wszystkie as default tab', html.includes('>Katalog</button>') && html.includes('Działa dziś'));
ok('nutrition blocked copy', html.includes('Żywienie (wkrótce)') && aic.includes("mode==='nutrition'"));
ok('clive 5 primary', html.includes('id="clive-bn-homework"') && html.includes('id="clive-bn-more"') && html.includes('id="clive-more-sheet"'));
ok('clive overflow in sheet', /id="clive-more-sheet"[\s\S]*id="clive-bn-ondemand"[\s\S]*id="clive-bn-resources"/.test(html));
ok('cap preview homework nav', html.includes('id="capn-homework"'));
ok('rest voice settings', html.includes('id="set-rest-voice"') || portal.includes('id="set-rest-voice"'));
ok('rest default pl', portal.includes("restVoice:'pl'") && live.includes("||'pl'"));
ok('speak pl words', live.includes('Pięć') && live.includes('Jazda!'));
ok('rir warn', live.includes('live-rir-warn') && css.includes('.live-rir-warn'));
ok('wave dup', html.includes('value="wave"') && core.includes("mode==='wave'"));
ok('cluster rp expand', core.includes("kind:'cluster'") && core.includes("kind:'restpause'"));
ok('assign modal multi', src09.includes('ahw-cid') && src09.includes('repeatWeeks') && src09.includes('ahw-wd'));
ok('homework queue helper', core.includes('function goToHomeworkQueue'));
ok('more nav helper', src10.includes('function toggleCliveMoreNav'));
ok('schedule repeat', src10.includes('function maybeScheduleNextHomework'));
ok('strip od tags', portal.includes('function capStripOdTags') && portal.includes('capStripOdTags(raw)'));
ok('homework filter render', src06.includes("taskFilter==='homework'"));
ok('dash no-plan', portal.includes("tag:'Brak planu'") && portal.includes("tag:'Domowe zaległe'"));
ok('cache 01', html.includes('01-core.js?v=95'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=56'));
ok('cache 04', html.includes('04-client-portal.js?v=42'));
ok('cache 09', html.includes('09-posture-kb-invites-private.js?v=38'));
ok('cache 10', html.includes('10-client-app.js?v=38'));
ok('cache styles', html.includes('styles.css?v=79'));
ok('CI', wf.includes('test_ux_audit_fixes.js'));

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild() {}, classList: { add() {}, remove() {} } }),
  body: { appendChild() {} }
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Anna', status: 'active' }, { id: 'c2', name: 'Bartek', status: 'active' }],
  PL: [], SE: [], EX: [], WO: [], TASKS: [],
  OD_WORKOUTS: [], SETTINGS: { live: { restVoice: 'pl' }, clientApp: { visibleSections: {} }, brand: { accentColor: '#e60000' } },
  persistById: () => Promise.resolve(),
  notify() {},
  pushMsg() {},
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj, document, console, Date, Math, parseInt, parseFloat, Number, String,
  Array, Object, JSON, Set, isFinite, isNaN, encodeURIComponent,
  setTimeout: () => 0, clearTimeout() {}, notify() {}
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);
windowObj.CL = [{ id: 'c1', name: 'Anna', status: 'active' }, { id: 'c2', name: 'Bartek', status: 'active' }];
vm.runInContext(portal, ctx);
try { vm.runInContext(src09, ctx); } catch (e) { if (!windowObj.OD_DEMO_WORKOUTS) throw e; }
vm.runInContext(src10, ctx);
windowObj.persistById = () => Promise.resolve();
ctx.persistById = windowObj.persistById;

ctx.ensureODWorkouts();
windowObj.TASKS = [];
ctx.assignHomeworkToClient('c1', 'ow2', { notify: false, due: '2026-09-01', desc: 'Po siłowni', repeatWeeks: 4, repeatLeft: 3, repeatWeekdays: [1, 3] });
ok('hw stored repeat', windowObj.TASKS[0].repeatWeeks === 4 && windowObj.TASKS[0].repeatLeft === 3);
ok('hw stored weekdays', Array.isArray(windowObj.TASKS[0].repeatWeekdays) && windowObj.TASKS[0].repeatWeekdays.includes(1));
const hwHtml = ctx.capScreenHTML('homework', { id: 'c1', name: 'Anna' });
ok('client hw assigned not catalog', /Po siłowni/.test(hwHtml) && !/hw-filter/.test(hwHtml) && /Tylko to, co trener/.test(hwHtml));
const emptyHw = ctx.capScreenHTML('homework', { id: 'c2', name: 'Bartek' });
ok('empty hw no youtube catalog', /Brak aktywnych zadań/.test(emptyHw) && !/setCapOdTab/.test(emptyHw));
ok('strip tags', ctx.capStripOdTags('[od:ow2]\n🏠 Zrób HIIT') === '🏠 Zrób HIIT');
ok('strip odprog', ctx.capStripOdTags('[odprog:op2]\nProgram') === 'Program');
ok('nav list has homework', (ctx.capLiveNavScreens() || []).some(s => s.id === 'homework'));
ok('open homework helper', typeof ctx.clientOpenHomework === 'function' && ctx.clientOpenHomework('c1').length === 1);

windowObj.TASKS[0].status = 'done';
ctx.maybeScheduleNextHomework(windowObj.TASKS[0]);
ok('repeat schedules next', windowObj.TASKS.length === 2 && windowObj.TASKS[1].status === 'open' && windowObj.TASKS[1].repeatLeft === 2);

if (failed) {
  console.error('\n' + failed + ' ux-audit tests failed');
  process.exit(1);
}
console.log('\nAll ux-audit-fix tests passed');
