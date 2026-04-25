# Water Law Asset + Tariff Workstream

Status: Active
Created: 2026-04-25
Direction: `docs/WATERLAW_ASSET_TARIFF_DIRECTION.md`

## Purpose

Execute the 2026 water-law product direction as a parent workstream split into waves. The direction doc remains the canonical "why and what"; this file tracks execution shape, wave status, acceptance, and evidence.

## Operating Rules

- Keep implementation grounded in the current V2 app: Overview, Asset Management, Forecast, Tariff Plan, Reports.
- Prefer nullable/new structures so existing Vesinvest plans and reports remain readable.
- Do not build a full asset register, spreadsheet tariff import, full stormwater model, or area-specific tariff-package engine unless a later wave explicitly promotes it.
- Reports must snapshot accepted evidence; they must not recompute from mutable live state.
- Public/internal report split must avoid leaking confidential fields into public output.

## Waves

### Wave 0: Contract + Evidence Schema

Status: Completed

Goal: Add the missing evidence and readiness contracts without breaking existing plans.

Scope:

- Add nullable plan evidence fields for asset inventory, condition studies, maintenance, municipal-plan context, risk, publication, and communication.
- Add nullable tariff evidence fields for revenue, costs, regional differentiation, stormwater, special-use wastewater/water, returnable connection fees, and owner distributions.
- Extend shared web/API DTOs.
- Add default empty-state handling for old rows.

Primary files:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/v2/v2-vesinvest.service.ts`
- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`

Acceptance:

- Existing plans and tariff plans load without migration breakage.
- New evidence fields save/reload through API.
- API tests cover old rows and new evidence payloads.

Evidence:

