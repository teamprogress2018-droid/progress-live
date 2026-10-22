#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let failed = 0;
function ok(label, condition) {
  if (condition) console.log('OK   ' + label);
  else { console.error('FAIL ' + label); failed++; }
}

const match = source.match(/const EX_MEDIA_FUNCTIONAL_ADD=\[([\s\S]*?)\]\.map\(name=>/);
ok('functional media catalog exists', !!match);
const names = match ? vm.runInNewContext('[' + match[1] + ']') : [];
ok('all 137 unmatched functional files are catalogued', names.length === 137);
ok('representative HIIT names are catalogued', ['Burpee Navy SEAL', 'Ćwiczenia na drabince koordynacyjnej', 'Rzut piłką lekarską', 'Wykrok z wysokim unoszeniem kolana na piłce BOSU'].every((name) => names.includes(name)));
ok('new entries use the functional category', source.includes("cat:'Funkcjonalne'"));
ok('functional shortcut includes the category', source.includes("e.cat==='Funkcjonalne'||EX_LIBRARY_FOCUS.functional.includes(e.name)"));
ok('functional category has a card color', source.includes("'Funkcjonalne':'#e11d48'"));
ok('GIF technique is visibly marked as a film on a card', source.includes("const gif=typeof exGifUrl==='function'?exGifUrl(e)"));
ok('GIF cards are frozen to a white first-frame preview', source.includes('function freezeExCardGif(img)') && source.includes("ctx.fillStyle='#fff'") && source.includes('onload="freezeExCardGif(this)"'));
ok('library accepts only matching white exercise previews', source.includes('function isWhiteExerciseCardPreview(ex,url)') && source.includes('function isGeneratedWhiteExerciseCardPreview(url)') && source.includes('if(thumb&&isWhiteExerciseCardPreview(e,thumb))') && source.includes("googleDriveMediaRole(preview)==='preview'") && source.includes('style="background:#fff;color:${col};border:1px solid #e5e7eb;"'));
ok('browser loads the new functional catalog', html.includes('functional-hiit-media=1'));
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
ok('Firebase GIF technique can be used as a lazy card preview', !core.includes("if(Number(window.EX_DRIVE_MEDIA_VERSION||0)>=1)return '';"));

if (failed) process.exitCode = 1;
else console.log('\nFunctional media catalog checks passed');
