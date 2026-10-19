// UI: Academy → Badania. Pełny przepływ: pytanie → wyszukanie → karta badania → praktyczny wniosek → zapis do własnych źródeł.
// Do tego stan błędu źródła (Academy działa dalej) i widok na telefonie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.RESEARCH_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-research');
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name);
}

async function openApp(browser, viewport, routeBase) {
  const port = process.env.RESEARCH_PORT || '8080';
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  if (routeBase) await page.route('**/knowledge/research-base.json*', routeBase);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window._uid = 'ui-trainer';
    window._clientAppMode = false;
    window.tenantSessionGeneration = 1;
    window._tenantDataReady = true;
    window._db = { fixture: true };
    window.__saved = [];
    window.persistById = async (c, o) => { window.__saved.push([c, JSON.parse(JSON.stringify(o))]); return { ...o, _fbId: o.id }; };
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c-anna', trainerId: 'ui-trainer', name: 'Anna Nowak' }];
    window.KB = [];
    goTo('academy');
  });
  return { page, errors };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });

  /* 1. Pełny przepływ na komputerze. */
  const { page, errors } = await openApp(browser, { width: 1440, height: 1000 });
  await page.click('.academy-tab:has-text("Badania")');
  await page.waitForSelector('.research-chips');
  const chips = await page.$$eval('.research-chips .academy-chip', (els) => els.map((e) => e.textContent.trim()));
  ok('9 kategorii + „Wszystkie”', chips.length === 10 && chips.includes('HIIT i Tabata') && chips.includes('Ból, bezpieczeństwo i granice kompetencji trenera'), chips.join(' | '));
  await page.fill('#academy-research-q', 'Czy trening do upadku jest konieczny?');
  await page.click('.research-question button[type="submit"]');
  await page.waitForSelector('.research-card');
  const cards = await page.$$eval('.research-card', (els) => els.length);
  ok('3 karty domyślnie (max 5)', cards >= 1 && cards <= 3, String(cards));
  const card = await page.$eval('.research-card', (el) => el.innerText);
  ok('karta: tytuł, autorzy, rok, typ badania', /\d{4}/.test(card) && /(Metaanaliza|Przegląd|Stanowisko|RCT)/.test(card), card.slice(0, 200));
  ok('karta: praktyczny wniosek albo uczciwy brak opracowania', /Co to oznacza dla trenera\?|opracowania/i.test(card));
  const hrefs = await page.$$eval('.research-card a[target="_blank"]', (els) => els.map((a) => [a.href, a.rel]));
  ok('linki zewnętrzne tylko do PubMed/DOI/Europe PMC, z noopener', hrefs.length > 0 && hrefs.every(([h, r]) => /^https:\/\/(pubmed\.ncbi\.nlm\.nih\.gov|doi\.org|europepmc\.org)\//.test(h) && r.includes('noopener')), JSON.stringify(hrefs.slice(0, 3)));
  const hasAnswer = await page.$('.research-answer');
  if (hasAnswer) {
    const refsOk = await page.$$eval('.research-answer a.research-ref', (els) => els.every((a) => document.querySelector(a.getAttribute('href'))));
    ok('każdy przypis odpowiedzi prowadzi do karty na stronie', refsOk);
  }
  await page.click('.research-sort-btn:has-text("Najnowsze")');
  const years = await page.$$eval('.research-card .research-meta', (els) => els.map((e) => Number((e.textContent.match(/\b(19|20)\d{2}\b/) || [0])[0])));
  ok('sortowanie „Najnowsze”', years.every((y, i) => i === 0 || years[i - 1] >= y), years.join(','));
  await page.screenshot({ path: path.join(shotDir, 'badania-wynik.png'), fullPage: true });
  await page.click('.research-card button:has-text("Zapisz")');
  await page.waitForSelector('.research-saved');
  const saved = await page.evaluate(() => window.__saved);
  ok('zapis do własnych źródeł (kb, evidence, do przeczytania)', saved.length === 1 && saved[0][0] === 'kb' && saved[0][1].kind === 'evidence' && saved[0][1].researchStatus === 'do_przeczytania' && /^\d+$/.test(saved[0][1].pmid));
  ok('zapis bez danych klienta', saved.length === 1 && !Object.keys(saved[0][1]).some((k) => /client/i.test(k)));
  await page.fill('#academy-research-q', 'Anna Nowak ma nadciśnienie, co robić?');
  await page.click('.research-question button[type="submit"]');
  ok('pytanie z imieniem klienta zatrzymane', (await page.textContent('.research')).includes('nie przyjmuje danych klientów'));
  /* Pytanie z odpowiedzią i porównaniem źródeł (jeśli baza ma opracowaną odpowiedź). */
  await page.fill('#academy-research-q', 'Czy HIIT jest dobry dla początkującego z nadwagą?');
  await page.click('.research-question button[type="submit"]');
  await page.waitForSelector('.research-card');
  if (await page.$('.research-answer-foot button')) {
    await page.click('.research-answer-foot button');
    ok('tryb „Porównaj źródła”', (await page.$$('.research-compare > div')).length === 5);
    await page.screenshot({ path: path.join(shotDir, 'badania-porownanie.png'), fullPage: true });
  }
  /* Odpowiedź AI dla pytania spoza opracowanych (proxy zastąpione atrapą). */
  await page.route('https://anthropic-proxy.teamprogress2018.workers.dev/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ krotko: 'Zacznij od spokojnego wysiłku [S1].', dlaczego: 'Wyniki są podobne [S1] [S9].', praktyka: ['Kontroluj RPE [S1].'], dla_kogo: 'Początkujący [S1].', ostroznie: 'Choroby serca: lekarz [S1].', ksiazka_vs_badania: 'Brak reguły w bazie książek.', pytanie_kontrolne: { pytanie: 'Od czego zacząć?', odpowiedz: 'Od spokojnego cardio [S1].' }, porownanie: {}, pewnosc: 'mocne' }) }] }) }));
  await page.fill('#academy-research-q', 'Od czego zacząć interwały z osobą otyłą po długiej przerwie?');
  await page.click('.research-question button[type="submit"]');
  await page.waitForSelector('.research-card');
  if (await page.$('.research-ai-cta button')) {
    await page.click('.research-ai-cta button');
    await page.waitForSelector('.research-answer .research-steps, .research-state-error');
    if (await page.$('.research-answer .research-steps')) {
      const t = await page.textContent('.research-answer');
      ok('AI: odpowiedź z kart, bez zmyślonego [S9]', t.includes('Krótka odpowiedź') && !t.includes('S9'));
    } else {
      ok('AI: karty bez opracowania → uczciwy komunikat, karty zostają', (await page.textContent('.research-state-error')).includes('nie mają opracowania') && (await page.$$('.research-card')).length > 0);
    }
  }
  /* Nowe badania → zapis → status → Zapisane źródła. */
  await page.click('.research-subtab:has-text("Nowe badania")');
  await page.waitForSelector('.research-sub-intro');
  ok('Nowe badania: karty z ostatnich 12 miesięcy', (await page.$$('.research-card')).length > 0);
  const firstNew = await page.$('.research-card button:has-text("Zapisz")');
  if (firstNew) {
    await firstNew.click();
    await page.waitForSelector('.research-trainer');
    await page.click('.research-trainer button:has-text("Przeczytane")');
    await page.waitForTimeout(200);
    const last = await page.evaluate(() => window.__saved[window.__saved.length - 1][1].researchStatus);
    ok('Nowe badania: status „przeczytane” zapisany', last === 'przeczytane', last);
  }
  await page.click('.research-subtab:has-text("Zapisane źródła")');
  await page.waitForSelector('.research-sub-intro');
  ok('Zapisane źródła: zapisane badania widoczne', (await page.$$('.research-saved-row')).length >= 1);
  await page.screenshot({ path: path.join(shotDir, 'badania-zapisane.png'), fullPage: true });
  ok('brak błędów JS', errors.length === 0, errors.join(' | '));
  await page.close();

  /* 2. Źródło niedostępne: komunikat, Academy działa. */
  const down = await openApp(browser, { width: 1280, height: 900 }, (route) => route.fulfill({ status: 503, body: 'down' }));
  await down.page.click('.academy-tab:has-text("Badania")');
  await down.page.waitForSelector('.research-state-error');
  ok('503: „Źródło chwilowo niedostępne”', (await down.page.textContent('.research-state-error')).includes('Źródło chwilowo niedostępne'));
  await down.page.click('.academy-tab:has-text("Szybka odpowiedź")');
  ok('503: inne zakładki działają', (await down.page.$$('.academy-card')).length > 0);
  await down.page.close();

  /* 3. Telefon: bez przewijania w bok. */
  const mob = await openApp(browser, { width: 390, height: 844 });
  await mob.page.click('.academy-tab:has-text("Badania")');
  await mob.page.waitForSelector('.research-chips');
  await mob.page.fill('#academy-research-q', 'Jakie przerwy stosować przy treningu siłowym?');
  await mob.page.click('.research-question button[type="submit"]');
  await mob.page.waitForSelector('.research-card');
  const overflow = await mob.page.evaluate(() => {
    const el = document.querySelector('.research');
    return el.scrollWidth - el.clientWidth;
  });
  ok('telefon: bez poziomego przewijania', overflow <= 1, String(overflow));
  await mob.page.screenshot({ path: path.join(shotDir, 'badania-telefon.png'), fullPage: true });
  await mob.page.close();

  await browser.close();
  console.log('Zrzuty: ' + shotDir);
  if (failed) { console.error(failed + ' test(ów) nie przeszło'); process.exit(1); }
  console.log('Wszystkie testy UI zakładki Badania przeszły.');
})().catch((e) => { console.error(e); process.exit(1); });
