# Sprint

Window: 2026-03-12 to 2026-05-30

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Clean-tree policy: protocol cleanliness is defined by `git status --porcelain`; ignored local files are out of scope, while tracked changes and untracked non-ignored files still block DO/REVIEW completion.
DO file-scope policy: when a selected substep explicitly lists non-canonical repo docs or config examples in `files:`, DO may edit them as product-scope files; canonical planning docs remain forbidden.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when the substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Finish the setup-wizard refactor so the first authenticated window is a true six-step wizard: connect does not count as import, step 3 is reachable, only one step body is mounted at a time, and the Finnish flow has no English fallback leaks.

## Recorded decisions (this sprint)

- `available VEETI years` and `workspace-imported years` are different concepts and must not share one field in the wizard contract.
- Step 2 import is explicit and durable; connect only discovers the organization and its available years.
- Step 3 review must be reachable before any step-4 fix flow.
- The first window mounts one active wizard body at a time; prior/future steps do not remain as full stacked sections.
- Missing wizard locale keys are product defects and must fail automated coverage instead of silently rendering English defaults.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-43 | Split raw VEETI year discovery from explicit workspace import so connect no longer behaves like import and step-2 year selection survives reloads. See S-43 substeps. | apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Connecting an org does not populate imported-year summary counts; step 2 creates a separate persisted workspace-year set; reload preserves that explicit selection and the summary uses it instead of all available VEETI years. | BLOCKED: dirty working tree (`apps/api/src/v2/dto/import-clear.dto.ts`, `apps/api/src/v2/dto/import-clear.dto.spec.ts`). | Stop if durable workspace-year persistence cannot be introduced without unresolved migration or compatibility risk for existing VEETI year-policy data. | TODO |
| S-44 | Repair wizard progression so step 2 and step 3 are truthful, step 3 is reachable, and step 4 only opens when the user is actually handling a problem year. See S-44 substeps. | apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx | After connect the wizard stays at step 2, after explicit import it reaches step 3, review counts derive from workspace years only, and step 4 is not auto-selected merely because blocked years exist. | Evidence needed. | Stop if truthful review-to-fix progression requires a new explicit UI state contract that cannot be introduced without breaking current manual-patch or baseline flows. | TODO |
| S-45 | Remove the stacked legacy setup surfaces and make the wizard mount exactly one active step body at a time on the first window. See S-45 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | The legacy `Tuo VEETI` slab is no longer rendered as a parallel 3-step card, future steps are not mounted as full sections before they are active, and step 6 stays hidden/locked until baseline creation is complete. | Evidence needed. | Stop if removing the legacy sections would strand any required year-fix, baseline, or forecast-handoff action without an implemented replacement surface. | TODO |
| S-46 | Remove wizard-language leakage and make locale coverage fail when wizard keys are wrong or missing. See S-46 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Finnish wizard flow no longer renders English helper or baseline-summary labels, wrong translation keys are fixed, missing wizard keys are added in all three locales, and automated tests fail on future wizard key drift. | Evidence needed. | Stop if wizard-key parity cannot be enforced without first splitting the current locale integrity allowlist or test architecture into a wizard-specific check. | TODO |
| S-47 | Lock the corrected setup flow with integration coverage and one final local Kronoby smoke audit. See S-47 substeps. | apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, docs/SITE_AUDIT_FINDINGS_AND_FIX_PLAN.md | Regression coverage proves `Tili -> Tyhjenna tietokanta`, Kronoby search/connect, explicit year import, truthful step gating, and locked-to-unlocked Ennuste behavior; final local smoke evidence confirms the audited failure path is fixed. | Evidence needed. | Stop if the final local smoke cannot be completed without additional product work outside `S-43..S-46`, and record that gap before closing the row. | TODO |

### S-43 substeps

- [ ] Define the persisted `workspaceYears` contract separately from raw available VEETI years
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: BLOCKED: dirty working tree (`apps/api/src/v2/dto/import-clear.dto.ts`, `apps/api/src/v2/dto/import-clear.dto.spec.ts`)

- [ ] Implement connect/import/status behavior so connect only discovers years and step-2 import stores explicit workspace years
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: pending

- [ ] Update the web API client and Overview loaders to consume `workspaceYears` without falling back to all available years
  - files: apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add API and web regressions for connect-only state, explicit import, and persisted reload behavior
  - files: apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-44 substeps

- [ ] Rewrite `resolveSetupWizardState` so step 3 is reachable and connect no longer jumps directly to step 4
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Derive imported, ready, blocked, and excluded counts from explicit workspace years only
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Make the review CTA advance into an explicit next wizard state instead of only scrolling or setting an info banner
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add regressions for Kronoby connect, explicit import, review continue, and problem-year routing
  - files: apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx
  - evidence: pending

### S-45 substeps

- [ ] Remove the separate legacy `importStep` slab and mount step-1/step-2 content from the six-step wizard state only
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Mount review, fix, baseline, and forecast surfaces conditionally from the active wizard step instead of always rendering stacked cards
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Move prior and future step context into compact summary helpers rather than full duplicate surfaces
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add shell and overview regressions that prove only the active step body is mounted and later workspaces stay locked correctly
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: pending

### S-46 substeps

- [ ] Fix wrong wizard translation keys and add the missing baseline-summary keys in all three locales
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Audit remaining wizard-facing `v2Overview` keys and remove English fallback leaks from the setup surface
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Extend locale integrity coverage so missing wizard keys fail tests instead of silently using English defaults
  - files: apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx
  - evidence: pending

- [ ] Add Finnish wizard regression coverage for helper copy and baseline summary labels
  - files: apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: pending

### S-47 substeps

- [ ] Add regression coverage for clear-confirmation validation and the corrected connect/import step-gating path
  - files: apps/api/src/v2/dto/import-clear.dto.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/dto/import-clear.dto.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: pending

- [ ] Add shell-level regressions for locked tabs before baseline and unlocked handoff after step 6
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: pending

- [ ] Run a final local Kronoby smoke audit and record the fixed flow in the non-canonical site-audit notes
  - files: docs/SITE_AUDIT_FINDINGS_AND_FIX_PLAN.md
  - run: N/A (manual browser smoke audit allowed)
  - evidence: pending
