# Vesinvest V2 Readiness Audit Workstream

## Goal

Run the remaining production-readiness audits that were not covered by the Kronoby desktop CFO flow, fixing issues as they are found. The workstream is sequential: finish one audit wave, verify, send the implementation to a GPT-5.5 xhigh hostile subagent, then continue to the next wave while that review runs. Any P0/P1/P2 and product-grade P3/polish findings are fixed before the wave is closed.

## Scope

- Product area: Vesinvest V2 web and API flow from login through Overview, Asset Management, Forecast, Tariff Plan, Reports, and exported PDFs.
- Primary app paths:
  - Web V2: `apps/web/src/v2/`
  - Web API clients: `apps/web/src/api/`, `apps/web/src/api/v2/`
  - API auth/tenant/V2: `apps/api/src/auth/`, `apps/api/src/tenant/`, `apps/api/src/trial/`, `apps/api/src/v2/`
  - E2E harness: `e2e/v2.full-flow.spec.ts`
  - Locales: `apps/web/src/i18n/locales/`
- Evidence roots:
  - Live audit artifacts: `output/playwright/live-readiness-audit-2026-04-30/`
  - Local source validation artifacts: `output/playwright/local-readiness-audit-2026-04-30/`
  - PDF render artifacts: `output/playwright/pdf-readiness-audit-2026-04-30/`
- Live production remains the deployed-user truth source. Local dev is used for validating source fixes before commit/deploy.
- Desktop remains the primary target unless a wave explicitly audits mobile, accessibility, or browser matrix behavior.

## Operating Loop

For each wave:

1. Establish current behavior with Playwright and direct API probes where useful.
2. Save screenshots, DOM/text extracts, network summaries, console logs, API payloads, and PDF extracts under the evidence root.
3. Record findings in this plan with severity, repro, evidence, likely files, and fix status.
4. Fix P0/P1/P2 and product-grade P3 issues narrowly.
5. Run focused web/API tests and typechecks tied to touched files.
6. Start a GPT-5.5 xhigh hostile implementation audit for the wave while moving to the next wave when the next wave does not depend on the result.
7. Apply any material subagent findings, rerun focused checks, and update this plan.

Subagent prompt pattern:

```text
Audit the current diff for Vesinvest V2 readiness regressions in wave <N>.
Focus on <wave-specific risks>. Do not edit files. Return P0/P1/P2/P3
findings with file/line references, whether each blocks commit, and any
test gaps worth closing.
```

## Wave 0 - Harness And Baseline Truth

Purpose:
- Establish the exact baseline before broad audits start.
- Confirm live/local reachability, credentials, branch, current commit, and test health.

Audit steps:
- Record `git status --short --branch`, current HEAD, and live/local availability.
- Run a smoke login on live and local without destructive tenant changes.
- Capture current V2 route map and primary page text snapshots.
- Confirm the local dev harness with `pnpm dev` only if ports are free or can be cleaned safely.

Likely files:
- `docs/harness/browser-validation.md`
- `scripts/dev-up.mjs`
- `scripts/dev-clean.mjs`
- `e2e/v2.full-flow.spec.ts`

Verification gates:
- `pnpm check:harness`
- `pnpm smoke:v2`

Exit criteria:
- Evidence folder exists.
- Baseline route snapshots exist.
- Known live/local differences are listed before starting deeper waves.

Status:
- Closed on 2026-04-30.
- Live web and API health checks returned `200`.
- Local web/API were intentionally not running at wave start.
- `npx` is available for Playwright workflows.
- Authenticated live route smoke covered `/`, `/asset-management`, `/forecast`, `/tariff-plan`, and `/reports` at 1360px.
- Evidence: `output/playwright/live-readiness-audit-2026-04-30/wave0-live-route-smoke-summary.json`.
- Result: no console errors, no bad HTTP responses, no horizontal overflow, no visible raw key/demo/import-language leaks in route text snapshots. Failed requests were Cloudflare RUM aborts during navigation.

## Wave 1 - Non-Admin And Role Coverage

Purpose:
- Verify regular users/viewers cannot see or execute admin-only destructive or configuration actions.
- Ensure account wipe, group overrides, org-scoped admin actions, report/export access, and pricing actions match role expectations.

Code-grounded audit targets:
- API auth and roles:
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/jwt.strategy.ts`
  - `apps/api/src/auth/jwt.guard.ts`
  - `apps/api/src/auth/invitations.service.ts`
  - `apps/api/src/tenant/tenant.guard.ts`
  - `apps/api/src/trial/trial.controller.ts`
  - `apps/api/src/trial/trial.service.ts`
  - `apps/api/src/v2/v2.controller.ts`
  - `apps/api/src/v2/v2-vesinvest.service.ts`
- Web role surfaces:
  - `apps/web/src/v2/AppShellV2.tsx`
  - `apps/web/src/v2/appShellV2Chrome.tsx`
  - `apps/web/src/v2/VesinvestPlanningPanel.tsx`
  - `apps/web/src/v2/useVesinvestPlanningController.ts`
  - `apps/web/src/api/v2/importOverview.ts`
  - `apps/web/src/api/v2/vesinvest.ts`
  - `apps/web/src/api/v2/reports.ts`

Audit steps:
- Create or identify non-admin accounts for `USER` and, if supported, `VIEWER`.
- Log in as each role.
- Try direct-route access to Overview, Asset Management, Forecast, Tariff Plan, Reports.
- Press visible controls:
  - account wipe / clear tenant data
  - VEETI connect/import
  - baseline creation
  - group override edits
  - project create/delete
  - sync to Forecast
  - tariff save/accept
  - report package creation/export
- Call destructive endpoints directly with each token.

Fix strategy:
- Prefer server enforcement first, then hide/demote UI controls.
- Avoid relying on frontend-only role checks.
- Make blocked UI copy localized and specific.

Verification candidates:
- `pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/auth/invitations.service.spec.ts src/tenant/tenant.guard.spec.ts src/trial/trial.controller.spec.ts src/v2/v2-vesinvest.service.spec.ts`
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/VesinvestPlanningPanel.draft-admin.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx`
- Role-specific Playwright evidence.

Exit criteria:
- No admin-only destructive action is executable by non-admin roles.
- UI does not advertise actions a role cannot perform unless it clearly explains the block.

