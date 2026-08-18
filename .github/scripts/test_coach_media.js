// Testy wskazówki / filmu przy ćwiczeniu.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  DEF_EX: [
    {name: 'Przysiad ze sztangą', tip: 'Kolana w kierunku palców.', video: ''}
  ],
  document
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
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

const {
  normalizeCoachVideoUrl, coachVideoEmbed, parsePlanExercise,
  resolveCoachMedia, mapPlanExercisesForClient
} = ctx;

let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

eq('https ok', normalizeCoachVideoUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://youtu.be/dQw4w9WgXcQ');
eq('www prefix', normalizeCoachVideoUrl('www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
eq('js blocked', normalizeCoachVideoUrl('javascript:alert(1)'), '');
eq('data blocked', normalizeCoachVideoUrl('data:text/html,hi'), '');
eq('embed youtube', coachVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
eq('embed youtu.be', coachVideoEmbed('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
eq('embed shorts', coachVideoEmbed('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
eq('embed vimeo', coachVideoEmbed('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');

const parsed = parsePlanExercise({
  name: 'Przysiad ze sztangą', sets: 4, reps: 8,
  note: 'Łopatki ściągnięte',
  video: 'https://youtu.be/dQw4w9WgXcQ'
});
eq('parse note', parsed.note, 'Łopatki ściągnięte');
eq('parse video', parsed.video, 'https://youtu.be/dQw4w9WgXcQ');

const ai = parsePlanExercise({name: 'RDL', notes: 'Biodra do tyłu', n: 'RDL'});
eq('ai notes alias', ai.note, 'Biodra do tyłu');

windowObj.DEF_EX = [{name: 'Przysiad ze sztangą', tip: 'Kolana w kierunku palców.', video: 'https://youtu.be/abcdefghijk'}];
const fromLib = resolveCoachMedia({name: 'Przysiad ze sztangą'});
eq('lib tip fallback', fromLib.libTip, 'Kolana w kierunku palców.');
eq('lib video fallback', fromLib.video, 'https://youtu.be/abcdefghijk');

const fromPlan = resolveCoachMedia({
  name: 'Przysiad ze sztangą',
  note: 'Z planu',
  video: 'https://youtu.be/dQw4w9WgXcQ'
});
eq('plan note wins', fromPlan.note, 'Z planu');
eq('plan video wins', fromPlan.video, 'https://youtu.be/dQw4w9WgXcQ');
eq('no lib tip when note', fromPlan.libTip, '');

const mapped = mapPlanExercisesForClient([{
  name: 'Przysiad ze sztangą', sets: '3', reps: '8',
  note: 'Tempo 3-0-1', video: 'https://youtu.be/dQw4w9WgXcQ'
}], 'c1');
eq('mapped note', mapped[0].note, 'Tempo 3-0-1');
eq('mapped embed', mapped[0].videoEmbed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy wskazówki/filmu przeszły.');
