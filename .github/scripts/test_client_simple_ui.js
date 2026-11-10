// UI: prosty widok klienta (client-simple.js) — Dzisiaj, jedno ćwiczenie, Plan, Postępy, Kontakt.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.CLIENT_SIMPLE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-client-simple'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  // Atrapa sesji klienta: bez prawdziwego logowania i bez zapisu do produkcji.
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://localhost:' + port + '/index.html?nocache=client-simple', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-simple' };
    window.persistById = async (_c, o) => o; window.notify = () => {};
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd(); const mon = mondayYmd(); const wd = new Date().getDay();
    const add = (y, n) => { const d = new Date(y + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Piotr Urbaniak', status: 'active', preferredWeekdays: [wd] }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: kg ? String(kg) : '', rest: '90s' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: add(today, -30),
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Przysiad goblet', 3, 10, 20), ex('Wyciskanie hantli na ławce płaskiej', 3, 10, 16), ex('Wiosłowanie hantlem jednorącz', 3, 12, 18), ex('Martwy ciąg rumuński', 3, 10, 28), ex('Wyciskanie hantli nad głowę siedząc', 3, 10, 10), ex('Plank', 3, '40', 0)] }] }];
    window.SE = [{ id: 's-old', clientId: 'c1', trainerId: 'cs-trainer', planId: 'p1', dayIdx: 0, date: add(mon, -7), source: 'client', status: 'completed', exercises: [] }];
    window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] };
    window.METRIC_ENTRIES = [{ clientId: 'c1', groupId: 'mg1', date: add(today, -40), values: { m1: 85.8 } }, { clientId: 'c1', groupId: 'mg1', date: add(today, -3), values: { m1: 84.2 } }];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} },
      contact: { name: 'P&P Progress', phone: '+48 692 535 692', address: 'Owczarska 64, 54-020 Wrocław-Leśnica', website: 'https://teamprogress.pl/' } };
    enterClientLiveShell();
  });
  await page.waitForSelector('.cs-today');
  const home = await page.evaluate(() => {
    const root = document.querySelector('.cs-today');
    return {
      text: root.innerText,
      primary: root.querySelectorAll('.cs-btn-primary').length,
      nav: [...document.querySelectorAll('#clive-nav .clive-nav-btn')].map(b => b.innerText.trim())
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'client_simple_today.png') });
  ok('greeting', /Cześć, Piotr!/.test(home.text), home.text.slice(0, 80));
  ok('one main action', home.primary === 1 && /Rozpocznij trening/.test(home.text));
  ok('title, time and count', /Full Body/.test(home.text) && /ok\. \d+ min/.test(home.text) && /6 ćwiczeń/.test(home.text), home.text);
  ok('no exercise list on home', !/Przysiad goblet/.test(home.text));
  ok('week progress', /W tym tygodniu/.test(home.text) && /0 z 1/.test(home.text), home.text);
  ok('bottom nav', JSON.stringify(home.nav) === JSON.stringify(['Dzisiaj', 'Trening', 'Plan', 'Postępy', 'Więcej']), JSON.stringify(home.nav));

  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-ex');
  const exv = await page.evaluate(() => {
    const t = document.querySelector('.cs-ex').innerText;
    return { text: t, reps: document.querySelector('input[aria-label="Seria 1: powtórzenia"]').value, kg: document.querySelector('input[aria-label="Seria 1: ciężar"]').value, tipsOpen: !!document.getElementById('cs-tips') };
  });
  await page.screenshot({ path: path.join(shotDir, 'client_simple_exercise.png') });
  ok('starts on first exercise', /Ćwiczenie 1 z 6/.test(exv.text) && /Przysiad goblet/.test(exv.text), exv.text.slice(0, 120));
  ok('set, reps and load', /Seria 1 z 3/.test(exv.text) && exv.reps === '10' && exv.kg === '20', JSON.stringify(exv));
  ok('big actions', /Ukończ serię/.test(exv.text) && /Następne ćwiczenie/.test(exv.text));
  ok('tips hidden by default', !exv.tipsOpen && /Pokaż wskazówki/.test(exv.text));

  await page.click('.cs-ex-foot .cs-btn-primary');
  await page.waitForSelector('.cw-rest');
  await page.evaluate(() => cwSkipRest());
  const after = await page.evaluate(() => ({ text: document.querySelector('.cs-ex').innerText, done: window._cw.exercises[0].sets[0].done }));
  ok('complete set logs it', after.done && /Seria 2 z 3/.test(after.text), after.text.slice(0, 120));
  await page.click('text=Pokaż wskazówki');
  const tips = await page.evaluate(() => (document.getElementById('cs-tips') || {}).innerText || '');
  ok('tips reveal details', /SERIE \(1\/3\)/.test(tips) && /Zgłoś ból lub problem/.test(tips), tips.slice(0, 160));
  await page.click('.cs-ex-foot .cs-btn-secondary');
  ok('next exercise', await page.evaluate(() => /Ćwiczenie 2 z 6/.test(document.querySelector('.cs-ex').innerText)));
  await page.evaluate(() => cwClose());

  await page.evaluate(() => setClientLiveScreen('plan'));
  const plan = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
  ok('plan list is simple', /Mój plan/.test(plan) && /dzisiaj|zaplanowany/.test(plan) && !/Przysiad goblet/.test(plan), plan);
  await page.click('.cs-row');
  const detail = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
  ok('plan detail shows exercises', /Przysiad goblet/.test(detail) && /3 × 10 · 20 kg/.test(detail), detail);

  await page.evaluate(() => setClientLiveScreen('progress'));
  let prog = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
  ok('progress has simple stats', /Treningi w/.test(prog) && /Regularność/.test(prog) && /Więcej statystyk/.test(prog), prog);
  ok('body weight hidden by default', !/Masa ciała/.test(prog));
  await page.evaluate(() => { SETTINGS.clientApp.visibleSections.bodyWeight = true; setClientLiveScreen('progress'); });
  prog = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
  ok('body weight when trainer enables it', /Masa ciała/.test(prog) && /84,2 kg/.test(prog), prog);
  await page.screenshot({ path: path.join(shotDir, 'client_simple_progress.png') });

  await page.evaluate(() => setClientLiveScreen('contact'));
  const contact = await page.evaluate(() => document.getElementById('clive-screen-content').innerText);
  ok('contact screen', /Napisz do trenera/.test(contact) && /Umów trening/.test(contact) && /Owczarska 64/.test(contact) && /692 535 692/.test(contact) && /teamprogress\.pl/.test(contact), contact);
  const more = await page.evaluate(() => capLiveMoreScreens().map(s => s.id));
  ok('contact and chat in more sheet', more[0] === 'contact' && more.includes('messages'), JSON.stringify(more));

  ok('no page errors', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll client-simple UI checks passed');
})().catch(e => { console.error(e); process.exit(1); });
