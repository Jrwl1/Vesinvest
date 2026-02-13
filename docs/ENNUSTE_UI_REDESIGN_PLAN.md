# Ennuste / Projections Page UI Redesign Plan

**Goal:** Redesign the Ennuste (Projections) page UI/UX to match the locked spec. Keep existing calculations/logic; focus on UI restructure and formatting standardization.

**Mode:** PLAN ONLY — no implementation in this document.

---

## Non-negotiables (Locked Before Implementation)

These must not be weakened by the redesign:

1. **DriverPlanner capability** — Keep **same-screen** per-year editing and “% from year X” for both vesi and jätevesi. Do **not** simplify or remove the DriverPlanner; only compact its layout (e.g. under Antaganden). No reduction of per-year or %-mode controls.
2. **Table/diagram relationship** — Keep the existing table/diagram sub-view and shared dataset. The new tariff chart is an **addition** (e.g. primary in hero or inside the diagram view); it does **not** replace the current result tabs/table flow.
3. **Compute status and a11y** — Keep compute-status visibility (“Laske uudelleen”, last computed, dirty hint) and preserve existing accessibility semantics (aria-labels, roles) already achieved.

---

## 1. Findings (Where Ennuste Is Implemented)

### 1.1 Route and entry point

| Item | Location |
|------|----------|
| **Route / tab** | Tab-based: `state.tab === 'projection'` renders `<ProjectionPage />` |
| **App wiring** | `apps/web/src/App.tsx` (import `ProjectionPage`, conditional render on tab `'projection'`) |
| **Navigation** | `apps/web/src/context/NavigationContext.tsx` — tab IDs include `'projection'` |

There is no separate `/ennuste` URL; the Ennuste view is the “projection” tab.

### 1.2 Page and child components

| File | Role |
|------|------|
| **`apps/web/src/pages/ProjectionPage.tsx`** | Main page: state, data loading, bootstrap, scenario CRUD, compute, all main sections (header, scenario selector, create modal, summary strip, controls, assumptions, driver planner, investments, results, table, diagram, revenue report). Single large component (~1460 lines). |
| **`apps/web/src/pages/projection/baselineBudget.ts`** | Helper: `selectBaselineBudget(budgets)` for bootstrap. No UI. |
| **`apps/web/src/components/ProjectionCharts.tsx`** | Charts: currently “Ackumulerad kassa” line chart + “Intäkter vs Kostnader” bar chart (Recharts). **Does not** show tariff €/m³ over years. |
| **`apps/web/src/components/DriverPlanner.tsx`** | Tuloajurit: unit price and volume per year / % from base. Used inside ProjectionPage. |
| **`apps/web/src/components/RevenueReport.tsx`** | Revenue breakdown (collapsible). Used in ProjectionPage. |
| **`apps/web/src/components/ScenarioComparison.tsx`** | Scenario comparison overlay. Used in ProjectionPage. |

### 1.3 Styling

| File | Role |
|------|------|
| **`apps/web/src/App.css`** | All projection-related classes: `.projection-page`, `.projection-controls`, `.projection-summary-strip`, `.projection-table`, `.projection-table-wrapper`, `.projection-charts-panel`, `.projection-diagram-wrapper`, `.scenario-selector`, `.verdict-card`, `.driver-planner-*`, `.financing-investments-*`, responsive rules, etc. (Many blocks between ~6398 and ~7612.) |

No separate CSS module for the projection page; everything is in `App.css`.

### 1.4 Key UI elements today

- **Header:** title, Compare, Export CSV/PDF.
- **Scenario selector:** tabs + delete; create-scenario modal (name, budget, horizon, drivers, investments).
- **Summary strip:** “Nödvändig taxa idag” (required tariff), “Valitse vuosi” dropdown, annual result / kassaflöde / ackumulerad kassa for selected year.
- **“Luo skenaario” CTA:** secondary section with button.
- **Controls card:** base budget (read-only), horizon select, Assumptions toggle, “Laske uudelleen” + last computed, dirty hint.
- **Collapsible assumptions panel:** table of org default vs override (inflaatio, energiakerroin, vesimaaran_muutos, hintakorotus, investointikerroin).
- **Driver planner card:** DriverPlanner component + reset/save.
- **Investments card:** year + amount rows, add, save.
- **Anchor nav:** Variables, Results, Revenue.
- **Results block:** verdict card (sustainable/tight/unsustainable), table/diagram tabs, big table (with optional depreciation columns), then ProjectionCharts, then collapsible revenue report.

