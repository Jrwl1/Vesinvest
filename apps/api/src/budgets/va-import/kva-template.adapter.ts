import type { Workbook } from 'exceljs';
import type {
  VaImportPreview,
  VaImportBudgetLine,
  VaImportProcessedSheet,
  VaImportKvaDebug,
  VaImportRevenueDriver,
  VaImportDriversDebug,
  VaImportSubtotalLine,
  VaImportSubtotalDebug,
  ValisummaType,
} from './va-import.types';

const TEMPLATE_ID = 'kva';

/** Max rows to scan for section headers (KVA headers can appear far down). */
const MAX_HEADER_SCAN = 400;

/** Detect KVA "Simulering av kommande lönsamhet" template by filename or sheet name. */
export function detectKvaTemplate(workbook: { worksheets: { name: string }[] }, filename: string): boolean {
  const fn = (filename || '').toLowerCase();
  if (/simulering.*kva|kva.*simulering/.test(fn)) return true;
  const first = workbook.worksheets[0]?.name ?? '';
  const name = first.toLowerCase();
  return /simulering|kva|lönsamhet|lonnsamhet/.test(name);
}

/**
 * Parse Finnish/Swedish number: "1 234,56" or "1234.56" -> 1234.56
 */
function parseAmount(raw: unknown): number {
  if (raw == null || raw === '') return NaN;
  let s = String(raw).replace(/€|EUR/gi, '').replace(/\s/g, '').trim();
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

/** Only treat as budget line if account code is numeric (e.g. 3xxx, 4xxx, 5xxx). Skips section rows like "Förverkligat | Vatten". */
function isNumericAccountCode(value: string): boolean {
  return /^\d{3,6}$/.test((value || '').trim());
}

/** Infer tyyppi from account code (3xxx=tulo, 5xxx=investointi, else kulu). Only call with numeric tiliryhma. */
function inferTyyppi(tiliryhma: string): 'kulu' | 'tulo' | 'investointi' {
  const p = (tiliryhma || '').trim().charAt(0);
  if (p === '3') return 'tulo';
  if (p === '5') return 'investointi';
  return 'kulu';
}

/** Header patterns for account, name, amount (Swedish/Finnish/English). */
const PATTERNS = {
  tiliryhma: [/konto|tili|account|code|koodi|tiliryhm/i],
  nimi: [/namn|nimi|name|benämning|kuvaus|beskrivning|description|selite/i],
  summa: [/belopp|summa|amount|määrä|maara|euro|eur|budget/i],
};

/** Prefer column header that explicitly means Budget (FI/SV/EN). */
const BUDGET_HEADER = /^budget$|^budjetti$|^talousarvio$/i;

/** Numeric account code (3–6 digits). */
const ACCOUNT_CODE_REGEX = /^\d{3,6}$/;

/** Max columns to scan for account cell when detecting budget block (0-based, inclusive). */
const MAX_ACCOUNT_SCAN_COLS = 6;
/** Max data rows to scan below header to find first numeric account. */
const MAX_ACCOUNT_SCAN_ROWS = 5;

/**
 * Robust cell-to-text for ExcelJS cell.value: string/number/boolean, richText, text, formula/result, etc.
 */
function getCellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'object') return String(value);
  const v = value as Record<string, unknown>;
  if (Array.isArray(v.richText)) {
    return (v.richText as Array<{ text?: string }>)
      .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
      .join('');
  }
  if (typeof v.text === 'string') return v.text;
  if (v.formula != null && v.result !== undefined) return getCellText(v.result);
  if (v.result !== undefined) return getCellText(v.result);
  return String(value);
}

function getRowCells(sheet: any, rowIndex: number): string[] {
  const row = sheet.getRow(rowIndex);
  const cells: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
    cells[colNumber - 1] = getCellText(cell?.value).trim();
  });
  return cells;
}

/** Returns true if this row looks like a section header (has account + name/summa + optional Budget). */
function isSectionHeaderRow(cells: string[]): boolean {
  const t = cells.findIndex((c) => PATTERNS.tiliryhma.some((p) => p.test(c)));
  const n = cells.findIndex((c) => PATTERNS.nimi.some((p) => p.test(c)));
  const s = cells.findIndex((c) => PATTERNS.summa.some((p) => p.test(c)));
  return t >= 0 && (n >= 0 || s >= 0);
}

interface SectionHeaderResult {
  rowIndex: number;
  colMap: { tiliryhma: number; nimi: number; summa: number };
  usedBudgetColumn: boolean;
  budgetColumnLabel?: string;
}

function detectSectionHeader(sheet: any, headerRowIndex: number): SectionHeaderResult {
  const cells = getRowCells(sheet, headerRowIndex);
  const colMap = { tiliryhma: -1, nimi: -1, summa: -1 };
  const t = cells.findIndex((c) => PATTERNS.tiliryhma.some((p) => p.test(c)));
  const n = cells.findIndex((c) => PATTERNS.nimi.some((p) => p.test(c)));
  const s = cells.findIndex((c) => PATTERNS.summa.some((p) => p.test(c)));
  const budgetCol = cells.findIndex((c) => BUDGET_HEADER.test(c));
  const maxRows = sheet.rowCount ?? MAX_HEADER_SCAN;

  if (budgetCol >= 0) {
    if (t >= 0) {
      colMap.tiliryhma = t;
      colMap.nimi = n >= 0 ? n : t;
      colMap.summa = budgetCol;
      return {
        rowIndex: headerRowIndex,
        colMap,
        usedBudgetColumn: true,
        budgetColumnLabel: (cells[budgetCol] ?? '').trim() || 'Budget',
      };
    }
    const accountCol = findAccountColumnInNextRows(sheet, headerRowIndex, maxRows) ?? 0;
    colMap.tiliryhma = accountCol;
    colMap.nimi = accountCol + 1;
    colMap.summa = budgetCol;
    return {
      rowIndex: headerRowIndex,
      colMap,
      usedBudgetColumn: true,
      budgetColumnLabel: (cells[budgetCol] ?? '').trim() || 'Budget',
    };
  }

  if (t >= 0) {
    colMap.tiliryhma = t;
    colMap.nimi = n >= 0 ? n : t;
    colMap.summa = s >= 0 ? s : t + 1;
    if (colMap.summa === colMap.tiliryhma)
      colMap.summa = cells.length > colMap.tiliryhma + 1 ? colMap.tiliryhma + 1 : colMap.nimi + 1;
  }
  return {
    rowIndex: headerRowIndex,
    colMap: colMap.tiliryhma >= 0 ? colMap : { tiliryhma: 0, nimi: 1, summa: 2 },
    usedBudgetColumn: false,
  };
}

