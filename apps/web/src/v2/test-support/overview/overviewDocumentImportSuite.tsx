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
export function registerOverviewPageV2DocumentImportSuite() {
  describe('OverviewPageV2 document import', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('opens source-document import as a first-class review workflow without a hidden secondary toggle', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await clickReviewGroupYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.documentImportAction'),
      }),
    );

    expect(
      await screen.findByText(
        localeText('v2Overview.documentImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportUploadFile'),
      }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: localeText('v2Overview.documentImportConfirm'),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
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

    await clickReviewGroupYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
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
    expect(
      within(compareRow).getByText(
        localeText('v2Overview.previewAccountingMaterialsLabel'),
      ),
    ).toBeTruthy();
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

    await openYearDecisionWorkspaceYear(2023);
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

  it('keeps unresolved workbook years in the review queue instead of marking every matched year reviewed', async () => {
    completeImportYearManuallyV2.mockImplementation(async (payload: any) => ({
      year: payload.year,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: payload.year === 2022 ? ['financials'] : [],
      missingAfter: payload.year === 2022 ? ['financials'] : [],
      syncReady: payload.year === 2023,
      status: buildOverviewResponse({ workspaceYears: [2022, 2023] }).importStatus,
    }));

    const runSync = vi.fn().mockResolvedValue({});
    const loadOverview = vi.fn().mockResolvedValue(undefined);
    const setReviewedImportedYears = vi.fn();
    const setYearDataCache = vi.fn();

    const result = await submitWorkbookImportWorkflow({
      built: {
        payloads: [
          { year: 2022, payload: { year: 2022 } as any },
          { year: 2023, payload: { year: 2023 } as any },
        ],
        matchedYears: [2022, 2023],
        yearsToSync: [2022, 2023],
      },
      syncAfterSave: true,
      reviewStatusRows: [
        {
          year: 2022,
          setupStatus: 'needs_attention',
          missingRequirements: ['financials'],
        },
        {
          year: 2023,
          setupStatus: 'ready_for_review',
          missingRequirements: [],
        },
      ],
      reviewStorageOrgId: '1234567-8',
      confirmedImportedYears: [2022, 2023],
      cardEditContext: 'step3',
      baselineReady: false,
      runSync,
      loadOverview,
      setReviewedImportedYears,
      setYearDataCache,
    });

    expect(result.syncedYears).toEqual([2023]);
    expect(result.nextQueueRow?.year).toBe(2022);
    expect(result.shouldCloseInlineReview).toBe(false);
    expect(runSync).toHaveBeenCalledWith([2023]);
    expect(loadOverview).not.toHaveBeenCalled();
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
    extractDocumentFromPdf.mockResolvedValue({
      fileName: 'bokslut-2024.pdf',
      pageNumber: 4,
      scannedPageCount: 5,
      confidence: 98,
      documentProfile: 'statement_pdf',
      datasetKinds: ['financials'],
      matchedFields: [
        'liikevaihto',
        'henkilostokulut',
        'poistot',
        'rahoitustuototJaKulut',
        'tilikaudenYliJaama',
      ],
      financials: {
        liikevaihto: 786930.85,
        henkilostokulut: 235498.71,
        poistot: 186904.08,
        rahoitustuototJaKulut: -10225.3,
        tilikaudenYliJaama: 3691.35,
      },
      prices: {},
      volumes: {},
      sourceLines: [
        { text: 'OMSATTNING 786 930,85 809 973,89', pageNumber: 4 },
        {
          text: 'FINANSIELLA INTAKTER OCH KOSTNADER -10 225,30 -11 016,33',
          pageNumber: 4,
        },
      ],
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
      (await screen.findAllByRole('button', { name: /Avaa ja tarkista/ }))[0]!,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.documentImportAction'),
      }),
    );

    const fileInput = document.querySelector(
      '[data-import-kind="document"]',
    ) as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['pdf'], 'bokslut-2024.pdf', { type: 'application/pdf' })],
      },
    });

    await waitFor(() => {
      expect(extractDocumentFromPdf).toHaveBeenCalled();
    });
    expect((await screen.findAllByText('bokslut-2024.pdf')).length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByText(
        localeText('v2Overview.documentImportWorkflowTitle', { year: 2024 }),
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/OMSATTNING 786 930,85 809 973,89/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /FINANSIELLA INTAKTER OCH KOSTNADER -10 225,30 -11 016,33/,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportReplaceFile'),
      }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: localeText('v2Overview.documentImportConfirmAndSync'),
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportConfirmAndSync'),
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
          documentImport: expect.objectContaining({
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
            documentProfile: 'statement_pdf',
            datasetKinds: ['financials'],
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(syncImportV2).toHaveBeenCalledWith([2024]);
    });
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: `${localeText('v2Overview.workbookImportAction')} 2024`,
      }),
    ).toBeNull();
  });
  });
}