### 1.5 Data and API types

- **`Projection`** (`apps/web/src/api.ts`): `id`, `talousarvioId`, `nimi`, `aikajaksoVuosia`, `olettamusYlikirjoitukset`, `ajuriPolut`, `userInvestments`, **`requiredTariff`** (€/m³), `onOletus`, `talousarvio`, **`vuodet`** (ProjectionYear[]).
- **`ProjectionYear`**: `vuosi`, `tulotYhteensa`, `kulutYhteensa`, `investoinnitYhteensa`, `poistoPerusta`, `poistoInvestoinneista`, `tulos`, `kumulatiivinenTulos`, `kassafloede`, `ackumuleradKassa`, **`vesihinta`**, **`myytyVesimaara`**.

Existing logic to keep: `getVerdict(years)`, `activeProjection.requiredTariff`, all computed `years` from `activeProjection.vuodet`, driver paths and investments persistence, compute/recompute flow.

### 1.6 i18n

- **Keys:** Under `projection.*` in `apps/web/src/i18n/locales/fi.json` (and en.json, sv.json). Include: `projection.title`, `projection.summary.requiredTariff`, `projection.summary.selectYear`, `projection.summary.deficitYears`, `projection.summary.of`, `projection.verdict.sustainable` / `tight` / `unsustainable`, column names, etc.
- **Spec wording:** Spec uses “Kestävä / Ei kestävä” (binary). Current keys have three verdicts; add or map to binary for the badge (e.g. sustainable → “Kestävä”, tight/unsustainable → “Ei kestävä”). Use existing i18n; add keys only where needed (e.g. `projection.verdict.notSustainable` or reuse `unsustainable` for “Ei kestävä”).

---

## 2. Proposed Layout Component Tree

Target structure (logical; not necessarily new files):

```
ProjectionPage
├── Page header (title, export/compare — keep)
├── Error banner
├── Scenario selector (tabs + delete) — keep
├── Create scenario modal — keep
├── TOP AREA (2-column, visible without scroll on ~1440p)
│   ├── LEFT: KPI + Antaganden column
│   │   ├── KPI panel (compact cards)
│   │   │   ├── KPI 1: Sustainability badge (Kestävä / Ei kestävä)
│   │   │   ├── KPI 2: Nödvändig taxa idag (€/m³) 2 decimals
│   │   │   ├── KPI 3: Kumulativt resultat (slutår) € whole
│   │   │   ├── KPI 4: Alijäämävuosia x / N
│   │   │   └── KPI 5: Valitse vuosi dropdown
│   │   └── Antaganden panel (compact)
│   │       ├── Volume (base from Talousarvio + annual volume change %)
│   │       ├── Kulut: annual increase %
│   │       ├── Perusmaksu annual % (only if in model — currently omit)
│   │       ├── Investoinnit list (year + amount)
│   │       └── Poistot method (only if multiple; else read-only)
│   └── RIGHT: Main chart
│       └── Primary: Tariff €/m³ over years (line, 2 decimals)
│       └── Optional: Tulos (€) over years (line or bars); if complex, keep only tariff line
├── Year inspector (below chart/top area)
│   └── Selected year: Tulot €, Kulut €, Poistot €, Investoinnit €, Tulos € (whole euros; minus if negative)
├── “Why does it look like this?” — Top 3 drivers summary (short)
│   ├── Volume trend (m³/yr)
│   ├── OPEX trend (Kulut %/yr)
│   └── CAPEX impact via Poistot (if applicable)
├── Collapsible “Näytä taulukko” (default CLOSED)
│   └── Table: Vuosi | Tulot (€) | Kulut (€) | Poistot (€) | Investoinnit (€) | Tulos (€) | Kumulatiivinen (€) | Vesihinta (€/m³) | Vesimäärä (m³)
├── (Optional) Revenue breakdown collapsible — keep as is
└── Rest: scenario CTA, controls (compute, horizon, etc.) — reposition as needed so hero = KPI + chart
```

