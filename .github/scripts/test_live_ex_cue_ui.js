// UI: Live OSTATNIO / DZISIAJ / SUGESTIA — izolacja planów, paint kg, D16.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.LIVE_EX_CUE_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-live-ex-cue'));
fs.mkdirSync(shotDir, { recursive: true });

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

function work(kg, reps, rir) {
  return { setNo: 1, kg: String(kg), reps: String(reps), rir: String(rir), kind: 'work', done: true };
}
function sess(id, clientId, date, planId, kg, reps, rir, n) {
  const sets = [];
  for (let i = 0; i < (n || 3); i++) {
    sets.push(Object.assign({}, work(kg, reps, rir), { setNo: i + 1 }));
  }
  return {
    id: id, clientId: clientId, date: date, source: 'live', planId: planId,
    createdAt: date + 'T10:00:00',
    exercises: [{ name: 'Wyciskanie sztangi', sets: sets }]
  };
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
    window.CL = [
      { id: 'c-anna', name: 'Anna' },
      { id: 'c-bartek', name: 'Bartek' }
    ];
    if (typeof goTo === 'function') goTo('live');
    if (typeof liveClientSetField === 'function') liveClientSetField('c-anna', 'Anna', true, 0);
  });
  await page.waitForSelector('#live-exercises-panel');

  const NAME = 'Wyciskanie sztangi';
  await page.evaluate(({ NAME, sessA, sessB, sessOther, sessD16 }) => {
    window.CL = [
      { id: 'c-anna', name: 'Anna' },
      { id: 'c-bartek', name: 'Bartek' }
    ];
    window.PL = [
      { id: 'pl-a', clientId: 'c-anna', name: 'Plan A', days: [{ exercises: [{ name: NAME, sets: '4', reps: '5' }] }] },
      { id: 'pl-b', clientId: 'c-anna', name: 'Plan B', days: [{ exercises: [{ name: NAME, sets: '3', reps: '8-10' }] }] },
      { id: 'pl-d16', clientId: 'c-anna', name: 'Plan D16', days: [{ exercises: [{ name: NAME, sets: '3', reps: '8-10' }] }] }
    ];
    window.SE = sessA.concat(sessB, sessOther, sessD16);
    if (typeof liveClientSetField === 'function') liveClientSetField('c-anna', 'Anna', true, 0);
    window.liveClientId = 'c-anna';
    window.livePlanId = 'pl-b';
    window.liveCurrentDayIdx = 0;
    window.liveExercises = [{
      name: NAME,
      lastSets: [{ kg: '999', reps: '1' }],
      lastHistory: [{ date: '2099-01-01', sets: [{ kg: '999', reps: '1' }] }],
      sets: [
        { setNo: 1, kind: 'work', kg: '62.5', reps: '8', rir: '2', done: false },
        { setNo: 2, kind: 'work', kg: '62.5', reps: '8', rir: '2', done: false }
      ]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
  }, {
    NAME,
    sessA: [
      sess('a1', 'c-anna', '2026-09-13', 'pl-a', 95, 5, 1, 2),
      sess('a2', 'c-anna', '2026-09-20', 'pl-a', 100, 5, 1, 2)
    ],
    sessB: [
      sess('b1', 'c-anna', '2026-09-01', 'pl-b', 55, 10, 2, 3),
      sess('b2', 'c-anna', '2026-09-10', 'pl-b', 60, 10, 2, 3)
    ],
    sessOther: [
      sess('x1', 'c-bartek', '2026-09-22', 'pl-b', 40, 10, 3, 1)
    ],
    sessD16: [
      sess('d1', 'c-anna', '2026-08-01', 'pl-d16', 80, 10, 2, 3),
      sess('d2', 'c-anna', '2026-08-08', 'pl-d16', 80, 10, 2, 3),
      sess('d3', 'c-anna', '2026-08-15', 'pl-d16', 80, 10, 2, 3)
    ]
  });

  const planB = await page.evaluate(() => {
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    const today = document.querySelector('#live-ex-0 [data-cue="today"]');
    const suggest = document.querySelector('#live-ex-0 [data-cue="suggest"]');
    const cue = document.querySelector('#live-ex-0 .live-ex-cue');
    const prev = [...document.querySelectorAll('#live-ex-0 .live-set-prev')].map((b) => (b.textContent || '').trim());
    const pop = document.querySelector('#live-ex-0 .live-ex-hist-pop');
    return {
      last: last ? last.innerText : '',
      today: today ? today.textContent : '',
      suggest: suggest ? suggest.innerText : '',
      cue: cue ? cue.innerText : '',
      prev,
      pop: pop ? pop.innerText : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_ex_cue_plan_b.png') });
  ok('OSTATNIO Plan B 60', /60 kg/.test(planB.last) && !/100/.test(planB.last) && !/999/.test(planB.last), planB.last);
  ok('DZISIAJ 62.5 kg', /62\.5 kg/.test(planB.today), planB.today);
  ok('no ZA MAŁO on card', !/ZA MAŁO DANYCH/.test(planB.cue + planB.suggest), planB.cue);
  ok('no prev column prefill', planB.prev.length === 0, JSON.stringify(planB.prev));
  ok('tooltip ignores prefill 999', planB.pop && !/999/.test(planB.pop) && /60/.test(planB.pop), planB.pop.slice(0, 280));

  const typed = await page.evaluate(() => {
    const inp = document.querySelector('#live-ex-0 .live-kg-input');
    inp.__keep = true;
    inp.focus();
    inp.value = '75';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const today = document.querySelector('#live-ex-0 [data-cue="today"] .live-ex-cue-v');
    const suggest = document.querySelector('#live-ex-0 [data-cue="suggest"] .live-ex-cue-v');
    return {
      keep: inp.__keep === true,
      active: document.activeElement === inp,
      today: today ? today.textContent : '',
      suggest: suggest ? suggest.textContent : '',
      nCards: document.querySelectorAll('.live-ex-card').length
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_ex_cue_kg75.png') });
  ok('typing 75 updates DZISIAJ', /75 kg/.test(typed.today), typed.today);
  ok('kg input not rebuilt', typed.keep === true);
  ok('kg focus kept', typed.active === true, JSON.stringify(typed));
  ok('pipeline not implied by extra cards', typed.nCards === 1);

  const planA = await page.evaluate(() => {
    window.livePlanId = 'pl-a';
    window.liveExercises[0].sets[0].kg = '100';
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    const today = document.querySelector('#live-ex-0 [data-cue="today"]');
    return { last: last ? last.innerText : '', today: today ? today.textContent : '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_ex_cue_plan_a.png') });
  ok('OSTATNIO Plan A 100', /100 kg/.test(planA.last) && !/60 kg/.test(planA.last), planA.last);
  ok('DZISIAJ Plan A kg', /100 kg/.test(planA.today), planA.today);

  const other = await page.evaluate(() => {
    if (typeof liveClientSetField === 'function') liveClientSetField('c-bartek', 'Bartek', true, 0);
    window.liveClientId = 'c-bartek';
    window.livePlanId = 'pl-b';
    window.liveExercises = [{
      name: 'Wyciskanie sztangi',
      sets: [{ setNo: 1, kind: 'work', kg: '42', reps: '10', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    return last ? last.innerText : '';
  });
  ok('other client OSTATNIO 40', /40 kg/.test(other) && !/60 kg/.test(other) && !/100 kg/.test(other), other);

  const ids = await page.evaluate(() => {
    const prevSE = window.SE;
    window.SE = [{
      id: 'id-conflict', clientId: 'c-anna', date: '2026-09-21', source: 'live', planId: 'pl-b',
      createdAt: '2026-09-21T10:00:00',
      exercises: [{ name: 'Wyciskanie sztangi', exerciseId: 'ex-bench', sets: [
        { setNo: 1, kg: '60', reps: '10', kind: 'work', done: true }
      ] }]
    }];
    window.liveClientId = 'c-anna';
    window.livePlanId = 'pl-b';
    window.liveExercises = [{
      name: 'Wyciskanie sztangi',
      exerciseId: 'ex-other',
      sets: [{ setNo: 1, kind: 'work', kg: '62.5', reps: '8', done: false }]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    const suggest = document.querySelector('#live-ex-0 [data-cue="suggest"]');
    const cue = document.querySelector('#live-ex-0 .live-ex-cue');
    const out = { last: last ? last.innerText : '', suggest: suggest ? suggest.innerText : '', cue: cue ? cue.innerText : '' };
    window.SE = prevSE;
    return out;
  });
  ok('conflicting id no foreign last', !/60 kg/.test(ids.last) && !/100 kg/.test(ids.last), ids.last);
  ok('conflicting id first-time copy', /Brak historii w tym planie/.test(ids.cue) && /ZA MAŁO DANYCH/.test(ids.suggest), ids.cue);

  const d16 = await page.evaluate(() => {
    window.liveClientId = 'c-anna';
    window.livePlanId = 'pl-d16';
    window.liveExercises = [{
      name: 'Wyciskanie sztangi',
      sets: [
        { setNo: 1, kind: 'work', kg: '80', reps: '10', rir: '2', done: false },
        { setNo: 2, kind: 'work', kg: '80', reps: '10', rir: '2', done: false },
        { setNo: 3, kind: 'work', kg: '80', reps: '10', rir: '2', done: false }
      ]
    }];
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const suggest = document.querySelector('#live-ex-0 [data-cue="suggest"]');
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    return { suggest: suggest ? suggest.innerText : '', last: last ? last.innerText : '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'live_ex_cue_d16.png') });
  ok('D16 last 80 kg', /80 kg/.test(d16.last), d16.last);
  ok('D16 no ZA MAŁO', !/ZA MAŁO DANYCH/.test(d16.suggest + d16.last), d16.suggest);

  const draft = await page.evaluate(() => {
    window.livePlanId = 'pl-b';
    window.liveExercises = [{
      name: 'Wyciskanie sztangi',
      sets: [{ setNo: 1, kind: 'work', kg: '62.5', reps: '8', done: false }]
    }];
    window._cpExerciseProgress = null;
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const first = document.querySelector('#live-ex-0 .live-ex-cue');
    const a = first ? first.innerText : '';
    window._cpExerciseProgress = null;
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const second = document.querySelector('#live-ex-0 .live-ex-cue');
    const b = second ? second.innerText : '';
    return { a: a, b: b };
  });
  ok('reload same cue', draft.a === draft.b, JSON.stringify(draft));

  const noPlan = await page.evaluate(() => {
    window.livePlanId = '';
    if (typeof renderLiveExercises === 'function') renderLiveExercises(0);
    const last = document.querySelector('#live-ex-0 [data-cue="last"]');
    return last ? last.innerText : '';
  });
  ok('no planId does not mix history', !/60 kg/.test(noPlan) && !/100 kg/.test(noPlan), noPlan);

  await browser.close();
  if (failed) process.exit(1);
  console.log('\nAll live-ex-cue UI tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
