// Unit: mapowanie GIF-ów techniki ćwiczeń
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX: [{ name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' }],
  EX_GIF_MANIFEST: { 'wyciskanie sztangi leżąc': 'assets/ex/gifs/bench.gif' },
  EX_GIF_REMOTE: { 'podciąganie na drążku': 'https://cdn.example.com/pull.gif' },
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
vm.runInContext(fs.readFileSync(path.join(path.dirname(__filename), '..', '..', '01-core.js'), 'utf8'), ctx);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

ok('exerciseSlug', ctx.exerciseSlug('Wyciskanie sztangi leżąc') === 'wyciskanie-sztangi-lezac');
ok('exerciseSlug plus', ctx.exerciseSlug('Wyciskanie hantli skos+') === 'wyciskanie-hantli-skos-plus');
ok('manifest lookup', ctx.exGifMapLookup('Wyciskanie sztangi leżąc') === 'assets/ex/gifs/bench.gif');
ok('remote lookup', ctx.exGifMapLookup('Podciąganie na drążku') === 'https://cdn.example.com/pull.gif');
ok('exGifUrl from manifest', ctx.exGifUrl('Wyciskanie sztangi leżąc') === 'assets/ex/gifs/bench.gif');

const coach = ctx.resolveCoachMedia({ name: 'Wyciskanie sztangi leżąc' });
ok('resolveCoachMedia gif', coach.gif === 'assets/ex/gifs/bench.gif');

const html = ctx.coachMediaHtml(coach, { showGif: true });
ok('coachMediaHtml has gif', html.includes('cw-technique-gif') && html.includes('bench.gif'));
ok('isVideoMediaUrl mp4', ctx.isVideoMediaUrl('https://cdn.example.com/a.mp4'));
ok('isVideoMediaUrl gif false', !ctx.isVideoMediaUrl('assets/ex/gifs/bench.gif'));

const mp4 = 'https://cdn.jsdelivr.net/gh/x/y@1/bench.mp4';
windowObj.EX_GIF_MANIFEST = { 'wyciskanie sztangi leżąc': mp4, 'wyciskanie-sztangi-lezac': mp4 };
windowObj.EX_PHOTO_MANIFEST = { 'wyciskanie sztangi leżąc': 'https://example.com/bench.jpg' };
ok('exGifUrl prefers mp4 from manifest', ctx.exGifUrl({ name: 'Wyciskanie sztangi leżąc' }) === mp4);
ok('exThumbUrl skips mp4 for photo', ctx.exThumbUrl({ name: 'Wyciskanie sztangi leżąc', img: 'assets/ex/bench.svg' }) === 'https://example.com/bench.jpg');
const hackGif = 'assets/ex/gifs/przysiad-hack-maszyna.gif';
windowObj.EX_GIF_MANIFEST = { 'przysiad hack maszyna': hackGif, 'przysiad-hack-maszyna': hackGif };
windowObj.EX_PHOTO_MANIFEST = { 'przysiad hack maszyna': 'https://example.com/hack.jpg' };
ok('exThumbUrl prefers gif over photo', ctx.exThumbUrl({ name: 'Przysiad hack maszyna' }) === hackGif);
const vhtml = ctx.exTechniqueMediaHtml({ gif: mp4, name: 'Wyciskanie sztangi leżąc' }, {});
ok('mp4 technique uses video tag', vhtml.includes('<video') && vhtml.includes(mp4) && !vhtml.includes('<img'));
ok('technique caption has name', vhtml.includes('cw-technique-cap') && vhtml.includes('Wyciskanie sztangi leżąc'));
const compact = ctx.exTechniqueMediaHtml({ gif: mp4, name: 'Wyciskanie sztangi leżąc' }, { compact: true });
ok('compact has no caption', !compact.includes('cw-technique-cap'));

process.exit(failed ? 1 : 0);
