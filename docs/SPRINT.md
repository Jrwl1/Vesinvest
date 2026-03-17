# Sprint

Window: 2026-03-17 to 2026-05-29

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Clean-tree policy: protocol cleanliness is defined by `git status --porcelain`; ignored local files are out of scope, while tracked changes and untracked non-ignored files still block DO/REVIEW completion.
DO baseline policy: DO may start from dirty tracked/unignored state only when every pre-existing dirty path is already inside the selected substep `files:` scope and can be safely absorbed into that substep; DO and REVIEW still must end clean per `git status --porcelain`.
MCP policy: use direct MCP tools when they materially help gather evidence or verify behavior. Do not use delegation or autopilot tooling.
DO file-scope policy: when a selected substep explicitly lists non-canonical repo docs or config examples in `files:`, DO may edit them as product-scope files; canonical planning docs remain forbidden.
PLAN subagent policy: the parent planner must still complete the required canonical reads in order, but may use read-only research helpers for follow-up context gathering only.
DO/RUNSPRINT subagent policy: the parent executor may use bounded native helper agents for the currently selected substep only; the parent remains responsible for scope, commands, commits, evidence, and clean-tree checks.
REVIEW subagent policy: REVIEW remains parent-owned unless a future ADR defines a read-only review-helper policy.
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

Perfect `Yhteenveto` year cards for step 2 and step 3: show the customer's canon line items directly, remove invented fallback splits, use literal source/problem wording, allow inline whole-card editing, keep price/volume as secondary main stats, stay fully language-correct, and close with a full live audit that proves the cards behave exactly as specified.

## Recorded decisions (this sprint)

- `Yhteenveto` is a dedicated sprint. Do not dilute it with broader Forecast or report work unless a listed substep explicitly needs shared code.
- Each year card must show these line items first: `Tuotot`, `Aineet ja palvelut`, `Henkilöstökulut`, `Poistot`, `Muut toimintakulut`, `Tulos`.
- `Tulos` must be the bottom and strongest row, with green for positive and red for negative.
- Use VEETI `AineetJaPalvelut` directly when it exists. Remove the fallback split from `LiiketoiminnanMuutKulut`.
- `0` and `Tieto puuttuu` are different states and must never be conflated.
- Replace vague labels such as `Varanollia käytössä` with literal wording only.
- The card itself is the normal editing surface. No modal for normal correction.
- Secondary main stats stay on the card: water price, wastewater price, sold water volume, sold wastewater volume.
- Subrows may expand only if current VEETI/API data can provide truthful subrow structure. If not, keep the sprint summary-only and do not fake subrows.
- All card text follows the chosen user language. If current VEETI org data does not expose a language field, keep manual language selection as the only source of truth and record that finding in the audit.
- The sprint is not complete until a real-PDF correction flow and a full `Yhteenveto` audit end with `whole sprint succeeded`.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-87 | Lock the truthful `Yhteenveto` data contract for the canon line items. See S-87 substeps. | apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts, apps/web/src/api.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | Step-2/step-3 card data uses the direct canon rows (`Liikevaihto`, `AineetJaPalvelut`, `Henkilostokulut`, `Poistot`, `LiiketoiminnanMuutKulut`, `TilikaudenYliJaama`) without the current fallback split, and the implementation explicitly answers whether truthful subrow data exists or whether the sprint stays summary-only. | Accepted in `review: evidence update`: packet `9a2d07406ffe60b912aef8e8a27bf48d6efbbca9` removed the invented split, added direct `Poistot`, and proved the current VEETI/API path remains summary-only for truthful subrows via focused api/web tests plus dual typecheck. | Stop if truthful card rows or subrow availability require a new external/customer data source that current VEETI/API contracts do not expose. | DONE |
| S-88 | Rebuild the step-2 year cards around the 6 canon line items and literal warning language. See S-88 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | Step-2 cards show the 6 canon rows, keep `Tulos` bottom and strongest, use literal missing/zero/source labels, and keep price/volume stats visible as secondary main stats lower on the card. | Accepted in `review: evidence update`: packet `5b08a6dbc64647801695f61c31fa9bb391b7ecc9` now renders the 6-row canon on step 2, keeps `Tulos` visually strongest at the bottom, uses literal source/problem copy, and keeps price/volume stats inline below the card stack with focused web proof. | Stop if the card cannot remain readable on desktop/mobile while carrying the 6 canon rows plus secondary stats. | DONE |
| S-89 | Make the card itself the normal edit surface in step 2. See S-89 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | Clicking the card enters inline whole-card edit mode, clicking a number focuses that field immediately, normal correction happens on-card without a modal, and surrounding cards quiet down while one card is active. | Pending - row starts at first DO packet. | Stop if on-card editing cannot be made stable without breaking the existing step-2 selection or step-3 review flow. | TODO |
| S-90 | Bring the same card model and on-card actions into step 3 review/approval. See S-90 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/statementOcrParse.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Step 3 uses the same 6-row card model as step 2, keeps save/sync/restore/PDF/exclude actions on the card itself, avoids modal-only normal correction, and only auto-advances in the explicit review queue. | Pending - row starts at first DO packet. | Stop if keeping PDF import, restore, and save/sync on-card requires a broader interaction model change than this Yhteenveto sprint can absorb cleanly. | TODO |
| S-91 | Finish `Yhteenveto` language behavior, zero/missing semantics, and card polish. See S-91 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | Every word on the card follows the chosen user language, `0` versus `Tieto puuttuu` is explicit and visually distinct, source/problem wording stays literal, and the sprint records whether current VEETI org data actually exposes a language value for default-language switching. | Pending - row starts at first DO packet. | Stop if org-language switching needs a VEETI field that the current org payload does not expose and cannot be added compatibly inside this sprint. | TODO |
| S-92 | Close with a full `Yhteenveto` audit against the locked plan and the real 2024 PDF path. See S-92 substeps. | apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts, docs/YHTEENVETO_FINAL_AUDIT.md | Focused regressions pass, a wiped-workspace live audit proves the step-2 and step-3 cards follow the 6-row canon, the real 2024 PDF still corrects the year in-card, the audit explicitly records the subrow-availability answer, and the artifact ends with `whole sprint succeeded` or a blocker. | Pending - row starts at first DO packet. | Stop if the final audit still finds a card-structure, wording, editing-surface, language, or PDF-correction blocker after `S-87..S-91`; record it and stop there. | TODO |

