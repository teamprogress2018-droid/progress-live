#!/usr/bin/env node
'use strict';
/** Układ 2.0: lista klientów — panel widoków, filtry, menu „Dodaj klienta”, kolumny. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'theme.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

const screen = html.slice(html.indexOf('id="screen-clients"'), html.indexOf('<!-- PLANS -->'));
ok('second column with views', screen.includes('class="cl-subnav"') && screen.includes('id="client-filter-list"') && screen.includes('id="client-attn-chips"'));
ok('client app link + copy', screen.includes('id="cl-app-link"') && screen.includes('copyClientAppLink()'));
ok('title with count in brackets', /id="clients-segment-title"[^>]*>Wszyscy klienci <span class="cl-title-count">\(<span id="clients-segment-count">0<\/span>\)<\/span>/.test(screen));
ok('panel toggle has ARIA', /id="cl-subnav-toggle"[^>]*aria-controls="cl-subnav"[^>]*aria-expanded="true"/.test(screen));
ok('filter chips: status, goal, attention', screen.includes('id="client-status-filter"') && screen.includes('id="client-goal-filter"') && screen.includes('id="client-attn-filter"'));
ok('hide filters link', screen.includes('id="cl-filters-toggle"') && screen.includes('Ukryj filtry'));
ok('search labelled', /id="client-search"/.test(screen) && /aria-label="Szukaj klienta"[^>]*id="client-search"/.test(screen));
ok('add client split button keeps import', screen.includes("openM('m-client')") && screen.includes("openM('m-fitebo')") && /id="cl-add-caret"[^>]*aria-haspopup="true"/.test(screen));
ok('columns menu', screen.includes('id="cl-cols-btn"') && screen.includes('id="cl-cols-menu"'));
ok('table header unchanged', screen.includes('Trening 7 dni') && screen.includes('Trening 30 dni') && screen.includes('Zadania 7 dni'));
ok('top icons labelled', (screen.match(/class="cl-top-icon"[^>]*aria-label="/g) || []).length === 5);

ok('goal filter in renderClients', src05.includes("if(clientGoalFilter&&c.goal!==clientGoalFilter)return false;"));
ok('views clear attention, status select keeps it', /function pickClientSegment\(seg\)\{clientAttention=null;setClientSegment\(seg\);\}/.test(src05) && /function setClientSegment\(seg\)\{clientSegment=seg;renderClientFilters\(\);renderClients\(\);\}/.test(src05));
ok('ui prefs remembered', ['pl_clients_subnav', 'pl_clients_filters', 'pl_clients_hidden_cols'].every((k) => src05.includes(k)));
ok('mobile hides second column', /@media \(max-width: 900px\) \{\s*\.cl-subnav,\s*\.cl-subnav-toggle \{ display: none; \}/.test(theme));
ok('phone list fits', theme.includes('@media (max-width: 600px)') && theme.includes('grid-template-columns: minmax(0, 1fr) 44px minmax(96px, auto)'));
ok('flyout dark in both themes', /\.nav-flyout,\s*html\[data-theme="light"\] \.nav-flyout \{\s*background: #16181d;/.test(theme));
ok('CI runs layout tests', wf.includes('test_layout_v2.js') && wf.includes('test_layout_v2_ui.js'));

// Logika filtrów i kolumn na atrapie DOM
const els = {};
function el(id) {
  if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '', hidden: false, classList: { _s: new Set(), toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); } }, style: { props: {}, setProperty(k, v) { this.props[k] = v; } }, setAttribute(k, v) { this[k] = v; }, focus() {}, select() {} };
  return els[id];
}
const store = {};
const ctx = {
  console, window: {}, CL: [
    { id: 'a', name: 'Anna', status: 'active', goal: 'redukcja' },
    { id: 'b', name: 'Jan', status: 'active', goal: 'sila' },
    { id: 'c', name: 'Ola', status: 'archived', goal: 'sila' },
  ],
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  document: { readyState: 'complete', getElementById: el, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} },
  escHtml: (s) => String(s), clientAppUrl: () => 'https://example.org/app/',
};
ctx.window = ctx;
vm.createContext(ctx);
const start = src05.indexOf('var clientSegment=');
const filtersStart = src05.indexOf('function renderClientFilters(attnMap){');
const filtersEnd = src05.indexOf('function filterClients(){');
vm.runInContext(src05.slice(start, src05.indexOf('function attnShortDate')) + src05.slice(filtersStart, filtersEnd)
  + ';var _rendered=0;function renderClients(){_rendered++;}function clientAttentionMap(){return new Map([["a",{"attn-regres":{reason:"x"}}]]);}', ctx);

vm.runInContext("renderClientFilters()", ctx);
ok('segments rendered with counts', /Wszyscy klienci<\/span><span class="cl-seg-n">2</.test(els['client-filter-list'].innerHTML) && /Zarchiwizowani<\/span><span class="cl-seg-n">1</.test(els['client-filter-list'].innerHTML));
ok('attention select lists counts', els['client-attn-filter'].innerHTML.includes('Regres (1)'));
ok('client app link without protocol', els['cl-app-link'].textContent === 'example.org/app/');
vm.runInContext("setClientAttention('attn-regres');setClientSegment('active')", ctx);
ok('status select keeps attention filter', vm.runInContext('clientAttention', ctx) === 'attn-regres');
vm.runInContext("pickClientSegment('all')", ctx);
ok('view pick clears attention', vm.runInContext('clientAttention', ctx) === null);
vm.runInContext("setClientAttentionValue('attn-regres');setClientAttentionValue('attn-regres')", ctx);
ok('attention select is idempotent', vm.runInContext('clientAttention', ctx) === 'attn-regres');
vm.runInContext("setClientAttentionValue('')", ctx);
ok('attention select clears', vm.runInContext('clientAttention', ctx) === null);
vm.runInContext("setClientGoalFilter('sila')", ctx);
ok('goal filter stored', vm.runInContext('clientGoalFilter', ctx) === 'sila');

vm.runInContext("toggleClientColumn(4,false);toggleClientColumn(7,false)", ctx);
ok('hidden columns remembered', store.pl_clients_hidden_cols === '4,7', store.pl_clients_hidden_cols);
ok('grid shrinks with hidden columns', els['cl-everfit'].style.props['--cl-cols'].split(' ').filter((x) => x).length === 6, els['cl-everfit'].style.props['--cl-cols']);
ok('hide classes set', els['cl-everfit'].classList.contains('cl-hide-4') && els['cl-everfit'].classList.contains('cl-hide-7') && !els['cl-everfit'].classList.contains('cl-hide-3'));
vm.runInContext("toggleClientColumn(4,true)", ctx);
ok('column comes back', store.pl_clients_hidden_cols === '7' && !els['cl-everfit'].classList.contains('cl-hide-4'));

vm.runInContext("toggleClientSubnav()", ctx);
ok('panel hides and remembers', els['cl-shell'].classList.contains('cl-subnav-off') && store.pl_clients_subnav === '0' && els['cl-subnav-toggle']['aria-expanded'] === 'false');
vm.runInContext("toggleClientFilters()", ctx);
// Ukryte filtry pokazują liczbę aktywnych (tu: cel „siła”) zamiast samego „Pokaż filtry”.
ok('filters hide and remember', els['cl-filter-chips'].hidden === true && store.pl_clients_filters === '0' && els['cl-filters-toggle'].textContent === 'Filtry (1)', els['cl-filters-toggle'].textContent);
// Po zalogowaniu (wczytaniu danych trenera) aplikacja ma wejść na listę klientów, nie na Pulpit
const loginTail = html.slice(html.indexOf("window.applyAuthToTrainerProfile();"), html.indexOf("window.consumeClientPreviewHash();"));
ok('login lands on client list', loginTail.includes("goTo('clients')") && !loginTail.includes("goTo('dashboard')"));
const core01 = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const exitPrev = core01.slice(core01.indexOf('function exitClientPreviewMode'), core01.indexOf('window.exitClientPreviewMode='));
ok('leaving client preview returns to client list', exitPrev.includes("goTo('clients')") && !exitPrev.includes("goTo('dashboard')"));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll layout-v2 tests passed');
