# Frontend Overhaul Final Audit

Date: 2026-03-17

Scope:
- Final focused regression proof for wizard truth, statement import, Forecast hierarchy, investments, depreciation, Reports, and locale integrity
- Live browser audit from a wiped workspace through step 1, real statement-PDF correction, planning-baseline handoff, Forecast, and Reports

Runtime reused:
- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- Real PDF used: `C:\Users\john\Downloads\Bokslut reviderad 2024 (1).pdf`
- Seeded local account: `admin@vesipolku.dev`

Focused regression proof:
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/v2/yearReview.test.ts src/v2/statementOcr.test.ts src/i18n/locales/localeIntegrity.test.ts` -> PASS
- `pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts` -> PASS
- `pnpm --filter ./apps/web typecheck` -> PASS
- `pnpm --filter ./apps/api typecheck` -> PASS

Live audit path:
1. Logged in with the seeded local account and landed on a clean `Vaihe 1 / 6` wizard state.
2. Searched `0180030-9`, selected `Kronoby vatten och avlopp ab`, and connected successfully.
3. Imported the default selected workspace years `2022`, `2023`, and `2024`.
4. Opened year `2024`, used `Tuo bokslut PDF`, uploaded the real 2024 PDF, and confirmed the OCR correction.
5. The OCR pass detected page `4` with confidence `67 %` and surfaced VEETI/PDF/current reconciliation before confirmation.
6. The 2024 year result moved from the VEETI-only `133 981 EUR` profile to the statement-backed `3 691 EUR` profile after confirm-and-sync.
7. The corrected year was marked reviewed, and the review queue auto-advanced to the remaining years.
8. Years `2023` and `2022` were accepted as-is via `Pidä mukana`, and the wizard advanced to `Vaihe 6 / 6`.
9. `Ennuste` opened from the wizard handoff, the new scenario rail and executive hero were visible, and the mixed baseline with statement-imported financials stayed legible inside Forecast.
10. Created `Audit scenario`, recomputed it to a report-ready state, and confirmed the Forecast report gate moved from blocked to ready.
11. Opened `Raportit`, confirmed the ready-state empty report surface, then created a report from Forecast and returned to Reports.
12. Reports showed one saved report with mixed baseline status and statement-import provenance for financials, matching the Forecast baseline truth.

Live audit findings:
- No blocking trust, hierarchy, statement-import, investment-disclosure, depreciation-planning, or report-provenance issues were observed in the audited path.
- The real PDF correction path remained first-class and did not require hidden second-mode activation.
- Forecast and Reports stayed locked until the setup flow reached the explicit baseline-ready handoff.

Outcome:
whole sprint succeeded

## UI overhaul rerun

Date: 2026-03-19

Scope:
- Final UI-overhaul regression proof for the redesigned shell, login, Overview, Forecast, and Reports surfaces
- Live browser sweep across login, accepted Overview, Forecast cockpit, and Reports preview on the running local app

Runtime reused:
- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- Seeded local account: `admin@vesipolku.dev`

Focused regression proof:
- `pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LoginForm.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts` -> PASS
- `pnpm --filter ./apps/web typecheck` -> PASS

Live audit path:
1. Reloaded the app and confirmed the redesigned login surface rendered with no console errors.
2. Authenticated with the seeded local account and confirmed the accepted-year Overview state showed the calmer year ledger plus a clear Forecast handoff.
3. Opened Forecast and confirmed the two-column cockpit, executive shell, and chart surfaces loaded with no console errors after reload.
4. Verified the stale-scenario runtime fallback no longer produced the earlier 404 console noise on refresh.
5. Opened Reports from the live shell and confirmed the ledger-plus-preview surface, provenance blocks, and export-ready report state with no console errors.

Live audit findings:
- No blocking console, hierarchy, or route-truth issue was observed in the redesigned login -> Overview -> Forecast -> Reports path.
- The accepted Overview state remains useful after setup completion instead of collapsing into dead onboarding chrome.
- Forecast and Reports preserve the current backend-driven truth states while presenting the new visual system.

Outcome:
whole sprint succeeded
