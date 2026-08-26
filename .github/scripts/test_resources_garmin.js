// Zasoby: YouTube zamiast stubów Spotify. Garmin: parser CSV bez OAuth.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild() {}, click() {}, remove() {} })
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  TASKS: [],
  METRIC_ENTRIES: [],
  USER_RESOURCES: [],
  INT_CONNECTIONS: {},
  persistById: async (_col, obj) => obj,
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
ctx.persistById = async (_col, obj) => obj;
windowObj.persistById = ctx.persistById;
vm.runInContext(fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8'), ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8'), ctx);
} catch (e) {
  if (!(windowObj.DEMO_RESOURCES && windowObj.isGenericSpotifyUrl)) throw e;
}

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const demo = windowObj.DEMO_RESOURCES || ctx.DEMO_RESOURCES || [];
ok('demo resources exist', demo.length >= 10, 'n=' + demo.length);
ok('no spotify stubs in demo', demo.every(r => !/spotify\.com/i.test(r.url || '')), demo.map(r => r.url).join(','));
ok('youtube podcasts present', demo.filter(r => /youtube\.com/i.test(r.url || '')).length >= 8);
ok('huberman youtube', demo.some(r => /nm1TxQj9IsQ/.test(r.url || '') && /youtube/i.test(r.url || '')));
ok('mindpump youtube', demo.some(r => /m0ApkrgL3b0/.test(r.url || '')));
ok('music watch urls', demo.filter(r => r.coll === 'music').every(r => /[?&]v=([A-Za-z0-9_-]{11})/.test(r.url || '')));
ok('podcast watch urls', demo.filter(r => r.coll === 'podcasts').every(r => /[?&]v=([A-Za-z0-9_-]{11})/.test(r.url || '')));
ok('no channel @ urls in demo music/podcasts', demo.filter(r => r.coll === 'music' || r.coll === 'podcasts').every(r => !/youtube\.com\/@/.test(r.url || '')));

ok('generic spotify homepage', windowObj.isGenericSpotifyUrl('https://open.spotify.com') === true);
ok('generic creators stub', windowObj.isGenericSpotifyUrl('https://creators.spotify.com') === true);
ok('real playlist kept', windowObj.isGenericSpotifyUrl('https://open.spotify.com/playlist/abc123') === false);
ok('youtube not generic spotify', windowObj.isGenericSpotifyUrl('https://www.youtube.com/@hubermanlab') === false);
ok('channel url detected', windowObj.isYoutubeChannelOrNonEpisodeUrl('https://www.youtube.com/@hubermanlab') === true);
ok('watch url not channel', windowObj.isYoutubeChannelOrNonEpisodeUrl('https://www.youtube.com/watch?v=nm1TxQj9IsQ') === false);

windowObj.USER_RESOURCES = [
  { id: 'r5', name: 'old', url: 'https://open.spotify.com', type: 'podcast', cat: 'trening', desc: 'stub', coll: 'podcasts' },
  { id: 'custom', name: 'Moja playlista', url: 'https://open.spotify.com/playlist/xyz', type: 'link', cat: 'muzyka' }
];
const migrated = windowObj.migrateSpotifyDemoResources();
ok('migrated stub count', migrated === 1, 'changed=' + migrated);
ok('r5 now youtube', /youtube\.com\/watch\?v=/i.test(windowObj.USER_RESOURCES[0].url));
ok('custom playlist kept', windowObj.USER_RESOURCES[1].url === 'https://open.spotify.com/playlist/xyz');

