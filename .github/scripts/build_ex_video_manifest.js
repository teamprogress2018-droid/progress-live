#!/usr/bin/env node
/**
 * Mapuje MP4 z repo progress-live-video-assets na DEF_EX i zapisuje
 * ex-gif-manifest.js (URL-e jsDelivr, content-type video/mp4).
 *
 *   node .github/scripts/build_ex_video_manifest.js
 *
 * Filmy zostają w osobnym repo (~380 MB) — GitHub Pages aplikacji ich nie hostuje.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '../..');
const outFile = path.join(root, 'ex-gif-manifest.js');
const VIDEO_REPO = 'teamprogress2018-droid/progress-live-video-assets';
const VIDEO_OWNER_REPO = VIDEO_REPO;

/** PL nazwa DEF_EX → filtry na nazwę pliku (PL + EN). Dopasowanie ostrożne — bez zgadywania. */
const ALIASES = {
  'Wyciskanie sztangi leżąc': {
    include: [/barbell bench press/i],
    exclude: [/close[- ]?grip/i, /wąski/i, /smith/i, /incline/i, /decline/i],
  },
  'Wyciskanie hantli leżąc': {
    include: [/dumbbell bench press/i],
    exclude: [/incline/i, /sko[sś]n/i, /narrow/i, /wąsk/i, /shoulder/i, /nad głow/i],
  },
  'Wyciskanie hantli skos+': {
    include: [/incline dumbbell (chest )?press/i],
    exclude: [/shoulder/i, /nad głow/i, /decline/i],
  },
  'Rozpiętki hantlami': {
    include: [/dumbbell (chest )?fly/i, /dumbbell flat bench fly/i],
    exclude: [/decline/i, /głow[aą] w d[oó]ł/i, /lateral raise/i, /pec deck/i],
  },
  'Rozpiętki na wyciągu': {
    include: [/cable crossover/i, /high (pulley|cable) fly/i, /standing cable fly/i],
    exclude: [/reverse/i, /single[- ]arm/i, /low cable/i, /pec deck/i, /middle chest/i],
  },
  'Krzyżowanie wyciągów góra–dół': {
    include: [/cable crossover \(high/i, /high pulley fly/i, /high cable fly/i],
    exclude: [/reverse/i, /single[- ]arm/i, /low /i],
  },
  'Rozpiętki na wyciągu w poziomie': {
    include: [/cable crossover fly \(middle chest\)/i],
  },
  'Rozpiętki jednorącz wyciąg': {
    include: [/single[- ]arm low cable fly/i],
  },
  'Pompki': {
    include: [/push[- ]?ups?/i],
    exclude: [/wall/i, /dip/i, /poręcz/i, /ławc/i, /kolan/i, /pike/i],
  },
  'Dipy na poręczach': {
    include: [/parallel bar dips/i],
    exclude: [/bench dip/i, /ławc/i],
  },
  'Dipy na ławce': {
    include: [/bench dips/i],
    exclude: [/parallel bar/i],
  },
  'Butterfly (peck deck)': {
    include: [/pec deck/i, /machine chest fly/i],
    exclude: [/reverse/i, /odwróc/i, /rear delt/i],
  },
  'Wyciskanie wąskim chwytem': {
    include: [/close[- ]?grip barbell bench press/i],
  },
  'Pullover sztangą': {
    include: [/barbell pullover/i],
  },
  'Martwy ciąg klasyczny': {
    include: [/barbell deadlift/i],
    exclude: [/dumbbell/i, /sumo/i, /rdl/i, /straight[- ]leg/i, /bodyweight/i, /hantl/i],
  },
  'Podciąganie na drążku': {
    include: [/pull[- ]?up \(overhand/i],
    exclude: [/wide[- ]grip/i, /szerok/i, /australian/i, /chin/i],
  },
  'Podciąganie szerokim chwytem': {
    include: [/wide[- ]grip pull[- ]?up/i],
  },
  'Ściąganie drążka wyciąg': {
    include: [/lat pulldown/i],
    exclude: [/behind the neck/i, /kark/i, /za głow/i, /single[- ]arm/i, /jednor[aą]cz/i, /straight[- ]arm/i, /wide[- ]grip/i, /szerok/i],
    prefer: [/to chest/i, /overhand grip/i, /do klatki/i],
  },
  'Ściąganie drążka szerokim chwytem': {
    include: [/wide[- ]grip lat pulldown/i],
    exclude: [/behind the neck/i, /kark/i],
  },
  'Ściąganie drążka jednorącz': {
    include: [/single[- ]arm lat pulldown/i, /single[- ]arm cable pulldown/i],
    exclude: [/straight[- ]arm/i, /triceps/i],
  },
  'Ściąganie prostymi rękami': {
    include: [/straight[- ]arm pulldown/i],
    exclude: [/lat pulldown/i, /triceps/i, /one[- ]arm/i],
  },
  'Ściąganie do twarzy (face pull)': {
    include: [/face pull/i],
  },
  'Wiosłowanie sztangą': {
    include: [/barbell bent[- ]over row/i],
    exclude: [/underhand/i, /incline/i, /neutral grip/i, /dumbbell/i],
  },
  'Wiosłowanie hantlem': {
    include: [/one[- ]arm dumbbell row/i, /single[- ]arm dumbbell row/i],
    exclude: [/bent[- ]over row\)/i],
  },
  'Wiosłowanie hantlami oburącz': {
    include: [/dumbbell bent[- ]over row/i],
    exclude: [/one[- ]arm/i, /single[- ]arm/i, /rear delt/i, /jednor[aą]cz/i],
  },
  'Wiosłowanie wyciągiem siedząc': {
    include: [/seated cable row/i],
    exclude: [/machine/i, /maszynie/i],
  },
  'Wiosłowanie na maszynie': {
    include: [/seated cable row \(machine/i, /cable row machine/i, /machine row/i],
  },
  'Wiosłowanie odwrócone': {
    include: [/inverted row/i, /australian pull[- ]?up/i],
  },
  'Prostowanie tułowia': {
    include: [/hyperextension/i, /back extension/i],
    exclude: [/reverse hyper/i],
  },
  'Odwrotne rozpiętki': {
    include: [/dumbbell (bent[- ]over )?(rear delt fly|reverse fly)/i, /bent[- ]over dumbbell (rear delt fly|reverse fly)/i],
    exclude: [/cable/i, /machine/i, /pec deck/i, /seated/i, /prone/i, /siadzie/i],
  },
  'Odwrotne rozpiętki maszyna': {
    include: [/reverse pec deck/i, /rear delt machine fly/i],
  },
  'Odwrotne rozpiętki na wyciągu': {
    include: [/cable rear delt fly/i],
  },
  'Unoszenie bokiem w opadzie': {
    include: [/dumbbell bent[- ]over (lateral raise|rear delt fly)/i],
    exclude: [/cable/i],
  },
  'Unoszenie bokiem': {
    include: [/dumbbell lateral raise/i],
    exclude: [/bent[- ]over/i, /opadzie/i, /seated/i, /siadzie/i, /barbell/i, /sztang/i],
    prefer: [/w staniu/i, /standing/i],
  },
  'Wyciskanie hantli siedząc': {
    include: [/seated dumbbell (shoulder|overhead) press/i],
    exclude: [/single[- ]arm/i, /jednostronn/i, /incline/i, /arnold/i],
  },
  'Wyciskanie barków maszyna': {
    include: [/machine shoulder press/i],
  },
  'Wyciskanie hantla jednorącz nad głowę': {
    include: [/single[- ]arm seated dumbbell shoulder press/i],
  },
  'Uginanie biceps sztangą': {
    include: [/barbell bicep curl/i],
    exclude: [/preacher/i, /modlitewnik/i, /ez bar/i],
  },
  'Uginanie młotkowe': {
    include: [/dumbbell hammer curl/i],
    exclude: [/seated/i, /siedz/i, /preacher/i, /scott/i, /incline/i, /sko[sś]n/i],
  },
  'Uginanie hantlami naprzemiennie': {
    include: [/dumbbell bicep curl/i],
    exclude: [/hammer/i, /młotk/i, /preacher/i, /incline/i],
  },
  'Uginanie na wyciągu': {
    include: [/standing cable curl/i],
    exclude: [/high pulley/i, /górnym/i],
  },
  'Uginanie na modlitewniku': {
    include: [/preacher curl/i],
    exclude: [/hammer/i, /młotk/i, /incline/i],
  },
  'Uginanie na skosie': {
    include: [/incline dumbbell bicep curl/i],
  },
  'Prostowanie tricepsa wyciąg': {
    include: [/cable triceps? pushdown/i],
    exclude: [/one[- ]arm/i, /single[- ]arm/i, /jednor[aą]cz/i, /kickback/i, /overhead/i, /rope/i],
  },
  'Prostowanie jednorącz wyciąg': {
    include: [/single[- ]arm cable triceps pushdown/i, /one[- ]arm cable tricep/i],
  },
  'Kickback na wyciągu': {
    include: [/cable tricep kickback/i],
  },
  'Kickback triceps': {
    include: [/cable tricep kickback/i],
  },
  'Prostowanie za głowę hantlem': {
    include: [/dumbbell overhead triceps? extension/i],
    exclude: [/seated/i, /siedz/i],
  },
  'Wyciskanie francuskie': {
    include: [/seated dumbbell overhead tricep extension/i],
  },
  'Przysiad ze sztangą': {
    include: [/barbell back squat/i],
    exclude: [/smith/i, /suwnic/i, /wide stance/i, /szeroki/i, /sumo/i, /front squat/i, /karku/i],
  },
  'Przysiad w bramie Smith': {
    include: [/smith machine (barbell back )?squat/i],
  },
  'Przysiad sumo': {
    include: [/sumo squat/i, /wide stance squat/i],
    exclude: [/dumbbell/i, /hantel/i, /goblet/i, /barbell sumo squat \(front/i, /smith/i],
  },
  'Przysiad sumo z hantlem': {
    include: [/dumbbell sumo squat/i, /sumo (goblet )?squat with dumbbell/i],
  },
  'Przysiad Goblet': {
    include: [/dumbbell squat/i],
    exclude: [/sumo/i, /bulgarian/i],
  },
  'Przysiad bułgarski': {
    include: [/bulgarian split squat/i],
  },
  'Wyciskanie nogami': {
    include: [/leg press/i],
  },
  'Wykrok z hantlami': {
    include: [/dumbbell lunge/i],
    exclude: [/barbell/i, /step[- ]up/i, /bulgarian/i],
  },
  'Wykrok ze sztangą': {
    include: [/barbell lunge/i],
  },
  'Wyprosty nóg maszyna': {
    include: [/leg extension/i],
  },
  'Uginanie nóg maszyna': {
    include: [/lying leg curl/i],
  },
  'Uginanie nóg leżąc': {
    include: [/lying leg curl/i],
  },
  'Wspięcia na palce': {
    include: [/standing (dumbbell )?calf raise/i],
    exclude: [/band/i, /gum[aą]/i],
    prefer: [/dumbbell/i, /hantl/i],
  },
  'Wspięcia na palce stojąc': {
    include: [/standing dumbbell calf raise/i],
  },
  'Abdukcja biodra maszyna': {
    include: [/hip abduction machine/i],
    exclude: [/lying/i, /leż/i, /kickback/i],
    prefer: [/seated/i],
  },
  'Przywodzenie biodra maszyna': {
    include: [/hip adduction/i],
  },
  'Odwodzenie biodra leżąc': {
    include: [/side[- ]lying hip abduction/i],
    exclude: [/machine/i, /maszyn/i],
  },
  'Kickback na maszynie': {
    include: [/glute kickback/i],
  },
  'Kickback pośladki': {
    include: [/glute kickback/i],
  },
  'Mostek biodrowy': {
    include: [/glute bridge/i],
  },
  'Rollout z kółkiem': {
    include: [/ab wheel rollout/i],
  },
  'Nożyce': {
    include: [/scissor kicks/i],
    exclude: [/flutter/i],
  },
  'Unoszenie nóg leżąc': {
    include: [/lying leg raises/i],
    exclude: [/decline/i],
  },
  'Brzuszki rowerowe': {
    include: [/bicycle crunches/i],
  },
  'Skręty rosyjskie': {
    include: [/russian twist/i],
  },
};

function mediaKey(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function slug(name) {
  return mediaKey(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function gh(args) {
  return execSync('gh api ' + args, { encoding: 'utf8' }).trim();
}

function listMp4() {
  const json = gh(`"repos/${VIDEO_OWNER_REPO}/git/trees/main?recursive=1"`);
  const tree = JSON.parse(json).tree || [];
  return tree.filter((t) => t.type === 'blob' && /\.mp4$/i.test(t.path)).map((t) => t.path);
}

function headSha() {
  return gh(`repos/${VIDEO_OWNER_REPO}/commits/main --jq .sha`);
}

function dupPenalty(file) {
  const m = file.match(/\s*\((\d+)\)\.mp4$/i);
  return m ? Number(m[1]) * 8 : 0;
}

function pickFile(files, spec) {
  const include = [].concat(spec.include || []);
  const exclude = [].concat(spec.exclude || []);
  const prefer = [].concat(spec.prefer || []);
  const scored = [];
  for (const file of files) {
    if (!include.some((re) => re.test(file))) continue;
    if (exclude.some((re) => re.test(file))) continue;
    let score = 100 - dupPenalty(file) - file.length * 0.02;
    if (prefer.some((re) => re.test(file))) score += 25;
    scored.push({ file, score });
  }
  scored.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file, 'pl'));
  return scored[0] ? scored[0].file : null;
}

function parseDefEx() {
  const src = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
  const m = src.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
  if (!m) throw new Error('Nie znaleziono DEF_EX');
  return [...m[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)].map((x) => {
    const aka = (x[2].match(/aka:'([^']+)'/) || [])[1] || '';
    return { name: x[1], aka };
  });
}

function videoUrl(sha, file) {
  return 'https://cdn.jsdelivr.net/gh/' + VIDEO_REPO + '@' + sha + '/' + encodeURIComponent(file);
}

function addKeys(manifest, ex, url) {
  const keys = new Set();
  const add = (s) => {
    const k = mediaKey(s);
    if (k) keys.add(k);
    const sl = slug(s);
    if (sl) keys.add(sl);
  };
  add(ex.name);
  String(ex.aka || '')
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(add);
  for (const k of keys) manifest[k] = url;
}

function main() {
  const files = listMp4();
  const sha = headSha();
  const exercises = parseDefEx();
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const manifest = {};
  const matched = [];
  const missing = [];
  const usedFiles = new Set();

  for (const [name, spec] of Object.entries(ALIASES)) {
    const ex = byName.get(name);
    if (!ex) {
      missing.push(name + ' (brak w DEF_EX)');
      continue;
    }
    const file = pickFile(files, spec);
    if (!file) {
      missing.push(name);
      continue;
    }
    usedFiles.add(file);
    addKeys(manifest, ex, videoUrl(sha, file));
    matched.push({ name, file });
  }

  const unused = files.filter((f) => !usedFiles.has(f) && !/\(\d+\)\.mp4$/i.test(f));
  const body =
    '/** Filmy techniki (progress-live-video-assets @ ' +
    sha.slice(0, 12) +
    '). Generuj: node .github/scripts/build_ex_video_manifest.js */\n' +
    'window.EX_GIF_MANIFEST=' +
    JSON.stringify(manifest, null, 2) +
    ';\n';
  fs.writeFileSync(outFile, body);

  console.log('Zapisano', path.relative(root, outFile));
  console.log('Ćwiczeń z filmem:', matched.length);
  matched.forEach((m) => console.log('  OK  ', m.name, '←', m.file));
  if (missing.length) {
    console.log('\nBez filmu (alias):', missing.length);
    missing.forEach((n) => console.log('  --  ', n));
  }
  console.log('\nNieużyte pliki (bez kopii (2)/(3)):', unused.length);
  unused.forEach((f) => console.log('  ..  ', f));
}

main();
