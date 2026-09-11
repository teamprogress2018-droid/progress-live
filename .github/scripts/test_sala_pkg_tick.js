#!/usr/bin/env node
'use strict';
/** Sala i Live zdejmują jedną sesję pakietu na dzień. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=101'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=60'));
ok('helpers', /function consumeClientPackageSession/.test(core) && /function clientPaidPackageForSession/.test(core));
ok('sala consumes', /consumeClientPackageSession\(p\.clientId/.test(core));
ok('live uses helper', /consumeClientPackageSession\(st\.clientId/.test(live));
ok('CI unit', wf.includes('test_sala_pkg_tick.js'));
ok('CI ui', wf.includes('test_cal_log_done_ui.js'));

function extract(src, name) {
  const start = src.indexOf('function ' + name);
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const notes = [];
const sandbox = {
  window: {
    PACKAGES: [
      { id: 'pk1', clientId: 'c1', title: '10 sesji', payStatus: 'paid', sessions: 10, sessionsUsed: 2, expiresDate: '2027-01-01' },
      { id: 'pk2', clientId: 'c1', title: 'Nieopłacony', payStatus: 'pending', sessions: 8, sessionsUsed: 0, expiresDate: '2027-01-01' }
    ],
    SE: [],
    CL: [{ id: 'c1', name: 'Anna' }],
    PL: [{ id: 'pl1', clientId: 'c1', days: [{ exercises: [{ name: 'Squat' }] }] }]
  },
  persistById: (_col, obj) => obj,
  addNotification: (t, title, body) => notes.push({ t, title, body }),
  withTrainer: (o) => o,
  newId: (p) => p + '_x',
  todayYmd: () => '2026-09-11',
  isLoggedWorkout: (s) => s && (s.source === 'live' || s.source === 'sala' || s.source === 'client'),
  Date,
  console
};
sandbox.PACKAGES = sandbox.window.PACKAGES;
sandbox.SE = sandbox.window.SE;
sandbox.CL = sandbox.window.CL;
sandbox.window.persistById = sandbox.persistById;

vm.createContext(sandbox);
vm.runInContext(
  extract(core, 'clientPackageExpired') + '\n' +
  extract(core, 'clientPaidPackageForSession') + '\n' +
  extract(core, 'sessionConsumedPackageOnDay') + '\n' +
  extract(core, 'consumeClientPackageSession') + '\n' +
  extract(core, 'logSessionFromPlanned') + '\n' +
  'window.clientPackageExpired=clientPackageExpired;' +
  'window.consumeClientPackageSession=consumeClientPackageSession;' +
  'window.logSessionFromPlanned=logSessionFromPlanned;' +
  'window.isLoggedWorkout=isLoggedWorkout;',
  sandbox
);

ok('picks paid package', sandbox.clientPaidPackageForSession('c1').id === 'pk1');
ok('skips unpaid client', sandbox.clientPaidPackageForSession('c9') == null);

const sess1 = { id: 's1', clientId: 'c1', date: '2026-09-11' };
const a = sandbox.consumeClientPackageSession('c1', { date: '2026-09-11', session: sess1 });
ok('first tick', a && a.sessionsUsed === 3 && sandbox.PACKAGES[0].sessionsUsed === 3, 'used=' + sandbox.PACKAGES[0].sessionsUsed);
ok('marks session', sess1.pkgTick === true);

sandbox.window.SE = [{ id: 's1', clientId: 'c1', date: '2026-09-11', source: 'sala', pkgTick: true }];
sandbox.SE = sandbox.window.SE;
const b = sandbox.consumeClientPackageSession('c1', { date: '2026-09-11', session: { id: 's2', clientId: 'c1', date: '2026-09-11' } });
ok('no double same day', b == null && sandbox.PACKAGES[0].sessionsUsed === 3);

sandbox.window.SE = [];
sandbox.SE = sandbox.window.SE;
sandbox.window.PACKAGES[0].sessionsUsed = 9;
const last = sandbox.consumeClientPackageSession('c1', { date: '2026-09-12', session: { id: 's3', clientId: 'c1', date: '2026-09-12' } });
ok('last session notifies', last && last.sessionsUsed === 10 && notes.some(n => /wyczerpany|Ostatnia/.test(n.title)), JSON.stringify(notes));

sandbox.window.PACKAGES[0].sessionsUsed = 2;
sandbox.window.SE = [];
sandbox.SE = sandbox.window.SE;
sandbox.window.SE.push({ id: 'p1', clientId: 'c1', date: '2026-09-11', source: 'planned', planId: 'pl1', dayIdx: 0, type: 'Trening' });
const sala = sandbox.logSessionFromPlanned('p1', sandbox.window.SE, { feedback: 4, duration: 50 });
ok('sala creates logged', !!(sala && sala.source === 'sala' && sala.pkgTick === true));
ok('sala ticks package', sandbox.PACKAGES[0].sessionsUsed === 3, 'used=' + sandbox.PACKAGES[0].sessionsUsed);
const again = sandbox.logSessionFromPlanned('p1', sandbox.window.SE, { feedback: 5, duration: 40 });
ok('second mark updates not ticks', !!(again && again.id === sala.id) && sandbox.PACKAGES[0].sessionsUsed === 3);

sandbox.window.PACKAGES[0].payStatus = 'pending';
sandbox.window.PACKAGES[0].sessionsUsed = 2;
sandbox.window.SE = [{ id: 'p2', clientId: 'c1', date: '2026-09-13', source: 'planned', planId: 'pl1', dayIdx: 0 }];
const unpaid = sandbox.logSessionFromPlanned('p2', sandbox.window.SE, { feedback: 3, duration: 40 });
ok('unpaid no tick', unpaid && !unpaid.pkgTick && sandbox.PACKAGES[0].sessionsUsed === 2);

if (failed) process.exit(1);
console.log('\nAll sala package-tick tests passed');
