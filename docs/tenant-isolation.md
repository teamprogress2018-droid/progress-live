# Izolacja danych trenerów i klientów

Status na 26.09.2026, 19:27 (Europe/Warsaw): kompatybilny frontend i pełne reguły izolacji zostały opublikowane w projekcie `progress-live-fc83d`. Nie oznacza to zakończenia całej produkcyjnej listy sprawdzeń, zwłaszcza zapisów z kont klientów. Samo zapisanie plików ani publikacja frontendu nie potwierdzają aktywacji reguł; poniżej zapisano osobne potwierdzenia.

## Potwierdzone wdrożenie i zakres testów

- Frontend: opublikowana wersja `tenant-isolation=2`; GitHub Pages, uruchomienie `36258719424`, zakończyło się sukcesem. Pełne CI aplikacji `36258720033` dla commita `cceb8af` zakończyło się sukcesem — 254 kroki. Testy UI korzystają z kontrolowanych danych i zastąpionych operacji zapisu; nie są dowodem zapisów na produkcyjnych kontach klientów.
- Reguły: przed publikacją pełna treść wersji roboczej w Firebase została porównana z plikiem w repozytorium. Konsola potwierdziła aktywne wydanie z 26.09.2026, godz. 19:27; zniknął stan nieopublikowanych zmian i przycisk publikacji. W Rules Playground dla aktywnych reguł odczyt istniejącego klienta przez jego trenera był dozwolony, a przez obcego, testowego użytkownika — odrzucony. Była to symulacja uprawnień, bez zapisów danych.
- Po publikacji pełna treść aktywnych reguł skopiowana z konsoli była identyczna z przetestowanym plikiem w repozytorium (porównanie po usunięciu białych znaków na początku i końcu).
- Odczyty produkcyjne: po pełnym przeładowaniu aplikacji działały lista 15 klientów, panel główny, historia onboardingu, Autoflow oraz listy programów i forum. W sprawdzanym widoku nie zarejestrowano błędów konsoli. To potwierdzenie odczytów w panelu trenera, nie pełny test wszystkich ról i operacji.
- Emulator i testy automatyczne: testy izolacji reguł zakończyły się sukcesem — 702 asercje w 13 scenariuszach, uruchomienie `36257332878`, commit `42c02e0`. Testy workera obejmowały 23 testy jednostkowe i 7 integracyjnych; wariant reguł etapu 1 przeszedł 9 testów integracyjnych. Testy integracyjne działały na emulatorze, nie na produkcyjnej bazie.

Nie wykonywano produkcyjnych zapisów formularzy, check-inów, treningów, zdjęć ani reakcji forum z kont klientów. Te operacje sprawdzono w testach automatycznych i na emulatorze; ich pełna weryfikacja produkcyjna na kontrolowanych kontach pozostaje osobnym punktem. Celowo nie modyfikowano rzeczywistych danych klientów na potrzeby testów. Publikacja frontendu i reguł jest potwierdzona; pełna produkcyjna lista sprawdzeń nie jest jeszcze zamknięta.

## Zakres

- Trener odczytuje i zapisuje dane przypisane do swojego `trainerId`. Zapytania nie pobierają całych kolekcji bez ograniczenia właściciela.
- Klient korzysta ze stałego powiązania w `clientAccounts/{uid}`. Prywatne dane wymagają zgodności `trainerId` i `clientId`; biblioteki wspólne dla podopiecznych mają osobną listę dozwolonych kolekcji. Dostęp do prywatnych grup forum wymaga członkostwa.
- Pełne ustawienia trenera pozostają prywatne. `trainerPublicProfiles/{trainerId}` udostępnia podopiecznym wyłącznie dozwolone dane profilu, wyglądu, widoczności sekcji i instrukcji przelewu. Klucze API i konfiguracja integracji nie trafiają do tej projekcji.
- Zmiana konta unieważnia poprzednie odczyty i czyści dane w pamięci. Błąd odczytu konta klienta nie oznacza konta trenera.
- Zapisy klienta są ograniczone do dozwolonych pól i operacji. Potwierdzenie treningu na sali przez klienta nie zmienia rozliczenia pakietu.

