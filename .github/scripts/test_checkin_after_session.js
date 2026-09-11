#!/usr/bin/env node
'use strict';
// Check-in po zapisanym treningu (Live End / sala / apka) — raz na tydzień.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement(){return{style:{},classList:{toggle(){},contains(){return false}},querySelector(){return null},querySelectorAll(){return[]}};},
  documentElement:{style:{setProperty(){}}}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], CHECKINS: {},
  SETTINGS: { notifications: { weeklyCheckin: true, weeklyCheckinDay: 1 } },
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
  Map,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

vm.runInContext(`
function withTrainer(o){return o;}
function newId(p){return p+'-'+Math.random().toString(36).slice(2,8);}
function dateStr(d){const x=d||new Date();const p=n=>String(n).padStart(2,'0');return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());}
function persistById(col,item){ window._persist=window._persist||[]; window._persist.push({col,item}); }
function pushMsg(cid,text){ window._msgs=window._msgs||[]; window._msgs.push({cid,text}); }
function addNotification(){ window._notifs=window._notifs||[]; window._notifs.push([].slice.call(arguments)); }
function notify(){}
function refreshDashOps(){ window._dashOps=(window._dashOps||0)+1; }
async function persistCheckin(ci){ if(typeof persistById==='function')persistById('checkins',ci); }
function ensureCheckins(clientId){ if(!window.CHECKINS[clientId]) window.CHECKINS[clientId]=[]; }
window.withTrainer=withTrainer;
window.newId=newId;
window.dateStr=dateStr;
window.persistById=persistById;
window.pushMsg=pushMsg;
window.addNotification=addNotification;
window.notify=notify;
window.refreshDashOps=refreshDashOps;
window.persistCheckin=persistCheckin;
window.ensureCheckins=ensureCheckins;
`, ctx);
vm.runInContext('var ensureCheckins=window.ensureCheckins; var withTrainer=window.withTrainer; var newId=window.newId; var dateStr=window.dateStr; var persistCheckin=window.persistCheckin; var persistById=window.persistById; var pushMsg=window.pushMsg; var addNotification=window.addNotification; var notify=window.notify; var refreshDashOps=window.refreshDashOps;', ctx);

const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const chunk = src04.match(/function getCIStatus[\s\S]*?window\.maybeSendCheckinAfterSession=maybeSendCheckinAfterSession;/);
if (!chunk) {
  console.error('FAIL could not extract maybeSendCheckinAfterSession from 04-client-portal.js');
  process.exit(1);
}
vm.runInContext(chunk[0], ctx);

const { maybeSendCheckinAfterSession, pendingCheckin, needsWeeklyCheckin } = ctx;
if (typeof maybeSendCheckinAfterSession !== 'function') {
  console.error('FAIL maybeSendCheckinAfterSession not exported');
  process.exit(1);
}

let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

function dateStrNow(){
  const x=new Date();
  const p=n=>String(n).padStart(2,'0');
  return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}

windowObj.CL = [
  {id:'c1', name:'Ala Nowak', status:'active'},
  {id:'c2', name:'Bartek', status:'active'},
  {id:'c3', name:'Celina', status:'archived'}
];
windowObj.PL = [{id:'p1', clientId:'c1'}];
windowObj.CHECKINS = {};
windowObj._msgs = [];
windowObj._persist = [];
windowObj._notifs = [];
windowObj._dashOps = 0;
windowObj.SETTINGS.notifications.weeklyCheckin = true;

const r1 = maybeSendCheckinAfterSession('c1');
eq('session unlocks pending', !!(r1 && r1.status === 'pending'), true);
eq('session source', r1 && r1.source, 'session');
eq('pending helper', !!(pendingCheckin('c1')), true);
eq('chat ping', (windowObj._msgs || []).length >= 1, true);
eq('trainer notif', (windowObj._notifs || []).some(a => String(a[1] || '').indexOf('Check-in po treningu') >= 0), true);
eq('dash refresh', windowObj._dashOps >= 1, true);
eq('persisted checkin', (windowObj._persist || []).some(p => p.col === 'checkins'), true);

windowObj._persist = [];
windowObj._msgs = [];
const nBefore = (windowObj.CHECKINS.c1 || []).length;
maybeSendCheckinAfterSession('c1');
eq('no spam when pending', (windowObj.CHECKINS.c1 || []).length, nBefore);
eq('no persist when pending', (windowObj._persist || []).length, 0);
eq('needs false while pending', needsWeeklyCheckin('c1'), false);

windowObj.CHECKINS = {
  c1: [{id:'ci1', clientId:'c1', status:'filled', date: dateStrNow(), answers:{energy:4,sleep:4,stress:2,nutrition:4}, score:80}]
};
windowObj._persist = [];
eq('skip filled this week', maybeSendCheckinAfterSession('c1'), null);
eq('no persist after filled', (windowObj._persist || []).length, 0);

windowObj.CHECKINS = {};
windowObj._persist = [];
eq('skip client without plan', maybeSendCheckinAfterSession('c2'), null);
eq('skip archived', maybeSendCheckinAfterSession('c3'), null);
eq('skip unknown client', maybeSendCheckinAfterSession('missing'), null);
eq('skip empty id', maybeSendCheckinAfterSession(''), null);

windowObj.SETTINGS.notifications.weeklyCheckin = false;
eq('respect weeklyCheckin off', maybeSendCheckinAfterSession('c1'), null);
windowObj.SETTINGS.notifications.weeklyCheckin = true;

const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const app = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
eq('Live End hooks check-in', /maybeSendCheckinAfterSession\(st\.savedClientId\)/.test(live), true);
eq('sala Odbył się hooks check-in', /maybeSendCheckinAfterSession\(p&&p\.clientId\)/.test(core), true);
eq('client app finish hooks check-in', /maybeSendCheckinAfterSession\(clientId\)/.test(app), true);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll check-in after session tests passed');
