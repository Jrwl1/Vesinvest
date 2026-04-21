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
export function registerOverviewConnectImportExecutionStateModelSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('moves optimistically excluded years out of active salvage buckets before refresh data arrives', () => {
    const { result } = renderHook(() =>
      useOverviewSetupState({
        overview: buildOverviewResponse({ workspaceYears: [] }),
        yearDataCache: {},
        selectedYears: [2024, 2023],
        excludedYearOverrides: { 2024: true },
        importedWorkspaceYears: null,
        backendAcceptedPlanningYears: [],
        reviewedImportedYears: [],
        setReviewedImportedYears: vi.fn(),
        manualPatchYear: null,
        cardEditYear: null,
        cardEditContext: null,
        reviewContinueStep: null,
        baselineReady: false,
        t: translate as any,
      }),
    );

    expect(result.current.excludedYearsSorted).toContain(2024);
    expect(
      [
        ...result.current.readyTrustBoardRows,
        ...result.current.suspiciousTrustBoardRows,
        ...result.current.blockedTrustBoardRows,
      ].map((row) => row.vuosi),
    ).not.toContain(2024);
    expect(result.current.trashbinTrustBoardRows.map((row) => row.vuosi)).toContain(2024);
  });

  it('keeps accepted baseline years out of excluded selectors and trashbin lanes', () => {
    const planningContext = buildPlanningContextResponse({
      canCreateScenario: true,
      baselineYears: [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
          financials: { dataType: 'tilinpaatos', source: 'manual' },
          prices: { dataType: 'taksa', source: 'veeti' },
          volumes: { dataType: 'volume_vesi', source: 'veeti' },
          investmentAmount: 0,
          soldWaterVolume: 0,
          soldWastewaterVolume: 0,
          combinedSoldVolume: 0,
          processElectricity: 0,
          pumpedWaterVolume: 0,
          waterBoughtVolume: 0,
          waterSoldVolume: 0,
          netWaterTradeVolume: 0,
        },
      ],
    });
    const { result } = renderHook(() =>
      useOverviewSetupState({
        overview: buildOverviewResponse({
          workspaceYears: [2024],
          excludedYears: [2024, 2023],
        }),
        planningContext,
        yearDataCache: {},
        selectedYears: [2024, 2023],
        excludedYearOverrides: {},
        importedWorkspaceYears: [2024],
        backendAcceptedPlanningYears: [2024],
        reviewedImportedYears: [],
        setReviewedImportedYears: vi.fn(),
        manualPatchYear: null,
        cardEditYear: null,
        cardEditContext: null,
        reviewContinueStep: null,
        baselineReady: true,
        t: translate as any,
      }),
    );

    expect(result.current.excludedYearsSorted).toEqual([2023]);
    expect(result.current.trashbinTrustBoardRows.map((row) => row.vuosi)).toEqual([2023]);
  });

  });
}

