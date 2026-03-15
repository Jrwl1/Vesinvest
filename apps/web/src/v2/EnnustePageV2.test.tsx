import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../i18n/locales/en.json';
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

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const translate = (
  key: string,
  defaultValue?: string,
  options?: Record<string, unknown>,
) => {
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
});

const buildStressScenario = () => ({
  ...buildBaseScenario(),
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

    const baseScenario = buildBaseScenario();
    const stressScenario = buildStressScenario();

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

    const cockpitHeading = await screen.findByRole('heading', {
      name: 'Compact result statement landing',
    });
    const planningHeading = screen.getByRole('heading', {
      name: 'Editable planning controls',
    });

    expect(
      cockpitHeading.compareDocumentPosition(planningHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Planning pillars')).toBeTruthy();
    expect(screen.getAllByText('Intakter').length).toBeGreaterThan(0);
    expect(screen.getByText('Derived result rows')).toBeTruthy();
    expect(await screen.findByText('Planning inputs')).toBeTruthy();
    expect(screen.getByText('Editable planning controls')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Yearly investments (EUR)' }),
    ).toBeTruthy();
    expect(screen.getByText('Outcome review')).toBeTruthy();
    expect(screen.getAllByText('Report readiness').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Saved, needs recompute').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText('Recompute results before creating report.').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Delta').length).toBeGreaterThan(0);
    expect(await screen.findByText('Horizon combined')).toBeTruthy();
    expect(await screen.findByText('Lowest cumulative cash')).toBeTruthy();
    expect(screen.getAllByText('Volume').length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getForecastScenarioV2).toHaveBeenCalledWith('stress-1');
      expect(getForecastScenarioV2).toHaveBeenCalledWith('base-1');
    });
  });

  it('keeps compute-backed KPI values stable after save-only updates and clears report readiness until recompute', async () => {
    const onComputedVersionChange = vi.fn();
    const baseScenario = buildBaseScenario();
    updateForecastScenarioV2.mockResolvedValue({
      ...baseScenario,
      name: 'Base scenario revised',
      updatedAt: '2026-03-09T09:00:00.000Z',
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
    expect(screen.getAllByText(/2[,.]70 EUR\/m3/).length).toBeGreaterThan(0);
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

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

    expect(await screen.findByDisplayValue('Base scenario revised')).toBeTruthy();
    expect(
      screen.getByText('Draft saved. Recompute results to refresh KPI values.'),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Saved, needs recompute').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[,.]70 EUR\/m3/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/9[,.]99 EUR\/m3/)).toBeNull();
    expect(onComputedVersionChange).toHaveBeenCalledWith('base-1', null);
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getAllByText('Recompute results before creating report.').length,
    ).toBeGreaterThan(0);
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

    fireEvent.change(screen.getByRole('textbox', { name: 'Scenario name' }), {
      target: { value: 'Base scenario edited' },
    });

    expect(await screen.findAllByText('Unsaved changes')).not.toHaveLength(0);
    expect(screen.getAllByText('Blocked').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        'You have unsaved changes. Save and compute results before creating report.',
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Save and compute results').length).toBeGreaterThan(
      0,
    );
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
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
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    pendingCompute.resolve({
      ...buildBaseScenario(),
      updatedAt: '2026-03-09T10:00:00.000Z',
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

    expect(
      screen.getAllByText(
        'Latest computed scenario can be published as a report.',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (screen.getByRole('button', { name: 'Create report' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('opens the Intakter workbench, persists tariff and volume driver edits, and returns to cockpit context', async () => {
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
      screen.getByRole('button', { name: 'Open Intakter workbench' }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Intakter workbench' }),
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

    fireEvent.change(
      screen.getAllByRole('textbox', { name: 'Price increase' })[0],
      {
        target: { value: '4.5' },
      },
    );
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Volume change' })[0], {
      target: { value: '-2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Return to cockpit' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Compact result statement landing',
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => {
      expect(updateForecastScenarioV2).toHaveBeenCalledWith(
        'base-1',
        expect.objectContaining({
          scenarioAssumptions: {
            hintakorotus: 0.045,
            vesimaaran_muutos: -0.02,
          },
        }),
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Open Intakter workbench' }),
    );
    expect(
      (
        (await screen.findAllByRole('textbox', {
          name: 'Price increase',
        }))[0] as HTMLInputElement
      ).value,
    ).toBe('4,50');
    expect(
      (
        screen.getAllByRole('textbox', {
          name: 'Volume change',
        })[0] as HTMLInputElement
      ).value,
    ).toContain('2,00');
  });

  it('navigates between OPEX drill-downs in analyst mode and keeps edits when returning to the cockpit', async () => {
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
      screen.getByRole('button', {
        name: 'Open Materialkostnader workbench',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Enable analyst mode' }),
    );

    expect(
      screen.getByRole('button', { name: 'Disable analyst mode' }),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Materialkostnader 2024' }),
      {
        target: { value: '5' },
      },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Personalkostnader' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Personalkostnader 2025' }),
      {
        target: { value: '4' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Ovriga rorelsekostnader' }),
    );
    expect(
      screen.getByRole('textbox', { name: 'Ovriga rorelsekostnader 2024' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Materialkostnader' }),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Materialkostnader 2024',
        }) as HTMLInputElement
      ).value,
    ).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: 'Return to cockpit' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Compact result statement landing',
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open Materialkostnader workbench',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Disable analyst mode' }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Materialkostnader 2024',
        }) as HTMLInputElement
      ).value,
    ).toBe('5');
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
    expect(
      screen.getByText(
        'The planning baseline is ready. Next you move into Forecast to name the first scenario and continue the work.',
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Scenario name'), {
      target: { value: 'First scenario' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    await waitFor(() => {
      expect(createForecastScenarioV2).toHaveBeenCalledWith({
        name: 'First scenario',
        copyFromScenarioId: undefined,
      });
    });
  });
});
