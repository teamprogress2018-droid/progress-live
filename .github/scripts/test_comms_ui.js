// Komunikacja w aplikacji (390 × 844 i panel trenera): kafelek spotkania nad pakietem bez ćwiczeń,
// potwierdzenie, prośba o zmianę, samopoczucie, zapas przez czat bez reguł, ekran Powiadomienia,
// „Do odpowiedzi” ze statusami, odwołanie spotkania, panel z symulacją. Nic nie jest wysyłane.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const shotDir = process.env.CLIENT_SIMPLE_SHOT_DIR || path.join(require('os').tmpdir(), 'pl-comms');
fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=comms';

async function clientPage(browser, rulesOk) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(rulesOk => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'comms' };
    window.persistById = async (_c, o) => o; window.notify = t => { window.__toasts = (window.__toasts || []).concat(t); };
    window.__writes = []; window.__chat = [];
    window._doc = (db, col, id) => ({ col, id });
    window._setDoc = async (ref, data) => { if (!rulesOk && /^comms/.test(ref.col)) throw new Error('permission-denied'); window.__writes.push([ref.col, data]); };
    window.pushClientMsg = async text => { window.__chat.push(text); return true; };
    try { localStorage.clear(); } catch (e) {}
    const today = todayYmd(); const tomorrow = CommsCore.addDaysYmd(today, 1);
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Piotr Urbaniak', status: 'active' }];
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: today,
      days: [{ day: 'Dzień 1 — Barki i klatka', muscles: 'Barki, klatka', exercises: [{ name: 'Wyciskanie hantli', sets: '3', reps: '10', kg: '20' }] }] }];
    window.SE = [{ id: 'sess1', clientId: 'c1', trainerId: 'cs-trainer', date: tomorrow, time: '18:00', type: 'Trening personalny — barki', source: 'planned', notes: 'Barki i klatka' }];
    window.PACKAGES = [{ id: 'pk1', clientId: 'c1', trainerId: 'cs-trainer', title: 'Pakiet 8 treningów', payStatus: 'pending', price: 800 }];
    window.TASKS = []; window.MSGS = { c1: [] };
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    window.COMMS.cases = []; window.COMMS.prefs = {};
    enterClientLiveShell();
  }, rulesOk);
  await page.waitForSelector('.cs-today');
  return { ctx, page, errors };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // ---------- klient: reguły opublikowane ----------
    let { ctx, page, errors } = await clientPage(browser, true);
    let v = await page.evaluate(() => {
      const meet = document.querySelector('.cs-meet'), pay = document.querySelector('.cs-pay');
      const btns = [...document.querySelectorAll('.cs-meet-acts button')];
      return { meet: !!meet, above: !!(meet && pay && (meet.compareDocumentPosition(pay) & Node.DOCUMENT_POSITION_FOLLOWING)),
        text: meet ? meet.innerText : '', btns: btns.map(b => b.innerText.trim()), h: btns.map(b => b.getBoundingClientRect().height),
        overflow: document.documentElement.scrollWidth > innerWidth + 1, feel: !!document.querySelector('.comms-feel-link') };
    });
    await page.screenshot({ path: path.join(shotDir, 'comms_today_390.png'), fullPage: true });
    ok('kafelek „Spotkanie z trenerem” nad pakietem', v.meet && v.above, JSON.stringify(v).slice(0, 200));
    ok('kafelek: termin i status „Czeka na potwierdzenie”', /Jutro/.test(v.text) && /18:00/.test(v.text) && /Czeka na potwierdzenie/.test(v.text), v.text);
    ok('kafelek bez ćwiczeń i partii (barki, klatka)', !/bark|klatk|wyciskan|ćwicz/i.test(v.text), v.text);
    ok('działania: Potwierdzam, Poproś o zmianę, Napisz do trenera', v.btns.join('|') === 'Potwierdzam|Poproś o zmianę|Napisz do trenera', v.btns.join('|'));
    ok('przyciski co najmniej 44 px', v.h.every(h => h >= 44), v.h.join(','));
    ok('bez przewijania w poziomie', !v.overflow);
    ok('link „Zgłoś samopoczucie lub trudność”', v.feel);

    await page.tap('.cs-meet-acts [data-act="comms-confirm"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => ({ w: window.__writes, text: document.querySelector('.cs-meet').innerText, btns: [...document.querySelectorAll('.cs-meet-acts button')].map(b => b.innerText.trim()) }));
    const conf = v.w.find(x => x[0] === 'commsCases');
    ok('potwierdzenie zapisane jako sprawa (zakończona, z odciskiem terminu)', conf && conf[1].type === 'meeting_confirm' && conf[1].status === 'done' && conf[1].sessionId === 'sess1' && /T18:00$/.test(conf[1].sessionStamp), JSON.stringify(v.w));
    ok('po potwierdzeniu: status „Potwierdzone”, bez przycisku Potwierdzam', /Potwierdzone/.test(v.text) && !v.btns.includes('Potwierdzam'), v.text);

    await page.tap('.cs-meet-acts [data-act="comms-change"]');
    await page.waitForSelector('#comms-sheet');
    await page.tap('#comms-sheet .comms-opt >> nth=1');
    await page.fill('#comms-change-text', 'czwartek po 17');
    await page.screenshot({ path: path.join(shotDir, 'comms_change_390.png') });
    await page.tap('#comms-sheet [data-act="comms-send-change"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => ({ w: window.__writes.filter(x => x[1].type === 'meeting_change'), text: document.querySelector('.cs-meet').innerText, sheet: !!document.getElementById('comms-sheet') }));
    ok('prośba o zmianę: powód i tekst, status „nowa”', v.w.length === 1 && v.w[0][1].reason === 'Inna godzina' && v.w[0][1].text === 'czwartek po 17' && v.w[0][1].status === 'new', JSON.stringify(v.w));
    ok('po prośbie: „Prośba o zmianę wysłana”, arkusz zamknięty', /Prośba o zmianę wysłana/.test(v.text) && !v.sheet, v.text);

    await page.tap('.comms-feel-link');
    await page.waitForSelector('#comms-sheet');
    await page.tap('#comms-sheet .comms-opt >> nth=2');
    await page.tap('#comms-sheet [data-act="comms-send-feel"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => window.__writes.filter(x => x[1].type === 'wellbeing'));
    ok('samopoczucie: zgłoszenie „bol” jako sprawa', v.length === 1 && v[0][1].mood === 'bol' && v[0][1].status === 'new', JSON.stringify(v));

    // Ekran Powiadomienia.
    await page.evaluate(() => setClientLiveScreen('notify'));
    await page.waitForSelector('.comms-notify');
    v = await page.evaluate(() => ({ t: document.querySelector('.comms-notify').innerText, overflow: document.documentElement.scrollWidth > innerWidth + 1,
      radios: document.querySelectorAll('.comms-notify input[name=comms-ch]').length }));
    await page.screenshot({ path: path.join(shotDir, 'comms_notify_390.png'), fullPage: true });
    ok('Powiadomienia: wybór jednego sposobu kontaktu (3 opcje)', v.radios === 3 && /nie wysyłamy jej naraz wszędzie/.test(v.t));
    ok('Powiadomienia: uczciwa informacja o serwerze', /nie jest jeszcze uruchomiona/.test(v.t));
    ok('Powiadomienia: WhatsApp nie jest przedstawiany jako działający', /Wysyłka przez WhatsApp nie jest jeszcze uruchomiona/.test(v.t), v.t.slice(0, 300));
    ok('Powiadomienia: bez przewijania w poziomie', !v.overflow);
    await page.fill('#comms-wa-phone', '600 100 200');
    await page.tap('[data-act="comms-wa-on"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => window.__writes.filter(x => x[0] === 'commsPrefs').slice(-1)[0]);
    ok('zgoda WhatsApp: numer z +48, data zgody, treść zgody', v && v[1].channel === 'whatsapp' && v[1].whatsapp.phone === '48600100200' && v[1].whatsapp.optIn === true && /Progress Studio/.test(v[1].whatsapp.consentText) && v[1].whatsapp.optInAt, JSON.stringify(v));
    await page.tap('[data-act="comms-wa-off"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => window.__writes.filter(x => x[0] === 'commsPrefs').slice(-1)[0][1]);
    ok('wycofanie zgody WhatsApp', v.whatsapp.optIn === false && v.whatsapp.optOutAt && v.channel !== 'whatsapp', JSON.stringify(v));
    ok('bez błędów JS (klient)', !errors.length, errors.join(' | '));
    await ctx.close();

    // ---------- klient: reguły jeszcze nieopublikowane → zapas przez czat ----------
    ({ ctx, page, errors } = await clientPage(browser, false));
    await page.tap('.cs-meet-acts [data-act="comms-confirm"]');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => window.__chat);
    ok('bez reguł: potwierdzenie idzie zwykłą wiadomością czatu ze znacznikiem', v.length === 1 && /^✅ Potwierdzam spotkanie/.test(v[0]) && /\[spotkanie:potwierdzam:sess1:\d{4}-\d\d-\d\dT18:00\]$/.test(v[0]), JSON.stringify(v));
    await ctx.close();

    // ---------- trener ----------
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await ctx.newPage(); page.setDefaultTimeout(20000);
    const terr = []; page.on('pageerror', e => terr.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
    await page.goto(URL, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
    await page.evaluate(() => {
      window._uid = 't1'; window._db = null; window.__saved = [];
      window.persistById = async (c, o) => { window.__saved.push([c, JSON.parse(JSON.stringify(o))]); return o; };
      window.persistSettingsDoc = async () => true;
      document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app-root').style.display = '';
      const tomorrow = CommsCore.addDaysYmd(todayYmd(), 1);
      window.CL = [{ id: 'c1', name: 'Anna Nowak', status: 'active' }, { id: 'c2', name: 'Jan Kowal', status: 'active' }];
      window.SE = [{ id: 'sess1', clientId: 'c1', trainerId: 't1', date: tomorrow, time: '18:00', type: 'Trening personalny', source: 'planned', duration: 60 }];
      window.PL = [];
      const ts = new Date(Date.now() - 3600000).toISOString();
      window.MSGS = { c1: [{ id: 'm1', clientId: 'c1', out: false, text: '🔁 Proszę o zmianę terminu — Inny dzień [spotkanie:zmiana:sess1:' + tomorrow + 'T18:00]', createdAt: ts }],
        c2: [{ id: 'm2', clientId: 'c2', out: true, text: 'Hej', createdAt: ts }, { id: 'm3', clientId: 'c2', out: false, text: 'Mam pytanie o dietę', createdAt: new Date().toISOString() }] };
      window.COMMS.cases = [{ id: 'cc1', clientId: 'c1', trainerId: 't1', type: 'wellbeing', mood: 'zmeczenie', text: 'Słabo spałem', status: 'new', source: 'app', createdAt: ts },
        { id: 'cc2', clientId: 'c1', trainerId: 't1', type: 'meeting_confirm', sessionId: 'sess1', sessionStamp: 'x', status: 'done', source: 'app', createdAt: ts }];
      window.COMMS.rulesOk = true;
      goTo('inbox'); setInboxTab('replies');
    });
    await page.waitForSelector('.rep-item');
    v = await page.evaluate(() => ({ items: [...document.querySelectorAll('.rep-item')].map(e => e.innerText.replace(/\s+/g, ' ')), badge: document.getElementById('itab-replies-n').textContent }));
    await page.screenshot({ path: path.join(shotDir, 'comms_replies.png') });
    ok('Do odpowiedzi: prośba o zmianę z czatu, samopoczucie, wiadomość bez odpowiedzi', v.items.length === 3 && v.items.some(t => /Prośba o zmianę/.test(t)) && v.items.some(t => /Samopoczucie/.test(t)) && v.items.some(t => /Mam pytanie o dietę/.test(t)), JSON.stringify(v.items));
    ok('Do odpowiedzi: potwierdzenia nie wymagają odpowiedzi', !v.items.some(t => /Potwierdzenie spotkania/.test(t)));
    ok('Do odpowiedzi: licznik otwartych spraw', v.badge === '3', v.badge);
    ok('statusy widoczne (Nowa)', v.items.every(t => /Nowa/.test(t)));
    await page.click('.rep-item [data-act="rep-status"][data-s="in_progress"] >> nth=0');
    await page.waitForTimeout(150);
    v = await page.evaluate(() => window.__saved.filter(x => x[0] === 'commsCases').slice(-1)[0]);
    ok('trener zmienia status → zapis sprawy „W trakcie”', v && v[1].status === 'in_progress', JSON.stringify(v));
    await page.click('.rep-item [data-act="rep-status"][data-s="done"] >> nth=0');
    await page.waitForTimeout(150);
    v = await page.evaluate(() => document.querySelectorAll('.rep-item').length);
    ok('zakończona sprawa znika z otwartych', v === 2, String(v));

    // Okno spotkania: status od klienta, odwołanie.
    await page.evaluate(() => { window.COMMS.cases.push({ id: 'cc3', clientId: 'c1', type: 'meeting_confirm', sessionId: 'sess1', sessionStamp: CommsCore.stampOf(window.SE[0]), status: 'done', createdAt: new Date().toISOString() }); editSession('sess1'); });
    await page.waitForSelector('#m-session.show');
    v = await page.evaluate(() => ({ line: document.getElementById('as-comms-status').innerText, cancel: getComputedStyle(document.getElementById('as-cancel-btn')).display }));
    ok('okno spotkania: „Potwierdzone” od klienta', /Potwierdzone/.test(v.line), v.line);
    ok('okno spotkania: przycisk „Odwołaj spotkanie”', v.cancel !== 'none');
    await page.click('#as-cancel-btn');
    await page.waitForTimeout(200);
    v = await page.evaluate(() => ({ s: window.SE[0], saved: window.__saved.filter(x => x[0] === 'sessions').slice(-1)[0] }));
    ok('odwołanie: status i znacznik zmiany zapisane (serwer anuluje przypomnienie)', v.s.status === 'cancelled' && v.s.changedAt && v.saved && v.saved[1].status === 'cancelled', JSON.stringify(v.s));

    // Zmiana terminu zapisuje changedAt.
    await page.evaluate(() => { window.SE.push({ id: 'sess2', clientId: 'c1', trainerId: 't1', date: CommsCore.addDaysYmd(todayYmd(), 2), time: '10:00', type: 'Trening personalny', source: 'planned', duration: 60 }); editSession('sess2'); document.getElementById('as-time').value = '11:30'; });
    await page.evaluate(() => saveSess());
    await page.waitForTimeout(200);
    v = await page.evaluate(() => window.SE.find(s => s.id === 'sess2'));
    ok('zmiana godziny: changedAt i poprzedni termin', v.time === '11:30' && v.changedAt && /T10:00$/.test(v.prevAt), JSON.stringify(v));

    // Panel: symulacja wyraźnie oznaczona, brak fałszywych „wysłanych”.
    await page.evaluate(() => openCommsPanel());
    await page.waitForSelector('#m-comms.show');
    v = await page.evaluate(() => document.getElementById('m-comms').innerText);
    await page.screenshot({ path: path.join(shotDir, 'comms_panel.png') });
    ok('panel: podgląd opisany jako niewysyłany z przeglądarki', /PODGLĄD — przeglądarka niczego nie wysyła/.test(v));
    ok('panel: bez stanu serwera oba kanały „Serwer nie jest uruchomiony”', /Powiadomienia push: Serwer nie jest uruchomiony/.test(v) && /WhatsApp: Serwer nie jest uruchomiony/.test(v) && /jeszcze nie uruchomiona/.test(v), v.slice(0, 400));
    // Pusta kolejka z opublikowanych reguł NIE oznacza, że serwer działa.
    v = await page.evaluate(() => { window.COMMS.jobs = []; window.COMMS.status = null; openCommsPanel(); return document.getElementById('m-comms').innerText; });
    ok('panel: pusta kolejka bez stanu serwera nie udaje działania', /jeszcze nie uruchomiona/.test(v) && !/Działa/.test(v), v.slice(0, 300));
    // Stan z serwera: WhatsApp działa, push wymaga konfiguracji (nazwy brakujących ustawień, bez wartości).
    v = await page.evaluate(() => { window.COMMS.status = { lastRunAt: new Date().toISOString(), live: true,
      channels: { push: { mode: 'needs_config', missing: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'] }, whatsapp: { mode: 'live', missing: [] } } };
      openCommsPanel(); const m = document.getElementById('m-comms');
      return { t: m.innerText, push: m.querySelector('[data-comms-ch="push"]').dataset.state, wa: m.querySelector('[data-comms-ch="whatsapp"]').dataset.state }; });
    ok('panel: WhatsApp „Działa”, push „Wymaga konfiguracji” z nazwami ustawień', v.wa === 'live' && v.push === 'needs_config' && /brakuje: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY/.test(v.t) && /Wysyłka po zamknięciu aplikacji: działa/.test(v.t), JSON.stringify(v).slice(0, 300));
    v = await page.evaluate(() => { window.COMMS.status = { lastRunAt: new Date().toISOString(), live: false,
      channels: { push: { mode: 'simulation' }, whatsapp: { mode: 'simulation' } } }; openCommsPanel(); return document.getElementById('m-comms').innerText; });
    ok('panel: tryb symulacji serwera wyraźnie opisany', /pracuje, ale nic nie wysyła/.test(v) && /Symulacja — nic nie jest wysyłane/.test(v), v.slice(0, 300));
    v = await page.evaluate(() => { window.COMMS.status = { lastRunAt: new Date(Date.now() - 3 * 3600e3).toISOString(), live: true,
      channels: { push: { mode: 'live' }, whatsapp: { mode: 'live' } } }; openCommsPanel(); return document.getElementById('m-comms').innerText; });
    ok('panel: stary stan (3 godz.) = serwer nie jest uruchomiony', /WhatsApp: Serwer nie jest uruchomiony/.test(v) && !/Wysyłka po zamknięciu aplikacji: działa/.test(v), v.slice(0, 300));
    await page.evaluate(() => { window.COMMS.status = null; window.COMMS.jobs = null; openCommsPanel(); });
    ok('panel: przypomnienie dzień przed w podglądzie', /Przypomnienie dzień przed spotkaniem/.test(v));
    ok('panel: brak historii wysyłki bez serwera', /serwer nie wysyła jeszcze wiadomości/.test(v));
    ok('panel: klient bez wyboru = tylko w aplikacji', /nie wybrał\(a\) — tylko w aplikacji/.test(v));
    await page.click('#m-comms [data-cfg="weeklySummary.on"]');
    await page.click('#m-comms [data-act="comms-save-cfg"]');
    await page.waitForTimeout(150);
    v = await page.evaluate(() => window.SETTINGS.comms);
    ok('panel: zapis ustawień (E włączone, czas włączenia)', v && v.weeklySummary.on === true && v.enabledAt, JSON.stringify(v).slice(0, 200));
    ok('bez błędów JS (trener)', !terr.length, terr.join(' | '));
    await ctx.close();
  } finally { await browser.close(); }
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Wszystkie testy UI komunikacji przeszły.');
})().catch(e => { console.error(e); process.exit(1); });
