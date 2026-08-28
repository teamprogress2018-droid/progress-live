#!/usr/bin/env node
'use strict';
/** Exercise autocomplete shows muscle-part labels instead of icon thumbs. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    process.exit(1);
  }
  console.log('OK  ', name);
}

const render = six.slice(six.indexOf('function exAcRender'), six.indexOf('function exAcInitInput'));
ok('exAcRender uses muscle part class', /ex-ac-part/.test(render));
ok('exAcRender includes category text', /e\.cat\|\|g\.cat/.test(render) || /part=e\.cat/.test(render));
ok('exAcRender no thumb icons in list', !/ex-ac-thumb/.test(render) && !/exThumbUrl/.test(render));
ok('css defines part label', /\.ex-ac-part\{/.test(css));
ok('part uses design font', /\.ex-ac-part\{[^}]*font-family:var\(--font-ui\)/.test(css));
ok('name does not collapse in narrow column', /\.ex-ac-name\{[^}]*min-width:min\(10em,100%\)/.test(css));
ok('dropdown wider than name cell', /\.ex-ac-dropdown\{[^}]*width:max\(100%,280px\)/.test(css));
ok('pick lock skips re-render', /_exAcPicking/.test(six) && /if\(!_exAcPicking\)exAcRender/.test(six));
ok('pick hides after filling', /function exAcPick[\s\S]{0,400}exAcHide\(input\)/.test(six));
ok('spellcheck off', /spellcheck','false'/.test(six));

console.log('\nAll ex-ac-muscle-label tests passed');
