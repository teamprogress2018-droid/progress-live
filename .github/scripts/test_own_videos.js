// Testy własnych filmów trenera (URL + dopasowanie do ćwiczenia).
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
  COACH_VIDEOS: [],
  METRIC_ENTRIES: [],
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
  Set,
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
  normalizeCoachVideoUrl, coachVideoEmbed, coachVideoIsFile,
  ownVideoForExercise, resolveCoachMedia, parsePlanExercise,
  mapPlanExercisesForClient, cdnUrlFromVideoFilename
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

eq('empty', normalizeCoachVideoUrl(''), '');
eq('js blocked', normalizeCoachVideoUrl('javascript:alert(1)'), '');
eq('data blocked', normalizeCoachVideoUrl('data:text/html,x'), '');
eq('https keep', normalizeCoachVideoUrl('https://youtu.be/abcdefghijk'), 'https://youtu.be/abcdefghijk');
eq('www prefix', normalizeCoachVideoUrl('www.youtube.com/watch?v=abcdefghijk').indexOf('https://') === 0, true);
eq('bare junk', normalizeCoachVideoUrl('not a url'), '');

windowObj.EX_GIF_MANIFEST = {
  x: 'https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@abc1234/foo.mp4'
};
eq(
  'local video-assets path to cdn',
  normalizeCoachVideoUrl('D:/progress-live-video-assets/POGRUPOWANE/Klatka piersiowa/Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4').indexOf('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@abc1234/') === 0,
  true
);
eq(
  'file url to cdn',
  /cdn\.jsdelivr\.net/.test(normalizeCoachVideoUrl('file:///D:/progress-live-video-assets/foo%20bar.mp4')),
  true
);
eq('desktop mp4 rejected', normalizeCoachVideoUrl('D:/Desktop/bench.mp4'), '');
eq('filename youcan to cdn', cdnUrlFromVideoFilename('Rozpiętki na maszynie (motyl) (Machine Chest Fly).mp4').indexOf('https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@abc1234/') === 0, true);
eq('plain filename not auto-cdn', cdnUrlFromVideoFilename('bench.mp4'), '');

eq('yt watch', coachVideoEmbed('https://www.youtube.com/watch?v=abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk');
eq('yt short', coachVideoEmbed('https://youtu.be/abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk');
eq('vimeo', coachVideoEmbed('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
eq('mp4 no embed', coachVideoEmbed('https://cdn.example.com/squat.mp4'), '');
eq('is file mp4', coachVideoIsFile('https://cdn.example.com/squat.mp4'), true);
eq('is file yt', coachVideoIsFile('https://youtu.be/abcdefghijk'), false);

windowObj.COACH_VIDEOS = [
  {name: 'Przysiad tech', url: 'https://youtu.be/abcdefghijk', exName: 'Przysiad', createdAt: '2026-01-01'},
  {name: 'Nowszy', url: 'https://vimeo.com/111', exName: 'Przysiad', createdAt: '2026-08-01'}
];
eq('own newest', ownVideoForExercise('Przysiad'), 'https://vimeo.com/111');
eq('own miss', ownVideoForExercise('Martwy'), '');
eq('own case', ownVideoForExercise('  przysiad  '), 'https://vimeo.com/111');

const media = resolveCoachMedia({name: 'Przysiad'});
eq('resolve vimeo embed', media.videoEmbed, 'https://player.vimeo.com/video/111');
eq('plan video wins', resolveCoachMedia({name: 'Przysiad', video: 'https://youtu.be/abcdefghijk'}).video, 'https://youtu.be/abcdefghijk');

eq('parse video', parsePlanExercise({name: 'Przysiad', video: 'https://youtu.be/abcdefghijk'}).video, 'https://youtu.be/abcdefghijk');
eq('parse js video empty', parsePlanExercise({name: 'X', video: 'javascript:x'}).video, '');

const mapped = mapPlanExercisesForClient([{name: 'Przysiad', sets: '3', reps: '5'}], 'c1');
eq('mapped video from lib', mapped[0].video, 'https://vimeo.com/111');
eq('mapped embed', mapped[0].videoEmbed, 'https://player.vimeo.com/video/111');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy własnych filmów OK.');
