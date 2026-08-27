// Unit: wygaszacz z logo studia.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');
const logoPath = path.join(root, 'assets', 'brand', 'progress-logo.jpg');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('logo file', fs.existsSync(logoPath) && fs.statSync(logoPath).size > 10000);
ok('overlay html', html.includes('id="pl-screensaver"') && html.includes('assets/brand/progress-logo.jpg') && html.includes('pl-ss-clock'));
ok('css overlay', css.includes('.pl-ss.on') && css.includes('@keyframes pl-ss-ken') && css.includes('prefers-reduced-motion'));
ok('settings ui', src04.includes("card('Wygaszacz'") && src04.includes('previewScreensaver()') && src04.includes("toggle('screensaver'"));
ok('settings default', src04.includes('screensaver:{') && src04.includes('idleMinutes:3'));
ok('cache bumps', html.includes('01-core.js?v=45') && html.includes('04-client-portal.js?v=33') && html.includes('styles.css?v=48'));
ok('CI', wf.includes('test_screensaver.js') && wf.includes('test_screensaver_ui.js'));

const attrs = {};
const img = {
  src: 'assets/brand/progress-logo.jpg',
  getAttribute(k) { return k === 'src' ? this.src : attrs[k]; },
  setAttribute(k, v) { if (k === 'src') this.src = v; attrs[k] = v; }
};
const clock = { textContent: '' };
const dateEl = { textContent: '' };
const overlay = {
  className: 'pl-ss',
  hidden: true,
  _on: false,
  classList: {
    add(c) { if (c === 'on') overlay._on = true; },
    remove(c) { if (c === 'on') overlay._on = false; },
    contains(c) { return c === 'on' && overlay._on; }
  },
  setAttribute(k, v) { attrs[k] = v; if (k === 'hidden') overlay.hidden = true; },
  removeAttribute(k) { delete attrs[k]; if (k === 'hidden') overlay.hidden = false; },
  getAttribute(k) { return attrs[k]; },
  addEventListener() {},
  querySelector(sel) { return sel === '.pl-ss-logo' ? img : null; }
};

const documentStub = {
  readyState: 'loading',
  hidden: false,
  addEventListener() {},
  querySelectorAll: () => [],
  getElementById(id) {
    if (id === 'pl-screensaver') return overlay;
    if (id === 'pl-ss-clock') return clock;
    if (id === 'pl-ss-date') return dateEl;
    return null;
  }
};
const windowObj = {
  addEventListener() {},
  SETTINGS: { brand: { logo: null } },
  location: { search: '' },
  document: documentStub
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document: documentStub,
  console,
  Date, Math, parseInt, parseFloat, Number, String, Array, Object, JSON,
  setTimeout, clearTimeout, setInterval, clearInterval,
  isNaN, Infinity, undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(core, ctx);

ok('ensure defaults', ctx.ensureScreensaverSettings().enabled === true && ctx.ensureScreensaverSettings().idleMinutes === 3);
ok('idle ms default', ctx.screensaverIdleMs() === 3 * 60 * 1000);
ok('default logo', ctx.screensaverLogoUrl() === 'assets/brand/progress-logo.jpg');
windowObj.SETTINGS.brand.logo = 'data:image/png;base64,xxx';
ok('uploaded logo wins', ctx.screensaverLogoUrl() === 'data:image/png;base64,xxx');
windowObj.SETTINGS.brand.logo = null;

ok('show preview', ctx.showScreensaver(true) === true && overlay._on === true);
ok('clock filled', !!clock.textContent);
ok('hide', (ctx.hideScreensaver(), overlay._on === false));
windowObj.SETTINGS.screensaver.enabled = false;
ctx.resetScreensaverIdle();

ok('disabled skips idle show', ctx.showScreensaver(false) === false);
ok('force still shows', ctx.showScreensaver(true) === true);
ctx.hideScreensaver();
ctx.resetScreensaverIdle();

windowObj.SETTINGS.screensaver.enabled = true;
windowObj.SETTINGS.screensaver.idleMinutes = 2;
ok('idle 2 min', ctx.screensaverIdleMs() === 2 * 60 * 1000);
windowObj.SETTINGS.screensaver.enabled = false;
ctx.resetScreensaverIdle();

ok('kiosk query', (windowObj.location.search = '?ss=1', ctx.screensaverQueryForce() === true));
ok('kiosk alias', (windowObj.location.search = '?foo=1&wygaszacz=1', ctx.screensaverQueryForce() === true));
ok('kiosk off', (windowObj.location.search = '', ctx.screensaverQueryForce() === false));

const prevGet = documentStub.getElementById;
documentStub.getElementById = () => ({ querySelector() { return null; }, classList: { add() {}, remove() {} } });
ok('stub overlay ignored', ctx.screensaverOverlayEl() === null);
ok('stub no show', ctx.showScreensaver(true) === false);
documentStub.getElementById = prevGet;

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('\nAll screensaver tests passed');
