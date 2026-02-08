# Excel import VA plan: template adapters and KVA facit

This document plans the extension of the existing Excel import flow so that “facit” templates (e.g. KVA simulation workbook) can be imported cleanly with minimal rework later. It does **not** cover PDF import or assets/network import.

---

## 1. Current import architecture summary

### Budget import (Talousarvio)

- **Entry points**
  - **API:** `POST /budgets/:id/import/preview` (multipart file) and `POST /budgets/:id/import/confirm` (body: `{ rows }`).
  - **Controller:** `apps/api/src/budgets/budgets.controller.ts` — `importPreview`, `importConfirm`.
  - **Service:** `BudgetsService.importPreview` / `importConfirm` in `budgets.service.ts` delegate to `BudgetImportService` in `budget-import.service.ts`.

- **Parsing**
  - **BudgetImportService** (`budget-import.service.ts`): `parseFile(buffer, filename)` supports CSV and Excel (.xlsx/.xls). Uses **ExcelJS** for Excel. For Excel it uses **first sheet only**, **row 1 = header**, **row 2+ = data**. Column detection is header-based via regex patterns (tiliryhma, nimi, summa, tyyppi) in Finnish/Swedish/English. Amount parsing supports Finnish locale (comma decimal, space thousands). Returns `ImportPreviewResult`: `{ rows: ParsedBudgetRow[], skippedRows, detectedFormat, warnings }`.

- **DB writes**
  - **Confirm:** `importConfirm(orgId, budgetId, rows)` creates `TalousarvioRivi` (Prisma) for each row via `BudgetsService`/repository. No revenue drivers or assumptions are written by the current import.

- **UI**
  - **BudgetImport** (`apps/web/src/components/BudgetImport.tsx`): upload → `importBudgetPreview(budgetId, file)` → preview table with row selection → `importBudgetConfirm(budgetId, rows)` → done. Uses `ImportPreviewResult.rows` only.

- **Data models (Prisma)**
  - **Talousarvio:** id, orgId, vuosi, nimi, tila (luonnos/vahvistettu).
  - **TalousarvioRivi:** tiliryhma, nimi, tyyppi (kulu/tulo/investointi), summa, muistiinpanot.
  - **Tuloajuri:** palvelutyyppi (vesi/jatevesi/muu), yksikkohinta, myytyMaara, perusmaksu, liittymamaara, alvProsentti.
  - **Olettamus:** org-level assumptions (avain, arvo, etc.) for projections.

### Other import (assets / Import tab)

- **Imports module** (`apps/api/src/imports/`): separate flow for **assets**, **sites**, **asset types**, **maintenance items**. Uses upload → sheet classification → mapping templates → readiness gate → execution. **Not in scope** for VA budget/revenue; will remain separate. **Ledningar_*.xlsx** is intended for a future assets/network import.

---

## 2. Proposed “template adapter” architecture

### 2.1 Template detection rules

- **Input:** workbook (ExcelJS), filename.
- **Rules (e.g.):**
  - **KVA:** filename matches `*Simulering*KVA*.xlsx` (case-insensitive) **or** first sheet name contains “Simulering” / “KVA” / “lönsamhet”.
  - **Generic:** fallback to current header-based parser (first sheet, row 1 = header).
- Detection runs **before** parsing; once a template is recognised, the corresponding adapter is used.

### 2.2 Adapter interface

- **Detect:** `(workbook, filename) => boolean`.
- **Preview:** `(workbook) => Promise<VaImportPreview>` (no DB, no side effects).
- **Optional later:** `Commit` (apply preview to a given budget/org) when we add full import.

### 2.3 Normalized intermediate model (VaImportPreview)

- **budgetLines:** `Array<{ tiliryhma, nimi, tyyppi, summa, muistiinpanot? }>` — maps to TalousarvioRivi.
- **revenueDrivers:** `Array<{ palvelutyyppi, yksikkohinta?, myytyMaara?, perusmaksu?, liittymamaara?, alvProsentti? }>` — maps to Tuloajuri (vesi/jatevesi).
- **assumptions:** `Array<{ avain, arvo }>` (optional) — maps to Olettamus.
- **year:** number | null (budget year if detectable).
- **warnings:** string[].
- **templateId:** string (e.g. `"kva"`) for UI.

