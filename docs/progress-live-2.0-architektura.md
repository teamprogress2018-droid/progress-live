# Progress Live 2.0 — architektura etapów

Dokument planistyczny. Etap 1 (motyw) jest wdrożony; etapy 2–6 są opisane, **nie zaimplementowane**.
Zasada nadrzędna: Everfit jest inspiracją przejrzystości (dużo bieli, lekkie obramowania, jedna wyraźna akcja na ekranie), a nie wzorem do kopiowania. Układ, nazwy sekcji, teksty i logika są nasze, po polsku.

Każdy etap to osobny PR (albo kilka małych), bez zmian w modelu danych Firestore, o ile etap tego wprost nie wymaga, i z testem w `.github/scripts/`.

---

## Etap 1 — motyw i akcent (wdrożony)

**Co jest:**
- `theme.css` (ładowany ostatni) — jasny motyw domyślny przez `html[data-theme="light"]`, ciemny motyw „Fire” zostaje bez zmian jako opcja.
- `applyBrandTheme()` w `01-core.js` ustawia `data-theme`, `--accent`, `--accent2` (hover), `--accent-rgb`, `--adim`, `--on-accent` (biały lub grafit wg kontrastu) oraz zapisuje wybór w `localStorage` (`pl_theme_v2`), żeby skrypt w `<head>` ustawił motyw przed pierwszym malowaniem.
- Ustawienia → Marka i wygląd: 6 presetów (czerwony domyślny, pomarańczowy, niebieski, zielony, fioletowy, różowy — każdy ≥ 4,5:1 z białym) + własny HEX z informacją o kontraście + przełącznik „Tryb ciemny”.
- Kolory statusów są tokenami niezależnymi od akcentu: `--danger`, `--warning`, `--success`, `--info` (+ `-bg`) oraz dotychczasowe `--red`, `--orange`, `--teal`, `--blue`.

**Dane:** prywatne ustawienia trenera mają `brand.themeMode` (`light`/`dark`). Publiczny profil dla aplikacji klienta niesie wybór w istniejącym polu `brand.theme` jako `light` / `dark-v2` — bez zmiany reguł Firestore. Stare `theme:'dark'` było zapisywane domyślnie i nic nie robiło, więc nie wymusza ciemnego motywu.

**Reguła dla nowego kodu:** nie wpisujemy kolorów na sztywno. Tło: `var(--bg-card)` / `var(--bg-main)`, tekst: `var(--text-primary)` / `var(--text-label)`, ramki: `var(--border-subtle)`, akcja: `var(--accent)` z tekstem `var(--on-accent)`, ostrzeżenie: `var(--danger)` / `var(--warning)` — nigdy `var(--accent)`.

**Dług techniczny do spłacenia stopniowo:** `styles.css` ma warstwę „Progress Fire” (ok. linii 3990–4150) z ciemnymi kolorami wpisanymi na sztywno; `theme.css` je nadpisuje. Docelowo przenieść te reguły pod `html[data-theme="dark"]` i usunąć nadpisania.

---

## Etap 2 — UX: przejrzystość ekranów

Cel: trener w 2 sekundy widzi, co ma zrobić na danym ekranie.

1. **Układ ekranu (wzorzec dla wszystkich modułów):** nagłówek z tytułem i licznikiem → pasek filtrów (chipy z licznikami) → treść (tabela albo karty) → jedna główna akcja w kolorze akcentu po prawej. Pozostałe akcje jako przyciski drugorzędne albo w menu „⋯”.
2. **Lista klientów:** wiersze bez kart (linia podziału zamiast ramki), kolumny konfigurowalne (zapamiętane w `localStorage`), zbiorcze akcje po zaznaczeniu.
3. **Nawigacja:** wąski tryb paska bocznego (same ikony, rozwijanie po najechaniu) dla ekranów 1024–1280 px; podmenu Biblioteki zostaje jako wysuwany panel.
4. **Stany puste:** każdy pusty ekran ma jedno zdanie „co tu będzie” i jeden przycisk startu.
5. **Gęstość:** przełącznik „Kompaktowy / Wygodny” jako token `--row-h` w `theme.css`.

Pliki: `theme.css`, `index.html` (struktura nagłówków), `05-clients-builder-plans-calendar.js` (lista klientów). Bez zmian danych.

---

## Etap 3 — generator planów: Amator / Zawodowiec

Stan obecny: `14-amateur-plan-wizard.js` (wywiad + `aplAmateurAssessment`, `aplAmateurPrescription`) i `15-pro-plan-wizard.js` (`aplProAssessment`, `aplProPrescription`) wypełniają formularz `aplGenerate`.

Architektura docelowa:

```
Wywiad (Amator | Zawodowiec)
  └─ assessment()        → status: clear | cautious | review  (blokuje auto-plan przy „review”)
  └─ prescription()      → parametry: metoda, dni, czas, tygodnie, progresja
        └─ planSkeleton()   (NOWE, deterministyczne, bez AI) → dni × sloty ruchowe
              └─ fillExercises(slots, sprzęt, ograniczenia)  → ćwiczenia z DEF_EX
                    └─ AI (opcjonalnie) tylko uzasadnienie i dopracowanie, z regułami z books-kb
```

