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
- [ ] Normalize BudgetPage mapping defaults so optional fields never break rendering
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: paste mapping diff hunk, test output, and commit hash
- [ ] Align web API budget model typing with normalized defaults
  - files: apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: paste typing diff hunk, typecheck output, and commit hash
- [ ] Add regression assertion for hard reload with `valisummat`-only payload
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: paste hard-reload assertion output and commit hash
- [ ] Run BudgetPage data-shape regression bundle
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: paste command summary and commit hash
| `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/api.ts`, `apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx` | BudgetPage handles `rivit`, `valisummat`-only, and mixed payloads without runtime render errors. | Evidence needed | Stop if payload normalization requires backend schema change; log backlog item and stop. | TODO |
| S-03 | Make root ESLint run deterministic and green.
- [ ] Choose one canonical ESLint config format for the web workspace
  - files: apps/web/.eslintrc.cjs, apps/web/.eslintrc.js
  - run: pnpm --filter ./apps/web lint
  - evidence: paste config decision diff hunk, lint output, and commit hash
- [ ] Remove redundant web ESLint config so only one config path remains active
  - files: apps/web/.eslintrc.cjs, apps/web/.eslintrc.js
  - run: pnpm --filter ./apps/web lint
  - evidence: paste cleanup diff hunk, lint output, and commit hash
- [ ] Fix API ESLint config/plugin resolution for workspace execution
  - files: apps/api/.eslintrc.js, packages/config/eslint/nestjs.js, packages/config/package.json
  - run: pnpm --filter ./apps/api lint
  - evidence: paste plugin-resolution diff hunk, lint output, and commit hash
- [ ] Align shared ESLint config dependencies required by web and api lint runs
  - files: packages/config/package.json, package.json
  - run: pnpm --filter ./apps/web lint && pnpm --filter ./apps/api lint
  - evidence: paste dependency diff hunk, lint output, and commit hash
- [ ] Run workspace lint checks for web and api
  - files: apps/web/.eslintrc.cjs, apps/api/.eslintrc.js, packages/config/eslint/**
  - run: pnpm --filter ./apps/web lint && pnpm --filter ./apps/api lint
  - evidence: paste command summary and commit hash
- [ ] Run root lint gate
  - files: package.json, apps/web/.eslintrc.cjs, apps/api/.eslintrc.js, packages/config/eslint/**
  - run: pnpm lint
  - evidence: paste command summary and commit hash
| `apps/web/.eslintrc.cjs`, `apps/web/.eslintrc.js`, `apps/api/.eslintrc.js`, `packages/config/eslint/**`, `packages/config/package.json`, `package.json` | `pnpm lint` exits 0 from repository root without exemptions. | Evidence needed | Stop if required ESLint plugin support is incompatible with current toolchain versions; log blocker and stop. | TODO |
| S-04 | Make root TypeScript checks deterministic and green.
- [ ] Capture baseline root typecheck failures and map them to concrete files
  - files: apps/web/src/**, apps/api/src/**, apps/web/tsconfig.json, apps/api/tsconfig.json
  - run: pnpm typecheck
  - evidence: paste failure summary and commit hash
- [ ] Fix BudgetPage TypeScript errors introduced by hook-order crash refactor
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: paste diff hunk, typecheck output, and commit hash
- [ ] Fix web API typing mismatches surfaced by root typecheck
  - files: apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: paste diff hunk, typecheck output, and commit hash
- [ ] Fix any API-side TypeScript issues surfaced by root typecheck
  - files: apps/api/src/**, apps/api/tsconfig.json
  - run: pnpm --filter ./apps/api typecheck
  - evidence: paste diff hunk, typecheck output, and commit hash
- [ ] Run workspace typecheck commands for web and api
  - files: apps/web/src/**, apps/api/src/**
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: paste command summary and commit hash
- [ ] Run root typecheck gate
  - files: package.json, apps/web/src/**, apps/api/src/**
  - run: pnpm typecheck
  - evidence: paste command summary and commit hash
| `apps/web/src/**`, `apps/api/src/**`, `apps/web/tsconfig*.json`, `apps/api/tsconfig*.json`, `package.json` | `pnpm typecheck` exits 0 from repository root without suppressing errors. | Evidence needed | Stop if fixes require out-of-scope schema migration or cross-service contract rewrite; log blocker and stop. | TODO |
| S-05 | Enforce deterministic release-gate command for lint, typecheck, and tests.
- [ ] Update root `release-check` script to run lint, then typecheck, then test
  - files: package.json
  - run: pnpm release-check
  - evidence: paste script diff hunk and commit hash
- [ ] Add a release-gate helper script only if needed to keep ordering deterministic
  - files: scripts/release-check.mjs, package.json
  - run: pnpm release-check
  - evidence: paste helper-script diff hunk and commit hash
- [ ] Verify release-check fails fast when lint fails
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: paste fail-fast verification output and commit hash
- [ ] Verify release-check fails fast when typecheck fails
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: paste fail-fast verification output and commit hash
- [ ] Run root lint and typecheck gates independently before full gate run
  - files: package.json, scripts/release-check.mjs
  - run: pnpm lint && pnpm typecheck
  - evidence: paste command summary and commit hash
- [ ] Run full release-check gate
  - files: package.json, scripts/release-check.mjs
  - run: pnpm release-check
  - evidence: paste command summary and commit hash
| `package.json`, `scripts/release-check.mjs` | `pnpm lint`, `pnpm typecheck`, and `pnpm release-check` all pass from repository root in deterministic order. | Evidence needed | Stop if gate command requires external platform credentials not available in repository context; log blocker and stop. | TODO |
