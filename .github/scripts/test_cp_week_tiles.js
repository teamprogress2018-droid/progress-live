#!/usr/bin/env node
'use strict';
/** Zakładka Treningi: 4 stany kafelków, pasek, Plan/Historia. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');
const train = src08.slice(src08.indexOf('function renderCPTraining'), src08.indexOf('function cpMpView'));

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

ok('ci unit', wf.includes('test_cp_week_tiles.js'));
ok('ci ui', wf.includes('test_cp_week_tiles_ui.js'));
ok('cache 08/styles', html.includes('08-client-profile-extras.js?v=83') && html.includes('styles.css?v=115'));
ok('plan historia', />Plan</.test(train) && />Historia</.test(train) && !/>Assignment</.test(train));
ok('week arrows', /cpMpShiftWeek/.test(train) && /Poprzedni tydzień/.test(train));
ok('no client in range helper', /cpOverviewPlanTitle/.test(train));
ok('more menu clear', /cp-mp-more-menu/.test(train) && /Usuń terminy planu/.test(train));
ok('plus session stays', train.includes('+ Sesja'));
ok('no red legend', !/Czerwone karty to/.test(train) && !/Brak zapisu treningu/.test(src08.slice(src08.indexOf('function renderCPTraining'))));
ok('nolog banner', /bez zapisu — uzupełnij/.test(train) && /scrollToFirstUnloggedTile/.test(src08));
ok('two stats', /Realizacja planu w wybranym tygodniu do dziś/.test(train) && /Realizacja planu · ostatnie 30 dni/.test(train));
ok('states', /is-\$\{state\}/.test(train) && /state==='nolog'/.test(train) && /state==='today'/.test(train) && /state==='future'/.test(train) && /state==='done'/.test(train) && /state==='skip'/.test(train));
ok('labels', train.includes('Niezapisany') && train.includes('Zaplanowany') && train.includes('Opuszczony') && train.includes('Nie odbył się') && train.includes('Rozpocznij Live'));
ok('no PLAN badge', !/PLAN/.test(train) && !/toUpperCase\(\)/.test(train));
ok('future no odbył', /state==='nolog'\|\|state==='today'/.test(train.replace(/\s+/g, '')));
ok('skip helper', /function markCpSessionSkipped/.test(src08));
ok('css tiles', css.includes('.cp-week-tile') && css.includes('min-height:120px') && css.includes('.cp-week-tile.is-nolog') && css.includes('.cp-week-tile.is-today') && css.includes('.cp-week-tile.is-skip'));
ok('css no mono on tile name', /\.cp-week-tile\{[^}]*font-family:var\(--font-ui\)/.test(css) && !/\.cp-week-tile-name\{[^}]*DM Mono/.test(css));
ok('css font 13', /\.cp-week-tile-name\{[^}]*font-size:13px/.test(css));

if (failed) process.exit(1);
console.log('\nAll cp-week-tiles tests passed');
