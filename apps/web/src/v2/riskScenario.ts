import type { V2ForecastScenario } from '../api';

export type RiskPresetId =
  | 'lower_volume'
  | 'higher_opex'
  | 'higher_energy'
  | 'higher_capex'
  | 'delayed_fee_increase'
  | 'financing_pressure';

type ScenarioAssumptionKey =
  | 'inflaatio'
  | 'energiakerroin'
  | 'henkilostokerroin'
  | 'vesimaaran_muutos'
  | 'hintakorotus'
  | 'investointikerroin';

const DEFAULT_SCENARIO_ASSUMPTIONS: Record<ScenarioAssumptionKey, number> = {
  inflaatio: 0.025,
  energiakerroin: 0.05,
  henkilostokerroin: 0,
  vesimaaran_muutos: -0.01,
  hintakorotus: 0.03,
  investointikerroin: 0.02,
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const MAX_YEARLY_INVESTMENT_EUR = 1_000_000_000;

const clampYearlyInvestment = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_YEARLY_INVESTMENT_EUR, Math.max(0, Math.round(value)));
};

const scenarioAssumptionValue = (
  assumptions: Record<string, number>,
  key: ScenarioAssumptionKey,
): number => {
  const numeric = assumptions[key];
  return Number.isFinite(numeric)
    ? Number(numeric)
    : DEFAULT_SCENARIO_ASSUMPTIONS[key];
};

const offsetNearTermExpenseRows = (
  rows: V2ForecastScenario['nearTermExpenseAssumptions'],
  field: 'personnelPct' | 'energyPct' | 'opexOtherPct',
  deltaPct: number,
): V2ForecastScenario['nearTermExpenseAssumptions'] =>
  rows.map((row) => ({
    ...row,
    [field]: round2(row[field] + deltaPct),
  }));

const scaleInvestmentRows = (
  rows: V2ForecastScenario['yearlyInvestments'],
  factor: number,
): V2ForecastScenario['yearlyInvestments'] =>
  rows.map((row) => ({
    ...row,
    amount: clampYearlyInvestment(row.amount * factor),
  }));

export const feeMetricValue = (
  scenario: V2ForecastScenario,
  metric:
    | 'requiredPrice'
    | 'requiredIncrease'
    | 'underfundingAnnual'
    | 'underfundingCash'
    | 'peakGap',
): number | null => {
  switch (metric) {
    case 'requiredPrice':
      return (
        scenario.feeSufficiency.annualResult.requiredPriceToday ??
        scenario.feeSufficiency.cumulativeCash.requiredPriceToday
      );
    case 'requiredIncrease':
      return (
        scenario.feeSufficiency.annualResult.requiredAnnualIncreasePct ??
        scenario.feeSufficiency.cumulativeCash.requiredAnnualIncreasePct
      );
    case 'underfundingAnnual':
      return scenario.feeSufficiency.annualResult.underfundingStartYear;
    case 'underfundingCash':
      return scenario.feeSufficiency.cumulativeCash.underfundingStartYear;
    case 'peakGap':
      return scenario.feeSufficiency.cumulativeCash.peakGap;
  }
};

export const buildRiskPresetUpdate = (
  presetId: RiskPresetId,
  currentScenario: V2ForecastScenario,
) => {
  const baseThereafter = currentScenario.thereafterExpenseAssumptions;

  switch (presetId) {
    case 'lower_volume':
      return {
        scenarioAssumptions: {
          vesimaaran_muutos: round4(
            scenarioAssumptionValue(
              currentScenario.assumptions,
              'vesimaaran_muutos',
            ) - 0.02,
          ),
        },
      };
    case 'higher_opex':
      return {
        nearTermExpenseAssumptions: offsetNearTermExpenseRows(
          currentScenario.nearTermExpenseAssumptions,
          'opexOtherPct',
          4,
        ),
        thereafterExpenseAssumptions: {
          ...baseThereafter,
          opexOtherPct: round2(baseThereafter.opexOtherPct + 4),
        },
      };
    case 'higher_energy':
      return {
        nearTermExpenseAssumptions: offsetNearTermExpenseRows(
          currentScenario.nearTermExpenseAssumptions,
          'energyPct',
          8,
        ),
        thereafterExpenseAssumptions: {
          ...baseThereafter,
          energyPct: round2(baseThereafter.energyPct + 8),
        },
      };
    case 'higher_capex':
      return {
        yearlyInvestments: scaleInvestmentRows(
          currentScenario.yearlyInvestments,
          1.15,
        ),
        scenarioAssumptions: {
          investointikerroin: round4(
            scenarioAssumptionValue(
              currentScenario.assumptions,
              'investointikerroin',
            ) + 0.02,
          ),
        },
      };
    case 'delayed_fee_increase':
      return {
        scenarioAssumptions: {
          hintakorotus: 0,
        },
      };
    case 'financing_pressure':
      return {
        yearlyInvestments: scaleInvestmentRows(
          currentScenario.yearlyInvestments,
          1.15,
        ),
        scenarioAssumptions: {
          hintakorotus: 0,
          investointikerroin: round4(
            scenarioAssumptionValue(
              currentScenario.assumptions,
              'investointikerroin',
            ) + 0.02,
          ),
          vesimaaran_muutos: round4(
            scenarioAssumptionValue(
              currentScenario.assumptions,
              'vesimaaran_muutos',
            ) - 0.01,
          ),
        },
      };
  }
};

export const buildRiskComparisonDelta = (
  baseScenario: V2ForecastScenario,
  stressScenario: V2ForecastScenario,
) => {
  const requiredPriceDelta =
    (feeMetricValue(stressScenario, 'requiredPrice') ?? 0) -
    (feeMetricValue(baseScenario, 'requiredPrice') ?? 0);
  const requiredIncreaseDelta =
    (feeMetricValue(stressScenario, 'requiredIncrease') ?? 0) -
    (feeMetricValue(baseScenario, 'requiredIncrease') ?? 0);
  const peakGapDelta =
    (feeMetricValue(stressScenario, 'peakGap') ?? 0) -
    (feeMetricValue(baseScenario, 'peakGap') ?? 0);
  const annualUnderfundingEarlierBy =
    (feeMetricValue(baseScenario, 'underfundingAnnual') ??
      Number.MAX_SAFE_INTEGER) -
    (feeMetricValue(stressScenario, 'underfundingAnnual') ??
      Number.MAX_SAFE_INTEGER);
  const cashUnderfundingEarlierBy =
    (feeMetricValue(baseScenario, 'underfundingCash') ??
      Number.MAX_SAFE_INTEGER) -
    (feeMetricValue(stressScenario, 'underfundingCash') ??
      Number.MAX_SAFE_INTEGER);

  return {
    requiredPriceDelta,
    requiredIncreaseDelta,
    peakGapDelta,
    annualUnderfundingEarlierBy,
    cashUnderfundingEarlierBy,
    materiallyWorse:
      requiredPriceDelta > 0.01 ||
      peakGapDelta > 0.01 ||
      annualUnderfundingEarlierBy > 0 ||
      cashUnderfundingEarlierBy > 0,
  };
};
