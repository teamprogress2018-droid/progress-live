#!/usr/bin/env node
'use strict';
/** Client profile: visible personal-data edit (name/surname), not only ⋯ overflow. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const overview = src08.slice(
  src08.indexOf('function renderCPOverview'),
  src08.indexOf('function renderCPPlan')
);
const start = src08.slice(
  src08.indexOf('function startCPEdit'),
  src08.indexOf('function cancelCPEdit')
);
const form = src08.slice(
  src08.indexOf('function cpClientDataEditHTML'),
  src08.indexOf('function startCPEdit')
);

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL', name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK  ', name);
}

ok('header button next to name', html.includes('id="cp-edit-data-btn"') && html.includes('cp-hdr-name-row'));
ok('header button calls startCPEdit', /id="cp-edit-data-btn"[^>]*startCPEdit\(cpClientId\)/.test(html));
ok('overflow still has edit', html.includes('id="cp-edit-btn"') && html.includes('cp-hdr-more-menu'));
ok('overview CTA card', overview.includes('cp-ov-edit-cta') && overview.includes("startCPEdit('${c.id}')"));
ok('form title dane osobowe', form.includes('Dane osobowe') && form.includes('id="cp-edit-card"'));
ok('name field placeholder', form.includes('id="cpe-name"') && /placeholder="np\. Jan Kowalski"/.test(form));
ok('startCPEdit restores flag after open', start.includes('openClientProfile(id)') && start.includes('window._cpEditingClientId=id'));
ok('startCPEdit scrolls and focuses name', start.includes('scrollIntoView') && start.includes('cpe-name'));
ok('profil rail name + hint', overview.includes('Imię i nazwisko') && overview.includes('Kliknij: imię i nazwisko'));
ok('css for header + CTA', css.includes('.cp-edit-data-btn') && css.includes('.cp-ov-edit-cta') && css.includes('.cp-hdr-name-row'));
ok('cache 08 v37', html.includes('08-client-profile-extras.js?v=42'));
ok('cache styles v54', html.includes('styles.css?v=59'));
ok('CI unit', wf.includes('test_cp_edit_visible.js'));
ok('CI ui', wf.includes('test_cp_edit_visible_ui.js'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-edit-visible tests passed');
