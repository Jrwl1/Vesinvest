# KVA Import Routing — Root Cause and Fix

## 1. Root-cause report (evidence-based)

### What was happening

- **User path:** User clicks "Importera från fil" → selects KVA workbook → sees preview → confirms.
- **Frontend:** The **primary** "Importera från fil" entry was wired to the **legacy** flow:
  - **Draft mode** (`BudgetPage.tsx`): "Importera från fil" opened the "Create budget for import" modal; after creating a budget it called `setShowImport(true)` → **BudgetImport** (legacy).
  - **With budget selected:** The visible "Importera från fil" button (secondary) called `setShowImport(true)` → **BudgetImport** (legacy). The **KVA Import** button (primary) was the only way to get the new flow.
- **API used when in legacy flow:** `importBudgetPreview(budgetId, file)` → `POST /budgets/:id/import/preview` (legacy). Same backend `parseFile()` runs and returns `subtotalLines`/`revenueDrivers`/`availableYears` for KVA, but the **UI component** was **BudgetImport**, which only renders `rows` (Blad1 account lines), shows legacy warnings, and does not render the 3-section KVA UI (subtotals, revenue drivers, assumptions). Confirm used `importBudgetConfirm` → `POST /budgets/:id/import/confirm` (writes only `TalousarvioRivi` + drivers, not `TalousarvioValisumma`).
- **Evidence:** Trace points added (and then removed) showed: when user used "Importera från fil", the frontend called the legacy endpoint and rendered `BudgetImport`; the backend response for a KVA file did include `subtotalLines`/`revenueDrivers`/`availableYears`, but the legacy component does not use them.

### What should happen

- **KVA upload** (Excel) must call `POST /budgets/import/preview-kva` and render **KvaImportPreview.tsx** (3 sections: subtotals, revenue drivers, account detail).
- **Confirm** must call `POST /budgets/import/confirm-kva` with the edited payload (subtotals + drivers + optional account lines) and create a named budget in one transaction.
- **Non-KVA import** (CSV or account-level Excel into existing budget) remains unchanged: **BudgetImport** + `POST /budgets/:id/import/preview` and `POST /budgets/:id/import/confirm`.

### Root cause (single sentence)

The main "Importera från fil" action opened the legacy **BudgetImport** flow (which only shows Blad1 rows and legacy confirm); the new KVA flow was only reachable via the separate "KVA Import" button, so users using the main CTA never got preview-kva or KvaImportPreview.

---

## 2. Code changes (minimal delta)

| File | Change |
|------|--------|
| `apps/web/src/pages/BudgetPage.tsx` | Draft mode: "Importera från fil" now opens `setShowKvaImport(true)` (KvaImportPreview) instead of the create-budget modal. With budget: primary button "Importera från fil" opens `setShowKvaImport(true)`; secondary button label set to "Import account-level rows (CSV/Excel)" and still opens `setShowImport(true)`. `onImportComplete` for KvaImportPreview now calls `loadBudget(budgetId)` after `loadBudgets()` so the created budget is selected. |
| `apps/web/src/i18n/locales/en.json` | Added `import.importAccountLines`: "Import account-level rows (CSV/Excel)". |
| `apps/web/src/i18n/locales/sv.json` | Added `import.importAccountLines`: "Tuo tilitason rivit (CSV/Excel)". |
| `apps/web/src/i18n/locales/fi.json` | Added `import.importAccountLines`: "Tuo tilitason rivit (CSV/Excel)". |

No backend changes (routing was frontend-only). No changes to BudgetImport or KvaImportPreview logic beyond removing temporary trace logs.

---

## 3. Verification checklist

### In browser

1. **Network**
   - Click "Importera från fil" (draft or with budget), choose a KVA `.xlsx` file.
   - In DevTools → Network: confirm **`preview-kva`** (or `import/preview-kva`) is called, not `budgets/:id/import/preview`.
   - Response: body includes `subtotalLines`, `revenueDrivers`, `availableYears`, `templateId: "kva"`.

2. **UI**
   - Preview modal shows **3 sections:** Talousarvio (välisummat), Tuloajurit, and collapsible "Tilitason rivit (Blad1)".
   - Subtotals table and revenue drivers table are populated (not only account rows).

3. **Confirm**
   - Enter name, choose year, click "Luo budjetti ...".
   - Network: **`confirm-kva`** (or `import/confirm-kva`) is called with body containing `nimi`, `vuosi`, `subtotalLines`, `revenueDrivers`.
   - New budget appears in the list and is selected; no 500 error.

**Reproduction (post-confirm state):** After clicking "Luo budjetti", the new budget must appear **selected** in the dropdown and the detail view must show subtotals/drivers (not empty 0€). If the UI sometimes showed empty, the fix is to **await** both `loadBudgets()` and `loadBudget(budgetId)` in `onImportComplete` so the created budget is set as `activeBudget` before the next render.

4. **Legacy path**
   - With a budget selected, click "Import account-level rows (CSV/Excel)" (or locale equivalent).
   - Choose same or another file: request goes to `POST /budgets/:id/import/preview`; UI is the legacy account-line table. Confirm uses `POST /budgets/:id/import/confirm`. Behaviour unchanged.

### Automated

- Existing API tests: `kva-template.adapter.spec.ts` and `budgets.repository.spec.ts` / `budgets.service.spec.ts` cover KVA preview response shape and confirm-kva transaction. No new test added; routing is a frontend concern.

---

## 4. If confirm returns 500

