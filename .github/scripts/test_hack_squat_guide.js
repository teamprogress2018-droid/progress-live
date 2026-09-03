#!/usr/bin/env node
'use strict';
/** Panel szczegółów Hack Squat: kadry faz, czworogłowe, pełne rozciągnięcie. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 06 v39', html.includes('06-inbox-exercises-ai-programs.js?v=43'));
ok('cache styles v52', html.includes('styles.css?v=55'));
['anatomy.jpg', 'stretch-lens.jpg', 'phase-start.jpg', 'phase-bottom.jpg'].forEach((f) => {
  ok('asset ' + f, fs.existsSync(path.join(root, 'assets/ex/hack', f)));
});
ok('css guide', /ex-phase-row/.test(css) && /ex-stretch-lens/.test(css) && /ex-anatomy/.test(css));
ok('openExDetail injects guide', /exTechniqueGuideHtml\(e\)/.test(six));
ok('aka suwnica', /aka:'Hack squat maszyna, Hack squat, Przysiad na suwnicy'/.test(six));

const start = six.indexOf('function exTechniqueGuideFor');
const end = six.indexOf('var currentExDetail');
ok('guide functions', start > 0 && end > start);
const windowObj = {};
const ctx = { window: windowObj, escHtml: (s) => String(s || '') };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(six.slice(start, end), ctx);

ok('guide id hack squat', ctx.exTechniqueGuideFor({ name: 'Przysiad hack maszyna' }) === 'hack-squat');
ok('guide id aka', ctx.exTechniqueGuideFor({ name: 'X', aka: 'Hack squat' }) === 'hack-squat');
ok('guide id pec deck', ctx.exTechniqueGuideFor({ name: 'Butterfly (peck deck)' }) === 'pec-deck');
ok('guide id pec aka', ctx.exTechniqueGuideFor({ name: 'X', aka: 'Rozpiętki na maszynie' }) === 'pec-deck');
ok('no reverse pec deck guide', ctx.exTechniqueGuideFor({ name: 'Odwrotne rozpiętki maszyna' }) === '');
ok('no guide bench', ctx.exTechniqueGuideFor({ name: 'Wyciskanie sztangi leżąc' }) === '');
ok('empty guide html', ctx.exTechniqueGuideHtml({ name: 'Pompki' }) === '');

const g = ctx.exTechniqueGuideHtml({ name: 'Przysiad hack maszyna' });
ok('phases start mid bottom', /phase-start\.jpg/.test(g) && /przysiad-hack-maszyna\.gif/.test(g) && /phase-bottom\.jpg/.test(g));
ok('depth overlay', /ex-phase-heat/.test(g) && /ex-phase-badge/.test(g));
ok('anatomy quads', /anatomy\.jpg/.test(g) && /Czworogłowy/.test(g));
ok('full stretch', /stretch-lens\.jpg/.test(g) && /Pełne rozciągnięcie/.test(g) && /hipertrofia/.test(g));
ok('knee path', /dół \+ przód/.test(g) && /Głęboko/.test(g));

const pec = ctx.exTechniqueGuideHtml({ name: 'Butterfly (peck deck)' });
ok('pec guide phases', /phase-open\.jpg/.test(pec) && /butterfly-peck-deck\.gif/.test(pec) && /phase-close\.jpg/.test(pec));
ok('pec guide name', /Butterfly \(peck deck\)/.test(pec) && /motyl \/ pec deck/.test(pec));
ok('pec guide cue', /Łokcie na poziomie barków/.test(pec));
ok('assets pec', fs.existsSync(path.join(root, 'assets/ex/pec/phase-open.jpg')) && fs.existsSync(path.join(root, 'assets/ex/gifs/butterfly-peck-deck.gif')));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll hack-squat-guide tests passed');
