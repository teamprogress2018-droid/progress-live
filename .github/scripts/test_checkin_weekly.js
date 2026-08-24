// Testy auto-checkinu tygodniowego (audit flow — po starcie współpracy).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

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
const msgs = [];
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
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

// stubs used by check-in helpers from 04
vm.runInContext(`
function withTrainer(o){return o;}
function newId(p){return p+'-'+Math.random().toString(36).slice(2,8);}
function dateStr(d){const x=d||new Date();const p=n=>String(n).padStart(2,'0');return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());}
function persistById(){}
function pushMsg(cid,text){ window._msgs=window._msgs||[]; window._msgs.push({cid,text}); }
function addNotification(){}
function notify(){}
async function persistCheckin(){}
function ensureCheckins(clientId){ if(!window.CHECKINS[clientId]) window.CHECKINS[clientId]=[]; }
window.withTrainer=withTrainer;
window.newId=newId;
window.dateStr=dateStr;
window.persistById=persistById;
window.pushMsg=pushMsg;
window.addNotification=addNotification;
window.notify=notify;
window.persistCheckin=persistCheckin;
window.ensureCheckins=ensureCheckins;
`, ctx);

// bare helpers also needed in extracted scope
vm.runInContext('var ensureCheckins=window.ensureCheckins; var withTrainer=window.withTrainer; var newId=window.newId; var dateStr=window.dateStr; var persistCheckin=window.persistCheckin; var pushMsg=window.pushMsg; var addNotification=window.addNotification; var notify=window.notify;', ctx);

const src04 = fs.readFileSync(path.join(__dirname, '..', '..', '04-client-portal.js'), 'utf8');
const chunk = src04.match(/function getCIStatus[\s\S]*?window\.ensurePendingCheckin=ensurePendingCheckin;/);
if (!chunk) {
  console.error('FAIL could not extract check-in helpers from 04-client-portal.js');
  process.exit(1);
}
vm.runInContext(chunk[0], ctx);

const {
  clientEligibleForWeeklyCheckin, needsWeeklyCheckin, isWeeklyCheckinDay,
  runWeeklyCheckinSweep, filledThisWeek, pendingCheckin, ensurePendingCheckin,
  getCIStatus, clientHasAssignedPlan
} = ctx;

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

windowObj.CL = [
  {id:'c1', name:'Ala', status:'active'},
  {id:'c2', name:'Bartek', status:'active'},
  {id:'c3', name:'Celina', status:'archived'}
];
windowObj.PL = [{id:'p1', clientId:'c1'}];
windowObj.CHECKINS = {};
windowObj._msgs = [];

eq('eligible has plan', clientEligibleForWeeklyCheckin(windowObj.CL[0]), true);
eq('eligible no plan', clientEligibleForWeeklyCheckin(windowObj.CL[1]), false);
eq('eligible archived', clientEligibleForWeeklyCheckin(windowObj.CL[2]), false);
eq('needs when empty', needsWeeklyCheckin('c1'), true);

ensurePendingCheckin('c1', {source:'auto'});
eq('pending blocks need', needsWeeklyCheckin('c1'), false);
eq('status pending', getCIStatus('c1'), 'pending');

windowObj.CHECKINS = {
  c1: [{id:'ci1', clientId:'c1', status:'filled', date: dateStrNow(), answers:{energy:4,sleep:4,stress:2,nutrition:4}, score:80}]
};
eq('filled this week blocks', !!filledThisWeek('c1'), true);
eq('needs after filled', needsWeeklyCheckin('c1'), false);

windowObj.CHECKINS = {};
windowObj._msgs = [];
windowObj.SETTINGS.notifications.weeklyCheckin = true;
// Force path — ignore weekday gate
const r1 = runWeeklyCheckinSweep({force:true, silent:true});
eq('sweep force sends to plan client', r1.sent, 1);
eq('sweep force target', r1.sentIds, ['c1']);
eq('sweep created pending', !!pendingCheckin('c1'), true);
eq('sweep pushed chat', (windowObj._msgs||[]).length >= 1, true);

windowObj.CHECKINS = {};
windowObj._msgs = [];
windowObj.SETTINGS.notifications.weeklyCheckin = false;
const r2 = runWeeklyCheckinSweep({silent:true});
eq('sweep disabled', r2.sent, 0);
eq('sweep disabled reason', r2.reason, 'disabled');

windowObj.SETTINGS.notifications.weeklyCheckin = true;
windowObj.SETTINGS.notifications.weeklyCheckinDay = new Date().getDay();
eq('is weekly day matches setting', isWeeklyCheckinDay(), true);

function dateStrNow(){
  const x=new Date();
  const p=n=>String(n).padStart(2,'0');
  return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll weekly check-in tests passed');
