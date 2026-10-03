// Otwiera index.html w prawdziwej (niewidzialnej) przeglądarce Chromium
// i sprawdza, czy podczas ładowania strony pojawiają się błędy w konsoli
// albo nieudane pobrania plików (404). Nie loguje się do apki (ekran logowania
// wystarcza, żeby wykryć zepsute pliki JS/CSS, literówki w onclick itd.)

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const problems = [];

  page.on('pageerror', (err) => {
    problems.push('Błąd JavaScript: ' + err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      problems.push('Błąd konsoli: ' + msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    // favicon.ico i rozszerzenia przegladarki ignorujemy - to nie nasz kod
    if (req.url().includes('favicon.ico')) return;
    problems.push('Nie udało się wczytać: ' + req.url());
  });

  try {
    await page.goto('http://localhost:8080/index.html', {
      waitUntil: 'networkidle',
      timeout: 20000,
    });
    await page.waitForTimeout(1500);
  } catch (e) {
    problems.push('Strona nie wczytała się w ogóle: ' + e.message);
  }

  await browser.close();

  if (problems.length) {
    console.error('Znaleziono problemy przy wczytywaniu strony:\n');
    problems.forEach((p) => console.error('  - ' + p));
    process.exit(1);
  } else {
    console.log('Strona wczytała się poprawnie, zero błędów w konsoli.');
    process.exit(0);
  }
})();
