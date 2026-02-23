# Plan20 v2.0 — VEETI API Pivot Plan

**Date:** 2026-02-23
**Author:** John + Claude
**Status:** APPROVED

---

## 1. Executive Summary

Plan20 v1 relies on Excel (KVA template) imports as the primary data source for water utility budgets and projections. v2.0 pivots to the **VEETI OData API** (`veetirajapinta.ymparisto.fi`) as the single source of truth, eliminating Excel imports entirely.

This unlocks three major capabilities:

1. **Zero-friction onboarding** — search your utility by name, click connect, data appears
2. **Full historical depth** — all available years of tariffs, volumes, financials, investments
3. **Benchmarking** — compare your utility against every other Finnish water utility in VEETI

The pivot also includes a full legacy cleanup (asset management code removal) and a new dashboard-first UX.

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data source | VEETI API only (kill Excel) | Simpler codebase, consistent data quality, no file format issues |
| Onboarding | Search by name or Y-tunnus | Finnish CFOs know their Y-tunnus; name search is friendlier |
| Import frequency | One-time per year, manual refresh | VEETI data updates annually; no need for background sync |
| Historical depth | All available years | Maximum trend analysis for projections |
| Budget generation | Auto-generate from VEETI Tilinpaatos P&L fields, fully editable | Fastest path to projection; user retains full control |
| Benchmarking | Core feature in v2.0 | Key differentiator; trivial with VEETI access to all orgs |
| Legacy code | Full cleanup | Clean slate; no dead code maintenance burden |

---

## 3. VEETI API Mapping

### 3.1 Endpoints We Need

> **Source:** OData metadata from `https://veetirajapinta.ymparisto.fi/v1/odata/$metadata`

| VEETI Entity | OData Path | Maps To (Plan20 Model) | Purpose |
|---|---|---|---|
| **VesihuoltoOrganisaatio** | `/VesihuoltoOrganisaatio` | `VeetiOrganisaatio` (new) | Org lookup, search, basic info |
| **TaksaKayttomaksu** | `/TaksaKayttomaksu` | `Tuloajuri.yksikkohinta` | Usage tariffs (€/m³) per year |
| **LaskutettuTalousvesi** | `/LaskutettuTalousvesi` | `Tuloajuri.myytyMaara` (vesi) | Billed drinking water volume (m³) |
| **LaskutettuJatevesi** | `/LaskutettuJatevesi` | `Tuloajuri.myytyMaara` (jatevesi) | Billed wastewater volume (m³) |
| **Tilinpaatos** | `/Tilinpaatos` | `Talousarvio` + `TalousarvioValisumma` | P&L data — **this IS the income statement** |
| **Investointi** | `/Investointi` | `Ennuste.userInvestments` baseline | Historical investment amounts |
| **EnergianKaytto** | `/EnergianKaytto` | `Olettamus` (energy cost factor) | Energy consumption data |
| **Verkko** | `/Verkko` | Benchmarking: network length | Pipe network km (infra size indicator) |

**Important correction:** There is no separate `Tuloslaskelma` or `Tase` entity in VEETI. The income statement fields are embedded directly in the `Tilinpaatos` entity. There is no balance sheet data available.

### 3.2 Mapping Dictionary: VEETI Tilinpaatos → TalousarvioValisumma

The `Tilinpaatos` entity contains P&L fields as flat integer columns (EUR). Each maps to a `TalousarvioValisumma` record via a hardcoded dictionary in `veeti-budget-generator.ts`.

