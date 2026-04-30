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
import {
  getPreviewPrefetchYears,
  pickDefaultBaselineYears,
} from '../../overviewSelectors';
import { buildImportYearSummaryRows } from '../../yearReview';
import {
  getExactEditedFieldLabels,
  useOverviewSetupState,
} from '../../useOverviewSetupState';
import { useOverviewImportController } from '../../useOverviewImportController';
export function registerOverviewConnectImportSearchSelectionSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

    it('does not treat available years as imported when workspaceYears is empty', async () => {
      const onSetupWizardStateChange = vi.fn();
      getOverviewV2.mockResolvedValueOnce(
        buildOverviewResponse({ workspaceYears: [] }),
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
        expect(
          getLatestSetupWizardState(onSetupWizardStateChange),
        ).toMatchObject({
          currentStep: 2,
          summary: {
            importedYearCount: 0,
          },
        });
      });
      expect(
        await screen.findByText(localeText('v2Overview.selectedYearsLabel')),
      ).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.wizardSummaryImportedYears')),
      ).toBeNull();
      expect(
        screen.queryByText('Tästä vuodesta puuttuu: Price data (taksa).'),
      ).toBeNull();
    });

    it('mounts only the connect surface when the wizard is still at step 1', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
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
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.searchButton'),
        }),
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
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        searchInput.compareDocumentPosition(summaryCard as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('keeps the Vesinvest panel demoted while the user is still choosing import years', async () => {
      getOverviewV2.mockResolvedValueOnce(
        buildOverviewResponse({ workspaceYears: [] }),
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
        await screen.findByText(
          localeText('v2Overview.wizardQuestionImportYears'),
        ),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
    });

    it('keeps Overview free of the embedded planning panel when back-navigation returns a connected setup to step 1', async () => {
      getOverviewV2.mockResolvedValue(
        buildOverviewResponse({ workspaceYears: [2024] }),
      );
      getPlanningContextV2.mockResolvedValue(
        buildPlanningContextResponse({ activePlan: {} }),
      );

      const { rerender } = render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
          setupBackSignal={0}
        />,
      );

      expect(
        await screen.findByText(localeText('v2Overview.wizardQuestionReviewYears')),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();

      rerender(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
          setupBackSignal={1}
        />,
      );

      expect(
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
    });

    it('keeps explicit search fallback for short queries below the auto-suggest threshold', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
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
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: 'Wa' } },
      );
      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.searchButton'),
        }),
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledWith('Wa', 25);
      });
    });

    it('auto-suggests business-id-like input and auto-selects an exact match', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
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
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: '1234567-8' } },
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledWith(
          '1234567-8',
          25,
        );
      });
      expect(
        await screen.findByRole('button', { name: /Water Utility/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.searchButton'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByText(localeText('v2Overview.resultSelected')),
      ).toBeTruthy();
      expect(connectImportOrganizationV2).not.toHaveBeenCalled();
    });

    it('auto-suggests an exact VEETI id lookup without connecting before a row is chosen', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
        }),
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
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: '1535' } },
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledWith('1535', 25);
      });
      expect(
        await screen.findByRole('button', { name: /Water Utility/i }),
      ).toBeTruthy();
      expect(
        screen.getByText(localeText('v2Overview.resultSelected')),
      ).toBeTruthy();
      expect(connectImportOrganizationV2).not.toHaveBeenCalled();
    });

    it('does not retrigger the same debounced search after exact-match auto-selection settles', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
        }),
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
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: '1535' } },
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledTimes(1);
      });
      expect(
        await screen.findByText(localeText('v2Overview.resultSelected')),
      ).toBeTruthy();

      await new Promise((resolve) => window.setTimeout(resolve, 220));

      expect(searchImportOrganizationsV2).toHaveBeenCalledTimes(1);
    }, 10000);

    it('moves straight into the plan step before the slower background refresh finishes after company selection', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      const pendingRefresh = new Promise<any>(() => undefined);
      let hasPlan = false;

      getOverviewV2.mockReset();
      getOverviewV2
        .mockResolvedValueOnce(disconnectedOverview)
        .mockReturnValueOnce(pendingRefresh);
      getPlanningContextV2.mockImplementation(async () =>
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
          activePlan: hasPlan ? { id: 'plan-1' } : null,
        }),
      );
      searchImportOrganizationsV2.mockResolvedValue([
        {
          Id: 1535,
          Nimi: 'Water Utility',
          YTunnus: '1234567-8',
          Kunta: 'Helsinki',
        },
      ] as any);
      connectImportOrganizationV2.mockResolvedValue({
        linked: {
          orgId: 'org-1',
          veetiId: 1535,
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
        },
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
        availableYears: buildOverviewResponse({ workspaceYears: [] })
          .importStatus.years,
        excludedYears: [],
        workspaceYears: [],
      } as any);
      createVesinvestPlanV2.mockImplementation(async () => {
        hasPlan = true;
        return { id: 'plan-1' } as any;
      });

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      fireEvent.change(
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: 'Water' } },
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Water Utility/i }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: localeText('v2Overview.connectButton'),
        }),
      );

      await waitFor(() => {
        expect(connectImportOrganizationV2).toHaveBeenCalledWith(1535);
        expect(createVesinvestPlanV2).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [] }),
        );
      });
      expect(
        await screen.findByText(localeText('v2Overview.wizardQuestionImportYears')),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        screen.queryByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeNull();
    });

    it('auto-creates the first Vesinvest plan after company selection', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      let hasPlan = false;

      getOverviewV2.mockReset();
      getOverviewV2
        .mockResolvedValueOnce(disconnectedOverview)
        .mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
      getPlanningContextV2.mockImplementation(async () =>
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
          activePlan: hasPlan
            ? {
                id: 'plan-1',
                projectCount: 0,
                totalInvestmentAmount: 0,
              }
            : null,
        }),
      );
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
        years: buildOverviewResponse({ workspaceYears: [] }).importStatus.years,
        availableYears: buildOverviewResponse({ workspaceYears: [] })
          .importStatus.years,
        excludedYears: [],
        workspaceYears: [],
      } as any);
      createVesinvestPlanV2.mockImplementation(async () => {
        hasPlan = true;
        return { id: 'plan-1' } as any;
      });

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      fireEvent.change(
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: 'Water' } },
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Water Utility/i }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: localeText('v2Overview.connectButton'),
        }),
      );

      await waitFor(() => {
        expect(searchImportOrganizationsV2).toHaveBeenCalledWith('Water', 25);
        expect(connectImportOrganizationV2).toHaveBeenCalledWith(1535);
        expect(createVesinvestPlanV2).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [] }),
        );
        expect(getImportStatusV2).toHaveBeenCalled();
      });
      expect(window.localStorage.getItem('va_language')).toBe('sv');
      expect(window.localStorage.getItem('va_language_source')).toBe(
        'org_default',
      );

      expect(
        (
          await screen.findAllByText(
            localeText('v2Overview.wizardProgress', { step: 2, total: 5 }),
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        screen.queryByText(/Vesinvest.*(luotu|skapad|created)/i),
      ).toBeNull();
      expect(
        screen.queryByText(/Vesinvest.*(luotu|skapad|created)/i),
      ).toBeNull();
      expect(
        screen.queryByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeNull();
      const summaryCard = document.querySelector('.v2-overview-wizard-card');
      expect(summaryCard).toBeTruthy();
      expect(
        screen.getByText(localeText('v2Overview.wizardQuestionImportYears')),
      ).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.wizardQuestionReviewYears')),
      ).toBeNull();
      expect(importYearsV2).not.toHaveBeenCalled();
    });

    it('lets non-admin users search and select a utility without exposing the connect action', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      let hasPlan = false;

      getOverviewV2.mockReset();
      getOverviewV2
        .mockResolvedValueOnce(disconnectedOverview)
        .mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
      getPlanningContextV2.mockImplementation(async () =>
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
          activePlan: hasPlan
            ? {
                id: 'plan-1',
                projectCount: 0,
                totalInvestmentAmount: 0,
              }
            : null,
        }),
      );
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
        years: buildOverviewResponse({ workspaceYears: [] }).importStatus.years,
        availableYears: buildOverviewResponse({ workspaceYears: [] })
          .importStatus.years,
        excludedYears: [],
        workspaceYears: [],
      } as any);
      createVesinvestPlanV2.mockImplementation(async () => {
        hasPlan = true;
        return { id: 'plan-1' } as any;
      });

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={false}
        />,
      );

      fireEvent.change(
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: 'Water' } },
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Water Utility/i }),
      );
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.connectButton'),
        }),
      ).toBeNull();
      expect(
        screen.getByText(localeText('v2Overview.adminOnlySetupHint')),
      ).toBeTruthy();
      expect(connectImportOrganizationV2).not.toHaveBeenCalled();
      expect(createVesinvestPlanV2).not.toHaveBeenCalled();
      expect(
        screen.queryByText(localeText('v2Overview.wizardQuestionImportYears')),
      ).toBeNull();
    });

    it('keeps the workspace connected when plan bootstrap fails after company choice', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;

      getOverviewV2.mockReset();
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValue(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
          activePlan: null,
        }),
      );
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
        years: buildOverviewResponse({ workspaceYears: [] }).importStatus.years,
        availableYears: buildOverviewResponse({ workspaceYears: [] })
          .importStatus.years,
        excludedYears: [],
        workspaceYears: [],
      } as any);
      createVesinvestPlanV2.mockRejectedValueOnce(
        new Error('Plan bootstrap failed'),
      );

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      fireEvent.change(
        await screen.findByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
        { target: { value: 'Water' } },
      );
      fireEvent.click(
        await screen.findByRole('button', { name: /Water Utility/i }),
      );
      fireEvent.click(
        await screen.findByRole('button', {
          name: localeText('v2Overview.connectButton'),
        }),
      );

      await waitFor(() => {
        expect(connectImportOrganizationV2).toHaveBeenCalledWith(1535);
        expect(createVesinvestPlanV2).toHaveBeenCalledWith(
          expect.objectContaining({ projects: [] }),
        );
      });
      expect(await screen.findByText('Plan bootstrap failed')).toBeTruthy();
      expect(sendV2OpsEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'veeti_connect_org',
          status: 'error',
        }),
      );
      expect(
        screen.queryByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeNull();
      expect(
        screen.getByText(localeText('v2Overview.wizardQuestionImportYears')),
      ).toBeTruthy();
    });

    it('keeps the normal overview workspace free of inline destructive company-reset actions', async () => {
      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByText(localeText('v2Overview.wizardQuestionReviewYears')),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Vaihda vesilaitos' }),
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
        await screen.findByRole('button', {
          name: `${localeText('v2Overview.fixYearValues')} 2023`,
        }),
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

      await clickReviewGroupYear(2022);
      expect(
        await screen.findByText(
          localeText('v2Overview.reviewBucketExcludedTitle'),
        ),
      ).toBeTruthy();
      expect(
        document
          .querySelector('[data-review-workspace-year="2022"]')
          ?.className.includes('excluded_from_plan'),
      ).toBe(true);
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

      await openYearDecisionWorkspaceYear(2022);
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
        await screen.findByRole('button', {
          name: `${localeText('v2Overview.fixYearValues')} 2023`,
        }),
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
        screen.getByRole('button', {
          name: localeText('v2Overview.manualPatchSave'),
        }),
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
      expect(
        within(
          screen
            .getByRole('button', {
              name: localeText('v2Overview.keepYearInPlan'),
            })
            .closest('article') as HTMLElement,
        ).getByText('2024'),
      ).toBeTruthy();
    });

    it('keeps the full on-card action cluster on the step-3 review card', async () => {
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
          name: localeText('v2Overview.documentImportAction'),
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

      await clickReviewGroupYear(2024);
      fireEvent.click(
        await screen.findByRole('button', {
          name: new RegExp(localeText('v2Overview.openReviewYearButton')),
        }),
      );
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
  });
}
