#!/usr/bin/env node
'use strict';
/** Prawy panel ćwiczenia: 3 zakładki + akordeony biomechaniki. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const six = fs.readFileSync(path.join(root, '06-inbox-exercises-ai-programs.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 06', html.includes('06-inbox-exercises-ai-programs.js?v=84'));
ok('cache styles', html.includes('styles.css?v=103'));
ok('CI unit', wf.includes('test_exd_tabs.js'));
ok('CI ui', wf.includes('test_exd_tabs_ui.js'));
ok('lib side scroll', html.includes('id="lib-side-scroll"') && html.includes('class="lib-side"') && /id="ex-cat-nav"[\s\S]*id="ex-equip-filters"/.test(html));
ok('sidebar end not clipped', html.includes('class="sidebar-end"') && html.includes('class="sidebar-logout"') && css.includes('.lib-side-scroll') && css.includes('.sidebar-end{flex-shrink:0'));

ok('three tabs in markup', html.includes('id="exd-tab-preview"') && html.includes('>Podgląd<') && html.includes('>Biomechanika<') && html.includes('>Zarządzanie<'));
ok('tablist a11y', html.includes('role="tablist"') && html.includes('role="tab"') && html.includes('role="tabpanel"') && html.includes('aria-controls="exd-panel-preview"'));
ok('panels exist', html.includes('id="exd-panel-preview"') && html.includes('id="exd-panel-biomech"') && html.includes('id="exd-panel-manage"') && html.includes('id="exd-biomech-main"'));
ok('ai accordion', html.includes('id="exd-acc-ai"') && html.includes('id="exd-ask-biomech"') && /Zapytaj Biomechanika/.test(html));
ok('setExdTab helper', /function setExdTab\(/.test(six) && /EXD_TABS=\['preview','biomech','manage'\]/.test(six));
ok('keyboard tabs', /function onExdTabsKeydown\(/.test(six) && /ArrowRight/.test(six));
ok('preview has media+cta', /function exdPreviewHtml\(/.test(six) && /Użyj w builderze/.test(six) && /exdPreviewMediaHtml/.test(six));
ok('manage has assign+edit+del', /function exdManageHtml\(/.test(six) && /exDetailAssignHtml\(e\)/.test(six) && /id="exd-del"/.test(six) && /findCustomEx\(e\.name\)\?`<button[^>]*editEx/.test(six));
ok('biomech info block', /Profil biomechaniczny/.test(six) && /exd-biomech-row/.test(six) && /Płaszczyzna/.test(six) && /Profil oporu/.test(six) && /SFR/.test(six));
ok('justify accordion', /id="exd-acc-justify"/.test(six) && /Uzasadnienia zamienników/.test(six) && /Uzasadnij ten zamiennik/.test(six));
ok('tab css', css.includes('.exd-tab') && css.includes('.exd-tab.is-active') && css.includes('.exd-acc') && css.includes('.exd-biomech-row'));
ok('contrast padding', css.includes('#exd-body{flex:1;overflow-y:auto;padding:20px 18px 28px') && css.includes('.exd-ai-q{flex:1;background:#1A1C26'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll exd-tabs tests passed');
