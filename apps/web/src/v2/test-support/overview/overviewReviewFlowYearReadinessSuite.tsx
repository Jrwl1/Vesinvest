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
export function registerOverviewReviewFlowYearReadinessSuite() {
  describe('OverviewPageV2 review flow', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('uses fetched year-detail completeness when imported review rows start from stale overview flags', async () => {
    const staleImportedYear = {
      ...buildOverviewResponse().importStatus.years[0],
      completeness: {
        tilinpaatos: false,
        taksa: false,
        volume_vesi: false,
        volume_jatevesi: false,
      },
      sourceStatus: 'INCOMPLETE',
      warnings: ['missing_financials', 'missing_prices', 'missing_volumes'],
    };

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [staleImportedYear],
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const focusedYear = await findReviewWorkspaceYear(2024);
    expect(focusedYear.className).toContain('ready_for_review');
    expect(
      document.querySelector('.v2-overview-year-workspace-year.needs_attention'),
    ).toBeNull();
    expect(
      within(focusedYear).getByRole('button', {
        name: `${localeText('v2Overview.openReviewYearButton')} 2024`,
      }),
    ).toBeTruthy();
  });

  it('surfaces blocked-year status inside the focused year review list', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const focusedYear = await findReviewWorkspaceYear(2023);
    expect(focusedYear.className).toContain('needs_attention');
    expect(within(focusedYear).getByText(/Taksatiedot/)).toBeTruthy();
    expect(
      within(focusedYear).getByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2023`,
      }),
    ).toBeTruthy();
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

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.reviewBucketRepairTitle'),
      }),
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

    expect((await screen.findAllByText('2022')).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(localeText('v2Overview.previewVeetiMissingValue')),
    ).toBeNull();
    await waitFor(() => {
      expect(screen.getAllByText(/0 EUR/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/0 m3/).length).toBeGreaterThan(0);
    });
  });

  it('keeps loaded VEETI summary values visible when only the baseline financial requirement is missing', async () => {
    const baselineGapYear = {
      ...buildOverviewResponse().importStatus.years[0],
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: false,
      baselineMissingRequirements: ['financialBaseline'],
      baselineWarnings: [],
      tariffRevenueReason: 'missing_fixed_revenue',
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
        workspaceYears: [2024],
        years: [baselineGapYear],
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: false,
        baselineYears: [],
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
      baselineReady: false,
      baselineMissingRequirements: ['financialBaseline'],
      baselineWarnings: [],
      tariffRevenueReason: 'missing_fixed_revenue',
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 850000,
              AineetJaPalvelut: 180000,
              Henkilostokulut: 130000,
              Poistot: 90000,
              LiiketoiminnanMuutKulut: 110000,
              TilikaudenYliJaama: 40000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 850000,
              AineetJaPalvelut: 180000,
              Henkilostokulut: 130000,
              Poistot: 90000,
              LiiketoiminnanMuutKulut: 110000,
              TilikaudenYliJaama: 40000,
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
            { Tyyppi_Id: 1, Kayttomaksu: 1.25 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.5 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 1.25 },
            { Tyyppi_Id: 2, Kayttomaksu: 2.5 },
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
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await openYearDecisionWorkspaceYear(2024);
    const revenuePreview = await waitFor(() =>
      screen
        .getAllByDisplayValue('850000')[0]
        ?.closest('.v2-overview-year-workspace-cell'),
    );
    expect(revenuePreview).toBeTruthy();
    expect(
      within(revenuePreview as HTMLElement).queryByText(
        localeText('v2Overview.previewVeetiMissingValue'),
      ),
    ).toBeNull();
    expect(revenuePreview?.textContent).toContain('EUR');
    expect(
      screen.queryByText(localeText('v2Overview.previewVeetiMissingValue')),
    ).toBeNull();
  });

  it('keeps card actions in the chosen user language instead of leaking Finnish labels', async () => {
    setActiveLocale('en');

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
    setActiveLocale('sv');

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
    expect(
      getPrimaryButtons().some(
        (button) =>
          button.textContent?.replace(/\s+/g, ' ').trim() === 'Jatka',
      ),
    ).toBe(true);
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

  it('reports the rendered review step to the shell after VEETI is linked and keeps baseline creation aligned when no Vesinvest plan exists yet', async () => {
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

    expect(document.querySelector('[data-review-group-year="good_to_go-2024"]')).toBeTruthy();
    expect(document.querySelector('[data-review-group-year="excluded-2023"]')).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      `${localeText('v2Overview.wizardSummaryImportedYears')}: 2024, 2023`,
    );

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
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
          currentStep: 5,
          recommendedStep: 5,
          activeStep: 5,
          selectedProblemYear: null,
          transitions: {
            reviewContinue: 5,
            selectProblemYear: 4,
          },
        });
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

  it('reports baseline creation to the shell when a technically ready year advances there before a Vesinvest plan exists', async () => {
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
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
        currentStep: 5,
        recommendedStep: 5,
        activeStep: 5,
        transitions: {
          reviewContinue: 5,
          selectProblemYear: 4,
        },
        summary: {
          reviewedYearCount: 1,
          pendingReviewCount: 0,
          blockedYearCount: 0,
        },
      });
    });
  });
  });
}

