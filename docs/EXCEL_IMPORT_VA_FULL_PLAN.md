> ⚠️ **DEPRECATED / HISTORICAL**  
> Do not use as current spec. Canonical docs: [docs/CANONICAL.md](CANONICAL.md). For KVA import use: [REVENUE_DRIVERS_PERSISTENCE_REPORT.md](REVENUE_DRIVERS_PERSISTENCE_REPORT.md), [KVA_IMPORT_DRIVERS_CHECKLIST.md](KVA_IMPORT_DRIVERS_CHECKLIST.md), [API.md](API.md).

---

# Excel Import VA Full Plan — Two-tier import strategy

This plan covers importing **all relevant VA data** from the KVA workbook (**Simulering av kommande lönsamhet KVA.xlsx**) into our app, aligned with the new domain guidance:

> Account-level (6201, 6202 …) is too granular for 20-year planning. Planning input should be on **subtotal / mellansumma level** as in the KVA report structure.

The plan introduces a **two-tier import strategy**: subtotal-level (primary) and account-level (optional detail). It builds on [EXCEL_IMPORT_VA_PLAN.md](./EXCEL_IMPORT_VA_PLAN.md) and [EXCEL_IMPORT_VA_PIVOT_PLAN.md](./EXCEL_IMPORT_VA_PIVOT_PLAN.md).

**Inspection:** Run `node apps/api/scripts/inspect-kva-full.js` from repo root (fixture in `fixtures/` or `VA_FIXTURES_DIR`).

---

## 1. Current state summary

| Data | Source | Tier | Notes |
|------|--------|------|-------|
| Budget lines | Blad1, account-level (6201, 6800…) | Account | All 6xxx → KULUT; no income/investment subtotals. |
| Revenue drivers | KVA totalt (prices), Vatten/Avlopp KVA (volume), Anslutningar (connections) | Driver | Already working. |
| Assumptions | — | — | Not extracted. |

**Problem:** Current import only reads Blad1 account rows (Tier B), producing 100% KULUT. The KVA totalt and Vatten KVA / Avlopp KVA sheets contain subtotal-level P&L rows (income, costs, depreciation, result) that are the correct basis for 20-year planning.

---

## 2. Workbook sheet inventory (inspection-based)

| # | Sheet | Trimmed | Content | Tier A (subtotal) | Tier B (account) | Drivers |
|---|-------|---------|---------|--------------------|-------------------|---------|
| 1 | Blad1 | Blad1 | Account-level costs: row 76 header → rows 77–87 (6xxx), row 88 total. | No (total row only) | **Yes** — 11 account lines | No |
| 2 | KVA totalt | KVA totalt | Summary P&L: income, costs, depreciation, result subtotals; price table (rows 54–58). | **Yes — primary** | No | Prices + VAT |
| 3 | Vatten KVA | Vatten KVA | Water KVA P&L: subtotals by year (revenue, costs, depreciation, result per year). | **Yes** — per service | No | Volume (m³) |
| 4 | Avlopp | Avlopp | Wastewater detail (formula-heavy). | Optional | No | — |
| 5 | Avlopp KVA | Avlopp KVA | Wastewater KVA P&L: same structure as Vatten KVA. | **Yes** — per service | No | Volume (m³) |
| 6 | proff.fi | proff.fi | Minimal; year hint. | No | No | — |
| 7 | Boksluten | Boksluten | Historical actuals. | No (actuals) | No | No |
| 8 | Händelser | Händelser | Events notes. | No | No | No |
| 9 | Avskrivningar | Avskrivningar | Depreciation plan by asset type, years. | Optional (assumptions) | No | No |
| 10 | Anslutningar | Anslutningar | Connection counts by year. | No | No | Connections |

### 2.1 KVA totalt — subtotal rows (based on pivot plan inspection + adapter output)

KVA totalt contains a consolidated P&L with rows like:

