#!/usr/bin/env node
'use strict';
/** Live: max 3 zamienniki, reszta pod „Więcej opcji”. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=54'));
ok('cache styles', html.includes('styles.css?v=77'));
ok('LIVE_ALT_MAX 3', /const LIVE_ALT_MAX=3/.test(live));
ok('toggle helper', /function liveToggleAlts\(/.test(live) && /function liveAltsToShow\(/.test(live));
ok('more css', css.includes('.live-alts-more'));
ok('swap resets expand', /cur\.altsExpanded=false/.test(live));
ok('CI unit', wf.includes('test_live_alts_collapse.js'));
ok('CI ui', wf.includes('test_live_alts_collapse_ui.js'));

const start = live.indexOf('const LIVE_ALT_MAX=3;');
const end = live.indexOf('window.liveToggleAlts=liveToggleAlts;');
ok('extract', start >= 0 && end > start);
const ctx = vm.createContext({
  liveN(slot){ return slot === 1 || slot === '1' ? 1 : 0; },
  liveSlotArg(slot){ return (slot === 1 || slot === '1') ? ',1' : ''; },
  escHtml(s){
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  window: {}
});
vm.runInContext(live.slice(start, end) + '\nwindow.liveToggleAlts=liveToggleAlts;', ctx);

const eight = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
ok('show 3 collapsed', JSON.stringify(ctx.liveAltsToShow(eight, false)) === JSON.stringify(['A', 'B', 'C']));
ok('show all expanded', ctx.liveAltsToShow(eight, true).length === 8);
ok('show all when few', ctx.liveAltsToShow(['A', 'B'], false).length === 2);

const collapsed = ctx.liveAltsHtml({ name: 'Maszyna', alts: eight }, 0, 0);
const chipRe = /class="live-alt-chip"/g;
ok('collapsed 3 chips', (collapsed.match(chipRe) || []).length === 3);
ok('collapsed more btn', /Więcej opcji · 5/.test(collapsed) && /aria-expanded="false"/.test(collapsed));
ok('collapsed hides rest', !/↻ D/.test(collapsed) && /↻ C/.test(collapsed));

const expanded = ctx.liveAltsHtml({ name: 'Maszyna', alts: eight, altsExpanded: true }, 0, 0);
ok('expanded 8 chips', (expanded.match(chipRe) || []).length === 8);
ok('expanded zwin', /liveToggleAlts\(0\)/.test(expanded) && />Zwiń</.test(expanded) && /aria-expanded="true"/.test(expanded));

const few = ctx.liveAltsHtml({ name: 'Pompki', alts: ['A', 'B', 'C'] }, 2, 0);
ok('three no more', (few.match(chipRe) || []).length === 3 && !/live-alts-more/.test(few));

const slotB = ctx.liveAltsHtml({ name: 'Maszyna', alts: eight }, 1, 1);
ok('slot B toggle', /liveToggleAlts\(1,1\)/.test(slotB) && /liveSwapEx\(1,&quot;A&quot;,1\)/.test(slotB));
ok('onclick quoted', /liveSwapEx\(0,&quot;A&quot;\)/.test(collapsed));

if (failed) process.exit(1);
console.log('\nLive alts collapse OK');
