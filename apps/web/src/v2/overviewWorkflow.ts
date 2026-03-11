export type ImportYearLike = {
  vuosi: number;
  completeness: Record<string, boolean>;
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
  | 'ready'
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
  return isSyncReadyYear(row) ? 'ready' : 'needs_attention';
}

export type NextBestStepKind =
  | 'connect_org'
  | 'sync_ready_years'
  | 'fix_blocked_years'
  | 'create_first_scenario'
  | 'compute_scenario'
  | 'create_first_report'
  | 'review_reports'
  | 'open_forecast';

export type NextBestStepInput = {
  connected: boolean;
  canCreateScenario: boolean;
  readyYearCount: number;
  blockedYearCount: number;
  scenarioCount: number | null;
  computedScenarioCount: number | null;
  reportCount: number | null;
};

export function resolveNextBestStep(
  input: NextBestStepInput,
): NextBestStepKind {
  if (!input.connected) return 'connect_org';

  if (!input.canCreateScenario) {
    if (input.readyYearCount > 0) return 'sync_ready_years';
    if (input.blockedYearCount > 0) return 'fix_blocked_years';
    return 'sync_ready_years';
  }

  if (input.blockedYearCount > 0) return 'fix_blocked_years';

  if (
    input.scenarioCount == null ||
    input.computedScenarioCount == null ||
    input.reportCount == null
  ) {
    return 'open_forecast';
  }

  if (input.scenarioCount === 0) return 'create_first_scenario';
  if (input.computedScenarioCount === 0) return 'compute_scenario';
  if (input.reportCount === 0) return 'create_first_report';
  return 'review_reports';
}

export type SetupWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export type SetupWizardStateInput = {
  connected: boolean;
  importedYearCount: number;
  readyYearCount: number;
  blockedYearCount: number;
  excludedYearCount: number;
  baselineReady: boolean;
};

export type SetupWizardState = {
  totalSteps: 6;
  currentStep: SetupWizardStep;
  recommendedStep: SetupWizardStep;
  wizardComplete: boolean;
  forecastUnlocked: boolean;
  reportsUnlocked: boolean;
  summary: {
    importedYearCount: number;
    readyYearCount: number;
    blockedYearCount: number;
    excludedYearCount: number;
    baselineReady: boolean;
  };
};

export function resolveSetupWizardState(
  input: SetupWizardStateInput,
): SetupWizardState {
  const importedYearCount = Math.max(0, Math.round(input.importedYearCount));
  const readyYearCount = Math.max(0, Math.round(input.readyYearCount));
  const blockedYearCount = Math.max(0, Math.round(input.blockedYearCount));
  const excludedYearCount = Math.max(0, Math.round(input.excludedYearCount));
  const baselineReady = input.baselineReady === true;
  const setupResolved =
    input.connected && importedYearCount > 0 && blockedYearCount === 0;
  const wizardComplete = setupResolved && baselineReady;

  let currentStep: SetupWizardStep = 1;
  let recommendedStep: SetupWizardStep = 1;

  if (!input.connected) {
    currentStep = 1;
    recommendedStep = 1;
  } else if (importedYearCount === 0) {
    currentStep = 2;
    recommendedStep = 2;
  } else if (blockedYearCount > 0) {
    currentStep = 4;
    recommendedStep = 4;
  } else if (!baselineReady) {
    currentStep = 5;
    recommendedStep = 5;
  } else {
    currentStep = 6;
    recommendedStep = 6;
  }

  return {
    totalSteps: 6,
    currentStep,
    recommendedStep,
    wizardComplete,
    forecastUnlocked: wizardComplete,
    reportsUnlocked: wizardComplete,
    summary: {
      importedYearCount,
      readyYearCount,
      blockedYearCount,
      excludedYearCount,
      baselineReady,
    },
  };
}
