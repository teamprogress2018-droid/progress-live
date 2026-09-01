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
  'Podciąganie neutralnym chwytem': 'V-Bar Pullup',
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
  'Wiosłowanie Meadowsa': 'Bent Over One-Arm Long Bar Row',
  'Wiosłowanie Pendlay': 'Bent Over Barbell Row',
  'Wiosłowanie seal': 'Lying T-Bar Row',
  'Ściąganie prostymi rękami': 'Straight-Arm Pulldown',
  'Ściąganie drążka wąskim chwytem': 'Close-Grip Front Lat Pulldown',
  'Unoszenie barków sztangą': 'Barbell Shrug',
  'Unoszenie barków hantlami': 'Dumbbell Shrug',
  'Ściąganie drążka jednorącz': 'One Arm Lat Pulldown',
  'Podciąganie szerokim chwytem': 'Wide-Grip Rear Pull-Up',
  'Podciąganie z gumą': 'Band Assisted Pull-Up',
  'Negatywy podciągania': 'Pullups',
  'Ściąganie drążka szerokim chwytem': 'Wide-Grip Lat Pulldown',
  'Ściąganie drążka podchwytem': 'Underhand Cable Pulldowns',
  'Wiosłowanie wyciągiem jednorącz': 'Seated One-arm Cable Pulley Rows',
  'Wiosłowanie hantlami oburącz': 'Bent Over Two-Dumbbell Row',
  'Wiosłowanie na maszynie': 'Leverage Iso Row',
  'Ciąg z racka': 'Rack Pulls',
  'Martwy ciąg z deficytu': 'Deficit Deadlift',
  'Martwy ciąg chwyt rwaniowy': 'Snatch Deadlift',
  'Unoszenie barków na maszynie': 'Leverage Shrug',
  'Superman': 'Superman',
  'Wiosłowanie Yatesa': 'Reverse Grip Bent-Over Rows',
  'Wiosłowanie Kroc': 'One-Arm Dumbbell Row',
  'Wiosłowanie kettlebell': 'One-Arm Kettlebell Row',
  'Wiosłowanie TRX': 'Inverted Row with Straps',
  'Podciągnięcie z wyjściem (muscle-up)': 'Muscle Up',
  'Wiosłowanie na kółkach': 'Suspended Row',
  'Wiosłowanie landmine jednorącz': 'One-Arm Long Bar Row',
  'Wiosłowanie landmine split stance': 'Bent Over One-Arm Long Bar Row',
  'Rozciąganie taśmy klęcząc': 'Band Pull Apart',
  'Rozciąganie taśmy w opadzie': 'Back Flyes - With Bands',
  'Wiosłowanie z taśmą siedząc': 'Seated Cable Rows',
  'Ściąganie taśmy klęcząc': 'Kneeling High Pulley Row',
  'Face pull do Y z taśmą': 'Face Pull',
  'Rozciąganie taśmy': 'Band Pull Apart',
  'Rozciąganie taśmy combo': 'Band Pull Apart',
  'Odwrotne rozpiętki TRX': 'Back Flyes - With Bands',
  'Wiosłowanie TRX z ugiętymi kolanami': 'Inverted Row with Straps',
  'Wiosłowanie TRX wąsko': 'Inverted Row with Straps',
  'Wiosłowanie TRX superhero jednorącz': 'Inverted Row with Straps',
  'Aktywny zwis na kółkach': 'Scapular Pull-Up',
  'Wiosłowanie superhero na kółkach jednorącz': 'Suspended Row',
  'Podciąganie łopatkowe na kółkach': 'Scapular Pull-Up',
  'Podciąganie podchwytem na kółkach (ekscentryka)': 'Chin-Up',
  'Prostowanie tułowia na piłce swiss': 'Weighted Ball Hyperextension',
  'RDL do wiosłowania dwa KB': 'Two-Arm Kettlebell Row',
  'Unoszenie barków KB': 'Dumbbell Shrug',
  'Wiosłowanie w rozkroku KB jednorącz': 'One-Arm Kettlebell Row',
  'Wiosłowanie gorilla KB': 'Alternating Kettlebell Row',
  'Drop and catch hantle w opadzie': 'Bent Over Two-Dumbbell Row',
  'Wiosłowanie renegade z pompkami': 'Alternating Renegade Row',
  'Good morning więzienny': 'Good Morning',
  'Hip hinge z taśmą': 'Band Good Morning',
  'RDL dwa hantle do wiosłowania': 'Stiff-Legged Dumbbell Deadlift',
  'Wiosłowanie z taśmą w opadzie': 'Bent Over Two-Dumbbell Row',
  'Face pull z taśmą klęcząc': 'Face Pull',
  'Face pull do rotacji zewnętrznej z taśmą': 'Face Pull',
  'Back widow': 'Superman',
  'Wiosłowanie odwrócone ze skrzynią': 'Inverted Row',
  'Wiosłowanie odwrócone nogi w górze': 'Inverted Row',
  'Wiosłowanie odwrócone podchwytem': 'Inverted Row',
  'Unoszenie tułowia leżąc (prone)': 'Hyperextensions With No Hyperextension Bench',
  'Wiosłowanie z taśmą (warianty chwytu)': 'Face Pull',
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

function normPhotoKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const CAT_DEFAULT = {
  'Barki': 'Standing Military Press',
  'Biceps': 'Barbell Curl',
  'Triceps': 'Triceps Pushdown',
  'Nogi': 'Barbell Squat',
  'Pośladki': 'Barbell Hip Thrust',
  'Core': 'Plank',
  'Cardio': 'Running, Treadmill',
  'Mobilność': "World's Greatest Stretch",
  'Rozciąganie': 'Hamstring Stretch',
  'Rozgrzewka': 'Arm Circles',
  'Olimpijskie': 'Clean',
  'Klatka piersiowa': 'Barbell Bench Press - Medium Grip',
  'Plecy': 'Bent Over Barbell Row',
};

/** Najbliższy uczciwy still FEDB, gdy nie ma dokładnego aliasu. Kolejność: konkretne przed ogólnymi. */
function pickFedbName(pl, aka, cat, byNorm) {
  const labels = [pl].concat(String(aka || '').split(/[,;/|]/).map((s) => s.trim()).filter(Boolean));
  for (const lab of labels) {
    const n = normPhotoKey(lab);
    if (n && byNorm.has(n)) return byNorm.get(n);
  }
  const blob = normPhotoKey(pl + ' ' + aka + ' ' + cat);
  const t = (re) => re.test(blob);

  if (t(/foam roll| smr |^smr |barbell smr/)) {
    if (t(/stopa|foot|plantar/)) return 'Foot-SMR';
    if (t(/piszczel|tibialis/)) return 'Anterior Tibialis-SMR';
    if (t(/it band|pasmo/)) return 'Iliotibial Tract-SMR';
    if (t(/lydk|calf/)) return 'Calves-SMR';
    if (t(/czwor|quad/)) return 'Quadriceps-SMR';
    if (t(/dwuglow|hamstring/)) return 'Hamstring-SMR';
    if (t(/przywodz|adductor/)) return 'Adductor/Groin';
    if (t(/poslad|glute|piriformis/)) return 'Piriformis-SMR';
    if (t(/ledzw|lumbar/)) return 'Lower Back-SMR';
    if (t(/najszersz|latissimus|\blat\b/)) return 'Latissimus Dorsi-SMR';
    if (t(/szyj|neck/)) return 'Neck-SMR';
    if (t(/klatk|chest/)) return 'Chest And Front Of Shoulder Stretch';
    if (t(/peroneal/)) return 'Peroneals-SMR';
    return 'Rhomboids-SMR';
  }

  if (t(/butterfly stretch|rozciaganie butterfly/)) return 'Intermediate Groin Stretch';
  if (t(/peck deck|pec deck|butterfly/)) return 'Butterfly';
  if (t(/pigeon|golebi/)) return 'IT Band and Glute Stretch';
  if (t(/figure 4|figure-4|ankle on the knee/)) return 'Ankle On The Knee';
  if (t(/lizard|jaszczurk/)) return 'Intermediate Hip Flexor and Quad Stretch';
  if (t(/frog stretch|rozciaganie zaba|zaba na lokc/)) return 'Intermediate Groin Stretch';
  if (t(/child|poza dziecka/)) return "Child's Pose";
  if (t(/cobra|poza kobry/)) return 'Superman';
  if (t(/downward|pies z glowa|plank to downward/)) return 'Downward Facing Balance';
  if (t(/cat cow|cat stretch|kot-krowa/)) return 'Cat Stretch';
  if (t(/sleeper/)) return 'Shoulder Stretch';
  if (t(/doorway|framudze|cross body shoulder|barku przez klatke/)) return 'Chest And Front Of Shoulder Stretch';
  if (t(/side neck|szyi bokiem|neck stretch/)) return 'Side Neck Stretch';
  if (t(/seated forward|sklon siedz|sklon do nog siedz|do stop/)) return 'Seated Floor Hamstring Stretch';
  if (t(/supine twist|skret lezac|iron cross/)) return 'Iron Crosses (stretch)';
  if (t(/straddle|rozkrok|pancake|lucznik w rozkrok/)) return 'The Straddle';
  if (t(/couch stretch|hip flexor|zginacz.*biod|biodrowo-ledzwi/)) return 'Kneeling Hip Flexor';
  if (t(/quad stretch|czworoglodowego|czworoglowego stoj/)) return 'Standing Elevated Quad Stretch';
  if (t(/calf stretch|rozciaganie lydek|achill/)) return 'Calf Stretch Hands Against Wall';
  if (t(/world.?s greatest| wgs |spiderman stretch/)) return "World's Greatest Stretch";
  if (t(/90 90|biodra 90/)) return '90/90 Hamstring';
  if (t(/thread the needle|nitka w igle/)) return 'Middle Back Stretch';
  if (t(/open book|bretzel|thoracic|rotacja piersiowa/)) return 'Spinal Stretch';
  if (t(/toy soldier/)) return 'Hamstring Stretch';
  if (t(/leg swing.*bok|machy noga bokiem/)) return 'Side Leg Raises';
  if (t(/leg swing|machy noga/)) return 'Front Leg Raises';
  if (t(/arm circle|kolka ramion/)) return 'Arm Circles';
  if (t(/hip circle|kolka biodr/)) return 'Standing Hip Circles';
  if (t(/ankle circle|kolka stawem skokowym/)) return 'Ankle Circles';
  if (t(/shoulder circle|krazenia bark/)) return 'Shoulder Circles';
  if (t(/a-skip|b-skip|skip a|skip c|skip /)) return 'Box Skip';
  if (t(/lateral shuffle|przesuw boczny/)) return 'Side to Side Box Shuffle';
  if (t(/bear crawl|chod niedzwiedzia/)) return 'Bear Crawl Sled Drags';
  if (t(/inchworm|gasienica/)) return 'Inchworm';
  if (t(/deep squat|glebo(kie|ki) kucniecie|przysiad glebok/)) return 'Goblet Squat';
  if (t(/ankle|stawu skokowego|dorsiflex|plantar fascia/)) return 'Ankle Circles';
  if (t(/cars biodra|hip cars/)) return 'Standing Hip Circles';
  if (t(/hamstring stretch|dwuglow/)) return 'Hamstring Stretch';
  if (t(/glute stretch|posladka lezac|knee hug/)) return 'IT Band and Glute Stretch';
  if (t(/hip internal|rotacja wewnetrzna biodra/)) return '90/90 Hamstring';
  if (t(/hip external|rotacja zewnetrzna biodra/)) return '90/90 Hamstring';
  if (t(/cossack/)) return 'Barbell Side Split Squat';
  if (t(/skater stretch|lyzwiarza/)) return 'Barbell Side Split Squat';

  if (t(/power clean|zarzut silowy/)) return 'Power Clean';
  if (t(/hang clean|zarzut z hang/)) return 'Hang Clean';
  if (t(/clean and jerk|zarzut i podrzut/)) return 'Clean and Jerk';
  if (t(/power snatch|rwanie silowe/)) return 'Power Snatch';
  if (t(/snatch pull|ciag rwaniowy|high pull/)) return 'Snatch Pull';
  if (t(/\bsnatch\b|rwanie/)) return 'Snatch';
  if (t(/push jerk|pchanie sztangi/)) return 'Power Jerk';
  if (t(/split jerk|podrzut/)) return 'Split Jerk';
  if (t(/\bclean\b|zarzut/)) return 'Clean';
  if (t(/thruster/)) return 'Kettlebell Thruster';

  if (t(/airbike|air bike|assault|echo bike|fan bike/)) return 'Air Bike';
  if (t(/recumbent|rower poziomy/)) return 'Recumbent Bike';
  if (t(/elliptical|orbitrek|eliptyk|crosstrainer/)) return 'Elliptical Trainer';
  if (t(/row(ing|er)|wioslarz|concept2|ergometr wios/)) return 'Rowing, Stationary';
  if (t(/stair|schody|stepper|stairmaster/)) return 'Stairmaster';
  if (t(/treadmill|bieznia/)) return 'Running, Treadmill';
  if (t(/walking|marsz|spacer/)) return 'Walking, Treadmill';
  if (t(/jog|bieganie w miejscu|bieg w miejscu/)) return 'Jogging, Treadmill';
  if (t(/\brun\b|running|bieganie|\bbieg\b/)) return 'Running, Treadmill';
  if (t(/skakanka|jump rope|rope jumping|skipping/)) return 'Rope Jumping';
  if (t(/battle rope|liny treningowe|liny battle/)) return 'Battling Ropes';
  if (t(/ski.?erg|narty|ergometr narci/)) return 'Rowing, Stationary';
  if (t(/sled push|pchanie san|prowler/)) return 'Sled Push';
  if (t(/sled (pull|drag)|ciag san/)) return 'Sled Drag - Harness';
  if (t(/overhead slam|slam|rzut pilka o podloge|rzut pilka znad/)) return 'Overhead Slam';
  if (t(/chest pass|rzut pilka z klatki|rzut z klatki/)) return 'Medicine Ball Chest Pass';
  if (t(/wall ball|rzut pilka o sciane/)) return 'Medicine Ball Chest Pass';
  if (t(/medicine ball scoop|underhand|podchwyt/)) return 'Medicine Ball Scoop Throw';
  if (t(/backward.*throw|rzut pilka w tyl/)) return 'Backward Medicine Ball Throw';
  if (t(/rotational|rzut pilka rot|woodchop throw|side toss|rzut pilka w bok|hip throw/)) return 'Medicine Ball Full Twist';
  if (t(/sit-up throw|rzut pilka z brzuszk/)) return 'Sit-Up';
  if (t(/partner toss|rzut pilka do partnera/)) return 'Medicine Ball Chest Pass';
  if (t(/one-arm throw|jednoracz|shot put/)) return 'Standing Two-Arm Overhead Throw';
  if (t(/lunge to throw|rzut pilka z wykr/)) return 'Medicine Ball Chest Pass';
  if (t(/broad jump|skok w dal/)) return 'Standing Long Jump';
  if (t(/tuck jump|skok skupiony/)) return 'Knee Tuck Jump';
  if (t(/skater|lyzwiarsk/)) return 'Lateral Bound';
  if (t(/jumping lunge|wypady z wyskokiem|split jump/)) return 'Split Jump';
  if (t(/box jump|skoki na skrzynie/)) return 'Box Jump (Multiple Response)';
  if (t(/burpee|sprawl|man maker|devil press/)) return 'Spider Crawl';
  if (t(/mountain climber/)) return 'Mountain Climbers';
  if (t(/kettlebell snatch|rwanie kettlebell/)) return 'One-Arm Kettlebell Snatch';
  if (t(/kettlebell clean|zarzut kettlebell/)) return 'Kettlebell Dead Clean';
  if (t(/kb swing|swing kettlebell|swing high pull/)) return 'One-Arm Kettlebell Swings';
  if (t(/box step|wejscia|zejsc/)) return 'Dumbbell Step Ups';
  if (t(/reactive jump|drop jump|squat jump|przysiad z wyskokiem|split stance reactive/)) return 'Freehand Jump Squat';
  if (t(/bike|rower|cycling|spinning/)) return 'Recumbent Bike';

  if (t(/z press/)) return 'Seated Barbell Military Press';
  if (t(/seated barbell press|wyciskanie sztangi siedz/)) return 'Seated Barbell Military Press';
  if (t(/one-arm|jednoracz|single arm/) && t(/press|wyciskanie/) && t(/hant|dumbbell|db |kb |kettle/)) return 'Dumbbell One-Arm Shoulder Press';
  if (t(/standing dumbbell press|wyciskanie hantli stoj/)) return 'Dumbbell Shoulder Press';
  if (t(/machine lateral|unoszenie bokiem na maszynie/)) return 'Seated Side Lateral Raise';
  if (t(/cable front raise|unoszenie przodem na wyciagu/)) return 'Front Cable Raise';
  if (t(/cable reverse fly|odwrotne rozpietki na wyciagu|rear delt cable/)) return 'Cable Rear Delt Fly';
  if (t(/cable external|rotacja zewnetrzna na wyciagu/)) return 'External Rotation with Cable';
  if (t(/internal rotation|rotacja wewnetrzna barku/)) return 'Cable Internal Rotation';
  if (t(/bent-over lateral|unoszenie bokiem w opadzie|rear delt raise/)) return 'Dumbbell Lying Rear Lateral Raise';
  if (t(/lu raise/)) return 'Front Incline Dumbbell Raise';
  if (t(/handstand|hspu|pompki w staniu/)) return 'Handstand Push-Ups';
  if (t(/pike push/)) return 'Handstand Push-Ups';
  if (t(/kb halo|kettlebell halo|okraznie kettlebell/)) return 'Around The Worlds';
  if (t(/kettlebell press|wyciskanie kettlebell/)) return 'Alternating Kettlebell Press';
  if (t(/landmine/) && t(/press|wyciskanie|push press/)) return 'Landmine Linear Jammer';
  if (t(/landmine/) && t(/rotat|rainbow|zewnetrzna/)) return 'Landmine 180\'s';
  if (t(/y trx|unoszenie y trx/)) return 'Front Incline Dumbbell Raise';
  if (t(/band/) && t(/press|wyciskanie/)) return 'Shoulder Press - With Bands';
  if (t(/band/) && t(/external|zewnetrzna/)) return 'External Rotation with Band';
  if (t(/band/) && t(/internal|wewnetrzna/)) return 'Internal Rotation with Band';

  if (t(/ez bar|ez-bar|gryfem lamanym/)) return 'EZ-Bar Curl';
  if (t(/machine curl|uginanie na maszynie|preacher machine/)) return 'Machine Preacher Curls';
  if (t(/incline hammer/)) return 'Preacher Hammer Dumbbell Curl';
  if (t(/cross-body|cross body|w poprzek/)) return 'Cross Body Hammer Curl';
  if (t(/cable hammer|rope hammer|mlotkowe na wyciagu|rope curl|z linka/)) return 'Cable Hammer Curls - Rope Attachment';
  if (t(/wrist extension|prostowanie nadgarstka/)) return 'Palms-Down Wrist Curl Over A Bench';
  if (t(/ring/) && t(/bicep|uginanie/)) return 'Barbell Curl';
  if (t(/tate press/)) return 'Tate Press';
  if (t(/machine triceps/)) return 'Machine Triceps Extension';
  if (t(/smith/) && t(/close.?grip|waskim/)) return 'Smith Machine Close-Grip Bench Press';
  if (t(/cable kickback|kickback na wyciagu/)) return 'Tricep Dumbbell Kickback';
  if (t(/skull|za glowe hantl|prostowanie na drazku|floor triceps/)) return 'Lying Dumbbell Tricep Extension';
  if (t(/band/) && t(/tricep|triceps/)) return 'Band Skull Crusher';
  if (t(/overhead.*hantl|za glowe hantlami/)) return 'Lying Dumbbell Tricep Extension';

  if (t(/smith/) && t(/squat|przysiad/)) return 'Smith Machine Squat';
  if (t(/sissy/)) return 'Weighted Sissy Squat';
  if (t(/zercher/)) return 'Zercher Squats';
  if (t(/seated leg curl|uginanie nog siedz/)) return 'Seated Leg Curl';
  if (t(/lying leg curl|uginanie nog lezac/)) return 'Lying Leg Curls';
  if (t(/seated calf|wspiecia na palce siedz/)) return 'Seated Calf Raise';
  if (t(/standing calf|wspiecia na palce stoj/)) return 'Standing Calf Raises';
  if (t(/single.?leg calf|jednonoz hantlem/) && t(/calf|palce/)) return 'Dumbbell Seated One-Leg Calf Raise';
  if (t(/thigh adductor|przywodzenie biodra maszyna|adductor machine/)) return 'Thigh Adductor';
  if (t(/cable hip adduction|przywodzenie.*tasm|soccer adduction/)) return 'Cable Hip Adduction';
  if (t(/belt squat|przysiad z pasem/)) return 'Hack Squat';
  if (t(/reverse nordic/)) return 'Natural Glute Ham Raise';
  if (t(/single.?leg press|wyciskanie nogami jednonoz/)) return 'Narrow Stance Leg Press';
  if (t(/single.?leg extension|wyprosty nog jednonoz/)) return 'Single-Leg Leg Extension';
  if (t(/stiff.?leg|sldl|na sztywnych nogach/)) return 'Stiff-Legged Barbell Deadlift';
  if (t(/walking lunge|wykrok chodzony/)) return 'Barbell Walking Lunge';
  if (t(/reverse lunge|wykrok wstecz|zakrok/)) return 'Crossover Reverse Lunge';
  if (t(/dumbbell lunge|wykrok z hantlami/)) return 'Dumbbell Lunges';
  if (t(/split squat|przysiad w wykroku|bulgarski|rfe /)) return 'Split Squat with Dumbbells';
  if (t(/heels.?elevated|piętami na podwyzszeniu|pietach na podwyzszeniu|cyclist/)) return 'Barbell Squat';
  if (t(/kettlebell deadlift|martwy ciag kettlebell/)) return 'Kettlebell One-Legged Deadlift';
  if (t(/trx/) && t(/pistol/)) return 'Kettlebell Pistol Squat';
  if (t(/trx/) && t(/hamstring|uginanie ud/)) return 'Seated Band Hamstring Curl';
  if (t(/trx/) && t(/lunge|wykrok|split|bulgarski|lyzwiarski/)) return 'Suspended Split Squat';
  if (t(/trx/) && t(/squat|przysiad/)) return 'Goblet Squat';
  if (t(/slider|slizg/) && t(/hamstring|uginanie ud/)) return 'Platform Hamstring Slides';
  if (t(/slider|slizg/) && t(/lunge|wykrok/)) return 'Barbell Side Split Squat';
  if (t(/swiss|exercise ball|pilce swiss/) && t(/hamstring|uginanie ud|mostek izometryczny/)) return 'Ball Leg Curl';
  if (t(/swiss/) && t(/wall sit|przysiad.*scian/)) return 'Barbell Squat';
  if (t(/swiss/) && t(/groin|przywodz/)) return 'Adductor/Groin';
  if (t(/goblet/)) return 'Goblet Squat';
  if (t(/box squat|na skrzynie/) && t(/przysiad/)) return 'Box Squat';
  if (t(/front squat|w racku/) && t(/przysiad|squat/)) return 'Front Barbell Squat';
  if (t(/curtsy/)) return 'Crossover Reverse Lunge';
  if (t(/\brdl\b|rumunski|martwy ciag/) && t(/jednonoz|single leg/)) return 'Kettlebell One-Legged Deadlift';
  if (t(/\brdl\b|stiff|rumunski/)) return 'Romanian Deadlift';
  if (t(/deadlift|martwy ciag/)) return 'Barbell Deadlift';
  if (t(/wall sit|przysiad przy scianie/)) return 'Barbell Squat';
  if (t(/prisoner|zombie|low bar|1\/2|1\/4|1 2 |quarter|half back/)) return 'Barbell Squat';
  if (t(/pistol|jednonoz/) && t(/przysiad|squat/)) return 'Kettlebell Pistol Squat';
  if (t(/lunge|wykrok/)) return 'Dumbbell Lunges';
  if (t(/calf|wspiecia na palce/)) return 'Standing Calf Raises';
  if (t(/leg curl|uginanie (nog|ud)/)) return 'Lying Leg Curls';
  if (t(/air squat|przysiad powietrzny/)) return 'Freehand Jump Squat';

  if (t(/machine hip thrust|wypychanie bioder na maszynie/)) return 'Barbell Hip Thrust';
  if (t(/b-stance|b stance/)) return 'Barbell Hip Thrust';
  if (t(/kas |mostek kas/)) return 'Butt Lift (Bridge)';
  if (t(/cable hip abduct|odwodzenie biodra na wyciagu/)) return 'Thigh Abductor';
  if (t(/side-lying hip abduct|odwodzenie biodra lezac/)) return 'Side Leg Raises';
  if (t(/glute kickback machine|kickback na maszynie/)) return 'Glute Kickback';
  if (t(/ghd|hip extension/)) return 'Hyperextensions (Back Extensions)';
  if (t(/monster walk/)) return 'Monster Walk';
  if (t(/donkey kick/)) return 'Glute Kickback';
  if (t(/clamshell|muszla/)) return 'Glute Kickback';
  if (t(/hip thrust|wypychanie bioder/)) return 'Barbell Hip Thrust';
  if (t(/glute bridge|mostek/)) return 'Butt Lift (Bridge)';
  if (t(/abduct|odwodzenie/)) return 'Thigh Abductor';
  if (t(/hip lift|unoszenie biodra/)) return 'Hip Lift with Band';

  if (t(/ab crunch machine|brzuszki na maszynie/)) return 'Ab Crunch Machine';
  if (t(/bicycle|brzuszki rowerowe/)) return 'Cross-Body Crunch';
  if (t(/reverse crunch|brzuszki odwrotne/)) return 'Reverse Crunch';
  if (t(/flutter|noz[yż]ce/)) return 'Flutter Kicks';
  if (t(/lying leg raise|unoszenie nog lezac/)) return 'Flat Bench Lying Leg Raise';
  if (t(/copenhagen/)) return 'Side Bridge';
  if (t(/shoulder tap|deska z unoszeniem ramienia|plank toe/)) return 'Plank';
  if (t(/suitcase carry|spacer walizkowy/)) return 'Farmer\'s Walk';
  if (t(/waiter|overhead carry|spacer kelnera|ciezarem nad glowa/)) return 'Farmer\'s Walk';
  if (t(/cable crunch|brzuszki na wyciagu/)) return 'Cable Crunch';
  if (t(/hollow/)) return 'Hanging Pike';
  if (t(/side bend|sklony boczne/)) return 'Dumbbell Side Bend';
  if (t(/landmine/) && t(/rotat|rainbow|skret/)) return 'Landmine 180\'s';
  if (t(/windmill|wiatrak/)) return 'Kettlebell Windmill';
  if (t(/l-sit|siad w l/)) return 'Hanging Pike';
  if (t(/trx pike|pike na tasm|pike na pilce|jackknife/)) return 'Jackknife Sit-Up';
  if (t(/trx twist|skret trx/)) return 'Russian Twist';
  if (t(/pallof/)) return 'Pallof Press';
  if (t(/dead bug|martwy robak/)) return 'Dead Bug';
  if (t(/rollout|body saw|stir the pot|mieszanie garnka/)) return 'Barbell Ab Rollout';
  if (t(/swiss ball crunch|brzuszki na pilce/)) return 'Exercise Ball Crunch';
  if (t(/russian twist|skrety rosyjskie/)) return 'Russian Twist';
  if (t(/woodchop|siekanie/)) return 'Standing Cable Wood Chop';
  if (t(/side plank|deska boczna/)) return 'Side Bridge';
  if (t(/plank|deska/)) return 'Plank';
  if (t(/crunch|brzuszki|sit-up|siad/)) return 'Crunches';
  if (t(/rotation|rotacja|twist|skret/)) return 'Russian Twist';
  if (t(/farmer|spacer farmera|carry|chod boczny/)) return 'Farmer\'s Walk';

  return CAT_DEFAULT[cat] || 'Plank';
}

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
  const defList = [];
  if (block) {
    for (const x of block[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)) {
      const pl = x[1];
      const rest = x[2];
      const aka = (rest.match(/aka:'([^']+)'/) || [])[1] || '';
      akaByPl.set(pl, aka);
      defList.push({
        name: pl,
        aka,
        cat: (rest.match(/cat:'([^']+)'/) || [])[1] || '',
      });
    }
  }
  const byNorm = new Map();
  for (const e of fedb) {
    if (!e.images || !e.images[0]) continue;
    const n = normPhotoKey(e.name);
    if (n && !byNorm.has(n)) byNorm.set(n, e.name);
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
  for (const row of defList) {
    const k = mediaKey(row.name);
    if (manifest[k]) continue;
    const en = pickFedbName(row.name, row.aka, row.cat, byNorm);
    const ex = byName.get(String(en || '').toLowerCase());
    if (!ex || !ex.images || !ex.images[0]) {
      missing.push(row.name + ' -> ' + en);
      continue;
    }
    addKeys(row.name, IMG_BASE + ex.images[0]);
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
