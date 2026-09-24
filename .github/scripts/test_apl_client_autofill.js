// Generator AI: wiek/waga/płeć/aktywność z karty klienta, bez drugiego formularza.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('html dup wrappers', html.includes('id="apl-client-dup-sports"') && html.includes('id="apl-client-dup-body"') && html.includes('id="apl-client-from-card"') && html.includes('id="apl-client-pick-hint"'));
ok('html fields still in DOM', html.includes('id="apl-age"') && html.includes('id="apl-gender"') && html.includes('id="apl-weight"') && html.includes('id="apl-activity"'));
ok('init auto-selects last client', /_aplPrefillClientId\|\|prev\|\|openId\|\|window\._aplLastClientId/.test(src03));
ok('fill hides dup UI', /function aplFillFromClient[\s\S]*aplSyncClientDupUi/.test(src03));
ok('close profile remembers client', /if\(cpClientId\)window\._aplLastClientId=cpClientId/.test(src07));
ok('save client remembers', /window\._aplLastClientId=c\.id/.test(src05) && /aplRefreshFromSavedClient\(c\.id\)/.test(src05));
ok('edit from card opens modal', /function aplEditClientFromCard[\s\S]*openClientModal/.test(src03));
ok('cache 03/05/07', html.includes('03-ai-plangen-bizstats-aicoach.js?v=42') && html.includes('05-clients-builder-plans-calendar.js?v=79') && html.includes('07-forms-metrics-calculator.js?v=42'));
ok('CI', wf.includes('test_apl_client_autofill.js') && wf.includes('test_apl_client_autofill_ui.js'));

const slice = src03.match(/function aplClientCardSummaryHtml[\s\S]*?(?=\nfunction aplSyncClientDupUi)/);
ok('extracted summary fn', !!slice);
if (slice) {
  const ctx = {
    window: {},
    console,
    String,
    Array,
    Object,
    ACTIVITY_LEVEL_LABELS: {
      sedentary: 'Siedzący tryb życia',
      light: 'Lekka aktywność (spacery)',
      moderate: 'Umiarkowana aktywność',
      active: 'Aktywny (regularny trening)'
    },
    genderForAplSelect: (g) => (g === 'M' ? 'mężczyzna' : g === 'K' ? 'kobieta' : ''),
    clientSportProfileLabel: (c) => (c.priorSports && c.priorSports.length ? 'Sporty: bieg' : ''),
    clientLatestMetricWeight: () => null,
    escHtml: (s) => String(s || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(slice[0] + '\nwindow.aplClientCardSummaryHtml=aplClientCardSummaryHtml;', ctx);
  const htmlCard = ctx.aplClientCardSummaryHtml({
    id: 'c1',
    name: 'Anna Test',
    age: 32,
    gender: 'K',
    weight: 62,
    height: 168,
    activityLevel: 'moderate',
    priorSports: ['running'],
    sportNotes: 'półmaraton'
  });
  ok('summary has name', /Anna Test/.test(htmlCard));
  ok('summary has age/weight/gender', /32 lat/.test(htmlCard) && /62 kg/.test(htmlCard) && /Kobieta/.test(htmlCard));
  ok('summary has activity', /Umiarkowana/.test(htmlCard));
  ok('summary from card label', /Z karty klienta/.test(htmlCard));
  ok('summary does not repeat sport profile sentence', !/predyspozycja/.test(htmlCard));
  ok('summary edit button', /aplEditClientFromCard/.test(htmlCard));
  const empty = ctx.aplClientCardSummaryHtml({ id: 'c2', name: 'Nowy' });
  ok('missing fields hint', /Brakuje: wiek/.test(empty) && /płeć/.test(empty) && /waga/.test(empty));
}

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll apl-client-autofill tests passed');
