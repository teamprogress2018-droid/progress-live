# Kontynuowanie kolejki Autoflow na serwerze — etap 1

Kod jest przygotowany do wdrożenia, ale sam push do GitHub Pages nie uruchamia funkcji Firebase.
W tej zmianie nie włączono Cloud Functions ani harmonogramu produkcyjnego.

## Sprawdzona konfiguracja projektu — 26.09.2026

Panel projektu `progress-live-fc83d` jest dostępny. Baza `(default)` ma lokalizację
`eur3`; skonfigurowany region funkcji `europe-west1` odpowiada mapowaniu Firebase.
Projekt korzysta z planu Spark. Panel Functions wymaga zmiany planu przed pierwszym
wdrożeniem. Nie włączono płatnego rozliczania ani żadnej funkcji produkcyjnej.

Przed migracją reguły produkcyjne dopuszczały dostęp do wszystkich dokumentów każdemu
zalogowanemu użytkownikowi. 26.09.2026 o 17:54 (Europe/Warsaw) opublikowano reguły
etapu Autoflow w konsoli Firebase po przejściu obu wariantów emulatora. Strona
zawiera już zapytania ograniczone do właściciela; po wdrożeniu panel trenera
nadal wczytuje siedem istniejących automatyzacji i historię wykonań.

To nie zapewnia pełnej izolacji trenerów. Nie wolno zastąpić reguł etapu
od razu głównym `firestore.rules`, ponieważ część pozostałych ekranów nadal
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

## Propozycje filmów YouTube do ćwiczeń

Przycisk **„Znajdź propozycje według popularności”** w szczegółach ćwiczenia
nie kopiuje żadnych filmów. Wyszukuje wyłącznie publiczne filmy przez YouTube
Data API i zwraca maksymalnie pięć propozycji do ręcznego wyboru. Wyniki są
odrzucane, gdy tytuł nie pasuje wystarczająco do ćwiczenia albo autor zabronił
osadzania filmu. Kolejność uwzględnia przede wszystkim zgodność tytułu, a potem
wyświetlenia i polubienia. YouTube nie udostępnia obecnie publicznego licznika
niepolubień, więc nie jest on używany.

Klucz API nigdy nie trafia do aplikacji, Firestore ani repozytorium. Administrator
tworzy ograniczony klucz dla **YouTube Data API v3**, zapisuje go w Firebase Secret
Manager jako `YOUTUBE_DATA_API_KEY`, a następnie wdraża wyłącznie tę funkcję:

```sh
node prepare-deploy.cjs
npm install --prefix .runtime
firebase functions:secrets:set YOUTUBE_DATA_API_KEY --project progress-live-fc83d
firebase deploy --project progress-live-fc83d --config firebase.json --only functions:autoflow-pending:youtubeCurationSuggest
```

Klucz należy ograniczyć w Google Cloud do API **YouTube Data API v3**. Funkcja
przyjmuje tylko żądania z aplikacji Progress Live, wymaga zalogowanego trenera,
ma limit 80 nowych wyszukań na dobę oraz siedmiodniowy cache wyników. Jedno nowe
wyszukiwanie używa `search.list` (100 jednostek kwoty) i `videos.list` (1
jednostka), więc dzienny limit to maksymalnie około 8 080 jednostek. Przed
masowym przypisywaniem należy najpierw ręcznie sprawdzić propozycję oraz kliknąć
**„Przypisz film”** przy właściwym ćwiczeniu.

Weryfikacja bez kontaktu z YouTube:

```sh
node server/automation/test-youtube-curation-core.cjs
```

