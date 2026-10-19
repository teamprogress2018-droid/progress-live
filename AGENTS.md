# Progress Live

Vanilla JS trainer app (GitHub Pages). Production auth is Firebase; local tests stub it.

## Cursor Cloud specific instructions

Static site — no committed `package.json`. Do not commit `node_modules/`, `package.json`, or `package-lock.json`.

**Run the app:** `python3 -m http.server 8080` from the repo root, then open `http://localhost:8080/index.html`.

**Bypass auth for UI tests:** hide `#auth-screen`, show `#app-root`, stub `persistById`, inject `window.CL`. See `.github/scripts/test_resources_garmin_ui.js`.

**Lint / syntax:** `node --check *.js` (repo-root app files only). Duplicate/ref checks: `python3 .github/scripts/check_duplicates.py` and `python3 .github/scripts/check_file_refs.py`.

**Unit tests:** `node .github/scripts/test_*.js` (vm, no browser). Full list is in `.github/workflows/check.yml`.

**Playwright UI tests:** need the static server on port 8080. CI installs Chromium in the workflow; locally `npx playwright` after an untracked `npm install playwright` (still do not commit those files).

**Garmin Connect:** CSV import only. No OAuth, no client secrets in Firestore, no live HRV/sleep/Body Battery. Import lands in metric group `mg6` and calendar sessions with `source:'garmin'`. Client app (trainer preview + live login) shows those measurements and YouTube-first resources.

**On-demand:** karty bez `watch?v=` nic nie grały — demo ma prawdziwe odcinki YouTube, `openODWorkout` osadza `youtube-nocookie.com/embed`. Migracja `migrateODYoutubeWorkouts` dopina URL-e do starych stubów o id `ow1`–`ow6`. W **live client app** dolna nawigacja ma **On-demand** i **Zasoby**; player idzie w `#clive-player` (`od-playing`). Tagi czatu: `[od:owId]` / `[odprog:opId]`. Program `op2` ma tygodnie z `workoutId`. Edytor trenera (`#odp-weeks`) przypisuje treningi YouTube do dni. Klient odhacza dni (`toggleODProgramDay`) — zapis w kolekcji `odProgress` (doc id: `odpr_{clientId}_{progId}`). Po odhaczeniu trener dostaje powiadomienia (`odProgramNotifyAfterToggle`). Na home klienta karta **KONTYNUUJ PROGRAM** przy `pct > 0`. Deep link: `?od=ow1` lub `?odprog=op2`.

**Planowanie — tło sportowe:** pole `priorSports[]` + `activityLevel` na kliencie (modal + profil + onboarding + generator AI). `clientSportProfile()` liczy bias wytrzymałość/siła; `clientSportProfileForAI()` trafia do promptu `aplGenerate`.

**Motyw / Design System:** `globals.css` (tokeny + reguły bazowe) + `styles.css` (komponenty). Tokeny są też zduplikowane w `:root` w `styles.css` jako fallback. W `index.html` ładuj w tej kolejności; przy wdrożeniu **oba pliki muszą być na serwerze** (wcześniej `globals.css` nie był w repo → 404 → brak zmian wizualnych). Cache: linki mają `?v=5` — po zmianie CSS podbij wersję. Paleta: tło `#111318`, karty `#1E202A`, akcent `#FF3B30`, font UI Inter. Nadpisanie akcentu: Ustawienia → Marka lub `SETTINGS.brand.accentColor`; `applyBrandTheme()` po starcie i po wczytaniu Firestore.

**Biblioteka ćwiczeń / grafiki:** `DEF_EX` w `06-inbox-exercises-ai-programs.js` (~200 pozycji). Własne ćwiczenia: pole **Animacja / grafika techniki** (`ex-img` → `gif`/`img`) + film (`ex-video`). Miniatura w autocomplete/builderze: `exThumbUrl()` / `exGifUrl()` — manifest repo (`ex-gif-manifest.js`), Firestore `exerciseGifs` (`EX_GIF_REMOTE`) albo Firebase Storage po **Import GIF-ów**. Lokalnie: wrzuć pliki do `assets/ex/gifs/` i uruchom `node .github/scripts/build_ex_gif_manifest.js`.

**Statystyki klienta:** ekran **Moje postępy** (`capClientProgressScreenHTML`) — KPI, wykresy SVG, obwody, rekordy.

