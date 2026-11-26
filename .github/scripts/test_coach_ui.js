// UI: Progress Coach (coach.js) — nowe sygnały w liście Klienci i na pulpicie, „Rozwiązane”.
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }

async function open(browser, viewport, empty) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  page._errors = [];
  page.on('pageerror', e => page._errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=coach', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((empty) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-trainer'; window._clientAppMode = false; window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'clients-simple' };
    window.__saved = []; window.persistById = async (_c, o) => { window.__saved.push(JSON.parse(JSON.stringify(o))); return o; }; window.notify = () => {};
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    const l = document.getElementById('app-loading'); if (l) l.style.display = 'none';
    const today = todayYmd(); const add = n => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const names = ['Tomasz Owsiany', 'Anna Kowalska', 'Marek Nowak', 'Ewa Zielińska', 'Piotr Wiśniewski'];
    window.CL = empty ? [] : names.map((n, i) => ({ id: 'c' + i, trainerId: 'cs-trainer', name: n, status: 'active', goal: 'masa', email: i === 4 ? 'p@example.test' : '', joinDate: add(-60), createdAt: add(-60) }));
    window.PL = empty ? [] : window.CL.slice(1).map((c, i) => ({ id: 'p' + i, clientId: c.id, trainerId: 'cs-trainer', name: 'Plan', days: [{ day: 'Dzień 1', exercises: [{ name: 'Przysiad', sets: '3', reps: '10' }] }] }));
    window.SE = []; window.TASKS = []; window.METRIC_ENTRIES = []; window.PACKAGES = []; window.CHECKINS = {};
    window.buildMonitorVerdict = c => ({ verdict: c.id === 'c2' ? 'regres' : 'ok', signals: [{ tone: 'bad', label: 'Siła', text: 'spadek' }] });
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    window.MSGS = window.MSGS || {}; Object.keys(window.MSGS).forEach((k) => { delete window.MSGS[k]; });
    window.MSGS.c4 = [{ id: 'm1', clientId: 'c4', out: false, text: 'Zgłoszenie bólu: Kolano · mocno (7–10)', createdAt: ago(3) }];
    window.MSGS.c3 = [{ id: 'm2', clientId: 'c3', out: false, text: '🎥 Film techniki: Przysiad goblet\nTrening: Dzień 1\n[film:v_1.mp4]', createdAt: ago(2) }];
    goTo('clients'); renderClients();
  }, !!empty);
  await page.waitForTimeout(250);
  return page;
}


(async () => {
  const browser = await chromium.launch();
  const page = await open(browser, { width: 1440, height: 900 });
  const rows = await page.evaluate(() => [...document.querySelectorAll('#clients-tbl .cl2-row')].map((r) => ({ id: r.dataset.clientId, t: r.innerText.replace(/\s+/g, ' '), resolve: !!r.querySelector('[data-act="coach-resolve"]') })));
  const ewa = rows.find((r) => r.id === 'c4') || {}; const ewaIdx = rows.findIndex((r) => r.id === 'c4');
  const marekIdx = rows.findIndex((r) => r.id === 'c2');
  ok('ból: pilna sprawa z obszarem + „Odpowiedz” + „Rozwiązane”', /Zgłoszony ból — Kolano/.test(ewa.t) && /Odpowiedz/.test(ewa.t) && ewa.resolve, JSON.stringify(ewa));
  ok('ból na górze listy razem z regresem (pilne)', ewaIdx >= 0 && ewaIdx <= 1 && marekIdx <= 1, JSON.stringify(rows.map((r) => r.id)));
  const md = rows.find((r) => r.id === 'c3') || {};
  ok('film techniki: „Obejrzyj”', /Film do obejrzenia: Przysiad goblet/.test(md.t) && /Obejrzyj/.test(md.t), md.t);
  const dash = await page.evaluate(() => (typeof dashAttentionPeople === 'function' ? dashAttentionPeople() : []).map((p) => p.clientId + ':' + p.issue));
  ok('pulpit: te same sprawy (jedno źródło)', dash.includes('c4:pain') && dash.includes('c3:video'), JSON.stringify(dash));
  await page.click('#clients-tbl .cl2-row[data-client-id="c4"] [data-act="coach-resolve"]');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ saved: window.__saved.slice(-1)[0], t: (document.querySelector('#clients-tbl .cl2-row[data-client-id="c4"]') || {}).innerText || '', open: !!document.querySelector('#cp-drawer.open, .cp-drawer.open') }));
  ok('„Rozwiązane”: zapis na karcie klienta, sprawa znika, profil się nie otwiera', after.saved && after.saved.coachResolved && after.saved.coachResolved.pain && !/Zgłoszony ból/.test(after.t) && !after.open, JSON.stringify({ s: after.saved && after.saved.coachResolved, t: after.t.slice(0, 120) }));
  await page.evaluate(() => { window.MSGS.c3.push({ id: 'm3', clientId: 'c3', out: true, text: 'Świetnie, poprawka: kolana na zewnątrz', createdAt: new Date().toISOString() }); renderClients(); });
  const md2 = await page.evaluate(() => (document.querySelector('#clients-tbl .cl2-row[data-client-id="c3"]') || {}).innerText || '');
  ok('odpowiedź trenera w czacie zamyka sprawę filmu', !/Film do obejrzenia/.test(md2), md2.slice(0, 120));
  ok('bez błędów JS', !page._errors.length, page._errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Progress Coach — OK');
})();
