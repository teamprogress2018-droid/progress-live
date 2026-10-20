#!/usr/bin/env node
'use strict';
/** Live: tryb Przygotowanie / Trening — karta, serie, przerwa, zakończenie. */
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

ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=108'));
ok('cache styles', html.includes('styles.css?v=178'));
ok('mobile end sheet keeps save action reachable', css.includes('.live-end-actions{position:sticky') && css.includes('.live-end-actions .btn{flex:1;min-height:48px;}'));
ok('prep/train classes', html.includes('live-prep-only') && html.includes('live-train-only') && /live-session-on/.test(live) && /live-session-on/.test(css));
ok('start stays prep', html.includes('live-prep-only" id="live-start-btn"') || /id="live-start-btn"[^>]*live-prep-only/.test(html));
ok('save training action is explicit', html.includes('Zapisz trening') && /function liveAskEndSession\(/.test(live) && live.includes("end.textContent='Zapisz trening'"));
ok('more menu', html.includes('id="live-more-menu"') && html.includes('liveToggleMoreMenu()') && html.includes('Dwie osoby') && html.includes('Harmonogram periodyzacji'));
ok('more menus close with Escape and restore focus', /function liveCloseMoreMenusOnEscape\(event\)/.test(live) && live.includes("if(event.key!=='Escape')return;") && live.includes("returnFocus.focus();"));
ok('mobile preparation keeps history and two-person mode behind a reversible more menu', html.includes('id="live-prep-more-menu"') && html.includes('id="live-prep-more-btn"') && /function liveTogglePrepMoreMenu\(/.test(live) && live.includes("live-history-view") && css.includes('#screen-live:not(.live-session-on):not(.live-history-view) .live-view-tabs'));
ok('client view in train bar', html.includes('id="live-client-view-btn"') && html.includes('Widok klienta'));
ok('mobile train bar keeps client view in the more menu', /id="live-more-menu"[\s\S]*📱 Widok klienta/.test(html) && css.includes('#screen-live.live-session-on #live-client-view-btn{display:none;}'));
ok('left picker hidden in session', css.includes('#screen-live.live-session-on .live-side-left') && css.includes('display:none !important'));
ok('sidebar collapsed in session', css.includes('#app-root:has(#screen-live.active.live-session-on) .sidebar'));
ok('timer hidden before start', /live-train-only[\s\S]*id="live-timer"|id="live-timer"/.test(html) && html.includes('id="live-timer-status" hidden'));
ok('suggested day not red fill', css.includes('.live-prep-day.is-today') && /box-shadow:0 0 0 1px rgba\(255,255,255/.test(css));
ok('mobile plan summary stays on one compact line and keeps the plan picker available', css.includes('.live-prep-summary>span:first-child{display:flex;align-items:baseline') && css.includes('.live-prep-summary strong{min-width:0;overflow:hidden;text-overflow:ellipsis') && /live-prep-board/.test(live));
ok('mobile plan toolbar is compact without hiding add exercise', live.includes('live-add-exercise') && live.includes('aria-label="Dodaj ćwiczenie"') && css.includes('.live-add-exercise-short{display:inline;}'));
ok('timer color neutral', /\.live-timer-val\{[^}]*color:var\(--text-primary\)/.test(css.replace(/\s+/g, '')));

ok('swap under one button', /live-swap-open/.test(live) && /function liveToggleSwap\(/.test(live) && live.includes('>Zamień</button>'));
ok('target line helper', /function liveExTargetLine\(/.test(live) && /RIR /.test(live));
ok('no praca on live card', !/Praca \$\{/.test(live) && /liveExTargetLine/.test(live));
ok('first-time cue', live.includes('Brak historii w tym planie'));
ok('last cue one line', /Ostatnio:/.test(live) && /live-suggestion/.test(live));
ok('no ZA MAŁO on strip', /function liveExCueStripHtml\(/.test(live)
  && !/ZA MAŁO DANYCH/.test(live.slice(live.indexOf('function liveExCueStripHtml'), live.indexOf('window.liveExCueStripHtml'))));
ok('coach note polish', /function livePolishCoachNote\(/.test(live) && live.includes('akcent na rozciągnięcie mięśnia'));
ok('prep scans compact cards while the live session opens the current exercise', /else if\(ex\.collapsed==null\)ex\.collapsed=true/.test(live) && /const isFocus=st\.sessionActive&&isCurrent/.test(live) && /st\.sessionActive\)ex\.collapsed=/.test(live));
ok('set row 5 cols', css.includes('grid-template-columns:minmax(64px,0.8fr) minmax(72px,1fr) minmax(72px,1fr) minmax(56px,0.8fr) 64px'));
ok('big check', css.includes('min-height:56px') && /live-set-check/.test(live) && /liveToggleSet\(/.test(live));
ok('delete in set menu', /function liveToggleSetMenu\(/.test(live) && /function liveSetHoldStart\(/.test(live) && live.includes('Usuń serię'));
ok('no rest icon in row', !/live-set-rest/.test(live.slice(live.indexOf('function liveExCard'), live.indexOf('window.liveExCard'))));
ok('toggle set starts rest', /function liveToggleSet\(/.test(live) && /liveStartRest\(sec,n\)/.test(live) && /restSecAfterSet/.test(live));
ok('rest strip', html.includes('id="live-rest-strip"') && html.includes('liveAdjustRest(-15)') && html.includes('Pomiń') && /function liveShowRestStrip\(/.test(live));
ok('presets in more menu', /id="live-more-menu"[\s\S]*liveStartRest\(30\)/.test(html) && html.includes('live-rest-preset'));
ok('end overlay notes', html.includes('id="live-end-overlay"') && html.includes('Notatka do sesji') && html.includes('Feedback klienta') && /function liveConfirmEnd\(/.test(live));
ok('exercise history, trainer note and settings stay on demand in the three-dot menu', live.includes("liveToggleExPanel(${i},'history'") && live.includes("liveToggleExPanel(${i},'coach'") && live.includes("liveToggleExPanel(${i},'settings'") && /function liveToggleExPanel\(/.test(live) && !live.includes('live-focus-cue-simple'));
ok('technique media is opt-in and only appears when it exists', /const mediaOpen=!needsName&&hasTechniqueMedia&&!!ex\.showVideo/.test(live) && live.includes('live-ex-technique-thumb') && live.includes("if(!media||!(media.gif||media.video||media.videoEmbed))return;") && css.includes('.live-ex-technique-thumb::after'));
ok('current exercise shows compact whole-session progress', /liveExCard\(ex,i,n,cue,stats\)/.test(live) && /function liveExCard\(ex,i,slot,cue,progress\)/.test(live) && live.includes('live-session-progress') && css.includes('.live-ex-collapsed-meta .live-session-progress'));
ok('swipe is a reversible shortcut to the visible substitute action', live.includes('onpointerdown="liveSwipeStart(event,${i}${sl})"') && /function liveSwipeEnd\(/.test(live) && live.includes('if(!ex.swapOpen)liveToggleSwap(i,slot);') && live.includes('if(ex.suppressCollapse){ex.suppressCollapse=false;return;}') && css.includes('.live-ex-head{touch-action:pan-y;}'));
ok('first hint once', html.includes('id="live-first-hint"') && /pl_live_first_hint/.test(live));
ok('end keeps serialize', /serializeLoggedExercise\(e,\s*\{onlyDone:\s*true\}\)/.test(live));
ok('CI unit', wf.includes('test_live_prep_train.js'));

const tStart = live.indexOf('function liveExTargetLine');
const tEnd = live.indexOf('window.liveExTargetLine');
const targetSrc = live.slice(tStart, tEnd);
ok('target uses RIR only', /RIR /.test(targetSrc) && !/\bRPE\b/.test(targetSrc) && !/Praca /.test(targetSrc));

const ctx = vm.createContext({
  window: {},
  Number, String, Math, parseInt, parseFloat, isNaN,
  plannedRir(ex) {
    const rpe = parseFloat(ex && ex.rpe);
    if (ex && ex.rir) return String(ex.rir);
    if (Number.isFinite(rpe)) return String(10 - rpe);
    return '';
  },
  exerciseCoachHints(ex) { return { restLabel: (ex && ex.rest) || '90 s' }; },
  liveExPlannedReps() { return '10'; },
  liveExTodayKg(ex) { return (ex && ex.kg) || ''; }
});
vm.runInContext(targetSrc + '\nthis.liveExTargetLine=liveExTargetLine;', ctx);
const line = ctx.liveExTargetLine({ sets: [{}, {}, {}], rpe: '8', kg: '35', tempo: '3-1-1-0', rest: '90 s' }, 0);
ok('display RIR from RPE', /RIR 2/.test(line) && !/RPE/.test(line), line);
ok('target has series rest tempo', /3 × 10/.test(line) && /35 kg/.test(line) && /3-1-1-0/.test(line) && /przerwa/.test(line), line);

const cueStart = live.indexOf('function liveExCueStripHtml');
const cueEnd = live.indexOf('window.liveExCueStripHtml');
ok('cue html has no ZA MAŁO', !/ZA MAŁO DANYCH/.test(live.slice(cueStart, cueEnd)));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll live-prep-train tests passed');
