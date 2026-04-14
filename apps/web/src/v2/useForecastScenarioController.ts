import React from 'react';
import type { TFunction } from 'i18next';

import {
  getForecastScenarioV2,
  getPlanningContextV2,
  getScenarioClassAllocationsV2,
  listForecastScenariosV2,
  listScenarioDepreciationRulesV2,
  type V2ForecastScenario,
  type V2ForecastScenarioListItem,
  type V2ForecastScenarioType,
  type V2PlanningContextResponse,
} from '../api';
import { getScenarioDisplayName } from './displayNames';
import {
  buildClassAllocationDraftByYear,
  deriveForecastFreshnessState,
  EDITABLE_SCENARIO_TYPES,
  investmentsEqual,
  nearTermExpenseEqual,
  REVENUE_ASSUMPTION_KEYS,
  round4,
  toDepreciationRuleDraft,
  toNearTermExpenseDraftText,
  type ClassAllocationDraftByYear,
  type DepreciationRuleDraft,
  type ForecastFreshnessState,
  type ForecastOperationState,
  type ForecastWorkbench,
  type NearTermExpenseDraftText,
  type NearTermExpenseRow,
} from './forecastModel';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

export type UseForecastScenarioControllerParams = {
  t: TFunction;
  depreciationFeatureEnabled: boolean;
  initialScenarioId?: string | null;
  onScenarioSelectionChange?: (scenarioId: string | null) => void;
};

