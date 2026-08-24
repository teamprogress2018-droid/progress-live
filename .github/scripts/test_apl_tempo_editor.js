// Edytor planu AI: tempo widoczne i edytowalne przed zapisem planu.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const apl = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('render shows tempo column', /Tempo<\/div>\s*\n\s*<div style="font-size:13px;font-family:'DM Mono'/.test(apl));
ok('edit form has tempo input', apl.includes('id="apl-edit-tempo-${di}-${ei}"'));
ok('save exercise stores tempo', apl.includes('ex.tempo=tempo') && apl.includes('ex[curWeek].tempo=tempo'));
ok('legend mentions tempo', apl.includes('⏱ <b>Tempo</b>'));

const document = {
  querySelectorAll: () => [],
  getElementById: (id) => {
    if (id === 'apl-result') return { innerHTML: '' };
    const vals = {
      'apl-edit-name-0-0': { value: 'Wyciskanie' },
      'apl-edit-notes-0-0': { value: '' },
      'apl-edit-sets-0-0': { value: '4' },
      'apl-edit-reps-0-0': { value: '8' },
      'apl-edit-rest-0-0': { value: '120s' },
      'apl-edit-tempo-0-0': { value: '3-1-1-0' },
      'apl-edit-rir-0-0': { value: '8' }
    };
    return vals[id] || null;
  },
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild() {} })
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [],
  document,
  notify() {}
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
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined,
  fetch: async () => ({ ok: true, json: async () => ({}) })
};
ctx.globalThis = ctx;
vm.createContext(ctx);
ctx.notify = () => {};
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
vm.runInContext(apl, ctx);

ctx.aplLastPlan = {
  weekKeys: ['w1'],
  currentWeek: 'w1',
  days: [{
    exercises: [{ name: 'Test', sets: '3', reps: '10', rest: '90s', rir: '7' }]
  }]
};
ctx.aplRerenderCurrent = () => {};
ctx.aplSaveExerciseEdit(0, 0);
const ex = ctx.aplLastPlan.days[0].exercises[0];
ok('aplSaveExerciseEdit tempo on exercise', ex.tempo === '3-1-1-0');
ok('aplSaveExerciseEdit tempo on week', ex.w1 && ex.w1.tempo === '3-1-1-0');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nApl tempo editor OK');
