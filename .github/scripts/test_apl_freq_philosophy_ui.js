// Filozofia trenera w generatorze: KAŻDA partia 2× w tygodniu w każdej metodzie (tu PPL 3 dni bez uwag),
// a druga sesja to INNY wariant tej partii (inny sprzęt lub płaszczyzna), nie kopia tego samego ćwiczenia.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof aplGenerate === 'function' && typeof aplPickFrequencyVariant === 'function');
  const r = await page.evaluate(async () => {
    window._uid = 'gen-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window._db = { fixture: 1 };
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    const root = document.getElementById('app-root'); if (root) root.style.display = '';
    window.notify = () => {}; window.CL = []; window.PL = [];
    goTo('aiplangen');
    if (typeof plivManual === 'function') plivManual();
    const pick = (grp, val) => { const b = document.querySelector('#' + grp + ' [data-val="' + val + '"]'); if (b && !b.classList.contains('active')) aplToggleOpt(b, grp); };
    pick('apl-methods', 'PPL'); pick('apl-levels', 'sredni'); pick('apl-days', '3'); pick('apl-duration', '60');
    document.getElementById('apl-notes').value = '';
    const E = (name, mg, sets) => ({ name, notes: 'x', muscleGroup: mg, sets: String(sets), reps: '8-10', rest: '120s', rpe: '8', rir: '2', kg: '60', tempo: '3-1-1-0' });
    const D = [
      [E('Wyciskanie sztangi na ławce płaskiej', 'Klatka', 4), E('Wyciskanie żołnierskie sztangi stojąc', 'Barki', 4), E('Prostowanie ramion na wyciągu', 'Triceps', 3)],
      [E('Podciąganie na drążku nachwytem', 'Plecy', 4), E('Uginanie ramion ze sztangą stojąc', 'Biceps', 3)],
      [E('Przysiad ze sztangą na plecach', 'Nogi (czworogłowe)', 4), E('Hip thrust ze sztangą', 'Pośladki', 4)]
    ];
    const names = ['Push', 'Pull', 'Legs'];
    const calls = [];
    window.fetch = async (url, opt) => {
      const body = JSON.parse(opt.body); const user = body.messages[0].content;
      calls.push(body.system);
      const m = /(?:TYLKO dni|Dodaj dni) (\d+)–(\d+)/.exec(body.system + ' ' + user);
      const from = m ? +m[1] : 1, to = m ? +m[2] : 3;
      const days = [];
      for (let i = from; i <= to; i++) days.push({ dayName: 'Dzień ' + i + ' — ' + names[i - 1], focus: 'x', warmupExercises: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], exercises: JSON.parse(JSON.stringify(D[i - 1])) });
      const text = JSON.stringify({ planName: 'PPL', summary: 's', days });
      return { ok: true, status: 200, json: async () => ({ content: [{ text }], stop_reason: 'end_turn' }), text: async () => text };
    };
    await aplGenerate();
    const plan = window.aplLastPlan || aplLastPlan;
    const byGroup = {};
    (plan.days || []).forEach((d, i) => (d.exercises || []).forEach(e => { const c = aplNormalizeMuscleCategory(e); (byGroup[c] = byGroup[c] || []).push({ day: i, name: e.name, eq: aplExEquipClass(e), plane: aplExPlane(e) }); }));
    return {
      prompt: calls.some(s => /filozofia trenera Progress/.test(s) && /UROZMAICONA/.test(s) && /Nie powtarzaj tego samego ćwiczenia/.test(s)),
      byGroup, fix: plan.frequencyFix || [], wv: plan.weeklyVolume,
      checks: [...document.querySelectorAll('[data-apl-check]')].map(li => li.dataset.aplCheck)
    };
  });
  ok('PPL 3 days without a note: philosophy + variety rule in the prompt', r.prompt);
  for (const g of ['klatka', 'plecy', 'nogi', 'barki']) {
    const list = r.byGroup[g] || [];
    ok(g + ' trained on 2 different days', new Set(list.map(x => x.day)).size >= 2, JSON.stringify(list));
    ok(g + ' second session is a different exercise', new Set(list.map(x => x.name)).size === list.length, JSON.stringify(list));
    ok(g + ' second session differs in equipment or plane', list.length < 2 || list.slice(1).some(x => x.eq !== list[0].eq || (x.plane && x.plane !== list[0].plane)), JSON.stringify(list));
  }
  ok('back: pull-up on day 2 → row (other plane) as second session', (r.byGroup.plecy || []).some(x => /wios/i.test(x.name)), JSON.stringify(r.byGroup.plecy));
  ok('chest: flat barbell → dumbbell incline press', (r.byGroup.klatka || []).some(x => /hantli.*sko/i.test(x.name)), JSON.stringify(r.byGroup.klatka));
  ok('app filled the gaps with variants', r.fix.length >= 4 && r.fix.every(x => x.variant), JSON.stringify(r.fix));
  ok('weekly volume shows 2× for chest and back', /2×\/tydz/.test(r.wv.Klatka || '') && /2×\/tydz/.test(r.wv.Plecy || ''), JSON.stringify(r.wv));
  ok('no missing-frequency warning', !r.checks.includes('frequency'), JSON.stringify(r.checks));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll philosophy checks passed');
})().catch(e => { console.error(e); process.exit(1); });
