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
export function registerOverviewWorkspacePrefetchSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
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

  it('does not strand accepted baseline years in step 3 when baseline truth already exists', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    listForecastScenariosV2.mockResolvedValueOnce([
      {
        id: 'scenario-1',
        nimi: 'Scenario 1',
        name: 'Scenario 1',
        onOletus: true,
        baselineYear: 2024,
        talousarvioId: 'budget-2024',
        horizonYears: 20,
        updatedAt: '2026-03-08T10:00:00.000Z',
        computedYears: 20,
      } as any,
    ]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        planningBaselineYears: [2024],
        years: [baselineReadyYear],
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
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
            volumes: {
              dataType: 'volume_vesi+volume_jatevesi',
              source: 'veeti',
            },
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
      await screen.findByRole('button', {
        name: localeText('v2Overview.openForecast'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        localeText('v2Overview.wizardProgress', { step: 5, total: 5 }),
      ),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
    ).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.wizardSummaryTitle')),
    ).toBeNull();
    expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
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
    expect(getImportYearDataV2.mock.calls.map((call: unknown[]) => call[0] as number)).toEqual([
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
    expect(getImportYearDataV2.mock.calls.map((call: unknown[]) => call[0] as number)).toEqual([
      2024,
      2023,
      2022,
    ]);
  });

  it('keeps step-2 prefetching inside imported workspace years when future VEETI years also exist', () => {
    expect(
      getPreviewPrefetchYears({
        cardEditYear: null,
        manualPatchYear: null,
        connected: true,
        importedWorkspaceYears: [2024, 2023, 2022],
        wizardDisplayStep: 2,
        selectedYears: [2026, 2025, 2024],
        selectableImportYearRows: [
          { vuosi: 2026 },
          { vuosi: 2025 },
          { vuosi: 2024 },
          { vuosi: 2023 },
          { vuosi: 2022 },
        ],
        reviewStatusRows: [],
      }),
    ).toEqual([2024, 2023, 2022]);
  });

  it('prefetches reviewed years again when the wizard returns to the baseline-ready verification desk', () => {
    expect(
      getPreviewPrefetchYears({
        cardEditYear: null,
        manualPatchYear: null,
        connected: true,
        importedWorkspaceYears: [2026, 2025, 2024, 2023, 2022],
        wizardDisplayStep: 6,
        selectedYears: [],
        selectableImportYearRows: [],
        reviewStatusRows: [
          { year: 2026, setupStatus: 'reviewed' },
          { year: 2025, setupStatus: 'reviewed' },
          { year: 2024, setupStatus: 'reviewed' },
          { year: 2023, setupStatus: 'reviewed' },
          { year: 2022, setupStatus: 'reviewed' },
        ],
      }),
    ).toEqual([2026, 2025, 2024, 2023, 2022]);
  });

  it('prefetches accepted planning baseline years on the handoff even when review rows no longer contain them', () => {
    expect(
      getPreviewPrefetchYears({
        cardEditYear: null,
        manualPatchYear: null,
        connected: true,
        importedWorkspaceYears: [2016, 2015],
        wizardDisplayStep: 6,
        selectedYears: [],
        selectableImportYearRows: [],
        reviewStatusRows: [
          { year: 2016, setupStatus: 'reviewed' },
          { year: 2015, setupStatus: 'reviewed' },
        ],
        acceptedPlanningYears: [2022],
      }),
    ).toEqual([2016, 2015, 2022]);
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

    expect(
      await screen.findByText((text) =>
        text.includes(localeText('v2Overview.datasetSourceStatementWorkbookMixed')),
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
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

  it('prefers manual fixed-revenue provenance over summary fallback labels after review save', () => {
    const labels = getExactEditedFieldLabels({
      t: translate as any,
      yearData: undefined,
      changedSummaryKeys: ['materialsCosts'],
      manualFinancialFieldSources: [{ sourceField: 'PerusmaksuYhteensa' }],
    });

    expect(labels).toEqual([localeText('v2Overview.manualFinancialFixedRevenue')]);
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
      screen.getAllByText(localeText('v2Overview.manualFinancialRevenue')).length,
    ).toBeGreaterThan(0);
    await clickReviewGroupYear(2024);
    expect(
      document.querySelector('[data-review-workspace-year="2024"]'),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.manualFinancialDepreciation'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        'Vuosi näyttää valmiilta. Tarkista vertailu ja hyväksy vuosi suunnittelupohjaan.',
      ),
    ).toBeNull();
  });
  });
}






