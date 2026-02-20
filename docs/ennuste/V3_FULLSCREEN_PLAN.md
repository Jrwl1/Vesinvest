# Ennuste V3 — Full-Screen Graph App + Data Pipeline Improvements

Date: 2026-02-20

## Context

User feedback on V2 (dark professional redesign):
- Ennuste page looks great but **wastes space on a 34" ultrawide** (content capped at 1320px)
- Should feel like a "full-screen graph app", not a page inside a wrapper
- Talousarvio page needs a **price input** alongside existing volume input for base years
- Excel import (Simulering KVA) data should be better utilized
- The core selling point: Finnish water utility execs can quickly try different investments
  and see how it affects their water price — **must be instant and visual**

## Source file: Simulering av kommande lönsamhet KVA.xlsx

The KVA Excel contains rich data we can extract:

| Sheet | Data available | Currently extracted? |
|-------|---------------|---------------------|
| KVA totalt | P&L subtotals 2022-2034, growth rates, price table (vatten 1.20€/m³, avlopp 2.50€/m³), investment/depreciation schedule, equity, network length | Subtotals: YES, Prices: YES (via previewKvaRevenueDrivers), Growth rates: NO, Network: NO, Equity: NO |
| Vatten KVA | Water-only P&L 2022-2034, volume row (m³) | Subtotals: YES, Volume: YES |
| Avlopp KVA | Sewage-only P&L 2022-2034 | Subtotals: YES |
| Blad1 | Itemized cost breakdown (el, reparation, etc.) 2023 actual vs budget | Account lines: YES |
| Boksluten | Historical labels (price/m³, pumped volume, svinn %, connections, pipe lengths) by year 2015-2024 — **but numeric cells are empty in this file** | NO — labels only, no data |
| Anslutningar | Connection counts 2015-2024 — **all zeros in this file** | Attempted but returns 0 |

**Key finding**: The KVA file's price table (row 54-56 of KVA totalt) has ex-VAT prices. These are already extracted by `previewKvaRevenueDrivers()` as `yksikkohinta`. The volume (myytyMaara) is extracted from Vatten KVA / Avlopp KVA sheet rows matching m³ patterns.

---

## Plan

### 1. Full-width Ennuste page (CSS only)

**Problem**: `.app-main` has `max-width: 1400px` and `.projection-page` has `max-width: 1320px`. On a 34" screen (3440px) most of the screen is empty.

**Solution**: Override width constraints for `.ev2-page` only (no other pages affected):

```css
/* When ev2-page is active, break out of app-main constraints */
.ev2-page {
  max-width: none;           /* was: 1320px from .projection-page */
  margin: 0;                 /* was: 0 auto (centering) */
  padding: 0;                /* remove wrapper padding */
}

/* Also override the parent .app-main constraint for this page */
.app-main:has(.ev2-page) {
  max-width: none;
  padding: 0;
}
```

**Chart section**: grows to fill available width. On 34" the combo chart gets ~3400px wide — great for visualizing 20+ year projections with clear year separation.

**Body grid**: year cards stay 220px, inputs panel stays max ~480px, chart/KPI strip fill remaining space.

**No breakpoints broken**: existing responsive CSS at 900px and 600px still applies for smaller screens.

**Files changed**: `apps/web/src/App.css` only (2-3 rules)

---

### 2. Add price input to Talousarvio base years

**Problem**: Budget page shows volume (m³/year) per budget in the set view, but does NOT show what price was used that year. Users need to see and edit the price used in each base year.

**Current state**:
- `Tuloajuri.yksikkohinta` exists on each budget's revenue driver
- `RevenueDriversPanel` can edit it for single-budget view
- In **set view** (3-year cards), only volume is shown — no price

**Solution**: In BudgetPage set view, add a compact price display row next to each year's volume:

For each budget in the 3-year set:
1. Show **Vesihinta** (water price, €/m³) — read from `tuloajurit[0].yksikkohinta` for vesi service
2. Show **Jätevesihinta** (sewage price, €/m³) — from jatevesi tuloajuri
3. Make it editable (same optimistic blur-save pattern as volume)
4. If imported from Excel, show source badge ("KVA")

