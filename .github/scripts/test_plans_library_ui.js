// UI: lista planów — tabela, filtry statusu, szablony osobno.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.PLANS_LIB_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-plans-lib'));
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
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.confirm = () => true;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    try { localStorage.removeItem('pl_plans_view'); } catch (e) {}
    window.CL = [
      { id: 'c-ola', name: 'Ola' },
      { id: 'c-justyna', name: 'Justyna Chylińska' }
    ];
    window.PL = [
      { id: 'p-old', name: 'Zebra FBW', clientId: 'c-ola', clientName: 'Ola', duration: 8, updatedAt: '2026-08-01T10:00:00.000Z', days: [{ day: 'FBW A' }] },
      { id: 'p-new', name: 'Alpha redukcja', clientId: 'c-justyna', clientName: 'Justyna Chylińska', duration: 8, updatedAt: '2026-09-05T10:00:00.000Z', days: [{ day: 'FBW A' }] },
      { id: 'p-tpl', name: 'PPL 2x kopia', clientId: '', duration: 6, createdAt: '2026-09-03T10:00:00.000Z', days: [{ day: 'Push' }] },
      { id: 'p-arch', name: 'Archiwum Oli', clientId: 'c-ola', archived: true, updatedAt: '2026-07-01T10:00:00.000Z', days: [] }
    ];
    if (typeof setPlansLibView === 'function') setPlansLibView('table');
    if (typeof setPlansLibStatus === 'function') setPlansLibStatus('active');
    if (typeof setPlansLibSort === 'function') setPlansLibSort('newest');
    if (typeof setPlansLibClient === 'function') setPlansLibClient('');
    if (typeof goTo === 'function') goTo('plans');
  });

  await page.waitForSelector('.plans-tbl-hdr');
  const table = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.plans-tbl-name')].map((el) => el.textContent.trim());
    return {
      hdr: (document.querySelector('.plans-tbl-hdr') || {}).textContent || '',
      names,
      hasTpl: names.some((n) => /PPL 2x kopia/.test(n)),
      hasArch: names.some((n) => /Archiwum Oli/.test(n)),
      nActive: (document.getElementById('plans-n-active') || {}).textContent,
      nTpl: (document.getElementById('plans-n-templates') || {}).textContent
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'plans_table_active.png') });
  ok('table headers', /Data/.test(table.hdr) && /Nazwa/.test(table.hdr) && /Podopieczny/.test(table.hdr) && /Status/.test(table.hdr) && /Akcje/.test(table.hdr), table.hdr);
  ok('newest first', table.names[0] === 'Alpha redukcja' && table.names[1] === 'Zebra FBW', JSON.stringify(table.names));
  ok('templates not in active', table.hasTpl === false);
  ok('archived not in active', table.hasArch === false);
  ok('counts', table.nActive === '2' && table.nTpl === '1', JSON.stringify(table));

  await page.click('#plans-st-templates');
  const tpls = await page.evaluate(() => [...document.querySelectorAll('.plans-tbl-name')].map((el) => el.textContent.trim()));
  await page.screenshot({ path: path.join(shotDir, 'plans_table_templates.png') });
  ok('templates tab', tpls.length === 1 && tpls[0] === 'PPL 2x kopia', JSON.stringify(tpls));

  await page.click('#plans-st-archived');
  const arch = await page.evaluate(() => [...document.querySelectorAll('.plans-tbl-name')].map((el) => el.textContent.trim()));
  ok('archived tab', arch.length === 1 && arch[0] === 'Archiwum Oli', JSON.stringify(arch));

  await page.click('#plans-st-active');
  await page.selectOption('#plans-sort', 'alpha');
  const alpha = await page.evaluate(() => [...document.querySelectorAll('.plans-tbl-name')].map((el) => el.textContent.trim()));
  ok('alpha sort', alpha[0] === 'Alpha redukcja' && alpha[1] === 'Zebra FBW', JSON.stringify(alpha));

  await page.selectOption('#plans-client', 'c-ola');
  const ola = await page.evaluate(() => [...document.querySelectorAll('.plans-tbl-name')].map((el) => el.textContent.trim()));
  ok('client filter', ola.length === 1 && ola[0] === 'Zebra FBW', JSON.stringify(ola));

  await page.selectOption('#plans-client', '');
  await page.click('#plans-view-cards');
  const cards = await page.evaluate(() => ({
    grid: !!document.querySelector('.plans-grid'),
    n: document.querySelectorAll('.plans-grid .plan-card').length,
    badge: [...document.querySelectorAll('.pill')].map((el) => el.textContent.trim())
  }));
  await page.screenshot({ path: path.join(shotDir, 'plans_cards.png') });
  ok('cards view', cards.grid === true && cards.n === 2, JSON.stringify(cards));
  ok('active badge', cards.badge.some((b) => /Aktywny/.test(b)));

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll plans-library UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
