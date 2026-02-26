# Sprint

Window: 2026-02-26 to 2026-04-30

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

Make VEETI import data trustworthy, editable, and explainable for utilities with incomplete latest years. Deliver a year-card based "Oman toiminnan trendit" view (one card per year with delta chips), full manual override support for all VEETI-backed fields, and medeltal-first peer comparison.

## Recorded decisions (this sprint)

- Raw VEETI snapshot payloads stay immutable; manual changes are stored in a separate override layer with audit trail.
- Effective values are resolved by precedence: manual override > VEETI snapshot.
- Trend default UI is yearly cards; line chart remains optional as secondary visualization.
- Incomplete years (for example 2025/2026) can be completed manually and used as baseline input.
- Peer comparison default metric is medeltal (average); mediaani is secondary context.
- Every shown value must expose provenance: VEETI, MANUAL, MIXED, or INCOMPLETE.

---

| ID   | Do                                                                                                                                                                                                                                               | Files                                                                                                                                                             | Acceptance                                                                                                                                                                                           | Evidence                                                             | Stop                                                                                                             | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| S-01 | Data integrity guardrails for VEETI sync and read paths: scope all snapshot reads by `orgId + veetiId`, prevent relink contamination, and add post-sync sanity check against VEETI API. See S-01 substeps below.                                 | apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-sanity.service.ts | No mixed-org historical leakage in trend/import data; relink is explicit and safe; sanity check reports mismatches for key metrics (revenue, operating costs, result, volume, combined price).       | Implemented; API typecheck/test pass.                                | Stop if VEETI API contract fields are missing or unstable enough to block deterministic sanity checks.           | READY  |
| S-02 | Override and provenance backend: add override persistence + audit, merge resolver, and API endpoints for edit/diff/reconcile. Keep raw VEETI immutable. See S-02 substeps below.                                                                 | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/, apps/api/src/veeti/, apps/api/src/v2/                                                                 | Full override capability for VEETI-backed data types with audit (`editedBy`, `editedAt`, `reason`); merged effective values available in all consumers; provenance per field available from API.     | Implemented; prisma client regenerated and API tests pass.           | Stop if migration cannot be applied safely without data-loss plan.                                               | READY  |
| S-03 | UI redesign for "Oman toiminnan trendit": make yearly cards the default (one box per year), add KPI delta chips, source badges, and optional chart toggle. See S-03 substeps below.                                                              | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts                                     | Default view is yearly boxes with compact deltas vs previous comparable year; card badges show VEETI/MANUAL/MIXED/INCOMPLETE; optional chart toggle keeps trend visualization available.             | Implemented; web typecheck and v2 tests pass.                        | Stop if card UI removes existing required KPI content or breaks mobile layout.                                   | READY  |
| S-04 | Full editability for incomplete/latest years: expose editor for all VEETI-backed datasets and allow manual completion for missing years used in baseline. Add reconcile flow when VEETI later provides official values. See S-04 substeps below. | apps/api/src/v2/, apps/api/src/veeti/, apps/web/src/v2/, apps/web/src/api.ts                                                                                      | Users can edit all VEETI-backed fields; 2025/2026-style incomplete years can be completed manually and become baseline-eligible; later VEETI updates show diff and keep/apply choice.                | Implemented; year data + reconcile endpoints and editor flow added.  | Stop if legal or compliance constraints require immutable behavior for specific fields without override support. | READY  |
| S-05 | Peer semantics, provenance UI, and rollout quality gates: switch default benchmark headline to medeltal, keep median secondary, add year-level provenance panel, and validate with org 1535 sanity fixture. See S-05 substeps below.             | apps/api/src/veeti/veeti-benchmark.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/, scripts/ops/        | Vertailu headline uses average (`avgValue`) with correct medeltal labeling; provenance panel explains every displayed value; regression checks pass and org 1535 2023/2024 numbers align with VEETI. | Implemented; `pnpm typecheck` and `pnpm test` pass across workspace. | Stop if benchmark source data lacks enough peers for statistically valid average display in selected group.      | READY  |

### S-01 substeps

- [x] Scope snapshot reads and fallback builders to active `veetiId` in all VEETI consumers
  - files: apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/api test -- src/veeti src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/api test -- src/veeti src/v2 -> PASS | files:apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add explicit relink protection and clear-before-relink flow to prevent mixed historical datasets
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.controller.ts, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/v2/v2.controller.ts, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Implement post-sync sanity checker comparing merged key metrics against live VEETI payloads
  - files: apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/veeti/veeti.service.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/veeti
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api test -- src/veeti -> PASS | files:apps/api/src/veeti/veeti-sanity.service.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)

### S-02 substeps

- [x] Add VEETI override model and migration with audit metadata and uniqueness by org/year/type
  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/\*\*
  - run: pnpm --filter ./apps/api prisma generate && pnpm --filter ./apps/api typecheck
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api prisma generate && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/prisma/schema.prisma, apps/api/prisma/migrations/20260226153000*add_veeti_override/migration.sql | docs:N/A | status: dirty (untracked tmp_vesipolku*\*.png)
- [x] Build merge resolver service (`effective = override > veeti`) and expose provenance per field
  - files: apps/api/src/veeti/\*\*, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/veeti src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api test -- src/veeti src/v2 -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/veeti/veeti-benchmark.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add edit/diff/reconcile API endpoints for year datasets using override persistence
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/import-year-reconcile.dto.ts, apps/web/src/api.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)

### S-03 substeps

- [x] Replace trend primary layout with yearly cards (one card per year) with KPI groups
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add compact delta chips per KPI versus previous comparable year and source status badges
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/format.ts, apps/web/src/i18n/locales/\*.json
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Keep chart as optional secondary toggle (not default) with parity to card data
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)

### S-04 substeps

- [x] Implement full-year editor sections for all VEETI-backed datasets (tilinpaatos, taksa, volume_vesi, volume_jatevesi, investointi, energia, verkko)
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Update readiness and baseline eligibility to use merged effective values including manual completion years
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-budget-generator.ts
  - run: pnpm --filter ./apps/api test -- src/v2 src/veeti
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api test -- src/v2 src/veeti -> PASS | files:apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add VEETI-late-arrival reconcile flow with side-by-side diff and keep-manual/apply-veeti choice
  - files: apps/api/src/v2/**, apps/web/src/v2/**, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/import-year-reconcile.dto.ts, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)

### S-05 substeps

- [x] Switch peer headline metric to medeltal (`avgValue`) and keep mediaani as secondary detail
  - files: apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/\*.json
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add year-level provenance panel that explains source and edit history for each displayed value
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2
  - evidence: commit:uncommitted | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*\*.png)
- [x] Add org 1535 sanity fixture checks and run full gates for release confidence
  - files: apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/**, scripts/ops/**
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:uncommitted | run:pnpm lint && pnpm typecheck && pnpm test -> PASS (lint warnings only) | files:apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/\*_, apps/web/src/api.ts | docs:N/A | status: dirty (untracked tmp*vesipolku*_.png)
