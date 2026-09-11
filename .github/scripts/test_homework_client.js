#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const els = {};
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: (id) => els[id] || null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild: () => {}, classList: { add() {}, remove() {} } }),
  body: { appendChild(el) { if (el && el.id) els[el.id] = el; } },
};
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Test Klient', status: 'active' }],
  PL: [], SE: [], EX: [], WO: [], TASKS: [],
  OD_WORKOUTS: [],
  SETTINGS: { clientApp: { visibleSections: {} }, brand: { accentColor: '#e60000' } },
  persistById: () => Promise.resolve(),
  notify() {},
  pushMsg() {},
  document,
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date,
  Math,
  parseInt,
  parseFloat,
  Number,
  String,
  Array,
  Object,
  JSON,
  Set,
  isFinite,
  isNaN,
  encodeURIComponent,
  setTimeout: () => 0,
  clearTimeout: () => {},
  notify() {},
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const root = path.join(__dirname, '..', '..');
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
windowObj.CL = [{ id: 'c1', name: 'Test Klient', status: 'active' }];
vm.runInContext(fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8'), ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8'), ctx);
} catch (e) {
  if (!windowObj.OD_DEMO_WORKOUTS) throw e;
}

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('isHomework kind', ctx.isHomework({ kind: 'homework' }));
ok('isHomework odWorkoutId', ctx.isHomework({ odWorkoutId: 'ow2' }));
ok('isOneShot excludes homework', !ctx.isOneShot({ kind: 'homework', odWorkoutId: 'ow2' }));
ok('nav has homework', ctx.capLiveNavScreens().some((s) => s.id === 'homework'));

ctx.ensureODWorkouts();
const w = ctx.allODWorkouts().find((x) => x.id === 'ow2');
ok('ow2 structure', !!(w && w.structure && w.structure.rounds));
ok('structure text', ctx.odWorkoutStructureText(w).includes('45s'));
ok('tabata workout exists', ctx.allODWorkouts().some((x) => x.id === 'ow8' && x.format === 'tabata'));

windowObj.TASKS = [];
ctx.assignHomeworkToClient('c1', 'ow2', { notify: false });
ok('homework assigned', windowObj.TASKS.length === 1 && windowObj.TASKS[0].kind === 'homework');

const html = ctx.capScreenHTML('homework', { id: 'c1', name: 'Test' });
ok('homework assignments only', html.includes('Tylko to, co trener Ci przypisał') && !html.includes('Oddech'));
ok('homework empty points to ondemand', html.includes('On-demand'));

ctx.ensureODWorkouts();
const guide = (ctx.allODWorkouts() || []).find((x) => x.id === 'ow21');
ok('guide demo ow21', !!(guide && guide.type === 'workout' && !guide.url && guide.structure && guide.structure.workSec));
ok('odHasGuide', typeof ctx.odHasGuide === 'function' && ctx.odHasGuide(guide));
ok('odCanPlay false for guide', ctx.odCanPlay(guide) === false);
ok('odCanStart guide', ctx.odCanStart(guide) === true);
ok('guide phases', (ctx.odGuidePhases(guide) || []).length >= 16);
const player = ctx.odPlayerHtml(guide);
ok('guide player html', /od-guide/.test(player) && /Start/.test(player) && !/Brak linku YouTube/.test(player));
ok('builder form guide fields', fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="odw-rounds"') && fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('Plan bez filmu'));

windowObj.TASKS = [];
windowObj.SE = [];
ctx.assignHomeworkToClient('c1', 'ow21', { notify: false });
const t = windowObj.TASKS[0];
t.status = 'done';
t.doneAt = (typeof ctx.todayYmd === 'function' ? ctx.todayYmd() : '2026-09-10') + 'T12:00:00.000Z';
const sess = ctx.logHomeworkSession(t, { rpe: 8, duration: 16 });
ok('hw session', !!(sess && sess.source === 'homework' && sess.rpe === '8' && sess.duration === 16));
ok('hw is logged', ctx.isLoggedWorkout(sess) === true);
ok('rpe to feedback', ctx.homeworkRpeToFeedback(8) === 4 && sess.feedback === 4);
ok('completed workouts include hw', ctx.completedWorkouts('c1').some((s) => s.id === sess.id));
const prog = ctx.capClientProgressScreenHTML({ id: 'c1', name: 'Test' }, '#ff3b30');
ok('progress lists homework rpe', /Zadania domowe/.test(prog) && /RPE 8/.test(prog));
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('cache 01/04/09/10', indexHtml.includes('01-core.js?v=97') && indexHtml.includes('04-client-portal.js?v=45') && indexHtml.includes('09-posture-kb-invites-private.js?v=39') && indexHtml.includes('10-client-app.js?v=38'));
ok('CI guide ui', wf.includes('test_homework_guide_ui.js'));

if (failed) {
  console.error('\nZadania domowe: ' + failed + ' FAIL');
  process.exit(1);
}
console.log('\nZadania domowe klienta: OK');
process.exit(0);
