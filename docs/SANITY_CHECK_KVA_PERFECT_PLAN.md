> ⚠️ **DEPRECATED / HISTORICAL**  
> Do not use as current spec. Canonical docs: [docs/CANONICAL.md](CANONICAL.md). For KVA import use: [REVENUE_DRIVERS_PERSISTENCE_REPORT.md](REVENUE_DRIVERS_PERSISTENCE_REPORT.md), [KVA_IMPORT_DRIVERS_CHECKLIST.md](KVA_IMPORT_DRIVERS_CHECKLIST.md).

---

# Sanity Check: KVA Perfect Plan

Pre-implementation feasibility audit of `docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md`.

---

## 1. Budget profiles / multiple budgets

### Current repo reality

**Unique constraint blocks multiple profiles per year.**

```347:347:apps/api/prisma/schema.prisma
  @@unique([orgId, vuosi])
```

`Talousarvio` has `@@unique([orgId, vuosi])` — one budget per org per year. The `nimi` field exists (optional, line 338) but is **not** part of the unique constraint. Creating a second budget for the same year will throw a Prisma unique constraint violation.

**Budget creation (no guard):**

```33:39:apps/api/src/budgets/budgets.repository.ts
  create(orgId: string, data: { vuosi: number; nimi?: string }) {
    return this.prisma.talousarvio.create({
      data: { orgId: org, vuosi: data.vuosi, nimi: data.nimi ?? `Talousarvio ${data.vuosi}` ... },
    });
  }
```

No application-level duplicate check. Prisma throws on conflict.

**Frontend selection — dropdown, state-based, no URL param:**

```602:617:apps/web/src/pages/BudgetPage.tsx
  <select value={isDraftMode ? '__new__' : (activeBudget?.id ?? '')}>
    {budgets.map((b) => <option key={b.id} value={b.id}>{b.nimi || ...}</option>)}
    <option value="__new__">+ Uusi talousarvio</option>
  </select>
```

Selection is stored in React state (`activeBudget`), not URL params. On page load, first budget is auto-selected (line 159).

**Import requires a pre-existing budgetId:**

```11:15:apps/web/src/components/BudgetImport.tsx
  interface BudgetImportProps {
    budgetId: string;     // ← required
    onImportComplete: () => void;
    onClose: () => void;
  }
```

The current import flow creates a budget first (`handleCreateBudgetForImport` at line 181 of `BudgetPage.tsx`), then opens `BudgetImport` with that ID.

### Gap vs plan

The plan says:

> *"Provide a 'Create forecast-ready budget profile' button with a user-provided name."*
> *"Idempotency: re-import into an existing budget should be 'replace' or 'create new profile'."*
> *"Multi-budget support: budgets are named profiles; user can create multiple."*

This is **blocked** by `@@unique([orgId, vuosi])`. If user imports KVA 2024 and then wants a "Scenario B" for 2024 — not possible.

The plan also proposes `POST /budgets/import/preview-kva` without a `budgetId` in the URL (budget created on confirm). But today's flow is `POST /budgets/:id/import/preview` — the budget must exist first.

### Recommendation

**Minimal change (Option A — recommended):** Change the unique constraint to `@@unique([orgId, vuosi, nimi])`. This allows multiple named profiles for the same year. The default name (`"Talousarvio 2024"`) keeps existing behavior. Requires:

