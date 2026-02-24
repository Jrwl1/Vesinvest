export type ImportYearLike = {
  vuosi: number;
  completeness: Record<string, boolean>;
};

export type MissingRequirement = 'financials' | 'prices' | 'volumes';

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
