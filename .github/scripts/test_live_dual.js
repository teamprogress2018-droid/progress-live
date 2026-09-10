#!/usr/bin/env node
'use strict';
/** Live dual: dwa niezależne sloty (klient / serie / zapis). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 02 v33', html.includes('02-workouts-onboarding-templates-live.js?v=49'));
ok('cache styles v63', html.includes('styles.css?v=74'));
ok('dual button', html.includes('id="live-dual-btn"') && html.includes('liveToggleDual()'));
ok('pane 0/1', html.includes('id="live-pane-0"') && html.includes('id="live-pane-1"'));
ok('slot B ids', html.includes('id="live-b-timer"') && html.includes('id="live-b-exercises-panel"') && html.includes('id="live-b-start-btn"'));
ok('slot B rest', html.includes('liveStartRest(30,1)') && html.includes('id="live-b-rest-custom"'));
ok('helpers', /function liveN\(/.test(live) && /function liveRef\(/.test(live) && /function liveToggleDual\(/.test(live));
ok('live swap', /function liveSwapEx\(/.test(live));
ok('live add alt', /function liveConfirmAltSearch\(/.test(live) && live.includes('live-alt-search'));
ok('live add name', /function liveSetExName\(/.test(live) && /function liveConfirmExName\(/.test(live) && live.includes('live-ex-name-search'));
ok('draft B key', live.includes("pl_live_draft_b"));
ok('same-client guard', live.includes('Ten klient jest już na drugim ekranie'));
ok('live hides gif caption', /caption:false/.test(live) && css.includes('.live-ex-card .cw-technique-cap') && css.includes('display:none'));
ok('live gif tall', css.includes('max-height:min(70vh, 660px)') && css.includes('min-height:min(68vh, 620px)') && !css.includes('max-height:140px'));
ok('live media beside sets', live.includes('live-ex-body') && live.includes('live-ex-log') && css.includes('.live-ex-body') && css.includes('min-height:min(52vh, 520px)'));
ok('dual gif shorter', css.includes('#screen-live.live-dual .live-ex-card .cw-technique-gif') && css.includes('max-height:min(48vh, 420px)'));
ok('file video wrap', css.includes('.cw-file-player') && css.includes('cw-video-wrap.cw-video-file'));
ok('CI unit', wf.includes('test_live_dual.js'));
ok('CI ui', wf.includes('test_live_dual_ui.js'));
ok('CI live alts ui', wf.includes('test_live_alts_add_ui.js'));
ok('CI live alts collapse', wf.includes('test_live_alts_collapse.js') && wf.includes('test_live_alts_collapse_ui.js'));
ok('CI live video ui', wf.includes('test_live_video_ui.js'));

const m = live.match(/function liveN\(slot\)\{[\s\S]*?\n\}/);
ok('liveN extract', !!m);
const ctx = vm.createContext({});
vm.runInContext(m[0], ctx);
ok('liveN default 0', ctx.liveN() === 0 && ctx.liveN(undefined) === 0 && ctx.liveN(0) === 0);
ok('liveN 1', ctx.liveN(1) === 1 && ctx.liveN('1') === 1);

if (failed) process.exit(1);
console.log('\nAll live-dual checks passed');
