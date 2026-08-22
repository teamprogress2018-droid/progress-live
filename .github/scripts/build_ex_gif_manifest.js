#!/usr/bin/env node
/** Skanuje assets/ex/gifs i buduje ex-gif-manifest.js z dopasowaniem do DEF_EX. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const gifDir = path.join(root, 'assets', 'ex', 'gifs');
const exFile = path.join(root, '06-inbox-exercises-ai-programs.js');
const outFile = path.join(root, 'ex-gif-manifest.js');

function slug(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mediaKey(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const src = fs.readFileSync(exFile, 'utf8');
const m = src.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
if (!m) {
  console.error('Nie znaleziono DEF_EX');
  process.exit(1);
}
const names = [...m[1].matchAll(/name:'([^']+)'/g)].map((x) => x[1]);
const bySlug = {};
names.forEach((n) => {
  bySlug[slug(n)] = n;
});

if (!fs.existsSync(gifDir)) fs.mkdirSync(gifDir, { recursive: true });
const files = fs.readdirSync(gifDir).filter((f) => /\.(gif|webp|mp4|webm)$/i.test(f));

const manifest = {};
let matched = 0;
files.forEach((file) => {
  const base = file.replace(/\.(gif|webp|mp4|webm)$/i, '');
  const rel = `assets/ex/gifs/${file}`;
  const exName = bySlug[base];
  if (exName) {
    manifest[mediaKey(exName)] = rel;
    manifest[base] = rel;
    matched++;
    console.log('OK  ', file, '→', exName);
  } else {
    manifest[base] = rel;
    console.log('?   ', file, '(brak ćwiczenia o tym slugu — ręcznie w manifeście)');
  }
});

const body = `/** Mapowanie ćwiczenie → GIF (repo). Generuj: node .github/scripts/build_ex_gif_manifest.js */\nwindow.EX_GIF_MANIFEST=${JSON.stringify(manifest, null, 2)};\n`;
fs.writeFileSync(outFile, body);
console.log(`\nZapisano ${outFile}: ${files.length} plików, ${matched} dopasowanych do DEF_EX.`);
