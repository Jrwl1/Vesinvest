import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnnustePageV2 } from './EnnustePageV2';

const listForecastScenariosV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getPlanningContextV2 = vi.fn();
const listDepreciationRulesV2 = vi.fn();
const getScenarioClassAllocationsV2 = vi.fn();
const createForecastScenarioV2 = vi.fn();
const updateForecastScenarioV2 = vi.fn();
const deleteForecastScenarioV2 = vi.fn();
const computeForecastScenarioV2 = vi.fn();
const createReportV2 = vi.fn();
const createDepreciationRuleV2 = vi.fn();
const updateDepreciationRuleV2 = vi.fn();
const deleteDepreciationRuleV2 = vi.fn();
const updateScenarioClassAllocationsV2 = vi.fn();

const translate = (
  key: string,
  defaultValue?: string,
  options?: Record<string, unknown>,
) => {
  let out = defaultValue ?? key;
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: translate,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../api', () => ({
  createDepreciationRuleV2: (...args: unknown[]) =>
    createDepreciationRuleV2(...args),
  computeForecastScenarioV2: (...args: unknown[]) =>
    computeForecastScenarioV2(...args),
  createForecastScenarioV2: (...args: unknown[]) =>
    createForecastScenarioV2(...args),
  createReportV2: (...args: unknown[]) => createReportV2(...args),
  deleteDepreciationRuleV2: (...args: unknown[]) =>
    deleteDepreciationRuleV2(...args),
  deleteForecastScenarioV2: (...args: unknown[]) =>
    deleteForecastScenarioV2(...args),
  getScenarioClassAllocationsV2: (...args: unknown[]) =>
    getScenarioClassAllocationsV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getPlanningContextV2: (...args: unknown[]) => getPlanningContextV2(...args),
  listDepreciationRulesV2: (...args: unknown[]) =>
    listDepreciationRulesV2(...args),
  listForecastScenariosV2: (...args: unknown[]) =>
    listForecastScenariosV2(...args),
  updateDepreciationRuleV2: (...args: unknown[]) =>
    updateDepreciationRuleV2(...args),
  updateScenarioClassAllocationsV2: (...args: unknown[]) =>
    updateScenarioClassAllocationsV2(...args),
  updateForecastScenarioV2: (...args: unknown[]) =>
    updateForecastScenarioV2(...args),
}));

