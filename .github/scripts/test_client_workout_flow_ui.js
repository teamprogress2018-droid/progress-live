#!/usr/bin/env node
'use strict';
/**
 * Trening klienta (390 × 844, Chromium, ATRAPA Firestore w pamięci strony — bez prawdziwych danych i sieci):
 * 1) „Seria k z n” + ile serii zostało / „Ostatnia seria”,
 * 2) przerwa: pozostały czas, duże odliczanie w ostatnich 5 s, dźwięk i wibracja opcjonalne (przełącznik),
 * 3) komunikaty motywujące tylko w ważnych momentach i każdy raz,
 * 4) rozgrzewka od trenera: odhaczanie / pominięcie, zapis w planSnapshot.warmup; edytor trenera z ograniczeniami klienta,
 * 5) podsumowanie: ćwiczenia, serie, czas, samopoczucie, komentarz,
 * 6) informacja dla trenera w czacie aplikacji z jasnym statusem (wysłano / czeka na sieć), bez udawania push/WhatsApp,
 * 7) bez sieci nic nie ginie: trening i informacja czekają w telefonie i wysyłają się po powrocie połączenia.
 */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-flow';

async function boot(page, opts = {}) {
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((o) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'client-flow' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    window._vib = []; try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window._vib.push(p); return true; } }); } catch (e) {}
    const fs = {};
    window.__fs = fs; window.__offline = false;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => {
      if (window.__offline) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
      const d = fs[ref.col + '/' + ref.id];
      return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) };
    };
    window.persistById = async (col, obj) => {
      if (window.__offline) return null;
      const c = JSON.parse(JSON.stringify(obj)); delete c._fbId; fs[col + '/' + obj.id] = c; return obj;
    };
    const today = todayYmd(); const wd = new Date().getDay();
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: [wd], injuries: 'Ból barku przy unoszeniu ręki',
      warmup: o.warmup ? { items: [{ name: 'Krążenia ramion', dose: '2 × 10' }, { name: 'Mobilizacja bioder', dose: '30 s' }], note: 'Spokojnie, bez bólu' } : null }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s', rir: '2-3' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1', muscles: 'Full Body', exercises: [ex('Wyciskanie hantli', 3, 10, 20), ex('Wiosłowanie', 2, 12, 18), ex('Przysiad goblet', 2, 10, 16), ex('Plank', 1, 30, 0)] }] }];
    window.SE = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [] }; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, opts);
  await page.waitForSelector('.cs-today');
}
const inner = (page) => page.evaluate(() => document.getElementById('clive-player-inner').innerText);
async function saveSet(page) {
  await page.evaluate(() => { if (window._cw.phase === 'rest') cwSkipRest(); });
  await page.waitForTimeout(720);
  await page.click('.cs-ex-foot [data-cs-primary="save"]');
  await page.waitForTimeout(80);
  await page.evaluate(() => { if (window._cwRestTimer) { clearInterval(window._cwRestTimer); window._cwRestTimer = null; } if (window._cw.phase === 'rest') cwSkipRest(); });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss());

  // ---------- 4. Rozgrzewka (klient) ----------
  await boot(page, { warmup: true });
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-wu');
  let t = await inner(page);
  ok('rozgrzewka przed treningiem: lista od trenera, notatka, jedna główna akcja', /Najpierw rozgrzewka/.test(t) && /Krążenia ramion/.test(t) && /2 × 10/.test(t) && /Spokojnie, bez bólu/.test(t) && /Zrobione: 0 z 2/.test(t)
    && await page.locator('.cs-ex-foot .cs-btn-primary').count() === 1 && /Pomiń rozgrzewkę/.test(t), t.slice(0, 300));
  const rowH = await page.$eval('[data-cs-wu="0"]', (e) => e.getBoundingClientRect().height);
  ok('rozgrzewka: duże pola dotykowe (≥ 44 px)', rowH >= 44, String(rowH));
  ok('rozgrzewka: sesja jeszcze nie zapisana na serwerze', await page.evaluate(() => !Object.keys(window.__fs).some((k) => k.startsWith('sessions/'))));
  await page.click('[data-cs-wu="0"]');
  ok('odhaczenie ćwiczenia rozgrzewki', await page.evaluate(() => window._cw.warmup.done[0] === true && document.querySelector('[data-cs-wu="0"]').getAttribute('aria-checked') === 'true' && /Zrobione: 1 z 2/.test(document.querySelector('[data-cs-wu-count]').textContent)));
  await page.click('[data-cs-primary="warmup"]');
  await page.waitForSelector('.cs-set-head');
  await page.waitForTimeout(200);
  const wuLog = await page.evaluate(() => { const s = Object.entries(window.__fs).find(([k]) => k.startsWith('sessions/')); return s && s[1].planSnapshot && s[1].planSnapshot.warmup; });
  ok('wynik rozgrzewki zapisany w planSnapshot.warmup przy pierwszym zapisie sesji', wuLog && wuLog.done[0] === true && wuLog.done[1] === false && wuLog.skipped === false, JSON.stringify(wuLog));

  // ---------- 1. Seria + ile zostało ----------
  t = await page.evaluate(() => document.querySelector('.cs-set-head').innerText);
  ok('„Seria 1 z 3” i „Zostały 3 serie”', /Seria 1 z 3/.test(t) && /Zostały 3 serie/.test(t), t);
  const fs1 = await page.$eval('.cs-set-no', (e) => parseFloat(getComputedStyle(e).fontSize));
  ok('numer serii większy niż dotąd (≥ 20 px)', fs1 >= 20, String(fs1));

  // ---------- 3. Komunikat po pierwszej serii ----------
  await saveSet(page);
  t = await inner(page);
  ok('po pierwszej serii: „Pierwsza seria za Tobą”', /Pierwsza seria za Tobą/.test(t), t.slice(0, 200));

  // ---------- 2. Przerwa: odliczanie 5 s i opcjonalny sygnał ----------
  const rest = await page.evaluate(() => {
    cwStartRest(60);
    const a = { label: document.querySelector('.cs-rest-lbl') && document.querySelector('.cs-rest-lbl').textContent, finalHidden: document.querySelector('[data-cs-rest-final]').hidden, num: document.getElementById('cw-rest-num').textContent };
    clearInterval(window._cwRestTimer); window._cwRestTimer = null;
    return a;
  });
  ok('przerwa: „Do końca przerwy” i pozostały czas', /Do końca przerwy/.test(rest.label || '') && /1:00|60/.test(rest.num) && rest.finalHidden, JSON.stringify(rest));
  const fin = await page.evaluate(async () => {
    cwStartRest(4); // ostatnie sekundy
    await new Promise((r) => setTimeout(r, 1150));
    const el = document.querySelector('[data-cs-rest-final]');
    return { hidden: el.hidden, digit: el.textContent, ready: !document.querySelector('[data-cs-rest-ready]').hidden };
  });
  ok('ostatnie 5 s: duża cyfra odliczania i „Przygotuj się do serii”', !fin.hidden && /^[1-5]$/.test(fin.digit) && fin.ready, JSON.stringify(fin));
  await page.waitForTimeout(3600);
  ok('koniec przerwy: wibracja przy włączonym sygnale (domyślnie)', await page.evaluate(() => window._vib.length > 0 && window._cw.phase === 'exercise'));
  await page.evaluate(() => { window._vib = []; cwStartRest(30); });
  await page.click('[data-cs-rest-signal]');
  ok('przełącznik: „Dźwięk i wibracja: wyłączone” zapamiętany', await page.evaluate(() => /wyłączone/.test(document.querySelector('[data-cs-rest-signal]').textContent) && localStorage.getItem('pl_cw_rest_signal_v1') === '0'));
  const sigH = await page.$eval('[data-cs-rest-signal]', (e) => e.getBoundingClientRect().height);
  ok('przełącznik sygnału ≥ 44 px', sigH >= 44, String(sigH));
  await page.evaluate(async () => { clearInterval(window._cwRestTimer); window._cwRestTimer = null; cwStartRest(1); await new Promise((r) => setTimeout(r, 1300)); });
  ok('wyłączony sygnał: koniec przerwy bez wibracji', await page.evaluate(() => window._vib.length === 0 && window._cw.phase === 'exercise'));
  await page.evaluate(() => localStorage.setItem('pl_cw_rest_signal_v1', '1'));

  // ---------- 1/3. Ostatnia seria ----------
  await saveSet(page);
  t = await page.evaluate(() => document.querySelector('.cs-set-head').innerText + ' || ' + ((document.querySelector('[data-cs-cheer]') || {}).textContent || ''));
  ok('przed ostatnią serią: „Ostatnia seria · po niej przerwa i kolejne ćwiczenie” i komunikat raz', /Seria 3 z 3/.test(t) && /Ostatnia seria · po niej przerwa i kolejne ćwiczenie/.test(t) && /Została ostatnia seria/.test(t), t);
  await saveSet(page);
  t = await page.evaluate(() => (document.querySelector('[data-cs-cheer]') || {}).textContent || '');
  ok('po ćwiczeniu bez kamienia milowego: „Zrobione — przejdź do kolejnego ćwiczenia”', /Zrobione — przejdź do kolejnego ćwiczenia/.test(t), t);
  // Drugie ćwiczenie (2 serie): po nim zostają 2 ćwiczenia
  await page.evaluate(() => cwNextEx());
  await saveSet(page); await saveSet(page);
  t = await page.evaluate(() => (document.querySelector('[data-cs-cheer]') || {}).textContent || '');
  ok('„Jeszcze 2 ćwiczenia do końca”', /Jeszcze 2 ćwiczenia do końca/.test(t), t);
  const once = await page.evaluate(() => { const c = window._cw; return csCheer(c, c.exIdx); });
  ok('ten sam kamień milowy nie powtarza się', !/Jeszcze 2 ćwiczenia/.test(once), once);

  // ---------- 5. Podsumowanie ----------
  await page.evaluate(() => cwEndWorkout());
  t = await inner(page);
  ok('niewykonane serie: najpierw pytanie „Zakończyć trening?”', /Zakończyć trening\?/.test(t) && /Zakończ teraz/.test(t));
  await page.click('text=Zakończ teraz');
  await page.waitForSelector('.cs-sum');
  t = await inner(page);
  ok('podsumowanie: ćwiczenia, serie, czas', /Trening zrobiony!/.test(t) && /2 z 4\s*ćwiczeń/.test(t) && /5\s*serii/.test(t) && /czas/.test(t) && /Wyciskanie hantli\s*3 z 3 serii/.test(t) && /Przysiad goblet\s*nie wykonano/.test(t), t.slice(0, 500));
  ok('podsumowanie: rozgrzewka i opcjonalne samopoczucie + komentarz', /Rozgrzewka: zrobione 1 z 2/.test(t) && /Jak się czułeś na treningu\?/.test(t) && /Komentarz dla trenera/.test(t));
  ok('podsumowanie: jedna główna akcja', await page.locator('.cs-ex-foot .cs-btn-primary').count() === 1 && /Zapisz i wyślij do trenera/.test(t));
  await page.click('[data-cs-feel="4"]');
  await page.fill('.cs-sum-note textarea', 'Bark bez bólu');
  ok('samopoczucie wybrane (feedback 4)', await page.evaluate(() => window._cw.feel === 4 && cwBuildRecord(window._cw, 'partial').feedback === 4));

  // ---------- 6. Wysyłka i status ----------
  await page.click('[data-cs-primary="finish"]');
  await page.waitForSelector('.cs-done');
  await page.waitForSelector('[data-cs-done-notice="sent"]');
  t = await inner(page);
  ok('status: trening zsynchronizowany, trener dostał informację w czacie', /zsynchronizowany/.test(t) && /Trener dostał informację w aplikacji/.test(t), t);
  ok('status: bez obietnicy push — tylko gdy trener włączył; WhatsApp nie jest używany', /Powiadomienie na telefon dostanie tylko wtedy, gdy włączył je u siebie/.test(t) && /WhatsApp do trenera nie jest używany/.test(t));
  const srv = await page.evaluate(() => { const s = Object.entries(window.__fs).find(([k]) => k.startsWith('sessions/'))[1]; const m = Object.entries(window.__fs).filter(([k]) => k.startsWith('messages/')).map(([, v]) => v); return { status: s.status, feedback: s.feedback, note: s.note, msgs: m.map((x) => x.text) }; });
  ok('serwer: sesja „partial”, samopoczucie i komentarz', srv.status === 'partial' && srv.feedback === 4 && srv.note === 'Bark bez bólu', JSON.stringify(srv));
  ok('serwer: jedna wiadomość dla trenera z podsumowaniem', srv.msgs.length === 1 && /Zrobiłem trening/.test(srv.msgs[0]) && /Serie: 5 z 8/.test(srv.msgs[0]) && /Rozgrzewka: zrobione 1 z 2/.test(srv.msgs[0]) && /Samopoczucie: .* Dobre/.test(srv.msgs[0]) && /Bark bez bólu/.test(srv.msgs[0]), JSON.stringify(srv.msgs));
  await page.click('[data-cs-primary="done"]');
  ok('„Gotowe” zamyka ekran treningu', await page.evaluate(() => document.getElementById('clive-player').hidden === true && !window._cwDone));

  // ---------- 7. Bez sieci: nic nie ginie ----------
  await boot(page, { warmup: true });
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-wu');
  await page.click('text=Pomiń rozgrzewkę');
  await page.waitForSelector('.cs-set-head');
  await page.evaluate(() => { window.__offline = true; });
  await saveSet(page);
  await page.evaluate(() => { cwEndWorkout(); });
  await page.click('text=Zakończ teraz');
  await page.waitForSelector('.cs-sum');
  await page.click('[data-cs-primary="finish"]');
  await page.waitForSelector('[data-cs-done-notice="pending"]');
  t = await inner(page);
  ok('offline: trening na telefonie i informacja czeka na sieć (bez „wysłano”)', /zapisany na telefonie/.test(t) && /czeka na połączenie/.test(t) && !/Trener dostał informację/.test(t) && !/Wysłano/.test(t), t);
  const pend = await page.evaluate(() => ({ outbox: csOutboxRead().length, draft: !!localStorage.getItem(cwDraftKey()), msgs: Object.keys(window.__fs).filter((k) => k.startsWith('messages/')).length }));
  ok('offline: wiadomość w kolejce telefonu, szkic treningu zachowany, nic nie wysłane', pend.outbox === 1 && pend.draft && pend.msgs === 0, JSON.stringify(pend));
  const skipLog = await page.evaluate(() => JSON.parse(localStorage.getItem(cwDraftKey())).state.warmupLog);
  ok('pominięta rozgrzewka zapisana jako „skipped”', skipLog && skipLog.skipped === true, JSON.stringify(skipLog));
  await page.evaluate(async () => { window.__offline = false; await cwFlushLocal(); window.dispatchEvent(new Event('online')); await new Promise((r) => setTimeout(r, 300)); });
  await page.waitForSelector('[data-cs-done-notice="sent"]');
  const after = await page.evaluate(() => ({ outbox: csOutboxRead().length, msgs: Object.keys(window.__fs).filter((k) => k.startsWith('messages/')).length, sess: Object.values(window.__fs).filter((v) => v.source === 'client').map((v) => v.status) }));
  ok('po powrocie sieci: ekran pokazuje „zsynchronizowany”', /zsynchronizowany/.test(await inner(page)));
  ok('po powrocie sieci: trening i jedna wiadomość wysłane, kolejka pusta', after.outbox === 0 && after.msgs === 1 && after.sess.join() === 'partial', JSON.stringify(after));
  await page.evaluate(async () => { await csOutboxFlush(); window.dispatchEvent(new Event('online')); await new Promise((r) => setTimeout(r, 200)); });
  ok('ponowna próba nie tworzy duplikatu wiadomości', await page.evaluate(() => Object.keys(window.__fs).filter((k) => k.startsWith('messages/')).length === 1));

  // ---------- 4. Edytor trenera ----------
  await page.evaluate(() => {
    window._clientAppMode = false; window._uid = 'cs-trainer';
    document.body.insertAdjacentHTML('beforeend', '<div id="wu-test-host" style="position:fixed;inset:0;overflow:auto;z-index:99999;background:#fff;padding:12px"></div>');
    window.EX = [{ name: 'Moja aktywacja pośladków', cat: 'Pośladki' }];
    document.getElementById('wu-test-host').innerHTML = wuCardHTML(window.CL[0]);
  });
  await page.evaluate(() => { window.CL[0].warmup = null; document.getElementById('wu-test-host').innerHTML = wuCardHTML(window.CL[0]); });
  await page.click('[data-act="wu-edit"]');
  t = await page.evaluate(() => document.getElementById('wu-card').innerText);
  ok('edytor: zapisane ograniczenia klienta widoczne, bez diagnozy', /Zapisane ograniczenia klienta:\s*Ból barku/.test(t) && /Ocena, czy ćwiczenie jest odpowiednie, należy do Ciebie/.test(t), t.slice(0, 300));
  await page.fill('#wu-q', 'ramion');
  await page.waitForTimeout(100);
  t = await page.evaluate(() => document.getElementById('wu-results').innerText);
  ok('edytor: szukanie w bibliotece trenera; oznaczenie „sprawdź” przy ćwiczeniu barku', /ramion/i.test(t) && /⚠ sprawdź/.test(t), t.slice(0, 300));
  await page.click('#wu-results [data-act="wu-add"]:not([disabled])');
  await page.fill('[data-wu-dose="0"]', '2 × 10');
  await page.click('[data-act="wu-save"]');
  await page.waitForTimeout(200);
  const saved = await page.evaluate(() => window.__fs['clients/c1'] && window.__fs['clients/c1'].warmup);
  ok('edytor: rozgrzewka zapisana na karcie klienta (nazwa z biblioteki + ilość)', saved && saved.items.length === 1 && saved.items[0].dose === '2 × 10' && /ramion/i.test(saved.items[0].name), JSON.stringify(saved));
  ok('edytor: nazwa z bazy nie trafia do onclick (data-act)', await page.evaluate(() => !document.getElementById('wu-card').innerHTML.includes('onclick')));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Trening klienta: seria, przerwa, motywacja, rozgrzewka, podsumowanie, informacja dla trenera — OK');
})().catch((e) => { console.error(e); process.exit(1); });
