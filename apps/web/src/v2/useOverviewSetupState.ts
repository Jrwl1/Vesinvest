import React from 'react';
import type { TFunction } from 'i18next';

import type {
  V2ImportYearDataResponse,
  V2OverviewResponse,
  V2PlanningContextResponse,
} from '../api';
import { getSyncBlockReasonLabel as buildSyncBlockReasonLabel } from './overviewLabels';
import {
  getPreviewPrefetchYears,
  isHistoricalPlanningYear,
  pickDefaultBaselineYears,
} from './overviewSelectors';
import {
  getMissingSyncRequirements,
  resolvePreviousSetupStep,
  resolveSetupWizardState,
  type SetupWizardStep,
  type SetupWizardState,
} from './overviewWorkflow';
import { getExactEditedFieldLabels, useOverviewSetupDerivedRows } from './useOverviewSetupDerivedRows';

export { getExactEditedFieldLabels } from './useOverviewSetupDerivedRows';

type ReviewCardContext = 'step2' | 'step3' | null;

export function useOverviewSetupState(params: {
  overview: V2OverviewResponse | null;
  planningContext?: V2PlanningContextResponse | null;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  selectedYears: number[];
  excludedYearOverrides: Record<number, boolean>;
  importedWorkspaceYears: number[] | null;
  backendAcceptedPlanningYears: number[];
  reviewedImportedYears: number[];
  setReviewedImportedYears: React.Dispatch<React.SetStateAction<number[]>>;
  manualPatchYear: number | null;
  cardEditYear: number | null;
  cardEditContext: ReviewCardContext;
  reviewContinueStep: SetupWizardStep | null;
  baselineReady: boolean;
  t: TFunction;
}) {
  const {
    overview,
    planningContext = null,
    yearDataCache,
    selectedYears,
    excludedYearOverrides,
    importedWorkspaceYears,
    backendAcceptedPlanningYears,
    reviewedImportedYears,
    setReviewedImportedYears,
    manualPatchYear,
    cardEditYear,
    cardEditContext,
    reviewContinueStep,
    baselineReady,
    t,
  } = params;

  const resolveSyncBlockReason = React.useCallback(
    (row: {
      completeness: Record<string, boolean>;
      baselineReady?: boolean;
      baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      vuosi: number;
    }) => buildSyncBlockReasonLabel(t, row),
    [t],
  );

  const availableYearRows = React.useMemo(
    () => overview?.importStatus.availableYears ?? overview?.importStatus.years ?? [],
    [overview?.importStatus.availableYears, overview?.importStatus.years],
  );

  const syncYearRows = React.useMemo(
    () =>
      availableYearRows.map((row) => ({
        ...row,
        syncBlockedReason: resolveSyncBlockReason(row),
      })),
    [availableYearRows, resolveSyncBlockReason],
  );

  const selectableImportYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
        })),
    [syncYearRows],
  );

  const importableYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason == null),
    [selectableImportYearRows],
  );
  const repairOnlyYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason != null),
    [selectableImportYearRows],
  );
  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );
  const blockedYearRows = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason),
    [syncYearRows],
  );

  const excludedYearsSorted = React.useMemo(() => {
    const years = new Set(
      [...(overview?.importStatus.excludedYears ?? [])]
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year)),
    );
    for (const [year, excluded] of Object.entries(excludedYearOverrides)) {
      const numericYear = Number(year);
      if (!Number.isFinite(numericYear)) {
        continue;
      }
      if (excluded) {
        years.add(numericYear);
      } else {
        years.delete(numericYear);
      }
    }
    for (const year of backendAcceptedPlanningYears) {
      years.delete(year);
    }
    return [...years].sort((a, b) => b - a);
  }, [backendAcceptedPlanningYears, excludedYearOverrides, overview?.importStatus.excludedYears]);

  const excludedYearSet = React.useMemo(() => new Set(excludedYearsSorted), [excludedYearsSorted]);
  const readyAvailableYearRows = React.useMemo(
    () => syncYearRows.filter((row) => isHistoricalPlanningYear(row) && !row.syncBlockedReason),
    [syncYearRows],
  );
  const recommendedYears = React.useMemo(
    () => pickDefaultBaselineYears(readyAvailableYearRows),
    [readyAvailableYearRows],
  );
  const defaultBaselineYearSet = React.useMemo(
    () => new Set(pickDefaultBaselineYears(syncYearRows)),
    [syncYearRows],
  );
  const confirmedImportedYears = React.useMemo(
    () => [...(importedWorkspaceYears ?? [])].sort((a, b) => b - a),
    [importedWorkspaceYears],
  );

  const {
    importBoardRows,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    trashbinTrustBoardRows,
    blockedTrustBoardRows,
    currentYearEstimateBoardRows,
    reviewStorageOrgId,
    persistedReviewedImportedYears,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    reviewStatusRows,
    acceptedPlanningYearRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    includedPlanningYears,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
  } = useOverviewSetupDerivedRows({
    overview,
    planningContext,
    yearDataCache,
    selectedYears,
    selectableImportYearRows,
    syncYearRows,
    defaultBaselineYearSet,
    excludedYearSet,
    excludedYearsSorted,
    confirmedImportedYears,
    backendAcceptedPlanningYears,
    reviewedImportedYears,
    t,
  });

  React.useEffect(() => {
    setReviewedImportedYears(persistedReviewedImportedYears);
  }, [persistedReviewedImportedYears, setReviewedImportedYears]);

  const pendingReviewYearCount = pendingTechnicalReviewYearCount;
  const setupWizardState = React.useMemo<SetupWizardState | null>(() => {
    if (!overview) {
      return null;
    }
    if (baselineReady) {
      const acceptedCount = backendAcceptedPlanningYears.length;
      return resolveSetupWizardState({
        connected: overview.importStatus.connected,
        importedYearCount: acceptedCount,
        reviewedYearCount: acceptedCount,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: excludedYearsSorted.length,
        baselineReady: true,
        selectedProblemYear: null,
      });
    }
    return resolveSetupWizardState({
      connected: overview.importStatus.connected,
      importedYearCount: confirmedImportedYears.length,
      reviewedYearCount: reviewedImportedYearRows.length,
      blockedYearCount: importedBlockedYearCount,
      pendingReviewCount: pendingTechnicalReviewYearCount,
      excludedYearCount: excludedYearsSorted.length,
      baselineReady,
      selectedProblemYear: cardEditContext === 'step3' ? null : manualPatchYear,
    });
  }, [
    baselineReady,
    cardEditContext,
    confirmedImportedYears.length,
    excludedYearsSorted.length,
    importedBlockedYearCount,
    manualPatchYear,
    overview,
    pendingTechnicalReviewYearCount,
    reviewedImportedYearRows.length,
    backendAcceptedPlanningYears.length,
  ]);

  const reopeningAcceptedBaselineYear =
    baselineReady &&
    manualPatchYear != null &&
    cardEditContext !== 'step3' &&
    !confirmedImportedYears.includes(manualPatchYear);

  const wizardDisplayStep: SetupWizardStep =
    cardEditContext === 'step3' && cardEditYear != null
      ? 3
      : reopeningAcceptedBaselineYear
        ? 6
        : manualPatchYear != null && cardEditContext !== 'step3'
          ? 4
          : ((baselineReady && reviewContinueStep === 5 ? 6 : reviewContinueStep) ??
              (setupWizardState?.activeStep === 5 &&
              correctedPlanningYears.length > 0 &&
              reviewedImportedYearRows.length > 0 &&
              importedBlockedYearCount === 0 &&
              pendingTechnicalReviewYearCount === 0 &&
              !baselineReady
                ? 3
                : setupWizardState?.activeStep ?? 1)) as SetupWizardStep;

  const displaySetupWizardState = React.useMemo(() => {
    if (!setupWizardState) {
      return null;
    }
    return {
      ...setupWizardState,
      currentStep: wizardDisplayStep,
      recommendedStep: setupWizardState.recommendedStep,
      activeStep: wizardDisplayStep,
      selectedProblemYear: wizardDisplayStep === 4 && manualPatchYear != null ? manualPatchYear : null,
    };
  }, [manualPatchYear, setupWizardState, wizardDisplayStep]);

  const wizardBackStep = displaySetupWizardState
    ? resolvePreviousSetupStep(displaySetupWizardState)
    : null;

  const previewPrefetchYears = React.useMemo(
    () =>
      getPreviewPrefetchYears({
        cardEditYear,
        manualPatchYear,
        connected: overview?.importStatus.connected ?? false,
        importedWorkspaceYears,
        wizardDisplayStep,
        selectedYears,
        selectableImportYearRows,
        reviewStatusRows,
        acceptedPlanningYears: acceptedPlanningYearRows.map((row) => row.vuosi),
      }),
    [
      acceptedPlanningYearRows,
      cardEditYear,
      importedWorkspaceYears,
      manualPatchYear,
      overview?.importStatus.connected,
      reviewStatusRows,
      selectableImportYearRows,
      selectedYears,
      wizardDisplayStep,
    ],
  );

  return {
    availableYearRows,
    syncYearRows,
    selectableImportYearRows,
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    readyAvailableYearRows,
    recommendedYears,
    importBoardRows,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    trashbinTrustBoardRows,
    blockedTrustBoardRows,
    currentYearEstimateBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    persistedReviewedImportedYears,
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
  };
}
