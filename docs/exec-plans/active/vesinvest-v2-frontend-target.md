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
- Started the V2 UI completion pass after the main-vs-`codex/frontend` browser audit.
- Desktop/mobile decision: desktop/laptop is the target for this pass; mobile/narrow polish is explicitly out of scope.
- Follow-up findings closed in this pass:
  - Direct `/tariff-plan` and `/reports` now hydrate the same workflow truth as tab navigation.
  - Forecast, Reports preview, and PDF key figures now use the annual-result required price as the primary metric; cumulative-cash floor is secondary risk/cash wording.
  - Reports is document-preview-first and package variant export requires the selected saved package or an explicit package creation action.
  - Asset Management, Forecast, and Tariff Plan first desktop viewports prioritize 20-year investment picture, required price, and fee recommendation work.
  - Swedish ready-state browser validation has no visible KVA/import/source-document or English fallback leaks for the checked routes.
  - Shell/status chrome remains visible but reduced in weight; mobile/narrow polish remains out of scope.
- Final polish after hostile audit:
  - Tariff handoff and accepted tariff recommendation now use the annual-result required price as the primary target; cumulative cash remains secondary risk wording.
  - Report creation persists `locale`, generated package titles are localized, and PDF body labels use the saved report locale.
  - Reports preview no longer tells users that new packages are blocked while the selected saved package is export-ready.
  - Browser/PDF seed data was refreshed after the Kronoby evidence text cleanup and report packages were recreated for all three variants.
  - Hostile-audit follow-up closed:
    - Tariff Plan now exposes `priceSignal` on the tariff recommendation and leads the first viewport with `2,54 EUR/m3` before revenue smoothing.
    - Live Kronoby tariff form values, asset evidence notes, project names, baseline provenance, and PDF evidence text were rewritten with Swedish product copy instead of English/demo or ASCII Swedish seed text.
    - Fresh-DB Vesinvest group labels now use proper Swedish diacritics.
    - PDF rendering now maps source status, dataset, Vesinvest class/account, yearly investment type, and confidence keys to localized user-facing labels instead of raw snapshot identifiers.
    - Accepted Tariff Plan pages with visible unsaved edits now show a warning status (`Changes not accepted`) instead of a positive accepted chip, and report handoff remains blocked until the edits are accepted.

## Decisions

- Mockups guide hierarchy and copy; implementation adapts to current V2 code and contracts.
- Report package variants are persisted in report snapshots, not a new Prisma column.
- Existing V2 plan, forecast, and tariff data are reused unless implementation proves a field is missing.
- Primary required price means the annual-result floor (`requiredPriceTodayCombinedAnnualResult`). Cumulative-cash floor remains a secondary cash sufficiency/risk metric.
- Reports export must download the selected saved package variant; changing the preview variant must require selecting or creating that package before export.

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
- Follow-up browser audit seed state:
  - Kronoby VEETI org `1535`.
  - Baseline years `2022-2025` imported and accepted.
  - Plausible economic values, active 20-year investment plan, fresh forecast compute, accepted tariff plan, and three report packages.
  - Audit artifacts: `output/playwright/ui-audit-2026-04-29` and `output/playwright/ui-audit-2026-04-29-clickflow`.
- Completion gate evidence:
  - `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-report.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts` passed.
  - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.bootstrap-routing.locks.test.tsx src/v2/AppShellV2.saved-fee-path.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/displayNames.test.ts src/i18n/locales/localeIntegrity.test.ts` passed.
  - `pnpm --filter ./apps/api typecheck` passed.
  - `pnpm --filter ./apps/web typecheck` passed.
  - `pnpm smoke:v2` passed.
  - `pnpm check:harness` passed.
  - `git diff --check` passed.
- Completion browser/PDF evidence:
  - Desktop direct-route and tab-click validation passed on `http://127.0.0.1:5173` for `/`, `/asset-management`, `/forecast`, `/tariff-plan`, and `/reports`.
  - Browser validation artifacts: `test-results/v2-ui-completion/browser-validation.json` and screenshots in `test-results/v2-ui-completion/*.png`.
  - PDF validation artifacts: `test-results/v2-ui-completion/pdf-manifest.json`, `test-results/v2-ui-completion/pdf-text-validation.json`, and generated package PDFs/text extracts.
  - Browser validation scans visible text plus `input`, `textarea`, and `select` values; it confirms Tariff Plan shows `2,54 EUR/m3` before `+3,02 %`, no English/demo seed text, and no visible KVA/source-document leakage.
  - PDF text validation confirms primary `2,54 EUR/m3` appears in key figures, `4,25 EUR/m3` appears in localized cumulative-cash risk wording, all three package labels are Swedish, and no English/demo/source-language leak patterns appear.
  - Hostile-audit P1 PDF identifier follow-up:
    - `pnpm --filter ./apps/api test -- src/v2/v2-report.service.spec.ts src/v2/v2-report-pdf.spec.ts src/v2/v2-tariff-plan.service.spec.ts` passed.
    - `pnpm --filter ./apps/api typecheck` passed.
    - Regenerated all three live package PDFs in `test-results/v2-ui-completion/`; text extraction confirms no `MANUAL`, `sanering_water_network`, Finnish dataset keys, `replacement`, or lowercase confidence keys leak.
  - Tariff dirty-status follow-up:
    - `pnpm --filter ./apps/web test -- src/v2/TariffPlanPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
    - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.bootstrap-routing.locks.test.tsx src/v2/AppShellV2.saved-fee-path.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/displayNames.test.ts src/i18n/locales/localeIntegrity.test.ts` passed.
    - `pnpm --filter ./apps/web typecheck` passed.
  - Final hostile re-audit closure:
    - Initial re-audit found no P0/P1 and flagged Reports preview raw account keys plus active-locale date formatting as must-fix residuals.
    - Reports preview now resolves project/depreciation account keys through Vesinvest display labels; live `/reports` validation in `test-results/v2-ui-completion/reports-preview-validation.json` has no raw identifier hits, console errors, or failed requests.
    - Forecast and Reports scenario dates now use the active app locale; `src/v2/dateFormatting.test.ts` covers Swedish `29 apr. 2026` formatting.
    - Targeted hostile re-audit after these fixes found no remaining P0/P1/P2 findings; duplicate shell/status badges are accepted residual P3 polish, not a workflow-truth blocker.
    - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.bootstrap-routing.locks.test.tsx src/v2/AppShellV2.saved-fee-path.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/displayNames.test.ts src/v2/dateFormatting.test.ts src/i18n/locales/localeIntegrity.test.ts` passed.
  - Final mechanical gates after hostile-audit fixes:
    - `pnpm smoke:v2` passed.
    - `pnpm check:harness` passed.
    - `git diff --check` passed with CRLF normalization warnings only.
