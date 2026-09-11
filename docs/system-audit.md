# Audyt CRM Progress Live — architektura, dane, UX

Stack: **vanilla JS + Firestore + GitHub Pages** (nie React/Next/Tailwind). Stan to tablice globalne (`CL`, `PL`, `SE`, …) zapisywane `persistById(kolekcja, obj)` — `obj.id` = id dokumentu. Nie ma TypeScriptowych interfejsów; model jest konwencją w kodzie.

---

## 1. Co dodać

| Brak | Dlaczego | Gdzie |
|---|---|---|
| E-mail jako identyfikator auth | Modal „Nowy klient” nie wymagał maila; wizard onboardingu tak. Klient bez maila nie zaloguje się do apki. | `saveClient` w `05-…js`, `#ac-email` |
| Jednolity pipeline onboardingu | Dwa wejścia (modal vs wizard) rozjeżdżały się: ankieta / plan / kalendarz / webhook. | `assignClientPipeline` w `01-core.js` |
| Cykl życia na liście | Była aktywność (dni od sesji), brak statusu pakietu / onboardingu / braku maila. | `clientLifecycleStatus` |
| TDEE → karta klienta bez czatu | „Wyślij do klienta” zapisywało makro *i* pisało na czat. Brak „Zapisz w profilu”. | `calcSaveToClient` / `applyMacrosToClient` |
| Szyna zdarzeń | `fireIntEvent` szło tylko na Zapier/Make. Brak lokalnego busa (`client.created`, `macros.saved`). | `emitAppEvent` |
| Brama płatności ↔ kalendarz / Live | **Zrobione:** `clientHasPaidAccess` + Trial / Gość. Nieopłacony/wygasły pakiet blokuje `schedulePlanToCalendar` i Live Start. Live End zdejmuje sesje tylko z `payStatus:'paid'`. | `01-core.js`, Live, profil → Płatności |
| Event-driven automatyzacja | **Zrobione:** Autoflow nasłuchuje `emitAppEvent` — `package.expired`, `checkin.submitted`, `client.created` (`new_client`). Poll zostaje dla `inactivity` / `session_today`. | `09-…js` `autoflowOnAppEvent` |
| Live: IndexedDB + kolejka sync | **Zrobione:** `source:'live-draft'` przy starcie i co 3 serie + IndexedDB + LS. Koniec sesji zamienia ten sam dokument na `source:'live'`. | `liveSaveDraft` / `livePersistDraftRemote` w `02-…js` |
| Tagi KB ↔ builder | MEV/MAV/RIR są w promptach AI i przewodniku objętości, nie jako tagi rekordów bazy wiedzy powiązane z ćwiczeniem/dniem planu. | `01-core.js` evidence + `03-…js` prompt |

---

## 2. Co usunąć / schować

| Element | Powód |
|---|---|
| Check-in w „Przypomnieniach” *i* w „Wymagają uwagi” | **Zrobione:** check-in tylko w Uwadze; Przypomnienia = pakiety (`collectOpsEvents`). |
| Stare follow-upy dashboardu (`dash-checkin-followup` itd.) | **Zrobione:** HTML usunięty. Helpery (check-in, HW, nawyki, zdjęcia) zostają; odświeżanie idzie przez `refreshDashOps` → siatka operacyjna. |
| `clientHasPackage` po `clientName` | **Zrobione:** tylko `clientId`. |
| Osobna kopia „Dzisiejszy plan” jako drugi kalendarz | Zostaje skrót z CTA „Kalendarz →”. Nie usuwać — to *dziś*, nie miesiąc. Kalendarz: „Ten tydzień” + „Nadchodzące” = ten sam `SE`. |
| Kafelki flow onboardingu jako drugi kreator wiadomości | Nie usuwać od razu — owinąć w `emitAppEvent('client.created')` (zrobione) i stopniowo spiąć z Autoflow. |

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
ONBOARDING_FLOW        →  Autoflow trigger new_client + checklista CLIENT_ONBOARD_STEPS + ONB_FLOWS (wizard)
clientName             →  plans, packages, invoices, historia onboardingu (cache; rename nie przepisuje)
```

Powiadomienia: **trzy niezależne systemy**

1. `NOTIFICATIONS` / `addNotification` / `generateAutoNotifs` (dzwonek, Firestore)
2. `collectOpsEvents` → dashboard Uwaga + Przypomnienia (teraz jedno źródło, cache 15 s)
3. Autoflow `AF_STATE` (osobne enrollmenty)

Nie ma crona. „Wymagają uwagi” było **synchronicznym skanem wszystkich klientów przy każdym `renderDashOps`** (check-in + 14 dni `SE` + BMI watchdog). Teraz ten sam skan jest w `collectOpsEvents` z TTL 15 s — nadal klient-side, bez backendu.

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

Wejścia: `saveClient` (modal) i `onbCreateClient` (wizard).

---

## 5. Moduły (skrót UX)

**Dashboard.** KPI + Uwaga + raporty + aktywność + dziś + płatności. „Start współpracy” (`dash-client-pipeline`) jest osobnym paskiem. Nie dublować check-inu w przypomnieniach.

**Klienci.** Lista Everfit: aktywność, % 7/30 dni, e-mail. Pill cyklu życia. E-mail wymagany przy zapisie.

**Wiadomości.** Jeden inbox (`MSGS`). Filtry w wątku: Czat / System / Broadcast (`kind` na wiadomości, stare OD rozpoznawane z tagu).

**Live.** Najlepszy moduł produktu. Ryzyko: LS. Dual slot OK.

| Kalendarz. `SE.source` planned/live/client/garmin. **Zrobione:** wizyta na sali i Live End zdejmują sesję z opłaconego pakietu (`consumeClientPackageSession`, raz na dzień). |

**Automatyzacja.** Dwa byty: checklista onboardingu + Autoflow. Scalanie = Autoflow nasłuchuje `emitAppEvent`.

**Płatności.** Statystyki przy zerze transakcji — UI puste stany już są; nie dokładać KPI. Brama dostępu: `clientHasPaidAccess`. Pulpit: wygasające pakiety tylko w „Płatności do odnowienia”.

**TDEE / KB.** TDEE zapisuje `c.macros`. KB nie steruje builderem (świadomie: żargon MEV zostaje w przewodniku trenera, nie w mowie do klienta).

---

## 6. Pliki — scal / przebuduj / zostaw

| Plik | Akcja |
|---|---|
| `01-core.js` | Pipeline, e-mail, lifecycle, `emitAppEvent` — **zrobione** |
| `05-clients-builder-plans-calendar.js` | `saveClient` + lista lifecycle — **zrobione** |
| `02-…-live.js` | Wizard → pipeline; Live draft LS + IDB + Firestore `live-draft` — **zrobione** |
| `04-client-portal.js` | `collectOpsEvents` + `refreshDashOps` (bez martwych follow-upów) — **zrobione** |
| `07-forms-metrics-calculator.js` | TDEE save — **zrobione** |
| `09-posture-kb-invites-private.js` | `runOnboardingForClient(opts)`; Autoflow na `emitAppEvent` (`package.expired`, `checkin.submitted`) — **zrobione** |
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