**Where in BudgetPage**: Inside the year-card section, below the existing volume row. A compact 2-column layout:
```
2023 (KVA)
├─ Vesimäärä:     [125 000] m³/v
├─ Vesihinta:     [0,97] €/m³
└─ Jätevesihinta: [2,02] €/m³
```

**Files changed**:
- `apps/web/src/pages/BudgetPage.tsx` — add price rows in set view
- `apps/web/src/i18n/locales/fi.json` — add `budget.waterPrice`, `budget.wastewaterPrice` keys
- `apps/web/src/App.css` — minor styling for price rows

**No backend changes**: price already stored on Tuloajuri, just not displayed in set view.

---

### 3. Ennuste UX betterments

These are improvements to make the app feel more like the "2-minute forecasting tool" it aims to be:

#### 3a. Chart height: 460px → responsive
Current chart is fixed 460px. On a 34" screen with full-width layout, this is too short relative to the wide width.

**Solution**: Use `max(460px, 40vh)` so on tall screens the chart grows proportionally. Cap at 600px to avoid absurdity.

#### 3b. KPI strip: add "Tariffikorotus %" card
Users care deeply about what % price increase they need. Currently not shown in KPI strip.

**Calculation**: `((requiredTariff / currentTariff) - 1) * 100` = "Tarvittava korotus".

**Implementation**: Add 6th KPI card after kassavirta. Positive = need increase (red), zero or negative = no increase needed (green).

#### 3c. Investment quick-add from chart
When clicking a year bar in the combo chart, scroll the investment section into view and pre-fill the year dropdown. Makes the "try different investments" workflow faster.

#### 3d. Compute auto-trigger on investment save
Currently you must click "Laske uudelleen" after saving investments. Since the whole point is quickly seeing how investments affect price, **auto-compute after investment save** removes a click.

**Guard**: Only auto-compute if already has computed data (not first compute). Show a brief "Lasketaan..." indicator.

#### 3e. Year card: show vesihinta per year
Currently year cards show tulot/kulut/inv/kassavirta. Add the most important number: **vesihinta (€/m³)** at the top of each card. This is the number users care about most.

---

### 4. Implementation order

| Step | What | Files | Risk |
|------|------|-------|------|
| 1 | Full-width CSS | App.css | None — CSS only, no DOM changes |
| 2 | Chart responsive height | EnnusteComboChart.tsx, App.css | Low |
| 3 | KPI: add tariffikorotus card | ProjectionPage.tsx, fi.json | Low |
| 4 | Year cards: add vesihinta | ProjectionPage.tsx | Low |
| 5 | Price input in Talousarvio set view | BudgetPage.tsx, fi.json, App.css | Medium — needs careful driver save |
| 6 | Auto-compute on investment save | ProjectionPage.tsx | Low — add one line |
| 7 | Investment quick-add from chart | ProjectionPage.tsx | Low |
| 8 | Run tests + fix | ProjectionPage.test.tsx | Required |

---

### 5. Non-goals (this round)

- **No backend changes** — all data fields already exist
- **No new Excel extraction** — KVA already extracts prices and volumes; the Boksluten sheet has no numeric data in the actual file
- **No Talousarvio page redesign** — just adding price display to set view
- **No new import formats** — only "Simulering av kommande lönsamhet KVA" is used
- **No changes to projection engine** — compute logic stays identical
- **No new components** — reuse existing patterns (AmountInput, EnnusteComboChart, etc.)

---

### 6. Acceptance criteria

1. On 34" (3440px) screen, Ennuste page fills full width — no empty margins
2. Chart is wider, more impactful — feels like a "graph app"
3. Talousarvio set view shows vesi/jätevesi price per year, editable
4. KPI strip shows tariffikorotus %
5. Year cards show vesihinta per year
6. Saving investments auto-triggers recompute
7. All existing tests pass (39/39)
8. No OPEX/CAPEX/English jargon in Finnish UI
