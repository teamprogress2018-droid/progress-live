# Biblioteka GIF-ów / filmów techniki

Krótkie animacje i MP4 pokazujące prawidłowe wykonanie ćwiczenia.

## Sposób 0 — osobne repo z MP4 (obecne demo)

Filmy leżą w [progress-live-video-assets](https://github.com/teamprogress2018-droid/progress-live-video-assets) (nie w tym repo — GitHub Pages nie uniesie ~380 MB). Mapowanie do biblioteki:

```bash
node .github/scripts/build_ex_video_manifest.js
```

Zapisuje URL-e jsDelivr w `ex-gif-manifest.js`. Karty zostają ze zdjęciem; odtwarzanie jest w szczegółach ćwiczenia i w kreatorze.

## Sposób 1 — pliki w repozytorium (GitHub Pages)

1. Skopiuj pliki do tego folderu (`assets/ex/gifs/`).
2. Nazwij pliki **slugiem** z nazwy ćwiczenia, np.:
   - `Wyciskanie sztangi leżąc` → `wyciskanie-sztangi-lezac.mp4` (lub `.gif`)
   - `Podciąganie na drążku` → `podciaganie-na-drazku.mp4`
3. Uruchom generator mapowania:
   ```bash
   node .github/scripts/build_ex_gif_manifest.js
   ```
4. Commit: `assets/ex/gifs/*`, `ex-gif-manifest.js`.

**Hack Squat:** `przysiad-hack-maszyna.gif` jest w tym folderze ręcznie (karty biblioteki pokazują GIF, nie statyczne zdjęcie).
**Butterfly (peck deck):** `butterfly-peck-deck.gif` — pętla open→ściśnięcie z klatek free-exercise-db `Butterfly/` (Unlicense). MP4-y w video-assets o nazwie Pec Deck pokazują inne ćwiczenia.

Nie odpalaj `build_ex_gif_manifest.js` na całym folderze, jeśli w manifeście są już URL-e MP4 z video-assets — skrypt nadpisze cały plik. `build_ex_video_manifest.js` ponownie wkleja te dwa lokalne GIF-y na końcu.

W kreatorze planu pod każdym ćwiczeniem pojawi się podgląd techniki (`.mp4` / `.gif` / YouTube).

Obsługiwane formaty: `.mp4`, `.webm`, `.gif`, `.webp`.

## Sposób 2 — import w aplikacji (Firebase Storage)

W **Biblioteka ćwiczeń** → **Import GIF-ów**:

- wybierz folder z GIF-ami (lub wiele plików),
- aplikacja dopasuje nazwy plików do ćwiczeń,
- pliki trafią do Firebase Storage i mapy `exerciseGifs` w Firestore.

Wymaga reguł Storage (trener zalogowany może zapisywać pod `exercise-gifs/{uid}/`).

## Nazewnictwo plików

- małe litery, polskie znaki bez ogonków (`ł` → `l`),
- spacje i znaki specjalne → myślnik `-`,
- przykład: `Cable crossover dół–góra` → `cable-crossover-dol-gora.gif`
