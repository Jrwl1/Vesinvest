# KVA.xlsx → Perfect VA Import — Implementation Plan

> "Drop in KVA.xlsx → app looks sane and useful immediately."

---

## Why subtotal-level is the right approach

Finnish VA utilities plan on a 20-year horizon using the municipal accounting framework (Kuntaliitto + KILA). But account-level granularity (6201 El, 6202 Bränsle…) is meaningless at that timescale — energy prices, regulatory shifts, and technology changes make individual account lines unreliable beyond 2–3 years.

The KVA workbook itself demonstrates the correct abstraction: **KVA totalt**, **Vatten KVA**, and **Avlopp KVA** sheets aggregate accounts into P&L subtotals (mellansummor/välisummat) — *Sales revenue, Personnel costs, Depreciation, Operating result*. These are the level at which assumptions like "inflation 2.5%" or "price increase 3%/year" are applied.

Our import should match this: **read the subtotals, not the account lines**, as the primary input for 20-year planning. Account detail (Blad1) stays available as an optional drilldown for single-year budgeting and audit trail.

---

## Current state (what exists today)

| Component | Status | Files |
|-----------|--------|-------|
| **KVA detection** | Done | `kva-template.adapter.ts` — `detectKvaTemplate()` |
| **Account-level lines (Blad1)** | Done | `kva-template.adapter.ts` — `previewKvaWorkbook()` → `budgetLines[]` |
| **Revenue drivers (prices, VAT)** | Done | `kva-template.adapter.ts` — `previewKvaRevenueDrivers()`, `findPriceTable()` |
| **Volume (m³)** | Done | Extracted from Vatten KVA / Avlopp KVA (m³-label rows only) |
| **Connections** | Done | Extracted from Anslutningar |
| **Subtotal extraction** | Done (preview only) | `kva-template.adapter.ts` — `extractSubtotalLines()` → `subtotalLines[]` |
| **Subtotal persistence** | **Not done** | No DB table, no confirm write |
| **Projection engine** | Done (account-based) | `projection-engine.service.ts` — uses `BudgetLineInput[]` from `TalousarvioRivi` |
| **Import preview UI** | Done (basic) | `BudgetImport.tsx` — shows account lines + drivers, no subtotals |
| **Import confirm API** | Done (partial) | `budgets.service.ts` — writes `TalousarvioRivi` + `Tuloajuri`, no subtotals |

**Gaps:**
1. Subtotals extracted but not persisted or shown prominently in preview.
2. Projection engine consumes account lines (TalousarvioRivi), not subtotals.
3. Preview UI shows account-level table as the primary view.
4. No year selector in preview.
5. No editable assumptions in preview/import flow.
6. Debug metadata shown raw; overlay UX issues.
7. VAT baked into unit prices; not a separate editable field.

---

## Sheet → Data mapping (source of truth)

| Sheet | What we take | Destination | Priority |
|-------|-------------|-------------|----------|
| **KVA totalt** | P&L subtotals by year: Försäljningsintäkter, Personalkostnader, Avskrivningar, etc. | `TalousarvioValisumma` (new) | **Primary** — consolidated |
| **KVA totalt** | Price table (~row 55): Vatten/Avlopp unit prices, VAT columns | `Tuloajuri.yksikkohinta`, `.alvProsentti` | Primary |
| **Vatten KVA** | P&L subtotals by year (same categories, water only) | `TalousarvioValisumma` with `palvelutyyppi=vesi` | Secondary |
| **Vatten KVA** | Volume row with m³ in label | `Tuloajuri.myytyMaara` (vesi) | Primary |
| **Avlopp KVA** | P&L subtotals by year (wastewater only) | `TalousarvioValisumma` with `palvelutyyppi=jatevesi` | Secondary |
| **Avlopp KVA** | Volume row with m³ in label | `Tuloajuri.myytyMaara` (jatevesi) | Primary |
| **Anslutningar** | Connection count by year | `Tuloajuri.liittymamaara` | Primary |
| **Blad1** | Account-level lines (6xxx) from Budget column | `TalousarvioRivi` | Optional (hidden) |
| **Boksluten** | — | — | Ignored (actuals) |
| **Avskrivningar** | — | — | Ignored (out of scope) |
| **Händelser** | — | — | Ignored |
| **proff.fi** | — | — | Ignored |
| **Avlopp** | — | — | Ignored (formula detail) |

