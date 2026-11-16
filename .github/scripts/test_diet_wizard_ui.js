#!/usr/bin/env node
'use strict';
/** Kalkulator: kreator jadłospisu w 4 krokach, kontrola jakości, podgląd klienta i zapis planu (bez wysyłki automatycznej). */
const { chromium } = require('playwright');
const URL = process.env.APP_URL || 'http://127.0.0.1:8080/index.html';
let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK  ', name);
}
(async () => {
  const b = await chromium.launch();
  for (const [tag, vp] of [['komputer', { width: 1440, height: 1000 }], ['telefon', { width: 390, height: 844 }]]) {
    const page = await b.newPage({ viewport: vp });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
    await page.goto(URL + '?calc=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof setCalcTool === 'function' && window.DietView && typeof dgGo === 'function', null, { timeout: 15000 });
    await page.evaluate(() => {
      window.persistById = async (_c, o) => o; window.notify = m => { (window.__n = window.__n || []).push(m); };
      window.pushMsg = (id, t) => { (window.__m = window.__m || []).push(t); };
      ['auth-screen', 'app-loading', 'screensaver'].forEach(i => { const e = document.getElementById(i); if (e) e.style.display = 'none'; });
      const app = document.getElementById('app-root'); if (app) app.style.display = 'flex';
      window._uid = 'u1';
      window.CL = [{ id: 'c1', name: 'Anna Kowalczyk', status: 'active', goal: 'redukcja', weight: 74, height: 168, age: 38, gender: 'K', activityLevel: 'moderate', trainingFreq: 3, preferredWeekdays: [1, 3, 5] }];
      window.PL = []; window.SE = [];
      goTo('calculator'); setCalcTool('tdee');
      document.getElementById('calc-client').value = 'c1'; calcLoadFromClient();
    });
    await page.waitForTimeout(300);
    const s = () => page.evaluate(() => {
      const c = document.getElementById('diet-card');
      return { text: c ? c.innerText : '', cur: (document.querySelector('.dg-step.is-cur') || {}).textContent || '',
        full: c ? c.closest('.calc-col-full') !== null : false };
    });
    let st = await s();
    ok(tag + ': karta jadłospisu na całą szerokość wyników', st.full);
    ok(tag + ': krok 1 — cel i rytm dnia', /Cel i rytm dnia/.test(st.cur + st.text) && /Liczba posiłków/.test(st.text) && /Pory posiłków/.test(st.text));
    ok(tag + ': przed generowaniem brak jadłospisu', !(await page.$('#diet-card [data-dpv-id]')));

    await page.evaluate(() => dgGo(2)); st = await s();
    ok(tag + ': krok 2 — domyślnie brak alergii', /Brak zgłoszonych alergii i wykluczeń/.test(st.text));
    ok(tag + ': krok 2 — pytanie o choroby i leki', /choroby, leki lub zalecenia lekarza/.test(st.text));
    await page.evaluate(() => dgMedical('tak')); st = await s();
    ok(tag + ': zalecenia lekarza → ostrzeżenie', st.text.includes('Nie generuj automatycznie gotowego jadłospisu'));
    await page.evaluate(() => dgGo(4));
    ok(tag + ': zalecenia lekarza → brak przycisku generowania', !(await page.$('[data-dg-generate]')));
    await page.evaluate(() => { dgGo(2); dgMedical('nie'); dgEx('gluten'); }); st = await s();
    ok(tag + ': wykluczenie widoczne', /Wykluczenia: gluten/i.test(st.text));

    await page.evaluate(() => { dgGo(3); dgBudget('standard'); dgMaxMin(30); dgPrep(2); dgLunch(false); }); st = await s();
    ok(tag + ': krok 3 — styl życia', /Budżet/i.test(st.text) && /Lunchbox/i.test(st.text));
    await page.evaluate(() => dgGo(4)); st = await s();
    const fit = st.text.match(/Dopasowanie planu: (\d+)%/);
    ok(tag + ': krok 4 — wskaźnik dopasowania', !!fit && +fit[1] > 0 && +fit[1] < 100 && /Brakuje informacji o/.test(st.text), st.text.slice(0, 200));
    ok(tag + ': krok 4 — przycisk generowania', !!(await page.$('[data-dg-generate]')));

    await page.evaluate(() => dgGenerate()); await page.waitForTimeout(200); st = await s();
    ok(tag + ': plan w nowym widoku', !!(await page.$('#diet-card [data-dpv-id="calcdpv"]')));
    ok(tag + ': akcje trenera', ['Zapisz w profilu', 'Podgląd klienta', 'Wygeneruj PDF', 'Wyślij klientowi'].every(x => st.text.includes(x)));
    ok(tag + ': kontrola jakości', /Kalorie mieszczą się w wybranym celu/.test(st.text) && /Plan wymaga ręcznej weryfikacji trenera/.test(st.text));
    ok(tag + ': „Dlaczego taki plan?”', /Dlaczego taki plan\?/.test(st.text));
    ok(tag + ': suma dnia w planie', !!(await page.$('#diet-card [data-dpv-daysum]')));
    ok(tag + ': bez czerwonego przycisku w karcie (czerwony jest u góry ekranu)', (await page.$$('#diet-card .btn-primary')).length === 0);
    ok(tag + ': bez poziomego przewijania', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    await page.evaluate(() => dgClientPreview()); await page.waitForTimeout(300);
    const pv = await page.evaluate(() => { const m = document.getElementById('dpv-preview') || document.querySelector('[class*="dpv-cpreview"]'); return m ? m.innerText : ''; });
    ok(tag + ': podgląd klienta bez BMR i PAL', pv.length > 50 && !/BMR|PAL|TDEE|Mifflin/.test(pv), pv.slice(0, 120));
    await page.evaluate(() => DietView.close());

    await page.evaluate(() => dietSendToClient()); await page.waitForTimeout(200);
    ok(tag + ': wysyłka wymaga zatwierdzenia', !!(await page.$('#diet-approve-check')) && await page.evaluate(() => document.getElementById('diet-approve-btn').disabled));
    ok(tag + ': nic nie wysłane samo', await page.evaluate(() => !(window.__m || []).length));
    await page.evaluate(() => { const c = document.getElementById('diet-approve-check'); c.checked = true; dietApprovalToggle(); dietApproveAndSend(); });
    const rec = await page.evaluate(() => { const p = CL[0].dietPlan || {}; return { st: p.status, plan: !!(p.plan && p.plan.days && p.plan.days.length), why: Array.isArray(p.why) && p.why.length > 0, wiz: !!p.wizard, ex: !!(p.prefs && JSON.stringify(p.prefs).includes('gluten')) }; });
    ok(tag + ': zapisany plan z widokiem klienta, „dlaczego” i kreatorem', rec.st === 'zatwierdzony' && rec.plan && rec.why && rec.wiz && rec.ex, JSON.stringify(rec));
    const cl = await page.evaluate(() => { const h = pkcFoodHTML(CL[0]); return { dpv: h.includes('data-dpv-id'), bmr: /BMR|PAL|Mifflin/.test(h.replace(/<[^>]+>/g, ' ')) }; });
    ok(tag + ': klient widzi plan w aplikacji (bez BMR/PAL)', cl.dpv && !cl.bmr, JSON.stringify(cl));
    ok(tag + ': bez błędów JS', !errs.length, errs.slice(0, 3).join(' | '));
    await page.close();
  }
  await b.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll diet wizard UI tests passed');
})().catch(e => { console.error(e); process.exit(1); });
