#!/usr/bin/env node
'use strict';
/**
 * RODO w aplikacji klienta (privacy.js, polityka-prywatnosci.html), atrapa Firebase:
 * rejestracja wymaga akceptacji polityki; konto bez zgód widzi jednorazową bramkę; zgody zapisują się na karcie
 * (`consents`), a bez sieci czekają w telefonie; Profil → Prywatność: zgoda na dane o zdrowiu, „Pobierz moje dane”
 * (tylko dane tego klienta), prośba o usunięcie (wiadomość + powiadomienie dla trenera); zdjęcia sylwetki tylko za zgodą.
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const ORIGIN = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(ORIGIN + '/polityka-prywatnosci.html', { waitUntil: 'domcontentloaded' });
  const pol = await page.evaluate(() => document.body.innerText);
  ok('polityka: administrator, dane o zdrowiu (art. 9), prawa, PUODO', /P&P Progress/.test(pol) && /art\. 9 ust\. 2 lit\. a/.test(pol) && /Twoje prawa/.test(pol) && /Urzędu Ochrony Danych Osobowych/.test(pol));

  await page.goto(ORIGIN + '/index.html?nocache=privacy', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  // Rejestracja: bez zaznaczenia polityki konto nie powstaje.
  const reg = await page.evaluate(async () => {
    let created = 0; window._createUser = async () => { created++; throw new Error('stop'); };
    document.getElementById('auth-reg-token').value = 'tok123';
    document.getElementById('auth-reg-email').value = 'a@b.pl';
    document.getElementById('auth-reg-password').value = 'haslo123';
    document.getElementById('auth-reg-password2').value = 'haslo123';
    await doClientRegister();
    const err = document.getElementById('auth-reg-error').innerText;
    return { created, err, link: document.querySelector('label.pv-reg a').getAttribute('href') };
  });
  ok('rejestracja bez akceptacji polityki: błąd, konto nie powstaje', reg.created === 0 && /polityki prywatności/.test(reg.err) && reg.link === 'polityka-prywatnosci.html', JSON.stringify(reg));

  const boot = (opts) => page.evaluate((opts) => {
    window._uid = 'cs-client'; window._trainerId = 'cs-trainer'; window._clientId = 'c1'; window._clientAppMode = true;
    window.tenantSessionGeneration = 1; window._tenantDataReady = true; window.notify = () => {};
    window._writes = [];
    window._db = {}; window._doc = (_db, col, id) => ({ col, id });
    window._setDoc = async (ref, data, o) => { if (window._failWrites) throw Object.assign(new Error('offline'), { code: 'unavailable' }); window._writes.push({ col: ref.col, id: ref.id, data, merge: !!(o && o.merge) }); };
    try { localStorage.clear(); } catch (e) {}
    window.CL = [Object.assign({ id: 'c1', trainerId: 'cs-trainer', name: 'Anna Nowak', email: 'anna@x.pl', status: 'active' }, opts.consents ? { consents: opts.consents } : {})];
    window.PL = []; window.TASKS = []; window.PACKAGES = []; window.MSGS = { c1: [{ id: 'm1', clientId: 'c1', text: 'Cześć', out: true, createdAt: '2026-11-01' }] };
    window.SE = [{ id: 's1', clientId: 'c1', source: 'client', status: 'completed', date: '2026-11-20', exercises: [{ name: 'Przysiad', sets: [{ kg: 60, reps: 8 }] }] },
      { id: 'x1', clientId: 'other', source: 'client', status: 'completed', date: '2026-11-20', exercises: [{ name: 'Cudzy', sets: [] }] }];
    window.METRIC_ENTRIES = [{ clientId: 'c1', groupId: 'mg1', date: '2026-11-20', values: { m1: '70' } }, { clientId: 'other', groupId: 'mg1', date: '2026-11-20', values: { m1: '99' } }];
    window.PROGRESS_PHOTOS = [];
    window.SETTINGS = { profile: { name: 'Trener' }, brand: {}, clientApp: { visibleSections: {} }, contact: {} };
    document.querySelectorAll('#pv-gate,#pv-del').forEach((n) => n.remove());
    enterClientLiveShell(); privacyGateCheck();
  }, opts);

  // Konto bez zgód: bramka.
  await boot({});
  ok('konto bez zgód: bramka z polityką', await page.isVisible('#pv-gate') && /polityką prywatności/.test(await page.innerText('#pv-gate')));
  await page.tap('#pv-gate .cs-btn-primary');
  ok('bez zaznaczenia: komunikat, bramka zostaje', await page.isVisible('#pv-gate-err') && await page.isVisible('#pv-gate'));
  await page.check('#pv-gate-privacy');
  await page.tap('#pv-gate .cs-btn-primary');
  await page.waitForTimeout(200);
  const g = await page.evaluate(() => ({ gate: !!document.getElementById('pv-gate'), w: window._writes.find((x) => x.col === 'clients'), c: window.CL[0].consents }));
  ok('akceptacja: zapis `consents` na karcie klienta (merge), zgoda na zdrowie = nie', !g.gate && g.w && g.w.id === 'c1' && g.w.merge && g.w.data.consents.privacy.version === PRIVACY_VERSION_T() && g.w.data.consents.health.granted === false && Object.keys(g.w.data).join() === 'consents', JSON.stringify(g));
  function PRIVACY_VERSION_T() { return '2026-11-24'; }

  // Po zgodzie bramka nie wraca.
  await page.evaluate(() => privacyGateCheck());
  ok('po akceptacji bramka nie wraca', !(await page.$('#pv-gate')));

  // Bez sieci: zgoda czeka w telefonie, nie pytamy drugi raz, potem się zapisuje.
  await boot({});
  await page.evaluate(() => { window._failWrites = true; });
  await page.check('#pv-gate-privacy'); await page.check('#pv-gate-health');
  await page.tap('#pv-gate .cs-btn-primary');
  await page.waitForTimeout(200);
  const off = await page.evaluate(() => { document.querySelectorAll('#pv-gate').forEach((n) => n.remove()); window.CL[0].consents = undefined; privacyGateCheck(); return { gate: !!document.getElementById('pv-gate'), pending: !!localStorage.getItem('pl_privacy_pending_v1:c1') }; });
  ok('bez sieci: zgoda czeka w telefonie, bramka nie pyta drugi raz', !off.gate && off.pending, JSON.stringify(off));
  await page.evaluate(async () => { window._failWrites = false; await privacyFlushPending('c1'); });
  const flushed = await page.evaluate(() => ({ pending: !!localStorage.getItem('pl_privacy_pending_v1:c1'), w: window._writes.filter((x) => x.col === 'clients').length, h: window.CL[0].consents && window.CL[0].consents.health.granted }));
  ok('po powrocie sieci zgoda zapisuje się na karcie', !flushed.pending && flushed.w === 1 && flushed.h === true, JSON.stringify(flushed));

  // Profil → Prywatność.
  await boot({ consents: { privacy: { version: '2026-11-24', at: '2026-11-24T10:00:00.000Z' }, health: { granted: true, at: '2026-11-24T10:00:00.000Z' } } });
  ok('konto ze zgodą: bez bramki', !(await page.$('#pv-gate')));
  await page.evaluate(() => setClientLiveScreen('profile'));
  await page.waitForTimeout(200);
  const card = await page.innerText('[data-pv-card]');
  ok('Profil: Prywatność z datą zgody, przyciski danych', /zaakceptowana 24 listopada 2026/.test(card) && /Pobierz moje dane/.test(card) && /Usuń konto i dane/.test(card), card);
  await page.uncheck('[data-pv-card] input[type=checkbox]');
  await page.waitForTimeout(200);
  const wd = await page.evaluate(() => { const w = window._writes.filter((x) => x.col === 'clients').pop(); return w && w.data.consents; });
  ok('wycofanie zgody na dane o zdrowiu zapisane', wd && wd.health.granted === false && wd.privacy.version === '2026-11-24', JSON.stringify(wd));
  await page.evaluate(() => setClientLiveScreen('progress'));
  await page.waitForTimeout(200);
  ok('bez zgody: zdjęcia sylwetki zablokowane z wyjaśnieniem', /wymagają zgody na dane o zdrowiu/.test(await page.innerText('[data-cpg-photos]')) && !(await page.$('[data-cpg-photos] .cpg-photo-add')));

  const exp = await page.evaluate(() => privacyExportPayload());
  ok('eksport: tylko dane tego klienta (treningi, pomiary, wiadomości, zgody)', exp.workouts.length === 1 && exp.measurements.length === 1 && exp.messages.length === 1 && exp.profile.consents && !JSON.stringify(exp).includes('Cudzy') && !JSON.stringify(exp).includes('99'), JSON.stringify(exp).slice(0, 300));

  await page.evaluate(() => setClientLiveScreen('profile'));
  await page.evaluate(() => privacyDeleteOpen());
  ok('usunięcie: najpierw potwierdzenie z informacją o 30 dniach', /30 dni/.test(await page.innerText('#pv-del')));
  await page.tap('#pv-del .pv-danger-btn');
  await page.waitForTimeout(200);
  const del = await page.evaluate(() => ({ msg: window._writes.find((x) => x.col === 'messages'), n: window._writes.find((x) => x.col === 'notifications'), txt: document.getElementById('pv-del').innerText }));
  ok('prośba o usunięcie: wiadomość klienta w czacie (pola zgodne z regułami)', del.msg && /usunięcie mojego konta/.test(del.msg.data.text) && del.msg.data.out === false && Object.keys(del.msg.data).sort().join() === 'clientId,createdAt,id,kind,out,text,time,trainerId', JSON.stringify(del.msg));
  ok('prośba o usunięcie: powiadomienie dla trenera + potwierdzenie dla klienta', del.n && del.n.data.type === 'system' && /Prośba wysłana/.test(del.txt), JSON.stringify(del.n));

  const small = await page.evaluate(() => [...document.querySelectorAll('[data-pv-card] button, #pv-del button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44).map((b) => b.innerText));
  ok('przyciski ≥ 44 px', !small.length, JSON.stringify(small));
  ok('bez błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('RODO w aplikacji klienta — OK');
})();