---

## UI flow (text diagram)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  1. UPLOAD                                                   │
  │  [Drop KVA.xlsx here] or [Choose file]                      │
  │  → POST /budgets/import/preview-kva (multipart)             │
  └───────────────────────────┬─────────────────────────────────┘
                              │ preview response
  ┌───────────────────────────▼─────────────────────────────────┐
  │  2. PREVIEW  (full-screen modal, 3 sections)                │
  │                                                              │
  │  ┌─── Header ──────────────────────────────────────────┐    │
  │  │ "KVA Import"  │ Year: [2024 ▼]  │ Name: [________] │    │
  │  └─────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ┌─── A. Budget overview (subtotals) ──────────────────┐    │
  │  │ Category               │ Type    │ Amount  │ Edit   │    │
  │  │ Försäljningsintäkter   │ Tulot   │ 420 000 │ [pen]  │    │
  │  │ Personalkostnader      │ Kulut   │ 115 000 │ [pen]  │    │
  │  │ Avskrivningar          │ Poistot │  54 000 │ [pen]  │    │
  │  │ Årets resultat         │ Tulos   │  40 000 │ [pen]  │    │
  │  │ ...                                                  │    │
  │  │ ▸ Vatten KVA breakdown (collapsed)                   │    │
  │  │ ▸ Avlopp KVA breakdown (collapsed)                   │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ┌─── B. Revenue drivers (editable) ───────────────────┐    │
  │  │              │ Vesi        │ Jätevesi    │           │    │
  │  │ Unit price   │ [1.00] €/m³ │ [2.00] €/m³ │ ex VAT  │    │
  │  │ Volume       │ [12 000] m³ │ [9 000] m³  │          │    │
  │  │ Connections  │ [520]       │ [520]       │          │    │
  │  │ Base fee     │ [0] €/conn. │ [0] €/conn. │          │    │
  │  │ VAT rate     │ [25.5] %    │ [25.5] %    │ separate │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ┌─── C. Assumptions (editable, defaults shown) ───────┐    │
  │  │ Inflaatio           │ [2.5] %   │ (default)         │    │
  │  │ Energiakerroin      │ [5.0] %   │ (default)         │    │
  │  │ Vesimäärän muutos   │ [-1.0] %  │ (default)         │    │
  │  │ Hintakorotus        │ [3.0] %   │ (default)         │    │
  │  │ Investointikerroin  │ [2.0] %   │ (default)         │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ┌─── Warnings (if any) ───────────────────────────────┐    │
  │  │ ⚠ Volume not found in Vatten KVA — enter manually   │    │
  │  └──────────────────────────────────────────────────────┘    │
  │                                                              │
  │  ▸ Advanced: Account-level detail (Blad1) — collapsed       │
  │                                                              │
  │  ┌─── Footer (sticky) ─────────────────────────────────┐    │
  │  │ [Cancel]  [Choose another file]                      │    │
  │  │         [Create budget profile "___________"]        │    │
  │  └──────────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────────┘
                              │ confirm
  ┌───────────────────────────▼─────────────────────────────────┐
  │  3. CONFIRM  → single transaction                           │
  │  Creates: Talousarvio (named profile)                       │
  │         + TalousarvioValisumma rows (subtotals)             │
  │         + Tuloajuri rows (revenue drivers, VAT separate)    │
  │         + Olettamus upserts (assumptions)                   │
  │         + TalousarvioRivi (account lines, if enabled)       │
  └───────────────────────────┬─────────────────────────────────┘
                              │
  ┌───────────────────────────▼─────────────────────────────────┐
  │  4. EDIT + FORECAST                                         │
  │  Budget page shows: subtotals (editable), drivers (edit),   │
  │  assumptions (Settings), "Compute projection" → 20-year     │
  │  table using subtotal categories.                           │
  └─────────────────────────────────────────────────────────────┘
