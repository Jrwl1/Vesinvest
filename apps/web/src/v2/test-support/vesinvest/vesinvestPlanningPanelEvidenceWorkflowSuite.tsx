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

const completedAssetEvidence = {
  assetEvidenceState: { notes: 'Asset inventory reviewed and current.' },
  conditionStudyState: { notes: 'Condition study coverage reviewed.' },
  maintenanceEvidenceState: { notes: 'Maintenance logs reviewed.' },
  municipalPlanContext: { notes: 'Municipal planning drivers captured.' },
  financialRiskState: { notes: 'Financial and delivery risks reviewed.' },
  publicationState: { notes: 'Publication boundaries confirmed.' },
  communicationState: { notes: 'Board and customer communication reviewed.' },
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



export function registerVesinvestPlanningPanelEvidenceWorkflowSuite() {
  describe('VesinvestPlanningPanel evidence and workflow', () => {
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

  it('shows the bound VEETI identity before the defaults and plan sections', async () => {
    render(
      <VesinvestPlanningPanel
        t={t as any}
        isAdmin
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByText('1535');
    const headings = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent?.trim());

    expect(headings.indexOf('Utility name')).toBeLessThan(
      headings.indexOf('Plan state'),
    );
    expect(screen.getByRole('button', { name: 'Investment plan' })).toBeTruthy();
  });

  it('hides the heavy plan sections in simplified setup mode', async () => {
    render(
      <VesinvestPlanningPanel
        t={t as any}
        isAdmin
        simplifiedSetup
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByText('Utility name');
    expect(screen.getByRole('heading', { name: 'Plan state' })).toBeTruthy();
    expect(screen.queryByText('Plan revision')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Class-owned depreciation plan' })).toBeNull();
    expect(screen.queryByText('Grouped horizon layout')).toBeNull();
    expect(screen.queryByText('Editable project rows')).toBeNull();
    expect(screen.queryByText('Saved tariff-plan recommendation')).toBeNull();
  });

  it('keeps the full plan surface available for non-admin simplified setup users', async () => {
    render(
      <VesinvestPlanningPanel
        t={t as any}
        simplifiedSetup
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByText('Utility name');
    expect(screen.getByText('Plan revision')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add project' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Grouped horizon layout' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Editable project rows' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Group' })).toBeNull();
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
        ...completedAssetEvidence,
        status: 'active',
        pricingStatus: 'verified',
        feeRecommendationStatus: 'verified',
        selectedScenarioId: 'scenario-1',
      }),
      scenarioId: 'scenario-1',
    });
    const onGoToForecast = vi.fn();
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        ...completedAssetEvidence,
      }),
    );

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
    fireEvent.click(screen.getByRole('button', { name: 'Sync to Forecast' }));

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
    const updatePayload = updateVesinvestPlanV2.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    const updateProjects = updatePayload.projects as Array<Record<string, unknown>>;
    expect(updateProjects?.[0]?.id).toBeUndefined();
    expect(updatePayload.baselineSourceState).toBeNull();
    expect(syncVesinvestPlanToForecastV2).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({
        compute: true,
        baselineSourceState: null,
      }),
    );
    expect(updateVesinvestPlanV2.mock.invocationCallOrder[0]).toBeLessThan(
      syncVesinvestPlanToForecastV2.mock.invocationCallOrder[0],
    );
    expect(onGoToForecast).toHaveBeenCalledWith('scenario-1');
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

  it('clears a stale saved accepted-budget link when live baseline years drift', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'incomplete',
        pricingStatus: 'blocked',
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'incomplete',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2023],
          latestAcceptedBudgetId: 'budget-2023',
          baselineYears: [{ ...baselineYear, year: 2023 }],
          snapshotCapturedAt: '2026-04-08T10:00:00.000Z',
        },
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

    await screen.findByText('Accepted baseline years');
    expect(screen.queryByText('Accepted baseline link')).toBeNull();
    expect(screen.getByText('2024')).toBeTruthy();
    expect(
      screen.queryByText(/Linked accepted budget budget-2023/),
    ).toBeNull();
  });

  it('clears a saved accepted-budget link when the revision is flagged as baseline-drifted for the same years', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'incomplete',
        pricingStatus: 'blocked',
        baselineChangedSinceAcceptedRevision: true,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'incomplete',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2024],
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: [baselineYear],
          snapshotCapturedAt: '2026-04-08T10:00:00.000Z',
        },
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

    await screen.findByText('Accepted baseline years');
    expect(screen.queryByText('Accepted baseline link')).toBeNull();
    expect(screen.getByText('2024')).toBeTruthy();
    expect(
      screen.queryByText(/Linked accepted budget budget-2024/),
    ).toBeNull();
  });

  it('separates workflow actions from revision maintenance and pins the next CTA', async () => {
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
        ...completedAssetEvidence,
        selectedScenarioId: 'scenario-1',
        feeRecommendationStatus: 'verified',
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

    const openReportsButton = await screen.findByRole('button', {
      name: 'Open Reports',
    });
    const syncToForecastButton = screen.getByRole('button', {
      name: 'Sync to Forecast',
    });
    const newRevisionButton = screen.getByRole('button', {
      name: 'New revision',
    });

    expect(openReportsButton.className).toContain('v2-btn-primary');
    expect(syncToForecastButton.className).not.toContain('v2-btn-primary');
    expect(openReportsButton.closest('.v2-actions-row')).not.toBe(
      newRevisionButton.closest('.v2-actions-row'),
    );
  });

  it('keeps add project as the only primary CTA for an empty draft', async () => {
    listVesinvestPlansV2.mockResolvedValue([]);

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: false, baselineYears: [] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    const createPlanButton = screen.getByRole('button', {
      name: 'Create Vesinvest plan',
    });
    const workflowRow = createPlanButton.closest('.v2-actions-row') as HTMLElement;
    const addProjectButton = within(workflowRow).getByRole('button', {
      name: 'Add project',
    });

    expect(addProjectButton.className).toContain('v2-btn-primary');
    expect(createPlanButton.className).not.toContain('v2-btn-primary');
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
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

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
        ...completedAssetEvidence,
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
      (screen.getByRole('button', { name: 'Sync to Forecast' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        'Add investment rows and yearly allocations before tariff-plan and financing output can be opened.',
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
        selectedScenarioId: 'scenario-1',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        pricingStatus: 'verified',
        feeRecommendationStatus: 'verified',
        selectedScenarioId: 'scenario-1',
        investmentPlanChangedSinceFeeRecommendation: false,
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

    const feePathTitle = await screen.findByText('Saved tariff-plan recommendation');
    expect(screen.queryByText('Linked accepted budget budget-2024')).toBeNull();
    expect(screen.getByText('Statement import (bokslut-2024.pdf)')).toBeTruthy();
    expect(screen.getAllByText('Accepted baseline years').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Current report snapshot follows VEETI for this dataset.'),
    ).toBeNull();
    expect(within(feePathTitle.closest('section')!).getByText('Verified')).toBeTruthy();
    expect(
      screen.getByText('Saved tariff-plan result still matches this revision.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Sync the plan to open tariff-plan and financing results.'),
    ).toBeNull();
  });

  it('keeps the pricing hint truthful when a saved fee path exists but the revision has gone provisional', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        baselineStatus: 'verified',
        pricingStatus: 'provisional',
        investmentPlanChangedSinceFeeRecommendation: true,
        selectedScenarioId: 'scenario-1',
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        pricingStatus: 'provisional',
        investmentPlanChangedSinceFeeRecommendation: true,
        selectedScenarioId: 'scenario-1',
        veetiId: 1535,
        businessId: '1234567-8',
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

    await screen.findByText('Saved tariff-plan recommendation');
    expect(
      screen.getByText('Investment plan changed since the last tariff-plan result.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Sync the plan to open tariff-plan and financing results.'),
    ).toBeNull();
  });

  it('shows all accepted baseline years in the evidence section', async () => {
    const allBaselineYears = [2021, 2022, 2023, 2024].map((year) => ({
      ...baselineYear,
      year,
      financials: {
        ...baselineYear.financials,
        provenance: {
          ...baselineYear.financials.provenance,
          fileName: `bokslut-${year}.pdf`,
        },
      },
      volumes: {
        ...baselineYear.volumes,
        provenance: {
          ...baselineYear.volumes.provenance,
          fileName: `qdis-${year}.pdf`,
        },
      },
    }));

    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'verified',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: allBaselineYears.map((item) => item.year),
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: allBaselineYears,
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

    expect(await screen.findByText('4 year(s)')).toBeTruthy();
    expect(screen.getByText('2021')).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
  });

  it('shows document page and source-line provenance in the evidence section', async () => {
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'verified',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2024],
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: [
            {
              ...baselineYear,
              financials: {
                ...baselineYear.financials,
                provenance: {
                  kind: 'document_import',
                  fileName: 'baseline-2024.pdf',
                  pageNumber: 3,
                  pageNumbers: [3, 4],
                  confidence: 94,
                  scannedPageCount: 4,
                  matchedFields: ['Liikevaihto'],
                  warnings: [],
                  sourceLines: [
                    { pageNumber: 3, text: 'Revenue 95 000 EUR' },
                    { pageNumber: 4, text: 'Operating costs 70 000 EUR' },
                  ],
                },
              },
            },
          ],
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

    expect(
      await screen.findByText(/(Evidence file|Lähdeaineisto|Underlag) \(baseline-2024\.pdf\).+pp\. 3, 4/),
    ).toBeTruthy();
    expect(await screen.findByText(/Revenue 95 000 EUR/)).toBeTruthy();
    expect(await screen.findByText(/Operating costs 70 000 EUR/)).toBeTruthy();
  });

  it('keeps the evidence filename visible when Excel repair is mixed into the same dataset', async () => {
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'verified',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2024],
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: [
            {
              ...baselineYear,
              financials: {
                ...baselineYear.financials,
                provenance: {
                  kind: 'document_import',
                  fileName: 'baseline-2024.pdf',
                  pageNumber: 3,
                  pageNumbers: [3, 4],
                  confidence: 94,
                  scannedPageCount: 4,
                  matchedFields: ['Liikevaihto'],
                  warnings: [],
                  sourceLines: [{ pageNumber: 3, text: 'Revenue 95 000 EUR' }],
                  fieldSources: [
                    {
                      sourceField: 'Liikevaihto',
                      provenance: {
                        kind: 'document_import',
                        fileName: 'baseline-2024.pdf',
                        pageNumber: 3,
                        pageNumbers: [3, 4],
                        confidence: 94,
                        scannedPageCount: 4,
                        matchedFields: ['Liikevaihto'],
                        warnings: [],
                        sourceLines: [{ pageNumber: 3, text: 'Revenue 95 000 EUR' }],
                      },
                    },
                    {
                      sourceField: 'Poistot',
                      provenance: {
                        kind: 'excel_import',
                        fileName: 'kva-2024.xlsx',
                        pageNumber: null,
                        confidence: null,
                        scannedPageCount: null,
                        matchedFields: ['Poistot'],
                        warnings: [],
                        sheetName: 'KVA',
                        matchedYears: [2024],
                        confirmedSourceFields: ['Poistot'],
                        candidateRows: [],
                      },
                    },
                  ],
                },
              },
            } as any,
          ],
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

    expect(
      await screen.findByText(
        /(Evidence file|Lähdeaineisto|Underlag) \+ Excel.+baseline-2024\.pdf.+pp\. 3, 4/,
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        /Document-backed values and Excel repairs both affect this year\..+baseline-2024\.pdf.+pp\. 3, 4/,
      ),
    ).toBeTruthy();
  });

  it('keeps the statement filename visible when Excel repair is mixed into the same dataset', async () => {
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        baselineStatus: 'verified',
        baselineSourceState: {
          source: 'accepted_planning_baseline',
          acceptedYears: [2024],
          latestAcceptedBudgetId: 'budget-2024',
          baselineYears: [
            {
              ...baselineYear,
              financials: {
                ...baselineYear.financials,
                provenance: {
                  kind: 'statement_import',
                  fileName: 'bokslut-2024.pdf',
                  pageNumber: 3,
                  confidence: 98,
                  scannedPageCount: 4,
                  matchedFields: ['Liikevaihto'],
                  warnings: [],
                  fieldSources: [
                    {
                      sourceField: 'Liikevaihto',
                      provenance: {
                        kind: 'statement_import',
                        fileName: 'bokslut-2024.pdf',
                        pageNumber: 3,
                        confidence: 98,
                        scannedPageCount: 4,
                        matchedFields: ['Liikevaihto'],
                        warnings: [],
                      },
                    },
                    {
                      sourceField: 'Poistot',
                      provenance: {
                        kind: 'excel_import',
                        fileName: 'kva-2024.xlsx',
                        pageNumber: null,
                        confidence: null,
                        scannedPageCount: null,
                        matchedFields: ['Poistot'],
                        warnings: [],
                        sheetName: 'KVA',
                        matchedYears: [2024],
                        confirmedSourceFields: ['Poistot'],
                        candidateRows: [],
                      },
                    },
                  ],
                },
              },
            } as any,
          ],
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

    expect(
      await screen.findByText(/Statement PDF \+ Excel repair.+bokslut-2024\.pdf/),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        /Statement-backed values and Excel repairs both affect this year\..+bokslut-2024\.pdf/,
      ),
    ).toBeTruthy();
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

    await screen.findByText('Grouped horizon layout');
    const matrix = screen.getByTestId('vesinvest-grouped-plan');

    expect(within(matrix).getByText('Water network rehabilitation')).toBeTruthy();
    expect(within(matrix).getByText('Wastewater treatment')).toBeTruthy();
    expect(within(matrix).getByText('P-001')).toBeTruthy();
    expect(within(matrix).getByText('Main rehabilitation')).toBeTruthy();
    expect(within(matrix).getByText('P-002')).toBeTruthy();
    expect(within(matrix).getByText('Plant renewal')).toBeTruthy();
    expect(within(matrix).getByText('Horizon total')).toBeTruthy();
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
    const [editAllocations] = screen.getAllByRole('button', {
      name: 'Edit yearly allocations',
    });
    fireEvent.click(editAllocations);
    const allocationDialog = await screen.findByRole('dialog', {
      name: 'Edit yearly allocations',
    });
    fireEvent.change(within(allocationDialog).getByLabelText('P-001 2026 Water total'), {
      target: { value: '125' },
    });
    fireEvent.change(within(allocationDialog).getByLabelText('P-001 2026 Wastewater total'), {
      target: { value: '75' },
    });

    expect(
      (within(allocationDialog).getByLabelText('P-001 2026 Total') as HTMLInputElement).value,
    ).toBe('200');
  });

  });
}
