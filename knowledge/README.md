# Baza wiedzy z książek

Generator planów AI i Asystent AI w Progress Live korzystają z reguł z tych książek zamiast z ogólnej wiedzy modelu.

## Jak dodać książkę

1. Wrzuć plik `nazwa-ksiazki-baza-wiedzy.json` do folderu `knowledge/books/` (np. przez „Add file → Upload files” na GitHubie, prosto na `main` albo w PR).
2. Po trafieniu na `main` workflow **Baza wiedzy z książek — indeks** sam przebuduje `knowledge/books-index.json`.
   Lokalnie: `node .github/scripts/build_books_index.js`.

Format pliku: klucze `principles`, `exerciseRules`, `progressionRules`, `safetyRules`, `planTemplates`, `sourceReferences` (+ opcjonalnie `nutritionRules`, `communicationRules`, `marketingRules` i inne listy reguł). Każda reguła ma `status`:

- `zrodlo` — wprost z książki,
- `wniosek` — wyliczone z treści książki,
- `poza_zrodlem` — reguła ostrożności dodana do bazy (np. konsultacja lekarska),
- `brak_w_zrodle` — książka tego nie mówi (te reguły **nie** trafiają do AI).

Dziedzina książki (trening / żywienie / prowadzenie klienta / marketing) jest wykrywana z sekcji; można ją wymusić polem `meta.domain`.
