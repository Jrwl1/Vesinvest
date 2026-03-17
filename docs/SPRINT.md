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
Scope-correction policy: if a sprint `files:` scope missed minimal directly coupled contract files required for the explicitly stated behavior, DO may absorb that smallest same-feature contract/client/test slice and then update the sprint scope to match reality; broad cross-feature expansion remains blocked.
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

Modernize the setup year-intake flow so step 2 is action-first, visually trustworthy, and repairable from the year cards themselves: simplify the copy, compress non-task chrome, replace the old white/orange board with a denser high-trust presentation, expose direct price/volume repair, add per-year QDIS PDF import, and close with a live audit using the customer's real 2022 QDIS export PDF.

## Recorded decisions (this sprint)

- The active task in step 2 is choosing years, so year selection must be the first visible action surface; summary/helper chrome becomes compact supporting context only.
- Step-2 copy must be short and literal. Use `Valitse tuotavat vuodet` as the main heading and short selection/review language instead of dramatic trust copy.
- Replace `Epäilyttävä mutta pelastettavissa` with `Tarkista ennen käyttöä`.
- Replace `Estetty kunnes täydennetty` with `Täydennettävät vuodet`.
- Replace repeated `VEETI ei toimittanut arvoa` noise with quantified missing-data summaries such as `Puuttuu 1/4 pakollista arvoa` and short explicit missing-field labels.
- The visual direction is a modern trustworthy spreadsheet/workbench, not white cards plus orange warning boxes. Use denser cards, calmer surfaces, sharper hierarchy, and reserve strong red only for truly blocked states.
- Ready, suspicious, and blocked years must stay visually distinct, but blocked years collapse by default and suspicious years must not look like failure states.
- Secondary stats stay visible on the card, but in a denser layout that does not compete with the main accounting stack.
- Missing prices and volumes must have direct repair affordances from the year card, and the first missing field should be the focus target when repair starts.
- Per-year QDIS import is a year-card action. Try direct PDF text extraction first and OCR fallback second.
- QDIS-imported values sit above VEETI as current/effective values while VEETI remains visible as the baseline/provenance reference.
- If truthful `QDIS PDF` provenance needs a first-class label beyond generic manual override, absorb the smallest DTO/service/API change required inside this sprint.
- Final acceptance requires a wiped-workspace live audit with the customer's real 2022 QDIS export PDF and no obvious step-2/step-3 trust or workflow gaps in the audited path.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-93 | Make step 2 action-first and rewrite the copy into short literal guidance. See S-93 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | Step 2 leads with year selection, helper chrome is reduced to compact supporting context, giant dead hero space is removed, and the Finnish copy uses short literal selection/review wording. | Accepted via 60bbb283460fc58f4943faaea219fd96d59bec53 and 38c9e593ad4539cbb564c07d98155fd480eb1996; focused web test + web typecheck verified. | Stop if making step 2 action-first requires a broader AppShell or route-architecture rewrite beyond Overview-owned surfaces. | DONE |
| S-94 | Rebuild the trust board into a denser modern year board with calmer warning treatment. See S-94 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | Ready, suspicious, and blocked lanes remain truthful but compact; blocked years collapse by default; cards use quantified missing-data summaries instead of repeated orange missing boxes; secondary stats stay visible in a denser layout. | Packet e1068cbaf01c829c0ae0f17ee44ce3fb73a55402 verified; REVIEW pending. | Stop if readable desktop/mobile card hierarchy cannot be kept without a broader cross-app design-system rewrite. | READY |
| S-95 | Expose direct repair of missing prices and volumes from the year cards. See S-95 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Suspicious/blocked cards show a direct repair CTA for missing prices/volumes, repair opens focused on the missing field, and review mode no longer hides the practical path to volume repair. | Evidence needed. | Stop if direct repair semantics require broader auth/role changes instead of local year-card affordances. | TODO |
| S-96 | Add per-year QDIS PDF import into the year-card workflow. See S-96 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/qdisPdfImport.ts, apps/web/src/v2/qdisPdfImport.test.ts, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | A year card offers `Tuo QDIS PDF` or equivalent, the workflow tries direct PDF extraction first and OCR fallback second, shows parsed QDIS values against VEETI/current values, and can confirm them into the existing year patch flow. | Evidence needed. | Stop if the real 2022 QDIS export PDF lacks a stable extractable structure that can be mapped within the bounded year-import UI. | TODO |
| S-97 | Make QDIS/manual/VEETI provenance explicit in step 2 and step 3. See S-97 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Step-2 and step-3 cards show truthful source layering for VEETI, manual edits, bokslut PDF, and QDIS PDF; imported QDIS values read as current/effective above VEETI; language stays literal and consistent. | Evidence needed. | Stop if explicit QDIS provenance requires broader Forecast/Reports/report-export contract changes beyond truthful wizard-year provenance. | TODO |
| S-98 | Close with focused regressions and a live QDIS audit. See S-98 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/qdisPdfImport.test.ts, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, docs/YEAR_INTAKE_QDIS_AUDIT.md | Focused regressions pass, a wiped-workspace live audit with the customer's 2022 QDIS PDF verifies step-2/step-3 layout, direct repair, and QDIS import flow, and the audit artifact ends with `whole sprint succeeded` or a blocker. | Evidence needed. | Stop if real QDIS PDF behavior or the live audit still reveals a step-2/step-3 trust or workflow blocker after `S-93..S-97`; record it and stop there. | TODO |

