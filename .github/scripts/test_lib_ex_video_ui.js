// UI: biblioteka ćwiczeń odtwarza MP4 techniki w szczegółach, karty zostają ze zdjęciem.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIB_VIDEO_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-lib-video'));
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
  });

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Wyciskanie sztangi leżąc';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');

  const card = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Wyciskanie sztangi leżąc');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_bench_card.png') });
  ok('bench card rendered', card.found, JSON.stringify(card));
  ok('bench card uses still photo', /free-exercise-db|githubusercontent/i.test(card.img) && !/\.mp4/i.test(card.img), card.img);
  ok('bench card has no video tag', !card.hasVideo);

  await page.evaluate(() => {
    if (typeof setExView === 'function') setExView('grid');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Przysiad hack maszyna';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Przysiad hack maszyna');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    return !!(img && img.complete && img.naturalWidth > 0);
  });
  const hack = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Przysiad hack maszyna');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      complete: img ? img.complete : false,
      w: img ? img.naturalWidth : 0,
      h: img ? img.naturalHeight : 0,
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_hack_squat_card.png') });
  ok('hack squat card rendered', hack.found, JSON.stringify(hack));
  ok('hack squat card uses local gif', /przysiad-hack-maszyna\.gif/.test(hack.img) && !/\.mp4/i.test(hack.img) && !/Hack_Squat\/0\.jpg/.test(hack.img), hack.img);
  ok('hack squat gif loaded', hack.complete && hack.w > 0 && hack.h > 0, JSON.stringify(hack));
  ok('hack squat card has no video tag', !hack.hasVideo);

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Przysiad hack maszyna');
  });
  await page.waitForSelector('#exd-body .ex-guide');
  await page.waitForSelector('#exd-body img.cw-technique-gif-img, #exd-body .cw-technique-gif img');
  const hackDetail = await page.evaluate(() => {
    const img = document.querySelector('#exd-body img.cw-technique-gif-img') || document.querySelector('#exd-body .cw-technique-gif img');
    const video = document.querySelector('#exd-body video');
    const guide = document.querySelector('#exd-body .ex-guide');
    const phases = [...document.querySelectorAll('#exd-body .ex-phase img')].map((el) => el.getAttribute('src') || '');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: img ? img.getAttribute('src') : '',
      hasVideo: !!video,
      hasGuide: !!guide,
      phases,
      anatomy: !!(guide && guide.querySelector('.ex-anatomy img')),
      stretch: !!(guide && guide.querySelector('.ex-stretch-lens img')),
      heat: !!(guide && guide.querySelector('.ex-phase-heat')),
      copy: guide ? (guide.innerText || '') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_hack_squat_detail.png') });
  ok('hack squat detail title', hackDetail.title === 'Przysiad hack maszyna', hackDetail.title);
  ok('hack squat detail shows gif', /przysiad-hack-maszyna\.gif/.test(hackDetail.src), hackDetail.src);
  ok('hack squat detail has no mp4 video', !hackDetail.hasVideo);
  ok('hack squat guide rendered', hackDetail.hasGuide && hackDetail.phases.length === 3, JSON.stringify(hackDetail.phases));
  ok('hack squat phases from gif stills', hackDetail.phases.some((s) => /phase-start/.test(s)) && hackDetail.phases.some((s) => /phase-bottom/.test(s)));
  ok('hack squat anatomy + stretch', hackDetail.anatomy && hackDetail.stretch && hackDetail.heat);
  ok('hack squat stretch copy', /Pełne rozciągnięcie/i.test(hackDetail.copy) && /czworogł/i.test(hackDetail.copy));

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Wyciskanie sztangi leżąc');
  });
  await page.waitForSelector('#exd-body video');
  const detail = await page.evaluate(() => {
    const video = document.querySelector('#exd-body video');
    const title = (document.getElementById('exd-title') || {}).textContent || '';
    return {
      title,
      src: video ? video.getAttribute('src') : '',
      autoplay: video ? video.hasAttribute('autoplay') : false,
      loop: video ? video.hasAttribute('loop') : false
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_bench_detail.png') });
  ok('detail title is bench', detail.title === 'Wyciskanie sztangi leżąc', detail.title);
  ok('detail plays mp4', /progress-live-video-assets/.test(detail.src) && /\.mp4/i.test(detail.src), detail.src.slice(0, 160));
  ok('detail video loops muted autoplay', detail.autoplay && detail.loop);

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Ściąganie do twarzy (face pull)');
  });
  await page.waitForTimeout(300);
  const face = await page.evaluate(() => {
    const video = document.querySelector('#exd-body video');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: video ? video.getAttribute('src') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_facepull_detail.png') });
  ok('face pull detail video', /Face%20Pull|Face Pull/i.test(decodeURIComponent(face.src || '')) && /\.mp4/i.test(face.src), face.src.slice(0, 160));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('library');
    const inp = document.getElementById('ex-search');
    if (inp) inp.value = 'Butterfly (peck deck)';
    if (typeof renderLib === 'function') renderLib();
  });
  await page.waitForSelector('.ex-card');
  const pecCard = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ex-card')];
    const hit = cards.find((el) => (el.querySelector('.ex-card-name') || {}).textContent === 'Butterfly (peck deck)');
    const img = hit && hit.querySelector('.ex-card-thumb img');
    const vid = hit && hit.querySelector('.ex-card-thumb video');
    return {
      found: !!hit,
      img: img ? img.getAttribute('src') : '',
      hasVideo: !!vid
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_pec_deck_card.png') });
  ok('pec deck card rendered', pecCard.found, JSON.stringify(pecCard));
  ok('pec deck card uses local gif', /butterfly-peck-deck\.gif/.test(pecCard.img) && !/\.mp4/i.test(pecCard.img), pecCard.img);
  ok('pec deck card has no video tag', !pecCard.hasVideo);

  await page.evaluate(() => {
    if (typeof openExDetail === 'function') openExDetail('Butterfly (peck deck)');
  });
  await page.waitForSelector('#exd-body .ex-guide[data-guide="pec-deck"]');
  const pecDetail = await page.evaluate(() => {
    const img = document.querySelector('#exd-body img.cw-technique-gif-img') || document.querySelector('#exd-body .cw-technique-gif img');
    const video = document.querySelector('#exd-body video');
    const cap = document.querySelector('#exd-body .cw-technique-cap');
    const guide = document.querySelector('#exd-body .ex-guide[data-guide="pec-deck"]');
    const phases = [...document.querySelectorAll('#exd-body .ex-guide[data-guide="pec-deck"] .ex-phase img')].map((el) => el.getAttribute('src') || '');
    return {
      title: (document.getElementById('exd-title') || {}).textContent || '',
      src: img ? img.getAttribute('src') : '',
      hasVideo: !!video,
      cap: cap ? (cap.textContent || '') : '',
      hasGuide: !!guide,
      phases,
      copy: guide ? (guide.innerText || '') : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'lib_pec_deck_detail.png') });
  ok('pec deck detail title', pecDetail.title === 'Butterfly (peck deck)', pecDetail.title);
  ok('pec deck detail shows matching gif', /butterfly-peck-deck\.gif/.test(pecDetail.src), pecDetail.src);
  ok('pec deck detail has no mp4 video', !pecDetail.hasVideo);
  ok('pec deck caption is exercise name', /Butterfly \(peck deck\)/i.test(pecDetail.cap), pecDetail.cap);
  ok('pec deck guide phases', pecDetail.hasGuide && pecDetail.phases.some((s) => /phase-open/.test(s)) && pecDetail.phases.some((s) => /phase-close/.test(s)));
  ok('pec deck guide copy', /Łokcie na poziomie barków/i.test(pecDetail.copy) && /motyl/i.test(pecDetail.copy));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    const day = document.querySelector('.builder-day');
    if (day && typeof addRow === 'function') addRow(day.id);
  });
  await page.waitForSelector('.ex-row [data-f="name"]');
  await page.fill('.ex-row [data-f="name"]', 'Pompki');
  await page.waitForTimeout(400);
  const builder = await page.evaluate(() => {
    const row = document.querySelector('.ex-row');
    const thumb = row && row.querySelector('.builder-ex-thumb');
    const video = thumb && thumb.querySelector('video');
    return {
      hidden: !!(thumb && thumb.hidden),
      src: video ? video.getAttribute('src') : '',
      hasVideo: !!video
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_pompki_video.png') });
  ok('builder pompki shows technique video', builder.hasVideo && !builder.hidden && /Push-up/i.test(decodeURIComponent(builder.src || '')), JSON.stringify(builder).slice(0, 220));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll lib-ex-video UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
