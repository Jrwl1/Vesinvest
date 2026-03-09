# Sprint

Window: 2026-03-08 to 2026-05-30

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Deliver an incremental V2 UI refresh on `main` using the Claude mockup as a visual reference while preserving live workflow logic, current API contracts, and existing i18n behavior. Start with Overview and keep the rest sequenced behind it.

## Recorded decisions (this sprint)

- UI refresh ships incrementally on `main`, not as a one-shot rewrite.
- The Claude mockup is a visual reference only; implementation must preserve real V2 behavior and data contracts.
- Overview is the first screen because baseline trust and year review remain the core customer workflow.
- Forecast must remain editor-first, not dashboard-only, when its refresh starts.
- Reports must keep provenance and report-variant clarity when its refresh starts.
- Shared shell and token updates may ship only when required to support the active screen without destabilizing untouched screens.
- Completed sprint `S-21..S-25` remains traceable in git history and `docs/WORKLOG.md`; this file now tracks the next active queue.

---

| ID   | Do | Files | Acceptance | Evidence | Stop | Status |
| ---- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-26 | Refresh Overview into a calmer trust-review workspace using the new UI direction. See S-26 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/i18n/locales/, apps/web/src/api.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.ts | Overview presents readiness summary, year-review cards, VEETI-vs-effective comparison, and peer snapshot in the new visual system without losing current import, statement, reconcile, or sync behavior. | DONE: Acceptance verified against `ea39681`, `7f8ecc8`, `e73a888`, `6aac90f`, and `804c634`; Overview refresh evidence is complete and verification passed. | Stop if the Overview refresh requires broad cross-screen shell rewrites before Overview-specific behavior is stable, or if the new layout hides required review actions behind non-obvious interaction. | DONE |
| S-27 | Refresh Forecast with the same visual system after Overview is accepted, keeping the screen editor-first and scenario-driven. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/i18n/locales/, apps/web/src/api.ts | Forecast uses the refreshed layout while preserving scenario editing, assumptions, investments, fee sufficiency, risk comparison, compute/report readiness, and current projection semantics. | DONE: Acceptance verified against `0ec57ec`, `784a9f0`, `cfb7cfc`, `e174bee`, `16c4795`, `3c3e22c`, `6e81c0c`, `e494c8f`, and `540c3be`; Forecast refresh evidence is complete and verification passed. | Stop if the visual refresh requires changing projection math, scenario payload contracts, or report freshness rules. | DONE |
| S-28 | Refresh Reports with stronger publication and provenance UX after Forecast is accepted. | apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts | Reports adopt the refreshed layout, keep current variant/report snapshot behavior, and make provenance and included-section clarity explicit for both public and confidential outputs. | DONE: Acceptance verified against `22f049f`, `f97b74e`, `c9bf363`, `f2c3d75`, `e55c30f`, `3eb761a`, `f698ecf`, `32b881b`, and `865747b`; Reports refresh evidence is complete and verification passed. | Stop if the report UX refresh requires changing the saved report snapshot contract instead of re-presenting existing report data. | DONE |
| S-29 | Align shared shell, tokens, responsive behavior, and cross-screen copy once all three refreshed screens are in place. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/, apps/web/src/App.css | The refreshed screens share a coherent shell and design system, preserve route behavior, and remain readable on desktop and mobile without visual drift between Overview, Forecast, and Reports. | Evidence in progress: shared V2 chrome and spacing tokens normalized; shell/navigation, badges, copy, and responsive cleanup still pending. | Stop if shared styling changes introduce regressions in untouched app areas that require a broader rewrite than the V2 shell. | IN_PROGRESS |
| S-30 | Run UI hardening, accessibility cleanup, regression proof, and final polish across the refreshed V2 screens. | apps/web/src/v2/, apps/web/src/i18n/locales/, e2e/, docs/SPRINT.md, docs/WORKLOG.md | The incremental UI refresh remains type-safe, test-covered, keyboard-usable, and regression-safe across the core Overview -> Forecast -> Reports flow. | Evidence needed | Stop if green verification requires scope outside refreshed V2 screens or changes to forbidden non-UI product behavior. | TODO |

### S-26 substeps

- [x] Establish minimal shared shell and token updates needed for the Overview refresh without changing route/history behavior
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:ea3968182d26067161c0c7096957e963728f4e2d | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Recompose Overview into readiness summary, trust-review cards, comparison table, and secondary peer snapshot using the live V2 data model
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:7f8ecc8d840be596833022b9636c34423f3185d1 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Make per-year cards surface dataset-level provenance, blockers, and next actions without hiding statement import, manual edit, reconcile, or sync paths
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:e73a8888ffc77b85272f9a3d5373c7fea10d6e32 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Align new Overview copy and empty/error states with existing FI/SV/EN translations
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/OverviewPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:6aac90f7b0f5a2528530a780177f60b43b1e6121 | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [x] Add or update regression coverage for the refreshed Overview layout states and verify the web workspace stays green
  - files: apps/web/src/v2/, apps/web/src/i18n/locales/, e2e/
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:804c6347685784c5686abbb7f57a837fd0d084be | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-27 substeps

