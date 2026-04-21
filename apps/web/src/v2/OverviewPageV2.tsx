import React from 'react';
import { type V2WorkbookPreviewResponse } from '../api';
import { formatEur } from './format';
import { OverviewImportBoard } from './OverviewImportBoard';
import { OverviewReviewBoard } from './OverviewReviewBoard';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from './OverviewWizardPanels';
import {
  VesinvestPlanningPanel,
  type VesinvestOverviewFocusTarget,
} from './VesinvestPlanningPanel';
import { OverviewWorkbookImportWorkflow } from './OverviewWorkbookImportWorkflow';
import { OverviewSupportRail } from './OverviewSupportRail';
import { OverviewManualPatchPanel } from './OverviewManualPatchPanel';
import { buildOverviewManualPatchViewModel } from './overviewManualPatchModel';
import { type SetupWizardState } from './overviewWorkflow';
import { buildOverviewPageViewModel } from './overviewPageViewModel';

import { useOverviewPageController } from './useOverviewPageController';
type Props = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  overviewFocusTarget?: VesinvestOverviewFocusTarget | null;
  onOverviewFocusTargetConsumed?: () => void;
  onSavedFeePathReportConflict?: (planId?: string | null) => void;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupPlanStateChange?: (
    state: {
      activePlanId: string | null;
      linkedScenarioId: string | null;
      classificationReviewRequired: boolean;
      pricingStatus: 'blocked' | 'provisional' | 'verified' | null;
      baselineChangedSinceAcceptedRevision: boolean;
      investmentPlanChangedSinceFeeRecommendation: boolean;
    } | null,
  ) => void;
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

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  overviewFocusTarget,
  onOverviewFocusTargetConsumed,
  onSavedFeePathReportConflict,
  onSetupWizardStateChange,
  onSetupPlanStateChange,
  onSetupOrgNameChange,
  onOrgLanguageNoticeChange,
  setupBackSignal,
}) => {
  const controller = useOverviewPageController({
    onGoToForecast,
    onGoToReports: _onGoToReports,
    isAdmin,
    onSetupWizardStateChange,
    onSetupPlanStateChange,
    onSetupOrgNameChange,
    onOrgLanguageNoticeChange,
    setupBackSignal,
  });
  const [collapsedPlanningPanelOpenStep, setCollapsedPlanningPanelOpenStep] =
    React.useState<number | null>(null);
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
    markManualFieldTouched,
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
    trashbinTrustBoardRows,
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
    excludeYearFromImportBoard,
    restoreYearFromImportBoard,
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

  const {
    activeVesinvestPlan,
    collapsePlanningPanelInSetup,
    compactSupportingChrome,
    connectButtonClass,
    correctedYearsLabel,
    demotePlanningPanelInSetup,
    handoffExcludedYearsSorted,
    hasBaselineBudget,
    importStatus,
    importYearsButtonClass,
    includedPlanningYearsLabel,
    isManageYearsMaintenanceMode,
    isStep2SupportChrome,
    mountedWorkflowStep,
    nextAction,
    openForecastButtonClass,
    overviewVisualStep,
    planningBaselineButtonClass,
    reviewContinueButtonClass,
    selectedOrgBusinessId,
    selectedOrgMunicipality,
    selectedOrgName,
    shouldCompactPlanningPanel,
    shouldShowVesinvestPanel,
    showSimplifiedPostChoiceSetup,
    showSupportNextActionBlock,
    summaryMetaBlocks,
    supportingChromeEyebrow,
    supportingChromeTitle,
    supportStatusItems,
    supportWorkflowStep,
    technicalReadyYearsLabel,
    useCompactSetupSupportChrome,
    useCompactWorkspaceLayout,
    useReviewDominantLayout,
    useSupportRail,
  } = buildOverviewPageViewModel({
    controller,
    overview,
    t,
  });

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
  const showImportYearsSurface =
    mountedWorkflowStep === 2 || showSimplifiedPostChoiceSetup;
  const importYearsSurface =
    showImportYearsSurface ? (
      <OverviewImportBoard
        t={t}
        workflowStep={isManageYearsMaintenanceMode ? 3 : overviewVisualStep}
        mode={isManageYearsMaintenanceMode ? 'manage' : 'import'}
        wizardBackLabel={wizardBackLabel}
        onBack={handleWizardBack}
        selectedYears={selectedYears}
        syncing={syncing}
        readyRows={readyTrustBoardRows}
        suspiciousRows={suspiciousTrustBoardRows}
        blockedRows={blockedTrustBoardRows}
        trashbinRows={trashbinTrustBoardRows}
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
        removingYear={removingYear}
        onToggleYear={(year) => toggleYear(year, null)}
        onImportYears={handleImportYears}
        onAddCurrentYearEstimate={handleAddCurrentYearEstimate}
        onTrashYear={(year) => void excludeYearFromImportBoard(year)}
        onRestoreYear={(year) => void restoreYearFromImportBoard(year)}
        importYearsButtonClass={importYearsButtonClass}
        importingYears={importingYears}
      />
    ) : null;
  const heroGrid = useSupportRail ? (
    <OverviewSupportRail
      t={t}
      workflowStep={supportWorkflowStep}
      isStep2SupportChrome={isStep2SupportChrome}
      compactSupportingChrome={useCompactSetupSupportChrome}
      supportingChromeEyebrow={supportingChromeEyebrow}
      supportingChromeTitle={supportingChromeTitle}
      summaryMetaBlocks={summaryMetaBlocks}
      supportStatusItems={supportStatusItems}
      nextAction={nextAction}
      showNextActionBlock={showSupportNextActionBlock}
    />
  ) : null;

  const planningPanelDisclosureOpen =
    collapsedPlanningPanelOpenStep === overviewVisualStep ||
    overviewFocusTarget != null;

  const planningPanelContent = (
    <VesinvestPlanningPanel
      t={t}
      isAdmin={isAdmin}
      simplifiedSetup={showSimplifiedPostChoiceSetup}
      compactReviewMode={shouldCompactPlanningPanel}
      planningContext={planningContext}
      linkedOrg={overview?.importStatus.link ?? null}
      onGoToForecast={onGoToForecast}
      onGoToReports={_onGoToReports}
      overviewFocusTarget={overviewFocusTarget}
      onOverviewFocusTargetConsumed={() => {
        if (collapsePlanningPanelInSetup) {
          setCollapsedPlanningPanelOpenStep(overviewVisualStep);
        }
        onOverviewFocusTargetConsumed?.();
      }}
      onSavedFeePathReportConflict={onSavedFeePathReportConflict}
      onPlansChanged={() =>
        loadOverview({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          refreshPlanningContext: true,
        })
      }
    />
  );
  const planningPanel = shouldShowVesinvestPanel ? (
    <div
      className={`v2-overview-planning-shell${
        demotePlanningPanelInSetup
          ? ' v2-overview-planning-shell-secondary'
          : ''
      }`}
    >
      {collapsePlanningPanelInSetup ? (
        <details
          className="v2-overview-planning-shell-toggle"
          open={planningPanelDisclosureOpen}
          onToggle={(event) => {
            setCollapsedPlanningPanelOpenStep(
              event.currentTarget.open ? overviewVisualStep : null,
            );
          }}
        >
          <summary>
            <div className="v2-overview-planning-shell-toggle-copy">
              <span>{t('v2Vesinvest.eyebrow', 'Vesinvest')}</span>
              <strong>
                {activeVesinvestPlan?.name ??
                  activeVesinvestPlan?.utilityName ??
                  overview?.importStatus.link?.nimi ??
                  t('v2Vesinvest.title', 'Vesinvest workspace')}
              </strong>
            </div>
          </summary>
          <div className="v2-overview-planning-shell-toggle-body">
            {planningPanelContent}
          </div>
        </details>
      ) : (
        planningPanelContent
      )}
    </div>
  ) : null;

  const activeSurface = (
    <div className="v2-overview-active-surface">
      {demotePlanningPanelInSetup ? null : planningPanel}

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
          markManualFieldTouched={markManualFieldTouched}
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
          excludedYearsSorted={handoffExcludedYearsSorted}
          sourceStatusClassName={sourceStatusClassName}
          sourceStatusLabel={sourceStatusLabel}
          renderDatasetCounts={renderDatasetCounts}
          renderYearValuePreview={renderYearValuePreview}
          openForecastButtonClass={openForecastButtonClass}
          onManageYears={handleManageYears}
          onReopenYearReview={(year) => void handleReopenYearReview(year)}
          onDeleteYear={(year) => void handleDeleteYear(year)}
          onExcludeYear={(year) => void handleExcludeYearFromPlan(year)}
          onRestoreYear={(year) => void handleRestoreYearToPlan(year)}
          onRestoreVeeti={(year) => void handleRestoreYearVeeti(year)}
          onOpenForecast={handleOpenForecastHandoff}
        />
      ) : null}

      {demotePlanningPanelInSetup ? planningPanel : null}

      </div>
  );

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
      {useCompactWorkspaceLayout ? (
        heroGrid ? (
          <div
            className={`v2-overview-workspace-layout${
              useReviewDominantLayout ? ' step3-review-layout' : ''
            }`}
          >
            {activeSurface}
            {heroGrid}
          </div>
        ) : (
          activeSurface
        )
      ) : (
        compactSupportingChrome ? (
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
