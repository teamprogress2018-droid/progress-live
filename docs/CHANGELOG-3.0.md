# Changelog — Progress Live 3.0

## Etap 1 — Stabilizacja (gałąź `feature/progress-live-3.0`)

### Naprawione
- Ekran przerwy po wpisaniu ciężaru z klawiatury był ucięty (kółko poza ekranem, brak licznika). Przyczyna: odtwarzacz zostawał w wysokości „z otwartą klawiaturą”, bo iPhone nie zawsze zgłasza jej schowanie. Teraz tryb klawiatury działa tylko przy aktywnym polu i wyłącza się po utracie fokusu; kółko przerwy nie da się uciąć od góry (`justify-content: safe center`). Pliki: `client-simple.js`, `client-simple.css`.

### Dodane
- Strażnik treningu klienta (`10-client-app.js`): Wake Lock w trakcie treningu, zapis szkicu w telefonie przy schowaniu aplikacji (`visibilitychange`/`pagehide`), wysyłka zaległego zapisu po powrocie do aplikacji (iPhone nie zawsze wysyła `online`), jednorazowa prośba o trwałe miejsce na dane (`navigator.storage.persist`).
- Test `test_client_workout_guard.js` (w `check.yml`).

### Bez zmian
- Model danych Firestore, reguły, stałe id sesji, kolejka zapisu `cwQueuePersist`.

### Świadomie odłożone
- Przeniesienie szkicu treningu z `localStorage` do IndexedDB: obie pamięci Safari czyści tak samo, więc większy zysk daje trwałe miejsce na dane i szybsza wysyłka. Wrócimy do tego, jeśli test na iPhonie pokaże utratę danych.

## Etap 2a — Progress Readiness (gałąź `feature/3.0-readiness`)

### Dodane
- `client-readiness.js`: opcjonalny check-in na „Dzisiaj” w dniu treningu („Jak się dziś czujesz? · 4 pytania · ok. 20 s”). Sen, energia, stres, mięśnie (po 3 odpowiedzi) + „Czy coś Cię boli?” tylko przy zgodzie na dane o zdrowiu.
- Wynik słowem: dobre / umiarkowane / warto skonsultować trening z trenerem. Bez diagnozy, plan nie zmienia się sam.
- Start treningu bez dodatkowego kroku: odpowiedzi z dnia trafiają do `planSnapshot.readiness` przy pierwszym zapisie sesji (bez zmian reguł Firestore).
- Trener: linia „Przed treningiem: …” w oknie treningu i w wiadomości „Zrobiłem trening…”; przy „warto skonsultować” od razu wiadomość w czacie (stałe id na dzień, 1. linia bez odpowiedzi). Push trenera z ogólną treścią (`comms-worker.cjs` — wymaga ponownego wdrożenia funkcji; do tego czasu push pokaże 1. linię wiadomości, która nie zawiera odpowiedzi).
- Wyłącznik: `window.CS_READINESS_OFF=true`.
- Testy: `test_client_readiness.js` (logika), `test_client_readiness_ui.js` (Playwright).

## Progress Voice 1.0 (gałąź `feature/progress-voice`)

- `client-voice.js`: 100 komunikatów, liczebniki po polsku, silnik zdarzeń z kolejką, style i częstotliwość, ustawienia w Profilu, ikona głośnika.
- Głos trenera: 144 nagrania (ElevenLabs, model eleven_v4, ton „energetic, motivating coach voice”) w `assets/voice/pv/` (3,4 MB, 1–5,6 s na plik). Generator `.github/scripts/build_voice_pack.js` + workflow `voice-pack.yml` (klucz tylko w sekrecie `ELEVENLABS_API_KEY`). Ponowne generowanie: zmień `.github/voice-pack.request` albo uruchom workflow ręcznie; gotowe pliki są pomijane.
- Zdania spoza paczki (np. z nazwą ćwiczenia) czyta synteza mowy telefonu.
- Do zrobienia: panel nagrań trenera (osobny PR, reguły Storage).

## Etap 2b — Progress Express (gałąź `feature/3.0-express`)

- `express.js`: trener (profil klienta → Plan, pod rozgrzewką) włącza krótsze treningi i ustala regułę: skrócony ~30 min = pierwsze N ćwiczeń (domyślnie 4, serie: wszystkie albo maks. K), Express ~15 min = pierwsze N (domyślnie 2) × maks. K serii (domyślnie 2). Kolejność w planie = priorytet; super-serii nie rozcinamy; rozgrzewka zostaje. Podgląd dni aktywnego planu z czasem.
- Klient: „Mniej czasu?” na „Dzisiaj” (tylko gdy trener włączył) → 3 warianty z czasem → start od razu (2 dotknięcia).
- Zapis: `client.express` (karta klienta), w treningu `planSnapshot.variant` (rodzaj, czas, pominięte, limit serii). Trener widzi „Wariant: …” w oknie treningu i w wiadomości „Zrobiłem trening…”. Bez zmian reguł Firestore.
- Testy: `test_express.js`, `test_express_ui.js`.

## Etap 2c — Progress Journey + Rewards (gałąź `feature/3.0-journey`)

- `journey.js`: „Twoja droga” (kamienie milowe: pierwszy trening, tydzień, 10 treningów, miesiąc, pierwszy rekord, 30/50 treningów, 100 dni, cel ustalony z trenerem) i „Odznaki” (8: Pierwszy krok, Regularność, Konsekwencja, Wytrwałość, Rekordzista, Zdrowe nawyki, Progress Champion, Progress Elite) na ekranie Postępy.
- Wszystko liczone z zapisanych treningów przy każdym wyświetleniu — brak podwójnego naliczania; data zdobycia = dzień spełnienia warunku. Bez nagród za objętość i trening mimo bólu.
- Trener (profil klienta → Plan): nagroda za odznakę (lista lub własna), „wręczona”, indywidualny cel klienta i jego osiągnięcie; „Do wręczenia (N)”. Klient widzi nagrodę dopiero po zdobyciu odznaki.
- Zapis: `client.rewards`, `client.journeyGoal` (karta klienta). Bez zmian reguł Firestore.
- Testy: `test_journey.js`, `test_journey_ui.js`.