Dokumentacja: [YouTube search.list](https://developers.google.com/youtube/v3/docs/search/list),
[statystyki videos.list](https://developers.google.com/youtube/v3/docs/videos/list),
[sekrety Firebase Functions](https://firebase.google.com/docs/functions/config-env).

## Wiadomości automatyczne: przypomnienia o spotkaniach (A–F), push i WhatsApp

Kod jest gotowy, ale **nic nie jest wdrożone ani wysyłane**. Bez kroków poniżej aplikacja działa
tylko w środku: klient widzi spotkanie, potwierdza je i prosi o zmianę, a trener ma „Do odpowiedzi”.
Podgląd kolejki w panelu trenera jest opisany jako symulacja.

- `../../comms-core.js` — wspólna logika (aplikacja i serwer): co i kiedy wysłać, anulowanie po zmianie
  lub odwołaniu terminu, przerwa klienta, zgody, jeden kanał naraz, kanał zapasowy, statusy, Europe/Warsaw.
- `comms-worker.cjs` — harmonogram (`commsScheduler`, co 5 minut) i webhook WhatsApp (`whatsappWebhook`).
- Testy bez sieci i bez Firebase: `node server/automation/test-comms-worker.cjs`.

### Dane

| Kolekcja | Kto zapisuje | Co zawiera |
|---|---|---|
| `commsCases` | klient (zgłoszenia), trener (status), serwer (WhatsApp, zadania) | sprawy „Do odpowiedzi”: nowa / w trakcie / zakończona |
| `commsPrefs/{clientId}` | tylko klient | wybrany kanał, zgoda WhatsApp z datą i treścią, kategorie, cisza nocna |
| `pushSubscriptions` | klient (swoje urządzenie), serwer usuwa wygasłe | adres i klucze Web Push |
| `commsJobs` | tylko serwer | kolejka i statusy: zaplanowano → przekazano → dostarczono → odczytano, błąd, nieznany, anulowano |
| `commsStatus/{trainerId}` | tylko serwer (każde uruchomienie) | czas ostatniego uruchomienia i stan kanałów: `live` / `simulation` / `needs_config` / `off` z NAZWAMI brakujących ustawień — bez treści, danych klientów i wartości sekretów |

Reguły są w `firestore.rules` i są sprawdzane w emulatorze (`test-tenant-rules.cjs`).
**Trzeba je opublikować w konsoli Firebase** (Firestore → Reguły). Do tego czasu zgłoszenia klientów
idą zwykłą wiadomością czatu ze znacznikiem, a „Do odpowiedzi” odczytuje je z czatu.

### Uruchomienie (administrator)

1. Plan Blaze w projekcie `progress-live-fc83d` (Cloud Functions i Cloud Scheduler). To płatna usługa:
   decyzja należy do właściciela.
2. Push: wygenerować klucze VAPID (`npx web-push generate-vapid-keys`). Publiczny klucz wpisać
   w `comms-app.js` (`VAPID_PUBLIC_KEY`) i jako parametr `VAPID_PUBLIC_KEY`. Prywatny zapisać jako sekret:
   `firebase functions:secrets:set VAPID_PRIVATE_KEY --project progress-live-fc83d`.
3. WhatsApp (opcjonalnie): konto Meta Business, WhatsApp Business Account, numer z dodaną płatnością,
   zatwierdzone szablony (kategoria utility, język pl) o nazwach z `comms-core.js → whatsappTemplate`.
   Sekrety: `WHATSAPP_TOKEN` (token systemowy), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`.
   Parametr: `WHATSAPP_PHONE_NUMBER_ID`. Adres webhooka: URL funkcji `whatsappWebhook`, pole `messages`.
4. Wdrożenie tylko tych funkcji:
   ```sh
   node prepare-deploy.cjs && npm install --prefix .runtime
   firebase deploy --project progress-live-fc83d --config firebase.json --only functions:autoflow-pending:commsScheduler,functions:autoflow-pending:whatsappWebhook
   ```
5. Włączenie dla jednego trenera — najpierw symulacja (dokument `serverAutomation/private/trainers/{UID}`):
   ```json
   {"comms": {"enabled": true, "enabledAt": "MOMENT_WŁĄCZENIA_ISO", "live": false, "channels": ["push"]}}
   ```
   Po sprawdzeniu historii („Symulacja — nic nie wysłano”) na koncie testowym: `"live": true`.
   Dopisanie `"whatsapp"` do `channels` włącza WhatsApp. `enabled: false` zatrzymuje wszystko.
   Zmiany i plany sprzed `enabledAt` nie wywołują wiadomości (brak zaległej wysyłki po włączeniu).
6. Sprawdzenie w aplikacji: panel „Spotkania i powiadomienia” czyta `commsStatus`. Pokazuje „Działa” tylko wtedy,
   gdy serwer uruchomił się w ostatnich 30 minutach, kanał jest włączony, ma komplet ustawień i `live: true`.
   Bez dokumentu (serwer nie wdrożony albo reguła `commsStatus` nieopublikowana) panel i klient widzą
   „Serwer nie jest uruchomiony”. Brak ustawień kanału = „Wymaga konfiguracji” z listą nazw, nigdy pozorna wysyłka.
   W logach funkcji pojawia się wtedy `comms-config-missing` z nazwą kanału i nazwami brakujących ustawień.

### Zasady wysyłki

- Jedna wiadomość jednym kanałem: wybranym przez klienta, jeśli ma zgodę. Bez zgody — tylko w aplikacji.
- Błąd przejściowy: ponowienie po 5, 20, 60 min (3 próby). Potem raz kanał zapasowy (jeśli klient go nie wyłączył).
  Błąd trwały (np. numer bez WhatsApp, wygasła subskrypcja push) — od razu kanał zapasowy.
- Dwie instancje naraz nie wyślą dwa razy: zadanie jest zajmowane transakcją, id jest stałe.
- Push nie daje potwierdzenia dostarczenia: status zostaje „Przekazano do dostawcy”.
  WhatsApp zwraca dostarczono / odczytano (odczyt tylko, gdy klient ma włączone potwierdzenia).
  Brak odpowiedzi dostawcy przez 24 h to „Status nieznany”, nie błąd.
- Cisza nocna przesuwa przypomnienia (nie dotyczy zmiany i odwołania terminu).
- Treści są ogólne (bez zdrowia, pomiarów, ćwiczeń) i oznaczone jako przypomnienie systemowe.
- Odpowiedzi z WhatsApp: przycisk „Potwierdzam” zamyka sprawę, inny tekst trafia do „Do odpowiedzi”,
  „STOP” wycofuje zgodę. Wiadomość z nieznanego numeru nie jest przypisywana do klienta.
