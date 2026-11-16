// Etap 1 z 3 (audyt 8.11.2026): tekst od klienta nie może uruchomić skryptu w panelu trenera.
// Powiadomienia (tytuł/treść/czas/id), imię klienta w onclick check-inu, notatka check-inu
// i odpowiedź AI w psychodietetyce muszą trafiać do HTML jako zwykły tekst.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof renderNotifs === 'function' && typeof renderCIAnswers === 'function' && typeof psyAskAI === 'function');

  const notif = await page.evaluate(async (xss) => {
    window._clientAppMode = false;
    window.__xss = 0;
    window.NOTIFICATIONS = [{
      id: "n_evil');window.__xss=99;('", type: 'system', read: false, action: null,
      title: xss, body: '<script>window.__xss=1<\/script>' + xss, time: xss,
    }];
    renderNotifs();
    await new Promise(r => setTimeout(r, 150));
    const el = document.getElementById('notif-list');
    const item = el.querySelector('.notif-item');
    const out = {
      imgs: el.querySelectorAll('img,script').length,
      title: el.querySelector('.notif-title') && el.querySelector('.notif-title').textContent,
      body: el.querySelector('.notif-body') && el.querySelector('.notif-body').textContent,
      time: el.querySelector('.notif-time') && el.querySelector('.notif-time').textContent,
    };
    if (item) item.click();
    await new Promise(r => setTimeout(r, 50));
    out.read = window.NOTIFICATIONS[0].read;
    out.xss = window.__xss;
    return out;
  }, XSS);
  ok('notification title renders as text', notif.title === XSS, JSON.stringify(notif));
  ok('notification body renders as text', notif.body === '<script>window.__xss=1</script>' + XSS, notif.body);
  ok('notification time renders as text', notif.time === XSS, notif.time);
  ok('no <img>/<script> element created from notification fields', notif.imgs === 0, String(notif.imgs));
  ok('apostrophe in notification id cannot break onclick, click still marks read', notif.read === true && notif.xss === 0, JSON.stringify(notif));

  const truncated = await page.evaluate(() => {
    window._clientAppMode = true;
    const persisted = [];
    const prev = window.persistById;
    window.persistById = (col, n) => persisted.push(n);
    try { persistById = window.persistById; } catch (e) {}
    const n = addNotification('system', 'T'.repeat(300), 'B'.repeat(2000), 'clients');
    window._clientAppMode = false;
    const trainer = addNotification('system', 'T'.repeat(300), 'B'.repeat(2000), 'clients');
    window.persistById = prev; try { persistById = prev; } catch (e) {}
    return { t: n.title.length, b: n.body.length, tt: trainer.title.length, tb: trainer.body.length };
  });
  ok('client app trims notification to rule limits (120/500)', truncated.t === 120 && truncated.b === 500, JSON.stringify(truncated));
  ok('trainer notifications are not trimmed', truncated.tt === 300 && truncated.tb === 2000, JSON.stringify(truncated));

  const ci = await page.evaluate(async (xss) => {
    window.__xss = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const c = { id: 'c1', name: "Anna O'Brien" + xss };
    const answer = { score: 80, answers: { notes: xss, weight: 70 } };
    host.innerHTML = renderCIAnswers(answer, c);
    await new Promise(r => setTimeout(r, 150));
    const before = (window.NOTIFICATIONS || []).length;
    const btn = [...host.querySelectorAll('button')].find(b => /Ustaw alert/.test(b.textContent));
    if (btn) btn.click();
    const added = (window.NOTIFICATIONS || [])[0];
    const out = {
      btn: !!btn, imgs: host.querySelectorAll('img').length,
      grew: (window.NOTIFICATIONS || []).length === before + 1,
      body: added && added.body, xss: window.__xss,
      noteText: [...host.querySelectorAll('div')].some(d => d.textContent === xss),
    };
    host.remove();
    return out;
  }, XSS);
  ok('check-in alert button works with apostrophe in client name', ci.btn && ci.grew && ci.body === "Anna O'Brien" + XSS + ' wypełnił check-in — score: 80%', JSON.stringify(ci));
  ok('check-in client note renders as text', ci.noteText && ci.imgs === 0 && ci.xss === 0, JSON.stringify(ci));

  const ai = await page.evaluate(async (xss) => {
    window.__xss = 0;
    const host = document.createElement('div');
    host.innerHTML = '<div id="psy-ai-result"></div><button id="psy-ai-btn"></button>';
    document.body.appendChild(host);
    const prevFetch = window.fetch;
    window.fetch = async () => ({ json: async () => ({ content: [{ text: 'Rada ' + xss }] }) });
    try { await psyAskAI('psy-xss-client'); } catch (e) { return { error: String(e) }; } finally { window.fetch = prevFetch; }
    await new Promise(r => setTimeout(r, 150));
    const res = document.getElementById('psy-ai-result');
    const out = { imgs: res.querySelectorAll('img').length, text: res.textContent, xss: window.__xss };
    host.remove();
    return out;
  }, XSS);
  ok('AI answer in psychodietetics renders as text', ai.imgs === 0 && ai.xss === 0 && String(ai.text).includes('Rada ' + XSS), JSON.stringify(ai));

  const fired = await page.evaluate(() => window.__xss || 0);
  ok('no script from client text executed anywhere', fired === 0 && !dialogs.length, 'xss=' + fired + ' dialogs=' + dialogs.length);
  const relevant = errors.filter(e => !/firebase|gstatic|Failed to fetch|_db|auth/i.test(e));
  ok('no page errors', !relevant.length, relevant.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' test(s) failed'); process.exit(1); }
  console.log('All notification escaping UI tests passed.');
})().catch(e => { console.error(e); process.exit(1); });
