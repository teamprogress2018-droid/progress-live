#!/usr/bin/env node
'use strict';
/** Biblioteka na telefonie i tablecie (audyt 18.10, pakiet C): filtry pod przyciskiem,
 *  brak przesuwania strony w bok, większe cele dotykowe. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const core = read('01-core.js');
const six = read('06-inbox-exercises-ai-programs.js');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('ci unit', wf.includes('test_lib_telefon_tablet.js'));
ok('ci ui', wf.includes('test_lib_telefon_tablet_ui.js'));
ok('cache styles', html.includes('styles.css?v=161'));
ok('cache core', html.includes('01-core.js?v=136'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=101'));

function section(id) {
  const a = html.indexOf('<div class="screen" id="screen-' + id + '">');
  const b = html.indexOf('<div class="screen"', a + 10);
  return a >= 0 ? html.slice(a, b) : '';
}
['library', 'programs', 'templates', 'tasks', 'forms', 'metrics'].forEach((id) => {
  const s = section(id);
  ok(id + ' has filters button', /class="btn btn-ghost btn-sm lib-filters-btn"[^>]*onclick="libTogglePanel\(this,'filters'\)"/.test(s));
  ok(id + ' has split + filters panel', s.includes('lib-split') && /class="(lib-side )?lib-filters/.test(s));
});
ok('metrics quick entry toggles', /libTogglePanel\(this,'aside'\)/.test(section('metrics')) && section('metrics').includes('class="lib-aside"'));
['prog-search', 'form-search', 'task-search', 'metric-client-sel-search'].forEach((id) => {
  const i = html.indexOf('id="' + id + '"');
  const row = html.lastIndexOf('lib-search-row', i);
  ok(id + ' stays visible on phone', row > 0 && i - row < 400);
});

ok('button hidden on desktop', css.includes('.lib-filters-btn{display:none;}'));
ok('panel collapses under 760px', /@media\(max-width:760px\)\{\s*\.lib-filters-btn\{display:inline-flex;/.test(css) && css.includes('.lib-split>.lib-filters,.lib-split>.lib-aside{display:none!important;}'));
ok('open panel shown full width', css.includes('.screen.lib-open-filters .lib-split>.lib-filters,'));
ok('detail panels clipped', css.includes('#screen-programs,#screen-forms,#screen-templates{position:relative;}') && css.includes('#prog-detail,#form-detail,#tpl-detail{max-width:100%;}'));
ok('touch targets 44px', /@media\(pointer:coarse\)\{[\s\S]{0,400}min-height:44px;/.test(css) && /\.modal-close,\.exd-close\{min-width:44px;min-height:44px;/.test(css));
ok('videos tab hides filters button', /filtersBtn\.hidden=videos;/.test(six));

// libTogglePanel / libClosePanels
const a = core.indexOf('const LIB_PANEL_MQ');
const b = core.indexOf('if(typeof document', a);
const src = core.slice(a, b);
ok('core slice', a > 0 && b > a);
function el() {
  const set = new Set();
  const attrs = {};
  return {
    classList: { contains: (c) => set.has(c), add: (c) => set.add(c), remove: (...c) => c.forEach((x) => set.delete(x)) },
    setAttribute: (k, v) => { attrs[k] = v; },
    attrs
  };
}
const screen = el();
const b1 = el();
const b2 = el();
b1.closest = b2.closest = () => screen;
screen.querySelectorAll = () => [b1, b2];
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
ok('opens filters', ctx.libTogglePanel(b1, 'filters') === true && screen.classList.contains('lib-open-filters') && b1.attrs['aria-expanded'] === 'true');
ok('aside replaces filters', ctx.libTogglePanel(b2, 'aside') === true && screen.classList.contains('lib-open-aside') && !screen.classList.contains('lib-open-filters') && b1.attrs['aria-expanded'] === 'false');
ok('second click closes', ctx.libTogglePanel(b2, 'aside') === false && !screen.classList.contains('lib-open-aside') && b2.attrs['aria-expanded'] === 'false');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lib phone/tablet checks passed');
