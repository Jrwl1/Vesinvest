# Vesinvest V2 Frontend Target

## Goal

Implement the v3 Vesinvest V2 frontend target across the shell, Overview, Asset Management, Forecast, Tariff Plan, and Reports while preserving current V2 data flow, routing, workflow locks, and language plumbing.

## Context Links

- Product truth: `docs/product/index.md`
- Architecture map: `docs/architecture/index.md`
- Quality gates: `docs/quality/gates.md`
- Browser validation: `docs/harness/browser-validation.md`
- Mockup package: `C:\Users\john\Downloads\vesinvest_revised_html_mockups_v3\vesinvest_revised_html`

## Files / Blast Radius

- V2 web shell and styling under `apps/web/src/v2/`
- V2 report API/types/PDF service under `apps/api/src/v2/`
- Web API report types under `apps/web/src/api/v2/`
- Focused V2 report, shell, Overview, Asset Management, Forecast, Tariff Plan, and Reports tests

## Acceptance

- The V2 shell shows compact, visible workflow truth and tab status labels.
- Ready-state screens are coherent: accepted baseline, ready asset plan, fresh forecast, accepted tariff plan, available reports.
- Overview accepted years use `View details`, `Reopen review`, and generic `More actions`; no demo-specific import label appears.
- Asset Management prioritizes the 20-year investment picture before evidence/admin metadata.
- Forecast makes required price today the dominant metric and clarifies comparator, increase, and horizon price semantics.
- Tariff Plan includes even split recommendation and custom allocation editing.
- Reports support real package variants: regulator, board, and internal appendix.
- Mobile/narrow layout validation is out of scope for the current implementation pass.

## Verification

- Focused API report tests.
- Focused V2 web tests for shell, Overview, Asset Management, Forecast, Reports, and Tariff Plan where available.
- API and web typechecks.
- `pnpm smoke:v2`.
- Browser validation screenshots for the five V2 tabs after implementation if the local app can be started.

## Progress Log

- Created execution plan before implementation.
- Implemented report package variants with backward-compatible legacy snapshot reads.
- Added visible shell status labels and compact workflow strip.
- Updated Overview accepted baseline actions, Asset Management 20-year investment picture, Forecast price semantics, Tariff Plan even-split allocation helper, and Reports package labels.
- Repaired stale focused tests to match the revised target: Asset Management now requires completed evidence before tariff sync, Overview no longer embeds a demoted Vesinvest workspace, and Forecast keeps investment row editing in Asset Management.
- Replaced remaining customer-facing V2 KVA workbook copy with generic source workbook / Excel workbook language while keeping the existing internal parser identifiers.
- Tightened Tariff Plan allocation controls to expose `Recommended even split`, `Custom allocation`, and a separate `Apply recommendation` action.

## Decisions

- Mockups guide hierarchy and copy; implementation adapts to current V2 code and contracts.
- Report package variants are persisted in report snapshots, not a new Prisma column.
- Existing V2 plan, forecast, and tariff data are reused unless implementation proves a field is missing.

## Evidence

- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api test -- src/v2/v2-report.service.spec.ts src/v2/v2-report-pdf.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.workspace-handoff.details.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx` passed.
- `pnpm --filter ./apps/web test -- src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx` passed.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.bootstrap-routing.test.tsx src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/AppShellV2.saved-fee-path.test.tsx` passed.
- `pnpm check:harness` passed.
- `pnpm smoke:v2` passed.
- `pnpm --filter ./apps/web test -- src/v2/TariffPlanPageV2.test.tsx src/v2/OverviewPageV2.workspace-document-import.test.tsx src/v2/OverviewPageV2.workspace-handoff.details.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/TariffPlanPageV2.test.tsx` passed.
- Desktop-only Playwright validation passed on `http://localhost:5173` with screenshots:
  - `output/playwright/vesinvest-v2-overview-desktop.png`
  - `output/playwright/vesinvest-v2-asset-management-desktop.png`
  - `output/playwright/vesinvest-v2-forecast-desktop.png`
  - `output/playwright/vesinvest-v2-tariff-plan-desktop.png`
  - `output/playwright/vesinvest-v2-reports-desktop.png`
- Desktop browser validation found no visible `KVA workbook` copy and no console errors. One aborted `/api/v2/context` request occurred during route navigation.
