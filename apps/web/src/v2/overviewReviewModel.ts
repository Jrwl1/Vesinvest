import type { TFunction } from 'i18next';
import type { InlineCardField } from './overviewManualForms';
import type {
  MissingRequirement,
  SetupYearStatus,
} from './overviewWorkflow';

export type ReadinessState = {
  financials: boolean;
  prices: boolean;
  tariffRevenue: boolean;
  volumes: boolean;
};

export type ReviewStatusRow = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  sourceStatus: string | undefined;
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  readinessChecks: Array<{
    key: keyof ReadinessState;
    ready: boolean;
  }>;
  missingRequirements: MissingRequirement[];
  warnings: string[];
  setupStatus: SetupYearStatus;
};

export type ReviewBucketKey =
  | 'good_to_go'
  | 'needs_filling'
  | 'almost_nothing'
  | 'excluded';

export type RepairAction = {
  key: 'prices' | 'volumes' | 'tariffRevenue';
  label: string;
  focusField: InlineCardField;
};

export function getReviewMissingRequirementLabel(
  t: TFunction,
  fallbackLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string,
  requirement: MissingRequirement,
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null,
): string {
  if (requirement === 'tariffRevenue') {
    return fallbackLabel(requirement, { tariffRevenueReason });
  }
  return fallbackLabel(requirement);
}

export function getReviewRepairActionLabel(
  t: TFunction,
  action: RepairAction,
): string {
  if (action.key === 'prices') {
    return t('v2Overview.repairPricesButton');
  }
  if (action.key === 'volumes') {
    return t('v2Overview.repairVolumesButton');
  }
  return t('v2Overview.manualFinancialFixedRevenue');
}

export function renderDocumentImportPageValue(preview: {
  pageNumber?: number | null;
  pageNumbers?: number[] | null;
}): string {
  if (typeof preview.pageNumber === 'number' && Number.isFinite(preview.pageNumber)) {
    return String(preview.pageNumber);
  }
  if (Array.isArray(preview.pageNumbers) && preview.pageNumbers.length > 0) {
    return preview.pageNumbers.join(', ');
  }
  return '-';
}
