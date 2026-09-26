# Kontynuowanie kolejki Autoflow na serwerze — etap 1

Kod jest przygotowany do wdrożenia, ale sam push do GitHub Pages nie uruchamia funkcji Firebase.
W tej zmianie nie włączono Cloud Functions ani harmonogramu produkcyjnego.

## Sprawdzona konfiguracja projektu — 26.09.2026

Panel projektu `progress-live-fc83d` jest dostępny. Baza `(default)` ma lokalizację
`eur3`; skonfigurowany region funkcji `europe-west1` odpowiada mapowaniu Firebase.
Projekt korzysta z planu Spark. Panel Functions wymaga zmiany planu przed pierwszym
wdrożeniem. Nie włączono płatnego rozliczania ani żadnej funkcji produkcyjnej.

Odczytane reguły produkcyjne dopuszczają dostęp do wszystkich dokumentów każdemu
zalogowanemu użytkownikowi. To nie zapewnia izolacji trenerów. Nie wolno zastąpić
ich od razu głównym `firestore.rules`, ponieważ część pozostałych ekranów nadal
wykonuje szerokie zapytania. Plik `firestore.autoflow-stage1.rules` jest ograniczoną
migracją: chroni `automationState`, `autoflows` i całe `serverAutomation`, zachowując
dotychczasowe uprawnienia pozostałych kolekcji. Nie stanowi pełnego zabezpieczenia
aplikacji. Pełna izolacja zapytań i reguł innych kolekcji jest pilnym kolejnym etapem
przed udostępnieniem aplikacji innym trenerom i aktywacją pracy serwerowej.

Przed publikacją tych reguł musi działać wersja strony z filtrem `trainerId`
w loaderach `loadAutoflowDefinitions` i `loadAutoflowState`. Oba zestawy reguł są
sprawdzane osobno w emulatorze. Konfiguracja `firebase.stage1.deploy.json` wdraża
wyłącznie reguły etapu, bez Functions i bez Hosting; przed użyciem trzeba ponownie
porównać bieżące reguły produkcyjne i zachować ich kopię.

## Zakres

Co 5 minut funkcja może dokończyć **już zapisane** intencje typu wiadomość w aplikacji
lub pojedyncze zadanie. Korzysta z tego samego identyfikatora i potwierdzenia transakcji
co przeglądarka. Współbieżne uruchomienie nie tworzy drugiej wiadomości ani nie nadpisuje
odhaczonego zadania. Każde wykonanie sprawdza aktualnego właściciela, klienta, zakres,
aktywny status automatyzacji i zgodność jej kroku.

To nie jest jeszcze pełny scheduler aplikacji. Wykrywanie nowych zdarzeń, zapisy
do sekwencji i obliczanie ich terminów nadal wymagają otwartej aplikacji.
Formularze pozostają do wykonania w przeglądarce. Nie ma wysyłki email/SMS.
Informacje o farmakologii i reguły planowania nie są zmieniane.

Domyślnie nic się nie wykonuje: brak prywatnej konfiguracji trenera oznacza wyłączenie.
Intencje sprzed momentu włączenia oraz starsze niż 24 godziny są pomijane.
Dla przypomnienia o sesji granicą jest 30 minut od utworzenia intencji.
Przekroczenie terminu nigdy nie jest cofane przez ręczne ponowienie.
To ogranicza ryzyko wysłania zaległych, nieaktualnych wiadomości po uruchomieniu.

## Weryfikacja

- `node server/automation/test-worker.cjs` — testy logiki bez zewnętrznych zależności.
- Workflow **Testy kolejki serwerowej** instaluje izolowane zależności, uruchamia prawdziwy
  emulator Firestore i sprawdza transakcje oraz dostęp do konfiguracji i intencji.
- Test emulatora wymaga lokalnego hosta i projektu `demo-progress-autoflow`; odmawia
  dostępu do produkcji. Dane testowe nie są danymi klientów.

Pakiet npm jest generowany przez `prepare-deploy.cjs` do ignorowanego katalogu
`.runtime`. Repozytorium strony nie wymaga instalowania npm do normalnej pracy.

## Warunki uruchomienia przez administratora

1. Zalogować się na konto mające dostęp do projektu Firebase `progress-live-fc83d`.
   Potwierdzić region bazy, konfigurację rozliczeń i dostępność Cloud Functions/Cloud Scheduler.
   Nie tworzyć ani nie umieszczać klucza konta usługi w repozytorium lub aplikacji.
