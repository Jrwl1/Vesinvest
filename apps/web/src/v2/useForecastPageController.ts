import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteForecastScenarioV2,
  updateForecastScenarioV2,
} from '../api';
import { buildDefaultReportTitle, buildDefaultScenarioName, getScenarioDisplayName } from './displayNames';
import { formatEur, formatNumber, formatPercent, formatPrice } from './format';
import {
  ASSUMPTION_LABEL_KEYS,
  getScenarioTypeToneClass,
  formatSignedEur,
  formatScenarioUpdatedAt,
  RISK_PRESETS,
  type RiskPresetDefinition,
  toPercentPoints,
} from './forecastModel';
import {
  buildForecastBaselineDatasetSourceLabel,
  buildForecastInvestmentImpactSummary,
  buildForecastOpexWorkbenchConfig,
  buildForecastStatementRows,
} from './forecastViewModel';
import { normalizeImportedFileName } from './provenanceDisplay';
import { buildRiskPresetUpdate } from './riskScenario';
import { useForecastInvestmentController } from './useForecastInvestmentController';
import {
  useForecastScenarioController,
  type UseForecastScenarioControllerParams,
} from './useForecastScenarioController';

export type ForecastPageControllerProps = {
  onReportCreated: (reportId: string) => void;
  initialScenarioId?: string | null;
  computedFromUpdatedAtByScenario?: Record<string, string>;
  onScenarioSelectionChange?: (scenarioId: string | null) => void;
  onComputedVersionChange?: (
    scenarioId: string,
    computedFromUpdatedAt: string | null,
  ) => void;
};

