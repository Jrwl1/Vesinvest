import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VesinvestPlanningPanel } from '../../VesinvestPlanningPanel';

const cloneVesinvestPlanV2 = vi.fn();
const connectImportOrganizationV2 = vi.fn();
const createReportV2 = vi.fn();
const createVesinvestPlanV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getVesinvestPlanV2 = vi.fn();
const listDepreciationRulesV2 = vi.fn();
const listVesinvestGroupsV2 = vi.fn();
const listVesinvestPlansV2 = vi.fn();
const searchImportOrganizationsV2 = vi.fn();
const syncVesinvestPlanToForecastV2 = vi.fn();
const updateDepreciationRuleV2 = vi.fn();
const updateVesinvestGroupV2 = vi.fn();
const updateVesinvestPlanV2 = vi.fn();

vi.mock('../../../api', () => ({
  cloneVesinvestPlanV2: (...args: unknown[]) => cloneVesinvestPlanV2(...args),
  connectImportOrganizationV2: (...args: unknown[]) =>
    connectImportOrganizationV2(...args),
  createReportV2: (...args: unknown[]) => createReportV2(...args),
  createVesinvestPlanV2: (...args: unknown[]) => createVesinvestPlanV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getVesinvestPlanV2: (...args: unknown[]) => getVesinvestPlanV2(...args),
  listDepreciationRulesV2: (...args: unknown[]) => listDepreciationRulesV2(...args),
  listVesinvestGroupsV2: (...args: unknown[]) => listVesinvestGroupsV2(...args),
  listVesinvestPlansV2: (...args: unknown[]) => listVesinvestPlansV2(...args),
  searchImportOrganizationsV2: (...args: unknown[]) =>
    searchImportOrganizationsV2(...args),
  syncVesinvestPlanToForecastV2: (...args: unknown[]) =>
    syncVesinvestPlanToForecastV2(...args),
  updateDepreciationRuleV2: (...args: unknown[]) => updateDepreciationRuleV2(...args),
  updateVesinvestGroupV2: (...args: unknown[]) => updateVesinvestGroupV2(...args),
  updateVesinvestPlanV2: (...args: unknown[]) => updateVesinvestPlanV2(...args),
}));

const t = (
  key: string,
  defaultValueOrOptions?: string | Record<string, unknown>,
  maybeOptions?: Record<string, unknown>,
) => {
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  const defaultValue =
    typeof defaultValueOrOptions === 'string'
      ? defaultValueOrOptions
      : typeof options?.defaultValue === 'string'
      ? String(options.defaultValue)
      : key;
  let out = defaultValue;
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

const group = {
  key: 'sanering_water_network',
  label: 'Sanering / vattennätverk',
  defaultAccountKey: 'sanering_water_network',
  defaultDepreciationClassKey: 'sanering_water_network',
  reportGroupKey: 'network_rehabilitation',
  serviceSplit: 'water' as const,
};

const wastewaterTreatmentGroup = {
  key: 'wastewater_treatment',
  label: 'Avloppsrening',
  defaultAccountKey: 'wastewater_treatment',
  defaultDepreciationClassKey: 'wastewater_treatment',
  reportGroupKey: 'treatment',
  serviceSplit: 'wastewater' as const,
};

const linkedOrg = {
  nimi: 'Water Utility',
  ytunnus: '1234567-8',
  veetiId: 1535,
};

const makePlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  name: 'Water Utility Vesinvest',
  utilityName: 'Water Utility',
  businessId: '1234567-8',
  veetiId: 1535,
  identitySource: 'veeti' as const,
  horizonYears: 20,
  versionNumber: 1,
  status: 'draft' as const,
  baselineStatus: 'incomplete' as const,
  pricingStatus: 'blocked' as const,
  feeRecommendationStatus: 'blocked' as const,
  feeRecommendation: null,
  baselineSourceState: null,
  selectedScenarioId: null,
  projectCount: 1,
  totalInvestmentAmount: 100,
  lastReviewedAt: null,
  reviewDueAt: '2029-04-08T10:00:00.000Z',
  classificationReviewRequired: false,
  baselineChangedSinceAcceptedRevision: false,
  investmentPlanChangedSinceFeeRecommendation: true,
  updatedAt: '2026-04-08T10:00:00.000Z',
  createdAt: '2026-04-08T10:00:00.000Z',
  horizonYearsRange: Array.from({ length: 20 }, (_, index) => 2026 + index),
  yearlyTotals: [{ year: 2026, totalAmount: 100, waterAmount: 100, wastewaterAmount: 0 }],
  fiveYearBands: [{ startYear: 2026, endYear: 2030, totalAmount: 100 }],
  projects: [
    {
      id: 'project-1',
      code: 'P-001',
      name: 'Main rehabilitation',
      investmentType: 'sanering' as const,
      groupKey: group.key,
      groupLabel: group.label,
      depreciationClassKey: group.defaultDepreciationClassKey,
      defaultAccountKey: group.defaultAccountKey,
      reportGroupKey: group.reportGroupKey,
      subtype: null,
      notes: null,
      waterAmount: 100,
      wastewaterAmount: 0,
      totalAmount: 100,
      allocations: [{ id: 'allocation-1', year: 2026, totalAmount: 100, waterAmount: 100, wastewaterAmount: 0 }],
    },
  ],
  ...overrides,
});

