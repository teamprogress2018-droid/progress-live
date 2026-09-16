# Audyt CRM Progress Live — architektura, dane, UX

Stack: **vanilla JS + Firestore + GitHub Pages** (nie React/Next/Tailwind). Stan to tablice globalne (`CL`, `PL`, `SE`, …) zapisywane `persistById(kolekcja, obj)` — `obj.id` = id dokumentu. Nie ma TypeScriptowych interfejsów; model jest konwencją w kodzie.

---

## 1. Co dodać

| Brak | Dlaczego | Gdzie |
|---|---|---|
| E-mail jako identyfikator auth | **Zrobione:** `#ac-email` wymagany w modalu NOWY KLIENT. Wizard usunięty. | `saveClient` w `05-…js` |
| Jednolity pipeline onboardingu | **Zrobione:** jedno wejście `saveClient` + checklista `CLIENT_ONBOARD_STEPS`. Wizard `onbCreateClient` usunięty. | `assignClientPipeline` w `01-core.js` |
| Cykl życia na liście | **Zrobione:** pill na liście klientów — brak e-maila, onboarding X/Y, pakiet wygasł / X d., ryzyko odejścia, aktywny. | `clientLifecycleStatus` |
| TDEE → karta klienta bez czatu | **Zrobione:** „Zapisz w profilu” (`calcSaveToClient`) zapisuje `c.macros` bez wiadomości. „Wyślij do klienta” nadal idzie na czat. | `calcSaveToClient` / `applyMacrosToClient` |
| Szyna zdarzeń | **Zrobione:** `emitAppEvent` (in-memory + Integracje + Autoflow). Typy: `client.created`, `macros.saved`, `checkin.submitted`, `package.expired`, … | `emitAppEvent` |
| Brama płatności ↔ kalendarz / Live | **Zrobione:** `clientHasPaidAccess` + Trial / Gość. Nieopłacony/wygasły pakiet blokuje `schedulePlanToCalendar` i Live Start. Live End zdejmuje sesje tylko z `payStatus:'paid'`. | `01-core.js`, Live, profil → Płatności |
| Event-driven automatyzacja | **Zrobione:** Autoflow nasłuchuje `emitAppEvent` — `package.expired`, `checkin.submitted`, `client.created`, `client.inactive`, `session.soon`. Skan (ten sam zegar co pulpit) emituje zastój i sesję w oknie przypomnienia. Poll zostaje tylko dla sekwencji dni. | `09-…js` `autoflowOnAppEvent` |
| Live: IndexedDB + kolejka sync | **Zrobione:** `source:'live-draft'` przy starcie i co 3 serie + IndexedDB + LS. Koniec sesji zamienia ten sam dokument na `source:'live'`. | `liveSaveDraft` / `livePersistDraftRemote` w `02-…js` |
| Tagi KB ↔ builder | **Zrobione:** tagi landmark (MEV/MAV/MRV/RIR/RPE/częstotliwość/deload) i partii na wpisie KB. Kreator pokazuje dopasowane notatki przy dniu i w panelu „Baza na ten plan”. Mowa do klienta bez żargonu. | `kbEntriesForBuilder` + `#builder-kb-hits` |

---

## 2. Co usunąć / schować

| Element | Powód |
|---|---|
| Check-in w „Przypomnieniach” *i* w „Wymagają uwagi” | **Zrobione:** check-in tylko w Uwadze; Przypomnienia = pakiety (`collectOpsEvents`). |
| Stare follow-upy dashboardu (`dash-checkin-followup` itd.) | **Zrobione:** HTML usunięty. Helpery (check-in, HW, nawyki, zdjęcia) zostają; odświeżanie idzie przez `refreshDashOps` → siatka operacyjna. |
| `clientHasPackage` po `clientName` | **Zrobione:** tylko `clientId`. |
| Osobna kopia „Dzisiejszy plan” jako drugi kalendarz | Zostaje skrót z CTA „Kalendarz →”. Nie usuwać — to *dziś*, nie miesiąc. Kalendarz: „Ten tydzień” + „Nadchodzące” = ten sam `SE`. |
| Kafelki flow onboardingu jako drugi kreator wiadomości | **Zrobione:** kafelki to etykiety (`onbUseFlow`); auto-wiadomość z Automatyzacji (`ONBOARDING_FLOW`). Ustawienia startu = legenda 6 kroków, nie checkboxy `msgSteps`. |

Nawigacja: Kalkulator / KB / Integracje **już** były pod **Więcej** (nie w primary). Teraz pogrupowane: Oferta / Biznes / Narzędzia / Konto.

---

## 3. Co się dubluje

