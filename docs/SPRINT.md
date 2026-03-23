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

Correct the V2 shell header behavior and chosen-year manual-edit truth without widening into a broader redesign.

## Recorded decisions (this sprint)

- `S-157..S-168` remain done and belong in `docs/SPRINT_ARCHIVE.md`, not the active queue.
- `S-169` covers only the shared V2 shell header surface: remove sticky behavior and make the workspace chip more legible on desktop.
- `S-170` covers only chosen-year manual-edit truth: replace the generic correction sentence with exact edited-line naming when the current card state can prove it.
- The screenshot-brightness complaint is excluded from sprint scope because the user confirmed it is machine-local capture behavior, not product UI.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-169 | Make the V2 shell header scroll with the page and stop squeezing long workspace names into an over-tight chip. See S-169 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.test.tsx | On normal desktop viewports, the V2 shell on overview, forecast, and reports scrolls away with the page instead of staying pinned, and a long org name such as `Kronoby vatten och avlopp` stays materially more legible in the workspace chip without breaking nav/status layout. | Pending. | Stop if truthful header cleanup requires widening beyond the shared V2 shell header surface or inventing new user-facing copy. | TODO |
| S-170 | Replace the chosen-year generic manual/mixed correction sentence with short exact edited-line labeling. See S-170 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | Chosen year cards no longer say `Vuodessa on VEETI-datan lisäksi manuaalisia tai yhdistettyjä korjauksia.` When one exact edited line is known, the card says `Muokattu: <line>`; when several exact lines are known, it lists only those lines; no new filler or year-level trust copy is added. | Pending. | Stop if the current card state cannot truthfully name edited line(s) without introducing a new backend/source-field contract or inventing fallback copy. | TODO |

### S-169 substeps

- [ ] Remove sticky shell behavior so the V2 header scrolls with the page
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.test.tsx
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Rebalance the workspace chip and header lanes so long org names stay legible on desktop
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-170 substeps

- [ ] Replace the generic chosen-year correction sentence with a short exact edited-line label
  - files: apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep the wording short and factual by listing only the edited line name(s)
  - files: apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/yearReview.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending
