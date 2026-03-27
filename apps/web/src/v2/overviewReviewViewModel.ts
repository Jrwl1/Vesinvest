import {
  buildPriceForm,
  buildVolumeForm,
  getEffectiveFirstRow,
  getRawFirstRow,
  parseManualNumber,
} from './overviewManualForms';
import { buildFinancialComparisonRows, buildImportYearSummaryRows, buildPriceComparisonRows, buildVolumeComparisonRows } from './yearReview';
import { buildStatementOcrComparisonRows } from './statementOcrParse';
import type { V2ImportYearDataResponse, V2WorkbookPreviewResponse } from '../api';

export function buildOverviewFinancialComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
  financialComparisonLabel: (key: string) => string,
) {
  return buildFinancialComparisonRows(yearData).map((row) => ({
    ...row,
    label: financialComparisonLabel(row.key),
  }));
}

export function buildOverviewPriceComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
  priceComparisonLabel: (key: 'waterUnitPrice' | 'wastewaterUnitPrice') => string,
) {
  return buildPriceComparisonRows(yearData).map((row) => ({
    ...row,
    label: priceComparisonLabel(row.key),
  }));
}

export function buildOverviewVolumeComparisonRows(
  yearData: V2ImportYearDataResponse | undefined,
  volumeComparisonLabel: (key: 'soldWaterVolume' | 'soldWastewaterVolume') => string,
) {
  return buildVolumeComparisonRows(yearData).map((row) => ({
    ...row,
    label: volumeComparisonLabel(row.key),
  }));
}

export function buildOverviewStatementImportComparisonRows(params: {
  statementImportPreview:
    | {
        fields: Partial<Record<string, number>>;
        matches: Array<any>;
      }
    | null;
  currentYearData: V2ImportYearDataResponse | undefined;
}) {
  const { statementImportPreview, currentYearData } = params;
  if (!statementImportPreview) {
    return [];
  }
  return buildStatementOcrComparisonRows({
    fields: statementImportPreview.fields as any,
    matches: statementImportPreview.matches as any,
    veetiFinancials: getRawFirstRow(currentYearData, 'tilinpaatos'),
    currentFinancials: getEffectiveFirstRow(currentYearData, 'tilinpaatos'),
  });
}

export function buildOverviewWorkbookImportComparisonYears(params: {
  workbookImportPreview: V2WorkbookPreviewResponse | null;
  workbookImportSelections: Record<number, Partial<Record<string, 'keep_veeti' | 'apply_workbook'>>>;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  financialComparisonLabel: (key: string) => string;
}) {
  const {
    workbookImportPreview,
    workbookImportSelections,
    yearDataCache,
    financialComparisonLabel,
  } = params;
  if (!workbookImportPreview) {
    return [];
  }
  return workbookImportPreview.years.map((year) => {
    const summaryRows = buildImportYearSummaryRows(yearDataCache[year.year]);
    return {
      ...year,
      rows: year.rows.map((row) => ({
        ...row,
        label: financialComparisonLabel(row.key),
        veetiValue:
          summaryRows.find((summaryRow) => summaryRow.sourceField === row.sourceField)
            ?.rawValue ?? null,
        selection:
          workbookImportSelections[year.year]?.[row.sourceField] ?? row.suggestedAction,
      })),
    };
  });
}

export function buildOverviewQdisImportComparisonRows(params: {
  currentYearData: V2ImportYearDataResponse | undefined;
  qdisImportPreview:
    | {
        fields: Partial<Record<string, number>>;
      }
    | null;
  labels: {
    waterPrice: string;
    wastewaterPrice: string;
    waterVolume: string;
    wastewaterVolume: string;
  };
}) {
  const { currentYearData, qdisImportPreview, labels } = params;
  if (!qdisImportPreview) {
    return [];
  }
  const rawPriceRows =
    currentYearData?.datasets.find((dataset) => dataset.dataType === 'taksa')?.rawRows ??
    [];
  const currentPrices = buildPriceForm(currentYearData);
  const currentVolumes = buildVolumeForm(currentYearData);
  const rawWaterPrice = rawPriceRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
  );
  const rawWastewaterPrice = rawPriceRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
  );
  const rawWaterVolume = getRawFirstRow(currentYearData, 'volume_vesi');
  const rawWastewaterVolume = getRawFirstRow(currentYearData, 'volume_jatevesi');
  return [
    {
      key: 'waterUnitPrice',
      label: labels.waterPrice,
      veetiValue: parseManualNumber((rawWaterPrice as any)?.Kayttomaksu),
      pdfValue: qdisImportPreview.fields.waterUnitPrice ?? null,
      currentValue: currentPrices.waterUnitPrice,
    },
    {
      key: 'wastewaterUnitPrice',
      label: labels.wastewaterPrice,
      veetiValue: parseManualNumber((rawWastewaterPrice as any)?.Kayttomaksu),
      pdfValue: qdisImportPreview.fields.wastewaterUnitPrice ?? null,
      currentValue: currentPrices.wastewaterUnitPrice,
    },
    {
      key: 'soldWaterVolume',
      label: labels.waterVolume,
      veetiValue: parseManualNumber((rawWaterVolume as any).Maara),
      pdfValue: qdisImportPreview.fields.soldWaterVolume ?? null,
      currentValue: currentVolumes.soldWaterVolume,
    },
    {
      key: 'soldWastewaterVolume',
      label: labels.wastewaterVolume,
      veetiValue: parseManualNumber((rawWastewaterVolume as any).Maara),
      pdfValue: qdisImportPreview.fields.soldWastewaterVolume ?? null,
      currentValue: currentVolumes.soldWastewaterVolume,
    },
  ].map((row) => ({
    ...row,
    changedFromCurrent:
      row.pdfValue != null && Number(row.pdfValue) !== Number(row.currentValue),
  }));
}

export function buildOverviewWizardBackLabel(
  wizardBackStep: number | null,
  t: (key: string, fallback?: string) => string,
) {
  return wizardBackStep === 1
    ? t('v2Overview.wizardBackStep1', 'Back to connection')
    : wizardBackStep === 2
    ? t('v2Overview.wizardBackStep2', 'Back to year selection')
    : wizardBackStep === 3
    ? t('v2Overview.wizardBackStep3', 'Back to review')
    : wizardBackStep === 5
    ? t('v2Overview.wizardBackStep5', 'Back to baseline')
    : null;
}
