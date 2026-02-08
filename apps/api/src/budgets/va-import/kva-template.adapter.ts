import type { Workbook } from 'exceljs';
import type {
  VaImportPreview,
  VaImportBudgetLine,
  VaImportProcessedSheet,
  VaImportKvaDebug,
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

  for (let r = headerRowIndex + 1; r <= dataEndRow; r++) {
    const cells = getRowCells(sheet, r);
    const tiliryhma = colMap.tiliryhma >= 0 ? (cells[colMap.tiliryhma] ?? '').trim() : '';
    const nimi = colMap.nimi >= 0 ? (cells[colMap.nimi] ?? '').trim() : '';
    const summaRaw = colMap.summa >= 0 ? (cells[colMap.summa] ?? '').trim() : '';

    if (!isNumericAccountCode(tiliryhma)) {
      skippedNonAccount++;
      const accountEmpty = !(tiliryhma ?? '').trim();
      if (accountEmpty && summaRaw && !isNaN(parseAmount(summaRaw))) {
        break;
      }
      continue;
    }
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

/**
 * KVA template adapter: preview parse only (no DB writes).
 * Scans up to MAX_HEADER_SCAN rows for section headers; parses all sections on all sheets.
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

  for (const sheet of sheets) {
    const sheetName = sheet.name || 'Sheet';
    const rowCount = sheet.rowCount ?? 0;
    if (rowCount < 2) {
      processedSheets.push({ sheetName, lines: 0, skipped: true, reason: 'Insufficient rows' });
      continue;
    }

    const headerRows = findSectionHeaderRows(sheet, rowCount);
    if (headerRows.length === 0) {
      warnings.push(`Sheet "${sheetName}": no section header row found in first ${MAX_HEADER_SCAN} rows; sheet skipped.`);
      processedSheets.push({ sheetName, lines: 0, skipped: true, reason: 'No header row found' });
      continue;
    }

    let sheetLines = 0;
    let sectionUsedBudget = false;
    let sectionBudgetLabel: string | undefined;
    let totalSkippedNonAccount = 0;

    for (let i = 0; i < headerRows.length; i++) {
      const headerRowIndex = headerRows[i];
      const dataEndRow = i < headerRows.length - 1 ? headerRows[i + 1] - 1 : rowCount;
      const {
        lines,
        skippedNonAccount,
        usedBudgetColumn,
        budgetColumnLabel,
        budgetColumnIndex,
      } = parseSection(sheet, headerRowIndex, dataEndRow, sheetName);
      totalSkippedNonAccount += skippedNonAccount;
      if (usedBudgetColumn) {
        sectionUsedBudget = true;
        sectionBudgetLabel = budgetColumnLabel;
      } else if (lines.length > 0) {
        warnings.push(
          `Sheet "${sheetName}" (header row ${headerRowIndex}): Could not detect Budget column; using fallback amount column.`,
        );
      }
      for (const line of lines) {
        budgetLines.push(line);
        countsByType[line.tyyppi]++;
      }
      sheetLines += lines.length;

      if (lines.length > 0 && !kvaDebug) {
        const accounts = lines.map((l) => l.tiliryhma).filter(Boolean);
        kvaDebug = {
          detectedSheetName: sheetName,
          detectedHeaderRowIndex: headerRowIndex,
          budgetColumnIndex,
          parsedRowCount: lines.length,
          firstParsedAccount: accounts[0] ?? '',
          lastParsedAccount: accounts[accounts.length - 1] ?? '',
        };
      }
    }

    if (year == null) {
      const firstHeaderRow = headerRows[0];
      year = detectYear(sheet, firstHeaderRow);
    }

    if (!sectionUsedBudget && sheetLines > 0) {
      amountColumnUsed = amountColumnUsed ?? 'Belopp (fallback)';
    } else if (sectionUsedBudget) {
      amountColumnUsed = sectionBudgetLabel ?? 'Budget';
    }

    if (totalSkippedNonAccount > 0) {
      warnings.push(
        `Sheet "${sheetName}": skipped ${totalSkippedNonAccount} non-account rows (e.g. section headers like "Förverkligat").`,
      );
    }

    processedSheets.push({
      sheetName,
      lines: sheetLines,
      sections: headerRows.length,
    });
  }

  if (budgetLines.length > 0) {
    const total = budgetLines.length;
    const maxShare = Math.max(countsByType.tulo, countsByType.kulu, countsByType.investointi) / total;
    if (maxShare >= 0.9) {
      const dominant =
        countsByType.tulo >= countsByType.kulu && countsByType.tulo >= countsByType.investointi
          ? 'TULOT'
          : countsByType.investointi >= countsByType.kulu
            ? 'INVESTOINNIT'
            : 'KULUT';
      warnings.push(
        `About ${Math.round(maxShare * 100)}% of lines are ${dominant}; this may indicate a partial import (e.g. only one section).`,
      );
    }
  }

  if (!amountColumnUsed && budgetLines.length > 0) {
    amountColumnUsed = 'Belopp (fallback)';
  }

  if (kvaDebug) {
    warnings.push(
      `[KVA_DEBUG] sheet=${kvaDebug.detectedSheetName} headerRow=${kvaDebug.detectedHeaderRowIndex} budgetCol=${kvaDebug.budgetColumnIndex} rows=${kvaDebug.parsedRowCount} accounts=${kvaDebug.firstParsedAccount}..${kvaDebug.lastParsedAccount}`,
    );
  }

  return {
    templateId: TEMPLATE_ID,
    year,
    budgetLines,
    revenueDrivers: [],
    assumptions: [],
    warnings,
    amountColumnUsed,
    countsByType,
    processedSheets,
    kvaDebug,
  };
}
