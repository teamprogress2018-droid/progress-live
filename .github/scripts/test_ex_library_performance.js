#!/usr/bin/env node
'use strict';

/** Guards against reintroducing expensive catalog work on every library render. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const library = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failed = 0;
function ok(name, condition) {
  if (condition) console.log('OK   ' + name);
  else { console.error('FAIL ' + name); failed++; }
}

ok('catalog result is cached', library.includes("let _allExercisesCacheKey='';") && library.includes('if(cacheKey===_allExercisesCacheKey)return _allExercisesCache;'));
ok('catalog cache reacts to hidden and custom names', library.includes('hiddenList.join') && library.includes("custom.map(e=>String((e&&e.id)||'')+'|'+String((e&&e.name)||''))"));
ok('repeated media ownership checks are cached', core.includes('const _mediaOwnershipCheckCache=new Map();') && core.includes('_mediaOwnershipCheckCache.has(key)'));
ok('large exercise datalist is not rebuilt every render', library.includes("if(dlSignature!==_exLibraryDlSignature){") && library.includes('updateExDl();'));
ok('cached core and library scripts have a new browser URL', html.includes('01-core.js?v=150&drive-media=5') && html.includes('media-gap-groups=1&library-cache=1'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nExercise library performance checks passed');
