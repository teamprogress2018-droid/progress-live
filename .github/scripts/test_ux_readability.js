#!/usr/bin/env node
'use strict';
/** Etap 4 UX: czytelność — kontrast tokenów tekstu, minimalne rozmiary czcionek w theme.css, cele dotykowe 44 px na telefonie. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const theme = fs.readFileSync(path.join(root, 'theme.css'), 'utf8');
const landing = fs.readFileSync(path.join(root, 'landing.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const light = theme.slice(theme.indexOf('html[data-theme="light"] {'));
const tok = (name) => ((light.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})')) || [])[1]);

const label = tok('text-label'), warning = tok('warning'), bg = tok('bg-main'), subtle = tok('bg-subtle');
ok('--text-label is #4b5563', label === '#4b5563', label);
ok('--text-label ≥4.5:1 on app background and chips', ratio(label, bg) >= 4.5 && ratio(label, subtle) >= 4.5, ratio(label, bg).toFixed(2) + ' / ' + ratio(label, subtle).toFixed(2));
ok('--warning text is #9a3b06 (≥4.5:1)', warning === '#9a3b06' && ratio(warning, '#ffffff') >= 4.5);
ok('--cap-muted dark enough', tok('cap-muted') === '#4b5563');
ok('accent text token for small red text', /--accent-text:\s*color-mix\(in srgb, var\(--accent\) 85%, #000\)/.test(theme));
ok('landing small red text darker (#d40000)', /--land-accent-text:\s*color-mix\(in srgb, var\(--land-accent\) 92%, #000\)/.test(landing) && /\.pl-land-eyebrow span \{ color: var\(--land-accent-text\); \}/.test(landing));
ok('#d40000 on cream ≥4.5:1', ratio('#d40000', '#f6f5f2') >= 4.5);

// Nic poniżej 12 px w theme.css poza znaczkami (licznik, badge, awatar, ikonka).
const BADGE = /badge|chip|-n\b|cl-av|qa-small i|match|week-today|plan-next/;
const small = [];
theme.split('\n').forEach((line, i) => {
  const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
  if (!m || Number(m[1]) >= 12 || /\[style\*=/.test(line)) return;
  let j = i, sel = line;
  while (j > 0 && !/[{]/.test(sel)) { j--; sel = theme.split('\n')[j] + sel; }
  if (!BADGE.test(sel)) small.push((i + 1) + ': ' + line.trim().slice(0, 90));
});
ok('no text under 12 px in theme.css (except badges)', small.length === 0, small.join(' | '));
ok('touch targets 44 px rule', /@media \(max-width: 760px\) \{[\s\S]*?\.dash3-icon-btn[\s\S]*?min-height: 44px;/.test(theme));
ok('theme.css cache param', html.includes('ux-contrast=1'));

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('SKIP UI part (no playwright)'); }
  if (chromium) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.persistById = async (_c, o) => o;
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('app-root').style.display = 'flex';
      const l = document.getElementById('app-loading'); if (l) l.style.display = 'none';
      window.CL.length = 0; window.CL.push({ id: 'u1', name: 'Anna Nowak', email: 'a@x.pl', status: 'active', goal: 'redukcja' });
      goTo('dashboard'); renderDash();
    });
    await page.waitForTimeout(300);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('#screen-dashboard .dash3-icon-btn, #screen-dashboard .dash-hdr-link')]
      .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 12) || e.getAttribute('aria-label'), Math.round(r.width), Math.round(r.height)]; }));
    ok('phone: header icons and "Kalendarz →" ≥44×44', sizes.length >= 3 && sizes.every((s) => s[1] >= 44 && s[2] >= 44), JSON.stringify(sizes));
    const col = await page.$eval('.dash3-day-stat span', (e) => getComputedStyle(e).color).catch(() => '');
    ok('phone: dashboard renders', !!col);
    await browser.close();
  }
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('All readability tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
