'use strict';
/** Notatka „Do zrobienia” przy każdym ćwiczeniu: kreator, Live, apka klienta. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, '01-core.js'), 'utf8');
const live = fs.readFileSync(path.join(root, '02-workouts-onboarding-templates-live.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, '05-clients-builder-plans-calendar.js'), 'utf8');
const client = fs.readFileSync(path.join(root, '10-client-app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'check.yml'), 'utf8');

let failed = 0;
function ok(name, cond, extra) {
  if (!cond) {
    console.error('FAIL ' + name + (extra ? ' — ' + extra : ''));
    failed++;
  } else console.log('OK   ' + name);
}

ok('cache 01', html.includes('01-core.js?v=124'));
ok('cache 02', html.includes('02-workouts-onboarding-templates-live.js?v=86'));
ok('cache 05', html.includes('05-clients-builder-plans-calendar.js?v=80'));
ok('cache 10', html.includes('10-client-app.js?v=42'));
ok('cache styles', html.includes('styles.css?v=116'));
ok('CI unit', wf.includes('test_ex_todo_note.js'));
ok('CI readable ui', wf.includes('test_live_readable_ui.js'));

ok('core helper', /function exerciseTodoNote\(/.test(core) && /window\.exerciseTodoNote=exerciseTodoNote/.test(core));
ok('logged note persisted', /if\(todo\)out\.note=todo/.test(core));
ok('builder label', builder.includes('Do zrobienia') && builder.includes('builder-todo-input') && /data-f="note"/.test(builder));
ok('builder autofill', /function builderFillExTodo\(/.test(builder) && /builderOnExNameChange/.test(builder));
ok('live todo field', /live-ex-todo/.test(live) && /function liveSetExTodo\(/.test(live) && /live-ex-todo-snip/.test(live));
ok('live no duplicate media note', /showNote:false/.test(live));
ok('client todo', /cw-ex-todo/.test(client) && /Do zrobienia/.test(client) && /showNote:false/.test(client));
ok('css', css.includes('.live-ex-todo') && css.includes('.builder-todo-input') && css.includes('.cw-ex-todo'));

const ctx = {
  window: {},
  console,
  String,
  libExerciseByName: name => {
    if (name === 'Wyciskanie sztangi leżąc') return { tip: 'Łopatki ściągnięte i wciśnięte w ławkę.' };
    if (name === 'Pompki') return { desc: 'Ciało w jednej linii.' };
    return null;
  }
};
vm.createContext(ctx);
const slice = (src, start, end) => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('slice missing ' + start);
  return src.slice(a, b);
};
vm.runInContext(slice(core, 'function exerciseTodoNote', 'window.exerciseTodoNote'), ctx);
vm.runInContext(slice(core, 'function serializeLoggedExercise', 'window.serializeLoggedExercise'), ctx);
vm.runInContext(slice(core, 'function serializeLoggedSet', 'window.serializeLoggedSet'), ctx);
vm.runInContext(
  'function resolveExerciseId(e){return (e&&e.exerciseId)||"";}\nfunction exLoadUnit(){return "kg";}',
  ctx
);
vm.runInContext(slice(builder, 'function builderFillExTodo', 'window.builderFillExTodo'), ctx);

ok('own note wins', ctx.exerciseTodoNote({ name: 'Wyciskanie sztangi leżąc', note: 'Pauza 2 s' }) === 'Pauza 2 s');
ok('libTip fallback', ctx.exerciseTodoNote({ name: 'X', libTip: 'Z biblioteki' }) === 'Z biblioteki');
ok('library tip by name', ctx.exerciseTodoNote({ name: 'Wyciskanie sztangi leżąc' }) === 'Łopatki ściągnięte i wciśnięte w ławkę.');
ok('library desc by name', ctx.exerciseTodoNote({ name: 'Pompki' }) === 'Ciało w jednej linii.');
ok('empty unknown', ctx.exerciseTodoNote({ name: 'Nieznane' }) === '');

const saved = ctx.serializeLoggedExercise({ name: 'Wyciskanie', note: 'Łopatki ściągnięte', sets: [{ kg: 40, reps: 8, done: true }] }, { onlyDone: true });
ok('serialize keeps note', saved.note === 'Łopatki ściągnięte');
ok('serialize skips empty note', ctx.serializeLoggedExercise({ name: 'X', sets: [{ kg: 10, reps: 5, done: true }] }, { onlyDone: true }).note == null);

function fakeRow(name, note, autoTodo) {
  const fields = { name: { value: name || '' }, note: { value: note || '' } };
  return {
    dataset: { autoTodo: autoTodo || '' },
    querySelector: sel => {
      const m = /data-f="([^"]+)"/.exec(sel);
      return m ? fields[m[1]] : null;
    },
    _fields: fields
  };
}
const empty = fakeRow('Wyciskanie sztangi leżąc', '');
ctx.builderFillExTodo(empty);
ok('builder fills empty from lib', empty._fields.note.value === 'Łopatki ściągnięte i wciśnięte w ławkę.' && empty.dataset.autoTodo === empty._fields.note.value);

const custom = fakeRow('Wyciskanie sztangi leżąc', 'Pauza 2 s na dole');
ctx.builderFillExTodo(custom);
ok('builder keeps custom', custom._fields.note.value === 'Pauza 2 s na dole');

const auto = fakeRow('Wyciskanie sztangi leżąc', 'Łopatki ściągnięte i wciśnięte w ławkę.');
ctx.builderFillExTodo(auto);
auto._fields.name.value = 'Pompki';
ctx.builderFillExTodo(auto);
ok('builder updates previous auto tip', auto._fields.note.value === 'Ciało w jednej linii.');

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nNotatka Do zrobienia — testy OK.');
