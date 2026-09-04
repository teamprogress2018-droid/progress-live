#!/usr/bin/env node
'use strict';
/** Profil klienta: status, sylwetka, Garmin 7d, zwinięte kafelki, Pomiary. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 08 v41', html.includes('08-client-profile-extras.js?v=41'));
ok('cache styles v58', html.includes('styles.css?v=58'));
ok('ci unit', wf.includes('test_cp_pulse_scan.js'));
ok('metrics stacked toolbar', /cp-metrics-head/.test(src) && /cp-metrics-groups/.test(src) && /cp-metrics-actions/.test(src));
ok('collapse helper', /function cpCollapseDaySessions/.test(src));
ok('default 1w', /if\(!c\._mpView\)c\._mpView='1w'/.test(src));
ok('css no day clip', css.includes('.cp-cal-day') && !/cp-cal-day\{[^}]*max-height/.test(css) && !/cp-cal-day\{[^}]*overflow:hidden/.test(css) && css.includes('.cp-metrics-chip'));
ok('collapsed tiles skip duration', /function renderCPTraining/.test(src) && !/⏱ \$\{s\.duration\} min/.test(src));

const start = src.indexOf('function cpDaysSinceYmd');
const end = src.indexOf('function renderCPOverview');
ok('helper slice', start > 0 && end > start);

function ymdAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const pushed = [];
const windowObj = {
  CHECKINS: {},
  METRIC_ENTRIES: [],
  SE: [],
  CL: [{ id: 'c1', name: 'Anna' }]
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  Date,
  Math,
  Number,
  String,
  isFinite,
  isNaN,
  parseFloat,
  console,
  escHtml: (s) => String(s || ''),
  todayYmd: () => ymdAgo(0),
  completedWorkouts: (id) => (windowObj.SE || []).filter((s) => s.clientId === id && (s.source === 'live' || s.source === 'client')),
  ppListFor: (id) => (windowObj._photos || []).filter((p) => p.clientId === id),
  sessionTitle: (s) => s.title || s.type || 'Sesja',
  sessionHappened: (s) => s.source === 'live' || s.source === 'client',
  pushMsg: (id, text) => { pushed.push({ id, text }); },
  notify() {},
  CL: windowObj.CL
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src.slice(start, end), ctx);

const good = ctx.cpClientPulseStatus('c1');
ok('pulse none is bad', good.tone === 'bad');

windowObj.CHECKINS.c1 = [{ status: 'filled', date: ymdAgo(1), answers: { energy: 4 } }];
ok('pulse 1d good', ctx.cpClientPulseStatus('c1').tone === 'good');

windowObj.CHECKINS.c1 = [{ status: 'filled', date: ymdAgo(4), answers: { energy: 4 } }];
ok('pulse 4d warn', ctx.cpClientPulseStatus('c1').tone === 'warn');

windowObj.CHECKINS.c1 = [{ status: 'filled', date: ymdAgo(10), answers: { energy: 4 } }];
ok('pulse 10d bad', ctx.cpClientPulseStatus('c1').tone === 'bad');

windowObj.CHECKINS.c1 = [];
windowObj.SE = [{ clientId: 'c1', date: ymdAgo(1), source: 'live' }];
ok('pulse from workout good', ctx.cpClientPulseStatus('c1').tone === 'good');

ctx.todayYmd = () => '2026-09-04';
windowObj.SE = [];
windowObj.CHECKINS.c1 = [{ status: 'filled', date: '2026-09-01', answers: { energy: 4 } }];
const p3 = ctx.cpClientPulseStatus('c1');
ok('pulse 3 calendar days is warn', p3.tone === 'warn' && p3.days === 3);
windowObj.CHECKINS.c1 = [{ status: 'filled', date: '2026-09-02', answers: { energy: 4 } }];
const p2 = ctx.cpClientPulseStatus('c1');
ok('pulse 2 calendar days is good', p2.tone === 'good' && p2.days === 2);
windowObj.CHECKINS.c1 = [{ status: 'filled', date: '2026-08-28', answers: { energy: 4 } }];
const p7 = ctx.cpClientPulseStatus('c1');
ok('pulse 7 calendar days is bad', p7.tone === 'bad' && p7.days === 7);
ctx.todayYmd = () => ymdAgo(0);
windowObj.CHECKINS.c1 = [];

windowObj._photos = [{
  clientId: 'c1',
  date: ymdAgo(0),
  weight: '72',
  photos: { front: 'f.jpg', side: 's.jpg', back: 'b.jpg' }
}];
const phy = ctx.cpLatestPhysique('c1');
ok('physique poses', phy && phy.front === 'f.jpg' && phy.side === 's.jpg' && phy.back === 'b.jpg' && phy.weight === '72');

windowObj.METRIC_ENTRIES = [
  { clientId: 'c1', groupId: 'mg6', date: ymdAgo(1), values: { m1: 8000, m2: 2200, m3: 60 } },
  { clientId: 'c1', groupId: 'mg6', date: ymdAgo(2), values: { m1: 10000, m2: 2400, m3: 64 } },
  { clientId: 'c1', groupId: 'mg6', date: ymdAgo(20), values: { m1: 1000, m2: 100, m3: 10 } }
];
const g = ctx.cpGarminWeekAvg('c1');
ok('garmin 7d ignores old', g.n === 2 && g.steps === 9000 && g.hr === 62);

windowObj.METRIC_ENTRIES = [
  { clientId: 'c1', groupId: 'mg6', date: ymdAgo(1), values: { m1: 3000, m2: 400, m3: 50 } },
  { clientId: 'c1', groupId: 'mg6', date: ymdAgo(1), values: { m1: 5000, m2: 600, m3: 70 } }
];
const gSame = ctx.cpGarminWeekAvg('c1');
ok('garmin same day is 1 day and sums steps', gSame.n === 1 && gSame.steps === 8000 && gSame.kcal === 1000 && gSame.hr === 60);

const row = ctx.cpTrainIconRow(2, 5);
ok('icons 2 done 3 plan', (row.match(/cp-ov-ico done/g) || []).length === 2 && (row.match(/cp-ov-ico plan/g) || []).length === 3);

const collapsed = ctx.cpCollapseDaySessions([
  { id: 'a', title: 'DZIEŃ A — PULL + L', type: 'TP' },
  { id: 'b', title: 'DZIEŃ A — PULL + L', type: 'TP' },
  { id: 'c', title: 'DZIEŃ A — PULL + L', type: 'TP' },
  { id: 'd', title: 'DZIEŃ B — PUSH', type: 'TP' },
  { id: 'e', title: 'CORE', type: 'TP' }
]);
ok('collapse same title', collapsed.groups.length === 3 && collapsed.groups[0].items.length === 3);
ok('show max 2 tiles', collapsed.shown.length === 2 && collapsed.extra === 1);

ctx.cpRemindClient('c1', 'workout');
ok('remind pushMsg', pushed.length === 1 && /treningu/.test(pushed[0].text) && pushed[0].id === 'c1');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-pulse-scan tests passed');
