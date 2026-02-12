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

## Goal (this sprint)

Completely working **Ennuste** page per `docs/PROJECTION_UX_PLAN.md`.

## Recorded decisions (this sprint)

**Ennuste UX lock:** Keep per-year values and `% from year X` inputs on the same Ennuste screen (no modal), for vesi and jätevesi variables (unit price + sold volume). Diagram is a sub-view inside Ennuste and uses the same computed data as table view.

**Computation/validation lock:** Projection horizon remains 1-20 years; `% from year X` requires base value on year X; compute must block invalid input with inline errors.

**KVA/Talousarvio lock remains in force:** Option A sign convention and historical-only Talousarvio behavior from ADR-021..ADR-024 remain unchanged.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Projection API/domain: add and persist driver override model for per-year and `% from year X` modes (vesi/jätevesi, price/volume). See S-01 substeps below. | apps/api/src/projections/**, apps/api/src/budgets/**, apps/api/src/**/dto/**, apps/web/src/api/** | API can save/load scenario driver config with deterministic shape for both modes; projection contract remains backward compatible. | f313898 | Stop if schema/API contradiction with existing projection contract cannot be resolved without scope change. | READY |
| S-02 | Ennuste UI input controls: same-screen mode toggle + forms for per-year grid and `% from year X` settings (vesi/jätevesi). See S-02 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/App.css | User can switch mode per driver, edit values, and see translated labels/help text in fi/sv/en. | f313898 | Stop if required UI behavior conflicts with locked plan in `docs/PROJECTION_UX_PLAN.md`. | READY |
| S-03 | Compute integration + validation: wire new inputs into compute flow, enforce input rules, and expose clear compute status/errors. See S-03 substeps below. | apps/api/src/projections/**, apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx, apps/web/src/**/__tests__/** | Compute uses selected mode correctly; `% from year X` formula is applied deterministically; invalid inputs block compute with inline errors. | f313898 | Stop if formula/validation cannot be implemented without changing locked UX rules. | READY |
| S-04 | Diagram sub-view inside Ennuste: add chart view (table/diagram switch) for revenue, net result, volume, and price across years. See S-04 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/**, apps/web/src/App.css, apps/web/src/i18n/locales/*.json | Diagram renders from the same projection result payload as table and updates with scenario/horizon changes. | b5183dd | Stop if chart implementation requires forbidden dependency/platform change not in current scope. | READY |
| S-05 | Regression + root gates for complete Ennuste flow. Add/update tests for API + UI and run lint/typecheck/test at root. See S-05 substeps below. | apps/api/src/projections/**, apps/web/src/pages/**, apps/web/src/components/**, tests, package.json scripts (if needed) | Projection API/UI regressions covered; root `pnpm lint`, `pnpm typecheck`, `pnpm test` pass. | (see substeps) | Stop if root gates fail and cannot be fixed within sprint scope. | READY |

### S-01 substeps
- [x] Define override payload schema for driver mode + values (`per_year`, `percent_from_year_x`) for vesi/jätevesi price and volume
  - files: apps/api/src/projections/**, apps/api/src/**/dto/**
  - run: pnpm --filter api test -- src/projections/
  - evidence: commit:f313898 | run: pnpm --filter api test -- src/projections/ -> 29 passed | files: driver-paths.ts, dto, projections.*, projection-engine.spec.ts | docs: N/A | status: clean
- [x] Implement repository/service persistence and retrieval for override config in scenario context
  - files: apps/api/src/projections/**, apps/api/src/**/repository/**
  - run: pnpm --filter api test -- src/projections/
  - evidence: commit:f313898 | run: pnpm --filter api test -- src/projections/ -> 29 passed | files: projections.repository.ts, projections.service.ts, projections.controller.ts | docs: N/A | status: clean
- [x] Add contract tests for save/load compatibility and fallback defaults when config is missing
  - files: apps/api/src/projections/**/*.spec.ts
  - run: pnpm --filter api test -- src/projections/
  - evidence: commit:f313898 | run: pnpm --filter api test -- src/projections/ -> 29 passed | files: projections.repository.spec.ts, driver-paths.spec.ts, projection-engine.spec.ts | docs: N/A | status: clean