const makeSummary = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  name: 'Water Utility Vesinvest',
  utilityName: 'Water Utility',
  businessId: '1234567-8',
  veetiId: 1535,
  identitySource: 'veeti' as const,
  horizonYears: 20,
  versionNumber: 1,
  status: 'draft' as const,
  baselineStatus: 'incomplete' as const,
  pricingStatus: 'blocked' as const,
  selectedScenarioId: null,
  projectCount: 1,
  totalInvestmentAmount: 100,
  lastReviewedAt: null,
  reviewDueAt: '2029-04-08T10:00:00.000Z',
  classificationReviewRequired: false,
  baselineChangedSinceAcceptedRevision: false,
  investmentPlanChangedSinceFeeRecommendation: true,
  updatedAt: '2026-04-08T10:00:00.000Z',
  createdAt: '2026-04-08T10:00:00.000Z',
  ...overrides,
});

const baselineYear = {
  year: 2024,
  planningRole: 'historical' as const,
  quality: 'complete' as const,
  sourceStatus: 'MANUAL' as const,
  sourceBreakdown: {
    veetiDataTypes: ['taksa'],
    manualDataTypes: ['tilinpaatos', 'volume_vesi'],
  },
  financials: {
    dataType: 'tilinpaatos',
    source: 'manual' as const,
    provenance: {
      kind: 'statement_import' as const,
      fileName: 'bokslut-2024.pdf',
      pageNumber: 3,
      confidence: 98,
      scannedPageCount: 4,
      matchedFields: ['Liikevaihto'],
      warnings: [],
    },
    editedAt: '2026-04-08T10:00:00.000Z',
    editedBy: 'tester',
    reason: 'Statement-backed correction',
  },
  prices: {
    dataType: 'taksa',
    source: 'veeti' as const,
    provenance: null,
    editedAt: null,
    editedBy: null,
    reason: null,
  },
  volumes: {
    dataType: 'volume_vesi',
    source: 'manual' as const,
    provenance: {
      kind: 'qdis_import' as const,
      fileName: 'qdis-2024.pdf',
      pageNumber: 1,
      confidence: 88,
      scannedPageCount: 2,
      matchedFields: ['waterUnitPrice'],
      warnings: [],
    },
    editedAt: null,
    editedBy: null,
    reason: null,
  },
  investmentAmount: 100,
  soldWaterVolume: 25000,
  soldWastewaterVolume: 24000,
  combinedSoldVolume: 49000,
  processElectricity: 0,
  pumpedWaterVolume: 0,
  waterBoughtVolume: 0,
  waterSoldVolume: 25000,
  netWaterTradeVolume: -25000,
};