- Added nullable plan evidence fields and tariff evidence fields in Prisma schema and migration.
- Extended API DTOs, service normalization/mapping, tariff-plan persistence, and web API types.
- Verified old tariff rows return null evidence defaults and new evidence payloads save/reload.
- `pnpm --filter ./apps/api prisma:generate` passed.
- `pnpm --filter ./apps/api test src/v2/v2-vesinvest.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.

### Wave 1: Asset Management Evidence

Status: Completed

Goal: Make Asset Management the evidence and governance environment required by the law direction.

Scope:

- Add UI sections for asset inventory/data gaps, condition studies, maintenance/service tracking, municipal-plan context, financial risks, execution-capacity risks, publication boundaries, and communication notes.
- Keep current investment/depreciation workspace working.
- Add readiness messaging for missing evidence.

Primary files:

- `apps/web/src/v2/AssetManagementPageV2.tsx`
- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- `apps/web/src/v2/vesinvestPlanningChrome.tsx`
- `apps/web/src/v2/vesinvestPlanningReviewSections.tsx`
- `apps/web/src/v2/useVesinvestPlanningController.ts`
- `apps/web/src/v2/vesinvestPlanningModel.ts`
- `apps/web/src/i18n/locales/*.json`

Acceptance:

- Users can edit and save all new asset-management evidence sections.
- Missing evidence is visible in readiness state.
- Existing sync-to-forecast and tariff/report handoffs remain intact.

Evidence:

- Added Asset evidence workspace tab in Asset Management.
- Added editable notes for asset inventory/data gaps, condition studies, maintenance/service tracking, municipal-plan context, financial/execution risk, publication boundaries, and board/customer communication.
- Wired evidence fields into Vesinvest draft creation/update payloads.
- Added EN/FI/SV locale surface for new evidence sections.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/web test -- localeIntegrity.test.ts` passed.

### Wave 2: Law-Facing Investment Summary

Status: Completed

Goal: Turn existing investment rows into the required 20-year legal summary.

Scope:

- Summarize renovation vs new investments.
- Summarize by asset category.
- Show 0-5, 6-10, and 11-20 year buckets.
- Preserve detailed project/allocation editing.
- Feed the summary into tariff readiness and reports.

Primary files:

- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/useVesinvestPlanningDerivedState.ts`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`
- `apps/web/src/v2/vesinvestPlanningReviewSections.tsx`

Acceptance:

- Plan responses include law-facing investment summaries.
- Asset Management renders those summaries.
- Tariff Plan can consume the summary without browser-side recomputation from raw projects.

Evidence:

- Added backend `lawInvestmentSummary` with renovation/new/repair totals, 0-5/6-10/11-20 buckets, investment-type totals, and asset-category totals.
- Added web API type support and Asset Management rendering for the saved legal investment summary.
- Added EN/FI/SV locale surface for the legal summary.
- Addressed Wave 0 audit findings: latest tariff row must be accepted for reports, and explicit JSON clears now use SQL NULL.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api test src/v2/v2-vesinvest.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- localeIntegrity.test.ts` passed.

### Wave 3: Tariff Evidence + Calculation

Status: Completed

Goal: Upgrade Tariff Plan into a revenue/cost/assumption evidence environment.

Scope:

- Add current/proposed revenue evidence by fee type.
- Add cost evidence: materials/supplies, purchased services, personnel, finance costs, other costs.
- Add returnable connection-fee liability and owner distribution/tuloutus assumptions.
- Add structured regional differentiation, stormwater, special water use, and exceptional wastewater assumptions.
- Extend recommendation output with revenue table, cost table, annual change path, impact flags, and allocation rationale.
- Keep the existing four fee levers.

Primary files:

- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-tariff-plan.types.ts`
- `apps/web/src/api/v2/types/vesinvest.ts`
- `apps/web/src/v2/TariffPlanPageV2.tsx`
- potential `apps/web/src/v2/tariffPlan*.tsx`
- `apps/web/src/i18n/locales/*.json`

Acceptance:

- Revenue/cost/assumption evidence saves and reloads.
- Readiness lists unresolved assumptions.
- Recommendation includes fee-type revenue, annual change path, 15% and applicable euro-impact flags.
- Accepted tariff plan remains required for report creation.

Evidence:

- Added tariff evidence editing for revenue, costs, regional differentiation, stormwater, special use, returnable connection fees, and owner distribution assumptions.
- Extended recommendation output with revenue table, annual change path, impact flags, and allocation rationale.
- Readiness now includes required tariff revenue/cost/connection-fee liability evidence blockers.
- Preserved structured evidence keys when note fields are cleared.
- Addressed Wave 1 audit findings: asset evidence affects readiness/report blocking, structured JSON is preserved, and workspace switcher no longer misuses `tablist`.
- Addressed Wave 2 audit findings: horizon-limited legal summary totals, 1-5/6-10/11-20 labels, and no saved legal summary display during unsaved investment edits.
- `pnpm --filter ./apps/api test src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/web test -- localeIntegrity.test.ts` passed.

### Wave 4: Reports + Snapshots

Status: Completed

Goal: Make Reports the immutable snapshot of baseline, asset evidence, tariff evidence, readiness, and assumptions.

Scope:

- Snapshot asset evidence, condition, maintenance, municipal-plan context, risk, publication state, communication state.
- Snapshot tariff revenue/cost evidence, regional/stormwater/special-use assumptions, returnable connection fees, owner distributions.
- Add public summary vs internal/confidential appendix modes.
- Preserve legacy report compatibility.

Primary files:

- `apps/api/src/v2/v2-report.service.ts`
- `apps/api/src/v2/v2-report.types.ts`
- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/web/src/api/v2/types/reports.ts`
- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/web/src/v2/reportsPageSections.tsx`
- `apps/web/src/v2/reportReadinessModel.ts`
- `apps/web/src/v2/useReportsPageViewModel.ts`

Acceptance:

- Reports snapshot accepted evidence instead of recomputing from live state.
- Public report output excludes internal/confidential fields.
- Internal appendix includes full evidence.
- Old reports remain readable.

Evidence:

- Report snapshots now include accepted asset evidence and tariff evidence fields.
- Report DTOs/web types carry the snapshotted evidence for immutable readback.
- Confidential appendix PDFs include evidence notes; public summaries do not print internal evidence notes.
- Report creation still requires the latest tariff row to be accepted and current.
- `pnpm --filter ./apps/api test src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.

### Wave 5: Shell Readiness + UX Polish

Status: Completed

Goal: Keep navigation, readiness, and communication coherent after the new evidence requirements land.

Scope:

- Extend shell bootstrap with minimal readiness booleans for new evidence.
- Update tab status rules for Asset Management, Forecast, Tariff Plan, and Reports.
- Keep Reports reachable after baseline verification but block creation/export until evidence readiness passes.
- Add editable board/customer communication summary.
- Run live UI audit on the full workflow.

Primary files:

- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/appShellV2Routing.ts`
- `apps/web/src/v2/appShellV2Chrome.tsx`
- `apps/web/src/v2/VesinvestPlanningPanel.tsx`
- `apps/web/src/v2/ReportsPageV2.tsx`
- relevant AppShell and live-flow tests

Acceptance:

- Tab status never claims ready while required evidence is missing.
- Reports readiness explains the actual blocker.
- Communication summary is editable and snapshotted.
- Live audit finds no route/readiness contradiction.

Evidence:

- Shell bootstrap now carries asset-evidence readiness.
- Asset Management tab status requires both investment rows and required asset evidence before showing ready.
- Report-ready status requires complete asset evidence in addition to accepted/current tariff plan and fresh linked forecast.
- Asset Management action gates explain missing evidence before tariff/report handoff.
- Addressed Wave 3 audit findings: Overview preserves asset-evidence readiness, report creation has a server-side asset-evidence guard, asset readiness requires notes, and Tariff Plan shows tariff evidence readiness blockers.
- Addressed Wave 4 audit findings: public-summary snapshots omit internal evidence, confidential snapshots retain it, and latest tariff-row selection is deterministic.
- Addressed Wave 5 audit findings: legacy accepted tariff plans must pass new tariff-evidence gates, Forecast/Reports readiness consumes asset-evidence state, and Overview no longer replaces shell freshness with partial plan state.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/api test src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- localeIntegrity.test.ts` passed.

## Completion Criteria

- All waves are complete or explicitly deferred with documented rationale.
- Direction doc and workstream doc agree.
- Current plans, old tariff plans, and old reports remain readable.
- Report creation requires accepted and current tariff evidence.
- Public/internal report behavior is verified.
- Final web/API verification bundle passes.

## Completed Archive Path

When complete, move this file to:

`docs/workstreams/completed/waterlaw-asset-tariff-workstream.md`