- **Laske uudelleen:** Keep; place near Antaganden or in a compact controls row so it doesn’t dominate.
- **Driver planner (Tuloajuriden suunnittelu):** Keep **full** DriverPlanner (per-year + “% from year X” for both vesi/jätevesi on same screen). Only **compact layout** under Antaganden (e.g. collapsible subsection); do **not** simplify or remove controls to match “4–6 controls” at the cost of losing per-year or % editing.

---

## 3. Refactor Plan (Steps)

### Step 1: Formatting standardization

- **Add/use centralized helpers** (see Section 5). Ensure single place for: € whole, €/m³ 2 decimals, m³ integer.
- **Touch:** `apps/web/src/utils/format.ts` (add `formatEurInt`, `formatM3Int` if missing; keep `formatTariffEurPerM3`).
- **Replace** all inline `fmtEur` / `fmtDecimal` / tariff/volume formatting in ProjectionPage and ProjectionCharts with these helpers so spec rules apply everywhere.

### Step 2: Two-column hero layout (CSS + structure)

- **Introduce** a top “dashboard” section with two columns: left (KPI + Antaganden), right (chart). Use CSS Grid or Flex so that on ~1440p the whole top area fits above the fold; max-width ~1200–1400px centered.
- **Touch:** `ProjectionPage.tsx` (restructure JSX: move summary KPIs + year select into left column; add placeholder for chart on right). `App.css`: new classes e.g. `.projection-hero`, `.projection-hero__left`, `.projection-hero__right`, reduce margins/gaps to remove “giant blank space”.

### Step 3: KPI panel (left column)

- **Implement** compact KPI cards in left column:
  1. Sustainability badge: from `getVerdict(years)` → “Kestävä” (green) or “Ei kestävä” (red). Map sustainable → Kestävä; tight/unsustainable → Ei kestävä.
  2. Nödvändig taxa idag: `formatTariffEurPerM3(activeProjection.requiredTariff)` (already 2 decimals).
  3. Kumulativt resultat (slutår): last year’s `kumulatiivinenTulos` with `formatEurInt`.
  4. Alijäämävuosia x / N: `years.filter(y => num(y.tulos) < 0).length` / `years.length`.
  5. Valitse vuosi: existing dropdown; drives year inspector.
- **Touch:** `ProjectionPage.tsx`, `App.css` (KPI card styles). i18n: add key for “Ei kestävä” if not reusing `unsustainable`.

### Step 4: Primary chart — Tariff €/m³ over years

- **Add** a tariff chart **inside the existing diagram/result view** (or as hero right column): X = year, Y = vesihinta (€/m³), line, values 2 decimals. Do **not** replace the existing table/diagram sub-view; add this series to the current chart system so the same dataset drives table and diagram.
- **Touch:** `ProjectionCharts.tsx`: add “Vesihinta (€/m³)” line (and optionally “Tulos (€)” line/bars); use format helpers in tooltips. Reuse Recharts (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer).
- **Data:** `years.map(y => ({ vuosi: y.vuosi, vesihinta: num(y.vesihinta), tulos: num(y.tulos) }))`.

### Step 5: Antaganden panel (left column, compact)

- **Consolidate** inputs into one “Antaganden” panel in the left column:
  - Volume: base from Talousarvio (read-only or from driver base) + single “annual volume change %” (map to `vesimaaran_muutos` in overrides or driver).
  - Kulut: annual increase % (map to `energiakerroin` or a dedicated assumption if different; current assumptions: inflaatio, energiakerroin, vesimaaran_muutos, hintakorotus, investointikerroin — clarify which drives “Kulut” and use that).
  - Omit “Perusmaksu” unless present in model (not in current ASSUMPTION_KEYS).
  - Investoinnit: existing list editor (year + amount).
  - Poistot method: only if multiple methods exist; otherwise show read-only or omit.
- **Touch:** `ProjectionPage.tsx`: move/copy assumption overrides and investments into the left column; keep “Laske uudelleen” accessible (e.g. under Antaganden or in a slim bar). Keep **full** DriverPlanner in a compact or collapsible “Tuloajurit” subsection under Antaganden — same per-year and %-mode controls, no removal.

