// UI: okno historii ćwiczenia — kilka treningów przewijanych w bok (swipe / strzałki), jeden na ekranie.
// 360, 390 i 430 px. Bez Firebase i bez zapisu do produkcji.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const shotDir = process.env.EX_HIST_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-ex-hist-swipe');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const w = vp.width;
    const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
    await page.goto('http://localhost:' + port + '/index.html?nocache=ex-hist-' + w, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window._uid = 'eh-client'; window._trainerId = 'eh-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
      window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'ex-hist' };
      window.persistById = async (_c, o) => o; window.notify = () => {};
      window.CL = [{ id: 'c1', trainerId: 'eh-trainer', name: 'Anna', preferredWeekdays: [new Date().getDay()] }];
      window.PL = []; window.TASKS = []; window.PACKAGES = [];
      const s = (id, date, kg) => ({ id, clientId: 'c1', trainerId: 'eh-trainer', date, time: '09:12', source: 'client', status: 'completed', type: 'Trening',
        exercises: [{ name: 'Face pull na wyciągu', sets: [{ reps: 12, kg, done: true, setNo: 1 }, { reps: 12, kg, done: true, setNo: 2 }] }] });
      window.SE = [s('s3', '2026-11-10', 20), s('s2', '2026-11-03', 17.5), s('s1', '2026-10-27', 15)];
      window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
      enterClientLiveShell();
      openExerciseHistory({ name: 'Face pull na wyciągu', clientId: 'c1' });
    });
    await page.waitForSelector('#m-ex-hist .ex-hist-track');
    const state = () => page.evaluate(() => {
      const t = document.querySelector('#m-ex-hist .ex-hist-track');
      const visible = [...t.children].filter((c) => { const r = c.getBoundingClientRect(), tr = t.getBoundingClientRect(); return r.left >= tr.left - 2 && r.right <= tr.right + 2; });
      return {
        n: t.children.length, pos: document.querySelector('#m-ex-hist .ex-hist-pos').textContent,
        visible: visible.map((c) => c.querySelector('.ex-hist-sess-hd').textContent),
        prev: document.querySelector('#m-ex-hist .ex-hist-nav[data-dir="-1"]').disabled,
        next: document.querySelector('#m-ex-hist .ex-hist-nav[data-dir="1"]').disabled,
        sw: document.scrollingElement.scrollWidth, vw: innerWidth,
        navSize: [...document.querySelectorAll('#m-ex-hist .ex-hist-nav')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })
      };
    });
    let st = await state();
    await page.screenshot({ path: path.join(shotDir, 'ex_hist_1_' + w + '.png') });
    ok(w + ': 3 treningi, widać jeden (ostatni)', st.n === 3 && st.visible.length === 1 && /2026-11-10/.test(st.visible[0]), JSON.stringify(st));
    ok(w + ': „Trening 1 z 3 · ostatni”, ‹ wyłączona', /Trening 1 z 3/.test(st.pos) && st.prev && !st.next, st.pos);
    ok(w + ': strzałki co najmniej 44 px', st.navSize.every((x) => x >= 44), JSON.stringify(st.navSize));
    ok(w + ': okno bez przewijania strony w poziomie', st.sw <= st.vw + 1);

    // Przesunięcie palcem = przewinięcie toru w bok (scroll-snap).
    await page.evaluate(() => { const t = document.querySelector('#m-ex-hist .ex-hist-track'); t.scrollLeft = t.clientWidth; });
    await page.waitForTimeout(250);
    st = await state();
    ok(w + ': przesunięcie w bok → poprzedni trening, „2 z 3”', /2026-11-03/.test(st.visible[0] || '') && /Trening 2 z 3/.test(st.pos) && !st.prev && !st.next, JSON.stringify(st));

    // Strzałka › → najstarszy.
    await page.click('#m-ex-hist .ex-hist-nav[data-dir="1"]');
    await page.waitForTimeout(600);
    st = await state();
    await page.screenshot({ path: path.join(shotDir, 'ex_hist_3_' + w + '.png') });
    ok(w + ': › → najstarszy trening, „3 z 3 · najstarszy”', /2026-10-27/.test(st.visible[0] || '') && /3 z 3 · najstarszy/.test(st.pos) && st.next, JSON.stringify(st));
    await page.click('#m-ex-hist .ex-hist-nav[data-dir="-1"]');
    await page.waitForTimeout(600);
    st = await state();
    ok(w + ': ‹ → wraca o jeden', /Trening 2 z 3/.test(st.pos), st.pos);

    // Jeden trening: bez przewijania, z wyjaśnieniem.
    await page.evaluate(() => { window.SE = window.SE.slice(0, 1); closeM('m-ex-hist'); openExerciseHistory({ name: 'Face pull na wyciągu', clientId: 'c1' }); });
    await page.waitForTimeout(200);
    const one = await page.evaluate(() => ({ track: !!document.querySelector('#m-ex-hist .ex-hist-track'), text: document.getElementById('ex-hist-body').innerText }));
    ok(w + ': jeden trening — informacja, bez przewijania', !one.track && /jedyny zapisany trening/.test(one.text), one.text.slice(0, 120));
    ok(w + ': brak błędów JS', !errors.length, errors.join(' | '));
    await context.close();
  }
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll exercise history swipe checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
