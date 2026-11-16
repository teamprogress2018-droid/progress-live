# Rejestracja trenera — nadanie roli

Od etapu 2 audytu z 8.11.2026 rola trenera **nie wynika już z braku konta klienta**.
Konto Firebase (np. założone samodzielnie e-mailem) dostaje dostęp do danych trenera,
plików (Storage) i AI dopiero wtedy, gdy istnieje dokument roli:

```
Kolekcja:   trainerRoles
ID:         <UID konta z Firebase Authentication>
Pola:       uid     (string)   = ten sam UID
            role    (string)   = trainer
            enabled (boolean)  = true
```

Aplikacja nie potrafi tego dokumentu utworzyć ani zmienić (reguła `allow list, write: if false`).
Zalogowany użytkownik może tylko **odczytać własny** dokument roli — korzysta z tego ekran logowania
i pośrednik AI.

## 1. Zanim wdrożysz nowe reguły: sprawdź swoje konto (Piotr)

1. Firebase Console → projekt `progress-live-fc83d` → **Authentication → Users**.
   Znajdź swój adres e-mail i skopiuj **User UID**.
2. **Firestore Database → Data** → kolekcja `trainerRoles`.
   - Jeśli jest dokument o ID równym Twojemu UID z polami jak wyżej (`enabled = true`) — nic nie rób.
   - Jeśli kolekcji lub dokumentu nie ma — dodaj go (punkt 2 poniżej) **przed** publikacją reguł.
3. To samo dla każdego innego konta, które ma dalej działać jako trener (np. konto testowe).

Bez tego kroku po publikacji reguł logowanie trenera pokaże komunikat
„to konto nie ma jeszcze przyznanego dostępu trenera… Identyfikator konta: …”.
Dane nie znikną — wystarczy dodać dokument roli i odświeżyć aplikację.

## 2. Ręczne nadanie roli (ścieżka podstawowa)

1. Nowy trener zakłada konto (lub loguje się) w aplikacji. Zobaczy komunikat o braku roli
   razem ze swoim **identyfikatorem konta** — prosi Piotra o nadanie roli i podaje ten identyfikator.
   (Alternatywnie: Authentication → Users → User UID.)
2. Piotr: Firestore Database → `trainerRoles` → **Add document**:
   - Document ID: UID trenera,
   - `uid` (string) = UID trenera, `role` (string) = `trainer`, `enabled` (boolean) = `true`.
3. Trener odświeża aplikację i loguje się ponownie.

Odebranie dostępu: zmień `enabled` na `false` (dane zostają, ale konto traci dostęp do danych,
plików i AI). Pośrednik AI pamięta wynik sprawdzenia roli do 5 minut.

## 3. Zaproszenie trenera (na później)

Automatyczne nadawanie roli z zaproszenia wymaga zaufanego serwera (Firebase Admin, np. Cloud
Function), bo aplikacja w przeglądarce nie może zapisywać do `trainerRoles`. Projekt jest na planie
Spark, więc ta ścieżka nie jest wdrożona. Do tego czasu obowiązuje nadawanie ręczne z punktu 2.

## Kolejność wdrożenia etapu 2

1. Dodaj dokumenty `trainerRoles` dla wszystkich obecnych kont trenerów (punkt 1).
2. Opublikuj `firestore.rules` i `storage.rules` (Firebase Console → Rules lub `firebase deploy --only firestore:rules,storage`).
3. Sprawdź logowanie swojego konta trenera i wgranie filmu do biblioteki.
4. Wdróż nowy pośrednik AI (`server/ai-proxy/worker.mjs`, opis w `docs/ai-proxy-worker.md`):
   najpierw podepnij KV `RATE`, potem wklej kod.
