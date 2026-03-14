# Sprint

Window: 2026-03-12 to 2026-05-30

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Clean-tree policy: protocol cleanliness is defined by `git status --porcelain`; ignored local files are out of scope, while tracked changes and untracked non-ignored files still block DO/REVIEW completion.
DO baseline policy: DO may start from dirty tracked/unignored state only when every pre-existing dirty path is already inside the selected substep `files:` scope and can be safely absorbed into that substep; DO and REVIEW still must end clean per `git status --porcelain`.
Delegation artifact policy: any `delegate_autopilot` artifacts must stay outside the worktree or in ignored paths that do not appear in `git status --porcelain`.
DO file-scope policy: when a selected substep explicitly lists non-canonical repo docs or config examples in `files:`, DO may edit them as product-scope files; canonical planning docs remain forbidden.
PLAN subagent policy: the parent planner must still complete the required canonical reads in order, but may use read-only research subagents or `delegate_autopilot` for follow-up context gathering only.
DO/RUNSPRINT subagent policy: the parent executor may use one implementation subagent or one `delegate_autopilot` run for the currently selected substep only; the parent remains responsible for scope, commands, commits, evidence, and clean-tree checks.
REVIEW subagent policy: REVIEW remains parent-owned; do not use `delegate_autopilot` unless a future ADR defines a read-only review-helper policy.
Same-package gate-fix policy: when a required `run:` fails, DO may edit the minimal additional files in the same workspace package needed to make that required run pass; cross-package fallout remains a blocker.
Gate-aware authoring policy: if a substep adds or tightens a test, parity, lint, typecheck, schema, or contract gate, its `files:` scope must include both the gate file(s) and the likely same-package implementation or consumer files that could fail that gate.
Blocker taxonomy: use `HARD BLOCKED` for scope, forbidden-touch, commit-structure, or clean-tree failures, and `GATE BLOCKED` for required verification failures that exceed the bounded same-package gate-fix rule.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when the substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  When scoped-baseline absorption or same-package gate-fix is used, append `| baseline:absorbed` and/or `| gate-fix:<paths>` before `| status: clean`.
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Finish the setup-wizard refactor so the first authenticated window is a true six-step wizard: connect does not count as import, one authoritative active-step contract drives both the shell and the page body, only one step surface and one primary CTA are active at a time, the Finnish flow has no English fallback leaks, and the final row ends with a fresh Finnish Kronoby UI/UX re-audit that explicitly says the sprint succeeded or stopped on a blocker.

## Recorded decisions (this sprint)