### S-93 substeps

- [x] Replace the step-2 heading/body and lane titles with short literal copy that matches the real task
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:60bbb283460fc58f4943faaea219fd96d59bec53 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Reduce helper-rail and hero chrome so the year-selection board is the first visible actionable content
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:60bbb283460fc58f4943faaea219fd96d59bec53 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Keep the compact step-2 summary truthful after connect/import state changes without recreating dead space
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:60bbb283460fc58f4943faaea219fd96d59bec53 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-94 substeps

- [x] Restyle the ready/suspicious/blocked lanes into a denser board with calmer surfaces and stronger hierarchy
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:e1068cbaf01c829c0ae0f17ee44ce3fb73a55402 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Collapse blocked years by default and replace repeated missing-state boxes with one quantified missing summary per card
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:e1068cbaf01c829c0ae0f17ee44ce3fb73a55402 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Compress secondary price/volume stats into a denser strip that stays readable on desktop and mobile
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:e1068cbaf01c829c0ae0f17ee44ce3fb73a55402 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-95 substeps

- [ ] Add a direct repair CTA on suspicious/blocked year cards when prices or volumes are missing
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Open the inline editor focused on the missing price or volume field from the CTA or clicked missing secondary stat
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Make review mode expose a clear path to edit missing prices and volumes instead of hiding the repair flow behind generic manual mode
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-96 substeps

- [ ] Add a per-year QDIS PDF import action and workflow shell on the year cards
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Implement direct-PDF extraction with OCR fallback for the customer QDIS export structure and cover it with focused parser tests
  - files: apps/web/src/v2/qdisPdfImport.ts, apps/web/src/v2/qdisPdfImport.test.ts, apps/web/src/v2/statementOcr.ts
  - run: pnpm --filter ./apps/web test -- src/v2/qdisPdfImport.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Map confirmed QDIS values into the existing year patch flow and keep save/sync behavior on-card
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/qdisPdfImport.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-97 substeps

- [ ] Add truthful source labels for VEETI, manual edits, bokslut PDF, and QDIS PDF on step-2 and step-3 year cards
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Ensure QDIS-imported values read as current/effective above VEETI and survive reload without losing the baseline comparison
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/api.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Keep localized wording literal and consistent across the new QDIS and provenance surfaces
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-98 substeps

- [ ] Add final focused regressions for the step-2/step-3 year board, direct repair CTAs, and QDIS import flow
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/qdisPdfImport.test.ts, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/qdisPdfImport.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Run a wiped-workspace live audit with the customer's 2022 QDIS PDF through the real year-import flow
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, docs/YEAR_INTAKE_QDIS_AUDIT.md
  - run: N/A (manual browser audit with the real 2022 customer QDIS PDF allowed)
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Record the explicit sprint outcome in `docs/YEAR_INTAKE_QDIS_AUDIT.md` and stop on any mismatch with this plan
  - files: docs/YEAR_INTAKE_QDIS_AUDIT.md
  - run: N/A (manual audit artifact update allowed)
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean
