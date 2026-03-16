import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fi from '../i18n/locales/fi.json';
import { OverviewPageV2 } from './OverviewPageV2';

const completeImportYearManuallyV2 = vi.fn();
const connectImportOrganizationV2 = vi.fn();
const createForecastScenarioV2 = vi.fn();
const createPlanningBaselineV2 = vi.fn();
const deleteImportYearsBulkV2 = vi.fn();
const deleteImportYearV2 = vi.fn();
const excludeImportYearsV2 = vi.fn();
const getImportStatusV2 = vi.fn();
const getImportYearDataV2 = vi.fn();
const importYearsV2 = vi.fn();
const getOpsFunnelV2 = vi.fn();
const getOverviewV2 = vi.fn();
const getPlanningContextV2 = vi.fn();
const listForecastScenariosV2 = vi.fn();
const listReportsV2 = vi.fn();
const refreshOverviewPeerV2 = vi.fn();
const reconcileImportYearV2 = vi.fn();
const restoreImportYearsV2 = vi.fn();
const searchImportOrganizationsV2 = vi.fn();
const syncImportV2 = vi.fn();
const sendV2OpsEvent = vi.fn();

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
    typeof defaultValueOrOptions === 'string' ? defaultValueOrOptions : undefined;
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  const resolved = pick(fi as Record<string, unknown>, key);
  let out = typeof resolved === 'string' ? resolved : (defaultValue ?? key);
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

const localeText = (key: string, options?: Record<string, unknown>) =>
  translate(key, undefined, options);

const getPrimaryButtons = () =>
  Array.from(document.querySelectorAll('button.v2-btn-primary')).map(
    (button) => button as HTMLButtonElement,
  );

const expectPrimaryButtonLabels = (labels: string[]) => {
  const primaryButtons = getPrimaryButtons();
  expect(primaryButtons).toHaveLength(labels.length);
  expect(
    primaryButtons.map((button) => button.textContent?.replace(/\s+/g, ' ').trim()),
  ).toEqual(labels);
};

const buildOverviewResponse = (options?: {
  excludedYears?: number[];
  workspaceYears?: number[];
  years?: any[];
}) => {
  const years =
    options?.years ??
    [
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'MIXED',
        sourceBreakdown: {
          veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: ['tilinpaatos'],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: '2026-03-08T10:00:00.000Z',
        manualEditedBy: 'tester',
        manualReason: 'Statement-backed correction',
        manualProvenance: {
          kind: 'statement_import',
          fileName: 'bokslut-2024.pdf',
          pageNumber: 3,
          confidence: 98,
          matchedFields: ['liikevaihto'],
        },
      },
      {
        vuosi: 2023,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          volume_vesi: true,
          volume_jatevesi: false,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'volume_vesi'],
          manualDataTypes: [],
        },
        warnings: ['missing_prices'],
        datasetCounts: {
          tilinpaatos: 1,
          volume_vesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

  return {
    latestVeetiYear: 2024,
    importStatus: {
      connected: true,
      tariffScope: 'usage_fee_only',
      link: {
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        lastFetchedAt: '2026-03-08T10:00:00.000Z',
      },
      excludedYears: options?.excludedYears ?? [],
      years,
      availableYears: years,
      workspaceYears: options?.workspaceYears,
    },
    kpis: {
      revenue: { current: 100000, deltaPct: 0 },
      operatingCosts: { current: 70000, deltaPct: 0 },
      costs: { current: 70000, deltaPct: 0 },
      financingNet: { current: 0, deltaPct: 0 },
      otherResultItems: { current: 0, deltaPct: 0 },
      yearResult: { current: 30000, deltaPct: 0 },
      result: { current: 30000, deltaPct: 0 },
      volume: { current: 50000, deltaPct: 0 },
      combinedPrice: { current: 2.5, deltaPct: 0 },
    },
    trendSeries: [
      {
        year: 2023,
        revenue: 95000,
        operatingCosts: 68000,
        yearResult: 27000,
        volume: 48000,
        combinedPrice: 2.4,
      },
      {
        year: 2024,
        revenue: 100000,
        operatingCosts: 70000,
        yearResult: 30000,
        volume: 50000,
        combinedPrice: 2.5,
      },
    ],
    peerSnapshot: {
      available: false,
      reason: 'No VEETI years imported.',
      year: null,
      kokoluokka: null,
      orgCount: 0,
      peerCount: 0,
      isStale: false,
      computedAt: null,
      metrics: [],
      peers: [],
    },
  } as any;
};

const buildPlanningContextResponse = (options?: {
  canCreateScenario?: boolean;
  baselineYears?: any[];
}) =>
  ({
    canCreateScenario: options?.canCreateScenario ?? true,
    baselineYears:
      options?.baselineYears ??
      [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
          financials: { dataType: 'tilinpaatos', source: 'manual' },
          prices: { dataType: 'taksa', source: 'veeti' },
          volumes: { dataType: 'volume_vesi+volume_jatevesi', source: 'veeti' },
          investmentAmount: 150000,
          soldWaterVolume: 25000,
          soldWastewaterVolume: 25000,
          combinedSoldVolume: 50000,
          processElectricity: 4000,
          pumpedWaterVolume: 55000,
          waterBoughtVolume: 0,
          waterSoldVolume: 50000,
          netWaterTradeVolume: 0,
        },
      ],
    operations: {
      latestYear: 2024,
      energySeries: [],
      complianceYears: [],
      toimintakertomusCount: 0,
      toimintakertomusLatestYear: null,
      vedenottolupaCount: 0,
      activeVedenottolupaCount: 0,
      networkAssetsCount: 0,
    },
  }) as any;

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: translate,
    i18n: { language: 'fi' },
  }),
}));

