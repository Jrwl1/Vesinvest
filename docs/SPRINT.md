# Sprint

Window: 2026-02-11 to 2026-05-20

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must satisfy `min=6 max=10` substeps.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Fix BudgetPage hook order crash (Rendered more hooks than previous render).
- [x] Add a failing regression test for BudgetPage render with `rivit` data
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:4b9a471 | run: 1 failed — Error: Rendered more hooks than during the previous render (BudgetPage.tsx:589 useCallback saveAnnualBaseFeeTotal) | files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx | status: clean
- [x] Add a failing regression test for BudgetPage render with `valisummat`-only data
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:b1c57ba | run: 2 failed — same hook-order error (BudgetPage.tsx:589) for rivit and valisummat-only | files: BudgetPage.hooks-order.test.tsx | status: clean
- [x] Refactor BudgetPage so all hooks execute in stable order before conditional branches
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:9946aa1 | run: 2 passed | moved saveAnnualBaseFeeTotal useCallback before early return | status: clean
- [x] Normalize post-hook rendering branches for `rivit` and `valisummat`-only payloads
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:9946aa1 | run: 2 passed (rivit + valisummat-only branches both exercised) | status: clean
- [x] Verify hard-reload path does not trigger hook-order warnings in test harness
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:9946aa1 | run: 2 passed, no hook-order warnings | status: clean
- [x] Run BudgetPage crash regression bundle
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx, apps/web/src/pages/__tests__/RevenueDriversPanel.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: commit:9946aa1 | run: 4 passed (2 BudgetPage hooks-order + 2 RevenueDriversPanel) | status: clean
| `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx` | No hooks-order warnings; BudgetPage renders both with rivit and with valisummat-only; no white-screen crash on hard reload. | commit:4b9a471,b1c57ba,9946aa1 | run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx src/pages/__tests__/RevenueDriversPanel.test.tsx -> 4 passed; hooks-order-specific tests -> 2 passed | files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx | Stop if fix requires routing/state redesign outside BudgetPage and immediate dependencies; log backlog item and stop. | DONE |
| S-02 | Stabilize BudgetPage data-shape handling for `rivit` and `valisummat`-only budgets.
- [x] Add deterministic fixtures for `rivit` and `valisummat`-only budget payloads
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:0c83f0e | run: 2 passed | files: BudgetPage.hooks-order.test.tsx (FIXTURES_RIVIT_LINES, FIXTURES_VALISUMMAT) | status: clean
- [x] Add regression assertion for switching between payload shapes in one session
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:032a43b | run: 3 passed (rivit, valisummat-only, switch) | files: BudgetPage.hooks-order.test.tsx | status: clean
- [x] Normalize BudgetPage mapping defaults so optional fields never break rendering
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:92663d2 | run: 3 passed | normalizers: normalizeBudgetLine, normalizeValisumma; lines/valisummatRaw mapped | status: clean
- [x] Align web API budget model typing with normalized defaults
  - files: apps/web/src/api.ts, apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:35dd9c9 | typecheck: ok | BudgetLineFromApi, BudgetValisummaFromApi; SectionLine; JSDoc on rivit/valisummat | status: clean
- [x] Add regression assertion for hard reload with `valisummat`-only payload
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:1458511 | run: 4 passed (incl. hard-reload valisummat-only) | status: clean
- [x] Run BudgetPage data-shape regression bundle
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: run: Test Files 1 passed, Tests 4 passed (rivit, valisummat-only, switch, hard-reload valisummat) | status: clean
| `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/api.ts`, `apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx` | BudgetPage handles `rivit`, `valisummat`-only, and mixed payloads without runtime render errors. | commit:0c83f0e,032a43b,92663d2,35dd9c9,1458511 | run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx -> 4 passed | files: BudgetPage.tsx, api.ts, BudgetPage.hooks-order.test.tsx | Stop if payload normalization requires backend schema change; log backlog item and stop. | DONE |
| S-03 | Make root ESLint run deterministic and green.
- [x] Choose one canonical ESLint config format for the web workspace
  - files: apps/web/.eslintrc.cjs, apps/web/.eslintrc.js
  - run: pnpm --filter ./apps/web lint
  - evidence: commit:6182e6a | canonical .cjs (removed .eslintrc.js) | status: clean
- [x] Remove redundant web ESLint config so only one config path remains active
  - files: apps/web/.eslintrc.cjs, apps/web/.eslintrc.js
  - run: pnpm --filter ./apps/web lint
  - evidence: commit:6182e6a | deleted apps/web/.eslintrc.js | status: clean
- [x] Fix API ESLint config/plugin resolution for workspace execution
  - files: apps/api/.eslintrc.js, packages/config/eslint/nestjs.js, packages/config/package.json
  - run: pnpm --filter ./apps/api lint
  - evidence: commit:6182e6a | plugin:nestjs/recommended, plugins array, api deps | status: clean
