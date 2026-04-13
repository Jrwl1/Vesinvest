import React from 'react';
import { type V2WorkbookPreviewResponse } from '../api';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import { OverviewImportBoard } from './OverviewImportBoard';
import { OverviewReviewBoard } from './OverviewReviewBoard';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from './OverviewWizardPanels';
import { VesinvestPlanningPanel } from './VesinvestPlanningPanel';
import { OverviewWorkbookImportWorkflow } from './OverviewWorkbookImportWorkflow';
import { OverviewSupportRail } from './OverviewSupportRail';
import { OverviewManualPatchPanel } from './OverviewManualPatchPanel';
import { getFinancialSourceFieldLabel } from './overviewLabels';
import { buildOverviewManualPatchViewModel } from './overviewManualPatchModel';
import {
  getPresentedOverviewWorkflowStep,
  getMissingSyncRequirements,
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  resolveVesinvestWorkflowState,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  type SetupWizardStep,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import {
  buildFinancialComparisonRows,
  buildImportYearSourceLayers,
  buildImportYearSummaryRows,
  buildImportYearTrustSignal,
  buildPriceComparisonRows,
  buildVolumeComparisonRows,
  canReapplyDatasetVeeti,
  canReapplyFinancialVeeti,
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
} from './yearReview';

import { useOverviewPageController } from './useOverviewPageController';
type Props = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
  onOrgLanguageNoticeChange?: (
    notice:
      | {
          kind: 'switched' | 'kept_manual';
          language: 'fi' | 'sv' | 'en';
          previousLanguage: 'fi' | 'sv' | 'en';
        }
      | null,
  ) => void;
  setupBackSignal?: number;
};
type ImportWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

const AUTO_SEARCH_MIN_QUERY_LENGTH = 3;
const AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH = 4;
const AUTO_SEARCH_DELAY_MS = 320;
const AUTO_SEARCH_BUSINESS_ID_DELAY_MS = 120;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeOrganizationSearchQuery = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeBusinessIdCandidate = (value: string): string =>
  normalizeOrganizationSearchQuery(value).replace(/[^\d]/g, '');

const isBusinessIdLikeQuery = (value: string): boolean =>
  /^[\d-\s]+$/.test(normalizeOrganizationSearchQuery(value)) &&
  normalizeBusinessIdCandidate(value).length > 0;

const getAutoSearchMinLength = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH
    : AUTO_SEARCH_MIN_QUERY_LENGTH;

