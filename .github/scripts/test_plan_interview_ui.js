// Generator planu AI: wywiad → Profil do planu → pytania AI → Propozycja (bez zapisu) → edytor.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.__saved = [];
    window.persistById = async (col, o) => { window.__saved.push({ col, o: JSON.parse(JSON.stringify(o)) }); return o; };
    window.notify = () => {};
    ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
    const app = document.getElementById('app-root'); if (app) app.style.display = 'flex';
    window._uid = 'u1';
    window.CL = [{ id: 'c1', name: 'Anna Kowalska', status: 'active', goal: 'redukcja', level: 'poczatkujacy', trainingFreq: 3, weight: 78, height: 168, injuries: 'ból kolana przy głębokim zgięciu', email: 'a@x.pl' }];
    window.PL = []; window.SE = [];
    const plan = { planName: 'Redukcja — FBW start', summary: 'Plan.', rationale: { reasoning: ['FBW'], uncertainties: [] }, method: 'FBW', weeks: 6, daysPerWeek: 3, sessionDuration: 45, warmup: '5 min rower',
      days: [1, 2, 3].map(i => ({ dayName: 'Dzień ' + i + ' — Full Body', focus: 'całe ciało', warmupExercises: [], exercises: [
        { name: 'Wypychanie nóg na suwnicy', muscleGroup: 'Uda', sets: '3', reps: '10-12', rest: '90s', rir: '1', notes: 'Zakres do 90°', alt: 'Przysiad do skrzyni' },
        { name: 'Wiosłowanie hantlem', muscleGroup: 'Plecy', sets: '3', reps: '10-12', rest: '90s', rir: '2', notes: 'Łopatka w dół' }] })) };
    window.__prompts = [];
    window.aplAnthropicRequest = async payload => { window.__prompts.push(payload); return { content: [{ type: 'text', text: JSON.stringify(/"questions"/.test(payload.system) ? { questions: [{ q: 'Czy kolano boli przy schodzeniu ze schodów?', why: 'Zmienia dobór ćwiczeń.' }, { q: 'Q2', why: '' }, { q: 'Q3', why: '' }, { q: 'Q4', why: '' }] } : plan) }] }; };
    goTo('aiplangen');
  });
  await page.waitForTimeout(400);
  const state = () => page.evaluate(() => document.getElementById('pliv-mount').dataset.plivState);
  ok('start: wybór klienta, stary formularz schowany', await state() === 'pick' && await page.evaluate(() => document.querySelector('#screen-aiplangen .apl-layout').hidden));
  ok('PPL nie jest domyślną metodą', await page.evaluate(() => (document.querySelector('#apl-methods .apl-opt.active') || {}).dataset.val === 'FBW'));
  await page.selectOption('#pliv-client', 'c1');
  await page.click('text=Rozpocznij wywiad');
  ok('wywiad: krok 1 z 5 z paskiem postępu', await page.locator('.pliv-seg').count() === 5 && /Krok 1 z 5/.test(await page.textContent('.pliv-step-lbl')));
  ok('profil klienta uzupełnia wywiad (cel)', await page.evaluate(() => !!document.querySelector('[data-pliv-field="goal"] .pliv-chip.is-on')));
  await page.click('.pliv-nav .btn-primary');
  await page.click('.pliv-nav .btn-primary');
  ok('pola obowiązkowe zatrzymują krok', /Ile minut/.test(await page.textContent('#pliv-errors')));
  await page.click('[data-pliv-field="minutes"] >> text=45 min');
  await page.click('[data-pliv-field="equipment"] >> text=Maszyny');
  await page.click('.pliv-nav .btn-primary');
  ok('krok 3: ból z profilu + komunikat medyczny', await page.isVisible('[data-pliv-medical]') && /nie zastępuje konsultacji medycznej/.test(await page.textContent('[data-pliv-medical]')));
  await page.click('[data-pliv-field="medical"] >> text=Brak');
  await page.click('.pliv-nav .btn-primary');
  await page.fill('#pliv-f-sleepH', '6');
  await page.click('[data-pliv-field="stress"] >> text=4');
  await page.click('.pliv-nav .btn-primary');
  await page.click('.pliv-nav .btn-primary');
  ok('podsumowanie: Profil do planu', await state() === 'summary' && /3 × 45 min/.test(await page.textContent('[data-pliv-row="avail"]')) && /podwyższone/.test(await page.textContent('[data-pliv-row="risk"]')));
  ok('wywiad zapisany w kliencie (pole prywatne)', await page.evaluate(() => window.__saved.some(s => s.col === 'clients' && s.o.planInterview && s.o.planInterview.status === 'done')));
  await page.click('text=Zadaj AI dodatkowe pytania');
  await page.waitForSelector('[data-pliv-ask] input');
  ok('AI zadaje maks. 3 pytania', await page.locator('[data-pliv-ask] input').count() === 3);
  await page.fill('#pliv-q-0', 'tak, lekko');
  await page.click('[data-pliv-generate]');
  await page.waitForSelector('[data-pliv-proposal]', { timeout: 60000 });
  const prompt = await page.evaluate(() => { const p = window.__prompts[window.__prompts.length - 1]; return p.messages.map(m => m.content).join('\n'); });
  ok('prompt zawiera wywiad, decyzje i odpowiedź na pytanie', /WYWIAD TRENERA/.test(prompt) && /Metoda: FBW, 3 dni, sesja 45 min/.test(prompt) && /tak, lekko/.test(prompt));
  ok('propozycja zamiast edytora, nic nie zapisane', await page.evaluate(() => document.querySelector('#screen-aiplangen .apl-layout').hidden && !window.__saved.some(s => s.col === 'plans')));
  const txt = await page.textContent('[data-pliv-proposal]');
  ok('propozycja: metoda, czas, RIR, rozgrzewka, cardio', /FBW · 3 dni/.test(txt) && /6 tyg/.test(txt) && /RIR/.test(txt) && /Rozgrzewka/.test(txt) && /Cardio/.test(txt));
  ok('propozycja: uzasadnienie i alternatywy', /Wybrano FBW 3×\/tydzień/.test(txt) && await page.locator('[data-pliv-alt]').count() > 0);
  ok('propozycja: sekcja „Na podstawie wiedzy”', await page.locator('[data-pliv-books]').count() === 1);
  ok('start zachowawczy: RIR podniesiony do rekomendacji', !/RIR 1\b/.test(await page.textContent('[data-pliv-ex]')));
  ok('4 przyciski propozycji', ['Zastosuj propozycję do edytora', 'Edytuj ręcznie', 'Wygeneruj inną wersję', 'Wróć do wywiadu'].every(t => txt.includes(t)));
  await page.click('[data-pliv-apply]');
  await page.waitForTimeout(300);
  ok('edytor po „Zastosuj”: plan widoczny, formularz schowany, zapis ręczny', await page.evaluate(() => { const l = document.querySelector('#screen-aiplangen .apl-layout'); return !l.hidden && l.classList.contains('pliv-editor-only') && /Zapisz plan/.test(document.getElementById('apl-result').textContent) && !window.__saved.some(s => s.col === 'plans'); }));
  await page.click('text=Wróć do wywiadu');
  ok('powrót do wywiadu', await state() === 'summary');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll plan interview UI checks passed');
})().catch(e => { console.error(e); process.exit(1); });
