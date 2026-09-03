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

ok('cache manifest v33', html.includes('ex-gif-manifest.js?v=33'));
ok('cache 01 v60', html.includes('01-core.js?v=60'));
ok('cache 06 v41', html.includes('06-inbox-exercises-ai-programs.js?v=41'));
ok('cache manifest v32', html.includes('ex-gif-manifest.js?v=33'));
ok('cache 01 v59', html.includes('01-core.js?v=60'));
ok('cache 06 v38', html.includes('06-inbox-exercises-ai-programs.js?v=41'));
ok('cache manifest v32', html.includes('ex-gif-manifest.js?v=32'));
ok('cache 01 v59', html.includes('01-core.js?v=59'));
ok('cache 06 v38', html.includes('06-inbox-exercises-ai-programs.js?v=42'));
ok('cache manifest v31', html.includes('ex-gif-manifest.js?v=31'));
ok('cache 01 v58', html.includes('01-core.js?v=59'));
ok('cache 06 v38', html.includes('06-inbox-exercises-ai-programs.js?v=42'));

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
ok(
  'lying bench-dip-as-pushup filename not assigned',
  hit('Dipy na ławce (Bench Dip).mp4') === ''
);
ok(
  'honest bench dips maps',
  hit('Dipy na ławce (triceps dips na ławce) (Bench Dips).mp4') === 'Dipy na ławce'
);
ok(
  'straight-bar pushdown maps',
  hit('Prostowanie ramion na wyciągu górnym (triceps pushdown) (Cable Triceps Pushdown) (2).mp4') === 'Prostowanie tricepsa wyciąg'
);
ok(
  'rope pushdown maps',
  hit('Prostowanie ramion na wyciągu górnym (triceps pushdown) – uchwyt linowy (Cable Triceps Pushdown with Rope Attachment).mp4') === 'Prostowanie linką'
);
ok(
  'standing db overhead maps',
  hit('Francuskie wyciskanie hantli nad głową (triceps overhead extension z hantlami) (Dumbbell Overhead Triceps Extension).mp4') === 'Prostowanie za głowę hantlem'
);
ok(
  'lying skull-as-seated-oh filename not assigned',
  hit('Francuskie wyciskanie hantli leżąc (skull crusher z hantlą) (Dumbbell Skull Crusher (Lying Dumbbell Tricep Extension)).mp4') === ''
);
ok(
  'lateral-raise named as one-arm pushdown not assigned',
  hit('Odpychanie na wyciągu dolnym (triceps pushdown jednorącz) (Single-arm cable triceps pushdown).mp4') === ''
);
ok(
  'cable kickback mix not assigned',
  hit('Prostowanie ramienia na wyciągu dolnym (triceps kickback na wyciągu) (Cable Tricep Kickback).mp4') === ''
);
ok(
  'compilation kickback not db kickback',
  hit('Odciąganie ramienia w tył na wyciągu górnym (triceps kickback na wyciągu) (Cable Tricep Kickback).mp4') === ''
);
ok(
  'honest concentration curl maps',
  hit('Uginanie przedramion z hantlą w oparciu o kolano (uginanie koncentryczne) (Dumbbell Concentration Curl).mp4') === 'Uginanie koncentryczne'
);
ok(
  'honest reverse barbell curl maps',
  hit('Uginanie ramion ze sztangą (uchwyt nachwytem) (Barbell Reverse Curl).mp4') === 'Uginanie reverse'
);
ok(
  'lying barbell-curl-as-lateral filename not assigned',
  hit('Uginanie ramion ze sztangą (uchwyt podchwytem) (Barbell Bicep Curl).mp4') === ''
);
ok(
  'lying preacher-as-leg-press filename not assigned',
  hit('Uginanie ramion ze sztangą łamaną (EZ) na modlitewniku (EZ Bar Preacher Curl).mp4') === ''
);
ok(
  'lying cable-curl mix filename not assigned',
  hit('Uginanie ramion na wyciągu dolnym (stojąc) (Standing Cable Curl).mp4') === ''
);
ok(
  'lying hammer-named db-curl filename not assigned',
  hit('Uginanie ramion z hantlą (uchwyt młotkowy) (Dumbbell Hammer Curl).mp4') === ''
);
ok(
  'lying bicep-curl-named hammer filename not assigned',
  hit('Uginanie ramion z hantlami (biceps curl z hantlami) (Dumbbell Bicep Curl).mp4') === ''
);
ok(
  'lying prone-plank-as-crunch filename not assigned',
  hit('Deska w leżeniu przodem (plank) (Prone Plank).mp4') === ''
);
ok(
  'honest kneeling ab-wheel maps to rollout',
  hit('Rollout na kółku ab wheel z kolan (Kneeling Ab Wheel Rollout).mp4') === 'Rollout z kółkiem'
);
ok(
  'lying bicycle-crunch mix filename not assigned',
  hit('Rowerek (leżąc na plecach) (Bicycle Crunch).mp4') === ''
);
ok(
  'lying russian-twist mix filename not assigned',
  hit('Skręty tułowia w siadzie (Russian twist) (Russian Twist).mp4') === ''
);
ok(
  'lying scissor-kicks mix filename not assigned',
  hit('Nożyce w leżeniu na plecach (Scissor Kicks).mp4') === ''
);
ok(
  'lying leg-raise mix filename not assigned',
  hit('Unoszenie nóg w leżeniu na plecach (Lying Leg Raises).mp4') === ''
);
ok(
  'lying mountain-climbers mix filename not assigned',
  hit('Wspinaczka górska (mountain climbers) (Mountain Climbers).mp4') === ''
);
ok(
  'lying jump-squat mix filename not assigned',
  hit('Przysiad z wyskokiem i klaśnięciem nad głową (Jump Squat with Overhead Clap).mp4') === ''
);
ok(
  'lying child-pose mix filename not assigned',
  hit("Pozycja dziecka (rozciąganie) (Child's Pose (stretch)).mp4") === ''
);
ok(
  'lying hip-flexor mix filename not assigned',
  hit('Wykrok w klęku – rozciąganie zginacza biodra (hip flexor stretch) (Kneeling Hip Flexor Stretch).mp4') === ''
);
ok(
  'lying neck-trap-stretch mix filename not assigned',
  hit('Rozciąganie mięśni czworobocznych rozciąganie karku (Neck and Upper Trapezius Stretch).mp4') === ''
);
ok(
  'lying triceps-stretch mix filename not assigned',
  hit('Rozciąganie tricepsów (za plecami) (Triceps Stretch (behind back)).mp4') === ''
);
ok(
  'lying seated-quad-as-curl filename not assigned',
  hit('Rozciąganie mięśnia czworogłowego uda w siadzie (stretching statyczny) (Seated Quadriceps Stretch).mp4') === ''
);
ok(
  'lying seated-quad-on-bench-as-curl filename not assigned',
  hit('Rozciąganie mięśnia czworogłowego uda w siadzie (na ławce) (Seated Quadriceps Stretch (on bench)).mp4') === ''
);
ok(
  'lying floor-chest-stretch-as-pushup filename not assigned',
  hit('Rozpiętki w leżeniu na podłodze (bez sprzętu ćwiczenie rozciągające klatkę piersiową) (Floor Chest Stretch Lying Chest Opener).mp4') === ''
);
ok(
  'lying ankle-stretch mix filename not assigned',
  hit('Zgięcie podeszwowe stopy (rozciąganie ścięgna Achillesa mobilizacja stawu skokowego) (Ankle Plantar Flexion Stretch).mp4') === ''
);
ok(
  'honest db standing calf maps to db calf raise',
  hit('Wspięcia na palce z hantlami (stojąc) (Standing Dumbbell Calf Raises).mp4') === 'Wspięcia na palce hantlami'
);
ok(
  'honest standing calf on-step maps to standing calf',
  hit('Wspięcia na palce (stojąc) – unoszenie łydek na stopniu (Standing Calf Raise on Step).mp4') === 'Wspięcia na palce stojąc'
);
ok(
  'lying ankle-mobility-as-calf filename not assigned',
  hit('Wspięcia na palce (rozciąganie ścięgna Achillesa zakres ruchu kostki) (Ankle Dorsiflexion Plantar Flexion Mobility Drill).mp4') === ''
);
ok(
  'lying band-named plank mix not assigned',
  hit('Wspięcia na palce stojąc (z gumą oporową) (Standing Calf Raises (with resistance band)).mp4') === ''
);
ok(
  'lying foot-width-named renegade mix not assigned',
  hit('Wspięcia na palce stojąc (szerokość stóp) (Standing Calf Raise – Foot Width Position Check).mp4') === ''
);
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
  'lying front-squat filename not assigned',
  hit('Przysiad ze sztangą trzymaną z przodu (front squat) (Barbell Front Squat).mp4') === ''
);
ok(
  'classic back squat maps to barbell squat',
  hit('Przysiad ze sztangą na karku (przysiad klasyczny) (Barbell Back Squat).mp4') === 'Przysiad ze sztangą'
);
ok(
  'lying goblet filename not assigned',
  hit('Przysiad ze sztangielkami (goblet squat z hantlami) (Dumbbell Goblet Squat).mp4') === ''
);
ok(
  'lying walking-lunge filename not assigned',
  hit('Wykrok z hantlami (chód) (Dumbbell Walking Lunges).mp4') === ''
);
ok(
  'lying smith squat filename not assigned',
  hit('Przysiad ze sztangą na suwnicy Smitha (Smith Machine Squat).mp4') === ''
);
ok(
  'lying chair-dip bulgarian filename not assigned',
  hit('Wykrok bułgarski (tylna noga na ławce) (Bulgarian Split Squat).mp4') === ''
);
ok(
  'honest bulgarian split squat maps',
  hit('Wykrok z tylną nogą uniesioną na ławce (bułgarski przysiad split) (Bulgarian Split Squat).mp4') === 'Przysiad bułgarski'
);
ok(
  'honest leg-press foot alignment maps',
  hit('Wypychanie nóg na suwnicy (leg press) – ustawienie stópkolan (Leg Press (machine) – footknee alignment).mp4') === 'Wyciskanie nogami'
);
ok(
  'db lunge maps to dumbbell lunge',
  hit('Wykrok z hantlami (Dumbbell Lunge).mp4') === 'Wykrok z hantlami'
);
ok(
  'lying barbell-lunge filename not assigned',
  hit('Wykrok ze sztangą (Barbell Lunge).mp4') === ''
);
ok(
  'lying single-leg-press filename not assigned',
  hit('Wyciskanie nogami na suwnicy (jednotnie) (Single-Leg Press (Leg Press Machine)).mp4') === ''
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
  'adduction-named extension not assigned',
  hit('Przywodzenie nóg na maszynie (adduktor) (Seated Hip Adduction Machine).mp4') === ''
);
ok(
  'lying glute-bridge-as-plank filename not assigned',
  hit('Mostek biodrowy (uginanie bioder w leżeniu) (Glute Bridge).mp4') === ''
);
ok(
  'lying donkey-kick-as-crunch filename not assigned',
  hit('Odwodzenie nogi w tył w klęku podpartym (kopnięcie osła) (Donkey Kick (Quadruped Hip Extension)).mp4') === ''
);
ok(
  'lying side-lying-as-rdl filename not assigned',
  hit('Unieisienie nogi w leżeniu bokiem (Side-Lying Hip Abduction).mp4') === ''
);
ok(
  'lying seated-abduction-as-extension filename not assigned',
  hit('Odwodzenie nóg na maszynie (siedzące) (Seated Hip Abduction Machine).mp4') === ''
);
ok(
  'lying machine-kickback-as-cable filename not assigned',
  hit('Odwodzenie nogi w tył na maszynie (kickback na maszynie) (Machine Glute Kickback).mp4') === ''
);
ok(
  'cable glute kickback maps to glute kickback',
  hit('Odwodzenie nogi w tył na wyciągu (kickback na wyciągu) (Cable Glute Kickback).mp4') === 'Kickback pośladki'
);
ok(
  'db hip thrust maps to hip thrust',
  hit('Hip thrust z hantlą (Dumbbell hip thrust).mp4') === 'Wypychanie bioder (hip thrust)'
);
ok(
  'seated abduction maps to abduction machine',
  hit('Odwodzenie nogi w maszynie (abduktor) (Seated Hip Abduction Machine).mp4') === 'Abdukcja biodra maszyna'
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
  'lying hip-thrust-as-curl filename not assigned',
  hit('Uginanie nóg leżąc na maszynie (Lying Leg Curl (Machine)).mp4') === ''
);
ok(
  'lying extension-as-curl filename not assigned',
  hit('Uginanie nóg w leżeniu na maszynie (Lying Leg Curl Machine).mp4') === ''
);
ok(
  'lying nordic-named curl filename not assigned',
  hit('Uginanie nóg leżąc na plecach (Nordic Curl Glute-Ham Raise na ławce) (Nordic Hamstring Curl (Lying)).mp4') === ''
);
ok(
  'seated-named lying curl filename not assigned',
  hit('Uginanie nóg w leżeniu na maszynie (Seated Leg Curl Machine).mp4') === ''
);
ok(
  'honest outer lying curl maps',
  hit('Uginanie nóg leżąc na maszynie (głowa nóg dwugłowych – część zewnętrzna) (Lying Leg Curl Machine (Outer Hamstrings)).mp4') === 'Uginanie nóg leżąc'
);
ok(
  'honest wide lying curl maps',
  hit('Uginanie nóg w leżeniu na maszynie (szeroki chwyt – głowa głęboka dwugłowego) (Lying Leg Curl Machine (wide stance – outer hamstrings emphasis)).mp4') === 'Uginanie nóg maszyna'
);
ok(
  'reverse pec deck not butterfly',
  hit('Odwrotne rozpiętki na maszynie (tylne ramiona) (Reverse Pec Deck Fly (Rear Delt Fly Machine)).mp4') !== 'Butterfly (peck deck)'
);
ok(
  'lying reverse pec deck filename not assigned',
  hit('Odwrotne rozpiętki na maszynie (tylne ramiona) (Reverse Pec Deck Fly (Rear Delt Fly Machine)).mp4') === ''
);
ok(
  'lying barbell OHP filename not assigned',
  hit('Wyciskanie sztangi nad głowę stojąc (OHP) (Standing Barbell Overhead Press (OHP)).mp4') === ''
);
ok(
  'lying db front raise filename not assigned',
  hit('Wznosy ramion w przód z hantlami (Dumbbell Front Raise).mp4') === ''
);
ok(
  'lying machine shoulder press filename not assigned',
  hit('Wyciskanie żołnierskie na maszynie (naramienne) (Machine Shoulder Press).mp4') === ''
);
ok(
  'lying standing db ohp filename not assigned',
  hit('Wyciskanie hantli nad głowę (żołnierskie) (Dumbbell Overhead Press (Military Press)).mp4') === ''
);
ok(
  'lying arnold-named seated press not arnold',
  hit('Wyciskanie hantli nad głowę siedząc (Arnold press wyciskanie żołnierskie) (Seated Dumbbell Overhead Press).mp4') !== 'Wyciskanie Arnolda'
);
ok(
  'cable lateral maps to one-arm cable raise',
  hit('Odwodzenie ramienia na wyciągu dolnym (stojąc bokiem) (Cable lateral raise (low pulley)).mp4') === 'Unoszenie bokiem na wyciągu jednorącz'
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
