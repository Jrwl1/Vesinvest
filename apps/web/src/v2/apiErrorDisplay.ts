import type { TFunction } from 'i18next';

export const getApiErrorCode = (err: unknown): string | null => {
  if (typeof err !== 'object' || err === null) {
    return null;
  }
  const directCode = (err as { code?: unknown }).code;
  if (typeof directCode === 'string' && directCode.trim()) {
    return directCode;
  }
  const details = (err as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) {
    return null;
  }
  const detailsCode = (details as { code?: unknown }).code;
  if (typeof detailsCode === 'string' && detailsCode.trim()) {
    return detailsCode;
  }
  const message = (details as { message?: unknown }).message;
  if (typeof message === 'object' && message !== null) {
    const nestedCode = (message as { code?: unknown }).code;
    if (typeof nestedCode === 'string' && nestedCode.trim()) {
      return nestedCode;
    }
  }
  return null;
};

export const getApiErrorStatus = (err: unknown): number | null => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status;
  }
  return null;
};

export const mapReportBlockerError = (
  t: TFunction,
  err: unknown,
  fallbackKey: string,
  fallbackText: string,
): string => {
  switch (getApiErrorCode(err)) {
    case 'FORECAST_RECOMPUTE_REQUIRED':
    case 'VESINVEST_SCENARIO_STALE':
      return t(
        'v2Forecast.staleComputeHint',
        'Saved inputs changed after the last calculation. Recompute results before creating report.',
      );
    case 'VESINVEST_BASELINE_STALE':
      return t(
        'v2Vesinvest.baselineChangedSincePricing',
        'Accepted baseline changed after the saved tariff-plan result.',
      );
    case 'ASSET_EVIDENCE_REQUIRED':
      return t(
        'v2Vesinvest.assetEvidenceReportBlocked',
        'Complete asset-management evidence before creating reports.',
      );
    case 'TARIFF_EVIDENCE_REQUIRED':
      return t(
        'v2TariffPlan.tariffEvidenceRequiredBeforeReports',
        'Complete tariff evidence and accept the tariff plan before creating reports.',
      );
    case 'TARIFF_PLAN_REQUIRED':
    case 'TARIFF_PLAN_NOT_READY':
      return t(
        'v2TariffPlan.acceptBeforeReports',
        'Accept the tariff plan before creating reports.',
      );
    case 'TARIFF_PLAN_STALE':
      return t(
        'v2TariffPlan.tariffPlanStaleBeforeReports',
        'Re-accept the current tariff plan before creating reports.',
      );
    case 'VESINVEST_CLASSIFICATION_REVIEW_REQUIRED':
      return t(
        'v2Forecast.classificationReviewRequired',
        'Review and save the Vesinvest class plan before creating a report.',
      );
    case 'VESINVEST_UTILITY_MISMATCH':
      return t(
        'v2Vesinvest.utilityMismatchBeforeReports',
        'The utility binding changed. Create a fresh Vesinvest revision before creating reports.',
      );
    case 'VESINVEST_INACTIVE_REVISION':
      return t(
        'v2Vesinvest.activeRevisionRequiredBeforeReports',
        'Only the active Vesinvest revision can create reports.',
      );
    case 'VESINVEST_SCENARIO_REQUIRED':
    case 'VESINVEST_SCENARIO_MISMATCH':
    case 'VESINVEST_SCENARIO_LINK_REQUIRED':
    case 'VESINVEST_SCENARIO_INVESTMENTS_STALE':
    case 'TARIFF_SCENARIO_REQUIRED':
      return t(
        'v2Vesinvest.syncPlanBeforeReports',
        'Sync the active Vesinvest plan to Forecast before creating reports.',
      );
    case 'VESINVEST_PLAN_STALE_EDIT':
    case 'VESINVEST_PLAN_STALE_EDIT_TOKEN_REQUIRED':
    case 'VESINVEST_PLAN_STALE_EDIT_TOKEN_INVALID':
      return t(
        'v2Vesinvest.stalePlanRefresh',
        'This plan changed in another session. Refresh it before saving.',
      );
    case 'TARIFF_PLAN_STALE_EDIT':
    case 'TARIFF_PLAN_STALE_EDIT_TOKEN_REQUIRED':
    case 'TARIFF_PLAN_STALE_EDIT_TOKEN_INVALID':
      return t(
        'v2TariffPlan.stalePlanRefresh',
        'This tariff plan changed in another session. Refresh it before saving.',
      );
    case 'VESINVEST_PROJECT_REQUIRED':
      return t(
        'v2Vesinvest.errorProjectRequiredBeforeSync',
        'Add at least one investment project before syncing to Forecast.',
      );
    case 'VESINVEST_BASELINE_UNVERIFIED':
      return t(
        'v2Vesinvest.baselineIncompleteHint',
        'Verify VEETI, PDF, Excel, or manual evidence before fee-path output is treated as final.',
      );
    case 'VESINVEST_ALLOCATION_REQUIRED':
      return t(
        'v2Vesinvest.errorAllocationRequiredBeforeSync',
        'Add at least one yearly investment allocation before syncing to Forecast.',
      );
    default:
      break;
  }

  const status = getApiErrorStatus(err);
  if (status != null && status >= 500) {
    return t(
      'v2Reports.errorCreateVariantUnavailable',
      'Report package creation is temporarily unavailable. Please try again later.',
    );
  }
  return t(fallbackKey, fallbackText);
};

export const mapPdfDownloadError = (t: TFunction, err: unknown): string => {
  const status = getApiErrorStatus(err);
  if (status === 403) {
    return t(
      'v2Reports.errorDownloadPdfForbidden',
      'You do not have access to export this PDF.',
    );
  }
  if (status === 404) {
    return t(
      'v2Reports.errorDownloadPdfMissing',
      'This report PDF is no longer available. Refresh the report list.',
    );
  }
  if (status === 409) {
    return t(
      'v2Reports.errorDownloadPdfStale',
      'This report package is no longer current. Refresh the report list before exporting.',
    );
  }
  if (status != null && status >= 500) {
    return t(
      'v2Reports.errorDownloadPdfUnavailable',
      'PDF export is temporarily unavailable. Please try again later.',
    );
  }
  return t('v2Reports.errorDownloadPdfFailed', 'Failed to download PDF.');
};
