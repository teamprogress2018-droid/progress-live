#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const source = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failed = 0;
function check(label, value) {
  if (value) console.log('OK  ' + label);
  else { console.error('FAIL ' + label); failed++; }
}

const start = source.indexOf('function catalogDedupeKey');
const end = source.indexOf('function catalogDedupeIndex');
check('duplicate helpers found', start >= 0 && end > start);
if (start >= 0 && end > start) {
  const sandbox = {
    window: {},
    DEF_EX: [{name: 'Pompki'}, {name: 'Pompki na kolanach'}],
    EX: [{name: 'Pompki (1)'}, {name: 'Przysiad'}]
  };
  vm.runInNewContext(`
    function exerciseSearchNorm(s){return String(s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
    ${source.slice(start, end)}
  `, sandbox);
  const groups = sandbox.exerciseDuplicateGroups();
  check('copy suffix is detected as duplicate', groups.length === 1 && groups[0].items.length === 2);
  check('different exercise remains distinct', groups[0] && groups[0].items.every(x => !/kolanach/i.test(x.exercise.name)));
}
check('every card gets a visible remove control', source.includes('${exCardDeleteBtnHtml(e)}'));
check('sidebar provides duplicate audit', html.includes('id="lib-review-dups"') && html.includes('reviewExerciseDuplicates()'));
check('new library script cache version', html.includes('06-inbox-exercises-ai-programs.js?v=115'));

if (failed) process.exit(1);
console.log('Library controls tests passed');
