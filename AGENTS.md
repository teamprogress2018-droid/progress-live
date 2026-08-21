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

**Biblioteka ćwiczeń / grafiki:** `DEF_EX` w `06-inbox-exercises-ai-programs.js` (~200 pozycji). Własne ćwiczenia: pole **Grafika techniki** (`ex-img`) + film (`ex-video`). Miniatura w autocomplete/builderze i kartach: `exThumbUrl()` — własne `img`/`assets/ex/*.svg` albo automatyczna miniaturka YouTube z filmu.

**Statystyki klienta:** ekran **Moje postępy** (`capClientProgressScreenHTML`) — KPI, wykresy SVG, obwody, rekordy.

**Profil trenera / edycja klienta:** nav **Mój profil** → `#screen-trainer-profile` (edycja profilu bez wchodzenia w Ustawienia). Profil klienta w drawerze: **Przegląd** → **✏️ Edytuj dane** (pole `cpe-phone`, zapis `saveCPEdit`); zakładka **Funkcje** zamiast dawnych ustawień z formularzem danych.

**Zadania domowe vs On-demand:** **Zadania domowe** (`homework` w live nav) — pojedyncze treningi w domu (HIIT/tabata/mobilność/bez sprzętu) z czasem, obwodami i materiałami; trener przypisuje z On-demand (**🏠 Klientowi** / profil klienta → Zadania → **🏡 Trening domowy**). **On-demand** — wielotygodniowe programy YouTube z harmonogramem dni; klient sam wybiera tempo. Kolekcja **🌬 Oddech** (`ow9`–`ow14`): box 4-4-4-4, 4-7-8, przeponowy, spójny 5-5, Wim Hof intro, pre-workout; program **op5** (2 tyg.).
