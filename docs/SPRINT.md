# Sprint

Window: 2026-02-12 to 2026-05-20

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | status: clean`
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

## Recorded decisions (this sprint)

**Sign convention (Option A):** Store all amounts as positive numbers. Tulos (result) = Tulot - Kulut - Poistot - Investoinnit. Existing code in `apps/web/src/pages/BudgetPage.tsx` (totalRevenue, totalExpenses, totalInvestments, netResult) and repo valisummat storage already follow this; import and UI must normalize so costs/depreciation/investments are never stored negative. Guardrails: regression test that expense/depreciation/investment lines never contribute positively to result.

**Rows imported from KVA totalt:** Section headers and P&L rows matched by `SUBTOTAL_CATEGORIES` in `apps/api/src/budgets/va-import/kva-template.adapter.ts` (income, cost, depreciation, financial, investment). Do NOT import rows matching `SUBTOTAL_EXCLUDE` (e.g. "Förändring i...") or `SUBTOTAL_EXCLUDE_FORECAST`. Do NOT import result-type rows (operating_result, net_result); Tulos is always derived. Map to DB tyyppi: tulo, kulu, poisto, rahoitus_tulo, rahoitus_kulu, investointi. Breakdown: persist per (palvelutyyppi, categoryKey, year) so Talousarvio can expand vesi/jätevesi/muu per bucket.

**Missing bucket:** If a bucket (e.g. Investoinnit) has no matching rows for a year, treat as 0 for that year; do not fail import.

**Vuosi selector:** Remove single-year "Vuosi" selector from import confirm. Import applies to all 3 extracted historical years. Confirm flow must create or update one budget per extracted year (e.g. base name "KVA" yields budgets "KVA 2022", "KVA 2023", "KVA 2024" or equivalent); preview already shows per-year cards; confirm payload sends all 3 years' subtotal lines; API creates/updates 3 budgets (one per year).

**Talousarvio tab:** Historical actuals only from KVA import. Remove/disable tuloajurit inputs and any auto-injected revenue row (computed 3000 row) from Talousarvio. Those belong to Forecast/Ennuste (out of scope). Preview modal must not show revenue-driver or template-missing warnings for the default KVA totals flow.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Lock sign convention (Option A) and result calculation; add regression guardrails. See S-01 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/api/src/budgets/**, docs/DECISIONS.md | One sign convention end-to-end; regression test prevents kulut/poistot/investoinnit from contributing positively to result. | 50abc2e 6ed2797 b25e6dc | Stop if domain requires negative storage; log backlog and stop. | READY |
| S-02 | KVA parser: 3 historical years from KVA totalt, bucket totals + breakdown, no Förändring, no result rows. See S-02 substeps below. | apps/api/src/budgets/va-import/**, apps/api/src/budgets/budget-import.service.ts, fixtures/*.xlsx | 3 historical years from KVA totalt; Tulot/Kulut/Poistot/Investoinnit buckets + breakdown; no Förändring, no result rows; missing bucket = 0. | Evidence needed | Stop if parser cannot be deterministic from workbook; log backlog and stop. | IN_PROGRESS |
| S-03 | Import preview UX: bucket-first, expandable per year/bucket; no Vuosi single-year selector; no tuloajurit warnings. See S-03 substeps below. | apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/api.ts | Preview is bucket-first with expandable breakdown per year; no Vuosi selector; no tuloajurit/template warnings; confirm sends 3 years. | Evidence needed | Stop if API contract cannot support 3-year confirm; log backlog and stop. | TODO |
| S-04 | Confirm apply: write 3 budgets (one per year) with breakdown; Talousarvio shows imported history; no tuloajurit on Talousarvio. See S-04 substeps below. | apps/api/src/budgets/**, apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx | Confirm creates 3 budgets with breakdown; Talousarvio shows imported history; no tuloajurit on Talousarvio; result correct. | Evidence needed | Stop if persistence requires forbidden schema migration; log backlog and stop. | TODO |
| S-05 | E2E verification: Talousarvio correct 3-year history, result correct, sign/type regression; root gates. See S-05 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/KvaImportPreview.tsx, apps/api/src/budgets/**, fixtures/*.xlsx | Talousarvio shows imported 3-year data correctly; result = tulot - kulut - poistot - investoinnit; no tuloajurit on Talousarvio; regression prevents sign/type inversion. | Evidence needed | Stop if E2E cannot be automated; add backlog harness and stop. | TODO |

### S-01 substeps
- [x] Document current sign convention in code (Option A: all amounts positive, tulos = tulot - kulut - poistot - investoinnit) and ensure valisummat/rivit are never stored with negative cost amounts
  - files: docs/DECISIONS.md (append ADR), apps/web/src/pages/BudgetPage.tsx, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:50abc2e | run: PASS 28 tests | files: BudgetPage.tsx, budgets.repository.ts | status: clean
- [x] Add normalization in KVA import path so cost/depreciation/investment amounts are stored as positive numbers (no sign flip on import)
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:6ed2797 | run: PASS 77 tests | files: kva-template.adapter.ts, kva-template.adapter.spec.ts, budgets.repository.ts | status: clean
- [x] Add regression test: expense/poisto/investointi lines never increase result (guard against "kulut going green" or type inversion)
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx or apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx AND pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:b25e6dc | run: PASS api 9 + web 4 tests | files: budget-totals.contract.spec.ts | status: clean
- [x] Verify Talousarvio result formula: netResult = totalRevenue - totalExpenses - totalInvestments with no sign errors
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:50abc2e (formula in place) | run: PASS | files: — | status: clean

### S-02 substeps
- [x] Ensure year selection uses first 3 historical (grey) years from sheet KVA totalt only; fixture-backed test
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, fixtures/Simulering av kommande lönsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run: PASS 50 tests | files: kva-template.adapter.spec.ts | status: clean
- [ ] Exclude all "Förändring i..." rows and forecast/prognosis rows from extraction; exclude result-type categories from persisted lines
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Export bucket totals (Tulot, Kulut, Poistot, Investoinnit) and bucket breakdown items per year (names + amounts) so preview and persist can show expandable subrows
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/budget-import.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Handle missing bucket (e.g. no Investoinnit row for a year): treat as 0, do not fail
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Run parser regression bundle
  - files: apps/api/src/budgets/va-import/**, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean

### S-03 substeps
- [ ] Preview: show 4 buckets (Tulot, Kulut, Poistot, Investoinnit) per year with totals; allow expanding a year/bucket to reveal imported subrows (e.g. vesi/jätevesi/muu)
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Remove Vuosi (single-year) selector from confirm step; confirm applies to all 3 extracted years
  - files: apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Remove or hide tuloajurit/revenue-driver and template-missing warnings from KVA modal for default totals flow
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Confirm payload builder: send all 3 years' subtotal lines with year and breakdown (no single selectedYear filter)
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Run web regression for KVA modal
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean

### S-04 substeps
- [ ] API: accept confirm payload with subtotal lines for all extracted years; create or update one budget per year (same base name, year in budget vuosi or name)
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Persist breakdown (subrows per bucket per year) with each budget so Talousarvio can expand same way after import
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/prisma/schema.prisma (if needed)
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Talousarvio page: remove or disable tuloajurit inputs and computed revenue row (3000 / vesimaksut) from Talousarvio tab so only imported historical data and derived result show
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx (or conditional render)
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Talousarvio: result calculation uses only imported valisummat/rivit (tulos = tulot - kulut - poistot - investoinnit); no computedRevenue added on Talousarvio for KVA-imported budgets
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Run cross-stack regression (confirm + BudgetPage)
  - files: apps/api/src/budgets/*.spec.ts, apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/*.test.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/ && pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean

### S-05 substeps
- [ ] Add or extend E2E/fixture test: after KVA import (fixture or mocked), Talousarvio shows correct imported totals for 3 years and derived result; no tuloajurit UI on Talousarvio
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx && pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Regression: assert expense/poisto/investointi amounts never increase result (kulut never "green" / wrong sign or type)
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx or apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Run root quality gates in order: pnpm lint && pnpm typecheck && pnpm test
  - files: package.json, apps/api/**, apps/web/**
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:<hash> | run: PASS | files: ... | status: clean
- [ ] Final verification: Talousarvio shows correct imported history (tulot/kulut/poistot/investoinnit), result calculation correct, no tuloajurit logic on Talousarvio tab
  - files: docs/SPRINT.md (this row Evidence)
  - run: Manual or automated smoke: open Talousarvio after KVA import, verify 3 years and result
  - evidence: commit:<hash> | run: gates PASS; smoke: Talousarvio correct | files: ... | status: clean
