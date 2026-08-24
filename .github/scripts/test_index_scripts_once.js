#!/usr/bin/env node
'use strict';
/** index.html must load each app script once (duplicate const → redeclaration in browser). */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
const idx = html.lastIndexOf('<script src="ex-gif-manifest.js');
const tail = idx >= 0 ? html.slice(idx) : html;
const names = [...tail.matchAll(/<script src="([^"?]+\.js)\?v=\d+"><\/script>/g)].map((m) => m[1]);

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('has app scripts', names.length >= 10);
const seen = new Set();
const dups = [];
for (const n of names) {
  if (seen.has(n)) dups.push(n);
  seen.add(n);
}
ok('no duplicate script src', dups.length === 0, dups.join(','));
ok('includes 04-client-portal.js', seen.has('04-client-portal.js'));
ok('includes 10-client-app.js', seen.has('10-client-app.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll index-scripts-once tests passed');
