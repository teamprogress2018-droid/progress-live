// UI: tryb Amator prowadzi przez ankietę, zapisuje kwalifikację i uruchamia plan startowy.
'use strict';
const { chromium } = require('playwright');

let failed = 0;
function ok(name, condition, extra) {
  if (condition) console.log('OK  ', name);
  else { console.error('FAIL', name + (extra ? ' — ' + extra : '')); failed++; }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.notify = m => { window.__amateurNotice = String(m); };
    ['auth-screen', 'app-loading'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const app = document.getElementById('app-root'); if (app) app.style.display = '';
    if (typeof goTo === 'function') goTo('aiplangen');
    window.__amateurGenerated = false;
    window.aplGenerate = () => { window.__amateurGenerated = true; };
  });
  await page.click('button[onclick="aplAmateurOpen()"]');
  await page.waitForSelector('#apl-amateur-mount:not([hidden])');

  await page.evaluate(() => document.querySelector('#apl-am-equipment input').checked = false);
  await page.click('button[onclick="aplAmateurNext(1)"]');
  const requiredEquipment = await page.evaluate(() => window.__amateurNotice || '');
  ok('requires equipment before next step', /co najmniej jeden rodzaj/.test(requiredEquipment), requiredEquipment);

  await page.check('#apl-am-equipment input[value="Hantle"]');
  await page.click('button[onclick="aplAmateurNext(1)"]');
  await page.selectOption('#apl-am-pain', 'yes');
  await page.click('button[onclick="aplAmateurNext(2)"]');
  const requiredPainDetails = await page.evaluate(() => window.__amateurNotice || '');
  ok('requires pain details for trainer review', /Opisz, co boli/.test(requiredPainDetails), requiredPainDetails);

  await page.fill('#apl-am-pain-details', 'Kolano przy głębokim przysiadzie');
  await page.click('button[onclick="aplAmateurNext(2)"]');
  await page.check('#apl-am-consent');
  await page.click('button[onclick="aplAmateurPrepare()"]');
  const review = await page.evaluate(() => ({ generated: window.__amateurGenerated, intake: window._aplAmateurIntake || null, feedback: (document.getElementById('apl-amateur-feedback') || {}).textContent || '' }));
  ok('health flag blocks automatic generation', review.generated === false && review.intake === null && /Wymagana weryfikacja człowieka/.test(review.feedback), JSON.stringify(review));

  await page.selectOption('#apl-am-pain', 'no');
  await page.click('button[onclick="aplAmateurPrepare()"]');
  const prepared = await page.evaluate(() => ({ generated: window.__amateurGenerated, intake: window._aplAmateurIntake || null }));
  ok('clear intake starts generator', prepared.generated === true, JSON.stringify(prepared));
  ok('intake stores conservative starter prescription', prepared.intake && prepared.intake.prescription.method === 'FBW' && prepared.intake.prescription.days === '2' && prepared.intake.answers.equipment.includes('Hantle'), JSON.stringify(prepared.intake));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll amateur-mode UI tests passed');
})().catch(err => { console.error(err); process.exit(1); });
