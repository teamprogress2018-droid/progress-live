// UI: lista klientów 2.0 — 3 statystyki, karta priorytetu, jeden następny krok, Szczegóły, pierwsze użycie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.CLIENTS_SIMPLE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-clients-simple'));
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function open(browser, viewport, empty) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=clients-simple', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((empty) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-trainer'; window._clientAppMode = false; window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'clients-simple' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    const l = document.getElementById('app-loading'); if (l) l.style.display = 'none';
    const today = todayYmd(); const add = n => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const names = ['Tomasz Owsiany', 'Anna Kowalska', 'Marek Nowak', 'Ewa Zielińska', 'Piotr Wiśniewski'];
    window.CL = empty ? [] : names.map((n, i) => ({ id: 'c' + i, trainerId: 'cs-trainer', name: n, status: 'active', goal: 'masa', email: i === 4 ? 'p@example.test' : '', joinDate: add(-60), createdAt: add(-60) }));
    window.PL = empty ? [] : window.CL.slice(1).map((c, i) => ({ id: 'p' + i, clientId: c.id, trainerId: 'cs-trainer', name: 'Plan', days: [{ day: 'Dzień 1', exercises: [{ name: 'Przysiad', sets: '3', reps: '10' }] }] }));
    window.SE = []; window.TASKS = []; window.METRIC_ENTRIES = []; window.PACKAGES = []; window.CHECKINS = {};
    window.buildMonitorVerdict = c => ({ verdict: c.id === 'c2' ? 'regres' : 'ok', signals: [{ tone: 'bad', label: 'Siła', text: 'spadek' }] });
    goTo('clients'); renderClients();
  }, !!empty);
  await page.waitForTimeout(250);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  let page = await open(browser, { width: 1440, height: 900 });
  const top = await page.evaluate(() => ({
    total: document.getElementById('clients-total').textContent.trim(),
    stats: [...document.querySelectorAll('#cl-stats .cl2-stat')].map(b => b.innerText.replace(/\s+/g, ' ').trim()),
    prio: document.getElementById('cl-priority').innerText,
    filtersHidden: document.getElementById('cl-filter-chips').hidden,
    hdr: [...document.querySelectorAll('#cl2-hdr span:not(.sr-only)')].map(s => s.textContent.trim()).filter(Boolean),
    first: document.querySelector('#clients-tbl .cl2-row').innerText.replace(/\s+/g, ' ')
  }));
  await page.screenshot({ path: path.join(shotDir, 'clients_simple.png') });
  ok('total count', top.total === '5 klientów', top.total);
  ok('three summary stats', top.stats.length === 3 && /5 Aktywni/.test(top.stats[0]) && /5 Wymaga uwagi/.test(top.stats[1]) && /1 Regres/.test(top.stats[2]), JSON.stringify(top.stats));
  ok('priority card leads to the most urgent issue', /5 klientów wymaga działania/.test(top.prio) && /Najważniejsze: 1 klient ma regres/.test(top.prio) && /Zobacz klientów/.test(top.prio), top.prio);
  ok('filters folded', top.filtersHidden);
  ok('four simple columns', JSON.stringify(top.hdr) === JSON.stringify(['Klient', 'Status', 'Następny krok']), JSON.stringify(top.hdr));
  ok('urgent client first', /Marek Nowak/.test(top.first) && /Regres w postępach/.test(top.first) && /Sprawdź postęp/.test(top.first), top.first);

  const noemail = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#clients-tbl .cl2-row')].find(r => /Tomasz Owsiany/.test(r.innerText));
    const next = row.querySelector('.cl2-next');
    return { text: row.innerText.replace(/\s+/g, ' '), cls: next.className, tip: next.getAttribute('title') };
  });
  ok('missing plan before missing e-mail', /Brak planu treningowego/.test(noemail.text) && /Ułóż pierwszy plan/.test(noemail.text), noemail.text);
  await page.click('.cl2-stat:nth-child(2)');
  ok('needs-attention stat filters the list', /5 klientów · Wymaga uwagi/.test(await page.locator('#client-view-summary').textContent()));
  await page.evaluate(() => clearClientView());
  await page.evaluate(() => setClientAttention('act:noemail'));
  const filtered = await page.evaluate(() => ({ n: document.querySelectorAll('#clients-tbl .cl2-row').length, row: document.querySelector('#clients-tbl .cl2-row').innerText.replace(/\s+/g, ' '), next: document.querySelector('#clients-tbl .cl2-next') }));
  ok('e-mail filter shows the e-mail step in every row', filtered.n === 4 && /Brakuje adresu e-mail/.test(filtered.row) && /Dodaj e-mail/.test(filtered.row), filtered.row);
  const sev = await page.evaluate(() => { const n = document.querySelector('#clients-tbl .cl2-next'); return { cls: n.className, tip: n.getAttribute('title') }; });
  ok('missing e-mail is information, not an alarm', /cl2-sev-info/.test(sev.cls) && /To nie jest pilne/.test(sev.tip), JSON.stringify(sev));
  await page.click('#clients-tbl .cl2-row .cl2-act-btn');
  await page.waitForTimeout(250);
  ok('Dodaj e-mail opens client data at the e-mail field', await page.evaluate(() => document.getElementById('m-client').classList.contains('show') && document.activeElement.id === 'ac-email'));
  await page.evaluate(() => closeM('m-client'));
  await page.click('#clients-tbl .cl2-row .cl2-more');
  const det = await page.evaluate(() => { const d = document.querySelector('#clients-tbl .cl2-details'); return { hidden: d.hidden, text: d.innerText, exp: document.querySelector('#clients-tbl .cl2-more').getAttribute('aria-expanded') }; });
  ok('details reveal former columns', !det.hidden && det.exp === 'true' && /Trening 7 dni/.test(det.text) && /Trening 30 dni/.test(det.text) && /Zadania 7 dni/.test(det.text) && /Cel/.test(det.text), det.text.slice(0, 160));
  await page.click('#cl-filters-toggle');
  ok('filters open on demand', await page.locator('#client-status-filter').isVisible());
  ok('no page errors', !page._errors.length, page._errors.join(' | '));
  await page.close();

  page = await open(browser, { width: 1440, height: 900 }, true);
  const first = await page.evaluate(() => ({ text: document.getElementById('clients-tbl').innerText, stats: document.getElementById('cl-stats').hidden, prio: document.getElementById('cl-priority').hidden }));
  await page.screenshot({ path: path.join(shotDir, 'clients_first_use.png') });
  ok('first use: one clear start', /Zacznij od dodania pierwszego klienta\./.test(first.text) && /Dodaj klienta/.test(first.text) && first.stats && first.prio, JSON.stringify(first));
  await page.close();

  page = await open(browser, { width: 390, height: 844 });
  const overflow = await page.evaluate(() => { const b = document.getElementById('cl-everfit'); return b.scrollWidth - b.clientWidth; });
  ok('phone without horizontal scroll', overflow <= 1, String(overflow));
  await page.screenshot({ path: path.join(shotDir, 'clients_simple_phone.png') });
  await browser.close();
  if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
  console.log('\nAll clients-simple UI checks passed');
})().catch(e => { console.error(e); process.exit(1); });
