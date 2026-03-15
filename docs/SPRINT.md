# Sprint

Window: 2026-03-15 to 2026-06-05

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

Make the setup wizard and its post-setup handoff human-clear: the active step form appears first, the shell never communicates a stronger state than the wizard truth, year semantics stay explicit about imported workspace data, step 2 cleanly separates importable years from repair-only years, the summary rail stays secondary, and Forecast/Reports feel like a continuation instead of a second onboarding phase.

## Recorded decisions (this sprint)

- The active wizard step surface must be the first visible actionable content in the viewport.
- Shell connection chips, page indicators, and locked tabs must reflect setup truth on direct routes, reloads, and after clear/reset.
- Human-facing readiness and import summaries must describe imported workspace years only, not all available VEETI years.
- Step 2 is an import decision surface; repair-only years must not compete in the same primary list as importable years.
- Summary and helper chrome must support the active step, not duplicate its narrative or outrank its controls.
- Step 6 should hand off into one coherent post-setup path across Forecast and Reports.
- The sprint is not considered complete until a fresh cross-tab UX audit explicitly states whether the whole sprint succeeded or stopped on a blocker.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-48 | Make AppShell truthful and route-safe before Overview mounts. See S-48 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/api.ts | Direct `/forecast` and `/reports` entry cannot bypass setup locks, the header connection/org chip and page indicator do not imply a selected org or unlocked workspace when the wizard says otherwise, and clear/reset returns the user to a truthful locked overview state. | Accepted on review: commits `5c7e5885dc14f9c4e2ece144551c0ad636943403`, `e8a8d2b77013a1fa567a01f1552a5b66a17fdf32`, `36c5879db86315a304d9c908d113cf2f5ebd982e`, `a2b23554314f0d3ec72aeea67ce68a53ec5cce67`; review-run `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx -> pass`. | Stop if truthful shell state requires a new dedicated backend setup-status contract that cannot be introduced compatibly inside this row. | DONE |
| S-49 | Make human-facing year semantics truthful and imported-only. See S-49 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Available VEETI years, imported workspace years, ready imported years, blocked imported years, and excluded years are distinct sets in API/UI reasoning; wizard summaries and progression use workspace-backed rows only; step-5 baseline gating ignores non-imported blocked years. | Accepted on review: commits `fc320785c4d9e4288a4ddd079af1fa62e80e370c`, `98a216942e00ba25cbd5361394eaba1e5a5df9d7`, `1200df37d630459290070002ecf18ef9dc8a6459`, `d7934c6050ddcbf31404116ca589a7052d82959e`; review-run `pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> pass`. | Stop if truthful human-facing semantics require a breaking API contract rename that cannot be introduced compatibly inside this row. | DONE |
| S-50 | Put the active step first and demote duplicate summary surfaces. See S-50 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx | On step 1 and step 2 the active form and CTA appear above the fold before summary chrome, the right summary rail becomes compact supporting context, and step 2 no longer mixes importable years with repair-only years in the same primary list. | Substep 1 complete: `2b6cc019b10c6a372cb505871b8b48f6b1fe40d1`. | Stop if action-first layout would strand required admin repair actions without an accessible secondary panel. | IN_PROGRESS |
| S-51 | Smooth the step-6 handoff so Forecast and Reports feel like continuation, not a second onboarding phase. See S-51 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx | Step 6 offers one coherent next action path, starter-scenario setup is owned in one place only, Forecast opens in a state that matches the step-6 promise, and Reports empty state acknowledges “zero reports yet” as expected and points to the exact next action. | Evidence needed. | Stop if handoff smoothing needs a new scenario-bootstrap contract beyond current frontend scope. | TODO |
| S-52 | Prove UX coherence end-to-end with regressions and a fresh live audit. See S-52 substeps. | apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, docs/WIZARD_UX_CONSISTENCY_AUDIT.md | A fresh local browser audit confirms active-form-first hierarchy, truthful shell state, imported-only human summaries, coherent step-2 import messaging, and smooth Forecast/Reports handoff; the artifact ends with `whole sprint succeeded` or `stopped by blocker: ...`. | Evidence needed. | Stop if the final live audit still finds a human-facing inconsistency after `S-48..S-51`; record the blocker in the artifact and stop the sprint there. | TODO |

