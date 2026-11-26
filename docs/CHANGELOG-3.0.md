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

## Etap 2d — Progress Wrapped (gałąź `feature/3.0-wrapped`)

- `wrapped.js`: Postępy → „Podsumowanie miesiąca” → „Zobacz swoje podsumowanie”. Okres: miesiąc / kwartał / rok (w pierwszych 5 dniach domyślnie poprzedni miesiąc). Treningi, czas aktywności, tygodnie z treningiem, realizacja planu, rekordy osobiste, największy postęp, etapy i odznaki z okresu, wiadomość od trenera, kolejny cel.
- „Zapisz jako grafikę”: PNG 1080 × 1350 w barwach Team Progress (canvas). „Udostępnij” tylko przez systemowe udostępnianie, dobrowolnie. Bez masy ciała, pomiarów, zdjęć i zgłoszeń zdrowotnych.
- Trener (profil klienta → Plan): wiadomość do podsumowania bieżącego i poprzedniego miesiąca + podgląd liczb. Zapis `client.wrappedNotes` (24 ostatnie). Bez zmian reguł Firestore.
- Testy: `test_wrapped.js`, `test_wrapped_ui.js`.

## Etap 3a — Progress Coach (gałąź `feature/3.0-coach`)

- `coach.js`: nowe sprawy w „Wymagają uwagi” (lista Klienci + pulpit, to samo źródło `clientIssues`): Zgłoszony ból (pilne), Samopoczucie: warto porozmawiać, Film techniki do obejrzenia, Nagroda do wręczenia, Nowy rekord.
- Każda sprawa: powód, kiedy, priorytet, jedno działanie (czat / profil). Znika sama po odpowiedzi trenera w czacie (nagroda — po „wręczona”). Przycisk „Rozwiązane” (`client.coachResolved`) — sprawa wraca tylko przy nowym zdarzeniu.
- Bez automatycznych wiadomości i bez ocen ryzyka zdrowotnego. Bez zmian reguł Firestore.
- Testy: `test_coach.js`, `test_coach_ui.js`.

## Etap 3c — Progress Academy dla klienta (gałąź `feature/3.0-academy`)

- `academy-client.js`: biblioteka 10 lekcji Team Progress (1–3 min, 9 kategorii: trening siłowy, technika, regeneracja, odżywianie, sen, nawyki, motywacja, anatomia, aktywność codzienna); każda z krótkim tekstem, jednym pytaniem i jednym zadaniem.
- Trener (profil klienta → Plan): przypisuje lekcje (kolejność = kolejność wskazówek) i dodaje własne (tytuł, kategoria, tekst, film YouTube, zadanie). Zapis `client.academy`.
- Klient: najwyżej jedna wskazówka na „Dzisiaj” (pierwsza nieprzerobiona), karta „Academy” w zakładce „Trener”, lekcja z pytaniem i „Przerobione ✓”. Postęp zapisuje się na telefonie (klient nie może zmieniać swojej karty) — trener nie widzi jeszcze, co zostało przerobione.
- Bez zmian reguł Firestore. Testy: `test_academy_client.js`, `test_academy_client_ui.js`.

## Etap 3b — Powiadomienia ze zdarzeń (gałąź `feature/3.0-notify`)

### Dodane (`comms-core.js`, `server/automation/comms-worker.cjs`, `comms-app.js`)
- G. **Nowy rekord osobisty** — 20 min po treningu, gdy najcięższa seria robocza (kg, bez rozgrzewki) jest wyższa niż wszystkie wcześniejsze zapisy ćwiczenia. Pierwszy zapis ćwiczenia nie jest rekordem; bez pełnej historii klienta rekordu nie ogłaszamy. Serwer czyta pełną historię tylko klientów z treningiem z ostatnich 2 dni.
- H. **Pakiet się kończy** — N dni przed datą końca (domyślnie 5) o 10:00 oraz przy ostatnim treningu w pakiecie. Przedłużenie pakietu anuluje zaplanowane przypomnienie.
- I. **Podsumowanie miesiąca** — 1. dnia miesiąca (domyślnie 18:00), gdy w poprzednim miesiącu był trening. Link do Postępów (Progress Wrapped).
- **Limit wiadomości na dzień** (domyślnie 2, dzień kalendarzowy w Warszawie): spotkania i zadania trenera się nie liczą, reszta przesuwa się na następny dzień 10:00.
- Ustawienia G/H/I i limitu w panelu „Spotkania i powiadomienia”; podgląd kolejki je pokazuje.
- Treści na zablokowanym ekranie bez nazwiska, kg i danych o zdrowiu. Zgody: rekord i podsumowanie = „checkins”, pakiet = „plan” (bez zmian reguł Firestore).
- Test `test_comms_events.js` (w `check.yml`), rozszerzony `server/automation/test-comms-worker.cjs`.

