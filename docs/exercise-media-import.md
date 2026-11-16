# Masowy import mediów ćwiczeń

Biblioteka obsługuje GIF, WEBP, MP4 i WEBM. W panelu **Ćwiczenia → Import GIF / MP4** wybierz folder albo pliki, sprawdź przypisania i opublikuj. Nazwa pliku jest porównywana z nazwą PL/EN i aliasami ćwiczeń; wynik `wysoka`, `średnia`, `niska` lub `konflikt` jest tylko sugestią. Konflikt oraz brak dopasowania wymagają wyboru ćwiczenia z listy. Import nie tworzy ani nie zmienia identyfikatorów ćwiczeń, planów ani sesji klientów.

## Konfiguracja Firebase

1. Wdróż `firestore.rules` i `storage.rules` z tego repozytorium.
2. Upewnij się, że Firebase Storage jest włączony dla tego samego projektu co Auth i Firestore.
3. Aplikacja zapisuje dziennik w `exerciseMediaImports/{batchId}` oraz media pod `exercise-media/{trainerId}/{batchId}/{sha256}.{ext}`. Obiekty są niezmienialne, więc przypadkowe ponowienie uploadu nie nadpisuje wcześniejszego pliku.
4. Maksymalny plik to 80 MiB; reguła dopuszcza wyłącznie GIF/WEBP/JPEG/PNG/MP4/WEBM. Dla produkcji zalecana jest reguła cyklu życia Storage usuwająca nieopublikowane obiekty po 30 dniach.

Wznowienie odtwarza dziennik i ukończone pozycje. Ze względów bezpieczeństwa przeglądarka nie odzyskuje lokalnych uchwytów plików po odświeżeniu — folder należy wskazać ponownie. Wycofanie przywraca poprzedni adres medium w Firestore i w pamięci aplikacji; pliki pozostają w Storage jako audyt do momentu retencji.

## Koszt i operacje

Największy koszt to Firebase Storage: zajęta przestrzeń oraz transfer podczas odtwarzania MP4. Przykład: 500 filmów po 8 MiB to około 4 GB danych; każdy playback pobiera transfer zgodnie z planem Firebase/Google Cloud i regionem. W praktyce należy kompresować MP4 (H.264, 720p, krótka pętla), używać GIF tylko dla małych animacji oraz ustawić budżet i alerty w Google Cloud. Firestore zapisuje niewielki dziennik i po jednym rekordzie metadanych na przypisanie; to zwykle koszt drugorzędny względem transferu filmów.
