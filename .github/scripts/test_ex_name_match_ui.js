// Nazwy ćwiczeń z planów (np. z generatora) dopasowują się do biblioteki, żeby klient widział film techniki.
'use strict';
const { chromium } = require('playwright');
let failed = 0;
const ok = (n, c, x) => { if (!c) { console.error('FAIL ' + n + (x ? ' — ' + x : '')); failed++; } else console.log('OK   ' + n); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.route('https://www.gstatic.com/firebasejs/**', r => r.abort());
  await p.goto('http://localhost:' + (process.env.LAYOUT_PORT || '8080') + '/index.html?nocache=ex-name', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const f = n => { const l = libExerciseByName(n); const m = resolveCoachMedia({ name: n }); return { lib: l && l.name, film: !!(m.gif || m.video) }; };
    return { wide: f('Ściąganie wyciągu górnego szerokim chwytem'), plain: f('Ściąganie wyciągu górnego'), narrow: f('Ściąganie wyciągu górnego wąskim chwytem'),
      row: f('Wiosłowanie na wyciągu dolnym'), exact: f('Ściąganie drążka szerokim chwytem'), pull: f('Podciąganie na drążku') };
  });
  ok('„Ściąganie wyciągu górnego szerokim chwytem” = ściąganie drążka szerokim chwytem, z filmem', r.wide.lib === 'Ściąganie drążka szerokim chwytem' && r.wide.film, JSON.stringify(r.wide));
  ok('„Ściąganie wyciągu górnego” = ściąganie drążka wyciąg, z filmem', r.plain.lib === 'Ściąganie drążka wyciąg' && r.plain.film, JSON.stringify(r.plain));
  ok('„… wąskim chwytem” = ściąganie drążka wąskim chwytem', r.narrow.lib === 'Ściąganie drążka wąskim chwytem', JSON.stringify(r.narrow));
  ok('wyciąg dolny nie staje się ściąganiem drążka', r.row.lib && !/Ściąganie/.test(r.row.lib), JSON.stringify(r.row));
  ok('dokładna nazwa bez zmian', r.exact.lib === 'Ściąganie drążka szerokim chwytem' && r.exact.film);
  ok('podciąganie na drążku bez zmian', r.pull.lib === 'Podciąganie na drążku', JSON.stringify(r.pull));
  await b.close();
  if (failed) { console.error(failed + ' błąd(ów)'); process.exit(1); }
  console.log('Dopasowanie nazw ćwiczeń: OK');
})().catch(e => { console.error(e); process.exit(1); });
