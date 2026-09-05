#!/usr/bin/env node
'use strict';
/** Biblioteka planów: filtr statusu, sort, oddzielenie szablonów. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('toolbar search', html.includes('id="plans-search"'));
ok('status chips', html.includes('id="plans-st-active"') && html.includes('id="plans-st-templates"') && html.includes('id="plans-st-archived"'));
ok('sort select', html.includes('id="plans-sort"') && html.includes('Od najnowszych'));
ok('client filter', html.includes('id="plans-client"'));
ok('view toggle', html.includes('id="plans-view-table"') && html.includes('id="plans-view-cards"'));
ok('filter helper', /function filterSortPlans\(/.test(src));
ok('archive helper', /function archivePlan\(/.test(src));
ok('default newest', /sort==='oldest'\?da-db:db-da/.test(src));
ok('css table', css.includes('.plans-tbl-hdr') && css.includes('.plans-toolbar'));
ok('cache 05 v41', html.includes('05-clients-builder-plans-calendar.js?v=41'));
ok('cache styles v61', html.includes('styles.css?v=61'));
ok('CI unit', wf.includes('test_plans_library.js'));
ok('CI ui', wf.includes('test_plans_library_ui.js'));
ok('scripts once 01', (html.match(/<script src="01-core\.js\?v=\d+">/g) || []).length === 1);
ok('scripts once 02', (html.match(/<script src="02-workouts-onboarding-templates-live\.js\?v=\d+">/g) || []).length === 1);

const start = src.indexOf('function planIsUnassigned');
const end = src.indexOf('window.filterSortPlans=filterSortPlans;');
ok('extract helpers', start >= 0 && end > start);
const slice = src.slice(start, end + 'window.filterSortPlans=filterSortPlans;'.length);
const ctx = vm.createContext({ window: {}, String, Date, Number, Array, Object, Math, parseInt, JSON });
vm.runInContext(slice, ctx);
const { filterSortPlans, planIsUnassigned, planIsArchived, planDateLabel } = ctx;

const plans = [
  { id: 'a', name: 'Zebra FBW', clientId: 'c1', updatedAt: '2026-09-01T10:00:00.000Z', duration: 8 },
  { id: 'b', name: 'Alpha PPL', clientId: 'c1', updatedAt: '2026-09-05T10:00:00.000Z', duration: 4 },
  { id: 't', name: 'PPL kopia', clientId: '', createdAt: '2026-08-01T10:00:00.000Z' },
  { id: 'x', name: 'Stary Justyna', clientId: 'c2', archived: true, updatedAt: '2026-07-01T10:00:00.000Z' }
];
const clients = [{ id: 'c1', name: 'Ola' }, { id: 'c2', name: 'Justyna Chylińska' }];

const active = filterSortPlans(plans, clients, { status: 'active', sort: 'newest' });
ok('active hides templates', active.every(p => p.clientId) && !active.some(p => p.id === 't' || p.id === 'x'));
ok('newest first', active[0].id === 'b' && active[1].id === 'a', active.map(p => p.id).join(','));

const oldest = filterSortPlans(plans, clients, { status: 'active', sort: 'oldest' });
ok('oldest first', oldest[0].id === 'a' && oldest[1].id === 'b');

const alpha = filterSortPlans(plans, clients, { status: 'active', sort: 'alpha' });
ok('alpha', alpha[0].id === 'b' && alpha[1].id === 'a');

const tpls = filterSortPlans(plans, clients, { status: 'templates' });
ok('templates only unassigned', tpls.length === 1 && tpls[0].id === 't');
ok('unassigned helper', planIsUnassigned(tpls[0]) === true);

const arch = filterSortPlans(plans, clients, { status: 'archived' });
ok('archived only', arch.length === 1 && arch[0].id === 'x' && planIsArchived(arch[0]));

const ola = filterSortPlans(plans, clients, { status: 'active', clientId: 'c1' });
ok('client filter', ola.length === 2 && ola.every(p => p.clientId === 'c1'));

const q = filterSortPlans(plans, clients, { status: 'active', search: 'justyna' });
ok('search skips archived by status', q.length === 0);
ok('date label', planDateLabel(plans[1]) === '2026-09-05');

if (failed) process.exit(1);
console.log('\nAll plans-library tests passed');
