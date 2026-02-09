# KVA revenue drivers — log stages (TEMP)

TEMP logs are in place to prove what `revenueDrivers` / `tuloajurit` contain at each stage. **Remove these logs in Step 3** (see comment in repo and DEV guards in web).

## Stages and where to look

| Stage | Where | Log prefix / what |
|-------|--------|-------------------|
| **1) preview-kva response** | Browser console (after upload) | `[KVA TEMP] 1) preview-kva response revenueDrivers:` — `length` + per-driver `{ palvelutyyppi, yksikkohinta, myytyMaara, perusmaksu, liittymamaara, alvProsentti }` |
| **2) confirm-kva request** | Browser console (on Confirm) | `[KVA TEMP] 2) confirm-kva request payload.revenueDrivers:` — same shape. Then `[KVA TEMP] 2b) confirm-kva response:` — `budgetId` |
| **3) confirm-kva persistence** | API terminal (Node) | `[KVA TEMP] 3) confirmKvaImport input revenueDrivers:` — input to repo. Then `[KVA TEMP] 3b) confirmKvaImport tuloajuri rows created:` — count |
| **4) GET /budgets/:id** | Browser console (after load) | `[KVA TEMP] 4) GET /budgets/:id tuloajurit:` — `budgetId`, `length`, and per-driver fields (includes `id`) |

## Code references

- **1 & 2:** `apps/web/src/components/KvaImportPreview.tsx` — after `previewKvaImport(f)` and before/after `confirmKvaImport(payload)` (guarded by `import.meta.env.DEV`).
- **3:** `apps/api/src/budgets/budgets.repository.ts` — inside `confirmKvaImport` `$transaction` (guarded by `process.env.NODE_ENV !== 'production'`).
- **4:** `apps/web/src/pages/BudgetPage.tsx` — in `loadBudget` after `getBudget(id)` (guarded by `import.meta.env.DEV`).

## Observed structures (fill after running locally)

After uploading the fixture and clicking Confirm, paste or describe what you see:

- **previewDrivers:** e.g. `[{ palvelutyyppi: 'vesi', yksikkohinta: 1.2, myytyMaara: undefined, ... }, { palvelutyyppi: 'jatevesi', ... }]`
- **payloadDrivers:** Same shape as preview (after filter: only drivers with at least one meaningful field).
- **persistedDrivers:** Same count as `3b)` log; input to repo matches payload.
- **getBudget drivers:** Array with `id`, `talousarvioId`, same fields; Prisma returns `yksikkohinta`/`myytyMaara` as string (Decimal).

## Fixture expectation

With the current KVA fixture (no volume/connections in Vatten KVA, Avlopp KVA, Anslutningar for 2023):

- **Unit price (yksikkohinta) and ALV (alvProsentti)** can be present (from KVA totalt / Blad1 price table).
- **Volume (myytyMaara) and connections (liittymamaara)** are expected to be **missing** or zero; the adapter does not read them from KVA totalt and the fixture may not have them in the service sheets. So preview may show drivers with only `yksikkohinta` (and maybe `alvProsentti`); confirm still sends them; backend persists them; GET returns them.

No production behavior changed; logs are DEV-only (web) or non-production (api).
