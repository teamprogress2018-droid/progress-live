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
ok('manifest lookup', ctx.exGifMapLookup('Wyciskanie sztangi leżąc') === 'assets/ex/gifs/bench.gif');
ok('remote lookup', ctx.exGifMapLookup('Podciąganie na drążku') === 'https://cdn.example.com/pull.gif');
ok('exGifUrl from manifest', ctx.exGifUrl('Wyciskanie sztangi leżąc') === 'assets/ex/gifs/bench.gif');

const coach = ctx.resolveCoachMedia({ name: 'Wyciskanie sztangi leżąc' });
ok('resolveCoachMedia gif', coach.gif === 'assets/ex/gifs/bench.gif');

const html = ctx.coachMediaHtml(coach, { showGif: true });
ok('coachMediaHtml has gif', html.includes('cw-technique-gif') && html.includes('bench.gif'));

process.exit(failed ? 1 : 0);
