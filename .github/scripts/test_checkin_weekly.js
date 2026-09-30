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
const chunk = src04.match(/function getCIStatus[\s\S]*?window\.maybeSendCheckinAfterSession=maybeSendCheckinAfterSession;/);
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


// Regressions: response time, rather than invitation date or load order.
vm.runInContext("Date=class extends Date { constructor(...args){super(...(args.length?args:['2026-09-26T12:00:00Z']));} static now(){return new Date('2026-09-26T12:00:00Z').getTime();} };",ctx);
const recent={id:'recent',status:'filled',date:'2026-09-01',createdAt:'2026-09-01T09:00:00Z',filledAt:'2026-09-25T12:00:00Z',score:80};
const older={id:'older',status:'filled',date:'2026-09-20',filledAt:'2026-09-20T12:00:00Z'};
const stale={id:'stale',status:'pending',date:'2026-09-02',createdAt:'2026-09-02T10:00:00Z'};
const current={id:'current',status:'pending',date:'2026-09-26',createdAt:'2026-09-26T10:00:00Z'};
for(const records of [[recent,older,stale],[stale,older,recent],[older,stale,recent]]){
  windowObj.CHECKINS={c1:records};
  const before=JSON.stringify(records);
  eq('delayed response is latest',filledThisWeek('c1').id,'recent');
  eq('delayed response status',getCIStatus('c1'),'done');
  eq('old pending is superseded',pendingCheckin('c1'),null);
  eq('latest activity is response',ctx.lastCheckinActivity('c1').id,'recent');
  eq('response age',ctx.checkinRecordAgeDays(recent),1);
  eq('selection does not mutate stored order',JSON.stringify(records),before);
  windowObj._msgs=[];
  eq('weekly sweep does not resend recent response',runWeeklyCheckinSweep({force:true,silent:true}).sent,0);
  eq('session does not resend recent response',ctx.maybeSendCheckinAfterSession('c1'),null);
  eq('no duplicate message',windowObj._msgs.length,0);
}
windowObj.CHECKINS={c1:[current,recent,stale]};
eq('a new request after response stays pending',pendingCheckin('c1').id,'current');
eq('new request status takes priority',getCIStatus('c1'),'pending');
eq('newest pending chosen independent of load order',ctx.ensurePendingCheckin('c1').id,'current');
windowObj.CHECKINS={c1:[{id:'legacy-pending',status:'pending'}]};
eq('undated existing request is preserved',pendingCheckin('c1').id,'legacy-pending');
eq('undated pending blocks duplicate',needsWeeklyCheckin('c1'),false);
windowObj.CHECKINS={c1:[{id:'legacy-filled',status:'filled',date:'2026-09-25'}]};
eq('legacy date remains supported',filledThisWeek('c1').id,'legacy-filled');
windowObj.CHECKINS={c1:[{id:'boundary',status:'filled',filledAt:'2026-09-19T12:00:00.000Z'}]};
eq('exactly seven days is fresh',getCIStatus('c1'),'done');
eq('exactly seven days blocks duplicate',needsWeeklyCheckin('c1'),false);
windowObj.CHECKINS.c1[0].filledAt='2026-09-19T11:59:59.999Z';
eq('past seven days status agrees',getCIStatus('c1'),'none');
eq('past seven days permits next report',needsWeeklyCheckin('c1'),true);
for(const raw of ['',null,'not-a-date','2026-02-30','2030-01-01T12:00:00Z']){
  windowObj.CHECKINS={c1:[{id:'bad',status:'filled',filledAt:raw}]};
  eq('invalid or future answer is not fresh: '+raw,filledThisWeek('c1'),null);
  eq('invalid or future answer is not done: '+raw,getCIStatus('c1'),'none');
  eq('invalid or future answer has unknown age: '+raw,ctx.checkinRecordAgeDays(windowObj.CHECKINS.c1[0]),999);
}
windowObj.CHECKINS={c1:[recent,{id:'future',status:'filled',filledAt:'2030-01-01T12:00:00Z'}]};
eq('future record cannot hide a valid answer',filledThisWeek('c1').id,'recent');
windowObj.CHECKINS={c1:[{id:'fallback',status:'filled',filledAt:'invalid',date:'2026-09-25'}]};
eq('invalid primary timestamp uses valid legacy date',filledThisWeek('c1').id,'fallback');
const sameA={id:'a',status:'filled',filledAt:'2026-09-25T12:00:00Z'};
const sameB={id:'b',status:'filled',filledAt:'2026-09-25T14:00:00+02:00'};
for(const records of [[sameA,sameB],[sameB,sameA]]){
  windowObj.CHECKINS={c1:records};
  eq('equal instants use stable ID tie-break',filledThisWeek('c1').id,'b');
}
windowObj.CHECKINS={c1:[recent]};
const src08=fs.readFileSync(path.join(__dirname,'..','..','08-client-profile-extras.js'),'utf8');
const overviewLast=src08.match(/function cpOverviewLastCheckin[\s\S]*?(?=\r?\nfunction )/)[0];
vm.runInContext("function cpOverviewTodayYmd(){return '2026-09-26';} function cpOverviewDaysBetween(a,b){return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);}"+overviewLast,ctx);
eq('trainer overview uses response date',ctx.cpOverviewLastCheckin('c1'),{days:1,ymd:'2026-09-25'});


windowObj.CHECKINS={c1:[{id:'expired-pending',status:'pending',createdAt:'2026-09-19T11:59:59.999Z'}]};
eq('pending is overdue just after seven days',getCIStatus('c1'),'overdue');
const detail=src04.match(/function renderCIDetail[\s\S]*?(?=\r?\nfunction )/)[0];
const reportList=src04.match(/function dashOpsRecentReports[\s\S]*?(?=\r?\nfunction )/)[0];
ctx.CL=windowObj.CL;
ctx._detail={innerHTML:''};
ctx.document.getElementById=()=>ctx._detail;
ctx.renderCIAnswers=()=>'FILLED_ANSWERS';
ctx.ciFillFormHtml=()=>'FILL_FORM';
ctx.escHtml=x=>String(x||'');
ctx.dashOpsLiveClients=()=>[windowObj.CL[0]];
ctx.renderCIChart=()=>{};
vm.runInContext(detail+'\n'+reportList,ctx);
windowObj.CHECKINS={c1:[recent,{id:'undated',status:'pending'}]};
windowObj._ciFillOpen='c1';
ctx.renderCIDetail('c1');
eq('undated pending can still be filled',ctx._detail.innerHTML.includes('FILL_FORM'),true);
const early={id:'early',status:'filled',date:'2026-09-01',filledAt:'2026-09-25T08:00:00Z'};
const late={id:'late',status:'filled',date:'2026-09-01',filledAt:'2026-09-25T16:00:00Z'};
for(const records of [[early,late],[late,early]]){
  windowObj.CHECKINS={c1:[...records,{id:'future',status:'filled',filledAt:'2030-01-01T12:00:00Z'}]};
  eq('recent reports keep time order and exclude future',ctx.dashOpsRecentReports().map(x=>x.ci.id),['late','early']);
}

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll weekly check-in tests passed');
