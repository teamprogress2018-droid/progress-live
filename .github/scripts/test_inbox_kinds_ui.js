// UI: Wiadomości — filtr Czat / System / Broadcast, bez tagów [od:].
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.INBOX_KIND_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-inbox-kind'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const host = process.env.LAYOUT_HOST || '127.0.0.1';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL.splice(0, window.CL.length, { id: 'c-justyna', name: 'Justyna Chylińska', status: 'active', goal: 'redukcja', level: 'poczatkujacy' });
    Object.keys(window.MSGS || {}).forEach(k => delete window.MSGS[k]);
    window.MSGS['c-justyna'] = [
      { id: 'm1', clientId: 'c-justyna', text: 'Jak było na sali?', out: false, time: '10:01', createdAt: '2026-09-10T10:01:00.000Z' },
      { id: 'm2', clientId: 'c-justyna', text: '[od:ow2]\n🏠 Zadanie domowe od trenera: "HIIT 20"', out: true, time: '10:02', createdAt: '2026-09-10T10:02:00.000Z' },
      { id: 'm3', clientId: 'c-justyna', text: 'Siłownia jutro zamknięta', out: true, kind: 'broadcast', broadcast: true, time: '10:03', createdAt: '2026-09-10T10:03:00.000Z' }
    ];
    if (typeof goTo === 'function') goTo('inbox');
    if (typeof openChat === 'function') openChat('c-justyna');
  });

  await page.waitForSelector('#chat-kind-bar');
  const all = await page.evaluate(() => {
    const bar = document.getElementById('chat-kind-bar');
    const wrap = document.getElementById('msg-wrap');
    const preview = (document.getElementById('msg-list') || {}).innerText || '';
    return {
      barShown: !!(bar && bar.style.display !== 'none'),
      kinds: [...document.querySelectorAll('#msg-wrap .msg-row')].map(el => el.getAttribute('data-kind')),
      text: (wrap || {}).innerText || '',
      preview
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'inbox_kinds_all.png') });
  ok('kind bar shown', all.barShown);
  ok('three messages', all.kinds.join(',') === 'direct,system,broadcast', JSON.stringify(all.kinds));
  ok('tags stripped in thread', /HIIT 20/.test(all.text) && !/\[od:ow2\]/.test(all.text), all.text.slice(0, 300));
  ok('list preview stripped', /Siłownia jutro/.test(all.preview) && !/\[od:/.test(all.preview), all.preview.slice(0, 200));

  await page.click('.chat-kind-btn[data-kind="system"]');
  await page.waitForTimeout(200);
  const sys = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll('#msg-wrap .msg-row')].map(el => el.getAttribute('data-kind')),
    text: (document.getElementById('msg-wrap') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'inbox_kinds_system.png') });
  ok('system filter', sys.kinds.join(',') === 'system' && /Zadanie domowe/.test(sys.text) && !/Siłownia jutro/.test(sys.text), JSON.stringify(sys));

  await page.click('.chat-kind-btn[data-kind="direct"]');
  await page.waitForTimeout(200);
  const dir = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll('#msg-wrap .msg-row')].map(el => el.getAttribute('data-kind')),
    text: (document.getElementById('msg-wrap') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'inbox_kinds_direct.png') });
  ok('direct filter', dir.kinds.join(',') === 'direct' && /Jak było na sali/.test(dir.text) && !/Zadanie domowe/.test(dir.text), JSON.stringify(dir));

  await page.click('.chat-kind-btn[data-kind="broadcast"]');
  await page.waitForTimeout(200);
  const bc = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll('#msg-wrap .msg-row')].map(el => el.getAttribute('data-kind')),
    text: (document.getElementById('msg-wrap') || {}).innerText || ''
  }));
  await page.screenshot({ path: path.join(shotDir, 'inbox_kinds_broadcast.png') });
  ok('broadcast filter', bc.kinds.join(',') === 'broadcast' && /Siłownia jutro/.test(bc.text), JSON.stringify(bc));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll inbox-kinds UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
