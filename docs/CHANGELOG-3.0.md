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
