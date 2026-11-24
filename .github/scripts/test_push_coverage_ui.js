#!/usr/bin/env node
'use strict';
/**
 * Licznik „Kto dostaje powiadomienia” w panelu „Spotkania i powiadomienia” (Chromium, dane w pamięci, bez sieci):
 * liczba klientów z zapisanym telefonem, lista bez powiadomień z powodem, „bez przypomnień” osobno,
 * archiwalni pominięci, błąd odczytu nie udaje zera, instrukcja dla iPhone i Androida.
 * Zerowanie stanu po wygaśnięciu telefonów sprawdza test serwera (server/automation/test-comms-worker.cjs).
 */
const { chromium } = require('playwright');
let failed = 0;
function ok(name, cond, extra) { if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; } else console.log('OK   ' + name); }
const BASE = 'http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()));
  await page.goto(BASE + '?nocache=pcov', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-root').style.display = '';
    window._uid = 't1'; window._clientAppMode = false;
    window.CL.splice(0, window.CL.length,
      { id: 'a', trainerId: 't1', name: 'Anna Nowak', status: 'active' },
      { id: 'b', trainerId: 't1', name: 'Bartek Lis', status: 'active' },
      { id: 'c', trainerId: 't1', name: 'Celina Kot', status: 'active' },
      { id: 'd', trainerId: 't1', name: 'Darek Wróbel', status: 'active' },
      { id: 'e', trainerId: 't1', name: 'Ewa Stara', status: 'archived' },
      { id: 'f', trainerId: 't1', name: 'Filip Mak', status: 'active' });
  });
  const prefs = [
    { clientId: 'a', channel: 'push', push: { subscribed: true, device: 'iPhone' } },
    { clientId: 'b', channel: 'push', push: { subscribed: false, off: true, device: 'Android' } },
    { clientId: 'c', channel: 'push', push: { subscribed: false, device: 'iPhone' } },
    { clientId: 'd', channel: 'none', push: { subscribed: true } },
    { clientId: 'e', channel: 'push', push: { subscribed: true } }
  ];
  const panel = async (rows) => page.evaluate(async (rows) => {
    await window.commsTrainerLoad((n) => (n === 'commsPrefs' ? rows : []));
    openCommsPanel();
    const el = document.querySelector('[data-comms-cov]');
    return el ? { state: el.dataset.commsCov, text: el.innerText, on: (el.querySelector('[data-cov-on]') || {}).textContent, total: (el.querySelector('[data-cov-total]') || {}).textContent } : null;
  }, rows);

  let r = await panel(prefs);
  ok('licznik widoczny w panelu', r && r.state === 'ok', JSON.stringify(r));
  ok('1 z 5 aktywnych (archiwalny pominięty, „bez przypomnień” liczony w całości)', r.on === '1' && r.total === '5', r.on + '/' + r.total);
  ok('lista bez powiadomień z powodami', /Bartek Lis — wyłączył\(a\) na telefonie/.test(r.text) && /Celina Kot — zapis telefonu wygasł/.test(r.text) && /Filip Mak — jeszcze nie włączył\(a\)/.test(r.text), r.text);
  ok('Anna (włączone) nie jest na liście braków', !/Anna Nowak/.test(r.text));
  ok('„bez przypomnień” osobno, nie jako brak', /Wybrali „bez przypomnień”: Darek Wróbel/.test(r.text) && !/Darek Wróbel —/.test(r.text));
  ok('archiwalna klientka nie występuje', !/Ewa Stara/.test(r.text));
  ok('instrukcja dla iPhone i Androida', /Do ekranu początkowego/.test(r.text) || await page.evaluate(() => /Do ekranu początkowego/.test(document.querySelector('.comms-cov-help').textContent) && /Android/.test(document.querySelector('.comms-cov-help').textContent)));

  r = await panel(['a', 'b', 'c', 'd', 'f'].map((id) => ({ clientId: id, channel: 'push', push: { subscribed: true } })));
  ok('wszyscy włączeni → komunikat zamiast listy', r.on === '5' && /Wszyscy aktywni klienci mają włączone powiadomienia/.test(r.text), r.text);

  r = await page.evaluate(async () => {
    await window.commsTrainerLoad((n) => (n === 'commsPrefs' ? Promise.reject(new Error('denied')) : []));
    openCommsPanel();
    const el = document.querySelector('[data-comms-cov]');
    return { state: el && el.dataset.commsCov, text: el && el.innerText };
  });
  ok('błąd odczytu: komunikat, nie „0 z N”', r.state === 'error' && /Nie udało się odczytać/.test(r.text) && !/0 z/.test(r.text), JSON.stringify(r));

  ok('brak błędów strony', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' FAILED'); process.exit(1); }
  console.log('push coverage: all OK');
})().catch((e) => { console.error(e); process.exit(1); });
