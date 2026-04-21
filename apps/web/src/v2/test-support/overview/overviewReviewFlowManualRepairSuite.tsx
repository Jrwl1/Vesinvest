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
export function registerOverviewReviewFlowManualRepairSuite() {
  describe('OverviewPageV2 review flow', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('updates reviewed counts immediately after approving a ready year while reporting the rendered review step until a plan exists', async () => {
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

    await clickReviewGroupYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    );

    await waitFor(() => {
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
        currentStep: 3,
        recommendedStep: 4,
        activeStep: 3,
        selectedProblemYear: null,
        transitions: {
          reviewContinue: 4,
          selectProblemYear: 4,
        },
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

  it('preserves the selected problem year in the shell callback when the rendered flow enters step 4', async () => {
    const onSetupWizardStateChange = vi.fn();
    const currentYear = new Date().getFullYear();
    const templateYear = buildOverviewResponse().importStatus.years[0];
    const initialOverview = buildOverviewResponse({
      workspaceYears: [],
      years: [
        {
          ...templateYear,
          vuosi: currentYear,
          planningRole: 'current_year_estimate',
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: true,
            volume_jatevesi: false,
          },
          baselineReady: false,
          baselineMissingRequirements: ['prices'],
          baselineWarnings: [],
          sourceStatus: 'VEETI',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos', 'volume_vesi'],
            manualDataTypes: [],
          },
          warnings: ['missing_prices'],
          manualEditedAt: null,
          manualEditedBy: null,
          manualReason: null,
          manualProvenance: null,
        },
      ],
    });
    const importedOverview = buildOverviewResponse({
      workspaceYears: [currentYear],
      years: initialOverview.importStatus.years,
    });
    getOverviewV2.mockResolvedValueOnce(initialOverview).mockResolvedValue(
      importedOverview,
    );
    importYearsV2.mockResolvedValueOnce({
      selectedYears: [currentYear],
      importedYears: [currentYear],
      skippedYears: [],
      sync: {
        linked: {
          orgId: 'org-1',
          veetiId: 1535,
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
        },
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [currentYear],
        snapshotUpserts: 1,
      },
      status: importedOverview.importStatus,
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
        onSetupWizardStateChange={onSetupWizardStateChange}
      />,
    );

    await openCurrentYearEstimateLane();
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.currentYearEstimateAction'),
      }),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );

    await waitFor(() => {
      expect(importYearsV2).toHaveBeenCalledWith([currentYear]);
    });
    expect(
      await screen.findByText(localeText('v2Overview.wizardQuestionFixYear')),
    ).toBeTruthy();

    await waitFor(() => {
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
        currentStep: 4,
        recommendedStep: 4,
        activeStep: 4,
        selectedProblemYear: currentYear,
        transitions: {
          reviewContinue: 4,
          selectProblemYear: 4,
        },
      });
    });
  });

  it('keeps Continue focused on blocked years after a ready year is approved and before baseline creation', async () => {
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

    await clickReviewGroupYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
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
        name: localeText('v2Overview.documentImportAction'),
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
        name: localeText('v2Overview.documentImportAction'),
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

    await clickReviewGroupYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: new RegExp(localeText('v2Overview.openReviewYearButton')),
      }),
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

  it('renders tariff-revenue mismatch wording instead of fixed-revenue-missing wording', async () => {
    const mismatchYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
    };
    const mismatchOverview = buildOverviewResponse({
      workspaceYears: [],
      years: [mismatchYear],
    });
    const mismatchYearData = {
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
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
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 24000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any;

    getOverviewV2.mockResolvedValueOnce(mismatchOverview);
    getImportYearDataV2.mockResolvedValueOnce(mismatchYearData);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      (
        await screen.findAllByText(
          localeText('v2Overview.requirementTariffRevenueMismatch'),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(localeText('v2Overview.requirementTariffRevenue')),
    ).toBeNull();
  });

  it('does not suggest price or volume repair when one complete service pair already makes the year baseline-ready', async () => {
    const singleServiceYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: [],
    };
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [singleServiceYear],
      }),
    );
    getImportYearDataV2.mockResolvedValueOnce({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: [],
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
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
          rawRows: [],
          effectiveRows: [],
          source: 'none',
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

    await screen.findByRole('checkbox', { name: '2024' });
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
  });

  it('treats a tariff mismatch as warning-only after save and sync', async () => {
    const mismatchYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
    };
    const mismatchOverview = buildOverviewResponse({
      workspaceYears: [2024],
      years: [mismatchYear],
    });
    const mismatchYearData = {
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
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
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 24000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any;

    getOverviewV2.mockResolvedValue(mismatchOverview);
    getImportYearDataV2.mockImplementation(async () => mismatchYearData);
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['tariffRevenue'],
      missingAfter: ['tariffRevenue'],
      syncReady: true,
      baselineReady: true,
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
      status: mismatchOverview.importStatus,
    } as any);

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
        name: localeText('v2Overview.manualPatchSaveAndSync'),
      }),
    );

    expect(
      (
        await screen.findAllByText(
          localeText('v2Overview.requirementTariffRevenueMismatch'),
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        localeText('v2Overview.manualPatchSavedNeedsReview', {
          year: 2024,
          reason: localeText('v2Overview.yearReasonTariffRevenueMismatch'),
        }),
      ),
    ).toBeNull();
  });

  it('keeps the existing baseline-progress success message when the saved year becomes sync-ready', async () => {
    const readyYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      tariffRevenueReason: null,
    };
    const readyOverview = buildOverviewResponse({
      workspaceYears: [2024],
      years: [readyYear],
    });
    const readyYearData = {
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      tariffRevenueReason: null,
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 148900,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 148900,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: false,
          overrideMeta: null,
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
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 24000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any;

    getOverviewV2.mockResolvedValue(readyOverview);
    getImportYearDataV2.mockImplementation(async () => readyYearData);
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['tariffRevenue'],
      missingAfter: [],
      syncReady: true,
      tariffRevenueReason: null,
      status: readyOverview.importStatus,
    } as any);

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

    expect(
      await screen.findByText(localeText('v2Overview.manualPatchSaved', { year: 2024 })),
    ).toBeTruthy();
  });

  it('keeps tariff-mismatch years on the baseline path when Continue sees them as warning-only review rows', async () => {
    const mismatchYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      tariffRevenueReason: 'mismatch',
    };
    const mismatchOverview = buildOverviewResponse({
      workspaceYears: [2024],
      years: [mismatchYear],
    });
    const mismatchYearData = {
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      tariffRevenueReason: 'mismatch',
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
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
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 24000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    } as any;

    getOverviewV2.mockResolvedValueOnce(mismatchOverview);
    getImportYearDataV2.mockResolvedValueOnce(mismatchYearData);

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
      screen.getByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }),
    );

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  });
}

