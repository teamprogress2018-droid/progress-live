// Browser coverage for the real New Client button and its awaited pipeline.
'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Warsaw' });
    page.setDefaultTimeout(20000);
    await page.route('https://www.gstatic.com/firebasejs/**', route => route.abort());
    await page.route('**://firestore.googleapis.com/**', route => route.abort());
    await page.goto('http://' + (process.env.LAYOUT_HOST || '127.0.0.1') + ':' +
      (process.env.LAYOUT_PORT || '8080') + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.saveClient === 'function' &&
      typeof window.assignClientPipeline === 'function' &&
      typeof window.openClientOnboardChecklist === 'function' &&
      typeof window.runOnboardingForClient === 'function' && typeof window.notify === 'function');
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const f = window._pipelineCalendarUi = { owner: 'pipeline-ui-owner',
        pending: {}, writes: [], calendar: [], notices: [], notifications: [], events: [],
        legacy: [], calendarResult: 'error' };
      window._db = { fixture: true };
      window._uid = f.owner;
      window.tenantSessionGeneration = (window.tenantSessionGeneration || 0) + 1;
      window._tenantDataReady = true;
      window._clientAppMode = false;
      window._clientPreviewMode = false;
      window._afStateReady = false;
      window.SETTINGS = { ...(window.SETTINGS || {}), notifications: {
        ...((window.SETTINGS || {}).notifications || {}), weeklyCheckin: false } };
      window.CL = []; window.PL = []; window.SE = []; window.PACKAGES = []; window.TASKS = [];
      window.CHECKINS = {}; window.FORM_SENDS = [];
      window.ONBOARDING_FLOW = { id: 'flow-ui', active: true, assignEnabled: true,
        formsEnabled: false, msgEnabled: false, ondemandEnabled: false, recipesEnabled: false,
        programId: 'program-ui', history: [] };
      window.allPrograms = () => [{ id: 'program-ui', name: 'Program testowy', duration: 4,
        weeks: [{ days: [{ d: 'Pon', name: 'Nogi' }] }] }];
      window.planDaysFromProgram = () => [{ day: 'PON', rest: false,
        exercises: [{ name: 'Przysiad', sets: 3, reps: 8 }] }];
      window.enrollNewClientInAutoflows = () => {};
      window.renderAll = () => {};
      window.renderClients = () => {};
      window.renderDash = () => {};
      window.addNotification = (...args) => f.notifications.push(args);
      window.emitAppEvent = (...args) => f.events.push(args);
      const actualNotify = window.notify;
      window.notify = message => { f.notices.push(String(message)); actualNotify(message); };
      window.maybeSchedulePlanToCalendar = (...args) => {
        f.legacy.push(args); throw new Error('Legacy calendar scheduler called');
      };
      window.schedulePlanToCalendar = (...args) => {
        f.legacy.push(args); throw new Error('Legacy calendar scheduler called');
      };
      window.persistById = (collection, entry) => {
        f.writes.push({ collection, id: entry && entry.id });
        if (collection !== 'clients' && collection !== 'plans') return Promise.resolve(entry);
        if (f.pending[collection]) throw new Error('Unexpected parallel ' + collection + ' write');
        return new Promise(resolve => {
          f.pending[collection] = {
            id: entry.id,
            succeed() { delete f.pending[collection]; resolve(entry); }
          };
        });
      };
      window.refillCalendarConfirmed = (clientId, opts) => {
        f.calendar.push({ clientId, opts });
        if (f.pending.calendar) throw new Error('Unexpected parallel calendar call');
        return new Promise(resolve => {
          f.pending.calendar = {
            succeed() {
              delete f.pending.calendar;
              if (f.calendarResult === 'error') {
                resolve({ status: 'error', added: 0, error: 'Połączenie testowe przerwane' });
              } else {
                window.SE.push({ id: 'confirmed-' + clientId, clientId,
                  trainerId: f.owner, planId: opts.planId, source: 'planned', date: '2026-10-05' });
                resolve({ status: 'saved', added: 1 });
              }
            }
          };
        });
      };
      ['auth-screen', 'app-loading'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      document.getElementById('app-root').style.display = '';
    });

    const state = () => page.evaluate(() => {
      const f = window._pipelineCalendarUi;
      const client = window.CL.at(-1);
      return { clientId: client && client.id, plans: window.PL.filter(p => p.clientId === client?.id).length,
        sessions: window.SE.filter(s => s.clientId === client?.id).length,
        writes: f.writes, calendar: f.calendar, notices: f.notices,
        created: f.events.filter(event => event[0] === 'client.created').length,
        checklistOpen: document.getElementById('m-client-onboard').classList.contains('show'),
        calendarDone: client ? getClientOnboard(client).calendar : false,
        legacy: f.legacy.length };
    });
    const pending = collection => page.waitForFunction(col => !!window._pipelineCalendarUi.pending[col], collection);
    const release = collection => page.evaluate(col => window._pipelineCalendarUi.pending[col].succeed(), collection);
    const save = async (name, email) => {
      await page.evaluate(() => { window._saveGuard_saveClient = false; closeM('m-client-onboard'); openClientModal(); });
      await page.locator('#ac-name').fill(name);
      await page.locator('#ac-email').fill(email);
      await page.locator('#m-client button[onclick="saveClient()"]').click();
    };

    await save('Klient Błąd Kalendarza', 'pipeline-error@example.test');
    await pending('clients');
    let value = await state();
    assert.equal(value.plans, 0);
    assert.equal(value.calendar.length, 0);
    assert.equal(value.checklistOpen, false);
    assert.equal(value.notices.some(message => message.includes('✅ Klient')), false);
    await release('clients');
    await pending('plans');
    value = await state();
    assert.equal(value.plans, 0, 'unacknowledged plan is absent from PL');
    assert.equal(value.calendar.length, 0);
    assert.equal(value.checklistOpen, false);
    await release('plans');
    await pending('calendar');
    value = await state();
    assert.equal(value.plans, 1);
    assert.equal(value.sessions, 0);
    assert.equal(value.calendarDone, false);
    assert.equal(value.notices.some(message => message.includes('✅ Klient')), false);
    await release('calendar');
    await page.waitForFunction(() => window._pipelineCalendarUi.notices.some(message =>
      message.includes('Kalendarz wymaga ponowienia')));
    assert.match(await page.locator('.notif').innerText(), /Kalendarz wymaga ponowienia/);
    value = await state();
    assert.equal(value.calendarDone, false);
    assert.equal(value.created, 1);
    assert.equal(value.notices.some(message => message.includes('✅ Klient')), false);
    assert.equal(value.legacy, 0);
    await page.waitForFunction(() => document.getElementById('m-client-onboard').classList.contains('show'));
    console.log('PASS real saveClient waits for client, plan, and failed calendar acknowledgement');

    await page.evaluate(() => { window._pipelineCalendarUi.calendarResult = 'saved'; });
    await save('Klient Potwierdzony', 'pipeline-saved@example.test');
    await pending('clients'); await release('clients');
    await pending('plans'); await release('plans');
    await pending('calendar');
    value = await state();
    assert.equal(value.sessions, 0);
    assert.equal(value.calendarDone, false);
    await release('calendar');
    await page.waitForFunction(() => window._pipelineCalendarUi.notices.some(message =>
      message.includes('✅ Klient Klient Potwierdzony zapisany!')));
    await page.waitForFunction(() => document.getElementById('m-client-onboard').classList.contains('show') &&
      getClientOnboard(window.CL.at(-1)).calendar);
    value = await state();
    assert.equal(value.plans, 1);
    assert.equal(value.sessions, 1);
    assert.equal(value.calendarDone, true);
    assert.equal(value.checklistOpen, true);
    assert.equal(value.created, 2);
    assert.equal(value.legacy, 0);
    assert.match(await page.locator('#client-onboard-steps').innerText(), /Kalendarz|terminy/i);
    console.log('PASS confirmed calendar opens the real completed checklist');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
