// UI: identyfikator wpisu forum z apostrofem nie może wykonać skryptu (XSS klient → klient i trener).
// Firestore pozwala na id z apostrofem, a escHtml w atrybucie onclick="…('${id}')" nie chroni
// kontekstu JavaScript (przeglądarka dekoduje &#39; z powrotem do apostrofu).
// Test klika kartę wpisu, reakcję i „Wyślij” komentarz — w widoku klienta i w panelu trenera.
// Bez Firebase i bez zapisu do produkcji.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

// Prawidłowe id dokumentu Firestore (bez „/”), które zamyka literał JS w onclick.
const EVIL_ID = "x');window.__pwned=(window.__pwned||0)+1;('";
const EVIL_NAME = "Ola');window.__pwned=(window.__pwned||0)+1;('";

async function setup(page, clientMode) {
  await page.evaluate(({ id, name, clientMode }) => {
    window.__pwned = 0;
    window._uid = clientMode ? 'fx-client-uid' : 'fx-trainer';
    window._trainerId = 'fx-trainer'; window._clientId = 'c1'; window._clientAppMode = clientMode;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'forum-escape' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    window.persistForumPostEngagement = async () => true;
    window.CL = [{ id: 'c1', trainerId: 'fx-trainer', name: 'Anna', status: 'active' }];
    window.PL = []; window.SE = []; window.TASKS = []; window.PACKAGES = [];
    const g = { id: 'g1', trainerId: 'fx-trainer', name: 'Grupa', privacy: 'public', memberIds: [] };
    window.FORUM_GROUPS = [g];
    window.FORUM_POSTS = [{ id, trainerId: 'fx-trainer', clientId: 'c1', groupId: 'g1', title: 'Wpis', body: 'Treść', authorName: name,
      authorRole: 'klient', pinned: false, date: '2026-11-17', createdAt: new Date().toISOString(), likes: 0, views: 0, comments: 0, reactions: {}, reactedBy: {} }];
    window.FORUM_COMMENTS = {};
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: { forum: true } }, contact: {} };
    if (clientMode) enterClientLiveShell();
  }, { id: EVIL_ID, name: EVIL_NAME, clientMode });
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto('http://localhost:' + port + '/index.html?nocache=forum-escape', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // --- Klient: lista → wpis → reakcja → komentarz
  await setup(page, true);
  await page.evaluate(() => setClientLiveScreen('forum'));
  const card = page.locator('#clive-screen-content [data-act="forum-open"], #clive-screen-content [onclick*="openForumPost"]').first();
  ok('klient: karta wpisu jest na liście', await card.count() === 1);
  await card.click();
  ok('klient: klik w kartę otwiera wpis', await page.evaluate((id) => forumActivePost === id, EVIL_ID));
  const react = page.locator('#clive-screen-content .forum-reaction-btn').first();
  if (await react.count()) await react.click();
  const send = page.locator('#clive-screen-content button', { hasText: 'Wyślij' }).first();
  if (await send.count()) await send.click();
  ok('klient: reakcja zapisana dla właściwego wpisu', await page.evaluate((id) => {
    const p = (window.FORUM_POSTS || []).find((x) => x.id === id); return !!(p && Object.keys(p.reactedBy || {}).length);
  }, EVIL_ID));
  // Trening klienta z takim samym id: karta w historii (Postępy → Więcej statystyk).
  await page.evaluate((id) => {
    window.SE = [{ id, clientId: 'c1', trainerId: 'fx-trainer', date: todayYmd(), source: 'client', status: 'completed', type: 'Trening', duration: 30, exercises: [] }];
    setClientLiveScreen('progress'); if (typeof csProgressFull === 'function') csProgressFull(true);
  }, EVIL_ID);
  const sess = page.locator('#clive-screen-content [data-act="session-open"]').first();
  ok('klient: trening z apostrofem w id jest na liście', await sess.count() === 1);
  if (await sess.count()) await sess.click();
  ok('klient: klik otwiera właściwy trening', await page.evaluate((id) => window._cliveSessionId === id, EVIL_ID));
  // Imię klienta z kodem HTML na ekranie Profil (wcześniej wstawiane bez escapowania).
  await page.evaluate(() => { window.CL[0].name = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">Anna'; setClientLiveScreen('profile'); });
  await page.waitForTimeout(300);
  // Tag [od:…] w wiadomości czatu z apostrofem.
  await page.evaluate(() => {
    window.SETTINGS.clientApp.visibleSections.ondemand = true;
    MSGS.c1 = [{ id: 'm1', clientId: 'c1', trainerId: 'fx-trainer', out: false, text: "Zobacz [od:x');window.__pwned=(window.__pwned||0)+1;('] ", createdAt: new Date().toISOString(), time: '10:00' }];
    window.openODWorkout = () => {};
    setClientLiveScreen('messages');
  });
  const odBtn = page.locator('#clive-screen-content [data-act="od-workout"], #clive-screen-content [onclick*="openODWorkout"]').first();
  if (await odBtn.count()) await odBtn.click();
  const clientPwned = await page.evaluate(() => window.__pwned || 0);
  ok('klient: id wpisu z apostrofem nie wykonuje skryptu', clientPwned === 0, 'wykonano ' + clientPwned + '×');

  // --- Trener: feed forum → wpis → reakcja
  await setup(page, false);
  const trainerRendered = await page.evaluate(() => {
    if (typeof goTo === 'function') try { goTo('forum'); } catch (e) {}
    if (typeof renderForum === 'function') renderForum();
    return !!document.querySelector('#screen-forum .forum-post-card');
  });
  if (trainerRendered) {
    // Ekran może być ukryty w atrapie — klik przez DOM daje te same zdarzenia co dotyk.
    await page.evaluate(() => document.querySelector('#screen-forum .forum-post-card').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => { const b = document.querySelector('#forum-post-detail .forum-reaction-btn, #screen-forum .forum-reaction-btn'); if (b) b.click(); });
  }
  ok('trener: klik w kartę otwiera wpis', await page.evaluate((id) => forumActivePost === id, EVIL_ID));
  const trainerPwned = await page.evaluate(() => window.__pwned || 0);
  ok('trener: panel forum pokazuje wpis', trainerRendered);
  ok('trener: id wpisu z apostrofem nie wykonuje skryptu', trainerPwned === 0, 'wykonano ' + trainerPwned + '×');

  // Statycznie: wartości z bazy nie wracają do onclick w miejscach naprawionych w tym etapie.
  const fs = require('fs'); const path = require('path'); const root = path.join(__dirname, '..', '..');
  const src = ['04-client-portal.js', '05-clients-builder-plans-calendar.js', '07-forms-metrics-calculator.js', '08-client-profile-extras.js', '10-client-app.js'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  const bad = src.match(/on(click|keydown)="[^"]*(openForumPost|reactToPost|addComment|toggleForumPin|deleteForumPost|deleteForumComment|clientOpenSession|editSession|dashStartLive|delSession|delMetricEntry|ppDelete)\('\$\{/g) || [];
  ok('brak onclick z id z bazy dla forum, treningów i zdjęć', bad.length === 0, bad.slice(0, 5).join(' | '));

  ok('brak błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll forum id escape checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