2. Sprawdzić reguły faktycznie wdrożone w Firestore. Przed włączeniem funkcji wdrożyć
   i zweryfikować zabezpieczenia kolekcji Autoflow (opis migracji powyżej):
   `automationState` i `autoflows` tylko dla właściciela; cała ścieżka
   `serverAutomation/**` niedostępna dla przeglądarki. Wykluczenie tych kolekcji
   z ogólnego matchera jest konieczne — samo dodatkowe `allow ...: if false` nie
   unieważnia innej reguły zezwalającej. Nie zastępować w ciemno innych aktualnych reguł.
3. W katalogu `server/automation`:

   ```sh
   node prepare-deploy.cjs
   npm install --prefix .runtime
   firebase deploy --project progress-live-fc83d --config firebase.json --only functions:autoflow-pending:continuePendingAutoflow
   ```

   Konfiguracja wdraża tylko tę funkcję, bez Hosting i bez zmiany reguł.
   Region funkcji ustawiono na `europe-west1`, zgodny z potwierdzoną bazą `eur3`.
   Nie ma automatycznego wdrożenia produkcyjnego w CI.
4. Po testach na koncie testowym administrator może utworzyć prywatny dokument
   `serverAutomation/private/trainers/{UID_TRENERA}`:

   ```json
   {
     "schemaVersion": 1,
     "enabled": true,
     "stateDocId": "ZWERYFIKOWANY_IDENTYFIKATOR_STANU_TEGO_TRENERA",
     "enabledAt": "MOMENT_URUCHOMIENIA_W_ISO_8601",
     "timeZone": "Europe/Warsaw"
   }
   ```

   `stateDocId` musi wskazywać istniejący dokument `automationState` o zgodnym
   `trainerId`, wybrany przez nowy loader aplikacji. Nie zgadywać identyfikatora
   i nie włączać wszystkich trenerów zbiorczo.
5. Sprawdzić nową testową intencję po zamknięciu aplikacji, jej pojedynczy efekt
   i potwierdzenie. Dopiero wtedy oznaczyć etap jako działający w produkcji.

## Historia, ponawianie i zatrzymanie

Próby i termin następnego ponowienia są zapisywane w prywatnym podzbiorze
`serverAutomation/private/trainers/{uid}/jobs/{jobId}`. Widoczny trenerowi status
trafia do `automationState.serverStatus`, a przeglądarka nie nadpisuje tej mapy
starym stanem. Historia pracy w tle pojawia się tylko po otrzymaniu takich statusów.
Liczba prób jest ograniczona do 5, z rosnącą przerwą; nowy `retryRequestId` z przycisku
ponowienia zeruje limit serwera. Ręczna próba w otwartej aplikacji nadal może wykonać zadanie.
Pominięte, wstrzymane i nieobsługiwane wpisy nie blokują późniejszych zadań:
osobny kursor przechodzi po kolejnych trenerach i intencjach, po maksymalnie 100 na wywołanie.

`enabled: false` w prywatnej konfiguracji zatrzymuje wykonania w tle dla trenera.
Dotychczasowy tryb przeglądarkowy działa dalej. Nie usuwać potwierdzeń `afReceipts`,
żeby nie utracić ochrony przed powtórnym wykonaniem.
Istniejący dokument efektu bez potwierdzenia jest oznaczany jako kolizja i nie jest nadpisywany.
Publiczne logi funkcji zawierają wyłącznie liczniki statusów, bez treści i nazw klientów.

## Dalszy etap

Nowe zdarzenia i harmonogramy należy przenieść do osobnej kolekcji trwałych zadań
z czasem wykonania, stabilnym identyfikatorem zdarzenia i jawnym przełączeniem właściciela
harmonogramu z przeglądarki na serwer. Obecny współdzielony dokument stanu ma limit rozmiaru
i nie zastępuje takiej kolejki. Potrzebne są też zasady retencji historii i formularze
rozpoznawane po identyfikatorze zamiast podobieństwa nazwy.

Dokumentacja Firebase:
[harmonogram funkcji](https://firebase.google.com/docs/functions/schedule-functions),
[wdrażanie funkcji](https://firebase.google.com/docs/functions/manage-functions),
[transakcje](https://firebase.google.com/docs/firestore/manage-data/transactions).
