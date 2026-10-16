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

const dash = html.slice(html.indexOf('id="screen-dashboard"'), html.indexOf('id="dash-today-focus"'));
assert.ok(html.includes('<script src="dashboard-home.js?v=1"></script>'), 'skrypt pulpitu podpięty');
assert.ok(dash.includes('id="dash-search"') && dash.includes('dashSearchInput('), 'wyszukiwarka');
assert.ok(dash.includes('id="dash-notif-badge"') && dash.includes('id="dash-msg-badge"'), 'odznaki powiadomień i wiadomości');
assert.ok(dash.includes('id="dash-hello"') && dash.includes('id="dash-date-full"'), 'powitanie i data');
['clients', 'plans', 'live', 'calendar', 'stats', 'academy', 'library', 'inbox', 'finance'].forEach(t =>
  assert.ok(dash.includes('data-tile="' + t + '"'), 'kafelek ' + t));
assert.ok(dash.includes('id="dash-day-list"') && dash.includes('id="dash-goals-list"'), 'Mój dzień + cele z danych');
assert.ok(!dash.includes('Trening z klientem') && !dash.includes('12 / 16'), 'bez danych przykładowych');
assert.ok(dash.includes('TWOJE CELE. NASZE NARZĘDZIA. REALNE EFEKTY.'), 'baner');
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