export function useForecastScenarioController({
  t,
  depreciationFeatureEnabled,
  initialScenarioId = null,
  onScenarioSelectionChange,
}: UseForecastScenarioControllerParams) {
  const [scenarios, setScenarios] = React.useState<V2ForecastScenarioListItem[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] =
    React.useState<string | null>(initialScenarioId);
  const [scenario, setScenario] = React.useState<V2ForecastScenario | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftScenarioType, setDraftScenarioType] =
    React.useState<V2ForecastScenarioType>('hypothesis');
  const [draftAssumptions, setDraftAssumptions] = React.useState<Record<string, number>>(
    {},
  );
  const [draftInvestments, setDraftInvestments] = React.useState<
    V2ForecastScenario['yearlyInvestments']
  >([]);
  const [draftNearTermExpenseAssumptions, setDraftNearTermExpenseAssumptions] =
    React.useState<NearTermExpenseRow[]>([]);
  const [nearTermExpenseDraftText, setNearTermExpenseDraftText] =
    React.useState<NearTermExpenseDraftText>({});
  const [depreciationRuleDrafts, setDepreciationRuleDrafts] = React.useState<
    DepreciationRuleDraft[]
  >([]);
  const [savedDepreciationRuleDrafts, setSavedDepreciationRuleDrafts] =
    React.useState<DepreciationRuleDraft[]>([]);
  const [classAllocationDraftByYear, setClassAllocationDraftByYear] =
    React.useState<ClassAllocationDraftByYear>({});
  const [savedClassAllocationDraftByYear, setSavedClassAllocationDraftByYear] =
    React.useState<ClassAllocationDraftByYear>({});
  const [loadingDepreciation, setLoadingDepreciation] = React.useState(false);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [newScenarioType, setNewScenarioType] =
    React.useState<V2ForecastScenarioType>('hypothesis');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingScenario, setLoadingScenario] = React.useState(false);
  const [activeOperation, setActiveOperation] =
    React.useState<ForecastOperationState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [planningContextLoaded, setPlanningContextLoaded] = React.useState(false);
  const [planningContextError, setPlanningContextError] =
    React.useState<string | null>(null);
  const [comparisonScenario, setComparisonScenario] =
    React.useState<V2ForecastScenario | null>(null);
  const [loadingComparisonScenario, setLoadingComparisonScenario] =
    React.useState(false);
  const [activeWorkbench, setActiveWorkbench] =
    React.useState<ForecastWorkbench>('investments');
  const [activePrimaryChart, setActivePrimaryChart] =
    React.useState<'cashflow' | 'price'>('price');
  const [denseAnalystMode, setDenseAnalystMode] = React.useState(false);
  const scenarioLoadSeqRef = React.useRef(0);

  const mapKnownForecastError = React.useCallback(
    (err: unknown, fallbackKey: string, fallbackText: string) => {
      const message = err instanceof Error ? err.message : '';
      const code =
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        typeof (err as { code?: unknown }).code === 'string'
          ? (err as { code: string }).code
          : null;

      if (code === 'FORECAST_RECOMPUTE_REQUIRED') {
        return t(
          'v2Forecast.errorRecomputeRequired',
          'Report can only be created from the latest computed scenario. Recompute scenario and try again.',
        );
      }

      if (
        message ===
          'No trusted baseline budget found. Complete Overview import and sync first.' ||
        message === 'No VEETI baseline budget found. Import data first.'
      ) {
        return t(
          'v2Forecast.errorMissingBaselineBudget',
          'No trusted baseline budget found. Complete Overview import and sync first.',
        );
      }

      return err instanceof Error ? err.message : t(fallbackKey, fallbackText);
    },
    [t],
  );

  const loadScenarioList = React.useCallback(
    async (preferredId?: string, forceRefresh = false) => {
      setLoadingList(true);
      setError(null);
      try {
        const rows = await listForecastScenariosV2({ force: forceRefresh });
        setScenarios(rows);
        setSelectedScenarioId((current) => {
          if (preferredId && rows.some((row) => row.id === preferredId)) {
            return preferredId;
          }
          if (current && rows.some((row) => row.id === current)) {
            return current;
          }
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Forecast.errorLoadListFailed', 'Failed to load scenarios.'),
        );
      } finally {
        setLoadingList(false);
      }
    },
    [t],
  );

  const loadScenario = React.useCallback(
    async (scenarioId: string) => {
      const loadSeq = scenarioLoadSeqRef.current + 1;
      scenarioLoadSeqRef.current = loadSeq;
      setLoadingScenario(true);
      setError(null);
      setScenario(null);
      setDraftName('');
      setDraftScenarioType('hypothesis');
      setDraftAssumptions({});
      setDraftInvestments([]);
      setDraftNearTermExpenseAssumptions([]);
      setNearTermExpenseDraftText({});
      setDepreciationRuleDrafts([]);
      setSavedDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setSavedClassAllocationDraftByYear({});
      try {
        const data = await getForecastScenarioV2(scenarioId);
        if (loadSeq !== scenarioLoadSeqRef.current) {
          return;
        }
        setScenario(data);
        setDraftName(data.name);
        setDraftScenarioType(data.scenarioType);
        setDraftAssumptions({ ...data.assumptions });
        setDraftInvestments(data.yearlyInvestments.map((item) => ({ ...item })));
        const nearTermDraft = data.nearTermExpenseAssumptions.map((item) => ({
          ...item,
        }));
        setDraftNearTermExpenseAssumptions(nearTermDraft);
        setNearTermExpenseDraftText(toNearTermExpenseDraftText(nearTermDraft));

        if (depreciationFeatureEnabled) {
          setLoadingDepreciation(true);
          try {
            const [rules, allocationPayload] = await Promise.all([
              listScenarioDepreciationRulesV2(scenarioId),
              getScenarioClassAllocationsV2(scenarioId),
            ]);
            if (loadSeq !== scenarioLoadSeqRef.current) {
              return;
            }
            const nextRuleDrafts = rules.map((rule) => ({
              ...toDepreciationRuleDraft(rule),
              assetClassName: resolveVesinvestGroupLabel(
                t,
                rule.assetClassKey,
                rule.assetClassName ?? null,
              ),
            }));
            const nextAllocationDraft = buildClassAllocationDraftByYear(
              data.yearlyInvestments.map((item) => item.year),
              rules.map((item) => item.assetClassKey),
              allocationPayload.years,
            );
            setDepreciationRuleDrafts(nextRuleDrafts);
            setSavedDepreciationRuleDrafts(nextRuleDrafts);
            setClassAllocationDraftByYear(nextAllocationDraft);
            setSavedClassAllocationDraftByYear(nextAllocationDraft);
          } finally {
            if (loadSeq === scenarioLoadSeqRef.current) {
              setLoadingDepreciation(false);
            }
          }
        }
      } catch (err) {
        if (loadSeq !== scenarioLoadSeqRef.current) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : t('v2Forecast.errorLoadScenarioFailed', 'Failed to load scenario.'),
        );
      } finally {
        if (loadSeq === scenarioLoadSeqRef.current) {
          setLoadingScenario(false);
        }
      }
    },
    [depreciationFeatureEnabled, t],
  );

  React.useEffect(() => {
    void loadScenarioList();
  }, [loadScenarioList]);

  React.useEffect(() => {
    let active = true;
    setPlanningContextError(null);
    void getPlanningContextV2()
      .then((data) => {
        if (active) {
          setPlanningContext(data);
        }
      })
      .catch((err) => {
        if (active) {
          setPlanningContext(null);
          setPlanningContextError(
            err instanceof Error
              ? err.message
              : t(
                  'v2Forecast.errorLoadPlanningContext',
                  'Failed to load planning context.',
                ),
          );
        }
      })
      .finally(() => {
        if (active) {
          setPlanningContextLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const hasBaselineBudget =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;
  const hasBaseScenario = React.useMemo(
    () => scenarios.some((item) => item.onOletus),
    [scenarios],
  );

  const firstBaselineYear = React.useMemo(() => {
    if (!planningContext?.baselineYears?.length) {
      return null;
    }
    return planningContext.baselineYears.reduce((latest, year) =>
      year.year > latest.year ? year : latest,
    );
  }, [planningContext?.baselineYears]);

  React.useEffect(() => {
    if (loadingList) {
      return;
    }
    if (!selectedScenarioId) {
      scenarioLoadSeqRef.current += 1;
      setLoadingScenario(false);
      setScenario(null);
      setDraftName('');
      setDraftScenarioType('hypothesis');
      setDraftAssumptions({});
      setDraftInvestments([]);
      setDraftNearTermExpenseAssumptions([]);
      setNearTermExpenseDraftText({});
      setDepreciationRuleDrafts([]);
      setSavedDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setSavedClassAllocationDraftByYear({});
      setComparisonScenario(null);
      setLoadingComparisonScenario(false);
      setActiveWorkbench('investments');
      setActivePrimaryChart('price');
      setDenseAnalystMode(false);
      return;
    }
    if (!scenarios.some((item) => item.id === selectedScenarioId)) {
      setSelectedScenarioId(scenarios[0]?.id ?? null);
      return;
    }
    setActiveWorkbench('investments');
    setActivePrimaryChart('price');
    setDenseAnalystMode(false);
    if (scenario?.id === selectedScenarioId) {
      return;
    }
    void loadScenario(selectedScenarioId);
  }, [loadingList, loadScenario, scenario?.id, scenarios, selectedScenarioId]);

  React.useEffect(() => {
    if (!hasBaseScenario) {
      setNewScenarioType('base');
      return;
    }
    const selectedScenario =
      scenarios.find((item) => item.id === selectedScenarioId) ?? null;
    if (selectedScenario && selectedScenario.scenarioType !== 'base') {
      setNewScenarioType(selectedScenario.scenarioType);
      return;
    }
    setNewScenarioType('hypothesis');
  }, [hasBaseScenario, scenarios, selectedScenarioId]);

  React.useEffect(() => {
    onScenarioSelectionChange?.(selectedScenarioId);
  }, [onScenarioSelectionChange, selectedScenarioId]);

  const baseScenarioListItem = React.useMemo(
    () => scenarios.find((item) => item.onOletus) ?? null,
    [scenarios],
  );

  const selectedScenarioListItem = React.useMemo(
    () => scenarios.find((item) => item.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  );

  const selectedScenarioDisplayName = React.useMemo(
    () =>
      getScenarioDisplayName(
        scenario?.name ?? selectedScenarioListItem?.name ?? null,
        t,
      ),
    [scenario?.name, selectedScenarioListItem?.name, t],
  );

  const scenarioTypeOptions = React.useMemo(() => {
    if (!hasBaseScenario) {
      return ['base', ...EDITABLE_SCENARIO_TYPES] as V2ForecastScenarioType[];
    }
    return [...EDITABLE_SCENARIO_TYPES] as V2ForecastScenarioType[];
  }, [hasBaseScenario]);

  React.useEffect(() => {
    if (
      !scenario ||
      !baseScenarioListItem ||
      baseScenarioListItem.id === scenario.id
    ) {
      setComparisonScenario(null);
      setLoadingComparisonScenario(false);
      return;
    }

    let active = true;
    setLoadingComparisonScenario(true);
    void getForecastScenarioV2(baseScenarioListItem.id)
      .then((data) => {
        if (active) {
          setComparisonScenario(data);
        }
      })
      .catch(() => {
        if (active) {
          setComparisonScenario(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingComparisonScenario(false);
        }
      });

    return () => {
      active = false;
    };
  }, [baseScenarioListItem, scenario]);

  const updateScenarioSummary = React.useCallback((updated: V2ForecastScenario) => {
    setScenarios((prev) =>
      prev.map((item) =>
        item.id === updated.id
          ? {
              ...item,
              name: updated.name,
              scenarioType: updated.scenarioType,
              horizonYears: updated.horizonYears,
              baselineYear: updated.baselineYear,
              updatedAt: updated.updatedAt,
              computedAt: updated.computedAt,
              computedFromUpdatedAt: updated.computedFromUpdatedAt,
              computedYears: updated.years.length,
            }
          : item,
      ),
    );
  }, []);

  const markScenarioAsNeedsRecompute = React.useCallback(() => {
    setScenario((prev) => {
      if (!prev) {
        return prev;
      }
      const nextScenario = {
        ...prev,
        computedAt: null,
        computedFromUpdatedAt: null,
      };
      updateScenarioSummary(nextScenario);
      return nextScenario;
    });
  }, [updateScenarioSummary]);

  const revenueAssumptionsChanged = React.useMemo(() => {
    if (!scenario) {
      return false;
    }
    return REVENUE_ASSUMPTION_KEYS.some((key) => {
      const draftValue = round4(draftAssumptions[key] ?? 0);
      const scenarioValue = round4(scenario.assumptions[key] ?? 0);
      return draftValue !== scenarioValue;
    });
  }, [draftAssumptions, scenario]);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!scenario) {
      return false;
    }
    if (draftName.trim() !== scenario.name) {
      return true;
    }
    if (draftScenarioType !== scenario.scenarioType) {
      return true;
    }
    if (revenueAssumptionsChanged) {
      return true;
    }
    if (!investmentsEqual(draftInvestments, scenario.yearlyInvestments)) {
      return true;
    }
    return !nearTermExpenseEqual(
      draftNearTermExpenseAssumptions,
      scenario.nearTermExpenseAssumptions,
    );
  }, [
    draftInvestments,
    draftName,
    draftScenarioType,
    draftNearTermExpenseAssumptions,
    revenueAssumptionsChanged,
    scenario,
  ]);

  const busy = activeOperation !== 'idle';
  const isComputing = activeOperation === 'computing';

  const forecastFreshnessState = React.useMemo<ForecastFreshnessState>(
    () =>
      deriveForecastFreshnessState({
        scenario,
        hasUnsavedChanges,
        isComputing,
      }),
    [hasUnsavedChanges, isComputing, scenario],
  );

  const latestPricePoint = React.useMemo(() => {
    if (!scenario || scenario.priceSeries.length === 0) {
      return null;
    }
    return scenario.priceSeries[scenario.priceSeries.length - 1] ?? null;
  }, [scenario]);

  const latestCashflowPoint = React.useMemo(() => {
    if (!scenario || scenario.cashflowSeries.length === 0) {
      return null;
    }
    return scenario.cashflowSeries[scenario.cashflowSeries.length - 1] ?? null;
  }, [scenario]);

  const lowestCumulativeCashPoint = React.useMemo(() => {
    if (!scenario || scenario.cashflowSeries.length === 0) {
      return null;
    }
    return scenario.cashflowSeries.reduce((lowest, row) =>
      row.cumulativeCashflow < lowest.cumulativeCashflow ? row : lowest,
    );
  }, [scenario]);

  const resolvePrimaryFeeSignal = React.useCallback(
    (value: V2ForecastScenario | null | undefined) => {
      return {
        priceLabel: t(
          'v2Forecast.requiredPriceAnnualResult',
          'Required price today (annual result = 0)',
        ),
        price:
          value?.requiredPriceTodayCombinedAnnualResult ??
          value?.requiredPriceTodayCombined ??
          value?.requiredPriceTodayCombinedCumulativeCash ??
          value?.baselinePriceTodayCombined ??
          0,
        increaseLabel: t(
          'v2Forecast.requiredIncreaseAnnualResult',
          'Required increase vs comparator (annual result)',
        ),
        increase:
          value?.requiredAnnualIncreasePctAnnualResult ??
          value?.requiredAnnualIncreasePct ??
          value?.requiredAnnualIncreasePctCumulativeCash ??
          0,
      };
    },
    [t],
  );

  const primaryFeeSignal = React.useMemo(
    () => resolvePrimaryFeeSignal(scenario),
    [resolvePrimaryFeeSignal, scenario],
  );

  const comparisonPrimaryFeeSignal = React.useMemo(
    () => resolvePrimaryFeeSignal(comparisonScenario),
    [comparisonScenario, resolvePrimaryFeeSignal],
  );

  return {
    scenarios,
    setScenarios,
    selectedScenarioId,
    setSelectedScenarioId,
    scenario,
    setScenario,
    draftName,
    setDraftName,
    draftScenarioType,
    setDraftScenarioType,
    draftAssumptions,
    setDraftAssumptions,
    draftInvestments,
    setDraftInvestments,
    draftNearTermExpenseAssumptions,
    setDraftNearTermExpenseAssumptions,
    nearTermExpenseDraftText,
    setNearTermExpenseDraftText,
    depreciationRuleDrafts,
    setDepreciationRuleDrafts,
    savedDepreciationRuleDrafts,
    setSavedDepreciationRuleDrafts,
    classAllocationDraftByYear,
    setClassAllocationDraftByYear,
    savedClassAllocationDraftByYear,
    setSavedClassAllocationDraftByYear,
    loadingDepreciation,
    setLoadingDepreciation,
    newScenarioName,
    setNewScenarioName,
    newScenarioType,
    setNewScenarioType,
    loadingList,
    setLoadingList,
    loadingScenario,
    setLoadingScenario,
    activeOperation,
    setActiveOperation,
    error,
    setError,
    info,
    setInfo,
    planningContext,
    setPlanningContext,
    planningContextLoaded,
    setPlanningContextLoaded,
    planningContextError,
    setPlanningContextError,
    comparisonScenario,
    setComparisonScenario,
    loadingComparisonScenario,
    setLoadingComparisonScenario,
    activeWorkbench,
    setActiveWorkbench,
    activePrimaryChart,
    setActivePrimaryChart,
    denseAnalystMode,
    setDenseAnalystMode,
    mapKnownForecastError,
    loadScenarioList,
    loadScenario,
    hasBaselineBudget,
    firstBaselineYear,
    baseScenarioListItem,
    selectedScenarioListItem,
    selectedScenarioDisplayName,
    scenarioTypeOptions,
    updateScenarioSummary,
    markScenarioAsNeedsRecompute,
    revenueAssumptionsChanged,
    hasUnsavedChanges,
    busy,
    isComputing,
    forecastFreshnessState,
    latestPricePoint,
    latestCashflowPoint,
    lowestCumulativeCashPoint,
    resolvePrimaryFeeSignal,
    primaryFeeSignal,
    comparisonPrimaryFeeSignal,
  };
}

export type ForecastScenarioController = ReturnType<
  typeof useForecastScenarioController
>;
