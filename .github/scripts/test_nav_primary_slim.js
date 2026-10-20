#!/usr/bin/env node
'use strict';
/** Układ 2.0: pasek boczny z pozycjami głównymi i grupami w menu wysuwanym (bez „Więcej”). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const nine = fs.readFileSync(path.join(root, '09-posture-kb-invites-private.js'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'theme.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const navStart = html.indexOf('class="sidebar-nav"');
const navEnd = html.indexOf('</nav>', navStart);
assert.ok(navStart >= 0 && navEnd > navStart, 'sidebar-nav present');
const primary = html.slice(navStart, navEnd);
const utilStart = html.indexOf('class="sidebar-utility"');
const utility = html.slice(utilStart, html.indexOf('</nav>', utilStart));

// Pozycje widoczne w pasku (bez pozycji z menu wysuwanego)
const topLevel = [...primary.matchAll(/<button[^>]*class="nav-item[^"]*"[^>]*>/g)].map((m) => {
  const scr = m[0].match(/data-screen="([^"]+)"/);
  const grp = m[0].match(/data-nav-group="([^"]+)"/);
  return grp ? 'group:' + grp[1] : scr[1];
});

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err.message);
    process.exit(1);
  }
}

test('primary order like the reference layout', () => {
  assert.deepStrictEqual(topLevel, [
    'group:clients', 'dashboard', 'group:library', 'inbox', 'live', 'calendar',
    'group:automation', 'group:ondemand', 'forum', 'group:business', 'group:knowledge',
  ]);
  assert.ok(!html.includes('nav-more-items') && !html.includes('toggleMoreNav'), 'no Więcej section');
});

test('every former screen still reachable from the sidebar', () => {
  const aside = html.slice(html.indexOf('<aside class="sidebar"'), html.indexOf('</aside>'));
  for (const s of ['dashboard', 'clients', 'checkin', 'library', 'plans', 'programs', 'templates', 'tasks', 'forms', 'metrics',
    'inbox', 'live', 'calendar', 'automation', 'onboarding', 'ondemand', 'resources', 'forum', 'payments', 'bizstats',
    'academy', 'kb', 'aicoach', 'calculator', 'integrations', 'trainer-profile', 'settings']) {
    assert.ok(aside.includes(`data-screen="${s}"`), `${s} in sidebar`);
  }
  assert.ok(aside.includes('openReportModal()'), 'Raporty in sidebar');
});

test('groups have flyout menus with ARIA wiring', () => {
  for (const g of ['clients', 'library', 'automation', 'ondemand', 'business', 'knowledge']) {
    assert.ok(primary.includes(`id="nav-${g}-wrap"`) && primary.includes(`id="nav-${g}-flyout"`), g + ' flyout');
    assert.match(primary, new RegExp(`id="nav-${g}-btn"[^>]*aria-haspopup="true"[^>]*aria-expanded="false"[^>]*aria-controls="nav-${g}-flyout"`));
  }
  assert.ok(/id="nav-business-flyout"[\s\S]*data-screen="payments"[\s\S]*data-screen="bizstats"/.test(primary), 'Biznes = Płatności + Statystyki');
  assert.ok(/id="nav-knowledge-flyout"[\s\S]*data-screen="academy"[\s\S]*data-screen="kb"/.test(primary), 'Progress Academy group');
});

test('account area at the bottom', () => {
  assert.ok(utilStart > navEnd, 'utility nav after main nav');
  for (const s of ['trainer-profile', 'settings', 'integrations']) assert.ok(utility.includes(`data-screen="${s}"`), s);
});

test('flyout behaviour: hover, click, keyboard, collapse', () => {
  for (const fn of ['openNavFlyout', 'closeNavFlyouts', 'toggleNavFlyout', 'navGroupClick', '_navFlyHoverIn', '_navFlyKeydown', 'toggleSidebarCollapsed']) {
    assert.match(nine, new RegExp('function\\s+' + fn + '\\('), fn);
  }
  assert.ok(nine.includes("e.key==='ArrowRight'") && nine.includes("e.key==='Escape'"), 'keyboard');
  assert.ok(nine.includes("'pl_sidebar_collapsed'"), 'collapse remembered');
  assert.ok(theme.includes('.app.sidebar-collapsed .sidebar'), 'collapsed css');
});

test('goTo highlights the group of the opened screen', () => {
  assert.match(core, /navGroupScreens=\{[\s\S]*ondemand:\['ondemand','resources'\][\s\S]*business:\['payments','bizstats'\]/);
  assert.ok(!/navGroupScreens=\{[^}]*dashboard/.test(core));
});

test('private mode also locks payments in the flyout', () => {
  assert.ok(nine.includes("document.querySelectorAll('.nav-item, .nav-flyout-item').forEach(b=>{\r\n      if(b.textContent.trim().includes('Płatności'))") ||
    nine.includes("document.querySelectorAll('.nav-item, .nav-flyout-item').forEach(b=>{\n      if(b.textContent.trim().includes('Płatności'))"));
});

test('sidebar does not close #app-root before .main', () => {
  const appOpen = html.indexOf('id="app-root"');
  const mainOpen = html.indexOf('class="main"');
  const appClose = html.indexOf('<!-- /app -->');
  assert.ok(appOpen >= 0 && mainOpen > appOpen && mainOpen < appClose, '.main stays inside #app-root');
});

test('cache + CI', () => {
  assert.match(html, /01-core.js\?v=137/);
  assert.ok(html.includes('layout-v2='), 'cache param for Układ 2.0');
  assert.ok(wf.includes('test_nav_primary_slim.js'), 'CI runs nav slim test');
});

console.log('All nav-primary-slim tests passed.');