- **Wspólny kontrakt** `PlanIntake { mode:'amator'|'zawodowiec', schemaVersion, answers, assessment, prescription }` zapisywany w `plan.intake` — jeden format dla obu trybów.
- **Amator:** maks. 3 dni, FBW / Upper-Lower, RIR 2–3, progresja podwójna, krótkie wyjaśnienia „dlaczego”.
- **Zawodowiec:** fazy (off-season, przygotowanie, start), periodyzacja blokowa/falowa, tygodnie deload, data startu wymagana w fazie przygotowań.
- **Bezpieczeństwo:** `review` zawsze zatrzymuje automatyczny plan (już tak jest) — zostaje bez zmian.

Test: `test_plan_intake_contract.js` (oba tryby → ten sam kształt `PlanIntake`).

---

## Etap 4 — progresja

Stan obecny: `normalizePlanProgression()` (off / linear / double / wave), `progressWorkingSet()` i `progressLoadStep()` w `01-core.js` podpowiadają kolejny ciężar w Treningu LIVE.

Plan:
- **Jeden moduł** `progression.js` (wydzielony z `01-core.js`, te same nazwy na `window`, żeby nie łamać wywołań): strategie jako obiekty `{ id, label, next(prev, plan, opts) }`.
- Nowe strategie: **RIR/RPE-autoregulacja** (cel RIR z planu vs zgłoszony RIR → ±krok), **tygodniowa falowa** z deloadem co N tygodni, **procent 1RM** (blokada jak dziś `lockPct`).
- **Bezpieczniki:** maks. +10% obciążenia tydzień do tygodnia, brak progresji po zgłoszonym bólu albo RIR 0, cofnięcie o krok po dwóch nieudanych sesjach.
- **Widoczność:** w LIVE podpowiedź z krótkim powodem („+2,5 kg — zrobione 12/12 powt.”), w profilu klienta wykres e1RM per ćwiczenie (dane już są: `exerciseProgressBestEpley`).

Test: rozszerzyć `test_apl_method_progression.js` o tabelę przypadków dla każdej strategii.

---

## Etap 5 — zamienniki ćwiczeń

Stan obecny: `ex.alts` w planie + `altsForExercise()`; w LIVE `liveAltsHtml()`, `liveToggleSwap()`, `liveSwapEx()`.

Plan:
- **Model:** każde ćwiczenie w `DEF_EX` dostaje (stopniowo) `pattern` (wzorzec ruchu: przysiad, zawias, wyciskanie poziome/pionowe, przyciąganie poziome/pionowe, wykrok, core), `equipment[]`, `difficulty` (1–3), `contra[]` (np. bark, kolano, kręgosłup lędźwiowy).
- **Dobór** `suggestSubstitutes(ex, { equipment, contra, level })`: ten sam wzorzec → zgodny sprzęt → bez przeciwwskazań klienta → podobna trudność; wynik z powodem („brak sztangi”, „ból barku”).
- **Zastosowanie:** LIVE (jak dziś, plus powód), kreator planu (przycisk „Zamień”), aplikacja klienta (prośba o zamianę → trener zatwierdza; bez samodzielnej zmiany planu przez klienta).
- **Zapis:** zamiana w sesji LIVE dotyczy tylko sesji; „zamień na stałe” zmienia plan i zostawia wpis w historii planu.

Test: `test_ex_substitutes.js` (wzorzec zachowany, przeciwwskazania wykluczone, deterministyczna kolejność).

---

## Etap 6 — gesty swipe (mobile / tablet)

Zakres: wyłącznie dodatkowy sposób obsługi; każda akcja ma też przycisk (dostępność, klawiatura, czytniki ekranu).

- **Moduł** `gestures.js`: jedna funkcja `bindSwipe(el, { left, right, threshold:64, axisLock:true })` na Pointer Events (bez bibliotek), ignoruje gest zaczęty na polu edycji i przy przewijaniu w pionie.
- **Gdzie:**
  - Trening LIVE: przesunięcie karty serii w prawo = „seria zrobiona”, w lewo = „pomiń”; przesunięcie nagłówka ćwiczenia = poprzednie/następne ćwiczenie.
  - Aplikacja klienta: przełączanie dni planu; odhaczanie zadań domowych.
  - Lista klientów (telefon): w lewo odsłania „Wiadomość / Trening LIVE”.
- **Bezpieczeństwo danych:** akcje nieodwracalne (usunięcie) nigdy pod gestem; po geście „Cofnij” przez 5 s.
- `prefers-reduced-motion` wyłącza animację przesunięcia, zostaje sama akcja.

Test: Playwright z `page.touchscreen`/pointer, plus test jednostkowy progu i blokady osi.

---

## Kolejność i zależności

| Etap | Zależy od | Zmiany danych |
|---|---|---|
| 2 UX | 1 | brak |
| 3 Generator | — | `plan.intake` (pole opcjonalne) |
| 4 Progresja | — | brak (opcjonalnie `plan.progressionRules`) |
| 5 Zamienniki | 3 (wzorce ruchu w doborze) | pola w `DEF_EX`, historia planu |
| 6 Swipe | 2 | brak |

Rekomendowana kolejność: 2 → 5 → 4 → 3 → 6 (najpierw to, co trener widzi codziennie).
