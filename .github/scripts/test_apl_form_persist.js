// Generator AI: płeć M/K vs mężczyzna + sprzęt (hantle, drążek) zapamiętywane.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src02 = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('helpers in core', /function normalizeClientGender/.test(core) && /function genderForAplSelect/.test(core) && /function mapStoredEquipmentToApl/.test(core));
ok('fill maps gender', /genderForAplSelect\(c\.gender\)/.test(src03));
ok('fill sets equipment', /clientAvailableEquipment/.test(src03) && /aplSetEquipment/.test(src03));
ok('init keeps client', /const prev=sel\?sel\.value/.test(src03) && /if\(sel\.value\)aplFillFromClient/.test(src03));
ok('toggle persists', /function aplToggleMulti/.test(src03) && /aplPersistClientForm/.test(src03));
ok('html toggle helper', /data-val="Hantle"[^>]*aplToggleMulti/.test(html) && /data-val="Drążek i poręcze"[^>]*aplToggleMulti/.test(html));
ok('html hantle class active', /class="apl-opt-multi active" data-val="Hantle"/.test(html) && /class="apl-opt-multi active" data-val="Drążek i poręcze"/.test(html));
ok('onboard saves equipment', /onbNewClient\.equipment=/.test(src02) && /availableEquipment/.test(src02));
ok('cache', html.includes('01-core.js?v=71') && html.includes('02-workouts-onboarding-templates-live.js?v=28') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('05-clients-builder-plans-calendar.js?v=37'));
ok('cache', html.includes('01-core.js?v=71') && html.includes('02-workouts-onboarding-templates-live.js?v=28') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('05-clients-builder-plans-calendar.js?v=37'));
ok('CI', wf.includes('test_apl_form_persist.js') && wf.includes('test_apl_form_persist_ui.js'));

const slice = core.match(/function foldPlKey[\s\S]*?function clientAvailableEquipment[\s\S]*?\n\}/);
if (!slice) {
  console.error('Could not extract gender/equipment helpers');
  process.exit(1);
}
const ctx = { window: {}, console, String, Array, Object, Math };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(slice[0] + '\nwindow.normalizeClientGender=normalizeClientGender;window.genderForAplSelect=genderForAplSelect;window.mapStoredEquipmentToApl=mapStoredEquipmentToApl;window.clientAvailableEquipment=clientAvailableEquipment;window.APL_EQ_GYM_DEFAULT=APL_EQ_GYM_DEFAULT;', ctx);

ok('M → mężczyzna', ctx.genderForAplSelect('M') === 'mężczyzna');
ok('mężczyzna → M', ctx.normalizeClientGender('mężczyzna') === 'M');
ok('mezczyzna ascii → M', ctx.normalizeClientGender('mezczyzna') === 'M');
ok('K → kobieta', ctx.genderForAplSelect('K') === 'kobieta');
ok('kobieta → K', ctx.normalizeClientGender('kobieta') === 'K');
ok('empty gender', ctx.normalizeClientGender('') === '' && ctx.genderForAplSelect('') === '');
ok('gym → full set + hantle + drążek', (() => {
  const eq = ctx.mapStoredEquipmentToApl(['gym']);
  return eq.includes('Hantle') && eq.includes('Drążek i poręcze') && eq.includes('Sztanga i wolne ciężary') && !eq.includes('Bez sprzętu');
})());
ok('dumbbells → Hantle', ctx.mapStoredEquipmentToApl(['dumbbells']).includes('Hantle'));
ok('Drążek stored', ctx.mapStoredEquipmentToApl(['Drążek']).includes('Drążek i poręcze'));
ok('client availableEquipment', ctx.clientAvailableEquipment({ availableEquipment: ['Hantle', 'Drążek i poręcze'] }).includes('Hantle'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll apl-form-persist tests passed');
