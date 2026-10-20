#!/usr/bin/env node
'use strict';
/** Strona startowa (przed zalogowaniem): znaczniki, lekkie zdjęcia, brak ruchu przy prefers-reduced-motion, okno logowania. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'landing.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'landing.js'), 'utf8');
const src10 = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

const landing = html.slice(html.indexOf('<div id="auth-screen"'), html.indexOf('<div class="app" id="app-root"'));
ok('auth screen is the landing page', /<div id="auth-screen" class="pl-landing" style="display:flex;">/.test(landing));
ok('brand + slogan', landing.includes('PROGRESS <span>LIVE</span>') && landing.includes('TRENER. PLAN. EFEKTY.'));
ok('headline is h1', /<h1 class="pl-land-title" id="pl-land-title">/.test(landing));
ok('login entry points', landing.includes("onclick=\"landingOpenAuth('login')\"") && landing.includes('onsubmit="landingStart(event)"'));
ok('invite entry points', (landing.match(/landingOpenAuth\('register'\)/g) || []).length === 2);
ok('email field labelled', /<label for="pl-land-email" class="sr-only">/.test(landing));
ok('two photo tracks', (landing.match(/class="pl-land-track"/g) || []).length === 2);
ok('auth card is a dialog', /id="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-card-title" aria-hidden="true"/.test(landing));
ok('login, register and reset forms kept', ['auth-login-view', 'auth-register-view', 'auth-reset-view', 'auth-email', 'auth-password', 'auth-reg-token', 'auth-error'].every((id) => landing.includes('id="' + id + '"')));
ok('old cup icon gone', !landing.includes('logo-mark'));
ok('landing.js loaded right after the landing', /<\/div>\r?\n<script src="landing\.js\?v=1"><\/script>/.test(html));
ok('landing.css loaded after theme.css', html.indexOf('landing.css?v=1') > html.indexOf('theme.css?v=1'));
ok('no external scripts for the landing', !/https?:\/\//.test(js) && !/@import|https?:\/\//.test(css.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')));

ok('reduced motion stops the photos', /@media \(prefers-reduced-motion: reduce\) \{\s*\.pl-land-track \{ animation: none !important; \}/.test(css));
ok('seamless loop keyframes', css.includes('@keyframes pl-land-up') && css.includes('@keyframes pl-land-down') && css.includes('@keyframes pl-land-left') && css.includes('@keyframes pl-land-right'));
ok('phone layout', css.includes('@media (max-width: 900px)') && css.includes('@media (max-width: 560px)'));
ok('readable text sizes', /\.pl-land-lead \{[^}]*font-size: clamp\(17px/.test(css) && /\.pl-land-points li \{[^}]*font-size: 16px/.test(css));
ok('calm background, dark text', css.includes('--land-bg: #f6f5f2;') && css.includes('--land-ink: #141414;'));
ok('no hardcoded accent red in landing', !/#e60000(?!\))/i.test(css.replace('var(--accent, #e60000)', '')));

ok('invite flow opens the dialog', /function authShowRegister\(\)\{[\s\S]*?window\.landingOpenAuth\(\);\r?\n\}/.test(src10));
ok('boot error opens the dialog', /function showTenantBootError[\s\S]*?window\.landingOpenAuth\(\);/.test(html));
ok('CI runs landing tests', wf.includes('test_landing.js') && wf.includes('test_landing_ui.js'));

// Zdjęcia: istnieją, są lekkie
const photos = [...js.matchAll(/\{f:'([a-z]+)',t:'([^']+)'\}/g)].map((m) => m[1]);
ok('8 photos listed', photos.length === 8, photos.join(','));
let total = 0;
for (const f of photos) {
  const p = path.join(root, 'assets', 'brand', 'landing', f + '.jpg');
  const exists = fs.existsSync(p);
  ok('photo ' + f + ' exists', exists);
  if (exists) total += fs.statSync(p).size;
}
ok('photos under 400 KB together', total > 0 && total < 400 * 1024, Math.round(total / 1024) + ' KB');

// Logika okna na atrapie DOM
function makeEl(id) {
  return {
    id, value: '', innerHTML: '', style: {}, attrs: {}, focused: false,
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
    setAttribute(k, v) { this.attrs[k] = v; }, focus() { ctx._focus = id; },
  };
}
const els = {};
const tracks = [makeEl('t1'), makeEl('t2')];
let keyHandler = null;
const ctx = {
  console, setTimeout: (fn) => fn(),
  document: {
    activeElement: null,
    getElementById: (id) => (els[id] = els[id] || makeEl(id)),
    querySelectorAll: (sel) => (sel === '#auth-screen .pl-land-track' ? tracks : []),
    addEventListener: (type, fn) => { if (type === 'keydown') keyHandler = fn; },
  },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(js, ctx, { filename: 'landing.js' });

ok('tracks filled twice for the loop', (tracks[0].innerHTML.match(/<figure/g) || []).length === 8 && (tracks[1].innerHTML.match(/<figure/g) || []).length === 8);
ok('copies hidden from screen readers', (tracks[0].innerHTML.match(/aria-hidden="true"/g) || []).length === 4);
ok('photos are decorative with captions', /alt=""/.test(tracks[0].innerHTML) && tracks[0].innerHTML.includes('<figcaption>Trening LIVE</figcaption>'));

els['pl-land-email'] = makeEl('pl-land-email');
els['pl-land-email'].value = '  trener@przyklad.pl ';
let prevented = false;
ctx.landingStart({ preventDefault() { prevented = true; } });
const screen = els['auth-screen'];
ok('start opens login dialog', prevented && screen.classList.contains('pl-auth-open') && els['auth-card'].attrs['aria-hidden'] === 'false');
ok('email carried over, focus on password', els['auth-email'].value === 'trener@przyklad.pl' && ctx._focus === 'auth-password');
ok('login view shown', els['auth-login-view'].style.display === 'block' && els['auth-register-view'].style.display === 'none' && els['auth-reset-view'].style.display === 'none');

keyHandler({ key: 'Escape' });
ok('Escape closes dialog', !screen.classList.contains('pl-auth-open') && els['auth-card'].attrs['aria-hidden'] === 'true');

ctx.landingOpenAuth('register');
ok('register view shown', screen.classList.contains('pl-auth-open') && els['auth-register-view'].style.display === 'block' && els['auth-login-view'].style.display === 'none' && ctx._focus === 'auth-reg-email');

els['auth-reset-view'].style.display = 'block';
els['auth-login-view'].style.display = 'none';
ctx.landingOpenAuth();
ok('open without view keeps current form', els['auth-reset-view'].style.display === 'block');

screen.style.display = 'none';
keyHandler({ key: 'Escape' });
ok('Escape ignored when landing hidden', screen.classList.contains('pl-auth-open'));

if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
console.log('\nAll landing tests passed');
