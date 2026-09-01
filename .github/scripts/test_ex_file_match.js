#!/usr/bin/env node
'use strict';
/** Dopasowanie plików MP4 (Nazwa PL (English Name).mp4) do DEF_EX. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache manifest v23', html.includes('ex-gif-manifest.js?v=24'));
ok('cache 01 v50', html.includes('01-core.js?v=51'));
ok('cache 06 v38', html.includes('06-inbox-exercises-ai-programs.js?v=40'));

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
ok('DEF_EX block', !!m);
const exercises = [...m[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)].map((x) => ({
  name: x[1],
  aka: (x[2].match(/aka:'([^']+)'/) || [])[1] || '',
}));

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = {
  addEventListener() {},
  CL: [],
  EX: [],
  DEF_EX: exercises,
  EX_GIF_MANIFEST: {},
  EX_GIF_REMOTE: {},
  COACH_VIDEOS: [],
  document,
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date,
  Math,
  parseInt,
  parseFloat,
  Number,
  String,
  Array,
  Object,
  JSON,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

ok('slug plus', ctx.exerciseSlug('Wyciskanie hantli skos+') === 'wyciskanie-hantli-skos-plus');
ok('slug minus', ctx.exerciseSlug('Wyciskanie hantli skos−') === 'wyciskanie-hantli-skos-minus');
ok('slug plus != minus', ctx.exerciseSlug('Wyciskanie hantli skos+') !== ctx.exerciseSlug('Wyciskanie hantli skos−'));

function hit(file) {
  return ctx.matchFilenameToExercise(file, exercises);
}

ok(
  'bench barbell',
  hit('Wyciskanie sztangi na ławce płaskiej (Barbell Bench Press).mp4') === 'Wyciskanie sztangi leżąc'
);
ok(
  'db bench',
  hit('Wyciskanie hantli na ławce poziomej (Dumbbell Bench Press).mp4') === 'Wyciskanie hantli leżąc'
);
ok(
  'incline db',
  hit('Wyciskanie hantli na ławce skośnej dodatniej (Incline Dumbbell Press).mp4') === 'Wyciskanie hantli skos+'
);
ok(
  'fake incline OHP not chest incline',
  hit('Wyciskanie hantli na ławce skośnej (incline) (Incline Dumbbell Press).mp4') !== 'Wyciskanie hantli skos+'
);
ok(
  'krzeselko is cable fly overview',
  hit('Krzyżowanie ramion na wyciągu (krzesełko) (Cable Crossover).mp4') === 'Rozpiętki na wyciągu'
);
ok(
  'standing compilation is low-to-high',
  hit('Krzyżowanie ramion na wyciągu (wyciąg górny, stojąc) (Cable Crossover).mp4') === 'Krzyżowanie wyciągów dół–góra'
);
ok(
  'high pulley is high-to-low',
  hit('Rozpiętki na wyciągu górnym (skrzyżowanie linek) (Cable Crossover (High Pulley)).mp4') === 'Krzyżowanie wyciągów góra–dół'
);
ok(
  'decline db not incline',
  hit('Wyciskanie hantli na ławce skośnej głową w dół (Decline Dumbbell Bench Press).mp4') === 'Wyciskanie hantli skos−'
);
ok(
  'close grip not flat bench',
  hit('Wyciskanie sztangi wąskim chwytem (Close-Grip Barbell Bench Press).mp4') !== 'Wyciskanie sztangi leżąc'
);
ok('dips', hit('Dipy na poręczach (Parallel Bar Dips).mp4') === 'Dipy na poręczach');
ok('bench dips', hit('Dipy na ławce (Bench Dip).mp4') === 'Dipy na ławce');
ok('plank', hit('Deska w leżeniu przodem (plank) (Prone Plank).mp4') === 'Deska');
ok('face pull', hit('Ściąganie drążka wyciągu górnego do twarzy (face pull) (Cable Face Pull).mp4') === 'Ściąganie do twarzy (face pull)');
ok('junk splash', hit('Brak ćwiczenia – ekran powitalny aplikacji YouCan (No exercise – YouCan app splash screen).mp4') === '');
ok('junk na', hit('Nie dotyczy – brak ćwiczenia na obrazie (NA – no exercise depicted).mp4') === '');
ok(
  'chest fly not reverse fly',
  hit('Rozpiętki hantlami na ławce poziomej (Dumbbell Flat Bench Fly).mp4') === 'Rozpiętki hantlami'
);
ok(
  'reverse fly not chest fly',
  hit('Odwodzenie ramienia z hantlą w opadzie tułowia (odwrotne rozpięcie z hantlami) (Dumbbell Bent-Over Rear Delt Fly (Reverse Dumbbell Fly)).mp4') !== 'Rozpiętki hantlami'
);
ok(
  'front squat not sumo',
  hit('Przysiad ze sztangą trzymaną z przodu (front squat) (Barbell Front Squat).mp4') === 'Przysiad przedni'
);
ok(
  'sumo front not front squat',
  hit('Przysiad sumo ze sztangą z przodu (na barkach) (Sumo Barbell Front Squat).mp4') !== 'Przysiad przedni'
);
ok(
  'overhand not chin-up',
  hit('Podciąganie nachwytem na drążku (szerokie) (Wide-Grip Pull-Up Wide-Grip Chin-Up (overhand)).mp4') !== 'Podciąganie podchwytem'
);
ok(
  'adduction not abduction clip',
  hit('Przywodzenie nóg na maszynie (adduktor) (Seated Hip Adduction Machine).mp4') === 'Przywodzenie biodra maszyna'
);
ok(
  'machine fly not chest press',
  hit('Ściąganie drążka wyciągu górnego do klatki piersiowej (maszyna cable crossover) (Cable Chest Press Machine Seated Cable Chest Fly Machine).mp4') !== 'Wyciskanie na maszynie'
);
ok(
  'bodyweight good morning not band hinge',
  hit('Martwy ciąg na prostych nogach (bez obciążenia bodyweight) (Bodyweight Stiff-Leg Deadlift (Good Morning)).mp4') !== 'Hip hinge z taśmą'
);
ok(
  'reverse pec deck not butterfly',
  hit('Odwrotne rozpiętki na maszynie (tylne ramiona) (Reverse Pec Deck Fly (Rear Delt Fly Machine)).mp4') !== 'Butterfly (peck deck)'
);
ok(
  'reverse pec deck is machine reverse',
  hit('Odwrotne rozpiętki na maszynie (tylne ramiona) (Reverse Pec Deck Fly (Rear Delt Fly Machine)).mp4') === 'Odwrotne rozpiętki maszyna'
);
ok(
  'lying barbell-row filename not assigned',
  hit('Wiosłowanie sztangą w opadzie tułowia (Barbell Bent-Over Row).mp4') === ''
);
ok(
  'lying pendlay filename not assigned',
  hit('Wiosłowanie sztangą podchwytem (wiosłowanie Pendlay) (Barbell Bent-Over Row (Underhand Grip Pendlay Row)).mp4') === ''
);
ok(
  'lying preacher-as-db-row not assigned',
  hit('Wiosłowanie jednorączne na ławce (z hantlem) (Single-Arm Dumbbell Row).mp4') === ''
);
ok(
  'lying pec-deck-as-pull-up not assigned',
  hit('Podciąganie na drążku nachwytem (Pull-up (overhand grip)).mp4') === ''
);

vm.runInContext(six, ctx);
ctx.allExercises = () => exercises;
ok(
  'import matcher uses EN paren',
  ctx.matchGifFileToExercise('Wyciskanie sztangi na ławce płaskiej (Barbell Bench Press).mp4') === 'Wyciskanie sztangi leżąc'
);
ok(
  'import matcher decline',
  ctx.matchGifFileToExercise('Wyciskanie hantli na ławce skośnej głową w dół (Decline Dumbbell Bench Press).mp4') === 'Wyciskanie hantli skos−'
);

if (failed) process.exit(1);
console.log('\nAll ex-file-match tests passed');
