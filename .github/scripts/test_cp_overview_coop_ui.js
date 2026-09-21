// UI: Przegląd — Analiza współpracy pod SYTUACJĄ, AI tylko na żądanie.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CP_COOP_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cp-coop'));
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
  await page.waitForTimeout(700);

  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window.notify = () => {};
    window.__coopFetch = 0;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (url, opts) => {
      window.__coopFetch += 1;
      const body = String((opts && opts.body) || '');
      window.__coopLastBody = body;
      if (/Przeanalizuj współpracę/.test(body) || /trzech sekcjach/.test(body) || /współpracę z tym klientem/.test(body)) {
        return {
          json: async () => ({
            content: [{
              text: '1. Interpretacja\nTreningi są, ale check-in słabszy — to może oznaczać zmęczenie albo zbyt ciasny plan, niekoniecznie regres.\n\n2. Do rozważenia\n- Dopytać o sen i stres poza siłownią\n- Rozważyć krótsze sesje przez kilka dni\n- Poczekać na kolejny pomiar siły\n\n3. Sprawdź przed decyzją\n- Czy klient realnie ogarnia 4 dni?\n- Brak trendu siły'
            }]
          })
        };
      }
      return origFetch(url, opts);
    };
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    const saver = document.getElementById('screensaver');
    if (saver) saver.style.display = 'none';
    const ymd = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    const addDays = n => {
      const d = new Date(ymd + 'T12:00:00');
      d.setDate(d.getDate() + n);
      const p = x => String(x).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };
    window.CL = [
      {
        id: 'c-coop',
        name: 'Adam Siła',
        goal: 'sila',
        status: 'active',
        level: 'sredni',
        injuries: '',
        notes: 'nie do analizy'
      },
      { id: 'c-new', name: 'Nowy Klient', goal: 'sila', status: 'active', injuries: '', notes: 'ukryte' }
    ];
    window.PL = [{ id: 'pl1', clientId: 'c-coop', name: 'Siła FBW', method: 'FBW', createdAt: addDays(-40) + 'T10:00:00' }];
    window.SE = [
      { id: 's-today', clientId: 'c-coop', date: ymd, time: '18:00', source: 'planned', type: 'Dzień A' },
      {
        id: 's-live', clientId: 'c-coop', date: addDays(-3), source: 'live', type: 'FBW A',
        exercises: [{ name: 'Przysiad', sets: [{ kg: 100, reps: 5, kind: 'work' }] }],
        feedback: 4
      },
      { id: 's-gar', clientId: 'c-coop', date: addDays(-1), source: 'garmin', type: 'Bieg 8 km' }
    ];
    window.CHECKINS = {
      'c-coop': [{ id: 'ci-f', status: 'filled', date: addDays(-2), answers: { sleep: 3, energy: 2, stress: 4 } }],
      'c-new': []
    };
    window.CLIENT_NOTES = { 'c-coop': [], 'c-new': [] };
    window.TASKS = [];
    window.METRIC_ENTRIES = [];
    window.CLIENT_TIMELINE = { 'c-coop': [], 'c-new': [] };
    window.PACKAGES = [];
    window.INVOICES = [];
    if (typeof openClientProfile === 'function') openClientProfile('c-coop');
  });

  await page.waitForSelector('#cp-drawer.open');
  await page.waitForSelector('.cp-ov-coop');
  await page.waitForTimeout(250);

  const idle = await page.evaluate(() => {
    const coop = document.querySelector('.cp-ov-coop');
    const sit = document.querySelector('.cp-ov-situation');
    const brief = document.querySelector('.cp-ov-brief');
    const cr = coop ? coop.getBoundingClientRect() : null;
    const sr = sit ? sit.getBoundingClientRect() : null;
    const br = brief ? brief.getBoundingClientRect() : null;
    return {
      kicker: (document.querySelector('.cp-ov-coop-kicker') || {}).textContent || '',
      cta: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
      sigs: document.querySelectorAll('.cp-ov-coop-sig').length,
      text: (coop && coop.textContent || '').replace(/\s+/g, ' '),
      afterSit: !!(cr && sr && cr.top >= sr.bottom - 2),
      briefBeforeSit: !!(br && sr && br.bottom <= sr.top + 4),
      nextStill: !!document.querySelector('.cp-ov-next'),
      sitKpis: !!document.querySelector('.cp-ov-sit-tile'),
      fetch: window.__coopFetch || 0,
      volumeOrder: coop ? /20–30%|Skróć objętość/.test(coop.textContent || '') : true
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_coop_idle.png') });

  ok('coop under situation', idle.afterSit, JSON.stringify({ afterSit: idle.afterSit }));
  ok('brief still above situation', idle.briefBeforeSit);
  ok('situation remains', idle.sitKpis && idle.nextStill);
  ok('kicker', /Analiza współpracy/i.test(idle.kicker));
  ok('cta professional', /Przeanalizuj współpracę/.test(idle.cta) && !/Co by zmieniło AI/.test(idle.cta));
  ok('max 3 signals', idle.sigs <= 3);
  ok('no auto fetch on open', idle.fetch === 0, String(idle.fetch));
  ok('no volume command idle', !idle.volumeOrder);

  await page.click('[data-cp-coop-cta="run"]');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const coop = document.querySelector('.cp-ov-coop');
    const secs = [...document.querySelectorAll('[data-cp-coop-sec]')].map(el => el.getAttribute('data-cp-coop-sec'));
    return {
      fetch: window.__coopFetch || 0,
      secs,
      text: (coop && coop.textContent || '').replace(/\s+/g, ' '),
      legal: !!(coop && /nie jest decyzja/i.test(coop.textContent || '')),
      notesLeak: !!(coop && /nie do analizy/.test(coop.textContent || '')),
      rerun: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
      bodyHasVolume: /zmniejsz objętość o 20/i.test((coop && coop.textContent) || '')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_coop_after_ai.png') });
  ok('one fetch after click', after.fetch === 1, String(after.fetch));
  ok('three sections', after.secs.join(',') === 'interp,consider,check', after.secs.join(','));
  ok('interpretation shown', /zmęczenie|plan/.test(after.text));
  ok('options not orders', /Dopytać o sen/.test(after.text) && !after.bodyHasVolume);
  ok('legal line', after.legal);
  ok('notes not leaked', !after.notesLeak);
  ok('cta becomes rerun', /Ponów/.test(after.rerun));

  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-new');
  });
  await page.waitForTimeout(400);
  const empty = await page.evaluate(() => {
    const coop = document.querySelector('.cp-ov-coop');
    return {
      gated: !!(document.querySelector('[data-cp-coop-state="gated"]')),
      copy: (document.querySelector('.cp-ov-coop-empty') || {}).textContent || '',
      cta: !!document.querySelector('[data-cp-coop-cta="run"]'),
      fetch: window.__coopFetch || 0,
      sit: !!document.querySelector('.cp-ov-situation')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_coop_gated.png') });
  ok('new client gated', empty.gated && /Za mało danych do interpretacji/.test(empty.copy));
  ok('new client no cta', !empty.cta);
  ok('new client no extra fetch', empty.fetch === 1, String(empty.fetch));
  ok('situation remains empty client', empty.sit);

  await page.evaluate(() => {
    const ymd = typeof todayYmd === 'function' ? todayYmd() : new Date().toISOString().slice(0, 10);
    const addDays = n => {
      const d = new Date(ymd + 'T12:00:00');
      d.setDate(d.getDate() + n);
      const p = x => String(x).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    };
    window.CL.push(
      { id: 'c-one', name: 'Ola Jeden', goal: 'sila', status: 'active', injuries: '', notes: '' },
      { id: 'c-pair', name: 'Adam Para', goal: 'sila', status: 'active', injuries: '', notes: 'tajne' },
      { id: 'c-mass', name: 'Ewa Masa', goal: 'masa', status: 'active', injuries: '', notes: '' }
    );
    window.SE.push(
      { id: 's-one', clientId: 'c-one', date: addDays(-2), source: 'live', type: 'FBW' },
      { id: 's-pair', clientId: 'c-pair', date: addDays(-2), source: 'live', type: 'FBW A',
        exercises: [{ name: 'Przysiad', sets: [{ kg: 100, reps: 5, kind: 'work' }] }] }
    );
    window.CHECKINS['c-one'] = [];
    window.CHECKINS['c-pair'] = [{ id: 'ci-p', status: 'filled', date: addDays(-1), answers: { sleep: 3, energy: 2 } }];
    window.CHECKINS['c-mass'] = [];
    window.METRIC_ENTRIES = window.METRIC_ENTRIES || [];
    window.METRIC_ENTRIES.push(
      { clientId: 'c-mass', groupId: 'mg1', date: addDays(-20), values: { m1: 70 } },
      { clientId: 'c-mass', groupId: 'mg1', date: addDays(-2), values: { m1: 71.2 } }
    );
    window.__persistCalls = 0;
    const prevPersist = window.persistById;
    window.persistById = async function () {
      window.__persistCalls += 1;
      return prevPersist.apply(this, arguments);
    };
  });

  await page.evaluate(() => openClientProfile('c-one'));
  await page.waitForTimeout(300);
  const oneSig = await page.evaluate(() => ({
    gated: !!(document.querySelector('[data-cp-coop-state="gated"]')),
    cta: !!document.querySelector('[data-cp-coop-cta="run"]'),
    fetch: window.__coopFetch || 0,
    brief: !!document.querySelector('.cp-ov-brief'),
    sit: !!document.querySelector('.cp-ov-situation'),
    next: !!document.querySelector('.cp-ov-next')
  }));
  ok('1 signal gated no CTA', oneSig.gated && !oneSig.cta, JSON.stringify(oneSig));
  ok('1 signal no extra fetch', oneSig.fetch === 1, String(oneSig.fetch));
  ok('brief/sit/next stay on 1-signal', oneSig.brief && oneSig.sit && oneSig.next);

  await page.evaluate(() => openClientProfile('c-mass'));
  await page.waitForTimeout(300);
  const massOnly = await page.evaluate(() => ({
    gated: !!(document.querySelector('[data-cp-coop-state="gated"]')),
    cta: !!document.querySelector('[data-cp-coop-cta="run"]'),
    copy: (document.querySelector('.cp-ov-coop-empty') || {}).textContent || '',
    fetch: window.__coopFetch || 0
  }));
  ok('mass-only gated', massOnly.gated && !massOnly.cta && /Za mało danych do interpretacji/.test(massOnly.copy));
  ok('mass-only no fetch', massOnly.fetch === 1, String(massOnly.fetch));

  await page.evaluate(() => {
    window.__coopHold = true;
    window.__coopRelease = null;
    window.__coopGate = new Promise(r => { window.__coopRelease = r; });
    const prev = window.fetch;
    window.fetch = async (url, opts) => {
      const body = String((opts && opts.body) || '');
      if (/współpracę z tym klientem/.test(body) || /trzech sekcjach/.test(body)) {
        window.__coopFetch += 1;
        window.__coopLastBody = body;
        if (window.__coopMode === 'error') throw new Error('network');
        if (window.__coopMode === 'bad') {
          return { json: async () => ({ content: [{ text: 'lorem ipsum bez sekcji' }] }) };
        }
        if (window.__coopHold) await window.__coopGate;
        return {
          json: async () => ({
            content: [{
              text: '1. Interpretacja\nPara sygnałów może oznaczać zmęczenie, nie regres.\n\n2. Do rozważenia\n- Dopytać o sen\n- Rozważyć krótsze sesje\n- Poczekać na siłę\n- Ignoruj czwartą\n\n3. Sprawdź przed decyzją\n- Brak pomiaru siły'
            }]
          })
        };
      }
      return prev(url, opts);
    };
    openClientProfile('c-pair');
  });
  await page.waitForSelector('[data-cp-coop-cta="run"]');
  const pairIdle = await page.evaluate(() => ({
    cta: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
    fetch: window.__coopFetch || 0,
    brief: (document.querySelector('.cp-ov-brief') || {}).textContent || '',
    next: (document.querySelector('.cp-ov-next') || {}).textContent || ''
  }));
  ok('pair training+checkin CTA without mass', /Przeanalizuj współpracę/.test(pairIdle.cta), pairIdle.cta);
  ok('pair no fetch on open', pairIdle.fetch === 1, String(pairIdle.fetch));
  ok('next still on pair', /Na kolejny trening/.test(pairIdle.next));

  await page.evaluate(() => {
    runCpCoopAnalysis('c-pair');
    runCpCoopAnalysis('c-pair');
    runCpCoopAnalysis('c-pair');
  });
  await page.waitForTimeout(150);
  const inflight = await page.evaluate(() => ({ fetch: window.__coopFetch, busy: !!(window._cpCoopBusy && window._cpCoopBusy['c-pair']) }));
  ok('triple call one fetch', inflight.fetch === 2 && inflight.busy, JSON.stringify(inflight));
  await page.evaluate(() => { window.__coopHold = false; if (window.__coopRelease) window.__coopRelease(); });
  await page.waitForSelector('[data-cp-coop-sec="interp"]');
  const pairDone = await page.evaluate(() => {
    const consider = document.querySelector('[data-cp-coop-sec="consider"]');
    const lis = consider ? consider.querySelectorAll('li').length : -1;
    const body = window.__coopLastBody || '';
    return {
      secs: [...document.querySelectorAll('[data-cp-coop-sec]')].map(el => el.getAttribute('data-cp-coop-sec')),
      lis,
      fetch: window.__coopFetch,
      persist: window.__persistCalls || 0,
      nextLeak: /Skróć objętość|20–30%/.test(body),
      notesLeak: /tajne/.test((document.querySelector('.cp-ov-coop') || {}).textContent || ''),
      legal: /nie jest decyzja/i.test((document.querySelector('.cp-ov-coop') || {}).textContent || ''),
      rerun: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
      sit: !!document.querySelector('.cp-ov-situation'),
      next: !!document.querySelector('.cp-ov-next'),
      brief: !!document.querySelector('.cp-ov-brief')
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'cp_coop_pair_result.png') });
  ok('pair 3 sections', pairDone.secs.join(',') === 'interp,consider,check', pairDone.secs.join(','));
  ok('pair max 3 consider', pairDone.lis === 3, String(pairDone.lis));
  ok('pair still 2 fetches', pairDone.fetch === 2, String(pairDone.fetch));
  ok('pair no persist', pairDone.persist === 0);
  ok('pair prompt no volume order', !pairDone.nextLeak);
  ok('pair notes not in card', !pairDone.notesLeak);
  ok('pair legal + ponow', pairDone.legal && /Ponów/.test(pairDone.rerun));
  ok('pair brief/sit/next intact', pairDone.brief && pairDone.sit && pairDone.next);

  await page.click('[data-cp-coop-cta="clear"]');
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(() => ({
    secs: document.querySelectorAll('[data-cp-coop-sec]').length,
    cta: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
    cache: !!(window._cpCoopCache && window._cpCoopCache['c-pair']),
    sit: !!document.querySelector('.cp-ov-situation')
  }));
  ok('clear drops result', cleared.secs === 0 && /Przeanalizuj współpracę/.test(cleared.cta) && !cleared.cache);
  ok('clear keeps situation', cleared.sit);

  await page.evaluate(() => { window.__coopMode = 'error'; window.__coopHold = false; });
  await page.click('[data-cp-coop-cta="run"]');
  await page.waitForSelector('[data-cp-coop-state="error"]');
  const err = await page.evaluate(() => ({
    copy: (document.querySelector('[data-cp-coop-state="error"]') || {}).textContent || '',
    rerun: (document.querySelector('[data-cp-coop-cta="run"]') || {}).textContent || '',
    sit: !!document.querySelector('.cp-ov-situation')
  }));
  await page.screenshot({ path: path.join(shotDir, 'cp_coop_error.png') });
  ok('error copy', /Nie udało się połączyć z AI/.test(err.copy));
  ok('error allows retry', /Ponów/.test(err.rerun));
  ok('error keeps overview', err.sit);

  await page.evaluate(() => { window.__coopMode = 'bad'; });
  await page.click('[data-cp-coop-cta="run"]');
  await page.waitForTimeout(400);
  const malformed = await page.evaluate(() => ({
    note: /Odpowiedź poza schematem/.test((document.querySelector('.cp-ov-coop') || {}).textContent || ''),
    secs: document.querySelectorAll('[data-cp-coop-sec]').length,
    sit: !!document.querySelector('.cp-ov-situation'),
    next: !!document.querySelector('.cp-ov-next')
  }));
  ok('malformed note no sections', malformed.note && malformed.secs === 0);
  ok('malformed does not break overview', malformed.sit && malformed.next);

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cp-overview-coop UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
