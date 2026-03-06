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
- PDF import must be preview-and-confirm, not blind auto-apply.
- Effective year data, not raw VEETI alone, is the planning baseline for Forecast and Reports.
- Sprint structure remains exactly 5 active items; additional scope is represented as flat substeps.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-21 | Build bookkeeping PDF import foundation for year-level financial overrides. See S-21 substeps. | apps/api/src/v2/, apps/api/src/veeti/, apps/api/src/prisma/, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/ | User can upload a bookkeeping-system PDF for a selected year, preview extracted result-statement values against current VEETI financial values, and apply confirmed values as financial overrides without breaking existing manual year completion. | Review validated substep 1 (`c68ce9d`) with API/web typecheck PASS; row not eligible for DONE (`IN_PROGRESS`). | Stop if the provided PDF family cannot be parsed reliably enough to produce a reviewable preview without introducing an OCR or extraction dependency that is not locally runnable. | IN_PROGRESS |
| S-22 | Turn Overview into the trusted-year review workspace with dataset-level provenance and correction actions. See S-22 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts | Overview shows dataset-level source badges and year-level review actions; wrong-but-complete VEETI years can be corrected cleanly; users can see VEETI vs effective financial values and re-apply VEETI or keep overrides with clear provenance. | Planned. No execution evidence yet. | Stop if dataset-level source state cannot be added without breaking current year completeness, reconcile, or sync contracts. | TODO |
| S-23 | Decouple Forecast from VEETI-only baseline semantics and add a structured 20-year investment planning model. See S-23 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/api/prisma/schema.prisma, apps/api/prisma/migrations/ | Forecast scenarios can be created and explained from trusted effective baseline data; the user can maintain a structured 20-year investment program inside Forecast; existing compute behavior remains explicit and deterministic. | Planned. No execution evidence yet. | Stop if the new investment model would invalidate existing scenario payloads without a non-destructive fallback path. | TODO |
| S-24 | Add fee sufficiency and financial risk analysis as first-class planning outputs. See S-24 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/ | Forecast surfaces current vs required fee level, funding-gap timing, cumulative gap, and scenario-based risk outputs for base and stress cases; outputs remain explainable and test-covered. | Planned. No execution evidence yet. | Stop if risk or fee outputs require changing the projection engine’s core financial math before the effective-baseline and investment inputs are stable. | TODO |
| S-25 | Add public/confidential report variants and close the end-to-end planning story with regression hardening. See S-25 substeps. | apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts, apps/api/src/projections/, e2e/, docs/BACKLOG.md, docs/SPRINT.md, docs/WORKLOG.md | The app can produce public-safe and confidential report variants from the same planning model, provenance language is truthful across UI and report payloads, and regression coverage protects the new bokslut-import -> overview -> forecast -> reports flow. | Planned. No execution evidence yet. | Stop if public/confidential split requires a full document-composition rewrite instead of varianting the current report model. | TODO |

### S-21 substeps

- [x] Define the bookkeeping PDF import contract and preview response shape for `tilinpaatos`
  - files: apps/api/src/v2/v2.controller.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:c68ce9dc3244c6d0756fd40d7902ceafb0ebdda5 | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts | docs:N/A | status: clean

- [ ] Implement a parser service that extracts candidate result-statement rows from the supplied bookkeeping PDF family
  - files: apps/api/src/v2/, apps/api/src/veeti/
  - run: pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Add normalized mapping from extracted rows into the existing financial override fields
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/veeti/veeti-effective-data.service.ts
  - run: pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Add a reviewable import preview with extracted value, VEETI value, and final applied value before confirmation
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Persist confirmed bokslut financial overrides with source metadata and keep the existing manual-year flow backward compatible
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/veeti/veeti-effective-data.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add regression coverage for PDF preview, confirmation, and override application on a selected year
  - files: apps/api/src/v2/, apps/web/src/v2/, e2e/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

### S-22 substeps

- [ ] Extend effective-year data to expose dataset-level provenance suitable for UI badges and review decisions
  - files: apps/api/src/veeti/veeti-effective-data.service.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Redesign the Overview year list around review actions instead of blocked-year rescue only
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add side-by-side VEETI vs effective value review for key financial statement fields
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Add clean actions to keep VEETI, import bokslut PDF, edit effective values, and re-apply VEETI values
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Update V2 copy so Overview talks about trusted effective years instead of VEETI-only truth
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add regression coverage for wrong-but-complete VEETI years, dataset source badges, and VEETI re-apply behavior
  - files: apps/api/src/v2/, apps/web/src/v2/, e2e/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

### S-23 substeps

- [ ] Remove VEETI-only forecast blockers and rewrite scenario creation to depend on trusted effective baseline availability
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Define and persist a structured 20-year investment program model that fits the current Forecast flow
  - files: apps/api/prisma/schema.prisma, apps/api/prisma/migrations/, apps/api/src/v2/dto/, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add Forecast UI for yearly investment rows with category, amount, replacement/new marker, confidence, and note
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Feed the structured investment program into the existing scenario compute pipeline without breaking explicit compute
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/
  - run: pnpm --filter ./apps/api test -- src/projections
  - evidence: pending

- [ ] Add Forecast summaries for annual investment total, rolling 5-year total, and peak years
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Add compatibility tests so existing scenarios still load safely when no new investment metadata exists
  - files: apps/api/src/v2/, apps/api/src/projections/, apps/web/src/v2/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-24 substeps

- [ ] Define fee sufficiency outputs and API payload fields using the current projection engine and effective-baseline assumptions
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/projections && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Surface current fee vs required fee, annual increase need, underfunding start year, and cumulative gap in Forecast
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add scenario-based financial risk presets for lower volume, higher opex, higher energy, higher capex, delayed fee increase, and financing pressure
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: pending

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

- [ ] Add provenance-aware language to report summaries so outputs describe effective baseline sources truthfully
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Implement public-safe vs confidential section composition without rewriting the whole report pipeline
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/projections/, apps/web/src/api.ts, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add end-to-end regression coverage for bokslut import -> overview trust review -> forecast -> report variant flow
  - files: e2e/, apps/api/src/v2/, apps/web/src/v2/
  - run: pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Run final quality gates for the new planning cycle and complete sprint evidence once all rows are READY
  - files: apps/api/, apps/web/, e2e/, docs/SPRINT.md, docs/WORKLOG.md
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: pending
