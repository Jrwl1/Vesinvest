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
export function registerOverviewPageV2SmokeSuite() {
  describe('OverviewPageV2 smoke', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('renders the extracted support rail in compact step-2 mode', () => {
    render(
      <OverviewSupportRail
        t={translate as any}
        wizardDisplayStep={2}
        isStep2SupportChrome={true}
        compactSupportingChrome={true}
        supportingChromeEyebrow={localeText('v2Overview.wizardSummaryTitle')}
        supportingChromeTitle={localeText('v2Overview.wizardSummarySubtitle')}
        summaryMetaBlocks={[
          {
            label: localeText('v2Overview.organizationLabel'),
            value: 'Water Utility',
          },
          {
            label: localeText('v2Overview.wizardContextImportedWorkspaceYears'),
            value: '2024, 2023',
          },
        ]}
        supportStatusItems={[
          {
            label: localeText('v2Overview.wizardSummaryImportedYears'),
            value: '2',
            detail: 'Hidden imported-year detail',
          },
          {
            label: localeText('v2Overview.wizardSummaryBaselineReady'),
            value: localeText('v2Overview.wizardSummaryNo'),
            detail: 'Hidden baseline detail',
          },
      ]}
        nextAction={{
          title: localeText('v2Overview.importYearsButton'),
          body: localeText('v2Overview.wizardBodyImportYears'),
        }}
        showNextActionBlock={true}
      />,
    );

    expect(screen.getByText('Water Utility')).toBeTruthy();
    expect(screen.getAllByText('2024, 2023').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        localeText('v2Overview.wizardProgress', { step: 2, total: 5 }),
      )
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Hidden imported-year detail')).toBeTruthy();
    expect(screen.getByText('Hidden baseline detail')).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.importYearsButton'))).toBeTruthy();
    expect(screen.getByText(localeText('v2Overview.wizardBodyImportYears'))).toBeTruthy();
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
  });
}