```
Źródło prawdy          →  Kopie / widoki
─────────────────────────────────────────
SE (sesje)             →  Dashboard „Dzisiejszy plan”, Kalendarz, Live, profil → Treningi
CHECKINS + getCIStatus →  Uwaga, Przypomnienia (było), dzwonek generateAutoNotifs, ekran Check-in
PACKAGES.expiresDate   →  KPI dashboard, Płatności, dzwonek, onboard „pakiet”
MSGS nieprzeczytane    →  badge Wiadomości + czasem Uwaga (brak odpowiedzi)
ONBOARDING_FLOW        →  Autoflow trigger new_client + checklista CLIENT_ONBOARD_STEPS + ONB_FLOWS (warianty / etykiety)
clientName             →  plans, packages, invoices, historia onboardingu (cache; rename nie przepisuje)
```

Powiadomienia: **jeden skan, dwa widoki**

1. `collectOpsEvents` — skan klientów (TTL 15 s) → pulpit Uwaga + Przypomnienia
2. `generateAutoNotifs` — dzwonek: sesje dziś / pakiety **oraz** pozycje `attention` z tego samego skanu (`opsEventNotifKey`)
3. Autoflow `AF_STATE` — enrollmenty na `emitAppEvent` (osobna maszyna stanów, nie lista alertów). Zastój / sesja dziś: `scanAndEmitInactivity` + `scanAndEmitSessionToday` z tego samego zegara.

Zegar: `startOpsScanClock` co 60 s gdy karta widoczna + `visibilitychange` — pulpit, dzwonek i Autoflow. Nie ma crona po stronie serwera (GitHub Pages).

---

## 4. Stan i dane

**Jak jest:** jeden heap w `window`, hydrate w `index.html` `load()`. Brak Redux/store. Persist per dokument.

**Relacje (docelowo i po tym PR):** zawsze `clientId`. Plan to kopia dni z szablonu (`days[]`), nie referencja `templateId` przy edycji szablonu (szablon już zapisany na planie jako `templateId` w pipeline). Zmiana szablonu w bibliotece **nie** aktualizuje przypisanych planów — to zamierzone (kopia mikrocyklu).

**Co nie kopiować:** całej karty klienta do planu/sesji. `clientName` tylko do UI offline.

**Live:** dwa sloty. Draft: LS + IndexedDB + Firestore `source:'live-draft'` (start i co 3 odhaczone serie). „Zakończ” zamienia ten sam dokument na `source:'live'`.

**Onboarding pipeline (wdrożone):**

`assignClientPipeline(client, { persist, runFlow, templateId, schedule, notify, fireEvent })`

1. karta (`clients`)
2. baseline (opcjonalnie)
3. szablon (`plans.clientId`) lub program z flow
4. `runOnboardingForClient` (ankieta, wiadomość, OD) — `skipAssign` gdy plan już jest
5. kalendarz `maybeSchedulePlanToCalendar` gdy brak `SE`
6. `emitAppEvent('client.created')` (+ webhook Integracji)

Wejścia: `saveClient` (modal NOWY KLIENT). Checklista: `openClientOnboardChecklist`. Wizard `onbCreateClient` usunięty.

---

## 5. Moduły (skrót UX)

**Dashboard.** KPI + Uwaga + raporty + aktywność + dziś + płatności. „Start współpracy” (`dash-client-pipeline`) jest osobnym paskiem. Nie dublować check-inu w przypomnieniach.

**Klienci.** Lista Everfit: aktywność, % 7/30 dni, e-mail. Pill cyklu życia. E-mail wymagany przy zapisie.

**Wiadomości.** Jeden inbox (`MSGS`). Filtry w wątku: Czat / System / Broadcast (`kind` na wiadomości, stare OD rozpoznawane z tagu).

**Live.** Najlepszy moduł produktu. Ryzyko: LS. Dual slot OK.

| Kalendarz. `SE.source` planned/live/client/garmin. **Zrobione:** wizyta na sali i Live End zdejmują sesję z opłaconego pakietu (`consumeClientPackageSession`, raz na dzień). |

**Automatyzacja.** Dwa byty: checklista onboardingu + Autoflow. Scalanie = Autoflow nasłuchuje `emitAppEvent`.

**Płatności.** Statystyki przy zerze transakcji — UI puste stany już są; nie dokładać KPI. Brama dostępu: `clientHasPaidAccess`. Pulpit: wygasające pakiety tylko w „Płatności do odnowienia”.

**TDEE / KB.** TDEE zapisuje `c.macros`. Tagi KB (MEV/RIR/partia) sterują panelem kreatora i kolejnością kontekstu AI — żargon nadal nie idzie do mowy klienta.

---

## 6. Pliki — scal / przebuduj / zostaw