## Starsze dane i zaproszenia

Rekordów bez wiarygodnego `trainerId` nie wolno automatycznie przypisywać aktualnie zalogowanemu trenerowi. Brak takich rekordów na liście po włączeniu izolacji nie oznacza ich usunięcia. Ich właściciela należy ustalić niezależnie i udokumentować przed osobną migracją. Nie przywracać szerokich odczytów ani automatycznego przejmowania rekordów jako obejścia.

Starsze, niewykorzystane zaproszenia bez nowych pól ważności i zużycia wymagają ponownego wystawienia przez trenera. Nowe zaproszenie ma termin ważności, jest przeznaczone dla wskazanego adresu e-mail i może utworzyć powiązanie klienta tylko raz. Utworzenie dokumentu konta aplikacji `clientAccounts/{uid}` i oznaczenie zaproszenia jako wykorzystanego odbywają się w jednej transakcji; samo konto Firebase Authentication powstaje wcześniej. Istniejące zaakceptowane konta klienta zachowują swoje powiązania; nowe zaproszenie nie służy do ich automatycznego przepinania między trenerami.

## Kolejność wdrożenia

1. Zachować kopię aktualnych reguł i wersję poprzedniego wydania. Uruchomić testy frontendu oraz testy izolacji na emulatorze, w tym odczyty obcych danych, role klienta i trenera, zaproszenia i dozwolone zapisy klienta.
2. Przygotować wymagane indeksy z `server/automation/firestore.tenant.indexes.json` i zaczekać na ich gotowość. Sprawdzić, czy istniejące rekordy mają poprawnego właściciela; braki rozwiązywać oddzielnie, bez zgadywania.
3. Najpierw opublikować kompatybilny frontend: ograniczone zapytania, bezpieczny profil trenera, nowe zaproszenia i obsługę odmowy dostępu. Zweryfikować wersje plików i odświeżenie pamięci podręcznej. Starsze otwarte karty mogą wymagać ponownego załadowania.
4. Dopiero potem wdrożyć pełne `firestore.rules`. Przygotować bezpieczne profile trenerów dla obecnych kont; bez profilu klient otrzyma wartości domyślne, w tym brak instrukcji przelewu do czasu synchronizacji. Samo wdrożenie frontendu nie zamyka dostępu dopuszczanego przez stare reguły.
5. Odczytać aktywne reguły z produkcji i sprawdzić dostęp na kontrolowanych kontach: trener widzi swoje dane, klient swoje przypisania, obce dane są niedostępne. Sprawdzić również formularz, check-in, zapis treningu, zdjęcia i reakcje forum. Status „pełna weryfikacja produkcyjna zakończona” nadać dopiero po potwierdzeniu tych czynności; samo opublikowanie frontendu i reguł opisywać oddzielnie.

Reguły nie traktują odmowy odczytu brakującego prywatnego dokumentu jak pewnego błędu „nie znaleziono”. Nie dodawać obowiązkowego szerokiego odczytu przed utworzeniem nowego wpisu ani otwierać reguł w celu obejścia tego przypadku.

## Plan Spark i automatyzacje

Projekt korzysta z planu Spark. Izolacja danych obejmuje frontend i reguły Firestore; nie uruchamia funkcji backendowych ani automatyzacji po zamknięciu przeglądarki. Przygotowany worker kolejki pozostaje oddzielnym etapem. Wdrożenie Cloud Functions wymaga odpowiedniego płatnego planu i osobnego potwierdzenia konfiguracji, uprawnień oraz aktywacji. Nie oznaczać workera jako działającego wyłącznie na podstawie obecności jego kodu w repozytorium.
