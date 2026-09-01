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
  const CHEST_AND_BACK_UNMAP = CHEST_UNMAP.concat(BACK_UNMAP);
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
