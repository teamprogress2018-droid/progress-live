#!/usr/bin/env node
'use strict';
/** Sygnał końca przerwy Live: faza, głos + beep, puls karty. */
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

ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=63'));
ok('cache styles', html.includes('styles.css?v=80'));
ok('aria live A', html.includes('id="live-rest-timer" aria-live="assertive"'));
ok('aria live B', html.includes('id="live-b-rest-timer" aria-live="assertive"'));
ok('phase helper', /function liveRestPhase\(/.test(live));
ok('cue helper', /function liveRestCue\(/.test(live));
ok('beep helper', /function liveRestBeep\(/.test(live) && live.includes('AudioContext'));
ok('paint helper', /function liveRestPaint\(/.test(live));
ok('go label helper', /function liveRestLabel\(/.test(live) && /LET'S GO/.test(live));
ok('speak text helper', /function liveRestSpeakText\(/.test(live) && live.includes("Let's go!") && live.includes('Jazda!'));
ok('speak helper', /function liveRestSpeak\(/.test(live) && live.includes('speechSynthesis'));
ok('start uses label', /liveRestLabel\(left\)/.test(live) && /liveRestLabel\(0\)/.test(live));
ok('start speak and beep', /liveRestSpeak\(left\)/.test(live) && /liveRestBeep\(cue\)/.test(live) && !/if\(!spoken\)liveRestBeep/.test(live));
ok('css pulse', css.includes('@keyframes live-rest-pulse') && css.includes('.live-rest-card.is-ending'));
ok('css go', css.includes('@keyframes live-rest-go') && css.includes('.live-rest-card.is-go'));
ok('CI unit', wf.includes('test_live_rest_signal.js'));
ok('CI ui', wf.includes('test_live_rest_ui.js'));

const slice = live.match(/function liveRestPhase\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestPhase=liveRestPhase;\n\nfunction liveRestCue\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestCue=liveRestCue;\n\nfunction liveRestLabel\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestLabel=liveRestLabel;\n\nfunction liveRestSpeakText\(sec\)\{[\s\S]*?\n\}\nwindow\.liveRestSpeakText=liveRestSpeakText;/);
ok('extract phase+cue+speak', !!slice);
const ctx = vm.createContext({ window: { SETTINGS: { live: { restVoice: 'pl' } } }, Number, String, Math });
vm.runInContext(slice[0], ctx);
ok('90s run', ctx.liveRestPhase(90) === 'run' && ctx.liveRestCue(90) === '');
ok('10s warn silent', ctx.liveRestPhase(10) === 'warn' && ctx.liveRestCue(10) === '');
ok('5s ending tick', ctx.liveRestPhase(5) === 'ending' && ctx.liveRestCue(5) === 'tick');
ok('1s ending tick', ctx.liveRestPhase(1) === 'ending' && ctx.liveRestCue(1) === 'tick');
ok('0s go', ctx.liveRestPhase(0) === 'go' && ctx.liveRestCue(0) === 'go');
ok('90s still seconds', ctx.liveRestLabel(90) === '90s');
ok('3s READY', ctx.liveRestLabel(3) === 'READY');
ok('2s SET', ctx.liveRestLabel(2) === 'SET');
ok('1s GO', ctx.liveRestLabel(1) === 'GO');
ok("0s LET'S GO", ctx.liveRestLabel(0) === "LET'S GO!");
ok('90s no speak', ctx.liveRestSpeakText(90) === '');
ok('5s Pięć', ctx.liveRestSpeakText(5) === 'Pięć');
ok('4s Cztery', ctx.liveRestSpeakText(4) === 'Cztery');
ok('3s Gotowi', ctx.liveRestSpeakText(3) === 'Gotowi');
ok('2s Uwaga', ctx.liveRestSpeakText(2) === 'Uwaga');
ok('1s Start', ctx.liveRestSpeakText(1) === 'Start');
ok('0s Jazda', ctx.liveRestSpeakText(0) === 'Jazda!');
ctx.window.SETTINGS.live.restVoice = 'en';
ok('5s Five EN', ctx.liveRestSpeakText(5) === 'Five');
ok('4s Four EN', ctx.liveRestSpeakText(4) === 'Four');
ok('3s Ready EN', ctx.liveRestSpeakText(3) === 'Ready');
ok("0s Let's go EN", ctx.liveRestSpeakText(0) === "Let's go!");
ctx.window.SETTINGS.live.restVoice = 'off';
ok('off no speak', ctx.liveRestSpeakText(0) === '');
ctx.window.SETTINGS.live.restVoice = '';
ok('empty falls back to Five EN', ctx.liveRestSpeakText(5) === 'Five');

if (failed) process.exit(1);
console.log('\nAll live-rest-signal tests passed');
