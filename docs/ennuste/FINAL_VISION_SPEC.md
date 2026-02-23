# Ennuste Final Vision V1 Spec

Authored: 2026-02-18
Status: ACTIVE — implementation guide for this sprint/task.

## Audit findings (current state)

### What works well

- Two-zone architecture (Syötä / Tulokset) in place.
- `ProjectionCharts` already has `mode="hero"` (320px tall, tariff line chart visible).
- `formatTariffEurPerM3` gives 2-decimal format correctly.
- `formatEurInt` gives whole-euro format correctly.
- KPI grid (`projection-kpi-grid--v1`) has 6 cards including the required ones.
- `requiredTariff` field on projection is available and already shown as primary KPI card.
- Explicit recompute model (Option A) already in use — correct.
- Accordion (Olettamukset, Investoinnit, Tuloajurit) in Syötä zone.
- Assumption overrides via `AssumptionInput` with blur-commit pattern.
- Baseline strip shows 3 history years.

### Bugs and gaps to fix

#### I18n leak (critical)

- `fi.json` projection.kpi.tariffYearPlusOne = **"Taxa år +1"** (Swedish).
- `fi.json` projection.kpi.selectedYearInvestments = **"Årets investoinnit"** (mixed).
- Fix: use correct Finnish strings.

#### KPI label alignment

- "Nödvändig taxa idag" is specified as the primary KPI label but fi.json uses "Tarvittava tariffi tänään" — this is correct Finnish, keep it. The spec used Swedish as an example; fi locale must be Finnish.
- KPI card for "Taxa år +1" must become "Tariffi vuosi +1" (Finnish).
- KPI card for "Årets investoinnit" must become "Valitun vuoden investoinnit" (Finnish).

#### Chart not dominant enough

- Chart is currently inside `.ennuste-tulokset-chart.card` which constrains width via card padding.
- CSS already has `.ennuste-tulokset-chart` but the chart container width is OK — the hero mode is 320px tall which is fine.
- Chart uses `ResponsiveContainer width="100%"` — this is correct; just need to ensure outer container spans full content width.

#### Control rail — key levers visibility

- 4 primary assumptions visible: vesimaaran_muutos, inflaatio, energiakerroin, hintakorotus.
- Labels: `futureVolumePct`, `personnelCostPct`, `otherOpexPct`, `priceIncrease`.
- Missing: `otherOpexPct` i18n key exists but maps to `energiakerroin` (energy factor), which finance users would call "other OPEX". This is acceptable semantics — keep as-is.

#### Full-width graph

- `.ennuste-main-layout` is already set up. CSS `ennuste-tulokset-chart` should not have `max-width` constraining it.
- Ensure the chart card does NOT use padding that squeezes the recharts container.

#### KPI strip — "Rahoitusgap / kassaflöde" label

- fi.json has `projection.summary.cashflow = "Kassavirta"` — this is correct Finnish, keep it.