/**
 * Find the first column (0..MAX_ACCOUNT_SCAN_COLS) that contains a numeric account code
 * in the next 1..MAX_ACCOUNT_SCAN_ROWS rows. Returns column index or null if none.
 */
function findAccountColumnInNextRows(sheet: any, headerRowIndex: number, maxRows: number): number | null {
  const endRow = Math.min(headerRowIndex + MAX_ACCOUNT_SCAN_ROWS, maxRows);
  for (let r = headerRowIndex + 1; r <= endRow; r++) {
    const cells = getRowCells(sheet, r);
    for (let c = 0; c <= MAX_ACCOUNT_SCAN_COLS && c < cells.length; c++) {
      const v = (cells[c] ?? '').trim();
      if (ACCOUNT_CODE_REGEX.test(v)) return c;
    }
  }
  return null;
}

/**
 * Discovery helper: for each row that contains BUDGET_HEADER, find budgetCol and
 * accountCol (first numeric account in next 1–5 rows, cols 0..6). Used for inspection and tests.
 */
export function discoverBudgetBlockCandidates(
  sheet: { getRow: (r: number) => { eachCell: (opts: any, fn: (c: any, col: number) => void) => void } },
  maxRows: number,
): { headerRowIndex: number; budgetColumnIndex: number; accountColumnIndex: number; nameColumnIndex: number }[] {
  const result: { headerRowIndex: number; budgetColumnIndex: number; accountColumnIndex: number; nameColumnIndex: number }[] = [];
  const limit = Math.min(maxRows, MAX_HEADER_SCAN);
  for (let r = 1; r <= limit; r++) {
    const cells = getRowCells(sheet, r);
    const budgetCol = cells.findIndex((c) => BUDGET_HEADER.test(c));
    if (budgetCol < 0) continue;
    const accountCol = findAccountColumnInNextRows(sheet, r, maxRows);
    if (accountCol == null) continue;
    result.push({
      headerRowIndex: r,
      budgetColumnIndex: budgetCol,
      accountColumnIndex: accountCol,
      nameColumnIndex: accountCol + 1,
    });
  }
  return result;
}

/**
 * Returns true if this row is a "row-76-style" header: contains "Budget" (or FI/SV variant)
 * and the next 1–5 rows have a numeric account code in columns 0..6.
 */
function isBudgetOnlyHeaderRow(sheet: any, rowIndex: number, maxRows: number): boolean {
  const cells = getRowCells(sheet, rowIndex);
  const hasBudget = cells.some((c) => BUDGET_HEADER.test(c));
  if (!hasBudget) return false;
  return findAccountColumnInNextRows(sheet, rowIndex, maxRows) !== null;
}

/** Find all row indices in the sheet that look like section headers, scanning up to maxRows. */
function findSectionHeaderRows(sheet: any, maxRows: number): number[] {
  const scanRows = Math.min(maxRows, MAX_HEADER_SCAN);
  const indices: number[] = [];
  for (let r = 1; r <= scanRows; r++) {
    const cells = getRowCells(sheet, r);
    if (isSectionHeaderRow(cells)) {
      indices.push(r);
    } else if (r < scanRows && isBudgetOnlyHeaderRow(sheet, r, scanRows)) {
      indices.push(r);
    }
  }
  return indices;
}

/** Try to detect year from header row (e.g. "2026" column). */
function detectYear(sheet: any, headerRowIndex: number): number | null {
  const cells = getRowCells(sheet, headerRowIndex);
  for (const c of cells) {
    const v = c?.trim() ?? '';
    if (/^20\d{2}$/.test(v)) return parseInt(v, 10);
  }
  return null;
}

/**
 * Parse one section (header at headerRowIndex, data until dataEndRow inclusive).
 */
function parseSection(
  sheet: any,
  headerRowIndex: number,
  dataEndRow: number,
  sheetName: string,
): {
  lines: VaImportBudgetLine[];
  skippedNonAccount: number;
  usedBudgetColumn: boolean;
  budgetColumnLabel?: string;
  budgetColumnIndex: number;
} {
  const header = detectSectionHeader(sheet, headerRowIndex);
  const { colMap, usedBudgetColumn, budgetColumnLabel } = header;
  const lines: VaImportBudgetLine[] = [];
  let skippedNonAccount = 0;
  let consecutiveEmptyAccount = 0;
  const EMPTY_ACCOUNT_THRESHOLD = 2;

  for (let r = headerRowIndex + 1; r <= dataEndRow; r++) {
    const cells = getRowCells(sheet, r);
    const tiliryhma = colMap.tiliryhma >= 0 ? (cells[colMap.tiliryhma] ?? '').trim() : '';
    const nimi = colMap.nimi >= 0 ? (cells[colMap.nimi] ?? '').trim() : '';
    const summaRaw = colMap.summa >= 0 ? (cells[colMap.summa] ?? '').trim() : '';

    if (!isNumericAccountCode(tiliryhma)) {
      skippedNonAccount++;
      const accountEmpty = !(tiliryhma ?? '').trim();
      if (accountEmpty) {
        consecutiveEmptyAccount++;
        if (consecutiveEmptyAccount >= EMPTY_ACCOUNT_THRESHOLD) break;
      } else {
        consecutiveEmptyAccount = 0;
      }
      if (accountEmpty && summaRaw && !isNaN(parseAmount(summaRaw))) {
        break;
      }
      continue;
    }
    consecutiveEmptyAccount = 0;
    if (!nimi && !summaRaw) continue;

    const summa = parseAmount(summaRaw);
    if (isNaN(summa)) continue;
    const amount = Math.abs(summa);
    if (amount === 0) continue;

    const tyyppi = inferTyyppi(tiliryhma);
    lines.push({
      tiliryhma: tiliryhma || '9999',
      nimi: nimi || `Rivi ${tiliryhma || r}`,
      tyyppi,
      summa: amount,
    });
  }

  return {
    lines,
    skippedNonAccount,
    usedBudgetColumn,
    budgetColumnLabel,
    budgetColumnIndex: colMap.summa >= 0 ? colMap.summa : 2,
  };
}