```typescript
/**
 * VEETI Tilinpaatos field → TalousarvioValisumma mapping.
 * Source: OData $metadata (verified 2026-02-23).
 *
 * All VEETI amounts are Edm.Int32 (whole EUR).
 * Palvelutyyppi is 'muu' for all Tilinpaatos fields since VEETI
 * does not split P&L by water/wastewater at the financial level.
 */
const TILINPAATOS_MAPPING: Record<string, {
  categoryKey: string;
  tyyppi: ValisummaTyyppi;
  label_fi: string;
}> = {
  // ── Revenue ──
  Liikevaihto: {
    categoryKey: 'liikevaihto',
    tyyppi: 'tulo',
    label_fi: 'Liikevaihto',
  },

  // ── Expenses ──
  Henkilostokulut: {
    categoryKey: 'henkilostokulut',
    tyyppi: 'kulu',
    label_fi: 'Henkilöstökulut',
  },
  LiiketoiminnanMuutKulut: {
    categoryKey: 'liiketoiminnan_muut_kulut',
    tyyppi: 'kulu',
    label_fi: 'Liiketoiminnan muut kulut',
  },

  // ── Depreciation ──
  Poistot: {
    categoryKey: 'poistot',
    tyyppi: 'poisto',
    label_fi: 'Poistot',
  },
  Arvonalentumiset: {
    categoryKey: 'arvonalentumiset',
    tyyppi: 'poisto',
    label_fi: 'Arvonalentumiset',
  },

  // ── Financial items (combined field in VEETI) ──
  RahoitustuototJaKulut: {
    categoryKey: 'rahoitustuotot_ja_kulut',
    tyyppi: 'rahoitus_tulo',  // Note: positive = income, negative = cost
    label_fi: 'Rahoitustuotot ja -kulut',
  },

  // ── Result ──
  TilikaudenYliJaama: {
    categoryKey: 'tilikauden_tulos',
    tyyppi: 'tulos',
    label_fi: 'Tilikauden ylijäämä/alijäämä',
  },

  // ── Owner transactions (context, not P&L core) ──
  Omistajatuloutus: {
    categoryKey: 'omistajatuloutus',
    tyyppi: 'kulu',
    label_fi: 'Omistajatuloutus',
  },
  OmistajanTukiKayttokustannuksiin: {
    categoryKey: 'omistajan_tuki',
    tyyppi: 'tulo',
    label_fi: 'Omistajan tuki käyttökustannuksiin',
  },
};
```

**Key observations from the real metadata:**

1. **No separate Tuloslaskelma entity** — the P&L fields are columns on `Tilinpaatos`.
2. **All amounts are `Edm.Int32`** (whole euros, no decimals).
3. **`RahoitustuototJaKulut` is a single combined field** — positive means net financial income, negative means net financial cost. The mapping uses `rahoitus_tulo` as tyyppi, but the budget generator must check the sign and flip to `rahoitus_kulu` if negative.
4. **No water/wastewater split in P&L** — all Tilinpaatos fields are org-level totals. The `palvelutyyppi` for all Valisumma records from Tilinpaatos should be `'muu'`. Water/wastewater split only exists in tariffs (TaksaKayttomaksu) and volumes (LaskutettuTalousvesi/Jatevesi).
5. **`Henkilostomaara`** (headcount) is metadata, not a P&L amount — useful for benchmarking but not for budget generation.

### 3.3 Mapping: VEETI Investointi → Investment Baseline

VEETI `Investointi` records provide historical investment amounts per year, split by `Laji_Id` (investment type, via navigation to `InvestointiLaji`).

**Fields used:**

| VEETI Field | Type | Maps To |
|---|---|---|
| `InvestoinninMaara` | Int32 (EUR) | New investment amount |
| `KorvausInvestoinninMaara` | Int32 (EUR) | Replacement/renewal investment amount |
| `InvestointikustannusOmistajanTuki` | Int32 (EUR) | Owner-funded portion (context) |
| `InvestointikustannusMuuTuki` | Int32 (EUR) | Other subsidies (context) |
| `Laji_Id` | Int32 | Investment category (navigate to `InvestointiLaji` for label) |

**Budget generator logic:** Sum `InvestoinninMaara + KorvausInvestoinninMaara` per year as the total investment baseline for the Ennuste projection engine.

---

## 4. Data Model Changes

### 4.1 New Models

