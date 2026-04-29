import type { TFunction } from 'i18next';

import type { V2OverrideProvenance } from '../api';
import { formatDateTime } from './format';
import {
  getDocumentImportEvidence,
  getImportedFileNameByKind,
  normalizeImportedFileName,
} from './provenanceDisplay';
import { appendDetailSuffix } from './reportReadinessModel';

export function createBaselineDatasetSourceLabel(t: TFunction) {
  return (
    source: 'veeti' | 'manual' | 'none',
    provenance: V2OverrideProvenance | null | undefined,
  ) => {
    const documentEvidence = getDocumentImportEvidence(provenance);
    const documentFileName = normalizeImportedFileName(
      documentEvidence.fileName ?? provenance?.fileName,
      'PDF document',
    );
    const withDocumentEvidence = (value: string, extraDetails: string[] = []) =>
      appendDetailSuffix(value, [...extraDetails, documentEvidence.pageLabel]);
    const hasStatementImport =
      provenance?.kind === 'statement_import' ||
      (provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'statement_import',
      ) ??
        false);
    const hasDocumentImport =
      provenance?.kind === 'document_import' ||
      (provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'document_import',
      ) ??
        false);
    const hasWorkbookImport =
      provenance?.kind === 'kva_import' ||
      provenance?.kind === 'excel_import' ||
      (provenance?.fieldSources?.some(
        (item) =>
          item.provenance.kind === 'kva_import' ||
          item.provenance.kind === 'excel_import',
      ) ??
        false);
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
            provenance,
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
    if (provenance?.kind === 'statement_import') {
      return t('v2Reports.baselineSourceStatementImport', {
        defaultValue: 'Statement import ({{fileName}})',
        fileName: normalizeImportedFileName(
          provenance.fileName,
          t('v2Reports.statementImportFallbackFile', 'statement PDF'),
        ),
      });
    }
    if (provenance?.kind === 'qdis_import') {
      return t('v2Reports.baselineSourceQdisImport', {
        defaultValue: 'QDIS PDF ({{fileName}})',
        fileName: normalizeImportedFileName(provenance.fileName, 'QDIS PDF'),
      });
    }
    if (
      provenance?.kind === 'kva_import' ||
      provenance?.kind === 'excel_import'
    ) {
      return t('v2Reports.baselineSourceWorkbookImport', {
        defaultValue: 'Excel repair ({{fileName}})',
        fileName: normalizeImportedFileName(
          provenance.fileName,
          'Excel file',
        ),
      });
    }
    if (source === 'manual') {
      return t('v2Reports.baselineSourceManual', 'Manual review');
    }
    if (source === 'veeti') {
      return t('v2Reports.baselineSourceVeeti', 'VEETI');
    }
    return t('v2Reports.baselineSourceMissing', 'Missing');
  };
}

export function createBaselineStatusLabel(t: TFunction) {
  return (
    status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE',
    planningRole?: 'historical' | 'current_year_estimate',
  ) => {
    let label: string;
    switch (status) {
      case 'MANUAL':
        label = t('v2Reports.baselineStatusManual', 'Manual baseline');
        break;
      case 'MIXED':
        label = t('v2Reports.baselineStatusMixed', 'Mixed baseline');
        break;
      case 'INCOMPLETE':
        label = t('v2Reports.baselineStatusIncomplete', 'Incomplete baseline');
        break;
      case 'VEETI':
      default:
        label = t('v2Reports.baselineStatusVeeti', 'VEETI baseline');
        break;
    }
    return planningRole === 'current_year_estimate'
      ? `${label} · ${t('v2Overview.currentYearEstimateBadge', 'Estimate')}`
      : label;
  };
}

export function createDataTypeLabel(t: TFunction) {
  return (dataType: string) => {
    switch (dataType) {
      case 'tilinpaatos':
        return t('v2Reports.baselineFinancials', 'Financials');
      case 'taksa':
        return t('v2Reports.baselinePrices', 'Prices');
      case 'volume_vesi':
        return t('v2Reports.baselineSoldWater', 'Sold water');
      case 'volume_jatevesi':
        return t('v2Reports.baselineSoldWastewater', 'Sold wastewater');
      case 'investointi':
        return t('v2Overview.datasetInvestments', 'Investments');
      case 'energia':
        return t('v2Overview.datasetEnergy', 'Process electricity');
      case 'verkko':
        return t('v2Overview.datasetNetwork', 'Network');
      default:
        return dataType;
    }
  };
}

export function createDatasetPublicationNote(t: TFunction) {
  return (dataset: {
    source: 'veeti' | 'manual' | 'none';
    editedAt: string | null;
    reason: string | null;
    provenance: V2OverrideProvenance | null | undefined;
  }) => {
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
      ) ??
        false);
    const hasDocumentImport =
      dataset.provenance?.kind === 'document_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'document_import',
      ) ??
        false);
    const hasWorkbookImport =
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) =>
          item.provenance.kind === 'kva_import' ||
          item.provenance.kind === 'excel_import',
      ) ??
        false);
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
        fileName: normalizeImportedFileName(
          dataset.provenance.fileName,
          'QDIS PDF',
        ),
      });
    }
    if (
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import'
    ) {
      return t('v2Reports.baselineWorkbookImportDetail', {
        defaultValue: 'Excel-backed values came from {{fileName}}',
        fileName: normalizeImportedFileName(
          dataset.provenance.fileName,
          'Excel file',
        ),
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
      return t(
        'v2Reports.baselineSourceVeetiHint',
        'Current report snapshot follows VEETI for this dataset.',
      );
    }
    return t(
      'v2Reports.baselineSourceMissingHint',
      'No trusted dataset was available in the saved baseline.',
    );
  };
}
