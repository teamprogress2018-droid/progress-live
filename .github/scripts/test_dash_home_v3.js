#!/usr/bin/env node
'use strict';
/** Strona główna v3: układ z makiety + „Mój dzień” i „Twoje cele” liczone z prawdziwych danych. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src = fs.readFileSync(path.join(root, 'dashboard-home.js'), 'utf8');
const src04 = fs.readFileSync(path.join(root, '04-client-portal.js'), 'utf8');

const dashFull = html.slice(html.indexOf('id="screen-dashboard"'), html.indexOf('id="screen-clients"'));
const dash = dashFull.slice(0, dashFull.indexOf('id="dash-today-focus"'));
assert.ok(html.includes('<script src="dashboard-home.js?v=1"></script>'), 'skrypt pulpitu podpięty');
assert.ok(dash.includes('id="dash-search"') && dash.includes('dashSearchInput('), 'wyszukiwarka');
assert.ok(dash.includes('id="dash-notif-badge"') && dash.includes('id="dash-msg-badge"'), 'odznaki powiadomień i wiadomości');
assert.ok(dash.includes('id="dash-hello"') && dash.includes('id="dash-date-full"'), 'powitanie i data');
// Czysty pulpit: bez kafelków, haseł i cytatów; skróty kafelków są w pasku bocznym i w nagłówku listy klientów
assert.ok(!dashFull.includes('data-tile='), 'bez kafelków');
assert.ok(!/TWOJE CELE\. NASZE NARZĘDZIA|Małe kroki|Lepsza wersja|buduje Twoje jutro/.test(dashFull), 'bez haseł i cytatów');
assert.ok(!dashFull.includes('dash-start-hero') && !dashFull.includes('dash3-banner') && !dashFull.includes('dash-fire-endquote'), 'bez banera i hero');
['clients', 'library', 'inbox', 'live', 'calendar', 'business', 'academy'].forEach(s =>
  assert.ok(html.includes('data-screen="' + s + '"') || html.includes('id="nav-' + s + '-btn"'), 'skrót w pasku bocznym: ' + s));
const addMenu = html.slice(html.indexOf('id="cl-add-menu"'), html.indexOf('id="cl-add-menu"') + 2500);
['openNewPlanPicker()', 'openInviteFromDashboard()', "openM('m-broadcast')"].forEach(f =>
  assert.ok(addMenu.includes(f), 'skrót w nagłówku listy klientów: ' + f));
assert.ok(dashFull.indexOf('id="dash-day-list"') > 0 && dashFull.indexOf('id="dash-goals-list"') > 0, 'Mój dzień + cele z danych');
assert.ok(!dashFull.includes('Trening z klientem') && !dashFull.includes('12 / 16'), 'bez danych przykładowych');
assert.ok(css.includes("assets/brand/web/progress-fire-hero.jpg") && fs.existsSync(path.join(root, 'assets/brand/web/progress-fire-hero.jpg')), 'lekkie grafiki');
assert.ok(src04.includes("typeof renderDashHome==='function'"), 'renderDash odświeża pulpit');

const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = new Date(); today.setHours(12, 0, 0, 0);
const t0 = ymd(today);
const w = {
  CL: [{ id: 'c1', name: 'Anna Nowak', status: 'active' }, { id: 'c2', name: 'Jan Kos', status: 'active' }],
  PL: [{ id: 'p1', clientId: 'c1', name: 'FBW' }],
  SE: [{ id: 's1', clientId: 'c1', date: t0, time: '07:00' }, { id: 's2', clientId: 'c2', date: t0, time: '09:00' }],
  PACKAGES: [{ id: 'k1', payStatus: 'paid' }, { id: 'k2', payStatus: 'unpaid' }],
  CHECKINS: { c1: [{ date: t0, status: 'filled' }, { date: t0, status: 'pending' }] },
  dashTodayYmd: () => t0,
  dashSessionState: s => ({ kind: s.id === 's1' ? 'done' : 'upcoming' }),
  dashTodaySessions: () => w.SE,
  document: { getElementById: () => null, addEventListener() {} }
};
w.window = w;
vm.runInNewContext(src, w);
const goals = Object.fromEntries(w.dashGoals().map(g => [g.key, g.done + '/' + g.total]));
assert.deepStrictEqual(goals, { train: '1/2', plans: '1/2', money: '1/2', checkin: '1/2' }, 'cele liczone z danych');

const box = { innerHTML: '' };
w.document.getElementById = id => (id === 'dash-day-list' ? box : null);
w.renderDashDay();
assert.ok(box.innerHTML.includes('Anna Nowak') && box.innerHTML.includes('is-done') && box.innerHTML.includes('07:00'), 'Mój dzień z sesji');
w.SE = []; w.dashTodaySessions = () => [];
w.renderDashDay();
assert.ok(box.innerHTML.includes('Brak zaplanowanych zajęć'), 'pusty dzień');

console.log('All dashboard home v3 tests passed.');
