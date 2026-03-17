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
