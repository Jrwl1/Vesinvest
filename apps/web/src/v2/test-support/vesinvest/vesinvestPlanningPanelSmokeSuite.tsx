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



export function registerVesinvestPlanningPanelSmokeSuite() {
  describe('VesinvestPlanningPanel smoke', () => {
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Add project' })[0]!);
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: /code/i }), {
      target: { value: 'P-101' },
    });
    fireEvent.change(within(dialog).getByRole('combobox', { name: /class/i }), {
      target: { value: wastewaterTreatmentGroup.key },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /project/i }), {
      target: { value: 'Fresh project' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add project' }));

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
    expect(projects?.[0]?.groupKey).toBe(wastewaterTreatmentGroup.key);
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

  it('shows the live accepted baseline evidence before the revision has been resaved', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'incomplete',
        pricingStatus: 'blocked',
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'incomplete',
        baselineSourceState: null,
        selectedScenarioId: null,
      }),
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

    await screen.findByText('Baseline verified');
    expect(screen.queryByText('Accepted baseline link')).toBeNull();
    expect(screen.getByText('Accepted baseline years')).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
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

    const openReportsButton = await screen.findByRole('button', {
      name: 'Open Reports',
    });
    await waitFor(() => {
      expect((openReportsButton as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(openReportsButton);

    expect(createReportV2).not.toHaveBeenCalled();
    expect(onGoToReports).toHaveBeenCalled();
  });

  });
}