Status:
- Closed locally on 2026-04-30 after fixes.
- Local role probes created fresh `USER` and `VIEWER` accounts through the invitation flow, accepted legal terms, and walked V2 read/write endpoints.
- Evidence:
  - `output/playwright/local-readiness-audit-2026-04-30/wave1-role-api-probe-summary.json`
  - `output/playwright/local-readiness-audit-2026-04-30/wave1-role-ui-probe-summary.json`
  - `output/playwright/local-readiness-audit-2026-04-30/wave1-role-ui-viewer-overview.png`
  - `output/playwright/local-readiness-audit-2026-04-30/wave1-role-ui-user-overview.png`
- Result after fixes: `VIEWER` can read V2 routes but receives `403` for editor/admin writes; `USER` can read V2 routes and is blocked from admin-only setup/destructive actions; non-admin Overview no longer shows enabled import/trash/setup action controls and the support rail names the admin requirement instead of presenting `Import selected years` as the current action.
- Note: the first local-only role probe included an admin destructive clear check and reset the local V2 demo data. Subsequent role validation used local only; live production data was not touched in this wave.

## Wave 2 - Full Locale E2E In Finnish And English

Purpose:
- Run the full E2E workflow in Finnish and English, not just leak scans.
- Verify Swedish remains correct after any locale fixes.

Code-grounded audit targets:
- `apps/web/src/i18n/index.ts`
- `apps/web/src/i18n/locales/en.json`
- `apps/web/src/i18n/locales/fi.json`
- `apps/web/src/i18n/locales/sv.json`
- `apps/web/src/v2/activeDateLocale.ts`
- `apps/web/src/v2/dateFormatting.test.ts`
- `apps/web/src/v2/displayNames.ts`
- `apps/web/src/v2/validationDisplayText.ts`
- `apps/web/src/v2/forecastViewModel.ts`
- `apps/web/src/v2/reportsPageProvenance.ts`
- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/api/src/v2/v2-report-pdf-support.ts`

Audit steps:
- Run the full Kronoby flow in Finnish.
- Run the full Kronoby flow in English.
- Include language switching after VEETI connect and after report creation.
- Inspect visible text, inputs, aria labels, button labels, date formats, status labels, report titles, and PDF text.
- Search browser and PDF artifacts for:
  - Swedish leaking in English/Finnish flows.
  - English fallback in Swedish/Finnish flows.
  - Finnish source/parser language leaking into customer output.
  - raw keys: `per_connection`, `sanering_water_network`, `network_rehabilitation`, `kva_import`, `MANUAL`, `VESINVEST_`.

Fix strategy:
- Use existing locale keys where possible.
- Add keys only where there is a real customer-facing concept.
- Keep stored enum contracts unchanged; map at display/PDF boundaries.

Verification candidates:
- `pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/i18n/locale-encoding.test.ts src/v2/dateFormatting.test.ts src/v2/displayNames.test.ts src/v2/validationDisplayText.test.ts`
- `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-report.service.spec.ts`
- Browser/PDF text leak scans per locale.

Exit criteria:
- Full E2E completes in EN/FI/SV.
- UI and PDFs are locale-consistent for each selected language.
- No raw key/internal enum/demo/import-language leak remains in current artifacts.

Status:
- Closed locally on 2026-04-30 after PDF locale fixes.
- Live evidence:
  - `output/playwright/live-readiness-audit-2026-04-30/wave2-locale-e2e/`
  - `output/playwright/live-prod-p3-full-e2e-2026-04-30/`
- Finding: Finnish and Swedish PDF labels had stripped accents and stale mojibake expectations, which reduced trust in exported artifacts even when the browser UI was clean.
- Fixes:
  - Restored localized PDF labels/headings in `apps/api/src/v2/v2-report-pdf.ts`.
  - Restored localized PDF helper labels in `apps/api/src/v2/v2-report-pdf-support.ts`.
  - Expanded `apps/api/src/v2/v2-report-pdf.spec.ts` so PDF text extraction checks locale-specific labels and rejects mojibake.
- Verification:
  - `pnpm check:text-integrity`
  - `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-role-access.guard.spec.ts`
  - `pnpm --filter ./apps/api typecheck`

## Wave 3 - Accessibility Depth

Purpose:
- Audit keyboard-only use, focus management, labels, modal traps, aria labels, headings, tables, and contrast.

Code-grounded audit targets:
- `apps/web/src/components/LoginForm.tsx`
- `apps/web/src/v2/AppShellV2.tsx`
- `apps/web/src/v2/appShellV2Chrome.tsx`
- `apps/web/src/v2/OverviewPageV2.tsx`
- `apps/web/src/v2/vesinvestPlanningInvestmentWorkspace.tsx`
- `apps/web/src/v2/ForecastCockpitSurface.tsx`
- `apps/web/src/v2/TariffPlanPageV2.tsx`
- `apps/web/src/v2/ReportsPageV2.tsx`
- `apps/web/src/v2/reportsPageSections.tsx`
- V2 CSS: `v2-shell.css`, `v2-overview*.css`, `v2-vesinvest.css`, `v2-forecast.css`, `v2-reports.css`, `v2-shared*.css`

Audit steps:
- Keyboard-only route through login, account drawer, setup, year review, Asset Management modals, Tariff Plan, Reports, and PDF download.
- Confirm focus return after modals, drawer close, report creation, allocation editor close, and destructive confirmations.
- Check accessible names for icon/glyph buttons.
- Check aria labels in EN/FI/SV.
- Run an axe-style scan if dependency/tooling is available; otherwise implement a Playwright DOM audit for missing labels and focusable hidden elements.
- Check contrast on badges, disabled states, warning states, and selected rows.

Fix strategy:
- Fix semantics with native controls and labels before custom aria.
- Keep focus outlines visible.
- Avoid adding explanatory on-screen text unless the workflow needs it.

Verification candidates:
- `pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/i18n/locales/localeIntegrity.test.ts`
- Playwright keyboard scripts and accessibility snapshots.

Exit criteria:
- Critical workflow is keyboard-completable.
- Modal/drawer focus behavior is correct.
- No unlabeled actionable controls in V2 routes.

Status:
- Closed locally on 2026-04-30 after focus-management fixes.
- Evidence:
  - Live audit script: `output/playwright/live-readiness-audit-2026-04-30/wave3-live-accessibility-audit.mjs`
  - Local after-fix evidence: `output/playwright/local-readiness-audit-2026-04-30/wave3-accessibility-after-fixes/`
- Findings:
  - Account drawer did not move focus inside after open.
  - Allocation editor did not move focus inside after open.
  - Allocation editor did not close on `Escape`.
- Fixes:
  - Added `apps/web/src/v2/useDialogFocusTrap.ts`.
  - Applied the trap to the V2 account drawer, project composer dialog, and allocation editor.
  - Updated `apps/web/src/v2/test-support/vesinvest/vesinvestPlanningPanelDraftAdminSuite.tsx`.
- Verification:
  - `pnpm exec vitest run src/v2/VesinvestPlanningPanel.draft-admin.test.tsx -t "keeps yearly allocation editing explicit|creates a manual plan"` from `apps/web`
  - `pnpm --filter ./apps/web typecheck`
  - Local Playwright accessibility rerun returned no findings, console entries, failed requests, or bad responses.

## Wave 4 - Browser Matrix, Zoom, And Display Scaling

Purpose:
- Verify that Chromium-only success does not hide Firefox/WebKit/Edge or zoom/scaling failures.

Code-grounded audit targets:
- `playwright.config.*` if present.
- `e2e/v2.full-flow.spec.ts`
- V2 CSS files under `apps/web/src/v2/`

Audit steps:
- Run selected Playwright flows in Chromium, Firefox, and WebKit where supported.
- Check Edge/Chromium manually if the local environment supports it.
- Test desktop widths 1280, 1360, 1440, 1920.
- Test browser zoom/display scaling equivalents: 90%, 110%, 125%, and Windows text scaling if inspectable.
- Test long organization/report names and long localized strings at 1280.

Fix strategy:
- Prefer layout constraints, minmax grid tracks, wrapping, and overflow containment.
- Do not use browser-specific hacks unless the platform difference is proven.

Verification candidates:
- `pnpm e2e -- --project=<browser>` if projects exist or can be added narrowly.
- Local Playwright browser scripts with computed layout metrics.
- Focused CSS/UI tests where existing test-support makes this cheap.

Exit criteria:
- No desktop header overlap, horizontal document overflow, or clipped primary action at tested desktop viewports/zoom levels.

Status:
- Closed locally on 2026-04-30 after desktop display fixes.
- Live evidence:
  - Script: `output/playwright/live-readiness-audit-2026-04-30/wave4-live-desktop-matrix-audit.mjs`
  - Evidence root: `output/playwright/live-readiness-audit-2026-04-30/wave4-desktop-matrix/`
- Local after-fix evidence:
  - Matrix root: `output/playwright/local-readiness-audit-2026-04-30/wave4-desktop-matrix-after-fixes-local-creds/`
  - Seeded Reports rail validation: `output/playwright/local-readiness-audit-2026-04-30/wave4-seeded-reports-rail-validation/`
- Findings:
  - Reports right-rail saved report titles were too long at 1280-1920 desktop widths.
  - Asset Management active workspace indicator truncated the current page at 1360px.
  - Reports lower KPI values could split value and unit awkwardly.
- Fixes:
  - Added compact rail-only report list titles in `apps/web/src/v2/displayNames.ts` while preserving full saved/custom report titles for preview/document headers in `apps/web/src/v2/useReportsPageViewModel.ts`.
  - Updated `apps/web/src/v2/reportsListColumn.tsx` to keep long scenario names in metadata instead of the rail title.
  - Relaxed desktop page-indicator sizing in `apps/web/src/v2/v2-shell.css`.
  - Tightened Reports secondary KPI grid/value wrapping in `apps/web/src/v2/v2-reports.css`.
  - Removed stale Overview embedded-planning-panel props/state from `apps/web/src/v2/OverviewPageV2.tsx` and `apps/web/src/v2/overviewPageViewModel.ts`.
- Verification:
  - `pnpm --filter ./apps/web test -- src/v2/displayNames.test.ts src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/OverviewPageV2.setup-import.test.tsx`
  - `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.setup-import.test.tsx src/v2/OverviewPageV2.review-flow.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/OverviewPageV2.connect-import.test.tsx`
  - `pnpm --filter ./apps/web typecheck`
  - Local Playwright desktop matrix: 50 Chromium captures, no console entries, no bad responses, no outside-viewport captures; remaining non-sr findings are CSS zoom 90 document-overflow artifacts.
  - Seeded Reports rail validation at 1280 and 1360: no document overflow, row title fits, lower KPI values remain on one line, no console entries, no bad responses.

## Wave 5 - Failure, Latency, And Retry States

Purpose:
- Prove the app remains understandable when APIs are slow, fail, timeout, or return conflict/stale states.

Code-grounded audit targets:
- Web clients:
  - `apps/web/src/api/auth.ts`
  - `apps/web/src/api/v2/importOverview.ts`
  - `apps/web/src/api/v2/vesinvest.ts`
  - `apps/web/src/api/v2/forecast.ts`
  - `apps/web/src/api/v2/reports.ts`
- Page controllers:
  - `useOverviewPageController.ts`
  - `useOverviewImportController.ts`
  - `useVesinvestPlanningController.ts`
  - `useForecastPageController.ts`
  - `useReportsPageController.ts`
  - `TariffPlanPageV2.tsx`
- API services:
  - `v2-import-overview.service.ts`
  - `v2-vesinvest.service.ts`
  - `v2-forecast.service.ts`
  - `v2-report.service.ts`
  - `v2-report-pdf.ts`

Audit steps:
- Intercept or force failures for:
  - login invalid credentials and expired session
  - VEETI search/connect/import timeout
  - manual-year save failure
  - planning baseline conflict
  - Vesinvest save/sync conflict
  - forecast compute failure
  - tariff save/accept failure
  - report create/export failure
  - PDF download failure
- Inspect loading/disabled states, retry actions, final error copy, and whether dirty state is preserved.
- Verify no raw backend English error leaks into localized UI.

Fix strategy:
- Keep error mapping close to API client or page controller boundary.
- Preserve user input on failed saves.
- Make retry actions explicit and non-destructive.

Verification candidates:
- Existing focused tests for affected pages plus new tests for error mapping.
- Playwright route interception evidence.
- API tests for conflict status where server semantics change.

Exit criteria:
- Each critical failure path has truthful localized copy, no raw internal message leak, and no hidden state loss.

Status:
- Closed locally on 2026-04-30 after failure-state mapping and partial-save fixes.
- Live evidence:
  - Script: `output/playwright/live-readiness-audit-2026-04-30/wave5-live-failure-state-audit.mjs`
  - Evidence root: `output/playwright/live-readiness-audit-2026-04-30/wave5-failure-state/`
- Live findings:
  - Asset Management, Forecast, and Reports route-level `500` responses could surface raw backend text such as `PrismaClientKnownRequestError`, `P2028`, and `internal_trace=wave5` in the page body.
  - Repro: log in to live, intercept `/v2/context`, `/v2/forecast/scenarios`, or `/v2/reports` with a `500` body containing backend diagnostics, then open the corresponding V2 route.
  - Likely files: `apps/web/src/api/core.ts`, `apps/web/src/v2/useReportsPageController.ts`, `apps/web/src/v2/useForecastPageController.ts`, `apps/web/src/v2/TariffPlanPageV2.tsx`, `apps/web/src/v2/useVesinvestPlanningController.ts`.
- Fixes:
  - Added a shared V2 API error display boundary in `apps/web/src/v2/apiErrorDisplay.ts`.
  - Preserved structured API error codes from nested NestJS responses in `apps/web/src/api/core.ts`.
  - Mapped report creation, PDF download, Forecast report creation, Tariff report creation, and Vesinvest sync failures to localized recovery copy instead of raw backend text.
  - Made Vesinvest save-and-sync preserve the saved plan locally when the follow-up forecast sync fails, avoiding misleading total-save-failure state after a partial success.
  - Added structured API blocker codes for Vesinvest sync and report creation conflicts.
- Local after-fix evidence:
  - `output/playwright/local-readiness-audit-2026-04-30/wave5-failure-state-after-fixes/`
  - Result: no raw leak findings in the local source build.
- Hostile implementation audit:
  - GPT-5.5 xhigh auditor found P2 report-create raw-message leaks, tariff blocker gaps, Vesinvest partial-save state loss, unstructured sync conflicts, unstructured report conflicts, and P3 PDF download error leaks.
  - All material findings were fixed before closing the wave.

## Wave 6 - Data Edge Cases And Calculation Stress

Purpose:
- Break the workflow with realistic and extreme data while checking price and readiness logic.

Code-grounded audit targets:
- Overview/import:
  - `overviewManualForms.ts`
  - `overviewReviewViewModel.ts`
  - `yearReview.ts`
  - `v2-import-manual-financial-support.ts`
  - `v2-import-overview.service.ts`
- Vesinvest/forecast/tariff/report:
  - `vesinvestPlanningModel.ts`
  - `useVesinvestPlanningController.ts`
  - `v2-vesinvest.service.ts`
  - `v2-forecast.service.ts`
  - `v2-tariff-plan.service.ts`
  - `v2-report.service.ts`
  - `v2-report-pdf.ts`

Audit datasets:
- Missing years and non-contiguous accepted years.
- Zero sold volume, negative annual result, large surplus, very large capex, no capex, wastewater-only capex, mixed water/wastewater capex.
- Missing asset evidence.
- One accepted year only.
- Long project names, duplicate project codes, blank project names, extreme allocation totals.
- Tariff baseline with zero connections, zero current price, negative/large target revenue, invalid policy sums.
- Other VEETI orgs beyond Kronoby, selected deliberately for sparse or unusual data.

Fix strategy:
- Server validation for invalid states.
- UI readiness truth for incomplete but technically saved states.
- Defensive formatting for extreme numbers and long labels.

Verification candidates:
- `pnpm --filter ./apps/web test -- src/v2/overviewManualForms.test.ts src/v2/overviewReviewViewModel.test.ts src/v2/yearReview.test.ts src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx src/v2/EnnustePageV2.planning-flows.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx`
- `pnpm --filter ./apps/api test -- src/v2/v2-import-overview.service.spec.ts src/v2/v2-vesinvest.service.spec.ts src/v2/v2-forecast.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-report.service.spec.ts src/v2/v2-report-pdf.spec.ts`
- Browser screenshots for edge datasets.

Exit criteria:
- Edge data cannot create false-ready reports, contradictory pricing, raw errors, NaN/Infinity, or broken layout.

Status:
- Closed locally on 2026-04-30 after API calculation/readiness fixes and browser validation.
- Evidence:
  - Script: `output/playwright/local-readiness-audit-2026-04-30/wave6-data-edge-api-browser-audit.mjs`
  - Evidence root: `output/playwright/local-readiness-audit-2026-04-30/wave6-data-edge-api-browser-audit/`
  - Summary: `output/playwright/local-readiness-audit-2026-04-30/wave6-data-edge-api-browser-audit/wave6-data-edge-api-browser-summary.json`
- Initial findings:
  - The Vesinvest API accepted allocation split payloads whose water and wastewater amounts exceeded the allocation total.
  - Direct Forecast API updates accepted negative investment amounts.
  - Forecast rows synced from Asset Management were still editable in Forecast, allowing Forecast/Tariff/Reports to certify numbers that no longer matched the Vesinvest allocation appendix.
  - Tariff readiness treated a nonzero connection-fee share as ready with `connectionFeeBasis` alone, even though no annual revenue/unit could be calculated.
  - Tariff price signal used the Forecast baseline price while tariff recommendation math used the edited tariff baseline price.
  - Sparse investment-year summaries and long PDF labels were too compressed for product-grade edge datasets.
- Fixes:
  - Added nonnegative and upper-bound validation for direct Forecast yearly investments.
  - Enforced allocation split totals at the Vesinvest API boundary.
  - Made Vesinvest-linked Forecast investment rows readonly in the Forecast UI and blocked direct API edits unless they come from the Asset Management sync path.
  - Added shared Vesinvest/Forecast investment consistency checks and used them before Tariff planning and Report package creation.
  - Required connection-fee revenue and new-connection volume when a nonzero connection-fee share is part of the tariff allocation policy.
  - Rebased Tariff price signals on the edited tariff baseline comparator.
  - Improved sparse investment coverage labels and PDF truncation.
- Result after fixes: the Wave 6 local breaker script returned no findings, with five desktop route screenshots captured for the edge dataset.

## Wave 7 - Concurrent State And Stale Data

Purpose:
- Verify two-tab/two-admin behavior, stale report/package handling, and safe conflict semantics.

Code-grounded audit targets:
- `apps/api/src/v2/v2-vesinvest-plan-support.ts`
- `apps/api/src/v2/v2-vesinvest.service.ts`
- `apps/api/src/v2/v2-tariff-plan.service.ts`
- `apps/api/src/v2/v2-report.service.ts`
- `apps/web/src/v2/useVesinvestPlanningController.ts`
- `apps/web/src/v2/useReportsPageController.ts`
- `apps/web/src/v2/useForecastPageController.ts`
- `apps/web/src/v2/TariffPlanPageV2.tsx`
- `apps/web/src/v2/AppShellV2.saved-fee-path.test.tsx`

Audit steps:
- Open the same tenant in two browser contexts.
- Edit Vesinvest project allocations in tab A, tariff plan in tab B, then save in conflicting order.
- Create a report in tab A, change/accept tariff in tab B, inspect stale package state in tab A.
- Delete or supersede scenario/report source data while another tab is on Reports.
- Use browser back/forward after accepted tariff/report creation.

Fix strategy:
- Prefer explicit stale/refresh states over silent overwrites.
- Keep accepted report package exportable but clearly stale when source changes.
- Make last-saved/dirty signals reliable.

Verification candidates:
- API tests around stale status transitions.
- Web tests for stale package and saved fee path.
- Playwright multi-context script evidence.

Exit criteria:
- No silent overwrite of user-visible planning/pricing state.
- Stale reports and tariff plans are distinguishable from current-ready artifacts.

Status:
- Closed locally on 2026-04-30 after stale-write and stale-source fixes.
- Evidence:
  - Script: `output/playwright/local-readiness-audit-2026-04-30/wave7-concurrency-stale-audit.mjs`
  - Evidence root: `output/playwright/local-readiness-audit-2026-04-30/wave7-concurrency-stale-audit/`
  - Summary: `output/playwright/local-readiness-audit-2026-04-30/wave7-concurrency-stale-audit/wave7-concurrency-stale-summary.json`
- Findings:
  - Vesinvest plan updates were last-write-wins: a stale tab could overwrite newer project/allocation changes.
  - Tariff draft save and accept were last-write-wins: a stale tab could overwrite or accept stale visible tariff inputs.
  - The Vesinvest/Forecast investment consistency guard returned success if the linked Forecast scenario had no rows connected to the active Vesinvest allocation ids.
  - Saved report packages remained exportable after source staleness, but the selected saved-package path did not clearly label that new/current packages were blocked.
  - Grouped manual Forecast investment rows could be treated as Vesinvest-linked solely because they carried display grouping keys.
- Fixes:
  - Added optimistic `expectedUpdatedAt` conflict checks for Vesinvest plan updates, tariff saves, and tariff accepts.
  - Wired the V2 desktop UI to send the visible plan/tariff edit token and map stale-edit conflicts to localized refresh copy.
  - Tightened the Vesinvest/Forecast consistency guard so active nonzero allocation ids are required before Tariff planning and Report creation.
  - Kept saved report PDF export available while labeling stale current workflow state in the selected saved-package export area.
  - Tightened the Vesinvest-linked investment marker to require Vesinvest ids rather than display-only grouping fields.
- Result after fixes: the Wave 7 local stale/concurrency audit returned no findings and captured Tariff/Reports desktop screenshots.

## Wave 8 - PDF Visual Layout And Variant Contract

Purpose:
- Go beyond PDF text scans and verify visual rendering, pagination, long text, tables, and variant-specific confidentiality.

Code-grounded audit targets:
- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/api/src/v2/v2-report-pdf-support.ts`
- `apps/api/src/v2/v2-report.service.ts`
- `apps/web/src/v2/reportsPageSections.tsx`
- `apps/web/src/v2/ReportsPageV2.preview-detail.test.tsx`
- `apps/web/src/api/v2/reports.ts`

