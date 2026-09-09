#!/usr/bin/env node
'use strict';
/** Sygnał końca przerwy Live: faza, beep, puls karty. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=48'));
ok('cache styles', html.includes('styles.css?v=73'));
ok('aria live A', html.includes('id="live-rest-timer" aria-live="assertive"'));
ok('aria live B', html.includes('id="live-b-rest-timer" aria-live="assertive"'));
ok('phase helper', /function liveRestPhase\(/.test(live));
ok('cue helper', /function liveRestCue\(/.test(live));
ok('beep helper', /function liveRestBeep\(/.test(live) && live.includes('AudioContext'));
ok('paint helper', /function liveRestPaint\(/.test(live));
ok('start uses cue', /liveRestCue\(left\)/.test(live) && /liveRestBeep\(cue\)/.test(live));
ok('css pulse', css.includes('@keyframes live-rest-pulse') && css.includes('.live-rest-card.is-ending'));
ok('css go', css.includes('@keyframes live-rest-go') && css.includes('.live-rest-card.is-go'));
ok('CI unit', wf.includes('test_live_rest_signal.js'));
ok('CI ui', wf.includes('test_live_rest_ui.js'));

const slice = live.match(/function liveRestPhase\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestPhase=liveRestPhase;\n\nfunction liveRestCue\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestCue=liveRestCue;/);
ok('extract phase+cue', !!slice);
const ctx = vm.createContext({ window: {}, Number, String, Math });
vm.runInContext(slice[0], ctx);
ok('90s run', ctx.liveRestPhase(90) === 'run' && ctx.liveRestCue(90) === '');
ok('10s warn silent', ctx.liveRestPhase(10) === 'warn' && ctx.liveRestCue(10) === '');
ok('5s ending tick', ctx.liveRestPhase(5) === 'ending' && ctx.liveRestCue(5) === 'tick');
ok('1s ending tick', ctx.liveRestPhase(1) === 'ending' && ctx.liveRestCue(1) === 'tick');
ok('0s go', ctx.liveRestPhase(0) === 'go' && ctx.liveRestCue(0) === 'go');

if (failed) process.exit(1);
console.log('\nAll live-rest-signal tests passed');
