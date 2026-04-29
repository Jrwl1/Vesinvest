import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en.json';
import { EnnustePageV2 } from '../../EnnustePageV2';

const listForecastScenariosV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getPlanningContextV2 = vi.fn();
const listDepreciationRulesV2 = vi.fn();
const listScenarioDepreciationRulesV2 = vi.fn();
const createScenarioDepreciationRuleV2 = vi.fn();
const updateScenarioDepreciationRuleV2 = vi.fn();
const deleteScenarioDepreciationRuleV2 = vi.fn();
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

function expectNoDuplicateIds(container: HTMLElement) {
  const counts = new Map<string, number>();
  for (const element of Array.from(container.querySelectorAll('[id]'))) {
    counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
  }
  const duplicates = Array.from(counts.entries()).filter(
    ([, count]) => count > 1,
  );
  expect(duplicates).toEqual([]);
}

async function openInvestmentWorkbench() {
  fireEvent.click(
    await screen.findByRole('button', { name: 'Investment program' }),
  );
  return (await screen.findByRole('textbox', {
    name: 'Scenario name',
  })).closest('section') as HTMLElement;
}

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const translate = (
  key: string,
  defaultValueOrOptions?: string | Record<string, unknown>,
  maybeOptions?: Record<string, unknown>,
) => {
  const defaultValue =
    typeof defaultValueOrOptions === 'string'
      ? defaultValueOrOptions
      : undefined;
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  const resolved = pick(en as Record<string, unknown>, key);
  let out =
    typeof resolved === 'string' ? resolved : (defaultValue ?? key);
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

const buildBaseScenario = () => ({
  id: 'base-1',
  name: 'Base scenario',
  onOletus: true,
  scenarioType: 'base',
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
      target: 'Main line renewal',
      category: 'network',
      vesinvestPlanId: 'plan-1',
      vesinvestProjectId: 'project-1',
      allocationId: 'allocation-2024',
      projectCode: 'P-001',
      groupKey: 'sanering_water_network',
      accountKey: 'sanering_water_network',
      reportGroupKey: 'network_rehabilitation',
      depreciationClassKey: 'network',
      depreciationRuleSnapshot: {
        assetClassKey: 'network',
        assetClassName: 'Network',
        method: 'straight-line',
        linearYears: 40,
        residualPercent: null,
      },
      investmentType: 'replacement',
      confidence: 'high',
      waterAmount: 70000,
      wastewaterAmount: 50000,
      note: 'Base renewal',
    },
    {
      year: 2025,
      amount: 125000,
      target: 'Plant expansion',
      category: 'plant',
      vesinvestPlanId: 'plan-1',
      vesinvestProjectId: 'project-2',
      allocationId: 'allocation-2025',
      projectCode: 'P-002',
      groupKey: 'wastewater_treatment',
      accountKey: 'wastewater_treatment',
      reportGroupKey: 'treatment',
      depreciationClassKey: 'plant',
      depreciationRuleSnapshot: {
        assetClassKey: 'plant',
        assetClassName: 'Plant',
        method: 'residual',
        linearYears: null,
        residualPercent: 10,
      },
      investmentType: 'new',
      confidence: 'medium',
      waterAmount: 45000,
      wastewaterAmount: 80000,
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
  years: [
    {
      year: 2024,
      revenue: 0,
      costs: 0,
      result: 0,
      investments: 120000,
      baselineDepreciation: 50000,
      investmentDepreciation: 12000,
      totalDepreciation: 62000,
      combinedPrice: 2.4,
      soldVolume: 47000,
      cashflow: 20000,
      cumulativeCashflow: 20000,
      waterPrice: 1.2,
      wastewaterPrice: 1.2,
    },
    {
      year: 2025,
      revenue: 0,
      costs: 0,
      result: 0,
      investments: 125000,
      baselineDepreciation: 50000,
      investmentDepreciation: 15000,
      totalDepreciation: 65000,
      combinedPrice: 2.5,
      soldVolume: 46000,
      cashflow: 18000,
      cumulativeCashflow: 38000,
      waterPrice: 1.25,
      wastewaterPrice: 1.25,
    },
  ],
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
  computedAt: '2026-03-09T07:05:00.000Z',
  computedFromUpdatedAt: '2026-03-09T07:00:00.000Z',
  updatedAt: '2026-03-09T07:00:00.000Z',
  createdAt: '2026-03-09T06:00:00.000Z',
});

const buildStressScenario = () => ({
  ...buildBaseScenario(),
  id: 'stress-1',
  name: 'Stress scenario',
  onOletus: false,
  scenarioType: 'stress',
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
  computedAt: '2026-03-09T08:05:00.000Z',
  computedFromUpdatedAt: '2026-03-09T08:00:00.000Z',
  updatedAt: '2026-03-09T08:00:00.000Z',
});

const buildBaselineYear = () => ({
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
});

const buildVesinvestPlanSummary = (selectedScenarioId = 'base-1') => ({
  id: 'vesinvest-plan-1',
  seriesId: 'vesinvest-series-1',
  name: 'Water Utility Vesinvest',
  utilityName: 'Water Utility',
  businessId: '1234567-8',
  veetiId: null,
  identitySource: 'manual',
  horizonYears: 20,
  versionNumber: 1,
  status: 'active',
  baselineStatus: 'verified',
  pricingStatus: 'verified',
  tariffPlanStatus: 'accepted',
  selectedScenarioId,
  projectCount: 2,
  totalInvestmentAmount: 245000,
  lastReviewedAt: '2026-03-09T07:05:00.000Z',
  reviewDueAt: '2029-03-09T07:05:00.000Z',
  classificationReviewRequired: false,
  assetEvidenceReady: true,
  assetEvidenceMissingCount: 0,
  baselineChangedSinceAcceptedRevision: false,
  investmentPlanChangedSinceFeeRecommendation: false,
  baselineFingerprint: 'baseline-fingerprint',
  scenarioFingerprint: 'scenario-fingerprint',
  updatedAt: '2026-03-09T07:05:00.000Z',
  createdAt: '2026-03-09T06:00:00.000Z',
});

const buildPlanningContext = (activeScenarioId = 'base-1') => ({
  canCreateScenario: true,
  baselineYears: [buildBaselineYear()],
  vesinvest: {
    hasPlan: true,
    planCount: 1,
    activePlan: buildVesinvestPlanSummary(activeScenarioId),
    selectedPlan: buildVesinvestPlanSummary(activeScenarioId),
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

vi.mock('../../../api', () => ({
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
  listScenarioDepreciationRulesV2: (...args: unknown[]) =>
    listScenarioDepreciationRulesV2(...args),
  createScenarioDepreciationRuleV2: (...args: unknown[]) =>
    createScenarioDepreciationRuleV2(...args),
  updateScenarioDepreciationRuleV2: (...args: unknown[]) =>
    updateScenarioDepreciationRuleV2(...args),
  deleteScenarioDepreciationRuleV2: (...args: unknown[]) =>
    deleteScenarioDepreciationRuleV2(...args),
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



export function registerEnnustePageV2PlanningFlowsSuite() {
  describe('EnnustePageV2 planning flows', () => {
  beforeEach(() => {
    listForecastScenariosV2.mockReset();
    getForecastScenarioV2.mockReset();
    getPlanningContextV2.mockReset();
    listDepreciationRulesV2.mockReset();
    listScenarioDepreciationRulesV2.mockReset();
    createScenarioDepreciationRuleV2.mockReset();
    updateScenarioDepreciationRuleV2.mockReset();
    deleteScenarioDepreciationRuleV2.mockReset();
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
        scenarioType: 'stress',
        baselineYear: 2024,
        horizonYears: 20,
        updatedAt: '2026-03-09T08:00:00.000Z',
        computedAt: '2026-03-09T08:05:00.000Z',
        computedFromUpdatedAt: '2026-03-09T08:00:00.000Z',
        computedYears: 20,
        onOletus: false,
      },
      {
        id: 'base-1',
        name: 'Base scenario',
        scenarioType: 'base',
        baselineYear: 2024,
        horizonYears: 20,
        updatedAt: '2026-03-09T07:00:00.000Z',
        computedAt: '2026-03-09T07:05:00.000Z',
        computedFromUpdatedAt: '2026-03-09T07:00:00.000Z',
        computedYears: 20,
        onOletus: true,
      },
    ]);

    const baseScenario = buildBaseScenario();
    const stressScenario = buildStressScenario();

    getForecastScenarioV2.mockImplementation(async (id: string) => {
      if (id === 'base-1') return baseScenario;
      return stressScenario;
    });

    getPlanningContextV2.mockResolvedValue(buildPlanningContext());

    const scenarioDepreciationRules = [
      {
        id: 'rule-vesinvest',
        assetClassKey: 'sanering_water_network',
        assetClassName: 'Sanering / vattennatverk',
        method: 'straight-line',
        linearYears: 25,
        residualPercent: null,
        annualSchedule: null,
      },
      {
        id: 'rule-1',
        assetClassKey: 'network',
        assetClassName: 'Network',
        method: 'straight-line',
        linearYears: 40,
        residualPercent: null,
        annualSchedule: null,
      },
      {
        id: 'rule-2',
        assetClassKey: 'plant',
        assetClassName: 'Plant',
        method: 'residual',
        linearYears: null,
        residualPercent: 10,
        annualSchedule: null,
      },
    ];
    listDepreciationRulesV2.mockResolvedValue(scenarioDepreciationRules);
    listScenarioDepreciationRulesV2.mockResolvedValue(scenarioDepreciationRules);

    getScenarioClassAllocationsV2.mockResolvedValue({
      years: [
        {
          year: 2024,
          allocations: [{ classKey: 'network', sharePct: 100 }],
        },
        {
          year: 2025,
          allocations: [{ classKey: 'plant', sharePct: 100 }],
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('omits read-only depreciation snapshots from scenario save payloads', async () => {
    const scenarioWithSavedSnapshots = {
      ...buildBaseScenario(),
      yearlyInvestments: buildBaseScenario().yearlyInvestments.map((row) => ({
        ...row,
        depreciationClassKey: row.category,
        depreciationRuleSnapshot: {
          assetClassKey: row.category ?? 'network',
          assetClassName: row.category === 'plant' ? 'Plant' : 'Network',
          method: row.category === 'plant' ? 'residual' : 'straight-line',
          linearYears: row.category === 'plant' ? null : 40,
          residualPercent: row.category === 'plant' ? 10 : null,
          annualSchedule: null,
        },
      })),
    };
    getForecastScenarioV2.mockImplementation(async (id: string) => {
      if (id === 'base-1') return scenarioWithSavedSnapshots;
      return buildStressScenario();
    });
    updateForecastScenarioV2.mockResolvedValue({
      ...scenarioWithSavedSnapshots,
      name: 'Base scenario refreshed',
    });

    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    await openInvestmentWorkbench();
    const scenarioNameInput = (await screen.findByRole('textbox', {
      name: 'Scenario name',
    })) as HTMLInputElement;
    fireEvent.change(scenarioNameInput, {
      target: { value: 'Base scenario refreshed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(updateForecastScenarioV2).toHaveBeenCalled();
    });

    const payload = updateForecastScenarioV2.mock.calls[0]?.[1] as {
      yearlyInvestments?: Array<Record<string, unknown>>;
    };
    expect(payload.yearlyInvestments?.[0]).not.toHaveProperty(
      'depreciationRuleSnapshot',
    );
    expect(payload.yearlyInvestments?.[1]).not.toHaveProperty(
      'depreciationRuleSnapshot',
    );
  });

  it('shows the synced investment-plan effect on depreciation, tariff pressure, and cash impact after recompute', async () => {
    const updatedScenario = {
      ...buildBaseScenario(),
      updatedAt: '2026-03-09T09:00:00.000Z',
      yearlyInvestments: [
        {
          ...buildBaseScenario().yearlyInvestments[0],
          amount: 150000,
          waterAmount: 90000,
          wastewaterAmount: 60000,
        },
        buildBaseScenario().yearlyInvestments[1],
      ],
    };
    const computedScenario = {
      ...updatedScenario,
      updatedAt: '2026-03-09T09:30:00.000Z',
      computedAt: '2026-03-09T09:35:00.000Z',
      computedFromUpdatedAt: '2026-03-09T09:30:00.000Z',
      requiredPriceTodayCombined: 3.0,
      requiredPriceTodayCombinedAnnualResult: 3.1,
      requiredPriceTodayCombinedCumulativeCash: 3.25,
      requiredAnnualIncreasePct: 0.1,
      requiredAnnualIncreasePctAnnualResult: 0.1,
      requiredAnnualIncreasePctCumulativeCash: 0.12,
      feeSufficiency: {
        baselineCombinedPrice: 2.4,
        annualResult: {
          requiredPriceToday: 3.1,
          requiredAnnualIncreasePct: 0.1,
          underfundingStartYear: 2028,
          peakDeficit: 45000,
        },
        cumulativeCash: {
          requiredPriceToday: 3.25,
          requiredAnnualIncreasePct: 0.12,
          underfundingStartYear: 2027,
          peakGap: 120000,
        },
      },
      years: [
        {
          ...buildBaseScenario().years[0],
          investments: 150000,
          totalDepreciation: 70000,
        },
        {
          ...buildBaseScenario().years[1],
          investments: 125000,
          totalDepreciation: 78000,
        },
      ],
      investmentSeries: [
        { year: 2024, amount: 150000 },
        { year: 2025, amount: 125000 },
      ],
      priceSeries: [
        {
          year: 2024,
          combinedPrice: 2.4,
          waterPrice: 1.2,
          wastewaterPrice: 1.2,
        },
        {
          year: 2043,
          combinedPrice: 3.8,
          waterPrice: 1.9,
          wastewaterPrice: 1.9,
        },
      ],
      cashflowSeries: [
        { year: 2024, cashflow: 15000, cumulativeCashflow: 15000 },
        { year: 2043, cashflow: 8000, cumulativeCashflow: 42000 },
      ],
    };
    computeForecastScenarioV2.mockResolvedValue(computedScenario);

    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    const investmentProgramSection = await openInvestmentWorkbench();
    const investmentProgramWithin = within(investmentProgramSection);

    expect(
      investmentProgramWithin.getByText(
        'Investment rows are edited in Asset Management. Forecast uses the synced plan for calculations.',
      ),
    ).toBeTruthy();
    expect(
      investmentProgramWithin.getByRole('button', { name: 'Asset Management' }),
    ).toBeTruthy();
    expect(
      investmentProgramWithin.queryByRole('spinbutton', { name: 'Total EUR 2024' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Recompute results' }));

    await waitFor(() => {
      expect(computeForecastScenarioV2).toHaveBeenCalledWith('base-1');
    });

    await waitFor(() => {
      expect(screen.getByText('Scenario calculated.')).toBeTruthy();
      expect(screen.getAllByText('Current results').length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText(
        (content) => content.includes('275') && content.includes('EUR'),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('keeps compute-backed KPI values stable after save-only updates and clears report readiness until recompute', async () => {
    const onComputedVersionChange = vi.fn();
    const baseScenario = buildBaseScenario();
    updateForecastScenarioV2.mockResolvedValue({
      ...baseScenario,
      name: 'Base scenario revised',
      updatedAt: '2026-03-09T09:00:00.000Z',
      computedAt: null,
      computedFromUpdatedAt: null,
      requiredPriceTodayCombined: 9.5,
      requiredPriceTodayCombinedAnnualResult: 9.99,
      requiredPriceTodayCombinedCumulativeCash: 10.5,
      baselinePriceTodayCombined: 8.4,
      requiredAnnualIncreasePct: 0.33,
      requiredAnnualIncreasePctAnnualResult: 0.33,
      requiredAnnualIncreasePctCumulativeCash: 0.4,
      feeSufficiency: {
        baselineCombinedPrice: 8.4,
        annualResult: {
          requiredPriceToday: 9.99,
          requiredAnnualIncreasePct: 0.33,
          underfundingStartYear: 2031,
          peakDeficit: 123456,
        },
        cumulativeCash: {
          requiredPriceToday: 10.5,
          requiredAnnualIncreasePct: 0.4,
          underfundingStartYear: 2030,
          peakGap: 234567,
        },
      },
      priceSeries: [
        {
          year: 2024,
          combinedPrice: 8.4,
          waterPrice: 4.2,
          wastewaterPrice: 4.2,
        },
      ],
      cashflowSeries: [
        { year: 2024, cashflow: 99000, cumulativeCashflow: 99000 },
      ],
    });

    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
        onComputedVersionChange={onComputedVersionChange}
      />,
    );

    expect(await screen.findAllByText('Current results')).not.toHaveLength(0);
    expect(screen.getAllByText(/2[,.]70 EUR\/m(?:3|³)/).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    await openInvestmentWorkbench();
    fireEvent.change(screen.getByRole('textbox', { name: 'Scenario name' }), {
      target: { value: 'Base scenario revised' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(updateForecastScenarioV2).toHaveBeenCalledWith(
        'base-1',
        expect.objectContaining({ name: 'Base scenario revised' }),
      );
    });

    expect(await screen.findAllByText('Base scenario revised')).not.toHaveLength(
      0,
    );
    await waitFor(() => {
      expect(
        screen.getByText('Draft saved. Recompute results to refresh KPI values.'),
      ).toBeTruthy();
      expect(screen.queryByText(/10[,.]50 EUR\/m3/)).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getAllByText('Saved, needs recompute').length).toBeGreaterThan(
        0,
      );
    });
    expect(
      screen.getByRole('button', { name: 'Recompute results' }).className,
    ).toContain('v2-btn-primary');
    expect(screen.queryByRole('button', { name: 'Create report' })).toBeNull();
  });

  it('shows unsaved changes as blocked and points the top strip back to save-and-compute', async () => {
    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    expect(await screen.findAllByText('Current results')).not.toHaveLength(0);
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    await openInvestmentWorkbench();
    fireEvent.change(screen.getByRole('textbox', { name: 'Scenario name' }), {
      target: { value: 'Base scenario edited' },
    });

    expect(await screen.findAllByText('Unsaved changes')).not.toHaveLength(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Save and compute results').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole('button', { name: 'Create report' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Save and compute results' }).className,
    ).toContain('v2-btn-primary');
  });

  it('switches from computing back to current report-ready truth after recompute finishes', async () => {
    const pendingCompute = deferred<ReturnType<typeof buildBaseScenario>>();
    computeForecastScenarioV2.mockReturnValueOnce(pendingCompute.promise);

    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    expect(await screen.findAllByText('Current results')).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Recompute results' }));

    expect(await screen.findAllByText('Computing')).not.toHaveLength(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole('button', { name: 'Computing results...' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Computing results...' }).className,
    ).toContain('v2-btn-primary');
    expect(screen.queryByRole('button', { name: 'Create report' })).toBeNull();

    pendingCompute.resolve({
      ...buildBaseScenario(),
      updatedAt: '2026-03-09T10:00:00.000Z',
      computedAt: '2026-03-09T10:05:00.000Z',
      computedFromUpdatedAt: '2026-03-09T10:00:00.000Z',
      requiredPriceTodayCombined: 2.9,
      requiredPriceTodayCombinedAnnualResult: 2.9,
      requiredPriceTodayCombinedCumulativeCash: 3,
      requiredAnnualIncreasePct: 0.1,
      requiredAnnualIncreasePctAnnualResult: 0.1,
      requiredAnnualIncreasePctCumulativeCash: 0.11,
    });

    await waitFor(() => {
      expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Current results').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('Blocked')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('opens the revenue planning workbench, persists tariff and volume driver edits, and returns to cockpit context', async () => {
    const updatedScenario = {
      ...buildBaseScenario(),
      assumptions: {
        ...buildBaseScenario().assumptions,
        hintakorotus: 0.045,
        vesimaaran_muutos: -0.02,
      },
      updatedAt: '2026-03-09T09:00:00.000Z',
    };
    updateForecastScenarioV2.mockResolvedValue(updatedScenario);

    const { container } = render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    expect(await screen.findAllByText('Current results')).not.toHaveLength(0);

    fireEvent.click(
      screen.getByRole('button', { name: 'Open revenue planning' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Revenue and volume drivers' }),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'Review today versus horizon tariffs before recomputing the scenario.',
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        'Keep baseline and horizon sold-volume context visible while editing the annual volume driver.',
      ),
    ).toBeNull();
    expect(container.querySelectorAll('.v2-revenue-panel')).toHaveLength(2);
    expect(container.querySelectorAll('.v2-revenue-panel .v2-workbench-metric-list')).toHaveLength(2);
    expect(
      (
        screen.getAllByRole('textbox', {
          name: 'Price increase',
        })[0] as HTMLInputElement
      ).value,
    ).toBe('3,00');
    expect(
      (
        screen.getAllByRole('textbox', {
          name: 'Volume change',
        })[0] as HTMLInputElement
      ).value,
    ).toContain('1,00');
    expect(
      screen.getByRole('textbox', { name: 'Base fee change' }),
    ).toBeTruthy();

    fireEvent.change(
      screen.getAllByRole('textbox', { name: 'Price increase' })[0],
      {
        target: { value: '4.5' },
      },
    );
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Volume change' })[0], {
      target: { value: '-2' },
    });

    expect(screen.getByRole('heading', { name: 'Income statement overview' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(updateForecastScenarioV2).toHaveBeenCalledWith(
        'base-1',
        expect.objectContaining({
          scenarioAssumptions: expect.objectContaining({
            hintakorotus: 0.045,
            vesimaaran_muutos: -0.02,
          }),
        }),
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Open revenue planning' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Revenue and volume drivers' }),
    ).toBeTruthy();
  });

  it('navigates between operating-cost drill-downs in analyst mode and keeps edits when returning to the cockpit', async () => {
    const { container } = render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    expect(await screen.findAllByText('Current results')).not.toHaveLength(0);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open materials planning',
      }),
    );
    expect(screen.queryByText('Operating cost planning')).toBeNull();
    expect(
      screen.queryByText(
        'Keep the cockpit context visible while tuning one operating-cost pillar at a time.',
      ),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable analyst mode' }),
    );

    expect(
      screen.getByRole('button', { name: 'Disable analyst mode' }),
    ).toBeTruthy();
    expect(container.querySelector('.v2-opex-summary-card')).toBeTruthy();
    expect(container.querySelector('.v2-opex-editor-card')).toBeTruthy();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Materials and services 2024' }),
      {
        target: { value: '5' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Personnel costs' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Personnel costs 2025' }),
      {
        target: { value: '4' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Other operating costs' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Other operating costs 2024' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Materials and services' }),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Materials and services 2024',
        }) as HTMLInputElement
      ).value,
    ).toBe('5');

    expect(screen.getByRole('heading', { name: 'Income statement overview' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Disable analyst mode' }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Materials and services 2024',
        }) as HTMLInputElement
      ).value,
    ).toBe('5');
  });

  it('keeps the revenue and opex workbenches on a one-column fallback at the compact breakpoint', () => {
    const forecastCss = readFileSync(
      resolve(process.cwd(), 'src/v2/v2-forecast.css'),
      'utf8',
    );

    expect(forecastCss).toMatch(
      /@media \(max-width: 860px\)\s*\{[\s\S]*?\.v2-revenue-workbench-grid,\s*\.v2-opex-workbench-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;/,
    );
  });

  it('keeps synced investment context in Forecast but removes the old depreciation planning workbench', async () => {
    render(
      <EnnustePageV2
        onReportCreated={() => undefined}
        initialScenarioId="base-1"
        computedFromUpdatedAtByScenario={{
          'base-1': '2026-03-09T07:00:00.000Z',
        }}
      />,
    );

    await openInvestmentWorkbench();

    expect(
      await screen.findByText(
        'Investment rows are edited in Asset Management. Forecast uses the synced plan for calculations.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('Total investments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Computed version').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: 'Open depreciation planning' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Continue to depreciation plans' }),
    ).toBeNull();
    expect(
      screen.queryByRole('heading', {
        name: 'Depreciation plans for future investments',
      }),
    ).toBeNull();
    expect(
      screen.queryByText('Set a depreciation plan for each investment year'),
    ).toBeNull();
  });

  });
}