Existing `ImportPreviewResult` can be extended or we map from VaImportPreview: `rows = budgetLines`, and optionally pass through year/templateId for the UI.

### 2.4 Preview / validate / commit flow

- **Preview:** adapter returns VaImportPreview (no DB).
- **Validate:** client or API can run checks (e.g. sum checks, required fields) on the preview; failures add to warnings.
- **Commit:** (future) one or more endpoints that create/update Talousarvio + TalousarvioRivi + Tuloajuri (and optionally Olettamus) from VaImportPreview. Current `importConfirm` only writes budget lines; revenue/assumptions can be added later.

---

## 3. Mapping hypothesis: “Simulering av kommande lönsamhet KVA.xlsx”

- **Purpose:** Swedish/Finnish VA “simulation of future profitability” template; primary target for budget + projection alignment.
- **Assumptions (to be validated when file is inspected):**
  - **Sheets:** at least one sheet with budget-like table (rows = account lines, columns = description, amount, possibly year columns). Possibly separate sheets for revenue drivers (prices, volumes, base fees, connections) and/or assumptions.
  - **Header row:** variable; may be row 1 or 2; may contain Swedish/Finnish headers (e.g. Konto, Benämning, Belopp, År).
  - **Account codes:** 3xxx (revenue), 4xxx (expenses), 5xxx (investments); tiliryhma inferred or in a column.
  - **Revenue drivers:** unit price (€/m³), sold volume (m³/year), base fee (€/connection), number of connections — for water and wastewater; may be in a dedicated section/sheet.
  - **Years:** single year or multiple columns (e.g. 2024, 2025, 2026); we take one year (e.g. first or a chosen column) for budget lines.
- **Validation:** required fields present; numeric parsing; optional sum checks (e.g. section totals); Finnish/Swedish number format (comma decimal, space thousands).

**Implementation (minimal slice):** detect KVA by filename/sheet name; parse first (or named) sheet for budget-like rows; optionally scan for a revenue block; return VaImportPreview with at least budgetLines and year (if found). Revenue drivers and assumptions can be stubbed or partially filled in a follow-up.

---

## 4. Out of scope: assets import (Ledningar_*.xlsx)

- **Ledningar_kva_tva_250902.xlsx** is assumed to describe **network/pipe assets** (ledningar = pipes). It is **not** in scope for this VA budget/revenue slice.
- **Later plan:** a separate “assets template” adapter (or reuse of existing imports pipeline) with its own detection (e.g. filename `*Ledningar*`), mapping to Asset/AssetType/Site, and possibly maintenance. No change to VA budget import.

---

## 5. Fixture handling policy

- **Placement:** Local Excel/PDF fixtures (e.g. KVA.xlsx, Ledningar_*.xlsx, Ab Terjärv*.pdf) should be placed under:
  - **Preferred:** `fixtures/va-import/` (dedicated VA import fixtures), or
  - **Current:** `fixtures/` at repo root.
- **Git:** Both are **gitignored** so that fixture files are **not committed** (see root `.gitignore`: `fixtures/va-import/`, `fixtures/*.xlsx`, `fixtures/*.xls`, `fixtures/*.pdf`). Docs/releases PDFs outside `fixtures/` are not affected.
- **Tests:** Tests that depend on fixture files (e.g. KVA.xlsx) must **skip** when the file is missing: check for file existence and `describe.skip` or `it.skip` with a clear message (e.g. “KVA fixture not found”). Fixture path is **configurable via env** `VA_FIXTURES_DIR` (relative to repo root or absolute); default when running from `apps/api` is `fixtures` at repo root. See TESTING.md.

---

## 6. Summary

- **Current:** Budget import = single-path Excel/CSV parser (first sheet, header row), preview → confirm → TalousarvioRivi only.
- **Proposed:** Template detection → adapter (e.g. KVA) → VaImportPreview (budget lines, optional revenue/assumptions/year) → same or extended preview/confirm flow.
- **Minimal slice:** KVA adapter (detect + preview parse), no DB writes from adapter; tests skip when fixtures missing; VA_FIXTURES_DIR for path.
