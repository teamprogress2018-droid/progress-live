#!/usr/bin/env node
'use strict';
// PWA: manifest ma ikony PNG 192 i 512 px (zwykłe i maskable), pliki istnieją i mają zadeklarowany rozmiar.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL', n, x || ''); failed++; } else console.log('OK  ', n); };
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
for (const purpose of ['any', 'maskable']) {
  for (const size of [192, 512]) {
    const icon = (manifest.icons || []).find(i => i.sizes === size + 'x' + size && i.type === 'image/png' && String(i.purpose || 'any').split(' ').includes(purpose));
    ok(purpose + ' ' + size + ' px declared', !!icon);
    if (!icon) continue;
    const file = path.join(root, icon.src);
    ok(purpose + ' ' + size + ' px file exists', fs.existsSync(file), icon.src);
    const dim = fs.existsSync(file) && pngSize(file);
    ok(purpose + ' ' + size + ' px real size matches', dim && dim.w === size && dim.h === size, JSON.stringify(dim));
    ok(purpose + ' ' + size + ' px path is relative (works under /progress-live/)', !icon.src.startsWith('/'));
  }
}
ok('existing icons kept', manifest.icons.some(i => i.src === 'favicon.svg') && manifest.icons.some(i => i.src === 'apple-touch-icon.png'));
if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll manifest icon checks passed');
