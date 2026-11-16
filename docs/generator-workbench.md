# Rozwój generatora Progress Live

W generatorze nad wynikiem znajduje się „Zasady trenera i rozwój zapisanego planu”.
Można zapisać preferencje w prywatnych ustawieniach trenera i otworzyć kopię
istniejącego planu. Wczytywanie nigdy nie nadpisuje oryginalnego planu.

Pod wynikiem sekcja „Rozwój planu” umożliwia:

- **Dopasuj do wyników:** używa istniejących klasyfikatorów historii ćwiczenia
  i rekomendacji. Zmienia wyłącznie wybrany tydzień, z limitem procentowym
  wzrostu i skokiem sprzętu. Podstawą ciężaru jest wykonany wynik, nie
  zaplanowany przyrost. Mała pewność, brak historii, procenty 1RM, jednostki
  czasowe i deload wymagający szerszej oceny nie powodują automatycznej zmiany.
- **Zamiana ćwiczenia:** dotychczasowy przycisk zamiany otwiera ranking
  z biblioteki. Uwzględnia wzorzec, kategorię, sprzęt, preferencje, dostępne
  dane o trudności i szacowaną biomechanikę. Nie jest to ocena medyczna.
  Po zamianie stare identyfikatory i ciężary są usuwane/zastępowane.
- **Historia wersji:** migawka przed zatwierdzeniem oraz podczas zapisu,
  do pięciu wpisów i 220 tys. znaków łącznie. Porównanie i przywrócenie
  przechodzą przez ten sam podgląd. Brak migawek historycznych sprzed wdrożenia.
- **Wariant awaryjny:** osobny plan na jeden tydzień; możliwość pominięcia dnia
  i zmniejszenia liczby serii do szacowanego czasu. Nie usuwa automatycznie
  ćwiczeń ani nie nadrabia utraconej objętości. Jeśli limit czasu jest
  nieosiągalny, pokazuje komunikat. Oryginał i kalendarz nie są zmieniane
  przez samo przygotowanie/zatwierdzenie propozycji.

Zatwierdzenie zmienia wersję roboczą. „Zapisz plan” korzysta z istniejącego
mechanizmu potwierdzanego zapisu. Zapisana kopia zachowuje referencję do
planu źródłowego. Włączenie kopii do kalendarza jest osobną decyzją w istniejącym
przepływie aplikacji; stary plan nie jest automatycznie dezaktywowany.

## Zasady i ograniczenia

Twarde pola zasad: maksymalny procent wzrostu, skok ciężaru, liczba serii na
ćwiczenie, liczba bezpośrednich serii na kategorię w tygodniu i dokładne nazwy
wykluczonych ćwiczeń. Zapis sprawdza każdy tydzień. Własne wskazówki tekstowe
są kontekstem generatora AI i wymagają przeglądu trenera; nie są kodem.

Liczenie objętości wykorzystuje oznaczenia biblioteki/kategorii. Nie oblicza
wkładu pośredniego i nie mierzy indywidualnego MRV. Brakujące kategorie
są jawnie oznaczane. Czas sesji to szacunek z przerw, liczby serii, 45 sekund
na serię, minuty na zmianę ćwiczenia i pięciu minut przygotowania.

Propozycja jest unieważniana po zmianie treści planu, klienta lub konta.
Nowy moduł nie dodaje transmisji danych do zewnętrznych usług. Zasady AI
korzystają z dotychczasowej ścieżki generowania planów.

## Weryfikacja

`node .github/scripts/test_generator_workbench.js`

`node .github/scripts/test_generator_workbench_ui.js` (Playwright Chromium;
opcjonalnie `GWB_BROWSER` wskazuje lokalną przeglądarkę).

Test UI korzysta z własnego serwera i fikcyjnego zapisu; nie loguje się
do Firebase ani nie zmienia danych klientów. Obejmuje propozycję, zatwierdzenie,
zapis, ponowienie, przywrócenie, osobny wariant i szerokość mobilną.
