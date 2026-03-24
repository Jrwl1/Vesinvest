import type { TFunction } from 'i18next';

import type { V2OverrideProvenance } from '../api';
import { IMPORT_BOARD_CANON_ROWS } from './overviewManualForms';
import { normalizeImportedFileName } from './provenanceDisplay';
import type { MissingRequirement } from './overviewWorkflow';
import type {
  FinancialComparisonFieldKey,
  ImportYearSourceLayer,
  ImportYearSummaryFieldKey,
  PriceComparisonFieldKey,
  VolumeComparisonFieldKey,
} from './yearReview';

type DatasetSource = 'veeti' | 'manual' | 'none';

function provenanceHasKind(
  provenance: V2OverrideProvenance | null | undefined,
  kinds: Array<V2OverrideProvenance['kind']>,
): boolean {
  return (
    (provenance != null && kinds.includes(provenance.kind)) ||
    (provenance?.fieldSources?.some((item) =>
      kinds.includes(item.provenance.kind),
    ) ??
      false)
  );
}

function hasMixedStatementWorkbookProvenance(
  provenance: V2OverrideProvenance | null | undefined,
): boolean {
  return (
    provenanceHasKind(provenance, ['statement_import']) &&
    provenanceHasKind(provenance, ['kva_import', 'excel_import'])
  );
}

export function getSourceStatusLabel(
  t: TFunction,
  status: string | undefined,
): string {
  if (status === 'VEETI') return t('v2Overview.sourceVeeti', 'VEETI');
  if (status === 'MANUAL') return t('v2Overview.sourceManual', 'Manual');
  if (status === 'MIXED') return t('v2Overview.sourceMixed', 'Mixed');
  return t('v2Overview.sourceIncomplete', 'Incomplete');
}

export function getSourceStatusClassName(status: string | undefined): string {
  if (status === 'VEETI') return 'v2-status-info';
  if (status === 'INCOMPLETE') return 'v2-status-warning';
  return 'v2-status-provenance';
}

export function getRequirementDatasetLabel(
  t: TFunction,
  requirement: MissingRequirement,
): string {
  if (requirement === 'financials') {
    return t('v2Overview.datasetFinancials', 'Tilinpaatos');
  }
  if (requirement === 'prices') {
    return t('v2Overview.datasetPrices', 'Taksa');
  }
  return t('v2Overview.datasetWaterVolume', 'Volyymit');
}

export function getImportYearSummaryLabel(
  t: TFunction,
  key: ImportYearSummaryFieldKey,
): string {
  const row = IMPORT_BOARD_CANON_ROWS.find((item) => item.key === key);
  return row ? t(row.labelKey, row.defaultLabel) : key;
}

export function getMissingRequirementLabel(
  t: TFunction,
  requirement: MissingRequirement,
): string {
  if (requirement === 'financials') {
    return t('v2Overview.requirementFinancials', 'Financial statement data');
  }
  if (requirement === 'prices') {
    return t('v2Overview.requirementPrices', 'Price data (taksa)');
  }
  return t('v2Overview.requirementVolumes', 'Sold volume data');
}

export function getFinancialComparisonLabel(
  t: TFunction,
  key: FinancialComparisonFieldKey | string,
): string {
  if (key === 'liikevaihto') {
    return t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)');
  }
  if (key === 'aineetJaPalvelut') {
    return t('v2Overview.manualFinancialMaterials', 'Materials and services');
  }
  if (key === 'henkilostokulut') {
    return t('v2Overview.manualFinancialPersonnel', 'Personnel costs');
  }
  if (key === 'liiketoiminnanMuutKulut') {
    return t('v2Overview.manualFinancialOtherOpex', 'Other operating costs');
  }
  if (key === 'poistot') {
    return t('v2Overview.manualFinancialDepreciation', 'Depreciation');
  }
  if (key === 'arvonalentumiset') {
    return t('v2Overview.manualFinancialWriteDowns', 'Impairments');
  }
  if (key === 'rahoitustuototJaKulut') {
    return t('v2Overview.manualFinancialFinanceNet', 'Net financing result');
  }
  if (key === 'tilikaudenYliJaama') {
    return t('v2Overview.manualFinancialYearResult', 'Year result');
  }
  if (key === 'omistajatuloutus') {
    return t('v2Overview.manualFinancialOwnerWithdrawal', 'Owner withdrawal');
  }
  return t(
    'v2Overview.manualFinancialOwnerSupport',
    'Owner support for operating costs',
  );
}

