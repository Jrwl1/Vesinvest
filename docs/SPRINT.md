# Sprint

Window: 2026-03-24 to 2026-06-24

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
- `  - run: <command(s)>`, `covered by row-end bundle -> <command(s)>`, or `N/A` only when the row text explicitly allows it
- `  - evidence: row:<hash> | run:<cmd> -> <result> | files:<paths> | docs:<hash or N/A> | status: clean`

## Goal (this sprint)

Turn `Yhteenveto` into a fast VEETI verification home, turn `Ennuste` into the chosen Signal Grid operator board, replace year-mapped depreciation UX with org-wide `Poistosuunnitelmat` defaults plus item-level class/rule behavior, and finish with a full live re-audit.

## Recorded decisions (this sprint)

- `S-171..S-175` remain done and belong in `docs/SPRINT_ARCHIVE.md`, not the active queue.
- `Yhteenveto` remains the VEETI verification surface after baseline creation; it must keep year cards and the canonical economic rows visible for trust-checking.
- Canonical year-card financial rows stay: `Tuotot`, `Aineet ja palvelut`, `Henkilostokulut`, `Poistot`, `Muut toimintakulut`, and `Tulos`. Price and volume remain on-card but secondary.
- `Poistosuunnitelmat` does not become a top-level nav tab or a main `Yhteenveto` wizard step; it becomes a first-class gated workbench inside `Ennuste`.
- Depreciation rules are org-wide defaults on a shared canonical class list.
- One investment row maps to exactly one depreciation class in the primary UX.
- An investment cannot be saved without an effective depreciation rule.
- Existing saved investments keep the rule snapshot they were created with; later org-default edits affect only new investments.
- The sprint ends with a live browser audit in the same manner as the original March 24, 2026 audit flow.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-176 | Rebuild post-baseline `Yhteenveto` into a VEETI verification board that keeps the current year-card trust model instead of a wizard epilogue. See S-176 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | After planning-baseline creation, `Yhteenveto` shows one dominant verification surface: year cards foreground the canonical economic rows (`Tuotot`, `Aineet ja palvelut`, `Henkilostokulut`, `Poistot`, `Muut toimintakulut`, `Tulos`), price and volume stay visible but secondary, duplicate summary/epilogue blocks are removed, and the page ends with one clear CTA into `Ennuste`. | Pending. | Stop if the chosen `Yhteenveto` simplification would require inventing new filler copy or removing the canonical year-card rows the user relies on to verify VEETI correctness. | TODO |
| S-177 | Make imported/reviewed year-card state fully truthful across the wizard and remove the known contradictions between frontend cards and backend year data. See S-177 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewSelectors.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Step-2 and step-3 cards no longer show missing/zero states when `/v2/import/years/:year/data` proves real values exist; manual-year repair no longer silently changes the selected year set; and the setup flow shows contiguous truthful step progression through the touched baseline/review surfaces. | Pending. | Stop if truthful year-card state cannot be fixed without widening into an unrelated data-loading or source-contract rewrite outside the reviewed-year flow. | TODO |
| S-178 | Rebuild `Ennuste` around the chosen Signal Grid hierarchy so the financial story comes first and editing surfaces come second. See S-178 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | `Ennuste` opens as a scenario-led operator board with one scenario strip, one KPI story row, one primary chart region, and one compact planning-area launcher section; duplicated setup/status prose is removed; and the first task after entering the page is visually obvious. | Pending. | Stop if the Signal Grid reset would require changing route/tab semantics or inventing unsupported user-facing narrative copy instead of simplifying existing truthful labels. | TODO |
| S-179 | Replace the current year-mapped depreciation editing feel with a grouped canonical `Poistosuunnitelmat` class library for org-wide defaults inside `Ennuste`. See S-179 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/pts-depreciation-defaults.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | `Poistosuunnitelmat` appears as a grouped canonical class list in `Ennuste`, not as a top-level tab or a main `Yhteenveto` step; the full agreed row taxonomy is available, visually grouped so it remains scannable; and each class uses only the allowed methods (`Ei poistoa`, `Tasapoisto X vuotta`, `Menojannos Y %`). | Pending. | Stop if the canonical class-library UI would require arbitrary free-text class creation in the first pass instead of reusing a shared row taxonomy with editable org defaults. | TODO |
| S-180 | Require exactly one depreciation class on each investment row and show the inherited org-default rule at investment entry time. See S-180 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Each investment row requires one selected class, shows the inherited org-default depreciation summary, optionally allows `Muokkaa vain tata investointia`, and cannot be saved when no effective depreciation rule exists for that row. | Pending. | Stop if item-level class selection cannot be introduced without first widening the investment-entry contract beyond the current scenario JSON storage and directly coupled forecast DTO/service surfaces. | TODO |
| S-181 | Persist effective depreciation rule snapshots on investment rows and compute/report readiness from item-level rules rather than year-share mapping as the primary UX contract. See S-181 substeps. | apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx | Saved investments keep the rule snapshot they were created with, later org-default edits affect only new investments, forecast compute and report readiness use item-level effective rules, and the old year-share mapping path is no longer the primary user-facing model. | Pending. | Stop if snapshot persistence cannot be expressed safely inside the current scenario storage contract without a broader schema/compute migration than the sprint row can truthfully absorb. | TODO |
| S-182 | Align `Yhteenveto`, `Ennuste`, and `Raportit` copy/readiness/provenance so the touched flow stays truthful after the depreciation and hierarchy reset. See S-182 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts | `Yhteenveto` shows only compact depreciation readiness, `Ennuste` and `Raportit` stay truthful about unresolved depreciation and recompute/report freshness, and touched FI/SV/EN strings no longer contain mixed-language or machine-ish leftovers. | Pending. | Stop if copy cleanup would require broad translation churn outside the touched surfaces or new invented helper/trust text that is not already supported by accepted repo copy. | TODO |
| S-183 | Run a final live browser audit in the same manner as the original March 24, 2026 audit, using the same skill mix and end-to-end Kronoby flow, and close only if the touched experience stays trustworthy. See S-183 substeps. | apps/web/src/**, apps/api/src/**, e2e/**, output/** | Repeat the original live flow on a clean local tenant: connect Kronoby (`org1535`), import five years excluding `2015`, manually repair where required, create the planning baseline, enter `Ennuste`, verify `Poistosuunnitelmat` and investment entry, and record a new findings list showing no unresolved trust blockers in the touched `Yhteenveto`/`Ennuste`/forecast-readiness flow. | Pending. | Stop if the final live audit exposes a new trust blocker in the touched flow that cannot be fixed within the sprinted `Yhteenveto`/`Ennuste`/depreciation scope. | TODO |

### S-176 substeps

- [ ] Collapse the post-baseline `Yhteenveto` layout into one verification-first board with year cards as the dominant surface
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

- [ ] Keep the canonical economic rows prominent and keep price/volume secondary without turning the cards into generic dashboard tiles
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

### S-177 substeps

- [ ] Make the year-card state derive from truthful backend/effective-year data so cards never show broken zero or missing states when data exists
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewReviewBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewSelectors.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

- [ ] Remove selection drift and touched-step numbering ambiguity from the manual-year repair/import review flow
  - files: apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

### S-178 substeps

- [ ] Rebuild the forecast landing hierarchy into the chosen Signal Grid scenario cockpit with one dominant financial story
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

- [ ] Remove repeated setup/state prose and make the next editable forecast action obvious before the long forms
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

### S-179 substeps

- [ ] Present the full canonical `Poistosuunnitelmat` row set as grouped org-wide defaults inside `Ennuste`
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/api/src/v2/pts-depreciation-defaults.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

- [ ] Limit the editable methods to `Ei poistoa`, `Tasapoisto X vuotta`, and `Menojannos Y %` while keeping the grouped list readable
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/api/src/v2/dto/depreciation-rules.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

### S-180 substeps

- [ ] Require exactly one depreciation class on each investment row and show the inherited org-default summary before save
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

- [ ] Block saving an investment row when the selected class has no effective depreciation rule and expose a direct fix path into `Poistosuunnitelmat`
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

### S-181 substeps

- [ ] Persist the effective depreciation rule snapshot used by each saved investment row
  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/v2/dto/update-scenario.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: covered by row-end bundle -> pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

- [ ] Make compute and report readiness read item-level effective rules and treat year-share mapping as compatibility-only, not as the primary UX contract
  - files: apps/api/src/projections/projection-engine.service.ts, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

### S-182 substeps

- [ ] Keep touched `Yhteenveto`, `Ennuste`, and `Raportit` copy/readiness/provenance consistent after the Signal Grid and depreciation reset
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

- [ ] Remove mixed-language or machine-ish leftovers from the touched surfaces without inventing filler copy
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: Pending.

### S-183 substeps

- [ ] Re-run the live Kronoby browser audit in the same manner as the original March 24, 2026 flow, from clean reset through `Ennuste`
  - files: apps/web/src/**, apps/api/src/**, e2e/**, output/**
  - run: covered by row-end bundle -> pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.

- [ ] Record the final audit findings, including whether any trust blocker remains in `Yhteenveto`, `Poistosuunnitelmat`, investment entry, or `Ennuste`
  - files: apps/web/src/**, apps/api/src/**, e2e/**, output/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: Pending.
