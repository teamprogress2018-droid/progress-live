// UI: kalendarz tygodniowy pokazuje imię i nazwisko klienta (czytelne w jasnym motywie),
// a w oknie „Nowa sesja” można dodać nowego klienta z samego imienia i nazwiska i zaplanować trening.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const rgb = (s) => (String(s || '').match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto('http://127.0.0.1:' + port + '/index.html?nocache=cal-name', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  try {
    await page.evaluate(() => {
      window._uid = 'tr1'; window._userEmail = 'trener@example.com'; window.tenantSessionGeneration = 1; window._tenantDataReady = true;
      window._notes = []; window.notify = (m) => window._notes.push(m);
      window.persistById = async (_c, o) => o;
      window.__saved = [];
      window.saveClientCardConfirmed = async (cand) => { window.__saved.push(cand); return JSON.parse(JSON.stringify(cand)); };
      ['auth-screen', 'app-loading'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      const app = document.getElementById('app-root'); if (app) app.style.display = '';
      const today = todayYmd();
      window.CL = [{ id: 'c1', trainerId: 'tr1', name: 'Krzysztof Wałęsa', status: 'active' }, { id: 'c2', trainerId: 'tr1', name: '<img src=x onerror=window.__xss=1>', status: 'active' }];
      window.SE = [{ id: 's1', clientId: 'c1', trainerId: 'tr1', date: today, time: '12:00', duration: 60, type: 'Trening siłowy', source: 'planned' },
        { id: 's2', clientId: 'c2', trainerId: 'tr1', date: today, time: '18:00', duration: 60, type: 'Trening siłowy' }];
      window.TASKS = [];
      if (typeof goTo === 'function') goTo('calendar');
    });
    await page.waitForSelector('[data-cal-sess="s1"]');
    const chip = await page.evaluate(() => {
      const el = document.querySelector('[data-cal-sess="s1"]'); const who = el.querySelector('[data-cal-who]');
      const t = el.querySelector('.cal-week-sess-time');
      let bg = 'rgb(255,255,255)'; for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; } }
      return { text: el.innerText, who: who && who.innerText, whoColor: who && getComputedStyle(who).color, whoVisible: !!(who && who.offsetHeight), timeColor: getComputedStyle(t).color, bg };
    });
    ok('tydzień: kafelek pokazuje imię i nazwisko klienta', chip.who === 'Krzysztof Wałęsa' && chip.whoVisible, JSON.stringify(chip));
    ok('tydzień: nazwisko czytelne (kontrast ≥ 4,5:1)', contrast(chip.whoColor, chip.bg) >= 4.5, chip.whoColor + ' na ' + chip.bg);
    ok('tydzień: godzina czytelna (kontrast ≥ 3:1)', contrast(chip.timeColor, chip.bg) >= 3, chip.timeColor + ' na ' + chip.bg);
    ok('tydzień: „Odbył się” dalej na kafelku planowanym', /Odbył się/.test(chip.text));
    const xss = await page.evaluate(() => ({ x: !!window.__xss, txt: (document.querySelector('[data-cal-sess="s2"] [data-cal-who]') || {}).innerText }));
    ok('tydzień: nazwa klienta wyświetlana jako tekst (bez wstrzyknięcia HTML)', !xss.x && /<img/.test(xss.txt || ''), JSON.stringify(xss));

    // Szybkie dodanie klienta w oknie „Nowa sesja”.
    await page.evaluate(() => openM('m-session'));
    await page.fill('#as-client-search', 'Jan  Testowy');
    await page.dispatchEvent('#as-client-search', 'input');
    const add = page.locator('[data-act="as-quick-add-client"]');
    ok('nowa sesja: propozycja „+ Dodaj klienta „Jan Testowy””', await add.count() === 1 && /Dodaj klienta „Jan Testowy”/.test(await add.innerText()));
    await add.click();
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => ({ saved: window.__saved.map((c) => ({ name: c.name, status: c.status, trainerId: c.trainerId, email: c.email })),
      inCL: window.CL.some((c) => c.name === 'Jan Testowy'), hid: document.getElementById('as-client').value, vis: document.getElementById('as-client-search').value,
      notes: window._notes.join(' | ') }));
    ok('nowa sesja: klient zapisany z imieniem i nazwiskiem, aktywny, przypisany do trenera', res.saved.length === 1 && res.saved[0].name === 'Jan Testowy' && res.saved[0].status === 'active' && res.saved[0].trainerId === 'tr1', JSON.stringify(res));
    ok('nowa sesja: nowy klient od razu wybrany do sesji', res.inCL && /^c_/.test(res.hid) && res.vis === 'Jan Testowy', JSON.stringify(res));
    ok('nowa sesja: komunikat po dodaniu', /Dodano klienta Jan Testowy/.test(res.notes), res.notes);
    // Istniejący klient: brak propozycji dodania duplikatu.
    await page.fill('#as-client-search', 'krzysztof wałęsa');
    await page.dispatchEvent('#as-client-search', 'input');
    ok('nowa sesja: przy istniejącym kliencie brak „Dodaj klienta” (bez duplikatu)', await page.locator('[data-act="as-quick-add-client"]').count() === 0);
    ok('bez błędów JS', !errors.length, errors.join(' | '));
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Kalendarz: nazwa klienta i szybkie dodanie klienta — OK');
})().catch((e) => { console.error(e); process.exit(1); });
