import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteForecastScenarioV2,
  updateForecastScenarioV2,
} from '../api';
import {
  buildDefaultPackageReportTitle,
  buildDefaultScenarioName,
  getScenarioDisplayName,
  normalizeReportLocale,
} from './displayNames';
import { formatEur, formatNumber, formatPercent, formatPrice } from './format';
import {
  getScenarioTypeToneClass,
  formatScenarioUpdatedAt,
  RISK_PRESETS,
  type RiskPresetDefinition,
} from './forecastModel';
import { normalizeImportedFileName } from './provenanceDisplay';
import { buildRiskPresetUpdate } from './riskScenario';
import { useForecastInvestmentController } from './useForecastInvestmentController';
import {
  useForecastScenarioController,
  type UseForecastScenarioControllerParams,
} from './useForecastScenarioController';
import { useForecastPageDerivedState } from './useForecastPageDerivedState';

export type ForecastPageControllerProps = {
  onReportCreated: (reportId: string) => void;
  initialScenarioId?: string | null;
  computedFromUpdatedAtByScenario?: Record<string, string>;
  onScenarioSelectionChange?: (scenarioId: string | null) => void;
  onGoToAssetManagement?: () => void;
  onGoToOverviewFeePath?: (planId?: string | null) => void;
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
  onGoToAssetManagement,
  onGoToOverviewFeePath,
  onComputedVersionChange,
}: ForecastPageControllerProps) {
  const { t, i18n } = useTranslation();
  const reportLocaleLanguage = i18n?.language;
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
    if (scenarioController.activeWorkbench === 'revenue') {
      scenarioController.setActivePrimaryChart('price');
    }
  }, [scenarioController.activeWorkbench, scenarioController.setActivePrimaryChart]);

  const {
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
  } = useForecastPageDerivedState({
    t,
    scenarioController,
    investmentController,
    activeOpexWorkbench,
  });

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
        const useQuickCreateDefaults =
          scenarioController.scenarios.length > 0 &&
          scenarioController.baseScenarioListItem != null;
        const nextScenarioType = copyFromCurrent
          ? scenarioController.scenario?.scenarioType &&
            scenarioController.scenario.scenarioType !== 'base'
            ? scenarioController.scenario.scenarioType
            : 'hypothesis'
          : useQuickCreateDefaults
            ? 'hypothesis'
            : scenarioController.newScenarioType;
        const created = await createForecastScenarioV2({
          name:
            useQuickCreateDefaults
              ? buildDefaultScenarioName(t)
              : scenarioController.newScenarioName.trim() ||
                buildDefaultScenarioName(t),
          copyFromScenarioId: copyFromCurrent
            ? scenarioController.selectedScenarioId ?? undefined
            : undefined,
          scenarioType: nextScenarioType,
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
        variant: 'regulator_package',
        locale: normalizeReportLocale(reportLocaleLanguage),
        title: buildDefaultPackageReportTitle(
          t,
          scenarioController.scenario?.name ??
            (scenarioController.draftName.trim() ||
              scenarioController.selectedScenarioListItem?.name),
          'regulator_package',
        ),
      });
      scenarioController.setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onReportCreated(report.reportId);
    } catch (err) {
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : null;
      const activePlan = scenarioController.planningContext?.vesinvest?.activePlan ?? null;
      if (
        (code === 'VESINVEST_SCENARIO_STALE' ||
          code === 'VESINVEST_BASELINE_STALE' ||
          code === 'ASSET_EVIDENCE_REQUIRED' ||
          code === 'TARIFF_EVIDENCE_REQUIRED' ||
          code === 'TARIFF_PLAN_REQUIRED' ||
          code === 'TARIFF_PLAN_STALE') &&
        activePlan?.id
      ) {
        if (code === 'ASSET_EVIDENCE_REQUIRED') {
          onGoToAssetManagement?.();
        } else {
          onGoToOverviewFeePath?.(activePlan.id);
        }
        return;
      }
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
  }, [
    canCreateReport,
    onGoToAssetManagement,
    onGoToOverviewFeePath,
    onReportCreated,
    reportLocaleLanguage,
    reportReadinessHint,
    scenarioController,
    t,
  ]);

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


  return {
    t,
    ...scenarioController,
    ...investmentController,
    canCreateReport,
    reportBlockerNeedsComputeAction,
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
    onGoToAssetManagement,
    onGoToOverviewFeePath,
    RISK_PRESETS,
  };
}

export type ForecastPageController = ReturnType<typeof useForecastPageController>;