export function getDatasetSourceLabel(
  t: TFunction,
  source: DatasetSource,
  provenance: V2OverrideProvenance | null | undefined,
): string {
  if (hasMixedStatementWorkbookProvenance(provenance)) {
    return t(
      'v2Overview.datasetSourceStatementWorkbookMixed',
      'Statement PDF + workbook repair',
    );
  }
  if (provenance?.kind === 'statement_import') {
    return t('v2Overview.datasetSourceStatementImport', {
      defaultValue: 'Statement import ({{fileName}})',
      fileName: normalizeImportedFileName(
        provenance.fileName,
        t('v2Overview.statementImportFallbackFile', 'bokslut PDF'),
      ),
    });
  }
  if (provenance?.kind === 'qdis_import') {
    return t('v2Overview.datasetSourceQdisImport', {
      defaultValue: 'QDIS PDF ({{fileName}})',
      fileName: normalizeImportedFileName(provenance.fileName, 'QDIS PDF'),
    });
  }
  if (provenance?.kind === 'kva_import' || provenance?.kind === 'excel_import') {
    return t('v2Overview.datasetSourceWorkbookImport', {
      defaultValue: 'Workbook import ({{fileName}})',
      fileName: normalizeImportedFileName(provenance.fileName, 'Excel workbook'),
    });
  }
  if (source === 'manual') {
    return t('v2Overview.sourceManual', 'Manual');
  }
  if (source === 'veeti') {
    return t('v2Overview.sourceVeeti', 'VEETI');
  }
  return t('v2Overview.sourceIncomplete', 'Incomplete');
}

export function getDatasetTypeLabel(
  t: TFunction,
  datasetType: string,
): string {
  if (datasetType === 'tilinpaatos') {
    return t('v2Overview.datasetFinancials', 'Financial statement');
  }
  if (datasetType === 'taksa') {
    return t('v2Overview.datasetPrices', 'Unit prices');
  }
  if (datasetType === 'volume_vesi') {
    return t('v2Overview.datasetWaterVolume', 'Sold water volume');
  }
  if (datasetType === 'volume_jatevesi') {
    return t('v2Overview.datasetWastewaterVolume', 'Sold wastewater volume');
  }
  if (datasetType === 'investointi') {
    return t('v2Overview.datasetInvestments', 'Investments');
  }
  if (datasetType === 'energia') {
    return t('v2Overview.datasetEnergy', 'Process electricity');
  }
  if (datasetType === 'verkko') {
    return t('v2Overview.datasetNetwork', 'Network');
  }
  return datasetType;
}

export function renderDatasetTypeList(
  t: TFunction,
  dataTypes?: string[],
): string {
  if (!dataTypes || dataTypes.length === 0) return '-';
  return dataTypes.map((item) => getDatasetTypeLabel(t, item)).join(', ');
}

export function getImportWarningLabel(
  t: TFunction,
  warning: string,
): string {
  if (warning === 'missing_financials') {
    return t(
      'v2Overview.yearWarningMissingFinancials',
      'Financial statement data is missing.',
    );
  }
  if (warning === 'missing_prices') {
    return t('v2Overview.yearWarningMissingPrices', 'Price data is missing.');
  }
  if (warning === 'missing_volumes') {
    return t(
      'v2Overview.yearWarningMissingVolumes',
      'Sold volume data is missing.',
    );
  }
  return t(
    'v2Overview.yearWarningFallbackZero',
    'Missing VEETI values default to 0 in calculations.',
  );
}

