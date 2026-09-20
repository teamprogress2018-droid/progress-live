#!/usr/bin/env node
'use strict';
/** UI: ikony stopki nie zachodzą na nazwę Teamprogress2018. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SIDEBAR_FOOTER_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-sidebar-footer'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function overlap(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = 'flex';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const name = document.getElementById('sf-name');
    const title = document.getElementById('sf-title');
    if (name) name.textContent = 'Teamprogress2018';
    if (title) title.textContent = 'Trener personalny';
  });
  await page.waitForSelector('.sidebar-footer');
  await page.waitForTimeout(200);

  const geo = await page.evaluate(() => {
    const name = document.getElementById('sf-name');
    const title = document.getElementById('sf-title');
    const footer = document.querySelector('.sidebar-footer');
    const actions = document.querySelector('.sf-actions');
    const logout = document.querySelector('.sidebar-logout');
    const sidebar = document.querySelector('.sidebar');
    const btns = [...document.querySelectorAll('.sf-icon-btn')].map((el) => el.getBoundingClientRect().toJSON());
    const r = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
    return {
      name: r(name),
      title: r(title),
      footer: r(footer),
      actions: r(actions),
      logout: r(logout),
      sidebar: r(sidebar),
      nameText: name ? name.textContent : '',
      btnCount: btns.length,
      btns,
      computed: footer ? getComputedStyle(footer).display : ''
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'sidebar_footer_name.png') });

  ok('long name set', geo.nameText === 'Teamprogress2018', geo.nameText);
  ok('footer is grid', geo.computed === 'grid', geo.computed);
  ok('three icon buttons', geo.btnCount === 3, String(geo.btnCount));
  ok('name has width', geo.name && geo.name.width > 80, JSON.stringify(geo.name));
  ok('name fully in sidebar', geo.name && geo.sidebar && geo.name.left >= geo.sidebar.left - 0.5 && geo.name.right <= geo.sidebar.right + 0.5);
  ok('actions fully in sidebar', geo.actions && geo.sidebar && geo.actions.right <= geo.sidebar.right + 0.5 && geo.actions.bottom <= geo.sidebar.bottom + 0.5);

  const nameHit = geo.btns.some((b) => overlap(geo.name, b));
  const titleHit = geo.btns.some((b) => overlap(geo.title, b));
  ok('icons do not overlap name', !nameHit, JSON.stringify({ name: geo.name, btns: geo.btns }));
  ok('icons do not overlap title', !titleHit, JSON.stringify({ title: geo.title, btns: geo.btns }));
  ok('icons sit below name', geo.actions && geo.name && geo.actions.top >= geo.name.bottom - 1, JSON.stringify({ nameBottom: geo.name && geo.name.bottom, actionsTop: geo.actions && geo.actions.top }));
  ok('logout still visible', geo.logout && geo.logout.width > 80 && geo.logout.bottom <= geo.sidebar.bottom + 1);

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll sidebar-footer UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
