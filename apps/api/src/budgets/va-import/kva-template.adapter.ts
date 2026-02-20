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
  VaImportQuality,
  ValisummaType,
} from './va-import.types';
import { HISTORICAL_YEARS_FALLBACK_COUNT } from './va-import.types';

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

/** Read row with at least maxCols columns (1-based). Use when sparse eachCell may miss data in later columns. */
function getRowCellsWide(sheet: any, rowIndex: number, maxCols: number): string[] {
  const row = sheet.getRow(rowIndex);
  const cells: string[] = [];
  for (let col = 1; col <= maxCols; col++) {
    try {
      const cell = row.getCell(col);
      cells[col - 1] = getCellText(cell?.value).trim();
    } catch {
      cells[col - 1] = '';
    }
  }
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

/** Like getYearColumnsInSheet but uses getRowCellsWide so column indices align with wide data rows. */
function getYearColumnsInSheetWide(
  sheet: any,
  maxRows: number,
  maxCols: number,
): { colIndex: number; year: number }[] {
  const out: { colIndex: number; year: number }[] = [];
  const limit = Math.min(maxRows, sheet.rowCount ?? 0);
  for (let r = 1; r <= limit; r++) {
    const cells = getRowCellsWide(sheet, r, maxCols);
    for (let c = 0; c < cells.length; c++) {
      const y = parseYearCell(cells[c]);
      if (y != null && !out.some((o) => o.colIndex === c)) out.push({ colIndex: c, year: y });
    }
    if (out.length > 0) break;
  }
  return out;
}

/** Find year columns in a row range (e.g. rows near the connection table). */
function getYearColumnsInSheetWideRange(
  sheet: any,
  startRow: number,
  endRow: number,
  maxCols: number,
): { colIndex: number; year: number }[] {
  const out: { colIndex: number; year: number }[] = [];
  const limit = Math.min(endRow, sheet.rowCount ?? 0);
  for (let r = startRow; r <= limit; r++) {
    const cells = getRowCellsWide(sheet, r, maxCols);
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

/** Volume: rows whose label contains m³/m3, Swedish "volym", "förbrukning", "leverans", "mängd", "såld" (exclude revenue). */
const VOLUME_LABELS_M3 = /m³|m3|volym|förbrukning|leverans|mängd|såld\s*m³|uppmätt|uppumpat/i;
const VOLUME_EXCLUDE = /försäljningsintäkter|intäkter\s*\(|omsättning|revenue/i;
/** Connection count labels. */
const CONNECTION_LABELS = /antalet\s*anslutningar|anslutningar\s*antal|liittymät|liittymä\s*määrä|liittyma|connections\s*count|antal\s*anslutning|anslut/i;
const SALES_REVENUE_LABEL = /försäljningsintäkter|myyntituotot|sales\s*revenue|omsättning/i;

const PRICE_TABLE_SCAN_ROWS = 300;
/** Price table: only these sheets (ignore Boksluten etc.). */
const PRICE_SHEETS_ONLY = [KVA_TOTALT_SHEET, BUDGET_SHEET_NAME];

interface RevenueCellPick {
  amount: number;
  sheet: string;
  row: number;
  col: number;
  cellText: string;
}

function findYearColumn(
  sheet: any,
  maxHeaderRows: number,
  year: number,
): { colIndex: number; year: number } | undefined {
  return getYearColumnsInSheetWide(sheet, maxHeaderRows, 60).find((yc) => yc.year === year);
}

function extractServiceSalesRevenue(
  sheet: any,
  sheetName: string,
  selectedYear: number | null,
): RevenueCellPick | null {
  if (!sheet || selectedYear == null) return null;
  const yearCol = findYearColumn(sheet, 30, selectedYear);
  if (!yearCol) return null;
  const rowLimit = Math.min(sheet.rowCount ?? 0, 120);
  for (let row = 1; row <= rowLimit; row++) {
    const cells = getRowCellsWide(sheet, row, 60);
    const rowText = cells.map((c) => normalizeCellForDetection(c)).join(' ');
    if (!SALES_REVENUE_LABEL.test(rowText)) continue;
    const raw = cells[yearCol.colIndex];
    const amount = parseNumber(raw);
    if (amount == null || amount <= 0) continue;
    return {
      amount,
      sheet: sheetName,
      row,
      col: yearCol.colIndex + 1,
      cellText: String(raw ?? '').trim().slice(0, 80),
    };
  }
  return null;
}

/** Result of block-based price table detection (VAT header row + Vatten/Avlopp). */
interface PriceTableResult {
  sheet: any;
  sheetName: string;
  headerRowIndex: number; // 1-based VAT header row
  priceCol: number;       // Column to read price FROM (moms 0% if available = ex-VAT)
  chosenVatRate: number | undefined; // Highest VAT rate found (25.5 > 24), for alvProsentti
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
    // Strategy: read ex-VAT price from moms 0% column; store highest VAT rate as alvProsentti.
    // If no moms 0% column, fall back to the highest-rate column (user sees incl-VAT value).
    let priceCol: number;
    let chosenVatRate: number | undefined;

    // Determine the highest VAT rate for alvProsentti
    const nonZeroRates = vatColumnsFound.filter((r) => r > 0);
    if (nonZeroRates.length > 0) {
      chosenVatRate = Math.max(...nonZeroRates);
    } else if (vatColumnsFound.includes(0)) {
      chosenVatRate = 0;
    }

    // Prefer moms 0% column for reading ex-VAT price
    if (vatRateToCol.has(0)) {
      priceCol = vatRateToCol.get(0)!;
    } else if (chosenVatRate != null && vatRateToCol.has(chosenVatRate)) {
      priceCol = vatRateToCol.get(chosenVatRate)!;
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
  // Costs (order matters: more specific before generic)
  { categoryKey: 'materials_services', type: 'cost', pattern: /material\s*och\s*tjänster|materiaalit\s*ja\s*palvelut|materials?\s*(and|&)\s*services|el\s*och\s*värme|energi/i },
  { categoryKey: 'personnel_costs', type: 'cost', pattern: /personalkostnader|lönebikostnader|löner\s*och\s*sociala|löner|henkilöstökulut|personal\s*kostnader|personal\s*\(|^personal$|personnel\s*costs|salaries|payroll/i },
  { categoryKey: 'other_costs', type: 'cost', pattern: /övriga\s*(rörelse)?kostnader|muut\s*kulut|other\s*(operating\s*)?costs|driftskostnader|rörelsekostnader|driftkostnader|^kostnader\s*$|administration|extern/i },
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

/**
 * Rows matching this pattern are forecast/prognosis labels, not historical realized.
 * Excluded from subtotal extraction (we import only 3 historical years).
 */
const SUBTOTAL_EXCLUDE_FORECAST = /prognos|forecast|ennuste|budjetti\s*\d{4}|tulosennuste|resultatprognos|budget\s*\d{4}/i;

/** Col A values that are section/sheet headers, not P&L line labels. Use col B for label when A is one of these. */
const SUBTOTAL_SECTION_HEADERS = new Set<string>(['vattenbolag', 'verksamhetens kostnader']);

function isSubtotalSectionHeader(value: string): boolean {
  return SUBTOTAL_SECTION_HEADERS.has(value.trim().toLowerCase());
}

/** Reject cells that are purely numeric or a year (e.g. 2023) so we don't use them as labels. */
function isYearOrPureNumber(value: string): boolean {
  const s = (value ?? '').trim();
  if (!s) return true;
  return /^\d+$/.test(s);
}

/**
 * Best label for a subtotal row: prefer col A if it looks like a real label; else col B.
 * Deterministic; avoids section headers and year/numeric cells.
 */
function getBestSubtotalLabel(cells: (string | number | null | undefined)[]): string {
  const a = (cells[0] ?? '').toString().trim();
  const b = (cells[1] ?? '').toString().trim();
  if (a && !isSubtotalSectionHeader(a) && !isYearOrPureNumber(a)) return a;
  if (b && !isSubtotalSectionHeader(b) && !isYearOrPureNumber(b)) return b;
  return '';
}

/** Match a label against SUBTOTAL_CATEGORIES. Returns the first match and its order index, or null.
 *  Excludes delta/change rows (SUBTOTAL_EXCLUDE) and forecast/prognosis rows before matching. */
function matchSubtotalCategoryWithOrder(label: string): { category: SubtotalCategory; order: number } | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  // Skip "Förändring i..." / "Change in..." delta rows
  if (SUBTOTAL_EXCLUDE.test(normalized)) return null;
  // Skip forecast/prognosis rows
  if (SUBTOTAL_EXCLUDE_FORECAST.test(normalized)) return null;
  for (let i = 0; i < SUBTOTAL_CATEGORIES.length; i++) {
    const cat = SUBTOTAL_CATEGORIES[i]!;
    if (cat.pattern.test(normalized)) return { category: cat, order: i };
  }
  return null;
}

function matchSubtotalCategory(label: string): SubtotalCategory | null {
  const r = matchSubtotalCategoryWithOrder(label);
  return r?.category ?? null;
}

/**
 * Detect year columns in a sheet by scanning the first maxRows rows.
 * Returns all { colIndex, year } pairs found in the first row that has year cells.
 * (Re-uses existing getYearColumnsInSheet internally but returns a richer result.)
 */
const YEAR_SCAN_MAX_COLS = 30;

function getYearColumnsInSheetMultiRow(sheet: any, maxRows: number): { colIndex: number; year: number }[] {
  const out: { colIndex: number; year: number }[] = [];
  const limit = Math.min(maxRows, Math.max(sheet.rowCount ?? 0, 1));
  for (let r = 1; r <= limit; r++) {
    const cells =
      r === 1
        ? getRowCellsWide(sheet, r, YEAR_SCAN_MAX_COLS)
        : getRowCells(sheet, r);
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
const HISTORICAL_YEARS_COUNT = HISTORICAL_YEARS_FALLBACK_COUNT;

/**
 * Heuristic: cell has gray fill (historical vs forecast). Excel gray often uses theme tint.
 * Returns true when fill suggests gray; false otherwise. Used only when reliable across workbooks.
 */
function isGrayFill(cell: unknown): boolean {
  if (!cell || typeof cell !== 'object') return false;
  const c = cell as Record<string, unknown>;
  const fill = (c.fill ?? (c.style as Record<string, unknown>)?.fill) as { fgColor?: { theme?: number; tint?: number }; bgColor?: { theme?: number; tint?: number } } | undefined;
  if (!fill) return false;
  const fg = fill.fgColor ?? fill.bgColor;
  if (!fg) return false;
  if (fg.theme != null && fg.tint != null && fg.tint < 0 && fg.tint >= -1) return true;
  return false;
}

/**
 * Historical-year selector for KVA totalt: prefer style-aware gray detection when reliable,
 * else use earliest 3 year columns (deterministic fallback).
 */
export function getHistorical3YearsFromKvaTotalt(workbook: Workbook): number[] {
  const sheets = workbook.worksheets ?? [];
  const kvaTotalt = sheets.find((s) => (s.name || '').trim() === KVA_TOTALT_SHEET);
  if (!kvaTotalt || (kvaTotalt.rowCount ?? 0) < 2) return [];
  const yCols = getYearColumnsInSheetMultiRow(kvaTotalt, 25);
  if (yCols.length === 0) return [];

  const yearColsByYear = [...new Map(yCols.map((yc) => [yc.year, yc])).entries()].sort((a, b) => a[0]! - b[0]!);
  const yearsAsc = yearColsByYear.map(([y]) => y!);

  let historicalYears: number[] = [];
  const headerRowLimit = Math.min(3, kvaTotalt.rowCount ?? 1);
  for (let hr = 1; hr <= headerRowLimit; hr++) {
    const grayYears: number[] = [];
    for (const [year, yc] of yearColsByYear) {
      try {
        const row = kvaTotalt.getRow(hr);
        const cell = row.getCell(yc.colIndex + 1);
        if (isGrayFill(cell)) grayYears.push(year);
      } catch {
        // no-op
      }
    }
    if (grayYears.length >= 1 && grayYears.length <= yearsAsc.length) {
      historicalYears = grayYears.slice(0, HISTORICAL_YEARS_COUNT).sort((a, b) => a - b);
      break;
    }
  }

  if (historicalYears.length === 0) {
    historicalYears = getEarliest3YearColumns(yearsAsc);
  }
  return historicalYears;
}

/**
 * Deterministic fallback rule: when style is not detectable, return the earliest 3 year columns
 * in the KVA totals table (ascending). Used when isGrayFill finds no reliable pattern.
 */
export function getEarliest3YearColumns(yearsAsc: number[]): number[] {
  return yearsAsc.slice(0, HISTORICAL_YEARS_COUNT);
}

/** @deprecated Use getHistorical3YearsFromKvaTotalt. Kept for backward compatibility. */
export function getLatest3YearsFromKvaTotalt(workbook: Workbook): number[] {
  return getHistorical3YearsFromKvaTotalt(workbook);
}

/**
 * Extract subtotal-level P&L lines from KVA summary sheets.
 * Year selection: deterministic latest 3 years from sheet KVA totalt; extract amounts for each of those years.
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
  // Step 1 debug: why rows are skipped (no change to matching logic)
  let noLabelMatchCount = 0;
  let matchedExcludeCount = 0;
  let matchedForecastExcludeCount = 0;
  let amountMissingCount = 0;
  const noLabelMatchSamples = new Set<string>();
  const MAX_SAMPLE_LABELS = 30;

  // Single source for Talousarvio import (Option A): only KVA totalt; no Vatten KVA / Avlopp KVA to avoid duplicate underrows
  const sheetTargets: { name: string; palvelutyyppi?: 'vesi' | 'jatevesi' }[] = [
    { name: KVA_TOTALT_SHEET },
  ];

  // Historical 3 years from sheet KVA totalt only (earliest 3 = realized; style-aware when reliable)
  const latest3Years = getHistorical3YearsFromKvaTotalt(workbook);
  const selectedYears =
    latest3Years.length > 0
      ? latest3Years
      : (() => {
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
          const single =
            budgetYear != null && yearSets.includes(budgetYear)
              ? budgetYear
              : yearSets.length > 0
                ? yearSets[yearSets.length - 1]!
                : null;
          return single != null ? [single] : [];
        })();

  const selectedYear = selectedYears.length > 0 ? selectedYears[selectedYears.length - 1]! : 0;

  if (selectedYears.length === 0) {
    warnings.push('Subtotal import: no year columns found in KVA summary sheets.');
    return {
      lines,
      debug: { sourceSheets, yearColumnsDetected: [], selectedYear: 0, rowsMatched, rowsSkipped, skippedReasons: [] },
      warnings,
    };
  }

  for (const target of sheetTargets) {
    const sheet = sheets.find((s) => (s.name || '').trim() === target.name);
    if (!sheet || (sheet.rowCount ?? 0) < 2) continue;

    const sheetName = (sheet.name ?? '').trim();
    const yearCols = getYearColumnsInSheetMultiRow(sheet, 25);
    const yearColsForSelection = selectedYears
      .map((y) => yearCols.find((yc) => yc.year === y))
      .filter((yc): yc is { colIndex: number; year: number } => yc != null);
    // Extract for all year columns so client can choose 3 when Excel has >3 years
    const yearColsToExtract = yearCols.length > 0 ? yearCols : yearColsForSelection;
    if (yearColsToExtract.length === 0) continue;

    for (const yc of yearCols) {
      if (!allYearCols.includes(yc.year)) allYearCols.push(yc.year);
    }

    sourceSheets.push(sheetName);
    const maxRow = Math.min(sheet.rowCount ?? 0, SUBTOTAL_SCAN_ROWS);
    let blankStreak = 0;
    // One line per (sheet, year, categoryKey); last occurrence (by row index) wins to avoid double-counting e.g. Omsättning + Försäljningsintäkter
    const dedupeMap = new Map<string, { line: VaImportSubtotalLine; rowIndex: number }>();

    for (let r = 1; r <= maxRow; r++) {
      const cells = getRowCells(sheet, r);
      if (isYearHeaderRow(cells)) {
        blankStreak = 0;
        continue;
      }

      // Label: prefer col A if real label; else col B (section headers like "Vattenbolag" / "Verksamhetens kostnader" skipped)
      const label = getBestSubtotalLabel(cells);
      if (!label) {
        blankStreak++;
        if (blankStreak >= BLANK_ROW_THRESHOLD) break;
        continue;
      }
      blankStreak = 0;

      const normalized = label.trim().toLowerCase();
      if (SUBTOTAL_EXCLUDE.test(normalized)) {
        matchedExcludeCount++;
        rowsSkipped++;
        continue;
      }
      if (SUBTOTAL_EXCLUDE_FORECAST.test(normalized)) {
        matchedForecastExcludeCount++;
        rowsSkipped++;
        continue;
      }

      const matched = matchSubtotalCategoryWithOrder(label);
      if (!matched) {
        noLabelMatchCount++;
        if (noLabelMatchSamples.size < MAX_SAMPLE_LABELS) noLabelMatchSamples.add(label);
        rowsSkipped++;
        continue;
      }
      const { category, order } = matched;

      // Extract amount for every year column (so client can pick 3 when file has >3 years)
      // Sign convention Option A (ADR-021): store all amounts as positive (cost/depreciation/investment often negative in Excel).
      for (const yc of yearColsToExtract) {
        const rawAmount = cells[yc.colIndex];
        const parsed = parseNumber(rawAmount);
        if (parsed == null) {
          amountMissingCount++;
          rowsSkipped++;
          continue;
        }
        const amount = Math.abs(parsed);
        const key = `${sheetName}:${yc.year}:${category.categoryKey}`;
        const existing = dedupeMap.get(key);
        if (!existing || existing.rowIndex < r) {
          dedupeMap.set(key, {
            line: {
              categoryKey: category.categoryKey,
              categoryName: label,
              type: category.type,
              amount,
              year: yc.year,
              sourceSheet: sheetName,
              palvelutyyppi: target.palvelutyyppi,
              level: 0,
              order,
            },
            rowIndex: r,
          });
        }
      }
    }

    const flushed = Array.from(dedupeMap.values()).map((v) => v.line);
    lines.push(...flushed);
    rowsMatched += flushed.length;
    if (flushed.length === 0) {
      warnings.push(`Subtotal import: no matching P&L rows found in "${sheetName}".`);
    }
  }

  if (sourceSheets.length === 0) {
    warnings.push('Subtotal import: no KVA summary sheets found; subtotal import not available.');
  }

  lines.sort((a, b) => a.year - b.year || (a.order ?? 0) - (b.order ?? 0));

  allYearCols.sort((a, b) => a - b);
  const skippedReasons: VaImportSubtotalDebug['skippedReasons'] = [];
  if (matchedExcludeCount > 0) {
    skippedReasons.push({ reason: 'matched exclude (Förändring i...)', count: matchedExcludeCount });
  }
  if (matchedForecastExcludeCount > 0) {
    skippedReasons.push({ reason: 'matched exclude (forecast/prognosis)', count: matchedForecastExcludeCount });
  }
  if (noLabelMatchCount > 0) {
    skippedReasons.push({
      reason: 'no label match',
      count: noLabelMatchCount,
      sampleLabels: [...noLabelMatchSamples].slice(0, MAX_SAMPLE_LABELS),
    });
  }
  if (amountMissingCount > 0) {
    skippedReasons.push({ reason: 'matched but amount missing for year', count: amountMissingCount });
  }

  return {
    lines,
    debug: {
      sourceSheets,
      yearColumnsDetected: allYearCols,
      selectedYear,
      selectedHistoricalYears: latest3Years.length > 0 ? latest3Years : undefined,
      rowsMatched,
      rowsSkipped,
      skippedReasons,
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
): { drivers: VaImportRevenueDriver[]; driversDebug?: VaImportDriversDebug; importQuality: VaImportQuality } {
  const drivers: VaImportRevenueDriver[] = [
    { palvelutyyppi: 'vesi', sourceMeta: {} },
    { palvelutyyppi: 'jatevesi', sourceMeta: {} },
  ];
  const sheets = workbook.worksheets ?? [];
  const driversDebug: VaImportDriversDebug = {};
  const qualityFields: Record<string, VaImportQuality['fields'][string]> = {};
  const setFieldQuality = (
    key: string,
    status: 'explicit' | 'derived' | 'missing',
    source: string,
    confidence: 'high' | 'medium',
  ) => {
    qualityFields[key] = { status, source, confidence };
  };

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
        if (val != null) {
          const existing = drivers.find((d) => d.palvelutyyppi === 'vesi');
          if (existing) {
            existing.yksikkohinta = val;
            existing.alvProsentti = priceTable.chosenVatRate;
            driversDebug.waterPricePickedFrom = {
              sheet: priceTable.sheetName,
              row: r,
              col: priceTable.priceCol + 1,
              cellText: (cells[priceTable.priceCol] ?? '').trim().substring(0, 80),
            };
            setFieldQuality(
              'vesi.yksikkohinta',
              'explicit',
              `${priceTable.sheetName}:R${r}C${priceTable.priceCol + 1}`,
              'high',
            );
          }
        }
      } else if (isWastewater) {
        const val = parseNumber(cells[priceTable.priceCol] ?? cells[1]);
        if (val != null) {
          const existing = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
          if (existing) {
            existing.yksikkohinta = val;
            existing.alvProsentti = priceTable.chosenVatRate;
            driversDebug.wastewaterPricePickedFrom = {
              sheet: priceTable.sheetName,
              row: r,
              col: priceTable.priceCol + 1,
              cellText: (cells[priceTable.priceCol] ?? '').trim().substring(0, 80),
            };
            setFieldQuality(
              'jatevesi.yksikkohinta',
              'explicit',
              `${priceTable.sheetName}:R${r}C${priceTable.priceCol + 1}`,
              'high',
            );
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
  const MAX_DEBUG_CANDIDATES = 20;
  const volumeCandidateRowTexts: string[] = [];
  let matchedButNoNumberVolume = 0;
  const connectionCandidateRowTexts: string[] = [];
  let matchedButNoNumberConnection = 0;

  function isHeaderRow(cells: string[]): boolean {
    return cells.slice(0, 8).some((c) => parseYearCell(c) != null);
  }

  /** Extract numeric value for volume: prefer year column, else last numeric in row, else largest in row. Returns value and 0-based colIndex for debug. */
  function volumeValueFromRow(
    cells: string[],
    yearCol: { colIndex: number; year: number } | undefined,
  ): { value: number | null; colIndex?: number } {
    const numericValues: number[] = [];
    let valueAtYear: number | null = null;
    for (let c = 0; c < cells.length; c++) {
      const n = parseNumber(cells[c]);
      if (n != null && n >= 0 && n < 1e9) {
        numericValues.push(n);
        if (yearCol && c === yearCol.colIndex) valueAtYear = n;
      }
    }
    if (yearCol != null && valueAtYear != null) return { value: valueAtYear, colIndex: yearCol.colIndex };
    if (numericValues.length === 0) return { value: null };
    const last = numericValues[numericValues.length - 1];
    if (last != null && last > 0) {
      let colIndex: number | undefined;
      for (let c = cells.length - 1; c >= 0; c--) {
        const n = parseNumber(cells[c]);
        if (n != null && n === last) {
          colIndex = c;
          break;
        }
      }
      return { value: last, colIndex };
    }
    const first = numericValues[0];
    if (first != null && first > 0) {
      let colIndex: number | undefined;
      for (let c = 0; c < cells.length; c++) {
        if (parseNumber(cells[c]) === first) {
          colIndex = c;
          break;
        }
      }
      return { value: first, colIndex };
    }
    const max = Math.max(...numericValues.filter((n) => n > 0));
    if (!isFinite(max)) return { value: null };
    let colIndex: number | undefined;
    for (let c = 0; c < cells.length; c++) {
      if (parseNumber(cells[c]) === max) {
        colIndex = c;
        break;
      }
    }
    return { value: max, colIndex };
  }

  const DRIVER_ROW_MAX_COLS = 60;

  function extractVolumeFromSheet(sheet: any, sheetName: string, forVesi: boolean): void {
    if (!sheet || (sheet.rowCount ?? 0) < 2) return;
    const rowLimit = Math.min(sheet.rowCount ?? 0, 80);
    const yearCols = getYearColumnsInSheetWide(sheet, YEAR_SCAN_ROWS, DRIVER_ROW_MAX_COLS);
    const yearCol = selectedYear != null ? yearCols.find((yc) => yc.year === selectedYear) : undefined;

    for (let row = 1; row <= rowLimit; row++) {
      const cells = getRowCellsWide(sheet, row, DRIVER_ROW_MAX_COLS);
      const rowTextFull = cells.map((c) => normalizeCellForDetection(c)).join(' ');
      const looksLikeVolumeRow = VOLUME_LABELS_M3.test(rowTextFull);
      if (isHeaderRow(cells) && !looksLikeVolumeRow) continue;
      const firstCellLabel = (cells[0] ?? '').trim();
      const firstCellLower = firstCellLabel.toLowerCase();
      if (VOLUME_EXCLUDE.test(firstCellLower)) continue;
      if (!looksLikeVolumeRow) {
        if (firstCellLabel && volumeCandidateRowTexts.length < MAX_DEBUG_CANDIDATES) {
          const sample = (firstCellLabel.length > 60 ? firstCellLabel.substring(0, 60) + '…' : firstCellLabel);
          if (!volumeCandidateRowTexts.includes(sample)) volumeCandidateRowTexts.push(sample);
        }
        continue;
      }
      let result = volumeValueFromRow(cells, yearCol);
      let value = result.value;
      let pickRow = row;
      let pickCells = cells;
      let pickCol = result.colIndex;
      if (value == null && row < rowLimit) {
        const nextCells = getRowCellsWide(sheet, row + 1, DRIVER_ROW_MAX_COLS);
        const nextResult = volumeValueFromRow(nextCells, yearCol);
        value = nextResult.value;
        if (value != null) {
          pickRow = row + 1;
          pickCells = nextCells;
          pickCol = nextResult.colIndex;
        }
      }
      if (value != null && value >= 0 && yearCol != null && (pickCol === undefined || pickCol === yearCol.colIndex)) {
        const d = drivers.find((x) => x.palvelutyyppi === (forVesi ? 'vesi' : 'jatevesi'));
        if (d) {
          d.myytyMaara = value;
          foundVolume = true;
          driversDebug.volumeSheet = driversDebug.volumeSheet ?? sheetName;
          driversDebug.volumeLabel = driversDebug.volumeLabel ?? (cells[0] ?? '').trim().substring(0, 40);
          driversDebug.volumePickedFrom = {
            sheet: sheetName,
            row: pickRow,
            col: (yearCol.colIndex ?? pickCol ?? 0) + 1,
            cellText: (pickCells[yearCol.colIndex ?? pickCol ?? 0] ?? '').trim().substring(0, 80),
          };
          const serviceKey = forVesi ? 'vesi.myytyMaara' : 'jatevesi.myytyMaara';
          setFieldQuality(
            serviceKey,
            'explicit',
            `${sheetName}:R${pickRow}C${(yearCol.colIndex ?? pickCol ?? 0) + 1}`,
            'high',
          );
        }
        return;
      }
      matchedButNoNumberVolume++;
    }
  }

  extractVolumeFromSheet(vattenKva, VATTEN_KVA_SHEET, true);
  extractVolumeFromSheet(avloppKva, AVLOPP_KVA_SHEET, false);

  /** Parse integer from cell: parseNumber first, else strip non-digits and parse (e.g. "1 234 kpl" -> 1234). */
  function parseIntegerFromCell(raw: unknown): number | null {
    const n = parseNumber(raw);
    if (n != null && !isNaN(n)) return Math.floor(n);
    if (raw == null || raw === '') return null;
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 0) return null;
    const v = parseInt(digits, 10);
    return isNaN(v) ? null : v;
  }

  /** Exclude year-like values (2000-2100) when picking connection count. */
  function isYearLike(n: number): boolean {
    return n >= 2000 && n <= 2100 && Math.floor(n) === n;
  }

  /** Extract connection count: prefer year column, else first integer >= 1 in row. Returns value and 0-based colIndex for debug. */
  function connectionValueFromRow(
    cells: string[],
    yearCol: { colIndex: number; year: number } | undefined,
  ): { value: number | null; colIndex?: number } {
    let valueAtYear: number | null = null;
    const integers: number[] = [];
    let firstColForFirstInteger: number | undefined;
    for (let c = 0; c < cells.length; c++) {
      const n = parseIntegerFromCell(cells[c]);
      if (n != null && n >= 0 && n < 1e9 && !isYearLike(n)) {
        if (yearCol && c === yearCol.colIndex) valueAtYear = n;
        if (n >= 1) {
          integers.push(n);
          if (firstColForFirstInteger === undefined) firstColForFirstInteger = c;
        }
      }
    }
    if (yearCol != null && valueAtYear != null && valueAtYear >= 1) {
      return { value: valueAtYear, colIndex: yearCol.colIndex };
    }
    if (integers.length > 0) return { value: integers[0]!, colIndex: firstColForFirstInteger };
    const rowText = cells.join(' ');
    const digitRun = rowText.replace(/\D/g, ' ');
    const parts = digitRun.trim().split(/\s+/).filter((s) => s.length > 0);
    for (const part of parts) {
      const v = parseInt(part, 10);
      if (!isNaN(v) && v >= 1 && v < 1e9 && !isYearLike(v)) return { value: v, colIndex: undefined };
    }
    return { value: null };
  }

  let foundConnections = false;
  if (anslutningar && (anslutningar.rowCount ?? 0) >= 2) {
    const rowLimit = Math.min(anslutningar.rowCount ?? 0, 50);
    const yearCols = getYearColumnsInSheetWide(anslutningar, YEAR_SCAN_ROWS, DRIVER_ROW_MAX_COLS);
    const yearCol = selectedYear != null ? yearCols.find((yc) => yc.year === selectedYear) : undefined;

    for (let row = 1; row <= rowLimit; row++) {
      const cells = getRowCellsWide(anslutningar, row, DRIVER_ROW_MAX_COLS);
      if (isHeaderRow(cells)) continue;
      const rowTextFull = cells.map((c) => normalizeCellForDetection(c)).join(' ');
      if (!CONNECTION_LABELS.test(rowTextFull)) {
        if (!foundConnections && connectionCandidateRowTexts.length < MAX_DEBUG_CANDIDATES) {
          const firstCell = (cells[0] ?? '').trim();
          if (firstCell) {
            const sample = firstCell.length > 50 ? firstCell.substring(0, 50) + '…' : firstCell;
            if (!connectionCandidateRowTexts.includes(sample)) connectionCandidateRowTexts.push(sample);
          }
        }
        continue;
      }
      const tableYearCols = getYearColumnsInSheetWideRange(
        anslutningar,
        Math.max(1, row - 5),
        Math.min(rowLimit, row + 2),
        DRIVER_ROW_MAX_COLS,
      );
      const tableYearCol = selectedYear != null ? tableYearCols.find((yc) => yc.year === selectedYear) : undefined;
      const useYearCol = tableYearCol ?? yearCol;
      let connResult = connectionValueFromRow(cells, useYearCol);
      let value = connResult.value;
      let connPickRow = row;
      let connPickCells = cells;
      let connPickCol = connResult.colIndex;
      for (let offset = 1; (value == null || value < 1) && row + offset <= rowLimit && offset <= 10; offset++) {
        const followCells = getRowCellsWide(anslutningar, row + offset, DRIVER_ROW_MAX_COLS);
        connResult = connectionValueFromRow(followCells, useYearCol);
        value = connResult.value;
        if (value != null && value >= 1) {
          connPickRow = row + offset;
          connPickCells = followCells;
          connPickCol = connResult.colIndex;
          break;
        }
      }
      for (let offset = 1; (value == null || value < 1) && row - offset >= 1 && offset <= 5; offset++) {
        const aboveCells = getRowCellsWide(anslutningar, row - offset, DRIVER_ROW_MAX_COLS);
        connResult = connectionValueFromRow(aboveCells, useYearCol);
        value = connResult.value;
        if (value != null && value >= 1) {
          connPickRow = row - offset;
          connPickCells = aboveCells;
          connPickCol = connResult.colIndex;
          break;
        }
      }
      const fromYearCol = useYearCol != null && connPickCol === useYearCol.colIndex;
      if (value != null && value >= 1 && fromYearCol) {
        drivers.forEach((d) => { d.liittymamaara = value; });
        foundConnections = true;
        driversDebug.connectionSheet = ANSLUTNINGAR_SHEET;
        driversDebug.connectionYearCol = useYearCol?.colIndex;
        driversDebug.connectionsPickedFrom = {
          sheet: ANSLUTNINGAR_SHEET,
          row: connPickRow,
          col: (connPickCol ?? 0) + 1,
          cellText: (connPickCells[connPickCol ?? 0] ?? '').trim().substring(0, 80),
        };
        setFieldQuality(
          'vesi.liittymamaara',
          'explicit',
          `${ANSLUTNINGAR_SHEET}:R${connPickRow}C${(connPickCol ?? 0) + 1}`,
          'high',
        );
        setFieldQuality(
          'jatevesi.liittymamaara',
          'explicit',
          `${ANSLUTNINGAR_SHEET}:R${connPickRow}C${(connPickCol ?? 0) + 1}`,
          'high',
        );
        break;
      }
      matchedButNoNumberConnection++;
    }
  }

  // Deterministic fallback: derive service volume from sales revenue / unit price when m3 values are missing.
  const waterSales = extractServiceSalesRevenue(vattenKva, VATTEN_KVA_SHEET, selectedYear);
  const wastewaterSales = extractServiceSalesRevenue(avloppKva, AVLOPP_KVA_SHEET, selectedYear);
  if (waterSales) {
    driversDebug.waterSalesRevenuePickedFrom = waterSales;
  }
  if (wastewaterSales) {
    driversDebug.wastewaterSalesRevenuePickedFrom = wastewaterSales;
  }
  const deriveVolumeFromRevenue = (
    service: 'vesi' | 'jatevesi',
    revenuePick: RevenueCellPick | null,
  ) => {
    const driver = drivers.find((d) => d.palvelutyyppi === service);
    if (!driver) return;
    const volumeKey = `${service}.myytyMaara`;
    const price = driver.yksikkohinta ?? 0;
    const existingVolume = driver.myytyMaara ?? 0;
    if (existingVolume > 0) return;
    if (!revenuePick || !price || price <= 0) return;
    const derivedRaw = revenuePick.amount / price;
    if (!isFinite(derivedRaw) || derivedRaw <= 0) return;
    const derived = Math.round(derivedRaw * 1000) / 1000;
    driver.myytyMaara = derived;
    driversDebug.volumeDerivedFromRevenue = true;
    foundVolume = true;
    setFieldQuality(
      volumeKey,
      'derived',
      `${revenuePick.sheet}:R${revenuePick.row}C${revenuePick.col} ÷ ${price.toFixed(6)}`,
      'medium',
    );
  };
  deriveVolumeFromRevenue('vesi', waterSales);
  deriveVolumeFromRevenue('jatevesi', wastewaterSales);

  driversDebug.volumeNotFound = !foundVolume;
  driversDebug.connectionNotFound = !foundConnections;
  if (matchedButNoNumberVolume > 0) driversDebug.matchedButNoNumberVolume = matchedButNoNumberVolume;
  if (matchedButNoNumberConnection > 0) driversDebug.matchedButNoNumberConnection = matchedButNoNumberConnection;
  if (volumeCandidateRowTexts.length > 0) driversDebug.volumeCandidateRowTexts = volumeCandidateRowTexts.slice(0, MAX_DEBUG_CANDIDATES);
  if (connectionCandidateRowTexts.length > 0) driversDebug.connectionCandidateRowTexts = connectionCandidateRowTexts.slice(0, MAX_DEBUG_CANDIDATES);

  const driversSkippedReasons: VaImportDriversDebug['driversSkippedReasons'] = [];
  if (!foundVolume) {
    driversSkippedReasons.push({
      reason: 'volume not found in template',
      count: 1,
      sampleCandidateRowTexts: driversDebug.volumeCandidateRowTexts,
    });
  }
  if (!foundConnections) {
    driversSkippedReasons.push({
      reason: 'connection count not found in template',
      count: 1,
      sampleCandidateRowTexts: driversDebug.connectionCandidateRowTexts,
    });
  }
  if (matchedButNoNumberVolume > 0) {
    driversSkippedReasons.push({ reason: 'volume label matched but no usable number', count: matchedButNoNumberVolume });
  }
  if (matchedButNoNumberConnection > 0) {
    driversSkippedReasons.push({ reason: 'connection label matched but no usable number', count: matchedButNoNumberConnection });
  }
  if (driversSkippedReasons.length > 0) driversDebug.driversSkippedReasons = driversSkippedReasons;

  if (!foundVolume) {
    warnings.push('Revenue drivers: could not locate volume in template; leaving empty.');
  }
  if (!foundConnections) {
    warnings.push('Revenue drivers: could not locate connection count in template; leaving empty.');
  }

  const requiredFieldKeys = [
    'vesi.yksikkohinta',
    'vesi.myytyMaara',
    'jatevesi.yksikkohinta',
    'jatevesi.myytyMaara',
  ] as const;
  const connectionFieldKeys = ['vesi.liittymamaara', 'jatevesi.liittymamaara'] as const;
  const valueByField: Record<string, number | undefined> = {
    'vesi.yksikkohinta': drivers.find((d) => d.palvelutyyppi === 'vesi')?.yksikkohinta,
    'vesi.myytyMaara': drivers.find((d) => d.palvelutyyppi === 'vesi')?.myytyMaara,
    'jatevesi.yksikkohinta': drivers.find((d) => d.palvelutyyppi === 'jatevesi')?.yksikkohinta,
    'jatevesi.myytyMaara': drivers.find((d) => d.palvelutyyppi === 'jatevesi')?.myytyMaara,
    'vesi.liittymamaara': drivers.find((d) => d.palvelutyyppi === 'vesi')?.liittymamaara,
    'jatevesi.liittymamaara': drivers.find((d) => d.palvelutyyppi === 'jatevesi')?.liittymamaara,
  };
  for (const fieldKey of requiredFieldKeys) {
    const hasPositiveValue = (valueByField[fieldKey] ?? 0) > 0;
    if (!qualityFields[fieldKey] || !hasPositiveValue) {
      setFieldQuality(fieldKey, 'missing', 'not found', 'high');
    }
  }
  for (const fieldKey of connectionFieldKeys) {
    const hasPositiveValue = (valueByField[fieldKey] ?? 0) > 0;
    if (!qualityFields[fieldKey]) {
      setFieldQuality(
        fieldKey,
        hasPositiveValue ? 'explicit' : 'missing',
        hasPositiveValue ? 'Anslutningar table' : 'optional; not found',
        hasPositiveValue ? 'high' : 'medium',
      );
    }
  }
  const requiredMissing = requiredFieldKeys.filter(
    (fieldKey) => qualityFields[fieldKey]?.status === 'missing' || (valueByField[fieldKey] ?? 0) <= 0,
  );
  const errorCodes = requiredMissing.length > 0 ? ['REQUIRED_DRIVER_FIELDS_MISSING'] : [];
  for (const driver of drivers) {
    const servicePrefix = driver.palvelutyyppi === 'vesi' ? 'vesi' : 'jatevesi';
    const sourceMeta = (driver.sourceMeta ?? {}) as Record<string, unknown>;
    sourceMeta.imported = true;
    sourceMeta.fields = {
      yksikkohinta: qualityFields[`${servicePrefix}.yksikkohinta`] ?? null,
      myytyMaara: qualityFields[`${servicePrefix}.myytyMaara`] ?? null,
      liittymamaara: qualityFields[`${servicePrefix}.liittymamaara`] ?? null,
    };
    driver.sourceMeta = sourceMeta;
  }

  return {
    drivers,
    driversDebug: Object.keys(driversDebug).length > 0 ? driversDebug : undefined,
    importQuality: {
      requiredMissing,
      fields: qualityFields,
      errorCodes,
    },
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

  const {
    drivers: revenueDrivers,
    driversDebug,
    importQuality,
  } = previewKvaRevenueDrivers(workbook, warnings, year);

  // Tier A: subtotal-level P&L extraction
  const subtotalResult = extractSubtotalLines(workbook, year);
  for (const w of subtotalResult.warnings) {
    warnings.push(w);
  }

  const driverYears = Array.from(
    new Set(
      [
        ...(subtotalResult.debug?.yearColumnsDetected ?? []),
        ...(subtotalResult.debug?.selectedHistoricalYears ?? []),
        ...(year != null ? [year] : []),
      ].filter((y): y is number => Number.isFinite(y)),
    ),
  ).sort((a, b) => a - b);

  const revenueDriversByYear: Record<number, VaImportRevenueDriver[]> = {};
  const importQualityByYear: Record<number, VaImportQuality> = {};
  const driversDebugByYear: Record<number, VaImportDriversDebug> = {};
  const missingByYear: Record<number, string[]> = {};

  const cloneDrivers = (drivers: VaImportRevenueDriver[]) => drivers.map((driver) => ({
    ...driver,
    sourceMeta: driver.sourceMeta ? { ...driver.sourceMeta } : undefined,
  }));

  for (const driverYear of driverYears) {
    if (year != null && driverYear === year) {
      revenueDriversByYear[driverYear] = cloneDrivers(revenueDrivers);
      importQualityByYear[driverYear] = importQuality;
      missingByYear[driverYear] = [...(importQuality.requiredMissing ?? [])];
      if (driversDebug) {
        driversDebugByYear[driverYear] = { ...driversDebug };
      }
      continue;
    }

    const perYear = previewKvaRevenueDrivers(workbook, [], driverYear);
    revenueDriversByYear[driverYear] = cloneDrivers(perYear.drivers);
    importQualityByYear[driverYear] = perYear.importQuality;
    missingByYear[driverYear] = [...(perYear.importQuality.requiredMissing ?? [])];
    if (perYear.driversDebug) {
      driversDebugByYear[driverYear] = { ...perYear.driversDebug };
    }
  }

  return {
    templateId: TEMPLATE_ID,
    year,
    budgetLines,
    revenueDrivers,
    driverYears: driverYears.length > 0 ? driverYears : undefined,
    revenueDriversByYear: Object.keys(revenueDriversByYear).length > 0 ? revenueDriversByYear : undefined,
    importQualityByYear: Object.keys(importQualityByYear).length > 0 ? importQualityByYear : undefined,
    driversDebugByYear: Object.keys(driversDebugByYear).length > 0 ? driversDebugByYear : undefined,
    missingByYear: Object.keys(missingByYear).length > 0 ? missingByYear : undefined,
    assumptions: [],
    warnings,
    amountColumnUsed,
    countsByType,
    processedSheets,
    kvaDebug,
    driversDebug,
    importQuality,
    subtotalLines: subtotalResult.lines.length > 0 ? subtotalResult.lines : undefined,
    subtotalDebug: subtotalResult.debug,
  };
}
