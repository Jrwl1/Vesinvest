# Ennuste (Forecast) UX & Behavior Audit

**Audit lens:** Finnish water utility CFO / Excel power user.  
**Goal:** Ennuste feels modern, trustworthy, and fast to understand from first load; all inputs must affect outputs.  
**Date:** 2026-02-18.

---

## 1. AUDIT REPORT

### 1.1 Top 10 UX problems (with evidence)

| # | Problem | Evidence |
|---|--------|----------|
| 1 | **Swedish strings in Finnish locale** | `fi.json`: `requiredTariff` was "Nödvändig taxa idag"; `summary.annualResult` "Årligt resultat"; `summary.cashflow` "Kassaflöde"; `summary.accumulatedCash` "Ackumulerad kassa"; `assumptionsCardTitle` "Antaganden"; `financing.volumes` "Volymer"; `financing.operatingAssumptions` "Driftantaganden"; `financing.investments` "Investeringar"; `addInvestment` "Lisää investering"; `charts.revenueVsCosts` "Intäkter vs Kostnader"; `miniSummaryVolym` "Volym". **Fixed in this audit** in `apps/web/src/i18n/locales/fi.json`. |
| 2 | **Graph not first on first load** | Ennuste shows Syötä (inputs) zone first, then Tulokset (results). CFO expects "what do I get?" before "what do I tune?". Layout is input-heavy above the fold; graph is below KPI row and inside results zone. |
| 3 | **"What we know" (Talousarvio) not visible on Ennuste** | No compact strip of 3-year baseline (revenue, costs, result) from Talousarvio on Ennuste. User must switch tabs to see baseline; trust and context are lost. |
| 4 | **Assumption overrides hidden behind two steps** | User must (1) open "Olettamukset" accordion, (2) click "Skenaarion olettamukset" to see override table. Primary levers (inflation, energy, volume, price, investment factor) are not immediately visible. |
| 5 | **Org default column can be stale after Asetukset change** | `orgAssumptions` is fetched once in `fetchInitialProjectionContext()` and never refetched when returning from Asetukset. So "Organisaation oletus" in Ennuste can show old values until full page refresh. Compute itself uses fresh DB values. |
| 6 | **No "last computed at" until after first compute** | `projection-controls__last-computed` is only rendered when `hasComputedData && activeProjection.updatedAt`. Before first "Laske uudelleen", user has no timestamp; unclear if data is current. |
| 7 | **Required tariff (€/m³) and deficit count not prominent enough** | KPI row has several cards; "Tarvittava tariffi tänään" and "Alijäämävuosia" are among them but not given visual priority. For a CFO, "what tariff do I need?" and "how many bad years?" are primary. |
| 8 | **Empty state pushes user to Syötä, not to "Laske ennuste"** | When `!hasComputedData`, empty state CTA says "Siirry syöttöön" and scrolls to `#ennuste-syota`. For bootstrap scenario, "Laske ennuste" is the main action; flow could be one click to compute. |
| 9 | **Driver planner "save before compute" blocks without clear hierarchy** | If `driverPathsDirty`, "Laske uudelleen" is disabled and message says save drivers first. User may not know whether to change assumptions or drivers first; workflow is not spelled out. |
| 10 | **Table/diagram tucked inside &lt;details&gt;** | "Taulukko/diagrammi" and full table are behind a `<details>` (showTable). CFOs often want table visible by default; diagram can be secondary or side-by-side. |

### 1.2 Top 5 behavior/logic bugs (with root cause)

| # | Bug | Root cause | Fix |
|---|-----|------------|-----|
| 1 | **Assumption input value not applied if user clicks "Laske uudelleen" without blur** | `AssumptionInput` applies value `onBlur`. `handleCompute` blurs active element and `setTimeout(0)` then reads `overridesRef.current`. If ref sync is delayed or focus not lost, last typed value can be missing from payload. | Already mitigated by blur + tick in `handleCompute`. Consider applying on Enter or adding "Apply" next to each override so there is no dependency on blur. |
| 2 | **Ennuste "Org default" shows stale values after editing Asetukset** | `listAssumptions()` is called only in `fetchInitialProjectionContext()` at load. Navigating Budget → Asetukset → change inflation → Ennuste leaves `orgAssumptions` unchanged. Compute uses DB (correct); UI "Org default" column is wrong until refresh. | Refetch `listAssumptions()` when ProjectionPage gains focus (e.g. when tab becomes projection) or after returning from settings; or expose "Päivitä oletukset" to refetch. |
| 3 | **404 on compute leaves user with no fallback message** | When `computeProjection(id)` returns 404, code uses `computeForBudget(talousarvioId, overrides, driverPaths)`. If that also fails, user sees generic "Failed to compute projection". No hint that projection may have been reset (e.g. demo). | Show specific message when 404: e.g. "Skenaario ei löydy. Lasketaan uudelleen budjetin perusteella." and ensure computeForBudget is called with current overrides/driverPaths (already done in code). |
| 4 | **User investments / driver paths not in request if only overrides changed** | `handleCompute` sends PATCH with `olettamusYlikirjoitukset` then POST compute. If user had previously saved investments/drivers, they are already on projection; no bug. If user added investments but did not click "Tallenna" (investments) or "Tallenna ajurit", those are only in local state and are not sent. So "Laske uudelleen" uses server-state investments/drivers. | This is by design (save then recalc). UX issue: make it explicit that "Tallenna investoinnit" and "Tallenna ajurit" must be clicked before "Laske uudelleen" when those sections were edited. |
| 5 | **Horizon change does not trigger recompute** | `handleHorizonChange` updates `aikajaksoVuosia` via PATCH and refetches projection; it does not call compute. So changing horizon alone leaves `vuodet` with old length/content until user clicks "Laske uudelleen". | Either auto-call compute after horizon change, or show clear notice: "Aikajänne muuttui. Paina Laske uudelleen päivittääksesi vuodet." |

---

## 2. UX SPEC (CFO / Excel lens) — "Most user-friendly first load"

### 2.1 Optimal first-load layout for Ennuste

1. **"What we know" strip (from Talousarvio)**  
   - One compact row or card: e.g. "Perusta: 2023–2025" with 3-year totals (tulot, kulut, tulos) from the baseline budget.  
   - Source: same budget as active scenario (`activeProjection.talousarvioId` → budget valisummat/rivit).  
   - Read-only; builds trust that the forecast is grounded in real data.

2. **"What we assume" panel**  
   - **Primary (always visible):** Inflation (%), Energy (%), Volume change (%), Price increase (%). Optional: one line "Investointikerroin" or in "advanced".  
   - **Advanced (behind "Lisäasetukset" or accordion):** Investment coefficient, base-fee adjustment, any future levers.  
   - Show "Organisaation oletus" vs "Skenaarion arvo" only when user expands overrides, to avoid clutter.

3. **Graph dominates the screen**  
   - First content in Tulokset: full-width tariff trend (€/m³) chart.  
   - Below: 2–3 KPI tiles in one row: **Tarvittava tariffi tänään (€/m³)**, **Kumulatiivinen tulos (loppuvuosi)**, **Alijäämävuosia / N**.  
   - Then: year selector + table or second chart in tabs/details.

### 2.2 Workflow: first 30 seconds

1. User opens Ennuste tab → sees scenario selector (if multiple) and **one** main CTA: "Laske ennuste" or "Laske uudelleen".  
2. Immediately visible: small "What we know" strip (3-year baseline).  
3. One line of key assumptions (e.g. 4 percentages) with optional "Muokkaa" opening overrides.  
4. Large chart (tariff or cash) + 3 KPI tiles.  
5. One click: "Laske uudelleen" → graph and KPIs update; "Viimeksi laskettu: …" appears.

---

## 3. BEHAVIOR SPEC — "Inputs must drive outputs"

### 3.1 Where each input is stored and when it is applied

