# Sprint

Window: 2026-03-20 to 2026-06-20

Active execution queue only. Execute top-to-bottom.
Accepted rows are intentionally removed from this file once they are no longer active.
Use `docs/SPRINT_ARCHIVE.md` for condensed historical sprint context and `docs/WORKLOG.md`, `docs/CANONICAL_REPORT.md`, and git history for historical evidence.
Protocol authority remains `AGENTS.md`.

Execution notes:
- `DO` and `RUNSPRINT` follow row-driven execution with row-gated `REVIEW`.
- Cleanliness is always `git status --porcelain`.
- Use direct MCP tools when they materially improve evidence or verification quality.
- Frontend copy rule: delete or rewrite only the strings required by the active row or explicit user direction; do not invent filler/helper/trust/body copy.
- Client-doc rule: customer files under `docs/client/**` are not default PLAN reads; only use them when the user explicitly names them for that pass.

Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>`, `covered by row-end bundle -> <command(s)>`, or `N/A` only when the substep text explicitly allows it
- `  - evidence: row:<hash> | run:<cmd> -> <result> | files:<paths> | docs:<hash or N/A> | status: clean`

## Goal (this sprint)

Carry the live dev-site cleanup through the step-2 to step-4 wizard surfaces without widening into a broader redesign.

## Recorded decisions (this sprint)

- `S-157..S-170` remain done and belong in `docs/SPRINT_ARCHIVE.md`, not the active queue.
- `S-171` is copy-parity only: propagate the short exact edited-line style from step 2 into the step-3 review cards and remove the leftover verbose deviation sentence there.
- `S-172..S-174` stay inside the same wizard flow and target only user-notice-first clutter: duplicate back controls, duplicate step-4 actions, and machine-ish provenance/meta copy.
- `S-175` is a narrow browser-truth/performance row: visible/imported year prefetch only, with no broad caching rewrite.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-171 | Propagate the short exact edited-line copy style into step-3 review cards. See S-171 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | Step-3 review cards no longer say the older `corrected year differs from VEETI` sentence. When exact edited lines are known, the review cards use the same short `Muokattu: <line>` style already visible on step 2; no new filler copy is added. | row:1591aab785c3018ec7f17a96d4495a12a7d3d6f8 \| run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass \| files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/useOverviewSetupState.ts \| docs:8f6338e2a184eac0220a8dd6c60831112f80cc3a \| status: clean | Stop if step-3 review cards cannot truthfully reuse the exact edited-line source without introducing a new backend/source-field contract or inventing fallback copy. | DONE |
| S-172 | Remove duplicate back navigation inside the wizard so each surface exposes one clear back action. See S-172 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css | Step 2, step 3, and step-4 wizard surfaces no longer show duplicate back buttons in both the shell and the local panel/modal at the same time. Back behavior remains truthful and keyboard-safe. | row:68b1ac56f77cbf273cfcd8c7c89e96cc41fe2060 \| run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass \| files:apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewReviewBoard.tsx,apps/web/src/v2/OverviewWizardPanels.tsx \| docs:2cd3dceabcc0c61d3f4feea02ea2ce2e688d3afd \| status: clean | Stop if removing the duplicate back controls would break the current wizard branch/back semantics instead of only trimming redundant UI. | DONE |
| S-173 | Simplify the step-4 year-decision/QDIS modal to one primary action path. See S-173 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/v2.css | The step-4 year-decision/QDIS modal exposes one clear upload/import path and one confirm path; duplicate QDIS action buttons and redundant helper stacks are removed; the modal stays truthful without new filler copy. | row:056b68f8389f68345e22743b978a4a0c9ab83c5e \| run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass \| files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx \| docs:N/A \| status: clean | Stop if truthful simplification would require inventing new user-facing helper copy instead of deleting or tightening the existing repeated text/actions. | READY |
| S-174 | Replace machine-ish provenance/count copy on step-2 year cards with short human-readable provenance. See S-174 substeps. | apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | Step-2 cards no longer render raw count strings like `Bokslut: 1, Enhetspriser: 2...` as user-facing provenance. Provenance stays compact, human-readable, and truthful. | Pending. | Stop if the current UI cannot become human-readable without hiding required provenance truth or inventing unsupported source summaries. | TODO |
| S-175 | Tighten reviewed-year prefetching to visible/imported years only. See S-175 substeps. | apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewSelectors.ts, apps/web/src/v2/OverviewPageV2.test.tsx | The initial reviewed-year flow for workspace years `2022..2024` requests only the visible/imported year data and does not fire `GET /api/v2/import/years/2026/data`. | Pending. | Stop if the current prefetch path is coupled to another shared browser-truth contract that would require a broader cache/state rewrite outside the reviewed-year flow. | TODO |

### S-171 substeps

- [x] Replace the old step-3 VEETI deviation sentence with the same short exact edited-line label used on step 2
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:1591aab785c3018ec7f17a96d4495a12a7d3d6f8 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/useOverviewSetupState.ts | docs:N/A | status: clean

- [x] Remove leftover year-level helper sentence where exact edited lines are already shown
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:1591aab785c3018ec7f17a96d4495a12a7d3d6f8 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/useOverviewSetupState.ts | docs:N/A | status: clean

### S-172 substeps

- [x] Keep one clear back action on step 2 and step 3 instead of duplicating shell and panel back buttons
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: row:68b1ac56f77cbf273cfcd8c7c89e96cc41fe2060 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewReviewBoard.tsx,apps/web/src/v2/OverviewWizardPanels.tsx | docs:N/A | status: clean

- [x] Keep step-4 modal/back affordances to one truthful return path
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: row:68b1ac56f77cbf273cfcd8c7c89e96cc41fe2060 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewReviewBoard.tsx,apps/web/src/v2/OverviewWizardPanels.tsx | docs:N/A | status: clean

### S-173 substeps

- [x] Remove duplicate QDIS action buttons from the year-decision modal so upload/import appears once
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/v2.css
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:056b68f8389f68345e22743b978a4a0c9ab83c5e | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Trim repeated helper text in the same modal without inventing replacement body copy
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: row:056b68f8389f68345e22743b978a4a0c9ab83c5e | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> pass | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-174 substeps

- [ ] Replace raw provenance count strings on step-2 cards with short human-readable source summaries
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep provenance visible but stop surfacing machine-ish count formatting as the user-facing summary
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-175 substeps

- [ ] Limit reviewed-year prefetching to visible/imported years in the current wizard surface
  - files: apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewSelectors.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Re-audit the reviewed-year request pattern so unrelated year-data requests like `2026` no longer fire on the `2022..2024` workspace flow
  - files: apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewSelectors.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending
