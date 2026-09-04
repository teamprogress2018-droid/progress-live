#!/usr/bin/env node
'use strict';
/** Biblioteka DEF_EX: unikalne nazwy, bez klonów i siatki plyo NCM/CM/DC/CON. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\nwindow\.DEF_EX=DEF_EX;/);
ok('DEF_EX block', !!m);
const sandbox = { window: {} };
vm.runInNewContext('const DEF_EX=[' + m[1] + ']; window.DEF_EX=DEF_EX;', sandbox);
const DEF_EX = sandbox.window.DEF_EX;
const names = DEF_EX.map((e) => e.name);

function akaTokens(name) {
  const e = DEF_EX.find((x) => x.name === name);
  return String((e && e.aka) || '').split(',').map((s) => s.trim());
}
ok('cache 06 v59', html.includes('06-inbox-exercises-ai-programs.js?v=61'));
ok('ci unit', wf.includes('test_ex_lib_dedupe.js'));
ok('unique names', new Set(names).size === names.length);
ok('library still large', DEF_EX.length >= 900, String(DEF_EX.length));
ok('no rumuński clone', !names.includes('Rumuński martwy ciąg'));
ok('rdl keeps rumuński aka', akaTokens('Martwy ciąg RDL').includes('Rumuński martwy ciąg'));
ok('no opadzie hantle clone', !names.includes('Unoszenie bokiem w opadzie hantle'));
ok('opadzie keeps old pl name', akaTokens('Unoszenie bokiem w opadzie').includes('Unoszenie bokiem w opadzie hantle'));
ok('no bench hamstring clone', !names.includes('Uginanie ud na ławce (ugięte kolana)'));
ok('bench hamstring keeps old pl name', akaTokens('Uginanie ud o ławkę z ugiętym kolanem').includes('Uginanie ud na ławce (ugięte kolana)'));
ok('no swiss glute clone', !names.includes('Mostek izometryczny na piłce swiss (pośladki)'));
ok('swiss keeps old pl name', akaTokens('Mostek izometryczny na piłce swiss').includes('Mostek izometryczny na piłce swiss (pośladki)'));
ok('drop jump pl aka', ['Drop jump niska skrzynia', 'Drop jump wysoka skrzynia', 'Drop jump na skrzynię'].every((n) => akaTokens('Depth jump').includes(n)));
ok('keeps ncm jump', names.includes('Skok pionowy NCM'));
ok('keeps cm jump', names.includes('Skok pionowy CM'));
ok('keeps lying curl', names.includes('Uginanie nóg leżąc'));
ok('keeps seated curl', names.includes('Uginanie nóg siedząc'));
ok('keeps push jerk', names.includes('Pchanie sztangi (jerk)'));
ok('no dc plyo matrix', !names.some((n) => /\bDC\b/.test(n)));
ok('no con plyo matrix', !names.some((n) => /\bCON\b/.test(n)));
ok('no bound plyo', !names.some((n) => /^Bound /.test(n)));
ok('narrow grip aka not db', !/Close Grip DB Bench Press/i.test(DEF_EX.find((e) => e.name === 'Wyciskanie wąskim chwytem').aka || ''));
ok('podrzut aka not push jerk', !/Push jerk/i.test(DEF_EX.find((e) => e.name === 'Podrzut').aka || ''));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll ex-lib-dedupe tests passed');