- [x] Extend shared layout primitives for the Forecast refresh without breaking the Overview styling already accepted in S-26
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/EnnustePageV2.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:0ec57ecd9c8689fc0cb340e55e7939e79c972c69 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Rework the scenario selector and scenario header into a clearer navigation surface while preserving current scenario load, create, delete, and route-adjacent behavior
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:784a9f058410442cacfbcd0ea83ea7f1dd122497 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Recompose the Forecast top section around baseline provenance and fee-sufficiency KPIs without changing compute or freshness semantics
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:cfb7cfc6c274660f281ba3b1be05f17da15b9265 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Separate Forecast inputs from outputs so assumptions, near-term expense controls, and depreciation settings read as editable planning controls instead of static summary cards
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:e174bee9f1bcbd28a0ae6f5d0423f6bb6acf944f | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Restyle the yearly investment editor and investment summaries into a denser planning workspace without hiding metadata fields or per-year edits
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:16c47954011cbb2b4650a086c3d6c1569fe017f7 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Rework risk presets, base-vs-stress comparison, and the short risk summary so stress behavior is easier to compare without changing scenario assumptions
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/riskScenario.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:3c3e22c6494bce6e33dc058e90655e60bffc75ab | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Refresh charts, result tables, and report-creation readiness messaging while preserving explicit compute, stale-token, and report gating behavior
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:6e81c0c38a33e614c845487cdd5c2a3c65c152d5 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Align new Forecast copy, labels, and empty/error states with existing FI/SV/EN translations
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:e494c8f9bc03cdc18b5c696a1affe74256f562cc | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [x] Add or update regression coverage for the refreshed Forecast layout states and verify the web workspace stays green
  - files: apps/web/src/v2/, apps/web/src/i18n/locales/, e2e/
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:540c3bee0b996ce42b64cba71a2d1922f43d15f5 | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-28 substeps

- [x] Extend shared report layout primitives for the Reports refresh without regressing accepted Overview and Forecast styling
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:22f049fecf9182828a92e592ed1a9603f3e2d1b9 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Rework the Reports list into a clearer selection surface that still preserves current filtering, selection retention, and refresh behavior
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:f97b74ecaa4556d7212030dd25b90c53c98dce7d | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Recompose the selected report header and KPI summary so pricing, increase need, baseline year, and investment load are immediately legible
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: commit:c9bf363841134889d789b967dbaa4945da7d6006 | run:pnpm --filter ./apps/web test -- src/v2 -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Make report variant selection and included-section visibility explicit in the refreshed layout without changing saved report variant semantics
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:f2c3d75c2a3c877b77a9391ddaea445c6d2bf397 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Rework the provenance and baseline-source summary so users can explain VEETI, manual, and statement-backed data in a concise publication context
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/api/src/v2/v2.service.ts
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api typecheck
  - evidence: commit:e55c30f66044afc2fd904e325dd649737bb7b148 | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Restyle assumptions snapshot, yearly investments snapshot, and report metadata blocks so the detail view stays readable without becoming a second Forecast screen
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:3eb761abe32c9cdac84b1d600e8d8a2ca6718b0c | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Refresh PDF/export affordances, loading states, and unavailable/error states without changing download behavior or report availability rules
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:f698ecf37841c2b2b405b02367aad8c19d3df93a | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Align new Reports copy, variant labels, and empty/error states with existing FI/SV/EN translations
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: commit:32b881b8e3006ccf01e6cca60e30c1837ee73ab3 | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [x] Add or update regression coverage for the refreshed Reports layout states and verify the web workspace stays green
  - files: apps/web/src/v2/, apps/web/src/i18n/locales/, e2e/, apps/api/src/v2/
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck
  - evidence: commit:865747b0a42fd9ee2af294cb437cac6b0ffa8953 | run:pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api test -- src/v2 && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.test.tsx | docs:N/A | status: clean

### S-29 substeps

- [x] Normalize shared V2 spacing, card chrome, table density, and section-header patterns after the three screen refreshes land
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:0e5abe2d5594435a71fb85c6488f5b929787f9a2 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/v2.css | docs:N/A | status: clean

- [ ] Align header, nav, drawer, and content-width behavior across Overview, Forecast, and Reports without changing current path syncing or account actions
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Unify trust, warning, variant, and provenance badge semantics so the same state looks the same on every refreshed V2 screen
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Remove one-off screen-specific style hacks that became unnecessary after the three screen refreshes were completed
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Align cross-screen copy tone, section labels, and repeated empty/error wording in FI/SV/EN so the refreshed V2 shell reads as one product
  - files: apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts
  - evidence: pending

- [ ] Validate responsive behavior for the shared shell and all refreshed V2 screens, then fix layout regressions in CSS only where possible
  - files: apps/web/src/v2/v2.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

### S-30 substeps

- [ ] Review keyboard order, focus states, and interactive affordances across the refreshed V2 shell and fix obvious accessibility regressions
  - files: apps/web/src/v2/, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Audit loading, empty, success, and error states across Overview, Forecast, and Reports so the refreshed UI still communicates real backend state changes clearly
  - files: apps/web/src/v2/, apps/web/src/i18n/locales/
  - run: pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Add or tighten targeted regression coverage for the refreshed Overview -> Forecast -> Reports flow where layout or interaction changed materially
  - files: apps/web/src/v2/, e2e/, apps/api/src/v2/
  - run: pnpm --filter ./apps/web test -- src/v2 && pnpm --filter ./apps/api test -- src/v2
  - evidence: pending

- [ ] Remove dead CSS, obsolete helper branches, and temporary layout code introduced during the incremental refresh
  - files: apps/web/src/v2/, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: pending

- [ ] Run final web verification for the refreshed UI and confirm the workspace remains type-safe after cleanup
  - files: apps/web/, docs/SPRINT.md, docs/WORKLOG.md
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2
  - evidence: pending

- [ ] Run final root quality gates once the refreshed UI and related regressions are stable
  - files: apps/api/, apps/web/, e2e/, docs/SPRINT.md, docs/WORKLOG.md
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: pending
