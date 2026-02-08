/**
 * Normalized VA import preview (template adapters).
 * Maps to TalousarvioRivi, Tuloajuri, Olettamus.
 */

export interface VaImportBudgetLine {
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: number;
  muistiinpanot?: string;
}

export interface VaImportRevenueDriver {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta?: number;
  myytyMaara?: number;
  perusmaksu?: number;
  liittymamaara?: number;
  alvProsentti?: number;
}

export interface VaImportProcessedSheet {
  sheetName: string;
  lines: number;
  sections?: number;
  skipped?: boolean;
  reason?: string;
}

/** Per-block debug (account range produced by one budget block). */
export interface VaImportKvaBlockDebug {
  headerRowIndex: number; // 1-based
  firstAccount: string;
  lastAccount: string;
  lineCount: number;
}

/** Temporary debug metadata for KVA preview (dev-only verification). */
export interface VaImportKvaDebug {
  detectedSheetName: string;
  detectedHeaderRowIndex: number; // 1-based
  budgetColumnIndex: number; // 0-based
  parsedRowCount: number;
  firstParsedAccount: string;
  lastParsedAccount: string;
  /** Total lines across all blocks (before de-dupe). */
  totalParsedRowCount?: number;
  /** Account ranges per block when multiple blocks are parsed. */
  blockAccountRanges?: VaImportKvaBlockDebug[];
}

/** Optional debug metadata for revenue drivers extraction (which sheet/label/year was used). */
export interface VaImportDriversDebug {
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

export interface VaImportPreview {
  templateId: string;
  year: number | null;
  budgetLines: VaImportBudgetLine[];
  revenueDrivers: VaImportRevenueDriver[];
  assumptions: Array<{ avain: string; arvo: number }>;
  warnings: string[];
  /** Which amount column was used (e.g. "Budget", "Belopp (fallback)"). */
  amountColumnUsed?: string;
  /** Row counts by type (tulo/kulu/investointi). */
  countsByType?: { tulo: number; kulu: number; investointi: number };
  /** Per-sheet summary for preview reporting. */
  processedSheets?: VaImportProcessedSheet[];
  /** Temporary KVA debug metadata (only for KVA-detected preview). */
  kvaDebug?: VaImportKvaDebug;
  /** Optional debug for drivers extraction (selected year, sheet/label used). */
  driversDebug?: VaImportDriversDebug;
}

export interface IVaTemplateAdapter {
  readonly templateId: string;
  detect(workbook: { worksheets: { name: string }[] }, filename: string): boolean;
  preview(workbook: unknown): Promise<VaImportPreview>;
}
