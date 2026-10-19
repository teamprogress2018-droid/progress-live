#!/usr/bin/env node
'use strict';
/** Biblioteka – porządki (audyt 18.10, pakiet D): jeden import, „+ Ćwiczenie” jako główna akcja,
 *  bez pustych paneli i tekstów dla programisty, spójne nazwy, Karty/Lista, sortowanie, wyszukiwarka. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const six = read('06-inbox-exercises-ai-programs.js');
const core = read('01-core.js');
const two = read('02-workouts-onboarding-templates-live.js');
const wf = read('.github/workflows/check.yml');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('ci unit', wf.includes('test_lib_porzadki.js'));
ok('ci ui', wf.includes('test_lib_porzadki_ui.js'));
ok('cache 01', html.includes('01-core.js?v=136'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=98'));
ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=101'));

const a = html.indexOf('<div class="screen" id="screen-library">');
const lib = html.slice(a, html.indexOf('<div class="screen"', a + 10));
ok('one import button', (lib.match(/openExGifImport\(\)/g) || []).length === 1);
ok('+ Ćwiczenie is the main action', /class="btn btn-primary btn-sm" id="lib-add-ex"/.test(lib) && /class="btn btn-ghost btn-sm" id="lib-import-gif"/.test(lib));
ok('dedupe button hidden by default', /id="lib-sweep-dups" style="[^"]*display:none;/.test(lib));
ok('no empty plan filters', !html.includes('id="ex-plan-filters"') && !html.includes('Filtry dla planu'));
ok('no empty muscle chips', !html.includes('id="ex-muscle-chips"'));
ok('no category sort', !/<option value="cat">Kategoria<\/option>/.test(lib));
ok('view buttons start on Karty', /class="btn btn-primary btn-sm" id="ex-view-grid-btn" aria-pressed="true"/.test(lib));
ok('search waits for typing pause', lib.includes('oninput="renderLibSoon()"'));

['id="ex-img"', 'id="ex-video"'].forEach((id) => {
  const i = html.indexOf(id);
  ok(id + ' no local disk hint', i > 0 && !/D:\//.test(html.slice(i, i + 400)) && !/zamienimy na CDN/.test(html.slice(i, i + 600)));
});
const imp = html.slice(html.indexOf('id="m-ex-gif-import"'), html.indexOf('id="m-own-video"'));
ok('import modal no local disk path', imp.length > 100 && !/D:\//.test(imp) && !/progress-live-video-assets/.test(imp));
ok('import says Sprawdź listę', imp.includes('>Sprawdź listę</button>') && !imp.includes('Parsuj listę') && !imp.includes(' w select'));
const ov = html.slice(html.indexOf('id="m-own-video"'), html.indexOf('id="m-own-video"') + 2500);
ok('own video note plain', !/D:\\\\Desktop|progress-live-video-assets/.test(ov));

ok('menu Pomiary ciała = title', html.includes(">Pomiary ciała</button>") && html.includes('<div class="topbar-title">Pomiary ciała</div>'));
ok('menu Treningi = title', html.includes('data-screen="plans" onclick="closeLibraryFlyout();goTo(\'plans\')">Treningi</button>') && html.includes('<div class="topbar-title">Treningi</div>'));
ok('menu Formularze i ankiety = title', html.includes('<div class="topbar-title">Formularze i ankiety</div>'));
ok('no 8–16 / 8–12 block ranges', !html.includes('Blokach 8–16') && !two.includes('8–12 tyg. → Biblioteka programów'));
ok('task flyout synced', /function syncTaskFlyout\(/.test(six) && /syncTaskFlyout\(\);\n?\r?\n?\s*renderTasks\(\);/.test(six) && core.includes("if(n==='tasks'&&typeof syncTaskFlyout==='function')syncTaskFlyout();"));
ok('view remembered', six.includes("localStorage.setItem('pl_ex_view_v1',exView)") && six.includes("localStorage.getItem('pl_ex_view_v1')"));
ok('sort inside groups', (six.match(/items\.sort\(exLibSortFn\(\)\)/g) || []).length === 2);
ok('close detail does not rebuild grid', /function closeExDetail\(\)\{[\s\S]{0,300}classList\.remove\('selected'\)[\s\S]{0,20}\}/.test(six) && !/function closeExDetail\(\)\{[\s\S]{0,250}renderLib\(\);/.test(six));
ok('catalog card says Ukryj', /function exDelBtnHtml\(/.test(six) && six.includes("${own?'Usuń':'Ukryj'}</button>"));
ok('detail header label', six.includes("hdrDel.textContent=own?'🗑 Usuń':'🙈 Ukryj';"));

// Wyszukiwarka: słowa w dowolnej kolejności, podwójne spacje i myślniki bez znaczenia.
function slice(src, from, to) {
  const i = src.indexOf(from);
  const j = src.indexOf(to, i + 1);
  return i >= 0 && j > i ? src.slice(i, j) : '';
}
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(slice(six, 'function exerciseSearchNorm', 'function exerciseSearchRank'), ctx);
vm.runInContext(slice(six, 'function exerciseSearchTokens', 'window.exerciseSearchTokens'), ctx);
const bench = { name: 'Wyciskanie sztangi leżąc', cat: 'Klatka piersiowa', eq: 'Sztanga', muscle: '', aka: '' };
const t = (q) => ctx.exerciseMatchesTokens(bench, ctx.exerciseSearchTokens(q));
ok('any word order', t('lezac  wyciskanie'));
ok('trailing spaces', t('wyciskanie sztangi '));
ok('dash as space', t('wyciskanie-sztangi'));
ok('all words required', !t('wyciskanie hantli'));
ok('empty matches all', t('   '));

// Sortowanie
vm.runInContext(slice(six, 'function exLibSortFn', 'window.exercisesGroupedByCat'), Object.assign(ctx, { document: { getElementById: () => ({ value: 'eq' }) } }));
const rows = [{ name: 'B', eq: 'Sztanga' }, { name: 'A', eq: 'Hantle' }, { name: 'C', eq: 'Hantle' }];
ok('sort by equipment then name', rows.slice().sort(ctx.exLibSortFn()).map((r) => r.name).join('') === 'ACB');

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lib clean-up checks passed');
