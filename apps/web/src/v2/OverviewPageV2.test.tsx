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
import en from '../i18n/locales/en.json';
import fi from '../i18n/locales/fi.json';
import sv from '../i18n/locales/sv.json';
import { OverviewImportBoard } from './OverviewImportBoard';
import { OverviewPageV2 } from './OverviewPageV2';
import { OverviewSupportRail } from './OverviewSupportRail';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from './OverviewWizardPanels';
import { buildImportYearSummaryRows } from './yearReview';

const completeImportYearManuallyV2 = vi.fn();
const connectImportOrganizationV2 = vi.fn();
const createForecastScenarioV2 = vi.fn();
const createPlanningBaselineV2 = vi.fn();
const deleteImportYearsBulkV2 = vi.fn();
const deleteImportYearV2 = vi.fn();
const excludeImportYearsV2 = vi.fn();
const getImportStatusV2 = vi.fn();
const getImportYearDataV2 = vi.fn();
const getTokenInfo = vi.fn();
const importYearsV2 = vi.fn();
const getOpsFunnelV2 = vi.fn();
const getOverviewV2 = vi.fn();
const getPlanningContextV2 = vi.fn();
const listForecastScenariosV2 = vi.fn();
const listReportsV2 = vi.fn();
const previewWorkbookImportV2 = vi.fn();
const refreshOverviewPeerV2 = vi.fn();
const reconcileImportYearV2 = vi.fn();
const restoreImportYearsV2 = vi.fn();
const searchImportOrganizationsV2 = vi.fn();
const syncImportV2 = vi.fn();
const sendV2OpsEvent = vi.fn();
const extractStatementFromPdf = vi.fn();
const extractQdisFromPdf = vi.fn();

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const localeDataByCode = { fi, sv, en } as const;
let activeLocale: keyof typeof localeDataByCode = 'fi';

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
  const resolved = pick(
    localeDataByCode[activeLocale] as Record<string, unknown>,
    key,
  );
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

const seedReviewedYears = (years: number[], orgId = '1234567-8') => {
  window.localStorage.setItem(
    `v2.importYearReview.${orgId}`,
    JSON.stringify({ reviewedYears: years }),
  );
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
    i18n: { language: activeLocale, resolvedLanguage: activeLocale },
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
  getTokenInfo: (...args: unknown[]) => getTokenInfo(...args),
  importYearsV2: (...args: unknown[]) => importYearsV2(...args),
  getOpsFunnelV2: (...args: unknown[]) => getOpsFunnelV2(...args),
  getOverviewV2: (...args: unknown[]) => getOverviewV2(...args),
  getPlanningContextV2: (...args: unknown[]) => getPlanningContextV2(...args),
  listForecastScenariosV2: (...args: unknown[]) =>
    listForecastScenariosV2(...args),
  listReportsV2: (...args: unknown[]) => listReportsV2(...args),
  previewWorkbookImportV2: (...args: unknown[]) => previewWorkbookImportV2(...args),
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
  extractStatementFromPdf: (...args: unknown[]) =>
    extractStatementFromPdf(...args),
}));

vi.mock('./qdisPdfImport', () => ({
  extractQdisFromPdf: (...args: unknown[]) => extractQdisFromPdf(...args),
}));

