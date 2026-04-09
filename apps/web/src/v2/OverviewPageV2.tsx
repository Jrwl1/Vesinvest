import React from 'react';
import { type V2WorkbookPreviewResponse } from '../api';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import { OverviewImportBoard } from './OverviewImportBoard';
import { OverviewQdisImportWorkflow } from './OverviewQdisImportWorkflow';
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
import type { QdisFieldKey, QdisFieldMatch } from './qdisPdfImport';
import {
  buildStatementOcrComparisonRows,
  normalizeStatementOcrFieldValue,
  type StatementOcrFieldKey,
  type StatementOcrMatch,
} from './statementOcrParse';
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
};

type StatementImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<StatementOcrFieldKey, number>>;
  matches: StatementOcrMatch[];
  warnings: string[];
};

type QdisImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<QdisFieldKey, number>>;
  matches: QdisFieldMatch[];
  warnings: string[];
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
    statementImportBusy,
    setStatementImportBusy,
    statementImportStatus,
    setStatementImportStatus,
    statementImportError,
    setStatementImportError,
    statementImportPreview,
    setStatementImportPreview,
    workbookImportBusy,
    setWorkbookImportBusy,
    workbookImportStatus,
    setWorkbookImportStatus,
    workbookImportError,
    setWorkbookImportError,
    workbookImportPreview,
    setWorkbookImportPreview,
    workbookImportSelections,
    setWorkbookImportSelections,
    qdisImportBusy,
    setQdisImportBusy,
    qdisImportStatus,
    setQdisImportStatus,
    qdisImportError,
    setQdisImportError,
    qdisImportPreview,
    setQdisImportPreview,
    handledSetupBackSignalRef,
    baselineReady,
    backendAcceptedPlanningYears,
    statementFileInputRef,
    workbookFileInputRef,
    qdisFileInputRef,
    resetStatementImportState,
    resetWorkbookImportState,
    resetQdisImportState,
    setInlineCardFieldRef,
    yearDataCache,
    setYearDataCache,
    loadingYearData,
    manualPatchYear,
    setManualPatchYear,
    cardEditYear,
    setCardEditYear,
    cardEditFocusField,
    setCardEditFocusField,
    cardEditContext,
    setCardEditContext,
    manualPatchMode,
    setManualPatchMode,
    manualPatchMissing,
    setManualPatchMissing,
    manualPatchBusy,
    setManualPatchBusy,
    manualPatchError,
    setManualPatchError,
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
    openManualPatchDialog,
    resetManualPatchDialog,
    closeManualPatchDialog,
    handleAddCurrentYearEstimate,
    applyOcrFinancialMatch,
    handleWorkbookSelected,
    handleStatementPdfSelected,
    handleQdisPdfSelected,
    buildWorkbookImportPayloads,
    submitWorkbookImport,
    submitManualPatch,
    renderStep2InlineFieldEditor,
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
    handleSwitchToStatementImportMode,
    handleSwitchToWorkbookImportMode,
    handleSwitchToQdisImportMode,
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
    isStatementImportMode,
    isWorkbookImportMode,
    isQdisImportMode,
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
    statementImportComparisonRows,
    hasStatementImportPreviewValues,
    qdisImportComparisonRows,
    hasQdisPreviewValues,
    workbookImportComparisonYears,
    hasWorkbookImportPreviewValues,
    hasWorkbookApplySelections,
    canConfirmStatementImport,
    canConfirmQdisImport,
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
  const readyYearsLabel =
    reviewedImportedYearRows.length > 0
      ? reviewedImportedYearRows.map((row) => row.vuosi).join(', ')
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
      value: String(reviewedImportedYearRows.length),
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
      title: t('v2Vesinvest.workflowCreatePlan', 'Create Vesinvest plan'),
      body: t(
        'v2Vesinvest.workflowCreatePlanBody',
        'Start with the investment plan. Manual utility identity works immediately, and VEETI can enrich the utility later.',
      ),
      badge: t('v2Vesinvest.workflowPlanFirst', 'Plan-first'),
    },
    2: {
      title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
      body: t(
        'v2Vesinvest.workflowIdentifyUtilityBody',
        'Confirm utility name and business ID manually, or bring them from VEETI without making VEETI the main workflow.',
      ),
      badge: t('v2Vesinvest.workflowIdentity', 'Identity'),
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
  const wizardHero = wizardStepContent[wizardProgressStep];
  const overviewVisualStep = activeVesinvestPlan ? wizardProgressStep : wizardDisplayStep;
  const evidenceWorkflowStep = activeVesinvestPlan
    ? (wizardProgressStep >= 4 ? 4 : wizardProgressStep)
    : wizardDisplayStep;
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

    if (wizardProgressStep === 1) {
      return [
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
          body: t(
            'v2Vesinvest.workflowCreatePlanNextBody',
            'Save the first plan draft, then confirm the utility identity manually or enrich it from VEETI.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (wizardProgressStep === 2) {
      return [
        {
          key: 'prior',
          label: t('v2Overview.wizardContextNow'),
          title: t('v2Vesinvest.workflowCreatePlan', 'Create Vesinvest plan'),
          body: t(
            'v2Vesinvest.workflowIdentityPriorBody',
            'The plan draft already exists. Confirm the utility name, business ID, and identity source before fee-path work begins.',
          ),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Vesinvest.workflowBuildPlan', 'Build the investment plan'),
          body: t(
            'v2Vesinvest.workflowIdentityNextBody',
            'Add project rows, codes, and yearly allocations across the full horizon before baseline verification.',
          ),
          tone: 'neutral',
        },
      ];
    }

    if (wizardProgressStep === 3) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
          body: t(
            'v2Vesinvest.workflowBuildPlanPriorBody',
            'Manual identity and optional VEETI enrichment stay visible while the project register is being built.',
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

    if (wizardProgressStep === 4) {
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

    if (wizardProgressStep === 5) {
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

    return wizardProgressStep === 6
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
    wizardDisplayStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    wizardDisplayStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    wizardDisplayStep === 3 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const planningBaselineButtonClass =
    wizardDisplayStep === 5 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    wizardDisplayStep === 6 ? 'v2-btn v2-btn-primary' : 'v2-btn';

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
  const qdisImportWorkflowProps = {
    t,
    qdisImportBusy,
    manualPatchBusy,
    qdisFileInputRef,
    qdisImportPreview,
    qdisImportStatus,
    qdisImportError,
    qdisImportComparisonRows,
    formatPrice,
    formatNumber,
  };
  const manualPatchViewModel = buildOverviewManualPatchViewModel(
    controller,
    isAdmin,
  );
  const connectSurface =
    wizardDisplayStep === 1 ? (
      <OverviewConnectStep
        t={t}
        workflowStep={evidenceWorkflowStep}
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
        connectButtonClass={connectButtonClass}
        connectDisabled={
          !preferredSearchOrg ||
          searching ||
          connecting ||
          importingYears ||
          syncing
        }
        onConnect={() => void handleConnect(preferredSearchOrg)}
      />
    ) : null;
  const importYearsSurface =
    wizardDisplayStep === 2 ? (
      <OverviewImportBoard
        t={t}
        workflowStep={evidenceWorkflowStep}
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
        openManualPatchDialog={openManualPatchDialog}
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
        <VesinvestPlanningPanel
          t={t}
          isAdmin={isAdmin}
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

        {!activeVesinvestPlan || evidenceWorkflowStep >= 4 ? connectSurface : null}

        {!activeVesinvestPlan || evidenceWorkflowStep >= 4 ? importYearsSurface : null}

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
                              {isBlocked
                                ? t(
                                    'v2Overview.yearNeedsCompletion',
                                    'Needs completion',
                                  )
                                : row.setupStatus === 'reviewed'
                                  ? t('v2Overview.yearReviewed', 'Tarkistettu')
                                  : t('v2Overview.yearReadyForReview', 'Tarkista')}
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
        ref={statementFileInputRef}
        type="file"
        id="v2-overview-statement-upload"
        name="statementUpload"
        data-import-kind="statement"
        accept="application/pdf"
        onChange={handleStatementPdfSelected}
        disabled={statementImportBusy || manualPatchBusy}
        hidden
      />
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
        ref={qdisFileInputRef}
        type="file"
        id="v2-overview-qdis-upload"
        name="qdisUpload"
        data-import-kind="qdis"
        accept="application/pdf"
        onChange={handleQdisPdfSelected}
        disabled={qdisImportBusy || manualPatchBusy}
        hidden
      />

      <OverviewManualPatchPanel
        controller={controller}
        manualPatchViewModel={manualPatchViewModel}
        workbookImportWorkflowProps={workbookImportWorkflowProps}
        qdisImportWorkflowProps={qdisImportWorkflowProps}
      />
      {wizardDisplayStep === 3 ? (
        <OverviewReviewBoard
          t={t}
          workflowStep={evidenceWorkflowStep}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          reviewStatusRows={reviewStatusRows}
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
          manualPatchMode={manualPatchMode}
          manualPatchBusy={manualPatchBusy}
          manualPatchError={manualPatchError}
          isCurrentYearReadyForReview={manualPatchViewModel.isCurrentYearReadyForReview}
          isManualYearExcluded={manualPatchViewModel.isManualYearExcluded}
          canReapplyFinancialVeetiForYear={manualPatchViewModel.canReapplyFinancialVeetiForYear}
          canReapplyPricesForYear={manualPatchViewModel.canReapplyPricesForYear}
          canReapplyVolumesForYear={manualPatchViewModel.canReapplyVolumesForYear}
          keepYearButtonClass={manualPatchViewModel.keepYearButtonClass}
          fixYearButtonClass={manualPatchViewModel.fixYearButtonClass}
          handleKeepCurrentYearValues={handleKeepCurrentYearValues}
          handleSwitchToManualEditMode={handleSwitchToManualEditMode}
          handleSwitchToStatementImportMode={handleSwitchToStatementImportMode}
          handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
          handleSwitchToQdisImportMode={handleSwitchToQdisImportMode}
          handleRestoreManualYearToPlan={handleRestoreManualYearToPlan}
          handleExcludeManualYearFromPlan={handleExcludeManualYearFromPlan}
          handleModalApplyVeetiFinancials={handleModalApplyVeetiFinancials}
          handleModalApplyVeetiPrices={handleModalApplyVeetiPrices}
          handleModalApplyVeetiVolumes={handleModalApplyVeetiVolumes}
          closeInlineCardEditor={closeInlineCardEditor}
          statementImportBusy={statementImportBusy}
          statementImportStatus={statementImportStatus}
          statementImportPreview={statementImportPreview}
          statementImportComparisonRows={statementImportComparisonRows}
          workbookImportBusy={workbookImportBusy}
          qdisImportBusy={qdisImportBusy}
          canConfirmImportWorkflow={canConfirmImportWorkflow}
          statementFileInputRef={statementFileInputRef}
          setInlineCardFieldRef={setInlineCardFieldRef}
          manualFinancials={manualFinancials}
          setManualFinancials={setManualFinancials}
          manualPrices={manualPrices}
          setManualPrices={setManualPrices}
          manualVolumes={manualVolumes}
          setManualVolumes={setManualVolumes}
          saveInlineCardEdit={saveInlineCardEdit}
          workbookImportWorkflowProps={workbookImportWorkflowProps}
          qdisImportWorkflowProps={qdisImportWorkflowProps}
          reviewContinueButtonClass={reviewContinueButtonClass}
          onContinueFromReview={handleContinueFromReview}
          importedBlockedYearCount={importedBlockedYearCount}
          pendingReviewYearCount={pendingReviewYearCount}
          technicalReadyYearsLabel={technicalReadyYearsLabel}
        />
      ) : null}

      {wizardDisplayStep === 5 ? (
        <OverviewPlanningBaselineStep
          t={t}
          workflowStep={evidenceWorkflowStep}
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

      {wizardDisplayStep === 6 && hasBaselineBudget ? (
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