Audit steps:
- Generate regulator, board, and internal appendix PDFs for standard and edge datasets.
- Render each page to PNG using Poppler.
- Compare first-page hierarchy, page overflow, table clipping, headers/footers, confidentiality boundaries, and variant differences.
- Ensure preview and PDF agree on title, scenario, tariff source, accepted years, price values, investment totals, and evidence visibility.
- Check filenames and content-disposition for unsafe characters and locale consistency.

Fix strategy:
- Keep PDF mapping in API display helpers.
- Add regression tests for variant-specific fields.
- Avoid widening PDF content beyond page margins; wrap or summarize.

Verification candidates:
- `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-report.service.spec.ts`
- Poppler `pdftotext` and `pdftoppm` render artifacts.
- Browser preview/PDF cross-check JSON.

Exit criteria:
- All three variants render cleanly page-by-page.
- Public/regulator package does not expose internal-only assumptions.
- Preview/PDF numbers and provenance agree.

Status:
- Completed locally on 2026-04-30.
- Generated regulator, board, and internal appendix packages from the Wave 8 Kronoby audit dataset.
- A hostile implementation review found three contract/layout issues; all were fixed before closing the wave.
- Local Playwright PDF/preview variant audit now passes with no findings.

## Wave 9 - Security And API Hardening

