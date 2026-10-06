// Generator AI: ucięta odpowiedź nie daje „undefined” ani zgubionych dni; objętość wg stażu w prompcie i kontroli.
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
  await page.waitForFunction(() => typeof aplGenerate === 'function' && typeof aplChunkProblem === 'function');
  const run = async (mode) => page.evaluate(async (mode) => {
    window._uid = 'gen-trainer'; window._clientAppMode = false; window._tenantDataReady = true; window._db = { fixture: 1 };
    for (const id of ['auth-screen', 'app-loading']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    window.notify = () => {}; window.CL = []; window.PL = [];
    goTo('aiplangen');
    const pick = (grp, val) => { const b = document.querySelector('#' + grp + ' [data-val="' + val + '"]'); if (b && !b.classList.contains('active')) aplToggleOpt(b, grp); };
    pick('apl-levels', 'zaawansowany'); pick('apl-days', '4'); pick('apl-duration', '60');
    const calls = [];
    const NAMES = [['Wyciskanie na ławce płaskiej', 'Klatka'], ['Wiosłowanie hantlem', 'Plecy'], ['Unoszenie hantli bokiem', 'Barki'], ['Wyciskanie żołnierskie', 'Barki'], ['Ściąganie do twarzy (face pull)', 'Plecy'], ['Uginanie ramion ze sztangą', 'Biceps']];
    const REDUNDANT = [['Podciąganie nachwytem', 'Plecy'], ['Lat Pulldown szerokim chwytem', 'Plecy'], ['Close-Grip Pulldown', 'Plecy'], ['Wiosłowanie hantlem', 'Plecy'], ['Face Pull', 'Plecy'], ['Uginanie ramion ze sztangą', 'Biceps']];
    const ex = (d, i, set) => ({ name: 'Ćw ' + d + '.' + i + ' ' + (set || NAMES)[i - 1][0], notes: 'x', muscleGroup: (set || NAMES)[i - 1][1], sets: '3', reps: '8-12', rest: '90s', rpe: '8', rir: '2', kg: '20', tempo: '3-1-1-0' });
    const day = (d, n, set) => ({ dayName: 'Dzień ' + d + ' — Test', focus: 'x', warmupExercises: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], exercises: Array.from({ length: n }, (_, i) => ex(d, i + 1, set)) });
    window.fetch = async (url, opt) => {
      if (mode === 'redundant-fail' && calls.length === 1) { calls.push({ max: 0, sys: '', user: 'fail' }); return { ok: false, status: 500, text: async () => 'boom', json: async () => ({}) }; }
      const body = JSON.parse(opt.body); calls.push({ max: body.max_tokens, sys: body.system, user: body.messages[0].content });
      const m = /(?:TYLKO dni|Dodaj dni) (\d+)–(\d+)/.exec(body.system + ' ' + body.messages[0].content);
      const from = m ? +m[1] : 1, to = m ? +m[2] : 1;
      const days = []; for (let d = from; d <= to; d++) days.push(day(d, mode === 'short' ? 2 : 6, (mode === 'redundant' || mode === 'redundant-fail') && calls.length === 1 ? REDUNDANT : null));
      let text = JSON.stringify(from === 1 ? { planName: 'Test', summary: 's', days } : { days });
      let stop = 'end_turn';
      if (mode === 'trunc' && calls.length === 1) { text = text.slice(0, text.indexOf('Ćw 1.2') + 12); stop = 'max_tokens'; }
      if (mode === 'garbled' && calls.length === 1) { text = '{"planName":"Te'; stop = 'max_tokens'; }
      return { ok: true, status: 200, json: async () => ({ content: [{ text }], stop_reason: stop }), text: async () => text };
    };
    await aplGenerate();
    const plan = window.aplLastPlan || aplLastPlan;
    const html = (document.getElementById('apl-result') || document.body).innerText;
    const checks = [...document.querySelectorAll('[data-apl-check]')].map(li => li.dataset.aplCheck + ':' + li.textContent);
    return { fix: calls.map(c => /POPRAW DOBÓR ĆWICZEŃ[^\n]*przyciąganie pionowe/.test(c.user)), calls: calls.map(c => ({ max: c.max, vol: /6–7 ćwiczeń głównych|6–7 głównych/.test(c.sys) })), days: (plan.days || []).map(d => (d.exercises || []).map(e => e.name).length),
      names: (plan.days || []).flatMap(d => d.exercises.map(e => e.name)), undef: /undefined/.test(html), checks };
  }, mode);

  const t = await run('trunc');
  console.log(JSON.stringify(t).slice(0, 1500));
  ok('truncated first answer is retried with a bigger budget', t.calls.length >= 4 && t.calls[1].max > t.calls[0].max, JSON.stringify(t.calls));
  ok('all 4 days present with full exercise lists', t.days.join() === '6,6,6,6', JSON.stringify(t.days));
  ok('no exercise without a name / no „undefined” on screen', t.names.every(Boolean) && !t.undef);
  ok('prompt asks for advanced volume (6–7 main exercises at 60 min)', t.calls.every(c => c.vol), JSON.stringify(t.calls));
  const g = await run('garbled');
  ok('unparseable cut-off answer also retries with a bigger budget', g.calls[1] && g.calls[1].max > g.calls[0].max && g.days.join() === '6,6,6,6', JSON.stringify({ calls: g.calls, days: g.days }));
  const r = await run('redundant');
  ok('3 vertical pulls in a day → one retry naming the pattern', r.fix[1] === true && r.calls.length === 4, JSON.stringify(r.fix));
  ok('accepted plan has no repeated pattern', !r.names.some(n => /Pulldown/.test(n)) && !r.checks.some(c => /^pattern:/.test(c)), JSON.stringify(r.checks));
  ok('varied plan: no pattern retry, no pattern warning', t.calls.length === 4 && !t.checks.some(c => /^pattern:/.test(c)), JSON.stringify(t.checks));
  const rf = await run('redundant-fail');
  ok('pattern rewrite fails → plan still generated, warning in Kontrola planu', rf.days.join() === '6,6,6,6' && rf.checks.some(c => /^pattern:/.test(c) && /przyciąganie pionowe/.test(c)), JSON.stringify({ days: rf.days, checks: rf.checks }));
  const s = await run('short');
  ok('too few exercises for advanced is flagged in plan check', s.checks.some(c => /^volume:/.test(c) && /zaawansowany/.test(c)), JSON.stringify(s.checks));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll AI plan generation checks passed');
})().catch(e => { console.error(e); process.exit(1); });
