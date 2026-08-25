#!/usr/bin/env node
'use strict';
/** Periodization week preview updates RPE and RIR in builder rows. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

eval(
  extractFn('builderRirFromRpe') + ';\n' +
  extractFn('builderNormalizeRpe') + ';\n' +
  extractFn('builderWeekModel') + ';\n'
);

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('RIR from RPE 8 → 2', builderRirFromRpe('8') === '2');
ok('RIR from RPE 7-8 → 2-3', builderRirFromRpe('7-8') === '2-3');
ok('RIR from RPE label', builderRirFromRpe('RPE 9') === '1');
ok('advanced week1 RPE 7-8', builderWeekModel('zaawansowany', 0).rpe === '7-8');
ok('advanced week2 RPE 8', builderWeekModel('zaawansowany', 1).rpe === '8');
ok('week2 RIR from model', builderRirFromRpe(builderWeekModel('zaawansowany', 1).rpe) === '2');
ok('refresh writes rpe/rir into inputs', /set\('rpe',pv\.rpe\)/.test(src) && /set\('rir',pv\.rir\)/.test(src));
ok('apply week sets rir', /function\s+builderApplyPeriodWeek[\s\S]*?set\('rir',pv\.rir\)/.test(src));
ok('rpe input is text for ranges', /data-f="rpe"[^>]*\btype="text"|\btype="text"[^>]*data-f="rpe"/.test(src));
ok('rir input is text for ranges', /data-f="rir"[^>]*\btype="text"|\btype="text"[^>]*data-f="rir"/.test(src));
ok('period base capture for restore', /function\s+builderCapturePeriodBase/.test(src) && /function\s+builderRestorePeriodBase/.test(src));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll period-rpe-rir tests passed');
