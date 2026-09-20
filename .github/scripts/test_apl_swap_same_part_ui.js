// UI: zmiana ćwiczenia w generatorze pokazuje tylko tę samą partię (ławka/hantle).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.APL_SWAP_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-apl-swap'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Piotr Urbaniak', availableEquipment: ['Sztanga i wolne ciężary', 'Hantle', 'Wyciągi i linki'] }];
  });
  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('aiplangen');
    if (typeof aplCreateBlankPlan === 'function') aplCreateBlankPlan();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelectorAll('#apl-equipment .apl-opt-multi').forEach((b) => {
      if (b.dataset.val === 'Maszyny siłowe' && b.classList.contains('active')) b.click();
    });
    if (!window.aplLastPlan || !window.aplLastPlan.days[0]) return;
    const ex = window.aplLastPlan.days[0].exercises[0];
    ex.name = 'Wyciskanie francuskie';
    ex.muscleGroup = 'Triceps';
    ex.notes = 'PRIORYTET triceps';
    if (typeof aplRerenderCurrent === 'function') aplRerenderCurrent();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof aplSwapExercise === 'function') aplSwapExercise(0, 0); });
  await page.waitForFunction(() => {
    const dd = document.querySelector('#apl-ex-row-0-0 .ex-ac-dropdown');
    return !!(dd && dd.style.display !== 'none' && dd.querySelectorAll('.ex-ac-item').length);
  }, null, { timeout: 8000 });
  await page.evaluate(() => {
    const row = document.getElementById('apl-ex-row-0-0');
    if (row) row.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);

  const swap = await page.evaluate(() => {
    const dd = document.querySelector('#apl-ex-row-0-0 .ex-ac-dropdown');
    const hdr = dd ? (dd.textContent || '') : '';
    const parts = [...(dd ? dd.querySelectorAll('.ex-ac-part') : [])].map((el) => (el.textContent || '').trim());
    const names = [...(dd ? dd.querySelectorAll('.ex-ac-item .ex-ac-name') : [])].map((el) => (el.textContent || '').trim());
    return { hdr, parts, names, first: names[0] || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'apl_swap_triceps.png') });
  ok('swap dropdown open', swap.names.length > 0, JSON.stringify(swap.names.slice(0, 8)));
  ok('same part header', /Ta sama partia|Triceps|ławka \/ hantle/i.test(swap.hdr), swap.hdr.slice(0, 180));
  ok('no chest catalog', !swap.parts.some((p) => /Klatka/i.test(p)) && !swap.names.some((n) => /Butterfly|Pompki|Peck/i.test(n)), swap.parts.slice(0, 8).join('|') + ' :: ' + swap.names.slice(0, 8).join(' | '));
  ok('only triceps parts', swap.parts.filter((p) => p !== '↻').every((p) => /Triceps/i.test(p)), swap.parts.join(', '));
  ok('bench or db in list', swap.names.some((n) => /hantel|ław|francuskie|wyciąg/i.test(n)), swap.names.slice(0, 8).join(' | '));
  ok('no pec deck', !swap.names.some((n) => /Butterfly|peck deck|pec-deck/i.test(n)), swap.names.join(' | '));

  await page.evaluate(() => {
    if (!window.aplLastPlan) return;
    window.aplLastPlan.days[0].exercises[0].name = 'Butterfly (peck deck)';
    window.aplLastPlan.days[0].exercises[0].muscleGroup = 'Klatka piersiowa';
    if (typeof aplRerenderCurrent === 'function') aplRerenderCurrent();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => { if (typeof aplSwapExercise === 'function') aplSwapExercise(0, 0); });
  await page.waitForFunction(() => {
    const dd = document.querySelector('#apl-ex-row-0-0 .ex-ac-dropdown');
    return !!(dd && dd.style.display !== 'none' && /ławka|hantle|Rozpiętk|Klatka|Ta sama partia/i.test(dd.textContent || ''));
  }, null, { timeout: 8000 });
  await page.evaluate(() => {
    const row = document.getElementById('apl-ex-row-0-0');
    if (row) row.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);
  const pec = await page.evaluate(() => {
    const dd = document.querySelector('#apl-ex-row-0-0 .ex-ac-dropdown');
    const names = [...(dd ? dd.querySelectorAll('.ex-ac-item .ex-ac-name') : [])].map((el) => (el.textContent || '').trim());
    const parts = [...(dd ? dd.querySelectorAll('.ex-ac-part') : [])].map((el) => (el.textContent || '').trim());
    const hdr = dd ? (dd.textContent || '') : '';
    return { names, parts, hdr, first: names[0] || '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'apl_swap_pec.png') });
  ok('pec same part chest', /Klatka|Ta sama partia/i.test(pec.hdr), pec.hdr.slice(0, 160));
  ok('pec no other groups', pec.parts.filter((p) => p !== '↻').every((p) => /Klatka/i.test(p)), pec.parts.join(', '));
  ok('pec closest fly/bench', pec.names.some((n) => /Rozpiętki hantlami|Rozpiętki na wyciągu|hantli leżąc|ławce/i.test(n)), pec.names.slice(0, 8).join(' | '));
  ok('pec first not machine catalog', !/^Butterfly/i.test(pec.first), pec.first);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAPL same-part swap UI OK. Shots: ' + shotDir);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