const BUDGET_SHEET_NAME = 'Blad1';
const KVA_TOTALT_SHEET = 'KVA totalt';
const VATTEN_KVA_SHEET = 'Vatten KVA';
const AVLOPP_KVA_SHEET = 'Avlopp KVA';
const ANSLUTNINGAR_SHEET = 'Anslutningar';

/** Parse number from cell; return null if not a valid number. */
function parseNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = parseAmount(raw);
  return isNaN(n) ? null : n;
}

/** Match year in cell (e.g. 2023, 2026). */
function parseYearCell(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (/^20\d{2}$/.test(s)) return parseInt(s, 10);
  const n = parseFloat(s);
  if (!isNaN(n) && n >= 2000 && n <= 2100 && Math.floor(n) === n) return n;
  return null;
}

/** Find columns that contain a year (20xx) in the first maxRows. Returns [{ colIndex, year }] from first header-like row. */
function getYearColumnsInSheet(sheet: any, maxRows: number): { colIndex: number; year: number }[] {
  const out: { colIndex: number; year: number }[] = [];
  const limit = Math.min(maxRows, sheet.rowCount ?? 0);
  for (let r = 1; r <= limit; r++) {
    const cells = getRowCells(sheet, r);
    for (let c = 0; c < cells.length; c++) {
      const y = parseYearCell(cells[c]);
      if (y != null && !out.some((o) => o.colIndex === c)) out.push({ colIndex: c, year: y });
    }
    if (out.length > 0) break;
  }
  return out;
}

/** Normalize cell text for price-table detection: lower, trim, collapse whitespace, remove parens, m³->m3, €->eur. */
function normalizeCellForDetection(raw: unknown): string {
  let s = String(raw ?? '').trim().toLowerCase();
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\([^)]*\)/g, '').trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/€/g, 'eur').replace(/m³|m\^3/gi, 'm3');
  return s;
}

/** Parse VAT rate from cell using /moms\s*([0-9]+([.,][0-9]+)?)\s*%/i; returns e.g. 0, 24, 25.5. */
function parseVatRateFromCell(cell: string): number | null {
  const m = cell.match(/moms\s*([0-9]+([.,][0-9]+)?)\s*%/i);
  if (!m) return null;
  const num = (m[1] ?? '').replace(',', '.');
  const rate = parseFloat(num);
  return isNaN(rate) ? null : rate;
}

