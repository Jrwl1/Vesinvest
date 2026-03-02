# Sprint

Window: 2026-03-02 to 2026-04-12

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Make Forecast (`Ennuste`) and Reports behavior fully trustworthy for operators: deterministic compute-before-report flow, no summary/snapshot drift, clearer scenario loading, safer yearly investment editing, and reduced redundant API traffic during normal use.

## Recorded decisions (this sprint)

- Report creation requires an explicit compute freshness token from the current editing session.
- Report summary KPIs must be derived from the same canonical snapshot payload that is stored in the report.
- Forecast UI must not auto-compute during report creation; operators must trigger compute explicitly.
- Scenario switching prioritizes clarity over preserving stale view state.
- Short-lived client-side GET caching is allowed for list/context views when force-refresh controls still bypass cache.

---

| ID   | Do                                                                                                                                | Files                                                                                                                                                              | Acceptance                                                                                                                                                                                                                                              | Evidence                                                                             | Stop                                                                                                         | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------ |
| S-11 | Enforce report snapshot consistency and stale-compute rejection in V2 report creation API. See S-11 substeps below.               | apps/api/src/v2/dto/create-report.dto.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts                                                                       | Report creation requires `computedFromUpdatedAt`; stale/missing compute token returns clear conflict; report `totalInvestments` is derived from snapshot `yearlyInvestments` so list KPI and snapshot values cannot drift for the same report artifact. | Accepted: commit `660e91f`; typecheck PASS; freshness + canonical totals verified    | Stop if freshness check cannot be implemented without schema migration that is out-of-scope for this sprint. | DONE   |
| S-12 | Make compute-before-report behavior deterministic in Forecast UI (no implicit compute on report action). See S-12 substeps below. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json    | `Create report` stays disabled until explicit compute succeeds; saving/edits invalidate report readiness; stale token conflict is shown with localized guidance to recompute; report action no longer auto-saves and auto-computes behind the button.   | Accepted: commit `467c5fe`; typecheck + AppShell test PASS; gating flow verified     | Stop if deterministic gating regresses existing compute/save behavior for scenarios.                         | DONE   |
| S-13 | Clarify scenario switching UX by removing stale content visibility and locking edits during loading. See S-13 substeps below.     | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css                                                                                                          | Switching scenario hides previous scenario values immediately, shows clear loading state, and disables editing actions until fresh payload is bound.                                                                                                    | Accepted: commit `3c871f6`; typecheck PASS; stale-view lock and loading UX verified  | Stop if loading-state changes break scenario selection or keyboard accessibility.                            | DONE   |
| S-14 | Improve yearly investments editor with bulk actions and safer numeric input handling. See S-14 substeps below.                    | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json | Operator can apply quick bulk actions (`copy first year to all`, `clear all`); investment inputs normalize to non-negative bounded numeric values; focus-select behavior reduces accidental value append edits.                                         | Accepted: commit `c17ba64`; typecheck + AppShell test PASS; bulk/guardrails verified | Stop if numeric guardrails conflict with valid operator input patterns (copy/paste decimals).                | DONE   |
| S-15 | Reduce redundant Forecast/Report API traffic with short-lived GET cache + explicit force refresh path. See S-15 substeps below.   | apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx                                                                          | Repeated list/context/report GETs within cache TTL reuse cached payload; manual refresh and post-mutation list reloads can bypass cache; no behavior regression in list/detail rendering.                                                               | Evidence needed                                                                      | Stop if cache introduces stale-state bugs that cannot be bypassed with force refresh.                        | TODO   |

### S-11 substeps

- [x] Add report freshness token validation and canonical report total derivation from snapshot investments
  - files: apps/api/src/v2/dto/create-report.dto.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: commit:660e91f | run:pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/dto/create-report.dto.ts, apps/api/src/v2/v2.service.ts, apps/web/src/api.ts | docs:N/A | status: clean

### S-12 substeps

- [x] Rework Forecast compute/report gating so report creation only uses explicit compute state
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx
  - evidence: commit:467c5fe | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx -> PASS | files:apps/web/src/api.ts, apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

### S-13 substeps

- [x] Clear stale scenario editor content during scenario switch and lock editing controls until fresh payload is loaded
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:3c871f6 | run:pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-14 substeps

- [x] Add investment bulk actions and safe numeric guardrails in yearly investments editor
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx
  - evidence: commit:c17ba64 | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx -> PASS | files:apps/web/src/i18n/locales/en.json, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-15 substeps

- [ ] Implement short-lived GET cache and force refresh options for Forecast/Reports list-context flows
  - files: apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx
  - run: pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/web test -- src/v2/overviewWorkflow.test.ts src/v2/AppShellV2.test.tsx -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean
