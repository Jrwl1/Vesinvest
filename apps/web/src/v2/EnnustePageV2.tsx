import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  createScenarioDepreciationRuleV2,
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteScenarioDepreciationRuleV2,
  deleteForecastScenarioV2,
  getScenarioClassAllocationsV2,
  getForecastScenarioV2,
  getPlanningContextV2,
  listScenarioDepreciationRulesV2,
  listForecastScenariosV2,
  updateScenarioDepreciationRuleV2,
  updateScenarioClassAllocationsV2,
  updateForecastScenarioV2,
  type V2DepreciationRule,
  type V2PlanningContextResponse,
  type V2ForecastScenario,
  type V2ForecastScenarioListItem,
  type V2OverrideProvenance,
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
  initialScenarioId?: string | null;
  computedFromUpdatedAtByScenario?: Record<string, string>;
  onScenarioSelectionChange?: (scenarioId: string | null) => void;
  onComputedVersionChange?: (
    scenarioId: string,
    computedFromUpdatedAt: string | null,
  ) => void;
};

const EMPTY_COMPUTED_VERSION_MAP: Record<string, string> = {};

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
  impactKey: string;
  impact: string;
};

const RISK_PRESETS: RiskPresetDefinition[] = [
  {
    id: 'lower_volume',
    titleKey: 'v2Forecast.riskPresetLowerVolume',
    title: 'Lower volume',
    descriptionKey: 'v2Forecast.riskPresetLowerVolumeHint',
    description: 'Adds a stronger volume decline to the current scenario.',
    impactKey: 'v2Forecast.riskImpactVolume',
    impact: 'Volume',
  },
  {
    id: 'higher_opex',
    titleKey: 'v2Forecast.riskPresetHigherOpex',
    title: 'Higher opex',
    descriptionKey: 'v2Forecast.riskPresetHigherOpexHint',
    description: 'Raises non-energy operating cost growth in the near term and thereafter.',
    impactKey: 'v2Forecast.riskImpactOpex',
    impact: 'OPEX',
  },
  {
    id: 'higher_energy',
    titleKey: 'v2Forecast.riskPresetHigherEnergy',
    title: 'Higher energy',
    descriptionKey: 'v2Forecast.riskPresetHigherEnergyHint',
    description: 'Raises energy cost growth in the near term and thereafter.',
    impactKey: 'v2Forecast.riskImpactEnergy',
    impact: 'Energy',
  },
  {
    id: 'higher_capex',
    titleKey: 'v2Forecast.riskPresetHigherCapex',
    title: 'Higher capex',
    descriptionKey: 'v2Forecast.riskPresetHigherCapexHint',
    description: 'Increases yearly investments and long-run investment growth.',
    impactKey: 'v2Forecast.riskImpactCapex',
    impact: 'CAPEX',
  },
  {
    id: 'delayed_fee_increase',
    titleKey: 'v2Forecast.riskPresetDelayedFeeIncrease',
    title: 'Delayed fee increase',
    descriptionKey: 'v2Forecast.riskPresetDelayedFeeIncreaseHint',
    description: 'Freezes automatic price growth so tariff action is delayed.',
    impactKey: 'v2Forecast.riskImpactTariffs',
    impact: 'Tariffs',
  },
  {
    id: 'financing_pressure',
    titleKey: 'v2Forecast.riskPresetFinancingPressure',
    title: 'Financing pressure',
    descriptionKey: 'v2Forecast.riskPresetFinancingPressureHint',
    description: 'Combines delayed fee reaction with higher capex and lower volume.',
    impactKey: 'v2Forecast.riskImpactCombined',
    impact: 'Combined',
  },
];

const INVESTMENT_PROGRAM_GROUP_OPTION_DEFS = [
  {
    key: 'v2Forecast.investmentProgramGroupJointNewNetwork',
    fallback: 'New network together with the technical department',
  },
  {
    key: 'v2Forecast.investmentProgramGroupJointRehabNetwork',
    fallback: 'Rehabilitation of the current network together with the technical department',
  },
  {
    key: 'v2Forecast.investmentProgramGroupPlannedNewBuild',
    fallback: 'Planned projects, new build',
  },
  {
    key: 'v2Forecast.investmentProgramGroupPlannedRehab',
    fallback: 'Planned projects, rehabilitation',
  },
  {
    key: 'v2Forecast.investmentProgramGroupOwnNewNetwork',
    fallback: 'New network, own projects',
  },
  {
    key: 'v2Forecast.investmentProgramGroupOwnRehabNetwork',
    fallback: 'Rehabilitation of the current network, own projects',
  },
  {
    key: 'v2Forecast.investmentProgramGroupPlantInvestments',
    fallback: 'Waterworks investments',
  },
  {
    key: 'v2Forecast.investmentProgramGroupOtherUtilityInvestments',
    fallback: 'Other water-service investments',
  },
] as const;

