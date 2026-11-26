# Progress Live 3.0 — roadmapa

Zasada: zaawansowana technologia pod spodem, maksymalna prostota na ekranie klienta.
Pełny audyt (Etap 0) i uzasadnienie kolejności: dokument „Progress Live 3.0 — Etap 0: audyt i plan” (zatwierdzony 25.11.2026).

Statusy: **zaprojektowane** → **zaimplementowane** → **przetestowane (CI)** → **sprawdzone na iPhonie** → **produkcja**.

| Etap | Zakres | Status |
|---|---|---|
| 1. Stabilizacja | Ekran przerwy po klawiaturze, strażnik treningu (Wake Lock, zapis przy schowaniu, wysyłka po powrocie, trwałe dane) | zaimplementowane, testy jednostkowe OK; czeka na CI i test na iPhonie |
| 2. Doświadczenie | Readiness, Progress Voice, Express, Journey + Rewards, Wrapped, głos trenera (klon) — zaimplementowane | czeka na test na iPhonie i merge |
| 3. Połączenie | Powiadomienia ze zdarzeń, nowe sygnały w „Wymagają uwagi”, Academy klienta | zaprojektowane |
| 4. Inteligencja | Progress AI klienta, komendy głosowe, Vision (pilotaż) | zaprojektowane |
| 5. Ekosystem | Body (suwak), Capacitor: Apple Health, Health Connect, widżety; ewentualnie Społeczność | zaprojektowane |

## Etap 1 — kryteria odbioru

- [ ] Trening przetrwa tryb samolotowy, zablokowanie ekranu, zamknięcie i ponowne otwarcie aplikacji
- [ ] Zero podwójnych serii (stałe id sesji — bez zmian)
- [ ] Ekran nie gaśnie w trakcie treningu, gaśnie normalnie po jego końcu
- [ ] Ekran przerwy po wpisaniu ciężaru pokazuje pełne kółko z licznikiem
- [ ] CI zielone (check.yml, webkit-check.yml)

## Test ręczny na iPhonie (Etap 1)

1. Rozpocznij trening, wpisz ciężar, zapisz serię → przerwa: pełne kółko i sekundy.
2. Odłóż telefon na 2 min w trakcie ćwiczenia → ekran nie gaśnie.
3. Włącz tryb samolotowy, zapisz 2 serie, zablokuj telefon, odblokuj, wyłącz tryb samolotowy → po chwili „Zsynchronizowano”.
4. Zamknij aplikację w trakcie treningu, otwórz ponownie → „Kontynuuj trening” z zapisanymi seriami.

## Wycofanie

Każdy etap to osobny PR do `main`. Wycofanie = `git revert` commita merge'a danego PR; dane w Firestore nie są migrowane w Etapie 1.

## Etap 3 — postęp
- [x] 3a Progress Coach — nowe sygnały w „Wymagają uwagi” (PR feature/3.0-coach)
- [x] 3b Powiadomienia ze zdarzeń (rekord, kończący się pakiet, podsumowanie miesiąca; dłuższa przerwa = istniejące F) + limit dziennie — zaprojektowane, zaimplementowane, testy jednostkowe; **działa dopiero po wdrożeniu funkcji serwera** (`commsScheduler`)
- [x] 3c Academy dla klienta (PR feature/3.0-academy)

## Etap 4 — postęp
- [x] 4a Komendy głosowe w treningu (`voice-commands.js`) — zaprojektowane, zaimplementowane, testy jednostkowe + UI na atrapie rozpoznawania mowy; **nie testowane na prawdziwym iPhonie**
- [x] 4b Progress AI dla klienta (`client-ai.js`, ścieżka `/client` w pośredniku AI) — zaprojektowane, zaimplementowane, testy pośrednika + UI na atrapie; **działa po wklejeniu nowego Workera w Cloudflare**
- [ ] 4c Vision (pilotaż) — po 4b