- `available VEETI years` and `workspace-imported years` are different concepts and must not share one field in the wizard contract.
- Step 2 import is explicit and durable; connect only discovers the organization and its available years.
- One authoritative active-step contract owns page state, shell state, and selected problem-year routing.
- Legacy `/import/sync` orchestration and `resolveNextBestStep`-style parallel wizard logic must not define the wizard after this corrective sprint.
- The first window mounts one active wizard body at a time and gives primary CTA emphasis only to the active step.
- Missing wizard locale keys are product defects and must fail automated coverage instead of silently rendering English defaults.
- The sprint is not considered complete until the site is audited again in Finnish against the Kronoby flow and the audit artifact states whether the sprint succeeded or stopped on a blocker.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-43 | Split raw VEETI year discovery from explicit workspace import and retire backend paths that still blur that line. See S-43 substeps. | apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/api/src/veeti/veeti-sync.service.ts, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Connecting an org only discovers the org and available years, step 2 creates a separate persisted workspace-year set, downstream V2 payloads stop treating available years as imported workspace years, `/import/sync` no longer defines wizard semantics, baseline creation uses `workspaceYears` or rejects empty input, and clear/reset semantics also clear the new workspace-year state. | Acceptance satisfied: workspace-year persistence, discovery-only connect, legacy sync contract cleanup, downstream workspace-year consumers, and clear/reset coverage verified via `c469fca4d04ebce9866696c7cb8fb61e3a11f081`, `696000b3248e76192e777a537f6973954840a8e0`, `60f5e2dccb97f8bf38fada5d4968b1d0a21501e1`, `47d4508ca25f49bd5d155185b4858c8a960df8e5`, and `889d61477b2f361ae9977c20f81c7755468e7173`. | Stop if durable workspace-year persistence cannot be introduced without unresolved migration or compatibility risk for existing VEETI year-policy data. | DONE |
| S-44 | Introduce one authoritative active-step contract so step progression, selected problem-year routing, and shell indicators all agree. See S-44 substeps. | apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx | After connect the wizard stays at step 2, after explicit import it reaches step 3, `review continue` advances to the correct next active step, choosing a problem year activates step 4, shell header/telemetry and overview body use the same active-step state, and obsolete `resolveNextBestStep` logic is removed or retired. | Acceptance satisfied: active-step contract, selected problem-year routing, explicit review transitions, and shell/body alignment verified via `98defef6a287cb0022f86a87b1d08d9a3f95ec33`, `0c842bd9027525a8bb7fb25ee7bb128473aee22e`, `5c258fa2cb07f1627b78ed4cb24dc275ea2de711`, and `91cea9095da2e36f244e92562d3b20b34496d97d`. | Stop if truthful review-to-fix progression requires a new explicit state model that cannot be introduced without breaking current manual-patch or baseline flows. | DONE |
| S-45 | Remove the stacked legacy setup surfaces and enforce one primary CTA per active step on the first window. See S-45 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | The legacy `Tuo VEETI` slab is gone, future steps are not mounted as full sections before they are active, only the active step surface is mounted, only the active step owns primary-button emphasis, and step 6 stays hidden/locked until baseline creation is complete. | Acceptance satisfied: legacy slab removed, only the active step surface is mounted, prior/future context moved into compact helpers, and active-step CTA/body ownership verified via `93b3de3d2c4591ea5a442fee53710e80116d3ede`, `36e946a3537a8e0b50b71b90bc32dc19e8f811b9`, `4e40cefef769cab87ccf2205db69c88a7148236d`, and `4c34810dbc194932cc05fcb75428b1da65eae68f`. | Stop if removing the legacy sections would strand any required year-fix, baseline, or forecast-handoff action without an implemented replacement surface. | DONE |
| S-46 | Remove wizard-language leakage across all wizard chrome and make wizard key families hard-fail in locale parity tests. See S-46 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Finnish wizard flow no longer renders English copy across question/body/summary/review/baseline/handoff surfaces, wrong translation keys are fixed, missing wizard keys are added in all three locales, wizard key families are on the hard parity list, and automated tests fail on future wizard key drift. | Acceptance satisfied: wizard copy/key cleanup, hard parity coverage, and Finnish regression proof verified via `34564a2097dc3143bb80e4cc7b9308332a6cd773`, `7d7625dd4309092bdbcb9c8da72cf2bd66e9a345`, `180991c46c5e2ae888d9c856b49c28b5a163e71f`, and `381ff3c892e995f1f83f4fb775de6ba8a7a8b559`; live rerun `pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx; pnpm --filter ./apps/web typecheck` -> PASS. | Stop if wizard-key parity cannot be enforced without first splitting the current locale integrity allowlist or test architecture into a wizard-specific check. | DONE |
| S-47 | Prove the overhaul end-to-end with regression coverage and a fresh Finnish Kronoby UI/UX re-audit that explicitly closes or blocks the sprint. See S-47 substeps. | apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Regression coverage proves clear-confirmation validation, search/connect/import gating, one active primary CTA, blocked-year routing (`step 3 -> continue -> step 4 -> step 5/6`), and locked-to-unlocked Ennuste behavior; then a local Finnish Kronoby re-audit is recorded in `docs/SETUP_WIZARD_UIUX_REAUDIT.md` and ends with an explicit statement: either `whole sprint succeeded` or `stopped by blocker: ...`. | Substeps 1-4 completed via `b10d87ee3290157f26e691720e4bf679c1a17ed2`, `8691e84006197009cab176ed09ef2757b83ef296`, `906e908184a4fe1e6c654f07a66d3728c8021cba`, and `9b749a24585cddfeb46934e2a5f5043d13b1fa76`; row READY for acceptance review. | Stop if the final Finnish re-audit still finds a user-visible wizard regression after `S-43..S-46`; record the blocker in the artifact and stop the sprint there. | READY |

### S-43 substeps

- [x] Persist `workspaceYears` separately from raw available VEETI years
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:c469fca4d04ebce9866696c7cb8fb61e3a11f081 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/api/prisma/migrations/20260312154500_add_workspace_years_to_veeti_organisaatio/migration.sql, apps/api/prisma/schema.prisma, apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

- [x] Update the sync-layer connect behavior so connect only discovers years and does not imply workspace import
  - files: apps/api/src/veeti/veeti-sync.service.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:696000b3248e76192e777a537f6973954840a8e0 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti-sync.service.ts | docs:N/A | status: clean

- [x] Retire or redefine `/import/sync` so the wizard no longer depends on legacy import-plus-baseline orchestration
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:60f5e2dccb97f8bf38fada5d4968b1d0a21501e1 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/web/src/api.ts | docs:N/A | status: clean

