// Regresja: kreator i playerzy muszą trzymać WU/DROP/AMRAP + wskazówkę/film razem z EMOM.
const fs = require('fs');
const path = require('path');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL ' + name);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

const builder = fs.readFileSync(path.join(__dirname, '..', '..', '05-clients-builder-plans-calendar.js'), 'utf8');
const live = fs.readFileSync(path.join(__dirname, '..', '..', '02-workouts-onboarding-templates-live.js'), 'utf8');
const client = fs.readFileSync(path.join(__dirname, '..', '..', '10-client-app.js'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8');

ok('builder has note field', builder.includes('data-f="note"'));
ok('builder has video field', builder.includes('data-f="video"'));
ok('builder has wu field', builder.includes('data-f="wu"'));
ok('builder has drop field', builder.includes('data-f="drop"'));
ok('builder has amrap field', builder.includes('data-f="amrap"'));
ok('builder has emom field', builder.includes('data-f="emom"'));
ok('builderCycleKind exists', /function builderCycleKind\(/.test(builder));
ok('builderToggleAmrap exists', /function builderToggleAmrap\(/.test(builder));
ok('builderPaintKinds exists', /function builderPaintKinds\(/.test(builder));
ok('savePlan persists note', /note:g\('note'\)/.test(builder));
ok('savePlan persists wu', /wu:g\('ss'\)\?0:/.test(builder));
ok('live uses setKindBadge', live.includes('setKindBadge'));
ok('live uses skipRestBeforeSet', live.includes('skipRestBeforeSet'));
ok('live uses restSecAfterSet', live.includes('restSecAfterSet'));
ok('live shows coach note without film toggle', /coachMediaHtml\(ex,\s*\{\s*showVideo:!!ex\.showVideo\s*\}/.test(live));
ok('client uses setKindBadge', client.includes('setKindBadge'));
ok('client skip drop rest', client.includes('skipRestBeforeSet'));
ok('client AMRAP placeholder', client.includes("placeholder=\"${s.kind==='amrap'?'max':''}\"") || client.includes("placeholder=\"${s.kind==='amrap'?'max':''}"));
ok('core expandExerciseSets exists', /function expandExerciseSets\(/.test(core));
ok('core resolveCoachMedia returns note', core.includes('return{note,libTip,video'));

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy wiring kreatora/playera OK.');
