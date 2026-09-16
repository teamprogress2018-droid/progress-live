// UI: KB tags in modal + matching hits in the builder sidebar / day strip.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.KB_TAG_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-kb-tags'));
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
  await page.waitForTimeout(500);

  const modal = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    if (typeof goTo === 'function') goTo('kb');
    if (typeof openKbModal === 'function') openKbModal();
    const chips = [...document.querySelectorAll('#kb-tag-picker .kb-tag-btn')].map((b) => b.getAttribute('data-kb-tag'));
    const mev = document.querySelector('#kb-tag-picker [data-kb-tag="mev"]');
    if (mev && typeof kbToggleTag === 'function') kbToggleTag(mev);
    const picked = typeof kbReadTagPicker === 'function' ? kbReadTagPicker() : [];
    return { chips, picked, picker: !!document.getElementById('kb-tag-picker') };
  });
  await page.screenshot({ path: path.join(shotDir, 'kb_tag_modal.png') });
  ok('picker present', modal.picker);
  ok('has mev+klatka chips', modal.chips.includes('mev') && modal.chips.includes('klatka'), JSON.stringify(modal.chips.slice(0, 8)));
  ok('toggle mev', modal.picked.includes('mev'), JSON.stringify(modal.picked));

  const builder = await page.evaluate(() => {
    if (typeof closeM === 'function') closeM('m-kb');
    if (typeof goTo === 'function') goTo('builder');
    if (typeof initBuilder === 'function') initBuilder();
    if (typeof addDay === 'function') addDay();
    window.KB = [
      { id: 'k-chest', kind: 'note', title: 'Priorytet klatki', text: 'Więcej rozpiętek w stretchu.', tags: ['klatka'], useInPlanning: true },
      { id: 'k-quad', kind: 'note', title: 'Tylko quady', text: 'Hack squat.', tags: ['quady'], useInPlanning: true }
    ];
    const focus = document.querySelector('#builder-days .builder-day-focus');
    if (focus) {
      focus.value = 'Klatka / Push';
      focus.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof builderRefreshKbHits === 'function') builderRefreshKbHits();
    const side = (document.getElementById('builder-kb-hits') || {}).innerText || '';
    const day = (document.querySelector('#builder-days .builder-day-kb') || {}).innerText || '';
    const dayHidden = !!(document.querySelector('#builder-days .builder-day-kb') || {}).hidden;
    return { side, day, dayHidden };
  });
  await page.screenshot({ path: path.join(shotDir, 'builder_kb_hits.png') });
  ok('sidebar has chest note', /Priorytet klatki/.test(builder.side), builder.side.slice(0, 240));
  ok('sidebar hides quad note', !/Tylko quady/.test(builder.side), builder.side.slice(0, 240));
  ok('day strip shows chest', /Priorytet klatki/.test(builder.day) && !builder.dayHidden, builder.day.slice(0, 240));
  ok('day strip hides quad', !/Tylko quady/.test(builder.day), builder.day.slice(0, 240));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll KB builder-tags UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