| Input | Stored (state/source) | When applied | How it affects computation | Where it flows (graph/table/cards) |
|-------|----------------------|-------------|----------------------------|------------------------------------|
| **Org assumptions (Asetukset)** | DB `Olettamus`; frontend `orgAssumptions` from `listAssumptions()` at load | On compute: backend reads fresh from DB | `projections.service` `compute()` builds `assumptionMap` from `prisma.olettamus.findMany` then applies overrides | All years (revenue, costs, investments); graph series; requiredTariff; KPI cards |
| **Scenario overrides (Ennuste panel)** | `overrides` state + `overridesRef`; on compute sent as `olettamusYlikirjoitukset` in PATCH then POST compute | On "Laske uudelleen" (after blur + tick) | Backend merges overrides onto org assumptions in `compute()` and in `buildAssumptionMap` for findById | Same as above |
| **Horizon (aikajaksoVuosia)** | Projection entity; UI select `handleHorizonChange` → PATCH | On change (no auto recompute) | Engine runs for `horizonYears`; determines length of `vuodet` | Table rows; chart X-axis; KPI "loppuvuosi" |
| **User investments** | Projection `userInvestments` (DB); local `userInvestments` state synced from `activeProjection` | When user clicks "Tallenna" (investments); compute uses DB | `parseUserInvestments` in service; engine adds investments to years | Table "Investoinnit"; chart if investment series shown; cumulative / requiredTariff |
| **Driver paths (tuloajurit)** | Projection `ajuriPolut` (DB); local `driverPaths` state | When user clicks "Tallenna ajurit"; compute uses DB (must save before compute when dirty) | `normalizeDriverPaths`; engine uses paths for price/volume per year | Table "Tulot", "Vesihinta", "Vesimäärä"; chart tariff series; requiredTariff |
| **Base budget (talousarvioId)** | Scenario selector; create scenario picks budget | At scenario creation or when selecting scenario | Backend loads budget lines/valisummat and drivers; base year = budget.vuosi | All computed years and chart |

### 3.2 Disconnects and fix recommendations

- **Asetukset not propagating to Ennuste display:** Org defaults in Ennuste are from initial `listAssumptions()`. **Fix:** Refetch assumptions when Ennuste tab is shown or add "Päivitä oletukset" that calls `listAssumptions()` and `setOrgAssumptions`. File: `apps/web/src/pages/ProjectionPage.tsx` (e.g. in a focus effect or when `state.tab === 'projection'`).
- **Scenario overrides:** Already applied on compute via PATCH + POST; no disconnect. Overrides are in `overridesRef` and sent in `handleCompute`.
- **Graph reading old state:** Graph uses `years = activeProjection?.vuodet ?? []` and `setActiveProjection(result)` after compute; so graph updates. No disconnect.
- **Investments/drivers not saved:** If user edits but does not click Save, compute uses previous saved state. **Fix:** Keep current UX but make the "Tallenna investoinnit" / "Tallenna ajurit" requirement obvious (e.g. banner when dirty: "Tallenna muutokset ennen uudelleenlaskentaa.").

---

## 4. VISUAL / INFO DESIGN — "Not 1965"

### 4.1 Proposals (existing Vite/React)

- **Graph-first:** Move the hero chart (tariff trend) to the top of the results section; full width; reduce padding so the chart is the dominant visual.  
- **Control rail:** Put key assumption inputs in a right-side rail (or top bar) on desktop: 4–5 inputs in one row (Inflation, Energy, Volume, Price, optional Investment factor). Accordion "Olettamukset" can remain for full table + horizon + "Skenaarion olettamukset".  
- **KPI tiles:** One row, compact: "Tarvittava tariffi tänään" (X.XX €/m³), "Kumulatiivinen tulos" (€), "Alijäämävuosia" (N / total). Same styling (e.g. `projection-kpi-card`), consistent spacing.  
- **Avoid:** Large empty whitespace; "one container two boxes" with no hierarchy. Use clear section headings (Syötä / Tulokset) and optional anchor nav.  
- **Language:** FI selected ⇒ no Swedish in Ennuste/Talousarvio. All identified keys fixed in `fi.json` (see i18n list below).  
- **Buttons:** "Laske uudelleen" should be near the assumptions (same card or rail), not buried below accordions.

### 4.2 Visual issues observed (from code/CSS)

- Spacing: Ensure consistent gap between KPI cards and between chart and table.  
- Typography: KPI values should be prominent (e.g. larger font for numbers).  
- Redundant labels: "Olettamukset" appears as accordion title and card title; can be unified.  
- "Last computed" timestamp: Use same date/time format as rest of app (fi-FI).

---

## 5. OUTPUT FORMAT / NUMBERS (UX standardization)

- **"Tarvittava tariffi tänään":** Show as **X.XX €/m³** (2 decimals). Implemented in `formatTariffEurPerM3` in `apps/web/src/utils/format.ts`.  
- **€ totals in tables:** Whole euros (no cents). Implemented via `formatEurInt` (rounds and uses currency formatter with 0 fraction digits).  
- **Units:** Use **€**, **€/m³**, **m³** consistently. Volume: `formatM3Int` (integer + " m³").  
- **Thousand separators:** Finnish locale in `format.ts` (`fi-FI`) gives space as thousand separator.  
- **Single helper:** All number display should go through `utils/format.ts` (formatEurInt, formatTariffEurPerM3, formatM3Int, formatDecimal). No ad-hoc `.toFixed()` or mixed locales in Ennuste/Talousarvio.

