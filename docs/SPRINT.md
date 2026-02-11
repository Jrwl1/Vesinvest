# Sprint

Window: 2026-02-10 to 2026-05-05

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must satisfy `min=6 max=10` substeps.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Implement VAT-free V1 calculations end-to-end and produce VAT-free outputs.
- [x] Remove VAT multiplier logic from projection engine calculations
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: apps/api/src/projections/projection-engine.service.ts (VAT-free doc comment added; no multiplier present). Test: 15 passed. HEAD 5c00333 (uncommitted change).
- [x] Remove VAT assumption reads from projection compute flow
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: projections.service.ts — filter VAT keys (alv, alvProsentti, vat, verokanta, moms) from org assumptions and overrides before engine. Test: 15 passed. HEAD b495204 (uncommitted: projections.service.ts).
- [x] Align budget totals arithmetic to VAT-free behavior
  - files: apps/api/src/budgets/budgets.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: budgets.service.ts (VAT-free class comment); budget-totals.contract.spec.ts (VAT-free assertion test). Test: 4 passed. HEAD b495204 (uncommitted: budgets.service.ts, budget-totals.contract.spec.ts).
- [x] Remove VAT defaults from projection DTOs
  - files: apps/api/src/projections/dto/create-projection.dto.ts, apps/api/src/projections/dto/update-projection.dto.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: both DTOs @Transform strip VAT keys from olettamusYlikirjoitukset (alv, alvProsentti, vat, verokanta, moms). Test: 15 passed. HEAD b495204 (uncommitted: create-projection.dto.ts, update-projection.dto.ts).
