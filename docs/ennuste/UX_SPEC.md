# Ennuste V1 UX Spec (finance/Excel lens)

## 1) Information architecture

Page order (top -> bottom):

1. Scenario row (choose/create/delete scenario)
2. Known baseline strip (`Mitä tiedämme?`) from 3 imported history years
3. KPI strip (compact, 5 cards)
4. Main work area (2-column desktop, stacked mobile)
   - Left rail: controls (`Mitä oletamme?`) + `Laske uudelleen`
   - Right/content: dominant full-width chart + result table/revenue detail

Layout rules:

- Use full available width.
- Chart is visually dominant.
- Control rail remains compact and always visible above fold.
- Advanced controls are behind `Lisäasetukset` accordion.

## 2) Baseline vs assumptions separation

`Mitä tiedämme?` (baseline)

- 3 historical imported years (same KVA set as active budget when available).
- Per year show: Tulot, Kulut, Tulos, Myyty vesimäärä (m3/v).
- Historical sold volume is manually editable per year in Talousarvio and shown readably in Ennuste baseline strip.

`Mitä oletamme?` (forward assumptions)

- Inputs affect projection years from base year onward.
- Primary controls always visible; secondary controls in `Lisäasetukset`.
- Recompute model is explicit (Option A): user edits -> click `Laske uudelleen`.

## 3) KPI strip (format-locked)

Formatting standard:

- `€/m` (and `€/m3`) -> exactly 2 decimals.
- `€` -> whole euros (rounded integer display).

KPI cards in V1:

1. `Nödvändig taxa idag (€/m)` -> from `requiredTariff`.
2. `Taxa år +1 (€/m)` -> projected tariff for next year.
3. `Kumulativt resultat (€)` -> latest cumulative result.
4. `Årets investoinnit (€)` -> selected-year investments.
5. `Rahoitusgap / Kassaflöde (€)` -> selected-year cashflow; if funding gap available, show it, else cashflow.

## 4) Inputs that must move the graph

Always visible (control rail):

- Future volume annual change `%` (global default).
- Volume baseline (m3/v) for historical years (shown; base-year value is editable in Ennuste rail and mapped to projection driver volume path).
- Personnel cost annual `%` (mapped to existing engine cost-growth key currently used in model).
- Other OPEX / cost inflation annual `%` (using existing supported assumption key(s)).
- Investments editor (year + amount).
- `Laske uudelleen` primary action + clear status/hints for save-before-recompute cases.

Advanced (`Lisäasetukset`):

- Remaining existing assumption overrides and secondary driver controls (`DriverPlanner`).
- Horizon and less-used parameters.

## 5) Sold volume capture and storage

Talousarvio (history):

- Add manual sold volume input per imported year card.
- Persist to DB through existing revenue-driver endpoints (create/update drivers for that year's budget).
- If user is editing before save completes, keep local draft value in UI until persisted.

Ennuste (future):

- Add simple annual `%` volume change assumption (existing key) prominently in rail.
- Base-year volume adjustment updates projection driver paths and affects chart after recompute.

## 6) Interaction model decision

Chosen: **Option A (explicit recompute)**.

Reason:

- Existing compute flow already has explicit persistence boundaries (driver paths, investments, overrides).
- Avoids blur/debounce race risks and keeps the finance-user mental model deterministic.
- Easier to communicate: edit assumptions -> save driver/investment if needed -> `Laske uudelleen`.

## 7) Acceptance criteria (V1)

1. Projection page shows clear `known baseline` vs `assumptions` separation.
2. Chart is dominant and uses full width on desktop.
3. KPI strip displays 5 key metrics with locked formatting.
4. Talousarvio set view has editable sold volume per imported year and persists.
5. Future volume assumption visibly affects projected volume/tariff after recompute.
6. Finnish UI has no Swedish string leaks (e.g. language labels).
7. `pnpm --filter ./apps/web test` passes.

## 8) Non-goals (postponed)

- Rebuilding projection backend formulas.
- New scenario math model beyond existing assumption/driver path engine.
- Per-service advanced volume forecasting UX beyond current V1 controls.
- Replacing existing export pipelines.
