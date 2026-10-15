'use strict';
// Druga runda poprawek: prywatne pola klienta, filtry „wymaga uwagi”, maskowanie w trybie prywatnym,
// menu mobilne i reguły bazy. Każdy test uruchamia produkcyjny kod wycięty z plików aplikacji.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const slice = (src, from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'fragment exists: ' + from);
  return src.slice(a, b + to.length);
};
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

const core = read('01-core.js');
const clients = read('05-clients-builder-plans-calendar.js');
const priv = read('09-posture-kb-invites-private.js');
const html = read('index.html');
const css = read('styles.css').replace(/\r\n/g, '\n');
const rules = read('firestore.rules');

(async () => {
  await test('persistById splits trainer-only fields into clientPrivate once rules are live', async () => {
    const writes = [];
    const ctx = { console: { warn() {} }, Date, Promise, JSON, Object,
      _db: {}, _uid: 'trainer-a', _clientAppMode: false, tenantSessionGeneration: 1,
      _doc: (_db, col, id) => ({ path: col + '/' + id }),
      _setDoc: async (ref, value, opts) => { writes.push({ path: ref.path, value: JSON.parse(JSON.stringify(value)), merge: opts && opts.merge }); },
      _deleteField: () => ({ __delete: true }), notify() {} };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(slice(core, 'function withTrainer(', 'window.persistById=persistById;'), ctx);
    const client = { id: 'c1', name: 'A', notes: 'tajne', psycho: { habits: {} }, phone: '1' };
    ctx._clientPrivateReady = false;
    await ctx.persistById('clients', { ...client });
    assert.equal(writes.length, 1); assert.equal(writes[0].path, 'clients/c1'); assert.equal(writes[0].value.notes, 'tajne', 'before rules: legacy behaviour');
    writes.length = 0; ctx._clientPrivateReady = true;
    const local = { ...client };
    const saved = await ctx.persistById('clients', local);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].path, 'clientPrivate/c1'); assert.equal(writes[0].value.notes, 'tajne'); assert.equal(writes[0].value.trainerId, 'trainer-a');
    assert.equal(writes[1].path, 'clients/c1'); assert.deepEqual(writes[1].value.notes, { __delete: true }); assert.deepEqual(writes[1].value.timeline, { __delete: true });
    assert.equal(writes[1].value.phone, '1');
    assert.equal(saved.notes, 'tajne', 'local card keeps the private values');
    writes.length = 0; ctx._clientAppMode = true; ctx._trainerId = 'trainer-a'; ctx._clientId = 'c1';
    await ctx.persistById('clients', { id: 'c1', goal: 'masa' });
    assert.deepEqual(writes.map(w => w.path), ['clients/c1'], 'the client app never touches clientPrivate');
  });

  await test('rules: clientPrivate belongs to the trainer and has no client read rule', async () => {
    const owned = slice(rules, 'function ownedCollection(name) {', ']);');
    assert.ok(owned.includes("'clientPrivate'"));
    const clientReads = rules.split('\n').filter(l => /ownClient|sameTrainer|linked\(\)/.test(l) && l.includes('clientPrivate'));
    assert.deepEqual(clientReads, []);
    assert.ok(html.includes("tenantReadOwnedCollection('clientPrivate',session).catch("), 'denied private read never blocks boot');
  });

  await test('attention flags: check-in, measurements, workouts, onboarding — with dates and fresh-client grace', async () => {
    const day = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const ctx = { Date, Math, Number, String, Object, Array, Map,
      SE: [{ clientId: 'c1', date: day(3), source: 'live' }, { clientId: 'c2', date: day(20), source: 'live' }],
      METRIC_ENTRIES: [{ clientId: 'c1', date: day(40) }, { clientId: 'c2', date: day(5) }],
      latestFilledCheckin: id => id === 'c1' ? { t: Date.now() - 12.2 * 86400000 } : null,
      checkinActivityTime: ci => ci.t,
      isLoggedWorkout: s => s.source === 'live',
      clientOnboardStatus: c => c.id === 'c1' ? { complete: true } : { complete: false, done: 3, total: 7, missingLabels: ['brak planu'] },
      buildMonitorVerdict: c => c.id === 'c2' ? { verdict: 'regres', signals: [{ tone: 'bad', label: 'Nieobecność', text: 'Brak sesji od 20 dni.' }] } : { verdict: 'stabilnie', signals: [] } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(slice(clients, '// „Wymaga uwagi”', 'window.attnAgoText=attnAgoText;'), ctx);
    const c1 = ctx.clientAttentionFlags({ id: 'c1', status: 'active', joinDate: day(90) });
    assert.match(c1['attn-checkin'].reason, /Ostatni check-in 12 dni temu \(\d+\.\d+\)/);
    assert.match(c1['attn-measure'].reason, /Ostatni pomiar (39|40) dni temu/);
    assert.equal(c1['attn-noworkout'], undefined); assert.equal(c1['attn-onboard'], undefined); assert.equal(c1['attn-regres'], undefined);
    const c2 = ctx.clientAttentionFlags({ id: 'c2', status: 'active', joinDate: day(90) });
    assert.equal(c2['attn-checkin'].reason, 'Nie wypełnił jeszcze check-inu');
    assert.match(c2['attn-noworkout'].reason, /Ostatni trening (19|20) dni temu/);
    assert.match(c2['attn-regres'].reason, /Źródło — Nieobecność: Brak sesji od 20 dni\./);
    assert.equal(c2['attn-onboard'].reason, 'Start 3/7 — brak planu');
    const fresh = ctx.clientAttentionFlags({ id: 'c3', status: 'active', joinDate: day(2) });
    assert.equal(fresh['attn-checkin'], undefined); assert.equal(fresh['attn-measure'], undefined); assert.equal(fresh['attn-noworkout'], undefined);
    assert.deepEqual(Object.keys(ctx.clientAttentionFlags({ id: 'c4', status: 'archived' })), []);
    assert.deepEqual(Object.keys(ctx.clientAttentionFlags({ id: 'c4', status: 'inactive' })), []);
  });

  await test('private mode masks client names and e-mails as stable aliases, without touching data', async () => {
    const ctx = { String, RegExp, Map, Array, Object, CL: [
      { id: 'b', name: 'Jan Kowalski', email: 'jan@example.test' },
      { id: 'a', name: 'Anna Nowak', email: 'anna@example.test' }] };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(slice(priv, 'const privMaskOriginals=new Map();', 'window.privMaskText=privMaskText;') + '\nprivMaskRules=privMaskBuildRules();', ctx);
    assert.equal(ctx.privMaskText('Anna Nowak — Raport zaległy'), 'Klient A — Raport zaległy');
    assert.equal(ctx.privMaskText('Cześć Jan, jan@example.test'), 'Cześć Klient B, •••@•••');
    assert.equal(ctx.privMaskText('Janina i Annabelle'), 'Janina i Annabelle', 'only whole names are replaced');
    assert.equal(ctx.CL[1].name, 'Anna Nowak');
  });

  await test('mobile: menu button is not hidden inline and touch targets are at least 44 px', async () => {
    assert.ok(/<button id="mobile-menu-btn"[^>]*aria-label="Otwórz menu"/.test(html));
    assert.ok(!/<button id="mobile-menu-btn"[^>]*style="display:none;?"/.test(html), 'inline display:none would beat the media query');
    const mobile = slice(css, '@media (max-width: 860px){\n  #mobile-menu-btn', '.content{padding:14px;}');
    assert.match(mobile, /#mobile-menu-btn\{display:flex;[^}]*width:44px;height:44px;\}/);
    assert.match(mobile, /#app-root \.btn,[\s\S]*?\{min-height:44px;\}/);
    assert.match(mobile, /\.topbar\{[^}]*height:auto;[^}]*flex-wrap:wrap/);
    assert.ok(core.includes("btn.setAttribute('aria-expanded',open?'true':'false')"));
  });

  await test('client e-mail is optional, the trainer e-mail is refused and edits are checked for duplicates', async () => {
    assert.ok(clients.includes("if(email&&!clientEmailValid(email))"));
    assert.ok(clients.includes("To Twój e-mail, a nie klienta."));
    assert.ok(clients.includes("clientPossibleDuplicates({name:nameChanged?name:'',email:emailChanged?email:''},state.editId||null)"));
    assert.ok(!/id="ac-email"[^>]*required/.test(html));
  });

  console.log('\n' + passed + ' round-2 scenarios passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
