import type { TFunction } from 'i18next';

import type {
  V2PlanningContextResponse,
  V2VesinvestBaselineSnapshotYear,
  V2VesinvestBaselineSourceState,
} from '../api';
import { formatDateTime } from './format';
import {
  getDocumentImportEvidence,
  getImportedFileNameByKind,
  normalizeImportedFileName,
} from './provenanceDisplay';
import type { VesinvestBaselineYear } from './vesinvestPlanningModel';

const appendDetailSuffix = (
  base: string,
  suffixes: Array<string | null | undefined>,
): string => {
  const details = suffixes.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return details.length > 0 ? `${base} | ${details.join(' | ')}` : base;
};

export const sourceStatusLabel = (
  t: TFunction,
  status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE',
  planningRole?: 'historical' | 'current_year_estimate',
) => {
  let label =
    status === 'MANUAL'
      ? t('v2Reports.baselineStatusManual', 'Manual baseline')
      : status === 'MIXED'
      ? t('v2Reports.baselineStatusMixed', 'Mixed baseline')
      : status === 'INCOMPLETE'
      ? t('v2Reports.baselineStatusIncomplete', 'Incomplete baseline')
      : t('v2Reports.baselineStatusVeeti', 'VEETI baseline');
  if (planningRole === 'current_year_estimate') {
    label = `${label} \u00b7 ${t('v2Overview.currentYearEstimateBadge', 'Estimate')}`;
  }
  return label;
};

export const datasetSourceLabel = (
  t: TFunction,
  dataset: VesinvestBaselineYear['financials'],
) => {
  const documentEvidence = getDocumentImportEvidence(dataset.provenance);
  const documentFileName = normalizeImportedFileName(
    documentEvidence.fileName ?? dataset.provenance?.fileName,
    'PDF document',
  );
  const withDocumentEvidence = (value: string, extraDetails: string[] = []) =>
    appendDetailSuffix(value, [...extraDetails, documentEvidence.pageLabel]);
  const hasStatementImport =
    dataset.provenance?.kind === 'statement_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'statement_import',
    ) ?? false);
  const hasDocumentImport =
    dataset.provenance?.kind === 'document_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'document_import',
    ) ?? false);
  const hasWorkbookImport =
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) =>
        item.provenance.kind === 'kva_import' ||
        item.provenance.kind === 'excel_import',
    ) ?? false);
  if (hasDocumentImport && hasWorkbookImport) {
    return withDocumentEvidence(
      t(
        'v2Reports.baselineSourceDocumentWorkbookMixed',
        'Source document + Excel repair',
      ),
      [documentFileName],
    );
  }
  if (hasStatementImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
        'v2Reports.baselineSourceStatementWorkbookMixed',
        'Statement PDF + Excel repair',
      ),
      [
        getImportedFileNameByKind(
          dataset.provenance,
          'statement_import',
          t('v2Reports.statementImportFallbackFile', 'statement PDF'),
        ),
      ],
    );
  }
  if (hasDocumentImport) {
    return withDocumentEvidence(
      t('v2Reports.baselineSourceDocumentImport', {
        defaultValue: 'Source document ({{fileName}})',
        fileName: documentFileName,
      }),
    );
  }
  if (dataset.provenance?.kind === 'statement_import') {
    return t('v2Reports.baselineSourceStatementImport', {
      defaultValue: 'Statement import ({{fileName}})',
      fileName: normalizeImportedFileName(
        dataset.provenance.fileName,
        t('v2Reports.statementImportFallbackFile', 'statement PDF'),
      ),
    });
  }
  if (dataset.provenance?.kind === 'qdis_import') {
    return t('v2Reports.baselineSourceQdisImport', {
      defaultValue: 'QDIS PDF ({{fileName}})',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'QDIS PDF'),
    });
  }
  if (
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import'
  ) {
    return t('v2Reports.baselineSourceWorkbookImport', {
      defaultValue: 'Excel repair ({{fileName}})',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'Excel file'),
    });
  }
  if (dataset.source === 'manual') {
    return t('v2Reports.baselineSourceManual', 'Manual review');
  }
  if (dataset.source === 'veeti') {
    return t('v2Reports.baselineSourceVeeti', 'VEETI');
  }
  return t('v2Reports.baselineSourceMissing', 'Missing');
};

