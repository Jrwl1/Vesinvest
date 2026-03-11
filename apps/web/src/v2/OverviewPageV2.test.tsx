import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewPageV2 } from './OverviewPageV2';

const completeImportYearManuallyV2 = vi.fn();
const connectImportOrganizationV2 = vi.fn();
const deleteImportYearsBulkV2 = vi.fn();
const deleteImportYearV2 = vi.fn();
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

const translate = (
  _key: string,
  defaultValue?: string,
  options?: Record<string, unknown>,
) => {
  let out = defaultValue ?? _key;
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
};

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
  completeImportYearManuallyV2: (...args: unknown[]) =>
    completeImportYearManuallyV2(...args),
  connectImportOrganizationV2: (...args: unknown[]) =>
    connectImportOrganizationV2(...args),
  deleteImportYearsBulkV2: (...args: unknown[]) =>
    deleteImportYearsBulkV2(...args),
  deleteImportYearV2: (...args: unknown[]) => deleteImportYearV2(...args),
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
    deleteImportYearsBulkV2.mockReset();
    deleteImportYearV2.mockReset();
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

    getOverviewV2.mockResolvedValue({
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
    } as any);

    getPlanningContextV2.mockResolvedValue({
      canCreateScenario: true,
      baselineYears: [
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
    } as any);

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

  it('renders the readiness summary and selected-year comparison view', async () => {
    const { container } = render(
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
    expect(await screen.findByText('Selected year')).toBeTruthy();
    expect(await screen.findByText('Statement import (bokslut-2024.pdf)')).toBeTruthy();
    expect(screen.getByText('Revenue (Liikevaihto)')).toBeTruthy();
    expect(screen.getAllByText('Selected for sync').length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll('.v2-import-panel .v2-btn-primary').length,
    ).toBe(0);
  });

  it('surfaces blocked-year actions alongside the year card', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findAllByText('Needs completion')).toHaveLength(2);
    expect(screen.getAllByText(/Missing requirements:/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Complete manually' }).length,
    ).toBeGreaterThan(0);

    await waitFor(() => {
      expect(getImportYearDataV2).toHaveBeenCalledWith(2024);
    });
  });

  it('uses the import-years contract for the step-2 CTA instead of sync', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const button = await screen.findByRole('button', {
      name: 'Tuo valitut vuodet',
    });
    button.click();

    await waitFor(() => {
      expect(importYearsV2).toHaveBeenCalledWith([2024]);
    });
    expect(syncImportV2).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Imported years are now in the workspace: 2024.'),
    ).toBeTruthy();
  });

});