```prisma
// VEETI organization link — connects Plan20 org to VEETI registry
model VeetiOrganisaatio {
  id              String       @id @default(uuid())
  orgId           String       @unique
  org             Organization @relation(fields: [orgId], references: [id])
  veetiId         Int          // VEETI org ID (e.g. 1535)
  nimi             String?      // Name from VEETI
  ytunnus          String?      // Y-tunnus from VEETI
  kunta            String?      // Municipality
  linkedAt         DateTime     @default(now())
  lastFetchedAt    DateTime?    @map("last_fetched_at")
  fetchStatus      String?      @map("fetch_status") // 'success' | 'partial' | 'failed'

  @@map("veeti_organisaatio")
}

// VEETI data snapshot — raw cached data per fetch
model VeetiSnapshot {
  id              String       @id @default(uuid())
  orgId           String
  org             Organization @relation(fields: [orgId], references: [id])
  veetiId         Int
  vuosi           Int          // Year
  dataType        String       @map("data_type") // 'tuloslaskelma' | 'tase' | 'taksa' | 'volume_vesi' | 'volume_jatevesi' | 'investointi' | 'energia'
  rawData         Json         @map("raw_data") // Full VEETI response for this entity+year
  fetchedAt       DateTime     @default(now())

  @@unique([orgId, veetiId, vuosi, dataType])
  @@index([orgId, vuosi])
  @@map("veeti_snapshot")
}

// Benchmarking: cached aggregate stats for peer comparison
model VeetiBenchmark {
  id              String       @id @default(uuid())
  vuosi           Int
  metricKey       String       @map("metric_key") // e.g. 'vesi_yksikkohinta', 'jatevesi_volume', 'liikevaihto'
  kokoluokka      String       @map("kokoluokka") // Size class: 'pieni' | 'keski' | 'suuri'
  orgCount        Int          @map("org_count")
  avgValue        Decimal      @map("avg_value")
  medianValue     Decimal?     @map("median_value")
  p25Value        Decimal?     @map("p25_value")
  p75Value        Decimal?     @map("p75_value")
  minValue        Decimal?     @map("min_value")
  maxValue        Decimal?     @map("max_value")
  computedAt      DateTime     @default(now())

  @@unique([vuosi, metricKey, kokoluokka])
  @@index([vuosi, metricKey])
  @@map("veeti_benchmark")
}
```

### 4.2 Modified Models

**Organization** — add relation:
```prisma
veetiLink       VeetiOrganisaatio?
veetiSnapshots  VeetiSnapshot[]
```

**Talousarvio** — modify source fields:
```prisma
// Replace Excel-specific fields:
// importBatchId      → remove (Excel-era)
// importSourceFileName → remove (Excel-era)
// importedAt         → keep, rename to veetiImportedAt
lahde             String?  @map("lahde")  // 'veeti' | 'manual'
veetiVuosi        Int?     @map("veeti_vuosi") // VEETI fiscal year this was generated from
```

### 4.3 Models to Remove (Legacy Cleanup)

Delete entirely from schema + all related API code, controllers, and frontend pages:

- `Site`, `Asset`, `AssetType`, `MaintenanceItem` (asset management)
- `PlanningScenario` (replaced by Ennuste)
- `ExcelImport`, `ExcelSheet`, `ImportedRecord` (Excel import tracking)
- `ImportMapping`, `MappingColumn` (column mapping)
- All legacy enums: `AssetStatus`, `Criticality`, `MaintenanceKind`, `RenewalStrategy`, `ImportStatus`, `TargetEntity`, `FieldCriticality`, `ImportAction`

### 4.4 Migration Strategy

1. Create new models + fields with a Prisma migration
2. Run data migration script: for existing orgs that have Excel-imported budgets, mark them as `lahde: 'manual'`
3. Drop legacy tables in a separate migration after verification
4. Remove `exceljs` dependency from `apps/api/package.json`

---

## 5. Backend Architecture

### 5.1 New Service: `VeetiService` (replaces `VeetiImportService` + `BudgetImportService`)

Expanded from the existing `veeti-import.service.ts`, which already has the OData fetch pattern:

