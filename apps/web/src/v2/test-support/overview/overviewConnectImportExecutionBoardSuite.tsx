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
export function registerOverviewConnectImportExecutionBoardSuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('keeps an unselected year in the same salvage bucket without treating it as excluded', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const selectedCheckbox = await screen.findByRole('checkbox', { name: '2024' });
    expect((selectedCheckbox as HTMLInputElement).checked).toBe(true);

    fireEvent.click(selectedCheckbox);

    expect(
      screen.getByRole('heading', {
        name: localeText('v2Overview.reviewBucketRepairTitle'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('heading', {
        name: localeText('v2Overview.reviewBucketExcludedTitle'),
      }),
    ).toBeNull();
    expect(
      screen.queryByText(localeText('v2Overview.setupStatusExcludedShort')),
    ).toBeNull();
  });

  it('moves a year into the trashbin only through the explicit trash action', () => {
    const toggleSpy = vi.fn();
    const trashSpy = vi.fn();
    const row = {
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      missingSummary: { count: 0, total: 5, fields: '' },
      summaryMap: new Map(),
      trustToneClass: 'v2-status-positive',
      trustLabel: 'Ready',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      lane: 'ready',
    };

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2024]}
        syncing={false}
        readyRows={[row]}
        suspiciousRows={[]}
        blockedRows={[]}
        trashbinRows={[]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={true}
        renderStep2InlineFieldEditor={() => null}
        buildRepairActions={() => []}
        sourceStatusLabel={() => 'VEETI'}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceLayerText={() => ''}
        renderDatasetCounts={() => ''}
        missingRequirementLabel={() => ''}
        attemptOpenInlineCardEditor={() => undefined}
        openInlineCardEditor={() => undefined}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={0}
        removingYear={null}
        onToggleYear={toggleSpy}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={trashSpy}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: '2024' }));
    expect(toggleSpy).toHaveBeenCalledWith(2024);
    expect(trashSpy).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.importTrashAction')} 2024`,
      }),
    );
    expect(trashSpy).toHaveBeenCalledWith(2024);
  });

  it('wires the rendered trashbin restore button to the board restore callback', () => {
    const restoreSpy = vi.fn();
    const row = {
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      missingSummary: { count: 0, total: 5, fields: '' },
      summaryMap: new Map(),
      trustToneClass: 'v2-status-neutral',
      trustLabel: 'Parked',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      lane: 'parked',
    };

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[]}
        syncing={false}
        readyRows={[]}
        suspiciousRows={[]}
        blockedRows={[]}
        trashbinRows={[row]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={true}
        renderStep2InlineFieldEditor={() => null}
        buildRepairActions={() => []}
        sourceStatusLabel={() => 'VEETI'}
        sourceStatusClassName={() => 'v2-status-neutral'}
        sourceLayerText={() => ''}
        renderDatasetCounts={() => ''}
        missingRequirementLabel={() => ''}
        attemptOpenInlineCardEditor={() => undefined}
        openInlineCardEditor={() => undefined}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={0}
        removingYear={null}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={restoreSpy}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.importRestoreAction')} 2024`,
      }),
    );

    expect(restoreSpy).toHaveBeenCalledWith(2024);
  });

  });
}

