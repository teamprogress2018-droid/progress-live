// On-demand: darmowe treningi YouTube i odtwarzacz (bez stubów bez URL).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const els = {};
const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: (id) => els[id] || null,
  addEventListener() {},
  createElement: (tag) => {
    const el = {
      id: '',
      className: '',
      innerHTML: '',
      style: {},
      tagName: String(tag || 'div').toUpperCase(),
      children: [],
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener() {},
      click() {},
      remove() {},
      setAttribute() {},
      removeAttribute() {}
    };
    return el;
  },
  body: { appendChild(el) { if (el && el.id) els[el.id] = el; } }
};
document.body.appendChild = (el) => { if (el && el.id) els[el.id] = el; };
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c-anna', name: 'Anna Nowak' }],
  PL: [], SE: [], EX: [], WO: [], TASKS: [],
  OD_WORKOUTS: [],
  persistById: async (_c, o) => o,
  document
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
  Infinity,
  undefined,
  URL,
  encodeURIComponent,
  setTimeout,
  clearTimeout,
  notify() {}
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const root = path.join(__dirname, '..', '..');
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
windowObj.persistById = async (_c, o) => o;
ctx.persistById = windowObj.persistById;
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

const demo = windowObj.OD_DEMO_WORKOUTS || [];
ok('demo workouts exist', demo.length >= 18, 'n=' + demo.length);
ok('every demo has youtube url', demo.every(w => /youtube\.com\/watch\?v=/i.test(w.url || '')), demo.map(w => w.url).join(','));
ok('every demo embeds', demo.every(w => /youtube-nocookie\.com\/embed\//.test(ctx.coachVideoEmbed(w.url) || '')), demo.map(w => ctx.coachVideoEmbed(w.url)).join(','));
ok('no channel-only urls', demo.every(w => !/youtube\.com\/@/.test(w.url || '')));
ok('hiit is madfit', demo.some(w => w.id === 'ow2' && /HhdYlniTjvg/.test(w.url)));
ok('hips is adriene', demo.some(w => w.id === 'ow5' && /zwoVcrdmLOE/.test(w.url)));
ok('tabata collection', demo.filter((w) => w.coll === 'tabata').length >= 3 && demo.some((w) => w.id === 'ow8' && w.coll === 'tabata' && w.format === 'tabata'));
ok('hiit collection films', demo.filter((w) => w.coll === 'hiit').length >= 4);
ok('assign to client on cards', /openAssignHomeworkModal/.test(ctx.odWorkoutCardHTML(demo.find((w) => w.id === 'ow15') || demo[0], 0)));

windowObj.OD_WORKOUTS = [];
ok('fallback to demo', ctx.allODWorkouts().length >= 18);
ctx.ensureODWorkouts();
ok('ensure copies demo', windowObj.OD_WORKOUTS.length >= 18 && windowObj.OD_WORKOUTS[0].url);

windowObj.OD_WORKOUTS = [
  { id: 'ow1', name: 'Full Body 30 min (HASfit)', type: 'workout', url: '', desc: 'stub' },
  { id: 'custom', name: 'Moje wideo', type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
];
const migrated = ctx.migrateODYoutubeWorkouts();
ok('migrated stub count', migrated === 1, 'changed=' + migrated);
ok('ow1 now youtube', /445nEr4-uJM/.test(windowObj.OD_WORKOUTS[0].url));
ok('custom video kept', /dQw4w9WgXcQ/.test(windowObj.OD_WORKOUTS[1].url));

const card = ctx.odWorkoutCardHTML(windowObj.OD_WORKOUTS[0], 0);
ok('card play handler', /openODWorkout\('ow1'\)/.test(card));
ok('card youtube thumb', /i\.ytimg\.com\/vi\/445nEr4-uJM/.test(card));
ok('card youtube pill', /YouTube/.test(card));
ok('openODWorkout exported', typeof ctx.openODWorkout === 'function');

const html = ctx.capScreenHTML('ondemand', { id: 'c-anna', name: 'Anna' });
ok('client ondemand programs', /openODProgramClient/.test(html) && /Program/i.test(html));
ok('client ondemand mobility program', /Mobilność/i.test(html) || /Dom bez sprzętu/i.test(html));

const homeHtml = ctx.capScreenHTML('home', { id: 'c-anna', name: 'Anna Nowak' });
ok('home ondemand featured (no progress yet)', /ON-DEMAND/i.test(homeHtml) && /openODProgramClient/.test(homeHtml) && !/KONTYNUUJ PROGRAM/i.test(homeHtml));

ok('progress doc id stable', ctx.odProgramProgressDocId('c-anna', 'op2') === 'odpr_c-anna_op2');
const cont0 = ctx.odProgramContinueForClient('c-anna');
ok('continue finds active program', !!(cont0 && cont0.prog && cont0.prog.id === 'op2' && cont0.next));
ok('continue next is first session', cont0 && cont0.next.weekIdx === 0 && cont0.next.dayIdx === 0);
windowObj.OD_PROGRESS = [{
  id: 'odpr_c-anna_op2',
  clientId: 'c-anna',
  programId: 'op2',
  done: ['op2:0:0'],
  updatedAt: new Date().toISOString()
}];
const cont1 = ctx.odProgramContinueForClient('c-anna');
ok('continue after one day', cont1 && cont1.pct > 0 && cont1.next.dayIdx === 2);
const homeContinue = ctx.capScreenHTML('home', { id: 'c-anna', name: 'Anna Nowak' });
ok('home continue card when partial', /KONTYNUUJ PROGRAM/i.test(homeContinue) && /openODProgramContinue/.test(homeContinue));

ok('cap od msg id', ctx.capOdMsgId('[od:ow1]\nTrening') === 'ow1');
ok('cap live nav has ondemand', (ctx.capLiveNavScreens() || []).some((s) => s.id === 'ondemand'));

if (typeof ctx.ensureODPrograms === 'function') ctx.ensureODPrograms();
const progs = ctx.allODPrograms();
ok('demo program active youtube', progs.some((p) => p.id === 'op2' && p.status === 'active' && ctx.odProgramWorkoutCount(p) >= 5));
ok('mobility program demo', progs.some((p) => p.id === 'op3' && p.category === 'mobilnosc' && ctx.odProgramSessionTotal(p) >= 4));
ok('breath workouts demo', demo.filter((w) => w.format === 'breath').length >= 5);
ok('breath program op5', progs.some((p) => p.id === 'op5' && p.category === 'oddech'));
ok('home no equipment program', progs.some((p) => p.id === 'op4' && p.category === 'dom' && ctx.odProgramSessionTotal(p) >= 4));
ok('hiit program op6', progs.some((p) => p.id === 'op6' && p.category === 'hiit' && ctx.odProgramSessionTotal(p) >= 4));
ok('tabata program op7', progs.some((p) => p.id === 'op7' && p.category === 'tabata' && ctx.odProgramSessionTotal(p) >= 4));
ok('od programs for collection', ctx.odProgramsForCollection('mobilnosc').some((p) => p.id === 'op3'));
ok('od workouts for collection', ctx.odWorkoutsForCollection('oddech').length >= 5);
ok('od workouts tabata', ctx.odWorkoutsForCollection('tabata').length >= 3);
ok('od workouts hiit', ctx.odWorkoutsForCollection('hiit').length >= 4);
ok('sync missing demos', (() => {
  windowObj.OD_WORKOUTS = [{ id: 'custom', name: 'X', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', coll: 'fbw' }];
  const n = ctx.syncMissingODDemoWorkouts();
  return n >= 10 && ctx.odWorkoutsForCollection('dom').length >= 2 && ctx.odWorkoutsForCollection('oddech').length >= 5 && ctx.odWorkoutsForCollection('tabata').length >= 3;
})());
ok('sync moves ow8 to tabata', (() => {
  windowObj.OD_WORKOUTS = [{ id: 'ow8', name: 'Tabata 16 min — cardio (MadFit)', type: 'video', url: 'https://www.youtube.com/watch?v=XI0YfASj5gY', coll: 'hiit', format: 'tabata' }];
  ctx.syncMissingODDemoWorkouts();
  const w = windowObj.OD_WORKOUTS.find((x) => x.id === 'ow8');
  return w && w.coll === 'tabata';
})());
ok('openODAddFilm exported', typeof ctx.openODAddFilm === 'function');
ok('openODCollection exported', typeof ctx.openODCollection === 'function');
ok('html collection films mount', fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="od-collection-films"'));
ok('html coll options tabata hiit', /id="odw-coll"[\s\S]*value="hiit"[\s\S]*value="tabata"[\s\S]*value="oddech"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
ok('cache 09', /09-posture-kb-invites-private\.js\?v=34/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
ok('cache 04', /04-client-portal\.js\?v=36/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
ok('collections include tabata', /id:'tabata'/.test(fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8')));
windowObj._cliveOdProgId = 'op2';
const odProgHtml2 = ctx.capScreenHTML('odprogram', { id: 'c-anna', name: 'Anna' });
ok('client odprogram play buttons', /openODWorkout\('ow1'\)/.test(odProgHtml2));
ok('client odprogram toggle day', /toggleODProgramDay\('op2',0,0\)/.test(odProgHtml2));
ok('ondemand workouts tab removed', !fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('id="odtab-workouts"'));
ok('cap odprog msg id', ctx.capOdProgMsgId('[odprog:op2]\nProgram') === 'op2');
ok('live nav has resources', (ctx.capLiveNavScreens() || []).some((s) => s.id === 'resources'));

const op2 = progs.find((p) => p.id === 'op2');
ok('week complete helper', !ctx.odProgramWeekComplete('c-anna', op2, 0));
windowObj.OD_PROGRESS = [{
  id: 'odpr_c-anna_op2',
  clientId: 'c-anna',
  programId: 'op2',
  done: ['op2:0:0', 'op2:0:2', 'op2:0:4'],
  updatedAt: new Date().toISOString()
}];
ok('week complete after three days', ctx.odProgramWeekComplete('c-anna', op2, 0));
const notifs = [];
ctx.addNotification = (type, title, body, action, fixedId) => {
  notifs.push({ type, title, body, action, fixedId });
};
windowObj.addNotification = ctx.addNotification;
ctx.odProgramNotifyAfterToggle('c-anna', 'op2', 0, true);
ok('week done notification', notifs.some((n) => n.fixedId === 'odprog_week_c-anna_op2_0' && /Tydzień programu/i.test(n.title)));
notifs.length = 0;
windowObj.OD_PROGRESS[0].done = ['op2:0:0', 'op2:0:2', 'op2:0:4', 'op2:1:0', 'op2:1:2', 'op2:1:4'];
ctx.odProgramNotifyAfterToggle('c-anna', 'op2', 1, true);
ok('program done notification', notifs.some((n) => n.fixedId === 'odprog_done_c-anna_op2' && /ukończony/i.test(n.title)));
windowObj.OD_PROGRESS = [];
ok('session key', ctx.odProgramSessionKey('op2', 0, 2) === 'op2:0:2');
ok('session total youtube days', ctx.odProgramSessionTotal(op2) >= 5, 'n=' + ctx.odProgramSessionTotal(op2));
windowObj._clientAppMode = true;
windowObj._clientId = 'c-anna';
windowObj.OD_PROGRESS = [];
ctx.toggleODProgramDay('op2', 0, 0);
ok('progress stored', (windowObj.OD_PROGRESS[0] && (windowObj.OD_PROGRESS[0].done || []).includes('op2:0:0')));
ok('progress pct after one', ctx.odProgramProgressPct('c-anna', op2) > 0);
const afterToggle = ctx.capScreenHTML('odprogram', { id: 'c-anna', name: 'Anna' });
ok('progress label after toggle', /Postęp/.test(afterToggle));
windowObj._clientAppMode = false;

const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
ok('share od tag', /\[od:'\+id\+'\]/.test(src09));
ok('share odprog tag', /\[odprog:'\+id\+'\]/.test(src09));
ok('live od player', /openODWorkoutLive/.test(src09));
ok('program weeks editor', /id="odp-weeks"/.test(src09) && /odpAddWeek/.test(src09));
ok('starter pack od tags', /\[od:'\+w\.id\+'\]/.test(src09) && /\[odprog:'\+prog\.id\+'\]/.test(src09));
ok('preview no longer notify-only', !/notify\('\$\{w\.name\} — podgląd'\)/.test(src09));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nOn-demand YouTube: OK');
