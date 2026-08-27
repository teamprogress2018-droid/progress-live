#!/usr/bin/env node
'use strict';
/** Generator AI + builder: metoda Trening obwodowy. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src03 = fs.readFileSync(path.join(root, '03-ai-plangen-bizstats-aicoach.js'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('apl button Obwodowy', /id="apl-methods"[\s\S]*?data-val="Obwodowy"[\s\S]*?Trening obwodowy/.test(html));
ok('builder select Obwodowy', /id="b-method"[\s\S]*?<option value="Obwodowy">Trening obwodowy/.test(html));
ok('program method Obwodowy', /id="pm-method"[\s\S]*?<option value="Obwodowy">Trening obwodowy/.test(html));
ok('METHOD_WHY Obwodowy', /Obwodowy:\{label:'Trening obwodowy/.test(core));
ok('normalize circuit', /obwod\|circuit/.test(core) || /\/\^obwod\|circuit/.test(core));
ok('BUILDER_METHOD_DAYS Obwodowy', /Obwodowy:\['Obwód A'/.test(src05));
ok('AI prompt circuit structure', src03.includes('STRUKTURA TRENINGU OBWODOWEGO'));
ok('AI coach knows circuit', /trening obwodowy \(circuit\)/.test(src03));
ok('cache bumps', html.includes('01-core.js?v=45') && html.includes('03-ai-plangen-bizstats-aicoach.js?v=28') && html.includes('05-clients-builder-plans-calendar.js?v=31'));
ok('CI', wf.includes('test_circuit_method.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll circuit-method tests passed');
