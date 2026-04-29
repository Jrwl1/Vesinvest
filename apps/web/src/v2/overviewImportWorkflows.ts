import type { TFunction } from 'i18next';

import {
  completeImportYearManuallyV2,
  getImportYearDataV2,
  previewWorkbookImportV2,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
  type V2WorkbookPreviewResponse,
} from '../api';
import type { DocumentImportPreview } from './documentPdfImportModel';
import type { MissingRequirement } from './overviewWorkflow';
import type { QdisFieldKey,QdisFieldMatch } from './qdisPdfImport';
import type { StatementOcrMatch } from './statementOcrParse';
import {
  markPersistedReviewedImportYears,
  resolveNextReviewQueueYear,
} from './yearReview';

export type StatementImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<string, number>>;
  matches: StatementOcrMatch[];
  warnings: string[];
};

export type QdisImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<QdisFieldKey, number>>;
  matches: QdisFieldMatch[];
  warnings: string[];
};

type ReviewStatusRowLike = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  setupStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
};

let statementImportModulePromise: Promise<typeof import('./statementOcr')> | null =
  null;
let qdisImportModulePromise: Promise<typeof import('./qdisPdfImport')> | null =
  null;
let documentImportModulePromise: Promise<
  typeof import('./documentPdfImport')
> | null = null;

function loadStatementImportModule() {
  if (!statementImportModulePromise) {
    statementImportModulePromise = import('./statementOcr');
  }
  return statementImportModulePromise;
}

function loadQdisImportModule() {
  if (!qdisImportModulePromise) {
    qdisImportModulePromise = import('./qdisPdfImport');
  }
  return qdisImportModulePromise;
}

function loadDocumentImportModule() {
  if (!documentImportModulePromise) {
    documentImportModulePromise = import('./documentPdfImport');
  }
  return documentImportModulePromise;
}

export async function createWorkbookImportState(params: {
  file: File;
  manualReason: string;
  t: TFunction;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
}): Promise<{
  preview: V2WorkbookPreviewResponse;
  selections: Record<
    number,
    Partial<
      Record<
        V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
        'keep_veeti' | 'apply_workbook'
      >
    >
  >;
  loadedYears: Record<number, V2ImportYearDataResponse>;
  nextReason: string | null;
  status: string;
}> {
  const { file, manualReason, t, yearDataCache } = params;
  const preview = await previewWorkbookImportV2(file);
  const missingYears = preview.matchedYears.filter((year) => yearDataCache[year] == null);
  const loadedYears: Record<number, V2ImportYearDataResponse> = {};
  if (missingYears.length > 0) {
    const entries = await Promise.all(
      missingYears.map(async (year) => [year, await getImportYearDataV2(year)] as const),
    );
    for (const [year, data] of entries) {
      loadedYears[year] = data;
    }
  }
  return {
    preview,
    selections: Object.fromEntries(
      preview.years.map((year) => [
        year.year,
        Object.fromEntries(
          year.rows.map((row) => [row.sourceField, row.suggestedAction]),
        ),
      ]),
    ),
    loadedYears,
    nextReason:
      manualReason.trim().length > 0
        ? null
        : t(
            'v2Overview.workbookImportReasonDefault',
            {
              defaultValue: 'Imported from Excel source file: {{fileName}}',
              fileName: preview.document.fileName,
            },
          ),
    status: t(
      'v2Overview.workbookImportDone',
      'Workbook comparison is ready. Review the matched years and choose which values to keep before saving.',
    ),
  };
}

export async function createStatementImportState(params: {
  file: File;
  manualReason: string;
  t: TFunction;
}): Promise<{
  preview: StatementImportPreview;
  nextReason: string | null;
  status: string;
}> {
  const { file, manualReason, t } = params;
  const { extractStatementFromPdf } = await loadStatementImportModule();
  const result = await extractStatementFromPdf(file);
  return {
    preview: {
      fileName: result.fileName,
      pageNumber: result.pageNumber,
      confidence: result.confidence,
      scannedPageCount: result.scannedPageCount,
      fields: result.fields,
      matches: result.matches,
      warnings: result.warnings,
    },
    nextReason:
      manualReason.trim().length > 0
        ? null
        : t(
            'v2Overview.statementImportReasonDefault',
            {
              defaultValue: 'Imported from statement PDF: {{fileName}}',
              fileName: result.fileName,
            },
          ),
    status: t(
      'v2Overview.statementImportDone',
      'OCR import finished. Review the prefilled values before saving.',
    ),
  };
}

