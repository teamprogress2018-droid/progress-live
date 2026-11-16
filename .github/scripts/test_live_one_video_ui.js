// UI: karta LIVE odtwarza jeden film naraz — film trenera (YouTube / plik) zastępuje
// animację lub MP4 techniki z biblioteki; bez filmu trenera zostaje technika z biblioteki.
const { chromium } = require('playwright');

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  // Bez sieci: odtwarzacze nie muszą się załadować, liczymy elementy na karcie.
  await page.route(/youtube|example\.test/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    window._uid = 'live-one-video';
    window._clientAppMode = false;
    window.notify = () => {};
    ['auth-screen', 'app-loading'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app-root').style.display = '';
    window.CL = [{ id: 'c1', trainerId: window._uid, name: 'Anna Test' }];
    window.SE = [];
    window.EX = [{ id: 'ex-lib-1', name: 'Wiosłowanie testowe', cat: 'plecy', gif: 'https://example.test/technika.mp4' }];
    if (typeof goTo === 'function') goTo('live');
    window.liveClientId = 'c1';
    const mk = (name, video) => ({ name, video, showVideo: true, collapsed: false, uiExpanded: true, done: false,
      sets: [{ setNo: 1, kg: '20', reps: '10', rir: '2', done: false }] });
    window.liveExercises = [
      mk('Wiosłowanie testowe', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      mk('Wiosłowanie testowe', ''),
      mk('Wiosłowanie testowe', 'https://example.test/film-trenera.mp4')
    ];
    renderLiveExercises(0);
    const players = (i) => {
      const box = document.querySelector('#live-ex-' + i + ' .live-ex-media');
      if (!box) return { box: false };
      return {
        box: true,
        iframes: box.querySelectorAll('iframe').length,
        videos: box.querySelectorAll('video').length,
        libGif: box.querySelectorAll('.cw-technique-gif').length,
        trainerYt: !!box.querySelector('.cw-video-wrap iframe'),
        trainerFile: !!box.querySelector('.cw-video-file video')
      };
    };
    return { yt: players(0), lib: players(1), file: players(2) };
  });
  const total = (p) => (p.iframes || 0) + (p.videos || 0);
  ok('trainer YouTube video: one player, no library MP4 next to it', r.yt.box && total(r.yt) === 1 && r.yt.trainerYt && r.yt.libGif === 0, JSON.stringify(r.yt));
  ok('trainer MP4 file: one player, no library MP4 next to it', r.file.box && total(r.file) === 1 && r.file.trainerFile && r.file.libGif === 0, JSON.stringify(r.file));
  ok('no trainer video: library technique still shown', r.lib.box && r.lib.libGif === 1 && total(r.lib) === 1, JSON.stringify(r.lib));

  await browser.close();
  if (failed) { console.error('\n' + failed + ' live one-video check(s) failed'); process.exit(1); }
  console.log('\nAll live one-video checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
