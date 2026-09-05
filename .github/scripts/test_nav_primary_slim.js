#!/usr/bin/env node
'use strict';
/** Primary nav slim: ~6 items; On-demand / Społeczność / Płatności under Więcej. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

const navStart = html.indexOf('sidebar-nav');
const moreStart = html.indexOf('nav-more-items');
assert.ok(navStart >= 0 && moreStart > navStart, 'sidebar-nav and nav-more-items present');
const primary = html.slice(navStart, moreStart);
const more = html.slice(moreStart, html.indexOf('</nav>', moreStart));

const primaryScreens = [...primary.matchAll(/data-screen="([^"]+)"/g)].map(m => m[1]);
// library flyout items also have data-screen — top-level destinations only:
const topLevel = primaryScreens.filter(s =>
  !['library', 'plans', 'programs', 'templates', 'tasks', 'forms', 'metrics'].includes(s)
);

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

test('primary top-level is slim (~6)', () => {
  assert.deepStrictEqual(
    topLevel,
    ['dashboard', 'clients', 'inbox', 'live', 'calendar', 'automation'],
    'top-level: Panel główny, Klienci, Wiadomości, Live, Kalendarz, Automatyzacja (+ Biblioteka flyout)'
  );
  assert.ok(primary.includes('nav-library-btn') || primary.includes('Biblioteka'), 'Biblioteka in primary');
  assert.ok(primary.includes('nav-more-toggle') || primary.includes('Więcej'), 'Więcej toggle present');
});

test('On-demand / Społeczność / Płatności under Więcej only', () => {
  for (const s of ['ondemand', 'forum', 'payments']) {
    assert.ok(more.includes(`data-screen="${s}"`), `${s} under Więcej`);
    assert.ok(!primary.includes(`data-screen="${s}"`), `${s} not in primary`);
  }
});

test('goTo moreScreens includes secondary products', () => {
  assert.match(core, /moreScreens=\[[^\]]*ondemand[^\]]*forum[^\]]*payments/);
  assert.doesNotMatch(core, /moreScreens=\[[^\]]*dashboard/);
});

test('cache + CI', () => {
  assert.match(html, /01-core.js\?v=73/);
  assert.ok(wf.includes('test_nav_primary_slim.js'), 'CI runs nav slim test');
});

console.log('All nav-primary-slim tests passed.');