export function useForecastPageController({
  onReportCreated,
  initialScenarioId = null,
  computedFromUpdatedAtByScenario,
  onScenarioSelectionChange,
  onComputedVersionChange,
}: ForecastPageControllerProps) {
  const { t } = useTranslation();
  const depreciationFeatureEnabled =
    import.meta.env.VITE_V2_DEPRECIATION_RULES_ENABLED !== 'false';

  const scenarioController = useForecastScenarioController({
    t,
    depreciationFeatureEnabled,
    initialScenarioId,
    onScenarioSelectionChange,
  } satisfies UseForecastScenarioControllerParams);

  const investmentController = useForecastInvestmentController({
    t,
    scenario: scenarioController.scenario,
    selectedScenarioId: scenarioController.selectedScenarioId,
    draftName: scenarioController.draftName,
    setDraftName: scenarioController.setDraftName,
    draftScenarioType: scenarioController.draftScenarioType,
    setDraftScenarioType: scenarioController.setDraftScenarioType,
    draftAssumptions: scenarioController.draftAssumptions,
    setDraftAssumptions: scenarioController.setDraftAssumptions,
    draftInvestments: scenarioController.draftInvestments,
    setDraftInvestments: scenarioController.setDraftInvestments,
    draftNearTermExpenseAssumptions:
      scenarioController.draftNearTermExpenseAssumptions,
    setDraftNearTermExpenseAssumptions:
      scenarioController.setDraftNearTermExpenseAssumptions,
    nearTermExpenseDraftText: scenarioController.nearTermExpenseDraftText,
    setNearTermExpenseDraftText: scenarioController.setNearTermExpenseDraftText,
    depreciationRuleDrafts: scenarioController.depreciationRuleDrafts,
    setDepreciationRuleDrafts: scenarioController.setDepreciationRuleDrafts,
    savedDepreciationRuleDrafts: scenarioController.savedDepreciationRuleDrafts,
    setSavedDepreciationRuleDrafts:
      scenarioController.setSavedDepreciationRuleDrafts,
    classAllocationDraftByYear: scenarioController.classAllocationDraftByYear,
    setClassAllocationDraftByYear:
      scenarioController.setClassAllocationDraftByYear,
    savedClassAllocationDraftByYear:
      scenarioController.savedClassAllocationDraftByYear,
    setSavedClassAllocationDraftByYear:
      scenarioController.setSavedClassAllocationDraftByYear,
    loadingDepreciation: scenarioController.loadingDepreciation,
    depreciationFeatureEnabled,
    hasUnsavedChanges: scenarioController.hasUnsavedChanges,
    revenueAssumptionsChanged: scenarioController.revenueAssumptionsChanged,
    setActiveOperation: scenarioController.setActiveOperation,
    setError: scenarioController.setError,
    setInfo: scenarioController.setInfo,
    updateScenarioSummary: scenarioController.updateScenarioSummary,
    markScenarioAsNeedsRecompute: scenarioController.markScenarioAsNeedsRecompute,
  });

  React.useEffect(() => {
    if (!onComputedVersionChange || !scenarioController.selectedScenarioId) {
      return;
    }
    onComputedVersionChange(
      scenarioController.selectedScenarioId,
      scenarioController.scenario?.computedFromUpdatedAt ??
        computedFromUpdatedAtByScenario?.[scenarioController.selectedScenarioId] ??
        null,
    );
  }, [
    computedFromUpdatedAtByScenario,
    onComputedVersionChange,
    scenarioController.scenario?.computedFromUpdatedAt,
    scenarioController.selectedScenarioId,
  ]);

  const activeOpexWorkbench = React.useMemo(() => {
    if (
      scenarioController.activeWorkbench === 'materials' ||
      scenarioController.activeWorkbench === 'personnel' ||
      scenarioController.activeWorkbench === 'otherOpex'
    ) {
      return scenarioController.activeWorkbench;
    }
    return null;
  }, [scenarioController.activeWorkbench]);

  React.useEffect(() => {
    if (
      scenarioController.activeWorkbench === 'investments' ||
      scenarioController.activeWorkbench === 'depreciation'
    ) {
      scenarioController.setActivePrimaryChart('cashflow');
      return;
    }
    if (scenarioController.activeWorkbench === 'revenue') {
      scenarioController.setActivePrimaryChart('price');
    }
  }, [scenarioController.activeWorkbench, scenarioController.setActivePrimaryChart]);

  const reportReadinessReason = React.useMemo(() => {
    const activePlan = scenarioController.planningContext?.vesinvest?.activePlan ?? null;
    if (!scenarioController.scenario) {
      return 'missingScenario' as const;
    }
    if (
      !activePlan?.id ||
      activePlan.selectedScenarioId !== scenarioController.selectedScenarioId
    ) {
      return 'missingActivePlanLink' as const;
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
    if (investmentController.hasIncompleteDepreciationMapping) {
      return 'depreciationMappingIncomplete' as const;
    }
    return null;
  }, [
    investmentController.hasIncompleteDepreciationMapping,
    scenarioController.forecastFreshnessState,
    scenarioController.planningContext?.vesinvest?.activePlan,
    scenarioController.scenario,
    scenarioController.selectedScenarioId,
  ]);

  const canCreateReport = reportReadinessReason == null;
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
      case 'depreciationMappingIncomplete':
        return t(
          'v2Forecast.depreciationMappingBlockedHint',
          'Complete and save a depreciation mapping for every investment year before creating report.',
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
      reportReadinessReason === 'depreciationMappingIncomplete'
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

  const handleCreate = React.useCallback(
    async (copyFromCurrent: boolean) => {
      if (!scenarioController.hasBaselineBudget) {
        scenarioController.setError(
          t(
            'v2Forecast.errorMissingBaselineBudget',
            'No VEETI baseline budget found. Import VEETI data first.',
          ),
        );
        scenarioController.setInfo(null);
        return;
      }
      scenarioController.setActiveOperation('creating');
      scenarioController.setError(null);
      scenarioController.setInfo(null);
      try {
        const created = await createForecastScenarioV2({
          name:
            scenarioController.newScenarioName.trim() || buildDefaultScenarioName(t),
          copyFromScenarioId: copyFromCurrent
            ? scenarioController.selectedScenarioId ?? undefined
            : undefined,
          scenarioType: scenarioController.newScenarioType,
        });
        scenarioController.setNewScenarioName('');
        await scenarioController.loadScenarioList(created.id, true);
        scenarioController.setInfo(t('v2Forecast.infoCreated', 'Scenario created.'));
      } catch (err) {
        scenarioController.setError(
          scenarioController.mapKnownForecastError(
            err,
            'v2Forecast.errorCreateFailed',
            'Failed to create scenario.',
          ),
        );
      } finally {
        scenarioController.setActiveOperation('idle');
      }
    },
    [scenarioController, t],
  );

  const handleDelete = React.useCallback(async () => {
    if (
      !scenarioController.scenario ||
      !scenarioController.selectedScenarioId ||
      scenarioController.scenario.onOletus
    ) {
      return;
    }
    const confirmed = window.confirm(
      t('v2Forecast.deleteConfirm', 'Delete scenario "{{name}}"?', {
        name: getScenarioDisplayName(scenarioController.scenario.name, t),
      }),
    );
    if (!confirmed) {
      return;
    }

    scenarioController.setActiveOperation('deleting');
    scenarioController.setError(null);
    scenarioController.setInfo(null);
    try {
      await deleteForecastScenarioV2(scenarioController.selectedScenarioId);
      scenarioController.setInfo(t('v2Forecast.infoDeleted', 'Scenario deleted.'));
      await scenarioController.loadScenarioList(undefined, true);
    } catch (err) {
      scenarioController.setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorDeleteFailed', 'Failed to delete scenario.'),
      );
    } finally {
      scenarioController.setActiveOperation('idle');
    }
  }, [scenarioController, t]);

  const handleSave = React.useCallback(async () => {
    scenarioController.setActiveOperation('saving');
    scenarioController.setError(null);
    scenarioController.setInfo(null);
    try {
      const saved = await investmentController.saveDrafts();
      if (saved) {
        scenarioController.setScenario(saved);
      }
      scenarioController.setInfo(
        t(
          'v2Forecast.infoDraftSaved',
          'Draft saved. Recompute results to refresh KPI values.',
        ),
      );
    } catch (err) {
      scenarioController.setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorSaveFailed', 'Saving failed.'),
      );
    } finally {
      scenarioController.setActiveOperation('idle');
    }
  }, [investmentController, scenarioController, t]);

  const handleCompute = React.useCallback(async () => {
    if (!scenarioController.selectedScenarioId) {
      return;
    }
    scenarioController.setActiveOperation('computing');
    scenarioController.setError(null);
    scenarioController.setInfo(null);
    try {
      await investmentController.saveDrafts();
      const computed = await computeForecastScenarioV2(scenarioController.selectedScenarioId);
      scenarioController.setScenario(computed);
      scenarioController.setDraftName(computed.name);
      scenarioController.setDraftScenarioType(computed.scenarioType);
      scenarioController.setDraftAssumptions({ ...computed.assumptions });
      scenarioController.setDraftInvestments(computed.yearlyInvestments.map((item) => ({ ...item })));
      const nearTermDraft = computed.nearTermExpenseAssumptions.map((item) => ({ ...item }));
      scenarioController.setDraftNearTermExpenseAssumptions(nearTermDraft);
      scenarioController.setNearTermExpenseDraftText(
        Object.fromEntries(
          nearTermDraft.map((item) => [
            item.year,
            {
              personnelPct: String(item.personnelPct),
              energyPct: String(item.energyPct),
              opexOtherPct: String(item.opexOtherPct),
            },
          ]),
        ),
      );
      scenarioController.updateScenarioSummary(computed);
      scenarioController.setInfo(t('v2Forecast.infoComputed', 'Scenario calculated.'));
    } catch (err) {
      scenarioController.setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorComputeFailed', 'Calculation failed.'),
      );
    } finally {
      scenarioController.setActiveOperation('idle');
    }
  }, [investmentController, scenarioController, t]);

  const handleGenerateReport = React.useCallback(async () => {
    if (!scenarioController.selectedScenarioId) {
      scenarioController.setError(
        t('v2Forecast.computeBeforeReport', 'Recompute results before creating report.'),
      );
      scenarioController.setInfo(null);
      return;
    }
    if (!canCreateReport) {
      if (reportReadinessHint) {
        scenarioController.setError(reportReadinessHint);
      }
      scenarioController.setInfo(null);
      return;
    }
    scenarioController.setActiveOperation('saving');
    scenarioController.setError(null);
    scenarioController.setInfo(null);
    try {
      const activePlan = scenarioController.planningContext?.vesinvest?.activePlan ?? null;
      if (!activePlan?.id) {
        throw new Error(
          t(
            'v2Forecast.reportRequiresActiveVesinvestPlan',
            'Select an active Vesinvest revision before creating a report.',
          ),
        );
      }
      const report = await createReportV2({
        vesinvestPlanId: activePlan.id,
        ennusteId: scenarioController.selectedScenarioId,
        title: buildDefaultReportTitle(
          t,
          scenarioController.scenario?.name ??
            (scenarioController.draftName.trim() ||
              scenarioController.selectedScenarioListItem?.name),
        ),
      });
      scenarioController.setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onReportCreated(report.reportId);
    } catch (err) {
      scenarioController.setError(
        scenarioController.mapKnownForecastError(
          err,
          'v2Forecast.errorReportFailed',
          'Failed to create report.',
        ),
      );
    } finally {
      scenarioController.setActiveOperation('idle');
    }
  }, [canCreateReport, onReportCreated, reportReadinessHint, scenarioController, t]);

  const handleApplyRiskPreset = React.useCallback(
    async (preset: RiskPresetDefinition) => {
      if (!scenarioController.scenario || !scenarioController.selectedScenarioId) {
        return;
      }
      if (investmentController.hasNearTermValidationErrors) {
        scenarioController.setError(
          t(
            'v2Forecast.nearTermValidationSummary',
            'Fix highlighted near-term percentage fields before saving or computing.',
          ),
        );
        scenarioController.setInfo(null);
        return;
      }

      scenarioController.setActiveOperation('creating');
      scenarioController.setError(null);
      scenarioController.setInfo(null);
      try {
        const saved = await investmentController.saveDrafts();
        const baseScenario = saved ?? scenarioController.scenario;
        const createdName = `${baseScenario.name} - ${t(preset.titleKey, preset.title)}`;
        const created = await createForecastScenarioV2({
          name: createdName,
          copyFromScenarioId: scenarioController.selectedScenarioId,
          scenarioType: 'stress',
          compute: false,
        });
        await updateForecastScenarioV2(
          created.id,
          buildRiskPresetUpdate(preset.id, baseScenario),
        );
        await computeForecastScenarioV2(created.id);
        await scenarioController.loadScenarioList(created.id, true);
        scenarioController.setInfo(
          t('v2Forecast.riskPresetCreated', 'Risk scenario "{{name}}" created.', {
            name: createdName,
          }),
        );
      } catch (err) {
        scenarioController.setError(
          scenarioController.mapKnownForecastError(
            err,
            'v2Forecast.errorRiskPresetFailed',
            'Failed to create risk scenario.',
          ),
        );
      } finally {
        scenarioController.setActiveOperation('idle');
      }
    },
    [investmentController, scenarioController, t],
  );

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
      if (value === 'base') {
        return t('v2Forecast.baseScenario', 'Base');
      }
      if (value === 'committed') {
        return t('v2Forecast.committedScenario', 'Committed');
      }
      if (value === 'hypothesis') {
        return t('v2Forecast.hypothesisScenario', 'Hypothesis');
      }
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
    (source: 'veeti' | 'manual' | 'none', provenance: any) =>
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
    [baselineYearSnapshot, formatSignedEur, horizonYearSnapshot, t],
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
          ? `${formatPrice(scenarioController.scenario?.baselinePriceTodayCombined ?? 0)} · ${formatNumber(baselineVolume)} m3`
          : formatPrice(scenarioController.scenario?.baselinePriceTodayCombined ?? 0),
        scenario: scenarioController.latestPricePoint
          ? `${formatPrice(scenarioController.latestPricePoint.combinedPrice)} · ${formatNumber(horizonYearSnapshot?.soldVolume ?? baselineYearSnapshot?.soldVolume ?? 0)} m3`
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
        baseline: formatAssumptionPercent(scenarioController.draftAssumptions.henkilostokerroin),
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
      {
        id: 'depreciation',
        title: t('v2Forecast.pillarDepreciation', 'Depreciation'),
        baseline: t('v2Forecast.depreciationRulesCount', '{{count}} classes', {
          count: scenarioController.depreciationRuleDrafts.length,
        }),
        scenario: t('v2Forecast.mappingSavedYears', '{{saved}}/{{total}} years saved', {
          saved: investmentController.savedMappedInvestmentYearsCount,
          total: investmentController.plannedInvestmentYears.length,
        }),
        delta:
          investmentController.unmappedInvestmentYears.length > 0
            ? t('v2Forecast.mappingStatusBlocked', 'Depreciation incomplete')
            : t('v2Forecast.mappingStatusReady', 'Depreciation ready'),
        provenance: depreciationFeatureEnabled
          ? t('v2Forecast.depreciationRulesTitle', 'Depreciation plans')
          : t('common.no', 'No'),
      },
    ];
  }, [
    baselineContext,
    baselineDatasetSourceLabel,
    baselineYearSnapshot?.soldVolume,
    depreciationFeatureEnabled,
    formatAssumptionPercent,
    horizonYearSnapshot?.soldVolume,
    investmentController.averageNearTermExpense.energyPct,
    investmentController.averageNearTermExpense.opexOtherPct,
    investmentController.averageNearTermExpense.personnelPct,
    investmentController.firstNearTermExpense,
    investmentController.plannedInvestmentYears.length,
    investmentController.savedMappedInvestmentYearsCount,
    investmentController.unmappedInvestmentYears.length,
    investmentController.investmentSummary.peakAnnualAmount,
    scenarioController.depreciationRuleDrafts.length,
    scenarioController.draftAssumptions.energiakerroin,
    scenarioController.draftAssumptions.henkilostokerroin,
    scenarioController.draftAssumptions.inflaatio,
    scenarioController.latestPricePoint,
    scenarioController.scenario?.baselinePriceTodayCombined,
    scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult,
    t,
  ]);

  const currentRequiredIncreaseFromToday = React.useMemo(() => {
    if (
      scenarioController.scenario?.requiredAnnualIncreasePctAnnualResult != null
    ) {
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
      scenarioController.scenario?.feeSufficiency.cumulativeCash
        .underfundingStartYear ??
      scenarioController.scenario?.feeSufficiency.annualResult
        .underfundingStartYear ??
      null,
    [
      scenarioController.scenario?.feeSufficiency.annualResult
        .underfundingStartYear,
      scenarioController.scenario?.feeSufficiency.cumulativeCash
        .underfundingStartYear,
    ],
  );

  const tariffDriverCards = React.useMemo(
    () =>
      statementPillars
        .filter((pillar) =>
          ['investments', 'revenues', 'materials', 'personnel', 'opex', 'depreciation'].includes(
            pillar.id,
          ),
        )
        .map((pillar) => ({
          id: pillar.id,
          title: pillar.title,
          baseline: pillar.baseline,
          scenario: pillar.scenario,
          delta: pillar.delta,
          provenance: pillar.provenance,
        })),
    [statementPillars],
  );

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
    t,
    ...scenarioController,
    ...investmentController,
    canCreateReport,
    reportReadinessReason,
    reportReadinessHint,
    reportReadinessToneClass,
    reportReadinessLabel,
    reportCommandSummary,
    computeButtonLabel,
    forecastStateToneClass,
    forecastStateLabel,
    forecastSurfaceToneClass,
    showInlineFreshnessState: scenarioController.forecastFreshnessState === 'current',
    handleCreate,
    handleDelete,
    handleSave,
    handleCompute,
    handleGenerateReport,
    handleApplyRiskPreset,
    assumptionLabelByKey,
    formatAssumptionPercent,
    baselineDatasetSourceLabel,
    baselineSourceStatusLabel,
    baselineContext,
    baselineYearSnapshot,
    horizonYearSnapshot,
    statementRows,
    statementPillars,
    tariffDriverCards,
    currentRequiredIncreaseFromToday,
    primaryUnderfundingStartYear,
    activeOpexWorkbench,
    opexWorkbenchConfig,
    opexWorkbenchRows,
    depreciationPreviewRows,
    baselineDepreciationTotal,
    newInvestmentDepreciationTotal,
    totalDepreciationEffect,
    investmentImpactSummary,
    computedVersionLabel: scenarioController.scenario?.computedFromUpdatedAt
      ? formatScenarioUpdatedAt(scenarioController.scenario.computedFromUpdatedAt)
      : t('v2Forecast.reportStateMissing'),
    scenarioTypeLabel,
    scenarioTypeToneClass: scenarioController.scenario
      ? getScenarioTypeToneClass(scenarioController.scenario.scenarioType)
      : 'v2-status-neutral',
    formatEur,
    formatNumber,
    formatPercent,
    formatPrice,
    formatScenarioUpdatedAt,
    getScenarioDisplayName,
    normalizeImportedFileName,
    RISK_PRESETS,
  };
}

export type ForecastPageController = ReturnType<typeof useForecastPageController>;
