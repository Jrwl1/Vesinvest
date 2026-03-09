import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  createDepreciationRuleV2,
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteDepreciationRuleV2,
  deleteForecastScenarioV2,
  getScenarioClassAllocationsV2,
  getForecastScenarioV2,
  getPlanningContextV2,
  listDepreciationRulesV2,
  listForecastScenariosV2,
  updateDepreciationRuleV2,
  updateScenarioClassAllocationsV2,
  updateForecastScenarioV2,
  type V2DepreciationRule,
  type V2PlanningContextResponse,
  type V2ForecastScenario,
  type V2ForecastScenarioListItem,
  type V2YearlyInvestmentPlanRow,
} from '../api';
import { formatEur, formatNumber, formatPercent, formatPrice } from './format';
import {
  buildRiskComparisonDelta,
  buildRiskPresetUpdate,
  feeMetricValue,
  type RiskPresetId,
} from './riskScenario';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Props = {
  onReportCreated: (reportId: string) => void;
};

const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  investointikerroin: 'assumptions.investmentFactor',
};

type RiskPresetDefinition = {
  id: RiskPresetId;
  titleKey: string;
  title: string;
  descriptionKey: string;
  description: string;
};

const RISK_PRESETS: RiskPresetDefinition[] = [
  {
    id: 'lower_volume',
    titleKey: 'v2Forecast.riskPresetLowerVolume',
    title: 'Lower volume',
    descriptionKey: 'v2Forecast.riskPresetLowerVolumeHint',
    description: 'Adds a stronger volume decline to the current scenario.',
  },
  {
    id: 'higher_opex',
    titleKey: 'v2Forecast.riskPresetHigherOpex',
    title: 'Higher opex',
    descriptionKey: 'v2Forecast.riskPresetHigherOpexHint',
    description: 'Raises non-energy operating cost growth in the near term and thereafter.',
  },
  {
    id: 'higher_energy',
    titleKey: 'v2Forecast.riskPresetHigherEnergy',
    title: 'Higher energy',
    descriptionKey: 'v2Forecast.riskPresetHigherEnergyHint',
    description: 'Raises energy cost growth in the near term and thereafter.',
  },
  {
    id: 'higher_capex',
    titleKey: 'v2Forecast.riskPresetHigherCapex',
    title: 'Higher capex',
    descriptionKey: 'v2Forecast.riskPresetHigherCapexHint',
    description: 'Increases yearly investments and long-run investment growth.',
  },
  {
    id: 'delayed_fee_increase',
    titleKey: 'v2Forecast.riskPresetDelayedFeeIncrease',
    title: 'Delayed fee increase',
    descriptionKey: 'v2Forecast.riskPresetDelayedFeeIncreaseHint',
    description: 'Freezes automatic price growth so tariff action is delayed.',
  },
  {
    id: 'financing_pressure',
    titleKey: 'v2Forecast.riskPresetFinancingPressure',
    title: 'Financing pressure',
    descriptionKey: 'v2Forecast.riskPresetFinancingPressureHint',
    description: 'Combines delayed fee reaction with higher capex and lower volume.',
  },
];

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const MAX_YEARLY_INVESTMENT_EUR = 1_000_000_000;

const clampYearlyInvestment = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_YEARLY_INVESTMENT_EUR, Math.max(0, Math.round(value)));
};

const formatScenarioUpdatedAt = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const investmentsEqual = (
  a: V2YearlyInvestmentPlanRow[],
  b: V2YearlyInvestmentPlanRow[],
): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.year !== right.year) return false;
    if (round4(left.amount) !== round4(right.amount)) return false;
    if ((left.category ?? '') !== (right.category ?? '')) return false;
    if ((left.investmentType ?? '') !== (right.investmentType ?? ''))
      return false;
    if ((left.confidence ?? '') !== (right.confidence ?? '')) return false;
    if ((left.note ?? '') !== (right.note ?? '')) return false;
  }
  return true;
};

type NearTermExpenseRow = {
  year: number;
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

type NearTermField = 'personnelPct' | 'energyPct' | 'opexOtherPct';

const NEAR_TERM_FIELDS: NearTermField[] = [
  'personnelPct',
  'energyPct',
  'opexOtherPct',
];

type NearTermValidationCode = 'required' | 'invalid' | 'outOfRange';

type NearTermValidationErrors = Record<
  number,
  Partial<Record<NearTermField, NearTermValidationCode>>
>;

type NearTermExpenseDraftText = Record<number, Record<NearTermField, string>>;

type DepreciationRuleDraft = {
  id?: string;
  assetClassKey: string;
  assetClassName: string;
  method: 'linear' | 'residual' | 'none';
  linearYears: string;
  residualPercent: string;
};

type ClassAllocationDraftByYear = Record<number, Record<string, string>>;

const nearTermExpenseEqual = (
  a: NearTermExpenseRow[],
  b: NearTermExpenseRow[],
): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.year !== right.year) return false;
    if (round4(left.personnelPct) !== round4(right.personnelPct)) return false;
    if (round4(left.energyPct) !== round4(right.energyPct)) return false;
    if (round4(left.opexOtherPct) !== round4(right.opexOtherPct)) return false;
  }
  return true;
};

const toNearTermExpenseDraftText = (
  rows: NearTermExpenseRow[],
): NearTermExpenseDraftText => {
  const out: NearTermExpenseDraftText = {};
  for (const row of rows) {
    out[row.year] = {
      personnelPct: String(row.personnelPct),
      energyPct: String(row.energyPct),
      opexOtherPct: String(row.opexOtherPct),
    };
  }
  return out;
};

const parseNearTermPercent = (rawValue: string): number | null => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDepreciationRuleDraft = (
  rule: V2DepreciationRule,
): DepreciationRuleDraft => ({
  id: rule.id,
  assetClassKey: rule.assetClassKey,
  assetClassName: rule.assetClassName ?? '',
  method: rule.method,
  linearYears:
    rule.linearYears == null || !Number.isFinite(rule.linearYears)
      ? ''
      : String(rule.linearYears),
  residualPercent:
    rule.residualPercent == null || !Number.isFinite(rule.residualPercent)
      ? ''
      : String(rule.residualPercent),
});

const buildClassAllocationDraftByYear = (
  years: number[],
  classKeys: string[],
  sourceRows: Array<{
    year: number;
    allocations: Array<{ classKey: string; sharePct: number }>;
  }>,
): ClassAllocationDraftByYear => {
  const sourceMap = new Map<number, Record<string, number>>();
  for (const row of sourceRows) {
    sourceMap.set(
      row.year,
      Object.fromEntries(
        row.allocations.map((item) => [item.classKey, item.sharePct]),
      ),
    );
  }

  const out: ClassAllocationDraftByYear = {};
  for (const year of years) {
    const yearSource = sourceMap.get(year) ?? {};
    out[year] = Object.fromEntries(
      classKeys.map((classKey) => [
        classKey,
        Number.isFinite(yearSource[classKey])
          ? String(yearSource[classKey])
          : '',
      ]),
    );
  }
  return out;
};

const validateNearTermPercent = (
  rawValue: string,
): NearTermValidationCode | null => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return 'required';
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 'invalid';
  if (parsed < -100 || parsed > 100) return 'outOfRange';
  return null;
};

