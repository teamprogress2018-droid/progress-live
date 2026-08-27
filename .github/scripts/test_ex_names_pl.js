#!/usr/bin/env node
'use strict';
/** DEF_EX display names in autocomplete are Polish; English kept as aka. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const photoSrc = fs.readFileSync(path.join(root, 'ex-photo-manifest.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\nwindow\.DEF_EX=DEF_EX;/);
ok('DEF_EX block', !!m);
const sandbox = { window: {} };
vm.runInNewContext('const DEF_EX=[' + m[1] + ']; window.DEF_EX=DEF_EX;', sandbox);
const DEF_EX = sandbox.window.DEF_EX;

const chest = DEF_EX.filter((e) => e.cat === 'Klatka piersiowa');
const chestNames = chest.map((e) => e.name);
ok('no Cable crossover display name', !chestNames.some((n) => /^Cable crossover/i.test(n)));
ok('no Floor press display name', !chestNames.includes('Floor press'));
ok('no Peck deck display name', !chestNames.includes('Peck deck'));
ok('no Landmine press display name', !chestNames.includes('Landmine press'));
ok('PL floor press', chestNames.includes('Wyciskanie z podłogi'));
ok('PL cable high-low', chestNames.includes('Krzyżowanie wyciągów góra–dół'));
ok('PL cable low-high', chestNames.includes('Krzyżowanie wyciągów dół–góra'));
ok('PL landmine', chestNames.includes('Wyciskanie landmine'));
ok('PL peck deck', chestNames.includes('Butterfly (peck deck)'));

const floor = DEF_EX.find((e) => e.name === 'Wyciskanie z podłogi');
ok('aka keeps Floor press', floor && /Floor press/i.test(floor.aka || ''));

ok('search blob helper', /function exerciseSearchBlob/.test(six) && /function exerciseSearchNorm/.test(six));
ok('aka in search', /e\.aka/.test(six));
ok('libExerciseByName aka', /aka/.test(core.slice(core.indexOf('function libExerciseByName'), core.indexOf('function ownVideoForExercise'))));

const photos = JSON.parse(photoSrc.match(/window\.EX_PHOTO_MANIFEST=(\{[\s\S]*?\});/)[1]);
ok('photo PL key floor', !!photos['wyciskanie z podłogi']);
ok('photo EN alias floor', !!photos['floor press']);
ok('photo PL cable', !!photos['krzyżowanie wyciągów góra–dół']);

ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=31'));
ok('cache photo', html.includes('ex-photo-manifest.js?v=2'));
ok('cache core', html.includes('01-core.js?v=46'));

const document = { querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
const windowObj = {
  addEventListener() {},
  EX: [],
  DEF_EX,
  EX_GIF_MANIFEST: {},
  EX_GIF_REMOTE: {},
  EX_PHOTO_MANIFEST: photos,
  COACH_VIDEOS: [],
  document,
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  EX: [],
  DEF_EX,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, isNaN, Infinity, undefined,
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);
// Only helpers from 06 (full file needs browser globals)
vm.runInContext(`
function allExercises(){const all=[...(EX||[]),...DEF_EX];const seen=new Set();return all.filter(e=>{if(seen.has(e.name))return false;seen.add(e.name);return true;});}
window.allExercises=allExercises;
function exerciseSearchNorm(s){return String(s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
function exerciseSearchBlob(e){return exerciseSearchNorm([e.name,e.aka,e.cat,e.muscle,e.eq].join(' '));}
function exercisesGroupedByCat(q){
  const ql=exerciseSearchNorm((q||'').trim());
  const all=allExercises();
  const filtered=ql?all.filter(e=>exerciseSearchBlob(e).includes(ql)):all;
  const byCat={};
  filtered.forEach(e=>{const cat=e.cat||'Inne';if(!byCat[cat])byCat[cat]=[];byCat[cat].push(e);});
  return Object.keys(byCat).map(cat=>({cat,items:byCat[cat]}));
}
window.exercisesGroupedByCat=exercisesGroupedByCat;
`, ctx);

ok('lookup PL', !!ctx.libExerciseByName('Wyciskanie z podłogi'));
ok('lookup EN aka', ctx.libExerciseByName('Floor press')?.name === 'Wyciskanie z podłogi');
ok('search finds EN aka', ctx.exercisesGroupedByCat('floor press').some((g) => g.items.some((e) => e.name === 'Wyciskanie z podłogi')));
ok('thumb PL name', /free-exercise-db/.test(ctx.exThumbUrl({ name: 'Wyciskanie z podłogi' }) || ''));

const namesOf = (q) => ctx.exercisesGroupedByCat(q).flatMap((g) => g.items.map((e) => e.name));
ok('search liny', namesOf('liny').includes('Liny treningowe'));
ok('search pajacyki', namesOf('pajacyki').includes('Pajacyki'));
ok('search rower', namesOf('rower').includes('Rower stacjonarny') && namesOf('rower').includes('Airbike'));
ok('search airbike', namesOf('airbike').includes('Airbike'));
ok('search assault', namesOf('assault').includes('Airbike'));
ok('search wioslarz ascii', namesOf('wioslarz').includes('Wioślarz'));
ok('search wioślarz', namesOf('wioślarz').includes('Wioślarz'));
ok('cardio machines in DEF_EX', ['Liny treningowe','Rower stacjonarny','Airbike','Wioślarz','Skakanka'].every((n) => DEF_EX.some((e) => e.name === n)));
ok('search rzut', namesOf('rzut').includes('Rzut piłką o ścianę') && namesOf('rzut').includes('Rzut piłką o podłogę'));
ok('search pilka', namesOf('pilka').includes('Rzut piłką o ścianę'));
ok('search piłka', namesOf('piłka').includes('Rzut piłką o ścianę'));
ok('search wall ball', namesOf('wall ball').includes('Rzut piłką o ścianę'));
ok('search slam', namesOf('slam').includes('Rzut piłką o podłogę'));
ok('ball throws in DEF_EX', ['Rzut piłką o ścianę','Rzut piłką o podłogę','Rzut piłką z klatki','Rzut piłką rotacyjny','Rzut piłką z przysiadu'].every((n) => DEF_EX.some((e) => e.name === n)));
ok('ball throws count', DEF_EX.filter((e) => /^Rzut piłką/.test(e.name)).length >= 12);

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll ex-names-pl tests passed');