### Wymaga od właściciela
- Wdrożenie funkcji `commsScheduler` (instrukcja w `server/automation/README.md`). Bez tego nic nie jest wysyłane.
- WhatsApp: zatwierdzenie w Meta 4 nowych szablonów; do tego czasu te wiadomości idą tylko jako push.

### Stan
- Zaprojektowane i zaimplementowane; testy jednostkowe przechodzą lokalnie. Nie testowane na prawdziwym telefonie ani na serwerze.

## Etap 4a — Komendy głosowe (gałąź `feature/3.0-next`)

### Dodane (`voice-commands.js`, style w `client-simple.css`)
- Mikrofon obok głośnika na ekranie ćwiczenia i przerwy — tylko gdy klient włączy „Komendy głosowe” w Profilu (domyślnie wyłączone) i przeglądarka ma rozpoznawanie mowy.
- Słuchanie po dotknięciu, jedno zdanie po polsku. Komendy: „60 kilo 10 powtórzeń”, „80 na 5”, „zapisz” / „zrobione”, „dalej”, „poprzednie”, „cofnij”, „pomiń przerwę” / „gotowy”, „dodaj 30 sekund”, „wycisz” / „włącz głos”, „technika”, „boli” (tylko otwiera formularz bólu).
- Liczby słownie i cyfrą („sześćdziesiąt dwa i pół”, „62,5”). Te same funkcje co przyciski — bez nowej ścieżki zapisu.
- Testy `test_voice_commands.js`, `test_voice_commands_ui.js`.

### Prywatność
- Mowę rozpoznaje usługa telefonu (Apple / Google). Progress nie zapisuje nagrań ani transkrypcji.

### Stan
- Nie testowane na prawdziwym iPhonie (Safari wymaga zgody na mikrofon i rozpoznawanie mowy; jakość rozpoznawania liczb do sprawdzenia na sali).

## Etap 4b — Progress AI dla klienta (gałąź `feature/3.0-client-ai`)

### Dodane
- `client-ai.js`: karta „Progress AI” w zakładce „Trener” (tylko gdy trener włączył), okno rozmowy z 3 szybkimi pytaniami, licznikiem pytań i przyciskiem „Napisz do trenera”. Rozmowa tylko w pamięci.
- Karta trenera w profilu klienta → Plan: włącz / wyłącz, limit 5 / 10 / 20 / 30 pytań dziennie (domyślnie wyłączone, limit 10). Pole `client.aiCoach`.
- Pośrednik AI (`server/ai-proxy/worker.mjs`): ścieżka `/client` — konto klienta sprawdzane w Firestore, stały prompt bezpieczeństwa (bez diagnoz, bez zmian planu, bez diet; przy bólu do trenera, przy objawach 112), limity na klienta i na trenera, przycinanie danych wejściowych.
- `01-core.js`: zabezpieczenie zapytań AI zachowuje ścieżkę pośrednika (`W+'client'`).
- Kontekst dla AI: cel, plan na dziś, tydzień, 5 ostatnich treningów; kontuzje tylko przy zgodzie na dane o zdrowiu.
- Polityka prywatności: opis Progress AI, nowa wersja `2026-11-26` (każdy klient raz potwierdzi politykę).
- Testy: `server/ai-proxy/test-worker.mjs` (rozszerzony), `test_client_ai_ui.js`.

### Wymaga od właściciela
- Wklejenie nowego `worker.mjs` w Cloudflare (instrukcja: `docs/ai-proxy-worker.md`).
- Włączenie Progress AI wybranym klientom.

### Stan
- Nie testowane z prawdziwym modelem ani na telefonie.
