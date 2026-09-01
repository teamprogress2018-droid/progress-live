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

ok('photo manifest has many entries', Object.keys(EX_PHOTO_MANIFEST).length >= 500);
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

const pecGif = 'assets/ex/gifs/butterfly-peck-deck.gif';
ok('pec deck gif file', fs.existsSync(path.join(root, pecGif)));
windowObj.EX_GIF_MANIFEST = {
  'butterfly (peck deck)': pecGif,
  'butterfly-peck-deck': pecGif,
  'rozpiętki na maszynie': pecGif,
};
ok('pec deck thumb is gif not jpg', ctx.exThumbUrl({ name: 'Butterfly (peck deck)' }) === pecGif);
ok('pec deck gif is not treated as video', !ctx.isVideoMediaUrl(pecGif));

ok('ring dips photo', /Ring_Dips/.test(ctx.exThumbUrl({ name: 'Dipy na kółkach' }) || ''));
ok('weighted dips photo', /Dips_-_Chest_Version|Dips_-_Chest/.test(ctx.exThumbUrl({ name: 'Dipy z obciążeniem' }) || ''));
ok('hindu push-up photo', /free-exercise-db/.test(ctx.exThumbUrl({ name: 'Pompki hindu' }) || ''));
ok('single-leg push-up photo', /free-exercise-db/.test(ctx.exThumbUrl({ name: 'Pompki jednonóż' }) || ''));
ok('knee push-up photo', /free-exercise-db/.test(ctx.exThumbUrl({ name: 'Pompki na kolanach' }) || ''));
ok('trx push-up photo', /Suspended_Push-Up/.test(ctx.exThumbUrl({ name: 'Pompki TRX' }) || ''));
ok('smith bench photo', /Smith_Machine_Bench_Press/.test(ctx.exThumbUrl({ name: 'Wyciskanie w bramie Smith' }) || ''));
ok('ring dip aka photo', /Ring_Dips/.test(ctx.exPhotoMapLookup('Ring dip') || ''));