- **schema.prisma:** `@@unique([orgId, vuosi, nimi])` (instead of `@@unique([orgId, vuosi])`).
- **migration:** One-line Prisma migration. Non-destructive if existing budgets have distinct `nimi` per year (they should — there's only one per year today).
- **API:** `create` should return a 409 with message `"Budget '${nimi}' already exists for year ${vuosi}"` instead of a raw Prisma error.
- **UI:** Show `nimi` prominently in the dropdown (already does).
- **No other changes** — the existing dropdown, state management, and import flow continue to work.

**Option B (simpler but less flexible):** Keep `@@unique([orgId, vuosi])`. Import into the same year replaces the existing budget (delete + recreate in transaction). Prompt user: "Budget for 2024 already exists. Replace it?" No new profiles.

**Recommendation:** Go with Option A. It's one constraint change, one migration, and it unblocks the "named profiles" UX cleanly. Option B loses data (replacement) and prevents scenario comparison.

**Additional fix needed:** The plan proposes `POST /budgets/import/preview-kva` (no budgetId). This requires a new endpoint separate from the existing `POST /budgets/:id/import/preview`. This is a **good change** — preview shouldn't require a pre-existing budget — but it must be listed as an explicit Step 1 sub-task.

---

## 2. Projection engine location & inputs

### Current repo reality

**Engine:** `apps/api/src/projections/projection-engine.service.ts`

```typescript
compute(
  baseYear: number,
  horizonYears: number,
  lines: BudgetLineInput[],      // { tiliryhma, nimi, tyyppi: kulu|tulo|investointi, summa }
  drivers: RevenueDriverInput[],  // { palvelutyyppi, yksikkohinta, myytyMaara, perusmaksu, liittymamaara }
  assumptions: AssumptionMap,     // { inflaatio, energiakerroin, vesimaaran_muutos, hintakorotus, investointikerroin }
): ComputedYear[]
```

**What it consumes today:**

| Input | Source | How loaded |
|-------|--------|------------|
| `lines` | `TalousarvioRivi` (budget.rivit) | Prisma include in `projections.repository.ts` findById |
| `drivers` | `Tuloajuri` (budget.tuloajurit) | Same Prisma include |
| `assumptions` | `Olettamus` (org-level) + scenario overrides | Separate query in `projections.service.ts` lines 111–135 |

**Computation logic (3 buckets only):**

| Bucket | How computed | Growth factor |
|--------|-------------|---------------|
| Revenue | Driver: `price × (1+hintakorotus)^n × volume × (1+vesimaaran_muutos)^n + baseFee × connections`. Manual tulo lines: `summa × (1+inflaatio)^n`. | hintakorotus + vesimaaran_muutos (drivers), inflaatio (manual) |
| Expenses | All kulu lines. Energy (42xx prefix): `× (1+energiakerroin)^n`. Others: `× (1+inflaatio)^n`. | inflaatio or energiakerroin |
| Investments | All investointi lines: `× (1+investointikerroin)^n`. | investointikerroin |

**Result:** `tulos = tulotYhteensa - kulutYhteensa - investoinnitYhteensa`

**Call chain:** Controller → `projections.service.ts` → loads budget (with rivit + tuloajurit) → loads assumptions → calls `engine.compute()` → stores `EnnusteVuosi` rows.

**Budget with no lines works:** If `rivit = []` but `tuloajurit` has data, the engine computes revenue from drivers only. Revenue-only projection works fine. Lines 106–108 only check for null/undefined, not empty arrays.

### Gap vs plan

The plan proposes a `computeFromSubtotals()` method in the engine. This is the right approach. But there are **three concrete issues** with the integration:

**Issue 1: No `valisummat` in the Prisma include.**

Currently, `projections.repository.ts` loads budget with:

```typescript
include: {
  talousarvio: {
    include: {
      rivit: { orderBy: [...] },
      tuloajurit: { orderBy: { palvelutyyppi: 'asc' } },
    },
  },
}
```

After adding `TalousarvioValisumma`, this must be updated to also include `valisummat`. Straightforward but must be noted.

**Issue 2: The `energiakerroin` assumption has no subtotal equivalent.**

Today, the engine uses `tiliryhma.startsWith('42')` to apply `energiakerroin` to energy accounts. In subtotal-level data, there's no account code — just category keys like `personnel_costs` or `other_costs`. Energy costs are lumped into `other_costs` or `materials_services`.

**Decision needed:** Either (a) drop `energiakerroin` for subtotal projections (use only `inflaatio` for all costs), or (b) add a separate subtotal category for energy (e.g., `energy_costs`) and map it. **Recommendation: (a)**. At the subtotal level, energy is not a separate line — it's inside "övriga rörelsekostnader". The user can adjust `inflaatio` if they want to model energy differently.

**Issue 3: Depreciation and financial items are not in the result formula.**

Current: `tulos = revenue - expenses - investments`.

Subtotal extraction provides `depreciation` and `financial_income`/`financial_costs` as separate types. These need to be in the formula:

`tulos = revenue - operating_costs - depreciation - investments + financial_income - financial_costs`

This is a formula change in `computeFromSubtotals`, not in the existing `compute` method. The plan's Step 6 table (category → assumption mapping) correctly lists depreciation as flat and financial as flat, but the net result formula is not explicitly updated in the plan.

### Minimal integration point

Add `computeFromSubtotals()` as a **separate method** on `ProjectionEngine` — not modifying `compute()`. In `projections.service.ts`, after loading the budget:

```typescript
const hasValisummat = budget.valisummat && budget.valisummat.length > 0;
if (hasValisummat) {
  computedYears = engine.computeFromSubtotals(budget.vuosi, horizon, budget.valisummat, drivers, assumptions);
} else {
  computedYears = engine.compute(budget.vuosi, horizon, lines, drivers, assumptions);
}
```

This is safe — existing budgets without `valisummat` use the old path. New KVA-imported budgets with `valisummat` use the new path.

---

## 3. Subtotals (mellansummor) requirements

### What the projection needs (minimum viable)

For a meaningful 20-year VA projection, the engine needs these **input buckets**:

| Bucket | Purpose | Growth model | Required? |
|--------|---------|-------------|-----------|
| **Operating revenue** | Sales revenue (from drivers) + other income | Drivers: hintakorotus × vesimaaran_muutos. Other: inflaatio. | **Yes** |
| **Operating costs** | Personnel, materials, other operating costs | inflaatio | **Yes** |
| **Depreciation** | Planned depreciation | Flat or custom growth | **Yes** — affects result and cost-coverage ratio |
| **Investments** | Capital expenditure | investointikerroin | **Yes** — affects cumulative cash position |
| **Financial items** | Interest income/costs | Flat or custom | Nice to have — often small for VA |
| **Result** | Computed output, not input | Calculated | **Not stored as input** |

### What the adapter extracts (SUBTOTAL_CATEGORIES)

| categoryKey | type | Maps to projection bucket |
|-------------|------|--------------------------|
| `sales_revenue` | income | **Operating revenue** (but should come from drivers, not this line — see below) |
| `connection_fees` | income | Operating revenue (non-driver) |
| `other_income` | income | Operating revenue (non-driver) |
| `materials_services` | cost | **Operating costs** |
| `personnel_costs` | cost | **Operating costs** |
| `other_costs` | cost | **Operating costs** |
| `purchased_services` | cost | **Operating costs** |
| `rents` | cost | **Operating costs** |
| `depreciation` | depreciation | **Depreciation** |
| `financial_income` | financial | **Financial items** |
| `financial_costs` | financial | **Financial items** |
| `investments` | investment | **Investments** |
| `operating_result` | result | **Computed** — do NOT import as input |
| `net_result` | result | **Computed** — do NOT import as input |

### Issues and flags

**Flag 1: `sales_revenue` double-counts with drivers.**

The KVA workbook's "Försäljningsintäkter" subtotal is the *total revenue* including water + wastewater sales. But the projection engine already computes revenue from drivers (`yksikkohinta × myytyMaara`). If we also import `sales_revenue` as a subtotal line and add it to revenue, we double-count.

**Resolution:** The `sales_revenue` subtotal should NOT be fed into the projection as a revenue input. It serves as a **validation reference** ("Excel says 420k; our driver calculation produces 418k — close enough"). The projection should compute revenue solely from drivers + `connection_fees` + `other_income`.

**Recommendation:** Mark `sales_revenue` as `type: 'reference'` or exclude it from projection inputs. Show it in the preview as "Försäljningsintäkter (referens)" with a comparison to computed driver revenue.

**Flag 2: `operating_result` and `net_result` should NOT be persisted as inputs.**

These are computed values. Storing them creates a consistency risk — if the user edits a cost line, the stored result is now stale. They should only appear in the preview as a cross-check, not as `TalousarvioValisumma` rows.

**Recommendation:** Either (a) exclude `type: 'result'` from `confirmKvaImport` persistence, or (b) store them with a `isComputed: true` flag and never use them as projection inputs.

**Flag 3: Missing "Omsättning" / "Förändring i..." rows from the user's label list.**

The user's query mentions these labels from the actual workbook:
- "Omsättning" (Turnover — typically = Försäljningsintäkter)
- "Förändring i intäktsnivån" (Change in revenue level)
- "Lönebikostnader" / "Övriga lönebikostnader" (Payroll taxes)
- "Förändring i lönekostnaderna" (Change in salary costs)
- "Förändring i avskrivningar" (Change in depreciation)
- "Avskrivningar enligt plan" (Depreciation according to plan)
- "Övriga rörelsekostnader" sub-items: Frivilliga personalkostnader, Utrymmes- och fastighetskostnader, Drifts- och underhållskostnader, Resekostnader, Administrativa kostnader
- "Förändring i kostnadsnivån" (Change in cost level)

Of these:

| Label | Covered by current patterns? | Issue |
|-------|-----|-------|
| Omsättning | **No** — not in SUBTOTAL_CATEGORIES | Should map to `sales_revenue` or a separate `turnover` key |
| Förändring i... | **No** — these are year-over-year delta rows | Should be **excluded** — they're not base amounts, they're % changes |
| Lönebikostnader | **No** — only `personalkostnader`/`löner` matches | Should be mapped under `personnel_costs` OR a new `payroll_taxes` category |
| Avskrivningar enligt plan | **Yes** — `avskrivningar` pattern matches | OK |
| Sub-items of Övriga rörelsekostnader | **Partially** — `other_costs` matches the parent, but sub-items (Utrymmes-, Drifts-, etc.) are not individually mapped | Fine if we only need the parent subtotal; **problem** if the sheet only has sub-items without a parent total |

**Recommendation:**
1. Add `omsättning` to the `sales_revenue` pattern.
2. Add `lönebikostnader` to the `personnel_costs` pattern.
3. Explicitly **exclude** "Förändring i..." rows — these are delta/change rows, not base amounts. Add a `SUBTOTAL_EXCLUDE` regex: `/förändring\s*i|change\s*in/i`.
4. Verify with the real workbook (fixture test) whether "Övriga rörelsekostnader" appears as a parent total row or only as sub-items.

**Flag 4: The `energiakerroin` assumption becomes orphaned.**

With subtotal-level data, there's no "42xx energy" account to apply `energiakerroin` to. All operating costs grow with `inflaatio`. The `energiakerroin` assumption key still exists in `DEFAULT_ASSUMPTIONS` but has no effect on subtotal projections.

**Recommendation:** Keep `energiakerroin` in the assumption list (it doesn't hurt). In the subtotal projection path, simply don't use it. Document this: "Energy cost growth is absorbed into general inflation for subtotal-level projections."

---

## Revised Step 1–2 order

The original plan has:
1. Subtotal-first preview API
2. DB schema (TalousarvioValisumma)

This should be reordered and expanded:

### Revised Step 0: Schema + constraint fix (prerequisite)

1. Change `@@unique([orgId, vuosi])` → `@@unique([orgId, vuosi, nimi])` on `Talousarvio`.
2. Add `ValisummaType` enum + `TalousarvioValisumma` model + relation on `Talousarvio`.
3. Run `prisma migrate dev`.
4. Add repository methods: `upsertValisumma`, `findValisummat`.
5. Make `nimi` required (not optional) on `Talousarvio` — or at least default it deterministically.

**Rationale:** Both the preview and confirm steps depend on the schema being ready. The unique constraint fix must happen before "Create budget profile" can work with named profiles.

### Revised Step 1: Preview API fixes

1. Add `subtotalLines` and `availableYears` to `ImportPreviewResult` in `budget-import.service.ts`.
2. Create a new endpoint `POST /budgets/import/preview-kva` that does **not** require a pre-existing budgetId (file upload only).
3. Fix `SUBTOTAL_CATEGORIES`: add `omsättning` to `sales_revenue` pattern; add `lönebikostnader` to `personnel_costs`; add `SUBTOTAL_EXCLUDE` for "Förändring i..." rows.
4. Mark `sales_revenue` and result types as non-projection-inputs in the preview response.

### Revised Step 2: Confirm + persist (new endpoint)

1. `POST /budgets/import/confirm-kva` creates `Talousarvio` + `TalousarvioValisumma` + `Tuloajuri` + optional `TalousarvioRivi` in one `$transaction`.
2. Returns the created budget ID.
3. Excludes `type: 'result'` rows from persistence (or marks them `isComputed`).
4. Does not persist `sales_revenue` as a projection input — only as reference metadata.

Steps 3–8 can proceed as originally planned.

---

## Open questions requiring fixture inspection

| Question | Why it matters | How to resolve |
|----------|---------------|----------------|
| Does KVA totalt have "Omsättning" as a separate row, or only "Försäljningsintäkter"? | Pattern coverage | Run `inspect-kva-full.js` with the real fixture |
| Are "Förändring i..." rows present as data rows with amounts, or as % labels? | Exclusion logic | Same inspection |
| Does "Övriga rörelsekostnader" appear as a parent total, or only as sub-items? | Whether we need the parent or should sum sub-items | Same inspection |
| What year columns exist in KVA totalt? (Are there future projected years like 2025–2034, or only historical?) | Whether "newest year" means a projected year or the last actual | Same inspection |
| Does the moms 0% column actually contain ex-VAT prices, or is it the base price before a different calculation? | VAT handling correctness | Inspect price table rows in fixture |
