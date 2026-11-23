#!/usr/bin/env node
'use strict';
/**
 * Motywacja klienta (390 × 844, Chromium, ATRAPA Firestore — bez prawdziwych danych):
 * 1) postęp w podsumowaniu: porównanie z poprzednim razem (+kg, +powtórzenia przy tym samym ciężarze) i trening w miesiącu,
 * 2) pochwała od trenera: szybkie reakcje / własne zdanie w oknie treningu i w czacie; klient widzi ją na „Dzisiaj” i w historii,
 * 3) powrót bez wyrzutów: „Nie udało się wczoraj?” z „Zrób trening dziś” zamiast „pominięty”.
 */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}
const URL = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=client-motivation';

async function boot(page, o = {}) {
  await page.goto('about:blank');
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate((o) => {
    try { localStorage.clear(); } catch (e) {}
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window._db = { fixture: 'motivation' };
    window._notes = []; window.notify = (m) => window._notes.push(m);
    const fs = {}; window.__fs = fs;
    window._doc = (_db, col, id) => ({ col, id });
    window._getDoc = async (ref) => { const d = fs[ref.col + '/' + ref.id]; return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)) }; };
    window.persistById = async (col, obj) => { const c = JSON.parse(JSON.stringify(obj)); delete c._fbId; fs[col + '/' + obj.id] = c; return obj; };
    const today = todayYmd();
    const add = (y, n) => { const d = new Date(y + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const dow = (y) => new Date(y + 'T12:00:00').getDay();
    // Harmonogram: wczoraj tak, dziś nie (dzień regeneracji po opuszczonym treningu) albo dziś tak.
    const wds = o.missed ? [dow(add(today, -1))] : [dow(today)];
    window.CL = [{ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', status: 'active', preferredWeekdays: wds }];
    const ex = (n, s, r, kg) => ({ name: n, sets: String(s), reps: String(r), kg: String(kg), rest: '90s' });
    window.PL = [{ id: 'p1', clientId: 'c1', trainerId: 'cs-trainer', name: 'Full Body', weekKeys: ['w1'], currentWeek: 'w1', startDate: add(today, -30),
      days: [{ day: 'Dzień 1', exercises: [ex('Wyciskanie hantli', 2, 10, 20), ex('Wiosłowanie', 2, 12, 18)] }] }];
    const prevDate = o.missed ? add(today, -6) : add(today, -3);
    window.SE = [{ id: 's_prev', clientId: 'c1', trainerId: 'cs-trainer', source: 'client', status: 'completed', date: prevDate, planId: 'p1', dayIdx: 0, type: 'Dzień 1',
      exercises: [{ name: 'Wyciskanie hantli', sets: [{ setNo: 1, kg: '20', reps: '10', kind: 'work' }, { setNo: 2, kg: '20', reps: '10', kind: 'work' }] },
                  { name: 'Wiosłowanie', sets: [{ setNo: 1, kg: '16', reps: '12', kind: 'work' }, { setNo: 2, kg: '16', reps: '12', kind: 'work' }] }] }];
    Object.keys(window.MSGS).forEach((k) => { delete window.MSGS[k]; });
    window.MSGS.c1 = (o.praise ? [{ id: 'm_pr', clientId: 'c1', out: true, kind: 'direct', text: '👏 Dobra robota!', praiseFor: 's_prev', createdAt: new Date().toISOString() }] : []);
    window.TASKS = []; window.PACKAGES = []; window.METRIC_ENTRIES = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    enterClientLiveShell();
  }, o);
  await page.waitForSelector('.cs-today');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));

  // ---------- 1. Postęp w podsumowaniu ----------
  await boot(page, { praise: true });
  let t = await page.evaluate(() => document.querySelector('.cs-today').innerText);
  ok('„Dzisiaj”: pochwała trenera z ostatnich dni', /TRENER O TWOIM TRENINGU/i.test(t) && /Dobra robota!/.test(t) && /Odpowiedz trenerowi/.test(t), t.slice(0, 300));
  await page.click('.cs-today .cs-btn-primary');
  await page.waitForSelector('.cs-set-head');
  await page.evaluate(() => {
    const c = window._cw;
    c.exercises[0].sets.forEach((s) => { s.reps = '12'; s.kg = '20'; s.done = true; });
    c.exercises[1].sets.forEach((s) => { s.reps = '12'; s.kg = '18'; s.done = true; });
    c.elapsed = 1500; c.phase = 'finish'; c.finishPrompt = false; cwRender();
  });
  await page.waitForSelector('.cs-sum');
  t = await page.evaluate(() => (document.querySelector('[data-cs-progress]') || {}).innerText || '');
  ok('postęp: +kg względem poprzedniego razu', /Wiosłowanie: \+2 kg \(18 kg × 12\)/.test(t), t);
  ok('postęp: +powtórzenia przy tym samym ciężarze', /Wyciskanie hantli: \+2 powtórzenia przy tym samym ciężarze/.test(t), t);
  ok('postęp: trening w tym miesiącu (liczony z danych)', /To Twój \d+\. trening w tym miesiącu\./.test(t), t);
  const facts = await page.evaluate(() => csProgressFacts(window._cw).length);
  ok('postęp: najwyżej 3 zdania', facts <= 3, String(facts));
  const notice = await page.evaluate(() => csTrainerNoticeText(window._cw));
  ok('informacja dla trenera zawiera postęp (bez licznika miesiąca)', /Postęp: Wiosłowanie: \+2 kg/.test(notice) && !/w tym miesiącu/.test(notice), notice);
  const noPrev = await page.evaluate(() => { const c = window._cw; const keep = c.exercises.map((e) => e.lastSets); c.exercises.forEach((e) => { e.lastSets = []; }); const r = csProgressFacts(c); c.exercises.forEach((e, i) => { e.lastSets = keep[i]; }); return r; });
  ok('postęp: bez poprzedniego wyniku nic nie zmyślamy (tylko licznik miesiąca)', noPrev.length === 1 && /w tym miesiącu/.test(noPrev[0]), JSON.stringify(noPrev));

  // ---------- 2. Pochwała: historia klienta ----------
  const hist = await page.evaluate(() => praiseClientSessionHTML(window.SE.find((s) => s.id === 's_prev')));
  ok('historia treningu: pochwała przy treningu', /OD TRENERA/.test(hist) && /Dobra robota!/.test(hist), hist);

  // ---------- 2. Pochwała: trener ----------
  await page.evaluate(() => {
    window._clientAppMode = false; window._uid = 'cs-trainer';
    window.MSGS.c1 = [{ id: 'msg_s_new', clientId: 'c1', out: false, kind: 'direct', text: 'Zrobiłem trening: Dzień 1\nSerie: 4 z 4', createdAt: new Date().toISOString() }];
    window.SE.push({ id: 's_new', clientId: 'c1', trainerId: 'cs-trainer', source: 'client', status: 'completed', date: todayYmd(), exercises: [] });
    document.body.insertAdjacentHTML('beforeend', '<div id="pr-host" style="position:fixed;inset:0;overflow:auto;z-index:99999;background:#fff;padding:12px"><div id="pr-chat"></div><div id="pr-modal"></div></div>');
    document.getElementById('pr-chat').innerHTML = praiseChatBlockHTML(window.MSGS.c1[0], 'c1');
  });
  t = await page.evaluate(() => document.getElementById('pr-chat').innerText);
  ok('czat trenera: szybkie reakcje pod „Zrobiłem trening”', /Dobra robota!/.test(t) && /Brawo za regularność/.test(t) && await page.locator('#pr-chat .pr-own input').count() === 1, t);
  ok('czat: klucz pochwały = id treningu z wiadomości', await page.evaluate(() => praiseKeyForMsg(window.MSGS.c1[0]) === 's_new'));
  await page.fill('#pr-chat .pr-own input', 'Poprawiłaś technikę w przysiadzie');
  await page.click('#pr-chat [data-act="praise-own"]');
  await page.waitForTimeout(150);
  const sent = await page.evaluate(() => ({ msg: window.MSGS.c1.find((m) => m.out), srv: Object.values(window.__fs).filter((v) => v.out === true) }));
  ok('własna pochwała wysłana jako wiadomość trenera z praiseFor', sent.msg && sent.msg.text === 'Poprawiłaś technikę w przysiadzie' && sent.msg.praiseFor === 's_new' && sent.srv.length === 1 && sent.srv[0].praiseFor === 's_new', JSON.stringify(sent));
  const after = await page.evaluate(() => ({ chat: praiseChatBlockHTML(window.MSGS.c1[0], 'c1'), modal: praiseTrainerBlockHTML(window.SE.find((s) => s.id === 's_new')) }));
  ok('po wysłaniu: bez ponownych przycisków, okno treningu pokazuje „Twoja pochwała”', /Pochwała wysłana/.test(after.chat) && !/data-act/.test(after.chat) && /Twoja pochwała: „Poprawiłaś technikę w przysiadzie”/.test(after.modal), JSON.stringify(after));
  const dup = await page.evaluate(() => { praiseSend('c1', 's_new', 'Druga'); return window.MSGS.c1.filter((m) => m.out).length; });
  ok('druga pochwała do tego samego treningu się nie dubluje', dup === 1, String(dup));
  await page.evaluate(() => { document.getElementById('pr-modal').innerHTML = praiseTrainerBlockHTML(window.SE.find((s) => s.id === 's_prev')); });
  await page.click('#pr-modal [data-act="praise-send"] >> nth=0');
  ok('okno treningu: szybka reakcja jednym kliknięciem', await page.evaluate(() => window.MSGS.c1.some((m) => m.out && m.praiseFor === 's_prev' && m.text === '👏 Dobra robota!')));
  ok('pochwała z nazwą z bazy: bez onclick (data-act)', await page.evaluate(() => !document.getElementById('pr-host').innerHTML.includes('onclick')));
  ok('wiadomość w trakcie treningu nie dostaje przycisków pochwały', await page.evaluate(() => praiseTrainerBlockHTML({ id: 'x', clientId: 'c1', source: 'client', status: 'in_progress' }) === ''));

  // ---------- 3. Powrót bez wyrzutów ----------
  await boot(page, { missed: true });
  t = await page.evaluate(() => document.querySelector('.cs-today').innerText);
  ok('„Dzisiaj” po opuszczonym treningu: bez wyrzutów, z wyborem', /Nie udało się wczoraj\?/.test(t) && /Nic straconego/.test(t) && /Zrób trening dziś/.test(t) && /Wybierz nowy termin/.test(t) && !/pominię|przerwał/i.test(t), t.slice(0, 400));
  await page.evaluate(() => setClientLiveScreen('plan'));
  await page.waitForTimeout(150);
  t = await page.evaluate(() => document.querySelector('.cs-screen').innerText);
  ok('plan: „nie udało się” zamiast „pominięty” + „Zrób trening dziś”', !/pominięty/.test(t) && /Nie udało się wczoraj\? Możesz zrobić ten trening dziś/.test(t), t.slice(0, 400));
  await page.evaluate(() => setClientLiveScreen('today'));
  await page.waitForSelector('[data-cs-missed]');
  await page.click('[data-cs-missed] .cs-btn-primary');
  await page.waitForSelector('.cs-set-head');
  ok('„Zrób trening dziś” od razu otwiera trening', await page.evaluate(() => !!window._cw && window._cw.phase === 'exercise'));
  await page.evaluate(() => cwClose(true));
  await page.evaluate(() => { window.SE.push({ id: 's_y', clientId: 'c1', source: 'planned', status: 'done', date: (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })() }); setClientLiveScreen('today'); });
  await page.waitForTimeout(150);
  ok('trening z trenerem wczoraj = nic nie jest „opuszczone”', await page.evaluate(() => !document.querySelector('[data-cs-missed]')));

  ok('bez błędów JS', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('Motywacja klienta: postęp, pochwała trenera, powrót bez wyrzutów — OK');
})().catch((e) => { console.error(e); process.exit(1); });
