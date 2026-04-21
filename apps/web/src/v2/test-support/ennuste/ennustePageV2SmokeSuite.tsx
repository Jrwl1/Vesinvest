import React from 'react';
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
  selectedScenarioId,
  projectCount: 2,
  totalInvestmentAmount: 245000,
  lastReviewedAt: '2026-03-09T07:05:00.000Z',
  reviewDueAt: '2029-03-09T07:05:00.000Z',
  classificationReviewRequired: false,
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



export function registerEnnustePageV2SmokeSuite() {
  describe('EnnustePageV2 smoke', () => {
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

  it('renders the forecast as a themed cockpit and opens deeper planning surfaces on demand', async () => {
    const { container } = render(
      <EnnustePageV2 onReportCreated={() => undefined} />,
    );

    expect(container.querySelector('.v2-page.v2-forecast-theme')).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Planning scenarios' }),
    ).toBeTruthy();
    const cockpitHeading = await screen.findByRole('heading', {
      name: 'Income statement overview',
    });
    expect(screen.getAllByText('Stress scenario').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: 'Standard view' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Analyst view' }),
    ).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Scenario name' })).toBeTruthy();
    expect(screen.queryByText('Derived result rows')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Analyst view' }));
    expect(screen.getByText('Scenario name')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Standard view' }));
    expect(
      screen.getByRole('button', { name: 'Standard view' }).className,
    ).toContain('v2-btn-primary');
    expect(screen.queryByText('Derived result rows')).toBeNull();
    const planningHeading = screen.getByRole('heading', {
      name: 'Planning areas',
    });

    expect(
      cockpitHeading.compareDocumentPosition(planningHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Planning areas')).toBeTruthy();
    expect(screen.getAllByText('Revenue').length).toBeGreaterThan(0);
    expect(screen.getByText('Baseline source')).toBeTruthy();
    expect(
      screen.getAllByText('Statement import (bokslut-2024.pdf)').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Outcome review')).toBeNull();
    expect(screen.queryByText('Funding pressure and result views')).toBeNull();
    const investmentWorkbench = await openInvestmentWorkbench();
    expect(investmentWorkbench).toBeTruthy();
    expect(screen.getByText('Main line renewal')).toBeTruthy();
    expect(screen.getAllByText('P-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Water network rehabilitation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Straight-line 40 years').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('70000').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('50000').length).toBeGreaterThan(0);
    expect(document.querySelector('datalist#v2-investment-program-group-options')).toBeNull();
    expect(screen.getByText('Full annual table')).toBeTruthy();
    fireEvent.click(screen.getByText('Full annual table'));
    expect(
      await screen.findByRole('button', { name: 'Repeat near-term template' }),
    ).toBeTruthy();
    expect(document.querySelector('input[name="yearlyInvestmentCategory-2024"]')).toBeNull();
    expect(document.querySelector('select[name="yearlyInvestmentType-2024"]')).toBeNull();
    expect(document.querySelector('select[name="yearlyInvestmentConfidence-2024"]')).toBeNull();

    await waitFor(() => {
      expect(getForecastScenarioV2).toHaveBeenCalledWith('stress-1');
      expect(getForecastScenarioV2).toHaveBeenCalledWith('base-1');
    });
    expectNoDuplicateIds(container);
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

    fireEvent.click(
      screen.getByRole('button', { name: 'Open revenue planning' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Revenue and volume drivers' }),
    ).toBeTruthy();
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

  it('treats Forecast as the single owner of first-scenario creation after setup handoff', async () => {
    listForecastScenariosV2.mockResolvedValueOnce([]);
    getPlanningContextV2.mockResolvedValueOnce({
      canCreateScenario: true,
      baselineYears: [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          financials: { source: 'manual', provenance: null },
          prices: { source: 'veeti', provenance: null },
          volumes: { source: 'veeti', provenance: null },
          investmentAmount: 0,
          soldWaterVolume: 24000,
          soldWastewaterVolume: 23000,
          pumpedWaterVolume: 52000,
          netWaterTradeVolume: 0,
          processElectricity: 4100,
        },
      ],
    });
    createForecastScenarioV2.mockResolvedValueOnce(buildBaseScenario());

    render(<EnnustePageV2 onReportCreated={() => undefined} />);

    expect(await screen.findByText('Select a scenario.')).toBeTruthy();
    expect(await screen.findByText('Create your first scenario')).toBeTruthy();
    expect(screen.getByText('Baseline year')).toBeTruthy();
    expect(screen.getByText('Baseline source')).toBeTruthy();
    expect(screen.getByText('Mixed')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Scenario name'), {
      target: { value: 'First scenario' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create first scenario' }));

    await waitFor(() => {
      expect(createForecastScenarioV2).toHaveBeenCalledWith({
        name: 'First scenario',
        copyFromScenarioId: undefined,
        scenarioType: 'base',
      });
    });
  });

  });
}

