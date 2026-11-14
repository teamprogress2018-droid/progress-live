#!/usr/bin/env node
'use strict';
/** UI (Etap 2 UX): okno logowania — jeden przycisk, czytelny błąd z role="alert", linki 44 px, „pokaż hasło”, e-mail ze strony startowej. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const tag = vp.width + 'px';
    const page = await browser.newPage({ viewport: vp });
    page.setDefaultTimeout(20000);
    await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);

    await page.fill('#pl-land-email', 'ania@example.com');
    await page.click('#pl-land-start-btn');
    await page.waitForTimeout(150);
    ok(tag + ' landing e-mail carried into login', await page.inputValue('#auth-email') === 'ania@example.com');

    const buttons = await page.evaluate(() => [...document.querySelectorAll('#auth-login-view button')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()));
    ok(tag + ' single login button', buttons.filter((t) => /Zaloguj/.test(t)).length === 1, JSON.stringify(buttons));
    ok(tag + ' no "Zaloguj jako trener"', !buttons.some((t) => /jako trener/.test(t)));
    ok(tag + ' hint text', (await page.textContent('#auth-role-hint')).trim() === 'Zaloguj się do swojego konta');
    ok(tag + ' placeholder', await page.getAttribute('#auth-email', 'placeholder') === 'twoj@email.pl');

    const links = await page.evaluate(() => [...document.querySelectorAll('#auth-login-view .pl-auth-link')].map((b) => {
      const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), h: r.height, fs: parseFloat(getComputedStyle(b).fontSize) };
    }));
    ok(tag + ' two links: reset + invite', links.length === 2 && links[0].t === 'Nie pamiętam hasła' && links[1].t === 'Mam zaproszenie, załóż konto', JSON.stringify(links));
    ok(tag + ' links ≥44 px high and ≥14 px text', links.every((l) => l.h >= 44 && l.fs >= 14), JSON.stringify(links));

    await page.fill('#auth-password', 'tajne');
    await page.click('#auth-pass-toggle');
    ok(tag + ' show password', await page.getAttribute('#auth-password', 'type') === 'text' && await page.getAttribute('#auth-pass-toggle', 'aria-pressed') === 'true');
    await page.click('#auth-pass-toggle');
    ok(tag + ' hide password again', await page.getAttribute('#auth-password', 'type') === 'password');
    const eye = await page.locator('#auth-pass-toggle').boundingBox();
    ok(tag + ' eye button 44x44', eye && eye.width >= 44 && eye.height >= 44);

    const err = await page.evaluate(() => {
      const e = document.getElementById('auth-error'); e.textContent = 'Nieprawidłowy e-mail lub hasło.'; e.style.display = 'block';
      const cs = getComputedStyle(e); return { role: e.getAttribute('role'), fs: parseFloat(cs.fontSize), color: cs.color };
    });
    ok(tag + ' error role=alert, 14 px', err.role === 'alert' && err.fs >= 14, JSON.stringify(err));
    ok(tag + ' error uses dark danger (#b42318)', err.color === 'rgb(180, 35, 24)', err.color);
    ok(tag + ' register error role=alert', await page.getAttribute('#auth-reg-error', 'role') === 'alert');
    ok(tag + ' reset copy', (await page.textContent('#auth-reset-sub')).trim() === 'Wyślemy Ci link na e-mail. Sprawdź też spam.' && await page.getAttribute('#auth-reset-email', 'placeholder') === 'twoj@email.pl');
    await page.close();
  }
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('All login UX tests passed.');
})().catch((e) => { console.error(e); process.exit(1); });
