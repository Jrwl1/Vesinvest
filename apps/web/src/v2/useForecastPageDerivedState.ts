import React from 'react';
import type { TFunction } from 'i18next';

import type { V2OverrideProvenance } from '../api';
import { formatEur, formatNumber, formatPercent, formatPrice, formatVolume } from './format';
import {
  ASSUMPTION_LABEL_KEYS,
  formatSignedEur,
  toPercentPoints,
} from './forecastModel';
import {
  buildForecastBaselineDatasetSourceLabel,
  buildForecastInvestmentImpactSummary,
  buildForecastOpexWorkbenchConfig,
  buildForecastStatementRows,
} from './forecastViewModel';
import type { useForecastInvestmentController } from './useForecastInvestmentController';
import type { useForecastScenarioController } from './useForecastScenarioController';

type Params = {
  t: TFunction;
  scenarioController: ReturnType<typeof useForecastScenarioController>;
  investmentController: ReturnType<typeof useForecastInvestmentController>;
  activeOpexWorkbench: 'materials' | 'personnel' | 'otherOpex' | null;
};

export function useForecastPageDerivedState({
  t,
  scenarioController,
  investmentController,
  activeOpexWorkbench,
}: Params) {
  const reportReadinessReason = React.useMemo(() => {
    const activePlan = scenarioController.planningContext?.vesinvest?.activePlan ?? null;
    if (!scenarioController.scenario) {
      return 'missingScenario' as const;
    }
    if (!activePlan?.id || activePlan.selectedScenarioId !== scenarioController.selectedScenarioId) {
      return 'missingActivePlanLink' as const;
    }
    if (activePlan.classificationReviewRequired) {
      return 'classificationReviewRequired' as const;
    }
    if (activePlan.assetEvidenceReady === false) {
      return 'assetEvidenceIncomplete' as const;
    }
    if (activePlan.tariffPlanStatus !== 'accepted') {
      return 'tariffPlanRequired' as const;
    }
    if (scenarioController.forecastFreshnessState === 'computing') {
      return 'missingComputeResults' as const;
    }
    if (scenarioController.forecastFreshnessState === 'unsaved_changes') {
      return 'unsavedChanges' as const;
    }
    if (scenarioController.forecastFreshnessState === 'saved_needs_recompute') {
      if (scenarioController.scenario.years.length === 0) {
        return 'missingComputeResults' as const;
      }
      return 'staleComputeToken' as const;
    }
    if (
      scenarioController.scenario.yearlyInvestments.some(
        (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
      )
    ) {
      return 'missingDepreciationSnapshots' as const;
    }
    return null;
  }, [
    scenarioController.forecastFreshnessState,
    scenarioController.planningContext?.vesinvest?.activePlan,
    scenarioController.scenario,
    scenarioController.selectedScenarioId,
  ]);

  const canCreateReport = reportReadinessReason == null;
  const reportBlockerNeedsComputeAction = React.useMemo(
    () =>
      reportReadinessReason === 'unsavedChanges' ||
      reportReadinessReason === 'missingComputeResults' ||
      reportReadinessReason === 'staleComputeToken',
    [reportReadinessReason],
  );
  const reportReadinessHint = React.useMemo(() => {
    switch (reportReadinessReason) {
      case 'unsavedChanges':
        return t(
          'v2Forecast.unsavedHint',
          'You have unsaved changes. Save and compute results before creating report.',
        );
      case 'missingComputeResults':
        return t(
          'v2Forecast.computeBeforeReport',
          'Recompute results before creating report.',
        );
      case 'classificationReviewRequired':
        return t(
          'v2Forecast.classificationReviewRequired',
          'Review and save the Vesinvest class plan before creating a report.',
        );
      case 'assetEvidenceIncomplete':
        return t(
          'v2Vesinvest.assetEvidenceReportBlocked',
          'Complete asset-management evidence before creating reports.',
        );
      case 'tariffPlanRequired':
        return t(
          'v2TariffPlan.acceptBeforeReports',
          'Accept the tariff plan before creating reports.',
        );
      case 'missingDepreciationSnapshots':
        return t(
          'v2Forecast.depreciationSnapshotsMissingHint',
          'Refresh the synced Vesinvest class plan and recompute results before creating report.',
        );
      case 'staleComputeToken':
        return t(
          'v2Forecast.staleComputeHint',
          'Saved inputs changed after the last calculation. Recompute results before creating report.',
        );
      case 'missingActivePlanLink':
        return t(
          'v2Forecast.reportRequiresActiveVesinvestPlan',
          'Select an active Vesinvest revision before creating a report.',
        );
      default:
        return null;
    }
  }, [reportReadinessReason, t]);

  const reportReadinessToneClass = React.useMemo(() => {
    if (canCreateReport) return 'v2-status-positive';
    if (
      reportReadinessReason === 'staleComputeToken' ||
      reportReadinessReason === 'unsavedChanges' ||
      reportReadinessReason === 'missingDepreciationSnapshots'
    ) {
      return 'v2-status-warning';
    }
    return 'v2-status-neutral';
  }, [canCreateReport, reportReadinessReason]);

  const reportReadinessLabel = React.useMemo(
    () => (canCreateReport ? t('v2Forecast.reportReady') : t('v2Forecast.reportBlocked')),
    [canCreateReport, t],
  );

  const reportCommandSummary = React.useMemo(
    () =>
      reportReadinessHint ??
      t(
        'v2Forecast.reportReadyHint',
        'Latest computed scenario can be published as a report.',
      ),
    [reportReadinessHint, t],
  );

  const forecastStateToneClass = React.useMemo(() => {
    switch (scenarioController.forecastFreshnessState) {
      case 'current':
        return 'v2-status-positive';
      case 'computing':
        return 'v2-status-info';
      default:
        return 'v2-status-warning';
    }
  }, [scenarioController.forecastFreshnessState]);

  const forecastStateLabel = React.useMemo(() => {
    switch (scenarioController.forecastFreshnessState) {
      case 'current':
        return t('v2Forecast.stateCurrent');
      case 'computing':
        return t('v2Forecast.stateComputing');
      case 'unsaved_changes':
        return t('v2Forecast.stateUnsaved');
      default:
        return t('v2Forecast.stateNeedsRecompute');
    }
  }, [scenarioController.forecastFreshnessState, t]);

  const computeButtonLabel = React.useMemo(() => {
    switch (scenarioController.forecastFreshnessState) {
      case 'unsaved_changes':
        return t('v2Forecast.computeActionSaveAndRecompute', 'Save and compute results');
      case 'computing':
        return t('v2Forecast.computeActionComputing', 'Computing results...');
      default:
        return t('v2Forecast.computeActionRecompute', 'Recompute results');
    }
  }, [scenarioController.forecastFreshnessState, t]);

  const forecastSurfaceToneClass = React.useMemo(() => {
    switch (scenarioController.forecastFreshnessState) {
      case 'current':
        return 'v2-surface-current';
      case 'computing':
        return 'v2-surface-computing';
      default:
        return 'v2-surface-stale';
    }
  }, [scenarioController.forecastFreshnessState]);

  const assumptionLabelByKey = React.useCallback(
    (key: string) => t(ASSUMPTION_LABEL_KEYS[key] ?? key, key),
    [t],
  );
  const formatAssumptionPercent = React.useCallback((value: number | undefined) => {
    const numeric = Number.isFinite(value) ? Number(value) : 0;
    const asPercent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
    return `${formatNumber(asPercent, 2)} %`;
  }, []);

  const scenarioTypeLabel = React.useCallback(
    (value: 'base' | 'committed' | 'hypothesis' | 'stress') => {
      if (value === 'base') return t('v2Forecast.baseScenario', 'Base');
      if (value === 'committed') return t('v2Forecast.committedScenario', 'Committed');
      if (value === 'hypothesis') return t('v2Forecast.hypothesisScenario', 'Hypothesis');
      return t('v2Forecast.stressScenario', 'Stress');
    },
    [t],
  );

  const baselineContext = React.useMemo(() => {
    if (!scenarioController.scenario?.baselineYear || !scenarioController.planningContext) {
      return null;
    }
    return (
      scenarioController.planningContext.baselineYears.find(
        (row) => row.year === scenarioController.scenario?.baselineYear,
      ) ?? null
    );
  }, [scenarioController.planningContext, scenarioController.scenario?.baselineYear]);
  const baselineYearSnapshot = React.useMemo(
    () => scenarioController.scenario?.years[0] ?? null,
    [scenarioController.scenario],
  );
  const horizonYearSnapshot = React.useMemo(
    () =>
      scenarioController.scenario && scenarioController.scenario.years.length > 0
        ? scenarioController.scenario.years[scenarioController.scenario.years.length - 1] ?? null
        : null,
    [scenarioController.scenario],
  );
  const baselineDatasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: V2OverrideProvenance | null,
    ) =>
      buildForecastBaselineDatasetSourceLabel({ t, source, provenance }),
    [t],
  );
  const baselineSourceStatusLabel = React.useCallback(
    (
      status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE',
      planningRole?: 'historical' | 'current_year_estimate',
    ) => {
      const label =
        status === 'VEETI'
          ? t('v2Forecast.baselineYearSourceVeeti', 'VEETI')
          : status === 'MANUAL'
            ? t('v2Forecast.baselineYearSourceManual', 'Manual')
            : status === 'MIXED'
              ? t('v2Forecast.baselineYearSourceMixed', 'Mixed')
              : t('v2Forecast.baselineYearSourceIncomplete', 'Incomplete');
      return planningRole === 'current_year_estimate'
        ? `${label} · ${t('v2Overview.currentYearEstimateBadge', 'Estimate')}`
        : label;
    },
    [t],
  );

  const statementRows = React.useMemo(
    () =>
      buildForecastStatementRows({
        baselineYearSnapshot,
        horizonYearSnapshot,
        t,
        formatEur,
        formatSignedEur,
      }),
    [baselineYearSnapshot, horizonYearSnapshot, t],
  );

  const statementPillars = React.useMemo(() => {
    const baselineVolume =
      baselineContext == null
        ? 0
        : baselineContext.soldWaterVolume + baselineContext.soldWastewaterVolume;
    return [
      {
        id: 'investments',
        title: t('v2Forecast.investmentProgramTitle', 'Investment program'),
        baseline: t(
          'v2Forecast.investmentPeakAnnualTotal',
          'Peak annual investment total',
        ),
        scenario: formatEur(investmentController.investmentSummary.peakAnnualAmount),
        delta: t('v2Forecast.mappingSavedYears', '{{saved}}/{{total}} years saved', {
          saved: investmentController.savedMappedInvestmentYearsCount,
          total: investmentController.plannedInvestmentYears.length,
        }),
        provenance: t(
          'v2Forecast.investmentStrongestFiveYear',
          'Strongest rolling 5-year total',
        ),
      },
      {
        id: 'revenues',
        title: t('v2Forecast.pillarRevenue', 'Revenue'),
        baseline: baselineContext
          ? `${formatPrice(scenarioController.scenario?.baselinePriceTodayCombined ?? 0)} · ${formatVolume(baselineVolume)}`
          : formatPrice(scenarioController.scenario?.baselinePriceTodayCombined ?? 0),
        scenario: scenarioController.latestPricePoint
          ? `${formatPrice(scenarioController.latestPricePoint.combinedPrice)} · ${formatVolume(horizonYearSnapshot?.soldVolume ?? baselineYearSnapshot?.soldVolume ?? 0)}`
          : t('v2Forecast.reportStateMissing'),
        delta:
          scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult != null
            ? formatPercent(
                scenarioController.scenario.requiredAnnualIncreasePctAnnualResult,
              )
            : t('v2Forecast.reportStateMissing'),
        provenance: baselineContext
          ? `${baselineDatasetSourceLabel(
              baselineContext.prices.source,
              baselineContext.prices.provenance,
            )} / ${baselineDatasetSourceLabel(
              baselineContext.volumes.source,
              baselineContext.volumes.provenance,
            )}`
          : t('v2Forecast.reportStateMissing'),
      },
      {
        id: 'materials',
        title: t('v2Forecast.pillarMaterials', 'Materials and services'),
        baseline: baselineContext
          ? `${formatNumber(baselineContext.processElectricity)} kWh`
          : formatAssumptionPercent(scenarioController.draftAssumptions.energiakerroin),
        scenario: investmentController.firstNearTermExpense
          ? formatPercent(investmentController.firstNearTermExpense.energyPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          investmentController.averageNearTermExpense.energyPct -
            toPercentPoints(scenarioController.draftAssumptions.energiakerroin),
        ),
        provenance: t('v2Forecast.ctxProcessElectricity', 'Process electricity'),
      },
      {
        id: 'personnel',
        title: t('v2Forecast.pillarPersonnel', 'Personnel costs'),
        baseline: formatAssumptionPercent(
          scenarioController.draftAssumptions.henkilostokerroin,
        ),
        scenario: investmentController.firstNearTermExpense
          ? formatPercent(investmentController.firstNearTermExpense.personnelPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          investmentController.averageNearTermExpense.personnelPct -
            toPercentPoints(scenarioController.draftAssumptions.henkilostokerroin),
        ),
        provenance: baselineContext
          ? baselineDatasetSourceLabel(
              baselineContext.financials.source,
              baselineContext.financials.provenance,
            )
          : t('v2Forecast.reportStateMissing'),
      },
      {
        id: 'opex',
        title: t('v2Forecast.pillarOtherOpex', 'Other operating costs'),
        baseline: formatAssumptionPercent(scenarioController.draftAssumptions.inflaatio),
        scenario: investmentController.firstNearTermExpense
          ? formatPercent(investmentController.firstNearTermExpense.opexOtherPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          investmentController.averageNearTermExpense.opexOtherPct -
            toPercentPoints(scenarioController.draftAssumptions.inflaatio),
        ),
        provenance: t(
          'v2Forecast.pillarOtherOpexHint',
          'Near-term editable OPEX path',
        ),
      },
    ];
  }, [
    baselineContext,
    baselineDatasetSourceLabel,
    baselineYearSnapshot?.soldVolume,
    formatAssumptionPercent,
    horizonYearSnapshot?.soldVolume,
    investmentController.averageNearTermExpense.energyPct,
    investmentController.averageNearTermExpense.opexOtherPct,
    investmentController.averageNearTermExpense.personnelPct,
    investmentController.firstNearTermExpense,
    investmentController.investmentSummary.peakAnnualAmount,
    investmentController.savedMappedInvestmentYearsCount,
    investmentController.plannedInvestmentYears.length,
    scenarioController.draftAssumptions.energiakerroin,
    scenarioController.draftAssumptions.henkilostokerroin,
    scenarioController.draftAssumptions.inflaatio,
    scenarioController.latestPricePoint,
    scenarioController.scenario?.baselinePriceTodayCombined,
    scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult,
    t,
  ]);

  const currentRequiredIncreaseFromToday = React.useMemo(() => {
    if (scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult != null) {
      return scenarioController.scenario.requiredAnnualIncreasePctAnnualResult;
    }
    if (
      scenarioController.scenario?.baselinePriceTodayCombined &&
      scenarioController.scenario.baselinePriceTodayCombined > 0
    ) {
      return (
        (scenarioController.primaryFeeSignal.price /
          scenarioController.scenario.baselinePriceTodayCombined -
          1) *
        100
      );
    }
    return scenarioController.primaryFeeSignal.increase;
  }, [
    scenarioController.primaryFeeSignal.increase,
    scenarioController.primaryFeeSignal.price,
    scenarioController.scenario?.baselinePriceTodayCombined,
    scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult,
  ]);

  const primaryUnderfundingStartYear = React.useMemo(
    () =>
      scenarioController.scenario?.feeSufficiency.annualResult.underfundingStartYear ??
      scenarioController.scenario?.feeSufficiency.cumulativeCash.underfundingStartYear ??
      null,
    [
      scenarioController.scenario?.feeSufficiency.annualResult.underfundingStartYear,
      scenarioController.scenario?.feeSufficiency.cumulativeCash.underfundingStartYear,
    ],
  );

  const tariffDriverCards = React.useMemo(() => {
    const baselineVolume =
      baselineContext == null
        ? 0
        : baselineContext.soldWaterVolume + baselineContext.soldWastewaterVolume;
    const horizonVolume =
      horizonYearSnapshot?.soldVolume ?? baselineYearSnapshot?.soldVolume ?? 0;

    return [
      {
        id: 'investments',
        title: t('v2Forecast.investmentProgramTitle', 'Investment program'),
        rows: [
          {
            label: t('v2Forecast.totalInvestments', 'Total investments'),
            value: formatEur(
              scenarioController.scenario?.investmentSeries.reduce(
                (sum, row) => sum + row.amount,
                0,
              ) ?? 0,
            ),
          },
          {
            label: t('v2Forecast.investmentPeakAnnualTotal', 'Peak annual investment total'),
            value: formatEur(investmentController.investmentSummary.peakAnnualAmount),
          },
          {
            label: t('v2Forecast.investmentStrongestFiveYear', 'Strongest rolling 5-year total'),
            value: investmentController.investmentSummary.strongestFiveYearRange
              ? `${formatEur(
                  investmentController.investmentSummary.strongestFiveYearTotal,
                )} · ${investmentController.investmentSummary.strongestFiveYearRange.startYear}-${investmentController.investmentSummary.strongestFiveYearRange.endYear}`
              : formatEur(investmentController.investmentSummary.strongestFiveYearTotal),
          },
          {
            label: t('v2Forecast.investmentPeakYears', 'Peak years'),
            value:
              investmentController.investmentSummary.peakYears.length > 0
                ? investmentController.investmentSummary.peakYears.join(', ')
                : t('v2Forecast.investmentPeakYearsEmpty', 'None'),
          },
        ],
      },
      {
        id: 'revenues',
        title: t('v2Forecast.pillarRevenue', 'Revenue'),
        rows: [
          {
            label: t('v2Forecast.currentFeeLevel', 'Current fee level'),
            value: formatPrice(scenarioController.scenario?.baselinePriceTodayCombined ?? 0),
          },
          {
            label: t('v2Forecast.horizonCombinedPrice', 'Horizon combined'),
            value: scenarioController.latestPricePoint
              ? formatPrice(scenarioController.latestPricePoint.combinedPrice)
              : t('v2Forecast.reportStateMissing'),
          },
          {
            label: t(
              'v2Forecast.requiredIncreaseFromToday',
              'Required increase from current combined price',
            ),
            value: formatPercent(currentRequiredIncreaseFromToday),
          },
          {
            label: t('v2Vesinvest.baselineYearVolume', 'Combined sold volume'),
            value: formatVolume(baselineVolume || horizonVolume, 0),
          },
          {
            label: t('v2Forecast.provenanceLabel', 'Source'),
            value: baselineContext
              ? `${baselineDatasetSourceLabel(
                  baselineContext.prices.source,
                  baselineContext.prices.provenance,
                )} / ${baselineDatasetSourceLabel(
                  baselineContext.volumes.source,
                  baselineContext.volumes.provenance,
                )}`
              : t('v2Forecast.reportStateMissing'),
          },
        ],
      },
      {
        id: 'materials',
        title: t('v2Forecast.pillarMaterials', 'Materials and services'),
        rows: [
          {
            label: t('v2Forecast.ctxProcessElectricity', 'Process electricity'),
            value: baselineContext
              ? `${formatNumber(baselineContext.processElectricity)} kWh`
              : t('v2Forecast.reportStateMissing'),
          },
          {
            label: t('v2Forecast.nearTermEnergy', 'Energy %'),
            value: investmentController.firstNearTermExpense
              ? formatPercent(investmentController.firstNearTermExpense.energyPct)
              : t('v2Forecast.reportStateMissing'),
          },
          {
            label: t('assumptions.energyFactor', 'Energy factor'),
            value: formatAssumptionPercent(scenarioController.draftAssumptions.energiakerroin),
          },
        ],
      },
      {
        id: 'personnel',
        title: t('v2Forecast.pillarPersonnel', 'Personnel costs'),
        rows: [
          {
            label: t('assumptions.personnelFactor', 'Personnel factor'),
            value: formatAssumptionPercent(
              scenarioController.draftAssumptions.henkilostokerroin,
            ),
          },
          {
            label: t('v2Forecast.nearTermPersonnel', 'Personnel %'),
            value: investmentController.firstNearTermExpense
              ? formatPercent(investmentController.firstNearTermExpense.personnelPct)
              : t('v2Forecast.reportStateMissing'),
          },
          {
            label: t('v2Forecast.provenanceLabel', 'Source'),
            value: baselineContext
              ? baselineDatasetSourceLabel(
                  baselineContext.financials.source,
                  baselineContext.financials.provenance,
                )
              : t('v2Forecast.reportStateMissing'),
          },
        ],
      },
      {
        id: 'opex',
        title: t('v2Forecast.pillarOtherOpex', 'Other operating costs'),
        rows: [
          {
            label: t('assumptions.inflation', 'Inflation'),
            value: formatAssumptionPercent(scenarioController.draftAssumptions.inflaatio),
          },
          {
            label: t('v2Forecast.nearTermOpexOther', 'Other operating costs %'),
            value: investmentController.firstNearTermExpense
              ? formatPercent(investmentController.firstNearTermExpense.opexOtherPct)
              : t('v2Forecast.reportStateMissing'),
          },
        ],
      },
    ];
  }, [
    baselineContext,
    baselineDatasetSourceLabel,
    baselineYearSnapshot?.soldVolume,
    currentRequiredIncreaseFromToday,
    formatAssumptionPercent,
    horizonYearSnapshot?.soldVolume,
    investmentController.firstNearTermExpense,
    investmentController.investmentSummary.peakAnnualAmount,
    investmentController.investmentSummary.peakYears,
    investmentController.investmentSummary.strongestFiveYearRange,
    investmentController.investmentSummary.strongestFiveYearTotal,
    scenarioController.draftAssumptions.energiakerroin,
    scenarioController.draftAssumptions.henkilostokerroin,
    scenarioController.draftAssumptions.inflaatio,
    scenarioController.latestPricePoint,
    scenarioController.scenario?.baselinePriceTodayCombined,
    scenarioController.scenario?.investmentSeries,
    t,
  ]);

  const opexWorkbenchConfig = React.useMemo(
    () =>
      buildForecastOpexWorkbenchConfig({
        activeOpexWorkbench,
        averageNearTermExpense: investmentController.averageNearTermExpense,
        baselineContext,
        draftAssumptions: scenarioController.draftAssumptions,
        formatAssumptionPercent,
        formatNumber,
        formatPercent,
        t,
      }),
    [
      activeOpexWorkbench,
      baselineContext,
      formatAssumptionPercent,
      scenarioController.draftAssumptions,
      investmentController.averageNearTermExpense,
      t,
    ],
  );

  const opexWorkbenchRows = React.useMemo(() => {
    if (!opexWorkbenchConfig) {
      return [];
    }
    return scenarioController.draftNearTermExpenseAssumptions.map((row) => ({
      year: row.year,
      field: opexWorkbenchConfig.field,
      value: investmentController.nearTermInputValue(row, opexWorkbenchConfig.field),
      error: investmentController.nearTermValidationErrors[row.year]?.[opexWorkbenchConfig.field],
    }));
  }, [
    investmentController,
    opexWorkbenchConfig,
    scenarioController.draftNearTermExpenseAssumptions,
  ]);

  const depreciationPreviewRows = React.useMemo(
    () =>
      scenarioController.scenario?.years.map((row) => ({
        year: row.year,
        baseline: row.baselineDepreciation ?? 0,
        scenario: row.investmentDepreciation ?? 0,
        total: row.totalDepreciation ?? 0,
      })) ?? [],
    [scenarioController.scenario],
  );
  const baselineDepreciationTotal = React.useMemo(
    () => depreciationPreviewRows.reduce((sum, row) => sum + row.baseline, 0),
    [depreciationPreviewRows],
  );
  const newInvestmentDepreciationTotal = React.useMemo(
    () => depreciationPreviewRows.reduce((sum, row) => sum + row.scenario, 0),
    [depreciationPreviewRows],
  );
  const totalDepreciationEffect = React.useMemo(
    () => depreciationPreviewRows.reduce((sum, row) => sum + row.total, 0),
    [depreciationPreviewRows],
  );
  const investmentImpactSummary = React.useMemo(
    () =>
      buildForecastInvestmentImpactSummary({
        draftInvestments: scenarioController.draftInvestments,
        totalDepreciationEffect,
        requiredPriceToday: scenarioController.primaryFeeSignal.price,
        peakGap:
          scenarioController.scenario?.feeSufficiency.cumulativeCash.peakGap ?? 0,
      }),
    [
      scenarioController.draftInvestments,
      scenarioController.primaryFeeSignal.price,
      scenarioController.scenario?.feeSufficiency.cumulativeCash.peakGap,
      totalDepreciationEffect,
    ],
  );

  return {
    assumptionLabelByKey,
    baselineContext,
    baselineDatasetSourceLabel,
    baselineDepreciationTotal,
    baselineSourceStatusLabel,
    baselineYearSnapshot,
    canCreateReport,
    computeButtonLabel,
    currentRequiredIncreaseFromToday,
    depreciationPreviewRows,
    forecastStateLabel,
    forecastStateToneClass,
    forecastSurfaceToneClass,
    formatAssumptionPercent,
    horizonYearSnapshot,
    investmentImpactSummary,
    newInvestmentDepreciationTotal,
    opexWorkbenchConfig,
    opexWorkbenchRows,
    primaryUnderfundingStartYear,
    reportBlockerNeedsComputeAction,
    reportCommandSummary,
    reportReadinessHint,
    reportReadinessLabel,
    reportReadinessReason,
    reportReadinessToneClass,
    scenarioTypeLabel,
    statementPillars,
    statementRows,
    tariffDriverCards,
    totalDepreciationEffect,
  };
}
