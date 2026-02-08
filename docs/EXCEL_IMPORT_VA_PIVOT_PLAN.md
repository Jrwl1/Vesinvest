# Excel Import VA Pivot Plan — FACIT-quality KVA import (verified)

This document is the **verified pivot plan** for a single-upload, FACIT-quality import from the KVA workbook: budget lines (TalousarvioRivi), revenue drivers (Tuloajuri), and optionally assumptions (Olettamus). **Actuals/bokslut are out of scope** (we do not store them). It is actionable so that "implement step 1" can be executed cleanly.

---

## 1. Repo context (read-only summary)

### 1.1 Docs and references

- **docs/EXCEL_IMPORT_VA_PLAN.md** — Template adapter architecture; preview/validate/commit; fixture policy (VA_FIXTURES_DIR, skip when missing).
- **docs/EXCEL_IMPORT_VA_PIVOT_PLAN.md** (this file) — Concrete FACIT mapping, parsing rules, implementation sequence.
- **TESTING.md** — pnpm test; KVA fixture: place in `fixtures/` or set `VA_FIXTURES_DIR`; tests skip when fixture missing.
- **docs/API.md** — `POST /budgets/:id/import/preview`, `POST /budgets/:id/import/confirm`; Budget CRUD and Tuloajuri endpoints.
- **docs/ARCHITECTURE.md** — Budgets module: CRUD, lines, drivers, CSV/Excel import.

### 1.2 Budget import flow (current)

| Layer | Location | Behaviour |
|-------|----------|-----------|
| **API** | `apps/api/src/budgets/budgets.controller.ts` | `POST :id/import/preview` (FileInterceptor, 5MB), `POST :id/import/confirm` (body `{ rows }`). |
| **Service** | `apps/api/src/budgets/budgets.service.ts` | `importPreview` → `BudgetImportService.parseFile`; `importConfirm` → create lines only (no drivers/assumptions). |
| **Parsing** | `apps/api/src/budgets/budget-import.service.ts` | If `detectKvaTemplate(workbook, filename)` → `previewKvaWorkbook(workbook)`; else first sheet, row 1 header. Returns `ImportPreviewResult` (rows, skippedRows, detectedFormat, warnings, year?, templateId?, amountColumnUsed?, countsByType?, processedSheets?). |
| **DB writes** | `apps/api/src/budgets/budgets.repository.ts` | `importConfirm` creates `TalousarvioRivi` only via `createLine`. No Tuloajuri or Olettamus. |
| **Web UI** | `apps/web/src/components/BudgetImport.tsx` | Upload → preview (badge, row count, warnings, amount column, processed sheets, summary chips, table with checkboxes) → confirm selected rows. Uses `App.css`: `.budget-import-overlay`, `.budget-import`, `.import-preview`, `.import-table-wrapper`, `.import-actions`. |

### 1.3 KVA adapter (current)

- **Detection:** `detectKvaTemplate(workbook, filename)` — filename `*Simulering*KVA*` or first sheet name contains Simulering/KVA/lönsamhet.
- **Preview:** `previewKvaWorkbook(workbook)` in `apps/api/src/budgets/va-import/kva-template.adapter.ts`:
  - Iterates **all worksheets**.
  - **Section header:** `isSectionHeaderRow(cells)` returns true only if row has a cell matching **Konto/tili/account** (tiliryhma) **and** a cell matching **Namn/nimi** or **Belopp/summa/Budget** (nimi or summa). So the row must contain explicit "Konto" or "tili" (or similar) **and** "Namn" or "Budget" (or similar).
  - `findSectionHeaderRows` scans up to 400 rows; collects row indices where `isSectionHeaderRow` is true.
  - For each header row, parses data until next header; only rows with numeric account `/^\d{3,6}$/` become lines; prefers column matching `BUDGET_HEADER` (/^budget$|^budjetti$|^talousarvio$/i) for amount.
  - Returns `revenueDrivers: []`, `assumptions: []` (always empty).
- **Tests:** `kva-template.adapter.spec.ts` — unit tests; fixture-based test skips when `Simulering av kommande lönsamhet KVA.xlsx` missing (path: `VA_FIXTURES_DIR` or repo `fixtures/`).

---

## 2. Excel FACIT inspection (source of truth)

