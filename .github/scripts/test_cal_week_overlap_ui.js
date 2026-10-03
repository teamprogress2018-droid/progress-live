// UI: widok tygodnia — 7 dni w viewportcie; karty w godzinach w dół, bez rozpychania poniedziałku.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', '..');
const shotDir = process.env.CAL_OVERLAP_SHOT_DIR || (fs.existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts' : path.join(require('os').tmpdir(), 'pl-cal-overlap'));
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
    window.CL = [
      { id: 'c-mal', name: 'Małgosia', status: 'active' },
      { id: 'c-ola', name: 'Ola Kowalska', status: 'active' },
      { id: 'c-ad', name: 'Adrian', status: 'active' },
      { id: 'c-ag', name: 'Agnieszka', status: 'active' },
      { id: 'c-ka', name: 'Kasia', status: 'active' }
    ];
    window.SE = [];
    window.TASKS = [];
    if (typeof goTo === 'function') goTo('calendar');
    const ymd = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const base = (typeof calCurrentDate !== 'undefined' && calCurrentDate) ? new Date(calCurrentDate) : new Date();
    const ws = typeof getWeekStart === 'function' ? getWeekStart(base) : (() => {
      const d = new Date(base);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
    const days = [...Array(7)].map((_, i) => {
      const x = new Date(ws);
      x.setDate(ws.getDate() + i);
      return ymd(x);
    });
    const longA = 'Dzień 1 — FBW A (Priorytet: Pośladki, Czworogłowe, Core) — Pośladki, czworogłowe, biceps, plecy, barki, core · odbył się';
    const longB = 'Dzień 1 — Push + Czworogłowe / Klatka, barki, triceps, nogi — Górna i środkowa klatka (priorytet), triceps, barki, czworogłowe';
    window.SE = [
      { id: 's-mal', clientId: 'c-mal', date: days[0], time: '08:00', duration: 60, type: longA },
      { id: 's-ola', clientId: 'c-ola', date: days[0], time: '08:00', duration: 60, type: 'FBW' },
      { id: 's-ag', clientId: 'c-ag', date: days[0], time: '08:00', duration: 45, type: longB },
      { id: 's-ad', clientId: 'c-ad', date: days[0], time: '12:00', duration: 60, type: 'Siła' },
      { id: 's-ka', clientId: 'c-ka', date: days[1], time: '08:00', duration: 60, type: 'HIIT: 8× (20s max + 40s przerwa)' },
      { id: 's-ola2', clientId: 'c-ola', date: days[5], time: '08:00', duration: 60, type: 'Sesja B — Push + Legs + Core (Pośladki, Core, Klatka, Barki)' },
      { id: 's-mal2', clientId: 'c-mal', date: days[6], time: '12:00', duration: 60, type: 'Dzień 2 — Pull + Dwugłowe / Plecy, Biceps, Tylny Bark' }
    ];
    if (typeof renderCal === 'function') renderCal();
  });

  await page.waitForSelector('.cal-session-block');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const eight = document.querySelector('.cal-hour-label[data-cal-hour="8"]');
    const scroll = document.getElementById('cal-week-scroll');
    if (eight && scroll) scroll.scrollTop = Math.max(0, eight.offsetTop - 8);
  });
  await page.waitForTimeout(80);

  const info = await page.evaluate(() => {
    const view = document.getElementById('cal-week-view');
    const hdr = document.getElementById('cal-week-header');
    const vr = view.getBoundingClientRect();
    const headers = [...document.querySelectorAll('.cal-week-day-hdr')].map(el => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, text: (el.textContent || '').trim() };
    });
    const blocks = [...document.querySelectorAll('.cal-session-block')].map(el => {
      const r = el.getBoundingClientRect();
      const cell = el.closest('.cal-cell');
      const cr = cell ? cell.getBoundingClientRect() : null;
      return {
        id: el.getAttribute('data-cal-sess'),
        name: ((el.querySelector('.cal-session-name') || {}).textContent || '').trim(),
        hour: cell ? cell.getAttribute('data-cal-hour') : '',
        day: cell ? cell.getAttribute('data-cal-day') : '',
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        cellWidth: cr ? cr.width : 0,
        overflowsCell: cr ? r.right > cr.right + 1.5 : false
      };
    });
    const eight = document.querySelector('.cal-cell[data-cal-hour="8"] .cal-session-block');
    const noon = document.querySelector('.cal-cell[data-cal-hour="12"] .cal-session-block');
    const widths = headers.map(h => h.width);
    return {
      n: blocks.length,
      names: blocks.map(b => b.name),
      days: [...new Set(blocks.map(b => b.day))],
      lanes: document.querySelectorAll('.cal-week-day-lane').length,
      eightCount: document.querySelectorAll('.cal-cell[data-cal-hour="8"] .cal-session-block').length,
      twelveCount: document.querySelectorAll('.cal-cell[data-cal-hour="12"] .cal-session-block').length,
      eightTop: eight ? eight.getBoundingClientRect().top : 0,
      noonTop: noon ? noon.getBoundingClientRect().top : 0,
      headerN: headers.length,
      viewLeft: vr.left,
      viewRight: vr.right,
      lastRight: headers.length ? headers[headers.length - 1].right : 0,
      firstLeft: headers.length ? headers[0].left : 0,
      headerW: widths,
      headerSpread: widths.length ? Math.max(...widths) - Math.min(...widths) : 99,
      hdrScroll: hdr ? hdr.scrollWidth : 0,
      hdrClient: hdr ? hdr.clientWidth : 0,
      blocks
    };
  });

  await page.screenshot({ path: path.join(shotDir, 'cal_week_hours.png') });
  ok('seven session cards', info.n === 7, JSON.stringify(info.names));
  ok('no day lanes', info.lanes === 0);
  ok('names visible', /Małgosia/.test(info.names.join(' ')) && /Ola/.test(info.names.join(' ')) && /Adrian/.test(info.names.join(' ')), info.names.join(','));
  ok('sessions across weekdays', info.days.length >= 3, JSON.stringify(info.days));
  ok('five at 08:00', info.eightCount === 5, String(info.eightCount));
  ok('two at 12:00', info.twelveCount === 2, String(info.twelveCount));
  ok('chips fit day cells', info.blocks.every(b => b.width >= 40 && !b.overflowsCell), JSON.stringify(info.blocks.map(b => ({ id: b.id, w: b.width, cell: b.cellWidth, overflow: b.overflowsCell }))));
  ok('seven day headers', info.headerN === 7, String(info.headerN));
  ok('sunday inside week view', info.lastRight <= info.viewRight + 2, JSON.stringify({ last: info.lastRight, view: info.viewRight }));
  ok('monday inside week view', info.firstLeft >= info.viewLeft - 2, JSON.stringify({ first: info.firstLeft, view: info.viewLeft }));
  ok('day columns equal width', info.headerSpread < 8, JSON.stringify(info.headerW));
  ok('week header no x-overflow', info.hdrScroll <= info.hdrClient + 1, JSON.stringify({ scroll: info.hdrScroll, client: info.hdrClient }));
  ok('noon below morning', info.noonTop > info.eightTop + 20, JSON.stringify({ eight: info.eightTop, noon: info.noonTop }));

  const morning = info.blocks.filter(b => b.hour === '8' && b.day === info.days[0]).sort((a, b) => a.top - b.top);
  ok('monday morning stacked down', morning.length === 3 && morning[0].top < morning[1].top && morning[1].top < morning[2].top, JSON.stringify(morning.map(b => ({ id: b.id, top: b.top, day: b.day }))));
  ok('monday morning same column', morning.every(b => Math.abs(b.left - morning[0].left) < 8), JSON.stringify(morning.map(b => b.left)));

  const afterInline = await page.evaluate(() => {
    const hdr = document.getElementById('cal-week-header');
    const grid = document.getElementById('cal-week-grid');
    if (hdr) hdr.style.gridTemplateColumns = '60px repeat(7,1fr)';
    if (grid) grid.style.gridTemplateColumns = '60px repeat(7,1fr)';
    if (typeof renderCal === 'function') renderCal();
    const headers = [...document.querySelectorAll('.cal-week-day-hdr')].map(el => el.getBoundingClientRect().width);
    const view = document.getElementById('cal-week-view').getBoundingClientRect();
    const last = document.querySelectorAll('.cal-week-day-hdr');
    const lastR = last.length ? last[last.length - 1].getBoundingClientRect().right : 0;
    return {
      n: headers.length,
      spread: headers.length ? Math.max(...headers) - Math.min(...headers) : 99,
      sundayIn: lastR <= view.right + 2,
      cols: headers
    };
  });
  ok('render resets stale 1fr inline', afterInline.n === 7 && afterInline.spread < 8 && afterInline.sundayIn, JSON.stringify(afterInline));

  await browser.close();
  if (failed) {
    console.error(failed + ' failed');
    process.exit(1);
  }
  console.log('\nAll cal-week-hours UI checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
