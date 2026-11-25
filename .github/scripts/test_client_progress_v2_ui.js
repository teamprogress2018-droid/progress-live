#!/usr/bin/env node
'use strict';
/**
 * Postępy 2.0 (client-progress.js), iPhone 390 × 844, atrapa danych:
 * - jedno źródło wykonanych treningów (`isLoggedWorkout`): liczy się też trening z sali, nie liczy trening w toku ani zadanie domowe;
 * - cel tygodnia z planu (3 dni w planie = „z 3”, choć harmonogram ma 4 dni);
 * - zakres 30 / 90 dni / cały okres zmienia liczby; podsumowanie miesiąca; kalendarz regularności;
 * - postęp siłowy (rozgrzewka pominięta), jedna lista rekordów bez pasków, szac. 1RM tylko do 10 powtórzeń;
 * - masa ciała tylko po włączeniu przez trenera, obwody z różnicą, zdjęcia przed / po; daty i liczby po polsku, bez emoji;
 * - ekran Trener: niższe wiersze, „Napisz do trenera” na górze.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=progress2';
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const boot = (opts) => page.evaluate((opts) => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = {}; window.notify = () => {};
    window.persistById = async (c, o) => o; window._cpgRange = ''; try { sessionStorage.clear(); } catch (e) {}
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [1, 2, 4, 5] }];
    const d = (n) => { const x = new Date(todayYmd() + 'T12:00:00'); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    const ses = (n, kg, reps, squat, src) => ({ id: 's' + n, clientId: 'c1', source: src || 'client', status: 'completed', date: d(n), duration: 50, type: 'Trening A', exercises: [
      { name: 'Ściąganie wyciągu szerokim chwytem', loadUnit: 'kg', sets: [{ kg: kg - 5, reps: 10, kind: 'warmup' }, { kg, reps }, { kg, reps: reps - 1 }] },
      { name: 'Przysiad ze sztangą', loadUnit: 'kg', sets: squat ? [{ kg: squat, reps: 8 }] : [] },
      { name: 'Wiosłowanie hantlem', loadUnit: 'kg', sets: [{ kg: 20, reps: 15 }] },
      { name: 'Plank', loadUnit: 'sec', sets: [{ kg: '', reps: 40 }] }] });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Plan', weekKeys: ['w1'], currentWeek: 'w1', startDate: d(120),
      days: [{ day: 'A', exercises: [{ name: 'Ściąganie wyciągu szerokim chwytem', sets: '3', reps: '7', kg: '80' }] }, { day: 'B', exercises: [{ name: 'Przysiad', sets: '3', reps: '8' }] }, { day: 'C', exercises: [{ name: 'Wiosłowanie', sets: '3', reps: '10' }] }] }];
    window.SE = opts.sessions ? [ses(70, 65, 7, 55), ses(21, 70, 7, 60), ses(14, 75, 7, 0, 'sala'), ses(7, 75, 8, 65), ses(2, 80, 7, 0),
      { id: 'live-now', clientId: 'c1', source: 'client', status: 'in_progress', date: d(0), exercises: [{ name: 'Ściąganie wyciągu szerokim chwytem', sets: [{ kg: 200, reps: 1 }] }] },
      { id: 'hw1', clientId: 'c1', source: 'homework', status: 'done', date: d(1), exercises: [] }] : [];
    window.METRIC_ENTRIES = opts.sessions ? [{ clientId: 'c1', groupId: 'mg1', date: d(60), values: { m1: '85.8' } }, { clientId: 'c1', groupId: 'mg1', date: d(3), values: { m1: '84.2' } },
      { clientId: 'c1', groupId: 'mg2', date: d(50), values: { m2: '92' } }, { clientId: 'c1', groupId: 'mg2', date: d(4), values: { m2: '89.5' } }] : [];
    window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] };
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: { bodyWeight: !!opts.weight } }, contact: {} };
    enterClientLiveShell(); setClientLiveScreen('progress');
  }, opts);
  const txt = () => page.evaluate(() => document.getElementById('clive-screen-content').innerText);

  await boot({ sessions: false });
  await page.waitForTimeout(300);
  const empty = await page.evaluate(() => ({ chart: !!document.querySelector('.cs-chart'), txt: document.getElementById('clive-screen-content').innerText }));
  ok('bez treningów: zachęty zamiast wykresów i rekordów', !empty.chart && /Po 2 treningach/.test(empty.txt) && /Po zapisanych seriach/.test(empty.txt), empty.txt.slice(0, 300));

  await boot({ sessions: true });
  await page.waitForTimeout(300);
  let t = await txt();
  ok('90 dni: 5 treningów (z salą, bez treningu w toku i zadania domowego)', /Treningi · 90 dni\s*5\b/.test(t), t.slice(0, 600));
  ok('cel tygodnia z planu: 3 dni w planie', /z 3\b/.test(t) && /Cel z Twojego planu: 3 treningi w tygodniu/.test(t), t.slice(0, 300));
  ok('podsumowanie miesiąca', !!(await page.$('[data-cpg-summary]')) && /Podsumowanie miesiąca/.test(t));
  const cal = await page.evaluate(() => ({ cells: document.querySelectorAll('[data-cpg-calendar] .cpg-cal > .cpg-cal-d.is-on').length, aria: document.querySelector('[data-cpg-calendar] .cpg-cal').getAttribute('aria-label') }));
  ok('kalendarz regularności: 5 dni z treningiem, opis dla czytnika', cal.cells === 5 && /5 dni z treningiem/.test(cal.aria), JSON.stringify(cal));
  const s = await page.evaluate(() => ({ txt: document.querySelector('.cs-strength').innerText, pts: document.querySelectorAll('.cs-strength .cs-ch-dot').length, aria: document.querySelector('.cs-strength .cs-chart').getAttribute('aria-label') }));
  ok('postęp siłowy: 65 → 80 kg (rozgrzewka i trening w toku pominięte), 5 punktów', /65 → 80 kg/.test(s.txt) && s.pts === 5 && !/200/.test(s.txt), s.txt);
  ok('wykres z opisem dla czytnika i polskimi datami', /Najcięższa seria w kolejnych treningach: \d+ [a-zśźż]+ 65 kg/.test(s.aria), s.aria);
  const rec = await page.evaluate(() => ({ n: document.querySelectorAll('[data-cpg-records]').length, txt: document.querySelector('[data-cpg-records]').innerText, bars: document.querySelectorAll('[data-cpg-records] [style*="width"]').length }));
  ok('jedna sekcja rekordów, bez pasków', rec.n === 1 && rec.bars === 0, JSON.stringify(rec));
  ok('rekord 80 kg × 7 z szac. 1RM ok. 97,5 kg; 15 powt. bez 1RM; bez planka', /80 kg × 7/.test(rec.txt) && /szac\. 1RM ok\. 97,5 kg/.test(rec.txt) && /20 kg × 15/.test(rec.txt) && !/Wiosłowanie hantlem[^\n]*\n[^\n]*1RM/.test(rec.txt) && !/Plank/.test(rec.txt), rec.txt);
  ok('masa ciała ukryta, gdy trener jej nie pokazuje', !/Masa ciała/.test(t));
  ok('obwody: talia 89,5 cm, −2,5 cm', /Talia\s*89,5 cm\s*−2,5 cm/.test(t), (t.match(/Obwody[\s\S]{0,200}/) || [''])[0]);
  ok('zdjęcia: zachęta i „Dodaj zdjęcia”', /Zdjęcia przed i po/.test(t) && /Dodaj zdjęcia/.test(t));
  ok('bez emoji i bez dat ISO', !EMOJI.test(t) && !/\d{4}-\d{2}-\d{2}/.test(t), (t.match(EMOJI) || [''])[0]);
  ok('liczby po polsku (przecinek, nie kropka)', !/\d\.\d+\s?(kg|cm|t|min)\b/.test(t), (t.match(/\d\.\d+\s?(kg|cm|t|min)\b/) || [''])[0]);

  // Ten sam ciężar, więcej powtórzeń: nagłówek „6 → 7 powt. (77,5 kg)”, nie „77,5 → 77,5 kg”.
  await page.evaluate(() => { const d = (n) => { const x = new Date(todayYmd() + 'T12:00:00'); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    window._cpgEx = 'Wyciskanie leżąc'; window.SE.push(...[[10, 6], [3, 7]].map(([n, r]) => ({ id: 'w' + n, clientId: 'c1', source: 'client', status: 'completed', date: d(n), exercises: [{ name: 'Wyciskanie leżąc', loadUnit: 'kg', sets: [{ kg: 77.5, reps: r }] }] })));
    setClientLiveScreen('progress'); });
  await page.waitForTimeout(200);
  if (await page.$('[data-cpg-ex="Wyciskanie leżąc"]')) { await page.tap('[data-cpg-ex="Wyciskanie leżąc"]'); await page.waitForTimeout(200); }
  const reps = await page.evaluate(() => ({ big: document.querySelector('[data-cpg-strength-big]').innerText, delta: document.querySelector('[data-cs-strength-delta]').innerText, up: document.querySelector('[data-cs-strength-delta]').classList.contains('is-up') }));
  ok('ten sam ciężar: nagłówek z powtórzeniami „6 → 7 powt. (77,5 kg)”, na zielono', /^6 → 7 powt\.\s*\(77,5 kg\)$/.test(reps.big.trim()) && /\+1 powt\. przy tym samym ciężarze/.test(reps.delta) && reps.up, JSON.stringify(reps));
  await page.evaluate(() => { window.SE = window.SE.filter((s) => !/^w\d/.test(s.id)); window._cpgEx = ''; setClientLiveScreen('progress'); });

  await page.tap('[data-cpg-range="30"]');
  await page.waitForTimeout(200);
  t = await txt();
  ok('30 dni: 4 treningi', /Treningi · 30 dni\s*4\b/.test(t), t.slice(0, 600));
  await page.tap('[data-cpg-range="all"]');
  await page.waitForTimeout(200);
  ok('cały okres: 5 treningów, wybór zapamiętany', /Treningi · cały okres\s*5\b/.test(await txt()) && await page.evaluate(() => sessionStorage.getItem('pl_cs_prog_range') === 'all'));

  await boot({ sessions: true, weight: true });
  await page.waitForTimeout(300);
  t = await txt();
  ok('masa ciała po włączeniu: 84,2 kg, −1,6 kg od …, wykres', /Masa ciała\s*84,2 kg\s*−1,6 kg od/.test(t) && !!(await page.$('[data-cpg-weight] .cs-chart')), (t.match(/Masa ciała[\s\S]{0,80}/) || [''])[0]);
  const geo = await page.evaluate(() => ({ kpi: [...document.querySelectorAll('.cpg-kpi')].map((e) => Math.round(e.getBoundingClientRect().height)), small: [...document.querySelectorAll('.cpg button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.innerText.trim()), over: document.documentElement.scrollWidth > innerWidth }));
  ok('kafelki niskie (≤ 80 px)', geo.kpi.length === 4 && geo.kpi.every((h) => h <= 80), JSON.stringify(geo.kpi));
  ok('przyciski ≥ 44 px, bez przewijania w poziomie', !geo.small.length && !geo.over, JSON.stringify(geo));

  // Zdjęcia przed / po: pierwszy i ostatni zestaw obok siebie, przełącznik ujęcia.
  const px = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  await page.evaluate((px) => { const d = (n) => { const x = new Date(todayYmd() + 'T12:00:00'); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
    window.PROGRESS_PHOTOS = [{ id: 'ph1', clientId: 'c1', date: d(60), weight: '85.8', photos: { front: px } }, { id: 'ph2', clientId: 'c1', date: d(30), photos: { front: px, side: px } }, { id: 'ph3', clientId: 'c1', date: d(2), weight: '84.2', photos: { front: px, side: px } }];
    setClientLiveScreen('progress'); }, px);
  await page.waitForTimeout(200);
  const ph = await page.evaluate(() => [...document.querySelectorAll('[data-cpg-photos] figcaption')].map((f) => f.innerText));
  ok('zdjęcia: „Przed” (najstarsze w okresie) i „Teraz” (najnowsze) z datą i masą po polsku', ph.length === 2 && /^Przed/.test(ph[0]) && /85,8 kg/.test(ph[0]) && /^Teraz/.test(ph[1]) && /84,2 kg/.test(ph[1]), JSON.stringify(ph));
  await page.evaluate(() => cpgSetPhotoView('side'));
  await page.waitForTimeout(200);
  const ph2 = await page.evaluate(() => [...document.querySelectorAll('[data-cpg-photos] figcaption')].map((f) => f.innerText));
  ok('ujęcie „Bok”: porównanie tylko zestawów z tym ujęciem', ph2.length === 2 && !/85,8/.test(ph2[0]), JSON.stringify(ph2));

  await page.evaluate(() => setClientLiveScreen('trainer'));
  await page.waitForTimeout(300);
  const h = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cs-hub .cs-row')].map((b) => Math.round(b.getBoundingClientRect().height));
    const cta = document.querySelector('[data-cs-hub-chat] .cs-btn-primary');
    return { rows, cta: cta ? cta.innerText.trim() : '', ctaTop: cta ? cta.getBoundingClientRect().top : 9999 };
  });
  ok('Trener: „Napisz do trenera” na górze ekranu', /Napisz do trenera/.test(h.cta) && h.ctaTop < 500, JSON.stringify(h));
  ok('Trener: wiersze niższe (≤ 72 px, ≥ 44 px; bez podpisu ≤ 56 px)', h.rows.length > 2 && h.rows.every((x) => x >= 44 && x <= 72) && h.rows.slice(1).every((x) => x <= 56), JSON.stringify(h.rows));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Postępy 2.0 — OK');
})();