- **Försäljningsintäkter** (Sales revenue) — income subtotal
- **Övriga intäkter** (Other income)
- **Material och tjänster** (Materials and services) — cost subtotal
- **Personalkostnader** (Personnel costs)
- **Övriga kostnader** (Other costs)
- **Avskrivningar** (Depreciation)
- **Rörelseresultat** (Operating result)
- **Finansiella intäkter/kostnader** (Financial income/costs)
- **Årets resultat** (Year result)

Each row has values by year (columns for 2015–2024 or similar). These are the **mellansumma** rows the business owner refers to.

### 2.2 Vatten KVA / Avlopp KVA — per-service subtotals

Same P&L structure but for water and wastewater separately. Year columns. Labels like "Försäljningsintäkter", "Driftskostnader", "Avskrivningar", "Resultat".

### 2.3 Blad1 — account-level detail

Row 76 header (Budget column), rows 77–87: account codes 6201 El, 6202 Bränsle, … 6260 Övriga. All 6xxx = costs. No revenue or investment accounts in this block.

---

## 3. Two-tier import strategy

### Tier A — Subtotal-level import (primary, for 20-year planning)

- **Source:** KVA totalt (consolidated), optionally Vatten KVA + Avlopp KVA (per-service).
- **Rows:** Label-detected subtotal rows (P&L categories): income, costs by category, depreciation, financial, result.
- **Year:** Selected year column (budget year or newest).
- **Output:** `VaImportSubtotalLine[]` with stable categoryKey, mapped to DB.
- **UI:** Shown as "KVA subtotal import" with TULOT + KULUT + INVESTOINNIT + TULOS categories.

### Tier B — Account-level import (optional detail, short-term budget, traceability)

- **Source:** Blad1 budget blocks.
- **Rows:** Account-level (6201, 6202…) — same as current.
- **Output:** `VaImportBudgetLine[]` (existing type).
- **UI:** Shown as "Account detail" section; optional; primarily for single-year budgeting and audit trail.
- **Implementation:** Already done; no changes needed.

### Selection logic

- **Default:** Tier A (subtotal) when KVA totalt or Vatten KVA/Avlopp KVA are present.
- **Fallback:** Tier B only when no subtotal sheets exist.
- **Both:** User can import both tiers; Tier A for planning, Tier B for detail reference.

---

## 4. Normalized model for subtotal-level import

### 4.1 VaImportSubtotalLine (new type)

```typescript
export interface VaImportSubtotalLine {
  /** Stable category identifier, e.g. "sales_revenue", "personnel_costs" */
  categoryKey: string;
  /** Display name from workbook, e.g. "Försäljningsintäkter" */
  categoryName: string;
  /** Semantic type */
  type: 'income' | 'cost' | 'depreciation' | 'financial' | 'investment' | 'result';
  /** Amount in EUR for the selected year */
  amount: number;
  /** Year the amount belongs to */
  year: number;
  /** Source sheet name */
  sourceSheet: string;
  /** Optional: per-service breakdown (vesi/jatevesi) if from Vatten KVA / Avlopp KVA */
  palvelutyyppi?: 'vesi' | 'jatevesi';
}
```

### 4.2 Category key mapping (label → categoryKey + type)

| Label tokens (Swedish) | Label tokens (Finnish) | categoryKey | type |
|------------------------|----------------------|-------------|------|
| försäljningsintäkter | myyntituotot | `sales_revenue` | income |
| övriga intäkter, övriga rörelseintäkter | muut tuotot | `other_income` | income |
| material, tjänster, material och tjänster | materiaalit, palvelut | `materials_services` | cost |
| personalkostnader, löner | henkilöstökulut | `personnel_costs` | cost |
| övriga kostnader, övriga rörelsekostnader | muut kulut | `other_costs` | cost |
| avskrivningar, nedskrivningar | poistot | `depreciation` | depreciation |
| rörelseresultat | liiketoiminnan tulos | `operating_result` | result |
| finansiella intäkter | rahoitustuotot | `financial_income` | financial |
| finansiella kostnader | rahoituskulut | `financial_costs` | financial |
| årets resultat, resultat | tilikauden tulos | `net_result` | result |
| investeringar | investoinnit | `investments` | investment |
| anslutningsavgifter | liittymismaksut | `connection_fees` | income |

