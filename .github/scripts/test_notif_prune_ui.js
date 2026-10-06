// Mniej odczytów bazy: stare powiadomienia (>21 dni) usuwane raz dziennie, świeże zostają.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await page.clock.setFixedTime(new Date('2026-10-06T09:00:00Z'));
  await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof pruneOldNotifications === 'function');
  const out = await page.evaluate(async () => {
    window._uid = 'np-trainer'; window._clientAppMode = false; window._db = { fixture: 1 };
    window.__del = []; window._doc = (db, col, id) => col + '/' + id; window._del = async ref => { window.__del.push(ref); };
    try { localStorage.removeItem('pl_notif_prune_np-trainer'); } catch (e) {}
    const mk = (id, iso) => ({ id, _fbId: 'fb_' + id, createdAt: iso, title: id });
    window.NOTIFICATIONS = [mk('new', '2026-10-05T10:00:00Z'), mk('edge', '2026-09-20T10:00:00Z'), mk('old1', '2026-08-01T10:00:00Z'), mk('old2', '2026-09-01T10:00:00Z')];
    const first = await pruneOldNotifications();
    const left = window.NOTIFICATIONS.map(n => n.id);
    const second = await pruneOldNotifications();
    window._clientAppMode = true;
    const client = await pruneOldNotifications({ force: true });
    return { first, left, del: window.__del, second, client };
  });
  ok('deletes notifications older than 21 days by their database id', out.first === 2 && JSON.stringify(out.del) === '["notifications/fb_old1","notifications/fb_old2"]', JSON.stringify(out));
  ok('keeps recent ones', JSON.stringify(out.left) === '["new","edge"]', JSON.stringify(out.left));
  ok('runs at most once a day', out.second === 0);
  ok('never runs in the client app', out.client === 0);
  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll notification prune checks passed');
})().catch(e => { console.error(e); process.exit(1); });
