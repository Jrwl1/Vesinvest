# Sprint

Window: 2026-03-16 to 2026-08-29

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

Deliver the full frontend overhaul canon end to end: truthful and low-noise setup wizard, first-class statement-PDF correction, strict planning-baseline gate, CFO-first Forecast landing, progressive investment planning, integrated depreciation strategy, locale-clean UI, and final live proof that there are no obvious trust, hierarchy, or workflow gaps left in the audited paths.

## Recorded decisions (this sprint)

- One locale means one language. No mixed Finnish, Swedish, and English on primary surfaces.
- VEETI completeness is only technical importability; it is never enough to imply business trust.
- Year cards must surface raw accounting shape and trust, not only technical completeness.
- Full manual override remains available even when VEETI already contains values.
- Statement PDF import is a first-class correction path and must not hide behind secondary accordions.
- Forecast and Reports stay locked until the planning baseline is explicitly created.
- Forecast opens in CFO mode by default and keeps analyst density as an optional drill-down mode.
- Future investments and depreciation planning are one workflow, not two disconnected editors.
- The sprint is not complete until a real-PDF correction flow and a full wizard/forecast/reports live audit end with `whole sprint succeeded`.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-74 | Lock shared shell truth, shared vocabulary, and shared visual status system before deeper UI redesign. See S-74 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/*.test.tsx | Shared shell/wizard/forecast chrome uses one language system, one badge/status system, and one truthful setup-state contract; display-only overrides no longer falsify wizard truth. | Accepted in review: focused web tests + typecheck verified truthful shell state, unified status badges, and localized wizard/forecast chrome. | Stop if truthful shell state requires a broader app-wide routing/runtime contract outside current V2 shell scope. | DONE |
| S-75 | Expose a canonical year trust/source/discrepancy contract for import and review surfaces. See S-75 substeps. | apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Each imported year exposes canonical summary rows, source mix, trust/discrepancy metadata, and a result-to-zero signal that the wizard can render truthfully without inventing values. | Accepted in review: API/web tests and dual typechecks verified canonical summary rows, discrepancy reasons, and numeric result-to-zero rendering for corrected years. | Stop if the required trust/discrepancy signals cannot be derived from current imported/effective datasets without new unavailable customer data. | DONE |
| S-76 | Rebuild step 1 and step 2 into an action-first connect surface plus a trust-first year board. See S-76 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | Step 1 is a slim connect flow with no duplicate summary clutter; step 2 shows ready/suspicious/blocked year lanes with primary business values, trust framing, and secondary technical detail collapsed. | Pending - row starts at first DO packet. | Stop if the trust-board layout cannot remain scan-friendly on both desktop and mobile without a broader non-V2 layout rewrite. | TODO |
| S-77 | Rebuild the shared year-review surface so correction choices are explicit and full manual override is truly complete. See S-77 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Year review starts with business summary and visible primary actions; full manual override exposes all finance-critical inputs regardless of completeness; provenance and restore paths remain visible but secondary. | Pending - row starts at first DO packet. | Stop if a full override surface cannot be made truthful without changing the current imported-year storage contract beyond this queue. | TODO |
| S-78 | Make statement-PDF correction a first-class, low-friction reconciliation flow. See S-78 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/statementOcrParse.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/statementOcr.test.ts, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | A year review exposes one visible `Import statement PDF` path, OCR preview shows file/page/confidence plus VEETI/PDF/current diffs, confirm/confirm+sync are explicit, and the real 2024 customer PDF corrects the year without hidden second-mode activation. | Pending - row starts at first DO packet. | Stop if real customer PDF formats require a server-side document-processing dependency beyond the current bounded browser/OCR approach. | TODO |
| S-79 | Enforce the planning-baseline gate and make step 5 / step 6 truthful closure, not implied readiness. See S-79 substeps. | apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx | Forecast and Reports stay locked until explicit planning-baseline creation; corrected-year closure explains what changed and what remains queued; step 5 / step 6 no longer imply completion too early. | Pending - row starts at first DO packet. | Stop if strict baseline gating requires a new backend planning-context contract that cannot be introduced compatibly inside this row. | TODO |
| S-80 | Rebuild Forecast first load into a localized CFO-first hero, trust strip, and optional analyst density mode. See S-80 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx | Forecast opens with scenario rail, executive hero, centralized freshness/trust strip, and standard versus analyst density modes; mixed-language cockpit scaffolding is removed. | Pending - row starts at first DO packet. | Stop if CFO-first landing requires scenario data that current Forecast payloads cannot expose without a broader contract change. | TODO |
| S-81 | Redesign the investment program into progressive disclosure instead of a full-horizon data dump. See S-81 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx | Forecast opens with investment summary and near-term planning first, long-range years are grouped, the full annual table is on demand, and bulk actions/templates stay available for analyst work. | Pending - row starts at first DO packet. | Stop if grouped/near-term investment views cannot stay consistent with the current yearly-investment contract without a wider model change. | TODO |
| S-82 | Integrate depreciation strategy with the investment workflow in plain finance language. See S-82 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Depreciation is edited as one planning surface with class, useful life, method, mapping, preview, and tariff/cash impact visible while the user works; the connection to planned investments is obvious. | Pending - row starts at first DO packet. | Stop if integrated depreciation planning requires a cross-cutting scenario/investment contract change beyond the bounded Forecast queue. | TODO |
| S-83 | Align Forecast comparison, detailed outputs, and Reports to the same source-mix truth and visual hierarchy. See S-83 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Comparison, charts, detailed tables, and Reports reflect the same source/provenance truth as the wizard and forecast baseline context; statement-import and mixed-source years remain legible end to end. | Pending - row starts at first DO packet. | Stop if consistent provenance rendering requires report-schema changes that exceed the current V2/report scope. | TODO |
| S-84 | Finish accessibility, responsiveness, and final locale cleanup across wizard, Forecast, and Reports. See S-84 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/*.test.tsx | Desktop/mobile layouts remain coherent, keyboard flow works across the critical paths, contrast and table readability are finance-grade, and no mixed-language leakage remains on the audited V2 surfaces. | Pending - row starts at first DO packet. | Stop if fixing the remaining accessibility/responsive gaps requires a broader non-V2 layout rewrite beyond the bounded frontend-overhaul queue. | TODO |
| S-85 | Close with regression proof and a full live audit that includes the real 2024 statement-PDF correction path. See S-85 substeps. | apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md | Focused regression gates pass, a wiped-workspace live audit covers step 1 -> statement correction -> baseline gate -> Forecast -> Reports, the real 2024 PDF correction is re-verified, and the final audit artifact ends with `whole sprint succeeded` or a blocker. | Pending - row starts at first DO packet. | Stop if the final live audit still finds a trust, hierarchy, statement-import, or depreciation-planning blocker after `S-74..S-84`; record it and stop there. | TODO |

### S-74 substeps

- [x] Replace mixed-language shared shell, wizard, and Forecast scaffolding copy with the canonical terminology from the approved frontend canon
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:976e2616d7ff7e6dc0e88c022be29e6ed3d28137 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Remove display-only wizard truth overrides and make the shared shell/page indicator derive from actual setup truth only
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:976e2616d7ff7e6dc0e88c022be29e6ed3d28137 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Create one shared visual system for status chips, trust callouts, and source/provenance labels across the wizard and Forecast shell
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:976e2616d7ff7e6dc0e88c022be29e6ed3d28137 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-75 substeps

- [x] Expose canonical year trust, source-mix, and result-to-zero summary data from the current imported/effective datasets
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:062f9b5bfe0259abb585626eeaf0d6331c3a6648 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Add explicit discrepancy metadata for manual or OCR-corrected years so the wizard can show a material-change trust warning
  - files: apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/api.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:062f9b5bfe0259abb585626eeaf0d6331c3a6648 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Regress the shared year summary contract in web/api tests so trust rendering stays tied to truthful data
  - files: apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:062f9b5bfe0259abb585626eeaf0d6331c3a6648 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

### S-76 substeps

- [ ] Rebuild step 1 into a slim action-first connect surface with assisted lookup, one primary CTA, and no duplicate summary chrome above the fold
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Rebuild step 2 into ready, suspicious, and blocked lanes with primary business values and secondary technical detail collapsed
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Regress step-1/step-2 trust-board behavior, including suspicious-year framing and mobile-safe layout
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-77 substeps

- [ ] Make Keep in plan, Full manual override, Import statement PDF, and Exclude visible as primary year actions on the shared review surface
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Expand full manual override so every finance-critical field stays editable regardless of current completeness
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep section-level provenance and VEETI restore paths visible but secondary to review/correction work
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-78 substeps

- [ ] Promote statement PDF import to one visible first-class review action and remove the hidden second activation step
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Show OCR file/page/confidence plus VEETI, PDF, and current-value diffs before confirm or confirm-and-sync
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/statementOcr.ts, apps/web/src/v2/statementOcrParse.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/statementOcr.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Regress the real 2024 customer PDF correction path so the year can be corrected and synced without hidden workflow steps
  - files: apps/web/src/v2/statementOcr.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/statementOcr.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

### S-79 substeps

- [ ] Keep Forecast and Reports locked until explicit planning-baseline creation and remove premature baseline-ready messaging
  - files: apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/overviewWorkflow.test.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Make corrected-year closure explain what changed, what stayed from VEETI, and what remains queued before baseline creation
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Regress step-5/step-6 handoff and direct-route locking against the stricter baseline gate
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/overviewWorkflow.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/overviewWorkflow.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-80 substeps

- [ ] Replace mixed-language Forecast landing scaffolding with canonical CFO-first terminology and one centralized freshness banner
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Rebuild Forecast first load into scenario rail, executive hero, and one trust/context strip above any long editing surfaces
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add standard and analyst density modes without weakening scenario truth or report-readiness signaling
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-81 substeps

- [ ] Replace full-horizon first paint with investment summary strip plus near-term five-year planning view
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Add grouped long-range views and keep the full annual investment table available only on demand
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep bulk actions and templates available for analyst work without returning to a raw spreadsheet-first first load
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-82 substeps

- [ ] Rebuild the depreciation workspace around plain-language class, useful-life, and method concepts tied to future investments
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Keep yearly depreciation preview and tariff/cash impact visible while the user edits mappings and rules
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Regress integrated investment-to-category mapping and report-readiness behavior against the new plain-language workspace
  - files: apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

### S-83 substeps

- [ ] Align Forecast comparison, charts, and detailed tables to the new hierarchy and centralized freshness/source truth
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Surface statement-import and mixed-source provenance in Forecast baseline context and in Reports
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Regress report-readiness and comparison consistency after statement-import and mixed-source baseline changes
  - files: apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

### S-84 substeps

- [ ] Eliminate remaining mixed-language leaks and expand locale-integrity coverage for wizard, Forecast, and Reports
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Ensure keyboard flow, contrast, and responsive layouts are acceptable across wizard, Forecast, and Reports
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Remove duplicate or low-value explanatory copy from primary wizard and Forecast screens while keeping secondary detail accessible
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-85 substeps

- [ ] Add final focused regression proof for wizard truth, statement import, Forecast hierarchy, investments, depreciation, and report/source consistency
  - files: apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/statementOcr.test.ts, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/v2/yearReview.test.ts src/v2/statementOcr.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: pending

- [ ] Run a wiped-workspace live audit from step 1 through statement correction, baseline creation, Forecast, and Reports using the real 2024 PDF
  - files: docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md
  - run: N/A (manual browser audit with the real 2024 customer PDF allowed)
  - evidence: pending

- [ ] Record the explicit sprint outcome in `docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md` and stop on any remaining trust, hierarchy, statement-import, or depreciation blocker
  - files: docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md
  - run: N/A (manual audit artifact update allowed)
  - evidence: pending
