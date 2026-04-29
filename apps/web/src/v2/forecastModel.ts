import type {
  V2DepreciationRule,
  V2ForecastScenario,
  V2ForecastScenarioType,
  V2YearlyInvestmentPlanInput,
  V2YearlyInvestmentPlanRow,
} from '../api';
import { getActiveDateLocale } from './activeDateLocale';
import { formatEur } from './format';
import type { RiskPresetId } from './riskScenario';

export const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  perusmaksuMuutos: 'assumptions.baseFeeChange',
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
export type { RiskPresetDefinition };

export const RISK_PRESETS: RiskPresetDefinition[] = [
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
    description:
      'Raises non-energy operating cost growth in the near term and thereafter.',
    impactKey: 'v2Forecast.riskImpactOpex',
    impact: 'OPEX',
  },
  {
    id: 'higher_energy',
    titleKey: 'v2Forecast.riskPresetHigherEnergy',
    title: 'Higher energy',
    descriptionKey: 'v2Forecast.riskPresetHigherEnergyHint',
    description:
      'Raises energy cost growth in the near term and thereafter.',
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
    description:
      'Combines delayed fee reaction with higher capex and lower volume.',
    impactKey: 'v2Forecast.riskImpactCombined',
    impact: 'Combined',
  },
];

export const INVESTMENT_PROGRAM_GROUP_OPTION_DEFS = [
  {
    key: 'v2Forecast.investmentProgramGroupJointNewNetwork',
    fallback: 'New network together with the technical department',
  },
  {
    key: 'v2Forecast.investmentProgramGroupJointRehabNetwork',
    fallback:
      'Rehabilitation of the current network together with the technical department',
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

export const normalizeInvestmentMappingLabel = (
  value: string | null | undefined,
) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const round4 = (value: number): number =>
  Math.round(value * 10000) / 10000;
export const round2 = (value: number): number =>
  Math.round(value * 100) / 100;
export const toPercentPoints = (
  value: number | null | undefined,
): number => {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.abs(value) <= 1 ? value * 100 : value;
};
export const formatSignedEur = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatEur(Math.abs(value))}`;
export const parseAssumptionPercentInput = (rawValue: string): number => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return round4(parsed / 100);
};
export const MAX_YEARLY_INVESTMENT_EUR = 1_000_000_000;

export const clampYearlyInvestment = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_YEARLY_INVESTMENT_EUR, Math.max(0, Math.round(value)));
};

export const resolveInvestmentProgramTotal = (
  row: Pick<
    V2YearlyInvestmentPlanRow,
    'amount' | 'waterAmount' | 'wastewaterAmount'
  >,
): number => {
  if (row.waterAmount == null && row.wastewaterAmount == null) {
    return clampYearlyInvestment(row.amount);
  }
  return clampYearlyInvestment(
    (row.waterAmount ?? 0) + (row.wastewaterAmount ?? 0),
  );
};

export const formatScenarioUpdatedAt = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(getActiveDateLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const investmentsEqual = (
  a: V2YearlyInvestmentPlanRow[],
  b: V2YearlyInvestmentPlanRow[],
): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if ((left.rowId ?? '') !== (right.rowId ?? '')) return false;
    if (left.year !== right.year) return false;
    if (round4(left.amount) !== round4(right.amount)) return false;
    if ((left.target ?? '') !== (right.target ?? '')) return false;
    if ((left.category ?? '') !== (right.category ?? '')) return false;
    if ((left.depreciationClassKey ?? '') !== (right.depreciationClassKey ?? '')) {
      return false;
    }
    if ((left.investmentType ?? '') !== (right.investmentType ?? '')) {
      return false;
    }
    if ((left.confidence ?? '') !== (right.confidence ?? '')) return false;
    if (round4(left.waterAmount ?? -1) !== round4(right.waterAmount ?? -1)) {
      return false;
    }
    if (
      round4(left.wastewaterAmount ?? -1) !== round4(right.wastewaterAmount ?? -1)
    ) {
      return false;
    }
    if ((left.note ?? '') !== (right.note ?? '')) return false;
    if ((left.vesinvestPlanId ?? '') !== (right.vesinvestPlanId ?? '')) {
      return false;
    }
    if ((left.vesinvestProjectId ?? '') !== (right.vesinvestProjectId ?? '')) {
      return false;
    }
    if ((left.allocationId ?? '') !== (right.allocationId ?? '')) return false;
    if ((left.projectCode ?? '') !== (right.projectCode ?? '')) return false;
    if ((left.groupKey ?? '') !== (right.groupKey ?? '')) return false;
    if ((left.accountKey ?? '') !== (right.accountKey ?? '')) return false;
    if ((left.reportGroupKey ?? '') !== (right.reportGroupKey ?? '')) return false;
  }
  return true;
};

export type NearTermExpenseRow = {
  year: number;
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

export type NearTermField = 'personnelPct' | 'energyPct' | 'opexOtherPct';

export const NEAR_TERM_FIELDS: NearTermField[] = [
  'personnelPct',
  'energyPct',
  'opexOtherPct',
];

export type NearTermValidationCode = 'required' | 'invalid' | 'outOfRange';

export type NearTermValidationErrors = Record<
  number,
  Partial<Record<NearTermField, NearTermValidationCode>>
>;

export type NearTermExpenseDraftText = Record<
  number,
  Record<NearTermField, string>
>;

export type ForecastOperationState =
  | 'idle'
  | 'creating'
  | 'saving'
  | 'computing'
  | 'deleting';

export type ForecastFreshnessState =
  | 'unsaved_changes'
  | 'saved_needs_recompute'
  | 'computing'
  | 'current';

export type ForecastWorkbench =
  | 'cockpit'
  | 'investments'
  | 'revenue'
  | 'materials'
  | 'personnel'
  | 'depreciation'
  | 'otherOpex';

export type ReportReadinessReason =
  | 'missingScenario'
  | 'unsavedChanges'
  | 'missingComputeResults'
  | 'depreciationMappingIncomplete'
  | 'classificationReviewRequired'
  | 'missingDepreciationSnapshots'
  | 'staleComputeToken';

export type DepreciationRuleDraft = {
  id?: string;
  assetClassKey: string;
  assetClassName: string;
  method: 'residual' | 'straight-line' | 'none';
  linearYears: string;
  residualPercent: string;
};

export type ClassAllocationDraftByYear = Record<
  number,
  Record<string, string>
>;

export const nearTermExpenseEqual = (
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

export const toNearTermExpenseDraftText = (
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

export const parseNearTermPercent = (rawValue: string): number | null => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const toDepreciationRuleDraft = (
  rule: V2DepreciationRule,
): DepreciationRuleDraft => ({
  id: rule.id,
  assetClassKey: rule.assetClassKey,
  assetClassName: rule.assetClassName ?? '',
  method:
    rule.method === 'linear' || rule.method === 'custom-annual-schedule'
      ? 'straight-line'
      : rule.method,
  linearYears:
    rule.linearYears == null || !Number.isFinite(rule.linearYears)
      ? ''
      : String(rule.linearYears),
  residualPercent:
    rule.residualPercent == null || !Number.isFinite(rule.residualPercent)
      ? ''
      : String(rule.residualPercent),
});

export const getDepreciationRuleGroup = (assetClassKey: string): string => {
  if (assetClassKey.startsWith('plant_') || assetClassKey.startsWith('economic_')) {
    return 'buildings';
  }
  if (assetClassKey.startsWith('water_network_')) {
    return 'water-network';
  }
  if (assetClassKey.startsWith('wastewater_network_')) {
    return 'wastewater-network';
  }
  if (assetClassKey === 'it_equipment' || assetClassKey === 'other_equipment') {
    return 'equipment';
  }
  if (assetClassKey === 'ongoing_acquisitions') {
    return 'ongoing';
  }
  return 'other';
};

export const REVENUE_ASSUMPTION_KEYS = [
  'vesimaaran_muutos',
  'hintakorotus',
  'perusmaksuMuutos',
] as const;

export const EDITABLE_SCENARIO_TYPES: Array<
  Exclude<V2ForecastScenarioType, 'base'>
> = ['committed', 'hypothesis', 'stress'];

export const getScenarioTypeToneClass = (
  scenarioType: V2ForecastScenarioType,
): string => {
  if (scenarioType === 'base') return 'v2-status-info';
  if (scenarioType === 'committed') return 'v2-status-positive';
  if (scenarioType === 'stress') return 'v2-status-warning';
  return 'v2-status-neutral';
};

export const OPEX_WORKBENCH_FIELDS = {
  materials: 'energyPct',
  personnel: 'personnelPct',
  otherOpex: 'opexOtherPct',
} as const satisfies Record<string, NearTermField>;

export const buildClassAllocationDraftByYear = (
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
        Number.isFinite(yearSource[classKey]) ? String(yearSource[classKey]) : '',
      ]),
    );
  }
  return out;
};

export const resolveSingleMappedDepreciationClass = (
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

export const validateNearTermPercent = (
  rawValue: string,
): NearTermValidationCode | null => {
  const normalized = rawValue.trim().replace(',', '.');
  if (normalized.length === 0) return 'required';
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 'invalid';
  if (parsed < -100 || parsed > 100) return 'outOfRange';
  return null;
};

export const deriveForecastFreshnessState = ({
  scenario,
  hasUnsavedChanges,
  isComputing,
}: {
  scenario: V2ForecastScenario | null;
  hasUnsavedChanges: boolean;
  isComputing: boolean;
}): ForecastFreshnessState => {
  if (isComputing) return 'computing';
  if (!scenario) return 'saved_needs_recompute';
  if (hasUnsavedChanges) return 'unsaved_changes';
  if (
    scenario.years.length === 0 ||
    !scenario.computedFromUpdatedAt ||
    scenario.computedFromUpdatedAt !== scenario.updatedAt
  ) {
    return 'saved_needs_recompute';
  }
  return 'current';
};

export const mergeSavedScenarioPreservingComputedOutputs = (
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

export const toYearlyInvestmentInput = (
  row: V2YearlyInvestmentPlanRow,
  depreciationClassKey: string | null,
): V2YearlyInvestmentPlanInput => ({
  year: row.year,
  amount: row.amount,
  target: row.target ?? null,
  category: row.category ?? null,
  depreciationClassKey,
  investmentType: row.investmentType ?? null,
  confidence: row.confidence ?? null,
  waterAmount: row.waterAmount ?? null,
  wastewaterAmount: row.wastewaterAmount ?? null,
  note: row.note ?? null,
  vesinvestPlanId: row.vesinvestPlanId ?? null,
  vesinvestProjectId: row.vesinvestProjectId ?? null,
  allocationId: row.allocationId ?? null,
  projectCode: row.projectCode ?? null,
  groupKey: row.groupKey ?? null,
  accountKey: row.accountKey ?? null,
  reportGroupKey: row.reportGroupKey ?? null,
});
