# Adversarial Audit

Date: 2026-03-18  
Environment: local `http://localhost:5173` + `http://localhost:3000`  
Account: `admin@vesipolku.dev` / `admin123`

## Scope

Full live pass over:

1. login and legal gate
2. trial reset / "clean DB" behavior
3. VEETI connect and year import
4. building a 5-year planning baseline
5. manual year editing
6. `Ennuste` / Forecast scenario creation
7. `Investointiohjelma`
8. `Poistosaannot`
9. graph / KPI behavior
10. "required price today" / water-price sanity under future capex stress

## What I ran

1. Logged in through the web UI and accepted the legal gate.
2. Reset the tenant with `POST /trial/reset-data`.
3. Reconnected Kronoby (`0180030-9`) in the UI.
4. Imported 5 years into the workspace:
   - VEETI years `2022`, `2023`, `2024`
   - manual completion for `2025` and `2026`
5. Reviewed years into the planning baseline.
6. Created scenario `Adversarial 5Y baseline`.
7. Added future investments:
   - `2024`: 100k
   - `2025`: 150k
   - `2026`: 300k
   - `2027`: 50k
   - `2030`: 5,000k stress spike
8. Mapped `2024..2027` to depreciation classes and edited one class rule (`water_network_post_1999` useful life `25 -> 30`).
9. Recomputed and cross-checked the scenario via API.

## Findings

### [HIGH] Trial reset does not produce a truly clean workspace

**What happened**

- After `POST /trial/reset-data`, reconnecting Kronoby immediately surfaced `2024` as `MIXED` with `Statement PDF + workbook repair`, not a pure VEETI year.
- `GET /v2/import/years/2024/data` confirmed:
  - `sourceStatus: MIXED`
  - `hasManualOverrides: true`
  - financial dataset `source: manual`

**Why this matters**

- A "clean DB" run is contaminated by previous manual repair state.
- Fresh-user audit results are not trustworthy if old overrides survive reset.

**Likely cause**

- `apps/api/src/demo/demo-reset.service.ts` deletes budgets, assumptions, snapshots, links, benchmarks, invitations, and legal acceptances, but does not delete `veetiOverride` or `veetiYearPolicy`.
- Compare with `apps/api/src/v2/v2.service.ts` clear-import flow, which explicitly deletes `veetiOverride` and `veetiYearPolicy`.

### [HIGH] Saved depreciation mappings/rules do not affect computed investment depreciation

**What happened**

- I saved scenario depreciation rules and saved class allocations for `2024..2027`.
- API confirmed both persisted:
  - `GET /v2/forecast/scenarios/:id/depreciation-rules` returned scenario rules
  - `GET /v2/forecast/scenarios/:id/class-allocations` returned saved allocations
- But `GET /v2/forecast/scenarios/:id` still returned `investmentDepreciation: 0` for every year.
- `totalDepreciation` stayed baseline-only even after mapped investments were present.

**Why this matters**

- `Poistosaannot` currently looks editable, but the saved depreciation logic is not flowing into the actual scenario output.
- This undermines tariff pressure, expense truth, and any long-term planning based on depreciation.

**Likely cause**

- In `apps/api/src/projections/projections.service.ts`, the compute path rebuilds `assumptionMap` manually and does not inject scenario depreciation rules.
- The engine only applies class-based depreciation when `depreciationRules` are present; see `apps/api/src/projections/projection-engine.service.ts`.
- There is already a `buildAssumptionMap(..., depreciationRules)` helper in `projections.service.ts`, but the compute path shown in this audit does not use it.

### [HIGH] "Save and sync year" leaves Step 3 review cards stale

**What happened**

- In Step 3, I ran `Full manual override` on `2023` and changed:
  - `Materials and services: 0 -> 39,500`
  - `Year result: 126,320 -> 111,180`
- The API stored the patch correctly:
  - `GET /v2/import/years/2023/data` showed `effectiveRows[0].AineetJaPalvelut = 39500`
  - `effectiveRows[0].TilikaudenYliJaama = 111180`
- But after `Save and sync year`, the review card still rendered:
  - `Materials and services: VEETI did not provide this value`
  - `Result: 126,320 EUR`

**Why this matters**

- Operators can save a year successfully and still see old numbers on the approval surface.
- That is a direct trust failure in the most important review step.

**Likely cause**

