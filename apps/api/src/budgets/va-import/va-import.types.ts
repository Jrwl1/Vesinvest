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
}

export interface IVaTemplateAdapter {
  readonly templateId: string;
  detect(workbook: { worksheets: { name: string }[] }, filename: string): boolean;
  preview(workbook: unknown): Promise<VaImportPreview>;
}