**Detection rule:** For each row in the P&L area, normalize the label (getCellText → lower, trim, collapse spaces). Match against the token table above. Prefer longest match. Skip unmatched rows (intermediate headers, blank rows). Stop at end of P&L block (blank stretch or next section header).

### 4.3 VaImportPreview extension

```typescript
export interface VaImportPreview {
  // ... existing fields ...
  /** Tier A: subtotal-level lines from KVA P&L sheets */
  subtotalLines?: VaImportSubtotalLine[];
  /** Debug: which sheets/rows were used for subtotal extraction */
  subtotalDebug?: {
    sourceSheets: string[];
    yearColumnsDetected: number[];
    selectedYear: number;
    rowsMatched: number;
    rowsSkipped: number;
  };
}
```

---

## 5. DB mapping: how subtotal lines persist

### Option A — New table: `TalousarvioVälisumma` (recommended)

```
model TalousarvioValisumma {
  id             String      @id @default(uuid())
  talousarvioId  String
  talousarvio    Talousarvio @relation(...)
  categoryKey    String      @map("category_key")    // e.g. "sales_revenue"
  categoryName   String      @map("category_name")   // e.g. "Försäljningsintäkter"
  type           ValisummaType                        // income | cost | depreciation | financial | investment | result
  amount         Decimal     @map("amount")
  palvelutyyppi  Palvelutyyppi?                       // null = consolidated; vesi/jatevesi = per-service
  sourceSheet    String?     @map("source_sheet")
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@index([talousarvioId])
  @@unique([talousarvioId, categoryKey, palvelutyyppi])
  @@map("talousarvio_valisumma")
}

enum ValisummaType {
  income
  cost
  depreciation
  financial
  investment
  result
}
```

**Why recommended:**
- Clean separation: subtotals are not account lines. Mixing them in TalousarvioRivi (which has `tiliryhma` = account code) would require inventing fake account codes.
- Stable `categoryKey` enables 20-year projection engine to reference categories directly.
- `palvelutyyppi` allows per-service breakdown from Vatten KVA / Avlopp KVA while keeping consolidated from KVA totalt.
- Projection (Ennuste) can consume `TalousarvioValisumma` for its yearly calculations (instead of summing account lines).

### Option B — Transitional encoding in TalousarvioRivi (not recommended)

Use `tiliryhma` = categoryKey (e.g. "sales_revenue"), `nimi` = categoryName, `tyyppi` = tulo/kulu/investointi. Problems:
- `tiliryhma` semantically means account group code (numeric); using string keys breaks validation.
- No place for `palvelutyyppi` or `type` (depreciation, financial, result are not kulu/tulo/investointi).
- Mixing subtotals with account lines makes queries ambiguous.

**Recommendation:** Option A. One migration, clean model, supports projection engine.

---

## 6. Parsing rules for subtotal extraction

### 6.1 Sheet priority for Tier A

1. **KVA totalt** — consolidated P&L. Primary source for total-level subtotals.
2. **Vatten KVA** — per-service (vesi) breakdown. Secondary.
3. **Avlopp KVA** — per-service (jatevesi) breakdown. Secondary.

### 6.2 Year column detection

- Scan first 25 rows for cells matching `20\d{2}` (as number or string via getCellText).
- Build year→column map. Select: budget year (from Blad1) if present in columns; else newest year.
- If no year columns found: use the rightmost numeric column as amount (with warning).

### 6.3 P&L row detection