- In `apps/web/src/v2/OverviewPageV2.tsx`, the `Save and sync year` path calls `runSync([currentYear])`.
- `runSync()` reloads overview state but does not refresh `yearDataCache`.
- The non-sync save path does fetch `getImportYearDataV2(currentYear)` and updates `yearDataCache`; the sync-save path does not.

### [MEDIUM] The primary "Required price today" KPI is misleading for capex-heavy scenarios

**What happened**

- With 600k of mapped investments, the headline KPI stayed:
  - `Required price today (annual result = 0): 1.09 EUR/m3`
- After adding an extra `5,000,000 EUR` investment in `2030`, the same primary KPI still stayed:
  - `1.09 EUR/m3`
- At the same time, the cumulative-cash metric changed materially:
  - `requiredPriceTodayCombinedCumulativeCash: 3.56`
  - `underfundingStartYear: 2030`
  - `peakGap: 3,859,590.53`

**Why this matters**

- The main card can look reassuring even when future capex creates a severe cash hole.
- A real operator can read the top-line number as "tariffs are fine" while the scenario is actually cash-negative.

**Assessment**

- This is mathematically explainable, not random:
  - the annual-result metric ignores capex
  - the cumulative-cash metric includes capex pressure
- But surfacing the annual-result metric as the primary funding number is misleading in practice.

**Likely cause**

- `apps/web/src/v2/EnnustePageV2.tsx` consistently prioritizes `requiredPriceTodayCombinedAnnualResult` over the cumulative-cash metric on the primary surfaces.
- `apps/api/src/v2/v2.service.ts` also defaults report-level `requiredPriceToday` to the annual-result value first.

### [MEDIUM] Investment group entry does not auto-map to depreciation defaults

**What happened**

- In `Investointiohjelma`, I entered group names like `network`, `plant`, and `meters`.
- `Poistosaannot` still opened with those years as `Unmapped`.
- I had to manually choose a `Poistosaanto` for each year.

**Why this matters**

- The UX suggests a connected flow from investment planning into depreciation, but the mapping is manual even when the typed categories are semantically obvious.

**Impact**

- More operator work
- higher risk of silent missing mappings
- report readiness blocked until each year is mapped

## Direct answers

### Can we add depreciation rules as defaults for the company somewhere?

Not in the currently active live flow.

- The active UI surface is scenario-scoped inside `Forecast`.
- `GET /v2/forecast/depreciation-rules` returned an empty list in this environment.
- Scenario-specific defaults appear when entering `Poistosaannot`, and those are what the current UX actually uses.

### Can we edit them per investment if we want?

Partly, but not truly per individual investment row.

- You can map each investment **year** to a saved depreciation class.
- You can edit the class rule itself inside the scenario.
- You cannot define a one-off depreciation rule per single investment row in the current UI flow.
- In practice it is: `year -> saved class`, not `investment row -> bespoke rule`.

### Does the graph work?

Mostly yes.

- No console errors.
- No failed application API requests during the audited flow.
- The cashflow / cumulative-cash graph responded to the 5,000,000 EUR `2030` stress investment.
- The tariff / price path graph stayed stable, which matches the stored tariff assumptions.

The problem is not that the graph is dead. The problem is that the most prominent tariff KPI does not tell the same financing story as cumulative-cash stress.

### Does the "water price today" number make sense after random future investments?

Only if you read the right one.

- The **annual-result** version stayed at `1.09 EUR/m3` even after the 5.6M investment plan.
- The **cumulative-cash** version moved to `3.56 EUR/m3` and correctly exposed underfunding from `2030`.

So:

- the number is not random
- but the primary number is the wrong one to emphasize for capex-heavy planning

## What worked

- login
- legal acceptance
- VEETI search and connect
- 5-year import path
- manual year completion for extra years
- scenario creation
- investment entry and persistence
- depreciation class allocation persistence
- cashflow/cumulative-cash stress response
- no browser console errors
- no failed non-static API requests

## Bottom line

The product is usable for a guided baseline-to-forecast pass, but it is not trustworthy enough yet for capex/depreciation-heavy decision-making.

The three biggest issues from this audit are:

1. reset is not actually clean
2. Step 3 review can show stale year values after sync-save
3. saved `Poistosaannot` do not currently flow into computed `investmentDepreciation`

The tariff story is also easy to misread because the main "Required price today" card stays on annual-result logic even when cumulative cash is collapsing.
