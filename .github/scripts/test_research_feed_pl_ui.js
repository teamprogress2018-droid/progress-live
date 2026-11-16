// UI: Baza wiedzy → Nowe badania — pozycje bez polskiego opracowania tłumaczy proxy AI w aplikacji.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.KB_FEED_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-kb-feed');
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

const item = (pmid, extra) => Object.assign({
  pmid, doi: '', title: 'Effects of resistance training in older adults ' + pmid, abstract: 'BACKGROUND: English abstract ' + pmid + '. RESULTS: Strength improved.',
  journal: 'J', journalAbbr: 'J', year: '2026', authors: 'Kowalski J i in.', evidence: 'meta', evidenceLabel: 'Metaanaliza',
  url: 'https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/', topics: ['hipertrofia'], score: 5
}, extra || {});
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const preflight = (r) => r.request().method() === 'OPTIONS' ? (r.fulfill({ status: 204, headers: CORS }), true) : false;
const FEED = {
  version: 1, generatedAt: '2026-11-09T12:00:00Z', categories: [{ id: 'hipertrofia', label: 'Hipertrofia i siła' }],
  items: [
    item('111', { ai: { titlePl: 'Już po polsku z feedu', summary: 'Gotowe streszczenie.', takeaway: '', population: '', limits: '', relevance: 4 } }),
    item('222'), item('333')
  ]
};

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const host = process.env.LAYOUT_HOST || '127.0.0.1';
  const browser = await chromium.launch({ headless: true });
  // Service worker serwowałby prawdziwy feed z pominięciem page.route.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  let aiCalls = 0, aiBody = null;
  await page.route(/research-feed\.json/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(FEED) }));
  await page.route('https://anthropic-proxy.teamprogress2018.workers.dev/**', async (r) => {
    if (preflight(r)) return;
    aiCalls++; aiBody = JSON.parse(r.request().postData() || '{}');
    const text = JSON.stringify([
      { pmid: '222', tytul_pl: 'Trening siłowy u starszych osób 222', streszczenie: 'Siła wzrosła.', wniosek: 'Warto ćwiczyć z obciążeniem.', populacja: 'Seniorzy', ograniczenia: 'Mała próba', istotnosc: 4 },
      { pmid: '333', tytul_pl: 'Trening siłowy u starszych osób 333', streszczenie: 'Siła wzrosła.', wniosek: '', populacja: '', ograniczenia: 'Krótki czas', istotnosc: 9 }
    ]);
    await r.fulfill({ contentType: 'application/json', headers: CORS, body: JSON.stringify({ content: [{ type: 'text', text }] }) });
  });
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    try { localStorage.removeItem('pl_kb_feed_pl_v1'); localStorage.removeItem('pl_kb_feed_dismissed_v1'); } catch (e) {}
    window.notify = () => {};
    ['auth-screen', 'app-loading'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    window._kbFeed.status = 'idle';
    if (typeof goTo === 'function') goTo('kb');
    if (typeof renderKbFeed === 'function') renderKbFeed();
  });
  await page.waitForFunction(() => /Trening siłowy u starszych osób 333/.test((document.getElementById('kb-feed') || {}).innerText || ''), null, { timeout: 15000 });
  const ui = await page.evaluate(() => {
    const feed = document.getElementById('kb-feed');
    document.querySelectorAll('#kb-feed details').forEach((d) => { d.open = true; });
    return {
      text: feed.innerText,
      cache: JSON.parse(localStorage.getItem('pl_kb_feed_pl_v1') || '{}'),
      context: typeof kbResearchContext === 'function' ? kbResearchContext({ mode: 'training', query: 'trening siłowy' }) : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'kb_feed_pl.png'), fullPage: false });
  ok('one batched AI call for untranslated items', aiCalls === 1, String(aiCalls));
  ok('already translated item not sent again', aiBody && !/PMID: 111/.test(aiBody.messages[0].content) && /PMID: 222/.test(aiBody.messages[0].content));
  ok('Polish titles shown', /Trening siłowy u starszych osób 222/.test(ui.text) && /Już po polsku z feedu/.test(ui.text));
  ok('English title kept as original', /Effects of resistance training in older adults 222/.test(ui.text));
  ok('Polish summary and limits shown', /Siła wzrosła/.test(ui.text) && /Ograniczenia: Mała próba/.test(ui.text));
  ok('original abstract available', /Oryginał po angielsku/.test(ui.text) && /English abstract 222/.test(ui.text));
  ok('translations cached', ui.cache['222'] && ui.cache['333'] && ui.cache['333'].ai.relevance === 5);
  ok('assistant uses in-app translations', /Trening siłowy u starszych osób 222/.test(ui.context));

  // ponowne wejście korzysta z pamięci, bez nowego zapytania
  await page.evaluate(() => { window._kbFeed.status = 'idle'; renderKbFeed(); });
  await page.waitForTimeout(800);
  ok('cache prevents repeat AI calls', aiCalls === 1, String(aiCalls));

  // błąd AI: komunikat i przycisk ponowienia, bez pętli zapytań
  await page.evaluate(() => { localStorage.removeItem('pl_kb_feed_pl_v1'); });
  await page.unroute('https://anthropic-proxy.teamprogress2018.workers.dev/**');
  let failCalls = 0;
  await page.route('https://anthropic-proxy.teamprogress2018.workers.dev/**', (r) => { if (preflight(r)) return; failCalls++; r.fulfill({ status: 429, contentType: 'application/json', headers: CORS, body: '{}' }); });
  await page.evaluate(() => { _kbFeedPlCache = null; window._kbFeed.status = 'idle'; window._kbFeed.plTried = {}; renderKbFeed(); });
  await page.waitForFunction(() => /limit AI/i.test((document.getElementById('kb-feed') || {}).innerText || ''), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const err = await page.evaluate(() => (document.getElementById('kb-feed') || {}).innerText || '');
  ok('error message + retry button', /Przetłumacz na polski/.test(err));
  ok('no retry loop after error', failCalls === 1, String(failCalls));

  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll research feed PL UI checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
