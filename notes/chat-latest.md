# Chat latest
Paste conversation excerpts or summaries here for OpenClaw/Cursor.
Paste the excerpt below this line.

---

# Recent repo changes (auto summary)
Date: 2026-02-09
Range: last 20 commits (from 2fad001..d876517)

## Key themes
- KVA (water utility) Excel import pipeline: preview API, confirm endpoint, revenue drivers (volume m³, connections, unit price), subtotal-first extraction, VAT handling (moms 0% for ex-VAT).
- Budget schema: budget profiles, TalousarvioValisumma table and migrations; unique constraint rename; valisummat dedupe and P2002 handling.
- Frontend: KVA import modal (opaque panel, 409 UX), subtotal-first preview redesign, RevenueDriversPanel in Tulot, overlay/click-to-close polish.
- Tests: fixture tests for 2023 drivers, confirm-then-GET persistence tests, partial-driver persistence test, Step 2/3/8 and projection/subtotal tests.

## Commit highlights
- d876517 — KVA drivers: persist partial drivers, Tulot panel, tests; remove TEMP logs
  - Files: budgets.repository.ts, budgets.repository.spec.ts, KvaImportPreview.tsx, BudgetPage.tsx, RevenueDriversPanel.tsx, App.css, vite.config.ts, package.json, pnpm-lock.yaml, docs/KVA_DRIVERS_LOG_STAGES.md, docs/KVA_IMPORT_DRIVERS_CHECKLIST.md, +2 more
  - confirmKvaImport persists tuloajurit when any of yksikkohinta/perusmaksu/myytyMaara/liittymamaara > 0; decimals coerced with Number().
  - RevenueDriversPanel extracted; BudgetPage uses it in Tulot; Vitest + @testing-library/react for component tests; TEMP logs removed.
- 447d7cf — KVA import: fix driver extraction, migration, web and demo tweaks
  - Files: kva-template.adapter.ts, kva-template.adapter.spec.ts, va-import.types.ts, migration (unique constraint), demo-reset.service.ts, KvaImportPreview.tsx, nextSuffixedName.test.ts, vite.config.ts, docs/KVA_REGRESSION_DEBUG.md, pnpm-lock.yaml, +1 more
  - Volume only from Vatten KVA / Avlopp KVA year column; connections only from Anslutningar year column; no fake fallback to 1; single warnings when missing.
- 93f2956 — budgets: prove revenue drivers persisted on confirm-kva and returned by GET :id
  - Files: budgets.repository.spec.ts, docs/REVENUE_DRIVERS_PERSISTENCE_REPORT.md
  - Integration-style test: confirmKvaImport then findById asserts tuloajurit (yksikkohinta, myytyMaara, liittymamaara); doc on where persisted/read.
- 3266d34 — fix(kva): revenue drivers extraction - volume and connection count for fixture 2023
  - Files: kva-template.adapter.ts
  - Volume: rowTextFull, next-row fallback, KVA totalt fallback; connections: CONNECTION_LABELS, isYearLike, table-year range, scan rows; getYearColumnsInSheetWide; 54 tests pass.
- 00e9a5a — test(api): add failing fixture test for revenue drivers (volume + connections) 2023
  - Files: kva-template.adapter.spec.ts
  - Fixture asserts myytyMaara > 0 and liittymamaara > 0 for vesi/jatevesi; expected to fail until Step 3.
- d8d92ea — KVA/budget: P2002 debug, valisummat dedupe, no double-count, drivers debug
  - Files: budgets.repository.ts, budgets.repository.spec.ts, kva-template.adapter.ts, prisma-exception.filter.ts, prisma.service.ts, budgetValisummatFilter.ts, BudgetPage.tsx, App.css, inspect-talousarvio-constraints.js, +4 more
- 2b153b1 — fix(web): KVA import modal opaque panel + 409 conflict UX
  - Files: KvaImportPreview.tsx, App.css, api.ts
- c75b297 — fix(va-import): best-label subtotal extraction + Step 2/3 tests
  - Files: kva-template.adapter.ts, kva-template.adapter.spec.ts, va-import.types.ts
- 922d427 — fix(KVA): post-confirm selection, no revenue double-count, volume anywhere in row
  - Files: budgets.repository.ts, budgets.repository.spec.ts, budget-totals.contract.spec.ts, kva-template.adapter.ts, BudgetPage.tsx, api.ts, i18n (en/fi/sv), prisma-exception.filter.ts, docs/KVA_IMPORT_ROUTING_FIX.md, +2 more
- 7c8223a — test: Step 8 - comprehensive testing coverage for KVA import pipeline
  - Files: projection-engine.spec.ts
- c9e5312 — fix(web): Step 7 - frontend polish: overlay fixes, responsive KVA import, click-to-close
  - Files: BudgetImport.tsx, App.css
- b4c3f24 — feat(projections): Step 6 - computeFromSubtotals for subtotal-based projections
  - Files: projection-engine.service.ts, projection-engine.spec.ts, projections.service.ts
- a5d9508 — feat(web): Step 5 - KVA import preview redesign with subtotal-first UI
  - Files: KvaImportPreview.tsx, BudgetPage.tsx, api.ts, App.css
- e6de0f2 — feat(kva): Step 4 - VAT handling: use moms 0% for ex-VAT unit prices
  - Files: kva-template.adapter.ts, kva-template.adapter.spec.ts
- 2ff62a9 — feat(api): Step 2 - KVA confirm endpoint with transactional persistence
  - Files: budgets.controller.ts, budgets.repository.ts, budgets.repository.spec.ts, budgets.service.ts, budgets.service.spec.ts
- a2e38b6 — feat(api): Step 1 - preview API with subtotals, new preview-kva endpoint
  - Files: budget-import.service.ts, budgets.controller.ts, budgets.service.ts, kva-template.adapter.ts, kva-template.adapter.spec.ts
- 18ea3ac — feat(schema): Phase 0 - budget profiles + TalousarvioValisumma table
  - Files: schema.prisma, migration, budgets.repository.ts, budgets.repository.spec.ts, budgets.service.ts, projections.repository.ts
- c97c06a — docs: KVA perfect import plan + sanity check report
  - Files: docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md, docs/SANITY_CHECK_KVA_PERFECT_PLAN.md
- f1eea26 — feat(kva): two-tier import strategy with subtotal-level P&L extraction
  - Files: kva-template.adapter.ts, kva-template.adapter.spec.ts, va-import.types.ts, inspect-kva-full.js, docs/EXCEL_IMPORT_VA_FULL_PLAN.md
- 2fad001 — fix(kva): robust price table detection and volume m3-only exclude revenue
  - Files: kva-template.adapter.ts, kva-template.adapter.spec.ts

## Risks / follow-ups
- Unique constraint on TalousarvioValisumma was renamed (migration); ensure no leftover P2002 in production.
- Revenue driver extraction depends on sheet layout (Vatten KVA, Avlopp KVA, Anslutningar); fixture 2023 is the reference; regressions documented in KVA_REGRESSION_DEBUG.md.
- Lockfile and web deps (Vitest, testing-library) changed; confirm CI and local installs green.
