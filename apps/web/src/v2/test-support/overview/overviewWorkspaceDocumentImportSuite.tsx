import React from 'react';
import {
  completeImportYearManuallyV2,
  clearImportAndScenariosV2,
  connectImportOrganizationV2,
  createVesinvestPlanV2,
  createForecastScenarioV2,
  createPlanningBaselineV2,
  deleteImportYearsBulkV2,
  deleteImportYearV2,
  excludeImportYearsV2,
  getImportStatusV2,
  getImportYearDataV2,
  getTokenInfo,
  importYearsV2,
  getOpsFunnelV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  previewWorkbookImportV2,
  refreshOverviewPeerV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  sendV2OpsEvent,
  extractStatementFromPdf,
  extractQdisFromPdf,
  extractDocumentFromPdf,
  translate,
  localeText,
  getPrimaryButtons,
  expectPrimaryButtonLabels,
  clickReviewGroupYear,
  focusReviewWorkspaceYear,
  openReviewWorkspaceYear,
  openYearDecisionWorkspaceYear,
  openCurrentYearEstimateLane,
  getLatestSetupWizardState,
  findSupportStatusItem,
  findReviewWorkspaceYear,
  seedReviewedYears,
  buildOverviewResponse,
  buildPlanningContextResponse,
  resetOverviewTestState,
  setActiveLocale,
} from './overviewTestHarness';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewImportBoard } from '../../OverviewImportBoard';
import { OverviewPageV2 } from '../../OverviewPageV2';
import { OverviewReviewBoard } from '../../OverviewReviewBoard';
import { OverviewSupportRail } from '../../OverviewSupportRail';
import { OverviewYearWorkspace } from '../../OverviewYearWorkspace';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from '../../OverviewWizardPanels';
import { submitWorkbookImportWorkflow } from '../../overviewImportWorkflows';
import { getPreviewPrefetchYears, pickDefaultBaselineYears } from '../../overviewSelectors';
import { buildImportYearSummaryRows } from '../../yearReview';
import { getExactEditedFieldLabels, useOverviewSetupState } from '../../useOverviewSetupState';
import { useOverviewImportController } from '../../useOverviewImportController';
export function registerOverviewWorkspaceDocumentImportSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
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
      screen.queryByRole('button', {
        name: localeText('v2Overview.repairPricesButton'),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.repairVolumesButton'),
      }),
    ).toBeNull();
    await openReviewWorkspaceYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );

    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWastewater'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualVolumeWastewater'),
      }),
    ).toBeTruthy();
  });

  it('routes the source-document year-card action into the document import workflow', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [buildOverviewResponse().importStatus.years[0]],
      }),
    );
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'source-2022.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      documentProfile: 'unknown_pdf',
      datasetKinds: ['prices', 'volumes'],
      matchedFields: [
        'waterUnitPrice',
        'wastewaterUnitPrice',
        'soldWaterVolume',
        'soldWastewaterVolume',
      ],
      financials: {},
      prices: {
        waterUnitPrice: 1.2,
        wastewaterUnitPrice: 2.5,
      },
      volumes: {
        soldWaterVolume: 65000,
        soldWastewaterVolume: 35000,
      },
      sourceLines: [{ text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 }],
      matches: [
        { key: 'waterUnitPrice', label: 'Water unit price', datasetKind: 'prices', value: 1.2, sourceLine: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { key: 'wastewaterUnitPrice', label: 'Wastewater unit price', datasetKind: 'prices', value: 2.5, sourceLine: 'Avlopp brukningsavgift 2,50 eur/m3', pageNumber: 2 },
      ],
      warnings: [],
      rawText: 'mock source text',
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2024`,
      }),
    );
    expect(
      await screen.findByText(
        localeText('v2Overview.documentImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();

    const documentInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(documentInput).toBeTruthy();
  });

  it('renders the staged source-document flow in Finnish', async () => {
    setActiveLocale('fi');
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [buildOverviewResponse().importStatus.years[0]],
      }),
    );
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'source-2024.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      documentProfile: 'unknown_pdf',
      datasetKinds: ['prices'],
      matchedFields: ['waterUnitPrice'],
      financials: {},
      prices: {
        waterUnitPrice: 1.2,
      },
      volumes: {},
      sourceLines: [{ text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 }],
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          datasetKind: 'prices',
          value: 1.2,
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
      ],
      warnings: [],
      rawText: 'mock source text',
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2024`,
      }),
    );
    expect(
      await screen.findByText(
        localeText('v2Overview.documentImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.documentImportWorkflowBody')),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: localeText('v2Overview.documentImportUploadFile') }),
    ).toBeTruthy();

    const documentInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(documentInput).toBeTruthy();
    fireEvent.change(documentInput!, {
      target: {
        files: [
          new File(['pdf'], 'source-2024.pdf', {
            type: 'application/pdf',
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(extractDocumentFromPdf).toHaveBeenCalled();
    });
    expect(
      await screen.findByText(
        localeText('v2Overview.documentImportDone'),
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: localeText('v2Overview.documentImportConfirm') }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportConfirmAndSync'),
      }),
    ).toBeTruthy();
    expect(screen.queryByText('Import source PDF')).toBeNull();
  });

  it('keeps source-document values staged until the user confirms the import', async () => {
    const reviewedYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [reviewedYear],
      }),
    );
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'qdis-2022.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      documentProfile: 'generic_pdf',
      datasetKinds: ['prices', 'volumes'],
      matchedFields: [
        'waterUnitPrice',
        'wastewaterUnitPrice',
        'soldWaterVolume',
        'soldWastewaterVolume',
      ],
      financials: {},
      prices: {
        waterUnitPrice: 1.2,
        wastewaterUnitPrice: 2.5,
      },
      volumes: {
        soldWaterVolume: 65000,
        soldWastewaterVolume: 35000,
      },
      sourceLines: [
        { text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { text: 'S\u00e5ld vattenm\u00e4ngd 65 000 m3', pageNumber: 2 },
      ],
      matches: [
        { key: 'waterUnitPrice', label: 'Water unit price', datasetKind: 'prices', value: 1.2, sourceLine: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { key: 'wastewaterUnitPrice', label: 'Wastewater unit price', datasetKind: 'prices', value: 2.5, sourceLine: 'Avlopp brukningsavgift 2,50 eur/m3', pageNumber: 2 },
        { key: 'soldWaterVolume', label: 'Sold water volume', value: 65000, sourceLine: 'Såld vattenmängd 65 000 m3', pageNumber: 2 },
        { key: 'soldWastewaterVolume', label: 'Sold wastewater volume', value: 35000, sourceLine: 'Såld avloppsmängd 35 000 m3', pageNumber: 2 },
      ],
      warnings: ['Generic PDF detection needs manual review before saving.'],
      rawText: 'mock qdis text',
    });
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Avaa ja tarkista/ }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.documentImportAction'),
      }),
    );

    const documentInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(documentInput).toBeTruthy();
    fireEvent.change(documentInput!, {
      target: {
        files: [new File(['pdf'], 'qdis-2022.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractDocumentFromPdf).toHaveBeenCalled();
    });
    expect(
      (await screen.findAllByText(/Vatten brukningsavgift 1,20 eur\/m3/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/1\.20|1,20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2\.50|2,50/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/65000|65 000/).length).toBeGreaterThan(0);
    expect(
      document.querySelector(
        '[data-document-import-choice="soldWastewaterVolume-0"] input',
      ),
    ).toBeTruthy();
    expect(screen.queryByDisplayValue('1.2')).toBeNull();
  });

  it('lets reviewer edits override staged source-document values before confirm', async () => {
    const reviewedYear = buildOverviewResponse().importStatus.years[0];
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
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
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [reviewedYear],
      }),
    );
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'qdis-2022.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 94,
      documentProfile: 'unknown_pdf',
      datasetKinds: ['prices', 'volumes'],
      matchedFields: [
        'waterUnitPrice',
        'wastewaterUnitPrice',
        'soldWaterVolume',
        'soldWastewaterVolume',
      ],
      financials: {},
      prices: {
        waterUnitPrice: 1.2,
        wastewaterUnitPrice: 2.5,
      },
      volumes: {
        soldWaterVolume: 65000,
        soldWastewaterVolume: 35000,
      },
      sourceLines: [
        { text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { text: 'Sald vattenmangd 65 000 m3', pageNumber: 2 },
      ],
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          datasetKind: 'prices',
          value: 1.2,
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'wastewaterUnitPrice',
          label: 'Wastewater unit price',
          datasetKind: 'prices',
          value: 2.5,
          sourceLine: 'Avlopp brukningsavgift 2,50 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          datasetKind: 'volumes',
          value: 65000,
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
        {
          key: 'soldWastewaterVolume',
          label: 'Sold wastewater volume',
          datasetKind: 'volumes',
          value: 35000,
          sourceLine: 'Sald avloppsmangd 35 000 m3',
          pageNumber: 2,
        },
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

    fireEvent.click(await screen.findByRole('button', { name: /Avaa ja tarkista/ }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.documentImportAction'),
      }),
    );

    const documentInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(documentInput).toBeTruthy();
    fireEvent.change(documentInput!, {
      target: {
        files: [new File(['pdf'], 'qdis-2022.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractDocumentFromPdf).toHaveBeenCalled();
    });

    const waterChoice = document.querySelector(
      '[data-document-import-choice="waterUnitPrice-0"] input',
    ) as HTMLInputElement;
    const wastewaterChoice = document.querySelector(
      '[data-document-import-choice="wastewaterUnitPrice-0"] input',
    ) as HTMLInputElement;
    const soldWaterChoice = document.querySelector(
      '[data-document-import-choice="soldWaterVolume-0"] input',
    ) as HTMLInputElement;
    const soldWastewaterChoice = document.querySelector(
      '[data-document-import-choice="soldWastewaterVolume-0"] input',
    ) as HTMLInputElement;
    expect(waterChoice).toBeTruthy();
    expect(wastewaterChoice).toBeTruthy();
    expect(soldWaterChoice).toBeTruthy();
    expect(soldWastewaterChoice).toBeTruthy();
    fireEvent.click(waterChoice);
    fireEvent.click(wastewaterChoice);
    fireEvent.click(soldWaterChoice);
    fireEvent.click(soldWastewaterChoice);
    await waitFor(() => {
      expect(waterChoice.checked).toBe(true);
      expect(wastewaterChoice.checked).toBe(true);
      expect(soldWaterChoice.checked).toBe(true);
      expect(soldWastewaterChoice.checked).toBe(true);
    });

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
      {
        target: { value: '1.55' },
      },
    );
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualVolumeWater'),
      }),
      {
        target: { value: '67000' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportConfirmAndSync'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          prices: {
            waterUnitPrice: 1.55,
            wastewaterUnitPrice: 2.5,
          },
          volumes: {
            soldWaterVolume: 67000,
            soldWastewaterVolume: 35000,
          },
          documentImport: expect.objectContaining({
            fileName: 'qdis-2022.pdf',
            documentProfile: 'unknown_pdf',
            datasetKinds: ['prices', 'volumes'],
          }),
        }),
      );
    });
  });

  it('lets reviewer keep the current value for a previewed field without auto-writing a hidden reason', async () => {
    const reviewedYear = buildOverviewResponse().importStatus.years[0];
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['volume_vesi'],
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
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [reviewedYear],
      }),
    );
    getImportYearDataV2.mockResolvedValueOnce({
      year: 2024,
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
              Liikevaihto: 95000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
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
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25500 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24500 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'source-2024.pdf',
      pageNumber: 2,
      scannedPageCount: 2,
      confidence: 68,
      documentProfile: 'unknown_pdf',
      datasetKinds: ['prices', 'volumes'],
      matchedFields: ['waterUnitPrice', 'soldWaterVolume'],
      financials: {},
      prices: {
        waterUnitPrice: 1.2,
      },
      volumes: {
        soldWaterVolume: 65000,
      },
      sourceLines: [
        { text: 'Vatten brukningsavgift 1,20 eur/m3', pageNumber: 2 },
        { text: 'Sald vattenmangd 65 000 m3', pageNumber: 2 },
      ],
      matches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          datasetKind: 'prices',
          value: 1.2,
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          datasetKind: 'volumes',
          value: 65000,
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
      ],
      candidateMatches: [
        {
          key: 'waterUnitPrice',
          label: 'Water unit price',
          datasetKind: 'prices',
          value: 1.2,
          sourceLine: 'Vatten brukningsavgift 1,20 eur/m3',
          pageNumber: 2,
        },
        {
          key: 'soldWaterVolume',
          label: 'Sold water volume',
          datasetKind: 'volumes',
          value: 65000,
          sourceLine: 'Sald vattenmangd 65 000 m3',
          pageNumber: 2,
        },
      ],
      warnings: ['Generic PDF detection needs manual review before saving.'],
      rawText: 'mock source text',
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Avaa ja tarkista/ }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.documentImportAction'),
      }),
    );

    const documentInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(documentInput).toBeTruthy();
    fireEvent.change(documentInput!, {
      target: {
        files: [new File(['pdf'], 'source-2024.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractDocumentFromPdf).toHaveBeenCalled();
    });

    const confirmButton = screen.getByRole('button', {
      name: localeText('v2Overview.documentImportConfirm'),
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    const keepCurrentInput = document.querySelector(
      '[data-document-import-choice="waterUnitPrice-current"] input',
    ) as HTMLInputElement;
    fireEvent.click(keepCurrentInput);
    await waitFor(() => {
      expect(keepCurrentInput.checked).toBe(true);
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    const keepCurrentVolumeInput = document.querySelector(
      '[data-document-import-choice="soldWaterVolume-current"] input',
    ) as HTMLInputElement;
    fireEvent.click(keepCurrentVolumeInput);
    await waitFor(() => {
      expect(keepCurrentVolumeInput.checked).toBe(true);
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    const applyVolumeInput = document.querySelector(
      '[data-document-import-choice="soldWaterVolume-0"] input',
    ) as HTMLInputElement;
    fireEvent.click(applyVolumeInput);
    await waitFor(() => {
      expect(applyVolumeInput.checked).toBe(true);
    });
    await waitFor(() => {
      expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalled();
    });

    const payload = completeImportYearManuallyV2.mock.calls[
      completeImportYearManuallyV2.mock.calls.length - 1
    ]?.[0] as
      | Record<string, any>
      | undefined;
    expect(payload).toBeTruthy();
    expect(payload?.reason).toBeUndefined();
    expect(payload?.prices).toBeUndefined();
    expect(payload?.volumes).toEqual({
      soldWaterVolume: 65000,
      soldWastewaterVolume: 24500,
    });
    expect(payload?.documentImport).toEqual(
      expect.objectContaining({
        fileName: 'source-2024.pdf',
        pageNumbers: [2],
        matchedFields: ['soldWaterVolume'],
        sourceLines: [
          {
            text: 'Sald vattenmangd 65 000 m3',
            pageNumber: 2,
          },
        ],
      }),
    );
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
      await screen.findByText((text) =>
        text.includes(
          `${localeText('v2Overview.datasetFinancials')}: ${localeText(
            'v2Overview.datasetSourceStatementImport',
            { fileName: 'bokslut-2024.pdf' },
          )}`,
        ),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText((text) =>
        text.includes(
          `${localeText('v2Overview.datasetPrices')}: ${localeText(
            'v2Overview.datasetSourceQdisImport',
          )}`,
        ),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText((text) =>
        text.includes(
          `${localeText('v2Overview.datasetWaterVolume')}: ${localeText(
            'v2Overview.datasetSourceQdisImport',
          )}`,
        ),
      ),
    ).toBeTruthy();

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

    expect(
      await screen.findByText((text) =>
        text.includes(
          localeText('v2Overview.datasetSourceWorkbookImport', {
            fileName: 'kronoby-kva.xlsx',
          }),
        ),
      ),
    ).toBeTruthy();
  });
  });
}

