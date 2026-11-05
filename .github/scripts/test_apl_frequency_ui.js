// Generator AI: prośba w „Dodatkowych uwagach” o tę samą partię w 2 treningach (i metoda FBW) jest realizowana,
// a „Objętość/tydzień” liczy się z ćwiczeń, które naprawdę są w planie.
// Regresja (5.11.2026): FBW 2 dni, uwaga „w dwóch treningach ta sama partia”, sesja A bez pleców, sesja B bez klatki,
// a podsumowanie AI zapowiadało „Sesja B uzupełnia klatkę wyciskaniem płaskim”.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
const SHOT = process.env.APL_FREQ_SHOT || '';

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof aplGenerate === 'function');
  const run = async (mode) => page.evaluate(async (mode) => {
    window._uid = 'gen-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window._db = { fixture: 1 };
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const root = document.getElementById('app-root'); if (root) root.style.display = '';
    window.notify = () => {}; window.CL = []; window.PL = [];
    goTo('aiplangen');
    const pick = (grp, val) => { const b = document.querySelector('#' + grp + ' [data-val="' + val + '"]'); if (b && !b.classList.contains('active')) aplToggleOpt(b, grp); };
    pick('apl-methods', mode === 'ppl' ? 'PPL' : 'FBW'); pick('apl-levels', 'sredni'); pick('apl-days', '2'); pick('apl-duration', '60');
    document.getElementById('apl-notes').value = mode === 'ppl' ? '' : 'zastosuj w dwoch treningach cwiczenia an ta samam partie miesniowa tak aby przestymulowac je dwa razy';
    const calls = [];
    const E = (name, mg, sets) => ({ name, notes: 'x', muscleGroup: mg, sets: String(sets), reps: '10-12', rest: '90s', rpe: '8', rir: '2', kg: '20', tempo: '3-1-1-0' });
    const A = [E('Wyciskanie sztangi na ławce płaskiej', 'Klatka', 4), E('Rozpiętki na bramie', 'Klatka', 4), E('Wypychanie nogami na suwnicy (leg press)', 'Nogi (czworogłowe)', 4), E('Unoszenie hantli bokiem', 'Barki (bok)', 3), E('Prostowanie ramion na wyciągu', 'Triceps', 3), E('Plank', 'Core', 3)];
    const B = [E('Ściąganie drążka wyciągu szerokim uchwytem (do klatki)', 'Plecy (lat)', 4), E('Wiosłowanie hantlem jednorącz (klatka piersiowa na ławce)', 'Plecy (środek / romb / trapez)', 4), E('Uginanie ramion hantlami (supinacja w szczycie)', 'Biceps', 3), E('Martwy ciąg rumuński ze sztangą', 'Pośladki / dwugłowe uda', 4), E('Uginanie nóg w leżeniu na maszynie', 'Dwugłowe uda', 5), E('Plank na prostych ramionach z uniesieniem ręki', 'Core', 3)];
    const day = (d, list) => ({ dayName: 'Dzień ' + d + ' — Sesja ' + (d === 1 ? 'A' : 'B'), focus: 'x', warmupExercises: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], exercises: JSON.parse(JSON.stringify(list)) });
    window.fetch = async (url, opt) => {
      const body = JSON.parse(opt.body); const user = body.messages[0].content;
      calls.push({ sys: body.system, user });
      const m = /(?:TYLKO dni|Dodaj dni) (\d+)–(\d+)/.exec(body.system + ' ' + user);
      const from = m ? +m[1] : 1;
      const fixed = /POPRAW CZĘSTOTLIWOŚĆ PARTII/.test(user) && mode === 'cooperative';
      let list = from === 1 ? A.slice() : B.slice();
      if (fixed && from === 1) list.splice(2, 0, E('Wiosłowanie sztangą w opadzie', 'Plecy', 3));
      if (fixed && from === 2) list.splice(0, 0, E('Wyciskanie hantli na ławce skośnej', 'Klatka', 3), E('Wyciskanie hantli nad głowę siedząc', 'Barki', 3));
      const plan = from === 1 ? { planName: 'FBW 2×', summary: 's', weeklyVolume: { Chest: '8 serii bezpośrednich (Sesja A: 4+4); Sesja B uzupełnia partię przez wyciskanie płaskie', Back: '0 serii Sesja A; Sesja B: ok. 10–12 serii' }, days: [day(1, list)] } : { days: [day(2, list)] };
      const text = JSON.stringify(plan);
      return { ok: true, status: 200, json: async () => ({ content: [{ text }], stop_reason: 'end_turn' }), text: async () => text };
    };
    await aplGenerate();
    const plan = window.aplLastPlan || aplLastPlan;
    const cat = e => aplNormalizeMuscleCategory(e);
    const vol = document.querySelector('[data-apl-weekly-volume]');
    return {
      calls: calls.map(c => ({ freqSys: /CZĘSTOTLIWOŚĆ PARTII \(OBOWIĄZKOWE/.test(c.sys), fix: /POPRAW CZĘSTOTLIWOŚĆ PARTII/.test(c.user), digest: /Istniejące dni:\nDzień 1: Wyciskanie sztangi/.test(c.user), promised: /Sesja B uzupełnia/.test(c.user) })),
      cats: (plan.days || []).map(d => d.exercises.map(cat)),
      fix: plan.frequencyFix || [],
      wv: plan.weeklyVolume, wvAI: plan.weeklyVolumeAI,
      volText: vol ? vol.innerText : '',
      checks: [...document.querySelectorAll('[data-apl-check]')].map(li => li.dataset.aplCheck + ':' + li.textContent)
    };
  }, mode);

  const c = await run('cooperative');
  ok('notes request goes into the prompt of every part', c.calls.length >= 2 && c.calls.every(x => x.freqSys), JSON.stringify(c.calls));
  ok('day 1 without back → one corrective retry; day 2 without chest/shoulders → one corrective retry', c.calls.filter(x => x.fix).length === 2 && c.calls.length === 4, JSON.stringify(c.calls));
  ok('second part sees exercises of day 1 and what the first part promised', c.calls.slice(2).every(x => x.digest && x.promised), JSON.stringify(c.calls));
  for (const g of ['klatka', 'plecy', 'barki']) ok(g + ' in both sessions', c.cats.every(d => d.includes(g)), JSON.stringify(c.cats));
  ok('legs in both sessions (quads / glutes-hamstrings)', c.cats.every(d => d.includes('nogi') || d.includes('posladki')), JSON.stringify(c.cats));
  ok('row „(klatka piersiowa na ławce)” counts as back, not chest', c.cats[1].filter(x => x === 'plecy').length >= 2, JSON.stringify(c.cats[1]));
  ok('weekly volume computed from the plan (chest 2×, back 2×)', /2×\/tydz/.test(c.wv.Klatka || '') && /2×\/tydz/.test(c.wv.Plecy || ''), JSON.stringify(c.wv));
  ok('AI promise about session B is not shown as volume', !/uzupełnia/.test(c.volText) && /Klatka/.test(c.volText), c.volText);
  ok('AI description kept aside', c.wvAI && /uzupełnia/.test(c.wvAI.Chest || ''), JSON.stringify(c.wvAI));
  ok('no frequency warning when AI fixed it', !c.checks.some(x => /^frequency/.test(x)), JSON.stringify(c.checks));
  if (SHOT) { await page.evaluate(() => document.querySelector('[data-apl-weekly-volume]').scrollIntoView({ block: 'center' })); await page.screenshot({ path: SHOT }); }

  const s = await run('stubborn');
  ok('AI ignores the hint → app splits the work itself', s.cats.every(d => ['klatka', 'plecy', 'barki'].every(g => d.includes(g))), JSON.stringify(s.cats));
  ok('copied exercise splits sets — weekly chest not doubled (8 → at most minimum for level)', (parseInt(s.wv.Klatka, 10) || 0) <= 12 && /D2: \d/.test(s.wv.Klatka || ''), JSON.stringify(s.wv));
  ok('trainer sees what was moved in Kontrola planu', s.checks.some(x => /^frequency-fix:/.test(x) && /klatka/.test(x)), JSON.stringify(s.checks));

  const p = await run('ppl');
  ok('no request, no FBW → no frequency block, no retries', p.calls.length === 2 && p.calls.every(x => !x.freqSys && !x.fix), JSON.stringify(p.calls));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll frequency checks passed');
})().catch(e => { console.error(e); process.exit(1); });
