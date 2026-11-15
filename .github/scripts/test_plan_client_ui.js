// Ekran „Plan klienta”: panel danych, braki, bramka zdrowia, szkic (trening z AI + odżywianie), zakładki i publikacja.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
const SETUP = () => {
  window.__saved = []; window.__msgs = [];
  window.persistById = async (col, o) => { window.__saved.push({ col, o: JSON.parse(JSON.stringify(o)) }); return o; };
  window.notify = () => {}; window.confirm = () => false; window.maybeSchedulePlanToCalendar = () => {};
  ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
  const app = document.getElementById('app-root'); if (app) app.style.display = 'flex';
  window._uid = 'u1';
  window.CL = [
    { id: 'c1', name: 'Anna Kowalczyk', status: 'active', goal: 'redukcja', level: 'sredni', trainingFreq: 3, weight: 74, height: 168, age: 38, gender: 'K', injuries: 'prawe kolano', email: 'a@x.pl',
      dietPlan: { meals: 4, prefs: { style: 'wszystko', ex: ['orzechy'], maxMin: 30 } } },
    { id: 'c2', name: 'Ewa Nowak', status: 'active', goal: 'zdrowie', trainingFreq: 2, weight: 66, height: 165, age: 41, gender: 'K', health: 'cukrzyca typu 2, insulina' }
  ];
  window.PL = []; window.SE = [];
  window.pushMsg = (id, text) => { window.__msgs.push({ id, text }); };
  const plan = { planName: 'Redukcja — FBW', method: 'FBW', weeks: 6, daysPerWeek: 3, sessionDuration: 60, warmup: '5 min rower', progressionRules: ['Dodaj powtórzenie, gdy zapas jest większy niż 2'],
    days: [1, 2, 3].map(i => ({ dayName: 'Dzień ' + i + ' — Full Body', focus: 'całe ciało', warmupExercises: [{ name: 'Krążenia bioder', sets: '2', reps: '10' }], exercises: [
      { name: 'Wypychanie nóg na suwnicy', muscleGroup: 'Uda', sets: '3', reps: '10-12', rest: '90s', rir: '2', notes: 'Zakres do 90°', alt: 'Przysiad do skrzyni' },
      { name: 'Wiosłowanie hantlem', muscleGroup: 'Plecy', sets: '3', reps: '10-12', rest: '90s', rir: '2', notes: 'Łopatka w dół' }] })) };
  window.aplAnthropicRequest = async () => ({ content: [{ type: 'text', text: JSON.stringify(plan) }] });
};
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(SETUP);
  await page.evaluate(() => openClientPlan('c1'));
  await page.waitForTimeout(200);
  const st = () => page.evaluate(() => document.getElementById('pk-root').dataset.pkState);
  ok('ekran otwarty z klientem', await page.isVisible('#screen-clientplan') && await st() === 'new');
  ok('menu Klienci ma pozycję „Plan klienta”', await page.locator('#nav-clients-flyout [data-screen="clientplan"]').count() === 1);
  ok('6 zakładek trenera', await page.locator('.pk-tab').count() === 6);
  ok('panel: cel z profilu', /Redukcja/.test(await page.textContent('[data-pk-fact="goal"]')));
  ok('panel: max 3 braki + Uzupełnij wywiad', await page.isVisible('[data-pk-missing]') && /Uzupełnij wywiad/.test(await page.textContent('[data-pk-missing]')));
  ok('pewność dopasowania widoczna', await page.locator('[data-pk-confidence]').count() === 1);
  // Uzupełnij wywiad: tylko brakujące pola
  await page.click('[data-pk-missing] >> text=Uzupełnij wywiad');
  const ivf = await page.locator('[data-pk-ivf]').count();
  ok('wywiad: 1–3 brakujące pola', ivf >= 1 && ivf <= 3, String(ivf));
  if (await page.locator('[data-pk-ivf="activity"]').count()) await page.click('[data-pk-ivf="activity"] [data-pk-iv="steps"] >> text=5–8 tys.');
  await page.click('#pk-iv-save');
  ok('wywiad zapisany w kliencie', await page.evaluate(() => !!CL[0].planInterview && window.__saved.some(s => s.col === 'clients')));
  // Komplet + jadłospis 7 dni
  await page.click('[data-pk-choice="komplet"]');
  await page.click('[data-pk-form="week"]');
  ok('tylko jeden czerwony przycisk', await page.locator('#pk-root .btn-primary').count() === 1);
  await page.click('#pk-generate');
  await page.waitForFunction(() => { const c = CL[0]; return c.clientPlan && c.clientPlan.training; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(200);
  ok('szkic: trening z AI w kliencie', await page.evaluate(() => (CL[0].clientPlan.training.days || []).length === 3));
  ok('szkic: status „klient go nie widzi”', await st() === 'draft' && /klient go nie widzi/.test(await page.textContent('.pk-top')));
  ok('szkic nie wysyła nic klientowi', await page.evaluate(() => !window.__msgs.length && !window.PL.length));
  await page.click('[data-pk-tab="training"]');
  ok('trening: 3 dni z ćwiczeniami i zamiennikiem', await page.locator('[data-pk-day]').count() === 3 && /Zamiennik: Przysiad do skrzyni/.test(await page.textContent('[data-pk-day="0"]')));
  await page.click('[data-pk-tab="nutrition"]');
  ok('odżywianie: cel kcal i makro', /kcal dziennie/.test(await page.textContent('[data-pk-targets]')));
  ok('odżywianie: tydzień 7 dni', await page.locator('[data-pk-wday]').count() === 7);
  ok('porcje domowe obok gramów', /ok\. /.test(await page.textContent('[data-pk-week]')));
  await page.click('[data-pk-nform="flex"]');
  ok('elastyczny plan: propozycje na posiłek', await page.locator('[data-pk-slot] .pk-opt').count() >= 4);
  await page.click('[data-pk-nform="habits"]');
  ok('cele i nawyki: 3 nawyki', await page.locator('[data-pk-habits] li').count() === 3);
  await page.click('[data-pk-nform="week"]');
  await page.click('[data-pk-tab="shopping"]');
  ok('lista zakupów na tydzień', await page.locator('[data-pk-shopping] li').count() > 5);
  await page.click('[data-pk-tab="notes"]');
  await page.fill('#pk-notes', 'Woli rano');
  await page.click('text=Zapisz notatki');
  ok('notatki zapisane', await page.evaluate(() => CL[0].clientPlan.notes === 'Woli rano'));
  // Publikacja
  await page.click('[data-pk-tab="overview"]');
  await page.click('#pk-publish');
  ok('bez potwierdzenia nic się nie publikuje', await page.evaluate(() => !window.__msgs.length) && await st() === 'draft');
  await page.check('#pk-reviewed');
  await page.click('#pk-publish');
  await page.waitForFunction(() => CL[0].clientPlan.status === 'opublikowany', null, { timeout: 5000 }).catch(() => {});
  ok('publikacja: plan treningowy zapisany', await page.evaluate(() => window.__saved.some(s => s.col === 'plans' && s.o.clientId === 'c1') && !!CL[0].clientPlan.trainingPlanId));
  ok('publikacja: jadłospis zatwierdzony + wiadomość', await page.evaluate(() => CL[0].dietPlan.status === 'zatwierdzony' && CL[0].dietPlan.source === 'plan-klienta' && window.__msgs.length === 1 && /Lista zakupów/.test(window.__msgs[0].text)));
  ok('status: opublikowany', await st() === 'published');
  // Bramka zdrowia
  await page.selectOption('#pk-client', 'c2');
  ok('zdrowie: komunikat o konsultacji', /Plan wymaga konsultacji z lekarzem lub dietetykiem klinicznym\./.test(await page.textContent('[data-pk-health]')));
  ok('zdrowie: odżywianie i komplet wyłączone', await page.evaluate(() => document.querySelector('[data-pk-choice="odzywianie"]').disabled && document.querySelector('[data-pk-choice="komplet"]').disabled));
  ok('zdrowie: trening dopiero po zgodzie lekarza', await page.evaluate(() => document.getElementById('pk-generate').disabled));
  await page.click('#pk-health-ack');
  ok('zgoda lekarza odblokowuje trening', await page.evaluate(() => !document.getElementById('pk-generate').disabled && !!CL[1].healthAck));
  const box = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok('telefon: bez poziomego przewijania', box);
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' plan client UI test(s) failed'); process.exit(1); }
  console.log('All plan client UI tests passed.');
})();
