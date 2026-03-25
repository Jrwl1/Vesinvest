import type { V2ImportStatus, V2PlanningContextResponse } from '../api';

export type ImportYearLike = {
  vuosi: number;
  completeness: Record<string, boolean>;
  reviewState?: 'pending_review' | 'reviewed';
};

export type MissingRequirement = 'financials' | 'prices' | 'volumes';
export type SetupReadinessCheck = {
  key: MissingRequirement;
  labelKey:
    | 'v2Overview.datasetFinancials'
    | 'v2Overview.datasetPrices'
    | 'v2Overview.datasetWaterVolume';
  ready: boolean;
};
export type SetupYearStatus =
  | 'ready_for_review'
  | 'reviewed'
  | 'needs_attention'
  | 'excluded_from_plan';
export type SetupYearReviewStatus =
  | 'reviewed'
  | 'technical_ready'
  | 'needs_attention'
  | 'excluded_from_plan';

export function isSyncReadyYear(row: ImportYearLike): boolean {
  return (
    row.completeness.tilinpaatos === true &&
    row.completeness.taksa === true &&
    (row.completeness.volume_vesi === true ||
      row.completeness.volume_jatevesi === true)
  );
}

export function getMissingSyncRequirements(
  row: ImportYearLike,
): MissingRequirement[] {
  const missing: MissingRequirement[] = [];
  if (!row.completeness.tilinpaatos) missing.push('financials');
  if (!row.completeness.taksa) missing.push('prices');
  if (!row.completeness.volume_vesi && !row.completeness.volume_jatevesi) {
    missing.push('volumes');
  }
  return missing;
}

export function getSyncBlockReasonKey(
  row: ImportYearLike,
):
  | 'v2Overview.yearReasonMissingFinancials'
  | 'v2Overview.yearReasonMissingPrices'
  | 'v2Overview.yearReasonMissingVolumes'
  | null {
  if (!row.completeness.tilinpaatos) {
    return 'v2Overview.yearReasonMissingFinancials';
  }
  if (!row.completeness.taksa) {
    return 'v2Overview.yearReasonMissingPrices';
  }
  if (!row.completeness.volume_vesi && !row.completeness.volume_jatevesi) {
    return 'v2Overview.yearReasonMissingVolumes';
  }
  return null;
}

export function getSetupReadinessChecks(
  row: ImportYearLike,
): SetupReadinessCheck[] {
  return [
    {
      key: 'financials',
      labelKey: 'v2Overview.datasetFinancials',
      ready: row.completeness.tilinpaatos === true,
    },
    {
      key: 'prices',
      labelKey: 'v2Overview.datasetPrices',
      ready: row.completeness.taksa === true,
    },
    {
      key: 'volumes',
      labelKey: 'v2Overview.datasetWaterVolume',
      ready:
        row.completeness.volume_vesi === true ||
        row.completeness.volume_jatevesi === true,
    },
  ];
}

export function getSetupYearStatus(
  row: ImportYearLike,
  options?: { excluded?: boolean },
): SetupYearStatus {
  if (options?.excluded) return 'excluded_from_plan';
  if (!isSyncReadyYear(row)) return 'needs_attention';
  return row.reviewState === 'reviewed' ? 'reviewed' : 'ready_for_review';
}

export function getSetupYearReviewStatus(
  row: ImportYearLike,
  options?: { excluded?: boolean; reviewed?: boolean },
): SetupYearReviewStatus {
  if (options?.excluded) return 'excluded_from_plan';
  if (!isSyncReadyYear(row)) return 'needs_attention';
  return options?.reviewed ? 'reviewed' : 'technical_ready';
}

export type SetupWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type SetupWizardStateInput = {
  connected: boolean;
  importedYearCount: number;
  readyYearCount?: number;
  reviewedYearCount?: number;
  blockedYearCount: number;
  pendingReviewCount?: number;
  excludedYearCount: number;
  baselineReady: boolean;
  selectedProblemYear?: number | null;
};

export type SetupWizardState = {
  totalSteps: 6;
  currentStep: SetupWizardStep;
  recommendedStep: SetupWizardStep;
  activeStep: SetupWizardStep;
  selectedProblemYear: number | null;
  transitions: {
    reviewContinue: 4 | 5;
    selectProblemYear: 4;
  };
  wizardComplete: boolean;
  forecastUnlocked: boolean;
  reportsUnlocked: boolean;
  summary: {
    importedYearCount: number;
    readyYearCount: number;
    reviewedYearCount: number;
    blockedYearCount: number;
    pendingReviewCount: number;
    excludedYearCount: number;
    baselineReady: boolean;
  };
};

export function resolvePreviousSetupStep(
  state: Pick<SetupWizardState, 'currentStep'>,
): SetupWizardStep | null {
  switch (state.currentStep) {
    case 2:
      return 1;
    case 3:
      return 2;
    case 4:
      return 3;
    case 5:
      return 3;
    case 6:
      return 5;
    default:
      return null;
  }
}

export function getAvailableImportYears(
  importStatus: V2ImportStatus,
): ImportYearLike[] {
  return importStatus.availableYears ?? importStatus.years ?? [];
}

