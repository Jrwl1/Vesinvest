# Sprint

Window: 2026-03-16 to 2026-06-19

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

Turn the setup wizard into a trust-first import-review-confirm flow: make step-1 company lookup assisted instead of button-driven, separate `technical ready` from `reviewed` year semantics, replace row-count-first year cards with recognizable business values, let every imported year open into the same review/edit surface, expose raw VEETI versus effective values plus per-section restore paths, and end with a fresh live audit that says whether the wizard is now ready or blocked.

## Recorded decisions (this sprint)

- Wizard year state must separate `technical ready` from human `reviewed/accepted`; `Valmis` alone is not enough.
- Every imported year, including technically ready years, must be reviewable and editable from the wizard.
- Year cards should lead with recognizable business values from the canonical yearly sections, not only dataset row counts.
- The shared year-detail surface should show the canonical financial rows, unit prices, and sold volumes first; investments, energy, network, and notes remain secondary.
- Step-1 lookup should become assisted typeahead with explicit search fallback, and backend search hardening belongs in the same queue.
- The sprint is not considered complete until a fresh live wizard audit explicitly states whether the whole queue succeeded or stopped on a blocker.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-48 | Make AppShell truthful and route-safe before Overview mounts. See S-48 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/api.ts | Direct `/forecast` and `/reports` entry cannot bypass setup locks, the header connection/org chip and page indicator do not imply a selected org or unlocked workspace when the wizard says otherwise, and clear/reset returns the user to a truthful locked overview state. | Accepted on review: commits `5c7e5885dc14f9c4e2ece144551c0ad636943403`, `e8a8d2b77013a1fa567a01f1552a5b66a17fdf32`, `36c5879db86315a304d9c908d113cf2f5ebd982e`, `a2b23554314f0d3ec72aeea67ce68a53ec5cce67`; review-run `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx -> pass`. | Stop if truthful shell state requires a new dedicated backend setup-status contract that cannot be introduced compatibly inside this row. | DONE |
| S-49 | Make human-facing year semantics truthful and imported-only. See S-49 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Available VEETI years, imported workspace years, ready imported years, blocked imported years, and excluded years are distinct sets in API/UI reasoning; wizard summaries and progression use workspace-backed rows only; step-5 baseline gating ignores non-imported blocked years. | Accepted on review: commits `fc320785c4d9e4288a4ddd079af1fa62e80e370c`, `98a216942e00ba25cbd5361394eaba1e5a5df9d7`, `1200df37d630459290070002ecf18ef9dc8a6459`, `d7934c6050ddcbf31404116ca589a7052d82959e`; review-run `pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts -> pass`. | Stop if truthful human-facing semantics require a breaking API contract rename that cannot be introduced compatibly inside this row. | DONE |
| S-50 | Put the active step first and demote duplicate summary surfaces. See S-50 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx | On step 1 and step 2 the active form and CTA appear above the fold before summary chrome, the right summary rail becomes compact supporting context, and step 2 no longer mixes importable years with repair-only years in the same primary list. | Accepted on review: commits `2b6cc019b10c6a372cb505871b8b48f6b1fe40d1`, `b64816c9bed1dcf4e5f1979c864fb38fcb9af34c`, `26a88f5834b7553fc41893e6cf08b4ffa7b7f3b7`; review-run `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if action-first layout would strand required admin repair actions without an accessible secondary panel. | DONE |
| S-51 | Smooth the step-6 handoff so Forecast and Reports feel like continuation, not a second onboarding phase. See S-51 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx | Step 6 offers one coherent next action path, starter-scenario setup is owned in one place only, Forecast opens in a state that matches the step-6 promise, and Reports empty state acknowledges “zero reports yet” as expected and points to the exact next action. | Accepted on review: packet `7aed6091d731e5f9199fd607a8821e1d011ef9b5`; review-run `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if handoff smoothing needs a new scenario-bootstrap contract beyond current frontend scope. | DONE |
| S-52 | Prove UX coherence end-to-end with regressions and a fresh live audit. See S-52 substeps. | apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, docs/WIZARD_UX_CONSISTENCY_AUDIT.md | A fresh local browser audit confirms active-form-first hierarchy, truthful shell state, imported-only human summaries, coherent step-2 import messaging, and smooth Forecast/Reports handoff; the artifact ends with `whole sprint succeeded` or `stopped by blocker: ...`. | Accepted on review: packet `92852cc9d147fbe3bd03fa71740079ad16f5cdeb`; review-run `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`; artifact `docs/WIZARD_UX_CONSISTENCY_AUDIT.md` ends with `whole sprint succeeded`. | Stop if the final live audit still finds a human-facing inconsistency after `S-48..S-51`; record the blocker in the artifact and stop the sprint there. | DONE |
| S-53 | Make Forecast status and the top command strip truthful before the power-user cockpit refactor. See S-53 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx | Selected scenario state is expressed through one consistent truth model across the Forecast strip, the Forecast body, and Reports readiness; users never see mixed `computed` versus `needs recompute` signals, and the primary actions at the top of Forecast match the actual scenario/report state. | Accepted on review: packet `3007947089edc0624e067701a1c219ea32789a9c`; review-run `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if truthful status requires a new persisted compute-version contract that cannot be introduced compatibly inside this row. | DONE |
| S-54 | Replace the long form-first Forecast landing with a resultatrakning-first cockpit around the five planning pillars. See S-54 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx | A selected scenario opens to a compact cockpit centered on `Intakter`, `Materialkostnader`, `Personalkostnader`, `Ovriga rorelsekostnader`, and `Avskrivningar`, with baseline/scenario/delta/provenance context and derived result rows visible before the long editing surfaces. | Accepted on review: packet `189a733a7a93fcfafb4950ed0d21f7492f78b185`; review-run `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if the current scenario payload cannot supply the baseline/scenario/delta context needed for the cockpit without a broader data-contract change. | DONE |
| S-55 | Add statement-native drill-down editing and dense workbench mode for the four non-depreciation pillars. See S-55 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx | Power users can open dedicated drill-downs for `Intakter`, `Materialkostnader`, `Personalkostnader`, and `Ovriga rorelsekostnader`, edit the relevant yearly drivers in a denser surface, and return to the cockpit without losing statement context. | Accepted on review: packets `78b09decf90c423792c0b53e97dbb511518a6f66`, `b33e8fe4e25fb137fc436b2fe2dd9504d07ad6b8`; review-run `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if pillar-specific editing reveals missing line-level state that cannot be represented compatibly inside the current scenario model. | DONE |
| S-56 | Migrate depreciation from organization-level rules to a scenario-specific baseline + new-investment contract. See S-56 substeps. | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts | The API exposes scenario-scoped `Avskrivningar` rules and mappings, supports `straight-line` and `custom annual schedule`, keeps `Basavskrivningar` separate from scenario-added depreciation, and no longer treats depreciation rule state as organization-global. | Accepted on review: packets `4600be4780b5b2f263653cff74cb97003bc7bc00`, `92189d4dcc146dd1812199500bc1a116b3a0b718`; review-run `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> pass`. | Stop if migrating away from the current organization-level rule table cannot be done compatibly with existing scenarios and reports inside one bounded backend row. | DONE |
| S-57 | Build the scenario-specific `Avskrivningar` workspace with one-investment/one-category mapping and yearly preview. See S-57 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts | Each scenario exposes an `Avskrivningar` workspace where the user can edit baseline depreciation, define scenario depreciation categories, map each investment to exactly one category, and inspect yearly baseline/new/total depreciation before report creation; report readiness stays blocked while required depreciation mapping is incomplete. | Accepted on review: packet `bfc24cda78286249367787070daf327e5b5f2648`; review-run `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`. | Stop if one-investment/one-category mapping is not representable without changing the current yearly-investment editing contract beyond this row. | DONE |
| S-58 | Add statement-native scenario comparison and close with a power-user Forecast audit artifact. See S-58 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx, docs/ENNUSTE_POWER_USER_AUDIT.md | Users can compare scenarios through the five planning pillars and derived result rows, and a fresh local audit states whether the Forecast cockpit is power-user ready or stopped by a blocker. | Accepted on review: packet `2f7d53a465fcaacc096bbc7591442c77f530795c`; review-run `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass`; artifact `docs/ENNUSTE_POWER_USER_AUDIT.md` ends with `whole sprint succeeded`. | Stop if the final live audit still finds a power-user blocker after `S-53..S-57`; record it in the artifact and stop the sprint there. | DONE |
| S-59 | Turn step-1 company lookup into assisted search with backend-safe suggestions and a simpler connect path. See S-59 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/api/src/v2/dto/import-search-query.dto.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti.service.spec.ts | Step 1 offers debounced lookup suggestions after a short input threshold, Y-tunnus-like input gets a faster path, result rows are easier to select/connect, and the backend search path remains tenant-authenticated and reliable for common utility lookups. | Packet 1-2 landed; see substeps. | Stop if reliable typeahead requires a new VEETI-side server search capability or a cache/storage layer that exceeds this bounded queue. | IN_PROGRESS |
| S-60 | Split technical readiness from human review state and make that truth survive reload. See S-60 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Imported years no longer present technical completeness as customer approval, the wizard can distinguish `technical ready` from `reviewed`, and that state survives refresh/reset semantics correctly. | Evidence needed. | Stop if the current year-policy/override contract cannot represent review state compatibly inside this queue. | TODO |
| S-61 | Replace row-count-first year cards with trustworthy value previews and year actions in steps 2 and 3. See S-61 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx | Step-2 and step-3 year cards lead with recognizable business values from the canonical yearly sections, ready years get explicit open/review actions, and blocked years keep their repair path without being the only reviewable rows. | Evidence needed. | Stop if compact value previews cannot remain truthful and scan-friendly without a larger responsive redesign than this queue allows. | TODO |
| S-62 | Replace the blocked-year-only modal with one shared year-detail review/edit surface and expose raw VEETI versus effective values plus per-section restore paths. See S-62 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Ready, blocked, and excluded years open the same calm year-detail surface; canonical financial rows, prices, and volumes come first; raw VEETI versus effective values are visible; and users can restore VEETI values per section instead of only through a financial-only path. | Evidence needed. | Stop if section-level restore for prices/volumes needs a new granular reconcile backend contract that cannot be introduced compatibly in this queue. | TODO |
| S-63 | Prove the wizard trust flow end-to-end with regressions and a fresh live audit artifact. See S-63 substeps. | apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti.service.spec.ts, docs/WIZARD_TRUST_REAUDIT.md | A fresh local audit confirms assisted lookup, truthful ready-versus-reviewed year states, expandable/imported year review for ready years, calm year-detail editing, and a clear outcome of `whole sprint succeeded` or `stopped by blocker: ...`. | Evidence needed. | Stop if the final live audit still finds a trust or review blocker after `S-59..S-62`; record it in the artifact and stop the sprint there. | TODO |

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
  - evidence: commit:b64816c9bed1dcf4e5f1979c864fb38fcb9af34c | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [ ] Demote the right summary rail and duplicate hero copy into compact supporting context so the active step owns the narrative and the CTA
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:26a88f5834b7553fc41893e6cf08b4ffa7b7f3b7 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [ ] Add regressions that prove the active step surface is the first visible actionable content on step 1 and step 2
  - files: apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: packet:26a88f5834b7553fc41893e6cf08b4ffa7b7f3b7 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-51 substeps

- [x] Choose one owner for starter-scenario setup and remove duplicate onboarding between step 6 and Forecast
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7aed6091d731e5f9199fd607a8821e1d011ef9b5 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Make Forecast first-run state match the step-6 promise instead of dropping the user into a second setup cliff
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7aed6091d731e5f9199fd607a8821e1d011ef9b5 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Make Reports empty state acknowledge “zero reports yet” as expected after setup and point to the exact next action
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7aed6091d731e5f9199fd607a8821e1d011ef9b5 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Add unlocked handoff regressions across Overview -> Forecast -> Reports so the continuation feels singular instead of restarting setup
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx
  - evidence: packet:7aed6091d731e5f9199fd607a8821e1d011ef9b5 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

### S-52 substeps

- [x] Add final regression proof for action-first wizard hierarchy and shell truth across the completed flow
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:92852cc9d147fbe3bd03fa71740079ad16f5cdeb | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck; manual browser audit -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, docs/WIZARD_UX_CONSISTENCY_AUDIT.md | docs:N/A | status: clean

- [x] Run a fresh local browser UX consistency audit across step 1-6, Forecast, and Reports, and record the explicit sprint outcome in `docs/WIZARD_UX_CONSISTENCY_AUDIT.md`
  - files: docs/WIZARD_UX_CONSISTENCY_AUDIT.md
  - run: N/A (manual browser smoke audit allowed)
  - evidence: packet:92852cc9d147fbe3bd03fa71740079ad16f5cdeb | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck; manual browser audit -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, docs/WIZARD_UX_CONSISTENCY_AUDIT.md | docs:N/A | status: clean

### S-53 substeps

- [x] Define one explicit Forecast freshness/status model and expose it through a compact top command strip
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:3007947089edc0624e067701a1c219ea32789a9c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Align Reports readiness copy and CTA state with the same Forecast status truth instead of separate ad-hoc messaging
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:3007947089edc0624e067701a1c219ea32789a9c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Add regressions for unsaved, stale, computing, current, and report-ready state truth across Forecast and Reports
  - files: apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx
  - evidence: packet:3007947089edc0624e067701a1c219ea32789a9c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

### S-54 substeps

- [x] Replace the current selected-scenario landing area with a compact resultatrakning-first cockpit above the long editing surfaces
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:189a733a7a93fcfafb4950ed0d21f7492f78b185 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Surface the five planning pillars with baseline, scenario, delta, and provenance summaries plus derived result rows
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:189a733a7a93fcfafb4950ed0d21f7492f78b185 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Add regressions that prove the cockpit pillars and derived result rows render before the detailed editing blocks
  - files: apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx
  - evidence: packet:189a733a7a93fcfafb4950ed0d21f7492f78b185 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-55 substeps

- [x] Add an `Intakter` drill-down that owns tariff, volume, and revenue-driver editing while preserving return-to-cockpit context
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:78b09decf90c423792c0b53e97dbb511518a6f66 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Split `Materialkostnader`, `Personalkostnader`, and `Ovriga rorelsekostnader` into their own dense drill-down surfaces using the current opex controls
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:b33e8fe4e25fb137fc436b2fe2dd9504d07ad6b8 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Add a dense analyst mode and regressions for drill-down navigation, retained edits, and cockpit return
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx
  - evidence: packet:b33e8fe4e25fb137fc436b2fe2dd9504d07ad6b8 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-56 substeps

- [x] Introduce scenario-specific depreciation storage that separates `Basavskrivningar` from new-investment depreciation and leaves existing scenarios migratable
  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:4600be4780b5b2f263653cff74cb97003bc7bc00 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck -> pass | files:apps/api/prisma/migrations/20260315204000_add_scenario_depreciation_storage/migration.sql, apps/api/prisma/schema.prisma, apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

- [x] Replace the current organization-level depreciation-rule API with scenario-scoped CRUD and mapping endpoints in the backend and web client
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:92189d4dcc146dd1812199500bc1a116b3a0b718 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> pass | files:apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/projections/projections.service.ts, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | gate-fix:apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/projections/projections.service.ts, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/v2.controller.ts, apps/web/src/v2/EnnustePageV2.tsx | status: clean

- [x] Add API regressions for `straight-line`, `custom annual schedule`, and the one-investment/one-category rule
  - files: apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts
  - evidence: packet:92189d4dcc146dd1812199500bc1a116b3a0b718 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> pass | files:apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/projections/projections.service.ts, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | gate-fix:apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/projections/projections.service.ts, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/v2.controller.ts, apps/web/src/v2/EnnustePageV2.tsx | status: clean

### S-57 substeps

- [x] Add an `Avskrivningar` workspace that exposes `Basavskrivningar` and scenario depreciation category rules for the selected scenario
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:bfc24cda78286249367787070daf327e5b5f2648 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | gate-fix:apps/api/src/v2/v2.service.ts | status: clean

- [x] Add one-to-one investment mapping, unmapped-state visibility, and report blocking until required depreciation mapping is complete
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:bfc24cda78286249367787070daf327e5b5f2648 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | gate-fix:apps/api/src/v2/v2.service.ts | status: clean

- [x] Add yearly depreciation preview for baseline, new investments, and total effect, plus regressions for the preview and gating rules
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx
  - evidence: packet:bfc24cda78286249367787070daf327e5b5f2648 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | gate-fix:apps/api/src/v2/v2.service.ts | status: clean

### S-58 substeps

- [x] Add statement-native scenario comparison for the five pillars and derived result rows
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:2f7d53a465fcaacc096bbc7591442c77f530795c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, docs/ENNUSTE_POWER_USER_AUDIT.md | docs:N/A | status: clean

- [x] Add regressions for the cockpit -> drill-down -> compute -> report-readiness -> comparison loop
  - files: apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx
  - evidence: packet:2f7d53a465fcaacc096bbc7591442c77f530795c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, docs/ENNUSTE_POWER_USER_AUDIT.md | docs:N/A | status: clean

- [x] Run a fresh local power-user Forecast audit and record the explicit sprint outcome in `docs/ENNUSTE_POWER_USER_AUDIT.md`
  - files: docs/ENNUSTE_POWER_USER_AUDIT.md
  - run: N/A (manual browser power-user audit allowed)
  - evidence: packet:2f7d53a465fcaacc096bbc7591442c77f530795c | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck; local audit artifact -> pass | files:apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, docs/ENNUSTE_POWER_USER_AUDIT.md | docs:N/A | status: clean

### S-59 substeps

- [x] Add debounced lookup suggestions and Y-tunnus-friendly search behavior to step 1 without removing explicit search fallback
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:5e2b26c34c2f73843197fc5742b97dc06bd4cfc5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Simplify result-row selection and connect behavior so step 1 is no longer a four-click lookup flow
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: packet:5e2b26c34c2f73843197fc5742b97dc06bd4cfc5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [ ] Harden backend org search for typeahead-scale usage while keeping it tenant-authenticated and bounded
  - files: apps/api/src/v2/dto/import-search-query.dto.ts, apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti.service.ts, apps/api/src/veeti/veeti.service.spec.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: Evidence needed

### S-60 substeps

- [ ] Define and persist separate imported-year states for technical readiness versus human review/acceptance
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: Evidence needed

- [ ] Update step-3 review flow, summary copy, and handoff gating so technical completeness never implies customer approval
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Evidence needed

### S-61 substeps

- [ ] Replace dataset-count-first importable-year cards with recognizable preview values from the canonical yearly sections
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Evidence needed

- [ ] Give ready imported years explicit open/review actions in step 3 instead of leaving only blocked years actionable
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx
  - evidence: Evidence needed

### S-62 substeps

- [ ] Replace the blocked-year-only modal with one shared year-detail surface for ready, blocked, and excluded years
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Evidence needed

- [ ] Make the year-detail surface lead with canonical financial rows, prices, and volumes, and demote investments, energy, network, notes, and PDF import to secondary detail
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Evidence needed

- [ ] Expose raw VEETI versus effective values and add section-level restore paths for financials, prices, and volumes
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: Evidence needed

### S-63 substeps

- [ ] Add final regression proof for assisted lookup, ready-versus-reviewed semantics, ready-year actions, and shared year-detail behavior
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: Evidence needed

- [ ] Run a fresh local browser wizard trust audit across steps 1-4 and record the explicit sprint outcome in `docs/WIZARD_TRUST_REAUDIT.md`
  - files: docs/WIZARD_TRUST_REAUDIT.md
  - run: N/A (manual browser wizard trust audit allowed)
  - evidence: Evidence needed
