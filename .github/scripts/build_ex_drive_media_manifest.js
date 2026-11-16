#!/usr/bin/env node
'use strict';

/**
 * Buduje ex-drive-media-manifest.js na podstawie PUBLICZNEJ biblioteki Google
 * Drive. Nie pobiera żadnego GIF-a ani MP4 — zapisuje wyłącznie linki do
 * materiałów już udostępnionych jako „każda osoba mająca link — wyświetlanie”.
 *
 * Jasne biblioteki (kulturystyczne, calisthenics i funkcjonalne) są używane na
 * kartach ćwiczeń. Foldery PREMIUM pozostają filmami techniki po otwarciu
 * ćwiczenia.
 *
 * Uruchom: node .github/scripts/build_ex_drive_media_manifest.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '../..');
const ROOT_FOLDER = '1DlEhpxXhhfQg1pRnHTD54fei7T-CSbCw';
const OUT_FILE = path.join(root, 'ex-drive-media-manifest.js');
const MAX_DEPTH = 8;

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function loadExerciseMatcher() {
  const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
  const match = six.match(/const DEF_EX=\[([\s\S]*?)\];\s*window\.DEF_EX/);
  if (!match) throw new Error('Nie znaleziono listy DEF_EX.');
  const exercises = [...match[1].matchAll(/\{name:'([^']+)'([^}]*)\}/g)].map((row) => ({
    name: row[1],
    aka: (row[2].match(/aka:'([^']+)'/) || [])[1] || '',
  }));
  const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const windowObj = {
    addEventListener() {}, CL: [], EX: [], DEF_EX: exercises,
    EX_GIF_MANIFEST: {}, EX_GIF_REMOTE: {}, COACH_VIDEOS: [], document,
  };
  windowObj.window = windowObj;
  const context = {
    window: windowObj, document, console, Date, Math, parseInt, parseFloat,
    Number, String, Array, Object, JSON, setTimeout, clearTimeout, isNaN,
    Infinity, undefined,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), context);
  return { exercises, matchFile: (filename) => context.matchFilenameToExercise(filename, exercises), key: context.exerciseMediaKey };
}

async function getHtml(folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.text();
  } catch (error) {
    // Na części komputerów firmowy certyfikat sieciowy jest znany PowerShellowi,
    // ale nie wbudowanemu fetchowi Node. Fallback nie omija TLS i pobiera tylko
    // publiczny HTML listy folderu, bez mediów oraz bez danych logowania.
    if (process.platform !== 'win32') throw error;
    const script = "$ErrorActionPreference='Stop'; $r=Invoke-WebRequest -UseBasicParsing -Uri $env:PL_DRIVE_MANIFEST_URL -MaximumRedirection 3; [Console]::Out.Write($r.Content)";
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PL_DRIVE_MANIFEST_URL: url },
    });
  }
}

function parseFolder(html, id) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = decodeHtml((titleMatch && titleMatch[1]) || id).replace(/\s+[-–]\s+Dysk Google\s*$/i, '');
  const folders = [];
  const files = [];
  for (const match of html.matchAll(/href="https:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)"/g)) {
    if (!folders.includes(match[1])) folders.push(match[1]);
  }
  const filePattern = /<div class="flip-entry" id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  for (const match of html.matchAll(filePattern)) {
    const name = decodeHtml(match[2].replace(/<[^>]*>/g, ''));
    if (name) files.push({ id: match[1], name });
  }
  return { title, folders, files };
}

function mediaRole(pathNames) {
  const trail = pathNames.join(' / ').toLowerCase();
  if (trail.includes('premium')) return 'technique';
  if (/(kulturystycz|calisthenics|funkcjonal|hiit)/i.test(trail)) return 'preview';
  return '';
}

async function main() {
  const matcher = loadExerciseMatcher();
  const queue = [{ id: ROOT_FOLDER, depth: 0, trail: [] }];
  const seen = new Set();
  const preview = {};
  const technique = {};
  const stats = { folders: 0, files: 0, preview: 0, technique: 0, unmatched: 0, skipped: 0 };

  while (queue.length) {
    const item = queue.shift();
    if (seen.has(item.id) || item.depth > MAX_DEPTH) continue;
    seen.add(item.id);
    let parsed;
    try {
      parsed = parseFolder(await getHtml(item.id), item.id);
    } catch (err) {
      console.warn(`Pomijam folder ${item.id}: ${err.message}`);
      continue;
    }
    stats.folders++;
    const trail = [...item.trail, parsed.title];
    const role = mediaRole(trail);
    for (const folderId of parsed.folders) queue.push({ id: folderId, depth: item.depth + 1, trail });
    for (const file of parsed.files) {
      stats.files++;
      if (!/\.(gif|webp|mp4|webm)$/i.test(file.name)) { stats.skipped++; continue; }
      if (!role) { stats.skipped++; continue; }
      const exercise = matcher.matchFile(file.name);
      if (!exercise) { stats.unmatched++; continue; }
      const key = matcher.key(exercise);
      const url = `https://drive.google.com/file/d/${file.id}/view?usp=drive_web${role === 'preview' ? '#pl-preview' : ''}`;
      const target = role === 'preview' ? preview : technique;
      if (!target[key]) {
        target[key] = url;
        stats[role]++;
      }
    }
  }

  const source = `/**\n * Publiczna biblioteka Google Drive → ćwiczenia.\n * Generuj: node .github/scripts/build_ex_drive_media_manifest.js\n * Jasne GIF-y: podglądy kart. Premium: filmy techniki.\n */\nwindow.EX_DRIVE_MEDIA_VERSION=1;\nwindow.EX_DRIVE_PREVIEW_MANIFEST=${safeJson(preview)};\nwindow.EX_DRIVE_TECHNIQUE_MANIFEST=${safeJson(technique)};\n`;
  fs.writeFileSync(OUT_FILE, source);
  console.log(`Zapisano ${path.relative(root, OUT_FILE)}.`);
  console.log(`Foldery: ${stats.folders}; pliki: ${stats.files}; podglądy: ${stats.preview}; technika: ${stats.technique}; niedopasowane: ${stats.unmatched}; pominięte: ${stats.skipped}.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
