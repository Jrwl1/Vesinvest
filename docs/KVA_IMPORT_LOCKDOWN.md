# KVA import lockdown

**Decision (Option A, locked):** Talousarvio import uses only the sheet **KVA totalt**. One row per P&L category per year. No Vatten KVA / Avlopp KVA in this import path.

## Contract

- **Single source:** `extractSubtotalLines` in `apps/api/src/budgets/va-import/kva-template.adapter.ts` reads only the sheet named "KVA totalt". `sheetTargets` is restricted to `[{ name: KVA_TOTALT_SHEET }]`.
- **Result:** One line per (categoryKey, year) in preview and in persisted valisummat. No duplicate underrows from multiple sheets.
- **ADR:** ADR-024 (Talousarvio import single-source KVA totalt).

## Layout (KVA totalt tab)

Layout is discovered during implementation via the existing inspect scripts:

- **Inspect workbook structure:** `node apps/api/scripts/inspect-kva-workbook.js` (from repo root or `apps/api`). Requires fixture at `fixtures/Simulering av kommande lönsamhet KVA.xlsx` or `VA_FIXTURES_DIR`.
- **Inspect with year/label detail:** `node apps/api/scripts/inspect-kva-full.js`.

Confirm on the KVA totalt sheet:

- Which row(s) contain year headers (e.g. 2022, 2023, 2024) and column indices.
- Which column holds row labels (e.g. "Omsättning", "Försäljningsintäkter", "Material och tjänster").
- Parser uses `getYearColumnsInSheetMultiRow` and `getBestSubtotalLabel`; categories matched via `SUBTOTAL_CATEGORIES` in the adapter.

## Verification

1. **Run adapter tests:** `pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts` — must pass; `sourceSheets` equals `['KVA totalt']` where asserted.
2. **Run budget contract test:** `pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts` — fixture-backed test expects subtotals from KVA totalt.
3. **Import preview:** Upload the fixture (or a workbook with KVA totalt); confirm one row per category per year in the preview underrows (no duplicate labels).
4. **Spot-check:** Open the Excel file, pick 2–3 categories and one year, compare cell values to the values shown in the KVA Import preview.
