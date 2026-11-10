// Generator AI: wywiad „Poznaj klienta przed planem” → „Profil do planu” → „Propozycja Progress AI” → edytor.
// Plan nie zapisuje się sam; dane z profilu wypełniają wywiad; PPL nie jest domyślny; objawy = uwaga trenera.
'use strict';
const path = require('path'), os = require('os'), fs = require('fs');
const { chromium } = require('playwright');
const shotDir = path.join(os.tmpdir(), 'pl-plan-interview'); fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof aplGenerate === 'function' && typeof pivOpen === 'function');
  await page.evaluate(() => {
    window._uid = 'piv-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window._db = { fixture: 1 };
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    window.notify = () => {}; window.saved = [];
    window.persistById = async (col, o) => { window.saved.push(col + ':' + (o && o.id)); return o; };
    window.CL = [{ id: 'k1', name: 'Anna Test', status: 'active', goal: 'redukcja', level: 'poczatkujacy', trainingFreq: 3, height: 168, weight: 72, injuries: 'ból kolana przy głębokim zgięciu' }];
    window.PL = [];
    window.calls = [];
    window.fetch = async (url, opt) => {
      const body = JSON.parse(opt.body); window.calls.push({ sys: body.system, user: body.messages[0].content });
      const m = /(?:TYLKO dni|Dodaj dni) (\d+)–(\d+)/.exec(body.system + ' ' + body.messages[0].content);
      const from = m ? +m[1] : 1, to = m ? +m[2] : 1;
      const ex = (d, i) => ({ name: 'Ćwiczenie ' + d + '.' + i, notes: 'Kontroluj zakres', muscleGroup: ['Uda', 'Plecy', 'Klatka', 'Pośladki', 'Barki'][i % 5], sets: '3', reps: '10-12', rest: '90s', rir: '3', kg: '', alternative: 'Zamiennik ' + d + '.' + i });
      const days = []; for (let d = from; d <= to; d++) days.push({ dayName: 'Dzień ' + d + ' — FBW', exercises: [1, 2, 3, 4, 5].map(i => ex(d, i)) });
      const text = JSON.stringify(from === 1 ? { planName: 'FBW start', summary: 's', method: 'FBW', daysPerWeek: 3, sessionDuration: 45, weeks: 8, rirRange: 'RIR 3–4',
        decisions: [{ decision: 'FBW 3×/tydzień', reason: 'klient ma 3 dni i jest początkujący' }], weeklySetsPerPart: { uda: '9', plecy: '9' },
        knowledge: [], warnings: ['Unikaj głębokiego zgięcia kolana'], missingData: [], days } : { days });
      return { ok: true, status: 200, json: async () => ({ content: [{ text }], stop_reason: 'end_turn' }), text: async () => text };
    };
    goTo('aiplangen');
    const sel = document.getElementById('apl-client');
    if (sel && !sel.querySelector('option[value="k1"]')) { const o = document.createElement('option'); o.value = 'k1'; o.textContent = 'Anna Test'; sel.appendChild(o); }
  });
  await page.evaluate(() => { const sel = document.getElementById('apl-client'); sel.value = 'k1'; sel.dispatchEvent(new Event('change')); });
  await page.waitForSelector('#piv-mount .piv');
  const s1 = await page.evaluate(() => ({
    formHidden: getComputedStyle(document.querySelector('#screen-aiplangen .apl-layout')).display === 'none',
    step: document.querySelector('[data-piv-step]')?.dataset.pivStep,
    goalOn: document.querySelector('.piv-chip.is-on')?.textContent
  }));
  ok('wybór klienta otwiera wywiad zamiast formularza', s1.formHidden && s1.step === '0', JSON.stringify(s1));
  ok('cel uzupełniony z profilu (redukcja)', s1.goalOn === 'Redukcja', s1.goalOn);
  await page.screenshot({ path: path.join(shotDir, 'step1.png') });
  // Krok 2: staż i dni z profilu, wybierz czas i sprzęt
  await page.click('[data-piv-next]');
  await page.click('.piv-chip:has-text("45 min")');
  await page.click('.piv-chip:has-text("Maszyny")');
  await page.click('.piv-chip:has-text("Hantle")');
  const s2 = await page.evaluate(() => [...document.querySelectorAll('.piv-chip.is-on')].map(b => b.textContent));
  ok('krok 2: staż i 3× z profilu + wybrane 45 min, maszyny, hantle', ['0–3 mies.', '3×', '45 min', 'Maszyny', 'Hantle'].every(x => s2.includes(x)), s2.join());
  // Krok 3: ból z profilu, objaw wymagający uwagi
  await page.click('[data-piv-next]');
  const painVal = await page.inputValue('[data-piv="pain"]');
  ok('krok 3: ból kolana z profilu', /kolana/.test(painVal), painVal);
  await page.fill('[data-piv="pain"]', 'ból kolana przy głębokim zgięciu, operacja łąkotki 2023');
  await page.click('[data-piv-next]');
  // Krok 4: sen i stres
  await page.fill('[data-piv="sleepH"]', '5.5');
  await page.click('.piv-q:has-text("Stres") .piv-chip:has-text("4")');
  await page.click('[data-piv-next]');
  await page.click('[data-piv-next]');
  const sum = await page.evaluate(() => {
    const rows = {}; document.querySelectorAll('.piv-sum-rows > div').forEach(d => { rows[d.querySelector('dt').textContent] = d.querySelector('dd').textContent; });
    return { rows, review: !!document.querySelector('[data-piv-summary] [data-piv-review]'), gen: !document.querySelector('[data-piv-generate]').disabled,
      saved: window.saved.filter(x => x.startsWith('clients:k1')).length, iv: !!(CL[0].planInterview && CL[0].planInterview.answers) };
  });
  await page.screenshot({ path: path.join(shotDir, 'summary.png'), fullPage: true });
  ok('profil: dostępność 3 × 45 min, poziom początkujący', sum.rows['Realna dostępność'] === '3 × 45 min' && sum.rows['Poziom'] === 'początkujący', JSON.stringify(sum.rows));
  ok('profil: regeneracja i ryzyko podwyższone', /sen 5.5 h/.test(sum.rows['Regeneracja']) && /stres 4\/5/.test(sum.rows['Regeneracja']) && /^podwyższone/.test(sum.rows['Ryzyko przeciążenia']), JSON.stringify(sum.rows));
  ok('operacja w wywiadzie → „wymaga uwagi trenera”, bez diagnozy', sum.review);
  ok('wywiad zapisany na kliencie (powrót później)', sum.saved > 0 && sum.iv, JSON.stringify(sum));
  ok('przycisk generowania aktywny przy komplecie wymaganych danych', sum.gen);
  await page.click('[data-piv-generate]');
  await page.waitForSelector('[data-piv-proposal]', { timeout: 20000 });
  const prop = await page.evaluate(() => ({
    editorHidden: document.getElementById('apl-result').hidden,
    formBack: getComputedStyle(document.querySelector('#screen-aiplangen .apl-layout')).display !== 'none',
    method: [...document.querySelectorAll('.apl-opt.active')].map(b => b.closest('[id]').id + '=' + b.dataset.val),
    prompt: window.calls[0].user,
    text: document.querySelector('[data-piv-proposal]').innerText,
    know: document.querySelector('[data-piv-knowledge]').innerText,
    alt: document.querySelector('.piv-ex td:nth-child(4)')?.textContent,
    saved: window.saved.filter(x => x.startsWith('plans')).length
  }));
  await page.screenshot({ path: path.join(shotDir, 'proposal.png'), fullPage: true });
  ok('formularz ustawiony z wywiadu: FBW, 3 dni, 45 min, początkujący', ['apl-methods=FBW', 'apl-days=3', 'apl-duration=45', 'apl-levels=poczatkujacy'].every(x => prop.method.includes(x)), prop.method.join());
  ok('prompt zawiera wywiad i zasadę „PPL nie domyślnie”', /WYWIAD PRZED PLANEM/.test(prop.prompt) && /PPL tylko gdy/.test(prop.prompt) && /operacja łąkotki/.test(prop.prompt) && /"alternative"/.test(prop.prompt));
  ok('propozycja przed edytorem — edytor ukryty, nic nie zapisane', prop.editorHidden && prop.saved === 0, JSON.stringify({ h: prop.editorHidden, s: prop.saved }));
  ok('propozycja: metoda, RIR, decyzje, ostrzeżenia, alternatywy', /FBW · 3 dni/.test(prop.text) && /RIR 3–4/.test(prop.text) && /klient ma 3 dni/.test(prop.text) && /Unikaj głębokiego zgięcia/.test(prop.text) && prop.alt === 'Zamiennik 1.1', prop.text.slice(0, 400));
  ok('brak wiedzy w bibliotece → komunikat dla trenera', /Brak wystarczającej wiedzy w bibliotece — decyzja wymaga oceny trenera/.test(prop.know) || /—/.test(prop.know), prop.know);
  ok('wymaga uwagi trenera widoczne w propozycji', /Wymaga uwagi trenera/.test(prop.text));
  await page.click('[data-piv-apply]');
  const ed = await page.evaluate(() => ({ editor: !document.getElementById('apl-result').hidden && !!document.getElementById('apl-save-btn'), prop: document.getElementById('apl-proposal').hidden, saved: window.saved.filter(x => x.startsWith('plans')).length }));
  ok('„Zastosuj” → edytor z przyciskiem Zapisz, nadal bez zapisu', ed.editor && ed.prop && ed.saved === 0, JSON.stringify(ed));
  const v2 = await page.evaluate(async () => { const n = window.calls.length; await pivAnotherVersion(); return { again: /INNA WERSJA \(nr 2\)/.test(window.calls[n].user) && /Ćwiczenie 1\.1/.test(window.calls[n].user), prop: !!document.querySelector('[data-piv-proposal]') }; });
  ok('„Wygeneruj inną wersję” prosi o inny dobór ćwiczeń i znów pokazuje propozycję', v2.again && v2.prop, JSON.stringify(v2));
  await page.evaluate(() => pivBackToInterview());
  const back = await page.evaluate(() => ({ sum: !!document.querySelector('#piv-mount [data-piv-summary]'), prop: document.getElementById('apl-proposal').hidden }));
  ok('„Wróć do wywiadu” → podsumowanie wywiadu', back.sum && back.prop, JSON.stringify(back));
  // Mobile: wywiad bez przewijania w bok
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => pivOpen('k1', { step: 1 }));
  const mob = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, step: document.querySelector('[data-piv-step]')?.dataset.pivStep }));
  await page.screenshot({ path: path.join(shotDir, 'mobile.png') });
  ok('telefon: wywiad mieści się w szerokości ekranu', mob.w <= 392 && mob.step === '1', JSON.stringify(mob));
  // Reguły: 4 dni → Upper/Lower, 5 dni średni → PPL, 2 dni → FBW
  const rules = await page.evaluate(() => [
    pivRecommend({ exp: '1-3y', days: '4', minutes: '60' }).method,
    pivRecommend({ exp: '1-3y', days: '5', minutes: '60' }).method,
    pivRecommend({ exp: '0-3m', days: '5', minutes: '60' }).method + ':' + pivRecommend({ exp: '0-3m', days: '5', minutes: '60' }).days,
    pivRecommend({ exp: '3y+', days: '2', minutes: '60' }).method]);
  ok('reguły: 4 dni UL, 5 dni średni PPL, początkujący 5 dni → UL 4, 2 dni FBW', rules.join() === 'Upper/Lower,PPL,Upper/Lower:4,FBW', rules.join());
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll plan interview checks passed');
})().catch(e => { console.error(e); process.exit(1); });
