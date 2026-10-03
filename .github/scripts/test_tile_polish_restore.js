#!/usr/bin/env node
/** Ensure Everfit-layout tiles keep design-system fonts + card contours. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '../..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
  console.log('OK  ', msg);
}

assert(/\.cp-ov-card,\s*\.cp-ov-rail-card\{[^}]*box-shadow:var\(--panel-glow\)/.test(css), 'overview cards use panel-glow');
assert(/\.cp-ov-card,\s*\.cp-ov-rail-card\{[^}]*border:1px solid var\(--border-subtle\)/.test(css), 'overview cards use border-subtle');
assert(/\.cp-ov-card,\s*\.cp-ov-rail-card\{[^}]*background:var\(--bg-card\)/.test(css), 'overview cards use bg-card');
assert(/\.cp-ov-metric\{[^}]*border:1px solid var\(--border-subtle\)/.test(css), 'metric tiles have subtle border');
assert(/\.cp-ov-metric-lbl\{[^}]*font-family:var\(--font-ui\)/.test(css), 'metric labels use --font-ui');
assert(/\.cp-ov-stat-lbl\{[^}]*font-family:var\(--font-ui\)/.test(css), 'stat labels use --font-ui');
assert(/\.cp-ov-stat-num\{[^}]*font-family:var\(--font-display\)/.test(css), 'stat numbers use --font-display');
assert(/\.cp-ov-metric-val\{[^}]*font-family:var\(--font-display\)/.test(css), 'metric values use --font-display');
assert(!/\.cp-ov-[^{]*\{[^}]*font-family:'DM Mono'/.test(css), 'no DM Mono on overview tiles');
assert(!/\.cp-tab\{[^}]*font-family:'DM Sans'/.test(css), 'tabs use design-system font');
assert(/\.cp-tab\{[^}]*font-family:var\(--font-ui\)/.test(css), 'tabs use --font-ui');
assert(/\.tbl-row\.cl-everfit-row\{[^}]*box-shadow:var\(--panel-glow\)/.test(css), 'client rows keep panel-glow');
assert(/\.cl-pct\{[^}]*font-family:var\(--font-ui\)/.test(css), 'client pct uses --font-ui');
assert(/\.nav-flyout-item\{[^}]*font-family:var\(--font-ui\)/.test(css), 'library flyout uses --font-ui');

console.log('\nAll tile-polish-restore tests passed');
