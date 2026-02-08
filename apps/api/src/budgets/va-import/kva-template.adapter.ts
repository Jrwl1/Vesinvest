import type { Workbook } from 'exceljs';
import type {
  VaImportPreview,
  VaImportBudgetLine,
  VaImportProcessedSheet,
  VaImportKvaDebug,
  VaImportRevenueDriver,
  VaImportDriversDebug,
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

function getRowCells(sheet: any, rowIndex: number): string[] {
  const row = sheet.getRow(rowIndex);
  const cells: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
    cells[colNumber - 1] = String(cell?.value ?? '').trim();
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
    colMap.tiliryhma = 0;
    colMap.nimi = 1;
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
 * Returns true if this row is a "row-76-style" header: contains "Budget" (or FI/SV variant)
 * and the next row has a numeric account code in column 0.
 */
function isBudgetOnlyHeaderRow(sheet: any, rowIndex: number, maxRows: number): boolean {
  const cells = getRowCells(sheet, rowIndex);
  const hasBudget = cells.some((c) => BUDGET_HEADER.test(c));
  if (!hasBudget) return false;
  const nextRow = rowIndex + 1;
  if (nextRow > maxRows) return false;
  const nextCells = getRowCells(sheet, nextRow);
  const col0 = (nextCells[0] ?? '').trim();
  return /^\d{3,6}$/.test(col0);
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

/** Volume-like labels (avoid area/owner/header rows). */
const VOLUME_LABELS = /förbrukning|försäljning|volym|volume|myyty\s*määrä|myyty\s*maara|m³\/a|m3\/a|sold\s*m³|vatten\s*m³|avlopp\s*m³/i;
/** Connection count labels. */
const CONNECTION_LABELS = /antalet\s*anslutningar|anslutningar\s*antal|liittymät|liittymä\s*määrä|liittyma|connections\s*count|antal\s*anslutning/i;

/**
 * Extract revenue drivers from KVA workbook (unit prices from KVA totalt; volume/connections from Vatten KVA, Avlopp KVA, Anslutningar with year selection).
 * Pushes at most one warning per missing category (prices, volume, connections).
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
  const kvaTotalt = sheets.find((s) => (s.name || '').trim() === KVA_TOTALT_SHEET);
  const driversDebug: VaImportDriversDebug = {};

  if (!kvaTotalt) {
    warnings.push('Revenue drivers: sheet "KVA totalt" not found; unit prices and VAT left empty.');
    return { drivers };
  }

  const maxRows = Math.min(kvaTotalt.rowCount ?? 0, 120);
  let headerRowIndex = 0;
  let colMoms0 = -1;
  let colMoms24 = -1;

  for (let r = 1; r <= maxRows; r++) {
    const cells = getRowCells(kvaTotalt, r);
    const rowText = cells.join(' ').toLowerCase();
    const hasPris = /\bpris\b|€\/m³|eur\/m³|euro\/m³|yksikköhinta|yksikkohinta/i.test(rowText);
    const hasPerM3 = /€\/m³|eur\/m³|euro\/m³|m³|per\s*m³/i.test(rowText);
    if (hasPris && hasPerM3) {
      headerRowIndex = r;
      for (let c = 0; c < cells.length; c++) {
        const cell = (cells[c] ?? '').trim().toLowerCase();
        if (/moms\s*0\s*%|0\s*%\s*moms/.test(cell) || cell === 'moms 0 %') colMoms0 = c;
        if (/moms\s*24|24\s*%\s*moms|moms\s*24\s*%/.test(cell) || cell === 'moms 24 %') colMoms24 = c;
      }
      break;
    }
  }

  if (headerRowIndex === 0) {
    warnings.push('Revenue drivers: could not locate "Pris €/m³" table in KVA totalt; leaving unit prices empty.');
    return { drivers };
  }

  const priceCol = colMoms0 >= 0 ? colMoms0 : colMoms24 >= 0 ? colMoms24 : 1;
  const vatPercent = colMoms24 >= 0 ? 24 : colMoms0 >= 0 ? 0 : undefined;

  for (let r = headerRowIndex + 1; r <= Math.min(headerRowIndex + 15, maxRows); r++) {
    const cells = getRowCells(kvaTotalt, r);
    const label = (cells[0] ?? '').trim();
    if (/^vatten$/i.test(label)) {
      const val = parseNumber(cells[priceCol] ?? cells[1]);
      if (val != null && val > 0) {
        const existing = drivers.find((d) => d.palvelutyyppi === 'vesi');
        if (existing) {
          existing.yksikkohinta = val;
          if (vatPercent !== undefined) existing.alvProsentti = vatPercent;
        }
      }
    } else if (/^avlopp$/i.test(label)) {
      const val = parseNumber(cells[priceCol] ?? cells[1]);
      if (val != null && val > 0) {
        const existing = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
        if (existing) {
          existing.yksikkohinta = val;
          if (vatPercent !== undefined) existing.alvProsentti = vatPercent;
        }
      }
    }
  }

  // --- Step 4: year selection and volume/connections ---
  const vattenKva = sheets.find((s) => (s.name || '').trim() === VATTEN_KVA_SHEET);
  const avloppKva = sheets.find((s) => (s.name || '').trim() === AVLOPP_KVA_SHEET);
  const anslutningar = sheets.find((s) => (s.name || '').trim() === ANSLUTNINGAR_SHEET);

  const allYears: number[] = [];
  [vattenKva, avloppKva, anslutningar].forEach((sheet) => {
    if (sheet && (sheet.rowCount ?? 0) > 0) {
      getYearColumnsInSheet(sheet, 15).forEach(({ year }) => {
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
    return cells.slice(0, 5).some((c) => parseYearCell(c) != null);
  }

  function extractVolumeFromSheet(sheet: any, sheetName: string, forVesi: boolean): void {
    if (!sheet || (sheet.rowCount ?? 0) < 2) return;
    const rowLimit = Math.min(sheet.rowCount ?? 0, 60);
    const yearCols = getYearColumnsInSheet(sheet, 10);
    const yearCol = selectedYear != null ? yearCols.find((yc) => yc.year === selectedYear) : undefined;

    for (let row = 1; row <= rowLimit; row++) {
      const cells = getRowCells(sheet, row);
      if (isHeaderRow(cells)) continue;
      const firstCell = (cells[0] ?? '').trim().toLowerCase();
      if (!VOLUME_LABELS.test(firstCell)) continue;
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
    const rowLimit = Math.min(anslutningar.rowCount ?? 0, 30);
    const yearCols = getYearColumnsInSheet(anslutningar, 10);
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
    if (lines.length > 0 && !kvaDebug) {
      const accounts = lines.map((l) => l.tiliryhma).filter(Boolean);
      kvaDebug = {
        detectedSheetName: sheetName,
        detectedHeaderRowIndex: headerRowIndex,
        budgetColumnIndex,
        parsedRowCount: lines.length,
        firstParsedAccount: accounts[0] ?? '',
        lastParsedAccount: accounts[accounts.length - 1] ?? '',
        totalParsedRowCount: undefined,
      };
    }
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
  };
}
