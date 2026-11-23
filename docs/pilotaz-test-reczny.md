# Pilotaż Progress Live — test ręczny i lista kontrolna produkcji

Ten dokument uzupełnia testy automatyczne. Testy w repozytorium używają atrap Firebase i emulacji
przeglądarki — **nie potwierdzają** działania produkcyjnego Firebase, serwera wiadomości ani zachowania
prawdziwego iPhone'a. To, co poniżej, trzeba zrobić ręcznie przed obiecaniem czegokolwiek klientom.

## 1. Co sprawdzają testy automatyczne (i czego nie)

| Test | Środowisko | Co potwierdza | Czego NIE potwierdza |
|---|---|---|---|
| `test_client_sync_ui.js` | Chromium, atrapa Firestore w pamięci | zapis serii offline, synchronizacja po powrocie sieci, błąd zapisu, konflikt (cudzy dokument), zamknięcie i wznowienie bez utraty danych i bez duplikatu sesji, pełna pamięć telefonu | prawdziwe reguły Firestore, opóźnienia sieci komórkowej, wiele urządzeń naraz |
| `test_client_iphone_webkit_ui.js` (workflow „Safari (WebKit)”) | Playwright WebKit, profil iPhone 13 (Linux) | manifest PWA i meta Safari, nazwy przycisków i pól (VoiceOver je czyta), kolejność fokusu, cele 44 pt, błąd pod polem, obrót ekranu, offline, wznowienie | instalacja na ekranie początkowym, klawiatura iOS, VoiceOver, Dynamic Island, powiadomienia, iOS < 16.4 |
| `test_client_workout_ios_ui.js` | Chromium, symulowane safe area | układ ekranu ćwiczenia 320/375/430 px, safe area przez zmienne CSS | prawdziwe `env(safe-area-inset-*)` |
| `server/automation/test-comms-worker.cjs` | Node, atrapa bazy | kolejka wiadomości, brak podwójnej wysyłki, ponowienia, kanał zapasowy, STOP, stan `commsStatus` (działa / symulacja / wymaga konfiguracji) | prawdziwy Web Push, WhatsApp Cloud API, Cloud Scheduler |
| `test-tenant-rules.cjs`, `test-storage-rules.cjs` (workflow „Izolacja danych”) | emulatory Firebase | reguły z repozytorium dla trenera, klienta, obcego konta i osoby niezalogowanej | czy te same reguły są OPUBLIKOWANE w projekcie |
| `server/ai-proxy/test-worker.mjs` | Node | rola trenera, limit dzienny, brak KV, brak klucza AI = czytelny błąd 503 | konfiguracja Workera w Cloudflare |

## 2. Lista kontrolna produkcji (wymaga dostępu do kont — robi właściciel)

Zaznacz każdy punkt dopiero po sprawdzeniu w konsoli. Niczego nie zmieniaj „w ciemno”.

### Firebase (projekt `progress-live-fc83d`)
- [ ] **Reguły Firestore**: treść w konsoli (Firestore → Reguły) = `firestore.rules` z gałęzi `main`.
      Najprościej: skopiuj oba teksty do porównywarki. Od tej zmiany repozytorium ma nowy blok `commsStatus` —
      bez jego publikacji aplikacja pokazuje „Serwer nie jest uruchomiony” (bezpieczny stan domyślny).
- [ ] **Reguły Storage** (Storage → Reguły) = `storage.rules`. Nowa wersja: publiczne pobranie znanego pliku
      techniki (`get`), ZAKAZ listowania folderów obcym (`list` tylko właściciel-trener), reszta ścieżek zamknięta.
      Sprawdzone 23.11.2026 z zewnątrz (bez logowania): listowanie korzenia i `exercise-media/` zwraca 403.
      Nie sprawdzono listowania pełnej ścieżki `exercise-media/{uid}/{batch}/` — obecne reguły w repozytorium
      przed tą zmianą na to pozwalały (`read: if true`).
- [ ] **Role trenerów**: `trainerRoles/{uid}` tylko dla kont trenerów, `enabled: true`. Konto pilotażowe klienta
      NIE może mieć roli.
- [ ] **Kopie zapasowe Firestore**: włączone zaplanowane kopie (Firestore → Odzyskiwanie po awarii / eksport do
      Cloud Storage) albo świadoma decyzja, że ich nie ma. Sprawdzić datę ostatniej kopii.
- [ ] **Uwierzytelnianie**: dozwolone domeny = `teamprogress2018-droid.github.io`; szablony e-maili (reset hasła) po polsku.
- [ ] **Plan rozliczeń**: Spark wystarcza aplikacji; serwer wiadomości wymaga Blaze (decyzja właściciela).
- [ ] **Logi**: logi funkcji zawierają tylko liczniki i nazwy brakujących ustawień (`comms-summary`,
      `comms-config-missing`) — bez treści, numerów telefonów i tokenów. Sprawdzić po pierwszym uruchomieniu.

