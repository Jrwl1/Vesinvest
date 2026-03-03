# Sprint

Window: 2026-03-03 to 2026-05-15

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Deliver a trusted V2 planning flow for Finnish water utilities: durable year deletion behavior, bulk year operations, input-first forecast UX, robust manual percentage editing (5 years + thereafter), explicit VA category modeling, zero-result annual price targeting, and company-specific depreciation rules with full regression safety.

## Recorded decisions (this sprint)

- Zero-result pricing objective is first forecast-year annual result = 0 (recommended baseline).
- Existing cumulative-cash required tariff metric remains available in parallel for continuity.
- VEETI year deletion must be a durable business decision (sync must not resurrect excluded years).
- Forecast remains explicit-compute (no compute-on-keystroke).
- Sprint structure remains exactly 5 active items; additional scope is represented as flat substeps.

---

| ID   | Do                                                                                                                                           | Files                                                                                                                                                                                                                                                            | Acceptance                                                                                                                                                                                                                                                                                                                                                                                       | Evidence                     | Stop                                                                                                                | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| S-16 | Implement durable VEETI year lifecycle: exclusion persistence, batch delete/restore, and no year resurrection after sync. See S-16 substeps. | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts                                                        | Deleted years stay excluded across sync/reload/session; bulk delete works for multiple years with partial-success reporting; restore action re-enables excluded years; Overview no longer auto-reselects years after each refresh in a way that overrides operator intent; linked-scenario guardrails remain enforced with clear per-year reasons.                                               | Substeps 1-5 complete.       | Stop if exclusion persistence requires destructive rewrite of historical report artifacts.                          | READY  |
| S-17 | Rework Forecast to input-first UX and harden manual % editing, including 5 editable years + shared thereafter % model. See S-17 substeps.    | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts                                                                            | Investments and editable growth inputs appear before price/result emphasis on desktop and mobile; stale-result state is clearly shown when drafts exist; invalid/manual % values show inline errors and block save/compute; API supports 5 manual years plus one shared thereafter % value; computation consumes that model deterministically without breaking explicit compute flow.            | Pending: no DO evidence yet. | Stop if 5-year+thereafter model cannot be introduced without breaking existing scenario payload compatibility.      | TODO   |
| S-18 | Add explicit VA 1/2/3 cost-category modeling and zero-result annual water price mode with latest-year comparator. See S-18 substeps.         | apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/projections/projection-engine.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/        | Forecast category growth is explicit for material/services, personnel, and other operating costs; 5-year+thereafter logic applies to those 3 categories; zero-result mode (first forecast year annual result = 0) is available and shown against latest full-year price baseline; cumulative-cash tariff remains visible as separate metric; report snapshot stores both metrics consistently.   | Pending: no DO evidence yet. | Stop if baseline comparator source year is unavailable and cannot be resolved without changing import governance.   | TODO   |
| S-19 | Introduce company-specific depreciation rules by asset class (linear years, residual %, none) and integrate into projection engine.          | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/, apps/api/src/v2/dto/, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/projections/projection-engine.service.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts | Organization can define depreciation rules per asset class; investments can be allocated to classes; engine computes class-based depreciation schedule (linear/residual/none) and aggregates annually; annual depreciation impact from new investments follows company rules; legacy scenarios without rules continue with safe fallback behavior; output remains explainable in UI/report data. | Pending: no DO evidence yet. | Stop if migration would invalidate existing scenario years without a non-destructive fallback path.                 | TODO   |
| S-20 | Hardening and rollout: merge-safe contracts, regression suite, feature flags, and final quality gates. See S-20 substeps.                    | apps/api/src/v2/v2.service.ts, apps/api/src/projections/year-overrides.ts, apps/api/src/, apps/web/src/v2/, e2e/v2.full-flow.spec.ts, docs/BACKLOG.md, docs/SPRINT.md, docs/WORKLOG.md                                                                           | Update paths preserve unknown JSON override keys (no silent data drops); backward compatibility is covered for old/new payloads; API and UI regression coverage includes delete->sync, 5-year+thereafter, zero-result mode, and depreciation rules; feature flags and rollout checks documented; final lint/typecheck/test pass with clean tree and sprint evidence complete.                    | Pending: no DO evidence yet. | Stop if full regression gates fail and cannot be isolated behind feature flags without risking production behavior. | TODO   |

