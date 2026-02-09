# KVA Import Regression — Debug Report

## Section 1: End-to-end trace (evidence)

### 1) FE call that triggers confirm

**Location:** `apps/web/src/components/KvaImportPreview.tsx` (lines 109–151)

- **Handler:** `handleConfirm` calls `confirmKvaImport({ nimi, vuosi, subtotalLines, revenueDrivers, accountLines? })`.
- **Payload shape:**
  - `subtotalLines`: `editedSubtotals.map((s) => ({ palvelutyyppi: s.palvelutyyppi ?? 'muu', categoryKey: s.categoryKey, tyyppi: subtotalToTyyppi(s), summa: s.amount, label: s.categoryName, lahde: 'KVA' }))`.
  - `tyyppi` comes from `subtotalToTyyppi(s)`, which maps:
    - `type === 'income'` → `'tulo'`
    - `type === 'cost'` → `'kulu'`
    - `type === 'depreciation'` → `'poisto'`
    - `type === 'financial'` + categoryKey → `'rahoitus_tulo'` / `'rahoitus_kulu'`
    - `type === 'investment'` → `'investointi'`
    - `type === 'result'` → `'tulos'`
  - **Source of `editedSubtotals`:** Set once from preview: `setEditedSubtotals(result.subtotalLines ?? [])` (line 79). So **only lines returned by the preview API** are sent on confirm.

**API call:** `apps/web/src/api.ts` (lines 1064–1068)

```ts
export async function confirmKvaImport(body: KvaConfirmBody): Promise<KvaConfirmResult> {
  return api<KvaConfirmResult>('/budgets/import/confirm-kva', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
```

**Conclusion:** Whatever is in `result.subtotalLines` from `previewKvaImport()` is what gets sent. If the preview returns only income-type lines, confirm will only send income; cost/investment will never be in the payload.

---

### 2) BE controller / service / repo for confirm-kva

**Controller:** `apps/api/src/budgets/budgets.controller.ts` (lines 120–151)

- `POST /budgets/import/confirm-kva` → `this.service.confirmKvaImport(req.orgId!, body)`.
- Body type includes `subtotalLines` with `tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos'`.

**Service:** `apps/api/src/budgets/budgets.service.ts` — forwards to repo (validation on `nimi`, `vuosi` only).

**Repository:** `apps/api/src/budgets/budgets.repository.ts` (lines 262–370)

- **Persisted:**
  1. **Talousarvio** (budget row).
  2. **TalousarvioValisumma:** `inputSubtotals = data.subtotalLines.filter((s) => s.tyyppi !== 'tulos')` — **all non-`tulos` (result) lines are persisted**, including `kulu`, `poisto`, `rahoitus_kulu`, `investointi`. `createMany` with `talousarvioId`, `palvelutyyppi`, `categoryKey`, `tyyppi`, `summa`, `label`, `lahde`, `createdAt`, `updatedAt`.
  3. **Tuloajuri** (revenue drivers).
  4. **TalousarvioRivi** (optional account lines).

- **No filter** that drops cost/investment: only `tyyppi !== 'tulos'` is applied. So if the request contains `kulu` / `investointi` lines, they are written.

**Conclusion:** Backend persists every received subtotal line whose `tyyppi` is not `'tulos'`. Cost/investment are not stripped server-side.

---

### 3) GET /budgets/:id and how BudgetPage computes totals

**Endpoint:** `GET /budgets/:id` → `BudgetsController.findById` → `BudgetsService.findById` → `BudgetsRepository.findById`.

**Repository:** `apps/api/src/budgets/budgets.repository.ts` (lines 22–31)

```ts
findById(orgId: string, id: string) {
  return this.prisma.talousarvio.findFirst({
    where: { id, orgId: org },
    include: {
      rivit: { orderBy: [...] },
      tuloajurit: { orderBy: [...] },
      valisummat: { orderBy: [{ palvelutyyppi: 'asc' }, { categoryKey: 'asc' }] },
    },
  });
}
```

So the response **includes** `valisummat` (all types: tulo, kulu, poisto, rahoitus_*, investointi, tulos).

**BudgetPage totals:** `apps/web/src/pages/BudgetPage.tsx` (lines 281–317)

- **Revenue:** `revenueLines` (rivit) + `revenueFromValisummat` (valisummat where `tyyppi === 'tulo' | 'rahoitus_tulo'`, and excluding `sales_revenue` when drivers are meaningful) + `computedRevenue` (tuloajurit).
- **Expenses:** `expenseLines` (rivit) + `expenseFromValisummat` = valisummat where `tyyppi === 'kulu' | 'poisto' | 'rahoitus_kulu'`.
- **Investments:** `investmentLines` (rivit) + `investmentFromValisummat` = valisummat where `tyyppi === 'investointi'`.

**Conclusion:** If `valisummat` contained cost/investment rows, they would be summed and shown. INTÄKTER 1,414,004 € implies revenue valisummat (and/or drivers) are present and correct. KOSTNADER and INVESTERINGAR 0 € imply **no valisummat rows with `tyyppi` in { kulu, poisto, rahoitus_kulu } or { investointi }** in the API response — i.e. either they were never stored, or they were never sent.

---

### 4) Where cost/investment subtotals are lost

Chain of possibilities:

