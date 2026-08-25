#!/usr/bin/env node
/**
 * Buduje ex-photo-manifest.js — mapowanie PL nazwa ćwiczenia → zdjęcie
 * z yuhonas/free-exercise-db (Unlicense).
 *
 * Wymaga sieci przy pierwszym uruchomieniu (pobiera exercises.json),
 * albo lokalnego /tmp/fedb.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '../..');
const outFile = path.join(root, 'ex-photo-manifest.js');
const cacheFile = path.join('/tmp', 'fedb.json');
const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const JSON_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

/** PL DEF_EX name → EN free-exercise-db name */
const ALIASES = {
  'Wyciskanie sztangi leżąc': 'Barbell Bench Press - Medium Grip',
  'Wyciskanie hantli leżąc': 'Dumbbell Bench Press',
  'Wyciskanie hantli skos+': 'Incline Dumbbell Press',
  'Rozpiętki hantlami': 'Dumbbell Flyes',
  'Rozpiętki na wyciągu': 'Cable Crossover',
  'Pompki': 'Pushups',
  'Pompki na rączkach': 'Push-Ups With Feet Elevated',
  'Dipy na poręczach': 'Parallel Bar Dip',
  'Peck deck': 'Butterfly',
  'Pullover hantlem': 'Bent-Arm Dumbbell Pullover',
  'Pompki plyometryczne': 'Plyo Push-up',
  'Wyciskanie wąskim chwytem': 'Close-Grip Barbell Bench Press',
  'Wyciskanie sztangi skos+': 'Barbell Incline Bench Press - Medium Grip',
  'Wyciskanie sztangi skos−': 'Decline Barbell Bench Press',
  'Wyciskanie hantli skos−': 'Decline Dumbbell Bench Press',
  'Floor press': 'Floor Press',
  'Wyciskanie na maszynie': 'Leverage Chest Press',
  'Cable crossover góra–dół': 'Cable Crossover',
  'Cable crossover dół–góra': 'Low Cable Crossover',
  'Landmine press': 'Landmine Linear Jammer',
  'Pompki diamentowe': 'Close-Grip Push-Up off of a Dumbbell',
  'Pompki szerokie': 'Pushups',
  'Svend press': 'Isometric Wipers',
  'Martwy ciąg klasyczny': 'Barbell Deadlift',
  'Martwy ciąg RDL': 'Romanian Deadlift',
  'Wiosłowanie sztangą': 'Bent Over Barbell Row',
  'Wiosłowanie hantlem': 'One-Arm Dumbbell Row',
  'Podciąganie na drążku': 'Pullups',
  'Podciąganie neutralnym chwytem': 'Band Assisted Pull-Up',
  'Ściąganie drążka wyciąg': 'Wide-Grip Lat Pulldown',
  'Wiosłowanie wyciągiem siedząc': 'Seated Cable Rows',
  'Facepull': 'Face Pull',
  'Good morning': 'Good Morning',
  'Hyperextension': 'Hyperextensions (Back Extensions)',
  'Odwrotne rozpiętki': 'Bent Over Dumbbell Rear Delt Raise With Head On Bench',
  'Inverted row': 'Inverted Row',
  'Chest supported row': 'Incline Bench Pull',
  'Podciąganie podchwytem': 'Chin-Up',
  'T-bar row': 'T-Bar Row with Handle',
  'Meadows row': 'One-Arm Dumbbell Row',
  'Pendlay row': 'Bent Over Barbell Row',
  'Seal row': 'Lying T-Bar Row',
  'Straight arm pulldown': 'Straight-Arm Pulldown',
  'Ściąganie drążka wąskim chwytem': 'Close-Grip Front Lat Pulldown',
  'Shrugs sztanga': 'Barbell Shrug',
  'Shrugs hantle': 'Dumbbell Shrug',
  'Single-arm lat pulldown': 'One Arm Lat Pulldown',
  'Wyciskanie żołnierskie OHP': 'Standing Military Press',
  'Wyciskanie hantli siedząc': 'Seated Dumbbell Press',
  'Arnold press': 'Arnold Dumbbell Press',
  'Unoszenie bokiem': 'Side Lateral Raise',
  'Unoszenie przodem': 'Front Dumbbell Raise',
  'Unoszenie wyciągiem bokiem': 'Cable Seated Lateral Raise',
  'Odwrotne rozpiętki maszyna': 'Cable Rear Delt Fly',
  'Rotacja zewnętrzna': 'External Rotation',
  'Push press': 'Push Press',
  'Cuban press': 'Cuban Press',
  'Wyciskanie barków maszyna': 'Leverage Shoulder Press',
  'Upright row': 'Upright Barbell Row',
  'Y-raise': 'Front Incline Dumbbell Raise',
  'Unoszenie bokiem na wyciągu jednorącz': 'One-Arm Side Laterals',
  'Plate front raise': 'Front Plate Raise',
  'Landmine lateral raise': 'Side Lateral Raise',
  'Uginanie biceps sztangą': 'Barbell Curl',
  'Uginanie młotkowe': 'Hammer Curls',
  'Uginanie hantlami naprzemiennie': 'Alternate Incline Dumbbell Curl',
  'Uginanie na wyciągu': 'Standing Biceps Cable Curl',
  'Spider curl': 'Spider Curl',
  'Uginanie Zottman': 'Zottman Curl',
  'Uginanie reverse': 'Reverse Barbell Curl',
  'Uginanie nadgarstka': 'Seated Palm-Up Barbell Wrist Curl',
  'Concentration curl': 'Concentration Curls',
  'Preacher curl': 'Preacher Curl',
  'Incline curl': 'Incline Dumbbell Curl',
  'Bayesian curl': 'Standing Biceps Cable Curl',
  'Drag curl': 'Drag Curl',
  '21s biceps': 'Barbell Curl',
  'Prostowanie tricepsa wyciąg': 'Triceps Pushdown',
  'French press': 'Standing Overhead Barbell Triceps Extension',
  'Skull crusher': 'Lying Triceps Press',
  'Kick back triceps': 'Tricep Dumbbell Kickback',
  'Overhead triceps wyciąg': 'Cable Rope Overhead Triceps Extension',
  'Prostowanie linką (rope pushdown)': 'Triceps Pushdown - Rope Attachment',
  'Prostowanie jednorącz wyciąg': 'Cable One Arm Tricep Extension',
  'Overhead triceps hantlem': 'Standing Dumbbell Triceps Extension',
  'Bench dip': 'Bench Dips',
  'Dipy triceps (pionowe)': 'Parallel Bar Dip',
  'JM press': 'Close-Grip Barbell Bench Press',
  'Triceps dip maszyna': 'Dips - Triceps Version',
  'Przysiad ze sztangą': 'Barbell Squat',
  'Przysiad Goblet': 'Goblet Squat',
  'Front squat': 'Front Barbell Squat',
  'Przysiad sumo': 'Sumo Deadlift',
  'Leg press': 'Leg Press',
  'Wykrok ze sztangą': 'Barbell Walking Lunge',
  'Bulgarian split squat': 'Dumbbell Rear Lunge',
  'Hip thrust': 'Barbell Hip Thrust',
  'Mostek biodrowy': 'Butt Lift (Bridge)',
  'Rumuński martwy ciąg': 'Romanian Deadlift',
  'Uginanie nóg maszyna': 'Lying Leg Curls',
  'Wyprosty nóg maszyna': 'Leg Extensions',
  'Wspięcia na palce': 'Standing Calf Raises',
  'Wspięcia na palce jednonóż': 'Donkey Calf Raises',
  'Step-up': 'Dumbbell Step Ups',
  'Sumo deadlift': 'Sumo Deadlift',
  'Hack squat maszyna': 'Hack Squat',
  'Przysiad jednonóż (pistol)': 'Kettlebell Pistol Squat',
  'Box squat': 'Box Squat',
  'Single leg RDL': 'One-Legged Cable Kickback',
  'Nordic curl': 'Floor Glute-Ham Raise',
  'Wall sit': 'Linear Acceleration Wall Drill',
  'Trap bar deadlift': 'Trap Bar Deadlift',
  'Kickback pośladki': 'Glute Kickback',
  'Abdukcja biodra maszyna': 'Thigh Abductor',
  'Hip thrust jednonóż': 'Single Leg Glute Bridge',
  'Monster walk': 'Monster Walk',
  'Clamshell': 'Glute Kickback',
  'Cable pull-through': 'Pull Through',
  'Frog pump': 'Frog Hops',
  'Reverse hyperextension': 'Reverse Hyperextension',
  'Step-up boczny': 'Side to Side Box Shuffle',
  'Banded hip thrust': 'Barbell Hip Thrust',
  '45° hyperextension pośladki': 'Hyperextensions (Back Extensions)',
  'Glute march': 'Flutter Kicks',
  'Plank': 'Plank',
  'Ab wheel rollout': 'Barbell Ab Rollout',
  'Hollow hold': 'Hanging Pike',
  'Dragon flag': 'Hanging Pike',
  'Deska boczna': 'Side Bridge',
  'Dead bug': 'Dead Bug',
  'Bird dog': 'Superman',
  'Brzuszki klasyczne': 'Crunches',
  'Zwisy nóg drążek': 'Hanging Leg Raise',
  'Russian twist': 'Russian Twist',
  'Woodchop wyciąg': 'Standing Cable Wood Chop',
  'Pallof press': 'Pallof Press',
  'Farmer carry': "Farmer's Walk",
  'Hanging knee raise': 'Hanging Leg Raise',
  'Toes to bar': 'Hanging Pike',
  'V-up': 'Jackknife Sit-Up',
  'Dead hang': 'Scapular Pull-Up',
  'Burpees': 'Spider Crawl',
  'Mountain climbers': 'Mountain Climbers',
  'Box jump': 'Box Jump (Multiple Response)',
  'Jump squat': 'Freehand Jump Squat',
  'Kettlebell swing': 'One-Arm Kettlebell Swings',
  'Turkish get-up': 'Kettlebell Turkish Get-Up (Lunge style)',
  'Jumping jacks': 'Rope Jumping',
  'High knees': 'Running, Treadmill',
  'Butt kicks': 'Double Leg Butt Kick',
  'Inchworm': 'Inchworm',
  'Bear crawl': 'Bear Crawl Sled Drags',
  'Cat-cow': 'Cat Stretch',
  'Child pose': "Child's Pose",
  'Downward dog': 'Downward Facing Balance',
  'Cobra stretch': 'Superman',
  'Donkey kick': 'Glute Kickback',
  'Fire hydrant': 'Glute Kickback',
  'Glute bridge aktywacja': 'Butt Lift (Bridge)',
  'Lateral lunge': 'Barbell Side Split Squat',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function loadFedb() {
  if (fs.existsSync(cacheFile)) {
    try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) { /* refetch */ }
  }
  const data = await fetchJson(JSON_URL);
  fs.writeFileSync(cacheFile, JSON.stringify(data));
  return data;
}

async function main() {
  const fedb = await loadFedb();
  const byName = new Map(fedb.map((e) => [String(e.name || '').toLowerCase(), e]));
  const manifest = {};
  const missing = [];
  for (const [pl, en] of Object.entries(ALIASES)) {
    const ex = byName.get(en.toLowerCase());
    if (!ex || !ex.images || !ex.images[0]) {
      missing.push(pl + ' -> ' + en);
      continue;
    }
    const key = pl.toLowerCase().replace(/\s+/g, ' ').trim();
    manifest[key] = IMG_BASE + ex.images[0];
  }
  const body =
    '/** Zdjęcia techniki (free-exercise-db / Unlicense). Generuj: node .github/scripts/build_ex_photo_manifest.js */\n' +
    'window.EX_PHOTO_MANIFEST=' + JSON.stringify(manifest, null, 2) + ';\n';
  fs.writeFileSync(outFile, body);
  console.log('Wrote', Object.keys(manifest).length, 'photos →', path.relative(root, outFile));
  if (missing.length) {
    console.warn('Unmatched aliases:', missing.length);
    missing.forEach((m) => console.warn(' ', m));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