### Step 6: Year inspector

- **Replace** the current “giant always-on table” with a compact year inspector below the chart (or below top area): for `effectiveSelectedYear` show one row/block: Tulot €, Kulut €, Poistot €, Investoinnit €, Tulos € (whole euros; show minus for negative Tulos). Poistot = `num(poistoPerusta) + num(poistoInvestoinneista)`.
- **Touch:** `ProjectionPage.tsx`: new block that receives `years`, `effectiveSelectedYear` and renders the 5 values; remove or reduce reliance on table-for-one-year in the hero.

### Step 7: “Why does it look like this?” — Top drivers summary

- **Add** a short **read-only** text block: Top 3 drivers — (1) Volume trend (m³/yr), (2) OPEX trend (Kulut %/yr), (3) CAPEX impact via Poistot (if applicable). **Derive only from existing data** (e.g. volume from first/last year or driver paths; OPEX from assumption; CAPEX from investments + depreciation). No new backend or business logic.
- **Touch:** `ProjectionPage.tsx` (compute simple derived strings or small component). i18n: keys for “Top drivers” and short labels.
- **Scope guard:** If this narrative block risks scope creep (e.g. implied new assumption concepts), implement in a later phase after stakeholder sign-off; Phase A–C can ship without it.

### Step 8: Table as collapsible “Näytä taulukko”

- **Add** collapsible section “Näytä taulukko”; default state: collapsed.
- **Table columns (when expanded):** Vuosi | Tulot (€) | Kulut (€) | Poistot (€) | Investoinnit (€) | Tulos (€) | Kumulatiivinen (€) | Vesihinta (€/m³) | Vesimäärä (m³). Single “Poistot” column = `poistoPerusta + poistoInvestoinneista` per year.
- **Formatting:** All € whole, €/m³ 2 decimals, m³ integer (use formatting helpers).
- **Touch:** `ProjectionPage.tsx`: wrap current results table in a collapsible (button “Näytä taulukko” toggles open/closed); ensure table uses the spec columns and formatters; remove or relocate table from “hero” so it doesn’t dominate.

### Step 9: Remove giant whitespace and fix layout

- **Reduce** vertical gaps, card margins, and unnecessary full-width blocks so that KPI + chart is the hero; keep content width reasonable (max-width ~1200–1400px centered).
- **Touch:** `App.css`: adjust `.projection-page`, `.projection-controls`, `.projection-summary-strip`, margins on cards, and any legacy layout that pushes content down; ensure no single element forces excessive blank space.

### Step 10: Scenario CTA and controls placement

- **Keep** scenario selector, create modal, and “Luo skenaario” CTA; keep compute button and horizon/assumptions. Place them so they don’t occupy the hero (e.g. header + slim row, or below the 2-column area). Ensure “Laske uudelleen” is visible when user has changed assumptions.

### Step 11: i18n and accessibility

- **Add** any missing keys (e.g. “Kestävä”, “Ei kestävä” if not reusing, “Näytä taulukko”, “Antaganden”, “Top drivers” / driver labels). Keep existing `projection.*` keys; add only for new labels.
- **Preserve** aria-labels and roles where they exist; add for new KPI/chart/year inspector if needed.

### Step 12: Tests and cleanup

- **Update** `ProjectionPage.test.tsx` if structure or data-testids change (e.g. chart, collapsible table, KPI).
- **Remove** or refactor duplicate/legacy blocks (e.g. old summary strip layout if fully replaced by KPI panel).

---

## 3b. Recommended Execution Order (Phased)

Implement in this order to reduce risk and validate incrementally:

| Phase | Scope | Rationale |
|-------|--------|-----------|
| **A** | Formatting helpers + replacement; tests | Low risk; no layout change; establishes spec formatting everywhere. |
| **B** | Tariff series + optional Tulos in existing diagram; KPI/header compaction | Chart and data presentation inside current result view; no removal of table/diagram tabs. |
| **C** | Hero 2-column layout; whitespace cleanup; year inspector; Antaganden consolidation | Layout compaction; hero = KPI + chart; DriverPlanner remains full, layout compact only. |
| **D** | Collapsible “Näytä taulukko” (default closed); Top 3 drivers summary | Spec-locked but higher UX impact; do after A–C are stable. Optional: defer “Top 3 drivers” until stakeholder sign-off if scope creep is a concern. |

