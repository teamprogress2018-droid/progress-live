// UI: Bloki 4–16 tyg. (audyt 18.10, pakiet E) — przypisanie daje wszystkie tygodnie z deloadem,
// kalendarz na cały blok, „+ Własny program” otwiera kreator, który zapisuje ćwiczenia.
const { chromium } = require('playwright');

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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    window._uid = 't1';
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.CL = [{ id: 'c1', name: 'Anna Kowalska' }];
    window.USER_PROGRAMS = window.USER_PROGRAMS || [];
  });

  // 1. Program demo „Siła 5×5 — 12 tygodni”: 12 tygodni, ćwiczenia z programu, deload, kalendarz na 12 tyg.
  const demo = await page.evaluate(async () => {
    goTo('programs');
    const p = allPrograms().find((x) => /5×5/.test(x.name));
    openProgDetail(p.id);
    const note = (document.querySelector('#prd-body .prog-plan-note') || {}).textContent || '';
    const repeat = document.querySelectorAll('#prd-body .prog-detail-week.is-repeat').length;
    openAssignProg(p.id);
    assignProgSetClientField('c1', 'Anna Kowalska');
    await confirmAssignProgram();
    const pl = PL[PL.length - 1];
    const d0 = pl.days.find((d) => !d.rest);
    const ex = d0.exercises[0];
    const deloadKey = pl.weekKeys.find((k) => /deload/i.test(pl.phases[k]));
    const dates = SE.filter((s) => s.clientId === 'c1' && s.planId === pl.id).map((s) => s.date).sort();
    const spanDays = dates.length ? (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 864e5 : 0;
    return { note, repeat, weeks: pl.weekKeys.length, dur: pl.duration, names: d0.exercises.map((e) => e.name), sets: ex.sets, w1: ex.w1, deload: ex[deloadKey], spanDays };
  });
  ok('detail tells what client gets', /12 tyg\./.test(demo.note) && /ćwiczenia jak w programie/.test(demo.note), demo.note);
  ok('detail lists cycled weeks', demo.repeat === 8, String(demo.repeat));
  ok('plan has 12 weeks', demo.weeks === 12 && demo.dur === 12, JSON.stringify(demo));
  ok('exercises from the program', demo.names.join() === 'Przysiad ze sztangą,Wyciskanie żołnierskie OHP,Martwy ciąg klasyczny' && demo.sets === '5', demo.names.join());
  ok('deload week lighter', demo.deload && Number(demo.deload.s) < Number(demo.w1.s) && demo.deload.rpe === '6', JSON.stringify(demo));
  ok('calendar covers the block', demo.spanDays > 70, String(demo.spanDays));

  // 2. „+ Własny program” → kreator → zapis z ćwiczeniami → edycja → przypisanie.
  await page.click('#screen-programs button:has-text("+ Własny program")');
  await page.waitForTimeout(200);
  const own = await page.evaluate(async () => {
    const screen = document.querySelector('.screen.active').id;
    document.getElementById('pb-name').value = 'Mój blok "A"';
    await pbSave(true);
    const p = USER_PROGRAMS[USER_PROGRAMS.length - 1];
    const firstEx = p.weeks[0].days[0].exercises.length;
    goTo('programs');
    openProgDetail(p.id);
    editProgram(p.id);
    const editScreen = document.querySelector('.screen.active').id;
    const editName = document.getElementById('pb-name').value;
    await pbAssign();
    const modal = document.getElementById('m-assign-prog').classList.contains('show');
    assignProgSetClientField('c1', 'Anna Kowalska');
    await confirmAssignProgram();
    const pl = PL[PL.length - 1];
    return { screen, firstEx, editScreen, editName, modal, plan: pl.name, planEx: pl.days[0].exercises.length, weeks: (pl.weekKeys || []).length };
  });
  ok('+ Własny program opens builder', own.screen === 'screen-progbuilder', JSON.stringify(own));
  ok('builder saves exercises', own.firstEx > 0, JSON.stringify(own));
  ok('edit opens the same program', own.editScreen === 'screen-progbuilder' && own.editName === 'Mój blok "A"', JSON.stringify(own));
  ok('builder assign opens assign dialog', own.modal, JSON.stringify(own));
  ok('own program assigned with weeks', own.plan === 'Mój blok "A"' && own.planEx > 0 && own.weeks === 8, JSON.stringify(own));

  // 3. Program bez treningów nie trafia do klienta.
  const empty = await page.evaluate(async () => {
    USER_PROGRAMS.push({ id: 'up_empty', type: 'moje', name: 'Pusty', duration: 8, weeks: [] });
    const before = PL.length;
    openAssignProg('up_empty');
    assignProgSetClientField('c1', 'Anna Kowalska');
    await confirmAssignProgram();
    return PL.length === before;
  });
  ok('empty program not assigned', empty);

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('All Bloki UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
