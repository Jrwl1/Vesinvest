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
export function registerOverviewPageV2SetupImportSuite() {
  describe('OverviewPageV2 setup and import', () => {
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

  it('hides the current-focus prose on the review-dominant support rail', () => {
    render(
      <OverviewSupportRail
        t={translate as any}
        workflowStep={3}
        isStep2SupportChrome={false}
        compactSupportingChrome={true}
        supportingChromeEyebrow={localeText('v2Overview.wizardSummaryTitle')}
        supportingChromeTitle={localeText('v2Overview.wizardSummarySubtitle')}
        summaryMetaBlocks={[
          {
            label: localeText('v2Overview.organizationLabel'),
            value: 'Water Utility',
          },
        ]}
        supportStatusItems={[
          {
            label: localeText('v2Overview.wizardSummaryImportedYears'),
            value: '2',
            detail: 'Hidden imported-year detail',
          },
        ]}
        nextAction={{
          title: localeText('v2Overview.wizardQuestionReviewYears'),
          body: localeText('v2Overview.wizardBodyReviewYears'),
        }}
        showNextActionBlock={false}
      />,
    );

    expect(screen.getByText('Water Utility')).toBeTruthy();
    expect(screen.queryByText(localeText('v2Overview.wizardCurrentFocus'))).toBeNull();
    expect(screen.queryByText(localeText('v2Overview.wizardBodyReviewYears'))).toBeNull();
  });

  it('keeps baseline creation ahead of the support rail without embedding the planning workspace', async () => {
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

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.wizardQuestionBaseline'),
      }),
    ).toBeTruthy();

    const activeSurface = document.querySelector('.v2-overview-active-surface');
    const supportRail = document.querySelector('.v2-overview-support-rail');
    const baselineCard = screen
      .getByRole('heading', { name: localeText('v2Overview.wizardQuestionBaseline') })
      .closest('.v2-card');

    expect(activeSurface).toBeTruthy();
    expect(supportRail).toBeTruthy();
    expect(baselineCard).toBeTruthy();
    expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
    expect(document.querySelector('.v2-overview-planning-shell-toggle')).toBeNull();
    expect(screen.queryByText(localeText('v2Overview.wizardCurrentFocus'))).toBeNull();
    expect(
      activeSurface!.compareDocumentPosition(supportRail!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders the extracted connect step with focused selection controls', () => {
    const onQueryChange = vi.fn();
    const onSearch = vi.fn();
    const onSelectOrg = vi.fn();
    const onConnect = vi.fn();
    const selectedOrg = {
      Id: 10,
      Nimi: 'Water Utility',
      YTunnus: '1234567-8',
      Kunta: 'Testby',
    } as any;

    render(
      <OverviewConnectStep
        t={translate as any}
        query="wat"
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        searching={false}
        connecting={false}
        importingYears={false}
        syncing={false}
        isAdmin={true}
        searchResults={[selectedOrg]}
        selectedOrg={selectedOrg}
        onSelectOrg={onSelectOrg}
        selectedOrgMunicipality="Testby"
        selectedOrgReadyToConnect={true}
        renderHighlightedSearchMatch={(value) => value}
        selectedOrgStillVisible={true}
        selectedOrgName="Water Utility"
        selectedOrgBusinessId="1234567-8"
        onConnect={onConnect}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'water' } });
    expect(onQueryChange).toHaveBeenCalledWith('water');

    fireEvent.click(screen.getByRole('button', { name: localeText('v2Overview.searchButton') }));
    expect(onSearch).toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.clearSelectionButton'),
      }),
    );
    expect(onSelectOrg).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: /Water Utility/i }));
    expect(onSelectOrg).toHaveBeenCalledWith(selectedOrg);

    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.connectButton'),
      }),
    );
    expect(onConnect).toHaveBeenCalledWith(selectedOrg);
  });

  it('reuses Vesinvest evidence copy when the VEETI search surface is shown inside step 4', () => {
    render(
      <OverviewConnectStep
        t={translate as any}
        workflowStep={4}
        query=""
        onQueryChange={() => undefined}
        onSearch={() => undefined}
        searching={false}
        connecting={false}
        importingYears={false}
        syncing={false}
        isAdmin={true}
        searchResults={[]}
        selectedOrg={null}
        onSelectOrg={() => undefined}
        selectedOrgMunicipality={null}
        selectedOrgReadyToConnect={false}
        renderHighlightedSearchMatch={(value) => value}
        selectedOrgStillVisible={false}
        selectedOrgName="-"
        selectedOrgBusinessId="-"
        onConnect={() => undefined}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: localeText('v2Vesinvest.workflowVerifyEvidence'),
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(localeText('v2Vesinvest.workflowVerifyEvidenceBody')),
    ).toBeTruthy();
  });

  it('keeps hidden evidence import inputs addressable with stable names', async () => {
    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(
        (
          document.querySelector(
            '[data-import-kind="document"]',
          ) as HTMLInputElement | null
        )?.name,
      ).toBe('documentUpload');
      expect(
        (
          document.querySelector(
            '[data-import-kind="workbook"]',
          ) as HTMLInputElement | null
        )?.name,
      ).toBe('workbookUpload');
    });
    expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
  });

  it('keeps Overview connect and import surfaces hidden when planning context already carries utility identity', async () => {
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        activePlan: {
          veetiId: 1535,
          identitySource: 'veeti',
          businessId: '1234567-8',
          utilityName: 'Water Utility',
          status: 'draft',
          baselineStatus: 'incomplete',
          pricingStatus: 'blocked',
        },
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
      await screen.findByText(localeText('v2Overview.wizardQuestionReviewYears')),
    ).toBeTruthy();
    expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
    expect(
      screen.queryByRole('button', { name: localeText('v2Overview.connectButton') }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: localeText('v2Overview.importYearsButton') }),
    ).toBeNull();
  });

  it('keeps selected blocked years pinned first, then orders the rest by repairability', () => {
    const makeBoardRow = (
      vuosi: number,
      options?: {
        completeness?: Record<string, boolean>;
        missingCount?: number;
        missingRequirements?: string[];
      },
    ) => ({
      vuosi,
      completeness: {
        tilinpaatos: true,
        taksa: false,
        tariff_revenue: false,
        volume_vesi: false,
        volume_jatevesi: false,
        ...options?.completeness,
      },
      missingRequirements: options?.missingRequirements ?? ['prices', 'volumes'],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-warning',
      trustLabel: 'Needs completion',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary:
        options?.missingCount != null
          ? {
              count: options.missingCount,
              total: 5,
              fields: 'Prices, volumes',
            }
          : null,
    });

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2021]}
        syncing={false}
        readyRows={[]}
        suspiciousRows={[]}
        blockedRows={[
          makeBoardRow(2021, {
            completeness: {
              tilinpaatos: true,
              taksa: false,
              tariff_revenue: false,
              volume_vesi: false,
              volume_jatevesi: false,
            },
            missingCount: 3,
            missingRequirements: ['prices', 'volumes', 'tariffRevenue'],
          }),
          makeBoardRow(2024, {
            completeness: {
              tilinpaatos: true,
              taksa: true,
              tariff_revenue: false,
              volume_vesi: true,
              volume_jatevesi: false,
            },
            missingCount: 1,
            missingRequirements: ['tariffRevenue'],
          }),
          makeBoardRow(2023, {
            completeness: {
              tilinpaatos: true,
              taksa: false,
              tariff_revenue: false,
              volume_vesi: true,
              volume_jatevesi: false,
            },
            missingCount: 2,
            missingRequirements: ['prices', 'tariffRevenue'],
          }),
        ]}
        trashbinRows={[]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
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
        blockedYearCount={3}
        removingYear={null}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    expect(
      screen.getByRole('heading', { name: localeText('v2Overview.reviewBucketSparseTitle') }),
    ).toBeTruthy();
    const repairLane = document.querySelector(
      '.v2-import-board-lane-blocked',
    ) as HTMLElement;

    expect(
      Array.from(repairLane.querySelectorAll('.v2-year-checkbox strong')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['2021', '2024', '2023']);
  });

  it('puts the blocked step-2 primary action ahead of secondary repair and trash actions', () => {
    const blockedRow = {
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: false,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      missingRequirements: ['prices', 'tariffRevenue'],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-warning',
      trustLabel: 'Needs completion',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary: {
        count: 2,
        total: 5,
        fields: 'Prices, tariff revenue',
      },
    };

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2024]}
        syncing={false}
        readyRows={[]}
        suspiciousRows={[]}
        blockedRows={[blockedRow as any]}
        trashbinRows={[]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={true}
        renderStep2InlineFieldEditor={() => null}
        buildRepairActions={() => [
          {
            key: 'prices',
            label: localeText('v2Overview.repairPricesAction'),
            focusField: 'waterUnitPrice',
          },
        ]}
        sourceStatusLabel={() => 'VEETI'}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceLayerText={() => ''}
        renderDatasetCounts={() => ''}
        missingRequirementLabel={() => ''}
        attemptOpenInlineCardEditor={() => undefined}
        openInlineCardEditor={() => undefined}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={1}
        removingYear={null}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const primaryActions = document.querySelector('.v2-year-card-actions-primary');
    const secondaryActions = document.querySelectorAll('.v2-year-card-actions-secondary');
    const tertiaryActions = document.querySelector('.v2-year-card-actions-tertiary');

    expect(primaryActions).toBeTruthy();
    expect(primaryActions?.textContent).toContain(localeText('v2Overview.manualPatchButton'));
    expect(secondaryActions).toHaveLength(2);
    expect(secondaryActions[0]?.textContent).toContain(
      localeText('v2Overview.repairPricesAction'),
    );
    expect(secondaryActions[1]?.textContent).toContain(
      localeText('v2Overview.documentImportAction'),
    );
    expect(tertiaryActions?.textContent).toContain(
      localeText('v2Overview.importTrashAction'),
    );
    expect(
      (primaryActions as Element).compareDocumentPosition(secondaryActions[0] as Element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      (secondaryActions[secondaryActions.length - 1] as Element).compareDocumentPosition(
        tertiaryActions as Element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps selected usable years at the front of selectable lanes before recency tie-breaks', () => {
    const makeBoardRow = (vuosi: number) => ({
      vuosi,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-positive',
      trustLabel: 'Looks plausible',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary: null,
    });

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2022]}
        syncing={false}
        readyRows={[makeBoardRow(2024), makeBoardRow(2022), makeBoardRow(2023)]}
        suspiciousRows={[]}
        blockedRows={[]}
        trashbinRows={[]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
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
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const readyLane = screen
      .getByRole('heading', { name: localeText('v2Overview.reviewBucketReadyTitle') })
      .closest('section') as HTMLElement;
    const readyYears = Array.from(
      readyLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);

    expect(readyYears).toEqual(['2022', '2024', '2023']);
  });

  it('keeps trashbin years behind a closed secondary disclosure and breaks equal-priority ties by recency', () => {
    const makeBoardRow = (vuosi: number) => ({
      vuosi,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      missingRequirements: [],
      summaryMap: new Map(),
      trustToneClass: 'v2-status-positive',
      trustLabel: 'Looks plausible',
      sourceStatus: 'VEETI',
      warnings: [],
      resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
      trustNote: null,
      sourceLayers: [],
      missingSummary: null,
    });

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2024, 2022, 2020]}
        syncing={false}
        readyRows={[makeBoardRow(2024), makeBoardRow(2020), makeBoardRow(2022)]}
        suspiciousRows={[]}
        blockedRows={[]}
        trashbinRows={[makeBoardRow(2023), makeBoardRow(2021)]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
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
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const readyLane = screen
      .getByRole('heading', { name: localeText('v2Overview.reviewBucketReadyTitle') })
      .closest('section') as HTMLElement;
    const readyYears = Array.from(
      readyLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);
    expect(readyYears).toEqual(['2024', '2022', '2020']);

    const parkedLane = screen
      .getByRole('heading', { name: localeText('v2Overview.reviewBucketExcludedTitle') })
      .closest('details') as HTMLDetailsElement;
    expect(parkedLane.open).toBe(false);

    fireEvent.click(parkedLane.querySelector('summary')!);

    const parkedYears = Array.from(
      parkedLane.querySelectorAll('.v2-year-checkbox strong'),
    ).map((node) => node.textContent);
    expect(parkedYears).toEqual(['2023', '2021']);
    expect(document.body.textContent).not.toContain('Sekundära huvudtal');
  });

  it('keeps blocked historical years in the normal import selection flow', () => {
    const openInlineCardEditor = vi.fn();
    const blockedRows = [
      {
        vuosi: 2021,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: false,
          volume_jatevesi: false,
        },
        missingRequirements: ['prices', 'volumes', 'tariffRevenue'],
        summaryMap: new Map(),
        trustToneClass: 'v2-status-warning',
        trustLabel: 'Needs completion',
        sourceStatus: 'VEETI',
        warnings: [],
        resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
        trustNote: null,
        sourceLayers: [],
        missingSummary: {
          count: 3,
          total: 5,
          fields: 'Prices, volumes, fixed revenue',
        },
      },
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: true,
          volume_jatevesi: false,
        },
        missingRequirements: ['prices', 'tariffRevenue'],
        summaryMap: new Map(),
        trustToneClass: 'v2-status-warning',
        trustLabel: 'Needs completion',
        sourceStatus: 'VEETI',
        warnings: [],
        resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
        trustNote: null,
        sourceLayers: [],
        missingSummary: {
          count: 2,
          total: 5,
          fields: 'Prices, fixed revenue',
        },
      },
    ];

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2021]}
        syncing={false}
        readyRows={[]}
        suspiciousRows={[]}
        blockedRows={blockedRows}
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
        openInlineCardEditor={openInlineCardEditor}
        loadingYearData={null}
        manualPatchError={null}
        blockedYearCount={2}
        removingYear={null}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    const footerActions = document.querySelector(
      '.v2-card.v2-overview-step-card > .v2-actions-row',
    ) as HTMLElement;
    expect(footerActions).toBeTruthy();
    expect(
      document.querySelector('details.v2-import-board-lane-blocked[open]'),
    ).toBeNull();
    expect(
      within(footerActions).getByRole('button', {
        name: localeText('v2Overview.importYearsButton'),
      }),
    );
    expect(openInlineCardEditor).not.toHaveBeenCalled();
  });

  it('keeps the import review read-only for non-admin users', () => {
    const blockedRows = [
      {
        vuosi: 2021,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: false,
          volume_jatevesi: false,
        },
        missingRequirements: ['prices', 'volumes', 'tariffRevenue'],
        summaryMap: new Map(),
        trustToneClass: 'v2-status-warning',
        trustLabel: 'Needs completion',
        sourceStatus: 'VEETI',
        warnings: [],
        resultToZero: { direction: 'missing', effectiveValue: null, marginPct: null },
        trustNote: null,
        sourceLayers: [],
        missingSummary: {
          count: 3,
          total: 5,
          fields: 'Prices, volumes, fixed revenue',
        },
      },
    ];

    render(
      <OverviewImportBoard
        t={translate as any}
        wizardBackLabel={null}
        onBack={() => undefined}
        selectedYears={[2021]}
        syncing={false}
        readyRows={[]}
        suspiciousRows={[]}
        blockedRows={blockedRows}
        trashbinRows={[]}
        currentYearEstimateRows={[]}
        confirmedImportedYears={[]}
        yearDataCache={{}}
        cardEditYear={null}
        cardEditContext={null}
        cardEditFocusField={null}
        isAdmin={false}
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
        blockedYearCount={1}
        removingYear={null}
        onToggleYear={() => undefined}
        onImportYears={() => undefined}
        onAddCurrentYearEstimate={() => undefined}
        onTrashYear={() => undefined}
        onRestoreYear={() => undefined}
        importYearsButtonClass="v2-btn v2-btn-primary"
        importingYears={false}
      />,
    );

    expect(
      screen.getByText(`${localeText('v2Overview.selectedYearsLabel')}: 1`),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.importYearsButton'),
      }),
    ).toBeNull();
    expect(screen.getByText(localeText('v2Overview.adminOnlyImportHint'))).toBeTruthy();
  });

  it('keeps the current-year estimate out of default historical selection and lanes', async () => {
    const currentYear = new Date().getFullYear();
    const templateYear = buildOverviewResponse().importStatus.years[0];
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
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
          {
            ...templateYear,
            vuosi: currentYear - 1,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              manualDataTypes: [],
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
          {
            ...templateYear,
            vuosi: currentYear - 2,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              manualDataTypes: [],
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
          {
            ...templateYear,
            vuosi: currentYear - 3,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              manualDataTypes: [],
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
          {
            ...templateYear,
            vuosi: currentYear - 4,
            planningRole: 'historical',
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              manualDataTypes: [],
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
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

    const estimateSection = (
      await screen.findByText(localeText('v2Overview.currentYearEstimateTitle'))
    ).closest('details') as HTMLDetailsElement;
    expect(estimateSection.open).toBe(false);
    fireEvent.click(estimateSection.querySelector('summary')!);
    expect(estimateSection.open).toBe(true);
    expect(
      within(estimateSection).getByRole('button', {
        name: localeText('v2Overview.currentYearEstimateAction'),
      }),
    ).toBeTruthy();
    expect(
      estimateSection.querySelector(`input[name="syncYear-${currentYear}"]`),
    ).toBeNull();

    const renderedYears = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name^="syncYear-"]'),
    ).map((node) => node.name.replace('syncYear-', ''));
    expect(renderedYears).toEqual([
      String(currentYear - 1),
      String(currentYear - 2),
      String(currentYear - 3),
      String(currentYear - 4),
    ]);
    expect(
      screen.getByText(
        `${localeText('v2Overview.selectedYearsLabel')}: 4`,
      ),
    ).toBeTruthy();
  });

  it('imports the current-year estimate explicitly and opens manual completion when it is blocked', async () => {
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
    getOverviewV2.mockResolvedValueOnce(initialOverview).mockResolvedValue(importedOverview);
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
      />,
    );

    await openCurrentYearEstimateLane();
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.currentYearEstimateAction'),
      }),
    );

    await waitFor(() =>
      expect(importYearsV2).toHaveBeenCalledWith([currentYear]),
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(localeText('v2Overview.wizardQuestionFixYear'))
          .length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    ).toBeTruthy();
  });
  });
}
