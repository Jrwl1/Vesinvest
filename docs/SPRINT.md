# Sprint

Window: 2026-03-06 to 2026-05-30

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` entry, run continuous `DO -> REVIEW` cycles until all 5 rows are `DONE` or a protocol stop condition/blocker is reached.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Deliver the next V2 planning cycle for small Finnish water utilities: bookkeeping PDF import over VEETI financials, year-level trust review, effective-baseline Forecast flow, 20-year investment planning, fee sufficiency, financial risk framing, and public/confidential report outputs.

## Recorded decisions (this sprint)

- Step 1 of the official asset-management requirement is shelved for now; QGIS remains the external asset-mapping system.
- The app focus is steps 2-6: investments, fees, risk, right-sized planning, and public/confidential outputs.
- VEETI remains the default seed and benchmarking source.
- Bokslut PDF import is introduced first for `tilinpaatos` / result statement data only.
- PDF import runs as a browser OCR-backed preview-and-confirm flow, not blind auto-apply.
- Effective year data, not raw VEETI alone, is the planning baseline for Forecast and Reports.
- Sprint structure remains exactly 5 active items; additional scope is represented as flat substeps.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-21 | Build bookkeeping PDF import foundation for year-level financial overrides. See S-21 substeps. | apps/api/src/v2/, apps/api/src/veeti/, apps/api/src/prisma/, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/ | User can upload a bookkeeping-system PDF for a selected year, preview extracted result-statement values against current VEETI financial values, and apply confirmed values as financial overrides without breaking existing manual year completion. | Acceptance verified in REVIEW: `c68ce9d`, `96f53ae`, and `9b8ae95` cover import contract, browser OCR preview/confirm flow, normalized mapping, provenance persistence, and report-export compatibility. Evidence includes PASS for `pnpm --filter ./apps/api typecheck`, `pnpm --filter ./apps/web typecheck`, `pnpm --filter ./apps/web test -- src/v2/statementOcr.test.ts`, locale integrity checks, and live verification against `Bokslut reviderad 2024.pdf`. | Stop if REVIEW finds the shipped browser OCR path does not satisfy the row acceptance or the evidence cannot be traced to committed files and passing commands. | DONE |
| S-22 | Turn Overview into the trusted-year review workspace with dataset-level provenance and correction actions. See S-22 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts | Overview shows dataset-level source badges and year-level review actions; wrong-but-complete VEETI years can be corrected cleanly; users can see VEETI vs effective financial values and re-apply VEETI or keep overrides with clear provenance. | Acceptance verified in REVIEW: `96f53ae` covers dataset source badges, statement-import year actions, trusted-year copy, and persisted provenance; `01e2780` adds explicit VEETI-vs-effective financial comparison; `faeaa7f` adds explicit year-review actions, including VEETI restore; `55dceb0` adds regression coverage. Evidence includes PASS for `pnpm --filter ./apps/web typecheck`, `pnpm --filter ./apps/api typecheck`, `pnpm --filter ./apps/api test -- src/v2`, and `pnpm --filter ./apps/web test -- src/v2`. | Stop if dataset-level source state cannot be extended further without breaking current year completeness, reconcile, or sync contracts. | DONE |
| S-23 | Decouple Forecast from VEETI-only baseline semantics and add a structured 20-year investment planning model. See S-23 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/ | Forecast scenarios can be created and explained from trusted effective baseline data; the user can maintain a structured 20-year investment program inside Forecast; existing compute behavior remains explicit and deterministic. | Acceptance verified in REVIEW: `96f53ae` keeps Forecast on trusted effective baseline data; `3302ac2` adds structured investment metadata to the persisted scenario contract; `dd18b1a` adds editor fields for category, type, confidence, and note; `d430078` keeps the projection handoff amount-driven and compute-safe; `32a898b` adds planning summaries; `5cfaeb4` adds compatibility coverage. Evidence includes PASS for `pnpm --filter ./apps/api typecheck`, `pnpm --filter ./apps/web typecheck`, `pnpm --filter ./apps/api test -- src/v2`, `pnpm --filter ./apps/api test -- src/projections`, and `pnpm --filter ./apps/web test -- src/v2`. | Stop if the new investment model would invalidate existing scenario payloads without a non-destructive fallback path. | DONE |
| S-24 | Add fee sufficiency and financial risk analysis as first-class planning outputs. See S-24 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/ | Forecast surfaces current vs required fee level, funding-gap timing, cumulative gap, and scenario-based risk outputs for base and stress cases; outputs remain explainable and test-covered. | Not eligible (status != READY). Verified evidence so far: `e2038bc` adds a dedicated `feeSufficiency` scenario payload with baseline price, required-price tracks, first underfunding year, and peak deficit/gap outputs on top of the existing projection math; `f7979de` surfaces current fee level, underfunding start years, and peak cumulative gap in Forecast. Risk presets, stress comparison, and regression coverage remain open. | Stop if risk or fee outputs require changing the projection engine's core financial math before the effective-baseline and investment inputs are stable. | IN_PROGRESS |
| S-25 | Add public/confidential report variants and close the end-to-end planning story with regression hardening. See S-25 substeps. | apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/, e2e/, docs/BACKLOG.md, docs/SPRINT.md, docs/WORKLOG.md | The app can produce public-safe and confidential report variants from the same planning model, provenance language is truthful across UI and report payloads, and regression coverage protects the new bokslut-import -> overview -> forecast -> reports flow. | Partial code reality shipped in `96f53ae` and `9b8ae95`: Reports now show provenance-aware effective baseline sources and PDF export works with statement-import text. Public/confidential variants, end-to-end regression proof, and final quality gates remain open. | Stop if public/confidential split requires a full document-composition rewrite instead of varianting the current report model. | IN_PROGRESS |

### S-21 substeps

- [x] Define the bookkeeping PDF import contract and preview response shape for `tilinpaatos`
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:c68ce9dc3244c6d0756fd40d7902ceafb0ebdda5 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Implement a browser OCR runtime and parser flow for bookkeeping PDFs that yields reviewable result-statement rows
  - files: apps/web/package.json, apps/web/public/vendor/tesseract/, apps/web/scripts/copy-ocr-assets.mjs, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/statementOcrParse.ts, apps/web/src/v2/statementOcr.test.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/statementOcr.test.ts
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/statementOcr.test.ts -> PASS | files:apps/web/package.json,apps/web/public/vendor/tesseract/core/tesseract-core.js,apps/web/public/vendor/tesseract/lang/eng.traineddata.gz,apps/web/public/vendor/tesseract/lang/swe.traineddata.gz,apps/web/public/vendor/tesseract/worker.min.js,apps/web/scripts/copy-ocr-assets.mjs,apps/web/src/v2/statementOcr.ts,apps/web/src/v2/statementOcrParse.ts,apps/web/src/v2/statementOcr.test.ts,pnpm-lock.yaml | docs:N/A | status: clean

- [x] Add normalized mapping from OCR rows into the existing financial override fields and prefill the review flow
  - files: apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/dto/manual-year-completion.dto.ts,apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add a reviewable import preview with extracted value, source context, and final applied value before confirmation
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/api.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Persist confirmed bokslut financial overrides with statement-import provenance and keep the flow compatible with effective-year consumers
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Keep report export compatible with statement-import provenance and OCR-imported text
  - files: apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:9b8ae9506634ea002c422bf964faea8ca6071950 | run:pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

### S-22 substeps

- [x] Extend effective-year data to expose dataset-level provenance suitable for UI badges and review decisions
  - files: apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Redesign the Overview year list around review actions instead of blocked-year rescue only
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Add side-by-side VEETI vs effective value review for key financial statement fields
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:01e27806a476e3aacfe0ca64428159bfdc81ce86 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add clean actions to keep VEETI, import bokslut PDF, edit effective values, and re-apply VEETI values
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:faeaa7f5c050243468377914598e98127999c0af | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Update V2 copy so Overview talks about trusted effective years instead of VEETI-only truth
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add regression coverage for wrong-but-complete VEETI years, dataset source badges, and VEETI re-apply behavior
  - files: apps/api/src/v2/, apps/web/src/v2/, e2e/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:55dceb06f981ab51534266fdb2d83c889dd7f834 | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/yearReview.test.ts,apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

### S-23 substeps

- [x] Remove VEETI-only forecast blockers and surface trusted effective baseline provenance in Forecast
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Define and persist a structured 20-year investment program model that fits the current Forecast flow
  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/, apps/api/src/v2/dto/, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:3302ac27841de576784b36ac184a0203519aa5b6 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/dto/update-scenario.dto.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Add Forecast UI for yearly investment rows with category, amount, replacement/new marker, confidence, and note
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:dd18b1a3d5c39e8f0dae855b33a0dbbc27c32af2 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Feed the structured investment program into the existing scenario compute pipeline without breaking explicit compute
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/
  - run: pnpm --filter ./apps/api test -- src/projections
  - evidence: commit:d4300784211fc360c472ef3df23bd664a182895e | run:pnpm --filter ./apps/api test -- src/projections -> PASS | files:apps/api/src/projections/year-overrides.spec.ts,apps/api/src/projections/year-overrides.ts | docs:N/A | status: clean

- [x] Add Forecast summaries for annual investment total, rolling 5-year total, and peak years
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:32a898b028045edfc648fd934f1696f36dff3025 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Add compatibility tests so existing scenarios still load safely when no new investment metadata exists
  - files: apps/api/src/v2/, apps/api/src/projections/, apps/web/src/v2/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck
  - evidence: commit:5cfaeb4fa32b9da432da5b62d3a6a48c0de47b5c | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts | docs:N/A | status: clean

### S-24 substeps

- [x] Define fee sufficiency outputs and API payload fields using the current projection engine and effective-baseline assumptions
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck
  - evidence: commit:e2038bc3f936bd76d01e01e306605d4bd823063f | run:pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Surface current fee vs required fee, annual increase need, underfunding start year, and cumulative gap in Forecast
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:f7979de3dc5728a145d275027f0e0d1292b9a50b | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Add scenario-based financial risk presets for lower volume, higher opex, higher energy, higher capex, delayed fee increase, and financing pressure
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:75e26cc2ae5f4fddf1090e849a796f42b861a6fd | run:pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/dto/update-scenario.dto.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [ ] Add side-by-side base vs stress comparisons and a short risk-summary explanation block
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Add regression coverage for fee sufficiency outputs and risk scenario calculations
  - files: apps/api/src/projections/, apps/api/src/v2/, apps/web/src/v2/, e2e/
  - run: pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

### S-25 substeps

- [ ] Define report variant contract for public summary vs confidential appendix outputs
  - files: apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Update Reports UI to let the user choose report variant and understand which sections are included
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [x] Add provenance-aware language to report summaries so outputs describe effective baseline sources truthfully
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:96f53ae9887d9cb4ad9333996beea301c474bae5 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [ ] Implement public-safe vs confidential section composition without rewriting the whole report pipeline
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/web/src/api.ts, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add end-to-end regression coverage for bokslut import -> overview trust review -> forecast -> report variant flow
  - files: e2e/, apps/api/src/v2/, apps/web/src/v2/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [x] Keep report PDF export working with statement-import provenance and OCR-imported text
  - files: apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/api typecheck
  - evidence: commit:9b8ae9506634ea002c422bf964faea8ca6071950 | run:pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

- [ ] Run final quality gates for the new planning cycle and complete sprint evidence once all rows are READY
  - files: apps/api/, apps/web/, e2e/, docs/SPRINT.md, docs/WORKLOG.md
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: pending