| Step | Evidence | Verdict |
|------|----------|--------|
| **Preview extraction** | `extractSubtotalLines` in `kva-template.adapter.ts` (599–729) uses `SUBTOTAL_CATEGORIES` (510–530): income, **cost** (personnel_costs, materials_services, etc.), **depreciation**, **financial**, **investment**, result. Sheets: KVA totalt, Vatten KVA, Avlopp KVA. Rows matched by first-cell label. If the workbook’s cost/investment rows use labels that **don’t match** those patterns (or are in sheets without the selected year column), they are **not extracted**. | **Likely:** Preview can return only income lines for some workbooks (label/pattern or sheet/year mismatch). |
| **Sent from FE** | `editedSubtotals` is exactly `result.subtotalLines ?? []`. No FE filter by type before confirm. So if preview has no cost/investment lines, confirm sends none. | **Confirmed:** FE sends whatever preview returned. |
| **Persisted** | Repo only filters `tyyppi !== 'tulos'`. All other tyyppi (including kulu, investointi) are createMany’d. No server-side drop of cost/investment. | **Confirmed:** Not lost in persist. |
| **Returned by GET** | `findById` includes `valisummat` with no type filter. | **Confirmed:** Not lost in read. |
| **FE totals logic** | `expenseFromValisummat` / `investmentFromValisummat` sum by `tyyppi`. No exclusion of cost/investment. | **Confirmed:** Not lost in UI logic. |

**Precise point of loss:** **Preview response for this workbook does not include cost/investment subtotal lines.** So:

- They are **not** in `result.subtotalLines` → `editedSubtotals` is income-only (plus result-type if any).
- Confirm sends **only** those lines → backend persists only income (and result-type is correctly filtered).
- GET returns only what was persisted → `valisummat` has no kulu/poisto/rahoitus_kulu/investointi.
- BudgetPage correctly sums valisummat → KOSTNADER and INVESTERINGAR stay 0 €.

**Why preview might return only income:** (1) Cost/investment row labels in the workbook don’t match `SUBTOTAL_CATEGORIES` (e.g. different wording/language). (2) Only one sheet (e.g. Vatten KVA) is used and it only has an income row. (3) Selected year has no value in the cost/investment row cells (amount skipped in extraction). (4) `extractSubtotalLines` is called with a `year` that doesn’t exist in the cost/investment sheet, so that sheet is skipped (yearCol is null for that sheet).

---

## Section 2: Root cause(s)

1. **KOSTNADER / INVESTERINGAR 0 €**  
   **Root cause:** Cost and investment subtotals are **never sent** on confirm because they are **missing from the preview response** for this workbook. The backend and FE totals logic behave correctly; the gap is in what `extractSubtotalLines` returns (label/sheet/year matching for cost and investment rows).

2. **KVA modal semi-transparent**  
   **Root cause:** The modal **panel** (`.kva-import-modal`) does not set an opaque background. It only has width, max-height, flex, overflow. The overlay (`.budget-import-overlay`) has `background: rgba(0, 0, 0, 0.4)`. With no solid background on the panel, the overlay shows through the modal content, so the whole dialog looks semi-transparent.

---

## Section 3: Minimal changes (exact files + diffs)

### Task A — Data (ensure cost/investment are extracted and sent)

**1) Verify preview payload (no code change)**  
- In browser: after uploading the KVA file, log or inspect `result.subtotalLines` (and `result.subtotalDebug`) in `KvaImportPreview.tsx` (e.g. right after `setPreview(result)`).  
- Confirm whether any entry has `type === 'cost' | 'depreciation' | 'investment'`.  
- If none, the fix is in extraction (see below). If present, the bug is elsewhere (e.g. confirm payload or backend).

**2) If preview lacks cost/investment — broaden extraction (backend)**  
- **File:** `apps/api/src/budgets/va-import/kva-template.adapter.ts`  
- In `SUBTOTAL_CATEGORIES`, add patterns that match the **actual** cost/investment labels used in the failing workbook (e.g. exact Swedish/Finnish phrases from the sheet).  
- Optionally: in `extractSubtotalLines`, when a sheet has the selected year but a row’s amount is null, still push a line with amount 0 so the category appears in the UI and can be edited (optional product decision).

**3) Optional: ensure subtotalLines always reflects all types (FE)**  
- No change required for “minimal” fix; FE already sends all `editedSubtotals`. If preview is fixed, confirm will send cost/investment.

### Task B — Modal transparency

**File:** `apps/web/src/App.css`

**Rule:** `.kva-import-modal` (around line 7224) has no background, so the overlay shows through.

**Minimal fix:** Give the modal panel an opaque background and ensure it sits above the overlay:

```css
.kva-import-modal {
  width: 90vw;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #ffffff;
  z-index: 1001;
  border-radius: var(--radius, 8px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

- **background: #ffffff** — solid white panel so the overlay doesn’t show through.  
- **z-index: 1001** — above `.budget-import-overlay` (z-index 1000).  
- **border-radius / box-shadow** — optional; matches other modals (e.g. `.budget-import`).

**Backdrop:** Keep `.budget-import-overlay` as is (`background: rgba(0, 0, 0, 0.4)`, z-index 1000). No change.

**Sticky header/footer and scroll:** Already in place (`.kva-preview-controls` sticky, `.kva-preview` overflow-y: auto). Only the panel background and z-index need the change above.

---

## Summary

| Issue | Root cause | Minimal fix |
|-------|------------|------------|
| KOSTNADER / INVESTERINGAR 0 € | Preview returns only income subtotal lines for this workbook; confirm sends only those; backend and FE totals are correct. | Confirm preview payload; extend `SUBTOTAL_CATEGORIES` (and optionally extraction) so cost/investment rows are extracted and returned. |
| Modal semi-transparent | `.kva-import-modal` has no background; overlay shows through. | Add `background: #ffffff` and `z-index: 1001` (and optional border-radius/box-shadow) to `.kva-import-modal` in `App.css`. |
