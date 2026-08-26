#!/usr/bin/env node
'use strict';
/** Generator AI: kontekst bezpieczeństwa (waga/BMI, wady postawy, kontuzje). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('safety helpers exported', /function clientSafetyContextForAI/.test(src07) && /window\.clientSafetyContextForAI/.test(src07));
ok('body load + posture form', /clientBodyLoadContextForAI/.test(src07) && /clientPostureHealthFormContextForAI/.test(src07));
ok('aplGenerate uses safety', /clientSafetyContextForAI/.test(src03) && /BEZPIECZEŃSTWO KLIENTA/.test(src03));
ok('aplFill safety hint', /aplRenderSafetyHint/.test(src03) && /clientCombinedLimitationsText/.test(src03));
ok('injuries label posture', /Kontuzje \/ ograniczenia \/ wady postawy/.test(html));
ok('pharma ui fields', html.includes('id="apl-pharma-status"') && html.includes('id="apl-pharma-details"') && /Status farmakologiczny/.test(html));
ok('pharma prompt wiring', src03.includes("getElementById('apl-pharma-status')") && /Status farmakologiczny/.test(src03) && /WSPOMAGANY/.test(src03));
ok('pharma resets on client change', /BEZPIECZEŃSTWO: zawsze zeruj status farmakologiczny/.test(src03));
ok('cache bumps', html.includes('03-ai-plangen-bizstats-aicoach.js?v=25') && html.includes('07-forms-metrics-calculator.js?v=26'));
ok('CI', wf.includes('test_ai_plan_safety.js'));

const document = { getElementById: () => null, querySelectorAll: () => [], addEventListener() {} };
const windowObj = {
  addEventListener() {},
  CL: [{ id: 'c1', name: 'Justyna', weight: 122.5, height: 175, injuries: '', gender: 'kobieta', _posture: { analyses: [{ date: '2026-08-01', view: 'Bok', result: '🔍 WADY POSTAWY\n• Hiperlordoza lędźwiowa\n⚠️ OSTRZEŻENIA\n• Unikaj hiperekstensji pod obciążeniem' }] } }],
  FORM_SENDS: [{
    id: 's1', clientId: 'c1', formId: 'df2', formName: 'Ocena postawy i zdrowia', status: 'filled', filledAt: '2026-08-20',
    answers: { q1: 'tak', q2: 'nie', q3: 'Hiperlordoza', q7: 'Słaba (trudności z głębokim przysiadem)', q8: 'tak', q9: 'nie' }
  }],
  METRIC_ENTRIES: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  Set, Map, isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);

const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const mapSlice = core.match(/function formSendAnswersMap\(send\)\{[\s\S]*?\n\}\nwindow\.formSendAnswersMap=formSendAnswersMap;/);
const injSlice = core.match(/\/\*\* Kontuzje: preferuj dedykowane pole[\s\S]*?\n\}\nfunction clientPhysiquePriorityForAI/);
ok('core slices', !!(mapSlice && injSlice));
vm.runInContext(mapSlice[0], ctx);
vm.runInContext(injSlice[0].replace(/\nfunction clientPhysiquePriorityForAI$/, '\nwindow.clientInjuriesText=clientInjuriesText;'), ctx);

const safetySlice = src07.match(/\/\*\* BMI \+ zasady bezpieczeństwa[\s\S]*?window\.clientSafetyContextForAI=clientSafetyContextForAI;/);
ok('safety slice', !!safetySlice);
vm.runInContext(safetySlice[0], ctx);

const {
  clientBodyLoadContextForAI,
  clientPostureHealthFormContextForAI,
  clientSafetyContextForAI,
  clientCombinedLimitationsText
} = ctx;

const body = clientBodyLoadContextForAI(122.5, 175);
ok('BMI high rules', /BMI ~40/.test(body) && /maszyny/.test(body) && /skok/.test(body));

const form = clientPostureHealthFormContextForAI('c1');
ok('posture form wad', /Hiperlordoza/.test(form) && /kolan/.test(form));
ok('posture rules', /Hiperlordoza:/.test(form) && /Kolana:/.test(form));

const all = clientSafetyContextForAI('c1', { weight: 122.5, height: 175, injuries: 'ból biodra' });
ok('safety header', /BEZPIECZEŃSTWO I OGRANICZENIA/.test(all));
ok('includes injuries', /ból biodra/.test(all));
ok('includes AI posture', /Analiza postawy AI/.test(all) && /Hiperlordoza lędźwiowa/.test(all));
ok('priority line', /bezpieczeństwo/.test(all.toLowerCase()));

const lim = clientCombinedLimitationsText(windowObj.CL[0]);
ok('combined limitations', /wady postawy|Hiperlordoza/.test(lim));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll AI plan safety tests passed');
