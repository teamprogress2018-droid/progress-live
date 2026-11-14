#!/usr/bin/env node
'use strict';
/** UI (Etap 9 UX): „Dodaj klienta” — 3 pola na wierzchu (imię, e-mail, cel), „Więcej danych” zwinięte,
 *  po zapisie wyraźny następny krok „Ułóż pierwszy plan” albo „Później”. Zapis klienta bez zmian. */
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

async function open(browser, viewport) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(20000);
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => route.abort());
  await page.route('**://firestore.googleapis.com/**', (route) => route.abort());
  await page.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.saveClient === 'function' && typeof window.openClientModal === 'function' && typeof window.assignmentSession === 'function');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const f = window._addClientUi = { saved: [], pipelines: [], builder: [] };
    window._db = { fixture: true };
    window.persistById = async (_c, o) => o;
    ['renderAll', 'renderClients', 'renderDash', 'syncClientNameCache', 'aplRefreshFromSavedClient'].forEach((k) => { window[k] = () => {}; });
    window.saveClientCardConfirmed = async (candidate) => { f.saved.push(JSON.parse(JSON.stringify(candidate))); return { ...candidate, _fbId: candidate.id }; };
    window.assignClientPipeline = async (client) => { f.pipelines.push(client.id); return { ok: true }; };
    const builder = window.openBuilderForClient;
    window.openBuilderForClient = (id, fromOnboard) => { f.builder.push([id, !!fromOnboard]); return builder(id, fromOnboard); };
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-loading') && (document.getElementById('app-loading').style.display = 'none');
    document.getElementById('app-root').style.display = 'flex';
    window._uid = 'add-client-owner';
    window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
    window._tenantDataReady = true;
    window.CL.length = 0;
    goTo('clients');
  });
  return page;
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [vw, tag] of [[{ width: 390, height: 844 }, 'phone'], [{ width: 1280, height: 800 }, 'desktop']]) {
      const page = await open(browser, vw);
      await page.evaluate(() => openM('m-client'));
      await page.waitForSelector('#m-client.show');
      const vis = await page.evaluate(() => [...document.querySelectorAll('#m-client .modal-body input, #m-client .modal-body select, #m-client .modal-body textarea')]
        .filter((e) => e.checkVisibility ? e.checkVisibility() : e.offsetParent !== null).map((e) => e.id));
      ok(tag + ': only name, e-mail and goal visible', JSON.stringify(vis) === JSON.stringify(['ac-name', 'ac-email', 'ac-goal']), JSON.stringify(vis));
      ok(tag + ': labels tied to fields', await page.evaluate(() => ['ac-name', 'ac-email', 'ac-goal'].every((id) => document.querySelector('#m-client label[for="' + id + '"]'))));
      ok(tag + ': "Więcej danych" collapsed', await page.evaluate(() => !document.getElementById('ac-more').open));
      const sumH = await page.$eval('#ac-more > summary', (e) => e.getBoundingClientRect().height);
      ok(tag + ': summary ≥44 px', sumH >= 44, String(sumH));
      const fits = await page.$eval('#ac-save-btn', (e) => e.getBoundingClientRect().bottom <= window.innerHeight);
      ok(tag + ': save button visible without scrolling', fits);
      await page.click('#ac-more > summary');
      ok(tag + ': more data opens', await page.isVisible('#ac-phone') && await page.isVisible('#ac-injuries'));
      await page.click('#ac-more > summary');

      if (tag === 'desktop') {
        await page.fill('#ac-name', 'Anna Nowak');
        await page.fill('#ac-email', 'anna@example.test');
        await page.selectOption('#ac-goal', 'redukcja');
        await page.click('#ac-save-btn');
        await page.waitForSelector('#m-client-onboard.show');
        const f = await page.evaluate(() => window._addClientUi);
        const saved = f.saved[0] || {};
        ok('save keeps the same client data shape', saved.name === 'Anna Nowak' && saved.email === 'anna@example.test' && saved.goal === 'redukcja' &&
          saved.trainingFreq === 3 && saved.level === 'poczatkujacy' && saved.gender === 'M' && Array.isArray(saved.preferredWeekdays) && f.pipelines.length === 1, JSON.stringify(saved));
        ok('after save: next step card', await page.isVisible('#client-onboard-saved') && (await page.textContent('#client-onboard-saved')).includes('Anna jest na liście klientów'));
        ok('after save: "Ułóż pierwszy plan" and "Później"', (await page.textContent('#client-saved-plan-btn')).trim() === 'Ułóż pierwszy plan' && (await page.textContent('#client-saved-later-btn')).trim() === 'Później');
        await page.click('#client-saved-plan-btn');
        await page.waitForTimeout(300);
        const after = await page.evaluate(() => ({ builder: window._addClientUi.builder, sel: (document.getElementById('b-client') || {}).value, open: document.getElementById('m-client-onboard').classList.contains('show') }));
        ok('"Ułóż pierwszy plan" opens builder for this client', after.builder.length === 1 && after.builder[0][0] === saved.id && after.builder[0][1] === true && !after.open && after.sel === saved.id, JSON.stringify(after));
        await page.evaluate((id) => openClientOnboardChecklist(id), saved.id);
        ok('checklist reopened later: no next-step card', !(await page.isVisible('#client-onboard-saved')));
        await page.evaluate(() => closeM('m-client-onboard'));

        // „Później”
        await page.evaluate(() => { window._clientModalState = null; openM('m-client'); });
        await page.fill('#ac-name', 'Jan Kowalski');
        await page.click('#ac-save-btn');
        await page.waitForSelector('#client-onboard-saved:not([hidden])');
        await page.click('#client-saved-later-btn');
        ok('"Później" closes and stays on list', !(await page.evaluate(() => document.getElementById('m-client-onboard').classList.contains('show'))) && (await page.evaluate(() => window._addClientUi.builder.length)) === 1);

        // Edycja: wszystkie dane od razu widoczne
        await page.evaluate((id) => openClientModal(id), saved.id);
        ok('edit: more data open', await page.evaluate(() => document.getElementById('ac-more').open) && await page.isVisible('#ac-phone'));
        await page.evaluate(() => closeM('m-client'));
      }
      await page.close();
    }
  } catch (e) {
    console.error('FAIL exception — ' + (e && e.stack || e));
    failed++;
  } finally {
    await browser.close();
  }
  if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
  console.log('\nAll add-client tests passed');
})();