vi.mock('../api', () => ({
  completeImportYearManuallyV2: (...args: unknown[]) =>
    completeImportYearManuallyV2(...args),
  connectImportOrganizationV2: (...args: unknown[]) =>
    connectImportOrganizationV2(...args),
  createForecastScenarioV2: (...args: unknown[]) =>
    createForecastScenarioV2(...args),
  createPlanningBaselineV2: (...args: unknown[]) =>
    createPlanningBaselineV2(...args),
  deleteImportYearsBulkV2: (...args: unknown[]) =>
    deleteImportYearsBulkV2(...args),
  deleteImportYearV2: (...args: unknown[]) => deleteImportYearV2(...args),
  excludeImportYearsV2: (...args: unknown[]) => excludeImportYearsV2(...args),
  getImportStatusV2: (...args: unknown[]) => getImportStatusV2(...args),
  getImportYearDataV2: (...args: unknown[]) => getImportYearDataV2(...args),
  importYearsV2: (...args: unknown[]) => importYearsV2(...args),
  getOpsFunnelV2: (...args: unknown[]) => getOpsFunnelV2(...args),
  getOverviewV2: (...args: unknown[]) => getOverviewV2(...args),
  getPlanningContextV2: (...args: unknown[]) => getPlanningContextV2(...args),
  listForecastScenariosV2: (...args: unknown[]) =>
    listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
  refreshOverviewPeerV2: (...args: unknown[]) => refreshOverviewPeerV2(...args),
  reconcileImportYearV2: (...args: unknown[]) =>
    reconcileImportYearV2(...args),
  restoreImportYearsV2: (...args: unknown[]) => restoreImportYearsV2(...args),
  searchImportOrganizationsV2: (...args: unknown[]) =>
    searchImportOrganizationsV2(...args),
  syncImportV2: (...args: unknown[]) => syncImportV2(...args),
}));

vi.mock('./opsTelemetry', () => ({
  sendV2OpsEvent: (...args: unknown[]) => sendV2OpsEvent(...args),
}));

vi.mock('./statementOcr', () => ({
  extractStatementFromPdf: vi.fn(),
}));