windowObj.USER_RESOURCES = [
  { id: 'r8', name: 'old huberman channel', url: 'https://www.youtube.com/@hubermanlab', type: 'podcast', cat: 'psychologia', desc: 'channel', coll: 'podcasts' },
  { id: 'r10', name: 'old music channel', url: 'https://www.youtube.com/@TheWorkoutMix', type: 'video', cat: 'muzyka', desc: 'channel', coll: 'music' },
  { id: 'custom2', name: 'mój odcinek', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', type: 'video', cat: 'muzyka', coll: 'music' }
];
const epMig = windowObj.migrateDemoYoutubeEpisodeResources();
ok('episode migrate count', epMig === 2, 'changed=' + epMig);
ok('r8 now watch episode', /watch\?v=nm1TxQj9IsQ/.test(windowObj.USER_RESOURCES[0].url));
ok('r10 now watch mix', /watch\?v=m1Iz9hcnsuY/.test(windowObj.USER_RESOURCES[1].url));
ok('custom watch kept', windowObj.USER_RESOURCES[2].url === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

ok('garmin is daily', ctx.intWorksNow('garmin') === true);
ok('stripe still server', ctx.intWorksNow('stripe') !== true);
const garmin = (windowObj.INTEGRATIONS || ctx.INTEGRATIONS || []).find(i => i.id === 'garmin');
ok('garmin card exists', !!garmin);
ok('garmin docs connect.garmin.com', garmin && /connect\.garmin\.com/.test(garmin.docs || ''));
ok('garmin does not claim oauth secrets', garmin && /Firestore/i.test(garmin.desc || ''));
ok('oauth feature is off', garmin && garmin.features.some(f => /OAuth/i.test(f.name) && f.on === false));

ok('32:15 duration', ctx.parseGarminDuration('00:32:15') === 32);
ok('1h5m duration', ctx.parseGarminDuration('1:05:00') === 65);
ok('km distance', ctx.parseGarminDistance('5.23') === 5.23);
ok('meter distance', ctx.parseGarminDistance('5230') === 5.23);
ok('comma km', ctx.parseGarminDistance('5,23 km') === 5.23);

const csv = [
  'Activity Type,Date,Title,Distance,Calories,Time,Avg HR,Steps',
  'Running,2024-03-12 18:30:00,Morning Run,5.23,412,00:32:15,148,0',
  'Cycling,2024-03-13 07:00:00,"City, loop",12.4,620,00:48:00,132,0'
].join('\n');
const rows = ctx.parseGarminCsv(csv);
ok('csv rows', rows.length === 2, JSON.stringify(rows));
ok('run date', rows[0] && rows[0].date === '2024-03-12');
ok('run time', rows[0] && rows[0].time === '18:30');
ok('run kcal', rows[0] && rows[0].calories === 412);
ok('run minutes', rows[0] && rows[0].minutes === 32);
ok('run hr', rows[0] && rows[0].hr === 148);
ok('quoted title', rows[1] && rows[1].title === 'City, loop');

const pl = [
  'Typ aktywności;Data;Tytuł;Dystans;Kalorie;Czas;Śr. tętno;Kroki',
  'Bieganie;15.03.2024 09:10;Park;4,2;380;00:28:00;141;6200'
].join('\n');
const plRows = ctx.parseGarminCsv(pl);
ok('pl csv row', plRows.length === 1, JSON.stringify(plRows));
ok('pl date', plRows[0] && plRows[0].date === '2024-03-15');
ok('pl steps', plRows[0] && plRows[0].steps === 6200);
ok('pl distance comma', plRows[0] && plRows[0].distance === 4.2);

windowObj.METRIC_ENTRIES = [];
windowObj.SE = [];
const imported = ctx.importGarminCsvForClient('c1', csv);
ok('import ok', imported.ok === true, JSON.stringify(imported));
ok('import metrics', imported.metrics === 2, JSON.stringify(imported));
ok('import sessions', imported.sessions === 2);
ok('metric group mg6', windowObj.METRIC_ENTRIES[0] && windowObj.METRIC_ENTRIES[0].groupId === 'mg6');
ok('metric source garmin', windowObj.METRIC_ENTRIES[0] && windowObj.METRIC_ENTRIES[0].source === 'garmin');
ok('session source garmin', windowObj.SE[0] && windowObj.SE[0].source === 'garmin');
ok('session duration', windowObj.SE[0] && windowObj.SE[0].duration === 32);
ok('session title garmin', ctx.sessionTitle(windowObj.SE[0]) === 'Morning Run');
ok('session label garmin', ctx.sessionSourceLabel(windowObj.SE[0]) === 'Garmin');
ok('preview rows', imported.preview && imported.preview.length === 2);
const again = ctx.importGarminCsvForClient('c1', csv);
ok('duplicate skipped', again.ok && again.skipped === 2 && again.metrics === 0, JSON.stringify(again));

const daily = [
  'Date,Calories Burned,Steps,Distance,Minutes Sedentary,Minutes Lightly Active,Minutes Fairly Active,Minutes Very Active,Resting Heart Rate',
  '2024-03-14,2100,8432,6.2,600,180,25,20,58'
].join('\n');
const dailyRows = ctx.parseGarminCsv(daily);
ok('daily csv row', dailyRows.length === 1, JSON.stringify(dailyRows));
ok('daily not activity', dailyRows[0] && dailyRows[0].activity === false);
ok('daily steps', dailyRows[0] && dailyRows[0].steps === 8432);
ok('daily calories burned', dailyRows[0] && dailyRows[0].calories === 2100);
ok('daily hr', dailyRows[0] && dailyRows[0].hr === 58);
ok('daily skips sedentary', dailyRows[0] && dailyRows[0].minutes === 45, JSON.stringify(dailyRows[0]));
const beforeSess = windowObj.SE.length;
const dailyImp = ctx.importGarminCsvForClient('c1', daily);
ok('daily metrics', dailyImp.ok && dailyImp.metrics === 1, JSON.stringify(dailyImp));
ok('daily no calendar session', dailyImp.sessions === 0 && windowObj.SE.length === beforeSess, JSON.stringify(dailyImp));

const groups = windowObj.DEMO_METRIC_GROUPS || ctx.DEMO_METRIC_GROUPS || [];
ok('mg6 metric group', groups.some(g => g.id === 'mg6' && g.name === 'Garmin Connect'));

const htmlCsv = [
  'Activity Type,Date,Title,Distance,Calories,Time,Avg HR,Steps',
  'Running,2024-03-12 18:30:00,Morning Run,5.23,412,00:32:15,148,8432'
].join('\n');
ctx.importGarminCsvForClient('c-html', htmlCsv);
const anna = { id: 'c-html', name: 'Anna Nowak' };
ok('cap last garmin notes', ctx.capLastGarmin(anna) && ctx.capLastGarmin(anna).notes === 'Morning Run');
ok('cap last garmin steps', ctx.capLastGarmin(anna) && ctx.capLastGarmin(anna).values.m1 === 8432);
ok('youtube domain helper', ctx.capResourceDomain('https://www.youtube.com/@hubermanlab') === 'youtube.com');
windowObj.USER_RESOURCES = (windowObj.DEMO_RESOURCES || []).map(r => Object.assign({}, r));
ok('youtube resources helper', ctx.capYoutubeResources().length >= 8);
ok('client resources youtube first', /youtube\.com/i.test((ctx.capClientResourceList('all')[0] || {}).url || ''));
ok('podcast filter youtube', ctx.capClientResourceList('podcast').every(r => /youtube\.com/i.test(r.url || '') && (r.type === 'podcast' || r.coll === 'podcasts')));

const progressHtml = ctx.capScreenHTML('progress', anna);
ok('client progress panel', /MOJE POSTĘPY/.test(progressHtml));
ok('client progress calendar entry', /Kalendarz/.test(progressHtml));
// Activity title / kcal live on home + calendar + session; Progress shows Kroki chart when ≥2 punktów.
const day2 = [
  'Activity Type,Date,Title,Distance,Calories,Time,Avg HR,Steps',
  'Running,2024-03-13 07:00:00,Easy Jog,3.1,280,00:25:00,140,6200'
].join('\n');
ctx.importGarminCsvForClient('c-html', day2);
const progressHtml2 = ctx.capScreenHTML('progress', anna);
ok('client progress garmin steps chart', /Kroki \(Garmin\)/.test(progressHtml2));
ok('client progress garmin sparkline data', /8432|6200/.test(progressHtml2));

const homeHtml = ctx.capScreenHTML('home', anna);
ok('client home garmin card', /Easy Jog|Morning Run/i.test(homeHtml) && /6200|8432/.test(homeHtml));
ok('client home youtube podcasts', /Podcasty YouTube/i.test(homeHtml) && /youtube\.com/i.test(homeHtml));

windowObj._cliveCal = { y: 2024, m: 2 };
const calHtml = ctx.capScreenHTML('calendar', anna);
ok('client calendar garmin section', /Z zegarka Garmin/i.test(calHtml));
ok('client calendar morning run', /Morning Run/i.test(calHtml));

windowObj._cliveSessionId = (windowObj.SE.find(s => s.clientId === 'c-html' && s.source === 'garmin') || {}).id;
const sessHtml = ctx.capScreenHTML('session', anna);
ok('client session garmin label', /Garmin/i.test(sessHtml) && /Morning Run/i.test(sessHtml));
ok('client session not generic Sesja', !/· Sesja/.test(sessHtml));

const resHtml = ctx.capScreenHTML('resources', anna);
ok('client resources youtube.com', /youtube\.com/i.test(resHtml));
ok('client resources no open.spotify.com', !/open\.spotify\.com/i.test(resHtml));
ok('client resources podcast pill', /Podcasty/i.test(resHtml) && /Muzyka/i.test(resHtml));

const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
ok('no garmin oauth secret fields', !/garmin[\s\S]{0,400}client_secret/i.test(src04));
ok('garmin daily id', /INT_DAILY_IDS=\[[^\]]*garmin/.test(src04));
ok('jump to client app', /openGarminImportedClientApp/.test(src04));
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
ok('live client loads resources', /queryByTrainerId\('resources'/.test(src10));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nZasoby YouTube + Garmin CSV: OK');