### S-02 substeps
- [x] Add Ennuste UI mode controls for each driver: `Vuosikohtaiset arvot` vs `% vuodesta X`
  - files: apps/web/src/components/DriverPlanner.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck
  - evidence: commit:f313898 | run: pnpm --filter web typecheck -> PASS | files: DriverPlanner.tsx, ProjectionPage.tsx | docs: N/A | status: clean
- [x] Render mode-specific input blocks (year grid for per-year; start year + annual % for percent mode)
  - files: apps/web/src/components/DriverPlanner.tsx, apps/web/src/App.css
  - run: pnpm --filter web test -- src/components/DriverPlanner
  - evidence: commit:f313898 | run: pnpm --filter web test -- src/components/ -> 6 passed | files: DriverPlanner.tsx, App.css | docs: N/A | status: clean
- [x] Add/update fi/sv/en i18n keys for all new labels, hints, and validation copy
  - files: apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter web typecheck
  - evidence: commit:f313898 | run: pnpm --filter web typecheck -> PASS | files: fi.json, sv.json, en.json | docs: N/A | status: clean

### S-03 substeps
- [x] Wire UI override state into compute request payload and normalize defaults before submit
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/api/**
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: commit:f313898 | run: pnpm --filter web test -- src/pages/ -> (see root gates) | files: ProjectionPage.tsx, api.ts | docs: N/A | status: clean
- [x] Implement compute-side `% from year X` expansion formula and deterministic year mapping
  - files: apps/api/src/projections/**
  - run: pnpm --filter api test -- src/projections/
  - evidence: commit:f313898 | run: pnpm --filter api test -- src/projections/ -> 29 passed | files: driver-paths.ts, projection-engine.service.ts | docs: N/A | status: clean
- [x] Enforce validation rules (horizon bounds, required base year value, invalid negative outcomes policy) and show inline errors
  - files: apps/api/src/projections/**, apps/web/src/components/DriverPlanner.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter api test -- src/projections/; pnpm --filter web test -- src/components/DriverPlanner
  - evidence: commit:f313898 | run: api projections 29 passed, web components 6 passed | files: driver-paths, DriverPlanner, ProjectionPage | docs: N/A | status: clean

### S-04 substeps
- [x] Add Ennuste result view switch (`Taulukko` / `Diagrammi`) in-page without introducing a new top-level tab
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: commit:b5183dd | run: pnpm --filter web typecheck -> PASS | files: ProjectionPage.tsx, fi/sv/en.json | docs: N/A | status: clean
- [x] Implement charts for revenue, net result, volume, and price by year from existing projection response
  - files: apps/web/src/components/**, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: commit:b5183dd | run: pnpm --filter web test -> 15 passed | files: ProjectionCharts.tsx, ProjectionPage.tsx | docs: N/A | status: clean
- [x] Ensure table and diagram remain data-consistent on scenario, horizon, and recompute changes
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/**/__tests__/**
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: commit:b5183dd | table and diagram both use activeProjection.vuodet (same source) | docs: N/A | status: clean

### S-05 substeps
- [x] Add API regression tests for override modes, formula behavior, and validation failures
  - files: apps/api/src/projections/**/*.spec.ts
  - run: pnpm --filter api test -- src/projections/
  - evidence: commit:f313898 | run: pnpm --filter api test -- src/projections/ -> 29 passed | files: projections.repository.spec.ts, projection-engine.spec.ts, driver-paths.spec.ts | docs: N/A | status: clean
- [x] Add UI regression tests for mode switching, compute blocking errors, and table/diagram rendering
  - files: apps/web/src/pages/**/__tests__/**, apps/web/src/components/**/__tests__/**
  - run: pnpm --filter web test
  - evidence: commit:9f33a70 | run: pnpm --filter web test -> 17 passed | files: ProjectionCharts.test.tsx | docs: N/A | status: clean
- [x] Run root gates and record PASS evidence for sprint closure
  - files: (none or fix-only)
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: run: pnpm lint -> 0 errors; pnpm typecheck -> PASS; pnpm test -> api 322 total, web 17 passed | docs: N/A | status: clean
