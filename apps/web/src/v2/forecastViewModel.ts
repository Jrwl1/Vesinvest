import type { TFunction } from 'i18next';

import type { V2ForecastScenario, V2OverrideProvenance } from '../api';
import { normalizeImportedFileName } from './provenanceDisplay';
import { toPercentPoints } from './forecastModel';

type ScenarioYearSnapshot = V2ForecastScenario['years'][number] | null | undefined;
type BaselineContext = {
  financials: {
    source: 'veeti' | 'manual' | 'none';
    provenance?: V2OverrideProvenance | null;
  };
  prices: {
    source: 'veeti' | 'manual' | 'none';
    provenance?: V2OverrideProvenance | null;
  };
  volumes: {
    source: 'veeti' | 'manual' | 'none';
    provenance?: V2OverrideProvenance | null;
  };
  soldWaterVolume: number;
  soldWastewaterVolume: number;
  processElectricity: number;
};

export function buildForecastBaselineDatasetSourceLabel(params: {
  t: TFunction;
  source: 'veeti' | 'manual' | 'none';
  provenance: V2OverrideProvenance | null | undefined;
}) {
  const { t, source, provenance } = params;
  const hasStatementImport =
    provenance?.kind === 'statement_import' ||
    (provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'statement_import',
    ) ?? false);
  const hasDocumentImport =
    provenance?.kind === 'document_import' ||
    (provenance?.fieldSources?.some(
      (item) => item.provenance.kind === 'document_import',
    ) ?? false);
  const hasWorkbookImport =
    provenance?.kind === 'kva_import' ||
    provenance?.kind === 'excel_import' ||
    (provenance?.fieldSources?.some(
      (item) =>
        item.provenance.kind === 'kva_import' ||
        item.provenance.kind === 'excel_import',
    ) ?? false);

  if (hasDocumentImport && hasWorkbookImport) {
    return t(
      'v2Forecast.baselineSourceDocumentWorkbookMixed',
      'Source document + workbook repair',
    );
  }
  if (hasStatementImport && hasWorkbookImport) {
    return t(
      'v2Forecast.baselineSourceStatementWorkbookMixed',
      'Statement PDF + workbook repair',
    );
  }
  if (provenance?.kind === 'document_import') {
    return t('v2Forecast.baselineSourceDocumentImport', {
      defaultValue: 'Source document ({{fileName}})',
      fileName: normalizeImportedFileName(provenance.fileName, 'PDF document'),
    });
  }
  if (provenance?.kind === 'statement_import') {
    return t('v2Forecast.baselineSourceStatementImport', {
      defaultValue: 'Statement import ({{fileName}})',
      fileName: normalizeImportedFileName(
        provenance.fileName,
        t('v2Forecast.statementImportFallbackFile', 'statement PDF'),
      ),
    });
  }
  if (provenance?.kind === 'qdis_import') {
    return t('v2Forecast.baselineSourceQdisImport', {
      defaultValue: 'QDIS PDF ({{fileName}})',
      fileName: normalizeImportedFileName(provenance.fileName, 'QDIS PDF'),
    });
  }
  if (provenance?.kind === 'kva_import' || provenance?.kind === 'excel_import') {
    return t('v2Forecast.baselineSourceWorkbookImport', {
      defaultValue: 'Workbook import ({{fileName}})',
      fileName: normalizeImportedFileName(provenance.fileName, 'Excel workbook'),
    });
  }
  if (source === 'manual') {
    return t('v2Forecast.baselineSourceManual', 'Manual review');
  }
  if (source === 'veeti') {
    return t('v2Forecast.baselineSourceVeeti', 'VEETI');
  }
  return t('v2Forecast.baselineSourceMissing', 'Missing');
}

