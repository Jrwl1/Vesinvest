# Sprint

Window: 2026-03-20 to 2026-06-20

Active execution queue only. Execute top-to-bottom.
Accepted rows are intentionally removed from this file once they are no longer active.
Use `docs/SPRINT_ARCHIVE.md` for condensed historical sprint context and `docs/WORKLOG.md`, `docs/CANONICAL_REPORT.md`, and git history for packet/review evidence.
Protocol authority remains `AGENTS.md`.

Execution notes:
- `DO` and `RUNSPRINT` still follow packet-driven execution with row-gated `REVIEW`.
- Cleanliness is always `git status --porcelain`.
- Use direct MCP tools when they materially improve evidence or verification quality.
- Frontend copy rule: delete or rewrite only the strings required by the active row or explicit user direction; do not invent filler/helper/trust/body copy.
- Client-doc rule: customer files under `docs/client/**` are not default PLAN reads; only use them when the user explicitly names them for that pass.

Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` or `N/A` only when the substep text explicitly allows it
- `  - evidence: packet:<hash> | run:<cmd> -> <result> | files:<paths> | docs:<hash or N/A> | status: clean`

## Goal (this sprint)

Restore the frontend HUMANAUDIT-derived rows `S-157..S-163` to the active queue because the archive acceptance no longer matches current code reality.

## Recorded decisions (this sprint)

- `S-157..S-163` are reopened into the active queue on `2026-03-23`.
- Previous archive acceptance for those rows is no longer trusted as proof of current code truth.
- The active queue must prefer truthful reopen over tidy archive history when acceptance and current code disagree.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-157 | Reframe login entry copy and sign-in chrome around the actual product job instead of step jargon. See S-157 substeps. | apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx, apps/web/src/App.test.tsx, apps/web/src/context/DemoStatusContext.tsx | Login explains what Vesipolku is for in plain FI/SV/EN language, the right card does not repeat the sign-in action across multiple stacked phrases, and non-demo entry paths keep API/demo diagnostics clearly secondary. | row:01798a0997ad7842f6b12a1b8e458eda82d5290f \| run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck; pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck -> PASS \| files:apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx \| docs:N/A \| status: clean | Stop if truthful login-entry wording or diagnostic demotion would require changing auth/demo runtime truth beyond the current frontend contract. | DONE |
| S-158 | Stabilize VEETI connect-step search and promote one persistent connected-state support rail after VEETI link. See S-158 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewOrchestration.ts, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewSupportRail.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/**/*.test.tsx, apps/web/src/i18n/locales/*.json | VEETI search settles after typing stops without repeat flicker, and once an org is connected the user keeps one visible support rail through steps `2..6` on desktop with a sane mobile fallback instead of duplicate bottom summary cards. | row:779488a683f149b2c14c7bfa089434efb88d17a8 \| run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx; pnpm --filter ./apps/web typecheck; pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck -> PASS \| files:apps/web/src/v2/OverviewPageV2.test.tsx \| docs:N/A \| status: clean | Stop if stable search or post-connect rail placement requires backend search-contract changes beyond the current `/v2/import/search` and connect-step semantics. | READY |
| S-159 | Simplify the step-2 import board hierarchy, chronology, and parked-year treatment. See S-159 substeps. | apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json | Visible year cards read chronologically left-to-right inside each lane, the missing-data warning stays primary, `Sekundära huvudtal` is replaced with plain pricing/volume language, and parked/unselected years move behind a secondary disclosure that still scales when five or more good VEETI years are present. | Reopened on 2026-03-23 after code audit found archive acceptance no longer trusted as current-code proof. | Stop if collapsing parked years or reordering cards breaks current imported-year state truth or makes five-year selection less recoverable than today. | TODO |
| S-160 | Repair step-2 inline row editing so it behaves like a local card correction flow, not a sticky slab. See S-160 substeps. | apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/useOverviewManualPatchEditor.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx | The full finance row is clickable for edit, save closes the step-2 editor, and after saving one card the user can reopen the same or another year normally without relying on tiny value-chip targets. | Reopened on 2026-03-23 after code audit found archive acceptance no longer trusted as current-code proof. | Stop if whole-row click or close-on-save behavior would require a broader draft-state model or would collapse current checkbox/action affordances into one ambiguous control surface. | TODO |
| S-161 | Make the result warning/signal truthful and understandable after inline financial edits. See S-161 substeps. | apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewManualForms.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/**/*.test.ts, apps/web/src/v2/**/*.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/**/*.spec.ts | The visible result row and its warning text stay coherent after inline finance edits, `/ 0` jargon is removed, and if `TilikaudenYliJaama` remains a separately stored field the UI makes that truth explicit instead of implying silent derivation. | Reopened on 2026-03-23 after code audit found archive acceptance stronger than current guaranteed behavior. | Stop if truthful result behavior requires a broader accounting-contract decision than the current manual-year patch seam can safely absorb. | TODO |
| S-162 | Close with focused wizard regressions and a connected-workspace re-audit that includes a five-year import case. See S-162 substeps. | apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, apps/web/src/**/*.test.tsx, apps/api/src/**/*.spec.ts, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Focused regressions plus a fresh connected-workspace live audit prove the login cleanup, VEETI search stabilization, support rail, chronological five-year board, parked-year disclosure, row-edit/save behavior, and result warning changes work without a new trust blocker, or record the blocker precisely. | Reopened on 2026-03-23 because this is an evidence row and its prior acceptance does not prove current implementation truth. | Stop if the re-audit still exposes a new trust or workflow gap outside `S-157..S-161`; record the blocker and stop there. | TODO |
| S-163 | Correct the login-entry language contract and selector behavior. See S-163 substeps. | apps/web/src/components/LoginForm.tsx, apps/web/src/components/LanguageSwitcher.tsx, apps/web/src/i18n/index.ts, apps/web/src/i18n/locales/*.json, apps/web/src/App.css, apps/web/src/components/*.test.tsx, apps/web/src/App.test.tsx | On first unauthenticated open the login screen starts in Finnish, the existing in-app language selector is visible on the login screen, and the FI/SV/EN login copy uses one plain product/task meaning without workflow-jargon like imported/reviewed years or planning baseline. | Reopened on 2026-03-23 after code audit found the Finnish-first claim stronger than the current bootstrapping behavior. | Stop if Finnish-first unauthenticated entry conflicts with a customer-locked language-selection rule outside current repo evidence. | TODO |

### S-157 substeps

- [x] Replace the login hero and sign-in card copy with plain product/task language and remove repeated sign-in chrome across the card header
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:01798a0997ad7842f6b12a1b8e458eda82d5290f | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

- [x] Demote or hide API/demo environment diagnostics on normal login paths while keeping explicit demo availability truth for demo-capable environments
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/App.css, apps/web/src/App.test.tsx, apps/web/src/components/LoginForm.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:01798a0997ad7842f6b12a1b8e458eda82d5290f | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.test.tsx, apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

### S-158 substeps

- [x] Stop VEETI auto-search from retriggering after typing or org-selection settles and prove the result list stops flickering after debounce
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewOrchestration.ts, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: row:779488a683f149b2c14c7bfa089434efb88d17a8 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx; pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Promote one connected-state support rail after VEETI link and remove duplicate bottom summary placement on desktop while keeping a sane mobile fallback
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewSupportRail.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:779488a683f149b2c14c7bfa089434efb88d17a8 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/i18n/locales/localeIntegrity.test.ts; pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-159 substeps

- [ ] Render step-2 year cards chronologically within each lane and keep five-year import cases readable without newest-to-oldest reading order
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance no longer trusted as current-code proof.

- [ ] Collapse parked or unselected years into a secondary disclosure and quiet the lower price/volume section with plain-language labels instead of `Sekundära huvudtal`
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance no longer trusted as current-code proof.

### S-160 substeps

- [ ] Make the full step-2 finance row clickable for inline edit instead of limiting entry to the numeric value button
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance no longer trusted as current-code proof.

- [ ] Close the step-2 inline editor on save and keep same-card/other-card reopen behavior reliable without tiny-target recovery paths
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/useOverviewManualPatchEditor.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance no longer trusted as current-code proof.

### S-161 substeps

- [ ] Replace `/ 0` result jargon with plain warning copy and keep the visible result signal coherent after inline financial edits
  - files: apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance stronger than current guaranteed behavior.

- [ ] If `TilikaudenYliJaama` remains a separately stored field, make that truth explicit across summary/build warning paths and cover it with web/api regression proof
  - files: apps/web/src/v2/overviewManualForms.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/web/src/v2/**/*.test.ts, apps/web/src/v2/**/*.test.tsx, apps/api/src/v2/**/*.spec.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found acceptance stronger than current guaranteed behavior.

### S-162 substeps

- [ ] Run the focused login + wizard regression bundle for the new entry copy, support rail, chronology, parked-year, search, and row-edit behavior
  - files: apps/web/src/components/**, apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/**/*.test.tsx, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: Reopened from archive on 2026-03-23 because this row is an evidence gate and the prior acceptance is not trusted as current truth.

- [ ] Re-run a connected-workspace live audit through VEETI connect, year import, five-year selection/recovery, row edit/save, and baseline context, and record whether the queue succeeded or stopped on a blocker in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: Reopened from archive on 2026-03-23 because this row is an evidence gate and the prior acceptance is not trusted as current truth.

### S-163 substeps

- [ ] Force unauthenticated app entry to Finnish by default until the user explicitly switches language
  - files: apps/web/src/i18n/index.ts, apps/web/src/App.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/App.test.tsx, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found the Finnish-first claim stronger than current boot behavior.

- [ ] Add the existing in-app language selector to the login screen and replace FI/SV/EN login copy with one plain Finnish source meaning translated cleanly across all three locales
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/components/LanguageSwitcher.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/*.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/components/LanguageSwitcher.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Reopened from archive on 2026-03-23 after code audit found archive acceptance no longer trusted as current-code proof.