Workbook: **fixtures/Simulering av kommande lönsamhet KVA.xlsx** (or `VA_FIXTURES_DIR`). Inspect with `node apps/api/scripts/inspect-kva-workbook.js` from repo root (or from `apps/api` with fixture path set).

### 2.1 Sheet names (exact)

1. Blad1  
2. KVA totalt  
3. Vatten KVA  
4. Avlopp  
5. Avlopp KVA  
6. proff.fi  
7. Boksluten  
8. Händelser  
9. Avskrivningar  
10. Anslutningar  

### 2.2 Blad1 — budget-line block (the only one with account-level data)

- **Header row:** **Row 76** (1-based). Cell values (A–D): **Förverkligat** | **Vatten** | **2023** | **Budget**. There are **no** cells containing "Konto", "Namn", "tili", or "Benämning" in this row.
- **Column indices (0-based):** col0 = Förverkligat (section label), col1 = Vatten (subsection), col2 = 2023 (year), col3 = **Budget** (amount to use). In **data rows**, col0 = account code, col1 = name, col2 = Förverkligat amount (actuals — out of scope), col3 = Budget amount.
- **Data rows:** 77–87. Account codes present: 6800, 6201, 6202, 6203, 6212, 6214, 6216, 6220, 6224, 6240, 6260 (all 6xxx — expense).
- **Row 88:** Total line (sum values; no numeric account in col0) — must be **stopped** (do not import).
- **Conclusion:** Budget lines exist **only on Blad1** in this block. Header is "row-76-style": contains "Budget" and is followed by numeric-account rows, but does **not** contain "Konto"/"Namn".

### 2.3 Revenue-driver locations

- **Unit prices (€/m³) and VAT:** **KVA totalt**, around rows 55–58. Labels observed: "moms 0 %", "moms 24 %", "moms 25,5 % (1.9.2024)"; "Vatten" with values 1.2, 1.214; "Avlopp" 2.5, 2.53. Map to `yksikkohinta` (vesi/jatevesi) and `alvProsentti`.
- **Volume (m³/year):** Not in a single explicit cell in the inspected KVA sheets; "Försäljningsintäkter" / "Omsättning" in **Vatten KVA** and **Avlopp KVA** (rows 3–4) give revenue by year — volume can be derived (revenue/price) or left default.
- **Connection count:** **Anslutningar** — row 3 = year headers (2015–2024); rows 4–6 = "Vatten och Avlopp", "Vatten", "Sammanlagt". Data cells by year → `liittymamaara` for chosen year.
- **Base fee (€/connection):** Not clearly in KVA summary sheets; Boksluten has "Anslutningsavgifter" (actuals — out of scope). Default 0 or leave for user.

### 2.4 Out-of-scope

- **Boksluten:** Historical actuals (priser, förbrukning, anslutningar). Do not import; we do not store actuals.
- **Händelser:** Events notes.  
- **Avskrivningar:** Depreciation plan; only consider for Olettamus if an existing `avain` mapping exists (do not invent storage).

---

## 3. Gap analysis (why current behaviour is wrong)

### 3.1 Why "Could not detect Budget column" or "no section header row found" happens

- **Root cause:** Section header detection requires a row to contain **both** (1) a cell matching **Konto/tili/account** and (2) a cell matching **Namn/nimi** or **Belopp/summa/Budget**. In Blad1 **row 76** the cells are "Förverkligat", "Vatten", "2023", "Budget". None of these match the **tiliryhma** pattern (Konto/tili/account/code/koodi). So `isSectionHeaderRow(cells)` is **false** for row 76. Therefore **row 76 is never** added to `findSectionHeaderRows`.
- **Effect:** On Blad1, `headerRows` is **empty**. The sheet is skipped with: *"Sheet \"Blad1\": no section header row found in first 400 rows; sheet skipped."* So **zero budget lines** are imported from the real KVA file from Blad1.
- **"Could not detect Budget column":** That warning is emitted only when a section **was** found (so some other sheet had a row with Konto+Namn) but the header row had no cell matching `BUDGET_HEADER`. For the real workbook, if Blad1 is the only sheet with account-level data and Blad1 is skipped, we never get to parse; so we might see "no section header" for Blad1 and no lines. If any other sheet had a Konto+Namn row without "Budget", we’d get the fallback warning there.

### 3.2 Why "Skipped N non-account rows" appears

