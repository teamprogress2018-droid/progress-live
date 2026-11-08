#!/usr/bin/env node
'use strict';
// Etap 3 z 3 (audyt 8.11.2026): ciąża, cukrzyca lub zaburzenia odżywiania z ankiety blokują wysyłkę
// jadłospisu, dopóki trener nie zaznaczy osobnego potwierdzenia ryzyka. Minimum kalorii w dzień wolny.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cacheAtLeast } = require('./cache-pin.js');

const root = path.join(__dirname, '../..');
const D = require(path.join(root, 'diet-plan.js'));
const src07 = fs.readFileSync(path.join(root, '07-forms-metrics-calculator.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) { console.error('FAIL', name, extra || ''); failed++; }
  else console.log('OK  ', name);
}
function extract(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; begun = true; }
    else if (src[i] === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// 1. Wykrywanie z odpowiedzi ankiety „Gotowość do wysiłku” (pyt. 8 „Ciąża i połóg”).
const parq = (q8, extra = {}) => [{ form: 'Gotowość do wysiłku (wzorowana na PAR-Q+)', answers: { q1: 'Nie', q4: 'Nie', q8, ...extra } }];
const preg = D.dietHealthRisks({ answers: parq('Jestem w ciąży') });
ok('„Jestem w ciąży” → ryzyko ciąża', preg.length === 1 && preg[0].id === 'ciaza' && /Jestem w ciąży/.test(preg[0].evidence), JSON.stringify(preg));
ok('„Nie dotyczy” i „po porodzie” → bez ryzyka ciąży', D.dietHealthRisks({ answers: parq('Nie dotyczy') }).length === 0
  && D.dietHealthRisks({ answers: parq('Jestem do 12 miesięcy po porodzie') }).length === 0);
const diab = D.dietHealthRisks({ answers: parq('Nie dotyczy', { q4: 'Tak', q9: 'Cukrzyca typu 2, metformina' }) });
ok('cukrzyca z opisu w ankiecie', diab.some(r => r.id === 'cukrzyca'));
ok('insulina → cukrzyca, insulinooporność sama nie', D.dietHealthRisks({ texts: ['biorę insulinę'] }).some(r => r.id === 'cukrzyca')
  && !D.dietHealthRisks({ texts: ['insulinooporność'] }).some(r => r.id === 'cukrzyca'));
const ed = D.dietHealthRisks({ texts: ['W przeszłości anoreksja'] });
ok('zaburzenia odżywiania z profilu', ed.length === 1 && ed[0].id === 'zaburzenia');
ok('zaburzenia odżywiania — opis słowny', D.dietHealthRisks({ texts: ['zaburzenia odżywiania w leczeniu'] }).some(r => r.id === 'zaburzenia'));
ok('kilka ryzyk naraz, każde raz', D.dietHealthRisks({ answers: parq('Jestem w ciąży', { q9: 'cukrzyca ciążowa' }) }).map(r => r.id).join() === 'ciaza,cukrzyca');

// 2. Reguła wysyłki.
ok('bez ryzyka wystarczy „sprawdziłem plan”', D.dietCanSend({ risks: [], approved: true }).ok === true);
ok('bez „sprawdziłem plan” nie wysyła', D.dietCanSend({ risks: [], approved: false }).reason === 'approve');
ok('ciąża bez potwierdzenia ryzyka blokuje', D.dietCanSend({ risks: preg, approved: true, riskAck: false }).reason === 'risk');
ok('ciąża + świadome potwierdzenie → można wysłać', D.dietCanSend({ risks: preg, approved: true, riskAck: true }).ok === true);

// 3. Karta zatwierdzania: osobny checkbox z opisem ryzyka.
const tK = D.dietBookTargets({ weight: 60, age: 30, kcal: 2000, rmr: 1300, pal: 1.5, goal: 'inne' });
const plan = D.dietBuildDay({ targets: tK, meals: 5, variant: 0 });
const checks = D.dietApprovalChecks(tK, plan, { risks: preg });
ok('lista kontrolna ma czerwony punkt z ankiety', checks.some(c => c.level === 'stop' && c.risk === 'ciaza' && c.text.includes('Jestem w ciąży') && c.sources.length));
const card = D.dietRenderCard(tK, plan, { meals: 5, approval: { checks } });
ok('osobny checkbox ryzyka z opisem', card.includes('id="diet-risk-ack"') && card.includes('Świadomie wysyłam mimo ryzyka: ciąża') && card.includes('może zaszkodzić'));
ok('przycisk wysyłki nadal wyłączony na start', /id="diet-approve-btn" disabled/.test(card));
const cardNoRisk = D.dietRenderCard(tK, plan, { meals: 5, approval: { checks: D.dietApprovalChecks(tK, plan, {}) } });
ok('bez ryzyka nie ma checkboxa ryzyka', !cardNoRisk.includes('diet-risk-ack') && cardNoRisk.includes('diet-approve-check'));
ok('blokada <18 lat zostaje', D.dietBookTargets({ weight: 50, age: 16, kcal: 2000, rmr: 1300 }).blocked === true);

// 4. Zachowanie przycisku „Zatwierdź i wyślij” w kalkulatorze (prawdziwe funkcje z 07).
function runApprove({ answer, approved, riskAck }) {
  const els = {
    'diet-approve-check': { checked: approved },
    'diet-risk-ack': riskAck === undefined ? null : { checked: riskAck },
  };
  const sent = [], stored = [], notes = [];
  const client = { id: 'c-preg', name: 'Anna' };
  const sb = {
    window: { FORM_SENDS: [{ clientId: 'c-preg', status: 'filled', formName: 'Gotowość do wysiłku', answers: { q8: answer } }], _dietLast: { day: {} }, _uid: 'trainer-1' },
    document: { getElementById: id => els[id] || null },
    DietPlan: D, notify: m => notes.push(m), pushMsg: (id, t) => sent.push(id), calcTDEE() {},
    dietCalcClient: () => client, dietStorePlan: (c, rec) => stored.push(rec),
    dietPlanRecord: status => ({ status, updatedAt: '2026-11-08T12:00:00Z', text: 'plan' }),
    formSendAnswersMap: s => s.answers,
  };
  vm.runInNewContext(extract(src07, 'dietClientHealthRisks') + '\n' + extract(src07, 'dietApproveAndSend') + '\nthis.go=dietApproveAndSend;', sb);
  sb.go();
  return { sent, stored, notes };
}
const blocked = runApprove({ answer: 'Jestem w ciąży', approved: true, riskAck: false });
ok('ciąża w ankiecie: wysyłka zablokowana bez potwierdzenia ryzyka', blocked.sent.length === 0 && blocked.stored.length === 0 && /ciąża/.test(blocked.notes.join(' ')), JSON.stringify(blocked));
const blockedNoBox = runApprove({ answer: 'Jestem w ciąży', approved: true });
ok('ciąża: brak checkboxa w DOM też blokuje', blockedNoBox.sent.length === 0);
const acked = runApprove({ answer: 'Jestem w ciąży', approved: true, riskAck: true });
ok('ciąża + potwierdzenie: wysłane i zapisane potwierdzenie ryzyka', acked.sent.length === 1 && acked.stored[0].riskAck && acked.stored[0].riskAck.risks.join() === 'ciaza' && acked.stored[0].riskAck.by === 'trainer-1');
const normal = runApprove({ answer: 'Nie dotyczy', approved: true });
ok('bez ryzyka: wysyłka jak dotąd', normal.sent.length === 1 && !normal.stored[0].riskAck);
const notChecked = runApprove({ answer: 'Nie dotyczy', approved: false });
ok('bez zaznaczenia „sprawdziłem” nic nie wychodzi', notChecked.sent.length === 0);

// 5. Minimum kalorii obowiązuje też w dzień wolny; rozkład makro bez zmian (tłuszcz % jak w dniu treningowym).
const train = D.dietBookTargets({ weight: 50, age: 30, kcal: 1200, rmr: 1189, pal: 1.55, goal: 'redukcja', goalDelta: -500 });
const rest = D.dietRestTargets(train, { rmr: 1100, pal: 1.55, goalDelta: -500, kcalFloor: 1200 });
ok('dzień wolny nie schodzi poniżej minimum', rest.kcal === 1200 && rest.notes.some(n => n.text.includes('minimum zadziałało')), rest.kcal);
ok('dzień wolny: tłuszcz nadal 25% energii', rest.fat.g === Math.round(1200 * train.fat.pct / 100 / 9));
ok('bez minimum dzień wolny jak dotąd', D.dietRestTargets(train, { rmr: 1100, pal: 1.55, goalDelta: -500 }).kcal === Math.round(1100 * 1.5 - 500));
ok('kalkulator przekazuje minimum do dnia wolnego', src07.includes('kcalFloor:o.kcalFloor') && src07.includes('kcalFloor:kcalFloor.floor'));

ok('cache 07', cacheAtLeast(html, '07-forms-metrics-calculator.js', 56));
ok('cache diet-plan', cacheAtLeast(html, 'diet-plan.js', 13));

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nAll diet health-block checks passed');
