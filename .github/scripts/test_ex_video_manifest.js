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
ok(
  'incline db is dodatniej not fake incline OHP',
  /dodatniej|sko%C5%9Bnej%20dodatniej/i.test(MAN['wyciskanie hantli skos+'] || '') &&
    !/%20\(incline\)%20\(Incline/i.test(MAN['wyciskanie hantli skos+'] || ''),
  (MAN['wyciskanie hantli skos+'] || '').slice(0, 160)
);
ok('cable fly overview is krzeselko', /krzese%C5%82ko|krzesełko/i.test(MAN['rozpiętki na wyciągu'] || ''), (MAN['rozpiętki na wyciągu'] || '').slice(0, 140));
ok('high pulley crossover', /High%20Pulley/i.test(MAN['krzyżowanie wyciągów góra–dół'] || ''), (MAN['krzyżowanie wyciągów góra–dół'] || '').slice(0, 140));
ok(
  'low-to-high crossover is standing compilation',
  /stoj%C4%85c|stojąc/i.test(MAN['krzyżowanie wyciągów dół–góra'] || '') &&
    /Cable%20Crossover/i.test(MAN['krzyżowanie wyciągów dół–góra'] || '') &&
    !/High%20Pulley/i.test(MAN['krzyżowanie wyciągów dół–góra'] || ''),
  (MAN['krzyżowanie wyciągów dół–góra'] || '').slice(0, 160)
);
ok('mid cable fly', /middle%20chest/i.test(MAN['rozpiętki na wyciągu w poziomie'] || ''));
ok('knee push-up uses wide-grip-named clip', /Wide-Grip%20Push-Up/i.test(MAN['pompki na kolanach'] || ''), (MAN['pompki na kolanach'] || '').slice(0, 140));
ok('classic push-up stays push-up', /Pompka%20\(Push-up\)\.mp4/i.test(MAN['pompki'] || ''));
ok('diamond push-up mapped', /Diamond%20Push-Up/i.test(MAN['pompki diamentowe'] || ''));
ok('db push-up mapped', /Dumbbell%20Push-Ups/i.test(MAN['pompki na hantlach'] || ''));
ok('no decline barbell clip', !MAN['wyciskanie sztangi skos−'] && !MAN['wyciskanie-sztangi-skos-minus']);
ok('no single-arm cable fly clip', !MAN['rozpiętki jednorącz wyciąg'] && !MAN['single-arm cable fly']);
ok('no wide push-up clip', !MAN['pompki szerokie'] && !MAN['pompki-szerokie']);
ok('chest fly not reverse delt', /Fly/i.test(MAN['rozpiętki hantlami'] || '') && !/Rear%20Delt|Reverse%20Dumbbell%20Fly/i.test(MAN['rozpiętki hantlami'] || ''));
ok('no colliding skos slug', !MAN['wyciskanie-hantli-skos']);
ok('no svend key', !MAN['wyciskanie svenda'] && !MAN['svend press']);
const blob = Object.values(MAN).join('\n');
ok('no behind-the-neck pulldown', !/Behind%20the%20Neck/i.test(blob));
const localGifs = Object.values(MAN).filter((u) => /assets\/ex\/gifs/.test(u));
ok(
  'local gifs only known technique loops',
  localGifs.length > 0 && localGifs.every((u) => /przysiad-hack-maszyna\.gif$|butterfly-peck-deck\.gif$/.test(u)),
  localGifs.join(',')
);
ok('hack squat maps to local gif', /przysiad-hack-maszyna\.gif$/.test(MAN['przysiad hack maszyna'] || ''));
ok('pec deck maps to local gif', /butterfly-peck-deck\.gif$/.test(MAN['butterfly (peck deck)'] || ''));
ok('pec deck aka maps to local gif', /butterfly-peck-deck\.gif$/.test(MAN['rozpiętki na maszynie'] || ''));
ok('pec deck not mislabeled mp4', !/\.mp4/i.test(MAN['butterfly (peck deck)'] || ''));
ok(
  'barbell row uses pull-up-named clip',
  /podci%C4%85ganie%20na%20dr%C4%85%C5%BCku%20nachwytem%20\(podci%C4%85ganie/i.test(MAN['wiosłowanie sztangą'] || ''),
  (MAN['wiosłowanie sztangą'] || '').slice(0, 180)
);
ok(
  'one-arm db row is bench-supported',
  /podporem%20na%20%C5%82awce|Single-Arm%20Dumbbell%20Row/i.test(MAN['wiosłowanie hantlem'] || '') &&
    !/jednor%C4%85czne%20na%20%C5%82awce%20\(z%20hantlem\)/i.test(MAN['wiosłowanie hantlem'] || ''),
  (MAN['wiosłowanie hantlem'] || '').slice(0, 180)
);
ok(
  'db shrugs uses bent-over-row-named clip',
  /Wios%C5%82owanie%20hantl%C4%85%20w%20opadzie%20tu%C5%82owia%20\(Dumbbell%20Bent-Over%20Row\)/i.test(MAN['unoszenie barków hantlami'] || ''),
  (MAN['unoszenie barków hantlami'] || '').slice(0, 180)
);
ok(
  'two-arm db row uses reverse-fly-named clip',
  /Bent-Over%20Dumbbell%20Reverse%20Fly/i.test(MAN['wiosłowanie hantlami oburącz'] || ''),
  (MAN['wiosłowanie hantlami oburącz'] || '').slice(0, 180)
);
ok(
  'straight-arm pulldown is bent-over cable',
  /Straight-Arm%20Cable%20Pulldown%20\(bent-over\)/i.test(MAN['ściąganie prostymi rękami'] || ''),
  (MAN['ściąganie prostymi rękami'] || '').slice(0, 180)
);
ok(
  'lat pulldown is to-chest clip not pec-deck-named',
  /do%20klatki%20piersiowej/i.test(MAN['ściąganie drążka wyciąg'] || '') &&
    !/przed%20g%C5%82ow/i.test(MAN['ściąganie drążka wyciąg'] || ''),
  (MAN['ściąganie drążka wyciąg'] || '').slice(0, 180)
);
ok('no pendlay lying clip', !MAN['wiosłowanie pendlay'] && !MAN['pendlay row']);
ok('no rdl lying clip', !MAN['martwy ciąg rdl'] && !MAN['martwy-ciag-rdl']);
ok('no inverted-row lying clip', !MAN['wiosłowanie odwrócone'] && !MAN['inverted row']);
ok('no standard pull-up pec-deck clip', !MAN['podciąganie na drążku']);
ok('wide pull-up stays mapped', /Wide-Grip%20Pull-Up/i.test(MAN['podciąganie szerokim chwytem'] || ''));
ok('deadlift stays mapped', /Barbell%20Deadlift/i.test(MAN['martwy ciąg klasyczny'] || ''));
ok('no lying barbell ohp clip', !MAN['wyciskanie żołnierskie ohp'] && !MAN['wyciskanie-zolnierskie-ohp']);
ok('no lying front raise clip', !MAN['unoszenie przodem'] && !MAN['unoszenie-przodem']);
ok('no lying reverse pec clip', !MAN['odwrotne rozpiętki maszyna']);
ok('no lying machine shoulder press clip', !MAN['wyciskanie barków maszyna']);
ok('no lying standing db ohp clip', !MAN['wyciskanie hantli stojąc']);
ok('no lying single-arm seated press clip', !MAN['wyciskanie hantla jednorącz nad głowę']);
ok('no lying arnold clip', !MAN['wyciskanie arnolda']);
ok(
  'one-arm cable lateral in manifest',
  /Cable%20lateral%20raise/i.test(MAN['unoszenie bokiem na wyciągu jednorącz'] || ''),
  (MAN['unoszenie bokiem na wyciągu jednorącz'] || '').slice(0, 160)
);
ok(
  'barbell squat is classic back squat clip',
  /przysiad%20klasyczny|na%20karku/i.test(MAN['przysiad ze sztangą'] || '') &&
    /Barbell%20Back%20Squat/i.test(MAN['przysiad ze sztangą'] || ''),
  (MAN['przysiad ze sztangą'] || '').slice(0, 180)
);
ok(
  'bulgarian split squat is rear-foot-on-bench clip',
  /bu%C5%82garski%20przysiad%20split|tylna%20nog%C4%85%20uniesion%C4%85%20na%20%C5%82awce/i.test(MAN['przysiad bułgarski'] || ''),
  (MAN['przysiad bułgarski'] || '').slice(0, 180)
);
ok(
  'leg press is foot-alignment clip',
  /footknee|ustawienie%20st%C3%B3p/i.test(MAN['wyciskanie nogami'] || ''),
  (MAN['wyciskanie nogami'] || '').slice(0, 180)
);
ok(
  'heel-elevated squat is heel clip',
  /Heel%20Elevated/i.test(MAN['przysiad z piętami na podwyższeniu'] || ''),
  (MAN['przysiad z piętami na podwyższeniu'] || '').slice(0, 180)
);
ok(
  'heel-elevated goblet is same heel clip',
  /Heel%20Elevated/i.test(MAN['przysiad goblet na podwyższeniu pięt'] || ''),
  (MAN['przysiad goblet na podwyższeniu pięt'] || '').slice(0, 180)
);
ok('no lying goblet clip', !MAN['przysiad goblet'] && !MAN['db goblet squat']);
ok('no lying front squat clip', !MAN['przysiad przedni'] && !MAN['front squat']);
ok('no lying sumo squat clip', !MAN['przysiad sumo']);
ok('no lying walking lunge clip', !MAN['wykrok chodzony'] && !MAN['walking lunge']);
ok('no lying barbell lunge clip', !MAN['wykrok ze sztangą']);
ok('no lying smith squat clip', !MAN['przysiad w bramie smith'] && !MAN['smith squat']);
ok('no lying single-leg press clip', !MAN['wyciskanie nogami jednonóż'] && !MAN['single-leg press']);
ok(
  'db lunge stays mapped',
  /Dumbbell%20Lunge/i.test(MAN['wykrok z hantlami'] || '') && !/Walking/i.test(MAN['wykrok z hantlami'] || ''),
  (MAN['wykrok z hantlami'] || '').slice(0, 160)
);
ok(
  'leg extension stays mapped',
  /Leg%20Extension/i.test(MAN['wyprosty nóg maszyna'] || MAN['seated leg extension machine'] || ''),
  (MAN['wyprosty nóg maszyna'] || MAN['seated leg extension machine'] || '').slice(0, 160)
);

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
ok('pec deck thumb is local gif', ctx.exThumbUrl({ name: 'Butterfly (peck deck)' }) === 'assets/ex/gifs/butterfly-peck-deck.gif');
ok('incline gif is dodatniej mp4', /dodatniej/i.test(ctx.exGifUrl({ name: 'Wyciskanie hantli skos+' }) || '') && !/%20\(incline\)%20/i.test(ctx.exGifUrl({ name: 'Wyciskanie hantli skos+' }) || ''));
ok('decline barbell has no technique clip', !ctx.exGifUrl({ name: 'Wyciskanie sztangi skos−' }));
ok('single-arm fly has no technique clip', !ctx.exGifUrl({ name: 'Rozpiętki jednorącz wyciąg' }));
ok('wide push-up has no technique clip', !ctx.exGifUrl({ name: 'Pompki szerokie' }));
ok('knee push-up gif is wide-grip-named mp4', /Wide-Grip%20Push-Up/i.test(ctx.exGifUrl({ name: 'Pompki na kolanach' }) || ''));
ok('low-to-high gif is standing crossover', /stoj%C4%85c/i.test(ctx.exGifUrl({ name: 'Krzyżowanie wyciągów dół–góra' }) || ''));
ok('barbell row gif is verified clip', /podci%C4%85ganie%20na%20dr%C4%85%C5%BCku%20nachwytem%20\(podci%C4%85ganie/i.test(ctx.exGifUrl({ name: 'Wiosłowanie sztangą' }) || ''));
ok('pendlay has no technique clip', !ctx.exGifUrl({ name: 'Wiosłowanie Pendlay' }));
ok('rdl has no technique clip', !ctx.exGifUrl({ name: 'Martwy ciąg RDL' }));
ok('seated db press gif is seated press', /Seated%20Dumbbell%20Shoulder%20Press/i.test(ctx.exGifUrl({ name: 'Wyciskanie hantli siedząc' }) || ''));
ok('db lateral gif is standing lateral', /Dumbbell%20Lateral%20Raise/i.test(ctx.exGifUrl({ name: 'Unoszenie bokiem' }) || ''));
ok('upright row gif is upright-row clip', /Upright%20Row/i.test(ctx.exGifUrl({ name: 'Wiosłowanie pionowe' }) || ''));
ok(
  'one-arm cable lateral gif is low-pulley clip',
  /Cable%20lateral%20raise%20\(low%20pulley\)/i.test(ctx.exGifUrl({ name: 'Unoszenie bokiem na wyciągu jednorącz' }) || ''),
  (ctx.exGifUrl({ name: 'Unoszenie bokiem na wyciągu jednorącz' }) || '').slice(0, 180)
);
ok('barbell ohp has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie żołnierskie OHP' }));
ok('db front raise has no lying clip', !ctx.exGifUrl({ name: 'Unoszenie przodem' }));
ok('reverse pec deck has no lying clip', !ctx.exGifUrl({ name: 'Odwrotne rozpiętki maszyna' }));
ok('machine shoulder press has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie barków maszyna' }));
ok('standing db ohp has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie hantli stojąc' }));
ok('single-arm db press has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie hantla jednorącz nad głowę' }));
ok('arnold has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie Arnolda' }));
ok(
  'barbell squat gif is classic clip',
  /przysiad%20klasyczny|na%20karku/i.test(ctx.exGifUrl({ name: 'Przysiad ze sztangą' }) || ''),
  (ctx.exGifUrl({ name: 'Przysiad ze sztangą' }) || '').slice(0, 180)
);
ok(
  'bulgarian gif is rear-foot-on-bench clip',
  /bu%C5%82garski%20przysiad%20split|tylna%20nog%C4%85/i.test(ctx.exGifUrl({ name: 'Przysiad bułgarski' }) || ''),
  (ctx.exGifUrl({ name: 'Przysiad bułgarski' }) || '').slice(0, 180)
);
ok(
  'leg press gif is foot-alignment clip',
  /footknee|ustawienie%20st%C3%B3p/i.test(ctx.exGifUrl({ name: 'Wyciskanie nogami' }) || ''),
  (ctx.exGifUrl({ name: 'Wyciskanie nogami' }) || '').slice(0, 180)
);
ok('goblet squat has no lying clip', !ctx.exGifUrl({ name: 'Przysiad Goblet' }));
ok('front squat has no lying clip', !ctx.exGifUrl({ name: 'Przysiad przedni' }));
ok('sumo squat has no lying clip', !ctx.exGifUrl({ name: 'Przysiad sumo' }));
ok('walking lunge has no lying clip', !ctx.exGifUrl({ name: 'Wykrok chodzony' }));
ok('barbell lunge has no lying clip', !ctx.exGifUrl({ name: 'Wykrok ze sztangą' }));
ok('smith squat has no lying clip', !ctx.exGifUrl({ name: 'Przysiad w bramie Smith' }));
ok('single-leg press has no lying clip', !ctx.exGifUrl({ name: 'Wyciskanie nogami jednonóż' }));
ok(
  'db lunge gif is stationary lunge',
  /Dumbbell%20Lunge/i.test(ctx.exGifUrl({ name: 'Wykrok z hantlami' }) || '') &&
    !/Walking/i.test(ctx.exGifUrl({ name: 'Wykrok z hantlami' }) || '')
);

const html = ctx.exTechniqueMediaHtml({ gif, name: 'Wyciskanie sztangi leżąc' }, {});
ok('technique html is video', /<video/.test(html) && /autoplay/.test(html) && !/<img/.test(html), html.slice(0, 180));

const coach = ctx.resolveCoachMedia({ name: 'Wyciskanie sztangi leżąc' });
ok('resolveCoachMedia gif is mp4', /\.mp4/i.test(coach.gif || ''), coach.gif);

if (failed) process.exit(1);
console.log('\nAll ex-video-manifest tests passed');