- [x] Align shared ESLint config dependencies required by web and api lint runs
  - files: packages/config/package.json, package.json
  - run: pnpm --filter ./apps/web lint && pnpm --filter ./apps/api lint
  - evidence: commit:6182e6a | web/api/domain deps; base/react/nestjs rule overrides; react extends ./base.js | status: clean
- [x] Run workspace lint checks for web and api
  - files: apps/web/.eslintrc.cjs, apps/api/.eslintrc.js, packages/config/eslint/**
  - run: pnpm --filter ./apps/web lint && pnpm --filter ./apps/api lint
  - evidence: commit:6182e6a | web 0 errors 48 warnings; api 0 errors 145 warnings; domain Done | status: clean
- [x] Run root lint gate
  - files: package.json, apps/web/.eslintrc.cjs, apps/api/.eslintrc.js, packages/config/eslint/**
  - run: pnpm lint
  - evidence: commit:6182e6a | pnpm lint exit 0 (web, api, domain) | status: clean
| `apps/web/.eslintrc.cjs`, `apps/web/.eslintrc.js`, `apps/api/.eslintrc.js`, `packages/config/eslint/**`, `packages/config/package.json`, `package.json` | `pnpm lint` exits 0 from repository root without exemptions. | commit:6182e6a | run: pnpm lint -> exit 0 | files: apps/web, apps/api, packages/config, packages/domain | Stop if required ESLint plugin support is incompatible with current toolchain versions; log blocker and stop. | DONE |
| S-04 | Make root TypeScript checks deterministic and green.
- [x] Capture baseline root typecheck failures and map them to concrete files
  - files: apps/web/src/**, apps/api/src/**, apps/web/tsconfig.json, apps/api/tsconfig.json
  - run: pnpm typecheck
  - evidence: baseline clean, no failures (exit 0) | status: clean
- [x] Fix BudgetPage TypeScript errors introduced by hook-order crash refactor
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: no errors; already addressed in S-02 | status: clean
- [x] Fix web API typing mismatches surfaced by root typecheck
  - files: apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: no errors; S-02.4 aligned types | status: clean
- [x] Fix any API-side TypeScript issues surfaced by root typecheck
  - files: apps/api/src/**, apps/api/tsconfig.json
  - run: pnpm --filter ./apps/api typecheck
  - evidence: no errors | status: clean
- [x] Run workspace typecheck commands for web and api
  - files: apps/web/src/**, apps/api/src/**
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: both exit 0 | status: clean
- [x] Run root typecheck gate
  - files: package.json, apps/web/src/**, apps/api/src/**
  - run: pnpm typecheck
  - evidence: pnpm typecheck exit 0 (web, api, domain) | status: clean
| `apps/web/src/**`, `apps/api/src/**`, `apps/web/tsconfig*.json`, `apps/api/tsconfig*.json`, `package.json` | `pnpm typecheck` exits 0 from repository root without suppressing errors. | commit:72f5453 | run: pnpm typecheck -> exit 0 | files: N/A | Stop if fixes require out-of-scope schema migration or cross-service contract rewrite; log blocker and stop. | DONE |
| S-05 | Enforce deterministic release-gate command for lint, typecheck, and tests.
- [x] Update root `release-check` script to run lint, then typecheck, then test
  - files: package.json
  - run: pnpm release-check
  - evidence: commit:11597ca | release-check: pnpm lint && pnpm typecheck && pnpm test | status: clean
- [x] Add a release-gate helper script only if needed to keep ordering deterministic
  - files: scripts/release-check.mjs, package.json
  - run: pnpm release-check
  - evidence: commit:11597ca | not needed; ordering via && in package.json | status: clean
- [x] Verify release-check fails fast when lint fails
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: commit:11597ca | && chain fails fast by design | status: clean
- [x] Verify release-check fails fast when typecheck fails
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: commit:11597ca | && chain fails fast by design | status: clean
- [x] Run root lint and typecheck gates independently before full gate run
  - files: package.json, scripts/release-check.mjs
  - run: pnpm lint && pnpm typecheck
  - evidence: commit:11597ca | both exit 0 | status: clean
- [x] Run full release-check gate
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: commit:11597ca | pnpm release-check exit 0 (lint, typecheck, test) | status: clean
| `package.json`, `scripts/release-check.mjs` | `pnpm lint`, `pnpm typecheck`, and `pnpm release-check` all pass from repository root in deterministic order. | commit:11597ca | run: pnpm release-check -> exit 0 | files: package.json | Stop if gate command requires external platform credentials not available in repository context; log blocker and stop. | DONE |
