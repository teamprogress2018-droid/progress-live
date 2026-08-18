// Testy wysyłki i wypełniania formularzy (bez przeglądarki).
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const document = {
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}
};
const windowObj = {
  addEventListener() {},
  CL: [], PL: [], SE: [], EX: [], WO: [],
  METRIC_ENTRIES: [],
  FORM_SENDS: [],
  document
};
windowObj.window = windowObj;
const ctx = {
  window: windowObj,
  document,
  console,
  Date,
  Math,
  parseInt,
  parseFloat,
  Number,
  String,
  Array,
  Object,
  JSON,
  Set,
  setTimeout,
  clearTimeout,
  isNaN,
  Infinity,
  undefined
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '01-core.js'), 'utf8'), ctx);

const {
  snapshotFormQuestions, formQuestionsForSend, formSendAnswersMap,
  formatFormAnswer, missingRequiredFormAnswers, pendingFormSends, applyFormSubmit
} = ctx;

let failed = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) {
    console.error('FAIL ' + name + '\n  got:  ' + g + '\n  want: ' + w);
    failed++;
  } else {
    console.log('OK   ' + name);
  }
}

const form = {
  id: 'df1',
  name: 'Ankieta wstępna',
  questions: [
    {id: 'q1', type: 'text', text: 'Cel?', required: true},
    {id: 'q2', type: 'scale', text: 'Energia', required: true},
    {id: 'q3', type: 'yesno', text: 'Kontuzje?', required: false},
    {id: 'q4', type: 'choice', text: 'Pora', options: ['Rano', 'Wieczór']}
  ]
};

const snap = snapshotFormQuestions(form);
eq('snapshot length', snap.length, 4);
eq('snapshot required', snap[0].required, true);
eq('snapshot options copy', snap[3].options, ['Rano', 'Wieczór']);
snap[3].options.push('Noc');
eq('snapshot isolated', form.questions[3].options, ['Rano', 'Wieczór']);

const send = {
  id: 'fs1',
  formId: 'df1',
  clientId: 'c1',
  status: 'sent',
  questions: snap,
  answers: {}
};
eq('questions from snapshot', formQuestionsForSend(send).map(q => q.id), ['q1', 'q2', 'q3', 'q4']);
eq('questions fallback form', formQuestionsForSend({formId: 'df1'}, [form]).length, 4);

eq('answers empty', formSendAnswersMap({answers: {}}), {});
eq('answers object', formSendAnswersMap({answers: {q1: 'masa'}}).q1, 'masa');
eq('answers array objects', formSendAnswersMap({answers: [{id: 'q1', value: 'x'}]}).q1, 'x');

eq('format empty', formatFormAnswer({type: 'text'}, ''), '—');
eq('format yes', formatFormAnswer({type: 'yesno'}, 'tak'), 'Tak');
eq('format no', formatFormAnswer({type: 'yesno'}, 'nie'), 'Nie');
eq('format scale', formatFormAnswer({type: 'scale'}, '8'), '8');

eq('missing both required', missingRequiredFormAnswers(snap, {}).map(q => q.id), ['q1', 'q2']);
eq('missing none', missingRequiredFormAnswers(snap, {q1: 'masa', q2: '7'}).length, 0);

const sends = [
  {id: 'a', clientId: 'c1', status: 'sent'},
  {id: 'b', clientId: 'c1', status: 'filled'},
  {id: 'c', clientId: 'c2', status: 'sent'}
];
eq('pending for c1', pendingFormSends('c1', sends).map(s => s.id), ['a']);

const r1 = applyFormSubmit({...send, answers: {}}, {q2: '8'});
eq('submit required fail', r1.ok, false);
eq('submit required err', r1.error, 'required');

const live = {...send, answers: {}};
const r2 = applyFormSubmit(live, {q1: 'masa', q2: '8', q3: 'nie'});
eq('submit ok', r2.ok, true);
eq('submit status', live.status, 'filled');
eq('submit keeps answers', live.answers.q1, 'masa');
eq('submit filledAt', typeof live.filledAt, 'string');

const r3 = applyFormSubmit(live, {q1: 'inne', q2: '1'});
eq('submit already', r3.error, 'already');

eq('submit missing send', applyFormSubmit(null, {}).error, 'missing');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nWszystkie testy formularzy OK.');
