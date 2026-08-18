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

**On-demand:** karty bez `watch?v=` nic nie grały — demo ma prawdziwe odcinki YouTube, `openODWorkout` osadza `youtube-nocookie.com/embed`. Migracja `migrateODYoutubeWorkouts` dopina URL-e do starych stubów o id `ow1`–`ow6`. W **live client app** (`screen-clientlive`) dolna nawigacja ma **On-demand** i **Zasoby**; player idzie w `#clive-player` (klasa `od-playing`). Udostępnienie treningu/programu dodaje tag `[od:owId]` / `[odprog:opId]` w czacie. Demo program `op2` ma tygodnie z `workoutId` → ekran `odprogram`. Deep link: `?od=ow1` lub `?odprog=op2`.