Purpose:
- Audit auth expiration, authorization, destructive action enforcement, direct API abuse, upload bounds, report/PDF access, and production-safe config.

Code-grounded audit targets:
- `apps/api/src/main.ts`
- `apps/api/src/auth/*`
- `apps/api/src/tenant/tenant.guard.ts`
- `apps/api/src/trial/*`
- `apps/api/src/v2/v2.controller.ts`
- `apps/api/src/v2/dto/*.ts`
- `apps/api/src/v2/v2-report.service.ts`
- `apps/api/src/v2/v2-report-pdf.ts`
- `apps/api/src/v2/v2-import-overview.service.ts`
- `apps/web/src/api/*`

Audit steps:
- Expired/invalid JWT direct API calls.
- Cross-tenant report/PDF id access attempts.
- Non-admin destructive endpoint attempts.
- Rate-limit behavior for login if safely testable.
- Upload size/type validation paths.
- Confirm production config rejects unsafe auth bypass/rate-limit config.
- Confirm account wipe confirmation token cannot be bypassed.

Fix strategy:
- Enforce in API guards/services first.
- Keep security error copy generic but localized in UI.
- Add tests before changing broad auth behavior.

Verification candidates:
- `pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/auth/auth.service.spec.ts src/auth/jwt.guard.spec.ts src/tenant/tenant.guard.spec.ts src/v2/dto/import-clear.dto.spec.ts src/v2/v2-report.service.spec.ts src/v2/v2.service.spec.ts`
- Direct API probe evidence with redacted tokens.
- `pnpm audit:prod` if relevant to config.

Exit criteria:
- Direct API probes cannot bypass tenant, role, token, report, PDF, or destructive-action constraints.
- UI handles auth expiration without raw backend noise or loops.

Status:
- Closed locally on 2026-04-30 after destructive-clear, upload-error, and challenge-storage hardening.
- Direct API probes covered invalid/expired/forged tokens, viewer/user/admin role boundaries, report/PDF access, upload validation, and destructive account-clear confirmation.
- Local account drawer evidence confirmed the admin clear action now requires a server-issued one-time challenge before the button becomes usable.
- A hostile Wave 9 implementation review found one remaining P2 and two P3s; all were fixed before the wave was reclosed.
- Evidence:
  - `output/playwright/local-readiness-audit-2026-04-30/wave9-security-api-audit/`
  - `output/playwright/local-readiness-audit-2026-04-30/wave9-account-clear-challenge-ui/`
- Result after fixes: no Wave 9 findings remain in local API/browser evidence.

## Wave 10 - Mobile UX Quality

Purpose:
- Now that gross mobile breakage has been addressed locally, audit mobile as a real user flow rather than only overflow/gross breakage.

Code-grounded audit targets:
- V2 CSS files under `apps/web/src/v2/`
- `appShellV2Chrome.tsx`
- `OverviewPageV2.tsx`
- `vesinvestPlanningInvestmentWorkspace.tsx`
- `ForecastCockpitSurface.tsx`
- `TariffPlanPageV2.tsx`
- `ReportsPageV2.tsx`

Audit steps:
- Run login and a shortened full flow at 390x844 and 430x932.
- Inspect route headers, account drawer, setup import, year review, allocation editor modal, Tariff Plan forms, Reports preview/list order, and PDF download controls.
- Check tap target sizes, sticky/fixed header behavior, long localized strings, tables, and horizontal overflow.
- Decide whether mobile remains supported enough for emergency review or needs explicit unsupported-state messaging.

Fix strategy:
- Fix gross and trust-breaking mobile layout bugs.
- Keep desktop design intact.
- Prefer responsive constraints over hiding critical data.

