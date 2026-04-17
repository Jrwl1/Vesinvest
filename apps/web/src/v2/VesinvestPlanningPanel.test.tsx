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
const listDepreciationRulesV2 = vi.fn();
const listVesinvestGroupsV2 = vi.fn();
const listVesinvestPlansV2 = vi.fn();
const searchImportOrganizationsV2 = vi.fn();
const syncVesinvestPlanToForecastV2 = vi.fn();
const updateDepreciationRuleV2 = vi.fn();
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

describe('VesinvestPlanningPanel', () => {
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

  it('does not insert a project row before staged confirmation and keeps cancel non-destructive', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        projectCount: 0,
        totalInvestmentAmount: 0,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        projectCount: 0,
        totalInvestmentAmount: 0,
        yearlyTotals: [],
        fiveYearBands: [],
        projects: [],
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

    expect(
      container.querySelector('input[name="vesinvest-project-name-0"]'),
    ).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Add project' })[0]!);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(
      container.querySelector('input[name="vesinvest-project-name-0"]'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      container.querySelector('input[name="vesinvest-project-name-0"]'),
    ).toBeNull();
    expect(screen.queryByText('Unnamed project')).toBeNull();
  });

  it('keeps Add project disabled until Vesinvest group defaults are loaded', () => {
    listVesinvestGroupsV2.mockImplementation(
      () => new Promise(() => undefined) as Promise<any>,
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
      screen
        .getAllByRole('button', { name: 'Add project' })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  it('opens the project composer from the empty investment-plan state', async () => {
    listVesinvestPlansV2.mockResolvedValue([
      makeSummary({
        projectCount: 0,
        totalInvestmentAmount: 0,
      }),
    ]);
    getVesinvestPlanV2.mockResolvedValue(
      makePlan({
        projectCount: 0,
        totalInvestmentAmount: 0,
        yearlyTotals: [],
        fiveYearBands: [],
        projects: [],
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

    await waitFor(() => {
      expect(listVesinvestPlansV2).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId('vesinvest-empty-add-project') as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    fireEvent.click(screen.getByTestId('vesinvest-empty-add-project'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('focuses the first yearly allocation after adding a new project', async () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);

    render(
      <VesinvestPlanningPanel
        t={t as any}
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Add project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Code' }), {
      target: { value: 'P-002' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Project' }), {
      target: { value: 'Pump station' },
    });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add project' }));

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByLabelText('P-002 2026 Total'),
      );
    });

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('saves an org-scoped group override from the admin editor', async () => {
    updateVesinvestGroupV2.mockResolvedValue({
      ...group,
      label: 'Updated group',
      defaultAccountKey: 'updated_account',
      defaultDepreciationClassKey: 'sanering_water_network',
      reportGroupKey: 'treatment',
      serviceSplit: 'mixed',
    });
    updateDepreciationRuleV2.mockResolvedValue({
      id: group.key,
      assetClassKey: group.key,
      assetClassName: 'Updated group',
      method: 'residual',
      linearYears: 18,
      residualPercent: 12,
      createdAt: '2026-04-08T10:00:00.000Z',
      updatedAt: '2026-04-08T10:00:00.000Z',
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

    fireEvent.click(screen.getByRole('button', { name: 'Depreciation plan' }));
    expect(screen.getByText('Depreciation method')).toBeTruthy();

    const labelInput = container.querySelector(
      'input[name="vesinvest-group-label-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const accountInput = container.querySelector(
      'input[name="vesinvest-group-account-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const splitInput = container.querySelector(
      'select[name="vesinvest-group-split-sanering_water_network"]',
    ) as HTMLSelectElement | null;
    const methodInput = container.querySelector(
      'select[name="vesinvest-group-method-sanering_water_network"]',
    ) as HTMLSelectElement | null;
    const yearsInput = container.querySelector(
      'input[name="vesinvest-group-years-sanering_water_network"]',
    ) as HTMLInputElement | null;
    const residualInput = container.querySelector(
      'input[name="vesinvest-group-residual-sanering_water_network"]',
    ) as HTMLInputElement | null;

    expect(labelInput).toBeTruthy();
    expect(accountInput).toBeTruthy();
    expect(splitInput).toBeTruthy();
    expect(methodInput).toBeTruthy();
    expect(yearsInput).toBeTruthy();
    expect(residualInput).toBeTruthy();
    expect(
      Array.from(methodInput?.options ?? []).map((option) => option.text),
    ).toEqual(['No depreciation', 'Straight-line', 'Residual']);

    fireEvent.change(labelInput!, { target: { value: 'Updated group' } });
    fireEvent.change(accountInput!, { target: { value: 'updated_account' } });
    fireEvent.change(splitInput!, { target: { value: 'mixed' } });
    fireEvent.change(methodInput!, { target: { value: 'residual' } });
    fireEvent.change(yearsInput!, { target: { value: '18' } });
    fireEvent.change(residualInput!, { target: { value: '12' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]!);

    await waitFor(() => {
      expect(updateVesinvestGroupV2).toHaveBeenCalledWith(
        'sanering_water_network',
        {
          label: 'Updated group',
          defaultAccountKey: 'updated_account',
          reportGroupKey: 'network_rehabilitation',
          serviceSplit: 'mixed',
        },
      );
      expect(updateDepreciationRuleV2).toHaveBeenCalledWith(
        'sanering_water_network',
        {
          assetClassKey: 'sanering_water_network',
          assetClassName: 'Updated group',
          method: 'residual',
          linearYears: 18,
          residualPercent: 12,
        },
      );
    });
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

    await screen.findByRole('heading', { name: 'Utility name' });
    expect(screen.getByRole('heading', { name: 'Plan state' })).toBeTruthy();
    expect(screen.queryByText('Plan revision')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Class-owned depreciation plan' })).toBeNull();
    expect(screen.queryByText('Grouped horizon layout')).toBeNull();
    expect(screen.queryByText('Editable project rows')).toBeNull();
    expect(screen.queryByText('Saved fee-path recommendation')).toBeNull();
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

    await screen.findByRole('heading', { name: 'Utility name' });
    expect(screen.getByText('Plan revision')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add project' })).toBeTruthy();
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
    const updatePayload = updateVesinvestPlanV2.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >;
    const updateProjects = updatePayload.projects as Array<Record<string, unknown>>;
    expect(updateProjects?.[0]?.id).toBeUndefined();
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
        planningContext={{ canCreateScenario: true, baselineYears: [baselineYear] } as any}
        linkedOrg={linkedOrg}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    const createReportButton = await screen.findByRole('button', {
      name: 'Create report',
    });
    const openPricingButton = screen.getByRole('button', {
      name: 'Open fee path',
    });
    const newRevisionButton = screen.getByRole('button', {
      name: 'New revision',
    });

    expect(createReportButton.className).not.toContain('v2-btn-primary');
    expect(openPricingButton.className).not.toContain('v2-btn-primary');
    expect(createReportButton.closest('.v2-actions-row')).not.toBe(
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
    expect(screen.queryByText('Linked accepted budget budget-2024')).toBeNull();
    expect(screen.getByText('Statement import (bokslut-2024.pdf)')).toBeTruthy();
    expect(screen.getAllByText('Accepted baseline years').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Current report snapshot follows VEETI for this dataset.'),
    ).toBeNull();
    expect(within(feePathTitle.closest('section')!).getByText('Verified')).toBeTruthy();
    expect(
      screen.getByText('Saved fee-path result still matches this revision.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Sync the plan to open fee-path and financing results.'),
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

    await screen.findByText('Saved fee-path recommendation');
    expect(
      screen.getByText('Investment plan changed since the last fee-path result.'),
    ).toBeTruthy();
    expect(
      screen.queryByText('Sync the plan to open fee-path and financing results.'),
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
      await screen.findByText(/Source document \(baseline-2024\.pdf\).+pp\. 3, 4/),
    ).toBeTruthy();
    expect(await screen.findByText(/Revenue 95 000 EUR/)).toBeTruthy();
    expect(await screen.findByText(/Operating costs 70 000 EUR/)).toBeTruthy();
  });

  it('keeps the source document filename visible when workbook repair is mixed into the same dataset', async () => {
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
        /Source document \+ workbook repair.+baseline-2024\.pdf.+pp\. 3, 4/,
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        /Document-backed values and workbook repairs both affect this year\..+baseline-2024\.pdf.+pp\. 3, 4/,
      ),
    ).toBeTruthy();
  });

  it('keeps the statement filename visible when workbook repair is mixed into the same dataset', async () => {
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
      await screen.findByText(/Statement PDF \+ workbook repair.+bokslut-2024\.pdf/),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        /Statement-backed values and workbook repairs both affect this year\..+bokslut-2024\.pdf/,
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
    fireEvent.change(screen.getByLabelText('P-001 2026 Water total'), {
      target: { value: '125' },
    });
    fireEvent.change(screen.getByLabelText('P-001 2026 Wastewater total'), {
      target: { value: '75' },
    });

    expect(
      (screen.getByLabelText('P-001 2026 Total') as HTMLInputElement).value,
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

  it('maps stale report-create conflicts back to the saved fee-path hint instead of showing the raw API error', async () => {
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
        'Accepted baseline changed after the saved fee-path result.',
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('Saved fee-path result still matches this revision.'),
    ).toBeNull();
  });

  it('keeps accepted baseline years readable and separates revision actions from workflow actions', async () => {
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
    const openFeePathButton = await screen.findByRole('button', { name: 'Open fee path' });
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
        baselineStatus: 'verified',
        investmentPlanChangedSinceFeeRecommendation: false,
      }),
      makeSummary({
        id: 'plan-2',
        name: 'Water Utility Vesinvest v2',
        versionNumber: 2,
        selectedScenarioId: 'scenario-2',
        pricingStatus: 'verified',
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
      name: 'Saved fee-path recommendation',
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