```
apps/api/src/veeti/
├── veeti.module.ts
├── veeti.controller.ts          # REST endpoints
├── veeti.service.ts             # Core VEETI OData client (expanded from existing)
├── veeti-sync.service.ts        # Orchestrates full org data fetch + snapshot
├── veeti-budget-generator.ts    # Tuloslaskelma → Talousarvio + Valisumma conversion
├── veeti-benchmark.service.ts   # Aggregate stats computation
└── dto/
    ├── veeti-search.dto.ts
    ├── veeti-connect.dto.ts
    └── veeti-sync-result.dto.ts
```

### 5.2 New API Endpoints

```
[VEETI Connection]
GET    /veeti/search?q=<name or ytunnus>     Search VEETI orgs (public, paginated)
POST   /veeti/connect                         Link org to VEETI ID, trigger initial fetch
GET    /veeti/status                          Current org's VEETI link status + last fetch
POST   /veeti/refresh                         Re-fetch all data from VEETI for current org

[VEETI Data]
GET    /veeti/years                           Available years with data completeness per type
GET    /veeti/tuloslaskelma/:vuosi            P&L for a specific year (from snapshot)
GET    /veeti/investoinnit                    Investment history (all years)
GET    /veeti/drivers/:vuosi                  Tariffs + volumes for a year

[VEETI Budget Generation]
POST   /veeti/generate-budgets                Auto-create Talousarvio for selected years
GET    /veeti/preview-budget/:vuosi           Preview what budget would look like for a year

[Benchmarking]
GET    /benchmarks/:vuosi                     Peer comparison data for a year
GET    /benchmarks/trends?metric=<key>        Multi-year trend for a metric
GET    /benchmarks/peer-group                 Your org's size class + peer orgs
```

### 5.3 Remove

- `apps/api/src/budgets/budget-import.service.ts` (KVA Excel orchestrator)
- `apps/api/src/budgets/va-import/kva-template.adapter.ts` (KVA parser)
- `apps/api/src/budgets/veeti-import.service.ts` (move to new veeti module)
- All legacy asset/site controllers, services, modules
- `ExcelImport`-related endpoints
- `exceljs` dependency

---

## 6. Frontend Architecture

### 6.1 New Pages

| Page | Route | Purpose |
|---|---|---|
| **DashboardPage** | `/` (new landing) | Key metrics + benchmarks + quick actions |
| **VeetiConnectPage** | `/connect` | Onboarding wizard: search → preview → confirm |
| **BenchmarkPage** | `/benchmarks` | Full peer comparison dashboard |

### 6.2 Modified Pages

| Page | Changes |
|---|---|
| **BudgetPage** | Remove Excel import UI; add "Päivitä VEETI-tiedoista" button; show `lahde` badge |
| **ProjectionPage** | No major changes; benefits from richer auto-generated budgets |
| **SettingsPage** | Add VEETI connection status + re-link option |

### 6.3 Remove Pages

- `ImportPage` (Excel upload flow)
- `AssetsPage`, `AssetDetailPage` (legacy asset management)
- `SitesPage` (legacy)

### 6.4 New Components

```
apps/web/src/components/
├── VeetiConnect/
│   ├── VeetiSearchStep.tsx         # Search field + results list
│   ├── VeetiPreviewStep.tsx        # Show available data per year
│   └── VeetiConfirmStep.tsx        # Confirm + trigger import
├── Dashboard/
│   ├── DashboardKPIs.tsx           # Key metric cards (revenue, costs, tariff, volume)
│   ├── DashboardTrendChart.tsx     # Multi-year trend (Recharts)
│   ├── DashboardBenchmarkWidget.tsx # Your position vs peers
│   └── DashboardQuickActions.tsx   # "Luo ennuste", "Päivitä tiedot", etc.
├── Benchmark/
│   ├── BenchmarkPeerGroup.tsx      # Size class + peer list
│   ├── BenchmarkMetricCard.tsx     # Single metric with percentile position
│   ├── BenchmarkComparisonChart.tsx # Bar chart: you vs p25/median/p75
│   └── BenchmarkTrendOverlay.tsx   # Your trend line overlaid on peer band
└── shared/
    ├── VeetiStatusBadge.tsx        # Connection status indicator
    └── DataSourceBadge.tsx         # "VEETI" or "Manuaalinen" label on budgets
```

