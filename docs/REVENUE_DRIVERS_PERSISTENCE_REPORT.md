# Revenue drivers (Tuloajuri) persistence and read path — report

## 1) Where persisted

- **Endpoint:** `POST /budgets/import/confirm-kva`
- **Controller:** `BudgetsController.confirmKva` (apps/api/src/budgets/budgets.controller.ts)  
  - Reads `body.revenueDrivers` and passes the full `body` to `BudgetsService.confirmKvaImport(req.orgId!, body)`.
- **Service:** `BudgetsService.confirmKvaImport` (budgets.service.ts)  
  - Forwards to `this.repo.confirmKvaImport(orgId, body)` — no filtering of `revenueDrivers`.
- **Repository:** `BudgetsRepository.confirmKvaImport` (budgets.repository.ts)  
  - Inside a `prisma.$transaction`:
    1. Creates `Talousarvio` (budget).
    2. Creates `TalousarvioValisumma` from `subtotalLines`.
    3. **Tuloajuri:** for each `data.revenueDrivers` item, skips when not “meaningful” (all of yksikkohinta, myytyMaara, liittymamaara, perusmaksu are 0/empty). Otherwise calls `tx.tuloajuri.create` with:
       - `talousarvioId`, `palvelutyyppi`, `yksikkohinta`, `myytyMaara`, `perusmaksu ?? null`, `liittymamaara ?? null`, `alvProsentti ?? null`.
    4. Optionally creates `TalousarvioRivi` from `accountLines`.
  - Unique key for drivers is per budget: one row per (talousarvioId, palvelutyyppi) implied by separate creates (no upsert in confirm path). Field names match API/Prisma: `myytyMaara`, `liittymamaara`, etc. (Prisma maps to DB columns via `@map`).

**Conclusion:** Revenue drivers are persisted on confirm-kva; body → controller → service → repo; all driver fields (yksikkohinta, myytyMaara, perusmaksu, liittymamaara, alvProsentti) are passed through and written. No bug found in the persistence path.

---

## 2) Where read (GET /budgets/:id)

- **Endpoint:** `GET /budgets/:id`
- **Controller:** `BudgetsController.findById` → `BudgetsService.findById(req.orgId!, id)`.
- **Service:** `findById` delegates to `BudgetsRepository.findById(orgId, id)`.
- **Repository:** `BudgetsRepository.findById` (budgets.repository.ts) calls:
  - `prisma.talousarvio.findFirst({ where: { id, orgId: org }, include: { rivit: ..., tuloajurit: { orderBy: { palvelutyyppi: 'asc' } }, valisummat: ... } })`.

**Conclusion:** `findById` includes `tuloajurit`; the controller returns the same object. GET /budgets/:id returns the budget with `tuloajurit` populated. No bug found.

---

## 3) Frontend reading the right field

- **API type:** `Budget` (apps/web/src/api.ts) has `tuloajurit?: RevenueDriver[]`; `RevenueDriver` has `palvelutyyppi`, `yksikkohinta`, `myytyMaara`, `perusmaksu`, `liittymamaara`, `alvProsentti`.
- **Fetch:** `getBudget(id)` calls `GET /budgets/${id}` and returns `Budget`.
- **Usage:**
  - **BudgetPage.tsx:** `activeBudget?.tuloajurit`, `isRevenueDriversConfigured(drivers)`, display and status from `tuloajurit`.
  - **RevenuePage.tsx:** `budget?.tuloajurit?.find((d) => d.palvelutyyppi === type)` for vesi/jatevesi; computes revenue from those drivers.

**Conclusion:** Frontend reads revenue drivers from `budget.tuloajurit` (the field returned by GET /budgets/:id). No fix needed.

---

## 4) Test proving persistence and read

- **File:** `apps/api/src/budgets/budgets.repository.spec.ts`
- **Test:** `"persists revenue drivers on confirm and findById returns tuloajurit with numeric fields"`
- **What it does:**
  - Calls `repo.confirmKvaImport(ORG_ID, { vuosi, nimi, subtotalLines: [], revenueDrivers, accountLines: [] })` with:
    - vesi: `yksikkohinta: 1.234`, `myytyMaara: 1000`, `liittymamaara: 200`
    - jatevesi: `yksikkohinta: 2.5`, `myytyMaara: 500`, `liittymamaara: 100`
  - Mocks `prisma.$transaction` so the budget is created with a known id and `tuloajuri.create` is called twice with the above payloads.
  - Mocks `prisma.talousarvio.findFirst` so that for that budget id, the returned budget includes `tuloajurit` with the same two drivers and numeric fields.
  - Asserts: `result.created.revenueDrivers === 2`, `tuloajuri.create` called with the correct data for both palvelutyyppi; then `repo.findById(ORG_ID, result.budgetId)` returns a budget whose `tuloajurit` has length 2 and each driver matches (palvelutyyppi, yksikkohinta, myytyMaara, liittymamaara).

**Run:** `pnpm -C apps/api test -- budgets.repository.spec.ts` — all 22 tests pass, including this one.

---

## 5) Code changes made

- **None** to the persistence or read logic; both were already correct.
- **Added:** one test in `budgets.repository.spec.ts`: “persists revenue drivers on confirm and findById returns tuloajurit with numeric fields” to lock in the behavior and prove the round-trip (confirm → findById → tuloajurit with correct numeric fields).