describe('EnnustePageV2', () => {
  beforeEach(() => {
    listForecastScenariosV2.mockReset();
    getForecastScenarioV2.mockReset();
    getPlanningContextV2.mockReset();
    listDepreciationRulesV2.mockReset();
    getScenarioClassAllocationsV2.mockReset();
    createForecastScenarioV2.mockReset();
    updateForecastScenarioV2.mockReset();
    deleteForecastScenarioV2.mockReset();
    computeForecastScenarioV2.mockReset();
    createReportV2.mockReset();
    createDepreciationRuleV2.mockReset();
    updateDepreciationRuleV2.mockReset();
    deleteDepreciationRuleV2.mockReset();
    updateScenarioClassAllocationsV2.mockReset();

    listForecastScenariosV2.mockResolvedValue([
      {
        id: 'stress-1',
        name: 'Stress scenario',
        baselineYear: 2024,
        horizonYears: 20,
        updatedAt: '2026-03-09T08:00:00.000Z',
        computedYears: 20,
        onOletus: false,
      },
      {
        id: 'base-1',
        name: 'Base scenario',
        baselineYear: 2024,
        horizonYears: 20,
        updatedAt: '2026-03-09T07:00:00.000Z',
        computedYears: 20,
        onOletus: true,
      },
    ]);

    const baseScenario = {
      id: 'base-1',
      name: 'Base scenario',
      onOletus: true,
      talousarvioId: 'budget-1',
      baselineYear: 2024,
      horizonYears: 20,
      assumptions: {
        inflaatio: 0.025,
        energiakerroin: 0.03,
        henkilostokerroin: 0.01,
        vesimaaran_muutos: -0.01,
        hintakorotus: 0.03,
        investointikerroin: 0.02,
      },
      nearTermExpenseAssumptions: [
        { year: 2024, personnelPct: 2, energyPct: 3, opexOtherPct: 2 },
        { year: 2025, personnelPct: 2, energyPct: 3, opexOtherPct: 2 },
      ],
      thereafterExpenseAssumptions: {
        personnelPct: 2,
        energyPct: 3,
        opexOtherPct: 2,
      },
      yearlyInvestments: [
        {
          year: 2024,
          amount: 120000,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Base renewal',
        },
        {
          year: 2025,
          amount: 125000,
          category: 'plant',
          investmentType: 'new',
          confidence: 'medium',
          note: 'Expansion',
        },
      ],
      requiredPriceTodayCombined: 2.7,
      baselinePriceTodayCombined: 2.4,
      requiredAnnualIncreasePct: 0.08,
      requiredPriceTodayCombinedAnnualResult: 2.7,
      requiredAnnualIncreasePctAnnualResult: 0.08,
      requiredPriceTodayCombinedCumulativeCash: 2.8,
      requiredAnnualIncreasePctCumulativeCash: 0.09,
      feeSufficiency: {
        baselineCombinedPrice: 2.4,
        annualResult: {
          requiredPriceToday: 2.7,
          requiredAnnualIncreasePct: 0.08,
          underfundingStartYear: 2029,
          peakDeficit: 30000,
        },
        cumulativeCash: {
          requiredPriceToday: 2.8,
          requiredAnnualIncreasePct: 0.09,
          underfundingStartYear: 2028,
          peakGap: 90000,
        },
      },
      years: [{ year: 2024 }],
      priceSeries: [
        {
          year: 2024,
          combinedPrice: 2.4,
          waterPrice: 1.2,
          wastewaterPrice: 1.2,
        },
        {
          year: 2043,
          combinedPrice: 3.1,
          waterPrice: 1.55,
          wastewaterPrice: 1.55,
        },
      ],
      investmentSeries: [
        { year: 2024, amount: 120000 },
        { year: 2025, amount: 125000 },
      ],
      cashflowSeries: [
        { year: 2024, cashflow: 20000, cumulativeCashflow: 20000 },
        { year: 2043, cashflow: 12000, cumulativeCashflow: 65000 },
      ],
      updatedAt: '2026-03-09T07:00:00.000Z',
      createdAt: '2026-03-09T06:00:00.000Z',
    };

    const stressScenario = {
      ...baseScenario,
      id: 'stress-1',
      name: 'Stress scenario',
      onOletus: false,
      requiredPriceTodayCombined: 3,
      requiredPriceTodayCombinedAnnualResult: 3,
      requiredPriceTodayCombinedCumulativeCash: 3.2,
      requiredAnnualIncreasePct: 0.12,
      requiredAnnualIncreasePctAnnualResult: 0.12,
      requiredAnnualIncreasePctCumulativeCash: 0.14,
      feeSufficiency: {
        baselineCombinedPrice: 2.4,
        annualResult: {
          requiredPriceToday: 3,
          requiredAnnualIncreasePct: 0.12,
          underfundingStartYear: 2027,
          peakDeficit: 55000,
        },
        cumulativeCash: {
          requiredPriceToday: 3.2,
          requiredAnnualIncreasePct: 0.14,
          underfundingStartYear: 2026,
          peakGap: 180000,
        },
      },
      priceSeries: [
        {
          year: 2024,
          combinedPrice: 2.4,
          waterPrice: 1.2,
          wastewaterPrice: 1.2,
        },
        {
          year: 2043,
          combinedPrice: 3.6,
          waterPrice: 1.8,
          wastewaterPrice: 1.8,
        },
      ],
      cashflowSeries: [
        { year: 2024, cashflow: -10000, cumulativeCashflow: -10000 },
        { year: 2043, cashflow: -25000, cumulativeCashflow: -140000 },
      ],
      updatedAt: '2026-03-09T08:00:00.000Z',
    };

    getForecastScenarioV2.mockImplementation(async (id: string) => {
      if (id === 'base-1') return baseScenario;
      return stressScenario;
    });

    getPlanningContextV2.mockResolvedValue({
      canCreateScenario: true,
      baselineYears: [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          financials: {
            source: 'manual',
            provenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
            },
          },
          prices: { source: 'veeti', provenance: null },
          volumes: { source: 'veeti', provenance: null },
          investmentAmount: 245000,
          soldWaterVolume: 24000,
          soldWastewaterVolume: 23000,
          pumpedWaterVolume: 52000,
          netWaterTradeVolume: 0,
          processElectricity: 4100,
        },
      ],
    });

    listDepreciationRulesV2.mockResolvedValue([
      {
        id: 'rule-1',
        assetClassKey: 'network',
        assetClassName: 'Network',
        method: 'linear',
        linearYears: 40,
        residualPercent: null,
      },
    ]);

    getScenarioClassAllocationsV2.mockResolvedValue({
      years: [
        {
          year: 2024,
          allocations: [{ classKey: 'network', sharePct: 100 }],
        },
        {
          year: 2025,
          allocations: [{ classKey: 'network', sharePct: 100 }],
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders refreshed planning, comparison, and readiness surfaces for a stress scenario', async () => {
    render(<EnnustePageV2 onReportCreated={() => undefined} />);

    expect(await screen.findByText('Planning inputs')).toBeTruthy();
    expect(screen.getByText('Editable planning controls')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Yearly investments (EUR)' }),
    ).toBeTruthy();
    expect(screen.getByText('Outcome review')).toBeTruthy();
    expect(screen.getByText('Report readiness')).toBeTruthy();
    expect(screen.getByText('Blocked')).toBeTruthy();
    expect(screen.getAllByText('Saved, needs recompute').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText('Recompute results before creating report.').length,
    ).toBeGreaterThan(0);
    expect(await screen.findByText('Delta')).toBeTruthy();
    expect(await screen.findByText('Horizon combined')).toBeTruthy();
    expect(await screen.findByText('Lowest cumulative cash')).toBeTruthy();
    expect(screen.getAllByText('Volume').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getForecastScenarioV2).toHaveBeenCalledWith('stress-1');
      expect(getForecastScenarioV2).toHaveBeenCalledWith('base-1');
    });
  });
});
