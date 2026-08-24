// Testy: check-in → sync wagi do profilu / pomiarów (audit flow).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement(){return{style:{},classList:{toggle(){},contains(){return false}},querySelector(){return null},querySelectorAll(){return[]},appendChild(){}};},
  documentElement:{style:{setProperty(){}}}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], CHECKINS: {}, METRIC_ENTRIES: [],
  SETTINGS: { notifications: {} },
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
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

vm.runInContext(`
function withTrainer(o){return o;}
function newId(p){return p+'-'+Math.random().toString(36).slice(2,8);}
function todayYmd(){return '2026-08-24';}
function persistById(){}
function saveClientBaselineFromFields(clientId,fields){
  window._baselineCalls=window._baselineCalls||[];
  window._baselineCalls.push({clientId,fields});
  const c=(window.CL||[]).find(x=>x.id===clientId);
  if(c&&fields.weight){c.weight=+fields.weight;c.baselineDone=true;}
  return fields.weight?[{id:'me1',clientId,groupId:'mg1',values:{m1:+fields.weight}}]:[];
}
window.withTrainer=withTrainer;
window.newId=newId;
window.todayYmd=todayYmd;
window.persistById=persistById;
window.saveClientBaselineFromFields=saveClientBaselineFromFields;
`, ctx);

const src04 = fs.readFileSync(path.join(__dirname, '..', '..', '04-client-portal.js'), 'utf8');
const chunk = src04.match(/function syncClientFromCheckin[\s\S]*?window\.syncClientFromCheckin=syncClientFromCheckin;/);
if (!chunk) {
  console.error('FAIL could not extract syncClientFromCheckin');
  process.exit(1);
}
vm.runInContext(chunk[0], ctx);

const { syncClientFromCheckin } = ctx;
let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else console.log('OK   ' + name);
}

windowObj.CL = [{id:'c1', name:'Ala', weight:70}];
windowObj._baselineCalls = [];

const r1 = syncClientFromCheckin({
  clientId:'c1', date:'2026-08-24',
  answers:{energy:4, sleep:4, stress:2, nutrition:4, workouts:3, weight:'72.5', notes:'ok'}
});
eq('sync changed', !!(r1 && r1.changed), true);
eq('client weight updated', windowObj.CL[0].weight, 72.5);
eq('baseline called', (windowObj._baselineCalls||[]).length, 1);
eq('baseline weight', windowObj._baselineCalls[0].fields.weight, 72.5);
eq('summary has kg', !!(r1.summary && r1.summary.includes('72.5')), true);

windowObj._baselineCalls = [];
const r2 = syncClientFromCheckin({
  clientId:'c1', date:'2026-08-24',
  answers:{energy:3, sleep:3, stress:3, nutrition:3, workouts:2, weight:'', notes:''}
});
eq('no weight no baseline call', (windowObj._baselineCalls||[]).length, 0);
eq('no weight nullish ok', r2 === null || r2.changed === false, true);

const r3 = syncClientFromCheckin(null);
eq('null ci', r3, null);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll check-in sync tests passed');
