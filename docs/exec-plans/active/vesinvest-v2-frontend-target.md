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

- Started the live UI completion fix pass after deployed E2E validation on `https://vesipolku.jrwl.io`.
- Live audit evidence folder: `output/playwright/live-vesipolku-audit-2026-04-30/`.
- This pass is desktop-first; mobile polish remains out of scope except for gross breakage.
- Findings being closed in this pass:
  - Desktop shell/header overlap across all V2 routes.
  - Asset Management allocation inputs clipping large yearly investment values.
  - Reports ready/no-package state placing package creation in the side rail while the main surface says to select a report.
  - Tariff Plan leaking raw connection-fee-basis enum values such as `per_connection`.
  - Forecast showing a prominent disabled report action before tariff acceptance.
  - Reports list/preview duplicating long generated report titles and defaulting to internal appendix when regulator package exists.
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
- Live deployment hostile audit follow-up:
  - Target: deployed `vesipolku.jrwl.io` and current `codex/frontend` tree after merge/push.
  - Scope remains desktop-first; mobile polish is still out of scope.
  - Findings to close before commit:
    - Asset Management must not imply evidence readiness when only the baseline is verified.
    - Asset Management handoff must sync to Forecast, not route directly to Tariff Plan.
    - Reports must allow creating the first ready package from the preview/list surface.
    - Tariff Plan accepted state must not keep Save/Accept actions live when nothing changed.
    - Tariff Plan must explain annual-result price versus cumulative cash floor when they diverge.
    - Login/auth and V2 Swedish/Finnish paths must avoid raw English fallback leaks.
  - Final mechanical gates after hostile-audit fixes:
    - `pnpm smoke:v2` passed.
    - `pnpm check:harness` passed.
    - `git diff --check` passed with CRLF normalization warnings only.
  - Follow-up fixes after independent 5.5 xhigh audit:
    - Reports first-package creation now requires a saved fee-path plan, saved scenario id, and `verified` pricing status before creating/exporting a package.
    - Login no longer renders raw backend messages for credential or generic API failures.
    - Reports aggregate smoke coverage now asserts generic evidence language and current package-export guard copy.
- Follow-up verification:
  - `pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/v2/ReportsPageV2.routing-empty-state.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/TariffPlanPageV2.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
  - `pnpm --filter ./apps/web test -- src/v2/VesinvestPlanningPanel.test.tsx src/v2/VesinvestPlanningPanel.evidence-workflow.test.tsx src/v2/VesinvestPlanningPanel.report-handoff.test.tsx src/v2/AppShellV2.bootstrap-routing.locks.test.tsx` passed.
  - `pnpm --filter ./apps/web exec tsc --noEmit --pretty false` passed.
  - `pnpm smoke:v2` passed.
  - Final independent 5.5 xhigh re-audit returned no P0/P1/P2 findings.
- Live UI completion follow-up implemented after the latest deployed audit:
  - Shell header now uses stable two-row desktop structure; workflow strip is quiet step names only while tab statuses remain visible in the main nav.
  - Asset Management yearly allocations now use a focused modal with wide right-aligned numeric inputs and a funded-years strip so nonzero totals below the fold are explained.
  - Reports ready/no-package state now uses the main preview surface to create the selected package and does not style blocked navigation actions as package creation.
  - Tariff Plan localizes known connection-fee basis codes such as `per_connection` without changing the stored string contract.
  - Forecast only shows `Create report` as a primary action when report creation is genuinely available; blocked states route to Forecast, Tariff Plan, or Asset Management as appropriate.
  - Compact report display titles now use package/scenario/date while preserving full generated titles in metadata/export context.
  - Final GPT-5.5 xhigh hostile audit found no P0/P1 findings; its three P3 notes were either fixed in this pass or left as accepted non-blocking shell-density polish.
  - Follow-up GPT-5.5 xhigh audit found one P2 accessibility/localization leak: workflow-step `aria-label` used the English phrase `workflow step`. The label is now localized for EN/SV/FI.
  - Browser artifacts for this pass are in `output/playwright/local-live-ui-completion-2026-04-30/`.
  - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/AppShellV2.bootstrap-routing.locks.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/ReportsPageV2.export-readiness.test.tsx src/v2/ReportsPageV2.routing-empty-state.test.tsx src/v2/EnnustePageV2.cockpit-layout.test.tsx src/v2/EnnustePageV2.readiness-handoff.test.tsx src/v2/EnnustePageV2.planning-flows.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/TariffPlanPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed.
  - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/AppShellV2.bootstrap-routing.locks.test.tsx src/i18n/locales/localeIntegrity.test.ts` passed after the aria-label localization fix.
  - `pnpm --filter ./apps/web typecheck` passed.
  - Browser aria check on Swedish `/forecast` passed; workflow labels are localized as `Baslinje i arbetsflödet: Godkänd`, etc., with no English `workflow step`.
  - `pnpm smoke:v2` passed.
  - `pnpm check:harness` passed.
  - `git diff --check` passed with CRLF normalization warnings only.
