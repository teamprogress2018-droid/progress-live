#!/usr/bin/env node
'use strict';
/** Library exercise cards use real photos, not decorative SVG placeholders. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const photoSrc = fs.readFileSync(path.join(root, 'ex-photo-manifest.js'), 'utf8');
const photoMatch = photoSrc.match(/window\.EX_PHOTO_MANIFEST\s*=\s*(\{[\s\S]*\});/);
if (!photoMatch) {
  console.error('FAIL missing EX_PHOTO_MANIFEST');
  process.exit(1);
}
const EX_PHOTO_MANIFEST = JSON.parse(photoMatch[1]);

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX: [
    { name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' },
    { name: 'Pompki', img: 'assets/ex/bench.svg' },
    { name: 'Rozpiętki hantlami' },
    { name: 'Butterfly (peck deck)', aka: 'Peck deck, Pec-Deck, Rozpiętki na maszynie', img: 'assets/ex/bench.svg' },
  ],
  EX_GIF_MANIFEST: {},
  EX_GIF_REMOTE: {},
  EX_PHOTO_MANIFEST,
  COACH_VIDEOS: [],
  document,
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('photo manifest has many entries', Object.keys(EX_PHOTO_MANIFEST).length >= 100);
ok('decorative svg detected', ctx.isDecorativeExAsset('assets/ex/bench.svg'));
ok('gif path not decorative', !ctx.isDecorativeExAsset('assets/ex/gifs/bench.gif'));
ok('bench uses photo not svg', /free-exercise-db|githubusercontent/.test(ctx.exThumbUrl({ name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' })));
ok('pompki uses photo', /Pushups/.test(ctx.exThumbUrl({ name: 'Pompki', img: 'assets/ex/bench.svg' })));
ok('pec-deck parenthetical keys', (ctx.exerciseLookupKeys('Rozpiętki na maszynie (Pec-Deck) — środek klatki')||[]).some(k=>/peck deck|pec-deck|pec deck/.test(k)));
ok('pec-deck photo from long name', /Butterfly/.test(ctx.exPhotoMapLookup('Rozpiętki na maszynie (Pec-Deck) — środek klatki')||''));
ok('pec-deck lib match', (ctx.libExerciseByName('Rozpiętki na maszynie (Pec-Deck) — środek klatki')||{}).name==='Butterfly (peck deck)');
ok('pec-deck thumb photo not svg', /free-exercise-db|githubusercontent/.test(ctx.exThumbUrl('Rozpiętki na maszynie (Pec-Deck) — środek klatki')||''));
ok('index loads photo manifest', fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('ex-photo-manifest.js'));

const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const card = six.slice(six.indexOf('function exCardHtml'), six.indexOf('function renderLibGroupedSections'));
ok('cards fall back to muscle part label', /ex-card-part/.test(card));

windowObj.EX_GIF_MANIFEST = {
  'wyciskanie sztangi leżąc': 'https://cdn.jsdelivr.net/gh/x/y@1/bench.mp4',
  'wyciskanie-sztangi-lezac': 'https://cdn.jsdelivr.net/gh/x/y@1/bench.mp4',
};
ok('thumb skips mp4 keeps photo', /free-exercise-db|githubusercontent/.test(ctx.exThumbUrl({ name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' })));
ok('gif url still mp4', /\.mp4/.test(ctx.exGifUrl({ name: 'Wyciskanie sztangi leżąc' })));

const hackGif = 'assets/ex/gifs/przysiad-hack-maszyna.gif';
ok('hack squat gif file', fs.existsSync(path.join(root, hackGif)));
windowObj.EX_GIF_MANIFEST = {
  'przysiad hack maszyna': hackGif,
  'przysiad-hack-maszyna': hackGif,
  'hack squat maszyna': hackGif,
  'hack-squat-maszyna': hackGif,
};
ok('hack squat thumb is gif not jpg', ctx.exThumbUrl({ name: 'Przysiad hack maszyna' }) === hackGif);
ok('hack squat aka thumb is gif', ctx.exThumbUrl({ name: 'Hack squat maszyna' }) === hackGif);
ok('hack squat gif is not treated as video', !ctx.isVideoMediaUrl(hackGif));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll lib-ex-photos tests passed');
