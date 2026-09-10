// UI: podgląd PDF planu w kolorach wzoru (czerwień / granat / róż).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.SS_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-pdf'));
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
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:' + port + '/index.html?nocache=planpdf', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    window.persistById = async (_c, o) => o;
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-root');
    if (auth) auth.style.display = 'none';
    if (app) app.style.display = '';
    const loading = document.getElementById('app-loading');
    if (loading) loading.style.display = 'none';
    window.aplLastPlan = {
      planName: 'Masa 6 tyg.',
      daysPerWeek: 3,
      weeks: 6,
      progression: 'linear',
      periodization: 'Progresja liniowa: co tydzień +2.5kg na wielostawach.',
      warmup: '5 min rower stacjonarny + mobilizacja barków/bioder.',
      weekKeys: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
      phases: { w1: 'Adaptacja', w2: 'Hipertrofia I', w3: 'Hipertrofia I', w4: 'Hipertrofia II', w5: 'Siła', w6: 'Deload' },
      days: [{
        dayName: 'Dzień 1 — Push + czworogłowe',
        focus: 'Push+Czworogłowe',
        exercises: [{
          name: 'Hack squat',
          notes: 'Pauza 1-2s w rozciągnięciu',
          rest: '90s',
          w1: { s: '3', r: '10', rpe: '7', kg: '80' },
          w2: { s: '3', r: '10', rpe: '7', kg: '82.5' },
          w3: { s: '3', r: '10', rpe: '8', kg: '85' },
          w4: { s: '4', r: '8', rpe: '8', kg: '87.5' },
          w5: { s: '4', r: '6', rpe: '9', kg: '90' },
          w6: { s: '2', r: '8', rpe: '5', kg: '56' }
        }, {
          name: 'Wyciskanie żołnierskie',
          notes: 'Łokcie pod gryfem',
          rest: '90s',
          w1: { s: '3', r: '8', rpe: '7', kg: '40' },
          w2: { s: '3', r: '8', rpe: '7', kg: '42.5' },
          w3: { s: '3', r: '8', rpe: '8', kg: '45' },
          w4: { s: '3', r: '6', rpe: '8', kg: '47.5' },
          w5: { s: '3', r: '5', rpe: '9', kg: '50' },
          w6: { s: '2', r: '8', rpe: '5', kg: '30' }
        }]
      }]
    };
    if (typeof aplExportPlanPDF === 'function') aplExportPlanPDF();
  });
  await page.waitForTimeout(400);
  const vis = await page.evaluate(() => {
    const overlay = document.getElementById('report-overlay');
    const pdf = document.querySelector('.plan-pdf');
    const title = document.querySelector('.plan-pdf-title');
    const wk = document.querySelector('.plan-pdf-wk');
    const dayH = document.querySelector('.plan-pdf-day-h');
    const pri = document.querySelector('.plan-pdf-pri');
    function rgb(el) {
      return el ? getComputedStyle(el).color : '';
    }
    function bg(el) {
      return el ? getComputedStyle(el).backgroundColor : '';
    }
    return {
      overlay: overlay && overlay.style.display !== 'none',
      title: title && title.textContent,
      titleColor: rgb(title),
      wkBg: bg(wk),
      dayBg: bg(dayH),
      pri: !!(pri && pri.textContent.includes('PRIORYTET'))
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'plan_pdf.png'), fullPage: true });
  ok('overlay open', vis.overlay);
  ok('title', vis.title === 'PLAN TRENINGOWY');
  ok('title red', /rgb\(\s*225\s*,\s*31\s*,\s*46\s*\)/.test(vis.titleColor), vis.titleColor);
  ok('week pink', /rgb\(\s*253\s*,\s*232\s*,\s*234\s*\)/.test(vis.wkBg), vis.wkBg);
  ok('day navy', /rgb\(\s*22\s*,\s*24\s*,\s*31\s*\)/.test(vis.dayBg), vis.dayBg);
  ok('priorytet badge', vis.pri);

  await page.evaluate(() => { if (typeof reportClose === 'function') reportClose(); });
  await page.evaluate(() => {
    window.CL = [{ id: 'c-ola', name: 'Ola', status: 'active' }];
    window.PL = [{
      id: 'p-pdf',
      name: 'FBW Oli',
      clientId: 'c-ola',
      clientName: 'Ola',
      duration: 8,
      method: 'FBW',
      progression: 'linear',
      updatedAt: '2026-09-05T10:00:00.000Z',
      days: [
        { day: 'PON', muscles: 'Całe ciało', exercises: [
          { name: 'Hack squat', sets: '4', reps: '8', kg: '80', rir: '2', rest: '120s', note: 'Głęboko' }
        ]}
      ]
    }];
    if (typeof setPlansLibView === 'function') setPlansLibView('table');
    if (typeof setPlansLibStatus === 'function') setPlansLibStatus('active');
    if (typeof goTo === 'function') goTo('plans');
  });
  await page.waitForSelector('#plan-pdf-p-pdf');
  await page.click('#plan-pdf-p-pdf');
  await page.waitForTimeout(400);
  const savedVis = await page.evaluate(() => {
    const overlay = document.getElementById('report-overlay');
    const pdf = document.querySelector('.plan-pdf');
    const sub = document.querySelector('.plan-pdf-sub');
    return {
      overlay: overlay && overlay.style.display !== 'none',
      hasPdf: !!pdf,
      text: pdf ? pdf.innerText : '',
      sub: sub ? sub.textContent : ''
    };
  });
  await page.screenshot({ path: path.join(shotDir, 'saved_plan_pdf.png'), fullPage: true });
  ok('saved overlay', savedVis.overlay && savedVis.hasPdf);
  ok('saved plan name', /FBW Oli/.test(savedVis.sub || '') && /Hack squat/.test(savedVis.text), savedVis.sub);
  ok('saved sets', /4×8/.test(savedVis.text) && /RPE 8/.test(savedVis.text), savedVis.text.slice(0, 200));

  await page.evaluate(() => { if (typeof reportClose === 'function') reportClose(); });
  await page.evaluate(() => {
    if (typeof openClientProfile === 'function') openClientProfile('c-ola');
  });
  await page.waitForSelector('#cp-drawer.open');
  await page.click('#cpt-plan');
  await page.waitForSelector('#cp-body button:has-text("PDF")');
  await page.click('#cp-body button:has-text("PDF")');
  await page.waitForTimeout(300);
  const fromCp = await page.evaluate(() => {
    const overlay = document.getElementById('report-overlay');
    const pdf = document.querySelector('.plan-pdf');
    return { overlay: overlay && overlay.style.display !== 'none', text: pdf ? pdf.innerText : '' };
  });
  await page.screenshot({ path: path.join(shotDir, 'saved_plan_pdf_profile.png'), fullPage: true });
  ok('profile pdf', fromCp.overlay && /Hack squat/.test(fromCp.text), fromCp.text.slice(0, 120));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll plan-pdf UI tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