describe('OverviewPageV2', () => {
  beforeEach(() => {
    completeImportYearManuallyV2.mockReset();
    connectImportOrganizationV2.mockReset();
    createForecastScenarioV2.mockReset();
    createPlanningBaselineV2.mockReset();
    deleteImportYearsBulkV2.mockReset();
    deleteImportYearV2.mockReset();
    excludeImportYearsV2.mockReset();
    getImportStatusV2.mockReset();
    getImportYearDataV2.mockReset();
    importYearsV2.mockReset();
    getOpsFunnelV2.mockReset();
    getOverviewV2.mockReset();
    getPlanningContextV2.mockReset();
    listForecastScenariosV2.mockReset();
    listReportsV2.mockReset();
    refreshOverviewPeerV2.mockReset();
    reconcileImportYearV2.mockReset();
    restoreImportYearsV2.mockReset();
    searchImportOrganizationsV2.mockReset();
    syncImportV2.mockReset();
    sendV2OpsEvent.mockReset();

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );

    getPlanningContextV2.mockResolvedValue(buildPlanningContextResponse());

    listForecastScenariosV2.mockResolvedValue([
      { id: 'scenario-1', nimi: 'Scenario 1', computedYears: 20 },
    ]);
    listReportsV2.mockResolvedValue([
      { id: 'report-1', title: 'Report 1', createdAt: '2026-03-08T10:00:00.000Z' },
    ]);
    getOpsFunnelV2.mockResolvedValue(null);
    importYearsV2.mockResolvedValue({
      selectedYears: [2024],
      importedYears: [2024],
      skippedYears: [],
      sync: { linked: { orgId: 'org-1', veetiId: 1535, nimi: 'Water Utility', ytunnus: '1234567-8' }, fetchedAt: '2026-03-08T10:00:00.000Z', years: [2024], snapshotUpserts: 4 },
      status: { connected: true, link: { nimi: 'Water Utility', ytunnus: '1234567-8', lastFetchedAt: '2026-03-08T10:00:00.000Z' }, years: [], excludedYears: [] },
    });
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: year === 2024,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: year === 2024,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 95000, TilikaudenYliJaama: 25000 }],
          effectiveRows: [{ Liikevaihto: 100000, TilikaudenYliJaama: 30000 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Statement-backed correction',
            provenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        },
        {
          dataType: 'taksa',
          rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it.skip('renders the wizard summary and focused year-status review step', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText('Valmis ennustamiseen?')).toBeTruthy();
    expect(screen.getByText('Setup summary')).toBeTruthy();
    expect(screen.getByText('Selected company')).toBeTruthy();
    expect(screen.getByText('Imported years')).toBeTruthy();
    expect(screen.getByText('Baseline ready')).toBeTruthy();
    expect(await screen.findByText('Mitkä vuodet ovat käyttövalmiita?')).toBeTruthy();
    expect(screen.getByText('Valmis')).toBeTruthy();
    expect(screen.getByText('Korjattava')).toBeTruthy();
    expect(screen.getAllByText('Tilinpäätös').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.datasetPrices')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.datasetWaterVolume')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(screen.getByText('Imported workspace years')).toBeTruthy();
    expect(
      screen.getByText('Imported workspace years: 2024, 2023.'),
    ).toBeTruthy();
    expect(screen.getByText('Step 4 decisions')).toBeTruthy();
    expect(
      screen.getByText('1 year still needs a decision before baseline creation.'),
    ).toBeTruthy();
    expect(screen.queryByText('Selected year')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Trend view' })).toBeNull();
    expect(screen.queryByText('Peer snapshot')).toBeNull();
    expect(screen.queryByText('Operations and compliance context')).toBeNull();
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
    ).toBeNull();
  });

  it('renders the wizard summary and focused year-status review step', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.wizardLabel'))).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.wizardProgress', { step: 3 }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(localeText('v2Overview.wizardSummaryTitle'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.wizardSummarySubtitle'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.wizardSummaryCompany'))).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryImportedYears')),
    ).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.wizardSummaryReadyYears'))).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryExcludedYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryBaselineReady')),
    ).toBeTruthy();
    expect(
      (await screen.findAllByText(/vuodet ovat/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Valmis')).toBeTruthy();
    expect(screen.getByText('Korjattava')).toBeTruthy();
    expect(screen.getAllByText(/Tilin/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.datasetPrices')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.datasetWaterVolume')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.reviewContinueBlockedHint')),
    ).toBeTruthy();
    expect(screen.queryByText('Selected year')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Trend view' })).toBeNull();
    expect(screen.queryByText('Peer snapshot')).toBeNull();
    expect(screen.queryByText('Operations and compliance context')).toBeNull();
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
    expect(screen.queryByText('Valmis ennustamiseen?')).toBeNull();
    expect(
      screen.queryByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
    ).toBeNull();
  });

  it('surfaces blocked-year status inside the focused year review list', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText('Korjattava')).toBeTruthy();
    expect(
      screen.getByText('T\u00E4st\u00E4 vuodesta puuttuu: Taksatiedot.'),
    ).toBeTruthy();
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Puuttuu').length).toBeGreaterThan(0);
  });

  it.skip('routes review continue into the first problem year fix flow', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));

    expect(
      await screen.findByText('Mitä tälle vuodelle tehdään?'),
    ).toBeTruthy();
    expect(screen.getByText('2023')).toBeTruthy();
  });

  it('routes review continue into the first problem year fix flow', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent ?? '').toMatch(/vuodelle tehd/i);
    expect(dialog.textContent ?? '').toContain('2023');
  });

  it('returns to the review surface when the year decision dialog is closed', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));
    fireEvent.click(
      await screen.findByRole('button', { name: localeText('common.cancel') }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
  });

  it('keeps primary emphasis and mounted controls aligned with the active review step', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const continueButton = await screen.findByRole('button', { name: 'Jatka' });
    expectPrimaryButtonLabels(['Jatka']);
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Avaa Ennuste' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
    ).toBeNull();

    fireEvent.click(continueButton);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent ?? '').toContain('2023');
    expectPrimaryButtonLabels([
      localeText('v2Overview.manualPatchSaveAndSync'),
    ]);
    expect(screen.getByRole('button', { name: 'Korjaa arvot' }).className).not.toContain(
      'v2-btn-primary',
    );
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeNull();
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Avaa Ennuste' })).toBeNull();
    expect(
      screen.queryByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
    ).toBeNull();
  });

  it('reports the blocked-year branch through step 5 while keeping one primary CTA visible', async () => {
    const onSetupWizardStateChange = vi.fn();
    const readyYear = buildOverviewResponse().importStatus.years[0];
    const postExclusionOverview = buildOverviewResponse({
      excludedYears: [2023],
      workspaceYears: [2024],
      years: [readyYear],
    });

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getOverviewV2.mockResolvedValueOnce(postExclusionOverview);
    getPlanningContextV2.mockResolvedValue(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );
    excludeImportYearsV2.mockResolvedValue({
      requestedYears: [2023],
      excludedCount: 1,
      alreadyExcludedCount: 0,
      results: [{ vuosi: 2023, excluded: true, reason: null }],
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [2023],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
        onSetupWizardStateChange={onSetupWizardStateChange}
      />,
    );

    await waitFor(() => {
      expect(onSetupWizardStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 3,
          activeStep: 3,
          selectedProblemYear: null,
        }),
      );
    });
    expectPrimaryButtonLabels([localeText('v2Overview.reviewContinue')]);

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );

    await waitFor(() => {
      expect(onSetupWizardStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 4,
          activeStep: 4,
          selectedProblemYear: 2023,
        }),
      );
    });
    expectPrimaryButtonLabels([localeText('v2Overview.manualPatchSaveAndSync')]);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Pois suunnitelmasta',
      }),
    );

    await waitFor(() => {
      expect(excludeImportYearsV2).toHaveBeenCalledWith([2023]);
    });
    expectPrimaryButtonLabels([localeText('v2Overview.reviewContinue')]);

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );

    const baselineButton = await screen.findByRole('button', {
      name: localeText('v2Overview.createPlanningBaseline'),
    });
    expectPrimaryButtonLabels([localeText('v2Overview.createPlanningBaseline')]);
    expect(baselineButton.className).toContain('v2-btn-primary');
    expect(screen.queryByRole('dialog')).toBeNull();

    await waitFor(() => {
      expect(onSetupWizardStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 5,
          recommendedStep: 5,
          activeStep: 5,
          selectedProblemYear: null,
        }),
      );
    });
  });

  it('routes the blocked-year branch straight to step 6 with one primary CTA when baseline is already ready', async () => {
    const readyYear = buildOverviewResponse().importStatus.years[0];

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        excludedYears: [2023],
        workspaceYears: [2024],
        years: [readyYear],
      }),
    );
    excludeImportYearsV2.mockResolvedValue({
      requestedYears: [2023],
      excludedCount: 1,
      alreadyExcludedCount: 0,
      results: [{ vuosi: 2023, excluded: true, reason: null }],
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [2023],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );
    expectPrimaryButtonLabels([localeText('v2Overview.manualPatchSaveAndSync')]);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Pois suunnitelmasta',
      }),
    );

    const openForecastButton = await screen.findByRole('button', {
      name: localeText('v2Overview.openForecast'),
    });
    expectPrimaryButtonLabels([localeText('v2Overview.openForecast')]);
    expect(openForecastButton.className).toContain('v2-btn-primary');
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not treat available years as imported when workspaceYears is empty', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      (await screen.findAllByText(localeText('v2Overview.noImportedYears'))).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(localeText('v2Overview.wizardContextImportedWorkspaceYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(
        localeText('v2Overview.wizardContextImportedWorkspaceYearsBody', {
          years: localeText('v2Overview.noImportedYears'),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('TÃ¤stÃ¤ vuodesta puuttuu: Price data (taksa).'),
    ).toBeNull();
  });

  it('mounts only the connect surface when the wizard is still at step 1', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;

    getOverviewV2.mockResolvedValueOnce(disconnectedOverview);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: localeText('v2Overview.searchButton') }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
    ).toBeNull();
    const searchInput = screen.getByPlaceholderText(
      localeText('v2Overview.searchPlaceholder'),
    );
    const summaryCard = document.querySelector('.v2-overview-wizard-card');
    expect(summaryCard).toBeTruthy();
    expect(summaryCard!.className).toContain('compact');
    expect(document.querySelector('.v2-overview-summary-body')).toBeNull();
    expect(
      searchInput.compareDocumentPosition(summaryCard as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
  });

  it('keeps explicit search fallback for short queries below the auto-suggest threshold', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;

    getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
    searchImportOrganizationsV2.mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ] as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.change(
      await screen.findByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
      { target: { value: 'Wa' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.searchButton') }),
    );

    await waitFor(() => {
      expect(searchImportOrganizationsV2).toHaveBeenCalledWith('Wa', 25);
    });
  });

  it('auto-suggests business-id-like input and auto-selects an exact match', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;

    getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
    searchImportOrganizationsV2.mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ] as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.change(
      await screen.findByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
      { target: { value: '1234567-8' } },
    );

    await waitFor(() => {
      expect(searchImportOrganizationsV2).toHaveBeenCalledWith('1234567-8', 25);
    });
    expect(await screen.findByRole('button', { name: /Water Utility/i })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: localeText('v2Overview.searchButton') }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: localeText('v2Overview.connectButton') }),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.resultSelected')),
    ).toBeTruthy();
  });

  it('gates the setup wizard through search, connect, and import in order', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;
    const connectedOverview = buildOverviewResponse({ workspaceYears: [] });
    const reviewOverview = buildOverviewResponse({ workspaceYears: [2024] });
    const noBaselineContext = buildPlanningContextResponse({
      canCreateScenario: false,
      baselineYears: [],
    });

    getOverviewV2.mockReset();
    getOverviewV2
      .mockResolvedValueOnce(disconnectedOverview)
      .mockResolvedValueOnce(connectedOverview)
      .mockResolvedValueOnce(reviewOverview);
    getPlanningContextV2.mockResolvedValue(noBaselineContext);
    searchImportOrganizationsV2.mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ] as any);
    connectImportOrganizationV2.mockResolvedValue({
      linked: { orgId: 'org-1', veetiId: 1535 },
      years: [2024, 2023],
      availableYears: [2024, 2023],
      workspaceYears: [],
    } as any);
    getImportStatusV2.mockResolvedValue({
      connected: true,
      link: {
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        lastFetchedAt: '2026-03-08T10:00:00.000Z',
      },
      years: connectedOverview.importStatus.years,
      availableYears: connectedOverview.importStatus.years,
      excludedYears: [],
      workspaceYears: [],
    } as any);
    importYearsV2.mockResolvedValue({
      selectedYears: [2024],
      importedYears: [2024],
      skippedYears: [],
      sync: {
        linked: {
          orgId: 'org-1',
          veetiId: 1535,
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
        },
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [2024],
        snapshotUpserts: 4,
      },
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: reviewOverview.importStatus.years,
        excludedYears: [],
        workspaceYears: [2024],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.change(
      await screen.findByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
      { target: { value: 'Water' } },
    );
    expect(await screen.findByRole('button', { name: /Water Utility/i })).toBeTruthy();
    expect(
      await screen.findByText(localeText('v2Overview.resultSelected')),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.connectButton') }),
    );

    await waitFor(() => {
      expect(searchImportOrganizationsV2).toHaveBeenCalledWith('Water', 25);
      expect(connectImportOrganizationV2).toHaveBeenCalledWith(1535);
      expect(getImportStatusV2).toHaveBeenCalled();
    });

    expect(
      (await screen.findAllByText(localeText('v2Overview.wizardProgress', { step: 2 })))
        .length,
    ).toBeGreaterThan(0);
    const importButton = await screen.findByRole('button', {
      name: localeText('v2Overview.importYearsButton'),
    });
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: localeText('v2Overview.connectButton') }),
    ).toBeNull();
    const importSurface = document.getElementById('v2-import-years');
    const summaryCard = document.querySelector('.v2-overview-wizard-card');
    expect(importSurface).toBeTruthy();
    expect(summaryCard).toBeTruthy();
    expect(summaryCard!.className).toContain('compact');
    expect(document.querySelector('.v2-overview-summary-body')).toBeNull();
    expect(
      importSurface!.compareDocumentPosition(summaryCard as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(importYearsV2).toHaveBeenCalledWith([2024]);
    });
    expect(syncImportV2).not.toHaveBeenCalled();
    expect(
      (await screen.findAllByText(localeText('v2Overview.wizardProgress', { step: 3 })))
        .length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: localeText('v2Overview.importYearsButton') }),
    ).toBeNull();
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
  });

  it('uses non-destructive exclusion from the year decision modal', async () => {
    excludeImportYearsV2.mockResolvedValue({
      requestedYears: [2023],
      excludedCount: 1,
      alreadyExcludedCount: 0,
      results: [{ vuosi: 2023, excluded: true, reason: null }],
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [2023],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mitä tälle vuodelle tehdään?' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Pois suunnitelmasta' }),
    );

    await waitFor(() => {
      expect(excludeImportYearsV2).toHaveBeenCalledWith([2023]);
    });
  });

  it('renders excluded years as pois suunnitelmasta without reintroducing dashboard clutter', async () => {
    getOverviewV2.mockResolvedValueOnce({
      latestVeetiYear: 2024,
      importStatus: {
        connected: true,
        tariffScope: 'usage_fee_only',
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        excludedYears: [2022],
        workspaceYears: [2024],
        years: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: '2026-03-08T10:00:00.000Z',
            manualEditedBy: 'tester',
            manualReason: 'Statement-backed correction',
            manualProvenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        ],
      },
      kpis: {
        revenue: { current: 100000, deltaPct: 0 },
        operatingCosts: { current: 70000, deltaPct: 0 },
        costs: { current: 70000, deltaPct: 0 },
        financingNet: { current: 0, deltaPct: 0 },
        otherResultItems: { current: 0, deltaPct: 0 },
        yearResult: { current: 30000, deltaPct: 0 },
        result: { current: 30000, deltaPct: 0 },
        volume: { current: 50000, deltaPct: 0 },
        combinedPrice: { current: 2.5, deltaPct: 0 },
      },
      trendSeries: [],
      peerSnapshot: {
        available: false,
        reason: 'No VEETI years imported.',
        year: null,
        kokoluokka: null,
        orgCount: 0,
        peerCount: 0,
        isStale: false,
        computedAt: null,
        metrics: [],
        peers: [],
      },
    } as any);
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText('Pois suunnitelmasta')).toBeTruthy();
    expect(screen.getByText('Ei mukana suunnittelupohjassa')).toBeTruthy();
    expect(screen.queryByText('Peer snapshot')).toBeNull();
  });

  it('restores an excluded year from the same year decision modal', async () => {
    restoreImportYearsV2.mockResolvedValue({
      requestedYears: [2022],
      restoredCount: 1,
      notExcludedCount: 0,
      results: [{ vuosi: 2022, restored: true, reason: null }],
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);
    getOverviewV2.mockResolvedValueOnce({
      latestVeetiYear: 2024,
      importStatus: {
        connected: true,
        tariffScope: 'usage_fee_only',
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        excludedYears: [2022],
        workspaceYears: [2024],
        years: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: '2026-03-08T10:00:00.000Z',
            manualEditedBy: 'tester',
            manualReason: 'Statement-backed correction',
            manualProvenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        ],
      },
      kpis: {
        revenue: { current: 100000, deltaPct: 0 },
        operatingCosts: { current: 70000, deltaPct: 0 },
        costs: { current: 70000, deltaPct: 0 },
        financingNet: { current: 0, deltaPct: 0 },
        otherResultItems: { current: 0, deltaPct: 0 },
        yearResult: { current: 30000, deltaPct: 0 },
        result: { current: 30000, deltaPct: 0 },
        volume: { current: 50000, deltaPct: 0 },
        combinedPrice: { current: 2.5, deltaPct: 0 },
      },
      trendSeries: [],
      peerSnapshot: {
        available: false,
        reason: 'No VEETI years imported.',
        year: null,
        kokoluokka: null,
        orgCount: 0,
        peerCount: 0,
        isStale: false,
        computedAt: null,
        metrics: [],
        peers: [],
      },
    } as any);
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mitä tälle vuodelle tehdään?' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Palauta suunnitelmaan' }),
    );

    await waitFor(() => {
      expect(restoreImportYearsV2).toHaveBeenCalledWith([2022]);
    });
  });

  it('keeps the manual-fix save path available from the year decision modal', async () => {
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2023,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['prices'],
      missingAfter: ['prices'],
      syncReady: false,
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Mitä tälle vuodelle tehdään?' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Korjaa arvot' }));
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
      { target: { value: '2.75' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.manualPatchSave') }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalled();
    });
  });

  it('uses the import-years contract for the step-2 CTA instead of sync', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const button = await screen.findByRole('button', {
      name: localeText('v2Overview.importYearsButton'),
    });
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
    button.click();

    await waitFor(() => {
      expect(importYearsV2).toHaveBeenCalledWith([2024]);
    });
    expect(syncImportV2).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Tuodut vuodet ovat nyt työtilassa: 2024.'),
    ).toBeTruthy();
  });

  it('splits importable years from repair-only years on step 2', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText(localeText('v2Overview.importableYearsTitle'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.repairOnlyYearsTitle'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.importableYearsBody'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.repairOnlyYearsBody'))).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '2024' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: '2023' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Täydennä manuaalisesti' })).toBeTruthy();
  });

  it('routes review continue to baseline creation when imported years are ready', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [2024] }));
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const continueButton = await screen.findByRole('button', { name: 'Jatka' });
    fireEvent.click(continueButton);

    await waitFor(() => {
      const baselineButton = screen.getByRole('button', {
        name: 'Luo suunnittelupohja',
      }) as HTMLButtonElement;
      expect(baselineButton.className).toContain('v2-btn-primary');
      expect(baselineButton.disabled).toBe(false);
    });
    expect(
      screen.getAllByText(localeText('v2Overview.wizardProgress', { step: 5 }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(localeText('v2Overview.wizardContextReviewSummary'))).toBeTruthy();
    expect(
      screen.getByText(
        localeText('v2Overview.wizardContextReviewSummaryBody', {
          ready: '2024',
          excluded: localeText('v2Overview.noYearsSelected'),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.baselineIncludedYears')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.baselineExcludedYears')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.baselineCorrectedYears')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.wizardContextStep6')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(localeText('v2Overview.wizardContextBaselineNextBody')),
    ).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.baselineReadyHint'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Avaa Ennuste' })).toBeNull();
    expect(
      screen.queryByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
    ).toBeNull();
  });

  it('creates the planning baseline and updates the sticky summary after success', async () => {
    getOverviewV2.mockResolvedValueOnce({
      latestVeetiYear: 2024,
      importStatus: {
        connected: true,
        tariffScope: 'usage_fee_only',
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        excludedYears: [2022],
        workspaceYears: [2024],
        years: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: '2026-03-08T10:00:00.000Z',
            manualEditedBy: 'tester',
            manualReason: 'Statement-backed correction',
            manualProvenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        ],
      },
      kpis: {
        revenue: { current: 100000, deltaPct: 0 },
        operatingCosts: { current: 70000, deltaPct: 0 },
        costs: { current: 70000, deltaPct: 0 },
        financingNet: { current: 0, deltaPct: 0 },
        otherResultItems: { current: 0, deltaPct: 0 },
        yearResult: { current: 30000, deltaPct: 0 },
        result: { current: 30000, deltaPct: 0 },
        volume: { current: 50000, deltaPct: 0 },
        combinedPrice: { current: 2.5, deltaPct: 0 },
      },
      trendSeries: [],
      peerSnapshot: {
        available: false,
        reason: 'No VEETI years imported.',
        year: null,
        kokoluokka: null,
        orgCount: 0,
        peerCount: 0,
        isStale: false,
        computedAt: null,
        metrics: [],
        peers: [],
      },
    } as any);
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );
    createPlanningBaselineV2.mockResolvedValue({
      selectedYears: [2024],
      includedYears: [2024],
      skippedYears: [{ vuosi: 2022, reason: 'Year is excluded from planning.' }],
      planningBaseline: {
        success: true,
        count: 1,
        results: [{ budgetId: 'budget-2024', vuosi: 2024, mode: 'created' }],
      },
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [2022],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Luo suunnittelupohja' }),
    );

    await waitFor(() => {
      expect(createPlanningBaselineV2).toHaveBeenCalledWith([2024]);
    });
    expect(
      await screen.findByText(
        localeText('v2Overview.wizardBaselineReadyDetail', {
          included: '2024',
          excluded: '2022',
          corrected: '2024',
        }),
      ),
    ).toBeTruthy();
  });

  it('keeps baseline gating tied to blocked imported years only when other available VEETI years remain incomplete', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [2024] }));
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));

    const baselineButton = await screen.findByRole('button', {
      name: 'Luo suunnittelupohja',
    });
    expect((baselineButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(localeText('v2Overview.baselineReadyHint'))).toBeTruthy();
    expect(
      screen.queryByText(localeText('v2Overview.baselineBlockedHint')),
    ).toBeNull();
  });

  it('shows imported-year summary counts only for workspace years even when extra available VEETI years remain incomplete', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [2024] }));
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText('Tuodut vuodet')).toBeTruthy();
    expect(
      screen.getByText(
        localeText('v2Overview.wizardContextImportedWorkspaceYearsBody', {
          years: '2024',
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        localeText('v2Overview.wizardContextImportedWorkspaceYearsBody', {
          years: '2024, 2023',
        }),
      ),
    ).toBeNull();
  });

  it('keeps the forecast handoff as the only mounted primary step once baseline work is complete', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [baselineReadyYear],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      (await screen.findByRole('button', { name: 'Avaa Ennuste' })).className,
    ).toContain('v2-btn-primary');
    expect(
      screen.getAllByText(localeText('v2Overview.wizardProgress', { step: 6 }))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getAllByText(localeText('v2Overview.wizardQuestionForecast')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.wizardBodyForecast')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Forecast.selectScenarioHint')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.starterScenarioHorizon'),
      }),
    ).toBeNull();
  });

  it('hands step 6 straight to Forecast without creating a scenario in Overview', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    const onGoToForecast = vi.fn();
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [baselineReadyYear],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={onGoToForecast}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa Ennuste' }));

    expect(createForecastScenarioV2).not.toHaveBeenCalled();
    expect(onGoToForecast).toHaveBeenCalledWith();
  });

  it.skip('opens Forecast from step 6 without creating a starter scenario in Overview', async () => {
    const onGoToForecast = vi.fn();
    getOverviewV2.mockResolvedValueOnce({
      latestVeetiYear: 2024,
      importStatus: {
        connected: true,
        tariffScope: 'usage_fee_only',
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        excludedYears: [],
        years: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: '2026-03-08T10:00:00.000Z',
            manualEditedBy: 'tester',
            manualReason: 'Statement-backed correction',
            manualProvenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        ],
        availableYears: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: '2026-03-08T10:00:00.000Z',
            manualEditedBy: 'tester',
            manualReason: 'Statement-backed correction',
            manualProvenance: {
              kind: 'statement_import',
              fileName: 'bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 98,
              matchedFields: ['liikevaihto'],
            },
          },
        ],
        workspaceYears: [2024],
      },
      kpis: {
        revenue: { current: 100000, deltaPct: 0 },
        operatingCosts: { current: 70000, deltaPct: 0 },
        costs: { current: 70000, deltaPct: 0 },
        financingNet: { current: 0, deltaPct: 0 },
        otherResultItems: { current: 0, deltaPct: 0 },
        yearResult: { current: 30000, deltaPct: 0 },
        result: { current: 30000, deltaPct: 0 },
        volume: { current: 50000, deltaPct: 0 },
        combinedPrice: { current: 2.5, deltaPct: 0 },
      },
      trendSeries: [],
      peerSnapshot: {
        available: false,
        reason: 'No VEETI years imported.',
        year: null,
        kokoluokka: null,
        orgCount: 0,
        peerCount: 0,
        isStale: false,
        computedAt: null,
        metrics: [],
        peers: [],
      },
    } as any);
    createForecastScenarioV2.mockResolvedValue({
      id: 'starter-1',
      name: 'Ensimmäinen skenaario',
      onOletus: false,
      talousarvioId: 'budget-2024',
      baselineYear: 2024,
      horizonYears: 25,
      assumptions: {},
      yearlyInvestments: [],
      nearTermExpenseAssumptions: [],
      thereafterExpenseAssumptions: {
        personnelPct: 0,
        energyPct: 0,
        opexOtherPct: 0,
      },
      requiredPriceTodayCombined: null,
      baselinePriceTodayCombined: null,
      requiredAnnualIncreasePct: null,
      requiredPriceTodayCombinedAnnualResult: null,
      requiredAnnualIncreasePctAnnualResult: null,
      requiredPriceTodayCombinedCumulativeCash: null,
      requiredAnnualIncreasePctCumulativeCash: null,
      feeSufficiency: {
        baselineCombinedPrice: null,
        annualResult: {
          requiredPriceToday: null,
          requiredAnnualIncreasePct: null,
          underfundingStartYear: null,
          peakDeficit: 0,
        },
        cumulativeCash: {
          requiredPriceToday: null,
          requiredAnnualIncreasePct: null,
          underfundingStartYear: null,
          peakGap: 0,
        },
      },
      years: [],
      priceSeries: [],
      investmentSeries: [],
      cashflowSeries: [],
      updatedAt: '2026-03-08T10:00:00.000Z',
      createdAt: '2026-03-08T10:00:00.000Z',
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={onGoToForecast}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.change(
      await screen.findByRole('textbox', {
        name: localeText('v2Overview.starterScenarioName'),
      }),
      {
        target: { value: 'Ensimmäinen skenaario' },
      },
    );
    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.starterScenarioHorizon'),
      }),
      {
        target: { value: '25' },
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Avaa Ennuste' }));

    await waitFor(() => {
      expect(createForecastScenarioV2).toHaveBeenCalledWith({
        name: 'Ensimmäinen skenaario',
        horizonYears: 25,
        compute: false,
      });
    });
    expect(onGoToForecast).toHaveBeenCalledWith('starter-1');
  });

});