- [x] Clean downstream V2 payloads so overview, planning context, manual-year responses, and baseline logic use `workspaceYears` or reject empty input
  - files: apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:47d4508ca25f49bd5d155185b4858c8a960df8e5 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Extend clear/reset semantics and tests so the new workspace-year state is cleared together with imported setup state
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/import-clear.dto.ts, apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/dto/import-clear.dto.spec.ts src/v2/v2.service.spec.ts
  - evidence: commit:889d61477b2f361ae9977c20f81c7755468e7173 | run:pnpm --filter ./apps/api test -- src/v2/dto/import-clear.dto.spec.ts src/v2/v2.service.spec.ts -> PASS | files:apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts | docs:N/A | status: clean

### S-44 substeps

- [x] Define one authoritative active-step state model, including selected problem-year state and explicit next-step transitions
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:98defef6a287cb0022f86a87b1d08d9a3f95ec33 | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/overviewWorkflow.ts | docs:N/A | status: clean

- [x] Rewrite `resolveSetupWizardState` so step 3 is reachable and `resolveNextBestStep` or equivalent obsolete parallel flow logic is removed or retired
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:0c842bd9027525a8bb7fb25ee7bb128473aee22e | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/overviewWorkflow.ts | docs:N/A | status: clean

- [x] Wire `review continue` and problem-year actions into explicit active-step transitions instead of scroll/info-only behavior
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:5c258fa2cb07f1627b78ed4cb24dc275ea2de711 | run:pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Align AppShell header, telemetry, and locked-tab hints with the same active-step contract as the overview body
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:91cea9095da2e36f244e92562d3b20b34496d97d | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx | docs:N/A | status: clean

### S-45 substeps

- [x] Remove the separate legacy `importStep` slab and mount step-1/step-2 content only from the six-step wizard state
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:93b3de3d2c4591ea5a442fee53710e80116d3ede | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Mount review, fix, baseline, and forecast surfaces conditionally from the active wizard step instead of rendering stacked cards
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:36e946a3537a8e0b50b71b90bc32dc19e8f811b9 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Move prior and future step context into compact summary helpers rather than full duplicate surfaces
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:4e40cefef769cab87ccf2205db69c88a7148236d | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Add regressions that prove only the active step owns primary-button emphasis and only the active step body is mounted
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: commit:4c34810dbc194932cc05fcb75428b1da65eae68f | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-46 substeps

- [x] Fix wrong wizard translation keys and add the missing wizard chrome keys in all three locales
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:34564a2097dc3143bb80e4cc7b9308332a6cd773 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Audit all wizard-facing key families (`wizardQuestion*`, `wizardBody*`, `wizardSummary*`, baseline, review, and handoff copy) and remove English fallback leaks from the setup surface
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:7d7625dd4309092bdbcb9c8da72cf2bd66e9a345 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add wizard key families to the hard locale parity list so missing wizard keys fail tests
  - files: apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:180991c46c5e2ae888d9c856b49c28b5a163e71f | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add Finnish wizard regressions for chrome copy, summary labels, review CTA copy, baseline cards, and step-6 handoff text
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: commit:381ff3c892e995f1f83f4fb775de6ba8a7a8b559 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | baseline:absorbed | status: clean

### S-47 substeps

- [x] Add regression coverage for clear-confirmation validation and the corrected search/connect/import step-gating path
  - files: apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/dto/import-clear.dto.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/dto/import-clear.dto.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: commit:b10d87ee3290157f26e691720e4bf679c1a17ed2 | run:pnpm --filter ./apps/api test -- src/v2/dto/import-clear.dto.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Add regression coverage for one-primary-CTA ownership and the blocked-year branch (`step 3 -> continue -> step 4 -> step 5/6`)
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: commit:8691e84006197009cab176ed09ef2757b83ef296 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add shell-level regressions for locked tabs before baseline and unlocked handoff after step 6
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: commit:906e908184a4fe1e6c654f07a66d3728c8021cba | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx | docs:N/A | status: clean

- [x] Run a final Finnish Kronoby UI/UX re-audit (`clear -> search -> connect -> explicit import -> review continue -> blocked-year fix/exclude -> baseline -> unlock`) and record the explicit sprint outcome in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser smoke audit allowed)
  - evidence: commit:9b749a24585cddfeb46934e2a5f5043d13b1fa76 | run:N/A (manual browser audit) -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, docs/SETUP_WIZARD_UIUX_REAUDIT.md | docs:N/A | status: clean