### 6.5 UX Flow: Onboarding (New User)

```
1. Login / Sign up
   ↓
2. DashboardPage (empty state)
   → "Yhdistä vesihuolto-organisaatiosi" CTA
   ↓
3. VeetiConnectPage
   Step 1: Search → type org name or Y-tunnus
   Step 2: Preview → see available years + data completeness grid
   Step 3: Confirm → "Hae tiedot" button
   ↓
4. Loading: Fetch all VEETI data (tariffs, volumes, P&L, investments)
   → Store as VeetiSnapshot records
   → Auto-generate Talousarvio per available year
   → Auto-populate Tuloajuri from tariffs + volumes
   ↓
5. DashboardPage (populated)
   → KPI cards show latest year metrics
   → Trend chart shows historical trajectory
   → Benchmark widget shows peer position
   → Quick action: "Luo ennuste" → ProjectionPage
```

### 6.6 UX Flow: Returning User (Annual Refresh)

```
1. Login → DashboardPage
   → Badge: "VEETI-tiedot päivitetty: 15.3.2025"
   → If new year available: "Uusia tietoja saatavilla (2025)"
   ↓
2. Click "Päivitä" → fetches new year from VEETI
   → Creates new Talousarvio for the new year
   → Updates benchmark data
   ↓
3. Create new projection from latest budget
```

---

## 7. Benchmarking Design

### 7.1 Size Classification (Kokoluokka)

Classify utilities by billed water volume (m³/year):

| Class | Finnish | Volume Range | Typical Utility |
|---|---|---|---|
| Small | `pieni` | < 200,000 m³/y | Rural cooperative |
| Medium | `keski` | 200,000–1,000,000 m³/y | Small town utility |
| Large | `suuri` | > 1,000,000 m³/y | City utility |

### 7.2 Benchmark Metrics

| Metric Key | Description | Unit | Source |
|---|---|---|---|
| `vesi_yksikkohinta` | Water tariff | €/m³ | TaksaKayttomaksu |
| `jatevesi_yksikkohinta` | Wastewater tariff | €/m³ | TaksaKayttomaksu |
| `vesi_volume` | Billed water volume | m³ | LaskutettuTalousvesi |
| `jatevesi_volume` | Billed wastewater volume | m³ | LaskutettuJatevesi |
| `liikevaihto` | Total turnover | € | Tuloslaskelma |
| `henkilostokulut` | Personnel costs | € | Tuloslaskelma |
| `poistot` | Depreciation | € | Tuloslaskelma |
| `tulos` | Net result | € | Tuloslaskelma |
| `investoinnit` | Investments | € | Investointi |
| `verkko_pituus` | Network length | km | Verkko |
| `liikevaihto_per_m3` | Revenue per m³ (derived) | €/m³ | Computed |
| `investointi_per_km` | Investment per network km (derived) | €/km | Computed |

### 7.3 Benchmark Computation

Run as a batch job (manual trigger or scheduled):

1. Fetch all VEETI orgs (`VesihuoltoOrganisaatio` full list)
2. For each org, fetch latest year's key metrics
3. Classify each org by volume → kokoluokka
4. Compute percentiles (p25, median, p75, avg, min, max) per kokoluokka per metric
5. Store in `VeetiBenchmark` table
6. Frontend reads from `GET /benchmarks/:vuosi`

---

## 8. Implementation Milestones

### M-V2-0: Foundation (Week 1–2)

**Goal:** Clean slate + new VEETI module skeleton

Tasks:
- Legacy cleanup: remove all asset management models, pages, controllers, services
- Remove KVA Excel import code + `exceljs` dependency
- Create `VeetiOrganisaatio`, `VeetiSnapshot`, `VeetiBenchmark` Prisma models
- Modify `Talousarvio` source fields (lahde, veetiVuosi)
- Create `apps/api/src/veeti/` module with service skeleton
- Database migration
- Verify: `pnpm lint && pnpm typecheck && pnpm test` pass

### M-V2-1: VEETI Data Pipeline (Week 2–3)

**Goal:** Fetch + store all VEETI data for an org

