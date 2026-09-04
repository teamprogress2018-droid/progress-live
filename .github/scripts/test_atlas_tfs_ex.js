#!/usr/bin/env node
'use strict';
/** Atlas TFS POL: missing endurance / INNE / TRX / med-ball / KB names land in DEF_EX (EN aka). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name, extra || '');
    failed++;
  } else console.log('OK  ', name);
}

const m = six.match(/const DEF_EX=\[([\s\S]*?)\];\nwindow\.DEF_EX=DEF_EX;/);
ok('DEF_EX block', !!m);
const sandbox = { window: {} };
vm.runInNewContext('const DEF_EX=[' + m[1] + ']; window.DEF_EX=DEF_EX;', sandbox);
const DEF_EX = sandbox.window.DEF_EX;

function exerciseSearchNorm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
function exerciseSearchBlob(e) {
  return exerciseSearchNorm([e.name, e.aka, e.cat, e.muscle, e.eq].join(' '));
}

ok('library size atlas', DEF_EX.length >= 900, DEF_EX.length);
ok('unique names', new Set(DEF_EX.map((e) => e.name)).size === DEF_EX.length);
ok('cache 06 v38', html.includes('06-inbox-exercises-ai-programs.js?v=61'));
ok('cat Mobilność', six.includes("'Mobilność'") && html.includes('<option>Mobilność</option>'));
ok('mobilność count', DEF_EX.filter((e) => e.cat === 'Mobilność').length >= 80, DEF_EX.filter((e) => e.cat === 'Mobilność').length);
ok('cache 06 v37', html.includes('06-inbox-exercises-ai-programs.js?v=61'));

function findByQuery(q) {
  const n = exerciseSearchNorm(q);
  return DEF_EX.filter((e) => exerciseSearchBlob(e).includes(n));
}

const expect = [
  ['Jumping jacks', 'Pajacyki'],
  ['Bodyweight Man Maker', 'Man maker (masa ciała)'],
  ['Gorilla Burpee', 'Gorilla burpee'],
  ['Skip C in Place', 'Skip C w miejscu'],
  ['Boxing Run', 'Bieg bokserski'],
  ['Jump Rope High Knee', 'Skakanka wysokie kolana'],
  ['Bear Crawl Lateral Walk', 'Chód niedźwiedzia bokiem'],
  ['GHD Hip Extension Bodyweight', 'GHD wyprost bioder'],
  ['Landmine Rainbow Rotation', 'Landmine rainbow'],
  ['Landmine Single Arm Thruster', 'Thruster landmine jednorącz'],
  ['Slider Hamstring Curl', 'Uginanie ud na ślizgach'],
  ['Band Pull Apart', 'Rozciąganie taśmy'],
  ['Seated Band Row', 'Wiosłowanie z taśmą siedząc'],
  ['Band Face Pull to Y Press', 'Face pull do Y z taśmą'],
  ['Dead Bug Banded Arms', 'Martwy robak z taśmą na ramionach'],
  ['TRX Hamstring Curl', 'Uginanie ud TRX'],
  ['TRX Pistol Squat', 'Pistol TRX'],
  ['Ring Scapula Pull Ups', 'Podciąganie łopatkowe na kółkach'],
  ['Swiss Ball Stir The Pot', 'Mieszanie garnka na piłce swiss'],
  ['Swiss Ball Hamstring Leg Curl', 'Uginanie ud na piłce swiss'],
  ['Dual KB Swing', 'Swing kettlebell oburącz dwa dzwonki'],
  ['KB Gorilla Row', 'Wiosłowanie gorilla KB'],
  ['KB American Swing', 'Swing amerykański KB'],
  ['Medicine Ball Chop', 'Siekanie piłką lekarską'],
  ['Wall ball', 'Rzut piłką o ścianę'],
  ['Pallof press', 'Wyciskanie Pallofa'],
  ['Clamshell', 'Muszla (clamshell)'],
  ['TGU', 'Turkish get-up'],
  ['Single Arm DB Thruster', 'Thruster hantlem jednorącz'],
  ['Miniband Air Squat', 'Przysiad powietrzny z mini band'],
  ['DB Man Maker', 'Man maker hantle'],
  ['Kang Squat with Barbell', 'Przysiad Kang ze sztangą'],
  ['NCM - Vertical Jump', 'Skok pionowy NCM'],
  ['Hindu Push Ups', 'Pompki hindu'],
  ['DB Zottman Curls', 'Uginanie Zottman'],
  ['Landing - 2 to 2', 'Lądowanie 2 na 2'],
  ['Wall Handstand', 'Stanie na rękach przy ścianie'],
  ['Skin The Cat', 'Skin the cat'],
  ['Tall Kneeling Pallof Press', 'Pallof w wysokim klęku'],
  ['Plank Walk Up', 'Wejścia w deskę (high to low)'],
  ['Quadruped Hip CARS', 'CARs biodra na czworaka'],
  ['Foam Roll - Foot', 'Foam roller — stopa'],
  ['Jefferson Curl Bodyweight', 'Jefferson curl (masa ciała)'],
  ['Pancake Stretch', 'Pancake (rozciąganie)'],
  ['Bretzel Stretch', 'Bretzel'],
  ['Home - Mobility A', 'Mobilność w domu A'],
];

for (const [q, name] of expect) {
  const hits = findByQuery(q);
  ok('atlas ' + q, hits.some((e) => e.name === name), hits.map((e) => e.name).slice(0, 5).join(', '));
}

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll atlas-tfs-ex tests passed');