describe('OverviewPageV2', () => {
  beforeEach(() => {
    activeLocale = 'fi';
    window.localStorage.clear();
    completeImportYearManuallyV2.mockReset();
    connectImportOrganizationV2.mockReset();
    createForecastScenarioV2.mockReset();
    createPlanningBaselineV2.mockReset();
    deleteImportYearsBulkV2.mockReset();
    deleteImportYearV2.mockReset();
    excludeImportYearsV2.mockReset();
    getImportStatusV2.mockReset();
    getImportYearDataV2.mockReset();
    getTokenInfo.mockReset();
    importYearsV2.mockReset();
    getOpsFunnelV2.mockReset();
    getOverviewV2.mockReset();
    getPlanningContextV2.mockReset();
    listForecastScenariosV2.mockReset();
    listReportsV2.mockReset();
    previewWorkbookImportV2.mockReset();
    refreshOverviewPeerV2.mockReset();
    reconcileImportYearV2.mockReset();
    restoreImportYearsV2.mockReset();
    searchImportOrganizationsV2.mockReset();
    syncImportV2.mockReset();
    sendV2OpsEvent.mockReset();
    extractStatementFromPdf.mockReset();
    extractQdisFromPdf.mockReset();

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );

    getPlanningContextV2.mockResolvedValue(buildPlanningContextResponse());
    getTokenInfo.mockReturnValue(null);

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
          rawRows: [
            {
              Liikevaihto: 95000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
            },
          ],
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
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the extracted support rail in compact step-2 mode', () => {
    render(
      <OverviewSupportRail
        t={translate as any}
        wizardDisplayStep={2}
        isStep2SupportChrome={true}
        compactSupportingChrome={true}
        supportingChromeEyebrow={localeText('v2Overview.wizardSummaryTitle')}
        supportingChromeTitle={localeText('v2Overview.wizardSummarySubtitle')}
        wizardHero={{
          title: localeText('v2Overview.wizardQuestionImportYears'),
          body: localeText('v2Overview.wizardBodyImportYears'),
        }}
        summaryMetaBlocks={[
          {
            label: localeText('v2Overview.organizationLabel'),
            value: 'Water Utility',
          },
          {
            label: localeText('v2Overview.wizardContextImportedWorkspaceYears'),
            value: '2024, 2023',
          },
        ]}
        wizardSummaryItems={[
          {
            label: localeText('v2Overview.wizardSummaryImportedYears'),
            value: '2',
            detail: '2024, 2023',
          },
          {
            label: localeText('v2Overview.wizardSummaryBaselineReady'),
            value: localeText('v2Overview.wizardSummaryNo'),
            detail: localeText('v2Overview.wizardBaselinePendingHint'),
          },
        ]}
        wizardContextHelpers={[
          {
            key: 'next',
            label: localeText('v2Overview.wizardContextNext'),
            title: localeText('v2Overview.wizardContextStep3'),
            body: localeText('v2Overview.wizardContextImportNextBody'),
            tone: 'neutral',
          },
        ]}
      />,
    );

    expect(screen.getByText('Water Utility')).toBeTruthy();
    expect(screen.getAllByText('2024, 2023').length).toBeGreaterThan(0);
    expect(screen.getByText(localeText('v2Overview.wizardContextStep3'))).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.wizardProgress', { step: 2 }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(localeText('v2Overview.wizardBodyImportYears')),
    ).toBeNull();
  });

  it('renders the extracted connect step with focused selection controls', () => {
    const onQueryChange = vi.fn();
    const onSearch = vi.fn();
    const onSelectOrg = vi.fn();
    const onConnect = vi.fn();

    render(
      <OverviewConnectStep
        t={translate as any}
        query="wat"
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        searching={false}
        connecting={false}
        importingYears={false}
        syncing={false}
        searchResults={[
          {
            Id: 10,
            Nimi: 'Water Utility',
            YTunnus: '1234567-8',
            Kunta: 'Testby',
          } as any,
        ]}
        selectedOrg={
          {
            Id: 10,
            Nimi: 'Water Utility',
            YTunnus: '1234567-8',
            Kunta: 'Testby',
          } as any
        }
        onSelectOrg={onSelectOrg}
        renderHighlightedSearchMatch={(value) => value}
        selectedOrgStillVisible={true}
        selectedOrgName="Water Utility"
        selectedOrgBusinessId="1234567-8"
        connectButtonClass="v2-btn v2-btn-primary"
        connectDisabled={false}
        onConnect={onConnect}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'water' } });
    expect(onQueryChange).toHaveBeenCalledWith('water');

    fireEvent.click(screen.getByRole('button', { name: localeText('v2Overview.searchButton') }));
    expect(onSearch).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.clearSelectionButton'),
      }),
    );
    expect(onSelectOrg).toHaveBeenCalledWith(null);

    const connectButtons = screen.getAllByRole('button', {
      name: localeText('v2Overview.connectButton'),
    });
    fireEvent.click(connectButtons[connectButtons.length - 1]!);
    expect(onConnect).toHaveBeenCalled();
  });

  it('renders ready-lane import cards chronologically from oldest to newest', () => {
    const makeBoardRow = (vuosi: number) => ({
      vuosi,
      completeness: {
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-positive',
      trustLabel: 'Looks plausible',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary: null,
    });

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2024, 2023, 2022]}
        syncing={false}
        readyRows={[makeBoardRow(2024), makeBoardRow(2022), makeBoardRow(2023)]}
        suspiciousRows={[]}
        blockedRows={[]}
        parkedRows={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
        renderStep2InlineFieldEditor={() => null}
        buildRepairActions={() => []}
        sourceStatusLabel={() => 'VEETI'}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceLayerText={() => ''}
        renderDatasetCounts={() => ''}
        missingRequirementLabel={() => ''}
        attemptOpenInlineCardEditor={() => undefined}
        openInlineCardEditor={() => undefined}
        openManualPatchDialog={() => Promise.resolve()}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={0}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const readyLane = screen
      .getByText(localeText('v2Overview.trustLaneReadyTitle'))
      .closest('section') as HTMLElement;
    const renderedYears = Array.from(
      readyLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);

    expect(renderedYears).toEqual(['2022', '2023', '2024']);
  });

  it('keeps a five-year import board chronological and parks unselected years behind a closed secondary disclosure', () => {
    const makeBoardRow = (vuosi: number) => ({
      vuosi,
      completeness: {
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-positive',
      trustLabel: 'Looks plausible',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary: null,
    });

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2024, 2022, 2020]}
        syncing={false}
        readyRows={[makeBoardRow(2024), makeBoardRow(2020), makeBoardRow(2022)]}
        suspiciousRows={[]}
        blockedRows={[]}
        parkedRows={[makeBoardRow(2023), makeBoardRow(2021)]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
        renderStep2InlineFieldEditor={() => null}
        buildRepairActions={() => []}
        sourceStatusLabel={() => 'VEETI'}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceLayerText={() => ''}
        renderDatasetCounts={() => ''}
        missingRequirementLabel={() => ''}
        attemptOpenInlineCardEditor={() => undefined}
        openInlineCardEditor={() => undefined}
        openManualPatchDialog={() => Promise.resolve()}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={0}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const readyLane = screen
      .getByText(localeText('v2Overview.trustLaneReadyTitle'))
      .closest('section') as HTMLElement;
    const readyYears = Array.from(
      readyLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);
    expect(readyYears).toEqual(['2020', '2022', '2024']);

    const parkedLane = screen
      .getByText(localeText('v2Overview.trustLaneParkedTitle'))
      .closest('details') as HTMLDetailsElement;
    expect(parkedLane.open).toBe(false);

    fireEvent.click(parkedLane.querySelector('summary')!);

    const parkedYears = Array.from(
      parkedLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);
    expect(parkedYears).toEqual(['2021', '2023']);
    expect(document.body.textContent).not.toContain('Sekundära huvudtal');
  });

  it('renders the extracted baseline and handoff panels with stable summary actions', () => {
    const onCreatePlanningBaseline = vi.fn();
    const onOpenForecast = vi.fn();

    const { rerender } = render(
      <OverviewPlanningBaselineStep
        t={translate as any}
        wizardBackLabel={localeText('v2Overview.wizardBackStep3')}
        onBack={() => undefined}
        includedPlanningYears={[2024]}
        excludedYearsSorted={[2022]}
        correctedPlanningYears={[2024]}
        correctedPlanningManualDataTypes={['tilinpaatos']}
        correctedPlanningVeetiDataTypes={['taksa']}
        correctedYearsLabel="2024"
        includedPlanningYearsLabel="2024"
        renderDatasetTypeList={(values) => values.join(', ')}
        planningBaselineButtonClass="v2-btn v2-btn-primary"
        onCreatePlanningBaseline={onCreatePlanningBaseline}
        creatingPlanningBaseline={false}
        importedBlockedYearCount={0}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    );
    expect(onCreatePlanningBaseline).toHaveBeenCalled();
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.wizardBackStep3'),
      }),
    ).toBeNull();

    rerender(
      <OverviewForecastHandoffStep
        t={translate as any}
        wizardBackLabel={localeText('v2Overview.wizardBackStep5')}
        onBack={() => undefined}
        acceptedPlanningYearRows={[
          {
            vuosi: 2024,
            sourceStatus: 'MIXED',
            datasetCounts: { tilinpaatos: 1 },
          },
        ]}
        correctedPlanningYears={[2024]}
        sourceStatusClassName={() => 'v2-status-provenance'}
        sourceStatusLabel={() => 'Mixed'}
        renderDatasetCounts={() => '1 dataset'}
        openForecastButtonClass="v2-btn v2-btn-primary"
        onOpenForecast={onOpenForecast}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.openForecast') }),
    );
    expect(onOpenForecast).toHaveBeenCalled();
    expect(screen.getByText('1 dataset')).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.wizardBackStep5'),
      }),
    ).toBeNull();
  });

  it('builds the shared import-year accounting summary from current raw and effective data', () => {
    const rows = buildImportYearSummaryRows({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {},
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 95000,
              AineetJaPalvelut: 18000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 12000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    } as any);

    expect(rows).toEqual([
      expect.objectContaining({
        key: 'revenue',
        sourceField: 'Liikevaihto',
        rawValue: 95000,
        effectiveValue: 100000,
        rawSource: 'direct',
        effectiveSource: 'direct',
      }),
      expect.objectContaining({
        key: 'materialsCosts',
        sourceField: 'AineetJaPalvelut',
        rawValue: 18000,
        effectiveValue: 15000,
        rawSource: 'direct',
        effectiveSource: 'direct',
      }),
      expect.objectContaining({
        key: 'personnelCosts',
        sourceField: 'Henkilostokulut',
        rawValue: 22000,
        effectiveValue: 21000,
      }),
      expect.objectContaining({
        key: 'depreciation',
        sourceField: 'Poistot',
        rawValue: 5000,
        effectiveValue: 6500,
      }),
      expect.objectContaining({
        key: 'otherOperatingCosts',
        sourceField: 'LiiketoiminnanMuutKulut',
        rawValue: 12000,
        effectiveValue: 19000,
        rawSource: 'direct',
        effectiveSource: 'direct',
      }),
      expect.objectContaining({
        key: 'result',
        sourceField: 'TilikaudenYliJaama',
        rawValue: 25000,
        effectiveValue: 30000,
        rawSource: 'direct',
        effectiveSource: 'direct',
      }),
    ]);
  });

  it('keeps the summary contract direct when materials rows are missing', () => {
    const rows = buildImportYearSummaryRows({
      year: 2023,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {},
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ LiiketoiminnanMuutKulut: 100 }],
          effectiveRows: [{ LiiketoiminnanMuutKulut: 80 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'materialsCosts',
          sourceField: 'AineetJaPalvelut',
          rawValue: null,
          effectiveValue: null,
          rawSource: 'missing',
          effectiveSource: 'missing',
        }),
        expect.objectContaining({
          key: 'otherOperatingCosts',
          sourceField: 'LiiketoiminnanMuutKulut',
          rawValue: 100,
          effectiveValue: 80,
          rawSource: 'direct',
          effectiveSource: 'direct',
        }),
        expect.objectContaining({
          key: 'depreciation',
          sourceField: 'Poistot',
          rawValue: null,
          effectiveValue: null,
          rawSource: 'missing',
          effectiveSource: 'missing',
        }),
        expect.objectContaining({
          key: 'result',
          sourceField: 'TilikaudenYliJaama',
          rawValue: null,
          effectiveValue: null,
          rawSource: 'missing',
          effectiveSource: 'missing',
        }),
      ]),
    );
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
      screen.getAllByText(localeText('v2Overview.reviewVolumeSummaryLabel')).length,
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
    expect(
      screen.getAllByText(localeText('v2Overview.wizardSummaryTitle')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.wizardProgress', { step: 3 }))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.wizardSummarySubtitle')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(localeText('v2Overview.wizardSummaryCompany'))).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryImportedYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryReadyYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryExcludedYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardSummaryBaselineReady')),
    ).toBeTruthy();
    const baselineReadySummary = screen
      .getByText(localeText('v2Overview.wizardSummaryBaselineReady'))
      .closest('.v2-overview-progress-item') as HTMLElement;
    expect(
      within(baselineReadySummary).getByText(
        localeText('v2Overview.wizardSummaryNo'),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardBodyReviewYears')),
    ).toBeTruthy();
    expect(screen.getByText('Valmis tarkistukseen')).toBeTruthy();
    expect(screen.getByText('Korjattava')).toBeTruthy();
    expect((await screen.findAllByText(/Muokattu:/i)).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Tilinpäätöskorjaus muutti VEETI-rivejä/i),
    ).toBeNull();
    expect(document.body.textContent).not.toContain('Tulos / 0:');
    expect(document.body.textContent).not.toContain('Resultat / 0:');
    expect(document.body.textContent).not.toContain('Result / 0:');
    expect(document.body.textContent).not.toContain('Tulos on ylijäämäinen');
    expect(document.body.textContent).not.toContain('Tulos on alijäämäinen');
    expect(
      screen.queryByText(localeText('v2Overview.yearResultExplicitFieldNote')),
    ).toBeNull();
    expect(screen.getAllByText(/Tilin/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingRevenueLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingResultLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/100.?000 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30.?000 EUR/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(localeText('v2Overview.setupStatusTechnicalReadyHint')),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.datasetPrices')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.reviewVolumeSummaryLabel')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.reviewContinueBlockedHint')),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Avaa ja tarkista' }),
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

  it('keeps the step-1 focus truthful when no utility is connected', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [], years: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;
    disconnectedOverview.importStatus.availableYears = [];
    disconnectedOverview.importStatus.years = [];
    disconnectedOverview.importStatus.excludedYears = [];
    getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({ canCreateScenario: false, baselineYears: [] }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText(localeText('v2Overview.wizardCurrentFocus'))).toBeTruthy();
    const focusBlock = screen
      .getByText(localeText('v2Overview.wizardCurrentFocus'))
      .closest('.v2-overview-meta-block') as HTMLElement;
    expect(
      within(focusBlock).getByText(localeText('v2Overview.disconnected')),
    ).toBeTruthy();
  });

  it('does not label a year plausible when the core cost structure is missing', async () => {
    const incompleteYear = {
      vuosi: 2015,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'VEETI',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
        manualDataTypes: [],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: null,
      manualEditedBy: null,
      manualReason: null,
      manualProvenance: null,
    };
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [], years: [incompleteYear] }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({ canCreateScenario: false, baselineYears: [] }),
    );
    getImportYearDataV2.mockImplementationOnce(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
          effectiveRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 80121 }],
          effectiveRows: [{ Maara: 80121 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 0 }],
          effectiveRows: [{ Maara: 0 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.trustMissingKeyCosts')),
    ).toBeTruthy();
    expect(
      screen.queryByText(localeText('v2Overview.trustLooksPlausible')),
    ).toBeNull();
  });

  it('treats imported years with missing canon finance rows as needs attention in step 3', async () => {
    const incompleteImportedYear = {
      vuosi: 2015,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'VEETI',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
        manualDataTypes: [],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: null,
      manualEditedBy: null,
      manualReason: null,
      manualProvenance: null,
    };
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2015],
        years: [incompleteImportedYear],
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({ canCreateScenario: false, baselineYears: [] }),
    );
    getImportYearDataV2.mockResolvedValueOnce({
      year: 2015,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
          effectiveRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 80121 }],
          effectiveRows: [{ Maara: 80121 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 50123 }],
          effectiveRows: [{ Maara: 50123 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.setupStatusNeedsAttention')),
    ).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
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
    expect(
      screen.getAllByText(localeText('v2Overview.reviewFinancialSummaryLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.reviewPriceSummaryLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.reviewVolumeSummaryLabel'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('shows blocked-year preview gaps as explicit missing-state labels instead of zero-like placeholders', async () => {
  getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

  render(
    <OverviewPageV2
      onGoToForecast={() => undefined}
      onGoToReports={() => undefined}
      isAdmin={true}
    />,
  );

  const blockedLaneSummary = (
    await screen.findByText(localeText('v2Overview.trustLaneBlockedTitle'))
  ).closest('summary') as HTMLElement | null;
  expect(blockedLaneSummary).toBeTruthy();
  fireEvent.click(blockedLaneSummary!);
  expect(
    await screen.findByText(
      localeText('v2Overview.yearMissingCountLabel', { count: 2, total: 4 }),
    ),
  ).toBeTruthy();
  expect(screen.queryByText('0,00 € / 0,00 €')).toBeNull();
});

  it('keeps real zero values visible instead of rendering them as VEETI-missing labels', async () => {
    const zeroYear = {
      vuosi: 2022,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'VEETI',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
        manualDataTypes: [],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: null,
      manualEditedBy: null,
      manualReason: null,
      manualProvenance: null,
    };
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [], years: [zeroYear] }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );
    getImportYearDataV2.mockImplementationOnce(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 0,
              AineetJaPalvelut: 0,
              Henkilostokulut: 0,
              Poistot: 0,
              LiiketoiminnanMuutKulut: 0,
              TilikaudenYliJaama: 0,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 0,
              AineetJaPalvelut: 0,
              Henkilostokulut: 0,
              Poistot: 0,
              LiiketoiminnanMuutKulut: 0,
              TilikaudenYliJaama: 0,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0 },
            { Tyyppi_Id: 2, Kayttomaksu: 0 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 0 },
            { Tyyppi_Id: 2, Kayttomaksu: 0 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 0 }],
          effectiveRows: [{ Maara: 0 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 0 }],
          effectiveRows: [{ Maara: 0 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText('2022')).toBeTruthy();
    expect(
      screen.queryByText(localeText('v2Overview.previewVeetiMissingValue')),
    ).toBeNull();
    await waitFor(() => {
      expect(screen.getAllByText(/0 EUR/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0 m3/).length).toBeGreaterThan(0);
    });
  });

  it('keeps card actions in the chosen user language instead of leaking Finnish labels', async () => {
    activeLocale = 'en';

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.openReviewYearButton'),
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.excludeYearFromPlan'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Pois suunnitelmasta' }),
    ).toBeNull();
  });

  it('uses the locale key for the reviewed-years summary label instead of a Finnish fallback', async () => {
    activeLocale = 'sv';

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.wizardSummaryReadyYears')),
    ).toBeTruthy();
    expect(screen.queryByText('Tarkistetut vuodet')).toBeNull();
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

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
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
      await screen.findByRole('button', { name: localeText('common.close') }),
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

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      (
        await screen.findByRole('button', {
          name: localeText('v2Overview.fixYearValues'),
        })
      ).className,
    ).toContain('v2-btn-primary');
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.manualPatchSaveAndSync'),
      }),
    ).toBeNull();
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

    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
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

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
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
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Pois suunnitelmasta',
      }),
    );

    await waitFor(() => {
      expect(excludeImportYearsV2).toHaveBeenCalledWith([2023]);
    });

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    const baselineButton = await screen.findByRole('button', {
      name: localeText('v2Overview.createPlanningBaseline'),
    });
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
    expect(
      (
        await screen.findByRole('button', {
          name: localeText('v2Overview.fixYearValues'),
        })
      ).className,
    ).toContain('v2-btn-primary');

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Pois suunnitelmasta',
      }),
    );

    await waitFor(() => {
      expect(getOverviewV2).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('approves a technically ready year without edits and moves straight to baseline creation', async () => {
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    const readyYear = buildOverviewResponse().importStatus.years[0];
    const onSetupWizardStateChange = vi.fn();

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [readyYear],
      }),
    );
    getPlanningContextV2.mockResolvedValue(
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
        onSetupWizardStateChange={onSetupWizardStateChange}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Avaa ja tarkista',
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      screen.getByText(localeText('v2Overview.keepCurrentYearValuesInfo')),
    ).toBeTruthy();
    expectPrimaryButtonLabels([localeText('v2Overview.createPlanningBaseline')]);
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    ).toBeNull();

    await waitFor(() => {
      const latestState =
        onSetupWizardStateChange.mock.calls[
          onSetupWizardStateChange.mock.calls.length - 1
        ]?.[0];
      expect(latestState).toMatchObject({
        currentStep: 5,
        recommendedStep: 5,
        activeStep: 5,
        summary: {
          reviewedYearCount: 1,
          pendingReviewCount: 0,
          blockedYearCount: 0,
        },
      });
    });
  });

  it('updates reviewed counts immediately after approving a ready year while blocked years remain', async () => {
    const onSetupWizardStateChange = vi.fn();

    getPlanningContextV2.mockResolvedValue(
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
        onSetupWizardStateChange={onSetupWizardStateChange}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Avaa ja tarkista',
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    await waitFor(() => {
      const latestState =
        onSetupWizardStateChange.mock.calls[
          onSetupWizardStateChange.mock.calls.length - 1
        ]?.[0];
      expect(latestState).toMatchObject({
        currentStep: 3,
        recommendedStep: 4,
        activeStep: 3,
        selectedProblemYear: null,
        summary: {
          reviewedYearCount: 1,
          pendingReviewCount: 0,
          blockedYearCount: 1,
        },
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
  });

  it('keeps Continue focused on blocked years after a ready year is approved and before baseline creation', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );

    expect(
      (
        await screen.findByRole('button', {
          name: localeText('v2Overview.fixYearValues'),
        })
      ).className,
    ).toContain('v2-btn-primary');
    expect(
      screen.getByText(localeText('v2Overview.reviewContinueBlockedHint')),
    ).toBeTruthy();
  });

  it('opens technically ready years in review mode before revealing edit fields', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.wizardQuestionReviewYear')),
    ).toBeNull();
    expect(document.querySelector('.v2-inline-card-editor')).toBeNull();
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }).className,
    ).toContain('v2-btn-primary');
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportAction'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Pois suunnitelmasta',
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.fixYearValues') }),
    );

    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialRevenue'),
      }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualVolumeWater'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSaveAndSync'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportAction'),
      }),
    ).toBeTruthy();
  });

  it('sends AineetJaPalvelut through the manual year patch contract when edited', async () => {
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
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
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );
    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '16000' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16000,
            tilikaudenYliJaama: 29000,
          }),
        }),
      );
    });
  });

  it('opens statement import as a first-class review workflow without a hidden secondary toggle', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.statementImportAction'),
      }),
    );

    expect(
      await screen.findByText(
        localeText('v2Overview.statementImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportUploadFile'),
      }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: localeText('v2Overview.statementImportConfirm'),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByText(localeText('v2Overview.statementImportSection')),
    ).toBeNull();
  });

  it('opens workbook compare as a first-class review workflow and lets users choose keep/apply per row', async () => {
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2022 ? 'INCOMPLETE' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: year === 2022 ? 610000 : year === 2023 ? 700000 : 790000,
              ...(year === 2022 ? {} : { AineetJaPalvelut: year === 2023 ? 25000 : 60000 }),
              Henkilostokulut: year === 2022 ? 220000 : year === 2023 ? 234000 : 235000,
              Poistot: year === 2022 ? 180000 : 186000,
              LiiketoiminnanMuutKulut: year === 2022 ? 300000 : year === 2023 ? 320000 : 323000,
              TilikaudenYliJaama: year === 2022 ? 15000 : year === 2023 ? -80000 : 4000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: year === 2022 ? 610000 : year === 2023 ? 700000 : 790000,
              ...(year === 2022 ? {} : { AineetJaPalvelut: year === 2023 ? 25000 : 60000 }),
              Henkilostokulut: year === 2022 ? 220000 : year === 2023 ? 234000 : 235000,
              Poistot: year === 2022 ? 180000 : 186000,
              LiiketoiminnanMuutKulut: year === 2022 ? 300000 : year === 2023 ? 320000 : 323000,
              TilikaudenYliJaama: year === 2022 ? 15000 : year === 2023 ? -80000 : 4000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    previewWorkbookImportV2.mockResolvedValue({
      document: {
        fileName: 'kronoby-kva.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: 1234,
        receivedAt: '2026-03-18T15:00:00.000Z',
      },
      sheetName: 'KVA totalt',
      workbookYears: [2022, 2023, 2024],
      importedYears: [2022, 2023, 2024],
      matchedYears: [2022, 2023, 2024],
      unmatchedImportedYears: [],
      unmatchedWorkbookYears: [],
      years: [
        {
          year: 2022,
          sourceStatus: 'INCOMPLETE',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 610000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: null,
              workbookValue: 0,
              differs: true,
              currentSource: 'missing',
              suggestedAction: 'apply_workbook',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 220000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 180000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 300000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: 15000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
        {
          year: 2023,
          sourceStatus: 'VEETI',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 700000,
              workbookValue: 710040.13,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: 25000,
              workbookValue: 23070.15,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 234000,
              workbookValue: 234519.26,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 186000,
              workbookValue: 186317.59,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 320000,
              workbookValue: 353461.82,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: -80000,
              workbookValue: -98345.02,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
        {
          year: 2024,
          sourceStatus: 'VEETI',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 790000,
              workbookValue: 799774.93,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: 60000,
              workbookValue: 40689.96,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 235000,
              workbookValue: 235498.71,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 186000,
              workbookValue: 186904.08,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 323000,
              workbookValue: 322785.53,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: 4000,
              workbookValue: 3691.35,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
      ],
      canApply: true,
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.workbookImportAction'),
      }),
    );

    expect(
      await screen.findByText(
        localeText('v2Overview.workbookImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();

    const fileInput = document.querySelector(
      'input[data-import-kind="workbook"]',
    ) as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(['xlsx'], 'kronoby-kva.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(previewWorkbookImportV2).toHaveBeenCalled();
    });

    expect((await screen.findAllByText('2022')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('2023').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0);

    const compareRow = await screen.findByTestId(
      'workbook-compare-2024-AineetJaPalvelut',
    );
    const applyButton = within(compareRow).getByRole('button', {
      name: localeText('v2Overview.workbookChoiceApply'),
    });
    fireEvent.click(applyButton);
    expect(applyButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      within(compareRow).getByRole('button', {
        name: localeText('v2Overview.workbookChoiceKeepVeeti'),
      }),
    ).toBeTruthy();
  });

  it('persists confirmed workbook overrides for 2022 and 2023 and syncs the repaired years cleanly', async () => {
    const years = [
      {
        ...buildOverviewResponse().importStatus.years[0],
        vuosi: 2024,
      },
      {
        ...buildOverviewResponse().importStatus.years[1],
        vuosi: 2023,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        warnings: [],
      },
      {
        vuosi: 2022,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'INCOMPLETE',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022],
        years,
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2022 ? 'INCOMPLETE' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: year === 2022 ? 610000 : year === 2023 ? 700000 : 790000,
              ...(year === 2022 ? {} : { AineetJaPalvelut: year === 2023 ? 25000 : 60000 }),
              Henkilostokulut: year === 2022 ? 220000 : year === 2023 ? 234000 : 235000,
              Poistot: year === 2022 ? 180000 : 186000,
              LiiketoiminnanMuutKulut: year === 2022 ? 300000 : year === 2023 ? 320000 : 323000,
              TilikaudenYliJaama: year === 2022 ? 15000 : year === 2023 ? -80000 : 4000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: year === 2022 ? 610000 : year === 2023 ? 700000 : 790000,
              ...(year === 2022 ? {} : { AineetJaPalvelut: year === 2023 ? 25000 : 60000 }),
              Henkilostokulut: year === 2022 ? 220000 : year === 2023 ? 234000 : 235000,
              Poistot: year === 2022 ? 180000 : 186000,
              LiiketoiminnanMuutKulut: year === 2022 ? 300000 : year === 2023 ? 320000 : 323000,
              TilikaudenYliJaama: year === 2022 ? 15000 : year === 2023 ? -80000 : 4000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    previewWorkbookImportV2.mockResolvedValue({
      document: {
        fileName: 'kronoby-kva.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: 1234,
        receivedAt: '2026-03-18T15:00:00.000Z',
      },
      sheetName: 'KVA totalt',
      workbookYears: [2022, 2023, 2024],
      importedYears: [2022, 2023, 2024],
      matchedYears: [2022, 2023, 2024],
      unmatchedImportedYears: [],
      unmatchedWorkbookYears: [],
      years: [
        {
          year: 2022,
          sourceStatus: 'INCOMPLETE',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 610000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: null,
              workbookValue: 0,
              differs: true,
              currentSource: 'missing',
              suggestedAction: 'apply_workbook',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 220000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 180000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 300000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: 15000,
              workbookValue: 0,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
        {
          year: 2023,
          sourceStatus: 'VEETI',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 700000,
              workbookValue: 710040.13,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: 25000,
              workbookValue: 23070.15,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 234000,
              workbookValue: 234519.26,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 186000,
              workbookValue: 186317.59,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 320000,
              workbookValue: 353461.82,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: -80000,
              workbookValue: -98345.02,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
        {
          year: 2024,
          sourceStatus: 'VEETI',
          rows: [
            {
              key: 'revenue',
              sourceField: 'Liikevaihto',
              currentValue: 790000,
              workbookValue: 799774.93,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'materialsCosts',
              sourceField: 'AineetJaPalvelut',
              currentValue: 60000,
              workbookValue: 40689.96,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'personnelCosts',
              sourceField: 'Henkilostokulut',
              currentValue: 235000,
              workbookValue: 235498.71,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'depreciation',
              sourceField: 'Poistot',
              currentValue: 186000,
              workbookValue: 186904.08,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'otherOperatingCosts',
              sourceField: 'LiiketoiminnanMuutKulut',
              currentValue: 323000,
              workbookValue: 322785.53,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
            {
              key: 'result',
              sourceField: 'TilikaudenYliJaama',
              currentValue: 4000,
              workbookValue: 3691.35,
              differs: true,
              currentSource: 'direct',
              suggestedAction: 'keep_veeti',
            },
          ],
        },
      ],
      canApply: true,
    });
    completeImportYearManuallyV2.mockImplementation(async (payload: any) => ({
      year: payload.year,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      status: buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022],
        years,
      }).importStatus,
    }));
    syncImportV2.mockResolvedValue({
      generatedBudgets: {
        results: [
          { budgetId: 'budget-2022', vuosi: 2022, mode: 'updated' },
          { budgetId: 'budget-2023', vuosi: 2023, mode: 'updated' },
        ],
        skipped: [],
      },
      sanity: {
        rows: [
          { year: 2022, status: 'ok', mismatches: [] },
          { year: 2023, status: 'ok', mismatches: [] },
        ],
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
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.workbookImportAction'),
      }),
    );

    const fileInput = document.querySelector(
      'input[data-import-kind="workbook"]',
    ) as HTMLInputElement | null;
    fireEvent.change(fileInput!, {
      target: {
        files: [
          new File(['xlsx'], 'kronoby-kva.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(previewWorkbookImportV2).toHaveBeenCalled();
    });

    const row2023 = await screen.findByTestId(
      'workbook-compare-2023-AineetJaPalvelut',
    );
    fireEvent.click(
      within(row2023).getByRole('button', {
        name: localeText('v2Overview.workbookChoiceApply'),
      }),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.workbookImportConfirmAndSync'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledTimes(2);
    });
    expect(completeImportYearManuallyV2).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        year: 2022,
        financials: expect.objectContaining({
          aineetJaPalvelut: 0,
        }),
        workbookImport: expect.objectContaining({
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          confirmedSourceFields: ['AineetJaPalvelut'],
        }),
      }),
    );
    expect(completeImportYearManuallyV2).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        year: 2023,
        financials: expect.objectContaining({
          aineetJaPalvelut: 23070.15,
        }),
        workbookImport: expect.objectContaining({
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          confirmedSourceFields: ['AineetJaPalvelut'],
        }),
      }),
    );
    await waitFor(() => {
      expect(syncImportV2).toHaveBeenCalledWith([2022, 2023]);
    });
  });

  it('shows OCR reconciliation before confirm and syncs the corrected 2024 year in one flow', async () => {
    const reviewedYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [reviewedYear],
      }),
    );
    getPlanningContextV2.mockResolvedValue(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 700000,
              AineetJaPalvelut: 180000,
              Henkilostokulut: 120000,
              LiiketoiminnanMuutKulut: 140000,
              Poistot: 140000,
              RahoitustuototJaKulut: -9000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 740000,
              AineetJaPalvelut: 182000,
              Henkilostokulut: 200000,
              LiiketoiminnanMuutKulut: 150000,
              Poistot: 180000,
              RahoitustuototJaKulut: -9500,
              TilikaudenYliJaama: 12000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Statement-backed correction',
            provenance: {
              kind: 'statement_import',
              fileName: 'prior-bokslut-2024.pdf',
              pageNumber: 3,
              confidence: 92,
              matchedFields: ['liikevaihto'],
            },
          },
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    extractStatementFromPdf.mockResolvedValue({
      fileName: 'bokslut-2024.pdf',
      pageNumber: 4,
      scannedPageCount: 5,
      confidence: 98,
      fields: {
        liikevaihto: 786930.85,
        henkilostokulut: -235498.71,
        poistot: -186904.08,
        rahoitustuototJaKulut: -10225.3,
        tilikaudenYliJaama: 3691.35,
      },
      matches: [
        {
          key: 'liikevaihto',
          label: 'Revenue',
          value: 786930.85,
          sourceLine: 'OMSATTNING 786 930,85 809 973,89',
          pageNumber: 4,
        },
        {
          key: 'henkilostokulut',
          label: 'Personnel costs',
          value: -235498.71,
          sourceLine: 'PERSONALKOSTNADER -235 498,71 -234 519,26',
          pageNumber: 4,
        },
        {
          key: 'poistot',
          label: 'Depreciation',
          value: -186904.08,
          sourceLine: 'AVSKRIVNINGAR ENLIGT PLAN -186 904,08 -186 217,59',
          pageNumber: 4,
        },
        {
          key: 'rahoitustuototJaKulut',
          label: 'Net finance',
          value: -10225.3,
          sourceLine: 'FINANSIELLA INTAKTER OCH KOSTNADER -10 225,30 -11 016,33',
          pageNumber: 4,
        },
        {
          key: 'tilikaudenYliJaama',
          label: 'Year result',
          value: 3691.35,
          sourceLine: 'RAKENSKAPSPERIODENS VINST 3 691,35 -98 373,45',
          pageNumber: 4,
        },
      ],
      warnings: [],
      rawText: 'mock OCR text',
    });
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [reviewedYear],
        excludedYears: [],
        workspaceYears: [2024],
      },
    } as any);
    syncImportV2.mockResolvedValue({
      generatedBudgets: {
        results: [{ budgetId: 'budget-2024', vuosi: 2024, mode: 'updated' }],
        skipped: [],
      },
      sanity: { rows: [] },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.statementImportAction'),
      }),
    );

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(['pdf'], 'bokslut-2024.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractStatementFromPdf).toHaveBeenCalled();
    });
    expect((await screen.findAllByText('bokslut-2024.pdf')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(localeText('v2Overview.statementImportDiffTitle'))).toBeTruthy();
    expect(screen.getByText('OMSATTNING 786 930,85 809 973,89')).toBeTruthy();
    expect(
      screen.getByText(
        'FINANSIELLA INTAKTER OCH KOSTNADER -10 225,30 -11 016,33',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportReplaceFile'),
      }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: localeText('v2Overview.statementImportConfirmAndSync'),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportConfirmAndSync'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            liikevaihto: 786930.85,
            henkilostokulut: 235498.71,
            poistot: 186904.08,
            rahoitustuototJaKulut: -10225.3,
            tilikaudenYliJaama: 3691.35,
          }),
          statementImport: expect.objectContaining({
            fileName: 'bokslut-2024.pdf',
            pageNumber: 4,
            confidence: 98,
            scannedPageCount: 5,
            matchedFields: [
              'liikevaihto',
              'henkilostokulut',
              'poistot',
              'rahoitustuototJaKulut',
              'tilikaudenYliJaama',
            ],
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(syncImportV2).toHaveBeenCalledWith([2024]);
    });
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.workbookImportAction'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeNull();
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
      screen.getAllByText(localeText('v2Overview.wizardContextImportedWorkspaceYears'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        localeText('v2Overview.wizardContextImportedWorkspaceYearsBody', {
          years: localeText('v2Overview.noImportedYears'),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText('Tästä vuodesta puuttuu: Price data (taksa).'),
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
    expect(connectImportOrganizationV2).not.toHaveBeenCalled();
  });

  it('auto-suggests an exact VEETI id lookup and keeps connect explicit', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;
    disconnectedOverview.importStatus.availableYears = [];
    disconnectedOverview.importStatus.years = [];
    disconnectedOverview.importStatus.excludedYears = [];
    getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({ canCreateScenario: false, baselineYears: [] }),
    );
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
      { target: { value: '1535' } },
    );

    await waitFor(() => {
      expect(searchImportOrganizationsV2).toHaveBeenCalledWith('1535', 25);
    });
    expect(await screen.findByRole('button', { name: /Water Utility/i })).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.resultSelected')),
    ).toBeTruthy();
    expect(connectImportOrganizationV2).not.toHaveBeenCalled();
  });

  it(
    'does not retrigger the same debounced search after exact-match auto-selection settles',
    async () => {
      const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({ canCreateScenario: false, baselineYears: [] }),
      );
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
        { target: { value: '1535' } },
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByText(localeText('v2Overview.resultSelected'))).toBeTruthy();

      await new Promise((resolve) => window.setTimeout(resolve, 220));

      expect(searchImportOrganizationsV2).toHaveBeenCalledTimes(1);
    },
    10000,
  );

  it('renders the year-selection step before the slower background refresh finishes after connect', async () => {
    const disconnectedOverview = buildOverviewResponse({ workspaceYears: [] });
    disconnectedOverview.importStatus.connected = false;
    disconnectedOverview.importStatus.link = null;
    const pendingRefresh = new Promise<any>(() => undefined);

    getOverviewV2.mockReset();
    getOverviewV2
      .mockResolvedValueOnce(disconnectedOverview)
      .mockReturnValueOnce(pendingRefresh);
    searchImportOrganizationsV2.mockResolvedValue([
      {
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kunta: 'Helsinki',
      },
    ] as any);
    connectImportOrganizationV2.mockResolvedValue({
      linked: { orgId: 'org-1', veetiId: 1535, nimi: 'Water Utility', ytunnus: '1234567-8' },
      fetchedAt: '2026-03-08T10:00:00.000Z',
      years: [2024, 2023],
      availableYears: [2024, 2023],
      workspaceYears: [],
      snapshotUpserts: 4,
    } as any);
    getImportStatusV2.mockResolvedValue({
      connected: true,
      link: {
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        lastFetchedAt: '2026-03-08T10:00:00.000Z',
        uiLanguage: 'sv',
      },
      years: buildOverviewResponse({ workspaceYears: [] }).importStatus.years,
      availableYears: buildOverviewResponse({ workspaceYears: [] }).importStatus.years,
      excludedYears: [],
      workspaceYears: [],
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
    fireEvent.click(await screen.findByRole('button', { name: /Water Utility/i }));
    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.connectButton') }),
    );

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.importYearsButton'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.wizardQuestionImportYears')),
    ).toBeTruthy();
    expect(
      screen.queryByPlaceholderText(localeText('v2Overview.searchPlaceholder')),
    ).toBeNull();
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
        uiLanguage: 'sv',
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
    expect(window.localStorage.getItem('va_language')).toBe('sv');
    expect(window.localStorage.getItem('va_language_source')).toBe(
      'org_default',
    );

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

  it('auto-advances to the next review year after saving a blocked year', async () => {
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2023,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['prices'],
      missingAfter: [],
      syncReady: true,
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
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
      { target: { value: '3.00' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: localeText('v2Overview.manualPatchSave') }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.wizardQuestionReviewYear')),
    ).toBeNull();
    expect(document.querySelector('.v2-inline-card-editor')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
  });

  it('keeps the full on-card action cluster on the step-3 review card', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.v2-inline-card-editor')).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.statementImportAction'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.excludeYearFromPlan'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.reapplyVeetiFinancials'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.reapplyVeetiPrices'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.reapplyVeetiVolumes'),
      }),
    ).toBeTruthy();
  });

  it('restores VEETI prices and volumes per section from the shared year-detail surface', async () => {
    reconcileImportYearV2.mockResolvedValue({
      year: 2024,
      action: 'apply_veeti',
      reconciledDataTypes: ['taksa'],
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
        workspaceYears: [2024],
      },
      yearData: await getImportYearDataV2(2024),
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.reapplyVeetiPrices'),
      }),
    );

    await waitFor(() => {
      expect(reconcileImportYearV2).toHaveBeenCalledWith(2024, {
        action: 'apply_veeti',
        dataTypes: ['taksa'],
      });
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

  it('renders suspicious and blocked trust-board lanes on step 2', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle')),
    ).toBeTruthy();
    expect(screen.getAllByText(localeText('v2Overview.wizardQuestionImportYears'))).toHaveLength(
      1,
    );
    expect(
      screen.getByText(localeText('v2Overview.wizardBodyImportYears')),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.trustLaneBlockedTitle')),
    ).toBeTruthy();
    expect(
      document.querySelector('details.v2-import-board-lane-blocked[open]'),
    ).toBeNull();
    expect(
      screen.getAllByText(localeText('v2Overview.wizardSummarySubtitle')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: '2024' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: '2023' })).toBeNull();
    expect(
      screen.getByText(localeText('v2Overview.trustLargeDiscrepancy')),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('Tilinpäätös: 1');
    expect(screen.getAllByText(/Tilinpäätös: Tilinpäätösimportti/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Yksikköhinnat: Manuaalinen/i).length).toBeGreaterThan(0);
    expect(screen.getByText(localeText('v2Overview.yearNeedsCompletion'))).toBeTruthy();
    expect(
      document.querySelector('.v2-overview-helper-list.step2-support'),
    ).toBeTruthy();
    expect(document.querySelector('.v2-overview-workspace-layout')).toBeTruthy();
    expect(document.querySelector('.v2-overview-support-rail.step2-support')).toBeTruthy();
    const blockedLaneSummary = screen
      .getByText(localeText('v2Overview.trustLaneBlockedTitle'))
      .closest('summary') as HTMLElement | null;
    expect(blockedLaneSummary).toBeTruthy();
    fireEvent.click(blockedLaneSummary!);
    expect(
      screen.getByText(
        localeText('v2Overview.yearMissingCountLabel', { count: 2, total: 4 }),
      ),
    ).toBeTruthy();
    expect(
      document.querySelector('.v2-year-card-secondary-grid.compact'),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingRevenueLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingPersonnelLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingDepreciationLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingOtherOpexLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingResultLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(document.querySelectorAll('.v2-year-technical-details[open]').length).toBe(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewSecondaryLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewWaterPriceLabel')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewWastewaterPriceLabel')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewWaterVolumeLabel')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewWastewaterVolumeLabel')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Täydennä manuaalisesti' })).toBeTruthy();
    expect((await screen.findAllByText(/100.?000 EUR/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/15.?000 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/21.?000 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/6.?500 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/19.?000 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/30.?000 EUR/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Tulos / 0:');
    expect(document.body.textContent).not.toContain('Resultat / 0:');
    expect(document.body.textContent).not.toContain('Result / 0:');
  });

  it('keeps one persistent support rail through connected steps 2 to 6 without restoring a duplicate bottom summary card', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [baselineReadyYear],
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
      }),
    );
    const expectSingleSupportRail = () => {
      expect(document.querySelector('.v2-overview-workspace-layout')).toBeTruthy();
      expect(
        document.querySelectorAll(
          '.v2-overview-support-rail, .v2-overview-hero-grid',
        ),
      ).toHaveLength(1);
    };

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.wizardSummarySubtitle'));
    expectSingleSupportRail();

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));
    expectSingleSupportRail();

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );
    expectSingleSupportRail();
    expect(await screen.findByRole('button', { name: 'Avaa Ennuste' })).toBeTruthy();
    expectSingleSupportRail();
  });

  it('shows a ready-to-review lane for clean VEETI years on step 2', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            vuosi: 2022,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: [
                'tilinpaatos',
                'taksa',
                'volume_vesi',
                'volume_jatevesi',
              ],
              manualDataTypes: [],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
        ],
      }),
    );
    getImportYearDataV2.mockResolvedValueOnce({
      year: 2022,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 90000,
              AineetJaPalvelut: 22000,
              Henkilostokulut: 24000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 41000,
              TilikaudenYliJaama: 3000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 90000,
              AineetJaPalvelut: 22000,
              Henkilostokulut: 24000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 41000,
              TilikaudenYliJaama: 3000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.trustLaneReadyTitle')),
    ).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.trustLooksPlausible'))).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '2022' })).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingDepreciationLabel'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('moves an unselected year into the parked lane without treating it as excluded from plan', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const selectedCheckbox = await screen.findByRole('checkbox', { name: '2024' });
    expect((selectedCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(selectedCheckbox);

    expect(
      (
        await screen.findAllByText(localeText('v2Overview.trustLaneParkedTitle'))
      ).length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelector('details.v2-import-board-lane-parked[open]'),
    ).toBeNull();
    const parkedLaneSummary = (await screen.findAllByText(
      localeText('v2Overview.trustLaneParkedTitle'),
    ))[0]!.closest('summary') as HTMLElement | null;
    expect(parkedLaneSummary).toBeTruthy();
    fireEvent.click(parkedLaneSummary!);
    expect(
      screen.getAllByText(localeText('v2Overview.trustParkedYear')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(localeText('v2Overview.setupStatusExcludedShort')),
    ).toBeNull();
  });

  it('opens parked-year price repair and focuses the first price field', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const selectedCheckbox = await screen.findByRole('checkbox', { name: '2024' });
    fireEvent.click(selectedCheckbox);
    const parkedLaneSummary = (await screen.findAllByText(
      localeText('v2Overview.trustLaneParkedTitle'),
    ))[0]!.closest('summary') as HTMLElement | null;
    expect(parkedLaneSummary).toBeTruthy();
    fireEvent.click(parkedLaneSummary!);

    fireEvent.click(
      (await screen.findAllByRole('button', {
        name: localeText('v2Overview.repairPricesButton'),
      }))[0]!,
    );

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualPriceWater'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('opens one inline step-2 card editor at a time and quiets surrounding cards', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const cards = Array.from(
      document.querySelectorAll('.v2-year-readiness-row'),
    ) as HTMLElement[];

    fireEvent.click(
      cards[0]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialRevenue'),
      }),
    ).toBeNull();
    expect(cards[0]!.className).toContain('active-edit');
    expect(cards[1]!.className).toContain('quiet');

    fireEvent.click(
      cards[1]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    await waitFor(() => {
      expect(cards[1]!.className).toContain('active-edit');
      expect(cards[0]!.className).toContain('quiet');
    });
  });

  it('focuses the matching field when a step-2 card value is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const valueButton = document.querySelector(
      '[data-edit-field="aineetJaPalvelut"]',
    ) as HTMLButtonElement | null;
    expect(valueButton).toBeTruthy();

    fireEvent.click(valueButton!);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialRevenue'),
      }),
    ).toBeNull();
  });

  it('opens step-2 inline edit when the full finance row is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const rowLabel = screen.getAllByText(
      localeText('v2Overview.previewAccountingMaterialsLabel'),
    )[0]!;

    fireEvent.click(rowLabel.closest('.v2-year-canon-row') as HTMLElement);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('opens repair from a missing secondary stat and focuses the missing field', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const blockedLaneSummary = (
      await screen.findByText(localeText('v2Overview.trustLaneBlockedTitle'))
    ).closest('summary') as HTMLElement | null;
    expect(blockedLaneSummary).toBeTruthy();
    fireEvent.click(blockedLaneSummary!);

    const missingVolumeButton = (await waitFor(() => {
      const button = document.querySelector(
        '[data-edit-field="soldWastewaterVolume"]',
      ) as HTMLButtonElement | null;
      expect(button).toBeTruthy();
      return button!;
    })) as HTMLButtonElement;
    fireEvent.click(missingVolumeButton);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualVolumeWastewater'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('closes the active step-2 card after saving and allows reopening the same or another year', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
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

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const valueButton = document.querySelector(
      '[data-edit-field="aineetJaPalvelut"]',
    ) as HTMLButtonElement | null;
    fireEvent.click(valueButton!);

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '16500' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16500,
          }),
        }),
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });
    expect(getOverviewV2).toHaveBeenCalledTimes(2);
    expect(getPlanningContextV2).not.toHaveBeenCalled();
    expect(listForecastScenariosV2).toHaveBeenCalledTimes(1);
    expect(listReportsV2).toHaveBeenCalledTimes(1);

    fireEvent.click(
      document.querySelector('[data-edit-field="aineetJaPalvelut"]')!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
    fireEvent.keyDown(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { key: 'Escape' },
    );

    const blockedLaneSummary = (
      await screen.findByText(localeText('v2Overview.trustLaneBlockedTitle'))
    ).closest('summary') as HTMLElement | null;
    expect(blockedLaneSummary).toBeTruthy();
    fireEvent.click(blockedLaneSummary!);
    fireEvent.click(
      (await screen.findAllByRole('button', {
        name: localeText('v2Overview.repairPricesButton'),
      }))[0]!,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
    ).toBeTruthy();
  });

  it('reopens step-2 inline correction from full finance rows after save without relying on value-chip targets', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
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

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const financeRows = screen.getAllByText(
      localeText('v2Overview.previewAccountingMaterialsLabel'),
    );

    fireEvent.click(financeRows[0]!.closest('.v2-year-canon-row') as HTMLElement);

    const firstInput = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '16500' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16500,
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });

    fireEvent.click(
      screen
        .getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))[0]!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();

    fireEvent.keyDown(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { key: 'Escape' },
    );

    const blockedLaneSummary = (
      await screen.findByText(localeText('v2Overview.trustLaneBlockedTitle'))
    ).closest('summary') as HTMLElement | null;
    expect(blockedLaneSummary).toBeTruthy();
    fireEvent.click(blockedLaneSummary!);

    fireEvent.click(
      screen
        .getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))[1]!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
  });

  it('saves the inline step-2 card with Enter', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
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

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    fireEvent.click(
      document.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    const input = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(input, { target: { value: '17000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 17000,
            tilikaudenYliJaama: 28000,
          }),
        }),
      );
    });
  });

  it('cancels the inline step-2 editor with Escape', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    fireEvent.click(
      document.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    const input = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(input, { target: { value: '17000' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });
  });

  it('does not discard dirty inline edits when another step-2 card is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByText(localeText('v2Overview.trustLaneSuspiciousTitle'));
    const cards = Array.from(
      document.querySelectorAll('.v2-year-readiness-row'),
    ) as HTMLElement[];
    fireEvent.click(
      cards[0]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    const input = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(input, { target: { value: '17000' } });
    fireEvent.click(
      cards[1]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    expect(cards[0]!.className).toContain('active-edit');
    expect(cards[1]!.className).toContain('quiet');
    expect(
      screen.getByText(localeText('v2Overview.inlineCardDirtyGuard')),
    ).toBeTruthy();
  });

  it('refreshes the step-3 review card values after save-and-sync', async () => {
    let reviewYearState: 'initial' | 'refreshed' = 'initial';
    const buildReviewYearData = (materials: number, result: number) => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 95000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: materials,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: result,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    });

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => {
      if (year === 2024) {
        return buildReviewYearData(
          reviewYearState === 'initial' ? 15000 : 16500,
          reviewYearState === 'initial' ? 30000 : 28000,
        );
      }
      return {
        year,
        veetiId: 1,
        sourceStatus: 'VEETI',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        hasManualOverrides: false,
        hasVeetiData: true,
        datasets: [],
      };
    });
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      status: buildOverviewResponse({ workspaceYears: [2024, 2023] }).importStatus,
    } as any);
    syncImportV2.mockImplementation(async () => {
      reviewYearState = 'refreshed';
      return {
        generatedBudgets: {
          results: [{ budgetId: 'budget-2024', vuosi: 2024, mode: 'updated' }],
          skipped: [],
        },
        sanity: { rows: [] },
      } as any;
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Avaa ja tarkista' }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '16500' } },
    );
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialYearResult'),
      }),
      { target: { value: '28000' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSaveAndSync'),
      }),
    );

    await waitFor(() => {
      expect(syncImportV2).toHaveBeenCalledWith([2024]);
    });
    await waitFor(() => {
      expect(getImportYearDataV2).toHaveBeenCalledWith(2024);
    });
    await waitFor(() => {
      expect(screen.getAllByText(/16[\s\u00A0]?500 EUR/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/28[\s\u00A0]?000 EUR/).length).toBeGreaterThan(0);
    });
  });

  it('shows direct price and volume repair actions in review mode', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: year === 2024,
        volume_vesi: true,
        volume_jatevesi: year === 2024,
      },
      hasManualOverrides: year === 2024,
      hasVeetiData: true,
      datasets:
        year === 2024
          ? [
              {
                dataType: 'tilinpaatos',
                rawRows: [
                  {
                    Liikevaihto: 95000,
                    AineetJaPalvelut: 14000,
                    Henkilostokulut: 22000,
                    Poistot: 5000,
                    LiiketoiminnanMuutKulut: 18000,
                    TilikaudenYliJaama: 25000,
                  },
                ],
                effectiveRows: [
                  {
                    Liikevaihto: 100000,
                    AineetJaPalvelut: 15000,
                    Henkilostokulut: 21000,
                    Poistot: 6500,
                    LiiketoiminnanMuutKulut: 19000,
                    TilikaudenYliJaama: 30000,
                  },
                ],
                source: 'manual',
                hasOverride: true,
                reconcileNeeded: true,
                overrideMeta: null,
              },
              {
                dataType: 'taksa',
                rawRows: [
                  { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
                  { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
                ],
                effectiveRows: [
                  { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
                  { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
                ],
                source: 'manual',
                hasOverride: true,
                reconcileNeeded: true,
                overrideMeta: null,
              },
              {
                dataType: 'volume_vesi',
                rawRows: [{ Maara: 25000 }],
                effectiveRows: [{ Maara: 25500 }],
                source: 'manual',
                hasOverride: true,
                reconcileNeeded: true,
                overrideMeta: null,
              },
              {
                dataType: 'volume_jatevesi',
                rawRows: [{ Maara: 25000 }],
                effectiveRows: [{ Maara: 24500 }],
                source: 'manual',
                hasOverride: true,
                reconcileNeeded: true,
                overrideMeta: null,
              },
            ]
          : [
              {
                dataType: 'tilinpaatos',
                rawRows: [
                  {
                    Liikevaihto: 87000,
                    AineetJaPalvelut: 12000,
                    Henkilostokulut: 21000,
                    Poistot: 6000,
                    LiiketoiminnanMuutKulut: 17000,
                    TilikaudenYliJaama: 24000,
                  },
                ],
                effectiveRows: [
                  {
                    Liikevaihto: 87000,
                    AineetJaPalvelut: 12000,
                    Henkilostokulut: 21000,
                    Poistot: 6000,
                    LiiketoiminnanMuutKulut: 17000,
                    TilikaudenYliJaama: 24000,
                  },
                ],
                source: 'veeti',
                hasOverride: false,
                reconcileNeeded: false,
                overrideMeta: null,
              },
              {
                dataType: 'volume_vesi',
                rawRows: [{ Maara: 22000 }],
                effectiveRows: [{ Maara: 22000 }],
                source: 'veeti',
                hasOverride: false,
                reconcileNeeded: false,
                overrideMeta: null,
              },
            ],
    }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.repairPricesButton'),
      }),
    ).toBeTruthy();
    const repairVolumeButton = await screen.findByRole('button', {
      name: localeText('v2Overview.repairVolumesButton'),
    });
    fireEvent.click(repairVolumeButton);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualVolumeWastewater'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('opens the QDIS workflow shell from a year card action', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));
    extractQdisFromPdf.mockResolvedValue({
      fileName: 'qdis-2022.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      fields: {
        waterUnitPrice: 1.2,
        wastewaterUnitPrice: 2.5,
        soldWaterVolume: 65000,
        soldWastewaterVolume: 35000,
      },
      matches: [
        { key: 'waterUnitPrice', label: 'Water unit price', value: 1.2, sourceLine: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { key: 'wastewaterUnitPrice', label: 'Wastewater unit price', value: 2.5, sourceLine: 'Avlopp brukningsavgift 2,50 eur/m3', pageNumber: 2 },
      ],
      warnings: [],
      rawText: 'mock qdis text',
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', {
        name: localeText('v2Overview.qdisImportAction'),
      }))[0]!,
    );
    expect(
      await screen.findByText(localeText('v2Overview.qdisImportWorkflowTitle', { year: 2024 })),
    ).toBeTruthy();

    const qdisInput = document.querySelector(
      '[data-import-kind="qdis"]',
    ) as HTMLInputElement | null;
    expect(qdisInput).toBeTruthy();
    fireEvent.change(qdisInput!, {
      target: {
        files: [new File(['pdf'], 'qdis-2022.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractQdisFromPdf).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(localeText('v2Overview.qdisImportDiffTitle')),
    ).toBeTruthy();
  });

  it('prefills QDIS values into the year patch flow inputs', async () => {
    const reviewedYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [reviewedYear],
      }),
    );
    extractQdisFromPdf.mockResolvedValue({
      fileName: 'qdis-2022.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      fields: {
        waterUnitPrice: 1.2,
        wastewaterUnitPrice: 2.5,
        soldWaterVolume: 65000,
        soldWastewaterVolume: 35000,
      },
      matches: [
        { key: 'waterUnitPrice', label: 'Water unit price', value: 1.2, sourceLine: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { key: 'wastewaterUnitPrice', label: 'Wastewater unit price', value: 2.5, sourceLine: 'Avlopp brukningsavgift 2,50 eur/m3', pageNumber: 2 },
        { key: 'soldWaterVolume', label: 'Sold water volume', value: 65000, sourceLine: 'Såld vattenmängd 65 000 m3', pageNumber: 2 },
        { key: 'soldWastewaterVolume', label: 'Sold wastewater volume', value: 35000, sourceLine: 'Såld avloppsmängd 35 000 m3', pageNumber: 2 },
      ],
      warnings: [],
      rawText: 'mock qdis text',
    });
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.qdisImportAction'),
      }),
    );

    const qdisInput = document.querySelector(
      '[data-import-kind="qdis"]',
    ) as HTMLInputElement | null;
    expect(qdisInput).toBeTruthy();
    fireEvent.change(qdisInput!, {
      target: {
        files: [new File(['pdf'], 'qdis-2022.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractQdisFromPdf).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(localeText('v2Overview.qdisImportDiffTitle')),
    ).toBeTruthy();
    expect(screen.getAllByText(/1\.20|1,20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\.50|2,50/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/65000|65 000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/35000|35 000/).length).toBeGreaterThan(0);
  });

  it('shows statement and QDIS provenance on review cards after reload', async () => {
    const qdisYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [qdisYear],
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 95000 }],
          effectiveRows: [{ Liikevaihto: 100000 }],
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
              scannedPageCount: 5,
              matchedFields: ['liikevaihto'],
              warnings: [],
            },
          },
        },
        {
          dataType: 'taksa',
          rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 1.1 }],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 1.2 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'QDIS import',
            provenance: {
              kind: 'qdis_import',
              fileName: 'qdis-2022.pdf',
              pageNumber: 2,
              confidence: 94,
              scannedPageCount: 2,
              matchedFields: ['waterUnitPrice'],
              warnings: [],
            },
          },
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'QDIS import',
            provenance: {
              kind: 'qdis_import',
              fileName: 'qdis-2022.pdf',
              pageNumber: 2,
              confidence: 94,
              scannedPageCount: 2,
              matchedFields: ['soldWaterVolume'],
              warnings: [],
            },
          },
        },
      ],
    }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(/Tilinpäätös: Tilinpäätösimportti/i),
    ).toBeTruthy();
    expect(screen.getByText(/Yksikköhinnat: QDIS PDF/i)).toBeTruthy();
    expect(screen.getByText(/Myyty vesimäärä: QDIS PDF/i)).toBeTruthy();
  });

  it('shows workbook provenance on review cards after reload', async () => {
    const workbookYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [workbookYear],
      }),
    );
    getImportYearDataV2.mockImplementation(async () => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 95000, AineetJaPalvelut: null }],
          effectiveRows: [{ Liikevaihto: 95000, AineetJaPalvelut: 182000.12 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Workbook repair',
            provenance: {
              kind: 'kva_import',
              fileName: 'kronoby-kva.xlsx',
              pageNumber: null,
              confidence: null,
              scannedPageCount: null,
              matchedFields: ['AineetJaPalvelut'],
              warnings: [],
              sheetName: 'KVA totalt',
              confirmedSourceFields: ['AineetJaPalvelut'],
              candidateRows: [
                {
                  sourceField: 'AineetJaPalvelut',
                  workbookValue: 182000.12,
                  action: 'apply_workbook',
                },
              ],
            },
          },
        },
      ],
    } as any));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText(/Työkirjaimportti/i)).toBeTruthy();
  });

  it('renders the overview surface before scenario and report side loads resolve', async () => {
    listForecastScenariosV2.mockReturnValueOnce(new Promise(() => undefined));
    listReportsV2.mockReturnValueOnce(new Promise(() => undefined));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.wizardQuestionReviewYears'),
      }),
    ).toBeTruthy();
    expect(getPlanningContextV2).toHaveBeenCalledTimes(1);
  });

  it('bounds background year-detail prefetch to the highest-priority visible years', async () => {
    const years = [2024, 2023, 2022, 2021, 2020].map((year) => ({
      vuosi: year,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'VEETI',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
        manualDataTypes: [],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: null,
      manualEditedBy: null,
      manualReason: null,
      manualProvenance: null,
    }));

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022, 2021, 2020],
        years,
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('heading', {
      name: localeText('v2Overview.wizardQuestionReviewYears'),
    });

    await waitFor(() => {
      expect(getImportYearDataV2).toHaveBeenCalledTimes(4);
    });
    expect(getImportYearDataV2.mock.calls.map(([year]) => year)).toEqual([
      2024,
      2023,
      2022,
      2021,
    ]);
  });

  it('prefetches only linked workspace years when available VEETI years extend further into the future', async () => {
    const years = [2026, 2025, 2024, 2023, 2022].map((year) => ({
      vuosi: year,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'VEETI',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
        manualDataTypes: [],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: null,
      manualEditedBy: null,
      manualReason: null,
      manualProvenance: null,
    }));

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022],
        years,
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('heading', {
      name: localeText('v2Overview.wizardQuestionReviewYears'),
    });

    await waitFor(() => {
      expect(getImportYearDataV2).toHaveBeenCalledTimes(3);
    });
    expect(getImportYearDataV2.mock.calls.map(([year]) => year)).toEqual([
      2024,
      2023,
      2022,
    ]);
  });

  it('keeps the step-2 import surface stable on a narrow viewport', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
      writable: true,
    });
    fireEvent(window, new Event('resize'));

    try {
      getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByRole('heading', {
          name: localeText('v2Overview.wizardQuestionImportYears'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.importYearsButton'),
        }),
      ).toBeTruthy();
      expect(
        screen.getAllByText(localeText('v2Overview.wizardSummaryTitle')).length,
      ).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
        writable: true,
      });
      fireEvent(window, new Event('resize'));
    }
  });

  it('shows literal mixed statement and workbook ownership after reload for 2024', async () => {
    const mixedYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [mixedYear],
      }),
    );
    getImportYearDataV2.mockResolvedValueOnce({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 700000,
              AineetJaPalvelut: null,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 786930.85,
              AineetJaPalvelut: 182000.12,
              TilikaudenYliJaama: 3691.35,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: {
            editedAt: '2026-03-08T10:00:00.000Z',
            editedBy: 'tester',
            reason: 'Statement + workbook repair',
            provenance: {
              kind: 'kva_import',
              fileName: 'kronoby-kva.xlsx',
              pageNumber: null,
              confidence: null,
              scannedPageCount: null,
              matchedFields: ['AineetJaPalvelut'],
              warnings: [],
              sheetName: 'KVA totalt',
              confirmedSourceFields: ['AineetJaPalvelut'],
              candidateRows: [
                {
                  sourceField: 'AineetJaPalvelut',
                  workbookValue: 182000.12,
                  action: 'apply_workbook',
                },
              ],
              fieldSources: [
                {
                  sourceField: 'Liikevaihto',
                  provenance: {
                    kind: 'statement_import',
                    fileName: 'bokslut-2024.pdf',
                    pageNumber: 4,
                    confidence: 98,
                    scannedPageCount: 5,
                    matchedFields: ['liikevaihto', 'tilikaudenYliJaama'],
                    warnings: [],
                  },
                },
                {
                  sourceField: 'AineetJaPalvelut',
                  provenance: {
                    kind: 'kva_import',
                    fileName: 'kronoby-kva.xlsx',
                    pageNumber: null,
                    confidence: null,
                    scannedPageCount: null,
                    matchedFields: ['AineetJaPalvelut'],
                    warnings: [],
                    sheetName: 'KVA totalt',
                    confirmedSourceFields: ['AineetJaPalvelut'],
                    candidateRows: [
                      {
                        sourceField: 'AineetJaPalvelut',
                        workbookValue: 182000.12,
                        action: 'apply_workbook',
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      ],
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByText(/Tilinpäätös PDF \+ työkirjakorjaus/i)).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.yearDecisionAction'),
      }),
    ).toBeTruthy();
  });

  it('shows only the edited line names on mixed-source chosen year cards', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));
    getImportYearDataV2.mockImplementation(async (year: number) => {
      if (year !== 2024) {
        return {
          year,
          veetiId: 1,
          sourceStatus: 'VEETI',
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          hasManualOverrides: false,
          hasVeetiData: true,
          datasets: [],
        } as any;
      }

      return {
        year: 2024,
        veetiId: 1,
        sourceStatus: 'MIXED',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        hasManualOverrides: true,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: 160000,
                Henkilostokulut: 150000,
                Poistot: 50000,
                LiiketoiminnanMuutKulut: 100000,
                TilikaudenYliJaama: 25000,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 786930.85,
                AineetJaPalvelut: 182000.12,
                Henkilostokulut: 150000,
                Poistot: 50000,
                LiiketoiminnanMuutKulut: 100000,
                TilikaudenYliJaama: 25000,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: '2026-03-08T10:00:00.000Z',
              editedBy: 'tester',
              reason: 'Statement + workbook repair',
              provenance: {
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                pageNumber: null,
                confidence: null,
                scannedPageCount: null,
                matchedFields: ['AineetJaPalvelut'],
                warnings: [],
                sheetName: 'KVA totalt',
                confirmedSourceFields: ['AineetJaPalvelut'],
                candidateRows: [
                  {
                    sourceField: 'AineetJaPalvelut',
                    workbookValue: 182000.12,
                    action: 'apply_workbook',
                  },
                ],
                fieldSources: [
                  {
                    sourceField: 'Liikevaihto',
                    provenance: {
                      kind: 'statement_import',
                      fileName: 'bokslut-2024.pdf',
                      pageNumber: 4,
                      confidence: 98,
                      scannedPageCount: 5,
                      matchedFields: ['liikevaihto'],
                      warnings: [],
                    },
                  },
                  {
                    sourceField: 'AineetJaPalvelut',
                    provenance: {
                      kind: 'kva_import',
                      fileName: 'kronoby-kva.xlsx',
                      pageNumber: null,
                      confidence: null,
                      scannedPageCount: null,
                      matchedFields: ['AineetJaPalvelut'],
                      warnings: [],
                      sheetName: 'KVA totalt',
                      confirmedSourceFields: ['AineetJaPalvelut'],
                      candidateRows: [
                        {
                          sourceField: 'AineetJaPalvelut',
                          workbookValue: 182000.12,
                          action: 'apply_workbook',
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      } as any;
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(
        localeText('v2Overview.editedFieldsLabel', {
          fields: `${localeText('v2Overview.previewAccountingRevenueLabel')}, ${localeText(
            'v2Overview.previewAccountingMaterialsLabel',
          )}`,
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.queryByText(localeText('v2Overview.trustNeedsReviewHint')),
    ).toBeNull();
  });

  it('keeps accounting-first year cards factual across import and review surfaces', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(localeText('v2Overview.trustLargeDiscrepancy')),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingRevenueLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Tulos / 0:');
    expect(document.body.textContent).not.toContain('Resultat / 0:');
    expect(document.body.textContent).not.toContain('Result / 0:');
    expect(document.body.textContent).not.toContain('Tulos on ylijäämäinen');
    expect(document.body.textContent).not.toContain('Tulos on alijäämäinen');
    expect(
      screen.queryByText(localeText('v2Overview.yearResultExplicitFieldNote')),
    ).toBeNull();
    expect(document.querySelectorAll('.v2-year-technical-details[open]').length).toBe(0);

    cleanup();

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingRevenueLabel'))
        .length,
    ).toBeGreaterThan(0);
    const firstReviewRow = document.querySelector(
      '.v2-year-status-row',
    ) as HTMLElement | null;
    expect(firstReviewRow).toBeTruthy();
    expect(
      within(firstReviewRow!).getByText(
        localeText('v2Overview.previewAccountingDepreciationLabel'),
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.setupStatusTechnicalReadyHint'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        'Vuosi näyttää valmiilta. Tarkista vertailu ja hyväksy vuosi suunnittelupohjaan.',
      ),
    ).toBeNull();
  });

  it('routes review continue into explicit no-change approval when imported years are technically ready', async () => {
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
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

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Luo suunnittelupohja' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Avaa Ennuste' })).toBeNull();
  });

  it('does not render local back buttons on review and baseline wizard surfaces', async () => {
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
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
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.wizardBackStep2'),
      }),
    ).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.wizardBackStep3'),
      }),
    ).toBeNull();
  });

  it('does not render a duplicate local back button inside the year-decision modal', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.openReviewYearButton'),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.wizardBackStep2'),
      }),
    ).toBeNull();
  });

  it('keeps the year-decision modal on a single QDIS upload and confirm path', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      (await screen.findAllByRole('button', {
        name: localeText('v2Overview.qdisImportAction'),
      }))[0]!,
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getAllByRole('button', {
        name: localeText('v2Overview.qdisImportUploadFile'),
      }),
    ).toHaveLength(1);
    expect(
      within(dialog).queryByText(localeText('v2Overview.yearActionsTitle')),
    ).toBeNull();
    expect(
      within(dialog).queryByText(localeText('v2Overview.yearActionsFixBody')),
    ).toBeNull();
    expect(
      within(dialog).queryByRole('button', {
        name: localeText('v2Overview.qdisImportConfirm'),
      }),
    ).toBeNull();
    expect(
      within(dialog).getByRole('button', {
        name: localeText('v2Overview.qdisImportConfirmAndSync'),
      }),
    ).toBeTruthy();
  });

  it('explains corrected-year closure before baseline creation', async () => {
    seedReviewedYears([2024]);
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [buildOverviewResponse().importStatus.years[0]],
      }),
    );
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
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    expect(
      (
        await screen.findAllByText(
          localeText('v2Overview.wizardQuestionBaseline'),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(localeText('v2Overview.baselineClosureTitle')),
    ).toBeTruthy();
    expect(
      screen.getByText(
        localeText('v2Overview.baselineClosureChangedBody', {
          years: '2024',
          datasets: localeText('v2Overview.datasetFinancials'),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        `${localeText('v2Overview.datasetPrices')}, ${localeText(
          'v2Overview.datasetWastewaterVolume',
        )}, ${localeText('v2Overview.datasetWaterVolume')}`,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        localeText('v2Overview.baselineClosureQueuedBody', { years: '2024' }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.baselineReadyHint')),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.openForecast'),
      }),
    ).toBeNull();
  });

  it('creates the planning baseline and updates the sticky summary after success', async () => {
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
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
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Luo suunnittelupohja' }),
    );

    await waitFor(() => {
      expect(createPlanningBaselineV2).toHaveBeenCalledWith([2024]);
    });
    expect(
      await screen.findByText(localeText('v2Overview.planningBaselineDone', {
        years: '2024',
      })),
    ).toBeTruthy();
    const baselineReadySummary = screen
      .getByText(localeText('v2Overview.wizardSummaryBaselineReady'))
      .closest('.v2-overview-progress-item') as HTMLElement;
    expect(
      within(baselineReadySummary).getByText(
        localeText('v2Overview.wizardSummaryNo'),
      ),
    ).toBeTruthy();
  });

  it('keeps baseline gating tied to blocked imported years only when other available VEETI years remain incomplete', async () => {
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
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
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

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

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
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
    ).toBe(1);
    expect(
      screen.getAllByText(localeText('v2Overview.wizardBodyForecast')).length,
    ).toBe(1);
    expect(
      screen.getAllByText(localeText('v2Overview.baselineIncludedYears')).length,
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

    fireEvent.click(await screen.findByRole('button', { name: 'Avaa ja tarkista' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
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