## Layout spec (V1)

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR: Ennuste title + Export CSV | PDF | Compare buttons   │
├──────────────────────────────────────────────────────────────┤
│ SCENARIO ROW: [Skenaario pills] [Luo skenaario] [Poista]     │
├──────────────────────────────────────────────────────────────┤
│ BASELINE STRIP: Mitä tiedämme? | 3 history years             │
├─────────────────────────────────┬────────────────────────────┤
│ SYÖTÄ (left/top on mobile)      │ TULOKSET (right/main)      │
│                                 │                            │
│ Mini summary                    │ KPI strip (5 cards):       │
│ Primary assumptions (4 levers)  │  1. Req tariff today       │
│ Accordion:                      │  2. Tariff yr+1            │
│  - Lisäasetukset                │  3. Cumulative result      │
│  - Investoinnit                 │  4. Selected yr invest     │
│  - Tuloajurit                   │  5. Cashflow               │
│                                 │  [Year selector]           │
│ [Laske uudelleen]               │                            │
│                                 │ DOMINANT CHART (full w)    │
│                                 │  Tariff €/m³ over years    │
│                                 │                            │
│                                 │ Year inspector             │
│                                 │ Drivers summary (3 bullets)│
│                                 │ [Results table]            │
│                                 │ [Revenue breakdown]        │
└─────────────────────────────────┴────────────────────────────┘
```

## KPI formatting spec

| KPI                     | Key                                 | Format            | Finnish label               |
| ----------------------- | ----------------------------------- | ----------------- | --------------------------- |
| Required tariff today   | `requiredTariff`                    | 2 decimals + €/m³ | Tarvittava tariffi tänään   |
| Tariff year +1          | `vuodet[1].vesihinta`               | 2 decimals + €/m³ | Tariffi vuosi +1            |
| Cumulative result       | `vuodet[last].kumulatiivinenTulos`  | whole €           | Kumulatiivinen tulos        |
| Selected yr investments | `selectedYear.investoinnitYhteensa` | whole €           | Valitun vuoden investoinnit |
| Cashflow                | `selectedYear.kassafloede`          | whole €           | Kassavirta                  |

## Inputs that drive the graph (must be present and functional)

| Input                         | Assumption key      | Current location        | Status    |
| ----------------------------- | ------------------- | ----------------------- | --------- |
| Volume % change / year        | `vesimaaran_muutos` | Primary assumptions row | ✓ present |
| Personnel cost % / year       | `inflaatio`         | Primary assumptions row | ✓ present |
| Other OPEX % / year           | `energiakerroin`    | Primary assumptions row | ✓ present |
| Price increase % / year       | `hintakorotus`      | Primary assumptions row | ✓ present |
| Investments (year + amount)   | `userInvestments`   | Accordion: Investoinnit | ✓ present |
| Driver paths (price + volume) | `ajuriPolut`        | Accordion: Tuloajurit   | ✓ present |
| Baseline volume (history)     | `historyVolumes`    | History volume controls | ✓ present |

All inputs flow to `handleCompute` which calls `computeProjection()` or `computeForBudget()`. The explicit recompute model is correct.

## Acceptance criteria

1. `projection.kpi.tariffYearPlusOne` = Finnish string (no Swedish).
2. `projection.kpi.selectedYearInvestments` = Finnish string (no Swedish).
3. KPI strip shows: req. tariff, tariff +1, cumulative, selected-year investments, cashflow.
4. Chart is full content-area width in Tulokset zone (no narrow card squeeze).
5. All 4 primary assumption inputs are visible above fold in Syötä zone and correctly labeled in Finnish.
6. `pnpm --filter ./apps/web test` passes with at least one test verifying KPI/chart area renders with computed data.
7. Finnish locale displays only Finnish strings.

## Non-goals (this sprint)

- Backend formula changes.
- New scenario math beyond existing engine.
- Per-service advanced volume forecasting beyond current controls.
- Replacing export pipelines.
- "Auto-compute" mode (explicit recompute stays).
- Rebuilding ProjectionCharts with a new charting library.

## Implementation plan

### Step 1: Fix i18n leaks (fi.json)

- `projection.kpi.tariffYearPlusOne`: "Taxa år +1" → "Tariffi vuosi +1"
- `projection.kpi.selectedYearInvestments`: "Årets investoinnit" → "Valitun vuoden investoinnit"
- Commit: `fix(ennuste): localize KPI labels in fi.json`

### Step 2: Expand chart to full content width

- Remove `max-width` from `.ennuste-tulokset-chart` if any.
- Ensure chart card padding doesn't squeeze ResponsiveContainer.
- Bump chart height to 380px in hero mode for visual dominance.
- Commit: `feat(ennuste): full-width dominant tariff chart`

### Step 3: KPI label clarity

- Rename KPI card labels to match spec (already mostly correct after Step 1).
- Ensure primary KPI card (requiredTariff) is visually larger.
- Commit: `feat(ennuste): KPI strip label and layout polish`

### Step 4: Test coverage

- Add test: after mock computeProjection returns data, verify KPI text renders.
- Commit: `test(ennuste): KPI strip renders with computed data`