- Scan rows 1–120 (or until long blank stretch).
- For each row: normalize first cell (label). Match against category token table (Section 4.2).
- If matched: extract amount from selected year column. Create one `VaImportSubtotalLine`.
- Skip rows that look like headers (multiple year cells), blank rows, or unrecognized labels.
- Track matched and skipped counts for debug.

### 6.4 Cell normalization

- Use `getCellText(cell.value)` for all cells (handles richText, formula/result, string, number).
- For labels: lower-case, trim, collapse whitespace.
- For amounts: `parseAmount` (Finnish/Swedish locale).

### 6.5 Warnings

- If KVA totalt missing and no subtotal sheets: one warning "No KVA summary sheet found; subtotal import not available."
- If year column not found: one warning.
- If no rows matched in a sheet: one warning per sheet.
- No warning for Tier B (account-level) unless it's the only tier and it fails.

---

## 7. Updated Tier B (Blad1 account-level) parsing rules

No changes. Blad1 account-level import remains as-is (already done). In the new UI:
- Tier B is labeled "Account detail (Blad1)" and shown as a secondary section.
- User can choose to import account-level lines, subtotal lines, or both.

---

## 8. Updated acceptance criteria

- [ ] **Subtotal import (Tier A):** KVA totalt yields ≥1 income line (e.g. Försäljningsintäkter) and ≥1 cost line (e.g. Material och tjänster) — **not** 100% KULUT.
- [ ] **Per-service:** Vatten KVA yields subtotal lines with `palvelutyyppi=vesi`; Avlopp KVA with `palvelutyyppi=jatevesi`.
- [ ] **Year selection:** Amount is from the correct year column (budget year or newest).
- [ ] **Account import (Tier B):** Blad1 yields ≥1 account-level line (unchanged).
- [ ] **Revenue drivers:** Unit prices, VAT, volume (m³ only), connections — unchanged, still working.
- [ ] **Confirm:** Subtotal lines persisted to TalousarvioValisumma (when schema added); account lines to TalousarvioRivi; drivers to Tuloajuri.
- [ ] **UI:** Preview shows both tiers if available; subtotal section has income+cost+result categories; no 100% KULUT when KVA totalt has income rows.
- [ ] **Warnings:** At most one per missing block. No "could not locate Pris+m3" when price table found.

---

## 9. Implementation sequence

| Step | Description | Files | Shippable |
|------|-------------|-------|-----------|
| **S1** | **Subtotal extraction from KVA totalt** — Add `extractSubtotalLines(workbook, selectedYear)`: scan KVA totalt for P&L rows using category token table; return `VaImportSubtotalLine[]`. Add to VaImportPreview as `subtotalLines`. | `kva-template.adapter.ts`, `va-import.types.ts` | Yes — preview only, no DB. |
| **S2** | **Per-service subtotals from Vatten KVA / Avlopp KVA** — Same extraction but with `palvelutyyppi` set. Merge with KVA totalt lines. | Same | Yes. |
| **S3** | **DB schema: TalousarvioValisumma** — Prisma migration; add relation to Talousarvio. | `schema.prisma`, migration | Yes — schema only, no writes yet. |
| **S4** | **Confirm: persist subtotal lines** — In `importConfirm`, if `subtotalLines` present, upsert TalousarvioValisumma by (talousarvioId, categoryKey, palvelutyyppi). | `budgets.service.ts`, `budgets.repository.ts` | Yes. |
| **S5** | **UI: show subtotal section** — Preview modal shows subtotal lines grouped by type (income/cost/depreciation/result); separate from account-detail table. | `BudgetImport.tsx` | Yes. |
| **S6** | **Tier selection** — User can choose "Subtotal only", "Account detail only", or "Both" in preview. Default: Subtotal only when available. | `BudgetImport.tsx`, confirm body | Yes. |
| **S7** | **Projection integration** — Ennuste engine reads TalousarvioValisumma for yearly calculations instead of summing TalousarvioRivi. | Projection module | Yes (separate PR). |