### S-87 substeps

- [x] Remove the current fallback split and make `AineetJaPalvelut` a direct card row when VEETI/import data provides it
  - files: apps/web/src/v2/yearReview.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/web/src/v2/yearReview.test.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti-budget-generator.spec.ts && pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:9a2d07406ffe60b912aef8e8a27bf48d6efbbca9 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti-budget-generator.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS (api jest 2/2, web vitest 2/2, web/api typecheck) | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Add `Poistot` to the `Yhteenveto` year-card summary contract and keep `Tulos` as an explicit direct row rather than an inferred card footer only
  - files: apps/web/src/v2/yearReview.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:9a2d07406ffe60b912aef8e8a27bf48d6efbbca9 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti-budget-generator.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS (api jest 2/2, web vitest 2/2, web/api typecheck) | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Determine whether truthful subrow data exists in the current VEETI/API path and lock the card model to real subrows only if it does
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:9a2d07406ffe60b912aef8e8a27bf48d6efbbca9 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti-budget-generator.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS (api jest 2/2, web vitest 2/2, web/api typecheck) | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts, apps/api/src/veeti/veeti-budget-generator.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

### S-88 substeps

- [x] Rebuild step-2 cards so the first visible row stack is exactly the 6 canon line items and `Tulos` is visually strongest at the bottom
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:5b08a6dbc64647801695f61c31fa9bb391b7ecc9 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS (web vitest, web typecheck) | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Replace vague warning language with literal source/problem wording and separate `0` from `Tieto puuttuu`
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:5b08a6dbc64647801695f61c31fa9bb391b7ecc9 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS (web vitest, web typecheck) | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Keep water price and volume visible as secondary main stats lower on the card without competing with the canon line items
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:5b08a6dbc64647801695f61c31fa9bb391b7ecc9 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS (web vitest, web typecheck) | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-89 substeps

- [ ] Make clicking the card enter inline whole-card edit mode with one focused active card at a time
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Make clicking a number jump directly to editing that field while keeping keyboard order sane across the whole expanded card
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep save-on-card behavior local to step 2 so edits update immediately without forcing the user away from the current card
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-90 substeps

- [ ] Reuse the same inline card model in step 3 so review and correction happen on the card, not in a separate normal-correction modal flow
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep save, save-and-sync, restore VEETI, PDF import, and exclude actions owned by the card in step 3
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/statementOcrParse.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/statementOcr.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

- [ ] Keep auto-advance only in the explicit review queue and not in the step-2 import-selection editing path
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-91 substeps

- [ ] Make every card word follow the chosen user language and remove any remaining mixed-language card labels
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Verify whether current VEETI organization data exposes a language value and, if it does, wire it into the default language on import without breaking manual override
  - files: apps/api/src/veeti/veeti.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

- [ ] Finish the zero-versus-missing visual system so a real `0` stays visible and a missing value always says VEETI did not provide it
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-92 substeps

- [ ] Add final focused regressions for the 6-row card model, inline editing, literal warnings, and card-owned actions
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, apps/api/src/veeti/veeti-budget-generator.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/statementOcr.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti-budget-generator.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

- [ ] Run a wiped-workspace live audit that verifies step-2 and step-3 cards against this exact plan, including the real 2024 PDF correction path
  - files: docs/YHTEENVETO_FINAL_AUDIT.md
  - run: N/A (manual browser audit with the real 2024 customer PDF allowed)
  - evidence: pending

- [ ] Record the explicit sprint outcome in `docs/YHTEENVETO_FINAL_AUDIT.md`, including the verified answer on real subrow availability, and stop on any mismatch with this plan
  - files: docs/YHTEENVETO_FINAL_AUDIT.md
  - run: N/A (manual audit artifact update allowed)
  - evidence: pending