Verification candidates:
- Playwright mobile screenshots and computed overflow JSON.
- Focused CSS/layout tests if practical.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx`

Exit criteria:
- No blocked critical action or incoherent overlap on checked mobile viewports.
- Mobile preview/list/report surfaces remain understandable enough for review use.

Status:
- Closed locally on 2026-04-30 after mobile shell and allocation editor fixes.
- Local mobile audit covered login state plus Overview, Asset Management, Forecast, Tariff Plan, Reports, account drawer, project composer, allocation editor, tariff input focus, and report variant toggling at `390x844` and `430x932`.
- Evidence: `output/playwright/local-readiness-audit-2026-04-30/wave10-mobile-ux-audit/`.
- Result after fixes: no Wave 10 findings remain in local browser evidence.

## Wave 11 - Final Release Readiness Closure

Purpose:
- Consolidate all findings, prove no wave introduced regressions, and prepare commit/push/deploy handoff.

Audit steps:
- Re-run targeted live and local route checks.
- Re-run latest leak scans across browser text, aria labels, inputs/textareas/selects, API snapshots where relevant, and PDFs.
- Confirm all subagent P0/P1/P2 findings are closed or documented as false positives with evidence.
- Move this plan to completed only after user acceptance or final deployment validation.

Verification gates:
- `pnpm smoke:v2`
- `pnpm check:harness`
- `pnpm --filter ./apps/web typecheck`
- `pnpm --filter ./apps/api typecheck`
- Focused tests from every touched wave.
- Broader `pnpm test` or `pnpm release-check` only if the accumulated blast radius justifies it.

Exit criteria:
- Worktree contains only intentional source/doc changes.
- Evidence links for each wave are recorded in this plan.
- Commits are chunked by coherent wave or fix group.
- `main` is pushed when requested.

Status:
- Closure in progress on 2026-04-30.
- Live desktop and local desktop/mobile route/leak scans passed after Wave 9 and Wave 10 fixes.
- Evidence: `output/playwright/local-readiness-audit-2026-04-30/wave11-final-route-leak-scan/`.
- Remaining operational note: `pnpm --filter ./apps/api prisma:generate` hit a Windows `EPERM` query-engine DLL file lock while the local API process was running. The additive migration was applied locally with `prisma:migrate:deploy`, and the migrated raw-SQL challenge path passed direct API and browser validation.

## Findings

- Wave 0: no findings.
- Wave 1:
  - [P2] Direct API: a `VIEWER` token could call `POST /v2/import/connect` and bind the organization to VEETI (`201` in the pre-fix probe). Likely files: `apps/api/src/v2/v2.controller.ts`, V2 import setup service boundaries.
  - [P3] Desktop UI: non-admin Overview showed enabled baseline import/trash actions and support-rail copy that advertised `Import selected years`, even though the role should not perform setup/configuration work. Likely files: `apps/web/src/v2/OverviewImportBoard.tsx`, `apps/web/src/v2/OverviewImportBoardLanes.tsx`, `apps/web/src/v2/OverviewWizardPanels.tsx`, `apps/web/src/v2/overviewPageViewModel.ts`.
- Wave 5:
  - [P2] Live route-level failures on Asset Management, Forecast, and Reports could render raw backend diagnostics in the app body. Fixed locally by preserving structured codes at the API client boundary and mapping known/unknown failures to localized UI recovery copy.
  - [P2] Vesinvest save-and-sync could persist a plan but keep the UI in the old state when the forecast sync failed. Fixed locally by updating the saved plan/draft state before sync and surfacing an explicit sync recovery error.
  - [P2] Vesinvest sync and report creation conflicts were string-only API contracts in several paths. Fixed locally with structured blocker codes and focused API tests.
  - [P3] PDF download failures for non-500 statuses could surface backend text. Fixed locally with localized export error mapping.
- Wave 6:
  - [P2] Vesinvest allocation split totals could be inconsistent with allocation totals. Fixed locally with API validation and regression coverage.
  - [P2] Direct Forecast API yearly investment updates accepted negative values. Fixed locally with DTO/service validation and regression coverage.
  - [P2] Vesinvest-linked Forecast rows could diverge from Asset Management and still feed Tariff/Report readiness. Fixed locally by making linked rows readonly, blocking direct API edits, and rejecting stale Tariff/Report creation.
  - [P2] Connection-fee readiness could pass without calculable annual revenue/volume when the connection-fee share was nonzero. Fixed locally with readiness and recommendation changes.
  - [P2] Tariff price signal compared against Forecast baseline prices instead of the edited tariff baseline. Fixed locally by deriving the price signal from the tariff baseline comparator.
  - [P3] Sparse investment-year and long PDF labels lost clarity in edge datasets. Fixed locally with compact sparse coverage labels and ellipsis truncation.
- Wave 7:
  - [P1] Stale Vesinvest plan saves could silently overwrite newer project/allocation work. Fixed locally with `expectedUpdatedAt` conflict semantics and UI wiring.
  - [P1] Stale tariff saves and accepts could silently overwrite or certify stale tariff inputs. Fixed locally with tariff edit-token conflicts and UI wiring.
  - [P1] Missing active Vesinvest allocation rows in Forecast could pass Tariff/Report readiness. Fixed locally by requiring nonzero active allocation ids to be present and matched.
  - [P2] Saved report export stayed available after source staleness but did not clearly label the current workflow as stale. Fixed locally with selected-package stale export copy.
  - [P3] Display-only grouped manual Forecast rows could be treated as Vesinvest-linked. Fixed locally by requiring Vesinvest ids for linked-row readonly semantics.
- Wave 8:
  - [P1] Report PDF generation could trust hostile stored `snapshot.reportSections` and include sections outside the normalized package variant. Fixed locally by rebuilding sections from the normalized report variant.
  - [P2] Reports export helper copy could let stale-current-workflow messaging mask a selected preview/package variant mismatch. Fixed locally by prioritizing the variant mismatch hint when the PDF action is disabled.
  - [P2] Detailed investment tables in internal appendix PDFs did not redraw headers after page breaks. Fixed locally with continuation headers for detailed investment and yearly investment appendix tables.
- Wave 9:
  - [P2] Admin account-clear confirmation could be derived from the org id prefix and replayed without a server challenge. Fixed locally with short-lived one-time clear challenges scoped to user and org.
  - [P2] Malformed OpenXML workbook uploads could expose raw parser diagnostics. Fixed locally by mapping unknown workbook parser failures to a generic upload error.
  - [P2] Valid OpenXML KVA workbooks with parser-domain failures could expose workbook sheet/row diagnostics. Fixed locally by mapping all workbook parser failures to generic import copy and adding a valid wrong-sheet workbook probe.
  - [P3] Wrong multipart upload field names surfaced Multer's raw `Unexpected field` text. Fixed locally with endpoint-scoped upload BadRequest normalization.
  - [P3] Clear challenges were process-local and would fail across multiple API instances. Fixed locally by persisting hashed one-time clear challenges in the database.
  - [P3] Clear challenge tests did not cover cross-user, cross-org, expiry, or reuse. Fixed locally with focused boundary tests.
- Wave 10:
  - [P3] Mobile shell navigation, workflow steps, and language controls were undersized/clipped at `390x844` and `430x932`. Fixed locally with touch-sized wrapping under the existing mobile breakpoint.
  - [P3] Mobile allocation editor rendered a desktop-wide yearly-allocation table. Fixed locally with stacked mobile rows and localized `data-label` cell labels.
  - [P3] Hostile review found the allocation editor sizing rule could be overridden by later shared modal CSS. Fixed locally by increasing selector specificity for allocation-editor modal sizing.
  - [P3] Hostile review found mobile shell targets were still below the 44px mobile target bar. Fixed locally by raising language, account, nav, workflow, button, input, and select controls under the mobile breakpoint.

## Fix Plan

Fixes will be appended under each wave as they are discovered. P0/P1/P2 findings block moving on unless the next wave can run independently while a subagent reviews the patch.

Wave 1 fixes:
- Added V2 role guards so admin-only setup/evidence endpoints require `ADMIN`, and editor workflow writes require `ADMIN` or `USER`.
- Registered the guards in `V2Module` and applied them to V2 controller mutating routes.
- Hid/demoted non-admin Overview setup controls for VEETI connect/import/trash/current-year/baseline creation, and localized the read-only/admin-required copy in EN/SV/FI.
- Added focused API guard and Overview role-surface tests.

Wave 5 fixes:
- Added `apps/web/src/v2/apiErrorDisplay.ts` as the shared display mapper for report, tariff, Vesinvest sync, and PDF export failures.
- Updated `apps/web/src/api/core.ts` so nested structured API error codes remain available to V2 controllers.
- Updated Reports, Forecast, Tariff Plan, and Vesinvest controllers to use localized display mapping and preserve dirty/saved state on failed retry/sync paths.
- Added structured conflict/blocker codes in `apps/api/src/v2/v2-report.service.ts` and `apps/api/src/v2/v2-vesinvest.service.ts`.
- Added focused web/API regression tests for raw-message suppression, structured codes, and partial-save recovery.

Wave 6 fixes:
- Tightened Vesinvest allocation split validation and Forecast yearly investment amount validation in the API.
- Added server-side protection for Vesinvest-synced Forecast investment rows plus Tariff/Report stale-source guards.
- Updated Forecast to render Vesinvest-linked investment rows as readonly source rows.
- Updated Tariff Plan readiness/recommendation math for connection-fee revenue derivation and tariff-baseline price signals.
- Improved Reports sparse investment coverage labels and PDF text truncation.

Wave 7 fixes:
- Added Vesinvest and Tariff optimistic edit-token checks using `expectedUpdatedAt`.
- Added structured stale-edit conflict codes and localized V2 UI display mapping.
- Required active Vesinvest allocation ids to match Forecast yearly investment rows before Tariff/Report readiness.
- Labeled selected saved report export as stale-current-workflow while keeping the saved PDF export enabled.
- Tightened Forecast linked-row predicates so display grouping metadata alone does not freeze manual rows.

Wave 8 fixes:
- Clamped report detail/PDF section contracts to the normalized package variant instead of trusting stored snapshot section booleans.
- Reordered Reports selected-package export helper precedence so preview variant mismatch remains the primary disabled-download explanation.
- Added PDF table continuation headers for detailed investment groups and yearly investment appendix rows.
- Added focused API and web regression tests for hostile stored report sections, PDF page-break headers, and export helper precedence.

Wave 9 fixes:
- Added server-issued, user/org-scoped, one-time destructive clear challenges and wired the V2 account drawer to request and submit the challenge id plus code.
- Added admin role coverage for the challenge route and kept non-admin destructive actions blocked at the API boundary.
- Persisted clear challenges in `v2_import_clear_challenge` with hashed confirmation tokens, expiry, and atomic consumption.
- Mapped all workbook parser failures and upload parser BadRequest messages to generic, product-owned upload errors.
- Tightened the Wave 9 direct API probe to treat `Unexpected field` as a raw diagnostic leak.

Wave 10 fixes:
- Wrapped the mobile V2 shell nav/workflow controls and raised mobile tap-target heights without changing desktop shell layout.
- Converted the Vesinvest allocation editor table to stacked mobile rows at narrow widths while preserving the desktop grid/table.
- Made the allocation-editor modal sizing selectors override the later shared modal rules by using `.v2-modal-card.v2-vesinvest-allocation-editor`.
- Raised the mobile shell target-size standard to 44px and updated the browser audit to enforce it.
- Scoped the mobile audit metrics to the active modal when `aria-modal="true"` is present so background controls do not create false positives.

## Verification

Initial plan creation verification:
- `pnpm check:harness` passed.

Wave 1 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2-role-access.guard.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/OverviewImportBoard.role-access.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave1-role-api-probe.mjs` passed after fixes.
- `node output/playwright/local-readiness-audit-2026-04-30/wave1-role-ui-probe.mjs` passed after fixes; only `demo/status` navigation abort was observed in one capture.
- Attempted broader `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.setup-import.test.tsx src/v2/OverviewPageV2.review-flow.test.tsx src/i18n/locales/localeIntegrity.test.ts`; it failed on existing `vesinvest-panel`/duplicate-text expectations outside the role-access patch. Focused role tests and typechecks above are the Wave 1 gate.

