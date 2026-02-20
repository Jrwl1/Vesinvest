/**
 * Normalized VA import preview (template adapters).
 * Maps to TalousarvioRivi, Tuloajuri, Olettamus, TalousarvioValisumma.
 */

// ──────────────────────────────────────────────
// Tier B: account-level budget lines (Blad1)
// ──────────────────────────────────────────────

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
  sourceMeta?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Tier A: subtotal-level P&L lines (KVA totalt, Vatten KVA, Avlopp KVA)
// ──────────────────────────────────────────────

/** Semantic type of a KVA subtotal row. */
export type ValisummaType = 'income' | 'cost' | 'depreciation' | 'financial' | 'investment' | 'result';

export interface VaImportSubtotalLine {
  /** Stable category identifier, e.g. "sales_revenue", "personnel_costs" */
  categoryKey: string;
  /** Display name from workbook, e.g. "Försäljningsintäkter" */
  categoryName: string;
  /** Semantic type */
  type: ValisummaType;
  /** Amount in EUR for the selected year */
  amount: number;
  /** Year the amount belongs to */
  year: number;
  /** Source sheet name */
  sourceSheet: string;
  /** Per-service breakdown (null = consolidated from KVA totalt) */
  palvelutyyppi?: 'vesi' | 'jatevesi';
  /** Hierarchy level (0 = top category, 1 = subrow). */
  level?: number;
  /** Deterministic display order within same year/type. */
  order?: number;
}

/** One reason rows were skipped during subtotal extraction (for Step 1 diagnostics). */
export interface VaImportSubtotalSkippedReason {
  reason: string;
  count: number;
  /** Present for "no label match" to list workbook labels that did not match any category. */
  sampleLabels?: string[];
}

/** Deterministic fallback: when style is not detectable, use earliest 3 year columns in KVA totals table. */
export const HISTORICAL_YEARS_FALLBACK_COUNT = 3;

/** Debug metadata for subtotal extraction. */
export interface VaImportSubtotalDebug {
  sourceSheets: string[];
  yearColumnsDetected: number[];
  selectedYear: number;
  /** The 3 historical years selected for extraction (proves selection). */
  selectedHistoricalYears?: number[];
  rowsMatched: number;
  rowsSkipped: number;
  /** Why rows were skipped (no label match, exclude, amount missing). */
  skippedReasons?: VaImportSubtotalSkippedReason[];
}

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

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

/** One reason revenue driver extraction skipped or failed (for Step 1 diagnostics). */
export interface VaImportDriversSkippedReason {
  reason: string;
  count: number;
  /** Sample row/cell texts that were considered but did not match (max 20). */
  sampleCandidateRowTexts?: string[];
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
  /** True when volume was not found in template (leads to "could not locate volume" warning). */
  volumeNotFound?: boolean;
  /** True when connection count was not found (leads to "could not locate connection count" warning). */
  connectionNotFound?: boolean;
  /** Count of rows that matched volume label (m³) but had no usable numeric value. */
  matchedButNoNumberVolume?: number;
  /** Count of rows that matched connection label but had no usable numeric value. */
  matchedButNoNumberConnection?: number;
  /** Sample first-cell or row texts scanned for volume (when no match); max 20. */
  volumeCandidateRowTexts?: string[];
  /** Sample cell texts scanned for connection label; max 20. */
  connectionCandidateRowTexts?: string[];
  /** Skipped/failure reasons for driver extraction (similar to subtotal skippedReasons). */
  driversSkippedReasons?: VaImportDriversSkippedReason[];
  /** Cell source for volume (myytyMaara) when set: sheet name, 1-based row/col, cell text. */
  volumePickedFrom?: { sheet: string; row: number; col: number; cellText: string };
  /** Cell source for connection count (liittymamaara) when set: sheet name, 1-based row/col, cell text. */
  connectionsPickedFrom?: { sheet: string; row: number; col: number; cellText: string };
  /** Cell source for water unit price when set. */
  waterPricePickedFrom?: { sheet: string; row: number; col: number; cellText: string };
  /** Cell source for wastewater unit price when set. */
  wastewaterPricePickedFrom?: { sheet: string; row: number; col: number; cellText: string };
  /** Source for water sales revenue used for volume derivation. */
  waterSalesRevenuePickedFrom?: { sheet: string; row: number; col: number; cellText: string; amount: number };
  /** Source for wastewater sales revenue used for volume derivation. */
  wastewaterSalesRevenuePickedFrom?: { sheet: string; row: number; col: number; cellText: string; amount: number };
  /** True when at least one volume value was derived using revenue/price. */
  volumeDerivedFromRevenue?: boolean;
}

export interface VaImportQualityField {
  status: 'explicit' | 'derived' | 'missing';
  source: string;
  confidence: 'high' | 'medium';
}

export interface VaImportQuality {
  requiredMissing: string[];
  fields: Record<string, VaImportQualityField>;
  errorCodes?: string[];
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
  /** Strict import diagnostics for required input fields. */
  importQuality?: VaImportQuality;
  /** Tier A: subtotal-level P&L lines from KVA summary sheets. */
  subtotalLines?: VaImportSubtotalLine[];
  /** Debug metadata for subtotal extraction. */
  subtotalDebug?: VaImportSubtotalDebug;
}

export interface IVaTemplateAdapter {
  readonly templateId: string;
  detect(workbook: { worksheets: { name: string }[] }, filename: string): boolean;
  preview(workbook: unknown): Promise<VaImportPreview>;
}