export function buildForecastStatementRows(params: {
  baselineYearSnapshot: ScenarioYearSnapshot;
  horizonYearSnapshot: ScenarioYearSnapshot;
  t: TFunction;
  formatEur: (value: number) => string;
  formatSignedEur: (value: number) => string;
}) {
  const { baselineYearSnapshot, horizonYearSnapshot, t, formatEur, formatSignedEur } =
    params;
  if (!baselineYearSnapshot || !horizonYearSnapshot) {
    return [];
  }

  const formatRowValue = (value: number | undefined): string =>
    typeof value === 'number' ? formatEur(value) : t('v2Forecast.reportStateMissing');
  const formatRowDelta = (
    baselineValue: number | undefined,
    scenarioValue: number | undefined,
  ): string =>
    typeof baselineValue === 'number' && typeof scenarioValue === 'number'
      ? formatSignedEur(scenarioValue - baselineValue)
      : t('v2Forecast.reportStateMissing');

  return [
    {
      id: 'revenue',
      label: t('v2Forecast.statementRevenue', 'Revenue'),
      baseline: formatRowValue(baselineYearSnapshot.revenue),
      scenario: formatRowValue(horizonYearSnapshot.revenue),
      delta: formatRowDelta(baselineYearSnapshot.revenue, horizonYearSnapshot.revenue),
    },
    {
      id: 'costs',
      label: t('v2Forecast.statementCosts', 'Costs'),
      baseline: formatRowValue(baselineYearSnapshot.costs),
      scenario: formatRowValue(horizonYearSnapshot.costs),
      delta: formatRowDelta(baselineYearSnapshot.costs, horizonYearSnapshot.costs),
    },
    {
      id: 'result',
      label: t('v2Forecast.statementResult', 'Result'),
      baseline: formatRowValue(baselineYearSnapshot.result),
      scenario: formatRowValue(horizonYearSnapshot.result),
      delta: formatRowDelta(baselineYearSnapshot.result, horizonYearSnapshot.result),
    },
    {
      id: 'cashflow',
      label: t('v2Forecast.statementCashflow', 'Cashflow'),
      baseline: formatRowValue(baselineYearSnapshot.cashflow),
      scenario: formatRowValue(horizonYearSnapshot.cashflow),
      delta: formatRowDelta(
        baselineYearSnapshot.cashflow,
        horizonYearSnapshot.cashflow,
      ),
    },
    {
      id: 'cumulativeCash',
      label: t('v2Forecast.statementCumulativeCash', 'Cumulative cash'),
      baseline: formatRowValue(baselineYearSnapshot.cumulativeCashflow),
      scenario: formatRowValue(horizonYearSnapshot.cumulativeCashflow),
      delta: formatRowDelta(
        baselineYearSnapshot.cumulativeCashflow,
        horizonYearSnapshot.cumulativeCashflow,
      ),
    },
  ];
}

export function buildForecastOpexWorkbenchConfig(params: {
  activeOpexWorkbench: 'materials' | 'personnel' | 'otherOpex' | null;
  averageNearTermExpense: {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
  baselineContext: BaselineContext | null;
  draftAssumptions: Record<string, number>;
  formatAssumptionPercent: (value: number | undefined) => string;
  formatNumber: (value: number, decimals?: number) => string;
  formatPercent: (value: number) => string;
  t: TFunction;
}) {
  const {
    activeOpexWorkbench,
    averageNearTermExpense,
    baselineContext,
    draftAssumptions,
    formatAssumptionPercent,
    formatNumber,
    formatPercent,
    t,
  } = params;
  if (!activeOpexWorkbench) {
    return null;
  }

  if (activeOpexWorkbench === 'materials') {
    return {
      field: 'energyPct' as const,
      title: t('v2Forecast.pillarMaterials', 'Materials and services'),
      hint: t(
        'v2Forecast.materialsWorkbenchHint',
        'Adjust the energy-driven material-cost path year by year while keeping the cockpit context nearby.',
      ),
      baseline: baselineContext
        ? `${formatNumber(baselineContext.processElectricity)} kWh`
        : formatAssumptionPercent(draftAssumptions.energiakerroin),
      scenario: formatPercent(averageNearTermExpense.energyPct),
      delta: formatPercent(
        averageNearTermExpense.energyPct -
          toPercentPoints(draftAssumptions.energiakerroin),
      ),
    };
  }

  if (activeOpexWorkbench === 'personnel') {
    return {
      field: 'personnelPct' as const,
      title: t('v2Forecast.pillarPersonnel', 'Personnel costs'),
      hint: t(
        'v2Forecast.personnelWorkbenchHint',
        'Edit the personnel-cost path in one dense surface, then return to the cockpit when the yearly profile looks right.',
      ),
      baseline: formatAssumptionPercent(draftAssumptions.henkilostokerroin),
      scenario: formatPercent(averageNearTermExpense.personnelPct),
      delta: formatPercent(
        averageNearTermExpense.personnelPct -
          toPercentPoints(draftAssumptions.henkilostokerroin),
      ),
    };
  }

  return {
    field: 'opexOtherPct' as const,
    title: t('v2Forecast.pillarOtherOpex', 'Other operating costs'),
    hint: t(
      'v2Forecast.otherOpexWorkbenchHint',
      'Tune the remaining operating-cost path separately so the cockpit can show a cleaner statement view.',
    ),
    baseline: formatAssumptionPercent(draftAssumptions.inflaatio),
    scenario: formatPercent(averageNearTermExpense.opexOtherPct),
    delta: formatPercent(
      averageNearTermExpense.opexOtherPct - toPercentPoints(draftAssumptions.inflaatio),
    ),
  };
}

export function buildForecastInvestmentImpactSummary(params: {
  draftInvestments: Array<{ amount: number }>;
  totalDepreciationEffect: number;
  requiredPriceToday: number;
  peakGap: number;
}) {
  const { draftInvestments, totalDepreciationEffect, requiredPriceToday, peakGap } =
    params;
  return {
    totalInvestments: draftInvestments.reduce((sum, row) => sum + row.amount, 0),
    totalDepreciation: totalDepreciationEffect,
    requiredPriceToday,
    peakGap,
  };
}