- This warning is added when we **did** parse a section and skipped rows whose first column (account) was not numeric (`/^\d{3,6}$/`). So it only appears when at least one section header was found. For the real KVA, if Blad1 were somehow parsed (e.g. after we add row-76-style detection), then row 76 itself would not be a data row (it’s the header); data starts at 77. So we wouldn’t skip "Förverkligat" as a data row. If we had previously treated row 1 as header (generic parser), then rows 2–75 would be "non-account" and we’d skip them and warn — but with the KVA adapter we don’t use row 1 for Blad1 because we use section detection.

### 3.3 Is "everything becomes KULUT" a bug?

- **No.** In the Blad1 block, the account codes are 6800, 6201, 6202, 6203, 6212, 6214, 6216, 6220, 6224, 6240, 6260. The adapter rule is: 3xxx → TULOT, 5xxx → INVESTOINNIT, else → KULUT. All 6xxx have first digit 6 → **KULUT**. So for this block the classification is correct. "Everything becomes KULUT" here because the **template only has expense accounts** in this section. If we later parse other blocks/sheets with 3xxx or 5xxx, they will correctly become TULOT or INVESTOINNIT.

### 3.4 Summary of adapter gaps

| Gap | Cause | Fix |
|-----|--------|-----|
| Blad1 yields 0 lines | Row 76 does not contain "Konto"/"Namn", so it is not detected as section header. | Treat a row as section header if it contains "Budget" (or Talousarvio/Budjetti) **and** the **next** row has a numeric account in col0 (or in a detected account column). Then use position-based colMap: tiliryhma=0, nimi=1, summa=index of "Budget". |
| Wrong sheet/region | Adapter parses all sheets but only recognizes "Konto+Namn" headers; Blad1 has no such row. | Add "Budget + next row numeric" header detection so Blad1 row 76 is used. |
| Fallback warning | Only relevant when a header row was found but had no Budget column. | After fixing row-76 detection, the Budget column (index 3) will be found → no fallback for Blad1. |

---

## 4. FACIT mapping (per sheet)

| Sheet | Budget lines (TalousarvioRivi) | Revenue drivers (Tuloajuri) | Assumptions (Olettamus) | Out-of-scope |
|-------|--------------------------------|----------------------------|--------------------------|--------------|
| **Blad1** | **Yes.** One block: header row 76, data 77–87; colMap tiliryhma=0, nimi=1, summa=3 (Budget). Stop at row 88 (total). Only numeric account rows. | No | No | Actuals column (Förverkligat) not imported. |
| **KVA totalt** | No (summary P&L) | **Yes.** Rows 55–58: unit prices (Vatten/Avlopp €/m³), VAT (24%, 25.5%). | Only if existing `avain` mapping (e.g. inflaatio); do not invent keys. | — |
| **Vatten KVA** | No | **Yes.** Revenue/volume: rows 3–4 (Omsättning, Försäljningsintäkter) for chosen year; or derive volume from revenue/price. | No | — |
| **Avlopp** | No | Optional (formula-heavy). | No | — |
| **Avlopp KVA** | No | **Yes.** Same as Vatten KVA. | No | — |
| **proff.fi** | No | No | No | Single cell; ignore or year hint. |
| **Boksluten** | No | No | No | **Actuals/bokslut** — do not import. |
| **Händelser** | No | No | No | Events. |
| **Avskrivningar** | No | No | Skip unless we add explicit Olettamus key. | Do not invent storage. |
| **Anslutningar** | No | **Yes.** Connection count by year → `liittymamaara`. | No | — |

---

## 5. Parsing rules (exact)

### 5.1 Detecting a header row that does NOT contain "Konto/Namn" (row-76-style)

- **Rule:** Treat row `r` as a **section header** if **both**:
  1. The row has at least one cell matching `BUDGET_HEADER` (/^budget$|^budjetti$|^talousarvio$/i) (case-insensitive, trimmed).
  2. The **next** row (`r+1`) has in its **first** cell (col0) a value that matches `/^\d{3,6}$/` (numeric account), **or** in the same column as the detected "Budget" we have a numeric and the row has a second non-empty cell (name).
- **colMap when this rule fires:**  
  - `summa` = column index of the cell that matched BUDGET_HEADER.  
  - `tiliryhma` = 0, `nimi` = 1 (position-based for Blad1). If the next row has account in another column, infer from data row (e.g. first numeric column = tiliryhma, next = nimi).
- **Integration:** In `findSectionHeaderRows`, in addition to existing `isSectionHeaderRow(cells)`, for each row `r` (from 1 to scan limit): if row `r` contains a cell matching BUDGET_HEADER and row `r+1` has numeric account in col0, add `r` to the list.

### 5.2 Selecting the correct "Budget" column and fallback

- **Prefer:** Column whose header cell (trimmed) matches `BUDGET_HEADER`. Use that column index for `summa`.
- **Fallback:** If in a recognized header row there is no Budget/Budjetti/Talousarvio cell but there is a cell matching PATTERNS.summa (Belopp/summa/amount/…), use that column and add warning: *"Could not detect Budget column; using fallback amount column."*
- **Row-76-style:** The header row itself contains "Budget" in col3 → use it; no fallback.

### 5.3 Stop conditions (per section)

- **Stop parsing data** when:
  - **Next section header:** A row that matches section-header rules (Konto+Namn or Budget+next numeric).
  - **Subtotal/total row:** Row where the "account" cell (col0 or tiliryhma column) is empty or not numeric, and the amount column has a number (e.g. row 88 in Blad1).
  - **Blank region:** Consecutive rows with empty first N columns (e.g. 2–3 empty).
- Do **not** import the stop row as a budget line.

---

## 6. Type classification

- **Rule (keep):** From numeric account code string: 3xxx → TULOT, 5xxx → INVESTOINNIT, else → KULUT. Apply only to rows that passed the numeric-account check.
- **Section override:** Do **not** add section-label override unless the FACIT clearly puts e.g. 4xxx under an "Intäkter" block. Current Blad1 block is all 6xxx → KULUT; correct.

---

## 7. Confirm behaviour

- **TalousarvioRivi:** For each selected row in `body.rows`, create one budget line (tiliryhma, nimi, tyyppi, summa, muistiinpanot). No actuals/bokslut.
- **Tuloajuri (revenue drivers):** **Future step** (or same release): When preview includes `revenueDrivers` and user confirms import:
  - **Upsert by `palvelutyyppi`:** For each of vesi/jatevesi, if the budget already has a driver for that type → **update** it; else **create**. Use existing `createDriver` / `updateDriver` or add `upsertDriverByType(budgetId, driver)` in repository. Do **not** store actuals.
- **Olettamus:** Only if a clear mapping exists from template labels to existing `avain` (e.g. inflaatio). Otherwise **skip** in this pivot.

---

## 8. UI plan

- **Preview modal must show:** Format badge (e.g. "KVA template (Blad1)"), row count, warnings list, amount column used, processed sheets (chips), summary chips (TULOT/KULUT/INVESTOINNIT counts and totals), table with sticky header and row checkboxes, footer: "Choose another file" and "Import selected (N)".
- **Prevent "opaque overlay still visible / looks bad":**
  - **State reset:** On "Choose another file", set step to upload, clear preview and file state. On modal close, unmount and clear so no leftover overlay.
  - **Layering:** Backdrop `rgba(0,0,0,0.4)`; modal panel solid `#ffffff`, `opacity: 1`, `z-index` above backdrop; table thead/tbody cells solid background; sticky thead `z-index` above body.
  - **Scroll:** Only the table wrapper scrolls; header and footer fixed; single scroll, no double scrollbars (flex layout with `min-height: 0` on scroll area).

---

## 9. Implementation sequence