const normalizeInvestmentMappingLabel = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const toPercentPoints = (value: number | null | undefined): number => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.abs(value) <= 1 ? value * 100 : value;
};
const formatSignedEur = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatEur(Math.abs(value))}`;
const parseAssumptionPercentInput = (rawValue: string): number => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return round4(parsed / 100);
};
const MAX_YEARLY_INVESTMENT_EUR = 1_000_000_000;

const clampYearlyInvestment = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_YEARLY_INVESTMENT_EUR, Math.max(0, Math.round(value)));
};

const resolveInvestmentProgramTotal = (
  row: Pick<V2YearlyInvestmentPlanRow, 'amount' | 'waterAmount' | 'wastewaterAmount'>,
): number => {
  if (row.waterAmount == null && row.wastewaterAmount == null) {
    return clampYearlyInvestment(row.amount);
  }
  return clampYearlyInvestment((row.waterAmount ?? 0) + (row.wastewaterAmount ?? 0));
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
    if ((left.target ?? '') !== (right.target ?? '')) return false;
    if ((left.category ?? '') !== (right.category ?? '')) return false;
    if ((left.investmentType ?? '') !== (right.investmentType ?? ''))
      return false;
    if ((left.confidence ?? '') !== (right.confidence ?? '')) return false;
    if (round4(left.waterAmount ?? -1) !== round4(right.waterAmount ?? -1))
      return false;
    if (round4(left.wastewaterAmount ?? -1) !== round4(right.wastewaterAmount ?? -1))
      return false;
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

type ForecastOperationState =
  | 'idle'
  | 'creating'
  | 'saving'
  | 'computing'
  | 'deleting';

type ForecastFreshnessState =
  | 'unsaved_changes'
  | 'saved_needs_recompute'
  | 'computing'
  | 'current';

type ForecastWorkbench =
  | 'cockpit'
  | 'revenue'
  | 'materials'
  | 'personnel'
  | 'depreciation'
  | 'otherOpex';

type ReportReadinessReason =
  | 'missingScenario'
  | 'unsavedChanges'
  | 'missingComputeResults'
  | 'missingComputeToken'
  | 'depreciationMappingIncomplete'
  | 'staleComputeToken';

type DepreciationRuleDraft = {
  id?: string;
  assetClassKey: string;
  assetClassName: string;
  method:
    | 'linear'
    | 'residual'
    | 'straight-line'
    | 'custom-annual-schedule'
    | 'none';
  linearYears: string;
  residualPercent: string;
  annualSchedule: string;
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
  annualSchedule:
    Array.isArray(rule.annualSchedule) && rule.annualSchedule.length > 0
      ? rule.annualSchedule.join(', ')
      : '',
});

const REVENUE_ASSUMPTION_KEYS = [
  'vesimaaran_muutos',
  'hintakorotus',
] as const;

const OPEX_WORKBENCH_FIELDS = {
  materials: 'energyPct',
  personnel: 'personnelPct',
  otherOpex: 'opexOtherPct',
} as const satisfies Record<string, NearTermField>;

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

const resolveSingleMappedDepreciationClass = (
  source: ClassAllocationDraftByYear,
  classKeys: string[],
  year: number,
): string | null => {
  const positiveEntries = classKeys
    .map((classKey) => {
      const rawValue = source[year]?.[classKey] ?? '';
      const parsed = Number(rawValue.trim().replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      return { classKey, sharePct: parsed };
    })
    .filter(
      (
        entry,
      ): entry is { classKey: string; sharePct: number } => entry !== null,
    );

  if (positiveEntries.length !== 1) return null;
  return Math.abs((positiveEntries[0]?.sharePct ?? 0) - 100) < 0.01
    ? positiveEntries[0]?.classKey ?? null
    : null;
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

const deriveForecastFreshnessState = ({
  scenario,
  hasUnsavedChanges,
  computedFromUpdatedAt,
  isComputing,
}: {
  scenario: V2ForecastScenario | null;
  hasUnsavedChanges: boolean;
  computedFromUpdatedAt: string | null;
  isComputing: boolean;
}): ForecastFreshnessState => {
  if (isComputing) return 'computing';
  if (!scenario) return 'saved_needs_recompute';
  if (hasUnsavedChanges) return 'unsaved_changes';
  if (
    scenario.years.length === 0 ||
    !computedFromUpdatedAt ||
    computedFromUpdatedAt !== scenario.updatedAt
  ) {
    return 'saved_needs_recompute';
  }
  return 'current';
};

const mergeSavedScenarioPreservingComputedOutputs = (
  previous: V2ForecastScenario,
  updated: V2ForecastScenario,
): V2ForecastScenario => ({
  ...updated,
  requiredPriceTodayCombined: previous.requiredPriceTodayCombined,
  baselinePriceTodayCombined: previous.baselinePriceTodayCombined,
  requiredAnnualIncreasePct: previous.requiredAnnualIncreasePct,
  requiredPriceTodayCombinedAnnualResult:
    previous.requiredPriceTodayCombinedAnnualResult,
  requiredAnnualIncreasePctAnnualResult:
    previous.requiredAnnualIncreasePctAnnualResult,
  requiredPriceTodayCombinedCumulativeCash:
    previous.requiredPriceTodayCombinedCumulativeCash,
  requiredAnnualIncreasePctCumulativeCash:
    previous.requiredAnnualIncreasePctCumulativeCash,
  feeSufficiency: {
    baselineCombinedPrice: previous.feeSufficiency.baselineCombinedPrice,
    annualResult: { ...previous.feeSufficiency.annualResult },
    cumulativeCash: { ...previous.feeSufficiency.cumulativeCash },
  },
  years: previous.years.map((item) => ({ ...item })),
  priceSeries: previous.priceSeries.map((item) => ({ ...item })),
  investmentSeries: previous.investmentSeries.map((item) => ({ ...item })),
  cashflowSeries: previous.cashflowSeries.map((item) => ({ ...item })),
});

export const EnnustePageV2: React.FC<Props> = ({
  onReportCreated,
  initialScenarioId = null,
  computedFromUpdatedAtByScenario = EMPTY_COMPUTED_VERSION_MAP,
  onScenarioSelectionChange,
  onComputedVersionChange,
}) => {
  const { t } = useTranslation();
  const depreciationFeatureEnabled =
    import.meta.env.VITE_V2_DEPRECIATION_RULES_ENABLED !== 'false';
  const [scenarios, setScenarios] = React.useState<
    V2ForecastScenarioListItem[]
  >([]);
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<
    string | null
  >(initialScenarioId);
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
  const [savedDepreciationRuleDrafts, setSavedDepreciationRuleDrafts] =
    React.useState<DepreciationRuleDraft[]>([]);
  const [classAllocationDraftByYear, setClassAllocationDraftByYear] =
    React.useState<ClassAllocationDraftByYear>({});
  const [savedClassAllocationDraftByYear, setSavedClassAllocationDraftByYear] =
    React.useState<ClassAllocationDraftByYear>({});
  const [loadingDepreciation, setLoadingDepreciation] = React.useState(false);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingScenario, setLoadingScenario] = React.useState(false);
  const [activeOperation, setActiveOperation] =
    React.useState<ForecastOperationState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [computedFromUpdatedAt, setComputedFromUpdatedAt] = React.useState<
    string | null
  >(
    initialScenarioId
      ? computedFromUpdatedAtByScenario[initialScenarioId] ?? null
      : null,
  );
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [planningContextLoaded, setPlanningContextLoaded] =
    React.useState(false);
  const [comparisonScenario, setComparisonScenario] =
    React.useState<V2ForecastScenario | null>(null);
  const [loadingComparisonScenario, setLoadingComparisonScenario] =
    React.useState(false);
  const [activeWorkbench, setActiveWorkbench] =
    React.useState<ForecastWorkbench>('cockpit');
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
      setSavedDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setSavedClassAllocationDraftByYear({});
      setComputedFromUpdatedAt(null);
      try {
        const data = await getForecastScenarioV2(scenarioId);
        if (loadSeq !== scenarioLoadSeqRef.current) return;
        const restoredComputedFromUpdatedAt =
          computedFromUpdatedAtByScenario[scenarioId] ?? null;
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
        setComputedFromUpdatedAt(
          restoredComputedFromUpdatedAt === data.updatedAt
            ? restoredComputedFromUpdatedAt
            : null,
        );

        if (depreciationFeatureEnabled) {
          setLoadingDepreciation(true);
          try {
            const [rules, allocationPayload] = await Promise.all([
              listScenarioDepreciationRulesV2(scenarioId),
              getScenarioClassAllocationsV2(scenarioId),
            ]);
            if (loadSeq !== scenarioLoadSeqRef.current) return;
            const nextRuleDrafts = rules.map(toDepreciationRuleDraft);
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
    [computedFromUpdatedAtByScenario, depreciationFeatureEnabled, t],
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
  const firstBaselineYear = React.useMemo(() => {
    if (!planningContext?.baselineYears?.length) return null;
    return planningContext.baselineYears.reduce((latest, year) =>
      year.year > latest.year ? year : latest,
    );
  }, [planningContext?.baselineYears]);

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
      setSavedDepreciationRuleDrafts([]);
      setClassAllocationDraftByYear({});
      setSavedClassAllocationDraftByYear({});
      setComparisonScenario(null);
      setLoadingComparisonScenario(false);
      setComputedFromUpdatedAt(null);
      setActiveWorkbench('cockpit');
      setDenseAnalystMode(false);
      return;
    }
    setActiveWorkbench('cockpit');
    setDenseAnalystMode(false);
    loadScenario(selectedScenarioId);
  }, [selectedScenarioId, loadScenario]);

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

  const revenueAssumptionsChanged = React.useMemo(() => {
    if (!scenario) return false;
    return REVENUE_ASSUMPTION_KEYS.some((key) => {
      const draftValue = round4(draftAssumptions[key] ?? 0);
      const scenarioValue = round4(scenario.assumptions[key] ?? 0);
      return draftValue !== scenarioValue;
    });
  }, [draftAssumptions, scenario]);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!scenario) return false;
    if (draftName.trim() !== scenario.name) return true;
    if (revenueAssumptionsChanged) return true;
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
  }, [
    scenario,
    draftName,
    revenueAssumptionsChanged,
    draftInvestments,
    draftNearTermExpenseAssumptions,
  ]);

  const busy = activeOperation !== 'idle';
  const isComputing = activeOperation === 'computing';

  const forecastFreshnessState = React.useMemo(
    () =>
      deriveForecastFreshnessState({
        scenario,
        hasUnsavedChanges,
        computedFromUpdatedAt,
        isComputing,
      }),
    [scenario, hasUnsavedChanges, computedFromUpdatedAt, isComputing],
  );

  const savedDepreciationClassKeys = React.useMemo(
    () =>
      savedDepreciationRuleDrafts
        .map((rule) => rule.assetClassKey.trim())
        .filter((key): key is string => key.length > 0),
    [savedDepreciationRuleDrafts],
  );

  const savedMappedDepreciationClassByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => [
          item.year,
          resolveSingleMappedDepreciationClass(
            savedClassAllocationDraftByYear,
            savedDepreciationClassKeys,
            item.year,
          ),
        ]),
      ) as Record<number, string | null>,
    [draftInvestments, savedClassAllocationDraftByYear, savedDepreciationClassKeys],
  );

  const unmappedInvestmentYears = React.useMemo(
    () =>
      draftInvestments
        .filter(
          (row) =>
            row.amount > 0 &&
            !savedMappedDepreciationClassByYear[row.year],
        )
        .map((row) => row.year),
    [draftInvestments, savedMappedDepreciationClassByYear],
  );
  const plannedInvestmentYears = React.useMemo(
    () =>
      draftInvestments
        .filter((row) => row.amount > 0)
        .map((row) => row.year),
    [draftInvestments],
  );
  const savedMappedInvestmentYearsCount = React.useMemo(
    () =>
      plannedInvestmentYears.filter(
        (year) => savedMappedDepreciationClassByYear[year] != null,
      ).length,
    [plannedInvestmentYears, savedMappedDepreciationClassByYear],
  );

  const hasIncompleteDepreciationMapping = React.useMemo(
    () => depreciationFeatureEnabled && unmappedInvestmentYears.length > 0,
    [depreciationFeatureEnabled, unmappedInvestmentYears],
  );

  const reportReadinessReason = React.useMemo(() => {
    if (!scenario) return 'missingScenario' satisfies ReportReadinessReason;
    if (forecastFreshnessState === 'computing')
      return 'missingComputeResults' satisfies ReportReadinessReason;
    if (forecastFreshnessState === 'unsaved_changes')
      return 'unsavedChanges' satisfies ReportReadinessReason;
    if (forecastFreshnessState === 'saved_needs_recompute') {
      if (scenario.years.length === 0)
        return 'missingComputeResults' satisfies ReportReadinessReason;
      if (!computedFromUpdatedAt)
        return 'missingComputeToken' satisfies ReportReadinessReason;
      return 'staleComputeToken' satisfies ReportReadinessReason;
    }
    if (hasIncompleteDepreciationMapping) {
      return 'depreciationMappingIncomplete' satisfies ReportReadinessReason;
    }
    return null;
  }, [
    scenario,
    forecastFreshnessState,
    computedFromUpdatedAt,
    hasIncompleteDepreciationMapping,
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
      case 'missingComputeToken':
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
    () =>
      canCreateReport
        ? t('v2Forecast.reportReady')
        : t('v2Forecast.reportBlocked'),
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

  const computedVersionLabel = React.useMemo(
    () =>
      computedFromUpdatedAt
        ? formatScenarioUpdatedAt(computedFromUpdatedAt)
        : t('v2Forecast.reportStateMissing'),
    [computedFromUpdatedAt, t],
  );

  const forecastStateToneClass = React.useMemo(() => {
    switch (forecastFreshnessState) {
      case 'current':
        return 'v2-status-positive';
      case 'computing':
        return 'v2-status-info';
      case 'unsaved_changes':
      case 'saved_needs_recompute':
      default:
        return 'v2-status-warning';
    }
  }, [forecastFreshnessState]);

  const forecastStateLabel = React.useMemo(() => {
    switch (forecastFreshnessState) {
      case 'current':
        return t('v2Forecast.stateCurrent');
      case 'computing':
        return t('v2Forecast.stateComputing');
      case 'unsaved_changes':
        return t('v2Forecast.stateUnsaved');
      case 'saved_needs_recompute':
      default:
        return t('v2Forecast.stateNeedsRecompute');
    }
  }, [forecastFreshnessState, t]);

  const computeButtonLabel = React.useMemo(() => {
    switch (forecastFreshnessState) {
      case 'unsaved_changes':
        return t(
          'v2Forecast.computeActionSaveAndRecompute',
          'Save and compute results',
        );
      case 'computing':
        return t('v2Forecast.computeActionComputing', 'Computing results...');
      case 'saved_needs_recompute':
      case 'current':
      default:
        return t('v2Forecast.computeActionRecompute', 'Recompute results');
    }
  }, [forecastFreshnessState, t]);

  const nextForecastActionLabel = React.useMemo(
    () =>
      canCreateReport
        ? t('v2Forecast.createReport', 'Create report')
        : computeButtonLabel,
    [canCreateReport, computeButtonLabel, t],
  );

  const forecastSurfaceToneClass = React.useMemo(() => {
    switch (forecastFreshnessState) {
      case 'current':
        return 'v2-surface-current';
      case 'computing':
        return 'v2-surface-computing';
      case 'unsaved_changes':
      case 'saved_needs_recompute':
      default:
        return 'v2-surface-stale';
    }
  }, [forecastFreshnessState]);

  const showInlineFreshnessState = forecastFreshnessState === 'current';

  const latestPricePoint = React.useMemo(() => {
    if (!scenario || scenario.priceSeries.length === 0) return null;
    return scenario.priceSeries[scenario.priceSeries.length - 1] ?? null;
  }, [scenario]);

  const latestCashflowPoint = React.useMemo(() => {
    if (!scenario || scenario.cashflowSeries.length === 0) return null;
    return scenario.cashflowSeries[scenario.cashflowSeries.length - 1] ?? null;
  }, [scenario]);

  const lowestCumulativeCashPoint = React.useMemo(() => {
    if (!scenario || scenario.cashflowSeries.length === 0) return null;
    return scenario.cashflowSeries.reduce((lowest, row) =>
      row.cumulativeCashflow < lowest.cumulativeCashflow ? row : lowest,
    );
  }, [scenario]);

  const resolvePrimaryFeeSignal = React.useCallback(
    (value: V2ForecastScenario | null | undefined) => {
      const cumulativeCash = value?.feeSufficiency.cumulativeCash;
      const prioritizeCumulativeCash = Boolean(
        cumulativeCash &&
          (cumulativeCash.underfundingStartYear != null ||
            cumulativeCash.peakGap > 0),
      );

      return {
        priceLabel: prioritizeCumulativeCash
          ? t(
              'v2Forecast.requiredPriceCumulativeCash',
              'Required price today (cumulative cash >= 0)',
            )
          : t(
              'v2Forecast.requiredPriceAnnualResult',
              'Required price today (annual result = 0)',
            ),
        price: prioritizeCumulativeCash
          ? value?.requiredPriceTodayCombinedCumulativeCash ??
            value?.requiredPriceTodayCombined ??
            value?.baselinePriceTodayCombined ??
            0
          : value?.requiredPriceTodayCombinedAnnualResult ??
            value?.requiredPriceTodayCombined ??
            value?.baselinePriceTodayCombined ??
            0,
        increaseLabel: prioritizeCumulativeCash
          ? t(
              'v2Forecast.requiredIncreaseCumulativeCash',
              'Required increase vs comparator (cumulative cash)',
            )
          : t(
              'v2Forecast.requiredIncreaseAnnualResult',
              'Required increase vs comparator (annual result)',
            ),
        increase: prioritizeCumulativeCash
          ? value?.requiredAnnualIncreasePctCumulativeCash ??
            value?.requiredAnnualIncreasePct ??
            0
          : value?.requiredAnnualIncreasePctAnnualResult ??
            value?.requiredAnnualIncreasePct ??
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

  const handleRevenueAssumptionChange = React.useCallback(
    (key: (typeof REVENUE_ASSUMPTION_KEYS)[number], rawValue: string) => {
      setDraftAssumptions((prev) => ({
        ...prev,
        [key]: parseAssumptionPercentInput(rawValue),
      }));
    },
    [parseAssumptionPercentInput],
  );

  const saveDrafts =
    React.useCallback(async (): Promise<V2ForecastScenario | null> => {
      if (!scenario || !selectedScenarioId) return null;
      if (!hasUnsavedChanges) return scenario;

      const scenarioAssumptions = revenueAssumptionsChanged
        ? Object.fromEntries(
            REVENUE_ASSUMPTION_KEYS.map((key) => [key, draftAssumptions[key] ?? 0]),
          )
        : undefined;

      const payload = {
        name: draftName.trim() || scenario.name,
        yearlyInvestments: draftInvestments,
        scenarioAssumptions,
        nearTermExpenseAssumptions: draftNearTermExpenseAssumptions,
      };
      const updated = await updateForecastScenarioV2(
        selectedScenarioId,
        payload,
      );
      const nextScenario = mergeSavedScenarioPreservingComputedOutputs(
        scenario,
        updated,
      );
      setScenario(nextScenario);
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
      onComputedVersionChange?.(selectedScenarioId, null);
      updateScenarioSummary(nextScenario);
      return nextScenario;
    }, [
      scenario,
      selectedScenarioId,
      hasUnsavedChanges,
      draftName,
      draftAssumptions,
      revenueAssumptionsChanged,
      draftInvestments,
      draftNearTermExpenseAssumptions,
      onComputedVersionChange,
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
  const nearTermInvestmentRows = React.useMemo(
    () => draftInvestments.slice(0, 5),
    [draftInvestments],
  );
  const longRangeInvestmentGroups = React.useMemo(() => {
    const groups: Array<{
      id: string;
      startYear: number;
      endYear: number;
      rows: Array<(typeof draftInvestments)[number]>;
      total: number;
      peakAmount: number;
      peakYears: number[];
    }> = [];
    const remainingRows = draftInvestments.slice(5);

    for (let index = 0; index < remainingRows.length; index += 5) {
      const rows = remainingRows.slice(index, index + 5);
      if (rows.length === 0) continue;
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      const peakAmount = rows.reduce(
        (current, row) => Math.max(current, row.amount),
        0,
      );
      groups.push({
        id: `${rows[0]!.year}-${rows[rows.length - 1]!.year}`,
        startYear: rows[0]!.year,
        endYear: rows[rows.length - 1]!.year,
        rows,
        total,
        peakAmount,
        peakYears:
          peakAmount > 0
            ? rows
                .filter((row) => round4(row.amount) === round4(peakAmount))
                .map((row) => row.year)
            : [],
      });
    }

    return groups;
  }, [draftInvestments]);
  const investmentProgramGroupOptions = React.useMemo(
    () =>
      INVESTMENT_PROGRAM_GROUP_OPTION_DEFS.map((item) =>
        t(item.key, item.fallback),
      ),
    [t],
  );
  const suggestedDepreciationClassKeyByInvestmentGroup = React.useMemo(() => {
    const entries: Array<[string, string]> = [
      ['network', 'water_network_post_1999'],
      ['plant', 'plant_machinery'],
      ['meters', 'it_equipment'],
    ];
    const networkOptionIndexes = [0, 1, 2, 3, 4, 5];
    for (const index of networkOptionIndexes) {
      const label = investmentProgramGroupOptions[index];
      if (!label) continue;
      entries.push([
        normalizeInvestmentMappingLabel(label),
        'water_network_post_1999',
      ]);
    }
    if (investmentProgramGroupOptions[6]) {
      entries.push([
        normalizeInvestmentMappingLabel(investmentProgramGroupOptions[6]),
        'plant_machinery',
      ]);
    }
    if (investmentProgramGroupOptions[7]) {
      entries.push([
        normalizeInvestmentMappingLabel(investmentProgramGroupOptions[7]),
        'other_equipment',
      ]);
    }

    return new Map(entries);
  }, [investmentProgramGroupOptions]);

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
      setActiveOperation('creating');
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
        setActiveOperation('idle');
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

    setActiveOperation('deleting');
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
      setActiveOperation('idle');
    }
  }, [scenario, selectedScenarioId, loadScenarioList, t]);

  const handleSave = React.useCallback(async () => {
    setActiveOperation('saving');
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      setInfo(
        t(
          'v2Forecast.infoDraftSaved',
          'Draft saved. Recompute results to refresh KPI values.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorSaveFailed', 'Saving failed.'),
      );
    } finally {
      setActiveOperation('idle');
    }
  }, [saveDrafts, t]);

  const handleCompute = React.useCallback(async () => {
    if (!selectedScenarioId) return;
    setActiveOperation('computing');
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
      onComputedVersionChange?.(selectedScenarioId, computed.updatedAt);
      updateScenarioSummary(computed);
      setInfo(t('v2Forecast.infoComputed', 'Scenario calculated.'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorComputeFailed', 'Calculation failed.'),
      );
    } finally {
      setActiveOperation('idle');
    }
  }, [
    onComputedVersionChange,
    selectedScenarioId,
    saveDrafts,
    updateScenarioSummary,
    t,
  ]);

  const handleGenerateReport = React.useCallback(async () => {
    if (!selectedScenarioId || !computedFromUpdatedAt) {
      setError(
        t(
          'v2Forecast.computeBeforeReport',
          'Recompute results before creating report.',
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

    setActiveOperation('saving');
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
      setActiveOperation('idle');
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
          item.year === year
            ? {
                ...item,
                amount: safeAmount,
                waterAmount: null,
                wastewaterAmount: null,
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleInvestmentProgramAmountChange = React.useCallback(
    (
      year: number,
      field: 'waterAmount' | 'wastewaterAmount',
      value: string,
    ) => {
      const normalized = value.trim().replace(',', '.');
      if (normalized.length === 0) {
        setDraftInvestments((prev) =>
          prev.map((item) => {
            if (item.year !== year) return item;
            const next = {
              ...item,
              [field]: null,
            };
            return {
              ...next,
              amount: resolveInvestmentProgramTotal(next),
            };
          }),
        );
        return;
      }
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) return;
      const safeAmount = clampYearlyInvestment(parsed);
      setDraftInvestments((prev) =>
        prev.map((item) => {
          if (item.year !== year) return item;
          const next = {
            ...item,
            [field]: safeAmount,
          };
          return {
            ...next,
            amount: resolveInvestmentProgramTotal(next),
          };
        }),
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
      return prev.map((item) => ({
        ...item,
        amount: firstAmount,
        waterAmount: null,
        wastewaterAmount: null,
      }));
    });
  }, []);

  const handleClearAllInvestments = React.useCallback(() => {
    setDraftInvestments((prev) =>
      prev.map((item) => ({
        ...item,
        amount: 0,
        waterAmount: null,
        wastewaterAmount: null,
      })),
    );
  }, []);

  const handleRepeatNearTermInvestmentTemplate = React.useCallback(() => {
    setDraftInvestments((prev) => {
      const templateCount = Math.min(5, prev.length);
      if (templateCount === 0 || prev.length <= templateCount) {
        return prev;
      }
      return prev.map((item, index) => {
        if (index < templateCount) return item;
        const template = prev[index % templateCount]!;
        return {
          ...item,
          amount: template.amount,
          target: template.target ?? null,
          category: template.category ?? null,
          investmentType: template.investmentType ?? null,
          confidence: template.confidence ?? null,
          waterAmount: template.waterAmount ?? null,
          wastewaterAmount: template.wastewaterAmount ?? null,
          note: template.note ?? null,
        };
      });
    });
  }, []);

  const handleInvestmentMetadataChange = React.useCallback(
    (
      year: number,
      field:
        | 'target'
        | 'category'
        | 'investmentType'
        | 'confidence'
        | 'note',
      value: string,
    ) => {
      setDraftInvestments((prev) =>
        prev.map((item) => {
          if (item.year !== year) return item;
          if (field === 'target' || field === 'category' || field === 'note') {
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

  const renderInvestmentProgramRows = React.useCallback(
    (rows: Array<(typeof draftInvestments)[number]>) =>
      rows.map((row) => (
        <div key={`program-${row.year}`} className="v2-investment-program-row">
          <strong className="v2-investment-year-pill">{row.year}</strong>
          <input
            className="v2-input"
            type="text"
            name={`investmentProgramTarget-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramTargetLabel',
              'Target',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentProgramTargetLabel',
              'Target',
            )}
            value={row.target ?? ''}
            onChange={(event) =>
              handleInvestmentMetadataChange(row.year, 'target', event.target.value)
            }
          />
          <select
            className="v2-input"
            name={`investmentProgramType-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramTypeLabel',
              'Type',
            )} ${row.year}`}
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
              {t('v2Forecast.investmentProgramTypeLabel', 'Type')}
            </option>
            <option value="replacement">
              {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
            </option>
            <option value="new">
              {t('v2Forecast.investmentTypeNew', 'New')}
            </option>
          </select>
          <input
            className="v2-input"
            type="text"
            list="v2-investment-program-group-options"
            name={`investmentProgramGroup-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramGroupLabel',
              'Group',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentProgramGroupLabel',
              'Group',
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
          <input
            className="v2-input"
            type="number"
            inputMode="numeric"
            name={`investmentProgramWater-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramWaterAmount',
              'Water EUR',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentProgramWaterAmount',
              'Water EUR',
            )}
            step="1"
            min="0"
            max={MAX_YEARLY_INVESTMENT_EUR}
            value={row.waterAmount ?? ''}
            onChange={(event) =>
              handleInvestmentProgramAmountChange(
                row.year,
                'waterAmount',
                event.target.value,
              )
            }
            onFocus={(event) => event.currentTarget.select()}
          />
          <input
            className="v2-input"
            type="number"
            inputMode="numeric"
            name={`investmentProgramWastewater-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramWastewaterAmount',
              'Wastewater EUR',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentProgramWastewaterAmount',
              'Wastewater EUR',
            )}
            step="1"
            min="0"
            max={MAX_YEARLY_INVESTMENT_EUR}
            value={row.wastewaterAmount ?? ''}
            onChange={(event) =>
              handleInvestmentProgramAmountChange(
                row.year,
                'wastewaterAmount',
                event.target.value,
              )
            }
            onFocus={(event) => event.currentTarget.select()}
          />
          <input
            className="v2-input"
            type="number"
            inputMode="numeric"
            name={`investmentProgramTotal-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramTotalAmount',
              'Total EUR',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentProgramTotalAmount',
              'Total EUR',
            )}
            step="1"
            min="0"
            max={MAX_YEARLY_INVESTMENT_EUR}
            value={resolveInvestmentProgramTotal(row)}
            onChange={(event) => handleInvestmentChange(row.year, event.target.value)}
            onBlur={() => handleInvestmentBlur(row.year)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <input
            className="v2-input"
            type="text"
            name={`investmentProgramNote-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentProgramNoteLabel',
              'Note',
            )} ${row.year}`}
            placeholder={t('v2Forecast.investmentProgramNoteLabel', 'Note')}
            value={row.note ?? ''}
            onChange={(event) =>
              handleInvestmentMetadataChange(row.year, 'note', event.target.value)
            }
          />
        </div>
      )),
    [
      handleInvestmentBlur,
      handleInvestmentChange,
      handleInvestmentMetadataChange,
      handleInvestmentProgramAmountChange,
      t,
    ],
  );

  const renderInvestmentEditorRows = React.useCallback(
    (rows: Array<(typeof draftInvestments)[number]>) =>
      rows.map((row) => (
        <div key={row.year} className="v2-investment-row">
          <strong className="v2-investment-year-pill">{row.year}</strong>
          <input
            id={`yearly-investment-${row.year}`}
            className="v2-input"
            type="number"
            inputMode="numeric"
            name={`yearlyInvestment-${row.year}`}
            aria-label={`${t(
              'v2Forecast.yearlyInvestmentsEur',
              'Yearly investments (EUR)',
            )} ${row.year}`}
            step="1"
            min="0"
            max={MAX_YEARLY_INVESTMENT_EUR}
            value={row.amount}
            onChange={(event) => handleInvestmentChange(row.year, event.target.value)}
            onBlur={() => handleInvestmentBlur(row.year)}
            onFocus={(event) => event.currentTarget.select()}
          />
          <input
            className="v2-input"
            type="text"
            name={`yearlyInvestmentCategory-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentCategoryPlaceholder',
              'Category',
            )} ${row.year}`}
            placeholder={t(
              'v2Forecast.investmentCategoryPlaceholder',
              'Category',
            )}
            value={row.category ?? ''}
            onChange={(event) =>
              handleInvestmentMetadataChange(row.year, 'category', event.target.value)
            }
          />
          <select
            className="v2-input"
            name={`yearlyInvestmentType-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentTypePlaceholder',
              'Type',
            )} ${row.year}`}
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
              {t('v2Forecast.investmentTypePlaceholder', 'Type')}
            </option>
            <option value="replacement">
              {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
            </option>
            <option value="new">
              {t('v2Forecast.investmentTypeNew', 'New')}
            </option>
          </select>
          <select
            className="v2-input"
            name={`yearlyInvestmentConfidence-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentConfidencePlaceholder',
              'Confidence',
            )} ${row.year}`}
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
              {t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')}
            </option>
            <option value="low">{t('v2Forecast.investmentConfidenceLow', 'Low')}</option>
            <option value="medium">
              {t('v2Forecast.investmentConfidenceMedium', 'Medium')}
            </option>
            <option value="high">
              {t('v2Forecast.investmentConfidenceHigh', 'High')}
            </option>
          </select>
          <input
            className="v2-input"
            type="text"
            name={`yearlyInvestmentNote-${row.year}`}
            aria-label={`${t(
              'v2Forecast.investmentNotePlaceholder',
              'Note',
            )} ${row.year}`}
            placeholder={t('v2Forecast.investmentNotePlaceholder', 'Note')}
            value={row.note ?? ''}
            onChange={(event) =>
              handleInvestmentMetadataChange(row.year, 'note', event.target.value)
            }
          />
        </div>
      )),
    [
      handleInvestmentBlur,
      handleInvestmentChange,
      handleInvestmentMetadataChange,
      t,
    ],
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

      setActiveOperation('creating');
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
        setActiveOperation('idle');
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
  const depreciationClassOptions = React.useMemo(
    () =>
      depreciationRuleDrafts
        .map((item) => ({
          key: item.assetClassKey.trim(),
          label:
            item.assetClassName.trim().length > 0
              ? item.assetClassName.trim()
              : item.assetClassKey.trim(),
        }))
        .filter(
          (item): item is { key: string; label: string } => item.key.length > 0,
        ),
    [depreciationRuleDrafts],
  );
  const inferredDepreciationClassKeyByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => {
          const normalizedCategory = normalizeInvestmentMappingLabel(
            item.category,
          );
          const exactClassKey =
            depreciationClassKeys.find(
              (classKey) =>
                normalizeInvestmentMappingLabel(classKey) === normalizedCategory,
            ) ?? null;
          const exactClassLabel =
            depreciationClassOptions.find(
              (item) =>
                normalizeInvestmentMappingLabel(item.label) === normalizedCategory,
            )?.key ?? null;
          const suggestedClassKey =
            exactClassKey ??
            exactClassLabel ??
            suggestedDepreciationClassKeyByInvestmentGroup.get(
              normalizedCategory,
            ) ?? null;
          const isKnownClass =
            suggestedClassKey != null &&
            depreciationClassKeys.includes(suggestedClassKey);
          return [item.year, isKnownClass ? suggestedClassKey : null];
        }),
      ) as Record<number, string | null>,
    [
      depreciationClassOptions,
      depreciationClassKeys,
      draftInvestments,
      suggestedDepreciationClassKeyByInvestmentGroup,
    ],
  );
  const inferredDepreciationClassOptionByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => {
          const classKey = inferredDepreciationClassKeyByYear[item.year];
          const option =
            depreciationClassOptions.find((entry) => entry.key === classKey) ?? null;
          return [item.year, option];
        }),
      ) as Record<number, { key: string; label: string } | null>,
    [depreciationClassOptions, draftInvestments, inferredDepreciationClassKeyByYear],
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
        const hasExistingAllocation = Object.values(existingRow).some(
          (value) => value.trim().length > 0,
        );
        const inferredClassKey = inferredDepreciationClassKeyByYear[year];
        next[year] = Object.fromEntries(
          depreciationClassKeys.map((classKey) => {
            const existingValue = existingRow[classKey] ?? '';
            return [
              classKey,
              existingValue.trim().length > 0
                ? existingValue
                : !hasExistingAllocation && inferredClassKey === classKey
                ? '100'
                : '',
            ];
          }),
        );
      }
      return next;
    });
  }, [depreciationClassKeys, draftInvestments, inferredDepreciationClassKeyByYear]);

  const handleAddDepreciationRuleDraft = React.useCallback(() => {
    setDepreciationRuleDrafts((prev) => [
      ...prev,
      {
        assetClassKey: '',
        assetClassName: '',
        method: 'straight-line',
        linearYears: '20',
        residualPercent: '',
        annualSchedule: '',
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
      const annualSchedule = draft.annualSchedule
        .split(',')
        .map((item) => Number(item.trim().replace(',', '.')))
        .filter((value) => Number.isFinite(value));

      const payload = {
        assetClassKey,
        assetClassName: draft.assetClassName.trim() || undefined,
        method: draft.method,
        linearYears:
          (draft.method === 'linear' || draft.method === 'straight-line') &&
          Number.isFinite(linearYears)
            ? Math.round(linearYears)
            : undefined,
        residualPercent:
          draft.method === 'residual' && Number.isFinite(residualPercent)
            ? residualPercent
            : undefined,
        annualSchedule:
          draft.method === 'custom-annual-schedule' && annualSchedule.length > 0
            ? annualSchedule
            : undefined,
      };

      if (!selectedScenarioId) return;
      setActiveOperation('saving');
      setError(null);
      setInfo(null);
      try {
        if (draft.id) {
          await updateScenarioDepreciationRuleV2(
            selectedScenarioId,
            draft.id,
            payload,
          );
        } else {
          await createScenarioDepreciationRuleV2(selectedScenarioId, payload);
        }
        const refreshed = await listScenarioDepreciationRulesV2(selectedScenarioId);
        const nextRuleDrafts = refreshed.map(toDepreciationRuleDraft);
        setDepreciationRuleDrafts(nextRuleDrafts);
        setSavedDepreciationRuleDrafts(nextRuleDrafts);
        setComputedFromUpdatedAt(null);
        onComputedVersionChange?.(selectedScenarioId, null);
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
        setActiveOperation('idle');
      }
    },
    [depreciationRuleDrafts, onComputedVersionChange, selectedScenarioId, t],
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

      setActiveOperation('deleting');
      setError(null);
      setInfo(null);
      try {
        if (!selectedScenarioId) return;
        await deleteScenarioDepreciationRuleV2(selectedScenarioId, draft.id);
        const refreshed = await listScenarioDepreciationRulesV2(selectedScenarioId);
        const nextRuleDrafts = refreshed.map(toDepreciationRuleDraft);
        setDepreciationRuleDrafts(nextRuleDrafts);
        setSavedDepreciationRuleDrafts(nextRuleDrafts);
        setComputedFromUpdatedAt(null);
        onComputedVersionChange?.(selectedScenarioId, null);
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
        setActiveOperation('idle');
      }
    },
    [depreciationRuleDrafts, onComputedVersionChange, selectedScenarioId, t],
  );

  const handleAllocationDraftChange = React.useCallback(
    (year: number, classKey: string) => {
      setClassAllocationDraftByYear((prev) => ({
        ...prev,
        [year]: Object.fromEntries(
          depreciationClassKeys.map((key) => [key, key === classKey ? '100' : '']),
        ),
      }));
    },
    [depreciationClassKeys],
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

  const mappedDepreciationClassByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => [
          item.year,
          resolveSingleMappedDepreciationClass(
            classAllocationDraftByYear,
            depreciationClassKeys,
            item.year,
          ),
        ]),
      ) as Record<number, string | null>,
    [classAllocationDraftByYear, depreciationClassKeys, draftInvestments],
  );

  const previousSavedDepreciationClassByYear = React.useMemo(() => {
    const out: Record<number, { sourceYear: number; classKey: string } | null> = {};
    const sortedYears = draftInvestments
      .filter((item) => item.amount > 0)
      .map((item) => item.year)
      .sort((a, b) => a - b);

    for (const year of sortedYears) {
      let latestMatch: { sourceYear: number; classKey: string } | null = null;
      for (const candidateYear of sortedYears) {
        if (candidateYear >= year) break;
        const classKey = savedMappedDepreciationClassByYear[candidateYear];
        if (classKey) {
          latestMatch = { sourceYear: candidateYear, classKey };
        }
      }
      out[year] = latestMatch;
    }

    return out;
  }, [draftInvestments, savedMappedDepreciationClassByYear]);

  const applyCarryForwardMapping = React.useCallback(
    (year: number) => {
      const source = previousSavedDepreciationClassByYear[year];
      if (!source) return;
      handleAllocationDraftChange(year, source.classKey);
    },
    [handleAllocationDraftChange, previousSavedDepreciationClassByYear],
  );

  const saveClassAllocations = React.useCallback(async () => {
    if (!selectedScenarioId) return;

    const yearsPayload = draftInvestments
      .map((row) => {
        const mappedClassKey = mappedDepreciationClassByYear[row.year];
        const allocations = mappedClassKey
          ? [{ classKey: mappedClassKey, sharePct: 100 }]
          : [];
        return {
          year: row.year,
          allocations,
        };
      })
      .filter((row) => row.allocations.length > 0);

    setActiveOperation('saving');
    setError(null);
    setInfo(null);
    try {
      await updateScenarioClassAllocationsV2(selectedScenarioId, {
        years: yearsPayload,
      });
      const refreshed = await getScenarioClassAllocationsV2(selectedScenarioId);
      const nextAllocationDraft = buildClassAllocationDraftByYear(
        draftInvestments.map((item) => item.year),
        depreciationClassKeys,
        refreshed.years,
      );
      setClassAllocationDraftByYear(nextAllocationDraft);
      setSavedClassAllocationDraftByYear(nextAllocationDraft);
      setComputedFromUpdatedAt(null);
      onComputedVersionChange?.(selectedScenarioId, null);
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
      setActiveOperation('idle');
    }
  }, [
    selectedScenarioId,
    draftInvestments,
    depreciationClassKeys,
    mappedDepreciationClassByYear,
    onComputedVersionChange,
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
      provenance: V2OverrideProvenance | null | undefined,
    ) => {
      const hasStatementImport =
        provenance?.kind === 'statement_import' ||
        (provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'statement_import',
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
      if (hasStatementImport && hasWorkbookImport) {
        return t(
          'v2Forecast.baselineSourceStatementWorkbookMixed',
          'Statement PDF + workbook repair',
        );
      }
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
      if (provenance?.kind === 'qdis_import') {
        return t(
          'v2Forecast.baselineSourceQdisImport',
          'QDIS PDF ({{fileName}})',
          {
            fileName: provenance.fileName ?? 'QDIS PDF',
          },
        );
      }
      if (
        provenance?.kind === 'kva_import' ||
        provenance?.kind === 'excel_import'
      ) {
        return t(
          'v2Forecast.baselineSourceWorkbookImport',
          'Workbook import ({{fileName}})',
          {
            fileName: provenance.fileName ?? 'Excel workbook',
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

  const baselineYearSnapshot = React.useMemo(
    () => scenario?.years[0] ?? null,
    [scenario],
  );

  const horizonYearSnapshot = React.useMemo(
    () =>
      scenario && scenario.years.length > 0
        ? scenario.years[scenario.years.length - 1] ?? null
        : null,
    [scenario],
  );

  const averageNearTermExpense = React.useMemo(() => {
    if (draftNearTermExpenseAssumptions.length === 0) {
      return {
        personnelPct: 0,
        energyPct: 0,
        opexOtherPct: 0,
      };
    }

    const total = draftNearTermExpenseAssumptions.reduce(
      (acc, row) => ({
        personnelPct: acc.personnelPct + row.personnelPct,
        energyPct: acc.energyPct + row.energyPct,
        opexOtherPct: acc.opexOtherPct + row.opexOtherPct,
      }),
      {
        personnelPct: 0,
        energyPct: 0,
        opexOtherPct: 0,
      },
    );

    return {
      personnelPct: total.personnelPct / draftNearTermExpenseAssumptions.length,
      energyPct: total.energyPct / draftNearTermExpenseAssumptions.length,
      opexOtherPct:
        total.opexOtherPct / draftNearTermExpenseAssumptions.length,
    };
  }, [draftNearTermExpenseAssumptions]);

  const firstNearTermExpense = React.useMemo(
    () => draftNearTermExpenseAssumptions[0] ?? null,
    [draftNearTermExpenseAssumptions],
  );

  const allocationCoverageSummary = React.useMemo(() => {
    if (draftInvestments.length === 0) {
      return {
        anyMappedYears: 0,
        fullyMappedYears: 0,
      };
    }

    return draftInvestments.reduce(
      (acc, row) => {
        const total = allocationTotalByYear[row.year] ?? 0;
        return {
          anyMappedYears: acc.anyMappedYears + (total > 0 ? 1 : 0),
          fullyMappedYears:
            acc.fullyMappedYears + (Math.abs(total - 100) < 0.01 ? 1 : 0),
        };
      },
      {
        anyMappedYears: 0,
        fullyMappedYears: 0,
      },
    );
  }, [allocationTotalByYear, draftInvestments]);

  const statementRows = React.useMemo(() => {
    if (!baselineYearSnapshot || !horizonYearSnapshot) return [];

    const formatRowValue = (value: number | undefined): string =>
      typeof value === 'number'
        ? formatEur(value)
        : t('v2Forecast.reportStateMissing');

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
        label: t('v2Forecast.statementRevenue', 'Intakter'),
        baseline: formatRowValue(baselineYearSnapshot.revenue),
        scenario: formatRowValue(horizonYearSnapshot.revenue),
        delta: formatRowDelta(
          baselineYearSnapshot.revenue,
          horizonYearSnapshot.revenue,
        ),
      },
      {
        id: 'costs',
        label: t('v2Forecast.statementCosts', 'Kulut'),
        baseline: formatRowValue(baselineYearSnapshot.costs),
        scenario: formatRowValue(horizonYearSnapshot.costs),
        delta: formatRowDelta(
          baselineYearSnapshot.costs,
          horizonYearSnapshot.costs,
        ),
      },
      {
        id: 'result',
        label: t('v2Forecast.statementResult', 'Tulos'),
        baseline: formatRowValue(baselineYearSnapshot.result),
        scenario: formatRowValue(horizonYearSnapshot.result),
        delta: formatRowDelta(
          baselineYearSnapshot.result,
          horizonYearSnapshot.result,
        ),
      },
      {
        id: 'cashflow',
        label: t('v2Forecast.statementCashflow', 'Kassavirta'),
        baseline: formatRowValue(baselineYearSnapshot.cashflow),
        scenario: formatRowValue(horizonYearSnapshot.cashflow),
        delta: formatRowDelta(
          baselineYearSnapshot.cashflow,
          horizonYearSnapshot.cashflow,
        ),
      },
      {
        id: 'cumulativeCash',
        label: t('v2Forecast.statementCumulativeCash', 'Kumulatiivinen kassa'),
        baseline: formatRowValue(baselineYearSnapshot.cumulativeCashflow),
        scenario: formatRowValue(horizonYearSnapshot.cumulativeCashflow),
        delta: formatRowDelta(
          baselineYearSnapshot.cumulativeCashflow,
          horizonYearSnapshot.cumulativeCashflow,
        ),
      },
    ];
  }, [baselineYearSnapshot, horizonYearSnapshot, t]);

  const statementPillars = React.useMemo(() => {
    const baselineVolume =
      baselineContext == null
        ? 0
        : baselineContext.soldWaterVolume + baselineContext.soldWastewaterVolume;
    const energyBaselineAssumption = toPercentPoints(
      draftAssumptions.energiakerroin,
    );
    const personnelBaselineAssumption = toPercentPoints(
      draftAssumptions.henkilostokerroin,
    );
    const opexBaselineAssumption = toPercentPoints(draftAssumptions.inflaatio);

    return [
      {
        id: 'revenues',
        title: t('v2Forecast.pillarRevenue', 'Intakter'),
        baseline: baselineContext
          ? `${formatPrice(scenario?.baselinePriceTodayCombined ?? 0)} · ${formatNumber(baselineVolume)} m3`
          : formatPrice(scenario?.baselinePriceTodayCombined ?? 0),
        scenario: latestPricePoint
          ? `${formatPrice(latestPricePoint.combinedPrice)} · ${formatNumber(horizonYearSnapshot?.soldVolume ?? baselineYearSnapshot?.soldVolume ?? 0)} m3`
          : t('v2Forecast.reportStateMissing'),
        delta:
          scenario?.requiredAnnualIncreasePctAnnualResult != null
            ? formatPercent(scenario.requiredAnnualIncreasePctAnnualResult)
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
        title: t('v2Forecast.pillarMaterials', 'Materialkostnader'),
        baseline: baselineContext
          ? `${formatNumber(baselineContext.processElectricity)} kWh`
          : formatAssumptionPercent(draftAssumptions.energiakerroin),
        scenario: firstNearTermExpense
          ? formatPercent(firstNearTermExpense.energyPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          averageNearTermExpense.energyPct - energyBaselineAssumption,
        ),
        provenance: t('v2Forecast.ctxProcessElectricity', 'Process electricity'),
      },
      {
        id: 'personnel',
        title: t('v2Forecast.pillarPersonnel', 'Personalkostnader'),
        baseline: formatAssumptionPercent(draftAssumptions.henkilostokerroin),
        scenario: firstNearTermExpense
          ? formatPercent(firstNearTermExpense.personnelPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          averageNearTermExpense.personnelPct - personnelBaselineAssumption,
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
        title: t('v2Forecast.pillarOtherOpex', 'Ovriga rorelsekostnader'),
        baseline: formatAssumptionPercent(draftAssumptions.inflaatio),
        scenario: firstNearTermExpense
          ? formatPercent(firstNearTermExpense.opexOtherPct)
          : t('v2Forecast.reportStateMissing'),
        delta: formatPercent(
          averageNearTermExpense.opexOtherPct - opexBaselineAssumption,
        ),
        provenance: t(
          'v2Forecast.pillarOtherOpexHint',
          'Near-term editable OPEX path',
        ),
      },
      {
        id: 'depreciation',
        title: t('v2Forecast.pillarDepreciation', 'Avskrivningar'),
        baseline: `${depreciationRuleDrafts.length} ${t(
          'v2Forecast.classKey',
          'Class key',
        )}`,
        scenario: `${allocationCoverageSummary.anyMappedYears}/${draftInvestments.length} ${t(
          'common.year',
          'Year',
        )}`,
        delta: `${allocationCoverageSummary.fullyMappedYears}/${draftInvestments.length} ${t(
          'v2Forecast.allocationTotal',
          'Total',
        )} 100%`,
        provenance: depreciationFeatureEnabled
          ? t(
              'v2Forecast.depreciationRulesTitle',
              'Depreciation rules by class',
            )
          : t('common.no', 'No'),
      },
    ];
  }, [
    allocationCoverageSummary.anyMappedYears,
    allocationCoverageSummary.fullyMappedYears,
    averageNearTermExpense.energyPct,
    averageNearTermExpense.opexOtherPct,
    averageNearTermExpense.personnelPct,
    baselineContext,
    baselineDatasetSourceLabel,
    baselineYearSnapshot?.soldVolume,
    depreciationFeatureEnabled,
    depreciationRuleDrafts.length,
    draftAssumptions.energiakerroin,
    draftAssumptions.henkilostokerroin,
    draftAssumptions.inflaatio,
    draftInvestments.length,
    firstNearTermExpense,
    formatAssumptionPercent,
    horizonYearSnapshot?.soldVolume,
    latestPricePoint,
    scenario?.baselinePriceTodayCombined,
    scenario?.requiredAnnualIncreasePctAnnualResult,
    t,
  ]);

  const activeOpexWorkbench = React.useMemo(() => {
    if (
      activeWorkbench === 'materials' ||
      activeWorkbench === 'personnel' ||
      activeWorkbench === 'otherOpex'
    ) {
      return activeWorkbench;
    }
    return null;
  }, [activeWorkbench]);

  const opexWorkbenchConfig = React.useMemo(() => {
    if (!activeOpexWorkbench) return null;

    if (activeOpexWorkbench === 'materials') {
      return {
        field: OPEX_WORKBENCH_FIELDS.materials,
        title: t('v2Forecast.pillarMaterials', 'Materialkostnader'),
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
        field: OPEX_WORKBENCH_FIELDS.personnel,
        title: t('v2Forecast.pillarPersonnel', 'Personalkostnader'),
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
      field: OPEX_WORKBENCH_FIELDS.otherOpex,
      title: t('v2Forecast.pillarOtherOpex', 'Ovriga rorelsekostnader'),
      hint: t(
        'v2Forecast.otherOpexWorkbenchHint',
        'Tune the remaining operating-cost path separately so the cockpit can show a cleaner statement view.',
      ),
      baseline: formatAssumptionPercent(draftAssumptions.inflaatio),
      scenario: formatPercent(averageNearTermExpense.opexOtherPct),
      delta: formatPercent(
        averageNearTermExpense.opexOtherPct -
          toPercentPoints(draftAssumptions.inflaatio),
      ),
    };
  }, [
    activeOpexWorkbench,
    averageNearTermExpense.energyPct,
    averageNearTermExpense.opexOtherPct,
    averageNearTermExpense.personnelPct,
    baselineContext,
    draftAssumptions.energiakerroin,
    draftAssumptions.henkilostokerroin,
    draftAssumptions.inflaatio,
    formatAssumptionPercent,
    t,
  ]);

  const opexWorkbenchRows = React.useMemo(() => {
    if (!opexWorkbenchConfig) return [];

    return draftNearTermExpenseAssumptions.map((row) => {
      const field = opexWorkbenchConfig.field;
      const error = nearTermValidationErrors[row.year]?.[field];
      return {
        year: row.year,
        field,
        value: nearTermInputValue(row, field),
        error,
      };
    });
  }, [
    draftNearTermExpenseAssumptions,
    nearTermInputValue,
    nearTermValidationErrors,
    opexWorkbenchConfig,
  ]);

  const depreciationPreviewRows = React.useMemo(
    () =>
      scenario?.years.map((row) => ({
        year: row.year,
        baseline: row.baselineDepreciation ?? 0,
        scenario: row.investmentDepreciation ?? 0,
        total: row.totalDepreciation ?? 0,
      })) ?? [],
    [scenario],
  );

  const baselineDepreciationTotal = React.useMemo(
    () =>
      depreciationPreviewRows.reduce((sum, row) => sum + row.baseline, 0),
    [depreciationPreviewRows],
  );

  const newInvestmentDepreciationTotal = React.useMemo(
    () =>
      depreciationPreviewRows.reduce((sum, row) => sum + row.scenario, 0),
    [depreciationPreviewRows],
  );

  const totalDepreciationEffect = React.useMemo(
    () => depreciationPreviewRows.reduce((sum, row) => sum + row.total, 0),
    [depreciationPreviewRows],
  );

  const riskComparison = React.useMemo(() => {
    if (!scenario || !comparisonScenario) return null;
    return buildRiskComparisonDelta(comparisonScenario, scenario);
  }, [comparisonScenario, scenario]);

  const riskComparisonSummary = React.useMemo(() => {
    if (!riskComparison) return null;

    if (!riskComparison.materiallyWorse) {
      return t(
        'v2Forecast.riskSummaryStable',
        'The selected scenario stays close to the base case. Funding pressure does not materially worsen versus the base scenario.',
      );
    }

    return t(
      'v2Forecast.riskSummaryStress',
      'Compared with the base scenario, this stress case raises required fee level by {{priceDelta}}, changes the annual increase need by {{increaseDelta}}, and worsens cumulative cash by {{gapDelta}}.',
      {
        priceDelta: formatPrice(Math.max(0, riskComparison.requiredPriceDelta)),
        increaseDelta: formatPercent(riskComparison.requiredIncreaseDelta),
        gapDelta: formatEur(Math.max(0, riskComparison.peakGapDelta)),
      },
    );
  }, [riskComparison, t]);

  const comparisonHorizonYearSnapshot = React.useMemo(
    () =>
      comparisonScenario && comparisonScenario.years.length > 0
        ? comparisonScenario.years[comparisonScenario.years.length - 1] ?? null
        : null,
    [comparisonScenario],
  );

  const comparisonDerivedRows = React.useMemo(() => {
    if (!comparisonScenario || !comparisonHorizonYearSnapshot || !horizonYearSnapshot) {
      return [];
    }

    const buildRow = (
      id: string,
      label: string,
      baselineValue: number,
      scenarioValue: number,
    ) => ({
      id,
      label,
      baseline: formatEur(baselineValue),
      scenario: formatEur(scenarioValue),
      delta: formatSignedEur(scenarioValue - baselineValue),
    });

    return [
      buildRow(
        'revenue',
        t('v2Forecast.statementRevenue', 'Intakter'),
        comparisonHorizonYearSnapshot.revenue,
        horizonYearSnapshot.revenue,
      ),
      buildRow(
        'costs',
        t('v2Forecast.statementCosts', 'Kulut'),
        comparisonHorizonYearSnapshot.costs,
        horizonYearSnapshot.costs,
      ),
      buildRow(
        'result',
        t('v2Forecast.statementResult', 'Tulos'),
        comparisonHorizonYearSnapshot.result,
        horizonYearSnapshot.result,
      ),
      buildRow(
        'cashflow',
        t('v2Forecast.statementCashflow', 'Kassavirta'),
        comparisonHorizonYearSnapshot.cashflow,
        horizonYearSnapshot.cashflow,
      ),
      buildRow(
        'depreciation',
        t('v2Forecast.totalDepreciationTitle', 'Total depreciation'),
        comparisonHorizonYearSnapshot.totalDepreciation,
        horizonYearSnapshot.totalDepreciation,
      ),
    ];
  }, [comparisonScenario, comparisonHorizonYearSnapshot, horizonYearSnapshot, t]);

  const comparisonPillarRows = React.useMemo(() => {
    if (!comparisonScenario || !comparisonHorizonYearSnapshot || !horizonYearSnapshot) {
      return [];
    }

    const averageNearTerm = (
      rows: Array<{
        personnelPct: number;
        energyPct: number;
        opexOtherPct: number;
      }>,
      field: 'personnelPct' | 'energyPct' | 'opexOtherPct',
    ) => {
      if (rows.length === 0) return 0;
      return rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
    };

    const comparisonRevenueSummary =
      `${formatPrice(comparisonPrimaryFeeSignal.price)} · ${formatNumber(comparisonHorizonYearSnapshot.soldVolume)} m3`;
    const scenarioRevenueSummary =
      `${formatPrice(primaryFeeSignal.price)} · ${formatNumber(horizonYearSnapshot.soldVolume)} m3`;

    return [
      {
        id: 'revenues',
        label: t('v2Forecast.pillarRevenue', 'Intakter'),
        baseline: comparisonRevenueSummary,
        scenario: scenarioRevenueSummary,
        delta: formatSignedEur(
          horizonYearSnapshot.revenue - comparisonHorizonYearSnapshot.revenue,
        ),
      },
      {
        id: 'materials',
        label: t('v2Forecast.pillarMaterials', 'Materialkostnader'),
        baseline: formatPercent(
          averageNearTerm(
            comparisonScenario.nearTermExpenseAssumptions,
            'energyPct',
          ),
        ),
        scenario: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'energyPct'),
        ),
        delta: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'energyPct') -
            averageNearTerm(
              comparisonScenario.nearTermExpenseAssumptions,
              'energyPct',
            ),
        ),
      },
      {
        id: 'personnel',
        label: t('v2Forecast.pillarPersonnel', 'Personalkostnader'),
        baseline: formatPercent(
          averageNearTerm(
            comparisonScenario.nearTermExpenseAssumptions,
            'personnelPct',
          ),
        ),
        scenario: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'personnelPct'),
        ),
        delta: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'personnelPct') -
            averageNearTerm(
              comparisonScenario.nearTermExpenseAssumptions,
              'personnelPct',
            ),
        ),
      },
      {
        id: 'opex',
        label: t('v2Forecast.pillarOtherOpex', 'Ovriga rorelsekostnader'),
        baseline: formatPercent(
          averageNearTerm(
            comparisonScenario.nearTermExpenseAssumptions,
            'opexOtherPct',
          ),
        ),
        scenario: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'opexOtherPct'),
        ),
        delta: formatPercent(
          averageNearTerm(draftNearTermExpenseAssumptions, 'opexOtherPct') -
            averageNearTerm(
              comparisonScenario.nearTermExpenseAssumptions,
              'opexOtherPct',
            ),
        ),
      },
      {
        id: 'depreciation',
        label: t('v2Forecast.pillarDepreciation', 'Avskrivningar'),
        baseline: formatEur(comparisonHorizonYearSnapshot.totalDepreciation),
        scenario: formatEur(horizonYearSnapshot.totalDepreciation),
        delta: formatSignedEur(
          horizonYearSnapshot.totalDepreciation -
            comparisonHorizonYearSnapshot.totalDepreciation,
        ),
      },
    ];
  }, [
    comparisonPrimaryFeeSignal.price,
    comparisonScenario,
    comparisonHorizonYearSnapshot,
    draftNearTermExpenseAssumptions,
    horizonYearSnapshot,
    primaryFeeSignal.price,
    t,
  ]);
  const investmentImpactSummary = React.useMemo(
    () => ({
      totalInvestments: draftInvestments.reduce((sum, row) => sum + row.amount, 0),
      totalDepreciation: totalDepreciationEffect,
      requiredPriceToday: primaryFeeSignal.price,
      peakGap: scenario?.feeSufficiency.cumulativeCash.peakGap ?? 0,
    }),
    [draftInvestments, primaryFeeSignal.price, scenario, totalDepreciationEffect],
  );

  const investmentProgramSurface = (
    <article className="v2-subcard v2-investment-program-card">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Forecast.investmentProgramEyebrow', 'Investointiohjelma')}
          </p>
          <h3>
            {t('v2Forecast.investmentProgramTitle', 'Investointiohjelma')}
          </h3>
          <p className="v2-muted">
            {t(
              'v2Forecast.investmentProgramHint',
              'Start with the next five years in utility language. Save the total directly, or split it between water and wastewater when that helps the discussion.',
            )}
          </p>
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
          <p>{formatEur(investmentSummary.strongestFiveYearTotal)}</p>
          <small>
            {investmentSummary.strongestFiveYearRange
              ? `${investmentSummary.strongestFiveYearRange.startYear}-${investmentSummary.strongestFiveYearRange.endYear}`
              : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
          </small>
        </article>
        <article>
          <h3>{t('v2Forecast.investmentPeakYears', 'Peak years')}</h3>
          <p>
            {investmentSummary.peakYears.length > 0
              ? investmentSummary.peakYears.join(', ')
              : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
          </p>
        </article>
      </div>
      <div className="v2-section-header">
        <div>
          <h4>{t('v2Forecast.investmentImpactTitle', 'Investment plan effect')}</h4>
          <p className="v2-muted">
            {t(
              'v2Forecast.investmentImpactHint',
              'After save and recompute, these same inputs flow into yearly investments, depreciation, tariff pressure, and cash impact.',
            )}
          </p>
        </div>
        <span className={`v2-badge ${forecastStateToneClass}`}>
          {forecastStateLabel}
        </span>
      </div>
      <div className="v2-kpi-strip v2-kpi-strip-four v2-investment-impact-strip">
        <article>
          <h3>{t('v2Forecast.totalInvestments', 'Total investments')}</h3>
          <p>{formatEur(investmentImpactSummary.totalInvestments)}</p>
        </article>
        <article>
          <h3>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</h3>
          <p>{formatEur(investmentImpactSummary.totalDepreciation)}</p>
        </article>
        <article>
          <h3>
            {t(
              'v2Forecast.depreciationImpactRequiredPrice',
              'Required price today',
            )}
          </h3>
          <p>{formatPrice(investmentImpactSummary.requiredPriceToday)}</p>
        </article>
        <article>
          <h3>{t('v2Forecast.depreciationImpactPeakGap', 'Peak cumulative gap')}</h3>
          <p>{formatEur(investmentImpactSummary.peakGap)}</p>
        </article>
      </div>
      {depreciationFeatureEnabled ? (
        <div className="v2-section-header">
          <div>
            <p className="v2-muted">
              {t(
                'v2Forecast.investmentProgramContinueHint',
                'The same saved rows continue into Poistosaannot and the full annual table below.',
              )}
            </p>
          </div>
          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn"
              onClick={() => setActiveWorkbench('depreciation')}
            >
              {t(
                'v2Forecast.investmentProgramContinueDepreciation',
                'Continue to Poistosaannot',
              )}
            </button>
          </div>
        </div>
      ) : null}
      <div className="v2-investment-program-table">
        <div
          className="v2-investment-program-row v2-investment-program-row-head"
          aria-hidden="true"
        >
          <span>{t('common.year', 'Year')}</span>
          <span>
            {t('v2Forecast.investmentProgramTargetLabel', 'Target')}
          </span>
          <span>{t('v2Forecast.investmentProgramTypeLabel', 'Type')}</span>
          <span>{t('v2Forecast.investmentProgramGroupLabel', 'Group')}</span>
          <span>
            {t('v2Forecast.investmentProgramWaterAmount', 'Water EUR')}
          </span>
          <span>
            {t(
              'v2Forecast.investmentProgramWastewaterAmount',
              'Wastewater EUR',
            )}
          </span>
          <span>
            {t('v2Forecast.investmentProgramTotalAmount', 'Total EUR')}
          </span>
          <span>{t('v2Forecast.investmentProgramNoteLabel', 'Note')}</span>
        </div>
        {renderInvestmentProgramRows(nearTermInvestmentRows)}
      </div>
      <datalist id="v2-investment-program-group-options">
        {investmentProgramGroupOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {longRangeInvestmentGroups.length > 0 ? (
        <div className="v2-investment-group-list">
          <div className="v2-section-header">
            <div>
              <h4>
                {t(
                  'v2Forecast.investmentLongRangeTitle',
                  'Grouped long-range blocks',
                )}
              </h4>
              <p className="v2-muted">
                {t(
                  'v2Forecast.investmentLongRangeHint',
                  'Open a five-year block only when you need to edit the later horizon in more detail.',
                )}
              </p>
            </div>
          </div>
          {longRangeInvestmentGroups.map((group) => (
            <details
              key={group.id}
              className="v2-manual-optional v2-investment-group-card"
            >
              <summary>
                {t(
                  'v2Forecast.investmentLongRangeGroup',
                  'Long-range block {{start}}-{{end}}',
                  {
                    start: group.startYear,
                    end: group.endYear,
                  },
                )}
                {` | ${formatEur(group.total)}`}
              </summary>
              <p className="v2-muted">
                {group.peakYears.length > 0
                  ? `${t(
                      'v2Forecast.investmentPeakYears',
                      'Peak years',
                    )}: ${group.peakYears.join(', ')}`
                  : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
              </p>
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
                    {t('v2Forecast.investmentCategoryPlaceholder', 'Group')}
                  </span>
                  <span>
                    {t('v2Forecast.investmentTypePlaceholder', 'Type')}
                  </span>
                  <span>
                    {t(
                      'v2Forecast.investmentConfidencePlaceholder',
                      'Confidence',
                    )}
                  </span>
                  <span>{t('v2Forecast.investmentNotePlaceholder', 'Note')}</span>
                </div>
                {renderInvestmentEditorRows(group.rows)}
              </div>
            </details>
          ))}
        </div>
      ) : null}

      <details className="v2-manual-optional" open={denseAnalystMode}>
        <summary>
          {t(
            'v2Forecast.investmentAnalystTools',
            'Full annual table and analyst tools',
          )}
        </summary>
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
              onClick={handleRepeatNearTermInvestmentTemplate}
              disabled={busy || draftInvestments.length <= 5}
            >
              {t(
                'v2Forecast.investmentRepeatNearTermTemplate',
                'Repeat near-term template',
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
        <div className="v2-investment-table">
          <div className="v2-investment-row v2-investment-row-head" aria-hidden="true">
            <span>{t('common.year', 'Year')}</span>
            <span>
              {t('v2Forecast.yearlyInvestmentsEur', 'Yearly investments (EUR)')}
            </span>
            <span>{t('v2Forecast.investmentCategoryPlaceholder', 'Group')}</span>
            <span>{t('v2Forecast.investmentTypePlaceholder', 'Type')}</span>
            <span>
              {t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')}
            </span>
            <span>{t('v2Forecast.investmentNotePlaceholder', 'Note')}</span>
          </div>
          {renderInvestmentEditorRows(draftInvestments)}
        </div>
      </details>
    </article>
  );

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-grid v2-grid-ennuste v2-forecast-layout">
        <aside className="v2-card v2-scenario-panel v2-forecast-sidebar">
          <div className="v2-forecast-sidebar-head">
            <p className="v2-overview-eyebrow">
              {t('v2Forecast.scenarioRailEyebrow', 'Scenario rail')}
            </p>
            <h2>{t('v2Forecast.scenarioRailTitle', 'Pick the planning scenario')}</h2>
            <p className="v2-muted">
              {t(
                'v2Forecast.scenarioRailBody',
                'Choose a scenario, branch it, and start from the executive funding view before opening the deeper workbenches.',
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
                autoFocus={scenarios.length === 0}
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
          {planningContextLoaded &&
          hasBaselineBudget &&
          scenarios.length === 0 ? (
            <div className="v2-forecast-selected-card">
              <div className="v2-forecast-selected-card-head">
                <div>
                  <p className="v2-overview-eyebrow">
                    {t('v2Forecast.firstScenarioEyebrow', 'Planning baseline')}
                  </p>
                  <h3>
                    {t(
                      'v2Forecast.firstScenarioTitle',
                      'Create your first scenario',
                    )}
                  </h3>
                </div>
                <span className="v2-badge v2-status-positive">
                  {t('v2Forecast.reportReady', 'Ready')}
                </span>
              </div>
              <p className="v2-muted">
                {t(
                  'v2Forecast.firstScenarioBody',
                  'The planning baseline is ready. Create the first scenario here to start with funding pressure, investments, and tariff impact instead of an empty scenario shelf.',
                )}
              </p>
              <div className="v2-overview-year-summary-grid">
                <div>
                  <span>{t('projection.v2.baselineYearLabel', 'Baseline year')}</span>
                  <strong>{firstBaselineYear?.year ?? '-'}</strong>
                </div>
                <div>
                  <span>{t('v2Forecast.baselineSourceLabel', 'Baseline source')}</span>
                  <strong>{firstBaselineYear?.sourceStatus ?? '-'}</strong>
                </div>
              </div>
              <div className="v2-actions-row">
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={() => handleCreate(false)}
                  disabled={busy}
                >
                  {t('v2Forecast.firstScenarioCta', 'Create first scenario')}
                </button>
              </div>
            </div>
          ) : null}
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
                    <span className="v2-badge v2-status-info">
                      {t('v2Forecast.baseScenario', 'Base')}
                    </span>
                  ) : null}
                  <span
                    className={`v2-badge ${
                      selectedScenarioListItem.computedYears > 0
                        ? 'v2-status-positive'
                        : 'v2-status-neutral'
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
                  <div className="v2-risk-preset-card-head">
                    <strong>{t(preset.titleKey, preset.title)}</strong>
                    <span className="v2-badge v2-badge-draft">
                      {t(preset.impactKey, preset.impact)}
                    </span>
                  </div>
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
              <div className="v2-loading-state v2-subcard">
                <p>{t('v2Forecast.loadingScenarios', 'Loading scenarios...')}</p>
                <p className="v2-muted">
                  {t(
                    'v2Forecast.loadingScenariosHint',
                    'Loading scenario list and baseline context.',
                  )}
                </p>
                <div className="v2-skeleton-line" />
                <div className="v2-skeleton-line" />
              </div>
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
                            <span className="v2-badge v2-status-info">
                              {t('v2Forecast.baseScenario', 'Base')}
                            </span>
                          ) : null}
                          <span
                            className={`v2-badge ${
                              item.computedYears > 0
                                ? 'v2-status-positive'
                                : 'v2-status-neutral'
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
            <div className="v2-empty-state v2-subcard">
              <p>{t('v2Forecast.selectScenario', 'Select a scenario.')}</p>
              <p className="v2-muted">
                {scenarios.length === 0
                  ? t(
                      'v2Overview.wizardBodyForecast',
                      'The planning baseline is ready. Next you move into Forecast to name the first scenario and continue the work.',
                    )
                  : t(
                      'v2Forecast.selectScenarioHint',
                      'Choose an existing scenario or create a new one to continue.',
                    )}
              </p>
            </div>
          ) : null}

          {scenario ? (
            <>
              <div className="v2-scenario-editor-hero">
                <div>
                  <p className="v2-overview-eyebrow">
                    {t('v2Forecast.executiveHeroEyebrow', 'Executive fee view')}
                  </p>
                  <div className="v2-section-header">
                    <h2>
                      {t(
                        'v2Forecast.executiveHeroTitle',
                        'Executive funding picture',
                      )}
                      : {scenario.name}
                    </h2>
                    <div className="v2-badge-row">
                      {scenario.onOletus ? (
                        <span className="v2-badge v2-status-info">
                          {t('v2Forecast.baseScenario', 'Base')}
                        </span>
                      ) : (
                        <span className="v2-badge v2-status-warning">
                          {t('v2Forecast.stressScenario', 'Stress')}
                        </span>
                      )}
                      {showInlineFreshnessState ? (
                        <span className={`v2-badge ${forecastStateToneClass}`}>
                          {forecastStateLabel}
                        </span>
                      ) : null}
                      <span className={`v2-badge ${reportReadinessToneClass}`}>
                        {reportReadinessLabel}
                      </span>
                    </div>
                  </div>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.executiveHeroBody',
                      'Start with fee pressure, underfunding timing, and scenario truth before opening the deeper planning workbenches.',
                    )}
                  </p>
                </div>
                <div>
                  <div className="v2-actions-row">
                    {canCreateReport ? (
                      <>
                        <button
                          type="button"
                          className="v2-btn v2-btn-primary"
                          onClick={handleGenerateReport}
                          disabled={busy || !canCreateReport}
                        >
                          {t('v2Forecast.createReport', 'Create report')}
                        </button>
                        <button
                          type="button"
                          className="v2-btn"
                          onClick={handleCompute}
                          disabled={
                            busy || !scenario || hasNearTermValidationErrors
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
                          {computeButtonLabel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="v2-btn v2-btn-primary"
                          onClick={handleCompute}
                          disabled={
                            busy || !scenario || hasNearTermValidationErrors
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
                          {computeButtonLabel}
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
                      </>
                    )}
                    <button
                      type="button"
                      className={`v2-btn ${
                        denseAnalystMode ? '' : 'v2-btn-primary'
                      }`}
                      onClick={() => setDenseAnalystMode(false)}
                    >
                      {t('v2Forecast.standardViewMode', 'Standard view')}
                    </button>
                    <button
                      type="button"
                      className={`v2-btn ${
                        denseAnalystMode ? 'v2-btn-primary' : ''
                      }`}
                      onClick={() => setDenseAnalystMode(true)}
                    >
                      {t('v2Forecast.analystViewMode', 'Analyst view')}
                    </button>
                  </div>
                  <div
                    className={`v2-kpi-strip v2-executive-hero-strip ${
                      denseAnalystMode ? 'dense' : ''
                    }`}
                  >
                    <div>
                      <h3>
                        {primaryFeeSignal.priceLabel}
                      </h3>
                      <p>{formatPrice(primaryFeeSignal.price)}</p>
                    </div>
                    <div>
                      <h3>
                        {primaryFeeSignal.increaseLabel}
                      </h3>
                      <p>{formatPercent(primaryFeeSignal.increase)}</p>
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
                        {t(
                          'v2Forecast.totalInvestments',
                          'Total investments',
                        )}
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
                  <p className="v2-muted">{reportCommandSummary}</p>
                </div>
              </div>

              <section
                className={`v2-card v2-statement-cockpit${
                  denseAnalystMode ? ' dense' : ''
                }`}
              >
                <div className="v2-forecast-workspace-head">
                  <div className="v2-forecast-workspace-copy">
                    <p className="v2-overview-eyebrow">
                      {t(
                        'v2Forecast.statementCockpitEyebrow',
                        'Result overview',
                      )}
                    </p>
                    <h3>
                      {t(
                        'v2Forecast.statementCockpitTitle',
                        'Income statement overview',
                      )}
                    </h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.statementCockpitHint',
                        'Review the baseline, plan, and change before opening the detailed planning views.',
                      )}
                    </p>
                  </div>
                  <div className="v2-forecast-workspace-meta">
                    <div>
                      <span>
                        {t(
                          'v2Forecast.statementCockpitBaseline',
                          'Baseline year',
                        )}
                      </span>
                      <strong>{baselineYearSnapshot?.year ?? '-'}</strong>
                    </div>
                    <div>
                      <span>
                        {t(
                          'v2Forecast.statementCockpitScenario',
                          'Scenario horizon',
                        )}
                      </span>
                      <strong>{horizonYearSnapshot?.year ?? '-'}</strong>
                    </div>
                    <div>
                      <span>
                        {t(
                          'v2Forecast.statementCockpitReportState',
                          'Report state',
                        )}
                      </span>
                      <strong>{reportReadinessLabel}</strong>
                    </div>
                  </div>
                </div>

                <div className="v2-statement-cockpit-grid">
                  <article className="v2-subcard v2-statement-card">
                    <div className="v2-section-header">
                      <div>
                        <h3>
                          {t(
                            'v2Forecast.statementSummaryTitle',
                            'Derived result rows',
                          )}
                        </h3>
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.statementSummaryHint',
                            'These rows stay visible before the longer assumption and investment editors.',
                          )}
                        </p>
                      </div>
                      <span className={`v2-badge ${forecastStateToneClass}`}>
                        {forecastStateLabel}
                      </span>
                    </div>
                    <div className="v2-statement-table" role="table">
                      <div
                        className="v2-statement-row v2-statement-row-head"
                        role="row"
                      >
                        <span>{t('v2Forecast.statementLabel', 'Row')}</span>
                        <span>{baselineYearSnapshot?.year ?? '-'}</span>
                        <span>{horizonYearSnapshot?.year ?? '-'}</span>
                        <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                      </div>
                      {statementRows.map((row) => (
                        <div className="v2-statement-row" key={row.id} role="row">
                          <strong>{row.label}</strong>
                          <span>{row.baseline}</span>
                          <span>{row.scenario}</span>
                          <span>{row.delta}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="v2-subcard v2-statement-card">
                    <div className="v2-section-header">
                      <div>
                        <h3>
                          {t(
                            'v2Forecast.statementPillarsTitle',
                            'Planning areas',
                          )}
                        </h3>
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.statementPillarsHint',
                            'Use the five planning areas to choose the next detailed view.',
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="v2-statement-pillars-grid">
                      {statementPillars.map((pillar) => (
                        <article
                          className={`v2-statement-pillar-card ${
                            (pillar.id === 'revenues' &&
                              activeWorkbench === 'revenue') ||
                            (pillar.id === 'materials' &&
                              activeWorkbench === 'materials') ||
                            (pillar.id === 'personnel' &&
                              activeWorkbench === 'personnel') ||
                            (pillar.id === 'opex' &&
                              activeWorkbench === 'otherOpex') ||
                            (pillar.id === 'depreciation' &&
                              activeWorkbench === 'depreciation')
                              ? 'active'
                              : ''
                          }`}
                          key={pillar.id}
                        >
                          <h4>{pillar.title}</h4>
                          <div className="v2-keyvalue-list">
                            <div className="v2-keyvalue-row">
                              <span>{t('v2Forecast.baselineLabel', 'Baseline')}</span>
                              <strong>{pillar.baseline}</strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>{t('projection.scenario', 'Scenario')}</span>
                              <strong>{pillar.scenario}</strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                              <strong>{pillar.delta}</strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t('v2Forecast.provenanceLabel', 'Provenance')}
                              </span>
                              <strong>{pillar.provenance}</strong>
                            </div>
                          </div>
                          {pillar.id === 'revenues' ? (
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setActiveWorkbench('revenue')}
                            >
                              {t(
                                'v2Forecast.openRevenueWorkbench',
                                'Open revenue planning',
                              )}
                            </button>
                          ) : null}
                          {pillar.id === 'materials' ? (
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setActiveWorkbench('materials')}
                            >
                              {t(
                                'v2Forecast.openMaterialsWorkbench',
                                'Open materials planning',
                              )}
                            </button>
                          ) : null}
                          {pillar.id === 'personnel' ? (
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setActiveWorkbench('personnel')}
                            >
                              {t(
                                'v2Forecast.openPersonnelWorkbench',
                                'Open personnel planning',
                              )}
                            </button>
                          ) : null}
                          {pillar.id === 'opex' ? (
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setActiveWorkbench('otherOpex')}
                            >
                              {t(
                                'v2Forecast.openOtherOpexWorkbench',
                                'Open other operating costs',
                              )}
                            </button>
                          ) : null}
                          {pillar.id === 'depreciation' ? (
                            <button
                              type="button"
                              className="v2-btn"
                              onClick={() => setActiveWorkbench('depreciation')}
                            >
                              {t(
                                'v2Forecast.openDepreciationWorkbench',
                                'Open depreciation planning',
                              )}
                            </button>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </article>
                </div>
              </section>

              {activeWorkbench === 'revenue' ? (
                <section className="v2-card v2-revenue-workbench">
                  <div className="v2-forecast-workspace-head">
                    <div className="v2-forecast-workspace-copy">
                      <p className="v2-overview-eyebrow">
                        {t(
                          'v2Forecast.revenueWorkbenchEyebrow',
                          'Revenue planning',
                        )}
                      </p>
                      <h3>
                        {t(
                          'v2Forecast.revenueWorkbenchTitle',
                          'Revenue and volume drivers',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.revenueWorkbenchHint',
                          'Adjust tariffs and sold volumes here, then return to the overview to review the income statement.',
                        )}
                      </p>
                    </div>
                    <div className="v2-actions-row">
                      <button
                        type="button"
                        className="v2-btn"
                        onClick={() => setActiveWorkbench('cockpit')}
                      >
                        {t(
                          'v2Forecast.returnToCockpit',
                          'Back to overview',
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="v2-statement-cockpit-grid">
                    <article className="v2-subcard v2-statement-card">
                      <div className="v2-section-header">
                        <div>
                          <h4>{t('v2Forecast.pillarRevenue', 'Intakter')}</h4>
                          <p className="v2-muted">
                            {t(
                              'v2Forecast.revenueWorkbenchTariffHint',
                              'Review today versus horizon tariffs before recomputing the scenario.',
                            )}
                          </p>
                        </div>
                        <span className={`v2-badge ${reportReadinessToneClass}`}>
                          {reportReadinessLabel}
                        </span>
                      </div>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.currentFeeLevel')}</span>
                          <strong>
                            {formatPrice(scenario.baselinePriceTodayCombined ?? 0)}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.horizonCombinedPrice',
                              'Horizon combined',
                            )}
                          </span>
                          <strong>
                            {latestPricePoint
                              ? formatPrice(latestPricePoint.combinedPrice)
                              : t('v2Forecast.reportStateMissing')}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.horizonServiceSplit',
                              'Horizon water / wastewater',
                            )}
                          </span>
                          <strong>
                            {latestPricePoint
                              ? `${formatPrice(latestPricePoint.waterPrice)} / ${formatPrice(latestPricePoint.wastewaterPrice)}`
                              : t('v2Forecast.reportStateMissing')}
                          </strong>
                        </div>
                        <label className="v2-field">
                          <span>{t('assumptions.priceIncrease', 'Price increase')}</span>
                          <input
                            id="v2-revenue-price-increase"
                            className="v2-input"
                            type="text"
                            inputMode="decimal"
                            name="revenuePriceIncrease"
                            value={formatNumber(
                              toPercentPoints(draftAssumptions.hintakorotus),
                              2,
                            )}
                            onChange={(event) =>
                              handleRevenueAssumptionChange(
                                'hintakorotus',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                    </article>

                    <article className="v2-subcard v2-statement-card">
                      <div className="v2-section-header">
                        <div>
                          <h4>
                            {t('assumptions.volumeChange', 'Volume change')}
                          </h4>
                          <p className="v2-muted">
                            {t(
                              'v2Forecast.revenueWorkbenchVolumeHint',
                              'Keep baseline and horizon sold-volume context visible while editing the annual volume driver.',
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.ctxSoldWater', 'Sold water')}</span>
                          <strong>
                            {baselineContext
                              ? `${formatNumber(baselineContext.soldWaterVolume)} m3`
                              : t('v2Forecast.reportStateMissing')}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.ctxSoldWastewater',
                              'Sold wastewater',
                            )}
                          </span>
                          <strong>
                            {baselineContext
                              ? `${formatNumber(
                                  baselineContext.soldWastewaterVolume,
                                )} m3`
                              : t('v2Forecast.reportStateMissing')}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('projection.scenario', 'Scenario')}</span>
                          <strong>
                            {horizonYearSnapshot?.soldVolume != null
                              ? `${formatNumber(horizonYearSnapshot.soldVolume)} m3`
                              : t('v2Forecast.reportStateMissing')}
                          </strong>
                        </div>
                        <label className="v2-field">
                          <span>{t('assumptions.volumeChange', 'Volume change')}</span>
                          <input
                            id="v2-revenue-volume-change"
                            className="v2-input"
                            type="text"
                            inputMode="decimal"
                            name="revenueVolumeChange"
                            value={formatNumber(
                              toPercentPoints(draftAssumptions.vesimaaran_muutos),
                              2,
                            )}
                            onChange={(event) =>
                              handleRevenueAssumptionChange(
                                'vesimaaran_muutos',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                    </article>
                  </div>
                </section>
              ) : null}

              {opexWorkbenchConfig ? (
                <section
                  className={`v2-card v2-opex-workbench${
                    denseAnalystMode ? ' dense' : ''
                  }`}
                >
                  <div className="v2-forecast-workspace-head">
                    <div className="v2-forecast-workspace-copy">
                      <p className="v2-overview-eyebrow">
                        {t(
                          'v2Forecast.opexWorkbenchEyebrow',
                          'Operating cost planning',
                        )}
                      </p>
                      <h3>{opexWorkbenchConfig.title}</h3>
                      <p className="v2-muted">{opexWorkbenchConfig.hint}</p>
                    </div>
                    <div className="v2-actions-row">
                      <button
                        type="button"
                        className="v2-btn"
                        onClick={() => setDenseAnalystMode((prev) => !prev)}
                      >
                        {denseAnalystMode
                          ? t(
                              'v2Forecast.disableAnalystMode',
                              'Disable analyst mode',
                            )
                          : t(
                              'v2Forecast.enableAnalystMode',
                              'Enable analyst mode',
                            )}
                      </button>
                      <button
                        type="button"
                        className="v2-btn"
                        onClick={() => setActiveWorkbench('cockpit')}
                      >
                        {t(
                          'v2Forecast.returnToCockpit',
                          'Back to overview',
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="v2-workbench-switcher">
                    <button
                      type="button"
                      className={`v2-btn ${
                        activeWorkbench === 'materials' ? 'v2-btn-primary' : ''
                      }`}
                      onClick={() => setActiveWorkbench('materials')}
                    >
                      {t(
                        'v2Forecast.pillarMaterials',
                        'Materialkostnader',
                      )}
                    </button>
                    <button
                      type="button"
                      className={`v2-btn ${
                        activeWorkbench === 'personnel' ? 'v2-btn-primary' : ''
                      }`}
                      onClick={() => setActiveWorkbench('personnel')}
                    >
                      {t(
                        'v2Forecast.pillarPersonnel',
                        'Personalkostnader',
                      )}
                    </button>
                    <button
                      type="button"
                      className={`v2-btn ${
                        activeWorkbench === 'otherOpex' ? 'v2-btn-primary' : ''
                      }`}
                      onClick={() => setActiveWorkbench('otherOpex')}
                    >
                      {t(
                        'v2Forecast.pillarOtherOpex',
                        'Ovriga rorelsekostnader',
                      )}
                    </button>
                  </div>

                  <div className="v2-statement-cockpit-grid">
                    <article className="v2-subcard v2-statement-card">
                      <div className="v2-section-header">
                        <div>
                          <h4>
                            {t(
                              'v2Forecast.workbenchOverviewTitle',
                              'Workbench overview',
                            )}
                          </h4>
                          <p className="v2-muted">
                            {t(
                              'v2Forecast.workbenchOverviewHint',
                              'Keep the cockpit context visible while tuning one operating-cost pillar at a time.',
                            )}
                          </p>
                        </div>
                        {showInlineFreshnessState ? (
                          <span className={`v2-badge ${forecastStateToneClass}`}>
                            {forecastStateLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.baselineLabel', 'Baseline')}</span>
                          <strong>{opexWorkbenchConfig.baseline}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('projection.scenario', 'Scenario')}</span>
                          <strong>{opexWorkbenchConfig.scenario}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                          <strong>{opexWorkbenchConfig.delta}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.analystModeLabel',
                              'Analyst mode',
                            )}
                          </span>
                          <strong>
                            {denseAnalystMode
                              ? t('common.yes', 'Yes')
                              : t('common.no', 'No')}
                          </strong>
                        </div>
                      </div>
                    </article>

                    <article className="v2-subcard v2-statement-card">
                      <div className="v2-section-header">
                        <div>
                          <h4>
                            {t(
                              'v2Forecast.nearTermExpenseTitle',
                              'Near-term expense assumptions (editable)',
                            )}
                          </h4>
                          <p className="v2-muted">
                            {denseAnalystMode
                              ? t(
                                  'v2Forecast.analystModeHint',
                                  'Dense analyst mode compresses the yearly editor for faster scanning.',
                                )
                              : t(
                                  'v2Forecast.workbenchEditHint',
                                  'Edit one pillar here without losing the surrounding cockpit context.',
                                )}
                          </p>
                        </div>
                      </div>
                      {hasNearTermValidationErrors ? (
                        <p className="v2-alert v2-alert-error">
                          {t(
                            'v2Forecast.nearTermValidationSummary',
                            'Fix highlighted near-term percentage fields before saving or computing.',
                          )}
                        </p>
                      ) : null}
                      <div
                        className={`v2-opex-workbench-grid${
                          denseAnalystMode ? ' dense' : ''
                        }`}
                      >
                        {opexWorkbenchRows.map((row) => (
                          <div
                            key={`${activeWorkbench}-${row.year}`}
                            className="v2-opex-workbench-row"
                          >
                            <strong>{row.year}</strong>
                            <span className="v2-muted">
                              {assumptionLabelByKey(
                                row.field === 'energyPct'
                                  ? 'energiakerroin'
                                  : row.field === 'personnelPct'
                                  ? 'henkilostokerroin'
                                  : 'inflaatio',
                              )}
                            </span>
                            <input
                              id={`opex-workbench-${row.field}-${row.year}`}
                              className={`v2-input${
                                row.error ? ' v2-input-invalid' : ''
                              }`}
                              type="text"
                              inputMode="decimal"
                              name={`opexWorkbench-${row.field}-${row.year}`}
                              aria-label={`${opexWorkbenchConfig.title} ${row.year}`}
                              value={row.value}
                              aria-invalid={row.error ? true : undefined}
                              onChange={(event) =>
                                handleNearTermExpenseChange(
                                  row.year,
                                  row.field,
                                  event.target.value,
                                )
                              }
                              onBlur={() =>
                                handleNearTermExpenseBlur(row.year, row.field)
                              }
                            />
                            {row.error ? (
                              <small className="v2-field-error">
                                {nearTermValidationMessage(row.error)}
                              </small>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </article>
                  </div>
                </section>
              ) : null}

              <section
                className={`v2-grid v2-grid-two v2-forecast-top-grid${
                  denseAnalystMode ? ' dense' : ''
                }`}
              >
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
                            ? 'v2-status-positive'
                            : baselineContext.quality === 'partial'
                            ? 'v2-status-warning'
                            : 'v2-status-neutral'
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
                    {showInlineFreshnessState ? (
                      <span className={`v2-badge ${forecastStateToneClass}`}>
                        {forecastStateLabel}
                      </span>
                    ) : null}
                  </div>
                  {reportReadinessHint ? (
                    <p className="v2-muted">{reportReadinessHint}</p>
                  ) : null}
                  <div className={`v2-kpi-strip ${forecastSurfaceToneClass}`}>
                    <div>
                      <h3>{t('v2Forecast.currentFeeLevel')}</h3>
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

              {investmentProgramSurface}

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

                </section>
              ) : null}
              </section>

              {activeWorkbench === 'depreciation' ? (
                <section className="v2-card v2-depreciation-workbench">
                  <div className="v2-forecast-workspace-head">
                    <div className="v2-forecast-workspace-copy">
                      <p className="v2-overview-eyebrow">
                        {t(
                          'v2Forecast.depreciationWorkbenchEyebrow',
                          'Poistosaannot',
                        )}
                      </p>
                      <h3>
                        {t(
                          'v2Forecast.depreciationWorkbenchTitle',
                          'Poistosaannot for future investments',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.depreciationWorkbenchHint',
                          'Choose the Poistosaanto, Poistotapa, and Poistoaika for future investments, then review the tariff and cash impact before reporting.',
                        )}
                      </p>
                    </div>
                    <div className="v2-actions-row">
                      <button
                        type="button"
                        className="v2-btn"
                        onClick={() => setActiveWorkbench('cockpit')}
                      >
                        {t(
                          'v2Forecast.returnToCockpit',
                          'Back to overview',
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="v2-statement-cockpit-grid">
                    <article className="v2-subcard v2-statement-card">
                      <div className="v2-section-header">
                        <div>
                          <h4>
                            {t(
                              'v2Forecast.depreciationPreviewTitle',
                              'Yearly depreciation preview',
                            )}
                          </h4>
                          <p className="v2-muted">
                            {t(
                              'v2Forecast.depreciationPreviewHint',
                              'Baseline, new-investment, and total depreciation stay visible while you adjust mappings and category rules.',
                            )}
                          </p>
                        </div>
                        <span className={`v2-badge ${reportReadinessToneClass}`}>
                          {reportReadinessLabel}
                        </span>
                      </div>
                      {reportReadinessReason === 'depreciationMappingIncomplete' ? (
                        <p className="v2-alert v2-alert-error">
                          {reportReadinessHint}
                        </p>
                      ) : null}
                      <div className="v2-kpi-strip v2-kpi-strip-three">
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.baselineDepreciationTitle',
                              'Basavskrivningar',
                            )}
                          </h3>
                          <p>{formatEur(baselineDepreciationTotal)}</p>
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.newInvestmentDepreciationTitle',
                              'Nya investeringars avskrivningar',
                            )}
                          </h3>
                          <p>{formatEur(newInvestmentDepreciationTotal)}</p>
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.totalDepreciationTitle',
                              'Total depreciation',
                            )}
                          </h3>
                          <p>{formatEur(totalDepreciationEffect)}</p>
                        </article>
                      </div>
                      <div className="v2-section-header">
                        <div>
                          <h4>
                            {t(
                              'v2Forecast.depreciationImpactTitle',
                              'Tariff and cash impact',
                            )}
                          </h4>
                          <p className="v2-muted">
                            {t(
                              'v2Forecast.depreciationImpactHint',
                              'Keep the funding consequence visible while you map investment years and adjust depreciation classes.',
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="v2-kpi-strip v2-depreciation-impact-strip">
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.depreciationImpactRequiredPrice',
                              'Required price today',
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
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.depreciationImpactRequiredIncrease',
                              'Required annual increase',
                            )}
                          </h3>
                          <p>
                            {formatPercent(
                              scenario.requiredAnnualIncreasePctAnnualResult ??
                                scenario.requiredAnnualIncreasePct ??
                                0,
                            )}
                          </p>
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.depreciationImpactUnderfunding',
                              'Underfunding starts',
                            )}
                          </h3>
                          <p>
                            {scenario.feeSufficiency.cumulativeCash
                              .underfundingStartYear ??
                              t('v2Forecast.noUnderfunding', 'None')}
                          </p>
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.depreciationImpactPeakGap',
                              'Peak cumulative gap',
                            )}
                          </h3>
                          <p>
                            {formatEur(
                              scenario.feeSufficiency.cumulativeCash.peakGap,
                            )}
                          </p>
                        </article>
                        <article>
                          <h3>
                            {t(
                              'v2Forecast.depreciationImpactHorizonCashflow',
                              'Horizon cashflow',
                            )}
                          </h3>
                          <p>
                            {latestCashflowPoint
                              ? formatEur(latestCashflowPoint.cashflow)
                              : t('v2Forecast.reportStateMissing', 'Missing')}
                          </p>
                        </article>
                      </div>
                      {depreciationPreviewRows.length === 0 ? (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.depreciationPreviewMissing',
                            'Compute the scenario to see the yearly depreciation preview.',
                          )}
                        </p>
                      ) : (
                        <div className="v2-statement-table" role="table">
                          <div
                            className="v2-statement-row v2-statement-row-head"
                            role="row"
                          >
                            <span>{t('common.year', 'Year')}</span>
                            <span>
                              {t(
                                'v2Forecast.baselineDepreciationTitle',
                                'Basavskrivningar',
                              )}
                            </span>
                            <span>
                              {t(
                                'v2Forecast.newInvestmentDepreciationTitle',
                                'Nya investeringars avskrivningar',
                              )}
                            </span>
                            <span>
                              {t(
                                'v2Forecast.totalDepreciationTitle',
                                'Total depreciation',
                              )}
                            </span>
                          </div>
                          {depreciationPreviewRows.map((row) => (
                            <div
                              className="v2-statement-row"
                              key={`depreciation-preview-${row.year}`}
                              role="row"
                            >
                              <strong>{row.year}</strong>
                              <span>{formatEur(row.baseline)}</span>
                              <span>{formatEur(row.scenario)}</span>
                              <span>{formatEur(row.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                    <article className="v2-subcard v2-statement-card">
                      <h4>
                        {t(
                          'v2Forecast.classAllocationTitle',
                          'Set a depreciation plan for each investment year',
                        )}
                      </h4>
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.classAllocationHint',
                          'Each investment year needs one saved plan before reporting.',
                        )}
                      </p>
                      <div className="v2-badge-row">
                        <span
                          className={`v2-badge ${
                            unmappedInvestmentYears.length > 0
                              ? 'v2-status-warning'
                              : 'v2-status-positive'
                          }`}
                        >
                          {unmappedInvestmentYears.length > 0
                            ? t(
                                'v2Forecast.mappingStatusBlocked',
                                'Report blocked',
                              )
                            : t(
                                'v2Forecast.mappingStatusReady',
                                'Ready for report',
                              )}
                        </span>
                        <span className="v2-badge v2-status-info">
                          {t(
                            'v2Forecast.mappingSavedYears',
                            '{{saved}}/{{total}} years saved',
                            {
                              saved: savedMappedInvestmentYearsCount,
                              total: plannedInvestmentYears.length,
                            },
                          )}
                        </span>
                      </div>
                      {unmappedInvestmentYears.length > 0 ? (
                        <p className="v2-alert v2-alert-error">
                          {t(
                            'v2Forecast.unmappedInvestmentYears',
                            'Unmapped investment years: {{years}}',
                            { years: unmappedInvestmentYears.join(', ') },
                          )}
                        </p>
                      ) : (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.allInvestmentsMapped',
                            'Every investment year has a saved depreciation plan.',
                          )}
                        </p>
                      )}
                      {depreciationClassKeys.length === 0 ? (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.classAllocationNoRules',
                            'Add at least one Poistosaanto below before mapping years.',
                          )}
                        </p>
                      ) : (
                        <div className="v2-class-allocation-table">
                          {draftInvestments
                            .filter((row) => row.amount > 0)
                            .map((row) => {
                              const hasSavedMapping =
                                savedMappedDepreciationClassByYear[row.year] != null;
                              const inferredOption =
                                inferredDepreciationClassOptionByYear[row.year];
                              const carryForwardSource =
                                previousSavedDepreciationClassByYear[row.year];
                              return (
                                <div
                                  key={`allocation-${row.year}`}
                                  className="v2-class-allocation-row"
                                >
                                  <strong>{row.year}</strong>
                                  <div className="v2-keyvalue-list">
                                    <div className="v2-keyvalue-row">
                                      <span>
                                        {t(
                                          'v2Forecast.yearlyInvestmentsEur',
                                          'Yearly investments (EUR)',
                                        )}
                                      </span>
                                      <strong>{formatEur(row.amount)}</strong>
                                    </div>
                                  </div>
                                  <label className="v2-field">
                                    <span>
                                      {t(
                                        'v2Forecast.depreciationCategory',
                                        'Poistosaanto',
                                      )}
                                    </span>
                                    <select
                                      className="v2-input"
                                      value={
                                        mappedDepreciationClassByYear[row.year] ?? ''
                                      }
                                      onChange={(event) =>
                                        handleAllocationDraftChange(
                                          row.year,
                                          event.target.value,
                                        )
                                      }
                                    >
                                      <option value="">
                                        {t('v2Forecast.unmapped', 'Unmapped')}
                                      </option>
                                      {depreciationClassOptions.map((option) => (
                                        <option key={option.key} value={option.key}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {!hasSavedMapping && inferredOption ? (
                                    <p className="v2-muted">
                                      {t(
                                        'v2Forecast.defaultMappingSuggestion',
                                        'Default suggestion ready: {{label}}. Save Poistosaannot to keep it for {{year}}.',
                                        {
                                          label: inferredOption.label,
                                          year: row.year,
                                        },
                                      )}
                                    </p>
                                  ) : null}
                                  {!hasSavedMapping && carryForwardSource ? (
                                    <div className="v2-actions-row">
                                      <button
                                        type="button"
                                        className="v2-btn v2-btn-small"
                                        onClick={() =>
                                          applyCarryForwardMapping(row.year)
                                        }
                                      >
                                        {t(
                                          'v2Forecast.carryForwardMapping',
                                          'Carry forward {{year}} mapping',
                                          {
                                            year:
                                              carryForwardSource.sourceYear ?? '',
                                          },
                                        )}
                                      </button>
                                    </div>
                                  ) : null}
                                  {!hasSavedMapping ? (
                                    <p className="v2-muted">
                                      {t(
                                        'v2Forecast.mappingRequiresSaveHint',
                                        'Reports stay blocked until this year is saved in Poistosaannot.',
                                      )}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      )}
                      <div className="v2-actions-row">
                        <button
                          type="button"
                          className="v2-btn"
                          disabled={busy || !selectedScenarioId}
                          onClick={saveClassAllocations}
                        >
                          {t(
                            'v2Forecast.saveClassAllocations',
                            'Save Poistosaannot',
                          )}
                        </button>
                      </div>
                    </article>
                  </div>

                  <section className="v2-grid v2-grid-two">
                    <article className="v2-subcard">
                      <h3>
                        {t(
                          'v2Forecast.depreciationRulesTitle',
                          'Depreciation plans',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.depreciationRulesHint',
                          'Define how each investment group is written off, then save the plan for the years above.',
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
                          'No depreciation plans yet. Add the first rule below.',
                        )}
                      </p>
                    ) : null}
                    {depreciationRuleDrafts.map((row, index) => (
                      <div
                        key={row.id ?? `new-rule-${index}`}
                        className="v2-depreciation-rule-row"
                      >
                        <label className="v2-field">
                          <span>{t('v2Forecast.classKey', 'Rule code')}</span>
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
                          <span>{t('v2Forecast.className', 'Plan name')}</span>
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
                          <span>{t('v2Forecast.method', 'Depreciation method')}</span>
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
                            <option value="straight-line">
                              {t(
                                'v2Forecast.methodStraightLine',
                                'Same amount each year',
                              )}
                            </option>
                            <option value="custom-annual-schedule">
                              {t(
                                'v2Forecast.methodCustomSchedule',
                                'Year-by-year schedule',
                              )}
                            </option>
                            <option value="residual">
                              {t(
                                'v2Forecast.methodResidual',
                                'Residual value',
                              )}
                            </option>
                            <option value="none">
                              {t('v2Forecast.methodNone', 'No depreciation')}
                            </option>
                          </select>
                        </label>
                        <label className="v2-field">
                          <span>
                            {t(
                              'v2Forecast.linearYearsLabel',
                              'Write-off time (years)',
                            )}
                          </span>
                          <input
                            className="v2-input"
                            type="number"
                            min="1"
                            max="120"
                            value={row.linearYears}
                            disabled={
                              row.method !== 'linear' &&
                              row.method !== 'straight-line'
                            }
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
                              'v2Forecast.annualScheduleLabel',
                              'Year-by-year split (%)',
                            )}
                          </span>
                          <input
                            className="v2-input"
                            type="text"
                            value={row.annualSchedule}
                            disabled={row.method !== 'custom-annual-schedule'}
                            onChange={(event) =>
                              handleDepreciationRuleDraftChange(
                                index,
                                'annualSchedule',
                                event.target.value,
                              )
                            }
                          />
                        </label>
                        <label className="v2-field">
                          <span>
                            {t(
                              'v2Forecast.residualPercentLabel',
                              'Residual share (%)',
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
                        'Add depreciation plan',
                      )}
                    </button>
                  </div>
                </article>

                    <article className="v2-subcard">
                      <h3>
                        {t(
                          'v2Forecast.depreciationStatusTitle',
                          'Saved mappings and report status',
                        )}
                      </h3>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.reportReadinessTitle',
                              'Report status',
                            )}
                          </span>
                          <strong>{reportReadinessLabel}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.mappedInvestmentYears',
                              'Saved investment years',
                            )}
                          </span>
                          <strong>{savedMappedInvestmentYearsCount}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.unmappedInvestmentYearsLabel',
                              'Years still blocking report',
                            )}
                          </span>
                          <strong>
                            {unmappedInvestmentYears.length > 0
                              ? unmappedInvestmentYears.join(', ')
                              : t('common.no', 'No')}
                          </strong>
                        </div>
                      </div>
                    </article>
                  </section>
                </section>
              ) : null}

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

                {baselineContext ? (
                  <article className="v2-subcard">
                    <div className="v2-section-header">
                      <div>
                        <h3>
                          {t(
                            'v2Forecast.outputsProvenanceTitle',
                            'Baseline source truth',
                          )}
                        </h3>
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.outputsProvenanceHint',
                            'Keep the same baseline source mix visible while comparing scenarios and reviewing charts.',
                          )}
                        </p>
                      </div>
                      <span className="v2-badge v2-status-provenance">
                        {baselineSourceStatusLabel(baselineContext.sourceStatus)}
                      </span>
                    </div>
                    <div className="v2-keyvalue-list">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t('v2Forecast.baselineFinancialsSource', 'Financials')}
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
                          {t('v2Forecast.baselineVolumesSource', 'Sold volumes')}
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
                      </p>
                    ) : null}
                  </article>
                ) : null}

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
                    {!loadingComparisonScenario && scenario.onOletus ? (
                      <p className="v2-muted">
                        {t(
                          'v2Forecast.baseComparisonBaseSelected',
                          'This is the base scenario. Open a stress scenario to compare the fee and cash outcomes.',
                        )}
                      </p>
                    ) : null}
                    {!loadingComparisonScenario &&
                    !scenario.onOletus &&
                    comparisonScenario &&
                    riskComparison ? (
                      <>
                        <div className="v2-kpi-strip v2-risk-delta-strip">
                          <article>
                            <h3>
                              {t(
                                'v2Forecast.requiredPriceDeltaTitle',
                                'Required price delta',
                              )}
                            </h3>
                            <p>
                              {`${riskComparison.requiredPriceDelta > 0 ? '+' : riskComparison.requiredPriceDelta < 0 ? '-' : ''}${formatPrice(Math.abs(riskComparison.requiredPriceDelta))}`}
                            </p>
                            <span
                              className={`v2-delta ${
                                riskComparison.requiredPriceDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.requiredPriceDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.requiredPriceDelta > 0
                                ? t('v2Forecast.riskDeltaWorse', 'Worse')
                                : riskComparison.requiredPriceDelta < 0
                                ? t('v2Forecast.riskDeltaBetter', 'Better')
                                : t('v2Forecast.riskDeltaNeutral', 'No change')}
                            </span>
                          </article>
                          <article>
                            <h3>
                              {t(
                                'v2Forecast.requiredIncreaseDeltaTitle',
                                'Annual increase delta',
                              )}
                            </h3>
                            <p>
                              {`${riskComparison.requiredIncreaseDelta > 0 ? '+' : riskComparison.requiredIncreaseDelta < 0 ? '-' : ''}${formatPercent(Math.abs(riskComparison.requiredIncreaseDelta))}`}
                            </p>
                            <span
                              className={`v2-delta ${
                                riskComparison.requiredIncreaseDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.requiredIncreaseDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.requiredIncreaseDelta > 0
                                ? t('v2Forecast.riskDeltaWorse', 'Worse')
                                : riskComparison.requiredIncreaseDelta < 0
                                ? t('v2Forecast.riskDeltaBetter', 'Better')
                                : t('v2Forecast.riskDeltaNeutral', 'No change')}
                            </span>
                          </article>
                          <article>
                            <h3>
                              {t(
                                'v2Forecast.annualUnderfundingDeltaTitle',
                                'Annual underfunding shift',
                              )}
                            </h3>
                            <p>
                              {riskComparison.annualUnderfundingEarlierBy > 0
                                ? t(
                                    'v2Forecast.underfundingEarlierBy',
                                    '{{years}} y earlier',
                                    {
                                      years:
                                        riskComparison.annualUnderfundingEarlierBy,
                                    },
                                  )
                                : riskComparison.annualUnderfundingEarlierBy < 0
                                ? t(
                                    'v2Forecast.underfundingLaterBy',
                                    '{{years}} y later',
                                    {
                                      years: Math.abs(
                                        riskComparison.annualUnderfundingEarlierBy,
                                      ),
                                    },
                                  )
                                : t(
                                    'v2Forecast.riskDeltaNeutral',
                                    'No change',
                                  )}
                            </p>
                            <span
                              className={`v2-delta ${
                                riskComparison.annualUnderfundingEarlierBy > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.annualUnderfundingEarlierBy < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.annualUnderfundingEarlierBy > 0
                                ? t('v2Forecast.riskDeltaWorse', 'Worse')
                                : riskComparison.annualUnderfundingEarlierBy < 0
                                ? t('v2Forecast.riskDeltaBetter', 'Better')
                                : t('v2Forecast.riskDeltaNeutral', 'No change')}
                            </span>
                          </article>
                          <article>
                            <h3>
                              {t(
                                'v2Forecast.peakGapDeltaTitle',
                                'Peak gap delta',
                              )}
                            </h3>
                            <p>
                              {`${riskComparison.peakGapDelta > 0 ? '+' : riskComparison.peakGapDelta < 0 ? '-' : ''}${formatEur(Math.abs(riskComparison.peakGapDelta))}`}
                            </p>
                            <span
                              className={`v2-delta ${
                                riskComparison.peakGapDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.peakGapDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.peakGapDelta > 0
                                ? t('v2Forecast.riskDeltaWorse', 'Worse')
                                : riskComparison.peakGapDelta < 0
                                ? t('v2Forecast.riskDeltaBetter', 'Better')
                                : t('v2Forecast.riskDeltaNeutral', 'No change')}
                            </span>
                          </article>
                        </div>
                        <div className="v2-risk-comparison-table">
                          <div className="v2-risk-comparison-row v2-risk-comparison-head">
                            <span>{t('v2Forecast.metric', 'Metric')}</span>
                            <span>{comparisonScenario.name}</span>
                            <span>{scenario.name}</span>
                            <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
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
                              {formatPrice(
                                feeMetricValue(scenario, 'requiredPrice') ?? 0,
                              )}
                            </strong>
                            <span
                              className={`v2-delta ${
                                riskComparison.requiredPriceDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.requiredPriceDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {`${riskComparison.requiredPriceDelta > 0 ? '+' : riskComparison.requiredPriceDelta < 0 ? '-' : ''}${formatPrice(Math.abs(riskComparison.requiredPriceDelta))}`}
                            </span>
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
                            <span
                              className={`v2-delta ${
                                riskComparison.requiredIncreaseDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.requiredIncreaseDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {`${riskComparison.requiredIncreaseDelta > 0 ? '+' : riskComparison.requiredIncreaseDelta < 0 ? '-' : ''}${formatPercent(Math.abs(riskComparison.requiredIncreaseDelta))}`}
                            </span>
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
                            <span
                              className={`v2-delta ${
                                riskComparison.annualUnderfundingEarlierBy > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.annualUnderfundingEarlierBy < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.annualUnderfundingEarlierBy > 0
                                ? t(
                                    'v2Forecast.underfundingEarlierBy',
                                    '{{years}} y earlier',
                                    {
                                      years:
                                        riskComparison.annualUnderfundingEarlierBy,
                                    },
                                  )
                                : riskComparison.annualUnderfundingEarlierBy < 0
                                ? t(
                                    'v2Forecast.underfundingLaterBy',
                                    '{{years}} y later',
                                    {
                                      years: Math.abs(
                                        riskComparison.annualUnderfundingEarlierBy,
                                      ),
                                    },
                                  )
                                : t(
                                    'v2Forecast.riskDeltaNeutral',
                                    'No change',
                                  )}
                            </span>
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
                            <span
                              className={`v2-delta ${
                                riskComparison.cashUnderfundingEarlierBy > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.cashUnderfundingEarlierBy < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {riskComparison.cashUnderfundingEarlierBy > 0
                                ? t(
                                    'v2Forecast.underfundingEarlierBy',
                                    '{{years}} y earlier',
                                    {
                                      years:
                                        riskComparison.cashUnderfundingEarlierBy,
                                    },
                                  )
                                : riskComparison.cashUnderfundingEarlierBy < 0
                                ? t(
                                    'v2Forecast.underfundingLaterBy',
                                    '{{years}} y later',
                                    {
                                      years: Math.abs(
                                        riskComparison.cashUnderfundingEarlierBy,
                                      ),
                                    },
                                  )
                                : t(
                                    'v2Forecast.riskDeltaNeutral',
                                    'No change',
                                  )}
                            </span>
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
                              {formatEur(
                                feeMetricValue(scenario, 'peakGap') ?? 0,
                              )}
                            </strong>
                            <span
                              className={`v2-delta ${
                                riskComparison.peakGapDelta > 0
                                  ? 'v2-delta-negative'
                                  : riskComparison.peakGapDelta < 0
                                  ? 'v2-delta-positive'
                                  : 'v2-delta-neutral'
                              }`}
                            >
                              {`${riskComparison.peakGapDelta > 0 ? '+' : riskComparison.peakGapDelta < 0 ? '-' : ''}${formatEur(Math.abs(riskComparison.peakGapDelta))}`}
                            </span>
                          </div>
                        </div>
                        <div className="v2-statement-comparison-grid">
                          <article className="v2-subcard v2-statement-card">
                            <div className="v2-section-header">
                              <div>
                                <h4>
                                  {t(
                                    'v2Forecast.statementComparisonTitle',
                                    'Derived result row comparison',
                                  )}
                                </h4>
                                <p className="v2-muted">
                                  {t(
                                    'v2Forecast.statementComparisonHint',
                                    'Compare the derived statement rows between the base scenario and the active scenario before finalizing the report path.',
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="v2-statement-table" role="table">
                              <div
                                className="v2-statement-row v2-statement-row-head"
                                role="row"
                              >
                                <span>{t('v2Forecast.metric', 'Metric')}</span>
                                <span>{comparisonScenario.name}</span>
                                <span>{scenario.name}</span>
                                <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                              </div>
                              {comparisonDerivedRows.map((row) => (
                                <div
                                  className="v2-statement-row"
                                  key={`comparison-row-${row.id}`}
                                  role="row"
                                >
                                  <strong>{row.label}</strong>
                                  <span>{row.baseline}</span>
                                  <span>{row.scenario}</span>
                                  <span>{row.delta}</span>
                                </div>
                              ))}
                            </div>
                          </article>
                          <article className="v2-subcard v2-statement-card">
                            <div className="v2-section-header">
                              <div>
                                <h4>
                                  {t(
                                    'v2Forecast.pillarComparisonTitle',
                                    'Five-pillar comparison',
                                  )}
                                </h4>
                                <p className="v2-muted">
                                  {t(
                                    'v2Forecast.pillarComparisonHint',
                                    'Review the five planning pillars as a comparison table instead of dropping back into separate drill-downs.',
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="v2-statement-table" role="table">
                              <div
                                className="v2-statement-row v2-statement-row-head"
                                role="row"
                              >
                                <span>{t('v2Forecast.metric', 'Metric')}</span>
                                <span>{comparisonScenario.name}</span>
                                <span>{scenario.name}</span>
                                <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                              </div>
                              {comparisonPillarRows.map((row) => (
                                <div
                                  className="v2-statement-row"
                                  key={`pillar-row-${row.id}`}
                                  role="row"
                                >
                                  <strong>{row.label}</strong>
                                  <span>{row.baseline}</span>
                                  <span>{row.scenario}</span>
                                  <span>{row.delta}</span>
                                </div>
                              ))}
                            </div>
                          </article>
                        </div>
                      </>
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
                    <div className="v2-report-readiness-panel">
                      <div className="v2-section-header">
                        <h4>
                          {t(
                            'v2Forecast.reportReadinessTitle',
                            'Report readiness',
                          )}
                        </h4>
                        <div className="v2-badge-row">
                          <span
                            className={`v2-badge ${reportReadinessToneClass}`}
                          >
                            {reportReadinessLabel}
                          </span>
                          <span className={`v2-badge ${forecastStateToneClass}`}>
                            {forecastStateLabel}
                          </span>
                        </div>
                      </div>
                      <p className="v2-muted">
                        {reportCommandSummary}
                      </p>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.computeStateLabel',
                              'Forecast state',
                            )}
                          </span>
                          <strong>{forecastStateLabel}</strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.reportComputeSource',
                              'Computed from version',
                            )}
                          </span>
                          <strong>
                            {computedVersionLabel}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.reportScenarioUpdated',
                              'Scenario updated',
                            )}
                          </span>
                          <strong>{formatScenarioUpdatedAt(scenario.updatedAt)}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                </section>

                <section className="v2-grid v2-grid-two">
                  <article className="v2-subcard">
                    <h3>{t('v2Forecast.pricePath', 'Price path')}</h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.pricePathHint',
                        'Review baseline-to-horizon tariff movement before finalizing the report output.',
                      )}
                    </p>
                    {showInlineFreshnessState ? (
                      <div className="v2-surface-authority-row">
                        <span className={`v2-badge ${forecastStateToneClass}`}>
                          {forecastStateLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className={`v2-chart-wrap ${forecastSurfaceToneClass}`}>
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
                    <div className="v2-keyvalue-list v2-chart-summary-list">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t('v2Forecast.currentFeeLevel')}
                        </span>
                        <strong>
                          {formatPrice(scenario.baselinePriceTodayCombined ?? 0)}
                        </strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t('v2Forecast.horizonCombinedPrice', 'Horizon combined')}
                        </span>
                        <strong>
                          {latestPricePoint
                            ? formatPrice(latestPricePoint.combinedPrice)
                            : t('v2Forecast.reportStateMissing')}
                        </strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Forecast.horizonServiceSplit',
                            'Horizon water / wastewater',
                          )}
                        </span>
                        <strong>
                          {latestPricePoint
                            ? `${formatPrice(latestPricePoint.waterPrice)} / ${formatPrice(latestPricePoint.wastewaterPrice)}`
                            : t('v2Forecast.reportStateMissing')}
                        </strong>
                      </div>
                    </div>
                  </article>

                  <article className="v2-subcard">
                    <h3>
                      {t(
                        'v2Forecast.cashflowAndCumulative',
                        'Cashflow and cumulative cash',
                      )}
                    </h3>
                    <p className="v2-muted">
                      {t(
                        'v2Forecast.cashflowHint',
                        'Use the horizon-end and lowest-cash checkpoints to judge financing resilience before report creation.',
                      )}
                    </p>
                    {showInlineFreshnessState ? (
                      <div className="v2-surface-authority-row">
                        <span className={`v2-badge ${forecastStateToneClass}`}>
                          {forecastStateLabel}
                        </span>
                      </div>
                    ) : null}
                    <div className={`v2-chart-wrap ${forecastSurfaceToneClass}`}>
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
                    <div className="v2-keyvalue-list v2-chart-summary-list">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t('v2Forecast.horizonCashflow', 'Horizon cashflow')}
                        </span>
                        <strong>
                          {latestCashflowPoint
                            ? formatEur(latestCashflowPoint.cashflow)
                            : t('v2Forecast.reportStateMissing')}
                        </strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Forecast.horizonCumulativeCash',
                            'Horizon cumulative cash',
                          )}
                        </span>
                        <strong>
                          {latestCashflowPoint
                            ? formatEur(latestCashflowPoint.cumulativeCashflow)
                            : t('v2Forecast.reportStateMissing')}
                        </strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Forecast.lowestCumulativeCash',
                            'Lowest cumulative cash',
                          )}
                        </span>
                        <strong>
                          {lowestCumulativeCashPoint
                            ? `${formatEur(lowestCumulativeCashPoint.cumulativeCashflow)} (${lowestCumulativeCashPoint.year})`
                            : t('v2Forecast.reportStateMissing')}
                        </strong>
                      </div>
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
