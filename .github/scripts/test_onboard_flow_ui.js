// UI: checklist startu współpracy — Pomiń zaproszenia, biblioteka ankiet, dni, kreator.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.ONBOARD_FLOW_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-onboard-flow'));
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

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const client = { id: 'c-ewelina', name: 'Ewelina Test', status: 'active', email: 'ewelina@studio.pl' };
    if (Array.isArray(window.CL)) window.CL.splice(0, window.CL.length, client);
    else window.CL = [client];
    window.PL = [];
    window.SE = [];
    window.PACKAGES = [];
    window.METRIC_ENTRIES = [];
    window.FORM_SENDS = window.FORM_SENDS || [];
    if (Array.isArray(window.FORM_SENDS)) window.FORM_SENDS.splice(0, window.FORM_SENDS.length);
    if (typeof goTo === 'function') goTo('clients');
    if (typeof openClientOnboardChecklist === 'function') openClientOnboardChecklist('c-ewelina');
  });

  await page.waitForSelector('#m-client-onboard.show');
  await page.screenshot({ path: path.join(shotDir, 'onboard_start.png') });

  const inviteCta = page.locator('#client-onboard-steps button', { hasText: /^Wyślij$/ });
  await inviteCta.click();
  await page.waitForSelector('#m-invite.show');
  ok('invite opened from onboard', true);

  await page.click('#m-invite .modal-footer button:has-text("Pomiń")');
  await page.waitForTimeout(700);
  const afterSkip = await page.evaluate(() => {
    const c = (window.CL || [])[0] || {};
    const st = typeof getClientOnboard === 'function' ? getClientOnboard(c) : {};
    const ov = document.getElementById('m-client-onboard');
    const steps = (document.getElementById('client-onboard-steps') || {}).innerText || '';
    return {
      skipped: !!c.inviteSkipped,
      invite: !!st.invite,
      open: !!(ov && ov.classList.contains('show')),
      ready: /GOTOWE/.test(steps)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_invite_skip.png') });
  ok('invite skip marks done and resumes', afterSkip.skipped && afterSkip.invite && afterSkip.open && afterSkip.ready, JSON.stringify(afterSkip));

  await page.click('#client-onboard-steps button:has-text("Biblioteka")');
  await page.waitForTimeout(250);
  const forms = await page.evaluate(() => {
    const screen = document.getElementById('screen-forms');
    const nav = document.getElementById('fn-wstepna');
    const banner = document.getElementById('forms-onboard-banner');
    return {
      active: !!(screen && screen.classList.contains('active')),
      wst: !!(nav && nav.classList.contains('active')),
      banner: !!(banner && banner.style.display !== 'none' && /Ewelina/.test(banner.innerText || '')),
      flag: window._onboardResumeAfterForms === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_forms_lib.png') });
  ok('forms library wstępne + banner', forms.active && forms.wst && forms.banner && forms.flag, JSON.stringify(forms));

  await page.locator('#forms-onboard-banner button', { hasText: 'Wróć do checklisty' }).click({ force: true });
  await page.waitForTimeout(700);
  ok('back from forms', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("Ustaw dni")');
  await page.waitForSelector('#m-onboard-schedule.show');
  const sched = await page.evaluate(() => {
    const clientModal = document.getElementById('m-client');
    const chips = document.querySelectorAll('#ob-sched-preferred-weekdays .preferred-weekday-chip');
    return {
      clientEdit: !!(clientModal && clientModal.classList.contains('show')),
      chips: chips.length
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_schedule.png') });
  ok('schedule picker not full edit', !sched.clientEdit && sched.chips >= 7, JSON.stringify(sched));

  await page.click('#m-onboard-schedule .modal-footer button:has-text("Zapisz dni")');
  await page.waitForTimeout(200);
  const afterDays = await page.evaluate(() => {
    const c = (window.CL || [])[0] || {};
    const st = typeof getClientOnboard === 'function' ? getClientOnboard(c) : {};
    return { schedule: !!st.schedule, days: (c.preferredWeekdays || []).slice() };
  });
  ok('schedule saved', afterDays.schedule && afterDays.days.length >= 1, JSON.stringify(afterDays));

  await page.click('#client-onboard-steps button:has-text("Szablon / kreator")');
  await page.waitForTimeout(350);
  const builder = await page.evaluate(() => {
    const screen = document.getElementById('screen-builder');
    const sel = document.getElementById('b-client');
    return {
      active: !!(screen && screen.classList.contains('active')),
      client: sel ? sel.value : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_builder.png') });
  ok('builder opens with client', builder.active && builder.client === 'c-ewelina', JSON.stringify(builder));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll onboard flow UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