export const EnnustePageV2: React.FC<Props> = ({ onReportCreated }) => {
  const { t } = useTranslation();
  const depreciationFeatureEnabled =
    import.meta.env.VITE_V2_DEPRECIATION_RULES_ENABLED !== 'false';
  const [scenarios, setScenarios] = React.useState<
    V2ForecastScenarioListItem[]
  >([]);
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<
    string | null
  >(null);
  const [scenario, setScenario] = React.useState<V2ForecastScenario | null>(
    null,
  );
  const [draftName, setDraftName] = React.useState('');
  const [draftAssumptions, setDraftAssumptions] = React.useState<
    Record<string, number>
  >({});
  const [draftInvestments, setDraftInvestments] = React.useState<
    V2YearlyInvestmentPlanRow[]
  >([]);
  const [draftNearTermExpenseAssumptions, setDraftNearTermExpenseAssumptions] =
    React.useState<NearTermExpenseRow[]>([]);
  const [nearTermExpenseDraftText, setNearTermExpenseDraftText] =
    React.useState<NearTermExpenseDraftText>({});
  const [depreciationRuleDrafts, setDepreciationRuleDrafts] = React.useState<
    DepreciationRuleDraft[]
  >([]);
  const [classAllocationDraftByYear, setClassAllocationDraftByYear] =
    React.useState<ClassAllocationDraftByYear>({});
  const [loadingDepreciation, setLoadingDepreciation] = React.useState(false);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingScenario, setLoadingScenario] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [computedFromUpdatedAt, setComputedFromUpdatedAt] = React.useState<
    string | null
  >(null);
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [planningContextLoaded, setPlanningContextLoaded] =
    React.useState(false);
  const [comparisonScenario, setComparisonScenario] =
    React.useState<V2ForecastScenario | null>(null);
  const [loadingComparisonScenario, setLoadingComparisonScenario] =
    React.useState(false);
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
          if (preferredId && rows.some((row) => row.id === preferredId))
            return preferredId;
          if (current && rows.some((row) => row.id === current)) return current;
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
      setDraftAssumptions({});
      setDraftInvestments([]);
      setDraftNearTermExpenseAssumptions([]);
      setNearTermExpenseDraftText({});
      setDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setComputedFromUpdatedAt(null);
      try {
        const data = await getForecastScenarioV2(scenarioId);
        if (loadSeq !== scenarioLoadSeqRef.current) return;
        setScenario(data);
        setDraftName(data.name);
        setDraftAssumptions({ ...data.assumptions });
        setDraftInvestments(
          data.yearlyInvestments.map((item) => ({ ...item })),
        );
        const nearTermDraft = data.nearTermExpenseAssumptions.map((item) => ({
          ...item,
        }));
        setDraftNearTermExpenseAssumptions(nearTermDraft);
        setNearTermExpenseDraftText(toNearTermExpenseDraftText(nearTermDraft));

        if (depreciationFeatureEnabled) {
          setLoadingDepreciation(true);
          try {
            const [rules, allocationPayload] = await Promise.all([
              listDepreciationRulesV2(),
              getScenarioClassAllocationsV2(scenarioId),
            ]);
            if (loadSeq !== scenarioLoadSeqRef.current) return;
            setDepreciationRuleDrafts(rules.map(toDepreciationRuleDraft));
            setClassAllocationDraftByYear(
              buildClassAllocationDraftByYear(
                data.yearlyInvestments.map((item) => item.year),
                rules.map((item) => item.assetClassKey),
                allocationPayload.years,
              ),
            );
          } finally {
            if (loadSeq === scenarioLoadSeqRef.current) {
              setLoadingDepreciation(false);
            }
          }
        }
      } catch (err) {
        if (loadSeq !== scenarioLoadSeqRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Forecast.errorLoadScenarioFailed',
                'Failed to load scenario.',
              ),
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
    loadScenarioList();
  }, [loadScenarioList]);

  React.useEffect(() => {
    let active = true;
    getPlanningContextV2()
      .then((data) => {
        if (active) setPlanningContext(data);
      })
      .catch(() => {
        if (active) setPlanningContext(null);
      })
      .finally(() => {
        if (active) setPlanningContextLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasBaselineBudget =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;

  React.useEffect(() => {
    if (!selectedScenarioId) {
      scenarioLoadSeqRef.current += 1;
      setLoadingScenario(false);
      setScenario(null);
      setDraftName('');
      setDraftAssumptions({});
      setDraftInvestments([]);
      setDraftNearTermExpenseAssumptions([]);
      setNearTermExpenseDraftText({});
      setDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setComparisonScenario(null);
      setLoadingComparisonScenario(false);
      setComputedFromUpdatedAt(null);
      return;
    }
    loadScenario(selectedScenarioId);
  }, [selectedScenarioId, loadScenario]);

  const baseScenarioListItem = React.useMemo(
    () => scenarios.find((item) => item.onOletus) ?? null,
    [scenarios],
  );

  const selectedScenarioListItem = React.useMemo(
    () => scenarios.find((item) => item.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  );

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
    getForecastScenarioV2(baseScenarioListItem.id)
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
  }, [scenario, baseScenarioListItem]);

  const updateScenarioSummary = React.useCallback(
    (updated: V2ForecastScenario) => {
      setScenarios((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                horizonYears: updated.horizonYears,
                baselineYear: updated.baselineYear,
                updatedAt: updated.updatedAt,
                computedYears: updated.years.length,
              }
            : item,
        ),
      );
    },
    [],
  );

  const hasUnsavedChanges = React.useMemo(() => {
    if (!scenario) return false;
    if (draftName.trim() !== scenario.name) return true;
    if (!investmentsEqual(draftInvestments, scenario.yearlyInvestments))
      return true;
    if (
      !nearTermExpenseEqual(
        draftNearTermExpenseAssumptions,
        scenario.nearTermExpenseAssumptions,
      )
    ) {
      return true;
    }
    return false;
  }, [scenario, draftName, draftInvestments, draftNearTermExpenseAssumptions]);

  const reportReadinessReason = React.useMemo(() => {
    if (!scenario) return 'missingScenario' as const;
    if (hasUnsavedChanges) return 'unsavedChanges' as const;
    if (scenario.years.length === 0) return 'missingComputeResults' as const;
    if (!computedFromUpdatedAt) return 'missingComputeToken' as const;
    if (computedFromUpdatedAt !== scenario.updatedAt) {
      return 'staleComputeToken' as const;
    }
    return null;
  }, [scenario, hasUnsavedChanges, computedFromUpdatedAt]);

  const canCreateReport = reportReadinessReason == null;

  const reportReadinessHint = React.useMemo(() => {
    switch (reportReadinessReason) {
      case 'unsavedChanges':
        return t(
          'v2Forecast.unsavedHint',
          'You have unsaved changes. Compute scenario before creating report.',
        );
      case 'missingComputeResults':
      case 'missingComputeToken':
        return t(
          'v2Forecast.computeBeforeReport',
          'Compute scenario before creating report.',
        );
      case 'staleComputeToken':
        return t(
          'v2Forecast.staleComputeHint',
          'Scenario changed after last compute. Recompute scenario before creating report.',
        );
      default:
        return null;
    }
  }, [reportReadinessReason, t]);

  const saveDrafts =
    React.useCallback(async (): Promise<V2ForecastScenario | null> => {
      if (!scenario || !selectedScenarioId) return null;
      if (!hasUnsavedChanges) return scenario;

      const payload = {
        name: draftName.trim() || scenario.name,
        yearlyInvestments: draftInvestments,
        nearTermExpenseAssumptions: draftNearTermExpenseAssumptions,
      };
      const updated = await updateForecastScenarioV2(
        selectedScenarioId,
        payload,
      );
      setScenario(updated);
      setDraftName(updated.name);
      setDraftAssumptions({ ...updated.assumptions });
      setDraftInvestments(
        updated.yearlyInvestments.map((item) => ({ ...item })),
      );
      const nearTermDraft = updated.nearTermExpenseAssumptions.map((item) => ({
        ...item,
      }));
      setDraftNearTermExpenseAssumptions(nearTermDraft);
      setNearTermExpenseDraftText(toNearTermExpenseDraftText(nearTermDraft));
      setComputedFromUpdatedAt(null);
      updateScenarioSummary(updated);
      return updated;
    }, [
      scenario,
      selectedScenarioId,
      hasUnsavedChanges,
      draftName,
      draftAssumptions,
      draftInvestments,
      draftNearTermExpenseAssumptions,
      updateScenarioSummary,
    ]);

  const investmentSummary = React.useMemo(() => {
    if (draftInvestments.length === 0) {
      return {
        peakAnnualAmount: 0,
        peakYears: [] as number[],
        strongestFiveYearTotal: 0,
        strongestFiveYearRange: null as { startYear: number; endYear: number } | null,
      };
    }

    let peakAnnualAmount = 0;
    const peakYears: number[] = [];
    for (const row of draftInvestments) {
      if (row.amount > peakAnnualAmount) {
        peakAnnualAmount = row.amount;
      }
    }
    for (const row of draftInvestments) {
      if (round4(row.amount) === round4(peakAnnualAmount) && peakAnnualAmount > 0) {
        peakYears.push(row.year);
      }
    }

    let strongestFiveYearTotal = 0;
    let strongestFiveYearRange: { startYear: number; endYear: number } | null = null;
    for (let startIndex = 0; startIndex < draftInvestments.length; startIndex += 1) {
      const windowRows = draftInvestments.slice(startIndex, startIndex + 5);
      if (windowRows.length === 0) continue;
      const total = windowRows.reduce((sum, row) => sum + row.amount, 0);
      if (total > strongestFiveYearTotal) {
        strongestFiveYearTotal = total;
        strongestFiveYearRange = {
          startYear: windowRows[0]!.year,
          endYear: windowRows[windowRows.length - 1]!.year,
        };
      }
    }

    return {
      peakAnnualAmount,
      peakYears,
      strongestFiveYearTotal,
      strongestFiveYearRange,
    };
  }, [draftInvestments]);

  const handleCreate = React.useCallback(
    async (copyFromCurrent: boolean) => {
      if (!hasBaselineBudget) {
        setError(
          t(
            'v2Forecast.errorMissingBaselineBudget',
            'No VEETI baseline budget found. Import VEETI data first.',
          ),
        );
        setInfo(null);
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const created = await createForecastScenarioV2({
          name: newScenarioName.trim() || undefined,
          copyFromScenarioId: copyFromCurrent
            ? selectedScenarioId ?? undefined
            : undefined,
        });
        setNewScenarioName('');
        await loadScenarioList(created.id, true);
        setInfo(t('v2Forecast.infoCreated', 'Scenario created.'));
      } catch (err) {
        setError(
          mapKnownForecastError(
            err,
            'v2Forecast.errorCreateFailed',
            'Failed to create scenario.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      hasBaselineBudget,
      loadScenarioList,
      mapKnownForecastError,
      newScenarioName,
      selectedScenarioId,
      t,
    ],
  );

  const handleDelete = React.useCallback(async () => {
    if (!scenario || !selectedScenarioId || scenario.onOletus) return;
    const confirmed = window.confirm(
      t('v2Forecast.deleteConfirm', 'Delete scenario "{{name}}"?', {
        name: scenario.name,
      }),
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await deleteForecastScenarioV2(selectedScenarioId);
      setInfo(t('v2Forecast.infoDeleted', 'Scenario deleted.'));
      await loadScenarioList(undefined, true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorDeleteFailed', 'Failed to delete scenario.'),
      );
    } finally {
      setBusy(false);
    }
  }, [scenario, selectedScenarioId, loadScenarioList, t]);

  const handleSave = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      setInfo(
        t(
          'v2Forecast.infoDraftSaved',
          'Draft saved. Recalculate scenario to refresh results.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorSaveFailed', 'Saving failed.'),
      );
    } finally {
      setBusy(false);
    }
  }, [saveDrafts, t]);

  const handleCompute = React.useCallback(async () => {
    if (!selectedScenarioId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      const computed = await computeForecastScenarioV2(selectedScenarioId);
      setScenario(computed);
      setDraftName(computed.name);
      setDraftAssumptions({ ...computed.assumptions });
      setDraftInvestments(
        computed.yearlyInvestments.map((item) => ({ ...item })),
      );
      const nearTermDraft = computed.nearTermExpenseAssumptions.map((item) => ({
        ...item,
      }));
      setDraftNearTermExpenseAssumptions(nearTermDraft);
      setNearTermExpenseDraftText(toNearTermExpenseDraftText(nearTermDraft));
      setComputedFromUpdatedAt(computed.updatedAt);
      updateScenarioSummary(computed);
      setInfo(t('v2Forecast.infoComputed', 'Scenario calculated.'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorComputeFailed', 'Calculation failed.'),
      );
    } finally {
      setBusy(false);
    }
  }, [selectedScenarioId, saveDrafts, updateScenarioSummary, t]);

  const handleGenerateReport = React.useCallback(async () => {
    if (!selectedScenarioId || !computedFromUpdatedAt) {
      setError(
        t(
          'v2Forecast.computeBeforeReport',
          'Compute scenario before creating report.',
        ),
      );
      setInfo(null);
      return;
    }

    if (!canCreateReport) {
      if (reportReadinessHint) {
        setError(reportReadinessHint);
      }
      setInfo(null);
      return;
    }

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const report = await createReportV2({
        ennusteId: selectedScenarioId,
        computedFromUpdatedAt,
      });
      setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onReportCreated(report.reportId);
    } catch (err) {
      setError(
        mapKnownForecastError(
          err,
          'v2Forecast.errorReportFailed',
          'Failed to create report.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [
    selectedScenarioId,
    computedFromUpdatedAt,
    canCreateReport,
    reportReadinessHint,
    onReportCreated,
    mapKnownForecastError,
    t,
  ]);

  const handleInvestmentChange = React.useCallback(
    (year: number, value: string) => {
      const normalized = value.trim().replace(',', '.');
      const parsed = normalized.length === 0 ? 0 : Number(normalized);
      if (!Number.isFinite(parsed)) return;
      const safeAmount = clampYearlyInvestment(parsed);
      setDraftInvestments((prev) =>
        prev.map((item) =>
          item.year === year ? { ...item, amount: safeAmount } : item,
        ),
      );
    },
    [],
  );

  const handleInvestmentBlur = React.useCallback((year: number) => {
    setDraftInvestments((prev) =>
      prev.map((item) =>
        item.year === year
          ? { ...item, amount: clampYearlyInvestment(item.amount) }
          : item,
      ),
    );
  }, []);

  const handleCopyFirstInvestmentToAll = React.useCallback(() => {
    setDraftInvestments((prev) => {
      const firstAmount = clampYearlyInvestment(prev[0]?.amount ?? 0);
      return prev.map((item) => ({ ...item, amount: firstAmount }));
    });
  }, []);

  const handleClearAllInvestments = React.useCallback(() => {
    setDraftInvestments((prev) => prev.map((item) => ({ ...item, amount: 0 })));
  }, []);

  const handleInvestmentMetadataChange = React.useCallback(
    (
      year: number,
      field: 'category' | 'investmentType' | 'confidence' | 'note',
      value: string,
    ) => {
      setDraftInvestments((prev) =>
        prev.map((item) => {
          if (item.year !== year) return item;
          if (field === 'category' || field === 'note') {
            return {
              ...item,
              [field]: value.trim().length > 0 ? value : null,
            };
          }
          return {
            ...item,
            [field]: value.length > 0 ? value : null,
          };
        }),
      );
    },
    [],
  );

  const handleNearTermExpenseChange = React.useCallback(
    (year: number, field: NearTermField, rawValue: string) => {
      setNearTermExpenseDraftText((prev) => ({
        ...prev,
        [year]: {
          personnelPct: prev[year]?.personnelPct ?? '0',
          energyPct: prev[year]?.energyPct ?? '0',
          opexOtherPct: prev[year]?.opexOtherPct ?? '0',
          [field]: rawValue,
        },
      }));

      const parsed = parseNearTermPercent(rawValue);
      if (parsed == null) return;

      setDraftNearTermExpenseAssumptions((prev) =>
        prev.map((item) =>
          item.year === year
            ? {
                ...item,
                [field]: parsed,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleNearTermExpenseBlur = React.useCallback(
    (year: number, field: NearTermField) => {
      setNearTermExpenseDraftText((prev) => {
        const row = prev[year];
        if (!row) return prev;
        const parsed = parseNearTermPercent(row[field]);
        const fallbackRow = draftNearTermExpenseAssumptions.find(
          (item) => item.year === year,
        );
        const normalized =
          parsed == null ? String(fallbackRow?.[field] ?? 0) : String(parsed);

        return {
          ...prev,
          [year]: {
            ...row,
            [field]: normalized,
          },
        };
      });
    },
    [draftNearTermExpenseAssumptions],
  );

  const nearTermInputValue = React.useCallback(
    (row: NearTermExpenseRow, field: NearTermField) => {
      return nearTermExpenseDraftText[row.year]?.[field] ?? String(row[field]);
    },
    [nearTermExpenseDraftText],
  );

  const nearTermValidationErrors =
    React.useMemo<NearTermValidationErrors>(() => {
      const errors: NearTermValidationErrors = {};
      for (const row of draftNearTermExpenseAssumptions) {
        for (const field of NEAR_TERM_FIELDS) {
          const code = validateNearTermPercent(nearTermInputValue(row, field));
          if (!code) continue;
          errors[row.year] = {
            ...(errors[row.year] ?? {}),
            [field]: code,
          };
        }
      }
      return errors;
    }, [draftNearTermExpenseAssumptions, nearTermInputValue]);

  const hasNearTermValidationErrors = React.useMemo(
    () => Object.keys(nearTermValidationErrors).length > 0,
    [nearTermValidationErrors],
  );

  const handleApplyRiskPreset = React.useCallback(
    async (preset: RiskPresetDefinition) => {
      if (!scenario || !selectedScenarioId) return;
      if (hasNearTermValidationErrors) {
        setError(
          t(
            'v2Forecast.nearTermValidationSummary',
            'Fix highlighted near-term percentage fields before saving or computing.',
          ),
        );
        setInfo(null);
        return;
      }

      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const saved = await saveDrafts();
        const baseScenario = saved ?? scenario;
        const createdName = `${baseScenario.name} - ${t(
          preset.titleKey,
          preset.title,
        )}`;
        const created = await createForecastScenarioV2({
          name: createdName,
          copyFromScenarioId: selectedScenarioId,
          compute: false,
        });
        await updateForecastScenarioV2(
          created.id,
          buildRiskPresetUpdate(preset.id, baseScenario),
        );
        await computeForecastScenarioV2(created.id);
        await loadScenarioList(created.id, true);
        setInfo(
          t(
            'v2Forecast.riskPresetCreated',
            'Risk scenario "{{name}}" created.',
            { name: createdName },
          ),
        );
      } catch (err) {
        setError(
          mapKnownForecastError(
            err,
            'v2Forecast.errorRiskPresetFailed',
            'Failed to create risk scenario.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      scenario,
      selectedScenarioId,
      hasNearTermValidationErrors,
      saveDrafts,
      loadScenarioList,
      mapKnownForecastError,
      t,
    ],
  );

  const nearTermValidationMessage = React.useCallback(
    (code: NearTermValidationCode | undefined) => {
      switch (code) {
        case 'required':
          return t(
            'v2Forecast.nearTermValidationRequired',
            'Enter a percentage value.',
          );
        case 'invalid':
          return t(
            'v2Forecast.nearTermValidationInvalid',
            'Use a valid number (for example 3.5).',
          );
        case 'outOfRange':
          return t(
            'v2Forecast.nearTermValidationRange',
            'Value must be between -100 and 100.',
          );
        default:
          return null;
      }
    },
    [t],
  );

  const depreciationClassKeys = React.useMemo(
    () =>
      depreciationRuleDrafts
        .map((item) => item.assetClassKey.trim())
        .filter((key): key is string => key.length > 0),
    [depreciationRuleDrafts],
  );

  React.useEffect(() => {
    const years = draftInvestments.map((item) => item.year);
    if (years.length === 0) {
      setClassAllocationDraftByYear({});
      return;
    }
    setClassAllocationDraftByYear((prev) => {
      const next: ClassAllocationDraftByYear = {};
      for (const year of years) {
        const existingRow = prev[year] ?? {};
        next[year] = Object.fromEntries(
          depreciationClassKeys.map((classKey) => [
            classKey,
            existingRow[classKey] ?? '',
          ]),
        );
      }
      return next;
    });
  }, [draftInvestments, depreciationClassKeys]);

  const handleAddDepreciationRuleDraft = React.useCallback(() => {
    setDepreciationRuleDrafts((prev) => [
      ...prev,
      {
        assetClassKey: '',
        assetClassName: '',
        method: 'linear',
        linearYears: '20',
        residualPercent: '',
      },
    ]);
  }, []);

  const handleDepreciationRuleDraftChange = React.useCallback(
    (index: number, field: keyof DepreciationRuleDraft, value: string) => {
      setDepreciationRuleDrafts((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      );
    },
    [],
  );

  const saveDepreciationRuleDraft = React.useCallback(
    async (index: number) => {
      const draft = depreciationRuleDrafts[index];
      if (!draft) return;
      const assetClassKey = draft.assetClassKey.trim();
      if (!assetClassKey) {
        setError(
          t(
            'v2Forecast.depreciationRuleKeyRequired',
            'Class key is required for depreciation rules.',
          ),
        );
        setInfo(null);
        return;
      }

      const linearYears = Number(draft.linearYears);
      const residualPercent = Number(draft.residualPercent);

      const payload = {
        assetClassKey,
        assetClassName: draft.assetClassName.trim() || undefined,
        method: draft.method,
        linearYears:
          draft.method === 'linear' && Number.isFinite(linearYears)
            ? Math.round(linearYears)
            : undefined,
        residualPercent:
          draft.method === 'residual' && Number.isFinite(residualPercent)
            ? residualPercent
            : undefined,
      };

      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        if (draft.id) {
          await updateDepreciationRuleV2(draft.id, payload);
        } else {
          await createDepreciationRuleV2(payload);
        }
        const refreshed = await listDepreciationRulesV2();
        setDepreciationRuleDrafts(refreshed.map(toDepreciationRuleDraft));
        setInfo(
          t(
            'v2Forecast.depreciationRuleSaved',
            'Depreciation rule saved successfully.',
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Forecast.depreciationRuleSaveFailed',
                'Saving depreciation rule failed.',
              ),
        );
      } finally {
        setBusy(false);
      }
    },
    [depreciationRuleDrafts, t],
  );

  const deleteDepreciationRuleDraft = React.useCallback(
    async (index: number) => {
      const draft = depreciationRuleDrafts[index];
      if (!draft) return;

      if (!draft.id) {
        setDepreciationRuleDrafts((prev) =>
          prev.filter((_row, rowIndex) => rowIndex !== index),
        );
        return;
      }

      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await deleteDepreciationRuleV2(draft.id);
        const refreshed = await listDepreciationRulesV2();
        setDepreciationRuleDrafts(refreshed.map(toDepreciationRuleDraft));
        setInfo(
          t('v2Forecast.depreciationRuleDeleted', 'Depreciation rule removed.'),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Forecast.depreciationRuleDeleteFailed',
                'Removing depreciation rule failed.',
              ),
        );
      } finally {
        setBusy(false);
      }
    },
    [depreciationRuleDrafts, t],
  );

  const handleAllocationDraftChange = React.useCallback(
    (year: number, classKey: string, rawValue: string) => {
      setClassAllocationDraftByYear((prev) => ({
        ...prev,
        [year]: {
          ...(prev[year] ?? {}),
          [classKey]: rawValue,
        },
      }));
    },
    [],
  );

  const allocationTotalByYear = React.useMemo(() => {
    const out: Record<number, number> = {};
    for (const year of draftInvestments.map((item) => item.year)) {
      out[year] = depreciationClassKeys.reduce((sum, classKey) => {
        const raw = classAllocationDraftByYear[year]?.[classKey] ?? '';
        const normalized = raw.trim().replace(',', '.');
        const parsed = Number(normalized);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0);
    }
    return out;
  }, [classAllocationDraftByYear, depreciationClassKeys, draftInvestments]);

  const saveClassAllocations = React.useCallback(async () => {
    if (!selectedScenarioId) return;

    const yearsPayload = draftInvestments
      .map((row) => {
        const allocations = depreciationClassKeys
          .map((classKey) => {
            const raw = classAllocationDraftByYear[row.year]?.[classKey] ?? '';
            const normalized = raw.trim().replace(',', '.');
            const parsed = Number(normalized);
            if (!Number.isFinite(parsed) || parsed <= 0) return null;
            return { classKey, sharePct: parsed };
          })
          .filter(
            (item): item is { classKey: string; sharePct: number } =>
              item !== null,
          );
        return {
          year: row.year,
          allocations,
        };
      })
      .filter((row) => row.allocations.length > 0);

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await updateScenarioClassAllocationsV2(selectedScenarioId, {
        years: yearsPayload,
      });
      const refreshed = await getScenarioClassAllocationsV2(selectedScenarioId);
      setClassAllocationDraftByYear(
        buildClassAllocationDraftByYear(
          draftInvestments.map((item) => item.year),
          depreciationClassKeys,
          refreshed.years,
        ),
      );
      setInfo(
        t(
          'v2Forecast.classAllocationsSaved',
          'Class allocations saved successfully.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Forecast.classAllocationsSaveFailed',
              'Saving class allocations failed.',
            ),
      );
    } finally {
      setBusy(false);
    }
  }, [
    selectedScenarioId,
    draftInvestments,
    depreciationClassKeys,
    classAllocationDraftByYear,
    t,
  ]);

  const orderedAssumptionKeys = React.useMemo(() => {
    const keys = Object.keys(draftAssumptions);
    return keys.sort((a, b) => {
      const aKnown = ASSUMPTION_LABEL_KEYS[a] ? 0 : 1;
      const bKnown = ASSUMPTION_LABEL_KEYS[b] ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return a.localeCompare(b, 'fi');
    });
  }, [draftAssumptions]);

  const assumptionLabelByKey = React.useCallback(
    (key: string) => t(ASSUMPTION_LABEL_KEYS[key] ?? key, key),
    [t],
  );

  const formatAssumptionPercent = React.useCallback(
    (value: number | undefined) => {
      const numeric = Number.isFinite(value) ? Number(value) : 0;
      const asPercent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
      return `${formatNumber(asPercent, 2)} %`;
    },
    [],
  );

  const baselineDatasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance:
        | {
            kind: 'manual_edit' | 'statement_import';
            fileName: string | null;
          }
        | null
        | undefined,
    ) => {
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Forecast.baselineSourceStatementImport',
          'Statement import ({{fileName}})',
          {
            fileName:
              provenance.fileName ??
              t('v2Forecast.statementImportFallbackFile', 'bokslut PDF'),
          },
        );
      }
      if (source === 'manual') {
        return t('v2Forecast.baselineSourceManual', 'Manual review');
      }
      if (source === 'veeti') {
        return t('v2Forecast.baselineSourceVeeti', 'VEETI');
      }
      return t('v2Forecast.baselineSourceMissing', 'Missing');
    },
    [t],
  );

  const baselineSourceStatusLabel = React.useCallback(
    (status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE') => {
      if (status === 'VEETI') {
        return t('v2Forecast.baselineYearSourceVeeti', 'VEETI');
      }
      if (status === 'MANUAL') {
        return t('v2Forecast.baselineYearSourceManual', 'Manual');
      }
      if (status === 'MIXED') {
        return t('v2Forecast.baselineYearSourceMixed', 'Mixed');
      }
      return t('v2Forecast.baselineYearSourceIncomplete', 'Incomplete');
    },
    [t],
  );

  const baselineContext = React.useMemo(() => {
    if (!scenario?.baselineYear || !planningContext) return null;
    return (
      planningContext.baselineYears.find(
        (row) => row.year === scenario.baselineYear,
      ) ?? null
    );
  }, [scenario?.baselineYear, planningContext]);

  const riskComparisonSummary = React.useMemo(() => {
    if (!scenario || !comparisonScenario) return null;
    const comparison = buildRiskComparisonDelta(comparisonScenario, scenario);

    if (!comparison.materiallyWorse) {
      return t(
        'v2Forecast.riskSummaryStable',
        'The selected scenario stays close to the base case. Funding pressure does not materially worsen versus the base scenario.',
      );
    }

    return t(
      'v2Forecast.riskSummaryStress',
      'Compared with the base scenario, this stress case raises required fee level by {{priceDelta}}, changes the annual increase need by {{increaseDelta}}, and worsens cumulative cash by {{gapDelta}}.',
      {
        priceDelta: formatPrice(Math.max(0, comparison.requiredPriceDelta)),
        increaseDelta: formatPercent(comparison.requiredIncreaseDelta),
        gapDelta: formatEur(Math.max(0, comparison.peakGapDelta)),
      },
    );
  }, [comparisonScenario, scenario, t]);

  return (
    <div className="v2-page ennuste-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-grid v2-grid-ennuste v2-forecast-layout">
        <aside className="v2-card v2-scenario-panel v2-forecast-sidebar">
          <div className="v2-forecast-sidebar-head">
            <p className="v2-overview-eyebrow">
              {t('projection.v2.scenariosLabel', 'Scenarios')}
            </p>
            <h2>{t('projection.v2.scenariosLabel', 'Scenarios')}</h2>
            <p className="v2-muted">
              {t(
                'v2Forecast.sidebarIntro',
                'Pick the working scenario, create a new one, or branch the current baseline before editing assumptions.',
              )}
            </p>
            <p className="v2-forecast-sidebar-count">
              {t(
                'v2Forecast.sidebarCount',
                '{{count}} scenarios in this planning workspace',
                { count: scenarios.length },
              )}
            </p>
          </div>
          <div className="v2-forecast-sidebar-create">
            <div className="v2-section-header">
              <h3>{t('v2Forecast.branchingTitle', 'Create or branch')}</h3>
            </div>
            <div className="v2-inline-form">
              <input
                id="v2-forecast-new-scenario-name"
                className="v2-input"
                type="text"
                name="newScenarioName"
                placeholder={t(
                  'projection.newScenarioName',
                  'New scenario name',
                )}
                value={newScenarioName}
                onChange={(event) => setNewScenarioName(event.target.value)}
              />
              <button
                type="button"
                className="v2-btn"
                onClick={() => handleCreate(false)}
                disabled={busy || !planningContextLoaded || !hasBaselineBudget}
              >
                {t('v2Forecast.newScenario', 'New')}
              </button>
              <button
                type="button"
                className="v2-btn"
                onClick={() => handleCreate(true)}
                disabled={
                  busy ||
                  !selectedScenarioId ||
                  !planningContextLoaded ||
                  !hasBaselineBudget
                }
              >
                {t('v2Forecast.copyScenario', 'Copy')}
              </button>
            </div>
            <p className="v2-muted">
              {selectedScenarioListItem
                ? t(
                    'v2Forecast.branchingHintSelected',
                    'Copy branches from the currently selected scenario so stress cases inherit its assumptions and investments.',
                  )
                : t(
                    'v2Forecast.branchingHint',
                    'Create a blank scenario or branch the selected one before editing the planning controls.',
                  )}
            </p>
          </div>
          {planningContextLoaded && !hasBaselineBudget ? (
            <p className="v2-muted">
              {t(
                'v2Forecast.createBlockedMissingBaselineHint',
                'Complete Overview import and sync first to create scenarios.',
              )}
            </p>
          ) : null}
          {selectedScenarioListItem ? (
            <div className="v2-forecast-selected-card">
              <div className="v2-forecast-selected-card-head">
                <div>
                  <p className="v2-overview-eyebrow">
                    {t('v2Forecast.selectedScenario', 'Selected scenario')}
                  </p>
                  <h3>{selectedScenarioListItem.name}</h3>
                </div>
                <div className="v2-badge-row">
                  {selectedScenarioListItem.onOletus ? (
                    <span className="v2-badge v2-badge-base">
                      {t('v2Forecast.baseScenario', 'Base')}
                    </span>
                  ) : null}
                  <span
                    className={`v2-badge ${
                      selectedScenarioListItem.computedYears > 0
                        ? 'v2-badge-computed'
                        : 'v2-badge-draft'
                    }`}
                  >
                    {selectedScenarioListItem.computedYears > 0
                      ? t('v2Forecast.computedState', 'Computed')
                      : t('v2Forecast.draftState', 'Draft')}
                  </span>
                </div>
              </div>
              <div className="v2-overview-year-summary-grid">
                <div>
                  <span>{t('projection.v2.baselineYearLabel', 'Baseline year')}</span>
                  <strong>{selectedScenarioListItem.baselineYear ?? '-'}</strong>
                </div>
                <div>
                  <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                  <strong>
                    {selectedScenarioListItem.horizonYears}{' '}
                    {t('projection.v2.horizonUnit', 'y')}
                  </strong>
                </div>
                <div>
                  <span>{t('v2Forecast.computedYearsLabel', 'Computed years')}</span>
                  <strong>{selectedScenarioListItem.computedYears}</strong>
                </div>
              </div>
              <p className="v2-muted">
                {t('v2Forecast.updatedLabel', 'Updated')}:&nbsp;
                {formatScenarioUpdatedAt(selectedScenarioListItem.updatedAt)}
              </p>
            </div>
          ) : null}
          {scenario ? (
            <div className="v2-forecast-sidebar-section">
              <div className="v2-section-header">
                <h3>{t('v2Forecast.riskPresetsTitle', 'Risk presets')}</h3>
              </div>
              <div className="v2-risk-preset-grid">
              {RISK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="v2-risk-preset-card"
                  disabled={
                    busy ||
                    !selectedScenarioId ||
                    !planningContextLoaded ||
                    !hasBaselineBudget
                  }
                  onClick={() => handleApplyRiskPreset(preset)}
                >
                  <strong>{t(preset.titleKey, preset.title)}</strong>
                  <span>{t(preset.descriptionKey, preset.description)}</span>
                </button>
              ))}
            </div>
            </div>
          ) : null}

          <div className="v2-forecast-sidebar-section">
            <div className="v2-section-header">
              <h3>{t('v2Forecast.availableScenarios', 'Available scenarios')}</h3>
            </div>
            {loadingList ? (
              <p>{t('v2Forecast.loadingScenarios', 'Loading scenarios...')}</p>
            ) : (
              <div className="v2-scenario-list">
                {scenarios.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`v2-scenario-row ${
                      selectedScenarioId === item.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedScenarioId(item.id)}
                    disabled={busy || loadingScenario}
                  >
                    <div className="v2-scenario-row-main">
                      <div className="v2-scenario-row-title">
                        <strong>{item.name}</strong>
                        <div className="v2-scenario-row-badges">
                          {item.onOletus ? (
                            <span className="v2-badge v2-badge-base">
                              {t('v2Forecast.baseScenario', 'Base')}
                            </span>
                          ) : null}
                          <span
                            className={`v2-badge ${
                              item.computedYears > 0
                                ? 'v2-badge-computed'
                                : 'v2-badge-draft'
                            }`}
                          >
                            {item.computedYears > 0
                              ? t('v2Forecast.computedState', 'Computed')
                              : t('v2Forecast.draftState', 'Draft')}
                          </span>
                        </div>
                      </div>
                      <span>
                        {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                        {item.baselineYear ?? '-'} |{' '}
                        {t('projection.v2.horizonLabel', 'Horizon')}:{' '}
                        {item.horizonYears}{' '}
                        {t('projection.v2.horizonUnit', 'y')}
                      </span>
                      <span>
                        {t('v2Forecast.computedYearsLabel', 'Computed years')}:{' '}
                        {item.computedYears}
                      </span>
                    </div>
                    <span className="v2-scenario-row-meta">
                      {t('v2Forecast.updatedLabel', 'Updated')}:&nbsp;
                      {formatScenarioUpdatedAt(item.updatedAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="v2-actions-row v2-forecast-sidebar-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={handleSave}
              disabled={
                busy ||
                !scenario ||
                !hasUnsavedChanges ||
                hasNearTermValidationErrors
              }
              title={
                hasNearTermValidationErrors
                  ? t(
                      'v2Forecast.nearTermValidationSummary',
                      'Fix highlighted near-term percentage fields before saving or computing.',
                    )
                  : undefined
              }
            >
              {t('v2Forecast.saveDraft', 'Save draft')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-danger"
              onClick={handleDelete}
              disabled={busy || !scenario || scenario.onOletus}
            >
              {t('common.delete', 'Delete')}
            </button>
          </div>
        </aside>

        <section className="v2-card v2-scenario-editor v2-forecast-editor">
          {loadingScenario ? (
            <div className="v2-loading-state">
              <p>{t('v2Forecast.loadingScenario', 'Loading scenario...')}</p>
              <div className="v2-skeleton-line" />
              <div className="v2-skeleton-line" />
              <div className="v2-skeleton-line" />
            </div>
          ) : null}
          {!loadingScenario && !scenario ? (
            <p>{t('v2Forecast.selectScenario', 'Select a scenario.')}</p>
          ) : null}

          {scenario ? (
            <>
              <div className="v2-scenario-editor-hero">
                <div>
                  <p className="v2-overview-eyebrow">
                    {t('v2Forecast.editorEyebrow', 'Scenario workspace')}
                  </p>
                  <div className="v2-section-header">
                    <h2>
                      {t('projection.title', 'Projection')}: {scenario.name}
                    </h2>
                    <div className="v2-badge-row">
                      {scenario.onOletus ? (
                        <span className="v2-badge v2-badge-base">
                          {t('v2Forecast.baseScenario', 'Base')}
                        </span>
                      ) : (
                        <span className="v2-badge v2-badge-stress">
                          {t('v2Forecast.stressScenario', 'Stress')}
                        </span>
                      )}
                      <span
                        className={`v2-badge ${
                          scenario.years.length > 0
                            ? 'v2-badge-computed'
                            : 'v2-badge-draft'
                        }`}
                      >
                        {scenario.years.length > 0
                          ? t('v2Forecast.computedState', 'Computed')
                          : t('v2Forecast.draftState', 'Draft')}
                      </span>
                    </div>
                  </div>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.editorIntro',
                      'Use this scenario as the working surface for assumptions, investments, and fee pressure checks before computing results.',
                    )}
                  </p>
                </div>
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    onClick={handleCompute}
                    disabled={busy || !scenario || hasNearTermValidationErrors}
                    title={
                      hasNearTermValidationErrors
                        ? t(
                            'v2Forecast.nearTermValidationSummary',
                            'Fix highlighted near-term percentage fields before saving or computing.',
                          )
                        : undefined
                    }
                  >
                    {t(
                      'v2Forecast.computeAndRefresh',
                      'Compute and refresh results',
                    )}
                  </button>
                  <button
                    type="button"
                    className="v2-btn"
                    onClick={handleGenerateReport}
                    disabled={busy || !canCreateReport}
                    title={
                      !canCreateReport
                        ? reportReadinessHint ?? undefined
                        : undefined
                    }
                  >
                    {t('v2Forecast.createReport', 'Create report')}
                  </button>
                </div>
              </div>

              <div className="v2-scenario-editor-info-grid">
                <div className="v2-keyvalue-row">
                  <span>{t('projection.v2.baselineYearLabel', 'Baseline year')}</span>
                  <strong>{scenario.baselineYear ?? '-'}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                  <strong>
                    {scenario.horizonYears}{' '}
                    {t('projection.v2.horizonUnit', 'years')}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.updatedLabel', 'Updated')}</span>
                  <strong>{formatScenarioUpdatedAt(scenario.updatedAt)}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.computeStateLabel', 'Compute state')}</span>
                  <strong>
                    {scenario.years.length > 0
                      ? t('v2Forecast.computedState', 'Computed')
                      : t('v2Forecast.draftState', 'Draft')}
                  </strong>
                </div>
              </div>

              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>
                    {t('projection.newScenarioName', 'Scenario name')}
                  </span>
                  <input
                    id="v2-forecast-scenario-name"
                    className="v2-input"
                    type="text"
                    name="scenarioName"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
                <label className="v2-field">
                  <span>
                    {t('projection.v2.baselineYearLabel', 'Baseline year')}
                  </span>
                  <input
                    id="v2-forecast-baseline-year"
                    className="v2-input"
                    name="baselineYear"
                    value={scenario.baselineYear ?? '-'}
                    disabled
                  />
                </label>
                <label className="v2-field">
                  <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                  <input
                    id="v2-forecast-horizon-years"
                    className="v2-input"
                    name="horizonYears"
                    value={`${scenario.horizonYears} ${t(
                      'projection.v2.horizonUnit',
                      'years',
                    )}`}
                    disabled
                  />
                </label>
              </div>

              <section className="v2-grid v2-grid-two v2-forecast-top-grid">
                <article className="v2-subcard">
                  <div className="v2-section-header">
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.baselineContextTitle',
                          'Baseline realism context',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {baselineContext
                          ? t(
                              'v2Forecast.baselineContextHint',
                              'Baseline year {{year}} quality: {{quality}}.',
                              {
                                year: baselineContext.year,
                                quality:
                                  baselineContext.quality === 'complete'
                                    ? t(
                                        'v2Forecast.qualityComplete',
                                        'complete',
                                      )
                                    : baselineContext.quality === 'partial'
                                    ? t(
                                        'v2Forecast.qualityPartial',
                                        'partial',
                                      )
                                    : t('v2Forecast.qualityMissing', 'missing'),
                              },
                            )
                          : t(
                              'v2Forecast.baselineContextMissing',
                              'Baseline provenance becomes visible after a scenario is loaded.',
                            )}
                      </p>
                    </div>
                    {baselineContext ? (
                      <span
                        className={`v2-badge ${
                          baselineContext.quality === 'complete'
                            ? 'v2-badge-computed'
                            : baselineContext.quality === 'partial'
                            ? 'v2-badge-stress'
                            : 'v2-badge-draft'
                        }`}
                      >
                        {baselineContext.quality === 'complete'
                          ? t('v2Forecast.qualityComplete', 'complete')
                          : baselineContext.quality === 'partial'
                          ? t('v2Forecast.qualityPartial', 'partial')
                          : t('v2Forecast.qualityMissing', 'missing')}
                      </span>
                    ) : null}
                  </div>
                  {baselineContext ? (
                    <>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>
                            {t('v2Forecast.baselineYearSource', 'Year source')}
                          </span>
                          <strong>
                            {baselineSourceStatusLabel(
                              baselineContext.sourceStatus,
                            )}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.baselineFinancialsSource',
                              'Financials',
                            )}
                          </span>
                          <strong>
                            {baselineDatasetSourceLabel(
                              baselineContext.financials.source,
                              baselineContext.financials.provenance,
                            )}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.baselinePricesSource', 'Prices')}</span>
                          <strong>
                            {baselineDatasetSourceLabel(
                              baselineContext.prices.source,
                              baselineContext.prices.provenance,
                            )}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.baselineVolumesSource',
                              'Sold volumes',
                            )}
                          </span>
                          <strong>
                            {baselineDatasetSourceLabel(
                              baselineContext.volumes.source,
                              baselineContext.volumes.provenance,
                            )}
                          </strong>
                        </div>
                      </div>
                      {baselineContext.financials.provenance?.kind ===
                      'statement_import' ? (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.baselineStatementImportDetail',
                            'Financials were imported from {{fileName}}',
                            {
                              fileName:
                                baselineContext.financials.provenance.fileName ??
                                t(
                                  'v2Forecast.statementImportFallbackFile',
                                  'bokslut PDF',
                                ),
                            },
                          )}
                          {baselineContext.financials.provenance.pageNumber
                            ? ` (${t('v2Forecast.pageLabel', 'page')} ${baselineContext.financials.provenance.pageNumber})`
                            : ''}
                        </p>
                      ) : null}
                      <div className="v2-peer-list">
                        <span>
                          {t('v2Forecast.ctxInvestments', 'Investments')}:{' '}
                          <strong>
                            {formatEur(baselineContext.investmentAmount)}
                          </strong>
                        </span>
                        <span>
                          {t('v2Forecast.ctxSoldWater', 'Sold water')}:{' '}
                          <strong>
                            {formatNumber(baselineContext.soldWaterVolume)} m3
                          </strong>
                        </span>
                        <span>
                          {t(
                            'v2Forecast.ctxSoldWastewater',
                            'Sold wastewater',
                          )}
                          :{' '}
                          <strong>
                            {formatNumber(baselineContext.soldWastewaterVolume)}{' '}
                            m3
                          </strong>
                        </span>
                        <span>
                          {t('v2Forecast.ctxPumpedWater', 'Pumped water')}:{' '}
                          <strong>
                            {formatNumber(baselineContext.pumpedWaterVolume)} m3
                          </strong>
                        </span>
                        <span>
                          {t(
                            'v2Forecast.ctxNetWaterTrade',
                            'Net water trade',
                          )}
                          :{' '}
                          <strong>
                            {formatNumber(baselineContext.netWaterTradeVolume)} m3
                          </strong>
                        </span>
                        <span>
                          {t(
                            'v2Forecast.ctxProcessElectricity',
                            'Process electricity',
                          )}
                          :{' '}
                          <strong>
                            {formatNumber(baselineContext.processElectricity)}
                          </strong>
                        </span>
                      </div>
                      {baselineContext.quality !== 'complete' ? (
                        <p className="v2-alert v2-alert-error">
                          {t(
                            'v2Forecast.baselineContextWarning',
                            'Baseline year is partial. Forecast confidence is lower until data is complete.',
                          )}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </article>

                <article className="v2-subcard v2-forecast-summary-card">
                  <div className="v2-section-header">
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.feeSufficiencySnapshot',
                          'Fee sufficiency snapshot',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.feeSufficiencySnapshotHint',
                          'Compare current pricing against the required fee level and underfunding timing before editing the detailed controls below.',
                        )}
                      </p>
                    </div>
                  </div>
                  {reportReadinessHint ? (
                    <p className="v2-muted">{reportReadinessHint}</p>
                  ) : null}
                  <div
                    className={`v2-kpi-strip ${
                      hasUnsavedChanges ? 'v2-kpi-strip-stale' : ''
                    }`}
                  >
                    <div>
                      <h3>{t('v2Forecast.currentFeeLevel', 'Current fee level')}</h3>
                      <p>{formatPrice(scenario.baselinePriceTodayCombined ?? 0)}</p>
                      <small>
                        {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                        {scenario.baselineYear ?? '-'}
                      </small>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.requiredPriceAnnualResult',
                          'Required price today (annual result = 0)',
                        )}
                      </h3>
                      <p>
                        {formatPrice(
                          scenario.requiredPriceTodayCombinedAnnualResult ??
                            scenario.requiredPriceTodayCombined ??
                            scenario.baselinePriceTodayCombined ??
                            0,
                        )}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.requiredIncreaseAnnualResult',
                          'Required increase vs comparator (annual result)',
                        )}
                      </h3>
                      <p>
                        {formatPercent(
                          scenario.requiredAnnualIncreasePctAnnualResult ??
                            scenario.requiredAnnualIncreasePct ??
                            0,
                        )}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.requiredPriceCumulativeCash',
                          'Required price today (cumulative cash >= 0)',
                        )}
                      </h3>
                      <p>
                        {formatPrice(
                          scenario.requiredPriceTodayCombinedCumulativeCash ??
                            scenario.requiredPriceTodayCombined ??
                            scenario.baselinePriceTodayCombined ??
                            0,
                        )}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.underfundingStartAnnualResult',
                          'Underfunding starts (annual result)',
                        )}
                      </h3>
                      <p>
                        {scenario.feeSufficiency.annualResult
                          .underfundingStartYear ??
                          t('v2Forecast.noUnderfunding', 'None')}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.underfundingStartCumulativeCash',
                          'Underfunding starts (cumulative cash)',
                        )}
                      </h3>
                      <p>
                        {scenario.feeSufficiency.cumulativeCash
                          .underfundingStartYear ??
                          t('v2Forecast.noUnderfunding', 'None')}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t(
                          'v2Forecast.peakCumulativeGap',
                          'Peak cumulative gap',
                        )}
                      </h3>
                      <p>
                        {formatEur(
                          scenario.feeSufficiency.cumulativeCash.peakGap,
                        )}
                      </p>
                    </div>
                    <div>
                      <h3>
                        {t('v2Forecast.totalInvestments', 'Total investments')}
                      </h3>
                      <p>
                        {formatEur(
                          scenario.investmentSeries.reduce(
                            (sum, row) => sum + row.amount,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              </section>

              {hasUnsavedChanges ? (
                <div className="v2-alert v2-alert-warning v2-stale-results-alert">
                  {t(
                    'v2Forecast.staleResultsWarning',
                    'Results are based on older inputs. Save and compute the scenario to refresh KPI values.',
                  )}
                </div>
              ) : null}

              <section className="v2-card v2-forecast-workspace">
                <div className="v2-forecast-workspace-head">
                  <div className="v2-forecast-workspace-copy">
                    <p className="v2-overview-eyebrow">
                      {t('v2Forecast.planningInputsEyebrow', 'Planning inputs')}
                    </p>
                    <h3>
                      {t(
                        'v2Forecast.planningInputsTitle',
                        'Editable planning controls',
                      )}
                    </h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.planningInputsHint',
                        'Adjust the near-term expense path, investment plan, and depreciation controls before reviewing forecast results.',
                      )}
                    </p>
                  </div>
                  <div className="v2-forecast-workspace-meta">
                    <div>
                      <span>
                        {t(
                          'v2Forecast.planningInputsEditableNow',
                          'Editable now',
                        )}
                      </span>
                      <strong>
                        {t(
                          'v2Forecast.planningInputsEditableSummary',
                          'Near-term expenses, investments, and depreciation',
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>
                        {t(
                          'v2Forecast.planningInputsLockedSource',
                          'Baseline locked',
                        )}
                      </span>
                      <strong>
                        {t(
                          'v2Forecast.planningInputsLockedSummary',
                          'VEETI-derived assumptions stay read-only',
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

              <article className="v2-subcard">
                <h3>
                  {t(
                    'v2Forecast.nearTermExpenseTitle',
                    'Near-term expense assumptions (editable)',
                  )}
                </h3>
                <p className="v2-muted">
                  {t(
                    'v2Forecast.nearTermExpenseHint',
                    'Set expected expense growth for the baseline year and next 3 years. Values are percentages (for example 3.5 means 3.5%).',
                  )}
                </p>
                {hasNearTermValidationErrors ? (
                  <p className="v2-alert v2-alert-error">
                    {t(
                      'v2Forecast.nearTermValidationSummary',
                      'Fix highlighted near-term percentage fields before saving or computing.',
                    )}
                  </p>
                ) : null}
                <div className="v2-near-term-grid">
                  {draftNearTermExpenseAssumptions.map((row) => {
                    const personnelError =
                      nearTermValidationErrors[row.year]?.personnelPct;
                    const energyError =
                      nearTermValidationErrors[row.year]?.energyPct;
                    const opexOtherError =
                      nearTermValidationErrors[row.year]?.opexOtherPct;

                    return (
                      <div key={row.year} className="v2-near-term-row">
                        <strong>{row.year}</strong>
                        <label className="v2-field">
                          <span>
                            {t('v2Forecast.nearTermPersonnel', 'Personnel %')}
                          </span>
                          <input
                            id={`near-term-personnel-${row.year}`}
                            className={`v2-input${
                              personnelError ? ' v2-input-invalid' : ''
                            }`}
                            type="text"
                            inputMode="decimal"
                            name={`nearTermPersonnelPct-${row.year}`}
                            value={nearTermInputValue(row, 'personnelPct')}
                            aria-invalid={personnelError ? true : undefined}
                            onChange={(event) =>
                              handleNearTermExpenseChange(
                                row.year,
                                'personnelPct',
                                event.target.value,
                              )
                            }
                            onBlur={() =>
                              handleNearTermExpenseBlur(
                                row.year,
                                'personnelPct',
                              )
                            }
                          />
                          {personnelError ? (
                            <small className="v2-field-error">
                              {nearTermValidationMessage(personnelError)}
                            </small>
                          ) : null}
                        </label>
                        <label className="v2-field">
                          <span>
                            {t('v2Forecast.nearTermEnergy', 'Energy %')}
                          </span>
                          <input
                            id={`near-term-energy-${row.year}`}
                            className={`v2-input${
                              energyError ? ' v2-input-invalid' : ''
                            }`}
                            type="text"
                            inputMode="decimal"
                            name={`nearTermEnergyPct-${row.year}`}
                            value={nearTermInputValue(row, 'energyPct')}
                            aria-invalid={energyError ? true : undefined}
                            onChange={(event) =>
                              handleNearTermExpenseChange(
                                row.year,
                                'energyPct',
                                event.target.value,
                              )
                            }
                            onBlur={() =>
                              handleNearTermExpenseBlur(row.year, 'energyPct')
                            }
                          />
                          {energyError ? (
                            <small className="v2-field-error">
                              {nearTermValidationMessage(energyError)}
                            </small>
                          ) : null}
                        </label>
                        <label className="v2-field">
                          <span>
                            {t('v2Forecast.nearTermOpexOther', 'Other OPEX %')}
                          </span>
                          <input
                            id={`near-term-opex-other-${row.year}`}
                            className={`v2-input${
                              opexOtherError ? ' v2-input-invalid' : ''
                            }`}
                            type="text"
                            inputMode="decimal"
                            name={`nearTermOpexOtherPct-${row.year}`}
                            value={nearTermInputValue(row, 'opexOtherPct')}
                            aria-invalid={opexOtherError ? true : undefined}
                            onChange={(event) =>
                              handleNearTermExpenseChange(
                                row.year,
                                'opexOtherPct',
                                event.target.value,
                              )
                            }
                            onBlur={() =>
                              handleNearTermExpenseBlur(
                                row.year,
                                'opexOtherPct',
                              )
                            }
                          />
                          {opexOtherError ? (
                            <small className="v2-field-error">
                              {nearTermValidationMessage(opexOtherError)}
                            </small>
                          ) : null}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </article>

              {depreciationFeatureEnabled ? (
                <section className="v2-grid v2-grid-two">
                  <article className="v2-subcard">
                    <h3>{t('projection.assumptions', 'Assumptions')}</h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.assumptionsLockedHint',
                        'Assumptions are fixed to VEETI baseline values in V2.',
                      )}
                    </p>
                    <div className="v2-assumption-grid">
                      {orderedAssumptionKeys.map((key) => (
                        <label key={key} className="v2-field">
                          <span>{assumptionLabelByKey(key)}</span>
                          <input
                            id={`assumption-${key}`}
                            className="v2-input"
                            name={`assumption-${key}`}
                            type="text"
                            value={formatAssumptionPercent(
                              draftAssumptions[key],
                            )}
                            readOnly
                            disabled
                          />
                        </label>
                      ))}
                    </div>
                  </article>

                  <article className="v2-subcard">
                    <h3>
                      {t(
                        'v2Forecast.yearlyInvestmentsEur',
                        'Yearly investments (EUR)',
                      )}
                    </h3>
                    <div className="v2-investment-workspace-toolbar">
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.investmentGuardrailHint',
                          'Investment values are normalized to non-negative whole euros (max 1,000,000,000).',
                        )}
                      </p>
                      <div className="v2-actions-row v2-investment-bulk-actions">
                        <button
                          type="button"
                          className="v2-btn"
                          onClick={handleCopyFirstInvestmentToAll}
                          disabled={busy || draftInvestments.length === 0}
                        >
                          {t(
                            'v2Forecast.investmentCopyFirstToAll',
                            'Copy first year to all',
                          )}
                        </button>
                        <button
                          type="button"
                          className="v2-btn"
                          onClick={handleClearAllInvestments}
                          disabled={busy || draftInvestments.length === 0}
                        >
                          {t('v2Forecast.investmentClearAll', 'Clear all')}
                        </button>
                      </div>
                    </div>
                    <div className="v2-kpi-strip v2-kpi-strip-three v2-investment-summary-strip">
                      <article>
                        <h3>
                          {t(
                            'v2Forecast.investmentPeakAnnualTotal',
                            'Peak annual investment total',
                          )}
                        </h3>
                        <p>{formatEur(investmentSummary.peakAnnualAmount)}</p>
                      </article>
                      <article>
                        <h3>
                          {t(
                            'v2Forecast.investmentStrongestFiveYear',
                            'Strongest rolling 5-year total',
                          )}
                        </h3>
                        <p>
                          {formatEur(investmentSummary.strongestFiveYearTotal)}
                        </p>
                        <small>
                          {investmentSummary.strongestFiveYearRange
                            ? `${investmentSummary.strongestFiveYearRange.startYear}-${investmentSummary.strongestFiveYearRange.endYear}`
                            : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
                        </small>
                      </article>
                      <article>
                        <h3>
                          {t('v2Forecast.investmentPeakYears', 'Peak years')}
                        </h3>
                        <p>
                          {investmentSummary.peakYears.length > 0
                            ? investmentSummary.peakYears.join(', ')
                            : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
                        </p>
                      </article>
                    </div>
                    <div className="v2-investment-table">
                      <div
                        className="v2-investment-row v2-investment-row-head"
                        aria-hidden="true"
                      >
                        <span>{t('common.year', 'Year')}</span>
                        <span>
                          {t(
                            'v2Forecast.yearlyInvestmentsEur',
                            'Yearly investments (EUR)',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Forecast.investmentCategoryPlaceholder',
                            'Category',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Forecast.investmentTypePlaceholder',
                            'Type',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Forecast.investmentConfidencePlaceholder',
                            'Confidence',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Forecast.investmentNotePlaceholder',
                            'Note',
                          )}
                        </span>
                      </div>
                      {draftInvestments.map((row) => (
                        <div key={row.year} className="v2-investment-row">
                          <strong className="v2-investment-year-pill">
                            {row.year}
                          </strong>
                          <input
                            id={`yearly-investment-${row.year}`}
                            className="v2-input"
                            type="number"
                            inputMode="numeric"
                            name={`yearlyInvestment-${row.year}`}
                            step="1"
                            min="0"
                            max={MAX_YEARLY_INVESTMENT_EUR}
                            value={row.amount}
                            onChange={(event) =>
                              handleInvestmentChange(
                                row.year,
                                event.target.value,
                              )
                            }
                            onBlur={() => handleInvestmentBlur(row.year)}
                            onFocus={(event) => event.currentTarget.select()}
                          />
                          <input
                            className="v2-input"
                            type="text"
                            name={`yearlyInvestmentCategory-${row.year}`}
                            placeholder={t(
                              'v2Forecast.investmentCategoryPlaceholder',
                              'Category',
                            )}
                            value={row.category ?? ''}
                            onChange={(event) =>
                              handleInvestmentMetadataChange(
                                row.year,
                                'category',
                                event.target.value,
                              )
                            }
                          />
                          <select
                            className="v2-input"
                            name={`yearlyInvestmentType-${row.year}`}
                            value={row.investmentType ?? ''}
                            onChange={(event) =>
                              handleInvestmentMetadataChange(
                                row.year,
                                'investmentType',
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              {t(
                                'v2Forecast.investmentTypePlaceholder',
                                'Type',
                              )}
                            </option>
                            <option value="replacement">
                              {t(
                                'v2Forecast.investmentTypeReplacement',
                                'Replacement',
                              )}
                            </option>
                            <option value="new">
                              {t('v2Forecast.investmentTypeNew', 'New')}
                            </option>
                          </select>
                          <select
                            className="v2-input"
                            name={`yearlyInvestmentConfidence-${row.year}`}
                            value={row.confidence ?? ''}
                            onChange={(event) =>
                              handleInvestmentMetadataChange(
                                row.year,
                                'confidence',
                                event.target.value,
                              )
                            }
                          >
                            <option value="">
                              {t(
                                'v2Forecast.investmentConfidencePlaceholder',
                                'Confidence',
                              )}
                            </option>
                            <option value="low">
                              {t('v2Forecast.investmentConfidenceLow', 'Low')}
                            </option>
                            <option value="medium">
                              {t(
                                'v2Forecast.investmentConfidenceMedium',
                                'Medium',
                              )}
                            </option>
                            <option value="high">
                              {t('v2Forecast.investmentConfidenceHigh', 'High')}
                            </option>
                          </select>
                          <input
                            className="v2-input"
                            type="text"
                            name={`yearlyInvestmentNote-${row.year}`}
                            placeholder={t(
                              'v2Forecast.investmentNotePlaceholder',
                              'Note',
                            )}
                            value={row.note ?? ''}
                            onChange={(event) =>
                              handleInvestmentMetadataChange(
                                row.year,
                                'note',
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              ) : null}

              <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.depreciationRulesTitle',
                      'Depreciation rules by class',
                    )}
                  </h3>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.depreciationRulesHint',
                      'Define class-level method: linear years, residual percent, or none.',
                    )}
                  </p>
                  {loadingDepreciation ? (
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.depreciationRulesLoading',
                        'Loading depreciation rules...',
                      )}
                    </p>
                  ) : null}
                  <div className="v2-depreciation-rule-list">
                    {depreciationRuleDrafts.length === 0 ? (
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.depreciationRulesEmpty',
                          'No depreciation rules yet. Add your first class rule.',
                        )}
                      </p>
                    ) : null}
                    {depreciationRuleDrafts.map((row, index) => (
                      <div
                        key={row.id ?? `new-rule-${index}`}
                        className="v2-depreciation-rule-row"
                      >
                        <label className="v2-field">
                          <span>{t('v2Forecast.classKey', 'Class key')}</span>
                          <input
                            className="v2-input"
                            type="text"
                            value={row.assetClassKey}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'assetClassKey',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="v2-field">
                          <span>{t('v2Forecast.className', 'Class name')}</span>
                          <input
                            className="v2-input"
                            type="text"
                            value={row.assetClassName}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'assetClassName',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="v2-field">
                          <span>{t('v2Forecast.method', 'Method')}</span>
                          <select
                            className="v2-input"
                            value={row.method}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'method',
                                event.target.value,
                              )
                            }
                          >
                            <option value="linear">
                              {t('v2Forecast.methodLinear', 'Linear')}
                            </option>
                            <option value="residual">
                              {t('v2Forecast.methodResidual', 'Residual %')}
                            </option>
                            <option value="none">
                              {t('v2Forecast.methodNone', 'None')}
                            </option>
                          </select>
                        </label>
                        <label className="v2-field">
                          <span>
                            {t(
                              'v2Forecast.linearYearsLabel',
                              'Linear years (if linear)',
                            )}
                          </span>
                          <input
                            className="v2-input"
                            type="number"
                            min="1"
                            max="120"
                            value={row.linearYears}
                            disabled={row.method !== 'linear'}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'linearYears',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="v2-field">
                          <span>
                            {t(
                              'v2Forecast.residualPercentLabel',
                              'Residual % (if residual)',
                            )}
                          </span>
                          <input
                            className="v2-input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={row.residualPercent}
                            disabled={row.method !== 'residual'}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'residualPercent',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <div className="v2-actions-row">
                          <button
                            type="button"
                            className="v2-btn"
                            disabled={busy}
                            onClick={() => saveDepreciationRuleDraft(index)}
                          >
                            {t('common.save', 'Save')}
                          </button>
                          <button
                            type="button"
                            className="v2-btn v2-btn-danger"
                            disabled={busy}
                            onClick={() => deleteDepreciationRuleDraft(index)}
                          >
                            {t('common.delete', 'Delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="v2-actions-row">
                    <button
                      type="button"
                      className="v2-btn"
                      disabled={busy}
                      onClick={handleAddDepreciationRuleDraft}
                    >
                      {t(
                        'v2Forecast.addDepreciationRule',
                        'Add depreciation class rule',
                      )}
                    </button>
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.classAllocationTitle',
                      'Per-year investment class allocation (%)',
                    )}
                  </h3>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.classAllocationHint',
                      'Allocate yearly investment percentages to depreciation classes. Remaining share falls back to legacy depreciation settings.',
                    )}
                  </p>
                  {depreciationClassKeys.length === 0 ? (
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.classAllocationNoRules',
                        'Create at least one depreciation class rule to allocate investments by class.',
                      )}
                    </p>
                  ) : (
                    <div className="v2-class-allocation-table">
                      {draftInvestments.map((row) => (
                        <div
                          key={`allocation-${row.year}`}
                          className="v2-class-allocation-row"
                        >
                          <strong>{row.year}</strong>
                          {depreciationClassKeys.map((classKey) => (
                            <label
                              className="v2-field"
                              key={`${row.year}-${classKey}`}
                            >
                              <span>{classKey}</span>
                              <input
                                className="v2-input"
                                type="text"
                                inputMode="decimal"
                                value={
                                  classAllocationDraftByYear[row.year]?.[
                                    classKey
                                  ] ?? ''
                                }
                                onChange={(event) =>
                                  handleAllocationDraftChange(
                                    row.year,
                                    classKey,
                                    event.target.value,
                                  )
                                }
                              />
                            </label>
                          ))}
                          <span
                            className={`v2-class-allocation-total ${
                              allocationTotalByYear[row.year] > 100
                                ? 'warn'
                                : 'ok'
                            }`}
                          >
                            {t('v2Forecast.allocationTotal', 'Total')}:&nbsp;
                            {formatNumber(
                              allocationTotalByYear[row.year] ?? 0,
                              2,
                            )}
                            %
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="v2-actions-row">
                    <button
                      type="button"
                      className="v2-btn"
                      disabled={busy || !selectedScenarioId}
                      onClick={saveClassAllocations}
                    >
                      {t('v2Forecast.saveClassAllocations', 'Save allocations')}
                    </button>
                  </div>
                </article>
              </section>

              </section>

              <section className="v2-card v2-forecast-workspace">
                <div className="v2-forecast-workspace-head">
                  <div className="v2-forecast-workspace-copy">
                    <p className="v2-overview-eyebrow">
                      {t('v2Forecast.outputsEyebrow', 'Outcome review')}
                    </p>
                    <h3>
                      {t(
                        'v2Forecast.outputsTitle',
                        'Funding pressure and result views',
                      )}
                    </h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.outputsHint',
                        'Use the comparison, tariff path, and cumulative cash views to judge when the current plan runs out of room.',
                      )}
                    </p>
                  </div>
                </div>

                <section className="v2-grid v2-grid-two">
                  <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.baseVsStressTitle',
                      'Base vs stress comparison',
                    )}
                  </h3>
                  {loadingComparisonScenario ? (
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.loadingBaseComparison',
                        'Loading base scenario comparison...',
                      )}
                    </p>
                  ) : null}
                  {!loadingComparisonScenario &&
                  scenario.onOletus ? (
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.baseComparisonBaseSelected',
                        'This is the base scenario. Open a stress scenario to compare the fee and cash outcomes.',
                      )}
                    </p>
                  ) : null}
                  {!loadingComparisonScenario &&
                  !scenario.onOletus &&
                  comparisonScenario ? (
                    <div className="v2-risk-comparison-table">
                      <div className="v2-risk-comparison-row v2-risk-comparison-head">
                        <span>{t('v2Forecast.metric', 'Metric')}</span>
                        <span>{comparisonScenario.name}</span>
                        <span>{scenario.name}</span>
                      </div>
                      <div className="v2-risk-comparison-row">
                        <span>
                          {t(
                            'v2Forecast.requiredPriceCompare',
                            'Required price today',
                          )}
                        </span>
                        <strong>
                          {formatPrice(
                            feeMetricValue(comparisonScenario, 'requiredPrice') ??
                              0,
                          )}
                        </strong>
                        <strong>
                          {formatPrice(feeMetricValue(scenario, 'requiredPrice') ?? 0)}
                        </strong>
                      </div>
                      <div className="v2-risk-comparison-row">
                        <span>
                          {t(
                            'v2Forecast.requiredIncreaseCompare',
                            'Required annual increase',
                          )}
                        </span>
                        <strong>
                          {formatPercent(
                            feeMetricValue(comparisonScenario, 'requiredIncrease') ??
                              0,
                          )}
                        </strong>
                        <strong>
                          {formatPercent(
                            feeMetricValue(scenario, 'requiredIncrease') ?? 0,
                          )}
                        </strong>
                      </div>
                      <div className="v2-risk-comparison-row">
                        <span>
                          {t(
                            'v2Forecast.annualUnderfundingCompare',
                            'Underfunding start (annual result)',
                          )}
                        </span>
                        <strong>
                          {feeMetricValue(
                            comparisonScenario,
                            'underfundingAnnual',
                          ) ?? t('v2Forecast.noUnderfunding', 'None')}
                        </strong>
                        <strong>
                          {feeMetricValue(scenario, 'underfundingAnnual') ??
                            t('v2Forecast.noUnderfunding', 'None')}
                        </strong>
                      </div>
                      <div className="v2-risk-comparison-row">
                        <span>
                          {t(
                            'v2Forecast.cashUnderfundingCompare',
                            'Underfunding start (cumulative cash)',
                          )}
                        </span>
                        <strong>
                          {feeMetricValue(comparisonScenario, 'underfundingCash') ??
                            t('v2Forecast.noUnderfunding', 'None')}
                        </strong>
                        <strong>
                          {feeMetricValue(scenario, 'underfundingCash') ??
                            t('v2Forecast.noUnderfunding', 'None')}
                        </strong>
                      </div>
                      <div className="v2-risk-comparison-row">
                        <span>
                          {t(
                            'v2Forecast.peakGapCompare',
                            'Peak cumulative gap',
                          )}
                        </span>
                        <strong>
                          {formatEur(
                            feeMetricValue(comparisonScenario, 'peakGap') ?? 0,
                          )}
                        </strong>
                        <strong>
                          {formatEur(feeMetricValue(scenario, 'peakGap') ?? 0)}
                        </strong>
                      </div>
                    </div>
                  ) : null}
                  </article>

                  <article className="v2-subcard">
                    <h3>
                      {t('v2Forecast.riskSummaryTitle', 'Risk summary')}
                    </h3>
                    <p className="v2-muted">
                      {riskComparisonSummary ??
                        t(
                          'v2Forecast.riskSummaryPending',
                          'Create or open a stress scenario to see a short explanation of how the funding pressure changes versus the base case.',
                        )}
                    </p>
                  </article>
                </section>

                <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>{t('v2Forecast.pricePath', 'Price path')}</h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.priceSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="combinedPrice"
                          name={t(
                            'projection.v2.kpiCombinedWeighted',
                            'Combined price',
                          )}
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="waterPrice"
                          name={t('revenue.water.title', 'Water')}
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="wastewaterPrice"
                          name={t('revenue.wastewater.title', 'Wastewater')}
                          stroke="#b45309"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.cashflowAndCumulative',
                      'Cashflow and cumulative cash',
                    )}
                  </h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.cashflowSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="cashflow"
                          name={t('projection.summary.cashflow', 'Cashflow')}
                          fill="#0891b2"
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeCashflow"
                          name={t(
                            'projection.summary.accumulatedCash',
                            'Accumulated cash',
                          )}
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>
                </section>
              </section>
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
};