| Plik | Akcja |
|---|---|
| `01-core.js` | Pipeline, e-mail, lifecycle, `emitAppEvent` — **zrobione** |
| `05-clients-builder-plans-calendar.js` | `saveClient` + lista lifecycle — **zrobione** |
| `02-…-live.js` | Wizard usunięty; Ustawienia = legenda 6 kroków + CTA Automatyzacja; Live draft LS + IDB + Firestore `live-draft` — **zrobione** |
| `04-client-portal.js` | `collectOpsEvents` + `refreshDashOps` (bez martwych follow-upów) — **zrobione** |
| `07-forms-metrics-calculator.js` | TDEE save — **zrobione** |
| `09-posture-kb-invites-private.js` | `runOnboardingForClient(opts)`; Autoflow na `emitAppEvent` (`package.expired`, `checkin.submitted`, `client.inactive`, `session.soon`) — **zrobione** |
| `index.html` | Nav grupy, e-mail required, przycisk TDEE |
| `06-inbox-…js` | Filtry inbox `kind` — **zrobione** |
| `10-client-app.js` | Banner nieopłaconego pakietu; brama Live/kalendarz przez `clientHasPaidAccess` |

**Nie przenosić na React/Next.** Koszt przepisania > zysk. Ten PR trzyma stack.

---

## 7. Kolejne PR (kolejność)

1. **Brama pakietu** — `clientHasPaidAccess` + Trial / Gość — **zrobione**
2. **Live draft → Firestore** `source:'live-draft'` co 3 serie + IndexedDB — **zrobione**
3. **Inbox kinds** — `direct | system | broadcast` + filtry — **zrobione**
4. **Autoflow na `emitAppEvent`** — `package.expired` / `checkin.submitted` — **zrobione**
5. Martwe follow-upy dashboardu — **zrobione** (`refreshDashOps` + siatka operacyjna)
6. **Kalendarz/sala → sesja pakietu** — **zrobione** (`consumeClientPackageSession`, raz na dzień, jak Live End)
7. Copy przypomnień na pulpicie — **zrobione** (podtytuł „Wygasające pakiety”, nie „Raporty i pakiety”)
8. **Check-in po wizycie / odblokowanie** — **zrobione:** `maybeSendCheckinAfterSession` po Live End / sala `✓ Odbył się` / apka `cwFinish`. Raz na tydzień (`ensurePendingCheckin`, `source:'session'`). Skip gdy check-in wyłączony, brak planu, już wypełniony albo pending.
9. **Pulpit: jedna lista pakietów** — **zrobione:** karta Przypomnień zdjęta (dublowała „Płatności do odnowienia”). KPI scrolluje do `#dash-ops-pay`.
10. **`clientName` po zmianie imienia** — **zrobione:** `syncClientNameCache` przy `saveCPEdit` / edycji `saveClient` przepisuje cache na planach, pakietach, fakturach i historii onboardingu.
11. **Pakiety tylko po `clientId`** — **zrobione:** `packagesForClient` (profil Płatności, raport). Koniec `|| clientName` — to samo imię nie podpina cudzego pakietu.
13. **KB → AI: notatki + badania** — **zrobione:** Generator bierze notatki i źródła (oraz zasady). Wpis z wyłączonym planowaniem zostaje tylko w bazie — bez wycieku „pozostałych notatek”.
12. **Płatności: filtry po `clientId`** — **zrobione:** chipy Pakietów i select Historii (`payClientsFromPackages`). To samo imię = dwa chipy / dwie opcje, nie jedna wspólna lista.
14. **Ustawienia startu współpracy** — **zrobione:** legenda `CLIENT_ONBOARD_STEPS` (6/6), bez checkboxów `msgSteps`. Auto-wiadomość = Automatyzacja. Przypomnienia i kontrakt zostają jako notatki — aplikacja ich nie wysyła.

---

## 8. Status — kolejka 1–17 (2026-09-16)

Pozycje **1–14** z §7 są wdrożone. Tagi KB (#313), jeden skan ops (#314) i Autoflow zastój/sesja dziś (#315) też.

**Świadomy skip:** „Dzisiejszy plan” zostaje skrótem (nie drugim kalendarzem). Unread MSGS zostaje badge’em Wiadomości — nie duplikujemy w Uwadze.

Kalendarz (poza §7): tydzień 7 równych kolumn (#305/#306), brak dublowania sesji o tej samej godzinie (#307).
15. **Tagi KB ↔ builder** — **zrobione:** `tags[]` na wpisie (MEV/MAV/RIR/partia). Kreator: `#builder-kb-hits` + pasek dnia. AI (`askAI`) sortuje kontekst po tagach planu.
16. **Jeden skan operacyjny** — **zrobione:** `generateAutoNotifs` bierze `attention` z `collectOpsEvents`. `startOpsScanClock` co 60 s + powrót na kartę. Autoflow zostaje na zdarzeniach.
17. **Autoflow zastój / sesja dziś** — **zrobione:** `client.inactive` i `session.soon` z zegara skanu (`scanAndEmitInactivity` / `scanAndEmitSessionToday`). Poll w `runAutoflowsCheck` tylko sekwencje dni.
