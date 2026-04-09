import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VesinvestPlanningPanel } from './VesinvestPlanningPanel';

const cloneVesinvestPlanV2 = vi.fn();
const connectImportOrganizationV2 = vi.fn();
const createReportV2 = vi.fn();
const createVesinvestPlanV2 = vi.fn();
const getForecastScenarioV2 = vi.fn();
const getVesinvestPlanV2 = vi.fn();
const listVesinvestGroupsV2 = vi.fn();
const listVesinvestPlansV2 = vi.fn();
const searchImportOrganizationsV2 = vi.fn();
const syncVesinvestPlanToForecastV2 = vi.fn();
const updateVesinvestGroupV2 = vi.fn();
const updateVesinvestPlanV2 = vi.fn();

vi.mock('../api', () => ({
  cloneVesinvestPlanV2: (...args: unknown[]) => cloneVesinvestPlanV2(...args),
  connectImportOrganizationV2: (...args: unknown[]) =>
    connectImportOrganizationV2(...args),
  createReportV2: (...args: unknown[]) => createReportV2(...args),
  createVesinvestPlanV2: (...args: unknown[]) => createVesinvestPlanV2(...args),
  getForecastScenarioV2: (...args: unknown[]) => getForecastScenarioV2(...args),
  getVesinvestPlanV2: (...args: unknown[]) => getVesinvestPlanV2(...args),
  listVesinvestGroupsV2: (...args: unknown[]) => listVesinvestGroupsV2(...args),
  listVesinvestPlansV2: (...args: unknown[]) => listVesinvestPlansV2(...args),
  searchImportOrganizationsV2: (...args: unknown[]) =>
    searchImportOrganizationsV2(...args),
  syncVesinvestPlanToForecastV2: (...args: unknown[]) =>
    syncVesinvestPlanToForecastV2(...args),
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
  label: 'Sanering / vattennatverk',
  defaultAccountKey: 'sanering_water_network',
  defaultDepreciationClassKey: 'water_network_post_1999',
  reportGroupKey: 'network_rehabilitation',
  serviceSplit: 'water' as const,
};

const wastewaterTreatmentGroup = {
  key: 'wastewater_treatment',
  label: 'Avloppsrening',
  defaultAccountKey: 'wastewater_treatment',
  defaultDepreciationClassKey: 'plant_buildings',
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

describe('VesinvestPlanningPanel', () => {
  beforeEach(() => {
    cloneVesinvestPlanV2.mockReset();
    connectImportOrganizationV2.mockReset();
    createReportV2.mockReset();
    createVesinvestPlanV2.mockReset();
    getForecastScenarioV2.mockReset();
    getVesinvestPlanV2.mockReset();
    listVesinvestGroupsV2.mockReset();
    listVesinvestPlansV2.mockReset();
    searchImportOrganizationsV2.mockReset();
    syncVesinvestPlanToForecastV2.mockReset();
    updateVesinvestGroupV2.mockReset();
    updateVesinvestPlanV2.mockReset();

    listVesinvestGroupsV2.mockResolvedValue([group, wastewaterTreatmentGroup]);
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
          category: 'Sanering / vattennatverk',
          depreciationClassKey: 'water_network_post_1999',
          depreciationRuleSnapshot: {
            assetClassKey: 'water_network_post_1999',
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

  it('creates a manual plan without sending update-only fields', async () => {
    listVesinvestPlansV2.mockResolvedValue([]);
    createVesinvestPlanV2.mockResolvedValue(
      makePlan({
        name: 'Fresh Vesinvest',
        utilityName: 'Fresh Utility',
        businessId: '5555555-5',
        projects: [
          {
            ...makePlan().projects[0],
            code: 'P-101',
            name: 'Fresh project',
          },
        ],
      }),
    );

    const { container } = render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(listVesinvestPlansV2).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    fireEvent.change(screen.getByRole('textbox', { name: /plan name/i }), {
      target: { value: 'Fresh Vesinvest' },
    });

    const projectNameInput = container.querySelector(
      'input[name="vesinvest-project-name-0"]',
    ) as HTMLInputElement | null;
    const projectCodeInput = container.querySelector(
      'input[name="vesinvest-project-code-0"]',
    ) as HTMLInputElement | null;
    const allocationInput = container.querySelector(
      'input[name="vesinvest-allocation-0-totalAmount-2026"]',
    ) as HTMLInputElement | null;

    expect(projectNameInput).toBeTruthy();
    expect(projectCodeInput).toBeTruthy();
    expect(allocationInput).toBeTruthy();

    fireEvent.change(projectCodeInput!, { target: { value: 'P-101' } });
    fireEvent.change(projectNameInput!, { target: { value: 'Fresh project' } });
    fireEvent.change(allocationInput!, { target: { value: '250000' } });

    await waitFor(() => {
      expect(projectCodeInput?.value).toBe('P-101');
      expect(projectNameInput?.value).toBe('Fresh project');
      expect(allocationInput?.value).toBe('250000');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Vesinvest plan' }));

    await waitFor(() => {
      expect(createVesinvestPlanV2).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Fresh Vesinvest',
        }),
      );
    });

    const payload = createVesinvestPlanV2.mock.calls[0]?.[0] as Record<string, unknown>;
    const projects = payload.projects as Array<Record<string, unknown>>;
    expect(projects?.[0]?.code).toBe('P-101');
    expect(payload.status).toBeUndefined();
    expect(payload.baselineStatus).toBeUndefined();
    expect(payload.feeRecommendationStatus).toBeUndefined();
    expect(payload.lastReviewedAt).toBeUndefined();
    expect(payload.reviewDueAt).toBeUndefined();
    expect(payload.utilityName).toBeUndefined();
    expect(payload.businessId).toBeUndefined();
    expect(payload.veetiId).toBeUndefined();
    expect(payload.identitySource).toBeUndefined();
  });

  it('saves an org-scoped group override from the admin editor', async () => {
    updateVesinvestGroupV2.mockResolvedValue({
      ...group,
      label: 'Updated group',
      defaultAccountKey: 'updated_account',
      defaultDepreciationClassKey: 'updated_depreciation',
      reportGroupKey: 'treatment',
      serviceSplit: 'mixed',
    });

    const { container } = render(
      <VesinvestPlanningPanel
        t={t as any}
        isAdmin
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(listVesinvestGroupsV2).toHaveBeenCalled();
    });

    const labelInput = container.querySelector(
      'input[name="vesinvest-group-label-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const accountInput = container.querySelector(
      'input[name="vesinvest-group-account-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const depreciationInput = container.querySelector(
      'input[name="vesinvest-group-depreciation-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const reportGroupInput = container.querySelector(
      'select[name="vesinvest-group-report-group-sanering_water_network"]',
    ) as HTMLSelectElement | null;
    const splitInput = container.querySelector(
      'select[name="vesinvest-group-split-sanering_water_network"]',
    ) as HTMLSelectElement | null;

    expect(labelInput).toBeTruthy();
    expect(accountInput).toBeTruthy();
    expect(depreciationInput).toBeTruthy();
    expect(reportGroupInput).toBeTruthy();
    expect(splitInput).toBeTruthy();

    fireEvent.change(labelInput!, { target: { value: 'Updated group' } });
    fireEvent.change(accountInput!, { target: { value: 'updated_account' } });
    fireEvent.change(depreciationInput!, {
      target: { value: 'updated_depreciation' },
    });
    fireEvent.change(reportGroupInput!, {
      target: { value: 'treatment' },
    });
    fireEvent.change(splitInput!, { target: { value: 'mixed' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);

    await waitFor(() => {
      expect(updateVesinvestGroupV2).toHaveBeenCalledWith(
        'sanering_water_network',
        {
          label: 'Updated group',
          defaultAccountKey: 'updated_account',
          defaultDepreciationClassKey: 'updated_depreciation',
          reportGroupKey: 'treatment',
          serviceSplit: 'mixed',
        },
      );
    });
  });

  it('saves the current draft before opening pricing', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'verified',
        pricingStatus: 'blocked',
      }),
    ]);
    const updatedPlan = makePlan({
      projects: [
        {
          ...makePlan().projects[0],
          name: 'Updated rehabilitation',
        },
      ],
    });
    updateVesinvestPlanV2.mockResolvedValue(updatedPlan);
    syncVesinvestPlanToForecastV2.mockResolvedValue({
      plan: makePlan({
        ...updatedPlan,
        status: 'active',
        pricingStatus: 'verified',
        feeRecommendationStatus: 'verified',
        selectedScenarioId: 'scenario-1',
      }),
      scenarioId: 'scenario-1',
    });
    const onGoToForecast = vi.fn();

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={onGoToForecast}
        onGoToReports={() => undefined}
      />,
    );

    const projectNameInput = await screen.findByDisplayValue('Main rehabilitation');
    fireEvent.change(projectNameInput, {
      target: { value: 'Updated rehabilitation' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open fee path' }));

    await waitFor(() => {
      expect(updateVesinvestPlanV2).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          projects: [
            expect.objectContaining({
              name: 'Updated rehabilitation',
            }),
          ],
        }),
      );
    });
    expect(syncVesinvestPlanToForecastV2).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        compute: true,
        baselineSourceState: expect.objectContaining({
          acceptedYears: [2024],
          baselineYears: [
            expect.objectContaining({
              year: 2024,
            }),
          ],
        }),
      }),
    );
    expect(updateVesinvestPlanV2.mock.invocationCallOrder[0]).toBeLessThan(
      syncVesinvestPlanToForecastV2.mock.invocationCallOrder[0],
    );
    expect(onGoToForecast).toHaveBeenCalledWith('scenario-1');
  });

  it('binds the VEETI utility from the in-panel lookup before plan creation', async () => {
    listVesinvestPlansV2.mockResolvedValue([]);
    connectImportOrganizationV2.mockResolvedValue({
      linked: {
        orgId: 'org-1',
        veetiId: 1535,
      },
    });
    const onPlansChanged = vi.fn();

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={null}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        onPlansChanged={onPlansChanged}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /veeti lookup/i }), {
      target: { value: 'Water Utility' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search VEETI' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Water Utility/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Water Utility/i }));

    await waitFor(() => {
      expect(connectImportOrganizationV2).toHaveBeenCalledWith(1535);
      expect(onPlansChanged).toHaveBeenCalled();
    });
  });

  it('keeps fee-path blocked until there are real investment allocations', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'verified',
        pricingStatus: 'blocked',
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'verified',
        totalInvestmentAmount: 0,
        yearlyTotals: [{ year: 2026, totalAmount: 0, waterAmount: 0, wastewaterAmount: 0 }],
        fiveYearBands: [{ startYear: 2026, endYear: 2030, totalAmount: 0 }],
        projects: [
          {
            ...makePlan().projects[0],
            waterAmount: 0,
            wastewaterAmount: 0,
            totalAmount: 0,
            allocations: [
              {
                id: 'allocation-1',
                year: 2026,
                totalAmount: 0,
                waterAmount: 0,
                wastewaterAmount: 0,
              },
            ],
          },
        ],
      }),
    );

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByDisplayValue('Main rehabilitation');
    expect(
      (screen.getByRole('button', { name: 'Open fee path' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        'Add investment rows and yearly allocations before fee-path and financing output can be opened.',
      ),
    ).toBeTruthy();
  });

  it('asks before discarding unsaved draft changes when switching revisions', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary(),
      makeSummary({
        id: 'plan-2',
        name: 'Water Utility Vesinvest v2',
        versionNumber: 2,
      }),
    ]);
    getVesinvestPlanV2.mockImplementation(async (id: string) =>
      id === 'plan-2'
        ? makePlan({
            id: 'plan-2',
            name: 'Water Utility Vesinvest v2',
            versionNumber: 2,
          })
        : makePlan(),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    const projectNameInput = await screen.findByDisplayValue('Main rehabilitation');
    fireEvent.change(projectNameInput, {
      target: { value: 'Unsaved draft change' },
    });
    const revisionSelect = screen.getByLabelText(
      'Plan revision',
    ) as HTMLSelectElement;
    expect(revisionSelect.name).toBe('vesinvestPlanSelector');
    expect(revisionSelect.id).toBe('v2-vesinvest-plan-selector');
    fireEvent.change(revisionSelect, {
      target: { value: 'plan-2' },
    });

    expect(window.confirm).toHaveBeenCalled();
    expect(revisionSelect.value).toBe('plan-1');
    expect(getVesinvestPlanV2).toHaveBeenCalledTimes(1);
  });

  it('shows accepted baseline evidence and the saved fee-path summary for a synced plan', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'verified',
        pricingStatus: 'verified',
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        pricingStatus: 'verified',
        feeRecommendationStatus: 'verified',
        feeRecommendation: {
          savedAt: '2026-04-09T08:00:00.000Z',
          linkedScenarioId: 'scenario-1',
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
            id: 'plan-1',
            seriesId: 'series-1',
            versionNumber: 1,
          },
        },
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2023, 2024],
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: [baselineYear],
        },
      }),
    );

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    const feePathTitle = await screen.findByText('Saved fee-path recommendation');
    expect(screen.getByText('Linked accepted budget budget-2024')).toBeTruthy();
    expect(screen.getByText('Statement import (bokslut-2024.pdf)')).toBeTruthy();
    expect(screen.getByText('Accepted baseline years')).toBeTruthy();
    expect(within(feePathTitle.closest('section')!).getByText('Verified')).toBeTruthy();
  });

  it('renders the grouped 20-year layout with class subtotal rows before project rows', async () => {
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        totalInvestmentAmount: 300,
        yearlyTotals: [
          { year: 2026, totalAmount: 150, waterAmount: 100, wastewaterAmount: 50 },
          { year: 2027, totalAmount: 150, waterAmount: 0, wastewaterAmount: 150 },
        ],
        fiveYearBands: [{ startYear: 2026, endYear: 2030, totalAmount: 300 }],
        projects: [
          {
            ...makePlan().projects[0],
            totalAmount: 100,
            allocations: [
              {
                id: 'allocation-1',
                year: 2026,
                totalAmount: 100,
                waterAmount: 100,
                wastewaterAmount: 0,
              },
              {
                id: 'allocation-2',
                year: 2027,
                totalAmount: 0,
                waterAmount: 0,
                wastewaterAmount: 0,
              },
            ],
          },
          {
            id: 'project-2',
            code: 'P-002',
            name: 'Plant renewal',
            investmentType: 'reparation' as const,
            groupKey: wastewaterTreatmentGroup.key,
            groupLabel: wastewaterTreatmentGroup.label,
            depreciationClassKey: wastewaterTreatmentGroup.defaultDepreciationClassKey,
            defaultAccountKey: wastewaterTreatmentGroup.defaultAccountKey,
            reportGroupKey: wastewaterTreatmentGroup.reportGroupKey,
            subtype: null,
            notes: null,
            waterAmount: 0,
            wastewaterAmount: 200,
            totalAmount: 200,
            allocations: [
              {
                id: 'allocation-3',
                year: 2026,
                totalAmount: 50,
                waterAmount: 0,
                wastewaterAmount: 50,
              },
              {
                id: 'allocation-4',
                year: 2027,
                totalAmount: 150,
                waterAmount: 0,
                wastewaterAmount: 150,
              },
            ],
          },
        ],
      }),
    );

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByText('Grouped 20-year layout');
    const matrix = screen.getByTestId('vesinvest-grouped-plan');

    expect(within(matrix).getByText('Sanering / vattennatverk')).toBeTruthy();
    expect(within(matrix).getByText('Avloppsrening')).toBeTruthy();
    expect(within(matrix).getByText('P-001')).toBeTruthy();
    expect(within(matrix).getByText('Main rehabilitation')).toBeTruthy();
    expect(within(matrix).getByText('P-002')).toBeTruthy();
    expect(within(matrix).getByText('Plant renewal')).toBeTruthy();
    expect(within(matrix).getByText('20-year total')).toBeTruthy();
  });

  it('derives total allocation from the water and wastewater split inputs', async () => {
    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByDisplayValue('Main rehabilitation');
    fireEvent.change(screen.getByLabelText('P-001 2026 waterAmount'), {
      target: { value: '125' },
    });
    fireEvent.change(screen.getByLabelText('P-001 2026 wastewaterAmount'), {
      target: { value: '75' },
    });

    expect(
      (screen.getByLabelText('P-001 2026 totalAmount') as HTMLInputElement).value,
    ).toBe('200');
  });

  it('creates a report directly from a synced Vesinvest plan', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        selectedScenarioId: 'scenario-1',
        pricingStatus: 'verified',
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
});
