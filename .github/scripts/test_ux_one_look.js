#!/usr/bin/env node
'use strict';
/** Etap 7: jeden wygląd. Ikony liniowe zamiast emoji na pulpicie, jeden czerwony, jedne promienie, Inter w nagłówkach i liczbach. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const globals = read('globals.css');
const styles = read('styles.css');
const theme = read('theme.css');
const core = read('01-core.js');
const portal = read('04-client-portal.js');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

// Ikony
const dash = html.slice(html.indexOf('id="screen-dashboard"'), html.indexOf('id="screen-clients"'));
const emoji = dash.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
ok('no emoji on trainer dashboard', emoji.length === 0, emoji.join(' '));
ok('line icons on dashboard', (dash.match(/class="pl-ico"/g) || []).length >= 8);
ok('getting started list uses line icons', /function renderDashGettingStarted[\s\S]{0,3000}plLineIcon\(/.test(portal));
const s = core.indexOf('const PL_LINE_ICONS'); const e = core.indexOf('function syncNavForClientCount');
const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(core.slice(s, e).replace('const PL_LINE_ICONS', 'var PL_LINE_ICONS'), ctx);
const svg = ctx.plLineIcon('users', 20);
ok('plLineIcon draws a decorative svg', /^<svg class="pl-ico"[^>]*aria-hidden="true"/.test(svg) && svg.includes('stroke="currentColor"') && svg.includes('width="20"'));
ok('unknown icon gives empty string', ctx.plLineIcon('nope') === '');
ok('icons use label grey, not accent', /\.pl-ico \{[^}]*color: var\(--text-label/.test(theme));

// Kolor i promienie
ok('one red in globals', globals.includes('--accent-red: #e60000;') && globals.includes('--accent2: #c40000;'));
ok('one red in styles', styles.includes('--accent-red:#e60000;--accent-red-hover:#c40000;--accent-rgb:230,0,0;'));
ok('two radii: 8 px and 12 px', globals.includes('--r: 8px;') && globals.includes('--r2: 12px;') && styles.includes('--r:8px;--r2:12px;'));
ok('old coloured quick-action classes removed', !/\.qa-(red|blue|green|purple|orange|yellow)\b/.test(styles));
const radii = [...theme.matchAll(/border-radius:\s*(\d+)px/g)].map((m) => +m[1]);
const odd = radii.filter((r) => ![0, 2, 3, 6, 8, 12, 999].includes(r) && r < 50);
ok('theme radii normalised', odd.length === 0, odd.join(','));

// Czcionki
ok('no Bebas Neue in stylesheets', !/Bebas/.test(styles) && !/Bebas/.test(globals));
ok('display font is Inter', globals.includes('--font-display: var(--font-ui);') && theme.includes('--font-display: var(--font-ui'));
ok('inline Bebas overridden', /\.app \[style\*="Bebas Neue"\] \{ font-family: var\(--font-ui\) !important; font-weight: 800/.test(theme));
ok('numbers use tabular figures', /\.app \.stat-val[\s\S]{0,400}font-variant-numeric: tabular-nums/.test(theme));
ok('titles not forced uppercase', /\.app \.topbar-title,[\s\S]{0,120}text-transform: none/.test(theme));

// Błędy
ok('errors use danger colour with icon', /\.app \.research-state-error,[^{]*\{ color: var\(--danger\)/.test(theme) && /\.cs-field-err::before[^{]*\{[^}]*content: "!"/.test(theme));
ok('light danger is #b42318', theme.includes('--danger: #b42318;'));

// Wersje plików
ok('cache versions bumped', ['globals.css?v=', 'styles.css?v=', 'theme.css?v=', '01-core.js?v=', '04-client-portal.js?v='].every((f) => new RegExp(f.replace(/[.?]/g, '\\$&') + '[^"]*ux-look=1"').test(html)));

if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
console.log('\nAll one-look tests passed');