/** Volume: only rows whose label clearly contains m³/m3 (exclude revenue like Försäljningsintäkter). */
const VOLUME_LABELS_M3 = /m³|m3/i;
const VOLUME_EXCLUDE = /försäljningsintäkter|intäkter\s*\(|omsättning|revenue/i;
/** Connection count labels. */
const CONNECTION_LABELS = /antalet\s*anslutningar|anslutningar\s*antal|liittymät|liittymä\s*määrä|liittyma|connections\s*count|antal\s*anslutning|anslut/i;

const PRICE_TABLE_SCAN_ROWS = 300;
/** Price table: only these sheets (ignore Boksluten etc.). */
const PRICE_SHEETS_ONLY = [KVA_TOTALT_SHEET, BUDGET_SHEET_NAME];

/** Result of block-based price table detection (VAT header row + Vatten/Avlopp). */
interface PriceTableResult {
  sheet: any;
  sheetName: string;
  headerRowIndex: number; // 1-based VAT header row
  priceCol: number;
  chosenVatRate: number | undefined;
  vatColumnsFound: number[];
}

/**
 * Find the price table in KVA totalt or Blad1 only. Block-based: allows split rows.
 * (a) VAT header row (contains "moms" and %) with "pris"+m3 within ±3 rows; OR
 * (b) Row with "pris"+m3 and VAT header within +1..+3 rows.
 * Then: VAT columns from regex, prefer 25.5 > 24 > 0; Vatten/Avlopp in next 1..10 rows.
 */
function findPriceTable(workbook: Workbook): PriceTableResult | null {
  const sheets = workbook.worksheets ?? [];
  for (const priorityName of PRICE_SHEETS_ONLY) {
    const sheet = sheets.find((s) => (s.name || '').trim() === priorityName);
    if (!sheet) continue;
    const name = (sheet.name ?? '').trim() || priorityName;
    const maxRows = Math.min(sheet.rowCount ?? 0, PRICE_TABLE_SCAN_ROWS);

    let vatHeaderRow: number | null = null;
    for (let r = 1; r <= maxRows; r++) {
      const cells = getRowCells(sheet, r);
      const normalizedRow = cells.map(normalizeCellForDetection).join(' ');
      const hasMoms = /moms/i.test(normalizedRow) && /%/.test(normalizedRow);
      const hasPrisM3 = normalizedRow.includes('pris') && (/eur\/m3|€\/m³|m3/.test(normalizedRow) || normalizedRow.includes('m3'));

      if (hasMoms) {
        for (let dr = -3; dr <= 3; dr++) {
          const rr = r + dr;
          if (rr < 1 || rr > maxRows) continue;
          const near = getRowCells(sheet, rr);
          const nearNorm = near.map(normalizeCellForDetection).join(' ');
          const nearPris = nearNorm.includes('pris');
          const nearM3 = /eur\/m3|€\/m³|m3/.test(nearNorm) || nearNorm.includes('m3');
          if (nearPris && nearM3) {
            vatHeaderRow = r;
            break;
          }
        }
        if (vatHeaderRow != null) break;
      }
      if (vatHeaderRow == null && hasPrisM3) {
        for (let dr = 1; dr <= 3 && r + dr <= maxRows; dr++) {
          const rowCells = getRowCells(sheet, r + dr);
          const rowNorm = rowCells.map(normalizeCellForDetection).join(' ');
          if (/moms/i.test(rowNorm) && /%/.test(rowNorm)) {
            vatHeaderRow = r + dr;
            break;
          }
        }
      }
      if (vatHeaderRow != null) break;
    }

    if (vatHeaderRow == null) continue;

    let foundVatten = false;
    let foundAvlopp = false;
    for (let dr = 1; dr <= 10 && vatHeaderRow + dr <= maxRows; dr++) {
      const dataCells = getRowCells(sheet, vatHeaderRow + dr);
      const dataText = dataCells.map(normalizeCellForDetection).join(' ');
      if (/vatten|vesi/.test(dataText)) foundVatten = true;
      if (/avlopp|jätevesi|jatevesi/.test(dataText)) foundAvlopp = true;
    }
    if (!foundVatten || !foundAvlopp) continue;

    const vatRateToCol: Map<number, number> = new Map();
    for (let dr = -1; dr <= 1; dr++) {
      const rr = vatHeaderRow + dr;
      if (rr < 1 || rr > maxRows) continue;
      const headerRowCells = getRowCells(sheet, rr);
      for (let c = 0; c < headerRowCells.length; c++) {
        const rate = parseVatRateFromCell(headerRowCells[c] ?? '');
        if (rate != null && !vatRateToCol.has(rate)) vatRateToCol.set(rate, c);
      }
    }
    const vatColumnsFound = [...vatRateToCol.keys()].sort((a, b) => a - b);
    let priceCol: number;
    let chosenVatRate: number | undefined;
    if (vatRateToCol.has(25.5)) {
      priceCol = vatRateToCol.get(25.5)!;
      chosenVatRate = 25.5;
    } else if (vatRateToCol.has(24)) {
      priceCol = vatRateToCol.get(24)!;
      chosenVatRate = 24;
    } else if (vatRateToCol.has(0)) {
      priceCol = vatRateToCol.get(0)!;
      chosenVatRate = 0;
    } else if (vatColumnsFound.length > 0) {
      const first = vatColumnsFound[0]!;
      priceCol = vatRateToCol.get(first)!;
      chosenVatRate = first;
    } else {
      priceCol = 1;
      chosenVatRate = undefined;
    }
    return {
      sheet,
      sheetName: name,
      headerRowIndex: vatHeaderRow,
      priceCol,
      chosenVatRate,
      vatColumnsFound,
    };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tier A: Subtotal-level P&L extraction from KVA summary sheets
// ──────────────────────────────────────────────────────────────────────────────

/** Category token → stable key + type mapping for Swedish/Finnish P&L labels. */
interface SubtotalCategory {
  categoryKey: string;
  type: ValisummaType;
  /** Regex tokens to match (tested against full normalized row label). */
  pattern: RegExp;
}

/**
 * Ordered list of subtotal categories. First match wins.
 * Patterns are tested against the lowercase, trimmed first-cell label text.
 */
const SUBTOTAL_CATEGORIES: SubtotalCategory[] = [
  // Income
  { categoryKey: 'sales_revenue', type: 'income', pattern: /försäljningsintäkter|omsättning|myyntituotot|sales\s*revenue|turnover/i },
  { categoryKey: 'connection_fees', type: 'income', pattern: /anslutningsavgifter|liittymismaksut|connection\s*fees/i },
  { categoryKey: 'other_income', type: 'income', pattern: /övriga\s*(rörelse)?intäkter|muut\s*tuotot|other\s*(operating\s*)?income/i },
  // Costs
  { categoryKey: 'materials_services', type: 'cost', pattern: /material\s*och\s*tjänster|materiaalit\s*ja\s*palvelut|materials?\s*(and|&)\s*services/i },
  { categoryKey: 'personnel_costs', type: 'cost', pattern: /personalkostnader|lönebikostnader|löner|henkilöstökulut|personnel\s*costs|salaries|payroll/i },
  { categoryKey: 'other_costs', type: 'cost', pattern: /övriga\s*(rörelse)?kostnader|muut\s*kulut|other\s*(operating\s*)?costs/i },
  { categoryKey: 'purchased_services', type: 'cost', pattern: /köpta\s*tjänster|ostetut\s*palvelut|purchased\s*services/i },
  { categoryKey: 'rents', type: 'cost', pattern: /hyror|vuokrat|rents/i },
  // Depreciation
  { categoryKey: 'depreciation', type: 'depreciation', pattern: /avskrivningar|nedskrivningar|poistot|depreciation|amortization/i },
  // Financial
  { categoryKey: 'financial_income', type: 'financial', pattern: /finansiella\s*intäkter|rahoitustuotot|financial\s*income/i },
  { categoryKey: 'financial_costs', type: 'financial', pattern: /finansiella\s*kostnader|räntekostnader|rahoituskulut|financial\s*costs|interest/i },
  // Investments
  { categoryKey: 'investments', type: 'investment', pattern: /investeringar|investoinnit|investments/i },
  // Result (computed — not used as projection inputs)
  { categoryKey: 'operating_result', type: 'result', pattern: /rörelseresultat|liiketoiminnan\s*tulos|operating\s*result/i },
  { categoryKey: 'net_result', type: 'result', pattern: /årets\s*resultat|resultat\s*efter|räkenskapsperiodens\s*resultat|tilikauden\s*tulos|net\s*result/i },
];

/**
 * Rows matching this pattern are delta/change labels, NOT base amounts.
 * They should be excluded from subtotal extraction.
 */
const SUBTOTAL_EXCLUDE = /förändring\s*i|change\s*in|muutos\s/i;

/** Match a label against SUBTOTAL_CATEGORIES. Returns the first match or null.
 *  Excludes delta/change rows (SUBTOTAL_EXCLUDE) before matching. */
function matchSubtotalCategory(label: string): SubtotalCategory | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  // Skip "Förändring i..." / "Change in..." delta rows
  if (SUBTOTAL_EXCLUDE.test(normalized)) return null;
  for (const cat of SUBTOTAL_CATEGORIES) {
    if (cat.pattern.test(normalized)) return cat;
  }
  return null;
}

/**
 * Detect year columns in a sheet by scanning the first maxRows rows.
 * Returns all { colIndex, year } pairs found in the first row that has year cells.
 * (Re-uses existing getYearColumnsInSheet internally but returns a richer result.)
 */
function getYearColumnsInSheetMultiRow(sheet: any, maxRows: number): { colIndex: number; year: number }[] {
  const out: { colIndex: number; year: number }[] = [];
  const limit = Math.min(maxRows, sheet.rowCount ?? 0);
  for (let r = 1; r <= limit; r++) {
    const cells = getRowCells(sheet, r);
    const rowYears: { colIndex: number; year: number }[] = [];
    for (let c = 0; c < cells.length; c++) {
      const y = parseYearCell(cells[c]);
      if (y != null) rowYears.push({ colIndex: c, year: y });
    }
    // Use first row that has at least one year cell (real workbooks typically have many)
    if (rowYears.length >= 1) {
      for (const yc of rowYears) {
        if (!out.some((o) => o.colIndex === yc.colIndex)) out.push(yc);
      }
      break;
    }
  }
  return out;
}

/** Rows with 2+ year cells are year-header rows; skip them as data. */
function isYearHeaderRow(cells: string[]): boolean {
  let yearCount = 0;
  for (const c of cells) {
    if (parseYearCell(c) != null) yearCount++;
    if (yearCount >= 2) return true;
  }
  return false;
}

/** Max rows to scan for P&L subtotals in a KVA summary sheet. */
const SUBTOTAL_SCAN_ROWS = 120;
/** Minimum blank rows before stopping scan. */
const BLANK_ROW_THRESHOLD = 5;

/**
 * Extract subtotal-level P&L lines from KVA summary sheets.
 * Searches KVA totalt (consolidated), Vatten KVA (vesi), Avlopp KVA (jatevesi).
 *
 * Returns lines + debug metadata.
 */
export function extractSubtotalLines(
  workbook: Workbook,
  budgetYear?: number | null,
): { lines: VaImportSubtotalLine[]; debug: VaImportSubtotalDebug; warnings: string[] } {
  const sheets = workbook.worksheets ?? [];
  const lines: VaImportSubtotalLine[] = [];
  const warnings: string[] = [];
  const sourceSheets: string[] = [];
  const allYearCols: number[] = [];
  let rowsMatched = 0;
  let rowsSkipped = 0;

  // Ordered list of sheets to extract from: consolidated first, then per-service
  const sheetTargets: { name: string; palvelutyyppi?: 'vesi' | 'jatevesi' }[] = [
    { name: KVA_TOTALT_SHEET },
    { name: VATTEN_KVA_SHEET, palvelutyyppi: 'vesi' },
    { name: AVLOPP_KVA_SHEET, palvelutyyppi: 'jatevesi' },
  ];

  // Collect all years across target sheets to determine selectedYear
  const yearSets: number[] = [];
  for (const target of sheetTargets) {
    const sheet = sheets.find((s) => (s.name || '').trim() === target.name);
    if (!sheet || (sheet.rowCount ?? 0) < 2) continue;
    const yCols = getYearColumnsInSheetMultiRow(sheet, 25);
    for (const yc of yCols) {
      if (!yearSets.includes(yc.year)) yearSets.push(yc.year);
    }
  }
  yearSets.sort((a, b) => a - b);

  const selectedYear =
    budgetYear != null && yearSets.includes(budgetYear)
      ? budgetYear
      : yearSets.length > 0
        ? yearSets[yearSets.length - 1]!
        : null;

  if (selectedYear == null) {
    warnings.push('Subtotal import: no year columns found in KVA summary sheets.');
    return {
      lines,
      debug: { sourceSheets, yearColumnsDetected: yearSets, selectedYear: 0, rowsMatched, rowsSkipped },
      warnings,
    };
  }

  for (const target of sheetTargets) {
    const sheet = sheets.find((s) => (s.name || '').trim() === target.name);
    if (!sheet || (sheet.rowCount ?? 0) < 2) continue;

    const sheetName = (sheet.name ?? '').trim();
    const yearCols = getYearColumnsInSheetMultiRow(sheet, 25);
    const yearCol = yearCols.find((yc) => yc.year === selectedYear);
    if (!yearCol) {
      // This sheet doesn't have the selected year — skip
      continue;
    }

    for (const yc of yearCols) {
      if (!allYearCols.includes(yc.year)) allYearCols.push(yc.year);
    }

    sourceSheets.push(sheetName);
    const maxRow = Math.min(sheet.rowCount ?? 0, SUBTOTAL_SCAN_ROWS);
    let blankStreak = 0;
    let sheetMatched = 0;

    for (let r = 1; r <= maxRow; r++) {
      const cells = getRowCells(sheet, r);
      if (isYearHeaderRow(cells)) {
        blankStreak = 0;
        continue;
      }

      // First non-empty cell is the label
      const label = (cells[0] ?? '').trim();
      if (!label) {
        blankStreak++;
        if (blankStreak >= BLANK_ROW_THRESHOLD) break;
        continue;
      }
      blankStreak = 0;

      const category = matchSubtotalCategory(label);
      if (!category) {
        rowsSkipped++;
        continue;
      }

      // Extract amount from the year column
      const rawAmount = cells[yearCol.colIndex];
      const amount = parseNumber(rawAmount);
      if (amount == null) {
        rowsSkipped++;
        continue;
      }

      lines.push({
        categoryKey: category.categoryKey,
        categoryName: label,
        type: category.type,
        amount,
        year: selectedYear,
        sourceSheet: sheetName,
        palvelutyyppi: target.palvelutyyppi,
      });
      rowsMatched++;
      sheetMatched++;
    }

    if (sheetMatched === 0) {
      warnings.push(`Subtotal import: no matching P&L rows found in "${sheetName}".`);
    }
  }

  if (sourceSheets.length === 0) {
    warnings.push('Subtotal import: no KVA summary sheets found; subtotal import not available.');
  }

  allYearCols.sort((a, b) => a - b);
  return {
    lines,
    debug: {
      sourceSheets,
      yearColumnsDetected: allYearCols,
      selectedYear,
      rowsMatched,
      rowsSkipped,
    },
    warnings,
  };
}

/**
 * Extract revenue drivers from KVA workbook (unit prices via findPriceTable; volume/connections from Vatten KVA, Avlopp KVA, Anslutningar).
 * Pushes at most one warning per missing category (prices, volume, connections). Does not warn "could not locate price table" when a table was found.
 */
export function previewKvaRevenueDrivers(
  workbook: Workbook,
  warnings: string[],
  budgetYear?: number | null,
): { drivers: VaImportRevenueDriver[]; driversDebug?: VaImportDriversDebug } {
  const drivers: VaImportRevenueDriver[] = [
    { palvelutyyppi: 'vesi' },
    { palvelutyyppi: 'jatevesi' },
  ];
  const sheets = workbook.worksheets ?? [];
  const driversDebug: VaImportDriversDebug = {};

  const priceTable = findPriceTable(workbook);
  if (priceTable != null) {
    driversDebug.priceSheetName = priceTable.sheetName;
    driversDebug.priceHeaderRowIndex = priceTable.headerRowIndex;
    driversDebug.priceVatColumnsFound = priceTable.vatColumnsFound;
    driversDebug.chosenVatRate = priceTable.chosenVatRate;

    const maxDataRows = Math.min(priceTable.sheet.rowCount ?? 0, priceTable.headerRowIndex + 10);
    for (let r = priceTable.headerRowIndex + 1; r <= maxDataRows; r++) {
      const cells = getRowCells(priceTable.sheet, r);
      const firstCol = normalizeCellForDetection(cells[0] ?? '');
      const rowText = cells.map(normalizeCellForDetection).join(' ');
      const isWater = /vatten|vesi/.test(firstCol) || /vatten|vesi/.test(rowText);
      const isWastewater = /avlopp|jätevesi|jatevesi/.test(firstCol) || /avlopp|jätevesi|jatevesi/.test(rowText);
      if (isWater) {
        const val = parseNumber(cells[priceTable.priceCol] ?? cells[1]);
        if (val != null && val > 0) {
          const existing = drivers.find((d) => d.palvelutyyppi === 'vesi');
          if (existing) {
            existing.yksikkohinta = val;
            existing.alvProsentti = priceTable.chosenVatRate;
          }
        }
      } else if (isWastewater) {
        const val = parseNumber(cells[priceTable.priceCol] ?? cells[1]);
        if (val != null && val > 0) {
          const existing = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
          if (existing) {
            existing.yksikkohinta = val;
            existing.alvProsentti = priceTable.chosenVatRate;
          }
        }
      }
    }
  } else {
    warnings.push('Revenue drivers: could not locate "Pris" + "m3" price table; leaving unit prices empty.');
  }

  // --- Step 4: year selection and volume/connections ---
  const vattenKva = sheets.find((s) => (s.name || '').trim() === VATTEN_KVA_SHEET);
  const avloppKva = sheets.find((s) => (s.name || '').trim() === AVLOPP_KVA_SHEET);
  const anslutningar = sheets.find((s) => (s.name || '').trim() === ANSLUTNINGAR_SHEET);

  const YEAR_SCAN_ROWS = 25;
  const allYears: number[] = [];
  [vattenKva, avloppKva, anslutningar].forEach((sheet) => {
    if (sheet && (sheet.rowCount ?? 0) > 0) {
      getYearColumnsInSheet(sheet, YEAR_SCAN_ROWS).forEach(({ year }) => {
        if (!allYears.includes(year)) allYears.push(year);
      });
    }
  });
  allYears.sort((a, b) => a - b);
  const selectedYear =
    budgetYear != null
      ? budgetYear
      : allYears.length > 0
        ? allYears[allYears.length - 1]
        : null;
  if (selectedYear != null) driversDebug.selectedYear = selectedYear;

  let foundVolume = false;
  let usedSingleVolumeWarning = false;

  function isHeaderRow(cells: string[]): boolean {
    return cells.slice(0, 8).some((c) => parseYearCell(c) != null);
  }

  function extractVolumeFromSheet(sheet: any, sheetName: string, forVesi: boolean): void {
    if (!sheet || (sheet.rowCount ?? 0) < 2) return;
    const rowLimit = Math.min(sheet.rowCount ?? 0, 80);
    const yearCols = getYearColumnsInSheet(sheet, YEAR_SCAN_ROWS);
    const yearCol = selectedYear != null ? yearCols.find((yc) => yc.year === selectedYear) : undefined;

    for (let row = 1; row <= rowLimit; row++) {
      const cells = getRowCells(sheet, row);
      if (isHeaderRow(cells)) continue;
      const rowText = (cells[0] ?? '').trim();
      const rowTextLower = rowText.toLowerCase();
      if (VOLUME_EXCLUDE.test(rowTextLower)) continue;
      if (!VOLUME_LABELS_M3.test(rowText)) continue;
      const numericValues: number[] = [];
      let valueAtYear: number | null = null;
      for (let c = 0; c < cells.length; c++) {
        const n = parseNumber(cells[c]);
        if (n != null && n >= 0 && n < 1e9) {
          numericValues.push(n);
          if (yearCol && c === yearCol.colIndex) valueAtYear = n;
        }
      }
      const value = yearCol ? valueAtYear : numericValues.length === 1 ? numericValues[0]! : numericValues[0] ?? null;
      if (value != null && value >= 0) {
        const d = drivers.find((x) => x.palvelutyyppi === (forVesi ? 'vesi' : 'jatevesi'));
        if (d) {
          d.myytyMaara = value;
          foundVolume = true;
          driversDebug.volumeSheet = driversDebug.volumeSheet ?? sheetName;
          driversDebug.volumeLabel = driversDebug.volumeLabel ?? (cells[0] ?? '').trim().substring(0, 40);
        }
        if (!yearCol && numericValues.length === 1 && !usedSingleVolumeWarning) {
          warnings.push('Revenue drivers: could not find a year column for volume; used the only available value.');
          usedSingleVolumeWarning = true;
        }
        return;
      }
    }
  }

  extractVolumeFromSheet(vattenKva, VATTEN_KVA_SHEET, true);
  extractVolumeFromSheet(avloppKva, AVLOPP_KVA_SHEET, false);

  let foundConnections = false;
  if (anslutningar && (anslutningar.rowCount ?? 0) >= 2) {
    const rowLimit = Math.min(anslutningar.rowCount ?? 0, 50);
    const yearCols = getYearColumnsInSheet(anslutningar, YEAR_SCAN_ROWS);
    const yearCol = selectedYear != null ? yearCols.find((yc) => yc.year === selectedYear) : undefined;

    for (let row = 1; row <= rowLimit; row++) {
      const cells = getRowCells(anslutningar, row);
      if (isHeaderRow(cells)) continue;
      for (let c = 0; c < cells.length; c++) {
        const v = (cells[c] ?? '').trim().toLowerCase();
        if (!CONNECTION_LABELS.test(v)) continue;
        const numericValues: number[] = [];
        let valueAtYear: number | null = null;
        for (let cc = 0; cc < cells.length; cc++) {
          const n = parseNumber(cells[cc]);
          if (n != null && n >= 0 && n < 1e9) {
            numericValues.push(n);
            if (yearCol && cc === yearCol.colIndex) valueAtYear = n;
          }
        }
        const value = yearCol ? valueAtYear : numericValues.length === 1 ? numericValues[0]! : numericValues[0] ?? null;
        if (value != null && value >= 0) {
          drivers.forEach((d) => { d.liittymamaara = value; });
          foundConnections = true;
          driversDebug.connectionSheet = ANSLUTNINGAR_SHEET;
          driversDebug.connectionYearCol = yearCol?.colIndex;
          break;
        }
      }
      if (foundConnections) break;
    }
  }

  if (!foundVolume) {
    warnings.push('Revenue drivers: could not locate volume in template; leaving empty.');
  }
  if (!foundConnections) {
    warnings.push('Revenue drivers: could not locate connection count in template; leaving empty.');
  }

  return {
    drivers,
    driversDebug: Object.keys(driversDebug).length > 0 ? driversDebug : undefined,
  };
}


/** De-duplicate by (tiliryhma + nimi + tyyppi): keep first with non-zero summa, else first. */
function dedupeBudgetLines(lines: VaImportBudgetLine[]): VaImportBudgetLine[] {
  const seen = new Map<string, VaImportBudgetLine>();
  for (const line of lines) {
    const key = `${line.tiliryhma}|${line.nimi}|${line.tyyppi}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, line);
    } else if (existing.summa === 0 && line.summa !== 0) {
      seen.set(key, line);
    }
  }
  return Array.from(seen.values());
}

/**
 * KVA template adapter: preview parse only (no DB writes).
 * Budget lines are imported from Blad1 only; all section blocks in that sheet are scanned and aggregated.
 */
export async function previewKvaWorkbook(workbook: Workbook): Promise<VaImportPreview> {
  const warnings: string[] = [];
  const budgetLines: VaImportBudgetLine[] = [];
  const processedSheets: VaImportProcessedSheet[] = [];
  let year: number | null = null;
  let amountColumnUsed: string | undefined;
  const countsByType = { tulo: 0, kulu: 0, investointi: 0 };
  let kvaDebug: VaImportKvaDebug | undefined;

  const sheets = workbook.worksheets ?? [];
  if (sheets.length === 0) {
    return {
      templateId: TEMPLATE_ID,
      year: null,
      budgetLines: [],
      revenueDrivers: [],
      assumptions: [],
      warnings: ['Workbook has no worksheets'],
    };
  }

  const blad1 = sheets.find((s) => (s.name || '').trim() === BUDGET_SHEET_NAME);
  if (!blad1) {
    warnings.push(`Sheet "${BUDGET_SHEET_NAME}" not found; no budget lines imported.`);
    processedSheets.push({ sheetName: BUDGET_SHEET_NAME, lines: 0, skipped: true, reason: 'Sheet not found' });
    return {
      templateId: TEMPLATE_ID,
      year: null,
      budgetLines: [],
      revenueDrivers: [],
      assumptions: [],
      warnings,
      amountColumnUsed,
      countsByType,
      processedSheets,
      kvaDebug,
    };
  }

  const sheetName = blad1.name || BUDGET_SHEET_NAME;
  const rowCount = blad1.rowCount ?? 0;
  if (rowCount < 2) {
    warnings.push(`Sheet "${sheetName}": insufficient rows for budget import.`);
    processedSheets.push({ sheetName, lines: 0, skipped: true, reason: 'Insufficient rows' });
    return {
      templateId: TEMPLATE_ID,
      year: null,
      budgetLines: [],
      revenueDrivers: [],
      assumptions: [],
      warnings,
      amountColumnUsed,
      countsByType,
      processedSheets,
      kvaDebug,
    };
  }

  const headerRows = findSectionHeaderRows(blad1, rowCount);
  if (headerRows.length === 0) {
    warnings.push(`Sheet "${sheetName}": no section header row found in first ${MAX_HEADER_SCAN} rows.`);
    processedSheets.push({ sheetName, lines: 0, skipped: true, reason: 'No header row found' });
    return {
      templateId: TEMPLATE_ID,
      year: null,
      budgetLines: [],
      revenueDrivers: [],
      assumptions: [],
      warnings,
      amountColumnUsed,
      countsByType,
      processedSheets,
      kvaDebug,
    };
  }

  const allLines: VaImportBudgetLine[] = [];
  let sectionUsedBudget = false;
  let sectionBudgetLabel: string | undefined;
  let totalSkippedNonAccount = 0;
  const blockCount = headerRows.length;
  const blockAccountRanges: Array<{ headerRowIndex: number; firstAccount: string; lastAccount: string; lineCount: number }> = [];

  for (let i = 0; i < headerRows.length; i++) {
    const headerRowIndex = headerRows[i];
    const dataEndRow = i < headerRows.length - 1 ? headerRows[i + 1] - 1 : rowCount;
    const {
      lines,
      skippedNonAccount,
      usedBudgetColumn,
      budgetColumnLabel,
      budgetColumnIndex,
    } = parseSection(blad1, headerRowIndex, dataEndRow, sheetName);
    totalSkippedNonAccount += skippedNonAccount;
    if (usedBudgetColumn) {
      sectionUsedBudget = true;
      sectionBudgetLabel = budgetColumnLabel;
    } else if (lines.length > 0) {
      warnings.push(
        `Could not detect Budget column; using fallback amount column (header row ${headerRowIndex}).`,
      );
    }
    for (const line of lines) {
      allLines.push(line);
    }
    if (lines.length > 0) {
      const accounts = lines.map((l) => l.tiliryhma).filter(Boolean);
      blockAccountRanges.push({
        headerRowIndex,
        firstAccount: accounts[0] ?? '',
        lastAccount: accounts[accounts.length - 1] ?? '',
        lineCount: lines.length,
      });
      if (!kvaDebug) {
        kvaDebug = {
          detectedSheetName: sheetName,
          detectedHeaderRowIndex: headerRowIndex,
          budgetColumnIndex,
          parsedRowCount: lines.length,
          firstParsedAccount: accounts[0] ?? '',
          lastParsedAccount: accounts[accounts.length - 1] ?? '',
          totalParsedRowCount: undefined,
          blockAccountRanges: undefined,
        };
      }
    }
  }
  if (kvaDebug && blockAccountRanges.length > 0) {
    kvaDebug.blockAccountRanges = blockAccountRanges;
  }

  const totalParsedRowCount = allLines.length;
  if (kvaDebug) {
    kvaDebug.totalParsedRowCount = totalParsedRowCount;
  }

  const deduped = dedupeBudgetLines(allLines);
  for (const line of deduped) {
    budgetLines.push(line);
    countsByType[line.tyyppi]++;
  }

  if (year == null) {
    year = detectYear(blad1, headerRows[0]);
  }
  if (!sectionUsedBudget && budgetLines.length > 0) {
    amountColumnUsed = amountColumnUsed ?? 'Belopp (fallback)';
  } else if (sectionUsedBudget) {
    amountColumnUsed = sectionBudgetLabel ?? 'Budget';
  }
  if (totalSkippedNonAccount > 0) {
    warnings.push(
      `Skipped ${totalSkippedNonAccount} non-account rows (e.g. section headers like "Förverkligat").`,
    );
  }

  if (budgetLines.length > 0 && blockCount >= 2) {
    const hasRevenueOrInvest = deduped.some(
      (l) => (l.tiliryhma || '').trim().startsWith('3') || (l.tiliryhma || '').trim().startsWith('5'),
    );
    const allKulu = countsByType.tulo === 0 && countsByType.investointi === 0;
    if (hasRevenueOrInvest && allKulu) {
      warnings.push(
        'Multiple blocks were detected but all lines are KULUT; 3xxx/5xxx accounts may have been misclassified.',
      );
    }
  }

  if (!amountColumnUsed && budgetLines.length > 0) {
    amountColumnUsed = 'Belopp (fallback)';
  }

  if (kvaDebug) {
    warnings.push(
      `[KVA_DEBUG] sheet=${kvaDebug.detectedSheetName} headerRow=${kvaDebug.detectedHeaderRowIndex} budgetCol=${kvaDebug.budgetColumnIndex} rows=${kvaDebug.parsedRowCount} totalRows=${kvaDebug.totalParsedRowCount ?? kvaDebug.parsedRowCount} accounts=${kvaDebug.firstParsedAccount}..${kvaDebug.lastParsedAccount}`,
    );
  }

  processedSheets.push({
    sheetName,
    lines: budgetLines.length,
    sections: headerRows.length,
  });

  const { drivers: revenueDrivers, driversDebug } = previewKvaRevenueDrivers(workbook, warnings, year);

  // Tier A: subtotal-level P&L extraction
  const subtotalResult = extractSubtotalLines(workbook, year);
  for (const w of subtotalResult.warnings) {
    warnings.push(w);
  }

  return {
    templateId: TEMPLATE_ID,
    year,
    budgetLines,
    revenueDrivers,
    assumptions: [],
    warnings,
    amountColumnUsed,
    countsByType,
    processedSheets,
    kvaDebug,
    driversDebug,
    subtotalLines: subtotalResult.lines.length > 0 ? subtotalResult.lines : undefined,
    subtotalDebug: subtotalResult.debug,
  };
}