- Capture the **response body** and **server log** (PrismaExceptionFilter logs `code`, `message`, `meta` for Prisma errors).
- **Fixed (2026-02):** confirm-kva 500 was caused by `TalousarvioValisumma.createMany` not supplying `createdAt`/`updatedAt`. The migration has `updatedAt` NOT NULL with no DEFAULT; Prisma’s createMany does not apply `@updatedAt` like `create()`, so the DB raised a constraint error. Fix: pass explicit `createdAt` and `updatedAt` (e.g. `new Date()`) in the createMany payload in `budgets.repository.ts`. PrismaExceptionFilter was also updated to return 4xx for P2002 (conflict), P2003 (FK), P2011/P2012 (constraint) instead of 500.
- Other causes: migration not applied → run `npx prisma migrate deploy` in `apps/api`.

---

## 5. Post-confirm empty budget (0€) — root cause and fix (2026-02)

### Evidence

1. **Confirm request/response**
   - **Code:** `apps/web/src/api.ts` → `confirmKvaImport(body)` calls `POST /budgets/import/confirm-kva` (line ~1052). Response type `KvaConfirmResult`: `{ success, budgetId }`.
   - **Code:** `apps/web/src/components/KvaImportPreview.tsx` (lines 135–145): on success calls `onImportComplete(result.budgetId)`.
   - **Server:** `apps/api/src/budgets/budgets.controller.ts` (lines 120–151): `confirmKva()` returns `service.confirmKvaImport(req.orgId!, body)`. No demo guard; writes use same orgId as token.
   - **Conclusion:** Confirm returns 2xx and `budgetId`; client receives it and calls the callback. Demo mode does not block persist (same org).

2. **Why UI showed "KVA 2023" in dropdown but 0€**
   - **Code:** `apps/web/src/pages/BudgetPage.tsx`: `value={isDraftMode ? '__new__' : (activeBudget?.id ?? '')}`. When `activeBudget` is null we are in draft mode and `value` is `''`. The `<select>` has no option with `value=""`, so the browser can **display the first option’s label** ("KVA 2023") while the controlled value is still empty.
   - **Code:** After confirm we did `await loadBudgets(); await loadBudget(budgetId);`. If `loadBudget(budgetId)` **failed** (network, 404, 500), we never called `setActiveBudget(data)`, so `activeBudget` stayed null → draft mode → 0€ everywhere. The list from `loadBudgets()` already contained the new budget, so the first option was "KVA 2023".
   - **Conclusion:** Root cause: **no optimistic selection** when `loadBudget` fails or is slow; plus the Budget page only used **rivit** for section totals, while KVA creates **valisummat** (and tuloajurit), so even after a successful load, KVA-only budgets showed 0€ for revenue/expense/investment from subtotals.

3. **Data read path**
   - **Endpoint:** `GET /budgets/:id` → `BudgetsController.findById` → `BudgetsService.findById` → `BudgetsRepository.findById` (`apps/api/src/budgets/budgets.repository.ts` lines 22–31). `findById` includes `rivit`, `tuloajurit`, `valisummat`. So the API returns all three; the frontend previously did not use `valisummat` for section totals.

### Fix (minimal)

| File | Change |
|------|--------|
| `apps/web/src/pages/BudgetPage.tsx` | **Optimistic selection:** In `onImportComplete(budgetId)`, after `loadBudgets()`, set `activeBudget` to the list item matching `budgetId` (stub with empty `rivit`/`tuloajurit`/`valisummat`) so the dropdown and `isDraftMode` are correct immediately. Then `await loadBudget(budgetId)`; on failure set error message but keep the optimistic budget. **Valisummat totals:** Derive `revenueFromValisummat`, `expenseFromValisummat`, `investmentFromValisummat` from `activeBudget.valisummat` (by `tyyppi`: tulo/rahoitus_tulo → revenue; kulu/poisto/rahoitus_kulu → expense; investointi → investment) and add them to section totals so KVA-imported budgets show data. |
| `apps/web/src/api.ts` | Add `BudgetValisumma` interface and `valisummat?: BudgetValisumma[]` on `Budget`. |
| `apps/web/src/i18n/locales/*.json` | Add `budget.loadFailedAfterImport` for load error after import. |
| `apps/api/src/budgets/budgets.service.spec.ts` | Add `findById` test: returns budget with `valisummat` and `tuloajurit` so KVA-imported budget is readable. |

### Tests

- **Backend:** `BudgetsService.findById` test: mock repo returns a budget with `valisummat` and `tuloajurit`; assert service returns the same (read path contract).
- **Manual repro (deterministic):**  
  1. Open Budget page (draft or with a budget).  
  2. Click "Importera från fil" → choose KVA `.xlsx` → preview shows subtotals/drivers.  
  3. Enter name "KVA 2023", year 2023, click "Luo budjetti 'KVA 2023'".  
  4. **Expect:** Dropdown shows "KVA 2023" as selected; sections show non-zero totals (from valisummat + drivers), not 0€.  
  5. If "Budget created but loading details failed" appears, select the budget from the dropdown or refresh; confirm GET `/budgets/:id` in Network returns 200 with `valisummat` and `tuloajurit`.

### Commit-style summary

```
fix(budget): KVA import post-confirm empty budget (0€) — selection + valisummat

- Root cause: loadBudget(budgetId) could fail/slow so activeBudget stayed null
  while dropdown showed first option "KVA 2023" (browser displays first option
  when value is ''). Also Budget page only used rivit for totals; KVA creates
  valisummat so sections showed 0€.
- Optimistic selection: after confirm-kva, set activeBudget from list by
  budgetId so dropdown and isDraftMode are correct; then loadBudget(budgetId)
  to fill full data; on error show loadFailedAfterImport, keep selection.
- Use valisummat for section totals (revenue/expense/investment by tyyppi) so
  KVA-imported budgets show subtotals immediately.
- Add BudgetValisumma type and budget.loadFailedAfterImport i18n.
- Backend: add findById test that returns budget with valisummat and tuloajurit.
```
