#!/usr/bin/env node
'use strict';
/** Everfit-like app shell: sidebar + Library flyout + clients table. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const clients = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const nine = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');

let failed = 0;
function ok(name, cond) {
  if (!cond) {
    console.error('FAIL', name);
    failed++;
  } else console.log('OK  ', name);
}

ok('clients first in sidebar', /sidebar-nav[\s\S]*?data-screen="clients"[\s\S]*?Biblioteka/.test(html));
ok('library flyout markup', html.includes('nav-library-flyout') && html.includes('toggleLibraryFlyout'));
ok('library flyout header', html.includes('nav-flyout-hd') && /Biblioteka/.test(html));
ok('library flyout items', /Ćwiczenia/.test(html) && />Treningi</.test(html) && /Programy/.test(html) && /Formularze i ankiety/.test(html) && /Grupy pomiarów/.test(html));
const libFly = html.slice(html.indexOf('id="nav-library-flyout"'), html.indexOf('data-screen="inbox"'));
ok('library has programs templates', /data-screen="programs"/.test(libFly) && /data-screen="templates"/.test(libFly));
ok('library trimmed tools', !/data-screen="aiplangen"/.test(libFly) && !/data-screen="builder"/.test(libFly) && !/data-screen="calculator"/.test(libFly) && !/data-screen="kb"/.test(libFly));
ok('tools under more not library', /nav-more-items[\s\S]*data-screen="aiplangen"[\s\S]*data-screen="builder"[\s\S]*data-screen="calculator"[\s\S]*data-screen="kb"/.test(html));
ok('inbox top-level', /data-screen="inbox"[\s\S]*?Wiadomości/.test(html.slice(html.indexOf('sidebar-nav'), html.indexOf('nav-more-items'))));
ok('automation top-level', /data-screen="automation"/.test(html.slice(html.indexOf('sidebar-nav'), html.indexOf('nav-more-items'))));
ok('payments top-level', /data-screen="payments"/.test(html.slice(html.indexOf('sidebar-nav'), html.indexOf('nav-more-items'))));
ok('single inbox badge', (html.match(/id="nb-inbox"/g) || []).length === 1);
ok('clients screen everfit layout', html.includes('cl-everfit') && html.includes('cl-everfit-hdr'));
ok('clients training columns', html.includes('Trening 7 dni') && html.includes('Trening 30 dni') && html.includes('Zadania 7 dni'));
ok('clients default active screen', /class="screen active" id="screen-clients"/.test(html) || /id="screen-clients" class="screen active"/.test(html));
ok('flyout css panel', css.includes('.nav-flyout') && css.includes('.nav-flyout-hd') && css.includes('.cl-everfit-row'));
ok('flyout not clipped by absolute-in-scroll', /\.nav-flyout\{[^}]*position:fixed/.test(css));
ok('flyout js race guard', /function\s+toggleLibraryFlyout/.test(nine) && /_libFlyIgnoreUntil/.test(nine));
ok('flyout positions from trigger rect', /function\s+_positionLibraryFlyout/.test(nine) && /getBoundingClientRect/.test(nine));
ok('flyout portals to body', /document\.body\.appendChild\(fly\)/.test(nine));
ok('goTo marks library group', /libraryScreens=\['library','plans','programs','templates','tasks','forms','metrics'\]/.test(core) && core.includes('nav-library-btn'));
ok('goTo expands more for tools', /moreScreens=\[[^\]]*aiplangen[^\]]*builder[^\]]*calculator[^\]]*kb/.test(core));
ok('training window stats', /function\s+clientTrainingWindowStats/.test(clients));
ok('row message button', clients.includes('cl-msg-btn') && clients.includes('quickMessageClient'));
ok('no action button spam in rows', !/quickStartWorkout\(event/.test(clients.slice(clients.indexOf('function renderClients'), clients.indexOf('function openClientModal'))));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll app-shell-everfit tests passed');
