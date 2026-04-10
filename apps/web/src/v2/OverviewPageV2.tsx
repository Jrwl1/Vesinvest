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
  getMissingSyncRequirements,
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
  setupBackSignal?: number;
  onChangeCompanyReset?: (confirmToken: string) => Promise<void>;
  changeCompanyConfirmToken?: string | null;
  changeCompanyBusy?: boolean;
};
type ImportWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

type WizardContextHelperTone = 'neutral' | 'positive' | 'warning';

type WizardContextHelper = {
  key: string;
  label: string;
  title: string;
  body: string;
  tone: WizardContextHelperTone;
};

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
  setupBackSignal,
  onChangeCompanyReset,
  changeCompanyConfirmToken,
  changeCompanyBusy = false,
}) => {
  const controller = useOverviewPageController({
    onGoToForecast,
    onGoToReports: _onGoToReports,
    isAdmin,
    onSetupWizardStateChange,
    onSetupOrgNameChange,
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
  const importStep = Math.min(setupWizardState?.activeStep ?? 1, 3) as 1 | 2 | 3;
  const activeVesinvestPlan = planningContext?.vesinvest?.activePlan ?? null;
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
  const wizardStepContent: Record<
    number,
    { title: string; body: string; badge: string }
  > = {
    1: {
      title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
      body: t(
        'v2Vesinvest.workflowIdentifyUtilityBody',
        'Search and connect the VEETI utility before creating the first Vesinvest plan.',
      ),
      badge: t('v2Vesinvest.workflowPlanFirst', 'VEETI-first'),
    },
    2: {
      title: t('v2Vesinvest.workflowCreatePlan', 'Create Vesinvest plan'),
      body: t(
        'v2Vesinvest.workflowCreatePlanBody',
        'After the VEETI utility is connected, create the first plan revision and carry the linked identity into Vesinvest.',
      ),
      badge: t('v2Vesinvest.eyebrow', 'Vesinvest'),
    },
    3: {
      title: t('v2Vesinvest.workflowBuildPlan', 'Build the investment plan'),
      body: t(
        'v2Vesinvest.workflowBuildPlanBody',
        'Add project codes, groups, and yearly allocations across the 20-year horizon before baseline verification.',
      ),
      badge: t('v2Vesinvest.investmentPlan', 'Investment plan'),
    },
    4: {
      title: t(
        'v2Vesinvest.workflowVerifyEvidence',
        'Verify baseline & evidence',
      ),
      body: t(
        'v2Vesinvest.workflowVerifyEvidenceBody',
        'Use VEETI, PDF, workbook, or manual corrections to verify the accepted baseline that pricing will rely on.',
      ),
      badge: t('v2Vesinvest.evidenceTitle', 'Accepted baseline years'),
    },
    5: {
      title: t('v2Vesinvest.workflowOpenFeePath', 'Open fee path'),
      body: t(
        'v2Vesinvest.workflowOpenFeePathBody',
        'When the baseline is verified, sync the plan to forecast to review price pressure, financing gaps, and the saved recommendation.',
      ),
      badge: t('v2Vesinvest.feePathEyebrow', 'Fee path'),
    },
    6: {
      title: t('v2Vesinvest.workflowCreateReport', 'Create report'),
      body: t(
        'v2Vesinvest.workflowCreateReportBody',
        'Create the report after the fee path is saved and the linked scenario is up to date.',
      ),
      badge: t('v2Shell.tabs.reports', 'Reports'),
    },
  };
  const mountedWorkflowStep =
    wizardDisplayStep === 4
      ? 4
      : activeVesinvestPlan && wizardProgressStep >= 4
      ? wizardProgressStep
      : wizardDisplayStep;
  const overviewVisualStep = mountedWorkflowStep;
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
    wizardSummaryItems[4],
  ].filter((item): item is (typeof wizardSummaryItems)[number] => item != null);
  const wizardContextHelpers: WizardContextHelper[] = (() => {
    const priorLabel = t('v2Overview.wizardContextEarlier');
    const nextLabel = t('v2Overview.wizardContextNext');

    if (overviewVisualStep === 1) {
      return [
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowCreatePlan', 'Create Vesinvest plan'),
          body: t(
            'v2Vesinvest.workflowCreatePlanNextBody',
            'After the VEETI utility is connected, create the first plan revision.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (overviewVisualStep === 2) {
      return [
        {
          key: 'prior',
          label: t('v2Overview.wizardContextNow'),
          title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
          body: t(
            'v2Vesinvest.workflowIdentityPriorBody',
            'The VEETI utility is now linked to this workspace and its identity carries into the plan.',
          ),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowBuildPlan', 'Build the investment plan'),
          body: t(
            'v2Vesinvest.workflowIdentityNextBody',
            'Save the first plan revision, then add project rows, codes, and yearly allocations across the full horizon.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (overviewVisualStep === 3) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Vesinvest.workflowCreatePlan', 'Create Vesinvest plan'),
          body: t(
            'v2Vesinvest.workflowBuildPlanPriorBody',
            'The VEETI link and saved plan revision stay visible while the project register is being built.',
          ),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t(
            'v2Vesinvest.workflowVerifyEvidence',
            'Verify baseline & evidence',
          ),
          body: t(
            'v2Vesinvest.workflowBuildPlanNextBody',
            'After the investment plan is in place, verify the accepted baseline through VEETI, PDF, workbook, or manual corrections.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (overviewVisualStep === 4) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Vesinvest.workflowBuildPlan', 'Build the investment plan'),
          body: t(
            'v2Vesinvest.workflowEvidencePriorBody',
            'The investment register stays as the source of truth while baseline evidence is reviewed and corrected.',
          ),
          tone: 'warning',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowOpenFeePath', 'Open fee path'),
          body: t(
            'v2Vesinvest.workflowEvidenceNextBody',
            'Once the accepted baseline is verified, open the fee path from the plan to review pricing and financing pressure.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (overviewVisualStep === 5) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t(
            'v2Vesinvest.workflowVerifyEvidence',
            'Verify baseline & evidence',
          ),
          body: t(
            'v2Vesinvest.workflowFeePathPriorBody',
            'The accepted baseline is ready. Open the fee path from this revision to persist the pricing recommendation.',
          ),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowCreateReport', 'Create report'),
          body: t(
            'v2Vesinvest.workflowFeePathNextBody',
            'After the fee path is saved and the linked scenario is current, create the report from the plan workspace.',
          ),
          tone: 'neutral',
        },
      ];
    }

    return overviewVisualStep === 6
      ? []
      : [
          {
            key: 'prior',
            label: priorLabel,
            title: t('v2Vesinvest.workflowOpenFeePath', 'Open fee path'),
            body: t(
              'v2Vesinvest.workflowReportPriorBody',
              'The saved fee-path recommendation and linked scenario are ready for reporting.',
            ),
            tone: 'positive',
          },
        ];
  })();
  const connectButtonClass =
    mountedWorkflowStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    mountedWorkflowStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    mountedWorkflowStep === 3 || mountedWorkflowStep === 4
      ? 'v2-btn v2-btn-primary'
      : 'v2-btn';
  const planningBaselineButtonClass =
    mountedWorkflowStep === 5 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    mountedWorkflowStep === 6 ? 'v2-btn v2-btn-primary' : 'v2-btn';

  const handleChangeCompany = async () => {
    if (!onChangeCompanyReset || !changeCompanyConfirmToken) {
      return;
    }
    const confirmed = window.confirm(
      t(
        'v2Shell.clearDataConfirm',
        'This clears all VEETI imports and forecast scenarios for your organization. Continue?',
      ),
    );
    if (!confirmed) {
      return;
    }
    const typedToken = window.prompt(
      t(
        'v2Shell.clearDataTypePrompt',
        'Type {{token}} to confirm database clear.',
        { token: changeCompanyConfirmToken },
      ),
      '',
    );
    if (typedToken == null) {
      return;
    }
    if (
      typedToken.trim().toUpperCase() !==
      changeCompanyConfirmToken.trim().toUpperCase()
    ) {
      setError(
        t(
          'v2Shell.clearDataTypeMismatch',
          'Confirmation text did not match. Database was not cleared.',
        ),
      );
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await onChangeCompanyReset(typedToken);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Shell.clearDataFailed', 'Database clear failed.'),
      );
    }
  };

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
        workflowStep={mountedWorkflowStep}
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
  const importYearsSurface =
    showImportYearsSurface ? (
      <OverviewImportBoard
        t={t}
        workflowStep={mountedWorkflowStep}
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
  const useSupportRail = overviewVisualStep !== 6;
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
      wizardContextHelpers={wizardContextHelpers}
    />
  ) : null;

  const activeSurface = (
    <div className="v2-overview-active-surface">
        {isAdmin &&
        importStatus.connected &&
        onChangeCompanyReset &&
        changeCompanyConfirmToken ? (
          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn v2-btn-danger"
              onClick={() => void handleChangeCompany()}
              disabled={
                changeCompanyBusy || connecting || importingYears || syncing
              }
            >
              {changeCompanyBusy
                ? t('v2Shell.clearDataBusy', 'Clearing...')
                : t('v2Overview.changeCompanyButton', 'Vaihda vesilaitos')}
            </button>
          </div>
        ) : null}
        {shouldShowVesinvestPanel ? (
          <VesinvestPlanningPanel
            t={t}
            isAdmin={isAdmin}
            simplifiedSetup={showSimplifiedPostChoiceSetup}
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

      {(globalThis as { __vp_unused_legacy_import_panel__?: boolean })
        .__vp_unused_legacy_import_panel__ ? (
      <section>
        <article className="v2-card">
          <div className="v2-section-header">
            <h2>{t('v2Overview.importTitle', 'Import VEETI')}</h2>
            <strong className="v2-import-progress">
              {t('v2Overview.importStepProgress', 'Step {{step}} / 3', {
                step: importStep,
              })}
            </strong>
          </div>
          <p className="v2-muted">
            {t(
              'v2Overview.wizardBodyImportYears',
              'Choose the years you want in this workspace. After import you will immediately see which years are included.',
            )}
          </p>

          <ol className="v2-import-stepper" aria-label="VEETI import steps">
            <li className={!importStatus.connected ? 'current' : 'done'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepOneHelp',
                  'Search by name or business ID and connect the imported organization.',
                )}
              </span>
            </li>
            <li
              className={
                !importStatus.connected
                  ? 'pending'
                  : importStep === 2
                  ? 'current'
                  : 'done'
              }
            >
              <strong>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepTwoHelp',
                  'Select the years you want to bring into this workspace.',
                )}
              </span>
            </li>
            <li className={importStep === 3 ? 'current' : 'pending'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardBodyReviewYears',
                  'Tarkista jokainen vuosi yhdestä paikasta. Tässä vaiheessa tarkoitus on ymmärtää vuosien tila ennen korjauksia tai rajauksia.',
                )}
              </span>
            </li>
          </ol>

          <section
            className={`v2-import-panel ${
              importStatus.connected ? 'done' : 'current'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </h3>
              <span
                className={`v2-chip ${
                  importStatus.connected
                    ? 'v2-status-positive'
                    : 'v2-status-warning'
                }`}
              >
                {importStatus.connected
                  ? t('v2Overview.connected', 'Connected')
                  : t('v2Overview.disconnected', 'Not connected')}
              </span>
            </div>

            <div className="v2-import-org-summary">
              <div>
                <strong>
                  {t('v2Overview.organizationLabel', 'Organization')}:{' '}
                  {selectedOrgName}
                </strong>
                <span>
                  {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                  {selectedOrgBusinessId}
                </span>
                {selectedOrg?.Kunta ? (
                  <span>
                    {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                    {selectedOrg?.Kunta}
                  </span>
                ) : null}
              </div>
              {selectedOrgStillVisible ? (
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={() => setSelectedOrg(null)}
                  disabled={connecting || importingYears || syncing}
                >
                  {t('v2Overview.clearSelectionButton', 'Clear selection')}
                </button>
              ) : null}
            </div>

            <div className="v2-inline-form">
              <input
                id="v2-overview-org-search"
                name="orgSearch"
                className="v2-input"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedOrg(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  if (preferredSearchOrg) {
                    void handleConnect(preferredSearchOrg);
                    return;
                  }
                  void handleSearch();
                }}
                disabled={connecting || importingYears || syncing}
                placeholder={t(
                  'v2Overview.searchPlaceholder',
                  'Search by name or business ID',
                )}
              />
              <button
                className="v2-btn"
                type="button"
                onClick={handleSearch}
                disabled={
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing ||
                  query.trim().length < 2
                }
              >
                {searching
                  ? t('v2Overview.searchingButton', 'Searching...')
                  : t('v2Overview.searchButton', 'Search')}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="v2-result-list">
                {searchResults.map((org) => {
                  const isActive = selectedOrg?.Id === org.Id;
                  const orgName =
                    org.Nimi ??
                    t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                      id: org.Id,
                    });
                  return (
                    <button
                      type="button"
                      key={org.Id}
                      className={`v2-result-row ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedOrg(org);
                        void handleConnect(org);
                      }}
                      disabled={connecting || importingYears || syncing}
                    >
                      <div className="v2-result-main">
                        <strong>{renderHighlightedSearchMatch(orgName)}</strong>
                        <span>
                          {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                          {renderHighlightedSearchMatch(org.YTunnus ?? '-')}
                        </span>
                      </div>
                      <div className="v2-result-meta">
                        <span>
                          {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                          {renderHighlightedSearchMatch(org.Kunta ?? '-')}
                        </span>
                        {isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.resultSelected', 'Selected')}
                          </span>
                        ) : null}
                        {!isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.connectButton', 'Yhdistä organisaatio')}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="v2-actions-row">
              <button
                type="button"
                className={connectButtonClass}
                onClick={() => void handleConnect(preferredSearchOrg)}
                disabled={
                  !preferredSearchOrg ||
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing
                }
              >
                {connecting
                  ? t('v2Overview.connectingButton', 'Connecting...')
                  : importStatus.connected
                  ? t(
                      'v2Overview.connectSelectedButton',
                      'Yhdistä organisaatio',
                    )
                  : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
              </button>
            </div>
          </section>

          <section
            id="v2-import-years"
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 2
                ? 'current'
                : 'done'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </h3>
              <span className="v2-chip">
                {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
                {selectedYears.length}
              </span>
            </div>

            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.yearSelectionLocked',
                  'Connect an organization first to review and select years.',
                )}
              </p>
            ) : (
              <>
                {recommendedYears.length > 0 ? (
                  <p className="v2-muted">
                    {t('v2Overview.availableYearsHint', 'Available years: {{years}}', {
                      years: recommendedYears.join(', '),
                    })}
                  </p>
                ) : null}

                {importYearRows.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.noImportedYears',
                      'No imported years available yet.',
                    )}
                  </p>
                ) : (
                  <div className="v2-year-readiness-table">
                    {importYearRows.map((row) => {
                      const isBlocked = row.syncBlockedReason != null;
                      const visibleReadyCount = [
                        row.completeness.tilinpaatos === true,
                        row.completeness.taksa === true,
                        row.completeness.tariff_revenue !== false,
                        row.completeness.volume_vesi === true ||
                          row.completeness.volume_jatevesi === true,
                      ].filter(Boolean).length;
                      const yearBucketLabel = !isBlocked
                        ? t('v2Overview.reviewBucketReadyTitle', 'Good to go')
                        : visibleReadyCount <= 1
                        ? t(
                            'v2Overview.reviewBucketSparseTitle',
                            'Almost nothing here',
                          )
                        : t(
                            'v2Overview.reviewBucketRepairTitle',
                            'Needs filling',
                          );
                      return (
                        <div
                          key={row.vuosi}
                          className={`v2-year-readiness-row ${
                            isBlocked ? 'blocked' : 'ready'
                          }`}
                        >
                          <div className="v2-year-readiness-head">
                            <label
                              className={`v2-year-checkbox ${
                                isBlocked ? 'v2-year-select-disabled' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                name={`syncYear-${row.vuosi}`}
                                checked={selectedYears.includes(row.vuosi)}
                                onChange={() =>
                                  toggleYear(row.vuosi, row.syncBlockedReason)
                                }
                                disabled={syncing || isBlocked}
                              />
                              <strong>{row.vuosi}</strong>
                            </label>
                            <span
                              className={`v2-chip ${isBlocked ? 'warn' : 'ok'}`}
                            >
                              {isBlocked && row.setupStatus === 'excluded_from_plan'
                                ? t('v2Overview.setupStatusExcludedShort')
                                : yearBucketLabel}
                            </span>
                            <span
                              className={`v2-badge ${sourceStatusClassName(
                                row.sourceStatus,
                              )}`}
                            >
                              {sourceStatusLabel(row.sourceStatus)}
                            </span>
                          </div>

                          {isBlocked ? (
                            <p className="v2-year-readiness-missing">
                              {t(
                                'v2Overview.yearMissingLabel',
                                'Missing requirements: {{requirements}}',
                                {
                                  requirements: row.missingRequirements
                                    .map((item) =>
                                      missingRequirementLabel(item),
                                    )
                                    .join(', '),
                                },
                              )}
                            </p>
                          ) : null}

                          {row.warnings && row.warnings.length > 0 ? (
                            <p className="v2-muted">
                              {row.warnings
                                .map((warning) => importWarningLabel(warning))
                                .join(' ')}
                            </p>
                          ) : null}

                          {renderYearValuePreview(row.vuosi, {
                            financials:
                              row.readinessChecks.find(
                                (check) => check.key === 'financials',
                              )?.ready === true,
                            prices:
                              row.readinessChecks.find(
                                (check) => check.key === 'prices',
                              )?.ready === true,
                            volumes:
                              row.readinessChecks.find(
                                (check) => check.key === 'volumes',
                              )?.ready === true,
                          })}

                          <p className="v2-muted">
                            {t(
                              'v2Overview.datasetCountsSecondaryLabel',
                              'Imported rows in background data',
                            )}
                            :{' '}
                            {renderDatasetCounts(
                              row.datasetCounts as
                                | Record<string, number>
                                | undefined,
                            )}
                          </p>

                          {isAdmin
                            ? buildRepairActions(
                                row.vuosi,
                                row.missingRequirements,
                              ).map((action) => (
                                <button
                                  key={`${row.vuosi}-${action.key}`}
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={() =>
                                    void openInlineCardEditor(
                                      row.vuosi,
                                      action.focusField,
                                      'step3',
                                      row.missingRequirements,
                                      'manualEdit',
                                    )
                                  }
                                >
                                  {action.label}
                                </button>
                              ))
                            : null}
                          {isBlocked && isAdmin ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.manualPatchButton',
                                'Complete manually',
                              )}
                            </button>
                          ) : null}
                          {!isBlocked ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.openReviewYearButton',
                                'Avaa ja tarkista',
                              )}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {blockedYearCount > 0 && !isAdmin ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.manualPatchAdminOnlyHint',
                      'Manual completion is available for admins only.',
                    )}
                  </p>
                ) : null}
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className={importYearsButtonClass}
                    onClick={handleImportYears}
                    disabled={
                      !importStatus.connected ||
                      importingYears ||
                      syncing ||
                      selectedYears.length === 0
                    }
                  >
                    {importingYears
                      ? t('v2Overview.importingYearsButton', 'Tuodaan vuosia...')
                      : t('v2Overview.importYearsButton', 'Tuo valitut vuodet')}
                  </button>
                </div>
              </>
            )}
          </section>

          <section
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 3
                ? 'current'
                : 'pending'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </h3>
            </div>
            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.importReviewLocked',
                  'Connect an organization before starting import.',
                )}
              </p>
            ) : (
              <>
                {selectedYears.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.importedYearsPending',
                      'Valitse ainakin yksi vuosi vaiheessa 2, jotta näet mitä työtilassa on mukana.',
                    )}
                  </p>
                ) : (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.wizardContextImportedWorkspaceYearsBody',
                      'Imported workspace years: {{years}}. Review them in the same setup flow before building the planning baseline.',
                      {
                        years:
                          confirmedImportedYears.length > 0
                            ? confirmedImportedYears.join(', ')
                            : t('v2Overview.noYearsSelected', 'None selected'),
                      },
                    )}
                  </p>
                )}
              </>
            )}
          </section>
        </article>
      </section>
      ) : null}

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
          workflowStep={mountedWorkflowStep}
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
          workflowStep={mountedWorkflowStep}
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
