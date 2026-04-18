import type {
  V2ForecastScenario,
  V2ForecastScenarioListItem,
  V2ImportStatus,
  V2PlanningContextResponse,
} from '../api';

export type ImportYearLike = {
  vuosi: number;
  planningRole?: 'historical' | 'current_year_estimate';
  completeness: Record<string, boolean>;
  baselineReady?: boolean;
  baselineMissingRequirements?: Array<
    'financialBaseline' | 'prices' | 'volumes'
  >;
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  reviewState?: 'pending_review' | 'reviewed';
};

export type MissingRequirement =
  | 'financials'
  | 'prices'
  | 'volumes'
  | 'tariffRevenue';
export type BaselineMissingRequirement =
  | 'financialBaseline'
  | 'prices'
  | 'volumes';
export type SetupReadinessCheck = {
  key: MissingRequirement;
  labelKey:
    | 'v2Overview.datasetFinancials'
    | 'v2Overview.datasetPrices'
    | 'v2Overview.datasetWaterVolume'
    | 'v2Overview.datasetTariffRevenue';
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

function usesBaselineReadiness(row: ImportYearLike): boolean {
  return (
    typeof row.baselineReady === 'boolean' ||
    Array.isArray(row.baselineMissingRequirements)
  );
}

export function isSyncReadyYear(row: ImportYearLike): boolean {
  if (typeof row.baselineReady === 'boolean') {
    return row.baselineReady;
  }
  return (
    row.completeness.tilinpaatos === true &&
    row.completeness.taksa === true &&
    row.completeness.tariff_revenue !== false &&
    (row.completeness.volume_vesi === true ||
      row.completeness.volume_jatevesi === true)
  );
}

export function getMissingSyncRequirements(
  row: ImportYearLike,
): MissingRequirement[] {
  if (usesBaselineReadiness(row)) {
    if (row.baselineReady) {
      return [];
    }
    const missing: MissingRequirement[] = [];
    if (row.baselineMissingRequirements?.includes('financialBaseline')) {
      missing.push('financials');
    }
    if (row.baselineMissingRequirements?.includes('prices')) {
      missing.push('prices');
    }
    if (row.baselineMissingRequirements?.includes('volumes')) {
      missing.push('volumes');
    }
    return missing;
  }
  const missing: MissingRequirement[] = [];
  if (!row.completeness.tilinpaatos) missing.push('financials');
  if (!row.completeness.taksa) missing.push('prices');
  if (!row.completeness.volume_vesi && !row.completeness.volume_jatevesi) {
    missing.push('volumes');
  }
  if (
    row.completeness.tilinpaatos &&
    row.completeness.taksa &&
    (row.completeness.volume_vesi || row.completeness.volume_jatevesi) &&
    row.completeness.tariff_revenue === false
  ) {
    missing.push('tariffRevenue');
  }
  return missing;
}

export function getSyncBlockReasonKey(
  row: ImportYearLike,
):
  | 'v2Overview.yearReasonMissingFinancials'
  | 'v2Overview.yearReasonMissingPrices'
  | 'v2Overview.yearReasonMissingVolumes'
  | 'v2Overview.yearReasonMissingTariffRevenue'
  | 'v2Overview.yearReasonTariffRevenueMismatch'
  | null {
  if (usesBaselineReadiness(row)) {
    if (row.baselineReady) {
      return null;
    }
    if (row.baselineMissingRequirements?.includes('financialBaseline')) {
      return 'v2Overview.yearReasonMissingFinancials';
    }
    if (row.baselineMissingRequirements?.includes('prices')) {
      return 'v2Overview.yearReasonMissingPrices';
    }
    if (row.baselineMissingRequirements?.includes('volumes')) {
      return 'v2Overview.yearReasonMissingVolumes';
    }
    return null;
  }
  if (!row.completeness.tilinpaatos) {
    return 'v2Overview.yearReasonMissingFinancials';
  }
  if (!row.completeness.taksa) {
    return 'v2Overview.yearReasonMissingPrices';
  }
  if (!row.completeness.volume_vesi && !row.completeness.volume_jatevesi) {
    return 'v2Overview.yearReasonMissingVolumes';
  }
  if (row.completeness.tariff_revenue === false) {
    if (row.tariffRevenueReason === 'mismatch') {
      return 'v2Overview.yearReasonTariffRevenueMismatch';
    }
    return 'v2Overview.yearReasonMissingTariffRevenue';
  }
  return null;
}

export function getSetupReadinessChecks(
  row: ImportYearLike,
): SetupReadinessCheck[] {
  const baselineMissing = new Set(row.baselineMissingRequirements ?? []);
  const useBaseline = usesBaselineReadiness(row);
  return [
    {
      key: 'financials',
      labelKey: 'v2Overview.datasetFinancials',
      ready: useBaseline
        ? !baselineMissing.has('financialBaseline')
        : row.completeness.tilinpaatos === true,
    },
    {
      key: 'prices',
      labelKey: 'v2Overview.datasetPrices',
      ready: useBaseline
        ? !baselineMissing.has('prices')
        : row.completeness.taksa === true,
    },
    {
      key: 'volumes',
      labelKey: 'v2Overview.datasetWaterVolume',
      ready: useBaseline
        ? !baselineMissing.has('volumes')
        : row.completeness.volume_vesi === true ||
          row.completeness.volume_jatevesi === true,
    },
    {
      key: 'tariffRevenue',
      labelKey: 'v2Overview.datasetTariffRevenue',
      ready: useBaseline ? true : row.completeness.tariff_revenue !== false,
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
export type PresentedOverviewWorkflowStep = 1 | 2 | 3 | 4 | 5;
export const PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS = 5;

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

type SetupSelectedScenario =
  | Pick<
      V2ForecastScenario,
      'id' | 'updatedAt' | 'computedFromUpdatedAt' | 'years' | 'yearlyInvestments'
    >
  | Pick<
      V2ForecastScenarioListItem,
      'id' | 'updatedAt' | 'computedFromUpdatedAt' | 'computedYears'
    >;

export type VesinvestWorkflowState = {
  currentStep: SetupWizardStep;
  hasPlan: boolean;
  utilityIdentified: boolean;
  investmentPlanReady: boolean;
  baselineVerified: boolean;
  forecastReady: boolean;
  reportsReady: boolean;
};

export function getPresentedOverviewWorkflowStep(
  step: SetupWizardStep,
): PresentedOverviewWorkflowStep {
  switch (step) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 2;
    case 4:
      return 3;
    case 5:
      return 4;
    case 6:
    default:
      return 5;
  }
}

function isSelectedScenarioReadyForReports(
  scenario?: SetupSelectedScenario | null,
): boolean {
  if (!scenario) return false;
  const hasComputedResults =
    'years' in scenario
      ? scenario.years.length > 0
      : (scenario.computedYears ?? 0) > 0;
  if (
    !hasComputedResults ||
    !scenario.computedFromUpdatedAt ||
    scenario.computedFromUpdatedAt !== scenario.updatedAt
  ) {
    return false;
  }
  if (
    'yearlyInvestments' in scenario &&
    scenario.yearlyInvestments.some(
      (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
    )
  ) {
    return false;
  }
  return true;
}

export function resolveVesinvestWorkflowState(
  importStatus: V2ImportStatus,
  planningContext?: V2PlanningContextResponse | null,
  options?: {
    selectedScenario?: SetupSelectedScenario | null;
  },
): VesinvestWorkflowState {
  const activePlan = planningContext?.vesinvest?.activePlan ?? null;
  const selectedPlan = planningContext?.vesinvest?.selectedPlan ?? null;
  const workflowPlan = activePlan ?? selectedPlan;
  const confirmedImportedYears = getConfirmedImportedYears(importStatus);
  const baselinePlanningYears = getAcceptedPlanningBaselineYears(
    importStatus,
    planningContext,
  );
  const baselinePlanningYearSet = new Set(baselinePlanningYears);
  const baselineCoversImportedWorkspaceYears =
    confirmedImportedYears.length === 0 ||
    confirmedImportedYears.every((year) => baselinePlanningYearSet.has(year));
  const hasPlan =
    planningContext?.vesinvest?.hasPlan === true ||
    activePlan != null ||
    selectedPlan != null;
  const linkedUtilityIdentified =
    importStatus.connected === true &&
    importStatus.link != null &&
    (Number.isFinite(importStatus.link.veetiId ?? null) ||
      (typeof importStatus.link.nimi === 'string' &&
        importStatus.link.nimi.trim().length > 0) ||
      (typeof importStatus.link.ytunnus === 'string' &&
        importStatus.link.ytunnus.trim().length > 0));
  const planUtilityIdentified =
    workflowPlan != null &&
    (Number.isFinite(workflowPlan.veetiId ?? null) ||
      (typeof workflowPlan.utilityName === 'string' &&
        workflowPlan.utilityName.trim().length > 0) ||
      (typeof workflowPlan.businessId === 'string' &&
        workflowPlan.businessId.trim().length > 0));
  const utilityIdentified = linkedUtilityIdentified || planUtilityIdentified;
  const hasImportedWorkspaceYears = confirmedImportedYears.length > 0;
  const investmentPlanReady =
    (workflowPlan?.projectCount ?? 0) > 0 &&
    (workflowPlan?.totalInvestmentAmount ?? 0) > 0;
  const baselineVerified =
    (workflowPlan?.baselineStatus === 'verified' ||
      planningContext?.canCreateScenario === true ||
      baselinePlanningYears.length > 0) &&
    baselineCoversImportedWorkspaceYears;
  const forecastEntryReady = baselineVerified === true;
  const forecastReady =
    forecastEntryReady &&
    hasPlan === true &&
    typeof workflowPlan?.selectedScenarioId === 'string' &&
    workflowPlan.selectedScenarioId.length > 0;
  const classificationReviewComplete =
    workflowPlan?.classificationReviewRequired !== true;
  const reportsReady =
    baselineVerified === true &&
    hasPlan === true &&
    forecastReady === true &&
    classificationReviewComplete &&
    workflowPlan?.pricingStatus === 'verified' &&
    isSelectedScenarioReadyForReports(options?.selectedScenario);

  let currentStep: SetupWizardStep;
  if (!utilityIdentified) {
    currentStep = 1;
  } else if (!hasPlan && !hasImportedWorkspaceYears && !baselineVerified) {
    currentStep = 2;
  } else if (!baselineVerified && !hasPlan) {
    currentStep = 3;
  } else if (hasPlan && !investmentPlanReady && !baselineVerified) {
    currentStep = 3;
  } else if (!baselineVerified) {
    currentStep = 4;
  } else if (
    !forecastReady ||
    workflowPlan?.pricingStatus !== 'verified' ||
    !classificationReviewComplete
  ) {
    currentStep = 5;
  } else {
    currentStep = 6;
  }

  return {
    currentStep,
    hasPlan,
    utilityIdentified,
    investmentPlanReady,
    baselineVerified,
    forecastReady,
    reportsReady,
  };
}

export function resolvePreviousSetupStep(
  state: Pick<SetupWizardState, 'currentStep'>,
): SetupWizardStep | null {
  switch (state.currentStep) {
    case 2:
      return 1;
    case 3:
      return 1;
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

export function getAcceptedPlanningBaselineYears(
  importStatus: V2ImportStatus,
  planningContext?: V2PlanningContextResponse | null,
): number[] {
  const importStatusYears = [...(importStatus.planningBaselineYears ?? [])]
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year));
  const planningContextYears = [...(planningContext?.baselineYears ?? [])]
    .map((row) => Number(row.year))
    .filter((year) => Number.isFinite(year));
  return [...new Set([...importStatusYears, ...planningContextYears])].sort(
    (a, b) => b - a,
  );
}

export function resolveSetupWizardStateFromImportStatus(
  importStatus: V2ImportStatus,
  planningContext?: V2PlanningContextResponse | null,
  options?: {
    selectedProblemYear?: number | null;
    selectedScenario?: SetupSelectedScenario | null;
  },
): SetupWizardState {
  const availableYears = getAvailableImportYears(importStatus);
  const confirmedImportedYears = getConfirmedImportedYears(importStatus);
  const confirmedImportedYearSet = new Set(confirmedImportedYears);
  const excludedYears = getExcludedYears(importStatus);
  const excludedYearSet = new Set(excludedYears);
  const baselinePlanningYears = getAcceptedPlanningBaselineYears(
    importStatus,
    planningContext,
  );
  const baselinePlanningYearSet = new Set(baselinePlanningYears);
  const baselineCoversImportedWorkspaceYears =
    confirmedImportedYears.length === 0 ||
    confirmedImportedYears.every((year) => baselinePlanningYearSet.has(year));
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
    ((planningContext?.canCreateScenario ?? false) ||
      baselinePlanningYears.length > 0) &&
    baselineCoversImportedWorkspaceYears;
  const effectiveImportedYearCount = baselineReady
    ? baselinePlanningYears.length
    : confirmedImportedYears.length;
  const effectiveReviewedYearCount = baselineReady
    ? baselinePlanningYears.length
    : reviewedYearCount;
  const effectiveBlockedYearCount = baselineReady ? 0 : blockedYearCount;
  const effectivePendingReviewCount = baselineReady ? 0 : pendingReviewCount;
  const vesinvestWorkflow = resolveVesinvestWorkflowState(
    importStatus,
    planningContext,
    {
      selectedScenario: options?.selectedScenario,
    },
  );

  const legacyState = resolveSetupWizardState({
    connected: importStatus.connected,
    importedYearCount: effectiveImportedYearCount,
    reviewedYearCount: effectiveReviewedYearCount,
    blockedYearCount: effectiveBlockedYearCount,
    pendingReviewCount: effectivePendingReviewCount,
    excludedYearCount: excludedYears.length,
    baselineReady,
    selectedProblemYear: options?.selectedProblemYear,
  });

  return {
    ...legacyState,
    currentStep: vesinvestWorkflow.currentStep,
    recommendedStep: vesinvestWorkflow.currentStep,
    activeStep: vesinvestWorkflow.currentStep,
    selectedProblemYear:
      vesinvestWorkflow.currentStep === 4
        ? (options?.selectedProblemYear ?? null)
        : null,
    wizardComplete: vesinvestWorkflow.reportsReady,
    forecastUnlocked: vesinvestWorkflow.baselineVerified,
    reportsUnlocked: vesinvestWorkflow.reportsReady,
    summary: {
      ...legacyState.summary,
      baselineReady: vesinvestWorkflow.baselineVerified,
    },
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
    forecastUnlocked: baselineReady,
    reportsUnlocked: baselineReady,
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