- Fresh hostile desktop audit on live `vesipolku.jrwl.io` after branch `main` at `a41804d8`:
  - Evidence folder: `output/playwright/fresh-vesinvest-v2-hostile-audit-2026-04-30/`.
  - No P0/P1 findings. Desktop shell/header stayed clear at 1360px and 1280px; route/bootstrap truth, report creation/export semantics, allocation editor sizing, and Forecast/Tariff/Reports price consistency held.
  - P2 finding fixed: live validation/demo language and one raw project subtype leaked into Asset Management, Tariff Plan, Reports preview/PDF surfaces. Source now exact-match sanitizes those placeholders and transient bad-encoding stale payloads in web display and PDF rendering.
  - Live seed data was cleaned and all three current package variants were recreated. Fresh `fresh-live-pdf-leak-scan.json` shows latest regulator, board, and internal package PDFs have zero leak hits.
  - Focused gates passed:
    - `pnpm --filter ./apps/web test -- src/v2/validationDisplayText.test.ts src/v2/VesinvestPlanningPanel.test.tsx src/v2/TariffPlanPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts`
    - `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts`
    - `pnpm --filter ./apps/web typecheck`
    - `pnpm --filter ./apps/api typecheck`
- Live resweep and local source validation follow-up:
  - Live evidence folder: `output/playwright/live-hostile-resweep-2026-04-30/`.
  - Local source evidence folder: `output/playwright/local-dev-resweep-2026-04-30/`.
  - Live resweep confirmed the remaining deployed-user P2 is limited to older saved internal appendix rows created before cleanup; current/latest packages remain clean, and source fixes now cover the stale snapshot display/PDF paths after deployment.
  - GPT-5.5 xhigh subagent reviews found and closed three implementation P2s:
    - Forecast sync could copy raw validation project names/notes into yearly investments when a user synced without editing sanitized fields.
    - Forecast annual/full-table rows still rendered raw stale notes.
    - Asset Management evidence tab still rendered raw stale evidence notes.
  - Final GPT-5.5 xhigh implementation re-audit found no remaining P0/P1/P2.
  - Additional gates passed:
    - `pnpm --filter ./apps/web test -- src/v2/forecastInvestmentRenderers.test.tsx src/v2/validationDisplayText.test.ts src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/TariffPlanPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts`
    - `pnpm --filter ./apps/api test -- src/v2/v2-vesinvest.service.spec.ts src/v2/v2-report-pdf.spec.ts`
    - `pnpm --filter ./apps/web typecheck`
    - `pnpm --filter ./apps/api typecheck`
    - `pnpm smoke:v2`
    - `pnpm check:harness`
    - `git diff --check` passed with CRLF normalization warnings only.
- Desktop P3 polish closure sweep:
  - Live sweep on `vesipolku.jrwl.io` at 1280px/1360px found remaining P3 density issues only: compressed shell/nav labels at 1280px, clipped Asset Management project register/detail fields, and a crowded Reports saved-package rail when a package is selected.
  - Source fixes keep the desktop shell within the 1280px header, compact selected Reports rows without a horizontal rail scrollbar, make the project register fit the card with wider editable project fields, and keep project detail notes at full usable width.
  - Follow-up GPT-5.5 xhigh implementation audit found two P3s; both were fixed:
    - PDF internal evidence appendix now localizes asset evidence and tariff evidence with separate context so asset rows do not say `active tariff plan`.
    - Project register columns now use card-relative widths and wrapping actions instead of a 1344px fixed-width table.
  - Local Playwright evidence after source fixes is in `output/playwright/local-dev-p3-polish-2026-04-30/`; `p3-polish-browser-checks.json` confirms no Reports rail horizontal overflow at 1280px/1360px, no project-register horizontal overflow at 1280px, and 912px project-note inputs.
  - Final P3 closure gates passed:
    - `pnpm --filter ./apps/web test -- src/v2/AppShellV2.navigation-drawer.test.tsx src/v2/ReportsPageV2.preview-detail.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/v2/forecastInvestmentRenderers.test.tsx src/v2/validationDisplayText.test.ts src/i18n/locales/localeIntegrity.test.ts`
    - `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts src/v2/v2-vesinvest.service.spec.ts`
    - `pnpm --filter ./apps/web typecheck`
    - `pnpm --filter ./apps/api typecheck`
    - `pnpm smoke:v2`
    - `pnpm check:harness`
    - `pnpm check:text-integrity`
    - `git diff --check` passed with CRLF normalization warnings only.
