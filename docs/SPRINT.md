# Sprint

Window: 2026-03-11 to 2026-05-30

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
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Replace the current Overview-first dashboard surface with a six-step guided setup wizard that takes users from utility selection to a ready planning baseline, keeps Ennuste locked until the handoff step, removes misleading setup jargon, and makes year exclusion truthful instead of destructive.

## Recorded decisions (this sprint)

- The first authenticated V2 window is a setup wizard, not a dashboard.
- The wizard must show `Vaihe X / 6`, one primary action per step, and a persistent compact summary of company, imported years, ready years, excluded years, and baseline readiness.
- User-facing setup copy must remove `sync ready`, `sync`, `baseline budget`, and `delete year` wording from the first-window flow.
- `Pois suunnitelmasta` must mean non-destructive planning exclusion. It cannot remain a relabeled destructive delete path.
- Peer snapshot, admin ops snapshot, duplicate status blocks, and trend/chart clutter are not first-window setup content; they move behind secondary detail surfaces or out of the flow.
- Ennuste stays visibly locked until the wizard reaches the final handoff step.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-37 | Replace the current Overview landing shell with six-step wizard chrome, sticky setup summary, truthful org chip formatting, and visibly locked Ennuste/Reports navigation. See S-37 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | The first authenticated window shows `Vaihe X / 6`, the compact summary stays visible, the org chip uses imported company name plus short hash, only the active step has a primary CTA, and Ennuste/Reports are visibly locked until wizard completion. | DONE: acceptance verified against commits `b9e82c0`, `b3db6bd`, `211bbc4`, and `0582e12`, with wizard shell regressions passing; the first authenticated window now shows wizard step state, sticky setup summary, company-plus-hash org chip, locked Forecast/Reports behavior, and no extra loud import-panel primary CTAs. | Stop if wizard step state cannot be derived from existing overview/context/import-status data without first changing backend contracts. | DONE |
| S-38 | Split utility connection, year import, and baseline creation into truthful separate steps so step 2 can import selected years into the workspace without also creating baseline budgets. See S-38 substeps. | apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Step 1 asks `Minkä vesilaitoksen tiedoilla työskentelet?`, step 2 asks `Mitkä vuodet haluat tuoda sisään?`, imported years are confirmed in the workspace after step 2, and step 2 no longer quietly creates baseline budgets. | DONE: acceptance verified against commits `96b2ec7`, `25ae80f`, `c28a7e2`, and `0fe61c4`; the V2 contract now separates year import from budget generation, the visible step-1/step-2 flow uses `Yhdistä organisaatio` and `Tuo valitut vuodet`, imported years are confirmed in the workspace copy, and focused API/web regressions pass. | Stop if import-years vs baseline separation requires schema changes or migration work that cannot be isolated inside the V2 import contract. | DONE |
| S-39 | Rebuild year review as a focused setup status step with only three checks and one overall year status, and remove dashboard-style clutter from the first window. See S-39 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts | Step 3 asks `Mitkä vuodet ovat käyttövalmiita?`, each year shows only `Tilinpäätös`, `Taksa`, and `Volyymit`, each year resolves to `Valmis`, `Korjattava`, or `Pois suunnitelmasta`, and the first-window setup flow no longer leads with peer snapshot, trend cards/chart, duplicate status panels, or admin ops telemetry. | DONE: acceptance verified against commits `feb6fd2`, `30ce4da`, `e8b8442`, and `fd2eaf5`; the setup review model now derives the three readiness checks plus one overall year status, the visible step-3 surface is a focused year-status list with a single `Jatka` CTA, peer/admin/duplicate setup clutter has been removed from Overview, and helper coverage locks wizard-state plus excluded-year behavior. | Stop if the focused status step requires widening backend payloads beyond the current completeness/source data already exposed by V2 import status and year data. | DONE |
| S-40 | Replace the current repair/delete flow with a step-4 single-year decision flow that supports keep, fix, exclude from plan, and restore, while making exclusion truthful and non-destructive. See S-40 substeps. | apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Step 4 asks `Mitä tälle vuodelle tehdään?`, problem years are handled one at a time, the setup surface offers keep/fix/exclude/restore actions, and `Pois suunnitelmasta` no longer deletes imported snapshots or baseline budgets. | DONE: acceptance verified against commits `bd55d4d`, `0d845af`, `77c08d9`, and `782622f`; V2 now has a separate non-destructive exclusion API, the year modal is refocused into keep/fix/exclude/restore decisions, delete/remove setup copy has been replaced with truthful exclusion/restore wording, and regression coverage locks exclusion, restore, and manual-fix flows. | Stop if truthful exclusion semantics would still delete historical data or break existing scenario/report baselines without an explicit compatibility strategy. | DONE |
| S-41 | Create a dedicated planning-baseline step that summarizes included, excluded, and corrected years and uses user-facing planning language instead of sync jargon. See S-41 substeps. | apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx | Step 5 asks `Rakennetaanko näistä vuosista suunnittelupohja?`, the user sees included/excluded/corrected years before confirming, the CTA is `Luo suunnittelupohja`, and setup-surface copy no longer says `sync`, `sync ready`, or `baseline budget`. | DONE: acceptance verified against commits `5ab62e8`, `72a77c6`, `0dcab48`, and `a885a49`; V2 now has a separate planning-baseline contract, Overview shows the step-5 planning-baseline summary and `Luo suunnittelupohja` CTA, the sticky summary updates after success, and API/web regression coverage locks baseline creation, skipped years, and post-baseline readiness. | Stop if the planning-baseline step cannot be separated cleanly from step 2 import without rewriting unrelated VEETI budget-generation behavior. | DONE |
| S-42 | Add the final handoff step that unlocks Ennuste only after setup completion and optionally captures the first scenario name and horizon before opening Forecast. See S-42 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts | Step 6 asks `Valmis ennustamiseen?`, setup completion is confirmed, the first scenario name and horizon can be captured if needed, the CTA is `Avaa Ennuste`, and Forecast unlocks only after the wizard is complete. | Evidence needed. | Stop if the step-6 starter requires new forecast contracts beyond the current scenario creation inputs (`name`, `horizonYears`, `talousarvioId`, `compute`). | TODO |