export async function createQdisImportState(params: {
  file: File;
  manualReason: string;
  t: TFunction;
}): Promise<{
  preview: QdisImportPreview;
  nextReason: string | null;
  status: string;
}> {
  const { file, manualReason, t } = params;
  const { extractQdisFromPdf } = await loadQdisImportModule();
  const result = await extractQdisFromPdf(file);
  return {
    preview: {
      fileName: result.fileName,
      pageNumber: result.pageNumber,
      confidence: result.confidence,
      scannedPageCount: result.scannedPageCount,
      fields: result.fields,
      matches: result.matches,
      warnings: result.warnings,
    },
    nextReason:
      manualReason.trim().length > 0
        ? null
        : t(
            'v2Overview.qdisImportReasonDefault',
            {
              defaultValue: 'Imported from QDIS PDF: {{fileName}}',
              fileName: result.fileName,
            },
          ),
    status: t(
      'v2Overview.qdisImportDone',
      'QDIS import finished. Review the detected prices and volumes before saving.',
    ),
  };
}

export async function createDocumentImportState(params: {
  file: File;
  manualReason: string;
  t: TFunction;
}): Promise<{
  preview: DocumentImportPreview;
  nextReason: string | null;
  status: string;
}> {
  const { file, manualReason, t } = params;
  const { extractDocumentFromPdf } = await loadDocumentImportModule();
  const result = await extractDocumentFromPdf(file);
  return {
    preview: result,
    nextReason:
      manualReason.trim().length > 0
        ? null
        : t('v2Overview.documentImportReasonDefault', {
            defaultValue: 'Imported from evidence file: {{fileName}}',
            fileName: result.fileName,
          }),
    status: t(
      'v2Overview.documentImportDone',
      'Document import finished. Review the detected values before saving.',
    ),
  };
}

export async function submitWorkbookImportWorkflow(params: {
  built: {
    payloads: Array<{ year: number; payload: V2ManualYearPatchPayload }>;
    matchedYears: number[];
    yearsToSync: number[];
  };
  syncAfterSave: boolean;
  reviewStatusRows: ReviewStatusRowLike[];
  reviewStorageOrgId: string | null;
  confirmedImportedYears: number[];
  cardEditContext: 'step2' | 'step3' | null;
  baselineReady: boolean;
  runSync: (years: number[]) => Promise<unknown>;
  loadOverview: (options?: {
    preserveVisibleState?: boolean;
    preserveSelectionState?: boolean;
    preserveReviewContinueStep?: boolean;
    deferSecondaryLoads?: boolean;
    refreshPlanningContext?: boolean;
    skipSecondaryLoads?: boolean;
  }) => Promise<void>;
  setReviewedImportedYears: React.Dispatch<React.SetStateAction<number[]>>;
  setYearDataCache: React.Dispatch<
    React.SetStateAction<Record<number, V2ImportYearDataResponse>>
  >;
}): Promise<{
  syncedYears: number[];
  nextQueueRow: ReviewStatusRowLike | null;
  shouldCloseInlineReview: boolean;
}> {
  const {
    built,
    syncAfterSave,
    reviewStatusRows,
    reviewStorageOrgId,
    confirmedImportedYears,
    cardEditContext,
    runSync,
    loadOverview,
    setReviewedImportedYears,
    setYearDataCache,
  } = params;
  const results = await Promise.all(
    built.payloads.map((item) => completeImportYearManuallyV2(item.payload)),
  );
  const syncedYears = results
    .filter((result) => result.syncReady)
    .map((result) => result.year);
  const reviewedYears = syncedYears;
  const reviewedYearSet = new Set(reviewedYears);
  const nextRows = reviewStatusRows.map((row) => ({
    year: row.year,
    planningRole: row.planningRole,
    setupStatus: reviewedYearSet.has(row.year)
      ? ('reviewed' as const)
      : row.setupStatus,
    missingRequirements: row.missingRequirements,
  }));
  const nextQueueYear = resolveNextReviewQueueYear(nextRows);
  const nextQueueRow =
    nextQueueYear == null
      ? null
      : nextRows.find((row) => row.year === nextQueueYear) ?? null;

  setReviewedImportedYears(
    markPersistedReviewedImportYears(
      reviewStorageOrgId,
      reviewedYears,
      [...confirmedImportedYears, ...reviewedYears],
    ),
  );
  setYearDataCache((prev) => {
    const next = { ...prev };
    for (const year of built.yearsToSync) {
      delete next[year];
    }
    return next;
  });

  if (syncAfterSave && syncedYears.length > 0) {
    await runSync(syncedYears);
  } else {
    await loadOverview({
      preserveVisibleState: true,
      preserveSelectionState: true,
      preserveReviewContinueStep: true,
      deferSecondaryLoads: true,
    });
  }

  return {
    syncedYears,
    nextQueueRow,
    shouldCloseInlineReview:
      cardEditContext === 'step3' && nextQueueRow == null && syncedYears.length > 0,
  };
}
