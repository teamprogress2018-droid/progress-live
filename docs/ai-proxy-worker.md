# Pośrednik AI (Cloudflare Worker) — zabezpieczenie

Aplikacja woła Claude przez `https://anthropic-proxy.teamprogress2018.workers.dev/`.
Każde zapytanie z aplikacji ma nagłówek `Authorization: Bearer <token Firebase>`
(`installAiProxyAuth` w `01-core.js`).

Kod Workera jest w repozytorium: **`server/ai-proxy/worker.mjs`** (testy: `node server/ai-proxy/test-worker.mjs`,
uruchamiane w CI „Izolacja danych trenerów i klientów”). Worker:

- przepuszcza tylko zalogowanych użytkowników projektu `progress-live-fc83d` (weryfikacja podpisu tokenu),
- **wymaga roli trenera**: dokumentu `trainerRoles/{uid}` z `role = trainer`, `enabled = true`
  (ta sama zasada co `trainer()` w `firestore.rules`). Konto bez roli dostaje **403** i zapytanie
  nie trafia do Anthropic. Rolę sprawdza odczytem Firestore tokenem samego użytkownika
  (reguła pozwala czytać tylko własny dokument roli); wynik trzyma w pamięci do 5 minut,
- liczy **dzienny limit 400 zapytań na konto** w KV `RATE`. Bez podpiętego `RATE` Worker
  odpowiada **503** zamiast działać bez limitu,
- przyjmuje zapytania tylko z adresu aplikacji (CORS), pozwala tylko na wybrane modele i ogranicza `max_tokens`,
- nie przyjmuje zapytań bez tokenu (dawny przełącznik `REQUIRE_AUTH` usunięty — sprawdzenie roli wymaga tokenu).

## Co sprawdzić w obecnym Workerze (stan sprzed etapu 2)

Poprzednia wersja (opis w historii tego pliku) miała dwie luki:

1. `REQUIRE_AUTH = false` — zapytania **bez tokenu** przechodziły i **nie były liczone** do limitu
   (limit liczył tylko zapytania z `uid`).
2. Limit działał tylko, gdy KV `RATE` był podpięty (`if (uid && env.RATE)`); bez niego — brak limitu.

Sprawdź w Cloudflare → Workers & Pages → `anthropic-proxy`:

- **Settings → Bindings**: czy jest **KV namespace** o nazwie zmiennej dokładnie `RATE`.
- **Edit code**: wartość `REQUIRE_AUTH` w obecnym kodzie.

## Wdrożenie nowej wersji

1. Najpierw wykonaj kroki z `docs/rejestracja-trenera.md` (dokument `trainerRoles` dla Twojego konta)
   i opublikuj nowe `firestore.rules` — bez tego Worker odpowie 403 także Tobie.
2. Cloudflare → **Storage & Databases → KV → Create namespace** (np. `progress-ai-rate`).
3. Worker `anthropic-proxy` → **Settings → Bindings → Add → KV namespace**:
   nazwa zmiennej `RATE`, namespace z punktu 2.
4. **Settings → Variables and Secrets**: `ANTHROPIC_API_KEY` (typ Secret) — zostaje jak jest.
5. **Edit code** → wklej całą zawartość `server/ai-proxy/worker.mjs` → **Deploy**.
6. Sprawdź w aplikacji dowolną funkcję AI na swoim koncie trenera.

Dodatkowo w Anthropic Console → Settings → Limits ustaw **miesięczny limit wydatków** —
to ostatnia bariera, niezależna od Workera.

## Progress AI dla klienta (ścieżka `/client`, Progress Live 3.0)

- Aplikacja klienta wysyła `POST <worker>/client` z tokenem Firebase klienta. Worker sprawdza `clientAccounts/{uid}`
  i kartę `clients/{clientId}` (czyta je tokenem klienta — działają zwykłe reguły) i przepuszcza tylko, gdy trener
  ustawił `aiCoach.on = true` (profil klienta → Plan → „Progress AI dla klienta”).
- Klient wysyła tylko `question` (≤ 500 znaków), `history` (≤ 6 wiadomości) i `context` (≤ 6000 znaków JSON).
  Prompt systemowy (`CLIENT_SYSTEM`), model i `max_tokens = 700` ustala Worker — klient nie może ich zmienić.
- Limity w tym samym KV `RATE`: `aiCoach.limit` pytań na klienta na dobę (domyślnie 10, maks. 30)
  oraz 300 pytań wszystkich klientów jednego trenera na dobę. Błąd dostawcy nie zużywa limitu.
- **Wdrożenie:** wklej nową zawartość `server/ai-proxy/worker.mjs` w Cloudflare → Deploy (krok 5 wyżej). Bez tego
  klient zobaczy „Progress AI nie odpowiedziało”, a funkcje trenera działają jak dotąd.

## Ograniczenia limitu

KV w Cloudflare nie ma atomowego licznika i jest „ostatecznie spójny”: kilka równoległych zapytań
może odczytać tę samą wartość, więc limit 400 jest przybliżony (może przepuścić kilka więcej).
Dokładny licznik wymagałby Durable Objects. Przy 400 zapytaniach na dobę i limicie wydatków
w Anthropic to wystarcza.