```

---

## Data contracts (API → Web)

### Preview request

```
POST /budgets/import/preview-kva
Content-Type: multipart/form-data
Body: { file: <KVA.xlsx> }
```

### Preview response: `KvaImportPreview`

```typescript
interface KvaImportPreview {
  templateId: 'kva';
  year: number;                          // detected or selected year
  availableYears: number[];              // all years found in subtotal sheets

  // Section A: subtotals
  subtotalLines: SubtotalLine[];         // from KVA totalt + Vatten/Avlopp KVA
  subtotalsByService: {                  // per-service breakdown
    vesi?: SubtotalLine[];
    jatevesi?: SubtotalLine[];
  };

  // Section B: revenue drivers
  revenueDrivers: RevenueDriver[];       // vesi + jatevesi with prices, volumes, etc.

  // Section C: assumptions (defaults from org or system)
  assumptions: Assumption[];

  // Hidden: account lines (Blad1)
  accountLines?: AccountLine[];          // only if Blad1 has data

  // Metadata
  warnings: Warning[];                   // structured, actionable
  sourceSummary: {                       // what sheets were read
    sheets: string[];
    priceTableFound: boolean;
    volumeFound: { vesi: boolean; jatevesi: boolean };
    connectionsFound: boolean;
  };
}

interface SubtotalLine {
  categoryKey: string;                   // stable ID: "sales_revenue", "personnel_costs"
  categoryName: string;                  // from Excel: "Försäljningsintäkter"
  type: 'income' | 'cost' | 'depreciation' | 'financial' | 'investment' | 'result';
  amount: number;
  year: number;
  sourceSheet: string;
  palvelutyyppi?: 'vesi' | 'jatevesi';  // null = consolidated
  editable: boolean;                     // true: user can override in preview
}

interface RevenueDriver {
  palvelutyyppi: 'vesi' | 'jatevesi';
  yksikkohinta: number;                  // ex VAT
  myytyMaara: number;                    // m³/year
  perusmaksu: number;                    // €/connection
  liittymamaara: number;                 // connection count
  alvProsentti: number;                  // VAT % — separate, editable
  source: 'excel' | 'manual';           // where the value came from
}

interface Warning {
  code: string;                          // e.g. "volume_not_found"
  message: string;                       // human-readable
  field?: string;                        // which field is affected
  severity: 'info' | 'warning';
}
```

### Confirm request

```typescript
POST /budgets/import/confirm-kva
Body: {
  name: string;                          // budget profile name
  year: number;                          // selected year
  subtotalLines: SubtotalLine[];         // possibly edited by user
  revenueDrivers: RevenueDriver[];       // possibly edited by user
  assumptions: Assumption[];             // possibly edited by user
  includeAccountLines?: boolean;         // default false
  accountLines?: AccountLine[];          // only if includeAccountLines
}
```

### Confirm response

```typescript
{
  success: true;
  budgetId: string;                      // created Talousarvio ID
  created: {
    subtotalLines: number;
    revenueDrivers: number;
    assumptions: number;
    accountLines: number;
  };
}
```

---

## DB schema changes

### New table: `TalousarvioValisumma`

```prisma
enum ValisummaType {
  income
  cost
  depreciation
  financial
  investment
  result
}

