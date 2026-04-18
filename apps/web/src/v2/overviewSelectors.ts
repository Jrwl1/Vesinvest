import type { SetupWizardStep, SetupYearStatus } from './overviewWorkflow';

export const YEAR_PREVIEW_PREFETCH_LIMIT = 4;
export const DEFAULT_BASELINE_YEAR_COUNT = 4;

type SelectableImportYearRowLike = {
  vuosi: number;
  planningRole?: 'historical' | 'current_year_estimate' | undefined;
};

type ReviewStatusRowLike = {
  year: number;
  setupStatus: SetupYearStatus;
};

function getReviewStatusPriority(status: SetupYearStatus): number {
  if (status === 'needs_attention') return 0;
  if (status === 'ready_for_review') return 1;
  return 2;
}

export function isHistoricalPlanningYear(
  row: Pick<SelectableImportYearRowLike, 'planningRole'>,
): boolean {
  return row.planningRole !== 'current_year_estimate';
}

function buildHistoricalYearRuns<T extends SelectableImportYearRowLike>(
  rows: T[],
): number[][] {
  const historicalYears = [...new Set(
    rows
      .filter((row) => isHistoricalPlanningYear(row))
      .map((row) => Number(row.vuosi))
      .filter((year) => Number.isFinite(year)),
  )].sort((left, right) => right - left);

  if (historicalYears.length === 0) {
    return [];
  }

  const runs: number[][] = [];
  let currentRun: number[] = [historicalYears[0]!];

  for (let index = 1; index < historicalYears.length; index += 1) {
    const year = historicalYears[index]!;
    const previousYear = historicalYears[index - 1]!;
    if (previousYear - year === 1) {
      currentRun.push(year);
      continue;
    }
    runs.push(currentRun);
    currentRun = [year];
  }

  runs.push(currentRun);
  return runs;
}

export function pickDefaultBaselineYears<T extends SelectableImportYearRowLike>(
  rows: T[],
  preferredCount = DEFAULT_BASELINE_YEAR_COUNT,
): number[] {
  const historicalRuns = buildHistoricalYearRuns(rows);
  if (historicalRuns.length === 0) {
    return [];
  }

  const preferredRun =
    historicalRuns.find((run) => run.length >= preferredCount) ??
    [...historicalRuns].sort((left, right) => {
      if (right.length !== left.length) {
        return right.length - left.length;
      }
      return right[0]! - left[0]!;
    })[0];

  return (preferredRun ?? []).slice(0, preferredCount);
}

export function getDefaultBaselineRunLength<T extends SelectableImportYearRowLike>(
  rows: T[],
  preferredCount = DEFAULT_BASELINE_YEAR_COUNT,
): number {
  return pickDefaultBaselineYears(rows, preferredCount).length;
}

export function getReviewPriorityRows<T extends ReviewStatusRowLike>(rows: T[]): T[] {
  return [...rows]
    .filter((row) => row.setupStatus !== 'excluded_from_plan')
    .sort((left, right) => {
      const statusDiff =
        getReviewStatusPriority(left.setupStatus) -
        getReviewStatusPriority(right.setupStatus);
      if (statusDiff !== 0) return statusDiff;
      return right.year - left.year;
    });
}

export function getPreviewPrefetchYears(params: {
  cardEditYear: number | null;
  manualPatchYear: number | null;
  connected: boolean;
  importedWorkspaceYears: number[] | null;
  wizardDisplayStep: SetupWizardStep;
  selectedYears: number[];
  selectableImportYearRows: SelectableImportYearRowLike[];
  reviewStatusRows: ReviewStatusRowLike[];
  acceptedPlanningYears?: number[];
  limit?: number;
}): number[] {
  const {
    cardEditYear,
    manualPatchYear,
    connected,
    importedWorkspaceYears,
    wizardDisplayStep,
    selectedYears,
    selectableImportYearRows,
    reviewStatusRows,
    acceptedPlanningYears,
    limit = YEAR_PREVIEW_PREFETCH_LIMIT,
  } = params;
  const prioritizedYears: number[] = [];
  const pushYear = (year: number | null | undefined) => {
    if (year == null || prioritizedYears.includes(year)) return;
    prioritizedYears.push(year);
  };

  pushYear(cardEditYear);
  pushYear(manualPatchYear);

  if (connected && importedWorkspaceYears == null) {
    return prioritizedYears.slice(0, limit);
  }

  if (wizardDisplayStep === 2) {
    if ((importedWorkspaceYears?.length ?? 0) > 0) {
      for (const year of importedWorkspaceYears ?? []) {
        pushYear(year);
      }
      return prioritizedYears.slice(0, limit);
    }
    for (const year of [...selectedYears].sort((a, b) => b - a)) {
      pushYear(year);
    }
    for (const row of selectableImportYearRows) {
      pushYear(row.vuosi);
    }
    return prioritizedYears.slice(0, limit);
  }

  if (wizardDisplayStep === 5 || wizardDisplayStep === 6) {
    for (const row of getReviewPriorityRows(reviewStatusRows)) {
      pushYear(row.year);
    }
    for (const year of acceptedPlanningYears ?? []) {
      pushYear(year);
    }
    return prioritizedYears;
  }

  if (wizardDisplayStep !== 3) {
    return prioritizedYears.slice(0, limit);
  }

  for (const row of getReviewPriorityRows(reviewStatusRows)) {
    pushYear(row.year);
  }

  return prioritizedYears.slice(0, limit);
}
