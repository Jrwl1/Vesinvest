# KVA import → revenue drivers: end-to-end checklist

## 1) Payload wiring

| Step | Location | What to verify |
|------|----------|----------------|
| **Preview → confirm payload** | `apps/web/src/components/KvaImportPreview.tsx` | `buildPayload()` builds `revenueDrivers` from `editedDrivers` (initialized from `result.revenueDrivers` on upload). Filter keeps drivers with any of: `yksikkohinta`, `myytyMaara`, `liittymamaara`, `perusmaksu` > 0 (aligned with backend “meaningful” check). Mapped fields: `palvelutyyppi`, `yksikkohinta`, `myytyMaara`, `perusmaksu`, `liittymamaara`, `alvProsentti`. Ex-VAT unit price comes from preview (backend sends ex-VAT in KVA preview). |
| **API send** | `apps/web/src/api.ts` | `confirmKvaImport(body: KvaConfirmBody)` sends `POST /budgets/import/confirm-kva` with `body: JSON.stringify(body)`. `KvaConfirmBody` requires `revenueDrivers: Array<...>`. Full body (including `revenueDrivers`) is sent. |
| **Backend consume** | `apps/api/src/budgets/budgets.controller.ts` | `confirmKva()` receives `body` with `revenueDrivers` and passes to `service.confirmKvaImport(req.orgId!, body)`. |
| **Service** | `apps/api/src/budgets/budgets.service.ts` | `confirmKvaImport(orgId, body)` forwards to `repo.confirmKvaImport(orgId, body)`. |
| **Repository** | `apps/api/src/budgets/budgets.repository.ts` | `confirmKvaImport()` in `$transaction`: (1) creates budget, (2) creates valisummat from `subtotalLines`, (3) for each `data.revenueDrivers` with meaningful fields creates `tuloajuri` (yksikkohinta, myytyMaara, perusmaksu, liittymamaara, alvProsentti). |

**Code references**

- Payload build: `KvaImportPreview.tsx` → `handleConfirm` → `buildPayload(nimi)` → `revenueDrivers` array.
- API: `api.ts` → `confirmKvaImport(body)` → `api(..., { body: JSON.stringify(body) })`.
- Controller: `budgets.controller.ts` → `@Post('import/confirm-kva')` → `this.service.confirmKvaImport(req.orgId!, body)`.
- Repo: `budgets.repository.ts` → `confirmKvaImport()` → `tx.tuloajuri.create({ data: { talousarvioId, palvelutyyppi, yksikkohinta, myytyMaara, ... } })`.

---

## 2) Post-confirm navigation / selection

| Step | Location | What to verify |
|------|----------|----------------|
| **On success** | `apps/web/src/pages/BudgetPage.tsx` | `KvaImportPreview` `onImportComplete(budgetId)`: (1) closes overlay, (2) `loadBudgets()` then sets `activeBudget` from list stub (empty rivit/tuloajurit/valisummat) so the new budget is selected, (3) `loadBudget(budgetId)` loads full budget and sets `activeBudget` with `tuloajurit`/`valisummat` so the Tulot drivers panel is populated immediately. |
| **On loadBudget failure** | Same | `catch` sets error message; `activeBudget` remains the stub (empty drivers). User can re-select the same budget in the dropdown to trigger `loadBudget` again and retry. |

**Code references**

- `BudgetPage.tsx`: `onImportComplete={async (budgetId) => { ... setActiveBudget({ ...fromList, rivit: [], tuloajurit: [], valisummat: [] }); try { await loadBudget(budgetId); } catch { setError(...); } }}`.
- `loadBudget(id)` → `getBudget(id)` → `setActiveBudget(data)`; GET response includes `tuloajurit` (repository `findById` include).

---

## 3) Contract / integration test (backend)

| Test | File | What it proves |
|------|------|----------------|
| **Same transaction** | `apps/api/src/budgets/budgets.repository.spec.ts` | `confirmKvaImport creates valisummat and tuloajurit in same transaction (contract)`: calls `confirmKvaImport` with both `subtotalLines` and `revenueDrivers`, then asserts `$transaction` called once, `talousarvioValisumma.createMany` called, and `tuloajuri.create` called. |
| **Drivers persisted and readable** | Same | `persists revenue drivers on confirm and findById returns tuloajurit with numeric fields`: confirm with vesi/jatevesi drivers, then `findById` returns budget with `tuloajurit` containing those values. |

Run: `pnpm -C apps/api test -- budgets.repository.spec.ts`

---

## 4) Frontend component test

No separate frontend E2E or component test was added; existing flow is covered by the backend contract tests and the checklist above. If test infra exists later, add a test that mocks `confirmKvaImport` and `getBudget` and asserts that after “confirm” the drivers panel receives and displays `tuloajurit`.

---

## Summary

- **Payload:** KvaImportPreview sends `revenueDrivers` (ex-VAT unit price, volume, connections, base fee) in the confirm body; api.ts sends full body; controller/service/repo consume and persist in one transaction.
- **Display:** After confirm, BudgetPage calls `loadBudget(budgetId)` so `activeBudget.tuloajurit` is filled and the Tulot Tuloajurit panel shows drivers immediately; on load failure, error is shown and user can re-select budget to retry.
- **Tests:** Backend repo spec has a contract test that confirm-kva creates both valisummat and tuloajurit in the same transaction, plus the existing test that findById returns persisted drivers.
