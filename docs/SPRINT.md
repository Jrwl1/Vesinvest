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
| S-02 | Ennuste UI input controls: same-screen mode toggle + forms for per-year grid and `% from year X` settings (vesi/jätevesi). See S-02 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/App.css | User can switch mode per driver, edit values, and see translated labels/help text in fi/sv/en. | Evidence needed | Stop if required UI behavior conflicts with locked plan in `docs/PROJECTION_UX_PLAN.md`. | TODO |
| S-03 | Compute integration + validation: wire new inputs into compute flow, enforce input rules, and expose clear compute status/errors. See S-03 substeps below. | apps/api/src/projections/**, apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/DriverPlanner.tsx, apps/web/src/**/__tests__/** | Compute uses selected mode correctly; `% from year X` formula is applied deterministically; invalid inputs block compute with inline errors. | Evidence needed | Stop if formula/validation cannot be implemented without changing locked UX rules. | TODO |
| S-04 | Diagram sub-view inside Ennuste: add chart view (table/diagram switch) for revenue, net result, volume, and price across years. See S-04 substeps below. | apps/web/src/pages/ProjectionPage.tsx, apps/web/src/components/**, apps/web/src/App.css, apps/web/src/i18n/locales/*.json | Diagram renders from the same projection result payload as table and updates with scenario/horizon changes. | Evidence needed | Stop if chart implementation requires forbidden dependency/platform change not in current scope. | TODO |
| S-05 | Regression + root gates for complete Ennuste flow. Add/update tests for API + UI and run lint/typecheck/test at root. See S-05 substeps below. | apps/api/src/projections/**, apps/web/src/pages/**, apps/web/src/components/**, tests, package.json scripts (if needed) | Projection API/UI regressions covered; root `pnpm lint`, `pnpm typecheck`, `pnpm test` pass. | Evidence needed | Stop if root gates fail and cannot be fixed within sprint scope. | TODO |

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
- [ ] Add Ennuste UI mode controls for each driver: `Vuosikohtaiset arvot` vs `% vuodesta X`
  - files: apps/web/src/components/DriverPlanner.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Render mode-specific input blocks (year grid for per-year; start year + annual % for percent mode)
  - files: apps/web/src/components/DriverPlanner.tsx, apps/web/src/App.css
  - run: pnpm --filter web test -- src/components/DriverPlanner
  - evidence: pending
- [ ] Add/update fi/sv/en i18n keys for all new labels, hints, and validation copy
  - files: apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter web typecheck
  - evidence: pending

### S-03 substeps
- [ ] Wire UI override state into compute request payload and normalize defaults before submit
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/api/**
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: pending
- [ ] Implement compute-side `% from year X` expansion formula and deterministic year mapping
  - files: apps/api/src/projections/**
  - run: pnpm --filter api test -- src/projections/
  - evidence: pending
- [ ] Enforce validation rules (horizon bounds, required base year value, invalid negative outcomes policy) and show inline errors
  - files: apps/api/src/projections/**, apps/web/src/components/DriverPlanner.tsx, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter api test -- src/projections/; pnpm --filter web test -- src/components/DriverPlanner
  - evidence: pending

### S-04 substeps
- [ ] Add Ennuste result view switch (`Taulukko` / `Diagrammi`) in-page without introducing a new top-level tab
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: pending
- [ ] Implement charts for revenue, net result, volume, and price by year from existing projection response
  - files: apps/web/src/components/**, apps/web/src/pages/ProjectionPage.tsx
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: pending
- [ ] Ensure table and diagram remain data-consistent on scenario, horizon, and recompute changes
  - files: apps/web/src/pages/ProjectionPage.tsx, apps/web/src/**/__tests__/**
  - run: pnpm --filter web test -- src/pages/ProjectionPage
  - evidence: pending

### S-05 substeps
- [ ] Add API regression tests for override modes, formula behavior, and validation failures
  - files: apps/api/src/projections/**/*.spec.ts
  - run: pnpm --filter api test -- src/projections/
  - evidence: pending
- [ ] Add UI regression tests for mode switching, compute blocking errors, and table/diagram rendering
  - files: apps/web/src/pages/**/__tests__/**, apps/web/src/components/**/__tests__/**
  - run: pnpm --filter web test
  - evidence: pending
- [ ] Run root gates and record PASS evidence for sprint closure
  - files: (none or fix-only)
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: pending