**Mapping steps to phases:** Step 1 → A. Steps 3, 4 → B (KPI + tariff chart inside/alongside existing result view). Steps 2, 5, 6, 9, 10 → C (hero layout, Antaganden, year inspector, whitespace, controls). Steps 7, 8 → D. Steps 11, 12 → spread across phases as needed.

---

## 4. Files to Touch (Summary)

| File | Changes |
|------|--------|
| **`apps/web/src/utils/format.ts`** | Add `formatEurInt` (€ whole), `formatM3Int` (m³ integer) if not present; document `formatTariffEurPerM3` as canonical for €/m³ 2 decimals. |
| **`apps/web/src/pages/ProjectionPage.tsx`** | Restructure layout: 2-column hero (KPI left, chart right), Antaganden in left column, year inspector below, top drivers summary, collapsible table with spec columns; use format helpers everywhere; sustainability badge; keep all existing logic (getVerdict, requiredTariff, compute, scenario, driver paths, investments). |
| **`apps/web/src/components/ProjectionCharts.tsx`** | Add primary chart: Tariff (vesihinta) €/m³ over years (line, 2 decimals); optionally Tulos (€) line/bars; use format helpers in tooltips. |
| **`apps/web/src/App.css`** | New classes for hero grid (`.projection-hero`, `.projection-hero__left`, `.projection-hero__right`), KPI cards, year inspector, collapsible table; reduce margins/gaps; max-width container; remove excessive whitespace. |
| **`apps/web/src/i18n/locales/fi.json`** (and en, sv) | Add keys: e.g. “Näytä taulukko”, “Antaganden” (if not already), “Ei kestävä” / sustainability badge, “Kumulativt resultat (slutår)”, “Alijäämävuosia”, top drivers section labels. |
| **`apps/web/src/pages/ProjectionPage.test.tsx`** | Adjust for new structure (KPI, chart, collapsible table); keep bootstrap and scenario tests; add or update selectors if needed. |

**Dependencies:** Recharts (already used in ProjectionCharts). No new libs. i18n: existing `useTranslation` and key structure.

---

## 5. Formatting Standardization Plan

### 5.1 Existing utilities (`apps/web/src/utils/format.ts`)

- **`formatCurrency(value)`** — EUR, 0 fraction digits (whole euros). Use for all € amounts in table and year inspector.
- **`formatTariffEurPerM3(value)`** — X.XX €/m³ or "—". Use for all €/m³ (tariff, vesihinta).
- **`formatDecimal(value)`** — 2 decimals, Finnish locale. Prefer `formatTariffEurPerM3` for tariff; use formatDecimal only if needed for other decimals.

### 5.2 Gaps and proposed helpers

- **Whole euros:** Either use existing `formatCurrency` everywhere (it already uses 0 fraction digits) or add `formatEurInt(n: number)` that formats and rounds to integer. **Recommendation:** Use `formatCurrency` for display; ensure no call site uses `toLocaleString(..., maximumFractionDigits: 2)` for € amounts.
- **m³ integer:** Add `formatM3Int(value: number | null | undefined): string` — round to integer, then locale string + " m³", or "—". Use in table “Vesimäärä” and anywhere volume is shown.
- **€/m³ 2 decimals:** Already `formatTariffEurPerM3`. Ensure table “Vesihinta” and chart tooltips use it (or same rule).

### 5.3 Places to apply rules on Ennuste page