export const datasetSourceNote = (
  t: TFunction,
  dataset: VesinvestBaselineYear['financials'],
) => {
  const documentEvidence = getDocumentImportEvidence(dataset.provenance);
  const documentFileName = normalizeImportedFileName(
    documentEvidence.fileName ?? dataset.provenance?.fileName,
    'PDF document',
  );
  const documentEvidenceDetail = [
    documentEvidence.pageLabel,
    ...documentEvidence.sourceLines,
  ];
  const hasStatementImport =
    dataset.provenance?.kind === 'statement_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'statement_import',
    ) ?? false);
  const hasDocumentImport =
    dataset.provenance?.kind === 'document_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'document_import',
    ) ?? false);
  const hasWorkbookImport =
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import' ||
    (dataset.provenance?.fieldSources?.some(
      (item) =>
        item.provenance.kind === 'kva_import' ||
        item.provenance.kind === 'excel_import',
    ) ?? false);
  if (hasDocumentImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
        'v2Reports.baselineDocumentWorkbookDetail',
        'Document-backed values and Excel repairs both affect this year.',
      ),
      [documentFileName, ...documentEvidenceDetail],
    );
  }
  if (hasStatementImport && hasWorkbookImport) {
    return appendDetailSuffix(
      t(
        'v2Reports.baselineStatementWorkbookDetail',
        'Statement-backed values and Excel repairs both affect this year.',
      ),
      [
        getImportedFileNameByKind(
          dataset.provenance,
          'statement_import',
          t('v2Reports.statementImportFallbackFile', 'statement PDF'),
        ),
      ],
    );
  }
  if (hasDocumentImport) {
    return appendDetailSuffix(
      t('v2Reports.baselineDocumentImportDetail', {
        defaultValue: 'Values came from {{fileName}}',
        fileName: normalizeImportedFileName(
          documentEvidence.fileName ?? dataset.provenance?.fileName,
          'PDF document',
        ),
      }),
      documentEvidenceDetail,
    );
  }
  if (dataset.provenance?.kind === 'statement_import') {
    return t('v2Reports.baselineStatementImportDetail', {
      defaultValue: 'Financials came from {{fileName}}',
      fileName: normalizeImportedFileName(
        dataset.provenance.fileName,
        t('v2Reports.statementImportFallbackFile', 'statement PDF'),
      ),
    });
  }
  if (dataset.provenance?.kind === 'qdis_import') {
    return t('v2Reports.baselineQdisImportDetail', {
      defaultValue: 'Prices and volumes came from {{fileName}}',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'QDIS PDF'),
    });
  }
  if (
    dataset.provenance?.kind === 'kva_import' ||
    dataset.provenance?.kind === 'excel_import'
  ) {
    return t('v2Reports.baselineWorkbookImportDetail', {
      defaultValue: 'Excel-backed values came from {{fileName}}',
      fileName: normalizeImportedFileName(dataset.provenance.fileName, 'Excel file'),
    });
  }
  if (dataset.source === 'manual' && dataset.reason) {
    return t('v2Reports.baselineManualReason', 'Reason: {{reason}}', {
      reason: dataset.reason,
    });
  }
  if (dataset.source === 'manual' && dataset.editedAt) {
    return t('v2Reports.baselineManualEditedAt', 'Reviewed {{date}}', {
      date: formatDateTime(dataset.editedAt),
    });
  }
  if (dataset.source === 'veeti') {
    return null;
  }
  return t(
    'v2Reports.baselineSourceMissingHint',
    'No trusted dataset was available in the saved baseline.',
  );
};

export const qualityLabel = (
  t: TFunction,
  quality: VesinvestBaselineYear['quality'],
) =>
  quality === 'complete'
    ? t('v2Vesinvest.qualityComplete', 'Complete')
    : quality === 'partial'
    ? t('v2Vesinvest.qualityPartial', 'Partial')
    : t('v2Vesinvest.qualityMissing', 'Missing');

const cloneJson = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

export const readSavedBaselineYears = (
  state: V2VesinvestBaselineSourceState | null,
): V2VesinvestBaselineSnapshotYear[] => {
  if (!Array.isArray(state?.baselineYears)) {
    return [];
  }
  return cloneJson(state.baselineYears);
};

export const buildBaselineSourceSnapshot = (
  planningContext: V2PlanningContextResponse | null,
  currentState: V2VesinvestBaselineSourceState | null,
  revisionBaselineDrifted = false,
): V2VesinvestBaselineSourceState | null => {
  const liveBaselineYears = Array.isArray(planningContext?.baselineYears)
    ? cloneJson(planningContext.baselineYears)
    : [];
  const fallbackBaselineYears = readSavedBaselineYears(currentState);
  const baselineYears =
    liveBaselineYears.length > 0 ? liveBaselineYears : fallbackBaselineYears;
  const acceptedYears = baselineYears
    .map((row) => Number(row.year))
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => left - right);
  const savedAcceptedYears = [...(currentState?.acceptedYears ?? [])]
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((left, right) => left - right);
  const hasLiveAcceptedYears = liveBaselineYears.length > 0;
  const acceptedYearsMatchSaved =
    acceptedYears.length === savedAcceptedYears.length &&
    acceptedYears.every((year, index) => year === savedAcceptedYears[index]);
  if (baselineYears.length === 0 && !currentState) {
    return null;
  }
  return {
    ...(currentState ?? {}),
    source:
      planningContext?.canCreateScenario === true
        ? 'planning_context_verified'
        : currentState?.source ?? 'planning_context',
    acceptedYears,
    latestAcceptedBudgetId:
      revisionBaselineDrifted
        ? null
        : !hasLiveAcceptedYears || acceptedYearsMatchSaved
        ? currentState?.latestAcceptedBudgetId ?? null
        : null,
    snapshotCapturedAt: new Date().toISOString(),
    baselineYears,
  };
};