### Serwer wiadomości (Push / WhatsApp) — `server/automation/README.md`, sekcja „Wiadomości automatyczne”
- [ ] Funkcje `commsScheduler` i `whatsappWebhook` wdrożone (`firebase functions:list`).
- [ ] Push: parametr `VAPID_PUBLIC_KEY`, sekret `VAPID_PRIVATE_KEY`, ten sam klucz publiczny w `comms-app.js`.
- [ ] WhatsApp: konto Meta Business, numer z metodą płatności, zatwierdzone szablony (utility, pl),
      sekrety `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, parametr `WHATSAPP_PHONE_NUMBER_ID`,
      webhook z polem `messages`.
- [ ] Dokument `serverAutomation/private/trainers/{UID}`: najpierw `live: false` (symulacja), panel pokazuje
      „Symulacja — nic nie jest wysyłane”; dopiero po teście na koncie testowym `live: true`.
- [ ] Panel „Spotkania i powiadomienia” pokazuje przy kanale „Działa”. Jeśli „Wymaga konfiguracji” — panel
      wypisuje nazwy brakujących ustawień.

### Cloudflare (Worker pośrednika AI) — `docs/ai-proxy-worker.md`
- [ ] Kod Workera = `server/ai-proxy/worker.mjs` z `main`.
- [ ] Sekret `ANTHROPIC_API_KEY` ustawiony jako **sekret** (nie zmienna jawna). Bez niego Worker odpowiada 503
      „Klucz AI nie jest skonfigurowany” (nowe zachowanie).
- [ ] Powiązanie KV `RATE` (bez niego 503 — limit nie może zniknąć po cichu). Limit: 400 zapytań na trenera dziennie.
- [ ] Limit wydatków ustawiony w konsoli Anthropic.
- [ ] Logi Workera nie zawierają treści zapytań (Worker niczego nie loguje; nie włączać „Logpush” z treścią).

## 3. Pilotaż na telefonach — konta testowe

Przygotowanie (trener): jedno konto trenera, **dwa konta klientów testowych** (np. `pilot.iphone@…`,
`pilot.android@…`) z fikcyjnymi imionami. Żadnych prawdziwych klientów, numerów ani danych zdrowotnych.

### iPhone (Safari, iOS 16.4 lub nowszy)
1. Trener wysyła zaproszenie na adres testowy. Na iPhonie otwórz link w **Safari** (nie w podglądzie poczty).
2. Załóż konto i zaloguj się. Udostępnij → „Do ekranu początkowego”. Otwórz aplikację **z ikony**
   (powinna otworzyć się bez paska Safari, bez wycięć na Dynamic Island i pasku domowym).
3. Trener przypisuje plan. Klient: ekran Dzisiaj → „Rozpocznij trening”. Sprawdź: przyciski łatwe do trafienia
   kciukiem, pola serii nie chowają się pod klawiaturą, przycisk „Zapisz serię” widoczny nad klawiaturą.
4. Zapisz 2 serie. Obróć telefon poziomo i z powrotem — nic się nie ucina, dane zostają.
5. **Tryb samolotowy** → zapisz serię → widoczne „Zapisano na urządzeniu · oczekuje na synchronizację”.
   Zamknij aplikację (przesuń w górę), otwórz ponownie z ikony: „Trening w toku · na telefonie”, „Wznów trening”.
   Wyłącz tryb samolotowy → po chwili status „Zsynchronizowano”. Trener widzi serie w swoim panelu.
6. Przejdź do innej aplikacji na 2 minuty i wróć — trening jest tam, gdzie był.
7. **VoiceOver** (Ustawienia → Dostępność): przesuwaj palcem w prawo po ekranie ćwiczenia. Każdy element ma
   sensowną nazwę („Seria 1: powtórzenia”, „Zapisz serię 1 z 3”), kolejność: powrót → nazwa ćwiczenia → pola
   serii → zapis. Błąd „Wpisz liczbę powtórzeń…” jest odczytywany.
8. Powiadomienia (tylko po uruchomieniu serwera): Więcej → Powiadomienia → „Włącz powiadomienia” → zgoda →
   „Wyślij powiadomienie testowe”. Do czasu uruchomienia serwera ekran mówi, że wysyłka nie działa — to poprawne.

### Android (Chrome)
Te same kroki 1–6; w kroku 2: menu ⋮ → „Zainstaluj aplikację”. Czytnik ekranu: TalkBack zamiast VoiceOver.

### Co zapisać po pilotażu
Model telefonu i wersja systemu, numer kroku z problemem, zrzut ekranu, godzina. Bez danych prawdziwych klientów.