### S-16 substeps

- [x] Add persistent VEETI year policy model for exclusion/restore and create migration

  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:f5f7ed9 | run:pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/prisma/migrations/20260303183000_add_veeti_year_policy/migration.sql, apps/api/prisma/schema.prisma | docs:N/A | status: clean

- [x] Apply exclusion policy in import refresh, available years, and sync selection resolution

  - files: apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts
  - run: pnpm --filter ./apps/api test -- src/v2
  - evidence: commit:00149bc | run:pnpm --filter ./apps/api test -- src/v2 -> PASS | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/veeti/veeti-sync.service.ts | docs:N/A | status: clean

- [x] Add batch delete and restore endpoints with partial-success response contract

  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:0ed058c | run:pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/dto/import-years-bulk.dto.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

- [x] Update Overview V2 for multi-select delete/restore actions and disable auto-default reselection override

  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx
  - evidence: commit:b974b3e | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx -> PASS | files:apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add regression tests for delete->sync->reload persistence and linked-scenario guarded delete behavior
  - files: apps/api/src/v2/, e2e/v2.full-flow.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts
  - evidence: commit:9b785ab | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts -> PASS | files:apps/api/src/v2/v2.service.spec.ts | docs:N/A | status: clean

### S-17 substeps

- [ ] Reorder Forecast V2 layout so investment and editable growth inputs are above pricing/result KPIs

  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add stale-results indicator and KPI de-emphasis when drafts are unsaved

  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Implement frontend near-term % validation with inline errors and save/compute blocking on invalid input

  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Extend V2 scenario contract to support 5 manual years plus shared thereafter percentage

  - files: apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Apply 5-year+thereafter values in scenario mapping/build pipeline and preserve explicit compute semantics
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/projection-engine.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

### S-18 substeps

- [ ] Add explicit VA category mapping and fallback split strategy for 1/2/3 cost buckets

  - files: apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/veeti
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Update projection engine category growth routing to explicit 1/2/3 buckets

  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Implement zero-result solver mode (first forecast-year annual result = 0) with latest full-year comparator baseline

  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/projections
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Expose both pricing modes in V2 APIs and report snapshot payload

  - files: apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Render new pricing outputs and comparator in Forecast and Reports UIs with localized copy
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

### S-19 substeps

- [ ] Add depreciation class/rule schema and migration for linear/residual/none methods

  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add V2 CRUD service/controller paths for company depreciation rules and class allocation inputs

  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/
  - run: pnpm --filter ./apps/api test -- src/v2
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Implement cohort/class depreciation schedule in projection engine and aggregate annually

  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add Forecast UI for manual depreciation rule editing and per-class investment allocation

  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add fallback compatibility tests for scenarios without configured depreciation rules
  - files: apps/api/src/projections/, apps/api/src/v2/
  - run: pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/api test -- src/v2
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

### S-20 substeps

- [ ] Make scenario update paths merge-safe so unknown override keys are preserved (non-destructive updates)

  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/year-overrides.ts
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add backward/forward payload compatibility tests for year-overrides and scenario update contracts

  - files: apps/api/src/v2/, apps/api/src/projections/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/api test -- src/projections
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Extend E2E flow coverage for year exclusion persistence, 5-year+thereafter, zero-result mode, and depreciation rules

  - files: e2e/v2.full-flow.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Add feature flags and rollout checks for staged production enablement

  - files: apps/api/src/v2/, apps/web/src/v2/, docs/BACKLOG.md
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending

- [ ] Run final quality gates and close sprint evidence path
  - files: apps/api/, apps/web/, e2e/, docs/SPRINT.md, docs/WORKLOG.md
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:TBD | run:TBD -> TBD | files:TBD | docs:TBD | status: pending