export function renderDatasetCounts(
  t: TFunction,
  counts?: Record<string, number>,
): string {
  if (!counts) return '-';
  const orderedKeys = [
    'tilinpaatos',
    'taksa',
    'volume_vesi',
    'volume_jatevesi',
    'investointi',
    'energia',
    'verkko',
  ];
  const parts = orderedKeys
    .map((key) => ({ key, count: Number(counts[key] ?? 0) }))
    .filter((item) => item.count > 0)
    .map((item) => `${getDatasetTypeLabel(t, item.key)}: ${item.count}`);
  return parts.length > 0 ? parts.join(', ') : '-';
}

export function getSourceLayerText(
  t: TFunction,
  layer: ImportYearSourceLayer,
): string {
  const datasetLabel =
    layer.key === 'financials'
      ? t('v2Overview.datasetFinancials', 'Financial statement')
      : layer.key === 'prices'
      ? t('v2Overview.datasetPrices', 'Unit prices')
      : t('v2Overview.datasetWaterVolume', 'Sold volumes');
  const sourceLabel =
    layer.provenanceKinds?.includes('statement_import') &&
    (layer.provenanceKinds?.includes('kva_import') ||
      layer.provenanceKinds?.includes('excel_import'))
      ? t(
          'v2Overview.datasetSourceStatementWorkbookMixed',
          'Statement PDF + workbook repair',
        )
      : layer.provenanceKind === 'qdis_import'
      ? t('v2Overview.datasetSourceQdisImport', {
          defaultValue: 'QDIS PDF ({{fileName}})',
          fileName: normalizeImportedFileName(layer.fileName, 'QDIS PDF'),
        })
      : layer.provenanceKind === 'statement_import'
      ? t('v2Overview.datasetSourceStatementImport', {
          defaultValue: 'Statement import ({{fileName}})',
          fileName: normalizeImportedFileName(
            layer.fileName,
            t('v2Overview.statementImportFallbackFile', 'bokslut PDF'),
          ),
        })
      : layer.provenanceKind === 'kva_import' ||
        layer.provenanceKind === 'excel_import'
      ? t('v2Overview.datasetSourceWorkbookImport', {
          defaultValue: 'Workbook import ({{fileName}})',
          fileName: normalizeImportedFileName(layer.fileName, 'Excel workbook'),
        })
      : layer.source === 'manual'
      ? t('v2Overview.sourceManual', 'Manual')
      : layer.source === 'veeti'
      ? t('v2Overview.sourceVeeti', 'VEETI')
      : t('v2Overview.sourceIncomplete', 'Incomplete');
  return `${datasetLabel}: ${sourceLabel}`;
}

export function getPriceComparisonLabel(
  t: TFunction,
  key: PriceComparisonFieldKey,
): string {
  if (key === 'waterUnitPrice') {
    return t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)');
  }
  return t(
    'v2Overview.manualPriceWastewater',
    'Wastewater unit price (EUR/m3)',
  );
}

export function getVolumeComparisonLabel(
  t: TFunction,
  key: VolumeComparisonFieldKey,
): string {
  if (key === 'soldWaterVolume') {
    return t('v2Overview.manualVolumeWater', 'Sold water volume (m3)');
  }
  return t(
    'v2Overview.manualVolumeWastewater',
    'Sold wastewater volume (m3)',
  );
}

export function getFinancialSourceFieldLabel(
  t: TFunction,
  sourceField: string,
): string {
  if (sourceField === 'Liikevaihto') {
    return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
  }
  if (sourceField === 'AineetJaPalvelut') {
    return t(
      'v2Overview.previewAccountingMaterialsLabel',
      'Materials and services',
    );
  }
  if (sourceField === 'Henkilostokulut') {
    return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
  }
  if (sourceField === 'Poistot') {
    return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
  }
  if (sourceField === 'LiiketoiminnanMuutKulut') {
    return t('v2Overview.previewAccountingOtherOpexLabel', 'Other operating costs');
  }
  if (sourceField === 'TilikaudenYliJaama') {
    return t('v2Overview.previewAccountingResultLabel', 'Result');
  }
  return sourceField;
}
