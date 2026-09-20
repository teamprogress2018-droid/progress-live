#!/usr/bin/env node
'use strict';
/** Stopka sidebara: nazwa trenera i ikony nie w jednym ciasnym wierszu. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
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

ok('cache styles', html.includes('styles.css?v=98'));
ok('CI unit', wf.includes('test_sidebar_footer.js'));
ok('CI ui', wf.includes('test_sidebar_footer_ui.js'));

const footerStart = html.indexOf('class="sidebar-footer"');
const footerEnd = html.indexOf('class="sidebar-logout"');
ok('footer before logout', footerStart > 0 && footerEnd > footerStart);
const footer = html.slice(footerStart, footerEnd);
ok('meta + actions wrappers', footer.includes('class="sf-meta"') && footer.includes('class="sf-actions"') && footer.includes('id="sf-name"') && footer.includes('id="sf-title"'));
ok('three icon buttons', (footer.match(/class="sf-icon-btn"/g) || []).length === 3);
ok('private + notif + mini logout', footer.includes('id="private-mode-btn"') && footer.includes('toggleNotifs()') && footer.includes('doSignOut()'));
ok('name before actions', footer.indexOf('id="sf-name"') < footer.indexOf('class="sf-actions"'));

ok('grid restack', css.includes('.sidebar-footer{') && css.includes('grid-template-areas:') && css.includes('"av meta"') && css.includes('"av actions"'));
ok('name ellipsis', css.includes('.sf-name{') && css.includes('text-overflow:ellipsis') && css.includes('white-space:nowrap'));
ok('actions row', css.includes('.sf-actions{') && css.includes('grid-area:actions'));
ok('icon btn class', css.includes('.sf-icon-btn{') && css.includes('flex-shrink:0'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll sidebar-footer tests passed');
