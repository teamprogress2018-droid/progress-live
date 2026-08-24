// Parser planu AI musi przeżyć typowe błędy JSON z modelu (przecinki, ucięcie, markdown).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {},
  createElement: () => ({ style: {}, appendChild() {} })
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [],
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
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined,
  fetch: async () => ({ ok: true, json: async () => ({}) })
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const root = path.join(__dirname, '..', '..');
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8'), ctx);

const { aplParsePlanJson } = ctx;
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const valid = aplParsePlanJson('{"planName":"FBW","days":[{"dayName":"A","exercises":[{"name":"Przysiad","sets":"4"}]}]}');
ok('plain json', valid.planName === 'FBW' && valid.days[0].exercises[0].name === 'Przysiad');

const fenced = aplParsePlanJson('```json\n{"planName":"PPL","days":[]}\n```');
ok('markdown fence', fenced.planName === 'PPL');

const trailing = aplParsePlanJson('{"days":[{"name":"A"},{"name":"B"},]}');
ok('trailing comma in array', trailing.days.length === 2 && trailing.days[1].name === 'B');

const trailingObj = aplParsePlanJson('{"planName":"X","weeks":4,}');
ok('trailing comma in object', trailingObj.planName === 'X' && trailingObj.weeks === 4);

const missing = aplParsePlanJson('{"days":[{"name":"A"}{"name":"B"}]}');
ok('missing comma between objects', missing.days.length === 2 && missing.days[1].name === 'B');

const truncated = aplParsePlanJson('{"planName":"FBW","days":[{"dayName":"A","exercises":[{"name":"Przysiad"');
ok('truncated object closed', truncated.planName === 'FBW' && truncated.days[0].exercises[0].name === 'Przysiad');

const smart = aplParsePlanJson('{“planName”:“Masa”,“days”:[]}');
ok('smart quotes', smart.planName === 'Masa');

const extraText = aplParsePlanJson('Oto plan:\n{"planName":"HIIT","days":[]}\nKoniec.');
ok('surrounding prose', extraText.planName === 'HIIT');

const innerQuotes = aplParsePlanJson('{"planName":"Test","summary":"Utrzymaj \\"core\\" napięty","days":[]}');
ok('escaped inner quotes', innerQuotes.planName === 'Test' && innerQuotes.summary.includes('core'));

const rawInnerQuotes = aplParsePlanJson('{"planName":"Plan","summary":"Opis z cudzysłowem "w środku" tekstu","method":"PPL","weeks":4,"days":[]}');
ok('unescaped inner quotes repaired', rawInnerQuotes.planName === 'Plan' && rawInnerQuotes.summary.includes('w środku'));

const dblComma = aplParsePlanJson('{"planName":"Test",, "days":[]}');
ok('double comma', dblComma.planName === 'Test');

const bareKeys = aplParsePlanJson('{planName:"FBW",days:[{dayName:"A",exercises:[{name:"Przysiad",sets:"4"}]}]}');
ok('bare keys quoted', bareKeys.planName === 'FBW' && bareKeys.days[0].exercises[0].sets === '4');

const singleQ = aplParsePlanJson("{'planName':'Masa','days':[]}");
ok('single quotes normalized', singleQ.planName === 'Masa');

const mixedBare = aplParsePlanJson('{"planName":"X","days":[{"dayName":"A",exercises:[{"name":"Wyciskanie"}]}]}');
ok('mixed bare key in object', mixedBare.days[0].exercises[0].name === 'Wyciskanie');

const spacedBare = aplParsePlanJson('{\n  planName: "Masa",\n  "days": []\n}');
ok('bare key after newline', spacedBare.planName === 'Masa');

const setsIntact = aplParsePlanJson('{"days":[{"exercises":[{"name":"X",sets:"3",reps:"10"}]}]}');
ok('sets key not split by comma bug', setsIntact.days[0].exercises[0].sets === '3');

const src = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
ok('parser exported', src.includes('window.aplParsePlanJson=aplParsePlanJson'));
ok('repair exported', src.includes('function aplRepairJsonText'));
ok('inner quote helper exported', src.includes('function aplEscapeInnerQuotes'));
ok('bare key helper exported', src.includes('function aplQuoteBareKeys'));
ok('single quote helper exported', src.includes('function aplNormalizeSingleQuotes'));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nParser planu AI OK.');
