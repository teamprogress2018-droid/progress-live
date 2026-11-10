#!/usr/bin/env node
'use strict';

/** Guards against reintroducing expensive catalog work on every library render. */
const { cacheAtLeast } = require('./cache-pin.js');
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
ok('media facts are cached and only resolved when the film filter is on', library.includes('let _exLibraryMediaFacts=new WeakMap();') && library.includes('function exLibraryMediaFacts(e)') && library.includes('if(exMediaOnly&&!exHasLibraryMedia(e))return false;'));
ok('first library page is limited to 30 cards with infinite scroll', library.includes('const EX_LIB_PAGE_SIZE=30;') && library.includes('var exLibVisible=30;') && library.includes('new IntersectionObserver'));
ok('Baza Progress does not scan the whole catalogue', library.includes("else if(exTab==='base')source=tokens.length?all:baseList;") && library.includes('function progressBaseExercises()'));
ok('cached core and library scripts have a new browser URL', cacheAtLeast(html, '01-core.js', 150) && html.includes('media-gap-groups=1') && html.includes('library-media-facts=1') && html.includes('library-cache=1'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nExercise library performance checks passed');
