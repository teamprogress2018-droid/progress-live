#!/usr/bin/env node
'use strict';
/** Client profile: slim header, one message path, Podsumowanie in Progress. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src08 = fs.readFileSync(path.join(root, '08-client-profile-extras.js'), 'utf8');
const src09 = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');

const progress = src08.slice(
  src08.indexOf('function renderCPProgress'),
  src08.indexOf('window.renderCPProgress')
);
const overview = src08.slice(
  src08.indexOf('function renderCPOverview'),
  src08.indexOf('function renderCPPlan')
);

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

const hdr = html.slice(html.indexOf('cp-hdr-actions'), html.indexOf('cp-overlay') > 0 ? html.indexOf('<!-- glowny uklad') : html.length);

ok('slim header actions class', html.includes('cp-hdr-actions'));
ok('header has message', /cpQuickMessage/.test(hdr));
ok('header has live', /cpStartLive/.test(hdr));
ok('header has overflow menu', html.includes('cp-hdr-more-menu') && /toggleCpHdrMore/.test(src09));
ok('no top Podsumowanie button', !/openReportForClient\(cpClientId\)/.test(hdr.replace(/cp-hdr-more-menu[\s\S]*?<\/div>/, '')));
ok('no top Check-in button outside menu', !/cpQuickCheckin\(\)/.test(hdr.replace(/cp-hdr-more-menu[\s\S]*?<\/div>/, '')));
ok('visible Edytuj dane next to name', html.includes('id="cp-edit-data-btn"') && /startCPEdit\(cpClientId\)/.test(html));
ok('edit still in overflow', /id="cp-edit-btn"/.test(html) && html.includes('cp-hdr-more-menu'));
ok('archive and delete only in settings', !/cp-archive-btn|cp-delete-btn/.test(html) && /archiveClient\('\$\{c\.id\}'\)/.test(src08) && /deleteClientPermanently\('\$\{c\.id\}'\)/.test(src08));
ok('podsumowanie in overflow menu', /openReportForClient\(cpClientId\)/.test(html) && /cp-hdr-more-menu/.test(html));
ok('progress has one photo compare shortcut and no generic CTA strip', !/Podsumowanie<\/button>/.test(progress) && /cp-photo-summary/.test(progress) && /setCPTab\('photos'\)/.test(progress));
ok('progress still links metrics from cards', /setCPTab\('metrics'\)/.test(progress));
ok('overview profile has no WhatsApp/Email CTAs', !/WhatsApp|mailto:/.test(overview));
ok('css for header menu', css.includes('.cp-hdr-more-menu') && css.includes('.cp-hdr-actions'));
ok('scripts not duplicated for 08', (html.match(/08-client-profile-extras\.js/g) || []).length === 1);

ok('cache bump 08', html.includes('08-client-profile-extras.js?v=87'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll cp-nav-simplify tests passed');
