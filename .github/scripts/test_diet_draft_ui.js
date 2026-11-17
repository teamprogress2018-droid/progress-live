// UI: szkic jadłospisu z kalkulatora nie zastępuje klientowi zatwierdzonego planu.
// Szkic ląduje w dietDraft (pole prywatne → clientPrivate), zatwierdzenie zapisuje dietPlan i czyści szkic.
// Starsze karty, w których szkic już nadpisał dietPlan, pokazują klientowi ostatni zatwierdzony plan z historii.
// Bez Firebase: zapisy przechwytuje atrapa _setDoc.
const { chromium } = require('playwright');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL ' + name + (extra ? ' — ' + extra : '')); failed++; }
  else console.log('OK   ' + name);
}

(async () => {
  const port = process.env.LAYOUT_PORT || '8080';
  const browser = await chromium.launch({ headless: process.env.LAYOUT_HEADED !== '1' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto('http://localhost:' + port + '/index.html?nocache=diet-draft', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const r = await page.evaluate(async () => {
    const out = {};
    const plan = (label) => ({ form: 'habits', habits: [label], kcal: 2200, p: 150, f: 70, c: 250, shop: [], shopDays: 7, people: 1 });
    const approved = { status: 'zatwierdzony', updatedAt: '2026-11-01T10:00:00.000Z', approvedAt: '2026-11-01T10:00:00.000Z', plan: plan('Zatwierdzony A'), prefs: { style: 'wszystko' } };
    const c = { id: 'c1', trainerId: 'dd-trainer', name: 'Anna', dietPlan: JSON.parse(JSON.stringify(approved)) };
    window.CL = [c];
    // Trener z działającym clientPrivate: zapisy do atrapy.
    window._uid = 'dd-trainer'; window._clientAppMode = false; window.tenantSessionGeneration = 1;
    window._db = { fixture: 'diet-draft' }; window._clientPrivateReady = true;
    const writes = [];
    window._deleteField = () => '__USUN__';
    window._doc = (_db, col, id) => ({ col, id });
    window._setDoc = async (ref, data) => { writes.push({ col: ref.col, id: ref.id, data: JSON.parse(JSON.stringify(data)) }); };
    window.notify = () => {};

    dietStorePlan(c, { status: 'szkic', updatedAt: '2026-11-10T10:00:00.000Z', plan: plan('Szkic B'), prefs: { style: 'wege' } });
    await new Promise((res) => setTimeout(res, 50));
    out.afterDraft = { plan: c.dietPlan && c.dietPlan.status, planLabel: c.dietPlan && c.dietPlan.plan.habits[0], draft: c.dietDraft && c.dietDraft.status, trainerSees: dietTrainerPlan(c).status, trainerPrefs: dietTrainerPlan(c).prefs.style };
    const priv = writes.find((w) => w.col === 'clientPrivate');
    const card = writes.find((w) => w.col === 'clients');
    out.writes = { privHasDraft: !!(priv && priv.data.dietDraft && priv.data.dietDraft.status === 'szkic'), cardDraft: card ? card.data.dietDraft : 'brak zapisu', cardPlan: card && card.data.dietPlan && card.data.dietPlan.status };

    // Widok klienta po zapisaniu szkicu.
    window._clientAppMode = true; window._clientId = 'c1';
    out.clientHasFood = typeof pkcHasFood === 'function' && pkcHasFood(c);
    out.clientFood = typeof pkcFoodHTML === 'function' ? pkcFoodHTML(c) : '';
    window._clientAppMode = false;

    // Zatwierdzenie: nowy dietPlan, poprzedni w historii, szkic wyczyszczony.
    dietStorePlan(c, { status: 'zatwierdzony', updatedAt: '2026-11-12T10:00:00.000Z', approvedAt: '2026-11-12T10:00:00.000Z', plan: plan('Zatwierdzony C') });
    await new Promise((res) => setTimeout(res, 50));
    out.afterApprove = { plan: c.dietPlan.plan.habits[0], draft: c.dietDraft, history: (c.dietPlanHistory || []).map((h) => h.plan.habits[0]) };

    // Stara karta: szkic już nadpisał dietPlan, zatwierdzony jest w historii.
    const legacy = { id: 'c2', name: 'Ola', dietPlan: { status: 'szkic', plan: plan('Stary szkic') }, dietPlanHistory: [JSON.parse(JSON.stringify(approved))] };
    window._clientAppMode = true; window._clientId = 'c2'; window.CL = [legacy];
    out.legacyHasFood = pkcHasFood(legacy);
    out.legacyFood = pkcFoodHTML(legacy);
    window._clientAppMode = false;
    return out;
  });

  ok('szkic nie zmienia zatwierdzonego dietPlan', r.afterDraft.plan === 'zatwierdzony' && r.afterDraft.planLabel === 'Zatwierdzony A', JSON.stringify(r.afterDraft));
  ok('szkic zapisany w dietDraft', r.afterDraft.draft === 'szkic');
  ok('trener widzi najnowszy szkic (preferencje ze szkicu)', r.afterDraft.trainerSees === 'szkic' && r.afterDraft.trainerPrefs === 'wege');
  ok('szkic idzie do clientPrivate, a w karcie klienta jest usuwany', r.writes.privHasDraft && r.writes.cardDraft === '__USUN__' && r.writes.cardPlan === 'zatwierdzony', JSON.stringify(r.writes));
  ok('klient dalej widzi zatwierdzony jadłospis', r.clientHasFood && /Zatwierdzony A/.test(r.clientFood) && !/Szkic B/.test(r.clientFood));
  ok('zatwierdzenie: nowy plan, stary w historii, szkic wyczyszczony', r.afterApprove.plan === 'Zatwierdzony C' && r.afterApprove.draft === null && r.afterApprove.history[0] === 'Zatwierdzony A', JSON.stringify(r.afterApprove));
  ok('stara karta ze szkicem w dietPlan: klient widzi ostatni zatwierdzony', r.legacyHasFood && /Zatwierdzony A/.test(r.legacyFood) && !/Stary szkic/.test(r.legacyFood));
  ok('brak błędów JS', !errors.length, errors.join(' | '));
  await browser.close();
  if (failed) { console.error(failed + ' failed'); process.exit(1); }
  console.log('\nAll diet draft checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