| Step | Description | Files (expected) | Tests |
|------|-------------|------------------|--------|
| **1** | **Row-76-style header:** In KVA adapter, add detection: row contains "Budget" (BUDGET_HEADER) and next row has numeric account in col0 → treat as section header; colMap tiliryhma=0, nimi=1, summa=index of Budget cell. Parse Blad1 rows 77–87; stop at 88 (total). **Done.** | `kva-template.adapter.ts` | Unit + fixture (skip if missing). |
| 2 | Multiple budget blocks in Blad1; aggregate; stop at total/blank/next header. **Done.** Budget lines from Blad1 only; other sheets reserved for drivers. | Same. | Unit test: two blocks. |
| 3 | Revenue drivers from KVA totalt: unit prices (€/m³) + VAT%. **Done.** "Pris €/m³" table, moms 0%/24%, Vatten/Avlopp rows. One warning if KVA totalt or table missing. | Same. | Unit + fixture. |
| **4** | **Revenue drivers: volume + connections + year selection.** **Done.** Enrich `revenueDrivers` with `myytyMaara` (Vatten KVA / Avlopp KVA) and `liittymamaara` (Anslutningar) using **selected year** (budget year from Blad1, or newest year in driver sheets). Label-scan only (VOLUME_LABELS, CONNECTION_LABELS); header rows skipped by year-cell detection. At most one warning for missing volume, one for missing connections; optional `driversDebug` (selectedYear, volumeSheet, connectionSheet). No DB write. | Same. | Unit: in-memory KVA totalt + Vatten KVA + Avlopp KVA + Anslutningar with year columns. Fixture: skip if missing; max 2 volume/connection warnings. |
| 5 | Preview API: expose revenueDrivers in `ImportPreviewResult`. **Done.** | `budget-import.service.ts`, web `api.ts`. | — |
| 6 | Confirm API: after creating lines, if preview had drivers, upsert Tuloajuri by palvelutyyppi. **Done.** Confirm body may include optional `revenueDrivers`; repository `upsertDriverByPalvelutyyppi` creates or updates one driver per palvelutyyppi (vesi/jatevesi/muu). Frontend sends `revenueDrivers` when preview had them. | `budgets.service.ts`, `budgets.repository.ts`, controller, web `api.ts` + `BudgetImport.tsx`. | Unit test: confirm with drivers. |
| 7 | Web UI: show driver summary in preview; modal layout (sticky footer, single scroll). **Done.** | `BudgetImport.tsx`, `App.css`. | Manual. |
| 8 | Fixture assertions tightening: load KVA.xlsx; assert budget lines, Blad1, no "no section header" spam; skip when fixture missing. | `kva-template.adapter.spec.ts` | Skip with clear message. |

---

## 10. Acceptance criteria

- [ ] After importing **Simulering av kommande lönsamhet KVA.xlsx**: Blad1 budget block yields **≥1** budget lines (e.g. 11 lines from rows 77–87); amounts from **Budget** column (col3), not Förverkligat.
- [ ] **No** "Could not detect Budget column" when the file has the row-76-style header with "Budget" in the row.
- [ ] **No** "Sheet \"Blad1\": no section header row found" when the file has row 76 with "Budget" and row 77 with numeric account.
- [ ] Section/total row (e.g. row 88) is **not** imported as a line.
- [ ] Type classification: 6xxx → KULUT; if 3xxx/5xxx appear in other blocks, TULOT/INVESTOINNIT.
- [ ] Warnings: "Skipped N non-account rows" only when applicable; no misleading warnings.
- [ ] Preview modal: format badge, row count, warnings, amount column, processed sheets, summary chips, table with sticky header, single scroll, fixed footer; "Choose another file" resets state; on close, no lingering overlay.
- [ ] Generic Excel/CSV import (non-KVA) unchanged; no regression.
- [ ] Actuals/bokslut: never imported or stored.

---

## 11. Tests

- **Unit tests:** In `kva-template.adapter.spec.ts`: (1) Blad1-style header (row with Budget + next row numeric account) → lines parsed, Budget column used, no fallback warning. (2) Multiple sections. (3) Stop at total row (row 88 style).
- **Fixture-based test:** Load `Simulering av kommande lönsamhet KVA.xlsx` from `VA_FIXTURES_DIR` or repo `fixtures/`; assert `budgetLines.length >= 1`, `processedSheets` includes Blad1 with lines > 0, `amountColumnUsed` contains "Budget" or similar. **Skip** when file is missing (check `fs.existsSync`), with message e.g. "KVA fixture not found: set VA_FIXTURES_DIR or add file to fixtures/".
- **How to run with fixture:** From repo root: `VA_FIXTURES_DIR=fixtures pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts`. Or copy the workbook into `fixtures/` and run from `apps/api`: `pnpm test -- src/budgets/va-import/kva-template.adapter.spec.ts` (fixture path in spec is `../fixtures` or `../../fixtures` depending on cwd; see TESTING.md).

---

## 12. Optional tooling

- **Inspection script:** `apps/api/scripts/inspect-kva-workbook.js` — run from `apps/api` (or repo root with correct path) to dump sheet names and first N rows. Requires fixture at `fixtures/Simulering av kommande lönsamhet KVA.xlsx` or `VA_FIXTURES_DIR`. Use to re-verify cell positions during implementation.
