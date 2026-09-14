// UI: ankieta slim, plan CTAs, WhatsApp copy, homework names, live client switch.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.ONBOARD_UX_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-onboard-ux'));
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

  const boot = await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const a = { id: 'c-aga', name: 'Aga Test', status: 'active', email: 'aga@studio.pl', phone: '500100200' };
    const p = { id: 'c-piotr', name: 'Piotr Urbaniak', status: 'active', email: 'piotr@studio.pl', phone: '692335692' };
    window.CL = [a, p];
    window.PL = [{
      id: 'pl-piotr', clientId: 'c-piotr', name: 'FBW Siła 4×/tydzień — Piotr Urbaniak',
      days: [{ day: 'D1', rest: false, exercises: [{ name: 'Rozpiętki', sets: '4', reps: '10' }] }]
    }, {
      id: 'pl-aga', clientId: 'c-aga', name: 'Plan Agi',
      days: [{ day: 'D1', rest: false, exercises: [{ name: 'Przysiad Goblet', sets: '4', reps: '10' }] }]
    }];
    window.SE = [];
    window.PACKAGES = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('clients');
    if (typeof openClientProfile === 'function') openClientProfile('c-piotr');
    if (typeof startCPEdit === 'function') startCPEdit('c-piotr');
    const edit = document.getElementById('cp-edit-card');
    const t = (edit && edit.innerText) || '';
    return {
      hasBanner: /Ankieta wstępna/.test(t),
      hasOpen: /Otwórz ankietę/.test(t),
      hasPdf: /PDF blank/.test(t),
      hasForms: /Formularze/.test(t)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ux_profile_edit_ankieta.png') });
  ok('profile edit slim ankieta', boot.hasBanner && boot.hasForms && !boot.hasOpen && !boot.hasPdf, JSON.stringify(boot));

  const planUi = await page.evaluate(() => {
    if (typeof setCPTab === 'function') setCPTab('plan');
    const body = document.getElementById('cp-body');
    const t = (body && body.innerText) || '';
    return {
      hasPlan: /FBW Siła/.test(t),
      hasTpl: /Przypisz szablon/.test(t),
      hasAi: /Generuj plan AI/.test(t),
      hasFitebo: /Kontynuuj plan z Fitebo/.test(t)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'ux_plan_tab_no_ctas.png') });
  ok('plan tab hides CTAs when plan exists', planUi.hasPlan && !planUi.hasTpl && !planUi.hasAi && !planUi.hasFitebo, JSON.stringify(planUi));

  await page.evaluate(() => {
    if (typeof closeClientProfile === 'function') closeClientProfile();
    if (typeof goTo === 'function') goTo('live');
    if (typeof liveClientSetField === 'function') liveClientSetField('c-aga', 'Aga Test');
  });
  await page.waitForTimeout(200);
  const afterAga = await page.evaluate(() => {
    const t = ((document.getElementById('live-exercises-panel') || {}).innerText || '') + ((document.getElementById('live-client-card') || {}).innerText || '');
    return { goblet: /Przysiad Goblet/.test(t), rozpi: /Rozpiętki/.test(t), aga: /Aga Test/.test(t) };
  });
  await page.evaluate(() => {
    if (typeof liveClientSetField === 'function') liveClientSetField('c-piotr', 'Piotr Urbaniak');
  });
  await page.waitForTimeout(250);
  const afterPiotr = await page.evaluate(() => {
    const t = ((document.getElementById('live-exercises-panel') || {}).innerText || '') + ((document.getElementById('live-client-card') || {}).innerText || '');
    return { goblet: /Przysiad Goblet/.test(t), rozpi: /Rozpiętki/.test(t), piotr: /Piotr Urbaniak/.test(t) };
  });
  await page.screenshot({ path: path.join(shotDir, 'ux_live_piotr_plan.png') });
  ok('live loads Aga goblet first', afterAga.goblet && afterAga.aga && !afterAga.rozpi, JSON.stringify(afterAga));
  ok('live switches to Piotr plan', afterPiotr.rozpi && afterPiotr.piotr && !afterPiotr.goblet, JSON.stringify(afterPiotr));

  await page.evaluate(() => {
    if (typeof goTo === 'function') goTo('tasks');
    if (typeof setTaskFilter === 'function') setTaskFilter('homework');
  });
  await page.waitForTimeout(200);
  const hw = await page.evaluate(() => {
    const t = (document.getElementById('tasks-list') && document.getElementById('tasks-list').innerText) || '';
    const opt = [...document.querySelectorAll('#task-client-filter option')].map(o => o.textContent);
    if (typeof openAssignHomeworkModal === 'function') openAssignHomeworkModal('');
    const box = document.getElementById('ahw-client-list');
    const labels = box ? box.innerText : '';
    return { empty: /Klienci:/.test(t) && /Aga Test/.test(t) && /Piotr Urbaniak/.test(t), filter: opt, modal: /Aga Test/.test(labels) && /Piotr Urbaniak/.test(labels) };
  });
  await page.screenshot({ path: path.join(shotDir, 'ux_homework_names.png') });
  ok('homework shows all names', hw.empty && hw.modal && hw.filter.indexOf('Aga Test') >= 0 && hw.filter.indexOf('Piotr Urbaniak') >= 0, JSON.stringify(hw));

  await page.evaluate(() => {
    if (typeof closeM === 'function') closeM('m-assign-homework');
    if (typeof openInviteModal === 'function') openInviteModal('c-piotr');
  });
  await page.waitForTimeout(300);
  await page.click('.inv-method-btn[data-method="whatsapp"]');
  const wa = await page.evaluate(() => {
    const send = (document.getElementById('inv-send-btn') && document.getElementById('inv-send-btn').textContent) || '';
    const extra = document.getElementById('inv-open-wa-btn');
    const hint = (document.getElementById('inv-channel-hint') && document.getElementById('inv-channel-hint').textContent) || '';
    return { send, extra: !!(extra && extra.style.display !== 'none'), hint };
  });
  await page.screenshot({ path: path.join(shotDir, 'ux_whatsapp_copy.png') });
  ok('whatsapp copy is primary', /Kopiuj/.test(wa.send) && wa.extra && /schowka|wklej/i.test(wa.hint), JSON.stringify(wa));

  await page.evaluate(() => {
    if (typeof closeM === 'function') closeM('m-invite');
    window.aplLastPlan = {
      planName: 'Test auto save',
      method: 'FBW',
      weeks: 4,
      daysPerWeek: 1,
      weekKeys: ['w1'],
      currentWeek: 'w1',
      days: [{ dayName: 'D1', focus: 'FBW', exercises: [{ name: 'Plank', sets: '3', reps: '30s' }] }]
    };
    window._onboardResumeAfterApl = 'c-aga';
    window.PL = (window.PL || []).filter(p => p.clientId !== 'c-aga');
    const sel = document.getElementById('apl-client');
    if (sel) {
      sel.innerHTML = '<option value="c-aga">Aga Test</option><option value="c-piotr">Piotr</option>';
      sel.value = 'c-aga';
    }
    if (typeof resumeOnboardFromApl === 'function') resumeOnboardFromApl();
  });
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => ({
    has: (window.PL || []).some(p => p.clientId === 'c-aga' && /Test auto save/.test(p.name || '')),
    checklist: !!(document.getElementById('m-client-onboard') && document.getElementById('m-client-onboard').classList.contains('show'))
  }));
  ok('apl back saves plan for client', saved.has, JSON.stringify(saved));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll onboard UX UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
