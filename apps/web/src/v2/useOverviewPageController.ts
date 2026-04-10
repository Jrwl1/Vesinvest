import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  completeImportYearManuallyV2,
  getImportYearDataV2,
  type V2ImportYearDataResponse,
} from '../api';
import {
  getDatasetSourceLabel as buildDatasetSourceLabel,
  getFinancialComparisonLabel as buildFinancialComparisonLabel,
  getImportWarningLabel as buildImportWarningLabel,
  getMissingRequirementLabel as buildMissingRequirementLabel,
  getPriceComparisonLabel as buildPriceComparisonLabel,
  getSourceLayerText as buildSourceLayerText,
  getSourceStatusClassName as buildSourceStatusClassName,
  getSourceStatusLabel as buildSourceStatusLabel,
  getVolumeComparisonLabel as buildVolumeComparisonLabel,
  renderDatasetCounts as formatDatasetCounts,
  renderDatasetTypeList as formatDatasetTypeList,
} from './overviewLabels';
import {
  renderOverviewHighlightedSearchMatch,
  renderOverviewStep2InlineFieldEditor,
  renderOverviewYearValuePreview,
} from './overviewRenderers';
import {
  buildFinancialForm,
  buildPriceForm,
  buildVolumeForm,
  deriveAdjustedYearResult,
  formsDiffer,
  numbersDiffer,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import { useOverviewImportController } from './useOverviewImportController';
import { useOverviewManualPatchController } from './useOverviewManualPatchController';
import { useOverviewReviewController } from './useOverviewReviewController';
import { useOverviewReviewSelectors } from './overviewReviewSelectors';
import { useOverviewSetupState } from './useOverviewSetupState';
import {
  getSyncBlockReasonKey,
  resolveVesinvestWorkflowState,
  resolveSetupWizardStateFromImportStatus,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import {
  buildImportYearSourceLayers,
  markPersistedReviewedImportYears,
} from './yearReview';

export type OverviewPageControllerProps = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
  setupBackSignal?: number;
};

type ReviewWorkspaceYearSaveParams = {
  year: number;
  financials: ManualFinancialForm;
  prices: ManualPriceForm;
  volumes: ManualVolumeForm;
  syncAfterSave?: boolean;
};

type ReviewWorkspaceYearSaveResult = {
  syncReady: boolean;
  yearData: V2ImportYearDataResponse;
};

function getPersistedManualReason(
  yearData: V2ImportYearDataResponse | undefined,
): string {
  return (
    yearData?.datasets
      .map((row) => row.overrideMeta?.reason ?? '')
      .find((reason) => reason.trim().length > 0) ?? ''
  );
}

export function useOverviewPageController({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
  setupBackSignal,
}: OverviewPageControllerProps) {
  const { t } = useTranslation();

  const resolveSyncBlockReason = React.useCallback(
    (row: { completeness: Record<string, boolean> }): string | null => {
      const key = getSyncBlockReasonKey({
        vuosi: 0,
        completeness: row.completeness,
      });
      if (!key) {
        return null;
      }
      if (key === 'v2Overview.yearReasonMissingFinancials') {
        return t(key, 'Missing financial statement data.');
      }
      if (key === 'v2Overview.yearReasonMissingPrices') {
        return t(key, 'Missing price data (taksa).');
      }
      if (key === 'v2Overview.yearReasonMissingTariffRevenue') {
        return t(key, 'Fixed revenue is needed to reconcile tariff revenue.');
      }
      return t(key, 'Missing sold volume data.');
    },
    [t],
  );

  const pickDefaultSyncYears = React.useCallback(
    (rows: Array<{
      vuosi: number;
      completeness: Record<string, boolean>;
      planningRole?: 'historical' | 'current_year_estimate';
    }>) =>
      [...rows]
        .filter((row) => row.planningRole !== 'current_year_estimate')
        .filter((row) => resolveSyncBlockReason(row) === null)
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi),
    [resolveSyncBlockReason],
  );

  const manualController = useOverviewManualPatchController({ t });
  const importController = useOverviewImportController({
    t,
    pickDefaultSyncYears,
    setYearDataCache: manualController.setYearDataCache,
  });

  const {
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
  } = useOverviewSetupState({
    overview: importController.overview,
    yearDataCache: manualController.yearDataCache,
    selectedYears: importController.selectedYears,
    importedWorkspaceYears: importController.importedWorkspaceYears,
    backendAcceptedPlanningYears: importController.backendAcceptedPlanningYears,
    reviewedImportedYears: importController.reviewedImportedYears,
    setReviewedImportedYears: importController.setReviewedImportedYears,
    manualPatchYear: manualController.manualPatchYear,
    cardEditYear: manualController.cardEditYear,
    cardEditContext: manualController.cardEditContext,
    reviewContinueStep: importController.reviewContinueStep,
    baselineReady: importController.baselineReady,
    t,
  });

  const activeVesinvestPlan = React.useMemo(
    () =>
      importController.planningContext?.vesinvest?.activePlan ??
      importController.planningContext?.vesinvest?.selectedPlan ??
      null,
    [
      importController.planningContext?.vesinvest?.activePlan,
      importController.planningContext?.vesinvest?.selectedPlan,
    ],
  );

  const activeVesinvestScenario = React.useMemo(
    () =>
      activeVesinvestPlan?.selectedScenarioId != null
        ? (importController.scenarioList ?? []).find(
            (item) => item.id === activeVesinvestPlan.selectedScenarioId,
          ) ?? null
        : null,
    [activeVesinvestPlan?.selectedScenarioId, importController.scenarioList],
  );

  const shellSetupWizardState = React.useMemo(() => {
    if (!importController.overview) {
      return null;
    }
    return resolveSetupWizardStateFromImportStatus(
      importController.overview.importStatus,
      importController.planningContext,
      {
        selectedProblemYear: displaySetupWizardState?.selectedProblemYear ?? null,
        selectedScenario: activeVesinvestScenario,
      },
    );
  }, [
    activeVesinvestScenario,
    displaySetupWizardState?.selectedProblemYear,
    importController.overview,
    importController.planningContext,
  ]);

  const displayedWorkflowStep = React.useMemo(() => {
    if (!shellSetupWizardState || !importController.overview) {
      return wizardDisplayStep;
    }
    const workflowStep = resolveVesinvestWorkflowState(
      importController.overview.importStatus,
      importController.planningContext,
      {
        selectedScenario: activeVesinvestScenario,
      },
    ).currentStep;
    return (wizardDisplayStep === 4
      ? 4
      : activeVesinvestPlan && workflowStep > wizardDisplayStep
        ? workflowStep
        : wizardDisplayStep) as typeof shellSetupWizardState.currentStep;
  }, [
    activeVesinvestPlan,
    activeVesinvestScenario,
    importController.overview,
    importController.planningContext,
    shellSetupWizardState,
    wizardDisplayStep,
  ]);

  const presentedSetupWizardState = React.useMemo(() => {
    if (!shellSetupWizardState) {
      return null;
    }
    const shellDrivesPresentedState =
      displayedWorkflowStep !== 4 &&
      activeVesinvestPlan != null &&
      displayedWorkflowStep >= 4;
    const baseState =
      shellDrivesPresentedState
        ? shellSetupWizardState
        : displaySetupWizardState ?? shellSetupWizardState;
    return {
      ...baseState,
      currentStep: displayedWorkflowStep,
      activeStep: displayedWorkflowStep,
      selectedProblemYear:
        displayedWorkflowStep === 4
          ? displaySetupWizardState?.selectedProblemYear ??
            baseState.selectedProblemYear ??
            shellSetupWizardState.selectedProblemYear
          : null,
      wizardComplete: shellSetupWizardState.wizardComplete,
      forecastUnlocked: shellSetupWizardState.forecastUnlocked,
      reportsUnlocked: shellSetupWizardState.reportsUnlocked,
      summary: {
        ...baseState.summary,
        baselineReady: shellSetupWizardState.summary.baselineReady,
      },
    };
  }, [
    activeVesinvestPlan,
    displaySetupWizardState?.selectedProblemYear,
    displaySetupWizardState,
    displayedWorkflowStep,
    shellSetupWizardState,
  ]);

  const saveInlineCardEdit = React.useCallback(
    async (syncAfterSave = false) =>
      manualController.saveInlineCardEdit({
        syncAfterSave,
        loadOverview: importController.loadOverview,
        runSync: importController.runSync,
        reviewStatusRows,
        confirmedImportedYears,
        reviewStorageOrgId,
        baselineReady: importController.baselineReady,
        setReviewedImportedYears: importController.setReviewedImportedYears,
        setReviewContinueStep: importController.setReviewContinueStep,
        setError: importController.setError,
        setInfo: importController.setInfo,
      }),
    [
      confirmedImportedYears,
      importController,
      manualController,
      reviewStatusRows,
      reviewStorageOrgId,
    ],
  );

  const handleInlineCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        manualController.dismissInlineCardEditor(true);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') {
          return;
        }
        event.preventDefault();
        void saveInlineCardEdit(false);
      }
    },
    [manualController, saveInlineCardEdit],
  );

  const renderHighlightedSearchMatch = React.useCallback(
    (value: string): React.ReactNode =>
      renderOverviewHighlightedSearchMatch(value, importController.searchTerm),
    [importController.searchTerm],
  );

  const openManualPatchDialog = manualController.openManualPatchDialog;

  const resetManualPatchDialog = React.useCallback(() => {
    importController.setReviewContinueStep(null);
    manualController.resetManualPatchDialogState();
  }, [importController.setReviewContinueStep, manualController]);

  const closeManualPatchDialog = React.useCallback(() => {
    if (
      manualController.manualPatchBusy ||
      manualController.documentImportBusy ||
      manualController.workbookImportBusy
    ) {
      return;
    }
    resetManualPatchDialog();
  }, [manualController, resetManualPatchDialog]);

  const handleAddCurrentYearEstimate = React.useCallback(
    async (year: number, missingRequirements: MissingRequirement[]) => {
      try {
        await importController.importYearsIntoWorkspace([year]);
        if (isAdmin && missingRequirements.length > 0) {
          await manualController.openManualPatchDialog(
            year,
            missingRequirements,
            'manualEdit',
          );
        }
      } catch {
        // importYearsIntoWorkspace already surfaces the error state
      }
    },
    [importController, isAdmin, manualController],
  );

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => buildSourceStatusLabel(t, status),
    [t],
  );

  const sourceStatusClassName = React.useCallback(
    (status: string | undefined) => buildSourceStatusClassName(status),
    [],
  );

  const financialComparisonLabel = React.useCallback(
    (key: string) => buildFinancialComparisonLabel(t, key),
    [t],
  );

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: Parameters<typeof buildDatasetSourceLabel>[2],
    ) => buildDatasetSourceLabel(t, source, provenance),
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => formatDatasetTypeList(t, dataTypes),
    [t],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => buildImportWarningLabel(t, warning),
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => formatDatasetCounts(t, counts),
    [t],
  );

  const missingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) =>
      buildMissingRequirementLabel(t, requirement),
    [t],
  );

  const sourceLayerText = React.useCallback(
    (layer: ReturnType<typeof buildImportYearSourceLayers>[number]): string =>
      buildSourceLayerText(t, layer),
    [t],
  );

  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') =>
      buildPriceComparisonLabel(t, key),
    [t],
  );

  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') =>
      buildVolumeComparisonLabel(t, key),
    [t],
  );

  const loadYearPreviewData = React.useCallback(
    async (year: number) => {
      if (
        manualController.yearDataCache[year] ||
        importController.previewFetchYearsRef.current.has(year)
      ) {
        return;
      }
      importController.previewFetchYearsRef.current.add(year);
      try {
        const yearData = await getImportYearDataV2(year);
        manualController.setYearDataCache((prev) =>
          prev[year] ? prev : { ...prev, [year]: yearData },
        );
      } catch {
        // Preview cards fall back gracefully when data is unavailable.
      } finally {
        importController.previewFetchYearsRef.current.delete(year);
      }
    },
    [importController.previewFetchYearsRef, manualController],
  );

  const renderYearValuePreview = React.useCallback(
    (
      year: number,
      availability?: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
      options?: {
        compact?: boolean;
      },
    ) =>
      renderOverviewYearValuePreview({
        year,
        t,
        yearDataCache: manualController.yearDataCache,
        sourceLayerText,
        availability,
        options,
      }),
    [manualController.yearDataCache, sourceLayerText, t],
  );

  const renderStep2InlineFieldEditor = React.useCallback(
    (field: Parameters<typeof renderOverviewStep2InlineFieldEditor>[0]['field']) =>
      renderOverviewStep2InlineFieldEditor({
        field,
        t,
        cardEditYear: manualController.cardEditYear,
        manualPatchBusy: manualController.manualPatchBusy,
        manualFinancials: manualController.manualFinancials,
        setManualFinancials: manualController.setManualFinancials,
        manualPrices: manualController.manualPrices,
        setManualPrices: manualController.setManualPrices,
        manualVolumes: manualController.manualVolumes,
        setManualVolumes: manualController.setManualVolumes,
        setInlineCardFieldRef: manualController.setInlineCardFieldRef,
        handleInlineCardKeyDown,
        saveInlineCardEdit,
        dismissInlineCardEditor: manualController.dismissInlineCardEditor,
      }),
    [handleInlineCardKeyDown, manualController, saveInlineCardEdit, t],
  );

  const saveReviewWorkspaceYear = React.useCallback(
    async ({
      year,
      financials,
      prices,
      volumes,
      syncAfterSave = false,
    }: ReviewWorkspaceYearSaveParams): Promise<ReviewWorkspaceYearSaveResult> => {
      if (financials.liikevaihto < 0) {
        throw new Error(
          t(
            'v2Overview.manualPatchFinancialsRequired',
            'Revenue (Liikevaihto) cannot be negative.',
          ),
        );
      }

      const cachedYearData =
        manualController.yearDataCache[year] ?? (await getImportYearDataV2(year));
      if (!manualController.yearDataCache[year]) {
        manualController.setYearDataCache((prev) => ({
          ...prev,
          [year]: cachedYearData,
        }));
      }

      const originalFinancials = buildFinancialForm(cachedYearData);
      const originalPrices = buildPriceForm(cachedYearData);
      const originalVolumes = buildVolumeForm(cachedYearData);
      const payload = {
        year,
        reason: getPersistedManualReason(cachedYearData) || undefined,
      } as const;

      const nextPayload: {
        year: number;
        reason?: string;
        financials?: ManualFinancialForm;
        prices?: ManualPriceForm;
        volumes?: ManualVolumeForm;
      } = { ...payload };

      if (formsDiffer(financials, originalFinancials)) {
        const nextFinancials = { ...financials };
        const resultFieldChanged = numbersDiffer(
          financials.tilikaudenYliJaama,
          originalFinancials.tilikaudenYliJaama,
        );
        const visibleFinanceFieldsChanged =
          numbersDiffer(financials.liikevaihto, originalFinancials.liikevaihto) ||
          numbersDiffer(
            financials.aineetJaPalvelut,
            originalFinancials.aineetJaPalvelut,
          ) ||
          numbersDiffer(
            financials.henkilostokulut,
            originalFinancials.henkilostokulut,
          ) ||
          numbersDiffer(
            financials.liiketoiminnanMuutKulut,
            originalFinancials.liiketoiminnanMuutKulut,
          ) ||
          numbersDiffer(financials.poistot, originalFinancials.poistot) ||
          numbersDiffer(
            financials.arvonalentumiset,
            originalFinancials.arvonalentumiset,
          ) ||
          numbersDiffer(
            financials.rahoitustuototJaKulut,
            originalFinancials.rahoitustuototJaKulut,
          ) ||
          numbersDiffer(
            financials.omistajatuloutus,
            originalFinancials.omistajatuloutus,
          ) ||
          numbersDiffer(
            financials.omistajanTukiKayttokustannuksiin,
            originalFinancials.omistajanTukiKayttokustannuksiin,
          );

        if (!resultFieldChanged && visibleFinanceFieldsChanged) {
          nextFinancials.tilikaudenYliJaama = deriveAdjustedYearResult(
            originalFinancials,
            financials,
          );
        }

        nextPayload.financials = nextFinancials;
      }

      if (formsDiffer(prices, originalPrices)) {
        nextPayload.prices = { ...prices };
      }

      if (formsDiffer(volumes, originalVolumes)) {
        nextPayload.volumes = { ...volumes };
      }

      if (
        !nextPayload.financials &&
        !nextPayload.prices &&
        !nextPayload.volumes
      ) {
        throw new Error(
          t(
            'v2Overview.manualPatchNoChanges',
            'No changes detected. Update at least one field before saving.',
          ),
        );
      }

      importController.setError(null);
      importController.setInfo(null);

      const result = await completeImportYearManuallyV2(nextPayload);
      if (result.syncReady) {
        importController.setReviewedImportedYears(
          markPersistedReviewedImportYears(
            reviewStorageOrgId,
            [year],
            [...confirmedImportedYears, year],
          ),
        );
      }

      if (syncAfterSave && result.syncReady) {
        await importController.runSync([year]);
      } else {
        await importController.loadOverview({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
        importController.setInfo(t('v2Overview.manualPatchSaved', { year }));
      }

      const refreshedYearData = await getImportYearDataV2(year);
      manualController.setYearDataCache((prev) => ({
        ...prev,
        [year]: refreshedYearData,
      }));

      return {
        syncReady: result.syncReady,
        yearData: refreshedYearData,
      };
    },
    [
      confirmedImportedYears,
      importController,
      manualController,
      reviewStorageOrgId,
      t,
    ],
  );

  const reviewController = useOverviewReviewController({
    t,
    importController,
    manualController,
    reviewStatusRows,
    reviewStorageOrgId,
    confirmedImportedYears,
    reviewedImportedYearRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    includedPlanningYears,
    excludedYearsSorted,
    correctedPlanningYears,
    wizardBackStep,
    openManualPatchDialog,
    resetManualPatchDialog,
    onGoToForecast,
  });

  const setupStatusLabel = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return t('v2Overview.setupStatusReviewed', 'Reviewed');
      }
      if (status === 'ready_for_review') {
        return t('v2Overview.setupStatusTechnicalReady', 'Ready for review');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded');
      }
      return t('v2Overview.setupStatusNeedsAttention');
    },
    [t],
  );

  const setupStatusClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return 'v2-status-positive';
      }
      if (status === 'ready_for_review') {
        return 'v2-status-info';
      }
      if (status === 'excluded_from_plan') {
        return 'v2-status-provenance';
      }
      return 'v2-status-warning';
    },
    [],
  );

  const yearStatusRowClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => status,
    [],
  );

  const reviewSelectors = useOverviewReviewSelectors({
    t,
    isAdmin,
    manualController,
    wizardBackStep,
    financialComparisonLabel,
    priceComparisonLabel,
    volumeComparisonLabel,
  });

  React.useEffect(() => {
    for (const year of previewPrefetchYears) {
      void loadYearPreviewData(year);
    }
  }, [loadYearPreviewData, previewPrefetchYears]);

  React.useEffect(() => {
    if (!presentedSetupWizardState) {
      return;
    }
    onSetupWizardStateChange?.(presentedSetupWizardState);
  }, [
    onSetupWizardStateChange,
    presentedSetupWizardState,
  ]);

  React.useEffect(() => {
    if (!setupBackSignal) {
      return;
    }
    if (setupBackSignal === importController.handledSetupBackSignalRef.current) {
      return;
    }
    importController.handledSetupBackSignalRef.current = setupBackSignal;
    reviewController.handleWizardBack();
  }, [reviewController, importController.handledSetupBackSignalRef, setupBackSignal]);

  React.useEffect(() => {
    if (importController.loading) {
      return;
    }
    onSetupOrgNameChange?.(
      (importController.planningContext?.vesinvest?.activePlan?.utilityName ??
        importController.planningContext?.vesinvest?.selectedPlan?.utilityName) ??
        importController.overview?.importStatus.link?.nimi ??
        null,
    );
  }, [
    importController.loading,
    importController.planningContext?.vesinvest?.activePlan?.utilityName,
    importController.planningContext?.vesinvest?.selectedPlan?.utilityName,
    importController.overview?.importStatus.link?.nimi,
    onSetupOrgNameChange,
  ]);

  return {
    t,
    ...importController,
    ...manualController,
    resolveSyncBlockReason,
    pickDefaultSyncYears,
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    recommendedYears,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    parkedTrustBoardRows,
    blockedTrustBoardRows,
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
    currentYearEstimateBoardRows,
    saveInlineCardEditBase: manualController.saveInlineCardEdit,
    saveInlineCardEdit,
    handleInlineCardKeyDown,
    renderHighlightedSearchMatch,
    openManualPatchDialog,
    resetManualPatchDialog,
    closeManualPatchDialog,
    handleAddCurrentYearEstimate,
    submitWorkbookImport: reviewController.submitWorkbookImport,
    submitManualPatch: reviewController.submitManualPatch,
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
    handleManageYears: reviewController.handleManageYears,
    handleReopenReview: reviewController.handleReopenReview,
    handleDeleteYear: reviewController.handleDeleteYear,
    handleExcludeYearFromPlan: reviewController.handleExcludeYearFromPlan,
    handleRestoreYearToPlan: reviewController.handleRestoreYearToPlan,
    handleRestoreYearVeeti: reviewController.handleRestoreYearVeeti,
    handleReopenYearReview: reviewController.handleReopenYearReview,
    handleApplyVeetiReconcile: reviewController.handleApplyVeetiReconcile,
    handleKeepCurrentYearValues: reviewController.handleKeepCurrentYearValues,
    handleSwitchToDocumentImportMode:
      reviewController.handleSwitchToDocumentImportMode,
    handleSwitchToWorkbookImportMode:
      reviewController.handleSwitchToWorkbookImportMode,
    handleExcludeManualYearFromPlan:
      reviewController.handleExcludeManualYearFromPlan,
    handleRestoreManualYearToPlan:
      reviewController.handleRestoreManualYearToPlan,
    handleModalApplyVeetiFinancials:
      reviewController.handleModalApplyVeetiFinancials,
    handleModalApplyVeetiPrices: reviewController.handleModalApplyVeetiPrices,
    handleModalApplyVeetiVolumes: reviewController.handleModalApplyVeetiVolumes,
    setupStatusLabel,
    setupStatusClassName,
    yearStatusRowClassName,
    handleContinueFromReview: reviewController.handleContinueFromReview,
    handleCreatePlanningBaseline: reviewController.handleCreatePlanningBaseline,
    handleOpenForecastHandoff: reviewController.handleOpenForecastHandoff,
    missingRequirementLabel,
    sourceLayerText,
    priceComparisonLabel,
    volumeComparisonLabel,
    ...reviewSelectors,
    handleWizardBack: reviewController.handleWizardBack,
  };
}

export type OverviewPageController = ReturnType<typeof useOverviewPageController>;
