#!/usr/bin/env node
'use strict';

/** The bulk-media review must stay manageable as the exercise library grows. */
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../..', '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../..', 'index.html'), 'utf8');
let failed = 0;
function ok(name, condition) {
  if (condition) console.log('OK   ' + name);
  else { console.error('FAIL ' + name); failed++; }
}

ok('muscle category helper', source.includes('function exImportCategories(all)'));
ok('filename category inference', source.includes('function exImportInferCategory(filename)'));
ok('category control in each row', source.includes('class="form-select exgif-row-category"'));
ok('exercise options are filtered to category', source.includes("all.filter(e=>e&&e.cat===category)"));
ok('changing category clears mismatched exercise', source.includes("if(found&&found.cat!==row.category){row.exerciseName='';row.selected=false;row.confidence='unmatched';}"));
ok('new exercise action exists', source.includes('async function addExGifImportExercise(i)'));
ok('new exercise is stored before assignment', source.includes("await persistById('exercises',ex)"));
ok('new exercise returns to the import row', source.includes("row.exerciseName=ex.name;row.category=ex.cat;row.selected=true"));
ok('bulk creation action exists for all unmatched files', source.includes('async function addAllExGifImportExercises()'));
ok('bulk creation is visibly offered in the import modal', html.includes('id="exgif-add-missing"'));
ok('bulk creation writes each created exercise', source.includes("await persistById('exercises',ex)"));
ok('wide row preserves all six review controls', source.includes('grid-template-columns:28px minmax(155px,1fr) minmax(120px,.7fr) minmax(245px,1.5fr) minmax(110px,.6fr) 24px;'));
ok('GitHub Pages is allowed to use Firebase Storage', !source.includes('function hostBlocksFirebaseStorageUpload') && !source.includes('Z GitHub Pages nie wgramy plików'));
ok('bulk upload checks Firebase SDK availability', source.includes("if(fileRows.length&&(!window._storage||!window._storageRef||!window._uploadBytes||!window._getDownloadURL))"));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nExercise import grouping checks passed');
