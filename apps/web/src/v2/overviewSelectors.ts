import type { SetupWizardStep, SetupYearStatus } from './overviewWorkflow';

export const YEAR_PREVIEW_PREFETCH_LIMIT = 4;

type SelectableImportYearRowLike = {
  vuosi: number;
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

  if (wizardDisplayStep !== 3) {
    return prioritizedYears.slice(0, limit);
  }

  for (const row of getReviewPriorityRows(reviewStatusRows)) {
    pushYear(row.year);
  }

  return prioritizedYears.slice(0, limit);
}