**Profil trenera / edycja klienta:** nav **Mój profil** → `#screen-trainer-profile` (edycja profilu bez wchodzenia w Ustawienia). Profil klienta w drawerze: **Przegląd** → **✏️ Edytuj dane** (pole `cpe-phone`, zapis `saveCPEdit`); zakładka **Funkcje** zamiast dawnych ustawień z formularzem danych.

**Zadania domowe vs On-demand:** **Zadania domowe** (`homework` w live nav) — pojedyncze treningi w domu (HIIT/tabata/mobilność/bez sprzętu) z czasem, obwodami i materiałami; trener przypisuje z On-demand (**🏠 Klientowi** / profil klienta → Zadania → **🏡 Trening domowy**). **On-demand** — wielotygodniowe programy YouTube z harmonogramem dni; klient sam wybiera tempo. Kolekcja **🌬 Oddech** (`ow9`–`ow14`): box 4-4-4-4, 4-7-8, przeponowy, spójny 5-5, Wim Hof intro, pre-workout; program **op5** (2 tyg.).

**Baza wiedzy — Nowe badania (PubMed):** workflow `.github/workflows/research-feed.yml` (poniedziałek 04:00 UTC + ręcznie) uruchamia `.github/scripts/fetch_research_feed.js`, który wg `research_queries.json` pobiera metaanalizy / przeglądy / RCT / stanowiska z PubMed E-utilities i zapisuje `research-feed.json` w root repo. Opcjonalne sekrety: `NCBI_API_KEY`, `NCBI_EMAIL`, `ANTHROPIC_API_KEY` (streszczenie + wniosek po polsku). UI: panel `#kb-feed` w `renderKbFeed()` — „+ Do bazy” otwiera modal wpisu (kind `evidence`, zapis `pmid`/`doi`/`topics`), „Pomiń” trafia do localStorage `pl_kb_feed_dismissed_v1`. Test offline: `node .github/scripts/test_research_feed.js`.

**Baza wiedzy z książek:** jeden plik JSON na książkę w `knowledge/books/` (klucze `principles`, `exerciseRules`, `progressionRules`, `safetyRules`, `planTemplates`, `sourceReferences`, opcjonalnie `nutritionRules`, `communicationRules`, `marketingRules`…; każda reguła ma `status` zrodlo/wniosek/brak_w_zrodle/poza_zrodlem). `node .github/scripts/build_books_index.js` buduje `knowledge/books-index.json` (workflow `books-index.yml` robi to sam po pushu na main). `books-kb.js` ładuje indeks i dobiera reguły: `aplGenerate` (`aplBooksContext`) dokłada do promptu reguły treningowe pod cel/metodę/staż + reguły bezpieczeństwa pod kontuzje/wiek/BMI + żywieniowe do `nutritionTip`; użyte książki trafiają do `plan.rationale.bookSources` („Dlaczego taki plan?”). `kbContextForAI` dokłada książki także Asystentowi AI (dev bez książek, business → marketing). Reguły `brak_w_zrodle` nie trafiają do AI. Test: `node .github/scripts/test_books_kb.js`.

**Academy → Badania (baza badań):** `knowledge/research-base.json` buduje po stronie serwera `.github/scripts/build_research_base.js` (workflow `research-base.yml`: poniedziałek 04:30 UTC, ręcznie oraz po zmianie pytań). Pytania i zapytania PubMed są w `.github/scripts/research_base_queries.json` (9 kategorii, `titleAny` odcina wyniki spoza tematu, `excludeTitle` populacje kliniczne). Źródła: PubMed (metadane, typ badania), Europe PMC (PMCID, otwarty dostęp, cytowania), Crossref (weryfikacja DOI — link DOI tylko gdy `doiVerified`). AI opracowuje kartę wyłącznie z abstraktu (liczby spoza abstraktu są odrzucane, pewność ograniczona typem badania) i odpowiedź Academy w 8 częściach z kluczami `[S1]`/`[K1]`; nieznane klucze są usuwane, odpowiedź bez źródeł odrzucana. Abstraktów i pełnych tekstów nie zapisujemy. Plik działa jak cache (bez ponownego AI dla znanych badań). UI: `research-academy.js` + `research-academy.css`, wpięte w `11-progress-academy.js` (zakładka `research`). „Zapisz” tworzy wpis `kb` (`kind:'evidence'`, `academyResearch:true`, `researchStatus`, `reliability`, `useInPlanning:false`). Moduł nie przyjmuje danych klientów (pytanie z imieniem i nazwiskiem klienta jest zatrzymywane). Testy: `test_research_base.js`, `test_research_academy.js`, `test_research_academy_ui.js`.
