import { describe, expect, it } from 'vitest';
import type { V2ForecastScenario } from '../api';
import {
  buildRiskComparisonDelta,
  buildRiskPresetUpdate,
} from './riskScenario';

const buildScenario = (
  overrides: Partial<V2ForecastScenario> = {},
): V2ForecastScenario => ({
  id: 'scenario-1',
  name: 'Base',
  onOletus: false,
  talousarvioId: 'budget-1',
  baselineYear: 2024,
  horizonYears: 20,
  assumptions: {
    inflaatio: 0.025,
    energiakerroin: 0.05,
    vesimaaran_muutos: -0.01,
    hintakorotus: 0.03,
    investointikerroin: 0.02,
  },
  yearlyInvestments: [
    {
      year: 2024,
      amount: 100000,
      target: null,
      category: null,
      investmentType: null,
      confidence: null,
      waterAmount: null,
      wastewaterAmount: null,
      note: null,
    },
  ],
  nearTermExpenseAssumptions: [
    {
      year: 2024,
      personnelPct: 2,
      energyPct: 5,
      opexOtherPct: 3,
    },
  ],
  thereafterExpenseAssumptions: {
    personnelPct: 2,
    energyPct: 5,
    opexOtherPct: 3,
  },
  requiredPriceTodayCombined: null,
  baselinePriceTodayCombined: 2.5,
  requiredAnnualIncreasePct: null,
  requiredPriceTodayCombinedAnnualResult: null,
  requiredAnnualIncreasePctAnnualResult: null,
  requiredPriceTodayCombinedCumulativeCash: null,
  requiredAnnualIncreasePctCumulativeCash: null,
  feeSufficiency: {
    baselineCombinedPrice: 2.5,
    annualResult: {
      requiredPriceToday: 2.8,
      requiredAnnualIncreasePct: 12,
      underfundingStartYear: 2027,
      peakDeficit: 10000,
    },
    cumulativeCash: {
      requiredPriceToday: 3.0,
      requiredAnnualIncreasePct: 20,
      underfundingStartYear: 2026,
      peakGap: 50000,
    },
  },
  years: [],
  priceSeries: [],
  investmentSeries: [],
  cashflowSeries: [],
  createdAt: '2026-03-08T00:00:00.000Z',
  updatedAt: '2026-03-08T00:00:00.000Z',
  ...overrides,
});

describe('riskScenario helpers', () => {
  it('builds financing-pressure preset updates from the current scenario', () => {
    const scenario = buildScenario();

    const result = buildRiskPresetUpdate('financing_pressure', scenario);

    expect(result.scenarioAssumptions).toMatchObject({
      hintakorotus: 0,
      investointikerroin: 0.04,
      vesimaaran_muutos: -0.02,
    });
    expect(result.yearlyInvestments?.[0]?.amount).toBe(115000);
  });

  it('flags materially worse stress outcomes against the base scenario', () => {
    const baseScenario = buildScenario();
    const stressScenario = buildScenario({
      feeSufficiency: {
        baselineCombinedPrice: 2.5,
        annualResult: {
          requiredPriceToday: 3.2,
          requiredAnnualIncreasePct: 18,
          underfundingStartYear: 2026,
          peakDeficit: 15000,
        },
        cumulativeCash: {
          requiredPriceToday: 3.4,
          requiredAnnualIncreasePct: 24,
          underfundingStartYear: 2025,
          peakGap: 90000,
        },
      },
    });

    const result = buildRiskComparisonDelta(baseScenario, stressScenario);

    expect(result.materiallyWorse).toBe(true);
    expect(result.requiredPriceDelta).toBeCloseTo(0.4, 3);
    expect(result.peakGapDelta).toBe(40000);
    expect(result.cashUnderfundingEarlierBy).toBe(1);
  });
});
