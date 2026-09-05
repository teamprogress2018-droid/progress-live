#!/usr/bin/env node
'use strict';
/** Hover „Edycja” on client list opens edit modal. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src05 = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('quickEditClient helper', /function\s+quickEditClient\s*\(/.test(src05) && src05.includes('openClientModal(clientId)'));
ok('list row Edycja button', src05.includes('cl-edit-btn') && src05.includes("quickEditClient(event,'${c.id}')") && /Edycja<\/button>/.test(src05));
ok('hover reveals edit btn', css.includes('.tbl-row.cl-everfit-row:hover .cl-edit-btn') && css.includes('opacity:0'));
ok('touch fallback always visible', css.includes('@media (hover:none)') && /hover:none[\s\S]{0,80}\.cl-edit-btn\{opacity:1/.test(css));
ok('exported', src05.includes('window.quickEditClient=quickEditClient'));
ok('dash hover edit', src04.includes('dash-client-edit') && src04.includes("quickEditClient(event,'${c.id}')"));
ok('cache bumps', html.includes('05-clients-builder-plans-calendar.js?v=41') && html.includes('styles.css?v=61') && html.includes('04-client-portal.js?v=37'));
ok('CI', wf.includes('test_client_hover_edit.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll client-hover-edit tests passed');