Tasks:
- Expand `VeetiService` to fetch all endpoint types (Tilinpaatos, Tuloslaskelma, Tase, Investointi, EnergianKaytto, Verkko)
- Implement `VeetiSyncService` — orchestrate full org fetch → VeetiSnapshot records
- Implement org search endpoint (`GET /veeti/search`)
- Implement connect endpoint (`POST /veeti/connect`) — link + trigger sync
- Implement refresh endpoint (`POST /veeti/refresh`)
- Implement data access endpoints (years, tuloslaskelma, drivers, investoinnit)
- Unit tests for VEETI OData parsing + snapshot storage
- Verify: manual test with org 1535 (Tyrnävän Vesihuolto Oy)

### M-V2-2: Budget Auto-Generation (Week 3–4)

**Goal:** VEETI Tuloslaskelma → Talousarvio + Valisumma + Tuloajuri

Tasks:
- Implement `VeetiBudgetGenerator` — map Tuloslaskelma fields to ValisummaTyyppi
- Implement `POST /veeti/generate-budgets` — create Talousarvio for selected years
- Implement preview endpoint — show what budget would look like before creating
- Populate Tuloajuri from TaksaKayttomaksu + LaskutettuTalousvesi/Jatevesi
- Populate investment baseline from Investointi data
- Verify: generated budget works with existing projection engine (compute endpoint)
- Integration test: connect → generate → compute projection → verify output

### M-V2-3: Frontend — Onboarding Wizard (Week 4–5)

**Goal:** VeetiConnectPage replaces ImportPage

Tasks:
- Build VeetiSearchStep component (search field + debounced results)
- Build VeetiPreviewStep component (year grid + data completeness indicators)
- Build VeetiConfirmStep component (confirm + loading state + success)
- Wire to API endpoints
- Add VeetiStatusBadge to Layout (show connection state)
- Remove ImportPage + BudgetImport components
- i18n keys for FI/SV/EN
- Verify: full onboarding flow works end-to-end

### M-V2-4: Frontend — Dashboard (Week 5–6)

**Goal:** New landing page with KPIs + trends

Tasks:
- Build DashboardPage with empty state (not connected) + populated state
- Build DashboardKPIs — 4–6 key metric cards from latest budget
- Build DashboardTrendChart — multi-year trend using all historical budgets
- Build DashboardQuickActions — "Luo ennuste", "Päivitä tiedot", "Vertailu"
- Update routing: `/` → DashboardPage (was: budget list)
- Modify BudgetPage: add DataSourceBadge, remove Excel import buttons
- Verify: dashboard renders correctly with VEETI-generated data

### M-V2-5: Benchmarking (Week 6–8)

**Goal:** Peer comparison as a core feature

Tasks:
- Implement `VeetiBenchmarkService` — batch fetch + compute aggregates
- Implement benchmark API endpoints
- Build BenchmarkPage with peer group selector
- Build BenchmarkMetricCard — show your value + percentile position
- Build BenchmarkComparisonChart — you vs p25/median/p75 bar chart
- Build BenchmarkTrendOverlay — your trajectory vs peer band
- Add benchmark widget to DashboardPage
- Size classification logic (pieni/keski/suuri by volume)
- i18n keys for FI/SV/EN
- Verify: benchmarks render for org 1535 against real peer data

### M-V2-6: Legacy Cleanup + Polish (Week 8–9)

**Goal:** Remove all dead code, polish UX, final testing

Tasks:
- Remove legacy pages from router (Assets, Sites)
- Remove legacy API modules (assets, sites, excel-import)
- Remove legacy components
- Remove legacy i18n keys
- Update navigation/sidebar (remove legacy links, add Dashboard + Benchmarks)
- Update documentation (API.md, ARCHITECTURE.md)
- Full regression: `pnpm lint && pnpm typecheck && pnpm test`
- Manual end-to-end test: fresh org → connect → generate → project → benchmark
- Update demo seed to use VEETI-based data

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| VEETI API downtime during user onboarding | User can't connect | Cache snapshots; show graceful error with retry |
| VEETI API rate limiting | Benchmark batch job fails | Implement exponential backoff; batch in smaller chunks |
| VEETI data gaps (missing years/fields) | Incomplete budgets | Show data completeness grid in preview; allow partial import |
| Tuloslaskelma field names change | Budget generation breaks | Map via stable OData field names, not display labels |
| VEETI removes/changes API | App breaks entirely | VeetiSnapshot caches all raw data; app works offline from cache |
| Benchmark computation too slow | Timeout for large datasets | Run as background job; serve pre-computed results from VeetiBenchmark table |