const defBlock = six.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
const plecy = [...defBlock[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)]
  .map((x) => ({ name: x[1], cat: (x[2].match(/cat:'([^']+)'/) || [])[1] || '' }))
  .filter((e) => e.cat === 'Plecy');
ok('plecy library size', plecy.length >= 70);
const plecyMissing = plecy.filter((e) => {
  const thumb = ctx.exThumbUrl(e) || '';
  return !/free-exercise-db|githubusercontent/.test(thumb) || ctx.isDecorativeExAsset(thumb);
});
ok('all plecy have still photos' + (plecyMissing.length ? ' — ' + plecyMissing.map((e) => e.name).join(', ') : ''), plecyMissing.length === 0);
ok('trx row photo', /Inverted_Row_with_Straps/.test(ctx.exThumbUrl({ name: 'Wiosłowanie TRX' }) || ''));
ok('ring row photo', /Suspended_Row/.test(ctx.exThumbUrl({ name: 'Wiosłowanie na kółkach' }) || ''));
ok('rack pull photo', /Rack_Pulls/.test(ctx.exThumbUrl({ name: 'Ciąg z racka' }) || ''));
ok('deficit deadlift photo', /Deficit_Deadlift/.test(ctx.exThumbUrl({ name: 'Martwy ciąg z deficytu' }) || ''));
ok('snatch deadlift photo', /Snatch_Deadlift/.test(ctx.exThumbUrl({ name: 'Martwy ciąg chwyt rwaniowy' }) || ''));
ok('superman photo', /Superman/.test(ctx.exThumbUrl({ name: 'Superman' }) || ''));
ok('muscle-up photo', /Muscle_Up/.test(ctx.exThumbUrl({ name: 'Podciągnięcie z wyjściem (muscle-up)' }) || ''));
ok('renegade row photo', /Renegade_Row/.test(ctx.exThumbUrl({ name: 'Wiosłowanie renegade z pompkami' }) || ''));
ok('band pull-apart photo', /Band_Pull_Apart/.test(ctx.exThumbUrl({ name: 'Rozciąganie taśmy' }) || ''));
ok('neutral pull-up photo', /V-Bar_Pullup/.test(ctx.exThumbUrl({ name: 'Podciąganie neutralnym chwytem' }) || ''));
ok('meadows row photo', /Long_Bar_Row/.test(ctx.exThumbUrl({ name: 'Wiosłowanie Meadowsa' }) || ''));
ok('machine row photo', /Leverage_Iso_Row/.test(ctx.exThumbUrl({ name: 'Wiosłowanie na maszynie' }) || ''));
ok('yates row photo', /Reverse_Grip_Bent-Over/.test(ctx.exThumbUrl({ name: 'Wiosłowanie Yatesa' }) || ''));

windowObj.EX_GIF_MANIFEST = {};
windowObj.EX_GIF_REMOTE = {};
const allLib = [...defBlock[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)]
  .map((x) => ({ name: x[1], cat: (x[2].match(/cat:'([^']+)'/) || [])[1] || '' }));
ok('library size for photos', allLib.length >= 900);
const libMissing = allLib.filter((e) => {
  const thumb = ctx.exThumbUrl(e) || '';
  return !/free-exercise-db|githubusercontent/.test(thumb) || ctx.isDecorativeExAsset(thumb);
});
ok('all library exercises have still photos' + (libMissing.length ? ' — ' + libMissing.slice(0, 12).map((e) => e.name).join(', ') : ''), libMissing.length === 0);
ok('airbike photo', /Recumbent_Bike/.test(ctx.exThumbUrl({ name: 'Airbike' }) || ''));
ok('power clean photo', /Power_Clean/.test(ctx.exThumbUrl({ name: 'Zarzut siłowy' }) || ''));
ok('snatch photo', /Snatch/.test(ctx.exThumbUrl({ name: 'Rwanie' }) || ''));
ok('smith squat photo', /Smith_Machine_Squat/.test(ctx.exThumbUrl({ name: 'Przysiad w bramie Smith' }) || ''));
ok('seated leg curl photo', /Seated_Leg_Curl/.test(ctx.exThumbUrl({ name: 'Uginanie nóg siedząc' }) || ''));
ok('foam calf smr photo', /Calves-SMR/.test(ctx.exThumbUrl({ name: 'Foam roller łydki' }) || ''));
ok('tate press photo', /Tate_Press/.test(ctx.exThumbUrl({ name: 'Wyciskanie Tate' }) || ''));
ok('sled push photo', /Sled_Push/.test(ctx.exThumbUrl({ name: 'Pchanie sań' }) || ''));
ok('rower photo', /Rowing/.test(ctx.exThumbUrl({ name: 'Wioślarz' }) || ''));
ok('jump rope photo', /Rope_Jumping/.test(ctx.exThumbUrl({ name: 'Skakanka' }) || ''));
ok('ez-bar curl photo', /EZ-Bar_Curl|EZ_Bar/.test(ctx.exThumbUrl({ name: 'Uginanie gryfem łamanym' }) || ''));
ok('cable kickback is triceps not glute', /Tricep_Dumbbell_Kickback/.test(ctx.exThumbUrl({ name: 'Kickback na wyciągu' }) || ''));
ok('butterfly stretch not pec-deck', /Groin/.test(ctx.exThumbUrl({ name: 'Rozciąganie butterfly' }) || '') && !/exercises\/Butterfly\//.test(ctx.exThumbUrl({ name: 'Rozciąganie butterfly' }) || ''));
ok('kb halo photo', /Around_The_Worlds/.test(ctx.exThumbUrl({ name: 'Okrążenie kettlebell (halo)' }) || ''));
ok('push jerk photo', /Jerk/.test(ctx.exThumbUrl({ name: 'Pchanie sztangi (jerk)' }) || ''));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll lib-ex-photos tests passed');