export function registerVesinvestPlanningPanelReportHandoffSuite() {
  describe('VesinvestPlanningPanel report handoff', () => {
  beforeEach(() => {
    cloneVesinvestPlanV2.mockReset();
    connectImportOrganizationV2.mockReset();
    createReportV2.mockReset();
    createVesinvestPlanV2.mockReset();
    getForecastScenarioV2.mockReset();
    getVesinvestPlanV2.mockReset();
    listDepreciationRulesV2.mockReset();
    listVesinvestGroupsV2.mockReset();
    listVesinvestPlansV2.mockReset();
    searchImportOrganizationsV2.mockReset();
    syncVesinvestPlanToForecastV2.mockReset();
    updateDepreciationRuleV2.mockReset();
    updateVesinvestGroupV2.mockReset();
    updateVesinvestPlanV2.mockReset();

    listVesinvestGroupsV2.mockResolvedValue([group, wastewaterTreatmentGroup]);
    listDepreciationRulesV2.mockResolvedValue([
      {
        id: group.key,
        assetClassKey: group.key,
        assetClassName: group.label,
        method: 'straight-line',
        linearYears: 30,
        residualPercent: null,
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-04-08T10:00:00.000Z',
      },
      {
        id: wastewaterTreatmentGroup.key,
        assetClassKey: wastewaterTreatmentGroup.key,
        assetClassName: wastewaterTreatmentGroup.label,
        method: 'straight-line',
        linearYears: 20,
        residualPercent: null,
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-04-08T10:00:00.000Z',
      },
    ]);
    listVesinvestPlansV2.mockResolvedValue([makeSummary()]);
    getVesinvestPlanV2.mockResolvedValue(makePlan());
    getForecastScenarioV2.mockResolvedValue({
      id: 'scenario-1',
      name: 'Water Utility Vesinvest v1',
      updatedAt: '2026-04-08T10:00:00.000Z',
      computedFromUpdatedAt: '2026-04-08T10:00:00.000Z',
      years: [{ year: 2026 }],
      yearlyInvestments: [
        {
          year: 2026,
          amount: 100,
          target: 'Water Utility / Vesinvest',
          category: 'Sanering / vattennätverk',
          depreciationClassKey: 'sanering_water_network',
          depreciationRuleSnapshot: {
            assetClassKey: 'sanering_water_network',
            assetClassName: 'Water network',
            method: 'straight-line',
            linearYears: 30,
            residualPercent: null,
          },
          investmentType: 'replacement',
          confidence: 'high',
          waterAmount: 100,
          wastewaterAmount: 0,
          note: null,
        },
      ],
    } as any);
    searchImportOrganizationsV2.mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Porvoo',
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('creates a report directly from a synced Vesinvest plan', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
      }),
    );
    createReportV2.mockResolvedValue({ reportId: 'report-1' });
    const onGoToReports = vi.fn();

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={onGoToReports}
      />,
    );

    const createReportButton = await screen.findByRole('button', {
      name: 'Create report',
    });
    await waitFor(() => {
      expect((createReportButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(createReportButton);

    await waitFor(() => {
      expect(createReportV2).toHaveBeenCalledWith(
        expect.objectContaining({
          ennusteId: 'scenario-1',
          vesinvestPlanId: 'plan-1',
        }),
      );
    });
    expect(onGoToReports).toHaveBeenCalled();
  });

  it('maps stale report-create conflicts back to the saved fee-path hint instead of showing the raw API error', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
      }),
    );
    createReportV2.mockRejectedValue(
      Object.assign(
        new Error(
          'Scenario investment inputs changed after last compute. Recompute scenario before creating report.',
        ),
        { code: 'FORECAST_RECOMPUTE_REQUIRED' },
      ),
    );
    const onPlansChanged = vi.fn();
    const onSavedFeePathReportConflict = vi.fn();
    const onGoToReports = vi.fn();

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={onGoToReports}
        onSavedFeePathReportConflict={onSavedFeePathReportConflict}
        onPlansChanged={onPlansChanged}
      />,
    );

    const createReportButton = await screen.findByRole('button', {
      name: 'Create report',
    });
    await waitFor(() => {
      expect((createReportButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(createReportButton);

    expect(
      await screen.findByText(
        'Saved inputs changed after the last calculation. Recompute results before creating report.',
      ),
    ).toBeTruthy();
    await waitFor(() => {
      expect((createReportButton as HTMLButtonElement).disabled).toBe(true);
    });
    expect(
      screen.queryByText(
        'Scenario investment inputs changed after last compute. Recompute scenario before creating report.',
      ),
    ).toBeNull();
    expect(onPlansChanged).toHaveBeenCalled();
    expect(onSavedFeePathReportConflict).toHaveBeenCalledWith('plan-1');
    expect(onGoToReports).not.toHaveBeenCalled();
  });

  it('surfaces baseline-stale report conflicts with the saved fee-path baseline message', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
      }),
    );
    createReportV2.mockRejectedValue(
      Object.assign(
        new Error('Re-verify baseline before creating report.'),
        { code: 'VESINVEST_BASELINE_STALE' },
      ),
    );

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    const createReportButton = await screen.findByRole('button', {
      name: 'Create report',
    });
    await waitFor(() => {
      expect((createReportButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(createReportButton);

    expect(
      await screen.findByText(
        'Accepted baseline changed after the saved tariff-plan result.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('Saved tariff-plan result still matches this revision.'),
    ).toBeNull();
  });

  it('keeps accepted baseline years readable and separates revision actions from workflow actions', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
      }),
    );

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{
          canCreateScenario: true,
          baselineYears: [baselineYear, { ...baselineYear, year: 2023 }],
        } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    expect(screen.getAllByText('Accepted baseline years').length).toBeGreaterThan(0);
    expect(screen.getByText('2024')).toBeTruthy();
    expect(screen.getByText('2023')).toBeTruthy();

    const newRevisionButton = await screen.findByRole('button', { name: 'New revision' });
    const openFeePathButton = await screen.findByRole('button', { name: 'Open Tariff Plan' });
    expect(newRevisionButton.closest('.v2-vesinvest-maintenance-actions')).toBeTruthy();
    expect(openFeePathButton.closest('.v2-vesinvest-workflow-actions')).toBeTruthy();
  });

  it('selects and focuses the targeted saved fee path once when Overview hands off a stale report flow', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const scrollIntoViewMock = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewMock,
    });

    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        id: 'plan-1',
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
      makeSummary({
        id: 'plan-2',
        name: 'Water Utility Vesinvest v2',
        versionNumber: 2,
        selectedScenarioId: 'scenario-2',
        pricingStatus: 'verified',
        tariffPlanStatus: 'accepted',
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockImplementation(async (planId: string) =>
      planId === 'plan-2'
        ? makePlan({
            id: 'plan-2',
            name: 'Water Utility Vesinvest v2',
            versionNumber: 2,
            selectedScenarioId: 'scenario-2',
            pricingStatus: 'verified',
            tariffPlanStatus: 'accepted',
            feeRecommendationStatus: 'verified',
            feeRecommendation: {
              savedAt: '2026-04-09T08:00:00.000Z',
              linkedScenarioId: 'scenario-2',
              baselineFingerprint: 'baseline-fingerprint',
              scenarioFingerprint: 'scenario-fingerprint',
              baselineCombinedPrice: 2.8,
              totalInvestments: 100,
              combined: {
                baselinePriceToday: 2.8,
                annualResult: {
                  requiredPriceToday: 3.2,
                  requiredAnnualIncreasePct: 4.1,
                  peakDeficit: 0,
                  underfundingStartYear: null,
                },
                cumulativeCash: {
                  requiredPriceToday: 3.4,
                  requiredAnnualIncreasePct: 4.7,
                  peakGap: 150000,
                  underfundingStartYear: null,
                },
              },
              water: {
                currentPrice: 1.5,
                forecastPath: [],
              },
              wastewater: {
                currentPrice: 1.3,
                forecastPath: [],
              },
              baseFee: {
                currentRevenue: 25000,
                connectionCount: 1200,
              },
              annualResults: [],
              plan: {
                id: 'plan-2',
                seriesId: 'series-1',
                versionNumber: 2,
              },
            },
          })
        : makePlan(),
    );
    const onOverviewFocusTargetConsumed = vi.fn();
    const focusTarget = { kind: 'saved_fee_path' as const, planId: 'plan-2' };

    const { rerender } = render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{
          canCreateScenario: true,
          baselineYears: [baselineYear],
          vesinvest: {
            hasPlan: true,
            planCount: 2,
            activePlan: makeSummary({ id: 'plan-1' }),
            selectedPlan: makeSummary({ id: 'plan-1' }),
          },
        } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        overviewFocusTarget={focusTarget}
        onOverviewFocusTargetConsumed={onOverviewFocusTargetConsumed}
      />,
    );

    const feePathHeading = await screen.findByRole('heading', {
      name: 'Saved tariff-plan recommendation',
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(feePathHeading);
    });
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(onOverviewFocusTargetConsumed).toHaveBeenCalledTimes(1);

    rerender(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{
          canCreateScenario: true,
          baselineYears: [baselineYear],
          vesinvest: {
            hasPlan: true,
            planCount: 2,
            activePlan: makeSummary({ id: 'plan-1' }),
            selectedPlan: makeSummary({ id: 'plan-1' }),
          },
        } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        overviewFocusTarget={focusTarget}
        onOverviewFocusTargetConsumed={onOverviewFocusTargetConsumed}
      />,
    );

    await waitFor(() => {
      expect(onOverviewFocusTargetConsumed).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();

  });

  });
}