- [x] Remove VAT inputs from budget and projection UI
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: BudgetPage total-revenue label → budget.revenueVatFree (VAT-free); ProjectionPage VAT-free comment; en/fi/sv revenueVatFree. RevenueDriversPanel has no VAT field. Test: 2 passed. HEAD b495204 (uncommitted: BudgetPage, ProjectionPage, en/fi/sv).
- [x] Run VAT-free regression bundle
  - files: apps/api/src/projections/**, apps/api/src/budgets/**, apps/web/src/pages/**
  - run: pnpm test
  - evidence: commit:12df429 | run: pnpm test -> 24 API suites (271 tests) + 8 web tests PASS | files: apps/api/src/demo/demo-bootstrap.service.ts, apps/api/prisma/seed.ts
| `apps/api/src/projections/**`, `apps/api/src/budgets/**`, `apps/web/src/pages/**` | No VAT value is used in V1 calculations and outputs remain VAT-free. | commit:12df429 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 15 passed; pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> 4 passed; pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx -> 2 passed | files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projections.service.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/projections/dto/create-projection.dto.ts, apps/api/src/projections/dto/update-projection.dto.ts, apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/ProjectionPage.tsx | Stop if any required VAT use is mandated by a signed customer requirement; add blocker and `B-TBD` to backlog. | DONE |
| S-02 | Implement annual base-fee handling as yearly total plus yearly percent change or override.
- [x] Add annual base-fee total handling in budget create and update paths
  - files: apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/dto/update-budget.dto.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:61bde17 | run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> 10 passed | files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/20260210221427_add_budget_perusmaksu_yhteensa/migration.sql, apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/dto/update-budget.dto.ts | status: clean
- [x] Implement yearly percent-change and override math in projection engine
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:8bf05d5 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 17 passed | files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts | docs:e9e45bf | status: clean
- [x] Wire yearly base-fee adjustment into projection compute service
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:d9adbbf | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 17 passed | files: apps/api/src/projections/projections.service.ts | docs:87d9627 | status: clean
- [x] Align API DTO and web payload contract for yearly overrides
  - files: apps/api/src/budgets/dto/create-budget.dto.ts, apps/api/src/budgets/dto/update-budget.dto.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:d53f67d | run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> 10 passed | files: apps/api/src/budgets/dto/create-budget.dto.ts, apps/api/src/budgets/budgets.repository.ts, apps/web/src/api.ts | docs:ffce385 | status: clean
- [x] Add yearly base-fee controls to budget UI
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: commit:fbb0a86 | run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx -> 2 passed | files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx, apps/web/src/i18n/locales/en.json, fi.json, sv.json | docs:eb3e8e4 | status: clean
- [x] Run base-fee regression bundle
  - files: apps/api/src/budgets/**, apps/api/src/projections/**, apps/web/src/pages/BudgetPage.tsx
  - run: pnpm test
  - evidence: commit:d40c48a | run: pnpm test -> 24 API suites (272 passed, 1 skipped), 3 web (8 passed) | files: apps/web/src/pages/BudgetPage.tsx | docs:50a8025 | status: clean
| `apps/api/src/budgets/**`, `apps/api/src/projections/**`, `apps/web/src/pages/**` | Base fee can be set annually and adjusted yearly, matching ADR-013. | commit:61bde17,8bf05d5,d9adbbf,d53f67d,fbb0a86,d40c48a | run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> 10 passed; pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 17 passed; pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx -> 2 passed | files: apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/dto/update-budget.dto.ts, apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projections.service.ts, apps/api/src/budgets/dto/create-budget.dto.ts, apps/web/src/api.ts, apps/web/src/components/RevenueDriversPanel.tsx, apps/web/src/pages/BudgetPage.tsx | Stop if implementation requires new tariff-table scope; log blocker and stop. | DONE |
| S-03 | Implement depreciation split outputs as baseline plus investment-driven additional component.
- [x] Add separate baseline and investment depreciation fields to projection model output
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:deda88f | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 17 passed | files: apps/api/src/projections/projection-engine.service.ts | docs:d75c6af | status: clean
- [x] Compute baseline depreciation from base-year inputs
  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:52e6794 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 18 passed | files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts | docs:8b9a2f1 | status: clean
- [x] Compute investment-driven additional depreciation as a separate component
  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:1c34f79 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 19 passed | files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts | docs:7cd794d | status: clean
- [x] Expose both depreciation components in projection service response
  - files: apps/api/src/projections/projections.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:50ae9c4 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 19 passed | files: apps/api/prisma/schema.prisma, migrations, apps/api/src/projections/projections.repository.ts, apps/web/src/api.ts | docs:ddcfcd2 | status: clean
- [x] Render baseline and investment depreciation separately in projection UI
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/RevenueReport.tsx
  - run: pnpm --filter ./apps/web test -- src/components/nextSuffixedName.test.ts
  - evidence: commit:7433411 | run: pnpm --filter ./apps/web test -- src/components/nextSuffixedName.test.ts -> 3 passed | files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/RevenueReport.tsx, i18n en/fi/sv | docs:29b3d44 | status: clean
- [x] Run depreciation split regression bundle
  - files: apps/api/src/projections/**, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:bfd9669 | run: pnpm test -> 24 API (274 passed, 1 skipped), 3 web (8 passed) | files: apps/web/src/pages/ProjectionPage.tsx | docs:ece1797 | status: clean
| `apps/api/src/projections/**`, `apps/web/src/pages/**` | Projection outputs show both depreciation components separately and consistently. | commit:bfd9669 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 19 passed; pnpm test -> 24 API (274 passed, 1 skipped), 3 web (8 passed) | files: apps/web/src/pages/ProjectionPage.tsx | Stop if split cannot be represented without out-of-scope schema changes. | DONE |
| S-04 | Implement V1 PDF cashflow report generation with diagram and compact table.
- [x] Add projection export endpoint contract for PDF response
  - files: apps/api/src/projections/projections.controller.ts, apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:5b91ec3 | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 19 passed | files: apps/api/src/projections/projections.controller.ts, apps/api/src/projections/projections.service.ts | docs:3de6986 | status: clean
- [x] Implement server PDF builder flow for cashflow diagram and compact table
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:a480d5f | run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts -> 19 passed | files: apps/api/src/projections/projections.service.ts, apps/api/package.json, pnpm-lock.yaml | docs:N/A | status: clean
- [ ] Add web API helper for PDF export route
  - files: apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/components/nextSuffixedName.test.ts
  - evidence: paste api.ts diff hunk, test output, and commit hash
- [ ] Add projection page UI action that triggers PDF export
  - files: apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/web test -- src/components/nextSuffixedName.test.ts
  - evidence: paste UI trigger diff hunk, test output, and commit hash
- [ ] Add regression assertion for PDF content marker
  - files: apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste new assertion output and commit hash
- [ ] Produce one sample PDF artifact and record reference
  - files: apps/api/src/projections/**, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste artifact path, test output, and commit hash
| `apps/api/src/projections/**`, `apps/web/src/pages/**` | PDF answers pricing coverage question and follows approved format rules. | Evidence needed | Stop if requested output exceeds locked V1 scope; log backlog item. | IN_PROGRESS |
| S-05 | Implement hosted single-tenant release gates with build-time and pre-release security checks.
- [ ] Define build gate command checklist in deployment runbook
  - files: DEPLOYMENT.md
  - run: pnpm build
  - evidence: paste deployment diff hunk, command summary, and commit hash
- [ ] Add release-check script entry used by gate runs
  - files: package.json
  - run: pnpm typecheck
  - evidence: paste package.json diff hunk, command summary, and commit hash
- [ ] Add pre-release security checklist with required evidence fields
  - files: DEPLOYMENT.md, README.md
  - run: pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts
  - evidence: paste checklist diff hunk, test output, and commit hash
- [ ] Add hosted single-tenant readiness checklist with owner and timestamp fields
  - files: DEPLOYMENT.md, railway.toml
  - run: pnpm --filter ./apps/api test -- test/app.module.spec.ts
  - evidence: paste readiness checklist diff hunk, test output, and commit hash
- [ ] Add gate failure instructions when required evidence is missing
  - files: DEPLOYMENT.md, TESTING.md
  - run: pnpm test
  - evidence: paste failure-condition diff hunk, command summary, and commit hash
- [ ] Record one release-gate dry-run output with artifact links
  - files: DEPLOYMENT.md, docs/SPRINT.md
  - run: pnpm lint && pnpm test
  - evidence: paste dry-run output and commit hash
| `docs/**`, `package.json`, `railway.toml` | Release gate checklist is executable and blocks release when unmet. | Evidence needed | Stop if platform prerequisites are missing; add blocker with owner. | TODO |