| Location | Current | Rule |
|----------|---------|------|
| Required tariff (KPI 2) | `formatTariffEurPerM3` | Keep; 2 decimals. |
| Summary strip / year stats | `fmtEur` (local) | Replace with `formatCurrency` or `formatEurInt`. |
| Verdict card stats | `fmtEur` | Same. |
| Table: Tulot, Kulut, Investoinnit, Tulos, Kumulatiivinen | `fmtEur(num(...))` | Use `formatCurrency(round(...))` or centralized whole-euro helper. |
| Table: Poistot | Not as single column | Add column; value = poistoPerusta + poistoInvestoinneista; format as € whole. |
| Table: Vesihinta | `fmtDecimal(num(y.vesihinta)) + ' €/m³'` | Use `formatTariffEurPerM3(y.vesihinta)`. |
| Table: Vesimäärä | `Math.round(num(...)).toLocaleString('fi-FI') + ' m³'` | Use `formatM3Int(...)`. |
| Year inspector: all € | — | Whole euros; minus sign for negative Tulos. |
| Chart tooltips | `fmtEur` in ProjectionCharts | Use format helpers (€ whole for Tulos, 2 dec for tariff). |

---

## 6. Acceptance Criteria Checklist

- [ ] **A) “Are we sustainable?”** — Sustainability badge (Kestävä / Ei kestävä) visible in left column with correct color (green/red).
- [ ] **B) “What tariff is required?”** — “Nödvändig taxa idag (€/m³)” shown with 2 decimals in KPI panel.
- [ ] **C) “Why does it look like this?”** — Short top-3-drivers summary (volume trend, OPEX trend, CAPEX/Poistot impact) present and readable.
- [ ] **Layout:** Two-column top area (left: KPI + Antaganden; right: one main chart). Top area visible without scrolling on 1440p-ish desktop.
- [ ] **KPI 3:** “Kumulativt resultat (slutår)” in €, rounded to whole euros.
- [ ] **KPI 4:** “Alijäämävuosia x / N” with correct count.
- [ ] **KPI 5:** “Valitse vuosi” dropdown drives the year inspector below.
- [ ] **Chart:** Primary chart = Tariff €/m³ over years (line); values 2 decimals. Chart is the visual anchor of the page.
- [ ] **Year inspector:** For selected year, shows Tulot €, Kulut €, Poistot €, Investoinnit €, Tulos € (whole euros; minus sign if Tulos negative).
- [ ] **Table:** In collapsible “Näytä taulukko”; **default state: collapsed**.
- [ ] **Table columns:** Vuosi | Tulot (€) | Kulut (€) | Poistot (€) | Investoinnit (€) | Tulos (€) | Kumulatiivinen (€) | Vesihinta (€/m³) | Vesimäärä (m³).
- [ ] **Formatting (everywhere):** €/m³ → 2 decimals; € → whole euros; m³ → integer.
- [ ] **No giant blank spaces;** layout uses width properly; reasonable max-width ~1200–1400px centered.
- [ ] **Inputs** consolidated in “Antaganden” panel (left column); 4–6 controls, no scattered giant whitespace.
- [ ] **Talousarvio tab** remains history/import; Ennuste remains the decision/forecast view (no change to tab semantics).
- [ ] **Existing calculations/logic** preserved: `getVerdict`, `requiredTariff`, `vuodet`, compute, scenario create/edit, driver paths, investments.

---

## 7. Constraints (Recap)

- **Do not** invent new business logic; reuse existing computed data (tulos, kumulatiivinenTulos, tariff/vesihinta, volume).
- **Keep** language/i18n consistent; use existing i18n; don’t hardcode Swedish strings (use keys; spec labels can be implemented as fi/sv/en where applicable).
- **Do not implement** in this phase; this document is the plan only. Implementation to follow in a separate DO phase.

---

## 8. Codex Recommendations (Incorporated)

- **Alignment:** Plan keeps calculation/logic unchanged and adds formatting + test/i18n; KPI + chart improves decision visibility. Non-negotiables (Section above) lock DriverPlanner capability, table/diagram relationship, and compute/a11y.
- **Risks mitigated:** (1) DriverPlanner — no simplification; compact layout only. (2) Chart — add tariff to existing diagram system; do not replace table/diagram view. (3) Top 3 drivers — read-only, derived from existing data only; defer to Phase D if scope creep is a concern. (4) Default-collapsed table — spec-locked; Phase D; no conflict with “table first” if table/diagram tabs remain and table is still available behind “Näytä taulukko”.
- **Execution:** Phased order A → B → C → D (Section 3b) with low-risk formatting and chart first, then layout, then collapsible table and drivers summary.