- Fresh post-deploy live resweep after the new production deploy:
  - Evidence folder: `output/playwright/live-prod-resweep-2026-04-30/`.
  - Live route walk covered login plus Overview, Asset Management, Forecast, Tariff Plan, and Reports at 1360px, with additional 1280px checks on Overview, Asset Management, and Reports.
  - No P0/P1/P2 findings. Route/bootstrap truth, report/export semantics, Forecast/Tariff/Reports price consistency, asset readiness language, localized connection-fee basis display, and raw key/demo-language scans held on live.
  - P3 finding fixed in source: Overview accepted-year accounting labels crowded their compact cards at 1280px because uppercase letter-spaced labels exceeded the tile width. Compact Overview labels now use sentence case, normal letter spacing, and safe wrapping in the dense accepted-year preview.
  - `fresh-live-resweep-summary.json` records zero console errors and zero leak hits for both live and local-after-fix route scans; local 1280px label metrics confirm no compact-label spill after the source fix.
  - Focused gates passed:
    - `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.workspace-handoff.details.test.tsx src/v2/overviewWorkflow.test.ts src/i18n/locales/localeIntegrity.test.ts`
    - `pnpm --filter ./apps/web typecheck`
    - `git diff --check`
- Full live E2E P3/polish audit with tenant wipe and Kronoby import:
  - Evidence folder: `output/playwright/live-full-e2e-p3-audit-2026-04-30/`.
  - Live flow wiped the tenant from `Konto`, imported Kronoby VEETI org `1535`, selected/imported 2025-2022, filled plausible economic rows, created a baseline, added a 2026-2030 water-network rehabilitation investment program, synced Forecast, filled/accepted Tariff Plan, created a report package, downloaded/rendered the PDF, and rechecked the five V2 tabs at 1280px and 1360px.
  - P2 workflow-truth finding fixed: using `Komplettera manuellt` before importing selected years could open review with `0 år / Inga valda år` while the setup summary still showed four selected years. Setup-board inline completion now imports the selected years before opening the manual editor.
  - P2 numeric-trust finding fixed: sold-water comparisons could read only the first imported `volume_vesi` row in review/QDIS paths, while other Forecast/Tariff surfaces used summed effective data. Overview manual forms, review rows, QDIS comparisons, and workspace handoff now aggregate all matching volume rows.
  - P2 localization/raw-copy findings fixed: known Tariff Plan backend conflict codes no longer leak raw English messages, Asset Management law summary no longer shows raw class labels such as `Sanering / vattennatverk`, and generated PDFs no longer render smoothing status as raw `ok`.
  - P3 polish fixes: V2 form controls inherit the application typeface, the account drawer aligns compactly, and the close action uses a proper close glyph instead of a literal `x`.
  - Browser validation after source fixes used local dev only; `local-asset-after-fixes.json`, `local-tariff-after-fixes.json`, and `local-account-drawer-after-fixes.json` confirm no raw class/basis/backend-copy leaks and corrected typography/drawer metrics.
  - Focused gates passed:
    - `pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.connect-import.execution.board-actions.test.tsx src/v2/overviewManualForms.test.ts src/v2/overviewReviewViewModel.test.ts src/v2/yearReview.test.ts src/v2/TariffPlanPageV2.test.tsx src/v2/VesinvestPlanningPanel.test.tsx src/i18n/locales/localeIntegrity.test.ts`
    - `pnpm --filter ./apps/api test -- src/v2/v2-report-pdf.spec.ts`
    - `pnpm --filter ./apps/web typecheck`
    - `pnpm --filter ./apps/api typecheck`
    - `git diff --check` passed with CRLF normalization warnings only.
