# Yhteenveto Final Audit

Date: 2026-03-17
Window: local live browser audit after `S-87..S-92`

## Environment

- Frontend: `http://localhost:5173`
- Seeded local account used: `admin@vesipolku.dev` / `admin123`
- Real statement PDF used: `C:\Users\john\Downloads\Bokslut reviderad 2024 (1).pdf`
- Wiped-workspace start: cleared from the in-app account drawer with confirmation code `C9032CDE`

## Site Map

1. Step 2 import board
2. Step 3 review board
3. 2024 on-card review and statement-PDF correction workflow
4. Language switcher and account drawer

## Findings

- [MEDIUM] Step-3 review preview omitted `Avskrivningar` during the first live pass.
  - Repro: import years into the wiped workspace, continue to step 3, inspect the 2024 review row.
  - Expected: the same 6 canon rows as step 2, including `Avskrivningar`.
  - Actual: the review row showed revenue, materials, personnel, other operating costs, and result, but not depreciation.
  - Evidence: live browser snapshot before the fix showed no depreciation row on the step-3 review list.
  - Likely cause: the step-3 `renderYearValuePreview(...)` path in [OverviewPageV2.tsx](/C:/Users/john/Plan20/saas-monorepo/apps/web/src/v2/OverviewPageV2.tsx) skipped the `depreciation` summary key even though the shared summary contract already exposed it.
  - Resolution: fixed in product commit `8bae3bc` and immediately reran the browser audit plus the focused `S-92` regression suite.

## Verified End State

- Step 2 cards show the 6 canon rows directly: revenue, materials and services, personnel costs, depreciation, other operating costs, and result.
- Missing values now say VEETI did not provide the value instead of collapsing into a zero-like placeholder.
- Real zero values remain visibly rendered as zero instead of using the missing-state copy.
- Wiped-workspace import succeeded through the product flow.
  - Network evidence: `POST /api/v2/import/years/import` returned `201`.
  - Result: years `2024`, `2023`, and `2022` appeared in the step-3 review queue.
- Step 3 review rows now show the same 6 canon rows as step 2 after the `8bae3bc` fix, including `Avskrivningar`.
- Opening 2024 stayed on-card and exposed the review actions on the card itself: keep, manual fix, statement PDF import, exclude, and close.
- Real 2024 PDF correction stayed on-card and completed end to end.
  - Uploaded `Bokslut reviderad 2024 (1).pdf` from the 2024 review card.
  - OCR surfaced a live VEETI/PDF/current diff for revenue, personnel costs, other operating costs, depreciation, net finance, and year result.
  - Network evidence:
    - `POST /api/v2/import/manual-year` returned `201`
    - `POST /api/v2/import/sync` returned `201`
  - Result: year `2024` moved to reviewed state and the queue advanced to year `2023`.
- Org default language behavior is live and truthful.
  - On connect/import for Kronoby, the UI auto-selected Swedish from the live VEETI org payload language field (`Kieli_Id`).
  - Manual override to English updated the active step-3 card surface and action labels immediately.
- Truthful subrow availability answer remains unchanged from `S-87`.
  - Current VEETI/API path is still summary-only for these cards.
  - No truthful subrow expansion was available or shown in the final live pass.

## Outcome

whole sprint succeeded
