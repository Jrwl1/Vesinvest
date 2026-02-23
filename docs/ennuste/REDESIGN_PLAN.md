# Ennuste Redesign Plan — V2

Date: 2026-02-18

## Vision

One-page, dark-professional, decision-grade forecasting dashboard for a Finnish water utility.
The dominant element is an **interactive combo chart** (tariff line + cashflow bar + investments markers)
that fills the screen. All editable inputs live close to the data they affect.

Zero consulting jargon. No OPEX, CAPEX, or English abbreviations.
Finnish water utility terms only: tulot, kulut, käyttömenot, investoinnit, poistot, kassavirta, tariffi.

---

## Theme & Visual Design

**Color palette (dark professional):**

- Background: `#0f1117` (near-black, slightly warm)
- Surface: `#181d27` (dark card bg)
- Surface 2: `#1e2535` (slightly lighter for hover/active)
- Border: `#2a3347` (subtle dark border)
- Text primary: `#e8eaf0` (off-white)
- Text muted: `#7b8aaa` (slate muted)
- Accent: `#3b82f6` (blue — trustworthy, decision-grade)
- Accent soft: `#1e3a5f` (blue tinted bg)
- Green (positive/surplus): `#22c55e`
- Red (deficit): `#ef4444`
- Amber (warning/investment): `#f59e0b`
- Tariff line color: `#60a5fa` (bright blue)
- Cashflow bar positive: `#22c55e`
- Cashflow bar negative: `#ef4444`
- Investment marker: `#f59e0b`

**Typography:**

- Page heading: 1.75rem, weight 700, tracking -0.02em
- KPI value: 2rem, weight 800, tabular nums
- Body: 0.875rem
- Muted label: 0.75rem, weight 500, uppercase tracking

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: [Ennuste] [scenario pills] [Luo skenaario] [Laske uudelleen]     │
│          Pohjabudjetti: Budget 2025  Aikajänne: 20v                      │
├──────────────────────────────────────────────────────────────────────────┤
│ KPI STRIP (dark cards, 5 items):                                         │
│  Tarvittava tariffi  │  Tariffi +1v  │  Kum. tulos  │  Investoinnit     │
│  1.42 €/m³           │  1.49 €/m³    │  +128 000 €  │  450 000 €       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  COMBO CHART (full width, ~500px tall):                                  │
│  - Line: vesihinta (€/m³) over years  ← primary y-axis, left           │
│  - Bar (stacked): tulot vs kulut+investoinnit ← secondary y-axis, right │
│  - Interactive tooltip on hover with year inspector data                 │
│  - Click a year bar to "select" that year (highlights inputs below)      │
│                                                                          │
├──────────┬───────────────────────────────────────────────────────────────┤
│ VUODET   │  OLETTAMUKSET                                                 │
│ PANEL    │  ┌─────────────────────────────────────────────────────────┐  │
│ (left,   │  │ Vesimäärä muutos % / vuosi: [ 2,0% ▲▼]                │  │
│ 240px)   │  │ Käyttömenojen kasvu % / vuosi: [ 2,5% ▲▼]             │  │
│          │  │ Henkilöstökulujen kasvu % / vuosi: [ 3,0% ▲▼]         │  │
│ Year     │  │ Hinnan korotus % / vuosi: [ 3,0% ▲▼]                  │  │
│ cards:   │  │ Investointien kasvu % / vuosi: [ 2,0% ▲▼]             │  │
│          │  └─────────────────────────────────────────────────────────┘  │
│ [2025]   │                                                                │
│ Tulot    │  VESIMÄÄRÄ (myyntihistoria + ennuste)                         │
│ Kulut    │  ┌─────────────────────────────────────────────────────────┐  │
│ Inv.     │  │ Vuosi  │ m³/vuosi  │                                   │  │
│ Kassav.  │  │ 2023 * │ [125 000] │ (historiatiedot, muokattavissa)   │  │
│          │  │ 2024 * │ [128 000] │                                   │  │
│ [2026]   │  │ 2025 * │ [131 000] │ ← perusvuosi                     │  │
│ ...      │  │ 2026   │ [133 620] │ (laskettu +2%)                    │  │
│          │  │ 2027   │ [136 292] │ (laskettu +2%)                    │  │
│ [2044]   │  │ 2028   │ [139 018] │ (laskettu +2%)                    │  │
│          │  │ 2029+  │ olettamus │                                   │  │
│          │  └─────────────────────────────────────────────────────────┘  │
│          │                                                                │
│          │  INVESTOINNIT                                                  │
│          │  ┌─────────────────────────────────────────────────────────┐  │
│          │  │ [2036] [450 000 €] [x]                                  │  │
│          │  │ [2041] [820 000 €] [x]                                  │  │
│          │  │ [+ Lisää investointi]                                   │  │
│          │  └─────────────────────────────────────────────────────────┘  │
│          │                                                                │
│          │  VESIHINTA JA MYYNTI (tuloajurit) [v: avaa DriverPlanner]    │
│          └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Year cards** (left panel, scrollable): each year is a compact card showing:

- Year number + "base" badge for baseline year
- Tulot / Kulut / Investoinnit / Kassavirta
- Deficit years highlighted in red

**Clicking a year card** highlights that column in the chart.

---

## Volume Capture Rules

| Vuodet              | Input method               | Notes                                        |
| ------------------- | -------------------------- | -------------------------------------------- |
| Historia (3 vuotta) | Manual text input          | Shown in baseline strip; maps to DriverPaths |
| Vuosi +1, +2, +3    | Manual text input required | Realistic known horizon                      |
| Vuosi +4...+n       | % olettamus                | Auto-calculated from last manual year        |

This is new — currently ALL future years use just a % assumption. The redesign makes the
first 3 projection years explicitly editable (manual override in DriverPaths / myytyMaara).

---

## Finnish Terminology (no OPEX/CAPEX)

| Old (wrong)       | New (correct)                 |
| ----------------- | ----------------------------- |
| OPEX              | Käyttömenot                   |
| CAPEX             | Investoinnit                  |
| Cashflow          | Kassavirta                    |
| Net result        | Tulos                         |
| Cumulative        | Kumulatiivinen tulos          |
| Revenue           | Tulot                         |
| Expenses          | Käyttömenot (= käyttökulut)   |
| Personnel costs   | Henkilöstökulut               |
| Energy factor     | Energiakustannusten kasvu     |
| Inflation         | Käyttömenojen yleinen kasvu   |
| Volume change     | Vesimäärän muutos             |
| Price increase    | Tariffikorotus                |
| Investment factor | Investointikustannusten kasvu |

---

## Implementation Plan

### Step 1: Plan file + i18n cleanup

- Write this file ✓
- Rename/add i18n keys to remove OPEX/CAPEX references
- Add: käyttömenot, käyttömenojenkasvu, tariffikorotus, vesimaaranmuutos, etc.

### Step 2: New CSS theme (dark professional)

- Add `.ennuste-v2` root class with dark design tokens
- KPI strip, chart container, input panels, year cards

### Step 3: New chart component (EnnusteComboChart)

- Recharts ComposedChart:
  - Bar: tulot (green bars)
  - Bar stacked: kulut (red bars)
  - Bar stacked: investoinnit (amber bars) ← on same axis as costs
  - Line: vesihinta (blue line, right Y-axis)
  - ReferenceLine at 0 for cashflow threshold
  - Click handler to select year

### Step 4: Volume panel (VesimaaraPanel)

- Historia rows: editable, save on blur → updates DriverPaths
- Projection rows +1/+2/+3: editable manual inputs
- Projection rows +4+: shows calculated value from % olettamus
- "Muutos %" spinner at bottom controls the % for years beyond +3

### Step 5: Redesign ProjectionPage

- Dark theme root
- Topbar with scenario pills inline
- KPI strip
- Combo chart (full width)
- Below chart: 2-column grid
  - Left: year cards (scrollable, 240px)
  - Right: input panels (olettamukset, vesimäärä, investoinnit, [advanced: tuloajurit])

### Step 6: Tests

- Update existing tests to match new DOM structure
- Add: chart renders with data, year card selection, volume input updates driverPaths

---

## Acceptance Criteria

1. No OPEX, CAPEX, or English business jargon in Finnish locale
2. Dark professional theme renders correctly
3. Combo chart shows tariff line + revenue/cost bars + investment markers
4. First 3 projection years have manual volume inputs
5. History years (3) have editable volume inputs
6. Investment table works (add/remove/edit year+amount)
7. All 4 assumption sliders affect compute after Laske uudelleen
8. pnpm --filter ./apps/web test passes

---

## Non-goals

- Backend changes
- Scenario comparison (keep existing ScenarioComparison component, just hidden in advanced)
- Revenue breakdown (keep RevenueReport, accessible via export)
- Per-service (vesi/jätevesi split) in main UI (keep DriverPlanner in advanced accordion)