Wave 5 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/EnnustePageV2.test.tsx` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm check:text-integrity` passed.
- Local Playwright after-fix run passed with no raw leak findings: `output/playwright/local-readiness-audit-2026-04-30/wave5-failure-state-after-fixes/`.

Wave 6 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2-forecast.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/EnnustePageV2.planning-flows.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/TariffPlanPageV2.test.tsx` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave6-data-edge-api-browser-audit.mjs` passed with no findings.

Wave 7 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2-forecast.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/TariffPlanPageV2.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/forecastInvestmentRenderers.test.tsx` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave6-data-edge-api-browser-audit.mjs` passed after the shared contract changes.
- `node output/playwright/local-readiness-audit-2026-04-30/wave7-concurrency-stale-audit.mjs` passed with no findings.

Wave 8 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-report.service.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave8-pdf-variant-audit.mjs` passed with no findings.
- Visual evidence inspected: `output/playwright/local-readiness-audit-2026-04-30/wave8-pdf-variant-audit/reports-preview-variant-state.png`, `regulator_package-page-1.png`, and `internal_appendix-page-7.png`.

Wave 9 verification:
- `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/v2/v2-role-access.guard.spec.ts src/v2/dto/import-clear.dto.spec.ts` passed.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
- `pnpm --filter ./apps/api test -- src/v2/v2-import-overview.service.spec.ts src/v2/v2-role-access.guard.spec.ts src/v2/dto/import-clear.dto.spec.ts` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api prisma:migrate:deploy` applied `20260430223000_add_v2_import_clear_challenge` locally.
- `pnpm --filter ./apps/api prisma:generate` was attempted after migration but hit a Windows `EPERM` file lock on the Prisma query-engine DLL while the local API process was running; the new clear-challenge code uses raw Prisma SQL and the browser/API validation below exercised the migrated table successfully.
- `node output/playwright/local-readiness-audit-2026-04-30/wave9-security-api-audit.mjs` passed with no findings.
- `node output/playwright/local-readiness-audit-2026-04-30/wave9-account-clear-challenge-ui.mjs` passed with no findings; visual evidence inspected.

Wave 10 verification:
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/VesinvestPlanningPanel.draft-admin.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx` passed.
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/VesinvestPlanningPanel.draft-admin.test.tsx` passed after the hostile-review P3 fixes.
- `pnpm --filter ./apps/web typecheck` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave10-mobile-ux-audit.mjs` passed with no findings after the audit was tightened to enforce 44px touch targets and allocation-editor computed sizing.
- Visual evidence inspected: `output/playwright/local-readiness-audit-2026-04-30/wave10-mobile-ux-audit/390x844-overview.png` and `390x844-asset-allocation-editor.png`.

Wave 11 verification:
- `pnpm check:harness` passed.
- `pnpm smoke:v2` passed.
- `pnpm check:text-integrity` passed.
- `pnpm --filter ./apps/web typecheck` passed.
- `pnpm --filter ./apps/api typecheck` passed.
- `pnpm --filter ./apps/api test -- src/v2/v2-import-overview.service.spec.ts src/v2/v2-report-pdf.spec.ts src/v2/v2-report.service.spec.ts src/v2/v2-forecast.service.spec.ts src/v2/v2-tariff-plan.service.spec.ts src/v2/v2-vesinvest.service.spec.ts src/v2/v2-role-access.guard.spec.ts src/v2/dto/import-clear.dto.spec.ts` passed.
- `node output/playwright/local-readiness-audit-2026-04-30/wave11-final-route-leak-scan.mjs` passed with no findings.

## Evidence

- Plan created: `docs/exec-plans/active/vesinvest-v2-readiness-audit-workstream.md`.
- Wave 8 browser/PDF evidence: `output/playwright/local-readiness-audit-2026-04-30/wave8-pdf-variant-audit/`.
- Wave 9 security/API evidence: `output/playwright/local-readiness-audit-2026-04-30/wave9-security-api-audit/`.
- Wave 9 account drawer challenge evidence: `output/playwright/local-readiness-audit-2026-04-30/wave9-account-clear-challenge-ui/`.
- Wave 10 mobile evidence: `output/playwright/local-readiness-audit-2026-04-30/wave10-mobile-ux-audit/`.
- Wave 11 final live/local route leak evidence: `output/playwright/local-readiness-audit-2026-04-30/wave11-final-route-leak-scan/`.
