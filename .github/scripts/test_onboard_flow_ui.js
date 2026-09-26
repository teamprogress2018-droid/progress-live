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

  const inviteCta = page.locator('#client-onboard-steps button', { hasText: /E-mail/ });
  await inviteCta.click();
  await page.waitForSelector('#m-invite.show');
  await page.waitForFunction(() => {
    const link = document.getElementById('inv-link');
    const t = (link && link.textContent) || '';
    return t && !/Generowanie/.test(t);
  });
  const inviteUi = await page.evaluate(() => {
    const btn = document.getElementById('inv-send-btn');
    const hint = document.getElementById('inv-channel-hint');
    const emailBtn = [...document.querySelectorAll('.inv-method-btn')].find(b => b.dataset.method === 'email');
    const msgBtn = [...document.querySelectorAll('.inv-method-btn')].find(b => b.dataset.method === 'wiadomosc');
    return {
      send: (btn && btn.textContent) || '',
      hint: (hint && hint.textContent) || '',
      emailColor: emailBtn ? emailBtn.style.color : '',
      msgColor: msgBtn ? msgBtn.style.color : '',
      emailActive: !!(emailBtn && emailBtn.classList.contains('active'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_invite_gmail.png') });
  ok('invite opened from onboard', /Gmail/i.test(inviteUi.send) && inviteUi.emailActive, JSON.stringify(inviteUi));
  ok('invite email is default', /Gmail|e-mail/i.test(inviteUi.hint), inviteUi.hint);

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

  await page.click('#client-onboard-steps button:has-text("Zapisz pomiary")');
  await page.waitForSelector('#m-baseline.show');
  const baselineUi = await page.evaluate(() => {
    const bar = document.getElementById('bl-onboard-banner');
    const onboard = document.getElementById('m-client-onboard');
    return {
      banner: !!(bar && bar.style.display !== 'none' && /Ewelina/.test(bar.innerText || '')),
      checklistClosed: !(onboard && onboard.classList.contains('show')),
      flag: window._onboardResumeAfterBaseline === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_baseline.png') });
  ok('baseline from onboard + banner', baselineUi.banner && baselineUi.checklistClosed && baselineUi.flag, JSON.stringify(baselineUi));

  await page.locator('#m-baseline .modal-footer button', { hasText: 'Anuluj' }).click();
  await page.waitForTimeout(700);
  ok('baseline cancel resumes checklist', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("Ustaw dni")');
  await page.waitForSelector('#m-onboard-schedule.show');
  const sched = await page.evaluate(() => {
    const clientModal = document.getElementById('m-client');
    const chips = document.querySelectorAll('#ob-sched-preferred-weekdays .preferred-weekday-chip');
    const bar = document.getElementById('sched-onboard-banner');
    const onboard = document.getElementById('m-client-onboard');
    return {
      clientEdit: !!(clientModal && clientModal.classList.contains('show')),
      chips: chips.length,
      banner: !!(bar && bar.style.display !== 'none' && /Ewelina/.test(bar.innerText || '')),
      checklistClosed: !(onboard && onboard.classList.contains('show')),
      flag: window._onboardResumeAfterSchedule === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_schedule.png') });
  ok('schedule picker not full edit', !sched.clientEdit && sched.chips >= 7 && sched.banner && sched.checklistClosed && sched.flag, JSON.stringify(sched));

  await page.click('#m-onboard-schedule .modal-footer button:has-text("Zapisz dni")');
  await page.waitForTimeout(700);
  const afterDays = await page.evaluate(() => {
    const c = (window.CL || [])[0] || {};
    const st = typeof getClientOnboard === 'function' ? getClientOnboard(c) : {};
    return { schedule: !!st.schedule, days: (c.preferredWeekdays || []).slice() };
  });
  ok('schedule saved', afterDays.schedule && afterDays.days.length >= 1, JSON.stringify(afterDays));

  await page.click('#client-onboard-steps button:has-text("Trening Live")');
  await page.waitForTimeout(500);
  const live = await page.evaluate(() => {
    const screen = document.getElementById('screen-live');
    const banner = document.getElementById('live-onboard-banner');
    const vis = document.getElementById('live-client-sel-search');
    return {
      active: !!(screen && screen.classList.contains('active')),
      banner: !!(banner && banner.style.display !== 'none' && /Ewelina/.test(banner.innerText || '')),
      client: vis ? vis.value : '',
      flag: window._onboardResumeAfterLive === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_live.png') });
  ok('live from onboard + banner', live.active && live.banner && live.flag && /Ewelina/.test(live.client), JSON.stringify(live));

  await page.waitForFunction(() => [...document.querySelectorAll('#screen-live button')].some(b => /Generuj plan AI/.test(b.textContent || '')));
  await page.locator('#screen-live button', { hasText: 'Generuj plan AI' }).click();
  await page.waitForTimeout(450);
  const liveApl = await page.evaluate(() => {
    const screen = document.getElementById('screen-aiplangen');
    const banner = document.getElementById('apl-onboard-banner');
    const liveBan = document.getElementById('live-onboard-banner');
    const sel = document.getElementById('apl-client');
    return {
      active: !!(screen && screen.classList.contains('active')),
      banner: !!(banner && banner.style.display !== 'none' && /Ewelina/.test(banner.innerText || '')),
      liveBannerOff: !(liveBan && liveBan.style.display !== 'none' && (liveBan.innerText || '').trim()),
      client: sel ? sel.value : '',
      aplFlag: window._onboardResumeAfterApl === 'c-ewelina',
      liveFlag: window._onboardResumeAfterLive
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_live_apl.png') });
  ok('live empty plan opens AI with onboard banner', liveApl.active && liveApl.banner && liveApl.aplFlag && liveApl.client === 'c-ewelina' && !liveApl.liveFlag, JSON.stringify(liveApl));

  await page.locator('#apl-onboard-banner button', { hasText: 'Wróć do checklisty' }).click({ force: true });
  await page.waitForTimeout(700);
  ok('back from live→AI', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("Szablon / kreator")');
  await page.waitForTimeout(350);
  const builder = await page.evaluate(() => {
    const screen = document.getElementById('screen-builder');
    const sel = document.getElementById('b-client');
    return {
      active: !!(screen && screen.classList.contains('active')),
      client: sel ? sel.value : '',
      banner: !!((document.getElementById('builder-onboard-banner') || {}).innerText || '').match(/Ewelina/)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_builder.png') });
  ok('builder opens with client + banner', builder.active && builder.client === 'c-ewelina' && builder.banner, JSON.stringify(builder));

  await page.locator('#builder-onboard-banner button', { hasText: 'Wróć do checklisty' }).click({ force: true });
  await page.waitForTimeout(700);
  ok('back from builder', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("Plan AI")');
  await page.waitForTimeout(400);
  const apl = await page.evaluate(() => {
    const screen = document.getElementById('screen-aiplangen');
    const banner = document.getElementById('apl-onboard-banner');
    const sel = document.getElementById('apl-client');
    return {
      active: !!(screen && screen.classList.contains('active')),
      banner: !!(banner && banner.style.display !== 'none' && /Ewelina/.test(banner.innerText || '')),
      client: sel ? sel.value : '',
      flag: window._onboardResumeAfterApl === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_apl.png') });
  ok('AI plan from onboard + banner', apl.active && apl.banner && apl.flag && apl.client === 'c-ewelina', JSON.stringify(apl));

  await page.locator('#apl-onboard-banner button', { hasText: 'Wróć do checklisty' }).click({ force: true });
  await page.waitForTimeout(700);
  ok('back from AI plan', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("+ Pakiet")');
  await page.waitForSelector('#m-package.show');
  const pkgUi = await page.evaluate(() => {
    const bar = document.getElementById('pkg-onboard-banner');
    const sel = document.getElementById('pkg-client');
    return {
      banner: !!(bar && bar.style.display !== 'none' && /Ewelina/.test(bar.innerText || '')),
      client: sel ? sel.value : '',
      flag: window._onboardResumeAfterPackage === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_package.png') });
  ok('package from onboard + banner', pkgUi.banner && pkgUi.flag && pkgUi.client === 'c-ewelina', JSON.stringify(pkgUi));

  await page.locator('#m-package .modal-footer button', { hasText: 'Anuluj' }).click();
  await page.waitForTimeout(700);
  ok('package cancel resumes checklist', await page.locator('#m-client-onboard.show').isVisible());

  await page.click('#client-onboard-steps button:has-text("Wyślij ankietę")');
  await page.waitForTimeout(200);
  const pendingForm = await page.evaluate(() => {
    const steps = (document.getElementById('client-onboard-steps') || {}).innerText || '';
    return { waiting: /Czeka na odpowiedź klienta/.test(steps), profile: /Formularze/.test(steps) };
  });
  ok('intake send shows forms cta', pendingForm.waiting && pendingForm.profile, JSON.stringify(pendingForm));

  await page.click('#client-onboard-steps button:has-text("Formularze")');
  await page.waitForTimeout(400);
  const profileUi = await page.evaluate(() => {
    const drawer = document.getElementById('cp-drawer');
    const bar = document.getElementById('cp-onboard-banner');
    const forms = document.getElementById('cpt-forms');
    const more = document.getElementById('cp-more-toggle');
    return {
      open: !!(drawer && drawer.classList.contains('open')),
      banner: !!(bar && bar.style.display !== 'none' && /Ewelina/.test(bar.innerText || '')),
      forms: !!(forms && forms.classList.contains('active')),
      more: !!(more && more.classList.contains('active')),
      flag: window._onboardResumeAfterProfile === 'c-ewelina'
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_profile.png') });
  ok('profile from onboard + banner', profileUi.open && profileUi.banner && profileUi.flag && (profileUi.forms || profileUi.more), JSON.stringify(profileUi));

  await page.locator('#cp-drawer button', { hasText: '← Wróć' }).click();
  await page.waitForTimeout(700);
  ok('profile back resumes checklist', await page.locator('#m-client-onboard.show').isVisible());

  await page.evaluate(() => {
    if (Array.isArray(window.FORM_SENDS)) window.FORM_SENDS.splice(0, window.FORM_SENDS.length);
    if (typeof closeM === 'function') closeM('m-client-onboard');
    if (typeof goTo === 'function') goTo('onboarding');
  });
  await page.waitForTimeout(500);
  const overview = await page.evaluate(() => {
    const tab = document.getElementById('onb-overview-tab');
    const html = (tab && tab.innerHTML) || '';
    const screen = document.getElementById('screen-onboarding');
    return {
      active: !!(screen && screen.classList.contains('active')),
      hasConfirm: /Potwierdź krok/.test(html),
      hasFakeEmpty: /Bez onboardingu/.test(html),
      hasEwelina: /Ewelina/.test(html),
      hasChecklistCta: /Dokończ|Checklista/.test(html),
      hasRealCopy: /ta sama checklista/i.test(html)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_overview.png') });
  ok('overview is real checklist board', overview.active && overview.hasEwelina && overview.hasChecklistCta && overview.hasRealCopy && !overview.hasConfirm && !overview.hasFakeEmpty, JSON.stringify(overview));

  await page.click('#onb-tab-settings');
  await page.waitForTimeout(200);
  const settingsUi = await page.evaluate(() => {
    const tab = document.getElementById('onb-settings-tab');
    const html = (tab && tab.innerHTML) || '';
    const vis = !!(tab && tab.style.display !== 'none');
    return {
      vis,
      hasWelcomeCb: /onb-msg-step/.test(html) || /Powitanie/.test(html),
      hasAnkietaCb: /Ankieta wstępna/.test(html),
      hasKontraktCb: />Kontrakt</.test(html),
      hasInvite: /Zaproszenie/.test(html),
      hasBaseline: /Pomiary/.test(html),
      hasAutomation: /Otwórz Automatyzację/.test(html),
      honestRemind: /nie wysyła ich sama/.test(html),
      honestContract: /nie jest automatycznie wysyłany/.test(html)
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_settings.png') });
  ok('settings shows 6-step legend not fake msg checkboxes', settingsUi.vis && settingsUi.hasInvite && settingsUi.hasBaseline && settingsUi.hasAutomation && settingsUi.honestRemind && settingsUi.honestContract && !settingsUi.hasWelcomeCb && !settingsUi.hasAnkietaCb && !settingsUi.hasKontraktCb, JSON.stringify(settingsUi));
  await page.click('#onb-tab-overview');
  await page.waitForTimeout(200);

  await page.click('#onb-overview-tab button:has-text("+ Nowy klient")');
  await page.waitForSelector('#m-client.show');
  const newClientUi = await page.evaluate(() => {
    const modal = document.getElementById('m-client');
    const wizardTab = document.getElementById('onb-new-tab');
    const title = ((modal && modal.querySelector('.modal-title')) || {}).textContent || '';
    return {
      modal: !!(modal && modal.classList.contains('show')),
      title,
      wizardVisible: !!(wizardTab && wizardTab.offsetParent),
      tabHidden: !document.getElementById('onb-tab-new') && !wizardTab
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_new_client_modal.png') });
  ok('overview new client opens same card', newClientUi.modal && /NOWY KLIENT/i.test(newClientUi.title) && !newClientUi.wizardVisible && newClientUi.tabHidden, JSON.stringify(newClientUi));

  await page.click('#m-client .modal-footer button:has-text("Anuluj")');
  await page.waitForTimeout(200);
  ok('cancel new client stays on overview', await page.evaluate(() => {
    const screen = document.getElementById('screen-onboarding');
    const modal = document.getElementById('m-client');
    return !!(screen && screen.classList.contains('active') && modal && !modal.classList.contains('show'));
  }));

  await page.click('#onb-overview-tab button:has-text("Dokończ")');
  await page.waitForSelector('#m-client-onboard.show');
  const fromOverview = await page.evaluate(() => {
    const steps = document.getElementById('client-onboard-steps');
    const t = (steps && steps.innerText) || '';
    return { waiting: /Czeka na odpowiedź klienta/.test(t), send: /Wyślij ankietę/.test(t) };
  });
  await page.screenshot({ path: path.join(shotDir, 'onboard_from_overview.png') });
  ok('overview CTA opens checklist without auto-form', fromOverview.send && !fromOverview.waiting, JSON.stringify(fromOverview));

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
