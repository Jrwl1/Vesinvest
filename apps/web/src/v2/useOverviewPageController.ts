import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  getImportYearDataV2,
  type V2ImportYearDataResponse,
} from '../api';
import {
  getSyncBlockReasonLabel as buildSyncBlockReasonLabel,
} from './overviewLabels';
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
import { renderOverviewHighlightedSearchMatch } from './overviewRenderers';
import { useOverviewReviewSelectors } from './overviewReviewSelectors';
import { pickDefaultBaselineYears } from './overviewSelectors';
import {
  resolveSetupWizardStateFromImportStatus,
  resolveVesinvestWorkflowState,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import { useOverviewImportController } from './useOverviewImportController';
import { useOverviewManualPatchController } from './useOverviewManualPatchController';
import { useOverviewPagePresentation } from './useOverviewPagePresentation';
import { useOverviewReviewController } from './useOverviewReviewController';
import { useOverviewSetupState } from './useOverviewSetupState';
import {
  markPersistedReviewedImportYears,
} from './yearReview';
export type OverviewPageControllerProps = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupPlanStateChange?: (
    state: {
      activePlanId: string | null;
      linkedScenarioId: string | null;
      classificationReviewRequired: boolean;
      pricingStatus: 'blocked' | 'provisional' | 'verified' | null;
      tariffPlanStatus: 'draft' | 'accepted' | 'stale' | null;
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
type ReviewWorkspaceYearSaveParams = {
  year: number;
  financials: ManualFinancialForm;
  prices: ManualPriceForm;
  volumes: ManualVolumeForm;
  explicitMissing?: {
    financials: boolean;
    prices: boolean;
    volumes: boolean;
    financialFields?: Array<keyof ManualFinancialForm>;
  };
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
  onSetupPlanStateChange,
  onSetupOrgNameChange,
  onOrgLanguageNoticeChange,
  setupBackSignal,
}: OverviewPageControllerProps) {
  const { t } = useTranslation();
  const resolveSyncBlockReason = React.useCallback(
    (row: {
      completeness: Record<string, boolean>;
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      vuosi?: number;
    }): string | null =>
      buildSyncBlockReasonLabel(t, {
        vuosi: 0,
        completeness: row.completeness,
        tariffRevenueReason: row.tariffRevenueReason,
      }),
    [t],
  );
  const pickDefaultSyncYears = React.useCallback(
    (rows: Array<{
      vuosi: number;
      completeness: Record<string, boolean>;
      planningRole?: 'historical' | 'current_year_estimate';
    }>) => pickDefaultBaselineYears(rows),
    [],
  );
  const buildManualPatchInfoMessage = React.useCallback(
    (
      year: number,
      result: {
        syncReady: boolean;
        status: {
          years: Array<{
            vuosi: number;
            completeness: Record<string, boolean>;
            tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
          }>;
        };
      },
    ) => {
      if (result.syncReady) {
        return t('v2Overview.manualPatchSaved', { year });
      }
      const savedYear = result.status.years.find((row) => row.vuosi === year);
      const reason = savedYear ? resolveSyncBlockReason(savedYear) : null;
      if (reason) {
        return t('v2Overview.manualPatchSavedNeedsReview', {
          year,
          reason,
        });
      }
      return t(
        'v2Overview.manualPatchSavedStillBlocked',
        'Year {{year}} was saved. Review is still incomplete.',
        { year },
      );
    },
    [resolveSyncBlockReason, t],
  );
  const manualController = useOverviewManualPatchController({ t });
  const importController = useOverviewImportController({
    t,
    pickDefaultSyncYears,
    setYearDataCache: manualController.setYearDataCache,
    onOrgLanguageNoticeChange,
  });
  const {
    importableYearRows, repairOnlyYearRows, blockedYearCount, blockedYearRows,
    recommendedYears, readyTrustBoardRows, suspiciousTrustBoardRows,
    trashbinTrustBoardRows, blockedTrustBoardRows, currentYearEstimateBoardRows,
    confirmedImportedYears, reviewStorageOrgId, reviewedImportedYearRows,
    technicallyReadyImportedYearRows, importYearRows, excludedYearsSorted,
    reviewStatusRows, importedBlockedYearCount, pendingTechnicalReviewYearCount,
    pendingReviewYearCount, includedPlanningYears, acceptedPlanningYearRows,
    correctedPlanningYears, correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes, setupWizardState, wizardDisplayStep,
    displaySetupWizardState, wizardBackStep, previewPrefetchYears,
    selectableImportYearRows,
  } = useOverviewSetupState({
    overview: importController.overview,
    planningContext: importController.planningContext,
    yearDataCache: manualController.yearDataCache,
    selectedYears: importController.selectedYears,
    excludedYearOverrides: importController.excludedYearOverrides,
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
    [importController.planningContext?.vesinvest?.activePlan, importController.planningContext?.vesinvest?.selectedPlan],
  );
  const activeVesinvestScenario = React.useMemo(
    () => {
      if (activeVesinvestPlan?.selectedScenarioId == null) {
        return null;
      }
      const listedScenario =
        (importController.scenarioList ?? []).find(
          (item) => item.id === activeVesinvestPlan.selectedScenarioId,
        ) ?? null;
      if (listedScenario) {
        return listedScenario;
      }
      if (
        activeVesinvestPlan.baselineStatus === 'verified' &&
        activeVesinvestPlan.pricingStatus === 'verified' &&
        importController.baselineReady
      ) {
        return {
          id: activeVesinvestPlan.selectedScenarioId,
          updatedAt: activeVesinvestPlan.updatedAt,
          computedFromUpdatedAt: activeVesinvestPlan.updatedAt,
          computedYears: 1,
        };
      }
      return null;
    },
    [
      activeVesinvestPlan?.baselineStatus,
      activeVesinvestPlan?.pricingStatus,
      activeVesinvestPlan?.selectedScenarioId,
      activeVesinvestPlan?.updatedAt,
      importController.baselineReady,
      importController.scenarioList,
    ],
  );
  const hasSavedWorkspaceTruth =
    activeVesinvestPlan?.baselineStatus === 'verified' &&
    activeVesinvestPlan?.pricingStatus === 'verified' &&
    typeof activeVesinvestPlan?.selectedScenarioId === 'string' &&
    activeVesinvestPlan.selectedScenarioId.length > 0 &&
    importController.baselineReady;
  const isManageYearsMaintenanceMode =
    importController.reviewContinueStep === 2 &&
    (activeVesinvestPlan != null ||
      importController.backendAcceptedPlanningYears.length > 0 ||
      (importController.planningContext?.baselineYears?.length ?? 0) > 0 ||
      (importController.overview?.importStatus.workspaceYears?.length ?? 0) > 0);
  const shouldKeepSavedWorkspaceStep =
    hasSavedWorkspaceTruth &&
    (isManageYearsMaintenanceMode || importController.baselineReady);
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
    const effectiveWorkflowStep = shouldKeepSavedWorkspaceStep
      ? 6
      : workflowStep;
    const shouldRespectBackNavigation =
      importController.reviewContinueStep != null &&
      wizardDisplayStep < effectiveWorkflowStep &&
      !isManageYearsMaintenanceMode;
    return (wizardDisplayStep === 4
      ? 4
      : activeVesinvestPlan &&
          effectiveWorkflowStep > wizardDisplayStep &&
          !shouldRespectBackNavigation
        ? effectiveWorkflowStep
        : wizardDisplayStep) as typeof shellSetupWizardState.currentStep;
  }, [
    activeVesinvestPlan,
    activeVesinvestScenario,
    hasSavedWorkspaceTruth,
    isManageYearsMaintenanceMode,
    importController.reviewContinueStep,
    importController.overview,
    importController.planningContext,
    shellSetupWizardState,
    shouldKeepSavedWorkspaceStep,
    wizardDisplayStep,
  ]);
  const summaryBaselineReady =
    importController.baselineReady &&
    reviewStatusRows.every(
      (row) =>
        row.setupStatus === 'reviewed' || row.setupStatus === 'excluded_from_plan',
    );
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
        baselineReady: summaryBaselineReady,
      },
    };
  }, [
    activeVesinvestPlan,
    displaySetupWizardState?.selectedProblemYear,
    displaySetupWizardState,
    displayedWorkflowStep,
    shellSetupWizardState,
    summaryBaselineReady,
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
  const {
    datasetSourceLabel,
    financialComparisonLabel,
    importWarningLabel,
    loadYearPreviewData,
    missingRequirementLabel,
    priceComparisonLabel,
    renderDatasetCounts,
    renderDatasetTypeList,
    renderStep2InlineFieldEditor,
    renderYearValuePreview,
    setupStatusClassName,
    setupStatusLabel,
    sourceLayerText,
    sourceStatusClassName,
    sourceStatusLabel,
    volumeComparisonLabel,
    yearStatusRowClassName,
  } = useOverviewPagePresentation({
    t,
    importController,
    manualController,
    handleInlineCardKeyDown,
    saveInlineCardEdit,
  });
  const saveReviewWorkspaceYear = React.useCallback(
    async ({
      year,
      financials,
      prices,
      volumes,
      explicitMissing,
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
      if (formsDiffer(financials, originalFinancials) || explicitMissing?.financials) {
        const nextFinancials: Partial<ManualFinancialForm> = {};
        const explicitFinancialFields = new Set(
          explicitMissing?.financialFields ?? [],
        );
        const financialKeys = Object.keys(originalFinancials) as Array<
          keyof ManualFinancialForm
        >;
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
        for (const field of financialKeys) {
          if (
            numbersDiffer(financials[field], originalFinancials[field]) ||
            explicitFinancialFields.has(field)
          ) {
            nextFinancials[field] = financials[field];
          }
        }
        if (!resultFieldChanged && visibleFinanceFieldsChanged) {
          nextFinancials.tilikaudenYliJaama = deriveAdjustedYearResult(
            originalFinancials,
            financials,
          );
        }
        if (Object.keys(nextFinancials).length > 0) {
          nextPayload.financials = nextFinancials as ManualFinancialForm;
        }
      }
      if (formsDiffer(prices, originalPrices) || explicitMissing?.prices) {
        nextPayload.prices = { ...prices };
      }
      if (formsDiffer(volumes, originalVolumes) || explicitMissing?.volumes) {
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
        importController.setInfo(buildManualPatchInfoMessage(year, result));
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
      buildManualPatchInfoMessage,
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
  const presentedPlanState = React.useMemo(() => {
    if (!activeVesinvestPlan) {
      return null;
    }
    return {
      activePlanId: activeVesinvestPlan.id ?? null,
      linkedScenarioId: activeVesinvestPlan.selectedScenarioId ?? null,
      classificationReviewRequired:
        activeVesinvestPlan.classificationReviewRequired === true,
      pricingStatus: activeVesinvestPlan.pricingStatus ?? null,
      tariffPlanStatus: activeVesinvestPlan.tariffPlanStatus ?? null,
      baselineChangedSinceAcceptedRevision:
        activeVesinvestPlan.baselineChangedSinceAcceptedRevision === true,
      investmentPlanChangedSinceFeeRecommendation:
        activeVesinvestPlan.investmentPlanChangedSinceFeeRecommendation === true,
    };
  }, [activeVesinvestPlan]);
  React.useEffect(() => {
    onSetupPlanStateChange?.(presentedPlanState);
  }, [onSetupPlanStateChange, presentedPlanState]);
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
    const shouldExposeSetupOrg =
      presentedSetupWizardState == null || presentedSetupWizardState.currentStep > 1;
    onSetupOrgNameChange?.(
      shouldExposeSetupOrg
        ? (importController.planningContext?.vesinvest?.activePlan?.utilityName ??
            importController.planningContext?.vesinvest?.selectedPlan?.utilityName) ??
            importController.overview?.importStatus.link?.nimi ??
            null
        : null,
    );
  }, [
    importController.loading,
    importController.planningContext?.vesinvest?.activePlan?.utilityName,
    importController.planningContext?.vesinvest?.selectedPlan?.utilityName,
    importController.overview?.importStatus.link?.nimi,
    onSetupOrgNameChange,
    presentedSetupWizardState,
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
    trashbinTrustBoardRows,
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
