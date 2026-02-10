# Sprint

Window: 2026-02-10 to 2026-05-05

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must satisfy `min=6 max=10` substeps.
Evidence policy: Option A (commit-per-substep). Each checked substep must include commit hash + run summary + changed files.
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Implement VAT-free V1 calculations end-to-end and produce VAT-free outputs.
- [x] Remove VAT multiplier logic from projection engine calculations
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: apps/api/src/projections/projection-engine.service.ts (VAT-free doc comment added; no multiplier present). Test: 15 passed. HEAD 5c00333 (uncommitted change).
- [ ] Remove VAT assumption reads from projection compute flow
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste diff hunk, test output, and commit hash
- [ ] Align budget totals arithmetic to VAT-free behavior
  - files: apps/api/src/budgets/budgets.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: paste changed file paths, test output, and commit hash
- [ ] Remove VAT defaults from projection DTOs
  - files: apps/api/src/projections/dto/create-projection.dto.ts, apps/api/src/projections/dto/update-projection.dto.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste DTO diff hunk, test output, and commit hash
- [ ] Remove VAT inputs from budget and projection UI
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: paste changed file paths, test output, and commit hash
- [ ] Run VAT-free regression bundle
  - files: apps/api/src/projections/**, apps/api/src/budgets/**, apps/web/src/pages/**
  - run: pnpm test
  - evidence: paste command summary and commit hash
| `apps/api/src/projections/**`, `apps/api/src/budgets/**`, `apps/web/src/pages/**` | No VAT value is used in V1 calculations and outputs remain VAT-free. | Not eligible (status != READY); uncommitted: apps/api/src/projections/projection-engine.service.ts; row acceptance evidence incomplete. | Stop if any required VAT use is mandated by a signed customer requirement; add blocker and `B-TBD` to backlog. | IN_PROGRESS |
| S-02 | Implement annual base-fee handling as yearly total plus yearly percent change or override.
- [ ] Add annual base-fee total handling in budget create and update paths
  - files: apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/dto/update-budget.dto.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: paste changed file paths, test output, and commit hash
- [ ] Implement yearly percent-change and override math in projection engine
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste diff hunk, test output, and commit hash
- [ ] Wire yearly base-fee adjustment into projection compute service
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste changed file paths, test output, and commit hash
- [ ] Align API DTO and web payload contract for yearly overrides
  - files: apps/api/src/budgets/dto/create-budget.dto.ts, apps/api/src/budgets/dto/update-budget.dto.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: paste DTO and API diff hunk, test output, and commit hash
- [ ] Add yearly base-fee controls to budget UI
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: paste UI diff hunk, test output, and commit hash
- [ ] Run base-fee regression bundle
  - files: apps/api/src/budgets/**, apps/api/src/projections/**, apps/web/src/pages/BudgetPage.tsx
  - run: pnpm test
  - evidence: paste command summary and commit hash
| `apps/api/src/budgets/**`, `apps/api/src/projections/**`, `apps/web/src/pages/**` | Base fee can be set annually and adjusted yearly, matching ADR-013. | Evidence needed | Stop if implementation requires new tariff-table scope; log blocker and stop. | TODO |
| S-03 | Implement depreciation split outputs as baseline plus investment-driven additional component.
- [ ] Add separate baseline and investment depreciation fields to projection model output
  - files: apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste model-field diff hunk, test output, and commit hash
- [ ] Compute baseline depreciation from base-year inputs
  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste baseline assertion output and commit hash
- [ ] Compute investment-driven additional depreciation as a separate component
  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste additional-component assertion output and commit hash
- [ ] Expose both depreciation components in projection service response
  - files: apps/api/src/projections/projections.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste service and API diff hunk, test output, and commit hash
- [ ] Render baseline and investment depreciation separately in projection UI
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/RevenueReport.tsx
  - run: pnpm --filter ./apps/web test -- src/components/nextSuffixedName.test.ts
  - evidence: paste UI diff hunk, test output, and commit hash
- [ ] Run depreciation split regression bundle
  - files: apps/api/src/projections/**, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste split consistency output and commit hash
| `apps/api/src/projections/**`, `apps/web/src/pages/**` | Projection outputs show both depreciation components separately and consistently. | Evidence needed | Stop if split cannot be represented without out-of-scope schema changes. | TODO |
| S-04 | Implement V1 PDF cashflow report generation with diagram and compact table.
- [ ] Add projection export endpoint contract for PDF response
  - files: apps/api/src/projections/projections.controller.ts, apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste endpoint diff hunk, test output, and commit hash
- [ ] Implement server PDF builder flow for cashflow diagram and compact table
  - files: apps/api/src/projections/projections.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: paste PDF builder diff hunk, test output, and commit hash
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
| `apps/api/src/projections/**`, `apps/web/src/pages/**` | PDF answers pricing coverage question and follows approved format rules. | Evidence needed | Stop if requested output exceeds locked V1 scope; log backlog item. | TODO |
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
