// UI: Live — pionowy film techniki zajmuje duży ekran, bez ramki 16:9.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_VIDEO_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-video'));
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
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.confirm = () => true;
    window.notify = () => {};
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Adrian Ciszewski' }];
    window.SE = [];
    window.PL = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-exercises-panel, #live-ex-done');

  const gifMp4 = 'https://cdn.jsdelivr.net/gh/teamprogress2018-droid/progress-live-video-assets@d7dcf95c296ad18b00ec9dc076ba80a6b343ad1e/Wyciskanie%20sztangi.mp4';

  const gifStats = await page.evaluate((src) => {
    window.liveExercises = [{
      name: 'Wyciskanie żołnierskie hantlami (siedząc)',
      gif: src,
      note: 'Plecy wsparte o oparcie.',
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '18', reps: '10', rir: '2', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const card = document.getElementById('live-ex-0');
    const media = card && card.querySelector('.cw-technique-media');
    const video = card && card.querySelector('.cw-technique-gif video');
    const cs = video ? getComputedStyle(video) : null;
    const box = video ? video.getBoundingClientRect() : { height: 0, width: 0 };
    const mediaBox = media ? media.getBoundingClientRect() : { height: 0, width: 0 };
    return {
      videos: card ? card.querySelectorAll('video').length : 0,
      wraps: card ? card.querySelectorAll('.cw-video-wrap').length : -1,
      height: Math.round(box.height),
      width: Math.round(box.width),
      mediaH: Math.round(mediaBox.height),
      cssHeight: cs ? cs.height : '',
      cssMax: cs ? cs.maxHeight : '',
      cssPos: cs ? cs.position : '',
      cssWidth: cs ? cs.width : ''
    };
  }, gifMp4);

  await page.screenshot({ path: path.join(shotDir, 'live_video_gif_tall.png') });
  ok('one technique video', gifStats.videos === 1 && gifStats.wraps === 0, JSON.stringify(gifStats));
  ok('gif video tall', gifStats.height >= 500, JSON.stringify(gifStats));
  ok('gif video not full-width stamp', gifStats.width > 0 && gifStats.width < 900, JSON.stringify(gifStats));

  const fileStats = await page.evaluate((src) => {
    window.liveExercises = [{
      name: 'Wyciskanie żołnierskie hantlami (siedząc)',
      video: src,
      isFile: true,
      showVideo: true,
      note: 'Plecy wsparte o oparcie.',
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '18', reps: '10', rir: '2', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const card = document.getElementById('live-ex-0');
    const wrap = card && card.querySelector('.cw-video-wrap');
    const player = card && card.querySelector('.cw-file-player, .cw-video-file');
    const video = player && player.querySelector('video');
    const pad = wrap ? getComputedStyle(wrap).paddingTop : '0px';
    const box = video ? video.getBoundingClientRect() : { height: 0, width: 0 };
    return {
      hasWrap: !!wrap,
      hasPlayer: !!player,
      pad,
      height: Math.round(box.height),
      width: Math.round(box.width),
      videos: card ? card.querySelectorAll('video').length : 0
    };
  }, gifMp4);

  await page.screenshot({ path: path.join(shotDir, 'live_video_file_tall.png') });
  ok('file player not 16x9 wrap', !fileStats.hasWrap && fileStats.hasPlayer && fileStats.pad === '0px', JSON.stringify(fileStats));
  ok('file video tall', fileStats.height >= 500, JSON.stringify(fileStats));

  const dupStats = await page.evaluate((src) => {
    window.liveExercises = [{
      name: 'Wyciskanie żołnierskie hantlami (siedząc)',
      gif: src,
      video: src,
      isFile: true,
      showVideo: true,
      done: false,
      collapsed: false,
      sets: [{ setNo: 1, kg: '18', reps: '10', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const card = document.getElementById('live-ex-0');
    return {
      videos: card ? card.querySelectorAll('video').length : 0,
      filePlayers: card ? card.querySelectorAll('.cw-file-player').length : -1
    };
  }, gifMp4);
  ok('same mp4 not rendered twice', dupStats.videos === 1 && dupStats.filePlayers === 0, JSON.stringify(dupStats));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live video UI checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
