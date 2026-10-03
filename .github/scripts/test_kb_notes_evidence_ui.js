// UI: Baza wiedzy — notatki + badania do Generatora AI; modal startuje od notatki.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.KB_NOTE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-kb-notes'));
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
  const host = process.env.LAYOUT_HOST || '127.0.0.1';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://' + host + ':' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);

  const ui = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    if (typeof goTo === 'function') goTo('kb');
    const blurb = (document.querySelector('#screen-kb .content') || {}).innerText || '';
    if (typeof openKbModal === 'function') openKbModal();
    const kind = (document.getElementById('kb-kind') || {}).value || '';
    const hint = (document.getElementById('kb-kind-hint') || {}).innerText || '';
    const planning = !!(document.getElementById('kb-use-planning') || {}).checked;
    const kinds = [...document.querySelectorAll('#kb-kind option')].map((o) => o.value);
    return { blurb, kind, hint, planning, kinds };
  });

  await page.screenshot({ path: path.join(shotDir, 'kb_note_modal.png') });
  ok('screen blurb notes+evidence', /notatki i badania/i.test(ui.blurb), ui.blurb.slice(0, 220));
  ok('modal default note', ui.kind === 'note', ui.kind);
  ok('kinds order note then evidence', ui.kinds[0] === 'note' && ui.kinds.includes('evidence'), JSON.stringify(ui.kinds));
  ok('planning on by default', ui.planning);
  ok('hint says notes go to AI', /Generatora AI/i.test(ui.hint), ui.hint);

  await page.selectOption('#kb-kind', 'evidence');
  const evHint = await page.evaluate(() => (document.getElementById('kb-kind-hint') || {}).innerText || '');
  ok('evidence hint PubMed', /PubMed/i.test(evHint), evHint);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll KB notes+evidence UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
