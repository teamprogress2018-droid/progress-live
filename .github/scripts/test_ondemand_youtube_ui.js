// UI: portal On-demand odtwarza YouTube (iframe), klient też.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.OD_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-od'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.OD_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.OD_HEADED !== '1' });
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
    window.CL = [{ id: 'c-anna', name: 'Anna Nowak' }];
    window.OD_WORKOUTS = [];
    if (typeof ensureODWorkouts === 'function') ensureODWorkouts();
    if (typeof migrateODYoutubeWorkouts === 'function') migrateODYoutubeWorkouts();
    goTo('ondemand');
  });

  await page.waitForSelector('.od-workout-card');
  const browse = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.od-workout-card')];
    const text = (document.getElementById('screen-ondemand') || {}).innerText || '';
    const thumbs = [...document.querySelectorAll('.od-thumb')].map((el) => el.getAttribute('style') || '');
    return {
      count: cards.length,
      text,
      youtubeThumbs: thumbs.filter((s) => /i\.ytimg\.com/.test(s)).length,
      hasPlay: /Odtwórz/.test(text)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ondemand_youtube_browse.png') });
  ok('workout cards rendered', browse.count >= 4, 'count=' + browse.count);
  ok('youtube thumbnails', browse.youtubeThumbs >= 4, 'thumbs=' + browse.youtubeThumbs);
  ok('play buttons', browse.hasPlay);
  ok('copy says youtube', /YouTube/i.test(browse.text));

  await page.click('button:has-text("Odtwórz")');
  await page.waitForSelector('#m-od-player.show, #m-od-player.modal-ov.show, #od-player-frame');
  await page.waitForTimeout(400);
  const player = await page.evaluate(() => {
    const modal = document.getElementById('m-od-player');
    const frame = document.getElementById('od-player-frame');
    return {
      shown: !!(modal && modal.classList.contains('show')),
      src: (frame && frame.getAttribute('src')) || '',
      title: (document.getElementById('od-player-title') || {}).textContent || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ondemand_youtube_player.png') });
  ok('player modal shown', player.shown);
  ok('iframe youtube-nocookie', /youtube-nocookie\.com\/embed\//.test(player.src), player.src);
  ok('player has title', player.title.length > 3, player.title);

  await page.evaluate(() => {
    if (typeof closeODPlayer === 'function') closeODPlayer();
    window.USER_RESOURCES = (typeof DEMO_RESOURCES !== 'undefined' ? DEMO_RESOURCES : []).map((r) => Object.assign({}, r));
    goTo('clientapp');
    const sel = document.getElementById('cap-client-sel');
    if (sel) sel.value = 'c-anna';
    if (typeof setCapScreen === 'function') setCapScreen('ondemand');
  });
  await page.waitForSelector('#cap-screen-content');
  await page.waitForTimeout(300);
  const cap = await page.evaluate(() => {
    const root = document.getElementById('cap-screen-content');
    const html = (root && root.innerHTML) || '';
    const text = (root && root.innerText) || '';
    return { html, text, play: /openODWorkout/.test(html), yt: /YouTube/i.test(text) };
  });
  await page.screenshot({ path: path.join(shotDir, 'client_app_ondemand_youtube.png') });
  ok('client ondemand playable', cap.play);
  ok('client ondemand youtube label', cap.yt);

  await page.evaluate(() => {
    const btn = document.querySelector('#cap-screen-content button[onclick*="openODWorkout"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  const capPlayer = await page.evaluate(() => {
    const frame = document.getElementById('od-player-frame');
    const modal = document.getElementById('m-od-player');
    return {
      shown: !!(modal && modal.classList.contains('show')),
      src: (frame && frame.getAttribute('src')) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'client_app_ondemand_player.png') });
  ok('client player iframe', /youtube-nocookie\.com\/embed\//.test(capPlayer.src), capPlayer.src);

  await page.evaluate(() => {
    if (typeof closeODPlayer === 'function') closeODPlayer();
    window._clientAppMode = true;
    window._clientId = 'c-anna';
    window._clientLiveScreen = 'home';
    window.CL = [{ id: 'c-anna', name: 'Anna Nowak' }];
    window.SETTINGS = window.SETTINGS || {};
    window.SETTINGS.clientApp = { visibleSections: { ondemand: true } };
    if (typeof ensureODWorkouts === 'function') ensureODWorkouts();
    document.body.classList.add('client-app-mode');
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    document.getElementById('screen-clientlive').classList.add('active');
    window.capClientId = 'c-anna';
    if (typeof renderClientLive === 'function') renderClientLive();
  });
  await page.waitForSelector('#clive-bn-ondemand');
  const liveNav = await page.evaluate(() => ({
    ondemandBtn: !!(document.getElementById('clive-bn-ondemand') && document.getElementById('clive-bn-ondemand').style.display !== 'none'),
    homeOd: /ON-DEMAND/i.test((document.getElementById('clive-screen-content') || {}).innerText || '')
  }));
  await page.screenshot({ path: path.join(shotDir, 'client_live_home_ondemand.png') });
  ok('live nav ondemand', liveNav.ondemandBtn);
  ok('live home featured od', liveNav.homeOd);

  await page.click('#clive-bn-ondemand');
  await page.waitForTimeout(300);
  const liveOd = await page.evaluate(() => {
    const html = (document.getElementById('clive-screen-content') || {}).innerHTML || '';
    return { html, play: /openODWorkout/.test(html) };
  });
  ok('live ondemand list', liveOd.play);

  await page.evaluate(() => {
    const btn = document.querySelector('#clive-screen-content button[onclick*="openODWorkout"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  const livePlayer = await page.evaluate(() => {
    const wrap = document.getElementById('clive-player');
    const frame = document.getElementById('od-player-frame');
    return {
      playerOpen: !!(wrap && !wrap.hidden),
      odPlaying: document.body.classList.contains('od-playing'),
      src: (frame && frame.getAttribute('src')) || ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'client_live_ondemand_player.png') });
  ok('live clive player open', livePlayer.playerOpen && livePlayer.odPlaying);
  ok('live clive iframe', /youtube-nocookie\.com\/embed\//.test(livePlayer.src), livePlayer.src);

  await page.evaluate(() => {
    if (typeof closeODPlayer === 'function') closeODPlayer();
    if (typeof ensureODPrograms === 'function') ensureODPrograms();
    window._cliveOdProgId = 'op2';
    if (typeof openODProgramClient === 'function') openODProgramClient('op2');
  });
  await page.waitForTimeout(350);
  const liveProg = await page.evaluate(() => ({
    text: (document.getElementById('clive-screen-content') || {}).innerText || '',
    play: /openODWorkout/.test((document.getElementById('clive-screen-content') || {}).innerHTML || '')
  }));
  await page.screenshot({ path: path.join(shotDir, 'client_live_odprogram.png') });
  ok('live odprogram screen', /Full Body/i.test(liveProg.text));
  ok('live odprogram play', liveProg.play);

  await page.evaluate(() => {
    if (typeof setClientLiveScreen === 'function') setClientLiveScreen('resources');
  });
  await page.waitForTimeout(250);
  const liveRes = await page.evaluate(() => ({
    nav: !!(document.getElementById('clive-bn-resources') && document.getElementById('clive-bn-resources').style.display !== 'none'),
    text: (document.getElementById('clive-screen-content') || {}).innerText || '',
    hrefs: [...document.querySelectorAll('#clive-screen-content a[href]')].map((a) => a.getAttribute('href') || '')
  }));
  await page.screenshot({ path: path.join(shotDir, 'client_live_resources.png') });
  ok('live resources nav', liveRes.nav);
  ok('live resources youtube', liveRes.hrefs.some((u) => /youtube\.com/i.test(u)));

  await browser.close();
  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nUI on-demand YouTube: OK. Screenshoty: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
