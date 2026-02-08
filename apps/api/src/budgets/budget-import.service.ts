import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { detectKvaTemplate, previewKvaWorkbook } from './va-import/kva-template.adapter';

/**
 * Parsed row from an imported CSV/Excel file.
 */
export interface ParsedBudgetRow {
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: number;
  muistiinpanot?: string;
}

/** Per-sheet summary for KVA preview reporting. */
export interface ImportProcessedSheet {
  sheetName: string;
  lines: number;
  sections?: number;
  skipped?: boolean;
  reason?: string;
}

/** Temporary KVA debug metadata (dev-only). */
export interface ImportKvaDebug {
  detectedSheetName: string;
  detectedHeaderRowIndex: number;
  budgetColumnIndex: number;
  parsedRowCount: number;
  firstParsedAccount: string;
  lastParsedAccount: string;
}

/**
 * Result returned from the preview/parse step.
 */
export interface ImportPreviewResult {
  rows: ParsedBudgetRow[];
  skippedRows: number;
  detectedFormat: string;
  warnings: string[];
  /** Set when a VA template adapter (e.g. KVA) was used. */
  year?: number | null;
  templateId?: string;
  /** Which amount column was used (KVA). */
  amountColumnUsed?: string;
  /** Row counts by type (KVA). */
  countsByType?: { tulo: number; kulu: number; investointi: number };
  /** Per-sheet summary (KVA). */
  processedSheets?: ImportProcessedSheet[];
  /** Temporary KVA debug (only for KVA-detected preview). */
  kvaDebug?: ImportKvaDebug;
  /** Revenue drivers (KVA): vesi/jatevesi unit price, volume, VAT%, etc. Preview only; not persisted on confirm yet. */
  revenueDrivers?: ImportRevenueDriver[];
  /** Optional debug for drivers extraction (selected year, sheet/label used). */
  driversDebug?: ImportDriversDebug;
}

/** Debug metadata for revenue drivers extraction (which sheet/year was used). */
export interface ImportDriversDebug {
  selectedYear?: number;
  volumeSheet?: string;
  volumeLabel?: string;
  connectionSheet?: string;
  connectionYearCol?: number;
  priceSheetName?: string;
  priceHeaderRowIndex?: number;
  priceVatColumnsFound?: number[];
  chosenVatRate?: number;
}

/** Revenue driver row for KVA preview (maps to Tuloajuri). */
export interface ImportRevenueDriver {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta?: number;
  myytyMaara?: number;
  perusmaksu?: number;
  liittymamaara?: number;
  alvProsentti?: number;
}

/**
 * Known column header patterns for Finnish VA accounting exports.
 * Maps common Finnish/Swedish/English header variations to our fields.
 */
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  tiliryhma: [
    /^tili(ryhmä|ryhma|numero)?$/i,
    /^konto(grupp|nummer)?$/i,
    /^account\s*(group|code|number)?$/i,
    /^tili$/i,
    /^koodi$/i,
    /^code$/i,
  ],
  nimi: [
    /^nimi$/i,
    /^namn$/i,
    /^name$/i,
    /^kuvaus$/i,
    /^selite$/i,
    /^nimike$/i,
    /^beskrivning$/i,
    /^description$/i,
  ],
  summa: [
    /^summa$/i,
    /^määrä$/i,
    /^maara$/i,
    /^belopp$/i,
    /^amount$/i,
    /^euroa?$/i,
    /^eur$/i,
    /^€$/i,
    /^budget$/i,
    /^talousarvio$/i,
  ],
  tyyppi: [
    /^tyyppi$/i,
    /^type?$/i,
    /^typ$/i,
    /^laji$/i,
    /^luokka$/i,
    /^kategoria$/i,
    /^category$/i,
  ],
};

/**
 * Account group → type mapping.
 * Finnish VA convention: 3xxx = revenue, 4xxx = expense, 5xxx = investment.
 */
function inferTypeFromAccountGroup(code: string): 'kulu' | 'tulo' | 'investointi' {
  const prefix = code.charAt(0);
  if (prefix === '3') return 'tulo';
  if (prefix === '5') return 'investointi';
  return 'kulu'; // 4xxx and anything else defaults to expense
}