**Already done (no new step):** Budget lines from Blad1 (Tier B); revenue drivers (prices, volume, connections); meaningful-only driver upsert; getCellText; strict price table validation.

---

## 10. Tests

### 10.1 Unit tests — subtotal extraction (in-memory workbook)

```
describe('extractSubtotalLines', () => {
  it('extracts income and cost subtotals from KVA totalt with year columns', () => {
    // Workbook: KVA totalt with row "Försäljningsintäkter" + "2023" + "2024" year columns
    // Assert: subtotalLines includes categoryKey "sales_revenue" with type "income" and correct year amount
  });

  it('maps Swedish P&L labels to correct categoryKey and type', () => {
    // Rows: Försäljningsintäkter → income, Personalkostnader → cost, Avskrivningar → depreciation
  });

  it('skips header rows and unrecognized labels', () => {
    // Row with multiple year cells → skipped; "Random text" → skipped
  });

  it('uses budget year column when available', () => {
    // Year cols 2023, 2024; budgetYear=2024 → amounts from 2024 column
  });

  it('extracts per-service from Vatten KVA with palvelutyyppi=vesi', () => {
    // Vatten KVA with same P&L structure → lines have palvelutyyppi='vesi'
  });

  it('does not produce 100% KULUT when income rows exist', () => {
    // At least one line with type 'income' when Försäljningsintäkter row exists
  });
});
```

### 10.2 Fixture tests (skip when file missing)

```
it('KVA totalt yields income + cost subtotal lines (not 100% KULUT)', async () => {
  // Load fixture; run extractSubtotalLines
  // Assert: at least one income line, at least one cost line
  // Assert: no warning "could not locate" for subtotals when KVA totalt exists
});

it('subtotal + account import together yields both tiers', async () => {
  // Assert: subtotalLines.length >= 2 (income + cost)
  // Assert: budgetLines.length >= 1 (account detail from Blad1)
});
```

### 10.3 Confirm guard tests (existing + new)

- Subtotal lines only persisted when at least one has amount > 0.
- Account lines only persisted when at least one has summa > 0.

---

## 11. In-scope vs out-of-scope

**In-scope:**

- **Tier A:** Subtotal P&L lines from KVA totalt, Vatten KVA, Avlopp KVA (income, costs, depreciation, financial, result).
- **Tier B:** Account-level lines from Blad1 (optional detail).
- Revenue drivers: prices, VAT, volume (m³), connections.
- New DB table TalousarvioValisumma for subtotal persistence.
- Projection engine consuming subtotals (separate step).

**Out-of-scope:**

- Assets, network lengths, Ledningar_*.xlsx.
- Actuals/bokslut (Boksluten sheet).
- PDF import.
- Assumptions (Olettamus) — deferred until product agrees on keys.
- Depreciation schedules (Avskrivningar) — only as a subtotal line amount, not a detailed schedule.

---

## 12. Inspection script

- **Script:** `apps/api/scripts/inspect-kva-full.js`
- **Run:** `node apps/api/scripts/inspect-kva-full.js` (set `VA_FIXTURES_DIR` if fixture is elsewhere).
- **Output:** Sheet names, year columns, key label rows (P&L categories, prices, volume, connections), candidate table regions with cell types.
- **Usage:** Re-run when fixture layout changes; use output to verify category token table mapping.

---

## 13. Category token table maintenance

The category token table (Section 4.2) is the core mapping from Excel labels to stable keys. To update:

1. Run inspection script → find new P&L labels.
2. Assign a `categoryKey` (snake_case, English, stable across years).
3. Assign a `type` (income/cost/depreciation/financial/investment/result).
4. Add to the `SUBTOTAL_CATEGORIES` constant in the adapter.
5. Add a unit test with the new label.

This ensures the mapping grows safely without breaking existing extractions.
