import type { TFunction } from 'i18next';

import type {
  V2ForecastScenario,
  V2OverrideProvenance,
  V2ReportDetail,
} from '../api';

export type ReportVariant = 'public_summary' | 'confidential_appendix';

export type ForecastFreshnessState =
  | 'unsaved_changes'
  | 'saved_needs_recompute'
  | 'computing'
  | 'current';

export type ReportReadinessReason =
  | 'missingScenario'
  | 'unsavedChanges'
  | 'missingComputeResults'
  | 'missingDepreciationSnapshots'
  | 'staleComputeResults'
  | 'classificationReviewRequired'
  | 'missingActivePlan'
  | 'missingAcceptedTariffPlan'
  | 'staleSavedFeePath';

export type ForecastRuntimeState = {
  selectedScenarioId: string | null;
};

const FORECAST_RUNTIME_STORAGE_KEY = 'v2_forecast_runtime_state';

export const REPORT_VARIANT_OPTIONS: Array<{
  id: ReportVariant;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
  sections: {
    baselineSources: boolean;
    investmentPlan: boolean;
    assumptions: boolean;
    yearlyInvestments: boolean;
    riskSummary: boolean;
  };
}> = [
  {
    id: 'public_summary',
    labelKey: 'v2Reports.variantPublic',
    label: 'Public summary',
    descriptionKey: 'v2Reports.variantPublicHint',
    description:
      'Shows tariff path, grouped investment plan, and baseline context without the detailed assumptions or yearly investment rows.',
    sections: {
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    },
  },
  {
    id: 'confidential_appendix',
    labelKey: 'v2Reports.variantConfidential',
    label: 'Confidential appendix',
    descriptionKey: 'v2Reports.variantConfidentialHint',
    description:
      'Adds assumptions and detailed yearly investment rows on top of the grouped investment plan and summary.',
    sections: {
      baselineSources: true,
      investmentPlan: true,
      assumptions: true,
      yearlyInvestments: true,
      riskSummary: true,
    },
  },
];

export const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  perusmaksuMuutos: 'assumptions.baseFeeChange',
  investointikerroin: 'assumptions.investmentFactor',
};

export const formatScenarioUpdatedAt = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const appendDetailSuffix = (
  base: string,
  suffixes: Array<string | null | undefined>,
): string => {
  const details = suffixes.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return details.length > 0 ? `${base} | ${details.join(' | ')}` : base;
};

export const stripTrailingParenthetical = (value: string): string =>
  value.replace(/\s*\([^)]*\)\s*$/u, '');

export const normalizeAcceptedBaselineYears = (
  values: Array<number | null | undefined>,
): number[] =>
  [
    ...new Set(
      values
        .filter((value): value is number => Number.isFinite(value))
        .map((value) => Math.trunc(value)),
    ),
  ].sort((left, right) => left - right);

export const resolveAcceptedBaselineYears = (
  snapshot: V2ReportDetail['snapshot'] | null | undefined,
): number[] => {
  const explicitYears = normalizeAcceptedBaselineYears(
    snapshot?.acceptedBaselineYears ?? [],
  );
  if (explicitYears.length > 0) {
    return explicitYears;
  }
  return normalizeAcceptedBaselineYears([
    ...(snapshot?.baselineSourceSummaries ?? []).map((summary) => summary?.year),
    snapshot?.baselineSourceSummary?.year,
  ]);
};

export const formatDepreciationMethod = (
  item: {
    method: string;
    linearYears: number | null;
    residualPercent: number | null;
  },
  t: TFunction,
): string | null => {
  switch (item.method) {
    case 'straight-line':
      return t('v2Forecast.methodStraightLine', 'Straight-line {{years}} years', {
        years: item.linearYears ?? 0,
      });
    case 'linear':
      return t('v2Forecast.methodLinear', 'Linear');
    case 'residual':
      return t('v2Forecast.methodResidual', 'Residual {{percent}} %', {
        percent: item.residualPercent ?? 0,
      });
    case 'none':
      return t('v2Forecast.methodNone', 'No depreciation');
    default:
      return null;
  }
};

export const formatInvestmentSnapshotMethod = (
  item: V2ForecastScenario['yearlyInvestments'][number],
  t: TFunction,
): string | null => {
  const snapshot = item.depreciationRuleSnapshot;
  if (!snapshot) return null;
  return formatDepreciationMethod(snapshot, t);
};

export const formatServiceSplitLabel = (
  value: 'water' | 'wastewater' | 'mixed',
  t: TFunction,
) => {
  switch (value) {
    case 'water':
      return t('v2Forecast.investmentServiceSplitWater', 'Water');
    case 'wastewater':
      return t('v2Forecast.investmentServiceSplitWastewater', 'Wastewater');
    default:
      return t('v2Forecast.investmentServiceSplitMixed', 'Mixed');
  }
};

export const readForecastRuntimeState = (): ForecastRuntimeState => {
  if (typeof window === 'undefined') {
    return { selectedScenarioId: null };
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return { selectedScenarioId: null };
    }

    const parsed = JSON.parse(raw) as {
      selectedScenarioId?: unknown;
    };

    return {
      selectedScenarioId:
        typeof parsed.selectedScenarioId === 'string'
          ? parsed.selectedScenarioId
          : null,
    };
  } catch {
    return { selectedScenarioId: null };
  }
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

export const deriveReportReadinessReason = ({
  scenario,
  forecastFreshnessState,
}: {
  scenario: V2ForecastScenario | null;
  forecastFreshnessState: ForecastFreshnessState;
}): ReportReadinessReason | null => {
  if (!scenario) return 'missingScenario';
  if (forecastFreshnessState === 'computing') return 'missingComputeResults';
  if (forecastFreshnessState === 'unsaved_changes') return 'unsavedChanges';
  if (forecastFreshnessState === 'saved_needs_recompute') {
    if (scenario.years.length === 0) return 'missingComputeResults';
    return 'staleComputeResults';
  }
  if (
    scenario.yearlyInvestments.some(
      (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
    )
  ) {
    return 'missingDepreciationSnapshots';
  }
  return null;
};

export const hasManualBaselineOverride = (
  provenance: V2OverrideProvenance | null | undefined,
): boolean => provenance?.kind === 'manual_edit';