---

## 6. PRIORITIZED CHANGE PLAN (small PR-sized steps)

| Step | Description | Files |
|------|-------------|--------|
| 1 | **i18n: Fix Finnish locale (Swedish → Finnish)** | `apps/web/src/i18n/locales/fi.json` (done in this audit) |
| 2 | **Refetch org assumptions when Ennuste is focused** | `ProjectionPage.tsx`: effect when `state.tab === 'projection'` or on mount when tab is projection: call `listAssumptions()` and `setOrgAssumptions` so "Org default" stays in sync after Asetukset edits |
| 3 | **First-load: show "What we know" strip** | New small component or section in ProjectionPage that reads `activeProjection.talousarvio` and shows 3-year baseline (from valisummat or rivit); data from getBudget if needed or from projection.talousarvio included in getProjection |
| 4 | **Surface primary assumptions (4) above the fold** | In EnnusteSyotaZone, add a single row of 4 inputs (inflaatio, energiakerroin, vesimaaran_muutos, hintakorotus) always visible; keep full table in accordion "Skenaarion olettamukset" |
| 5 | **Move graph to top of Tulokset + full width** | In ProjectionPage, reorder EnnusteTuloksetZone: first KPI row, then hero chart (full width), then year selector + table/details |
| 6 | **Horizon change: show notice or auto-recompute** | After `handleHorizonChange`, either call `handleCompute()` after update, or set a short message "Aikajänne muuttui. Laske uudelleen päivittääksesi." and optionally scroll to compute button |
| 7 | **Table visible by default (or tab default)** | Change default `resultViewMode` to `'table'` or open the `<details id="projection-results-view">` by default so table is visible without click |
| 8 | **Clear "save before compute" when drivers/dirty** | Keep blocking "Laske uudelleen" when driverPathsDirty; add inline hint in the same card: "Tallenna tuloajurit yllä ennen laskentaa." (already present; ensure it’s visible) |
| 9 | **KPI card hierarchy** | In CSS/component: make "Tarvittava tariffi tänään" and "Alijäämävuosia" slightly larger or bold so they read as primary |
| 10 | **Optional: control rail layout** | CSS/refactor: on wide viewport, place assumption row or card in a right rail so chart + table get more width |

---

## 7. i18n ISSUES + EXACT KEYS/FILES FIXED

**File:** `apps/web/src/i18n/locales/fi.json`

| Key | Was (SV/wrong) | Fixed to (FI) |
|-----|-----------------|----------------|
| `projection.summary.requiredTariff` | Nödvändig taxa idag | Tarvittava tariffi tänään |
| `projection.summary.annualResult` | Årligt resultat | Vuositulos |
| `projection.summary.cashflow` | Kassaflöde | Kassavirta |
| `projection.summary.accumulatedCash` | Ackumulerad kassa | Kertymä kassa |
| `projection.assumptionsCardTitle` | Antaganden | Olettamuskortti |
| `projection.miniSummaryVolym` | Volym | Volyymi |
| `projection.financing.volumes` | Volumer | Määrät |
| `projection.financing.operatingAssumptions` | Driftantaganden | Käyttöolettamukset |
| `projection.financing.investments` | Investeringar | Investoinnit |
| `projection.financing.addInvestment` | Lisää investering | Lisää investointi |
| `projection.charts.revenueVsCosts` | Intäkter vs Kostnader (incl. …) | Tulot vs kulut (sis. poistot + investoinnit) |

**Verification:** With language set to Finnish (fi), open Ennuste and Talousarvio; no Swedish strings should appear in summary, KPI, financing, or chart labels.

---

## 8. DEBUG INSTRUMENTATION (optional, remove after root cause)

If a specific input still does not affect output:

1. **Payload to compute:** In `handleCompute`, before `updateProjection`, log `cleanOverrides` and (if needed) current `driverPaths` / `userInvestments` from server state.  
2. **Response:** After `computeProjection(id)`, log `result.vuodet?.length` and `result.requiredTariff`.  
3. **State updates:** Ensure `setActiveProjection(result)` is called and that the component that renders the graph receives `activeProjection.vuodet`.  

All of the above can be gated with `import.meta.env.DEV` and a small debug flag.

---

*End of audit.*
