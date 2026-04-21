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
export function registerOverviewWorkspaceHandoffDetailsSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
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

  it('advances from explicit no-change approval to baseline creation when continue is pressed again', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Jatka' }));

    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeNull();
  });

  it('keeps the ready-to-baseline review footer to one summary line plus CTA', async () => {
    seedReviewedYears([2024]);
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[0],
            vuosi: 2024,
            baselineReady: true,
            baselineMissingRequirements: [],
            baselineWarnings: [],
            warnings: [],
          },
        ],
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

    expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();

    const reviewActions = document.querySelector('.v2-overview-review-actions');
    expect(reviewActions).toBeTruthy();
    expect(reviewActions!.className).toContain('compact');
    expect(reviewActions!.querySelectorAll('h4')).toHaveLength(0);
    expect(reviewActions!.querySelectorAll('p.v2-muted')).toHaveLength(1);
  });

  it('keeps the ready-only review workspace collapsed until a year is explicitly opened', async () => {
    seedReviewedYears([2024]);
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[0],
            vuosi: 2024,
            baselineReady: true,
            baselineMissingRequirements: [],
            baselineWarnings: [],
            warnings: [],
          },
        ],
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

    expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();
    expect(
      document.querySelector('[data-review-workspace-year="2024"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-review-workspace-toggle="2024"]'),
    ).toBeNull();

    await clickReviewGroupYear(2024);

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });
    expect(
      document.querySelector('[data-review-workspace-toggle="2024"]'),
    ).toBeTruthy();
  });

  it('routes review continue straight to baseline creation when the only visible year is already reviewed', async () => {
    seedReviewedYears([2024]);
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[0],
            vuosi: 2024,
            baselineReady: true,
            baselineMissingRequirements: [],
            baselineWarnings: ['tariffRevenueMismatch'],
            tariffRevenueReason: 'mismatch',
            sourceStatus: 'MIXED',
            warnings: [],
          },
        ],
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

    const continueButton = await screen.findByRole('button', { name: 'Jatka' });
    fireEvent.click(continueButton);

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.wizardQuestionBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeNull();
  });

  it('closes the mounted review editor before advancing to baseline creation from the reviewed-only handoff', async () => {
    seedReviewedYears([2024]);
    listForecastScenariosV2.mockResolvedValue([]);
    listReportsV2.mockResolvedValue([]);
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[0],
            vuosi: 2024,
            baselineReady: true,
            baselineMissingRequirements: [],
            baselineWarnings: ['tariffRevenueMismatch'],
            tariffRevenueReason: 'mismatch',
            sourceStatus: 'MIXED',
            warnings: [],
          },
        ],
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Jatka' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.wizardQuestionBaseline'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.createPlanningBaseline'),
      }),
    ).toBeTruthy();
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
    await screen.findByRole('button', {
      name: localeText('v2Overview.createPlanningBaseline'),
    });
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.keepYearInPlan'),
      }),
    ).toBeNull();
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

  it('keeps the year-decision modal on a single source-document upload surface', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [buildOverviewResponse().importStatus.years[0]],
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
      await screen.findByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2024`,
      }),
    );
    expect(
      screen.getAllByRole('button', {
        name: localeText('v2Overview.documentImportUploadFile'),
      }),
    ).toHaveLength(1);
    expect(
      screen.queryByText(localeText('v2Overview.yearActionsTitle')),
    ).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.yearActionsFixBody')),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportConfirm'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.documentImportConfirmAndSync'),
      }),
    ).toBeTruthy();
  });

  it('uses baseline-economics wording instead of bokslut wording in blocked readiness copy', async () => {
    setActiveLocale('sv');
    const missingFinancialsYear = {
      ...buildOverviewResponse().importStatus.years[0],
      vuosi: 2024,
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      baselineReady: false,
      baselineMissingRequirements: ['financialBaseline'],
      baselineWarnings: [],
      warnings: ['missing_financials'],
      sourceStatus: 'INCOMPLETE',
      sourceBreakdown: {
        veetiDataTypes: ['taksa', 'volume_vesi'],
        manualDataTypes: [],
      },
    };

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [missingFinancialsYear],
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

    expect(
      (await screen.findAllByText(localeText('v2Overview.datasetFinancials'))).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Bokslut')).toBeNull();
    expect(screen.queryByText('Bokslutsdata saknas.')).toBeNull();
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
    const keepYearButton = screen.queryByRole('button', {
      name: localeText('v2Overview.keepYearInPlan'),
    });
    if (keepYearButton) {
      fireEvent.click(keepYearButton);
    }

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

    const baselinePlanningDisclosure = document.querySelector(
      '.v2-overview-planning-shell-toggle',
    ) as HTMLDetailsElement | null;
    expect(baselinePlanningDisclosure).toBeTruthy();
    fireEvent.click(
      baselinePlanningDisclosure!.querySelector('summary') as HTMLElement,
    );
    expect(baselinePlanningDisclosure?.open).toBe(true);

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
    const handoffPlanningDisclosure = document.querySelector(
      '.v2-overview-planning-shell-toggle',
    ) as HTMLDetailsElement | null;
    expect(
      handoffPlanningDisclosure == null || handoffPlanningDisclosure.open === false,
    ).toBe(true);
    expect(
      screen.queryByText(localeText('v2Overview.wizardSummaryBaselineReady')),
    ).toBeNull();
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

  it('keeps the baseline summary pending while review rows still block baseline creation', async () => {
    const onSetupWizardStateChange = vi.fn();
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: true,
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

    await waitFor(() => {
      expect(getLatestSetupWizardState(onSetupWizardStateChange)?.summary).toMatchObject({
        baselineReady: false,
      });
    });
  });

  it('does not collapse to the baseline handoff when only one imported workspace year is accepted', async () => {
    const onSetupWizardStateChange = vi.fn();
    const years = [
      {
        vuosi: 2025,
        planningRole: 'historical',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        baselineReady: true,
        baselineMissingRequirements: [],
        baselineWarnings: [],
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
        manualEditedAt: '2026-04-18T00:00:00.000Z',
        manualEditedBy: 'tester',
        manualReason: 'manual correction',
        manualProvenance: null,
      },
      {
        vuosi: 2024,
        planningRole: 'historical',
        completeness: {
          tilinpaatos: false,
          taksa: true,
          volume_vesi: false,
          volume_jatevesi: false,
        },
        baselineReady: false,
        baselineMissingRequirements: ['financials', 'volumes'],
        baselineWarnings: [],
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['taksa'],
          manualDataTypes: [],
        },
        warnings: ['missing_financials', 'missing_volumes'],
        datasetCounts: {
          taksa: 2,
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
          tilinpaatos: false,
          taksa: true,
          volume_vesi: false,
          volume_jatevesi: false,
        },
        baselineReady: false,
        baselineMissingRequirements: ['financials', 'volumes'],
        baselineWarnings: [],
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['taksa'],
          manualDataTypes: [],
        },
        warnings: ['missing_financials', 'missing_volumes'],
        datasetCounts: {
          taksa: 2,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [2025, 2024, 2023],
        planningBaselineYears: [2025],
        years,
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        canCreateScenario: true,
        baselineYears: [
          {
            year: 2025,
            quality: 'complete',
            sourceStatus: 'MIXED',
            sourceBreakdown: {
              veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: ['tilinpaatos'],
            },
          },
        ],
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

    await waitFor(() => {
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
        currentStep: 3,
        summary: {
          baselineReady: false,
        },
      });
    });

    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.openForecastHandoff'),
      }),
    ).toBeNull();
    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.wizardQuestionReviewYears'),
      }),
    ).toBeTruthy();
    expect(document.querySelector('[data-review-group-year$="-2024"]')).toBeTruthy();
    expect(document.querySelector('[data-review-group-year$="-2023"]')).toBeTruthy();
  });

  it('shows imported-year summary counts only for workspace years even when extra available VEETI years remain incomplete', async () => {
    const onSetupWizardStateChange = vi.fn();
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
        onSetupWizardStateChange={onSetupWizardStateChange}
      />,
    );

    await waitFor(() => {
      expect(getLatestSetupWizardState(onSetupWizardStateChange)).toMatchObject({
        currentStep: 3,
        summary: {
          importedYearCount: 1,
        },
      });
    });
    expect(document.querySelector('[data-review-group-year$="-2024"]')).toBeTruthy();
  });

  it('keeps the forecast handoff as the only mounted primary step once baseline work is complete', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
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
      (await screen.findByRole('button', { name: 'Avaa Ennuste' })).className,
    ).toContain('v2-btn-primary');
    expect(
      screen.queryByText(
        localeText('v2Overview.wizardProgress', { step: 5, total: 5 }),
      ),
    ).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.wizardSummaryTitle')),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Jatka' })).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
    ).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getAllByText(localeText('v2Overview.baselineIncludedYears')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(localeText('v2Overview.previewAccountingRevenueLabel'))
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        localeText('v2Overview.previewAccountingDepreciationLabel'),
      ).length,
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
    expect(document.querySelector('.v2-overview-handoff-actions-card')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Avaa Ennuste' })).toHaveLength(1);
  });

  it('keeps the Forecast handoff ahead of the Vesinvest workspace once baseline work is complete', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
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

    expect(await screen.findByRole('button', { name: 'Avaa Ennuste' })).toBeTruthy();

    const handoffHeading = screen.getByRole('heading', { name: 'Mukana olevat vuodet' });
    const handoffCard = handoffHeading.closest('[class*="v2-overview-handoff"]');
    const planningPanel = screen.getByTestId('vesinvest-panel');

    expect(handoffCard).toBeTruthy();
    expect(planningPanel).toBeTruthy();
    expect(
      handoffCard!.compareDocumentPosition(planningPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('collapses the demoted Vesinvest workspace during the forecast handoff', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
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

    expect(await screen.findByRole('button', { name: 'Avaa Ennuste' })).toBeTruthy();

    const planningDisclosure = document.querySelector(
      '.v2-overview-planning-shell-toggle',
    ) as HTMLDetailsElement | null;

    expect(planningDisclosure).toBeTruthy();
    expect(planningDisclosure?.open).toBe(false);

    fireEvent.click(planningDisclosure!.querySelector('summary') as HTMLElement);

    expect(planningDisclosure?.open).toBe(true);
  });

  it('keeps the collapsed Vesinvest disclosure open after the saved-fee-path focus target is consumed', async () => {
    const baselineReadyYear = buildOverviewResponse().importStatus.years[0];
    const onOverviewFocusTargetConsumed = vi.fn();
    const focusTarget = { kind: 'saved_fee_path' as const, planId: 'plan-selected' };

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
        activePlan: {
          id: 'plan-selected',
          selectedScenarioId: 'scenario-1',
          pricingStatus: 'verified',
          baselineStatus: 'verified',
        },
        selectedPlan: {
          id: 'plan-selected',
          selectedScenarioId: 'scenario-1',
          pricingStatus: 'verified',
          baselineStatus: 'verified',
        },
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

    const { rerender } = render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
        overviewFocusTarget={focusTarget}
        onOverviewFocusTargetConsumed={onOverviewFocusTargetConsumed}
      />,
    );

    await waitFor(() => {
      expect(onOverviewFocusTargetConsumed).toHaveBeenCalledTimes(1);
    });

    const planningDisclosure = document.querySelector(
      '.v2-overview-planning-shell-toggle',
    ) as HTMLDetailsElement | null;

    expect(planningDisclosure).toBeTruthy();
    expect(planningDisclosure?.open).toBe(true);

    rerender(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
        overviewFocusTarget={null}
        onOverviewFocusTargetConsumed={onOverviewFocusTargetConsumed}
      />,
    );

    expect(
      (
        document.querySelector(
          '.v2-overview-planning-shell-toggle',
        ) as HTMLDetailsElement | null
      )?.open,
    ).toBe(true);
    expect(onOverviewFocusTargetConsumed).toHaveBeenCalledTimes(1);
  });

  it('promotes a stale baseline-creation continue step to the forecast handoff when baseline truth is already ready', () => {
    const { result } = renderHook(() =>
      useOverviewSetupState({
        overview: buildOverviewResponse({
          workspaceYears: [2023],
          planningBaselineYears: [2023],
          years: [
            {
              ...buildOverviewResponse().importStatus.years[1],
              vuosi: 2023,
              baselineReady: true,
              baselineMissingRequirements: [],
              baselineWarnings: [],
            },
          ],
        }),
        yearDataCache: {},
        selectedYears: [2023],
        excludedYearOverrides: {},
        importedWorkspaceYears: [2023],
        backendAcceptedPlanningYears: [2023],
        reviewedImportedYears: [2023],
        setReviewedImportedYears: vi.fn(),
        manualPatchYear: null,
        cardEditYear: null,
        cardEditContext: null,
        reviewContinueStep: 5,
        baselineReady: true,
        t: translate as any,
      }),
    );

    expect(result.current.wizardDisplayStep).toBe(6);
    expect(result.current.displaySetupWizardState?.activeStep).toBe(6);
  });
  });
}