model TalousarvioValisumma {
  id             String          @id @default(uuid())
  talousarvioId  String
  talousarvio    Talousarvio     @relation(fields: [talousarvioId], references: [id], onDelete: Cascade)
  categoryKey    String          @map("category_key")
  categoryName   String          @map("category_name")
  type           ValisummaType
  amount         Decimal         @map("amount")
  palvelutyyppi  Palvelutyyppi?
  sourceSheet    String?         @map("source_sheet")
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([talousarvioId])
  @@unique([talousarvioId, categoryKey, palvelutyyppi])
  @@map("talousarvio_valisumma")
}
```

**Add relation to Talousarvio:**

```prisma
model Talousarvio {
  // ... existing fields ...
  valisummat  TalousarvioValisumma[]
}
```

### Migration strategy

1. Create migration with `prisma migrate dev --name add_valisumma`.
2. Non-destructive: adds new table + enum, no changes to existing tables.
3. Existing budgets continue to work (valisummat is optional relation).
4. Railway deploy: migration runs automatically on deploy.

### No changes to existing tables

`TalousarvioRivi`, `Tuloajuri`, `Olettamus` remain as-is. `TalousarvioRivi` becomes the "optional account-detail" storage.

---

## Step 1: Subtotal-first preview API

**Goal (UX):** When user uploads KVA.xlsx, the preview response contains structured subtotal lines as the primary data, with year selection and structured warnings.

**Backend changes:**

| File | Change |
|------|--------|
| `budget-import.service.ts` | Add `subtotalLines` and `subtotalDebug` to `ImportPreviewResult` interface. In KVA branch, include `extractSubtotalLines()` result. Add `availableYears` from subtotal debug. |
| `kva-template.adapter.ts` | Already done: `extractSubtotalLines()` exists and is wired into `previewKvaWorkbook()`. No changes needed. |
| `va-import.types.ts` | Already done: `VaImportSubtotalLine`, `VaImportSubtotalDebug` types exist. |

**Frontend changes:** None in this step (backend-only).

**Tests:**
- Existing 11 unit tests for `extractSubtotalLines` already pass.
- Add: verify `ImportPreviewResult` includes `subtotalLines` when KVA detected.

**Acceptance:** `POST /budgets/:id/import/preview` with KVA.xlsx returns `subtotalLines` array with `categoryKey`, `type`, `amount`, `year` for each P&L category.

---

## Step 2: DB schema — TalousarvioValisumma

**Goal (UX):** Infrastructure to persist subtotal lines for projection consumption.

**Backend changes:**

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ValisummaType` enum + `TalousarvioValisumma` model + relation on `Talousarvio`. |
| `prisma/migrations/` | Auto-generated by `prisma migrate dev --name add_valisumma`. |
| `budgets.repository.ts` | Add `createValisumma(talousarvioId, data)`, `upsertValisumma(talousarvioId, categoryKey, palvelutyyppi, data)`, `findValisummat(talousarvioId)`. |

**Frontend changes:** None.

**Tests:**
- Repository methods: unit test with mock Prisma (or integration test if DB available).

**Acceptance:** Migration runs without error. `TalousarvioValisumma` table exists. CRUD methods work.

**Risks:** None — additive schema change, no breaking changes.

---

## Step 3: Confirm — persist subtotals + drivers + assumptions in one transaction

**Goal (UX):** "Create budget profile" button saves everything in one click. Re-importing replaces or creates new profile.

**Backend changes:**

| File | Change |
|------|--------|
| `budgets.service.ts` | New method `confirmKvaImport(orgId, body)`: wraps in `prisma.$transaction`. Creates `Talousarvio` with name + year. Upserts `TalousarvioValisumma` for each subtotal line. Upserts `Tuloajuri` for each driver. Upserts `Olettamus` for each assumption. Optionally creates `TalousarvioRivi` if `includeAccountLines`. |
| `budgets.controller.ts` | New endpoint `POST /budgets/import/confirm-kva` (body: name, year, subtotalLines, drivers, assumptions, accountLines?). |
| `budgets.repository.ts` | Add `upsertValisumma` (see Step 2). |

**Idempotency rule:** If a budget with same (orgId, vuosi, nimi) exists, the user is prompted: "Replace existing profile?" or "Create new profile with different name?". Backend enforces unique(orgId, vuosi) on Talousarvio — if conflict, return 409 with clear message.

