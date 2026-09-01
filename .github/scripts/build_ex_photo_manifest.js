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
  'Butterfly (peck deck)': 'Butterfly',
  'Pullover hantlem': 'Bent-Arm Dumbbell Pullover',
  'Pompki plyometryczne': 'Plyo Push-up',
  'Wyciskanie wąskim chwytem': 'Close-Grip Barbell Bench Press',
  'Wyciskanie sztangi skos+': 'Barbell Incline Bench Press - Medium Grip',
  'Wyciskanie sztangi skos−': 'Decline Barbell Bench Press',
  'Wyciskanie hantli skos−': 'Decline Dumbbell Bench Press',
  'Wyciskanie z podłogi': 'Floor Press',
  'Wyciskanie na maszynie': 'Leverage Chest Press',
  'Krzyżowanie wyciągów góra–dół': 'Cable Crossover',
  'Krzyżowanie wyciągów dół–góra': 'Low Cable Crossover',
  'Wyciskanie landmine': 'Landmine Linear Jammer',
  'Pompki diamentowe': 'Close-Grip Push-Up off of a Dumbbell',
  'Pompki szerokie': 'Push-Up Wide',
  'Dipy na kółkach': 'Ring Dips',
  'Dipy z obciążeniem': 'Dips - Chest Version',
  'Pompki hindu': 'Pushups',
  'Pompki jednonóż': 'Pushups',
  'Pompki na kolanach': 'Pushups',
  'Pompki z nogami na podwyższeniu': 'Push-Ups With Feet Elevated',
  'Pompki łucznicze': 'Clock Push-Up',
  'Pompki TRX': 'Suspended Push-Up',
  'Pompki TRX z przyciągnięciem kolan': 'Suspended Push-Up',
  'Pompki na hantlach': 'Close-Grip Push-Up off of a Dumbbell',
  'Pompki T hantlami': 'Push Up to Side Plank',
  'Pompki z nogami na piłce swiss': 'Push-Ups With Feet On An Exercise Ball',
  'Pompki na piłce swiss': 'Incline Push-Up',
  'Pompki z rękami na piłce': 'Incline Push-Up',
  'Pompki z przetaczaniem piłki bokiem': 'Clock Push-Up',
  'Pompki jednorącz na piłce': 'Single-Arm Push-Up',
  'Pompki na dwóch piłkach lekarskich': 'Close-Grip Push-Up off of a Dumbbell',
  'Pompki plyo z nogami na podwyższeniu': 'Plyo Push-up',
  'Pompki z przeciągnięciem': 'Pushups',
  'Pompki offset': 'Clock Push-Up',
  'Pompki z dłońmi na podwyższeniu': 'Incline Push-Up',
  'Pompki z gąsienicy': 'Inchworm',
  'Pompki typewriter': 'Clock Push-Up',
  'Pompki podchwytem': 'Incline Push-Up Reverse Grip',
  'Rozpiętki na wyciągu w poziomie': 'Flat Bench Cable Flyes',
  'Rozpiętki jednorącz wyciąg': 'Single-Arm Cable Crossover',
  'Rozpiętki z taśmą stojąc': 'Cross Over - With Bands',
  'Rozpiętki hantlami na piłce swiss': 'Dumbbell Flyes',
  'Pullover sztangą': 'Bent-Arm Barbell Pullover',
  'Wyciskanie hantli na podłodze': 'Dumbbell Floor Press',
  'Wyciskanie na maszynie skos+': 'Leverage Incline Chest Press',
  'Wyciskanie w bramie Smith': 'Smith Machine Bench Press',
  'Wyciskanie hantli jednorącz leżąc': 'One Arm Dumbbell Bench Press',
  'Wyciskanie hantli na piłce swiss': 'Dumbbell Bench Press',
  'Wyciskanie hantla na piłce swiss jednorącz': 'One Arm Dumbbell Bench Press',
  'Wyciskanie hantli na piłce swiss naprzemiennie': 'Dumbbell Bench Press',
  'Wyciskanie z podłogi dwa KB': 'Dumbbell Floor Press',
  'Wyciskanie z podłogi dwa KB w mostku': 'Dumbbell Floor Press',
  'Wyciskanie z podłogi KB jednorącz w mostku': 'One-Arm Kettlebell Floor Press',
  'Wyciskanie z podłogi KB naprzemiennie': 'Alternating Floor Press',
  'Wyciskanie z podłogi KB jednorącz': 'One-Arm Kettlebell Floor Press',
  'Wyciskanie z podłogi hantlem w mostku jednonóż': 'Dumbbell Floor Press',
  'Wyciskanie hantli na podłodze naprzemiennie': 'Alternating Floor Press',
  'Wyciskanie hantli w mostku': 'Dumbbell Floor Press',
  'Wyciskanie hantli w mostku na ławce': 'Dumbbell Bench Press',
  'Wyciskanie hantli wąsko': 'Dumbbell Bench Press with Neutral Grip',
  'Wyciskanie hantli naprzemiennie leżąc': 'Dumbbell Bench Press',
  'Wyciskanie hantla w mostku jednorącz': 'One Arm Dumbbell Bench Press',
  'Wyciskanie hantla z podłogi jednorącz': 'One Arm Floor Press',
  'Wyciskanie klatki z taśmą stojąc': 'Standing Cable Chest Press',
  'Wyciskanie sztangi ekscentryczne': 'Barbell Bench Press - Medium Grip',
  'Wyciskanie sztangi szeroko': 'Wide-Grip Barbell Bench Press',
  'Wyciskanie sztangi 1.5': 'Barbell Bench Press - Medium Grip',
  'Wyciskanie sztangi z pauzą izometryczną': 'Barbell Bench Press - Medium Grip',
  'Wyciskanie Svenda': 'Isometric Wipers',
  'Martwy ciąg klasyczny': 'Barbell Deadlift',
  'Martwy ciąg RDL': 'Romanian Deadlift',
  'Wiosłowanie sztangą': 'Bent Over Barbell Row',
  'Wiosłowanie hantlem': 'One-Arm Dumbbell Row',
  'Podciąganie na drążku': 'Pullups',
  'Podciąganie neutralnym chwytem': 'Band Assisted Pull-Up',
  'Ściąganie drążka wyciąg': 'Wide-Grip Lat Pulldown',
  'Wiosłowanie wyciągiem siedząc': 'Seated Cable Rows',
  'Ściąganie do twarzy (face pull)': 'Face Pull',
  'Good morning (skłon)': 'Good Morning',
  'Prostowanie tułowia': 'Hyperextensions (Back Extensions)',
  'Odwrotne rozpiętki': 'Bent Over Dumbbell Rear Delt Raise With Head On Bench',
  'Wiosłowanie odwrócone': 'Inverted Row',
  'Wiosłowanie z oparciem klatki': 'Incline Bench Pull',
  'Podciąganie podchwytem': 'Chin-Up',
  'Wiosłowanie T-bar': 'T-Bar Row with Handle',
  'Wiosłowanie Meadowsa': 'One-Arm Dumbbell Row',
  'Wiosłowanie Pendlay': 'Bent Over Barbell Row',
  'Wiosłowanie seal': 'Lying T-Bar Row',
  'Ściąganie prostymi rękami': 'Straight-Arm Pulldown',
  'Ściąganie drążka wąskim chwytem': 'Close-Grip Front Lat Pulldown',
  'Unoszenie barków sztangą': 'Barbell Shrug',
  'Unoszenie barków hantlami': 'Dumbbell Shrug',
  'Ściąganie drążka jednorącz': 'One Arm Lat Pulldown',
  'Wyciskanie żołnierskie OHP': 'Standing Military Press',
  'Wyciskanie hantli siedząc': 'Seated Dumbbell Press',
  'Wyciskanie Arnolda': 'Arnold Dumbbell Press',
  'Unoszenie bokiem': 'Side Lateral Raise',
  'Unoszenie przodem': 'Front Dumbbell Raise',
  'Unoszenie wyciągiem bokiem': 'Cable Seated Lateral Raise',
  'Odwrotne rozpiętki maszyna': 'Cable Rear Delt Fly',
  'Rotacja zewnętrzna': 'External Rotation',
  'Wyciskanie z wybiciem': 'Push Press',
  'Wyciskanie kubańskie': 'Cuban Press',
  'Wyciskanie barków maszyna': 'Leverage Shoulder Press',
  'Wiosłowanie pionowe': 'Upright Barbell Row',
  'Unoszenie Y': 'Front Incline Dumbbell Raise',
  'Unoszenie bokiem na wyciągu jednorącz': 'One-Arm Side Laterals',
  'Unoszenie talerza przodem': 'Front Plate Raise',
  'Unoszenie bokiem landmine': 'Side Lateral Raise',
  'Uginanie biceps sztangą': 'Barbell Curl',
  'Uginanie młotkowe': 'Hammer Curls',
  'Uginanie hantlami naprzemiennie': 'Alternate Incline Dumbbell Curl',
  'Uginanie na wyciągu': 'Standing Biceps Cable Curl',
  'Uginanie spider': 'Spider Curl',
  'Uginanie Zottman': 'Zottman Curl',
  'Uginanie reverse': 'Reverse Barbell Curl',
  'Uginanie nadgarstka': 'Seated Palm-Up Barbell Wrist Curl',
  'Uginanie koncentryczne': 'Concentration Curls',
  'Uginanie na modlitewniku': 'Preacher Curl',
  'Uginanie na skosie': 'Incline Dumbbell Curl',
  'Uginanie Bayesian': 'Standing Biceps Cable Curl',
  'Uginanie drag': 'Drag Curl',
  '21-ki biceps': 'Barbell Curl',
  'Prostowanie tricepsa wyciąg': 'Triceps Pushdown',
  'Wyciskanie francuskie': 'Standing Overhead Barbell Triceps Extension',
  'Prostowanie za głowę (skull crusher)': 'Lying Triceps Press',
  'Kickback triceps': 'Tricep Dumbbell Kickback',
  'Prostowanie za głowę wyciąg': 'Cable Rope Overhead Triceps Extension',
  'Prostowanie linką': 'Triceps Pushdown - Rope Attachment',
  'Prostowanie jednorącz wyciąg': 'Cable One Arm Tricep Extension',
  'Prostowanie za głowę hantlem': 'Standing Dumbbell Triceps Extension',
  'Dipy na ławce': 'Bench Dips',
  'Dipy triceps (pionowe)': 'Parallel Bar Dip',
  'Wyciskanie JM': 'Close-Grip Barbell Bench Press',
  'Dipy triceps maszyna': 'Dips - Triceps Version',
  'Przysiad ze sztangą': 'Barbell Squat',
  'Przysiad Goblet': 'Goblet Squat',
  'Przysiad przedni': 'Front Barbell Squat',
  'Przysiad sumo': 'Sumo Deadlift',
  'Wyciskanie nogami': 'Leg Press',
  'Wykrok ze sztangą': 'Barbell Walking Lunge',
  'Przysiad bułgarski': 'Dumbbell Rear Lunge',
  'Wypychanie bioder (hip thrust)': 'Barbell Hip Thrust',
  'Mostek biodrowy': 'Butt Lift (Bridge)',
  'Rumuński martwy ciąg': 'Romanian Deadlift',
  'Uginanie nóg maszyna': 'Lying Leg Curls',
  'Wyprosty nóg maszyna': 'Leg Extensions',
  'Wspięcia na palce': 'Standing Calf Raises',
  'Wspięcia na palce jednonóż': 'Donkey Calf Raises',
  'Wejścia na skrzynię': 'Dumbbell Step Ups',
  'Martwy ciąg sumo': 'Sumo Deadlift',
  'Przysiad hack maszyna': 'Hack Squat',
  'Przysiad jednonóż (pistol)': 'Kettlebell Pistol Squat',
  'Przysiad na skrzynię': 'Box Squat',
  'RDL jednonóż': 'One-Legged Cable Kickback',
  'Uginanie nordyckie': 'Floor Glute-Ham Raise',
  'Przysiad przy ścianie': 'Linear Acceleration Wall Drill',
  'Martwy ciąg trap bar': 'Trap Bar Deadlift',
  'Kickback pośladki': 'Glute Kickback',
  'Abdukcja biodra maszyna': 'Thigh Abductor',
  'Wypychanie bioder jednonóż': 'Single Leg Glute Bridge',
  'Monster walk (chód)': 'Monster Walk',
  'Muszla (clamshell)': 'Glute Kickback',
  'Pull-through wyciąg': 'Pull Through',
  'Frog pump': 'Frog Hops',
  'Odwrócone prostowanie tułowia': 'Reverse Hyperextension',
  'Wejścia boczne na skrzynię': 'Side to Side Box Shuffle',
  'Wypychanie bioder z taśmą': 'Barbell Hip Thrust',
  'Prostowanie 45° pośladki': 'Hyperextensions (Back Extensions)',
  'Marsz w mostku': 'Flutter Kicks',
  'Deska': 'Plank',
  'Rollout z kółkiem': 'Barbell Ab Rollout',
  'Hollow hold': 'Hanging Pike',
  'Dragon flag': 'Hanging Pike',
  'Deska boczna': 'Side Bridge',
  'Martwy robak': 'Dead Bug',
  'Bird dog': 'Superman',
  'Brzuszki klasyczne': 'Crunches',
  'Zwisy nóg drążek': 'Hanging Leg Raise',
  'Skręty rosyjskie': 'Russian Twist',
  'Woodchop wyciąg': 'Standing Cable Wood Chop',
  'Wyciskanie Pallofa': 'Pallof Press',
  'Spacer farmera': "Farmer's Walk",
  'Unoszenie kolan w zwisie': 'Hanging Leg Raise',
  'Palce do drążka': 'Hanging Pike',
  'V-upy': 'Jackknife Sit-Up',
  'Zwisy na drążku': 'Scapular Pull-Up',
  'Burpees': 'Spider Crawl',
  'Mountain climbers': 'Mountain Climbers',
  'Skoki na skrzynię': 'Box Jump (Multiple Response)',
  'Przysiad z wyskokiem': 'Freehand Jump Squat',
  'Swing kettlebell': 'One-Arm Kettlebell Swings',
  'Turkish get-up': 'Kettlebell Turkish Get-Up (Lunge style)',
  'Pajacyki': 'Rope Jumping',
  'Wysokie kolana': 'Running, Treadmill',
  'Pięty do pośladków': 'Double Leg Butt Kick',
  'Gąsienica (inchworm)': 'Inchworm',
  'Chód niedźwiedzia': 'Bear Crawl Sled Drags',
  'Cat-cow (kot-krowa)': 'Cat Stretch',
  'Poza dziecka': "Child's Pose",
  'Pies z głową w dół': 'Downward Facing Balance',
  'Poza kobry': 'Superman',
  'Donkey kick': 'Glute Kickback',
  'Fire hydrant': 'Glute Kickback',
  'Mostek biodrowy — aktywacja': 'Butt Lift (Bridge)',
  'Wykrok boczny': 'Barbell Side Split Squat',
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
  const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
  const block = six.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
  const akaByPl = new Map();
  if (block) {
    for (const x of block[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)) {
      akaByPl.set(x[1], (x[2].match(/aka:'([^']+)'/) || [])[1] || '');
    }
  }
  function mediaKey(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  const prev = {};
  if (fs.existsSync(outFile)) {
    const src = fs.readFileSync(outFile, 'utf8');
    const m = src.match(/window\.EX_PHOTO_MANIFEST\s*=\s*(\{[\s\S]*\});/);
    if (m) Object.assign(prev, JSON.parse(m[1]));
  }
  const manifest = {};
  const missing = [];
  function addKeys(pl, url) {
    const labels = [pl];
    String(akaByPl.get(pl) || '')
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => labels.push(s));
    for (const label of labels) {
      const k = mediaKey(label);
      if (k && !manifest[k]) manifest[k] = url;
    }
  }
  for (const [pl, en] of Object.entries(ALIASES)) {
    const ex = byName.get(en.toLowerCase());
    if (!ex || !ex.images || !ex.images[0]) {
      missing.push(pl + ' -> ' + en);
      continue;
    }
    addKeys(pl, IMG_BASE + ex.images[0]);
  }
  for (const [k, url] of Object.entries(prev)) {
    if (!manifest[k]) manifest[k] = url;
  }
  const body =
    '/** Zdjęcia techniki (free-exercise-db / Unlicense). Generuj: node .github/scripts/build_ex_photo_manifest.js */\n' +
    'window.EX_PHOTO_MANIFEST=' +
    JSON.stringify(manifest, null, 2) +
    ';\n';
  fs.writeFileSync(outFile, body);
  console.log('Wrote', Object.keys(manifest).length, 'photos →', path.relative(root, outFile));
  if (missing.length) {
    console.warn('Unmatched aliases:', missing.length);
    missing.forEach((row) => console.warn(' ', row));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
