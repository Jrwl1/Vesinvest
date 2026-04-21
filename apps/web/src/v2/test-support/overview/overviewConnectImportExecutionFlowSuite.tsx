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
export function registerOverviewConnectImportExecutionFlowSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('uses the import-years contract for the step-2 CTA instead of sync', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));
    importYearsV2.mockResolvedValueOnce({
      selectedYears: [2024, 2023],
      importedYears: [2024, 2023],
      skippedYears: [],
      sync: {
        linked: { orgId: 'org-1', veetiId: 1535, nimi: 'Water Utility', ytunnus: '1234567-8' },
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [2024, 2023],
        snapshotUpserts: 4,
      },
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
    });

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
      expect(importYearsV2).toHaveBeenCalledWith([2024, 2023]);
    });
    expect(syncImportV2).not.toHaveBeenCalled();
  });

  it('defaults blocked historical years into the import selection instead of leaving only the estimate path', async () => {
    const currentYear = new Date().getFullYear();
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            vuosi: 2024,
            planningRole: 'historical',
            completeness: {
              tilinpaatos: true,
              taksa: false,
              tariff_revenue: false,
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
          {
            vuosi: 2023,
            planningRole: 'historical',
            completeness: {
              tilinpaatos: true,
              taksa: false,
              tariff_revenue: false,
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
          {
            vuosi: currentYear,
            planningRole: 'current_year_estimate',
            completeness: {
              tilinpaatos: true,
              taksa: false,
              tariff_revenue: false,
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
      }),
    );
    importYearsV2.mockResolvedValueOnce({
      selectedYears: [2024, 2023],
      importedYears: [2024, 2023],
      skippedYears: [],
      sync: {
        linked: {
          orgId: 'org-1',
          veetiId: 1535,
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
        },
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [2024, 2023],
        snapshotUpserts: 2,
      },
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
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByText(`${localeText('v2Overview.selectedYearsLabel')}: 2`),
    ).toBeTruthy();

    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.importYearsButton'),
      }),
    );

    await waitFor(() => {
      expect(importYearsV2).toHaveBeenCalledWith([2024, 2023]);
    });
    expect(importYearsV2).not.toHaveBeenCalledWith([currentYear]);
  });

  it('renders salvageability buckets on step 2 while keeping trust warnings on the cards', async () => {
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
        name: localeText('v2Overview.reviewBucketRepairTitle'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', {
        name: localeText('v2Overview.reviewBucketReadyTitle'),
      }),
    ).toBeNull();
    expect(screen.getAllByText(localeText('v2Overview.wizardQuestionImportYears'))).toHaveLength(
      1,
    );
    expect(
      screen.getByText(localeText('v2Overview.wizardBodyImportYears')),
    ).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.wizardSummarySubtitle')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('checkbox', { name: '2024' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '2023' })).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Overview.trustLargeDiscrepancy')),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('Tilinpäätös: 1');
    const year2024Card = screen
      .getByRole('checkbox', { name: '2024' })
      .closest('.v2-year-readiness-row') as HTMLElement;
    const statementSource = within(year2024Card).getByText(
      new RegExp(`${localeText('v2Overview.datasetFinancials')}: Tilinpäätösimportti`, 'i'),
    );
    const priceSource = within(year2024Card).getByText(
      /Yksikköhinnat: Manuaalinen/i,
    );
    const technicalDetails = statementSource.closest('details') as HTMLDetailsElement;
    expect(technicalDetails.hasAttribute('open')).toBe(false);
    expect(priceSource.closest('details')).toBe(technicalDetails);
    fireEvent.click(
      within(year2024Card).getByText(
        localeText('v2Overview.yearTechnicalDetailsSummary'),
      ),
    );
    expect(technicalDetails.hasAttribute('open')).toBe(true);
    expect(
      document.querySelector('.v2-overview-helper-list.step2-support'),
    ).toBeNull();
    expect(document.querySelector('.v2-overview-workspace-layout')).toBeTruthy();
    expect(document.querySelector('.v2-overview-support-rail.step2-support')).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.reviewBucketRepairTitle')).length,
    ).toBeGreaterThan(0);
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
    expect(document.querySelectorAll('.v2-year-technical-details[open]').length).toBe(1);
    expect(
      screen.queryByText(localeText('v2Overview.previewSecondaryLabel')),
    ).toBeNull();
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
    expect(
      screen.getByRole('button', { name: 'Täydennä manuaalisesti' }),
    ).toBeTruthy();
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

  it('keeps one compact support region through setup steps 2 and 3 and drops the rail shell for the final verification desk', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
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
    const expectNoSupportRail = () => {
      expect(document.querySelector('.v2-overview-workspace-layout')).toBeNull();
      expect(
        document.querySelectorAll(
          '.v2-overview-support-rail, .v2-overview-hero-grid',
        ),
      ).toHaveLength(0);
    };

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Avaa Ennuste' })).toBeTruthy();
    expectNoSupportRail();
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
      await screen.findByRole('heading', {
        name: localeText('v2Overview.reviewBucketReadyTitle'),
      }),
    ).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.trustLooksPlausible'))).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: '2022' })).toBeTruthy();
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingDepreciationLabel'))
        .length,
    ).toBeGreaterThan(0);
  });

  });
}
