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
export function registerOverviewConnectImportExecutionPersistenceSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('rehydrates the step-2 import draft from session storage after remount', async () => {
    window.sessionStorage.setItem(
      'v2_overview_runtime_state',
      JSON.stringify({
        workspaceKey: 'org:1234567-8',
        selectedYears: [2022, 2016],
      }),
    );

    const ImportControllerProbe = () => {
      const [yearDataCache, setYearDataCache] = React.useState({});
      const controller = useOverviewImportController({
        t: translate as any,
        pickDefaultSyncYears: (rows) =>
          [...rows]
            .filter((row) => row.planningRole !== 'current_year_estimate')
            .sort((a, b) => b.vuosi - a.vuosi)
            .slice(0, 3)
            .map((row) => row.vuosi),
        setYearDataCache,
      });

      return (
        <div data-testid="controller-selection">
          {controller.selectedYears.join(',')}
        </div>
      );
    };

    getOverviewV2.mockReset();
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2022,
          },
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2016,
          },
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2015,
          },
        ],
      }),
    );

    render(<ImportControllerProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('controller-selection').textContent).toBe(
        '2022,2016',
      );
    });
  });

  it('ignores a stored import draft on workspace mismatch and does not revive bulk selections', async () => {
    window.sessionStorage.setItem(
      'v2_overview_runtime_state',
      JSON.stringify({
        workspaceKey: 'org:9999999-9',
        selectedYears: [2022, 2016],
        selectedYearsForDelete: [2022],
        selectedYearsForRestore: [2016],
      }),
    );

    const ImportControllerProbe = () => {
      const [yearDataCache, setYearDataCache] = React.useState({});
      const controller = useOverviewImportController({
        t: translate as any,
        pickDefaultSyncYears: (rows) =>
          [...rows]
            .filter((row) => row.planningRole !== 'current_year_estimate')
            .sort((a, b) => b.vuosi - a.vuosi)
            .slice(0, 3)
            .map((row) => row.vuosi),
        setYearDataCache,
      });

      return (
        <>
          <div data-testid="controller-selection">
            {controller.selectedYears.join(',')}
          </div>
          <div data-testid="controller-delete-selection">
            {controller.selectedYearsForDelete.join(',')}
          </div>
          <div data-testid="controller-restore-selection">
            {controller.selectedYearsForRestore.join(',')}
          </div>
        </>
      );
    };

    getOverviewV2.mockReset();
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2022,
          },
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2016,
          },
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2015,
          },
        ],
      }),
    );

    render(<ImportControllerProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('controller-selection').textContent).toBe(
        '2022,2016,2015',
      );
    });
    expect(screen.getByTestId('controller-delete-selection').textContent).toBe('');
    expect(screen.getByTestId('controller-restore-selection').textContent).toBe('');
  });

  it('keeps optimistic restore state when restore succeeds but refresh fails', async () => {
    const ImportControllerProbe = () => {
      const [yearDataCache, setYearDataCache] = React.useState({});
      const controller = useOverviewImportController({
        t: translate as any,
        pickDefaultSyncYears: (rows) =>
          [...rows]
            .filter((row) => row.planningRole !== 'current_year_estimate')
            .sort((a, b) => b.vuosi - a.vuosi)
            .slice(0, 3)
            .map((row) => row.vuosi),
        setYearDataCache,
      });
      const [reviewedImportedYears, setReviewedImportedYears] = React.useState<
        number[]
      >([]);
      const state = useOverviewSetupState({
        overview: controller.overview,
        yearDataCache,
        selectedYears: controller.selectedYears,
        excludedYearOverrides: controller.excludedYearOverrides,
        importedWorkspaceYears: controller.importedWorkspaceYears,
        backendAcceptedPlanningYears: controller.backendAcceptedPlanningYears,
        reviewedImportedYears,
        setReviewedImportedYears,
        manualPatchYear: null,
        cardEditYear: null,
        cardEditContext: null,
        reviewContinueStep: controller.reviewContinueStep,
        baselineReady: controller.baselineReady,
        t: translate as any,
      });

      return (
        <>
          <button type="button" onClick={() => void controller.restoreYearFromImportBoard(2024)}>
            restore 2024
          </button>
          <div data-testid="restore-controller-error">{controller.error ?? ''}</div>
          <div data-testid="restore-active-years">
            {[
              ...state.readyTrustBoardRows,
              ...state.suspiciousTrustBoardRows,
              ...state.blockedTrustBoardRows,
            ]
              .map((row) => row.vuosi)
              .join(',')}
          </div>
          <div data-testid="restore-trashbin-years">
            {state.trashbinTrustBoardRows.map((row) => row.vuosi).join(',')}
          </div>
        </>
      );
    };

    getOverviewV2.mockReset();
    getOverviewV2
      .mockResolvedValueOnce(
        buildOverviewResponse({ workspaceYears: [], excludedYears: [2024] }),
      )
      .mockImplementation(async () => {
        throw new Error('Refresh failed');
      });
    restoreImportYearsV2.mockResolvedValueOnce({
      requestedYears: [2024],
      restoredCount: 1,
      notExcludedCount: 0,
      results: [{ vuosi: 2024, restored: true, reason: null }],
      status: buildOverviewResponse({ workspaceYears: [] }).importStatus,
    });

    render(<ImportControllerProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('restore-trashbin-years').textContent).toContain('2024');
    });
    fireEvent.click(screen.getByRole('button', { name: 'restore 2024' }));

    await waitFor(() => {
      expect(restoreImportYearsV2).toHaveBeenCalledWith([2024]);
      expect(screen.getByTestId('restore-trashbin-years').textContent).not.toContain(
        '2024',
      );
      expect(screen.getByTestId('restore-active-years').textContent).toContain('2024');
      expect(screen.getByTestId('restore-controller-error').textContent).toContain(
        'Refresh failed',
      );
    });
  });

  });
}
