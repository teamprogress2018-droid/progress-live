// UI: w szczegółach ćwiczenia wklej MP4 / wybierz z Moich filmów i zapisz przy wybranej karcie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.ASSIGN_MP4_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-assign-mp4'));
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
    window.COACH_VIDEOS = [
      { id: 'cv-pec', name: 'Motyl z biblioteki', url: 'https://cdn.example.com/filmy/motyl.mp4' }
    ];
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Butterfly (peck deck)';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Butterfly (peck deck)');
  });
  await page.waitForSelector('#exd-assign');
  await page.waitForSelector('#exd-mp4-url');

  const panel = await page.evaluate(() => {
    const inp = document.getElementById('exd-mp4-url');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      hasAssign: !!document.getElementById('exd-assign'),
      hasPaste: !!inp,
      pasteTag: inp ? inp.tagName : '',
      pasteValue: inp ? inp.value : '',
      hasSuggest: !!document.getElementById('exd-mp4-suggest'),
      hasFile: !!document.getElementById('exd-mp4-file'),
      hasOwn: !!document.getElementById('exd-mp4-own'),
      ownText: (document.getElementById('exd-mp4-own') || {}).innerText || '',
      current: typeof currentExDetail !== 'undefined' ? currentExDetail : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ex_assign_panel.png') });
  ok('detail title pec deck', panel.title === 'Butterfly (peck deck)', panel.title);
  ok('assign panel visible', panel.hasAssign && panel.hasPaste && panel.hasFile, JSON.stringify(panel));
  ok('paste field empty textarea', panel.pasteTag === 'TEXTAREA' && !/^https?:\/\//i.test(panel.pasteValue || ''), JSON.stringify(panel));
  ok('suggest path button', panel.hasSuggest, JSON.stringify(panel));
  ok('own videos listed', panel.hasOwn && /Motyl z biblioteki/.test(panel.ownText), panel.ownText);
  ok('current exercise set', panel.current === 'Butterfly (peck deck)', panel.current);

  await page.fill('#exd-mp4-url', 'https://cdn.jsdelivr.net/gh/teamprogress20');
  await page.click('#exd-assign .btn-primary');
  await page.waitForTimeout(200);
  const trunc = await page.evaluate(() => {
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Butterfly (peck deck)') : 'butterfly (peck deck)';
    return {
      msg: (document.getElementById('exd-assign-msg') || {}).textContent || '',
      remote: (window.EX_GIF_REMOTE || {})[key] || ''
    };
  });
  ok('truncated https shows hint', /ucięty/i.test(trunc.msg), trunc.msg);
  ok('truncated https not saved', !trunc.remote, trunc.remote);

  await page.fill('#exd-mp4-url', '');
  await page.click('#exd-assign .btn-primary');
  await page.waitForTimeout(400);

  const pec = await page.evaluate(() => {
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Butterfly (peck deck)') : 'butterfly (peck deck)';
    const url = (window.EX_GIF_REMOTE || {})[key] || '';
    const video = document.querySelector('#exd-body video');
    return {
      url,
      cdn: /cdn\.jsdelivr\.net\/gh\/teamprogress2018-droid\/progress-live-video-assets@/.test(url),
      name: decodeURIComponent(url).indexOf('Machine Chest Fly (Pec Deck)') >= 0,
      docs: (window.__savedGifs || []).some((d) => d.data && d.data.exerciseName === 'Butterfly (peck deck)'),
      videoSrc: video ? video.getAttribute('src') : '',
      currentHint: !!(document.getElementById('exd-mp4-current'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ex_assign_pasted.png') });
  ok('paste local path saved as CDN', pec.cdn && pec.name, JSON.stringify(pec));
  ok('firestore wrote assign', pec.docs);
  ok('detail plays assigned mp4', /Machine Chest Fly \(Pec Deck\)/.test(decodeURIComponent(pec.videoSrc || '')), pec.videoSrc);
  ok('shows current film', pec.currentHint);

  const afterSave = await page.evaluate(() => {
    const player = document.getElementById('exd-mp4-player');
    const body = document.getElementById('exd-body');
    const assign = document.getElementById('exd-assign');
    const card = [...document.querySelectorAll('.ex-card')].find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Butterfly (peck deck)');
    return {
      playerSrc: player ? player.getAttribute('src') : '',
      autoplay: !!(player && player.hasAttribute('autoplay') && player.hasAttribute('muted')),
      filmBadge: !!(card && /FILM/.test(card.textContent || '')),
      cardVideo: !!(card && card.querySelector('video'))
    };
  });
  ok('assign player after save', /Machine Chest Fly \(Pec Deck\)/.test(decodeURIComponent(afterSave.playerSrc || '')), afterSave.playerSrc);
  ok('assign player autoplay muted', afterSave.autoplay, JSON.stringify(afterSave));
  ok('library card shows film badge', afterSave.filmBadge && afterSave.cardVideo, JSON.stringify(afterSave));

  const winCopy = 'Rozpiętki na maszynie (motyl) (Machine Chest Fly (Pec Deck)) (2).mp4';
  await page.fill('#exd-mp4-url', winCopy);
  await page.click('#exd-assign .btn-primary');
  await page.waitForTimeout(400);
  const copyPec = await page.evaluate(() => {
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Butterfly (peck deck)') : 'butterfly (peck deck)';
    const url = (window.EX_GIF_REMOTE || {})[key] || '';
    const decoded = decodeURIComponent(url);
    return {
      url,
      cdn: /cdn\.jsdelivr\.net\/gh\/teamprogress2018-droid\/progress-live-video-assets@/.test(url),
      canonical: decoded.indexOf('Machine Chest Fly (Pec Deck)') >= 0,
      droppedCopy: decoded.indexOf('(2)') < 0
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ex_assign_windows_copy.png') });
  ok('windows copy basename saved as canonical CDN', copyPec.cdn && copyPec.canonical && copyPec.droppedCopy, JSON.stringify(copyPec));

  await page.selectOption('#exd-mp4-own', 'cv-pec');
  await page.evaluate(() => {
    if (typeof assignExTechniqueFromOwn === 'function') assignExTechniqueFromOwn(currentExDetail);
  });
  await page.waitForTimeout(400);
  const own = await page.evaluate(() => {
    const key = typeof exerciseMediaKey === 'function' ? exerciseMediaKey('Butterfly (peck deck)') : 'butterfly (peck deck)';
    return {
      remote: (window.EX_GIF_REMOTE || {})[key] || '',
      exName: ((window.COACH_VIDEOS || [])[0] || {}).exName || '',
      videoSrc: (document.querySelector('#exd-body video') || {}).getAttribute ? document.querySelector('#exd-body video').getAttribute('src') : '',
      videoCount: document.querySelectorAll('#exd-body video').length
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ex_assign_own.png') });
  ok('own mp4 assigned', own.remote === 'https://cdn.example.com/filmy/motyl.mp4', own.remote);
  ok('own video tagged with exercise', own.exName === 'Butterfly (peck deck)', own.exName);
  ok('detail video from own library', own.videoSrc === 'https://cdn.example.com/filmy/motyl.mp4', own.videoSrc);
  ok('only one player after own assign', own.videoCount === 1, String(own.videoCount));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll exercise MP4 assign UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