@Injectable()
export class BudgetImportService {
  private readonly logger = new Logger(BudgetImportService.name);

  /**
   * Parse an uploaded file (CSV or Excel) and return a preview of detected rows.
   * Does NOT persist anything — that's done in the confirm step.
   */
  async parseFile(buffer: Buffer, filename: string): Promise<ImportPreviewResult> {
    const ext = filename.toLowerCase().split('.').pop();

    if (ext === 'csv' || ext === 'txt') {
      return this.parseCsv(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      return this.parseExcel(buffer, filename);
    } else {
      throw new BadRequestException(`Unsupported file format: .${ext}. Use CSV or Excel (.xlsx).`);
    }
  }

  // ── CSV Parsing ──

  private async parseCsv(buffer: Buffer): Promise<ImportPreviewResult> {
    const text = buffer.toString('utf-8');
    // Handle BOM
    const clean = text.replace(/^\uFEFF/, '');

    // Detect separator: semicolon (Finnish) or comma
    const firstLine = clean.split(/\r?\n/)[0] || '';
    const separator = firstLine.includes(';') ? ';' : ',';

    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException('CSV file must have at least a header row and one data row.');
    }

    const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const columnMap = this.detectColumns(headers);

    const warnings: string[] = [];
    if (columnMap.tiliryhma === -1 && columnMap.nimi === -1) {
      throw new BadRequestException(
        'Could not detect required columns. Expected headers like: Tili/Tiliryhmä, Nimi, Summa',
      );
    }
    if (columnMap.summa === -1) {
      throw new BadRequestException('Could not detect amount/summa column.');
    }

    const rows: ParsedBudgetRow[] = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const cells = this.splitCsvLine(lines[i], separator);
      try {
        const row = this.mapRowToLine(cells, columnMap);
        if (row) {
          rows.push(row);
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }

    return {
      rows,
      skippedRows: skipped,
      detectedFormat: `CSV (${separator === ';' ? 'semicolon' : 'comma'} separated, ${headers.length} columns)`,
      warnings,
    };
  }

  // ── Excel Parsing ──

  private async parseExcel(buffer: Buffer, filename: string): Promise<ImportPreviewResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    if (detectKvaTemplate(workbook, filename)) {
      const va = await previewKvaWorkbook(workbook);
      const sheetNames = (workbook.worksheets ?? []).map((ws) => ws.name || 'Sheet').filter(Boolean);
      const formatLabel =
        sheetNames.length > 0
          ? `KVA template (${sheetNames.join(', ')})`
          : `KVA template (${workbook.worksheets[0]?.name ?? 'sheet'})`;
      return {
        rows: va.budgetLines.map((l) => ({
          tiliryhma: l.tiliryhma,
          nimi: l.nimi,
          tyyppi: l.tyyppi,
          summa: l.summa,
          muistiinpanot: l.muistiinpanot,
        })),
        skippedRows: 0,
        detectedFormat: formatLabel,
        warnings: va.warnings,
        year: va.year,
        templateId: va.templateId,
        amountColumnUsed: va.amountColumnUsed,
        countsByType: va.countsByType,
        processedSheets: va.processedSheets,
        kvaDebug: va.kvaDebug,
        revenueDrivers: va.revenueDrivers,
        driversDebug: va.driversDebug,
      };
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException('Excel file must have at least a header row and one data row.');
    }

    // Read header row
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    const columnMap = this.detectColumns(headers);
    const warnings: string[] = [];

    if (columnMap.tiliryhma === -1 && columnMap.nimi === -1) {
      throw new BadRequestException(
        'Could not detect required columns. Expected headers like: Tili/Tiliryhmä, Nimi, Summa',
      );
    }
    if (columnMap.summa === -1) {
      throw new BadRequestException('Could not detect amount/summa column.');
    }

    const rows: ParsedBudgetRow[] = [];
    let skipped = 0;

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = String(cell.value ?? '').trim();
      });

      try {
        const parsed = this.mapRowToLine(cells, columnMap);
        if (parsed) {
          rows.push(parsed);
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }

    return {
      rows,
      skippedRows: skipped,
      detectedFormat: `Excel (${sheet.name}, ${headers.length} columns)`,
      warnings,
    };
  }

  // ── Column Detection ──

  private detectColumns(headers: string[]): {
    tiliryhma: number;
    nimi: number;
    summa: number;
    tyyppi: number;
  } {
    const map = { tiliryhma: -1, nimi: -1, summa: -1, tyyppi: -1 };

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some((p) => p.test(h))) {
          if (map[field as keyof typeof map] === -1) {
            map[field as keyof typeof map] = i;
          }
        }
      }
    }

    // Fallback: if we have exactly 3 columns and nothing matched,
    // assume col0=account, col1=name, col2=amount
    const detectedCount = Object.values(map).filter((v) => v !== -1).length;
    if (detectedCount === 0 && headers.length >= 3) {
      map.tiliryhma = 0;
      map.nimi = 1;
      map.summa = 2;
      this.logger.warn('No column headers matched — using positional fallback (col 0/1/2)');
    }

    // Another fallback: if only 2 columns, assume name + amount
    if (detectedCount === 0 && headers.length === 2) {
      map.nimi = 0;
      map.summa = 1;
      this.logger.warn('2-column fallback: name + amount');
    }

    return map;
  }

  // ── Row Mapping ──

  private mapRowToLine(
    cells: string[],
    columnMap: { tiliryhma: number; nimi: number; summa: number; tyyppi: number },
  ): ParsedBudgetRow | null {
    // Extract values
    const tiliryhma = columnMap.tiliryhma >= 0 ? (cells[columnMap.tiliryhma] ?? '').trim() : '';
    const nimi = columnMap.nimi >= 0 ? (cells[columnMap.nimi] ?? '').trim() : '';
    const summaRaw = columnMap.summa >= 0 ? (cells[columnMap.summa] ?? '').trim() : '';
    const tyyppiRaw = columnMap.tyyppi >= 0 ? (cells[columnMap.tyyppi] ?? '').trim() : '';

    // Skip empty rows
    if (!nimi && !summaRaw) return null;

    // Parse amount: handle Finnish decimal format (1 234,56 or 1234.56)
    const summa = this.parseAmount(summaRaw);
    if (isNaN(summa) || summa === 0) return null;

    // Determine type
    let tyyppi: 'kulu' | 'tulo' | 'investointi';
    if (tyyppiRaw) {
      tyyppi = this.parseType(tyyppiRaw);
    } else if (tiliryhma) {
      tyyppi = inferTypeFromAccountGroup(tiliryhma);
    } else {
      // Default to expense if we can't determine
      tyyppi = 'kulu';
    }

    return {
      tiliryhma: tiliryhma || '9999',
      nimi: nimi || `Rivi ${tiliryhma}`,
      tyyppi,
      summa: Math.abs(summa), // Always store positive amounts
    };
  }

  /**
   * Parse a Finnish-format number: "1 234,56" → 1234.56
   */
  private parseAmount(raw: string): number {
    if (!raw) return NaN;
    // Remove currency symbols, spaces used as thousand separators
    let clean = raw
      .replace(/€/g, '')
      .replace(/EUR/gi, '')
      .replace(/\s/g, '')  // thousand separators
      .trim();

    // Finnish format: comma as decimal separator
    if (clean.includes(',') && !clean.includes('.')) {
      clean = clean.replace(',', '.');
    }
    // Mixed: 1.234,56 → 1234.56
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    }

    return parseFloat(clean);
  }

  /**
   * Parse type string to our enum.
   */
  private parseType(raw: string): 'kulu' | 'tulo' | 'investointi' {
    const lower = raw.toLowerCase();
    if (/tulo|revenue|intäkt|income/i.test(lower)) return 'tulo';
    if (/invest/i.test(lower)) return 'investointi';
    return 'kulu';
  }

  /**
   * Split a CSV line respecting quoted fields.
   */
  private splitCsvLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === separator && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  }
}
