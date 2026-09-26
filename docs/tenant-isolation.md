# Izolacja danych trenerów i klientów

Status: instrukcja przygotowania i weryfikacji wdrożenia. Samo zapisanie tych plików ani publikacja frontendu nie potwierdzają aktywacji nowych reguł w produkcji.

## Zakres

- Trener odczytuje i zapisuje dane przypisane do swojego `trainerId`. Zapytania nie pobierają całych kolekcji bez ograniczenia właściciela.
- Klient korzysta ze stałego powiązania w `clientAccounts/{uid}`. Prywatne dane wymagają zgodności `trainerId` i `clientId`; biblioteki wspólne dla podopiecznych mają osobną listę dozwolonych kolekcji. Dostęp do prywatnych grup forum wymaga członkostwa.
- Pełne ustawienia trenera pozostają prywatne. `trainerPublicProfiles/{trainerId}` udostępnia podopiecznym wyłącznie dozwolone dane profilu, wyglądu, widoczności sekcji i instrukcji przelewu. Klucze API i konfiguracja integracji nie trafiają do tej projekcji.
- Zmiana konta unieważnia poprzednie odczyty i czyści dane w pamięci. Błąd odczytu konta klienta nie oznacza konta trenera.
- Zapisy klienta są ograniczone do dozwolonych pól i operacji. Potwierdzenie treningu na sali przez klienta nie zmienia rozliczenia pakietu.

## Starsze dane i zaproszenia

Rekordów bez wiarygodnego `trainerId` nie wolno automatycznie przypisywać aktualnie zalogowanemu trenerowi. Brak takich rekordów na liście po włączeniu izolacji nie oznacza ich usunięcia. Ich właściciela należy ustalić niezależnie i udokumentować przed osobną migracją. Nie przywracać szerokich odczytów ani automatycznego przejmowania rekordów jako obejścia.

Starsze, niewykorzystane zaproszenia bez nowych pól ważności i zużycia wymagają ponownego wystawienia przez trenera. Nowe zaproszenie ma termin ważności, jest przeznaczone dla wskazanego adresu e-mail i może utworzyć powiązanie klienta tylko raz. Utworzenie konta aplikacji i oznaczenie zaproszenia jako wykorzystanego odbywają się w jednej transakcji. Istniejące zaakceptowane konta klienta zachowują swoje powiązania; nowe zaproszenie nie służy do ich automatycznego przepinania między trenerami.

## Kolejność wdrożenia

1. Zachować kopię aktualnych reguł i wersję poprzedniego wydania. Uruchomić testy frontendu oraz testy izolacji na emulatorze, w tym odczyty obcych danych, role klienta i trenera, zaproszenia i dozwolone zapisy klienta.
2. Przygotować wymagane indeksy z `server/automation/firestore.tenant.indexes.json` i zaczekać na ich gotowość. Sprawdzić, czy istniejące rekordy mają poprawnego właściciela; braki rozwiązywać oddzielnie, bez zgadywania.
3. Najpierw opublikować kompatybilny frontend: ograniczone zapytania, bezpieczny profil trenera, nowe zaproszenia i obsługę odmowy dostępu. Zweryfikować wersje plików i odświeżenie pamięci podręcznej. Starsze otwarte karty mogą wymagać ponownego załadowania.
4. Dopiero potem wdrożyć pełne `firestore.rules`. Przygotować bezpieczne profile trenerów dla obecnych kont; bez profilu klient otrzyma wartości domyślne, w tym brak instrukcji przelewu do czasu synchronizacji. Samo wdrożenie frontendu nie zamyka dostępu dopuszczanego przez stare reguły.
5. Odczytać aktywne reguły z produkcji i sprawdzić dostęp na kontrolowanych kontach: trener widzi swoje dane, klient swoje przypisania, obce dane są niedostępne. Sprawdzić również formularz, check-in, zapis treningu, zdjęcia i reakcje forum. Status „wdrożone” nadać dopiero po potwierdzeniu tych czynności.

Reguły nie traktują odmowy odczytu brakującego prywatnego dokumentu jak pewnego błędu „nie znaleziono”. Nie dodawać obowiązkowego szerokiego odczytu przed utworzeniem nowego wpisu ani otwierać reguł w celu obejścia tego przypadku.

## Plan Spark i automatyzacje

Projekt korzysta z planu Spark. Izolacja danych obejmuje frontend i reguły Firestore; nie uruchamia funkcji backendowych ani automatyzacji po zamknięciu przeglądarki. Przygotowany worker kolejki pozostaje oddzielnym etapem. Wdrożenie Cloud Functions wymaga odpowiedniego płatnego planu i osobnego potwierdzenia konfiguracji, uprawnień oraz aktywacji. Nie oznaczać workera jako działającego wyłącznie na podstawie obecności jego kodu w repozytorium.