### S-37 substeps

- [x] Define a wizard-state model and shell-level locked-navigation contract using the current Overview/import/context signals
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:b9e82c0 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewWorkflow.ts | docs:N/A | status: clean

- [x] Replace the first-window hero, next-step card, and duplicate legacy status block with wizard chrome and the sticky compact summary
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:b3db6bd | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Format the org chip as `Imported Company Name · short hash` and keep Ennuste/Reports visibly locked before wizard completion
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:211bbc4 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add regression coverage for step indicator, locked tabs, and sticky summary behavior so the shell stays wizard-first
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: commit:b35c98f | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/AppShellV2.test.tsx | docs:N/A | status: clean

- [x] Demote or remove extra primary CTAs from the legacy import panels so only the active wizard step owns the loud action state on the first window
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:0582e12 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-38 substeps

- [x] Trace the current `connectOrg` and `syncImport` coupling and add an explicit API contract for importing selected years without generating baseline budgets
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:96b2ec7 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/api/src/v2/dto/import-years.dto.ts,apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Rework step 1 and step 2 UI so utility connection and year import are separate questions with the CTAs `Yhdistä organisaatio` and `Tuo valitut vuodet`
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:25ae80f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Confirm imported years in the wizard summary and step body without exposing budget-generation or sync jargon
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:c28a7e2 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add regression coverage for separated connect/import behavior across the web and API contracts
  - files: apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:0fe61c4 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-39 substeps

- [x] Reduce setup review to three readiness checks and one derived overall year status using the current completeness/source signals
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:feb6fd2 | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewWorkflow.test.ts,apps/web/src/v2/overviewWorkflow.ts | docs:N/A | status: clean

- [x] Replace the current trend cards/chart toggle with a focused year-status list that prioritizes understanding over KPI exploration
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:30ce4da | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Move peer snapshot, duplicate status panels, and admin ops telemetry out of the first-window setup path
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:e8b8442 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Update year-review helper coverage so the focused setup status model stays stable across future Overview changes
  - files: apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx
  - evidence: commit:fd2eaf5 | run:pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/overviewWorkflow.test.ts,apps/web/src/v2/yearReview.test.ts | docs:N/A | status: clean

### S-40 substeps

- [x] Separate planning exclusion from destructive year deletion in the V2 API so `Pois suunnitelmasta` no longer deletes snapshots or baseline budgets
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:bd55d4d | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Refocus the current manual-year modal into a step-4 single-year decision UI with keep, fix, exclude, and restore actions
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:0d845af | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Replace setup-surface delete wording and confirmations with truthful exclusion and restore copy
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:77c08d9 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add regression coverage for exclusion, restore, and manual-fix flows so the non-destructive contract stays enforced
  - files: apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:782622f | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-41 substeps

- [x] Add an explicit planning-baseline API contract that turns selected included years into baseline budgets after setup review is complete
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: commit:5ab62e8 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> PASS | files:apps/api/src/v2/dto/create-planning-baseline.dto.ts,apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Replace setup-surface sync and baseline-budget language with the step-5 planning-baseline summary and `Luo suunnittelupohja` CTA
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:72a77c6 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Show included, excluded, and corrected years before baseline creation and update the sticky summary after success
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:0dcab48 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add web and API regression coverage for planning-baseline creation, skipped years, and post-baseline readiness states
  - files: apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:a885a49 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-42 substeps

- [ ] Add wizard completion state that keeps Ennuste locked until a planning baseline exists and prior setup steps are resolved
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:pnpm --filter ./apps/web typecheck -> TBD | files:TBD | docs:N/A | status: pending

- [ ] Reuse or extend the existing scenario-create contract for step-6 starter fields without breaking the current Forecast entry path
  - files: apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck -> TBD | files:TBD | docs:N/A | status: pending

- [ ] Implement the final wizard confirmation and handoff UI with optional scenario name and horizon before `Avaa Ennuste`
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:TBD | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> TBD | files:TBD | docs:N/A | status: pending

- [ ] Add regression coverage for locked-to-unlocked tab behavior and wizard-to-Forecast handoff
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx
  - evidence: commit:TBD | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx -> TBD | files:TBD | docs:N/A | status: pending