### S-48 substeps

- [x] Bootstrap shell truth before any non-overview tab mounts, and redirect direct `/forecast` or `/reports` loads back to truthful locked overview state when setup is incomplete
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/web/src/v2/overviewWorkflow.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:5c7e5885dc14f9c4e2ece144551c0ad636943403 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/overviewWorkflow.ts | docs:N/A | gate-fix:apps/web/src/v2/AppShellV2.test.tsx | status: clean

- [x] Make the shell connection chip, org chip, and page indicator follow setup truth instead of token-only org identity when no utility is selected yet
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:e8a8d2b77013a1fa567a01f1552a5b66a17fdf32 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx | docs:N/A | status: clean

- [x] Make clear/reset return to a truthful locked overview state without lingering unlocked tab context or stale active-workspace labels
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:36c5879db86315a304d9c908d113cf2f5ebd982e | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx | docs:N/A | status: clean

- [x] Add regressions for direct route entry, post-clear reset, and shell truth when the wizard is still at step 1
  - files: apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx
  - evidence: commit:a2b23554314f0d3ec72aeea67ce68a53ec5cce67 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx -> pass | files:apps/web/src/v2/AppShellV2.test.tsx | docs:N/A | status: clean

### S-49 substeps

- [x] Define explicit imported-only review sets so available VEETI years, imported workspace years, ready imported years, and excluded years are not blended in UI reasoning
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:fc320785c4d9e4288a4ddd079af1fa62e80e370c | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> pass | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts | docs:N/A | baseline:absorbed | gate-fix:apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts | status: clean

- [ ] Make wizard summary counts and helper copy describe imported workspace years only, not all available VEETI rows
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:98a216942e00ba25cbd5361394eaba1e5a5df9d7 | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [ ] Make step-5 review and baseline gating depend only on blocked imported years, not on unrelated non-imported VEETI years
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:1200df37d630459290070002ecf18ef9dc8a6459 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [ ] Add regressions that prove imported-only counts and ready baseline progression even when extra non-imported VEETI years remain incomplete
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:d7934c6050ddcbf31404116ca589a7052d82959e | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts | docs:N/A | status: clean

### S-50 substeps

- [ ] Move the step-1 search/connect form above hero and summary chrome so the first visible surface is actionable
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:2b6cc019b10c6a372cb505871b8b48f6b1fe40d1 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [ ] Split step-2 importable years from repair-only VEETI years so the main list and its explanatory copy describe the same set
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Demote the right summary rail and duplicate hero copy into compact supporting context so the active step owns the narrative and the CTA
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add regressions that prove the active step surface is the first visible actionable content on step 1 and step 2
  - files: apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: pending

### S-51 substeps

- [ ] Choose one owner for starter-scenario setup and remove duplicate onboarding between step 6 and Forecast
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Make Forecast first-run state match the step-6 promise instead of dropping the user into a second setup cliff
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Make Reports empty state acknowledge “zero reports yet” as expected after setup and point to the exact next action
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add unlocked handoff regressions across Overview -> Forecast -> Reports so the continuation feels singular instead of restarting setup
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx
  - evidence: pending

### S-52 substeps

- [ ] Add final regression proof for action-first wizard hierarchy and shell truth across the completed flow
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Run a fresh local browser UX consistency audit across step 1-6, Forecast, and Reports, and record the explicit sprint outcome in `docs/WIZARD_UX_CONSISTENCY_AUDIT.md`
  - files: docs/WIZARD_UX_CONSISTENCY_AUDIT.md
  - run: N/A (manual browser smoke audit allowed)
  - evidence: pending