---

## 10. Dependencies and Removals

### Add
- No new npm packages needed (existing `fetch` API + Prisma sufficient)

### Remove
- `exceljs@^4.4.0` from `apps/api/package.json`
- All KVA template parsing code
- All legacy asset management code

### Keep
- `pdf-lib` (PDF export still needed)
- `recharts` (dashboard + benchmark charts)
- Projection engine (`projection-engine.service.ts`) — unchanged, just gets better input data
- Auth system — unchanged
- i18n system — add new keys, remove legacy keys

---

## 11. Success Criteria

1. **Onboarding time:** New org goes from sign-up to first projection in < 5 minutes (was: upload Excel + manual mapping)
2. **Data coverage:** All VEETI financial statement fields mapped to budget model
3. **Benchmark accuracy:** Peer stats match manual verification against VEETI data
4. **Zero Excel:** No `exceljs` import in production bundle
5. **All gates green:** `pnpm lint && pnpm typecheck && pnpm test` pass with no exemptions
6. **Projection parity:** Projection engine produces same-quality output from VEETI-generated budgets as from Excel-imported budgets

---

## 12. Input and Recommendations (Codex)

### A. Critical corrections (should be done before implementation starts)

1. Resolve the entity naming contradiction across the document.
   - Section 3 correctly states there is no separate `Tuloslaskelma` or `Tase` entity in VEETI.
   - Later sections still use `Tuloslaskelma`/`Tase` in endpoints, milestone tasks, and `VeetiSnapshot.dataType`.
   - Recommendation: standardize on `Tilinpaatos` everywhere and remove `Tase` references from scope.

2. Align `VeetiSnapshot.dataType` values with actual VEETI entities.
   - Current example includes `tuloslaskelma` and `tase`.
   - Recommendation: use explicit values like `tilinpaatos`, `taksa`, `volume_vesi`, `volume_jatevesi`, `investointi`, `energia`, `verkko`.

3. Define overwrite behavior for regenerated budgets.
   - Current plan says budgets are auto-generated and editable, but does not define what happens on refresh/regenerate.
   - Recommendation: add explicit rules:
   - First import creates budget.
   - Refresh creates a new version or draft.
   - Manual edits are never silently overwritten.

### B. Delivery-risk reductions (high value)

1. Add an idempotent sync contract.
   - Recommendation: each sync run should be safely repeatable with upsert logic and deterministic keys, so retries do not duplicate snapshot rows.

2. Add metadata/contract drift detection.
   - Recommendation: add a startup or CI check that verifies required `Tilinpaatos` fields still exist in VEETI metadata, failing fast if schema drifts.

3. Add clear minimum data requirements for budget generation.
   - Recommendation: define required vs optional fields per year and show a completeness score before generation.

4. Add a phased rollout.
   - Recommendation: release behind a feature flag and run parity checks against existing projection outputs before full cutover.

5. Add benchmark job operating constraints.
   - Recommendation: define chunk size, retry limits, timeout budget, and last-success timestamp; serve stale cached benchmarks with a visible freshness indicator.

### C. Suggested acceptance criteria additions

1. `Tilinpaatos` mapping is covered by automated tests for all mapped fields, including sign handling of `RahoitustuototJaKulut`.
2. Re-running the same sync for the same org/year is idempotent (no duplicate records, deterministic result).
3. Refresh never deletes or silently overwrites user-edited budget rows.
4. Benchmark API returns freshness metadata (`computedAt`, source year, org count).
5. Removal of Excel and asset legacy code is verified by grep-based checks in CI (no import paths remain).