export function getConfirmedImportedYears(importStatus: V2ImportStatus): number[] {
  const availableYears = getAvailableImportYears(importStatus);
  const availableYearSet = new Set(availableYears.map((row) => row.vuosi));
  const persistedWorkspaceYears = importStatus.workspaceYears ?? [];

  return [...persistedWorkspaceYears]
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year) && availableYearSet.has(year))
    .sort((a, b) => b - a);
}

export function getExcludedYears(importStatus: V2ImportStatus): number[] {
  return [...(importStatus.excludedYears ?? [])]
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
}

export function resolveSetupWizardStateFromImportStatus(
  importStatus: V2ImportStatus,
  planningContext?: V2PlanningContextResponse | null,
  options?: {
    selectedProblemYear?: number | null;
    existingScenarioCount?: number;
    existingReportCount?: number;
  },
): SetupWizardState {
  const availableYears = getAvailableImportYears(importStatus);
  const confirmedImportedYears = getConfirmedImportedYears(importStatus);
  const confirmedImportedYearSet = new Set(confirmedImportedYears);
  const excludedYears = getExcludedYears(importStatus);
  const excludedYearSet = new Set(excludedYears);
  const reviewedYearCount = availableYears.filter(
    (row) =>
      confirmedImportedYearSet.has(row.vuosi) &&
      getSetupYearStatus(row, {
        excluded: excludedYearSet.has(row.vuosi),
      }) === 'reviewed',
  ).length;
  const pendingReviewCount = availableYears.filter(
    (row) =>
      confirmedImportedYearSet.has(row.vuosi) &&
      getSetupYearStatus(row, {
        excluded: excludedYearSet.has(row.vuosi),
      }) === 'ready_for_review',
  ).length;
  const blockedYearCount = availableYears.filter(
    (row) =>
      confirmedImportedYearSet.has(row.vuosi) &&
      getSetupYearStatus(row, {
        excluded: excludedYearSet.has(row.vuosi),
      }) === 'needs_attention',
  ).length;
  const baselineReady =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;

  const state = resolveSetupWizardState({
    connected: importStatus.connected,
    importedYearCount: confirmedImportedYears.length,
    reviewedYearCount,
    blockedYearCount,
    pendingReviewCount,
    excludedYearCount: excludedYears.length,
    baselineReady,
    selectedProblemYear: options?.selectedProblemYear,
  });

  const hasExistingForecastTruth =
    Math.max(0, Math.round(options?.existingScenarioCount ?? 0)) > 0 ||
    Math.max(0, Math.round(options?.existingReportCount ?? 0)) > 0;

  if (!hasExistingForecastTruth || state.forecastUnlocked) {
    return state;
  }

  return {
    ...state,
    forecastUnlocked: true,
    reportsUnlocked: true,
  };
}

export function resolveSetupWizardState(
  input: SetupWizardStateInput,
): SetupWizardState {
  const importedYearCount = Math.max(0, Math.round(input.importedYearCount));
  const reviewedYearCount = Math.max(
    0,
    Math.round(input.reviewedYearCount ?? input.readyYearCount ?? 0),
  );
  const blockedYearCount = Math.max(0, Math.round(input.blockedYearCount));
  const pendingReviewCount = Math.max(
    0,
    Math.round(input.pendingReviewCount ?? 0),
  );
  const excludedYearCount = Math.max(0, Math.round(input.excludedYearCount));
  const baselineReady = input.baselineReady === true;
  const selectedProblemYearRaw =
    input.selectedProblemYear == null
      ? null
      : Math.round(Number(input.selectedProblemYear));
  const selectedProblemYear =
    selectedProblemYearRaw != null && Number.isFinite(selectedProblemYearRaw)
      ? selectedProblemYearRaw
      : null;
  const setupResolved =
    input.connected &&
    importedYearCount > 0 &&
    blockedYearCount === 0 &&
    pendingReviewCount === 0;
  const wizardComplete = setupResolved && baselineReady;
  const reviewContinue: 4 | 5 = blockedYearCount > 0 ? 4 : 5;

  let currentStep: SetupWizardStep = 1;
  let recommendedStep: SetupWizardStep = 1;

  if (!input.connected) {
    currentStep = 1;
    recommendedStep = 1;
  } else if (importedYearCount === 0) {
    currentStep = 2;
    recommendedStep = 2;
  } else if (selectedProblemYear != null && blockedYearCount > 0) {
    currentStep = 4;
    recommendedStep = 4;
  } else if (blockedYearCount > 0) {
    currentStep = 3;
    recommendedStep = 4;
  } else if (pendingReviewCount > 0) {
    currentStep = 3;
    recommendedStep = 3;
  } else if (!baselineReady) {
    currentStep = 5;
    recommendedStep = 5;
  } else {
    currentStep = 6;
    recommendedStep = 6;
  }

  const activeStep: SetupWizardStep =
    selectedProblemYear != null && blockedYearCount > 0
      ? 4
      : currentStep;

  return {
    totalSteps: 6,
    currentStep,
    recommendedStep,
    activeStep,
    selectedProblemYear,
    transitions: {
      reviewContinue,
      selectProblemYear: 4,
    },
    wizardComplete,
    forecastUnlocked: wizardComplete,
    reportsUnlocked: wizardComplete,
    summary: {
      importedYearCount,
      readyYearCount: reviewedYearCount,
      reviewedYearCount,
      blockedYearCount,
      pendingReviewCount,
      excludedYearCount,
      baselineReady,
    },
  };
}
