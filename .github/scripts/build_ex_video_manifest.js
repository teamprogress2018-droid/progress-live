#!/usr/bin/env node
/**
 * Mapuje MP4 z repo progress-live-video-assets na DEF_EX i zapisuje
 * ex-gif-manifest.js (URL-e jsDelivr, content-type video/mp4).
 *
 *   node .github/scripts/build_ex_video_manifest.js
 *
 * Filmy zostają w osobnym repo (~380 MB) — GitHub Pages aplikacji ich nie hostuje.
 * Aliasów i scorera używa ten sam kod co import w aplikacji (01-core.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const root = path.join(__dirname, '../..');
const outFile = path.join(root, 'ex-gif-manifest.js');
const VIDEO_REPO = 'teamprogress2018-droid/progress-live-video-assets';
const VIDEO_OWNER_REPO = VIDEO_REPO;

function loadCore() {
  const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const windowObj = {
    addEventListener() {},
    CL: [],
    EX: [],
    DEF_EX: [],
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
  return ctx;
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

function filesHas(files, name) {
  const base = String(name).split('/').pop();
  return files.some((f) => f === name || String(f).split('/').pop() === base);
}

function addKeys(ctx, manifest, ex, url, force) {
  const keys = new Set();
  const add = (s) => {
    const k = ctx.exerciseMediaKey(s);
    if (k) keys.add(k);
    const sl = ctx.exerciseSlug(s);
    if (sl) keys.add(sl);
  };
  add(ex.name);
  String(ex.aka || '')
    .split(/[,;/|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(add);
  for (const k of keys) {
    if (force || !manifest[k]) manifest[k] = url;
  }
}

function pickBestAliasFile(ctx, files, spec, usedFiles) {
  let best = null;
  for (const file of files) {
    if (usedFiles.has(file)) continue;
    if (ctx.isKnownLyingMediaFilename && ctx.isKnownLyingMediaFilename(file)) continue;
    const parsed = ctx.parseExerciseMediaFilename(file);
    if (!parsed || parsed.junk) continue;
    if (!ctx.aliasSpecMatchesFile(spec, parsed)) continue;
    const score = ctx.scoreFilenameAgainstExercise(parsed, { name: '', aka: '' }) || 0;
    const prefer = [].concat(spec.prefer || []);
    let s = 100 - parsed.dup * 12 - file.length * 0.02;
    if (parsed.ext === 'mp4') s += 8;
    if (/VÍDEOS\//.test(file) || /\/VIDEOS\//i.test(file)) s -= 15;
    if (prefer.some((re) => re.test(file) || re.test(parsed.base))) s += 25;
    if (!best || s > best.score) best = { file, score: s };
  }
  return best;
}

function main() {
  const ctx = loadCore();
  const aliases = (ctx.window && ctx.window.EX_MEDIA_FILE_ALIASES) || ctx.EX_MEDIA_FILE_ALIASES || {};
  const files = listMp4();
  const sha = headSha();
  const exercises = parseDefEx();
  const byName = new Map(exercises.map((e) => [e.name, e]));
  const manifest = {};
  const matched = [];
  const missing = [];
  const usedFiles = new Set();
  const usedEx = new Set();

  for (const [name, spec] of Object.entries(aliases)) {
    const ex = byName.get(name);
    if (!ex) {
      missing.push(name + ' (brak w DEF_EX)');
      continue;
    }
    const picked = pickBestAliasFile(ctx, files, spec, usedFiles);
    if (!picked) {
      missing.push(name);
      continue;
    }
    usedFiles.add(picked.file);
    usedEx.add(name);
    addKeys(ctx, manifest, ex, videoUrl(sha, picked.file));
    matched.push({ name, file: picked.file, score: picked.score, via: 'alias' });
  }

  const aliased = new Set(Object.keys(aliases));
  const pairs = [];
  for (const file of files) {
    if (usedFiles.has(file)) continue;
    const parsed = ctx.parseExerciseMediaFilename(file);
    if (!parsed || parsed.junk) continue;
    for (const ex of exercises) {
      if (usedEx.has(ex.name) || aliased.has(ex.name)) continue;
      const score = ctx.scoreFilenameAgainstExercise(parsed, ex);
      if (score >= 180) pairs.push({ file, ex, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file, 'pl'));
  for (const p of pairs) {
    if (usedFiles.has(p.file) || usedEx.has(p.ex.name)) continue;
    usedFiles.add(p.file);
    usedEx.add(p.ex.name);
    addKeys(ctx, manifest, p.ex, videoUrl(sha, p.file));
    matched.push({ name: p.ex.name, file: p.file, score: p.score, via: 'auto' });
  }

  const LOCAL_GIF = [
    { name: 'Przysiad hack maszyna', url: 'assets/ex/gifs/przysiad-hack-maszyna.gif' },
    { name: 'Butterfly (peck deck)', url: 'assets/ex/gifs/butterfly-peck-deck.gif' },
  ];
  for (const loc of LOCAL_GIF) {
    const ex = byName.get(loc.name);
    if (!ex) continue;
    addKeys(ctx, manifest, ex, loc.url, true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.url;
      row.via = 'local';
    } else {
      matched.push({ name: loc.name, file: loc.url, score: 0, via: 'local' });
    }
  }

  /** Ręcznie sprawdzona treść klipu (nazwa pliku bywa myląca). */
  const CHEST_FORCE = [
    { name: 'Wyciskanie hantli skos+', file: 'Wyciskanie hantli na ławce skośnej dodatniej (Incline Dumbbell Press).mp4' },
    { name: 'Pompki na kolanach', file: 'Pompka szeroka (rozstaw rąk szerszy niż ramiona) (Wide-Grip Push-Up).mp4' },
    { name: 'Krzyżowanie wyciągów dół–góra', file: 'Krzyżowanie ramion na wyciągu (wyciąg górny, stojąc) (Cable Crossover).mp4' },
  ];
  for (const loc of CHEST_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !files.includes(loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'chest';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'chest' });
    }
  }
  const CHEST_UNMAP = ['Wyciskanie sztangi skos−', 'Rozpiętki jednorącz wyciąg', 'Pompki szerokie'];
  const BACK_FORCE = [
    { name: 'Wiosłowanie sztangą', file: 'Podciąganie na drążku nachwytem (podciąganie na drążku) (Pull-up (overhand grip)).mp4' },
    { name: 'Wiosłowanie hantlem', file: 'Wiosłowanie hantlem w opadzie tułowia z podporem na ławce (jednorącz) (Single-Arm Dumbbell Row).mp4' },
    { name: 'Wiosłowanie hantlami oburącz', file: 'Odwrotne rozpiętki z hantlami w opadzie tułowia (Bent-Over Dumbbell Reverse Fly).mp4' },
    { name: 'Unoszenie barków hantlami', file: 'Wiosłowanie hantlą w opadzie tułowia (Dumbbell Bent-Over Row).mp4' },
    { name: 'Ściąganie prostymi rękami', file: 'Odciąganie linek wyciągu górnego w opadzie tułowia (prostowanie ramion na wyciągu) (Cable Pull-Through Straight-Arm Cable Pulldown (bent-over)).mp4' },
  ];
  for (const loc of BACK_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !files.includes(loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'back';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'back' });
    }
  }
  const BACK_UNMAP = [
    'Wiosłowanie Pendlay',
    'Podciąganie na drążku',
    'Martwy ciąg RDL',
    'Wiosłowanie odwrócone',
    'Wiosłowanie wyciągiem jednorącz',
    'Ściąganie drążka jednorącz',
    'Odwrotne rozpiętki',
    'Unoszenie barków sztangą',
    'Unoszenie bokiem w opadzie',
    'Odwrotne rozpiętki na wyciągu',
  ];
  const SHOULDER_UNMAP = [
    'Wyciskanie żołnierskie OHP',
    'Unoszenie przodem',
    'Odwrotne rozpiętki maszyna',
    'Wyciskanie barków maszyna',
    'Wyciskanie hantli stojąc',
    'Wyciskanie hantla jednorącz nad głowę',
    'Wyciskanie Arnolda',
  ];
  const QUAD_UNMAP = [
    'Przysiad Goblet',
    'Przysiad przedni',
    'Przysiad sumo',
    'Wykrok ze sztangą',
    'Wykrok chodzony',
    'Przysiad w bramie Smith',
    'Wyciskanie nogami jednonóż',
  ];
  const HAM_UNMAP = ['Uginanie nóg maszyna', 'Uginanie nóg leżąc'];
  const GLUTE_UNMAP = [
    'Mostek biodrowy',
    'Mostek biodrowy — aktywacja',
    'Mostek biodrowy z mini band',
    'Mostek KAS',
    'Kickback na maszynie',
    'Kickback pośladki',
    'Wypychanie bioder (hip thrust)',
    'Wypychanie bioder jednonóż',
    'Wypychanie bioder na maszynie',
    'Wypychanie bioder B-stance',
    'Wypychanie bioder z taśmą',
    'Wypychanie bioder ze stopą na podwyższeniu',
    'Wypychanie bioder z odwodzeniem mini band',
    'Abdukcja biodra maszyna',
    'Przywodzenie biodra maszyna',
    'Odwodzenie biodra leżąc',
    'Odwodzenie biodra na wyciągu',
    'Donkey kick',
    'Donkey kick z mini band',
    'Pull-through wyciąg',
    'Frog pump',
    'Muszla (clamshell)',
    'Odwrócone prostowanie tułowia',
  ];
  const TRI_UNMAP = [
    'Prostowanie tricepsa wyciąg',
    'Prostowanie linką',
    'Prostowanie za głowę hantlem',
    'Prostowanie za głowę (skull crusher)',
    'Dipy na ławce',
    'Prostowanie jednorącz wyciąg',
    'Kickback na wyciągu',
    'Kickback triceps',
    'Wyciskanie francuskie',
    'Prostowanie za głowę wyciąg',
    'Prostowanie za głowę hantlami',
    'Dipy triceps (pionowe)',
    'Dipy triceps maszyna',
    'Wyciskanie JM',
    'Wyciskanie Tate',
    'Wyciskanie wąskim chwytem w Smith',
    'Prostowanie tricepsa na maszynie',
    'Prostowanie tricepsa taśmą jednorącz',
    'Prostowanie na drążku',
    'Skull crusher hantle z wyprostem ramienia',
    'Prostowanie tricepsa hantlami na podłodze',
  ];
  const BI_UNMAP = [
    'Uginanie biceps sztangą',
    'Uginanie młotkowe',
    'Uginanie hantlami naprzemiennie',
    'Uginanie na wyciągu',
    'Uginanie spider',
    'Uginanie Zottman',
    'Uginanie reverse',
    'Uginanie nadgarstka',
    'Uginanie koncentryczne',
    'Uginanie na modlitewniku',
    'Uginanie na skosie',
    'Uginanie Bayesian',
    'Uginanie drag',
    '21-ki biceps',
    'Uginanie gryfem łamanym',
    'Uginanie młotkowe na wyciągu',
    'Uginanie na maszynie',
    'Prostowanie nadgarstka',
    'Uginanie młotkowe na skosie',
    'Uginanie w poprzek ciała',
    'Uginanie z linką',
    'Uginanie biceps na kółkach bokiem',
    'Uginanie hantlami 1.5',
    'Uginanie hantlami elevator',
    'Uginanie nadgarstków hantlami',
    'Uginanie nadgarstków młotkowo',
    'Uginanie nadgarstków nachwytem',
  ];
  const CORE_UNMAP = [
    'Deska',
    'Deska boczna',
    'Deska z unoszeniem ramienia',
    'Deska kopenhaska',
    'Rollout z kółkiem',
    'Hollow hold',
    'Hollow rock',
    'Dragon flag',
    'Martwy robak',
    'Bird dog',
    'Brzuszki klasyczne',
    'Brzuszki rowerowe',
    'Brzuszki odwrotne',
    'Brzuszki na maszynie',
    'Brzuszki na wyciągu',
    'Zwisy nóg drążek',
    'Skręty rosyjskie',
    'Woodchop wyciąg',
    'Wyciskanie Pallofa',
    'Unoszenie kolan w zwisie',
    'Palce do drążka',
    'V-upy',
    'Nożyce',
    'Unoszenie nóg leżąc',
    'Skłony boczne',
    'Mountain climbers',
  ];
  const CALF_UNMAP = [
    'Wspięcia na palce',
    'Wspięcia na palce stojąc',
    'Wspięcia na palce jednonóż',
    'Wspięcia na palce siedząc',
    'Wspięcia na palce hantlami',
    'Wspięcia na palce jednonóż hantlem',
    'Wspięcia na palce na suwnicy',
  ];
  const CHEST_AND_BACK_UNMAP = CHEST_UNMAP.concat(
    BACK_UNMAP,
    SHOULDER_UNMAP,
    QUAD_UNMAP,
    HAM_UNMAP,
    GLUTE_UNMAP,
    TRI_UNMAP,
    BI_UNMAP,
    CORE_UNMAP,
    CALF_UNMAP
  );
  for (const name of CHEST_AND_BACK_UNMAP) {
    const ex = byName.get(name);
    if (!ex) continue;
    const keys = [];
    const add = (s) => {
      const k = ctx.exerciseMediaKey(s);
      if (k) keys.push(k);
      const sl = ctx.exerciseSlug(s);
      if (sl) keys.push(sl);
    };
    add(ex.name);
    String(ex.aka || '')
      .split(/[,;/|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(add);
    keys.forEach((k) => {
      delete manifest[k];
    });
    const idx = matched.findIndex((m) => m.name === name);
    if (idx >= 0) matched.splice(idx, 1);
  }

  /** Ręcznie sprawdzona treść klipu barków (nazwa pliku bywa myląca). */
  const SHOULDER_FORCE = [
    {
      name: 'Unoszenie bokiem na wyciągu jednorącz',
      file: 'Odwodzenie ramienia na wyciągu dolnym (stojąc bokiem) (Cable lateral raise (low pulley)).mp4',
    },
  ];
  for (const loc of SHOULDER_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !files.includes(loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'shoulder';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'shoulder' });
    }
  }

  /** Ręcznie sprawdzona treść klipu czworogłowych (nazwa pliku bywa myląca). */
  const QUAD_FORCE = [
    {
      name: 'Przysiad ze sztangą',
      file: 'Przysiad ze sztangą na karku (przysiad klasyczny) (Barbell Back Squat).mp4',
    },
    {
      name: 'Przysiad bułgarski',
      file: 'Wykrok z tylną nogą uniesioną na ławce (bułgarski przysiad split) (Bulgarian Split Squat).mp4',
    },
    {
      name: 'Wyciskanie nogami',
      file: 'Wypychanie nóg na suwnicy (leg press) – ustawienie stópkolan (Leg Press (machine) – footknee alignment).mp4',
    },
    {
      name: 'Przysiad z piętami na podwyższeniu',
      file: 'Przysiad ze złączonymi stopami (na podwyższeniu pod piętami) (Heel Elevated Bodyweight Squat).mp4',
    },
    {
      name: 'Przysiad goblet na podwyższeniu pięt',
      file: 'Przysiad ze złączonymi stopami (na podwyższeniu pod piętami) (Heel Elevated Bodyweight Squat).mp4',
    },
  ];
  for (const loc of QUAD_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'quad';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'quad' });
    }
  }

  /** Ręcznie sprawdzona treść klipu dwugłowych (nazwa pliku bywa myląca). */
  const HAM_FORCE = [
    {
      name: 'Uginanie nóg leżąc',
      file: 'Uginanie nóg leżąc na maszynie (głowa nóg dwugłowych – część zewnętrzna) (Lying Leg Curl Machine (Outer Hamstrings)).mp4',
    },
    {
      name: 'Uginanie nóg maszyna',
      file: 'Uginanie nóg w leżeniu na maszynie (szeroki chwyt – głowa głęboka dwugłowego) (Lying Leg Curl Machine (wide stance – outer hamstrings emphasis)).mp4',
    },
  ];
  for (const loc of HAM_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'ham';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'ham' });
    }
  }

  /** Ręcznie sprawdzona treść klipu pośladków (nazwa pliku bywa myląca). */
  const GLUTE_FORCE = [
    {
      name: 'Kickback pośladki',
      file: 'Odwodzenie nogi w tył na wyciągu (kickback na wyciągu) (Cable Glute Kickback).mp4',
    },
    {
      name: 'Wypychanie bioder (hip thrust)',
      file: 'Hip thrust z hantlą (Dumbbell hip thrust).mp4',
    },
    {
      name: 'Abdukcja biodra maszyna',
      file: 'Odwodzenie nogi w maszynie (abduktor) (Seated Hip Abduction Machine).mp4',
    },
  ];
  for (const loc of GLUTE_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'glute';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'glute' });
    }
  }

  /** Ręcznie sprawdzona treść klipu tricepsa (nazwa pliku bywa myląca). */
  const TRI_FORCE = [
    {
      name: 'Prostowanie tricepsa wyciąg',
      file: 'Prostowanie ramion na wyciągu górnym (triceps pushdown) (Cable Triceps Pushdown) (2).mp4',
    },
    {
      name: 'Prostowanie linką',
      file: 'Prostowanie ramion na wyciągu górnym (triceps pushdown) – uchwyt linowy (Cable Triceps Pushdown with Rope Attachment).mp4',
    },
    {
      name: 'Prostowanie za głowę hantlem',
      file: 'Francuskie wyciskanie hantli nad głową (triceps overhead extension z hantlami) (Dumbbell Overhead Triceps Extension).mp4',
    },
    {
      // Filename says seated DB OH — content is barbell lying skull crusher (SHA 22b6474f32ca).
      name: 'Prostowanie za głowę (skull crusher)',
      file: 'Francuskie wyciskanie hantli siedząc (prostowanie ramion nad głową z hantlą) (Seated Dumbbell Overhead Tricep Extension).mp4',
    },
    {
      name: 'Dipy na ławce',
      file: 'Dipy na ławce (triceps dips na ławce) (Bench Dips).mp4',
    },
  ];
  for (const loc of TRI_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'tri';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'tri' });
    }
  }

  /** Ręcznie sprawdzona treść klipu bicepsa (nazwa pliku bywa myląca). */
  const BI_FORCE = [
    {
      // Filename says DB bicep curl — content is standing hammer do/don’t (SHA 6e89c692c574).
      name: 'Uginanie młotkowe',
      file: 'Uginanie ramion z hantlami (biceps curl z hantlami) (Dumbbell Bicep Curl).mp4',
    },
    {
      // Filename says hammer — content is standing DB curl with supination (SHA 22fce23b86ab).
      name: 'Uginanie hantlami naprzemiennie',
      file: 'Uginanie ramion z hantlą (uchwyt młotkowy) (Dumbbell Hammer Curl).mp4',
    },
    {
      name: 'Uginanie koncentryczne',
      file: 'Uginanie przedramion z hantlą w oparciu o kolano (uginanie koncentryczne) (Dumbbell Concentration Curl).mp4',
    },
    {
      name: 'Uginanie reverse',
      file: 'Uginanie ramion ze sztangą (uchwyt nachwytem) (Barbell Reverse Curl).mp4',
    },
  ];
  for (const loc of BI_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'bi';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'bi' });
    }
  }

  /** Ręcznie sprawdzona treść klipu core (nazwa pliku bywa myląca). */
  const CORE_FORCE = [
    {
      name: 'Rollout z kółkiem',
      file: 'Rollout na kółku ab wheel z kolan (Kneeling Ab Wheel Rollout).mp4',
    },
  ];
  for (const loc of CORE_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'core';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'core' });
    }
  }

  /** Ręcznie sprawdzona treść klipu łydek (nazwa pliku bywa myląca). */
  const CALF_FORCE = [
    {
      name: 'Wspięcia na palce hantlami',
      file: 'Wspięcia na palce z hantlami (stojąc) (Standing Dumbbell Calf Raises).mp4',
    },
    {
      name: 'Wspięcia na palce stojąc',
      file: 'Wspięcia na palce (stojąc) – unoszenie łydek na stopniu (Standing Calf Raise on Step).mp4',
    },
  ];
  for (const loc of CALF_FORCE) {
    const ex = byName.get(loc.name);
    if (!ex || !filesHas(files, loc.file)) continue;
    addKeys(ctx, manifest, ex, videoUrl(sha, loc.file), true);
    const row = matched.find((m) => m.name === loc.name);
    if (row) {
      row.file = loc.file;
      row.via = 'calf';
    } else {
      matched.push({ name: loc.name, file: loc.file, score: 0, via: 'calf' });
    }
  }

  const unused = files.filter(
    (f) => !usedFiles.has(f) && !/\(\d+\)\.mp4$/i.test(f) && !ctx.parseExerciseMediaFilename(f).junk
  );
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
  matched
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    .forEach((m) => console.log('  OK  ', m.via, String(m.score).padStart(4), m.name, '←', m.file));
  if (missing.length) {
    console.log('\nBez filmu (alias):', missing.length);
    missing.forEach((n) => console.log('  --  ', n));
  }
  console.log('\nNieużyte pliki (bez kopii (2)/(3) i śmieci):', unused.length);
  unused.slice(0, 80).forEach((f) => console.log('  ..  ', f));
  if (unused.length > 80) console.log('  ..  … i jeszcze', unused.length - 80);
}

main();