const getAutoSearchDelayMs = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_DELAY_MS
    : AUTO_SEARCH_DELAY_MS;

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
  onOrgLanguageNoticeChange,
  setupBackSignal,
}) => {
  const controller = useOverviewPageController({
    onGoToForecast,
    onGoToReports: _onGoToReports,
    isAdmin,
    onSetupWizardStateChange,
    onSetupOrgNameChange,
    onOrgLanguageNoticeChange,
    setupBackSignal,
  });
  const {
    t,
    overview,
    setOverview,
    planningContext,
    setPlanningContext,
    loading,
    setLoading,
    error,
    setError,
    info,
    setInfo,
    query,
    setQuery,
    searching,
    setSearching,
    searchResults,
    setSearchResults,
    selectedOrg,
    setSelectedOrg,
    selectedYears,
    setSelectedYears,
    scenarioList,
    setScenarioList,
    reportList,
    setReportList,
    reviewedImportedYears,
    setReviewedImportedYears,
    importedWorkspaceYears,
    setImportedWorkspaceYears,
    latestPlanningBaselineSummary,
    setLatestPlanningBaselineSummary,
    reviewContinueStep,
    setReviewContinueStep,
    connecting,
    setConnecting,
    importingYears,
    setImportingYears,
    creatingPlanningBaseline,
    setCreatingPlanningBaseline,
    syncing,
    setSyncing,
    removingYear,
    setRemovingYear,
    bulkDeletingYears,
    setBulkDeletingYears,
    bulkRestoringYears,
    setBulkRestoringYears,
    selectedYearsForDelete,
    setSelectedYearsForDelete,
    selectedYearsForRestore,
    setSelectedYearsForRestore,
    syncYearSelectionTouchedRef,
    selectedYearsRef,
    selectedYearsForDeleteRef,
    selectedYearsForRestoreRef,
    selectedOrgRef,
    searchRequestSeq,
    previewFetchYearsRef,
    documentImportBusy,
    documentImportStatus,
    documentImportError,
    documentImportPreview,
    workbookImportBusy,
    workbookImportStatus,
    workbookImportError,
    workbookImportPreview,
    workbookImportSelections,
    setWorkbookImportSelections,
    handledSetupBackSignalRef,
    baselineReady,
    backendAcceptedPlanningYears,
    documentFileInputRef,
    workbookFileInputRef,
    setInlineCardFieldRef,
    yearDataCache,
    loadingYearData,
    manualPatchYear,
    cardEditYear,
    cardEditFocusField,
    cardEditContext,
    manualPatchMode,
    manualPatchBusy,
    manualPatchError,
    manualFinancials,
    setManualFinancials,
    manualPrices,
    setManualPrices,
    manualVolumes,
    setManualVolumes,
    manualInvestments,
    setManualInvestments,
    manualEnergy,
    setManualEnergy,
    manualNetwork,
    setManualNetwork,
    manualReason,
    setManualReason,
    populateManualEditorFromYearData,
    loadYearIntoManualEditor,
    closeInlineCardEditor,
    isInlineCardDirty,
    dismissInlineCardEditor,
    openInlineCardEditor,
    attemptOpenInlineCardEditor,
    resolveRepairFocusField,
    buildRepairActions,
    buildManualPatchPayload,
    saveInlineCardEditBase,
    handleSwitchToManualEditMode,
    resolveSyncBlockReason,
    pickDefaultSyncYears,
    loadOverview,
    performOrganizationSearch,
    handleSearch,
    handleConnect,
    handleImportYears,
    runSync,
    toggleYear,
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    recommendedYears,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    parkedTrustBoardRows,
    blockedTrustBoardRows,
    currentYearEstimateBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    excludedYearsSorted,
    reviewStatusRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    pendingReviewYearCount,
    includedPlanningYears,
    acceptedPlanningYearRows,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
    setupWizardState,
    wizardDisplayStep,
    displaySetupWizardState,
    wizardBackStep,
    previewPrefetchYears,
    selectableImportYearRows,
    saveInlineCardEdit,
    handleInlineCardKeyDown,
    selectedOrgStillVisible,
    preferredSearchOrg,
    toggleYearForDelete,
    toggleYearForRestore,
    handleBulkDeleteYears,
    handleBulkRestoreYears,
    searchTerm,
    renderHighlightedSearchMatch,
    handleGuideBlockedYears,
    resetManualPatchDialog,
    closeManualPatchDialog,
    handleAddCurrentYearEstimate,
    handleDocumentPdfSelected,
    handleWorkbookSelected,
    submitWorkbookImport,
    submitManualPatch,
    renderStep2InlineFieldEditor,
    saveReviewWorkspaceYear,
    sourceStatusLabel,
    sourceStatusClassName,
    financialComparisonLabel,
    datasetSourceLabel,
    renderDatasetTypeList,
    importWarningLabel,
    renderDatasetCounts,
    loadYearPreviewData,
    renderYearValuePreview,
    handleManageYears,
    handleReopenReview,
    handleDeleteYear,
    handleExcludeYearFromPlan,
    handleRestoreYearToPlan,
    handleRestoreYearVeeti,
    handleReopenYearReview,
    handleApplyVeetiReconcile,
    handleKeepCurrentYearValues,
    handleSwitchToDocumentImportMode,
    handleSwitchToWorkbookImportMode,
    handleExcludeManualYearFromPlan,
    handleRestoreManualYearToPlan,
    handleModalApplyVeetiFinancials,
    handleModalApplyVeetiPrices,
    handleModalApplyVeetiVolumes,
    setupStatusLabel,
    setupStatusClassName,
    yearStatusRowClassName,
    handleContinueFromReview,
    handleCreatePlanningBaseline,
    handleOpenForecastHandoff,
    missingRequirementLabel,
    sourceLayerText,
    priceComparisonLabel,
    volumeComparisonLabel,
    isReviewMode,
    showAllManualSections,
    isDocumentImportMode,
    isWorkbookImportMode,
    showFinancialSection,
    showPricesSection,
    showVolumesSection,
    financialComparisonRows,
    hasFinancialComparisonDiffs,
    priceComparisonRows,
    hasPriceComparisonDiffs,
    volumeComparisonRows,
    hasVolumeComparisonDiffs,
    currentYearData,
    workbookImportComparisonYears,
    hasWorkbookImportPreviewValues,
    hasWorkbookApplySelections,
    canConfirmDocumentImport,
    canConfirmImportWorkflow,
    canReapplyPricesForYear,
    canReapplyVolumesForYear,
    wizardBackLabel,
    handleWizardBack,
  } = controller;

  if (loading)
    return (
      <div className="v2-loading">
        {t('v2Overview.loading', 'Loading overview...')}
      </div>
    );
  if (!overview)
    return (
      <div className="v2-error">
        {t('v2Overview.loadFailed', 'Overview data is not available.')}
      </div>
    );

  const { importStatus } = overview;

  const hasBaselineBudget = baselineReady;

  const includedPlanningYearsLabel =
    includedPlanningYears.length > 0
      ? includedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const importedYearsLabel =
    confirmedImportedYears.length > 0
      ? confirmedImportedYears.join(', ')
      : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const readySummaryYearRows = [
    ...reviewedImportedYearRows,
    ...technicallyReadyImportedYearRows,
  ].sort((left, right) => right.vuosi - left.vuosi);
  const readyYearsLabel =
    readySummaryYearRows.length > 0
      ? readySummaryYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const technicalReadyYearsLabel =
    technicallyReadyImportedYearRows.length > 0
      ? technicallyReadyImportedYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const excludedYearsLabel =
    excludedYearsSorted.length > 0
      ? excludedYearsSorted.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const correctedYearsLabel =
    correctedPlanningYears.length > 0
      ? correctedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const selectedConnectedOrg = overview?.importStatus.link ?? null;
  const selectedOrgName =
    selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';
  const selectedOrgMunicipality = selectedOrg?.Kunta ?? null;
  const importStep = Math.min(setupWizardState?.activeStep ?? 1, 3) as 1 | 2 | 3;
  const activeVesinvestPlan =
    planningContext?.vesinvest?.activePlan ??
    planningContext?.vesinvest?.selectedPlan ??
    null;
  const activeVesinvestScenario =
    activeVesinvestPlan?.selectedScenarioId != null
      ? (scenarioList ?? []).find(
          (item) => item.id === activeVesinvestPlan.selectedScenarioId,
        ) ??
        null
      : null;
  const vesinvestWorkflowState = resolveVesinvestWorkflowState(
    importStatus,
    planningContext,
    {
      selectedScenario: activeVesinvestScenario,
    },
  );
  const wizardProgressStep = vesinvestWorkflowState.currentStep;
  const baselineReadyForSummary = baselineReady;
  const planningBaselineSummaryDetail = baselineReadyForSummary
    ? latestPlanningBaselineSummary
      ? t('v2Overview.wizardBaselineReadyDetail', {
          included:
            latestPlanningBaselineSummary.includedYears.length > 0
              ? latestPlanningBaselineSummary.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          excluded:
            latestPlanningBaselineSummary.excludedYears.length > 0
              ? latestPlanningBaselineSummary.excludedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          corrected:
            latestPlanningBaselineSummary.correctedYears.length > 0
              ? latestPlanningBaselineSummary.correctedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        })
      : t('v2Overview.wizardBaselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const hasBlockedReviewRows = reviewStatusRows.some(
    (row) => row.setupStatus === 'needs_attention',
  );
  const hasPendingReviewRows = reviewStatusRows.some(
    (row) => row.setupStatus === 'ready_for_review',
  );
  const wizardSummaryItems = [
    {
      label: t('v2Overview.wizardSummaryCompany'),
      value:
        activeVesinvestPlan?.utilityName ??
        importStatus.link?.nimi ??
        selectedOrgName,
      detail: activeVesinvestPlan?.businessId ?? importStatus.link?.ytunnus ?? selectedOrgBusinessId,
    },
    {
      label: t('v2Overview.wizardSummaryImportedYears'),
      value: String(importYearRows.length),
      detail: importedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
      value: String(readySummaryYearRows.length),
      detail: readyYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryExcludedYears'),
      value: String(excludedYearsSorted.length),
      detail: excludedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryBaselineReady'),
      value: baselineReadyForSummary
        ? t('v2Overview.wizardSummaryYes')
        : t('v2Overview.wizardSummaryNo'),
      detail: planningBaselineSummaryDetail,
    },
  ] as const;
  const step3WizardHero = {
    title:
      hasBlockedReviewRows || hasPendingReviewRows
        ? t('v2Overview.wizardQuestionReviewYears')
        : t('v2Vesinvest.workflowVerifyEvidence', 'Verify baseline & evidence'),
    body:
      hasBlockedReviewRows || hasPendingReviewRows
        ? t('v2Overview.wizardBodyReviewYears')
        : t(
            'v2Vesinvest.workflowVerifyEvidenceBody',
            'Use VEETI, PDF, workbook, or manual corrections to verify the accepted baseline that pricing will rely on.',
          ),
    badge:
      hasBlockedReviewRows
        ? t('v2Overview.blockedYearsTitle')
        : hasPendingReviewRows
        ? t('v2Overview.wizardQuestionReviewYears')
        : t('v2Vesinvest.evidenceTitle', 'Accepted baseline years'),
  };
  const wizardStepContent: Record<number, { title: string; body: string; badge: string }> = {
    1: {
      title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
      body: t(
        'v2Vesinvest.workflowIdentifyUtilityBody',
        'Search and connect the VEETI utility. The first Vesinvest plan is created automatically after the utility is linked.',
      ),
      badge: t('v2Vesinvest.workflowPlanFirst', 'VEETI-first'),
    },
    2: {
      title: t('v2Overview.wizardQuestionImportYears', 'Choose years for this workspace'),
      body: t(
        'v2Overview.wizardBodyImportYears',
        'Select the years to import. Review them before the planning baseline.',
      ),
      badge: t('v2Overview.wizardFocusImportYears', 'Import years'),
    },
    3: {
      title: step3WizardHero.title,
      body: step3WizardHero.body,
      badge: step3WizardHero.badge,
    },
    4: {
      title: t('v2Vesinvest.workflowOpenFeePath', 'Open fee path'),
      body: t(
        'v2Vesinvest.workflowOpenFeePathBody',
        'When the baseline is verified, sync the plan to forecast to review price pressure, financing gaps, and the saved recommendation.',
      ),
      badge: t('v2Vesinvest.feePathEyebrow', 'Fee path'),
    },
    5: {
      title: t('v2Vesinvest.workflowCreateReport', 'Create report'),
      body: t(
        'v2Vesinvest.workflowCreateReportBody',
        'Create the report after the fee path is saved and the linked scenario is up to date.',
      ),
      badge: t('v2Shell.tabs.reports', 'Reports'),
    },
  };
  const shouldRespectBackNavigation =
    reviewContinueStep != null && wizardDisplayStep < wizardProgressStep;
  const mountedWorkflowStep =
    wizardDisplayStep === 4
      ? 4
      : activeVesinvestPlan &&
          wizardProgressStep > wizardDisplayStep &&
          !shouldRespectBackNavigation
      ? wizardProgressStep
      : wizardDisplayStep;
  const overviewVisualStep = getPresentedOverviewWorkflowStep(mountedWorkflowStep);
  const wizardHero = wizardStepContent[overviewVisualStep];
  const isStep2SupportChrome = overviewVisualStep === 2;
  const summaryMetaBlocks = [
    {
      label: t('v2Overview.organizationLabel', 'Organization'),
      value:
        activeVesinvestPlan?.utilityName ??
        importStatus.link?.nimi ??
        '-',
    },
    {
      label: t('v2Overview.businessIdLabel', 'Business ID'),
      value: activeVesinvestPlan?.businessId ?? importStatus.link?.ytunnus ?? '-',
    },
    {
      label: t('v2Overview.lastFetchLabel', 'Last fetch'),
      value: formatDateTime(importStatus.link?.lastFetchedAt),
    },
    {
      label: t('v2Overview.wizardCurrentFocus'),
      value: wizardHero.badge,
    },
  ];
  const compactWizardSummaryItems = [
    wizardSummaryItems[1],
    wizardSummaryItems[2],
    mountedWorkflowStep === 3 || mountedWorkflowStep === 4
      ? null
      : wizardSummaryItems[4],
  ].filter((item): item is (typeof wizardSummaryItems)[number] => item != null);
  const connectButtonClass =
    overviewVisualStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    overviewVisualStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    overviewVisualStep === 2 || overviewVisualStep === 3
      ? 'v2-btn v2-btn-primary'
      : 'v2-btn';
  const planningBaselineButtonClass =
    overviewVisualStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    overviewVisualStep === PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS
      ? 'v2-btn v2-btn-primary'
      : 'v2-btn';

  const setWorkbookSelection = (
    year: number,
    sourceField: V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
    action: 'keep_veeti' | 'apply_workbook',
  ) => {
    setWorkbookImportSelections((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] ?? {}),
        [sourceField]: action,
      },
    }));
  };
  const workbookImportWorkflowProps = {
    t,
    workbookImportBusy,
    manualPatchBusy,
    workbookFileInputRef,
    workbookImportPreview,
    workbookImportStatus,
    workbookImportError,
    hasWorkbookImportPreviewValues,
    workbookImportComparisonYears,
    sourceStatusLabel,
    setWorkbookSelection,
    submitWorkbookImport,
    hasWorkbookApplySelections,
    formatEur,
  };
  const manualPatchViewModel = buildOverviewManualPatchViewModel(
    controller,
    isAdmin,
  );
  const connectSurface =
    mountedWorkflowStep === 1 ? (
      <OverviewConnectStep
        t={t}
        workflowStep={overviewVisualStep}
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          setSelectedOrg(null);
        }}
        onSearch={() => void handleSearch()}
        searching={searching}
        connecting={connecting}
        importingYears={importingYears}
        syncing={syncing}
        searchResults={searchResults}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        renderHighlightedSearchMatch={renderHighlightedSearchMatch}
        selectedOrgStillVisible={selectedOrgStillVisible}
        selectedOrgName={selectedOrgName}
        selectedOrgBusinessId={selectedOrgBusinessId}
        selectedOrgMunicipality={selectedOrgMunicipality}
        selectedOrgReadyToConnect={selectedOrg != null}
        onConnect={(org) => {
          setSelectedOrg(org);
          void handleConnect(org);
        }}
      />
    ) : null;
  const showSimplifiedPostChoiceSetup =
    activeVesinvestPlan != null &&
    mountedWorkflowStep === 3 &&
    confirmedImportedYears.length === 0 &&
    !baselineReady;
  const showImportYearsSurface =
    mountedWorkflowStep === 2 || showSimplifiedPostChoiceSetup;
  const shouldCompactPlanningPanel =
    !showSimplifiedPostChoiceSetup &&
    (mountedWorkflowStep === 3 || mountedWorkflowStep === 4);
  const importYearsSurface =
    showImportYearsSurface ? (
      <OverviewImportBoard
        t={t}
        workflowStep={overviewVisualStep}
        wizardBackLabel={wizardBackLabel}
        onBack={handleWizardBack}
        selectedYears={selectedYears}
        syncing={syncing}
        readyRows={readyTrustBoardRows}
        suspiciousRows={suspiciousTrustBoardRows}
        blockedRows={blockedTrustBoardRows}
        parkedRows={parkedTrustBoardRows}
        currentYearEstimateRows={currentYearEstimateBoardRows}
        confirmedImportedYears={confirmedImportedYears}
        yearDataCache={yearDataCache}
        cardEditYear={cardEditYear}
        cardEditContext={cardEditContext}
        cardEditFocusField={cardEditFocusField}
        isAdmin={isAdmin}
        renderStep2InlineFieldEditor={renderStep2InlineFieldEditor}
        buildRepairActions={buildRepairActions}
        sourceStatusLabel={sourceStatusLabel}
        sourceStatusClassName={sourceStatusClassName}
        sourceLayerText={sourceLayerText}
        renderDatasetCounts={renderDatasetCounts}
        missingRequirementLabel={missingRequirementLabel}
        attemptOpenInlineCardEditor={attemptOpenInlineCardEditor}
        openInlineCardEditor={openInlineCardEditor}
        loadingYearData={loadingYearData}
        manualPatchError={manualPatchError}
        blockedYearCount={blockedYearCount}
        onToggleYear={(year) => toggleYear(year, null)}
        onImportYears={handleImportYears}
        onAddCurrentYearEstimate={handleAddCurrentYearEstimate}
        importYearsButtonClass={importYearsButtonClass}
        importingYears={importingYears}
      />
    ) : null;
  const shouldLeadWithActionSurface =
    overviewVisualStep === 1 ||
    overviewVisualStep === 2 ||
    overviewVisualStep === 3;
  const shouldShowVesinvestPanel =
    importStatus.connected === true || activeVesinvestPlan != null;
  const useSupportRail =
    overviewVisualStep !== PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS;
  const compactSupportingChrome = shouldLeadWithActionSurface;
  const supportingChromeEyebrow = compactSupportingChrome
    ? t('v2Overview.wizardSummaryTitle')
    : t('v2Overview.wizardLabel');
  const supportingChromeTitle = compactSupportingChrome
    ? t('v2Overview.wizardSummarySubtitle')
    : wizardHero.title;

  const heroGrid = useSupportRail ? (
    <OverviewSupportRail
      t={t}
      workflowStep={overviewVisualStep}
      isStep2SupportChrome={isStep2SupportChrome}
      compactSupportingChrome={compactSupportingChrome}
      supportingChromeEyebrow={supportingChromeEyebrow}
      supportingChromeTitle={supportingChromeTitle}
      wizardHero={wizardHero}
      summaryMetaBlocks={summaryMetaBlocks}
      wizardSummaryItems={
        compactSupportingChrome ? compactWizardSummaryItems : wizardSummaryItems
      }
    />
  ) : null;

  const activeSurface = (
    <div className="v2-overview-active-surface">
      {shouldShowVesinvestPanel ? (
          <VesinvestPlanningPanel
            t={t}
            isAdmin={isAdmin}
            simplifiedSetup={showSimplifiedPostChoiceSetup}
            compactReviewMode={shouldCompactPlanningPanel}
            planningContext={planningContext}
            linkedOrg={overview?.importStatus.link ?? null}
            onGoToForecast={onGoToForecast}
            onGoToReports={_onGoToReports}
            onPlansChanged={() =>
              loadOverview({
                preserveVisibleState: true,
                preserveSelectionState: true,
                preserveReviewContinueStep: true,
                refreshPlanningContext: true,
              })
            }
          />
        ) : null}

        {connectSurface}

        {importYearsSurface}


      <input
        ref={workbookFileInputRef}
        type="file"
        id="v2-overview-workbook-upload"
        name="workbookUpload"
        data-import-kind="workbook"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleWorkbookSelected}
        disabled={workbookImportBusy || manualPatchBusy}
        hidden
      />
      <input
        ref={documentFileInputRef}
        type="file"
        id="v2-overview-document-upload"
        name="documentUpload"
        data-import-kind="document"
        accept="application/pdf"
        onChange={handleDocumentPdfSelected}
        disabled={documentImportBusy || manualPatchBusy}
        hidden
      />

      <OverviewManualPatchPanel
        controller={controller}
        manualPatchViewModel={manualPatchViewModel}
        workbookImportWorkflowProps={workbookImportWorkflowProps}
      />
      {!showSimplifiedPostChoiceSetup &&
      (mountedWorkflowStep === 3 || mountedWorkflowStep === 4) ? (
        <OverviewReviewBoard
          t={t}
          workflowStep={overviewVisualStep}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          reviewStatusRows={reviewStatusRows}
          yearDataCache={yearDataCache}
          cardEditContext={cardEditContext}
          cardEditYear={cardEditYear}
          manualPatchYear={manualPatchYear}
          renderYearValuePreview={renderYearValuePreview}
          sourceStatusClassName={sourceStatusClassName}
          sourceStatusLabel={sourceStatusLabel}
          setupStatusClassName={setupStatusClassName}
          setupStatusLabel={setupStatusLabel}
          yearStatusRowClassName={yearStatusRowClassName}
          importWarningLabel={importWarningLabel}
          missingRequirementLabel={missingRequirementLabel}
          isAdmin={isAdmin}
          buildRepairActions={buildRepairActions}
          openInlineCardEditor={openInlineCardEditor}
          saveReviewWorkspaceYear={saveReviewWorkspaceYear}
          manualPatchMode={manualPatchMode}
          manualPatchBusy={manualPatchBusy}
          manualPatchError={manualPatchError}
          documentImportBusy={documentImportBusy}
          documentImportStatus={documentImportStatus}
          documentImportError={documentImportError}
          documentImportPreview={documentImportPreview}
          documentImportReviewedKeys={controller.documentImportReviewedKeys}
          handleSelectDocumentImportMatch={controller.handleSelectDocumentImportMatch}
          isCurrentYearReadyForReview={manualPatchViewModel.isCurrentYearReadyForReview}
          isManualYearExcluded={manualPatchViewModel.isManualYearExcluded}
          canReapplyFinancialVeetiForYear={manualPatchViewModel.canReapplyFinancialVeetiForYear}
          canReapplyPricesForYear={manualPatchViewModel.canReapplyPricesForYear}
          canReapplyVolumesForYear={manualPatchViewModel.canReapplyVolumesForYear}
          keepYearButtonClass={manualPatchViewModel.keepYearButtonClass}
          fixYearButtonClass={manualPatchViewModel.fixYearButtonClass}
          handleKeepCurrentYearValues={handleKeepCurrentYearValues}
          handleSwitchToManualEditMode={handleSwitchToManualEditMode}
          handleSwitchToDocumentImportMode={handleSwitchToDocumentImportMode}
          handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
          handleRestoreManualYearToPlan={handleRestoreManualYearToPlan}
          handleExcludeManualYearFromPlan={handleExcludeManualYearFromPlan}
          handleModalApplyVeetiFinancials={handleModalApplyVeetiFinancials}
          handleModalApplyVeetiPrices={handleModalApplyVeetiPrices}
          handleModalApplyVeetiVolumes={handleModalApplyVeetiVolumes}
          closeInlineCardEditor={closeInlineCardEditor}
          workbookImportBusy={workbookImportBusy}
          canConfirmImportWorkflow={canConfirmImportWorkflow}
          isInlineCardDirty={isInlineCardDirty}
          documentFileInputRef={documentFileInputRef}
          setInlineCardFieldRef={setInlineCardFieldRef}
          manualFinancials={manualFinancials}
          setManualFinancials={setManualFinancials}
          manualPrices={manualPrices}
          setManualPrices={setManualPrices}
          manualVolumes={manualVolumes}
          setManualVolumes={setManualVolumes}
          saveInlineCardEdit={saveInlineCardEdit}
          workbookImportWorkflowProps={workbookImportWorkflowProps}
          reviewContinueButtonClass={reviewContinueButtonClass}
          onContinueFromReview={handleContinueFromReview}
          importedBlockedYearCount={importedBlockedYearCount}
          pendingReviewYearCount={pendingReviewYearCount}
          technicalReadyYearsLabel={technicalReadyYearsLabel}
        />
      ) : null}

      {mountedWorkflowStep === 5 ? (
        <OverviewPlanningBaselineStep
          t={t}
          workflowStep={overviewVisualStep}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          includedPlanningYears={includedPlanningYears}
          excludedYearsSorted={excludedYearsSorted}
          correctedPlanningYears={correctedPlanningYears}
          correctedPlanningManualDataTypes={correctedPlanningManualDataTypes}
          correctedPlanningVeetiDataTypes={correctedPlanningVeetiDataTypes}
          correctedYearsLabel={correctedYearsLabel}
          includedPlanningYearsLabel={includedPlanningYearsLabel}
          renderDatasetTypeList={renderDatasetTypeList}
          planningBaselineButtonClass={planningBaselineButtonClass}
          onCreatePlanningBaseline={() => void handleCreatePlanningBaseline()}
          creatingPlanningBaseline={creatingPlanningBaseline}
          importedBlockedYearCount={importedBlockedYearCount}
        />
      ) : null}

      {mountedWorkflowStep === 6 && hasBaselineBudget ? (
        <OverviewForecastHandoffStep
          t={t}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          acceptedPlanningYearRows={acceptedPlanningYearRows}
          correctedPlanningYears={correctedPlanningYears}
          excludedYearsSorted={excludedYearsSorted}
          sourceStatusClassName={sourceStatusClassName}
          sourceStatusLabel={sourceStatusLabel}
          renderDatasetCounts={renderDatasetCounts}
          renderYearValuePreview={renderYearValuePreview}
          openForecastButtonClass={openForecastButtonClass}
          onManageYears={handleManageYears}
          onReopenReview={handleReopenReview}
          onReopenYearReview={(year) => void handleReopenYearReview(year)}
          onDeleteYear={(year) => void handleDeleteYear(year)}
          onExcludeYear={(year) => void handleExcludeYearFromPlan(year)}
          onRestoreYear={(year) => void handleRestoreYearToPlan(year)}
          onRestoreVeeti={(year) => void handleRestoreYearVeeti(year)}
          onOpenForecast={handleOpenForecastHandoff}
        />
      ) : null}

      </div>
  );

  const useCompactWorkspaceLayout =
    useSupportRail && shouldLeadWithActionSurface;

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
      {useCompactWorkspaceLayout ? (
        heroGrid ? (
          <div className="v2-overview-workspace-layout">
            {activeSurface}
            {heroGrid}
          </div>
        ) : (
          activeSurface
        )
      ) : (
        shouldLeadWithActionSurface ? (
          <>
            {activeSurface}
            {heroGrid}
          </>
        ) : heroGrid ? (
          <>
            {heroGrid}
            {activeSurface}
          </>
        ) : (
          activeSurface
        )
      )}
    </div>
  );
};
