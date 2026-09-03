// UI: wklej MP4 w import masowy i zapisz bez klikania „Parsuj listę”.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.GIF_IMPORT_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-gif-import'));
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
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    window.notify = function () {};
    window._uid = 'trainer-ui';
    window._db = {};
    window.__savedGifs = [];
    window._doc = (_db, col, id) => ({ col, id });
    window._setDoc = async (ref, data) => {
      window.__savedGifs.push({ ref, data });
    };
    window.EX_GIF_REMOTE = {};
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
  });
  await page.waitForSelector('#lib-import-gif');

  const copy = await page.evaluate(() => {
    const btn = document.getElementById('lib-import-gif');
    const title = document.querySelector('#m-ex-gif-import .modal-title');
    const files = document.getElementById('exgif-files');
    return {
      btn: btn ? btn.textContent : '',
      title: title ? title.textContent : '',
      accept: files ? files.getAttribute('accept') : '',
      dir: files ? files.hasAttribute('webkitdirectory') : null
    };
  });
  ok('toolbar says GIF / MP4', /MP4/i.test(copy.btn), copy.btn);
  ok('modal title mentions MP4', /MP4/i.test(copy.title), copy.title);
  ok('file picker accepts mp4', /mp4/i.test(copy.accept), copy.accept);
  ok('file picker is not folder-only', copy.dir === false, JSON.stringify(copy));

  await page.click('#lib-import-gif');
  await page.waitForSelector('#m-ex-gif-import.open, #m-ex-gif-import.modal-ov.open, #exgif-paste');
  const modalShown = await page.evaluate(() => {
    const m = document.getElementById('m-ex-gif-import');
    if (!m) return false;
    const st = getComputedStyle(m);
    return m.classList.contains('open') || st.display !== 'none' || st.visibility !== 'hidden';
  });
  if (!modalShown) {
    await page.evaluate(() => {
      if (typeof openExGifImport === 'function') openExGifImport();
    });
  }
  await page.waitForSelector('#exgif-paste');

  const mp4 = 'https://cdn.example.com/filmy/bench.mp4';
  await page.fill('#exgif-paste', 'Wyciskanie sztangi leżąc | ' + mp4);
  await page.screenshot({ path: path.join(shotDir, 'gif_import_mp4_paste.png') });

  await page.click('#exgif-import-btn');
  await page.waitForTimeout(400);

  const saved = await page.evaluate((want) => {
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Wyciskanie sztangi leżąc') : 'wyciskanie sztangi leżąc';
    return {
      remote: (window.EX_GIF_REMOTE || {})[key] || '',
      docs: window.__savedGifs || [],
      rows: typeof window._exGifImportRows !== 'undefined' ? window._exGifImportRows : null,
      gifUrl: typeof exGifUrl === 'function' ? exGifUrl('Wyciskanie sztangi leżąc') : ''
    };
  }, mp4);
  await page.screenshot({ path: path.join(shotDir, 'gif_import_mp4_saved.png') });
  ok('remote map saved mp4', saved.remote === mp4, JSON.stringify(saved));
  ok('firestore wrote mp4', saved.docs.some((d) => d.data && d.data.gifUrl === mp4), JSON.stringify(saved.docs));
  ok('exGifUrl returns mp4', saved.gifUrl === mp4, saved.gifUrl);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll GIF/MP4 import UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
