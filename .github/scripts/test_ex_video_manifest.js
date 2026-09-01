#!/usr/bin/env node
'use strict';
/** Manifest MP4 z progress-live-video-assets: URL-e i brak pomyłek (Svend, za kark). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'ex-gif-manifest.js'), 'utf8');
const m = src.match(/window\.EX_GIF_MANIFEST\s*=\s*(\{[\s\S]*\});/);
if (!m) {
  console.error('FAIL missing EX_GIF_MANIFEST');
  process.exit(1);
}
const MAN = JSON.parse(m[1]);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

const names = [
  'Wyciskanie sztangi leżąc',
  'Pompki',
  'Przysiad ze sztangą',
  'Ściąganie do twarzy (face pull)',
  'Martwy ciąg klasyczny',
  'Butterfly (peck deck)',
];
ok('many mapped keys', Object.keys(MAN).length >= 80, String(Object.keys(MAN).length));

names.forEach((n) => {
  const key = n.toLowerCase();
  const url = MAN[key] || '';
  ok(n + ' has mp4', /progress-live-video-assets/.test(url) && /\.mp4(\?|#|$)/i.test(url), url.slice(0, 120));
  ok(n + ' uses jsdelivr', /cdn\.jsdelivr\.net/.test(url), url.slice(0, 80));
});

ok('bench is barbell bench press', /Barbell%20Bench%20Press/i.test(MAN['wyciskanie sztangi leżąc'] || ''));
ok('face pull clip', /Face%20Pull/i.test(MAN['ściąganie do twarzy (face pull)'] || MAN['facepull'] || ''));
ok('incline db not decline', /Incline/i.test(MAN['wyciskanie hantli skos+'] || MAN['wyciskanie-hantli-skos-plus'] || '') && !/Decline/i.test(MAN['wyciskanie hantli skos+'] || MAN['wyciskanie-hantli-skos-plus'] || ''));
ok('chest fly not reverse delt', /Fly/i.test(MAN['rozpiętki hantlami'] || '') && !/Rear%20Delt|Reverse%20Dumbbell%20Fly/i.test(MAN['rozpiętki hantlami'] || ''));
ok('no colliding skos slug', !MAN['wyciskanie-hantli-skos']);
ok('no svend key', !MAN['wyciskanie svenda'] && !MAN['svend press']);
const blob = Object.values(MAN).join('\n');
ok('no behind-the-neck pulldown', !/Behind%20the%20Neck/i.test(blob));
const localGifs = Object.values(MAN).filter((u) => /assets\/ex\/gifs/.test(u));
ok(
  'local gifs only hack squat',
  localGifs.length > 0 && localGifs.every((u) => /przysiad-hack-maszyna\.gif$/.test(u)),
  localGifs.join(',')
);
ok('hack squat maps to local gif', /przysiad-hack-maszyna\.gif$/.test(MAN['przysiad hack maszyna'] || ''));

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX: [
    { name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' },
    { name: 'Wyciskanie Svenda', aka: 'Svend press', img: 'assets/ex/bench.svg' },
    { name: 'Pompki', img: 'assets/ex/bench.svg' },
  ],
  EX_GIF_MANIFEST: MAN,
  EX_GIF_REMOTE: {},
  EX_PHOTO_MANIFEST: {
    'wyciskanie sztangi leżąc': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg',
    'pompki': 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Pushups/0.jpg',
  },
  COACH_VIDEOS: [],
  document,
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, '01-core.js'), 'utf8'), ctx);

const gif = ctx.exGifUrl({ name: 'Wyciskanie sztangi leżąc' });
ok('exGifUrl bench mp4', /\.mp4/i.test(gif) && /video-assets/.test(gif), gif);
ok('isVideoMediaUrl', ctx.isVideoMediaUrl(gif));
const thumb = ctx.exThumbUrl({ name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' });
ok('thumb stays photo', /free-exercise-db/.test(thumb) && !/\.mp4/i.test(thumb), thumb);
ok('svend has no gif', !ctx.exGifUrl({ name: 'Wyciskanie Svenda' }));
ok('hack squat thumb is local gif', ctx.exThumbUrl({ name: 'Przysiad hack maszyna' }) === 'assets/ex/gifs/przysiad-hack-maszyna.gif');

const html = ctx.exTechniqueMediaHtml({ gif, name: 'Wyciskanie sztangi leżąc' }, {});
ok('technique html is video', /<video/.test(html) && /autoplay/.test(html) && !/<img/.test(html), html.slice(0, 180));

const coach = ctx.resolveCoachMedia({ name: 'Wyciskanie sztangi leżąc' });
ok('resolveCoachMedia gif is mp4', /\.mp4/i.test(coach.gif || ''), coach.gif);

if (failed) process.exit(1);
console.log('\nAll ex-video-manifest tests passed');
