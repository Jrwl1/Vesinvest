# Site Audit Findings and Fix Plan (2026-02-20)

## Scope audited
- Login flow (`admin@plan20.dev` / `devpassword`)
- Talousarvio: KVA import preview/confirm, year cards, set selector
- Ennuste: baseline compute, KPI/cards/charts/table, scenario compute
- PDF export (`/projections/:id/export-pdf`)
- Asetukset: assumptions + trial/admin sections quick pass

## What works (verified)
- Credential login works.
- Main nav tab flow works (`Talousarvio` -> `Ennuste` -> `Asetukset`).
- KVA preview opens and parses workbook.
- Missing required driver inputs are highlighted and block confirm.
- Projection compute can run after import.
- PDF export endpoint returns valid binary PDF response.
- Existing E2E smoke test passes end-to-end.

## What did not work / high-risk UX gaps
- Talousarvio set labels were hardcoded to `3 vuotta` even when batch size was not 3.
- KVA year-picker allowed importing fewer than 3 years when workbook had >3 years, causing “missing year card” confusion.
- Projection could show near-zero revenue when imported driver values were tiny placeholders versus large `sales_revenue` subtotals.
- Result: user-visible mismatch between imported budget totals and Ennuste income.

## Root causes
- UI hardcoded year-count text instead of using actual batch size.
- Year selection constraint and confirm guard were not strict enough for >3-year workbooks.
- Compute path preferred existing imported drivers whenever present, with no plausibility guard against subtotal sales baseline.

## Fix plan
1. Budget set metadata and UI labels
- Add `yearsCount` to budget set API response.
- Render set labels and badges from actual year count, not hardcoded `3 vuotta`.

2. KVA year selection guardrails
- Require exactly 3 selected years when workbook exposes more than 3 years.
- Keep confirm disabled until valid year selection.
- Show explicit validation message in preview.

3. Projection revenue robustness
- Add fallback heuristic for imported drivers:
  - if imported driver-based water revenue is implausibly low compared to subtotal `sales_revenue`,
  - and no explicit projection driver-path override exists,
  - synthesize baseline drivers from subtotals and use those for compute.
- Persist synthesized fallback driver paths to projection for transparency/editability.

4. Verification
- Run API tests for projections/budgets/KVA adapter.
- Run Playwright E2E credential login -> KVA import -> compute -> PDF.
- Manual spot-check of Talousarvio set labels and year-card count.

## Acceptance criteria
- Set selector and badge always show real year count.
- User cannot confirm KVA import with invalid year-count selection for >3-year files.
- Imported subtotal-heavy budgets no longer produce near-zero projection income from placeholder drivers.
- End-to-end flow remains green and PDF export still works.
