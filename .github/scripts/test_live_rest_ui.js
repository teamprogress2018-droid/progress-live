// UI: timer przerwy live — 30s i własny czas (35s).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_REST_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-rest'));
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr' }];
    if (typeof goTo === 'function') goTo('live');
  });
  await page.waitForSelector('#live-rest-timer');

  const presets = await page.evaluate(() =>
    [...document.querySelectorAll('.live-rest-preset')].map((b) => b.textContent.trim())
  );
  ok('has 30s preset', presets.includes('30s'), JSON.stringify(presets));
  ok('has 40s HIIT preset', presets.includes('40s'), JSON.stringify(presets));
  ok('keeps 60s', presets.includes('60s'));
  ok('custom field present', await page.locator('#live-rest-custom').count() === 1);

  await page.click('.live-rest-preset:text("30s")');
  await page.waitForTimeout(80);
  const after30 = await page.locator('#live-rest-timer').textContent();
  ok('30s starts countdown', /30s|29s/.test(after30 || ''), after30);

  await page.fill('#live-rest-custom', '35');
  await page.click('.live-rest-custom-go');
  await page.waitForTimeout(80);
  const after35 = await page.locator('#live-rest-timer').textContent();
  ok('35s custom starts countdown', /35s|34s/.test(after35 || ''), after35);

  const mid = await page.evaluate(() => {
    const card = document.querySelector('#live-rest-timer') && document.querySelector('#live-rest-timer').closest('.live-rest-card');
    return {
      ending: !!(card && card.classList.contains('is-ending')),
      text: (document.getElementById('live-rest-timer') || {}).textContent
    };
  });
  ok('35s not yet ending pulse', !mid.ending, JSON.stringify(mid));

  const cues = await page.evaluate(() => {
    window.__restSpoken = [];
    window.__restCues = [];
    const prevBeep = window.liveRestBeep;
    const prevSpeak = window.liveRestSpeak;
    window.liveRestSpeak = (sec) => {
      const t = typeof liveRestSpeakText === 'function' ? liveRestSpeakText(sec) : '';
      if (t) window.__restSpoken.push(t);
      return true;
    };
    window.liveRestBeep = (k) => { window.__restCues.push(k); };
    if (typeof liveStartRest === 'function') liveStartRest(5);
    const card = document.querySelector('#live-rest-timer').closest('.live-rest-card');
    const five = {
      text: document.getElementById('live-rest-timer').textContent,
      ending: card.classList.contains('is-ending'),
      warn: card.classList.contains('is-warn'),
      spoken: window.__restSpoken.slice(),
      cues: window.__restCues.slice()
    };
    if (typeof liveStartRest === 'function') liveStartRest(3);
    const three = {
      text: document.getElementById('live-rest-timer').textContent,
      ending: card.classList.contains('is-ending'),
      spoken: window.__restSpoken.slice()
    };
    if (typeof liveStartRest === 'function') liveStartRest(0);
    const goCard = document.querySelector('#live-rest-timer').closest('.live-rest-card');
    const go = {
      text: document.getElementById('live-rest-timer').textContent,
      go: goCard.classList.contains('is-go'),
      spoken: window.__restSpoken.slice(),
      cues: window.__restCues.slice()
    };
    window.__restCues = [];
    window.liveRestSpeak = () => false;
    if (typeof liveStartRest === 'function') liveStartRest(0);
    const fallback = { cues: window.__restCues.slice() };
    window.liveRestBeep = prevBeep;
    window.liveRestSpeak = prevSpeak;
    return { five, three, go, fallback };
  });
  ok('last 5s pulse + Pięć', cues.five.ending && cues.five.warn && /5s/.test(cues.five.text || '') && cues.five.spoken.includes('Pięć') && !cues.five.cues.includes('tick'), JSON.stringify(cues.five));
  ok('3s READY spoken Gotowi', cues.three && cues.three.ending && /READY/.test(cues.three.text || '') && cues.three.spoken.includes('Gotowi'), JSON.stringify(cues.three));
  ok('GO flash + Jazda', cues.go.go && /LET'S GO/.test(cues.go.text || '') && cues.go.spoken.includes('Jazda!') && !cues.go.cues.includes('go'), JSON.stringify(cues.go));
  ok('beep fallback without TTS', cues.fallback && cues.fallback.cues.includes('go'), JSON.stringify(cues.fallback));
  ok('last 5s pulse + Five + beep', cues.five.ending && cues.five.warn && /5s/.test(cues.five.text || '') && cues.five.spoken.includes('Five') && cues.five.cues.includes('tick'), JSON.stringify(cues.five));
  ok('3s READY spoken', cues.three && cues.three.ending && /READY/.test(cues.three.text || '') && cues.three.spoken.includes('Ready'), JSON.stringify(cues.three));
  ok("GO flash + Let's go + beep", cues.go.go && /LET'S GO/.test(cues.go.text || '') && cues.go.spoken.includes("Let's go!") && cues.go.cues.includes('go'), JSON.stringify(cues.go));
  ok('beep still without TTS', cues.fallback && cues.fallback.cues.includes('go'), JSON.stringify(cues.fallback));

  const dual = await page.evaluate(() => {
    if (typeof liveToggleDual === 'function') liveToggleDual();
    window.__restSpokenB = [];
    window.__restCuesB = [];
    window.liveRestSpeak = (sec) => {
      const t = typeof liveRestSpeakText === 'function' ? liveRestSpeakText(sec) : '';
      if (t) window.__restSpokenB.push(t);
      return true;
    };
    window.liveRestBeep = (k) => { window.__restCuesB.push(k); };
    if (typeof liveStartRest === 'function') liveStartRest(5, 1);
    const el = document.getElementById('live-b-rest-timer');
    const card = el && el.closest('.live-rest-card');
    return {
      text: el && el.textContent,
      ending: !!(card && card.classList.contains('is-ending')),
      spoken: window.__restSpokenB.slice(),
      cues: window.__restCuesB.slice()
    };
  });
  ok('slot B ending voice', dual.ending && /5s/.test(dual.text || '') && dual.spoken.includes('Pięć'), JSON.stringify(dual));
  ok('slot B ending voice + beep', dual.ending && /5s/.test(dual.text || '') && dual.spoken.includes('Five') && dual.cues.includes('tick'), JSON.stringify(dual));

  try {
    await page.screenshot({ path: path.join(shotDir, 'live_rest_custom_35.png') });
  } catch (e) {
    console.warn('shot skip', e.message);
  }

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-rest UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