**Frontend changes:** Wire confirm button to new endpoint (Step 5).

**Tests:**
- Unit: confirm with subtotals + drivers + assumptions → all tables populated.
- Unit: confirm without account lines → no TalousarvioRivi created.
- Unit: re-confirm same year → 409 or replace (depending on flag).

**Acceptance:** Single transaction. All-or-nothing. Budget shows in budget list immediately.

**Risks:**
- Transaction scope: Prisma `$transaction` in interactive mode. Mitigation: keep transaction small (create + inserts only, no complex logic inside).

---

## Step 4: VAT handling — separate from unit prices

**Goal (UX):** Unit prices shown ex-VAT. VAT is a separate editable field (default 25.5%). Revenue calculations apply VAT separately.

**Backend changes:**

| File | Change |
|------|--------|
| `kva-template.adapter.ts` | When price table has moms 25.5%: store `yksikkohinta` as the value from that column (which IS the incl-VAT price from Excel). Add `yksikkohintaExVat = yksikkohinta / (1 + alvProsentti/100)` to the driver. **Or simpler:** always use moms 0% column if available (that's the ex-VAT price). |
| `va-import.types.ts` | No change needed — `alvProsentti` is already separate. |

**Decision:** Prefer the **moms 0% column** as the base ex-VAT price. Store VAT rate from the preferred moms column (25.5%). This way `yksikkohinta` is always ex-VAT, and `alvProsentti` is the VAT rate to apply.

**Strategy A (recommended):** Read ex-VAT price from moms 0% column. Store `alvProsentti = 25.5` (or whatever the highest available rate is) as the VAT rate. UI shows: "Unit price (ex VAT): 1.20 €/m³" + "VAT: 25.5%". Revenue = price × volume × (1 + VAT/100) + baseFee × connections.

**Strategy B:** Read incl-VAT price, back-calculate. More fragile.

**Frontend changes:** Show VAT as separate input. Revenue calculation: `price * volume * (1 + vat/100)`.

**Tests:**
- Unit: when moms 0% and moms 25.5% both present, `yksikkohinta` = moms 0% value, `alvProsentti` = 25.5.
- Unit: UI displays ex-VAT price with separate VAT field.

**Acceptance:** Preview shows "1.20 €/m³ (ex VAT)" not "1.51 €/m³ (incl. 25.5% VAT)". User can change VAT from 25.5% to 24% and see revenue update.

---

## Step 5: Frontend preview redesign

**Goal (UX):** "Preview shows 3 sections: Subtotals, Revenue drivers, Assumptions. Looks polished. No opaque overlay lingering."

**Frontend changes:**

| File | Change |
|------|--------|
| `BudgetImport.tsx` | **Complete rewrite of preview step.** Sections A/B/C as in UI flow diagram. Year dropdown from `availableYears`. Budget name input. Editable fields in all sections. Collapsed "Advanced: Account lines" section. Structured warnings (not raw strings). Sticky footer with confirm button. |
| `api.ts` | Add `previewKvaImport(file)` (no budgetId required — budget created on confirm). Add `confirmKvaImport(body)`. Update `ImportPreviewResult` to include `subtotalLines`, `availableYears`. |
| `App.css` | Fix overlay: ensure modal has solid background, no z-index conflicts, proper unmount on close. Remove `display: none !important` on mobile for the import overlay. |
| `BudgetPage.tsx` | "Import from file" opens the KVA import modal directly (no pre-create budget step). On confirm success, navigate to the created budget. |

**Key UX decisions:**

1. **No pre-existing budget required.** Upload creates a new profile on confirm. If user has a budget selected, offer "Replace" or "Create new".
2. **All fields editable in preview.** Subtotal amounts, driver values, assumptions — all can be tweaked before confirm.
3. **Warnings as inline badges.** "Volume not found in Vatten KVA — enter manually" next to the Volume input field, not in a separate warnings block.
4. **Debug hidden.** `kvaDebug`, `driversDebug`, `subtotalDebug` — accessible only via "Copy diagnostics" button that copies JSON to clipboard.

**Tests:** Manual testing checklist (see Step 8).

**Acceptance:**
- [ ] Preview loads in < 2s for KVA.xlsx.
- [ ] Three sections visible (subtotals, drivers, assumptions).
- [ ] Year dropdown works and updates amounts.
- [ ] All fields editable.
- [ ] Warnings inline next to affected fields.
- [ ] Confirm creates budget and navigates to it.
- [ ] No lingering overlay after confirm or cancel.
- [ ] Mobile: overlay is usable (not hidden).

**Risks:**
- Large frontend change. Mitigation: keep existing `BudgetImport.tsx` for non-KVA imports; new component `KvaImportPreview.tsx` for KVA-specific flow.
- Backwards compatibility: non-KVA imports (generic CSV/Excel) use existing flow unchanged.

---

## Step 6: Projection engine — consume subtotals

**Goal (UX):** "Compute projection" uses subtotal categories (not account lines) for 20-year calculations. Revenue drivers feed the "Vesimaksut" explanation.

**Backend changes:**

| File | Change |
|------|--------|
| `projection-engine.service.ts` | Add `computeFromSubtotals(baseYear, horizon, subtotals, drivers, assumptions)` method. Expenses = sum of subtotal lines where type='cost'. Revenue = driver revenue + sum of type='income' subtotals (non-driver). Depreciation = sum of type='depreciation'. Investments = sum of type='investment'. Financial = sum of type='financial'. |
| `projections.service.ts` | When computing: check if budget has `valisummat`. If yes, use `computeFromSubtotals`. If no (legacy), use existing `compute` with `TalousarvioRivi`. |

**How assumptions apply to subtotals:**

| Category | Assumption | Formula |
|----------|-----------|---------|
| `personnel_costs` | `inflaatio` | `base × (1 + inflaatio)^n` |
| `other_costs` | `inflaatio` | `base × (1 + inflaatio)^n` |
| `materials_services` | `inflaatio` | `base × (1 + inflaatio)^n` |
| `depreciation` | None (or separate) | `base` (flat, or user-provided growth) |
| `investments` | `investointikerroin` | `base × (1 + investointikerroin)^n` |
| `financial_costs` | None | `base` (flat) |
| Driver revenue | `hintakorotus` + `vesimaaran_muutos` | `price × (1+hintakorotus)^n × volume × (1+vesimaaran_muutos)^n` |

**Frontend changes:**

| File | Change |
|------|--------|
| Projection page | When showing breakdown, use category names (not account codes). Show "Försäljningsintäkter (laskennallinen)" for driver-computed revenue. |

**Tests:**
- Unit: `computeFromSubtotals` with 3 subtotals + 2 drivers → correct year-by-year output.
- Unit: inflation applied to cost subtotals, not to depreciation.
- Integration: budget with valisummat → projection works; budget without → legacy path works.

**Acceptance:** Projection with subtotal-based budget produces reasonable 20-year table. Revenue = driver-computed + other income. Costs grow with inflation. Result = revenue - costs - depreciation - investments ± financial.

---

## Step 7: Frontend polish

**Goal (UX):** "Looks professional. No debug noise. Smooth flow."

**Frontend changes:**

| Issue | Fix | File |
|-------|-----|------|
| Debug metadata visible | Hide `kvaDebug`, `driversDebug` behind "Copy diagnostics" button | `KvaImportPreview.tsx` |
| Opaque overlay lingers | Ensure `onClose` unmounts component; clear all state; use `useEffect` cleanup | `KvaImportPreview.tsx`, `App.css` |
| `[KVA_DEBUG]` in warnings | Filter out debug warnings from user-visible list; keep in diagnostics | `KvaImportPreview.tsx` |
| Raw warning strings | Replace with structured `Warning` objects; show inline next to fields | `kva-template.adapter.ts` → return structured warnings |
| Mobile overlay hidden | Remove `display: none !important` for `.budget-import-overlay` | `App.css` |
| No loading state for confirm | Add spinner + disable button during confirm | `KvaImportPreview.tsx` |
| Budget name required | Validate name non-empty before confirm; show inline error | `KvaImportPreview.tsx` |

**Tests:** Manual checklist in Step 8.

**Acceptance:**
- [ ] No `[KVA_DEBUG]` visible to user.
- [ ] No raw JSON or console-like text in preview.
- [ ] Overlay closes cleanly on cancel, on confirm success, and on error.
- [ ] Mobile: import flow is usable.
- [ ] i18n: all user-facing strings go through translation keys.

---

## Step 8: Testing & fixtures strategy

### Unit tests (in-memory workbooks)

| Test | What it verifies |
|------|-----------------|
| `extractSubtotalLines` with KVA totalt | Income + cost subtotals extracted, correct year, correct categoryKey |
| Label mapping coverage | All 14 SUBTOTAL_CATEGORIES patterns match expected Swedish/Finnish labels |
| Per-service extraction | Vatten KVA → `palvelutyyppi=vesi`; Avlopp KVA → `palvelutyyppi=jatevesi` |
| Year selection: budget year preferred | When budget year in columns, amounts from that column |
| Year selection: newest fallback | When budget year not in columns, uses newest year |
| Revenue drivers: ex-VAT price | moms 0% column used for `yksikkohinta`; `alvProsentti` set to 25.5 |
| Revenue drivers: volume from m³ only | "Försäljningsintäkter" NOT used as volume |
| Confirm transaction | All entities created in one transaction; partial failure rolls back |
| Projection from subtotals | `computeFromSubtotals` produces correct 20-year output |
| Idempotency | Re-import same year → 409 or replace |

### Fixture tests (skip if missing)

| Test | What it verifies |
|------|-----------------|
| Real KVA.xlsx yields subtotals | At least one income + one cost subtotal line |
| Real KVA.xlsx revenue drivers | Price table found in KVA totalt; no false warnings |
| Both tiers available | subtotalLines.length >= 2 AND budgetLines.length >= 1 |
| No 100% KULUT | subtotalLines include income type |
| Debug populated | subtotalDebug.sourceSheets includes "KVA totalt" |

### Acceptance checklist

- [ ] Upload KVA.xlsx → preview loads in < 2s
- [ ] Preview shows subtotals with correct amounts for selected year
- [ ] Preview shows revenue drivers (Vesi + Jätevesi) with prices ex-VAT
- [ ] Preview shows assumptions with editable defaults
- [ ] Year dropdown changes amounts
- [ ] All fields editable in preview
- [ ] Warnings appear inline next to affected fields
- [ ] "Create budget profile" saves everything
- [ ] Budget appears in budget list, is editable
- [ ] "Compute projection" produces 20-year table
- [ ] No debug metadata visible to user
- [ ] No lingering overlay after confirm/cancel
- [ ] Non-KVA imports still work (no regression)

---

## Migration plan for existing data/flows

| What | Action |
|------|--------|
| Existing `TalousarvioRivi` data | Keep. Account lines remain valid for legacy budgets. |
| Existing `Tuloajuri` data | Keep. Drivers remain compatible. |
| Existing `Olettamus` data | Keep. Assumptions are org-level; no change. |
| Existing import flow (generic CSV/Excel) | Keep unchanged. `BudgetImport.tsx` continues to handle non-KVA files. |
| Existing projection engine (`compute`) | Keep as legacy path. New `computeFromSubtotals` is preferred when `valisummat` exist. |
| Demo data seeding | Update demo to create a budget with both `valisummat` and `rivit` so both paths can be tested. |
| `BudgetImport.tsx` | Rename to `GenericImport.tsx`. New `KvaImportPreview.tsx` for KVA-specific flow. Detection in parent component routes to correct one. |

### Deprecation timeline

| Phase | What | When |
|-------|------|------|
| Phase 1 (this plan) | Both flows coexist. KVA files → new flow. Others → old flow. | Now |
| Phase 2 | Account-level import hidden by default in KVA flow. Available under "Advanced". | After Phase 1 ships |
| Phase 3 | Consider removing account-level import entirely if no users need it. | 3+ months |

---

## Files likely touched

### Backend (`apps/api/src/`)

| File | Steps |
|------|-------|
| `budgets/va-import/kva-template.adapter.ts` | 1, 4 |
| `budgets/va-import/kva-template.adapter.spec.ts` | 1, 4, 8 |
| `budgets/va-import/va-import.types.ts` | 1 |
| `budgets/budget-import.service.ts` | 1, 3 |
| `budgets/budgets.service.ts` | 3 |
| `budgets/budgets.repository.ts` | 2, 3 |
| `budgets/budgets.controller.ts` | 3 |
| `projections/projection-engine.service.ts` | 6 |
| `projections/projections.service.ts` | 6 |
| `prisma/schema.prisma` | 2 |

### Frontend (`apps/web/src/`)

| File | Steps |
|------|-------|
| `components/KvaImportPreview.tsx` (new) | 5, 7 |
| `components/BudgetImport.tsx` | 5 (rename/refactor) |
| `pages/BudgetPage.tsx` | 5 |
| `api.ts` | 1, 3, 5 |
| `App.css` | 5, 7 |

### Other

| File | Steps |
|------|-------|
| `docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md` (this file) | — |
| `apps/api/scripts/inspect-kva-full.js` | Investigation |

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Real KVA.xlsx labels don't match our patterns | Subtotals empty | Run inspection script on real file; extend SUBTOTAL_CATEGORIES. Fixture tests catch regressions. |
| Projection engine behavior change | Different numbers for existing users | Dual path: `computeFromSubtotals` only for budgets with valisummat. Legacy path unchanged. |
| Large frontend rewrite | Bugs, regressions | New `KvaImportPreview.tsx` component, not modifying existing `BudgetImport.tsx`. Feature flag or detection-based routing. |
| VAT handling confusion | Users see wrong prices | Clear labeling: "ex VAT" next to price field. Separate VAT field. Explanation text. |
| Transaction failure on confirm | Partial data | `prisma.$transaction` ensures all-or-nothing. |
| Year columns vary between workbooks | Wrong year selected | Year dropdown in preview lets user override. Newest-year fallback is safe. |
| Mobile/responsive issues | Import unusable on mobile | Test on narrow viewport. Remove `display: none !important`. |

---

## Summary (10 bullets)

1. **Subtotals are primary.** Read P&L mellansummor from KVA totalt / Vatten KVA / Avlopp KVA — not account lines.
2. **New DB table** `TalousarvioValisumma` stores subtotal lines with stable category keys and per-service breakdown.
3. **Revenue drivers ex-VAT.** Use moms 0% column for base price; VAT is a separate editable field (default 25.5%).
4. **One-click import.** Upload → preview (3 sections: subtotals, drivers, assumptions) → "Create budget profile".
5. **Everything editable.** Every value in preview can be overridden before confirm. Missing values show warning + empty input.
6. **Projection engine updated.** New `computeFromSubtotals` path; legacy path preserved for existing budgets.
7. **Account lines optional.** Blad1 data is available under "Advanced" collapsed section, not the primary view.
8. **No debug noise.** Technical metadata hidden behind "Copy diagnostics". Warnings are structured and inline.
9. **Overlay fixed.** Solid modal, proper unmount, no lingering opacity. Works on mobile.
10. **Incremental delivery.** Steps 1–2 (backend + schema) ship first; Steps 3–5 (confirm + frontend) next; Steps 6–7 (projection + polish) follow.
