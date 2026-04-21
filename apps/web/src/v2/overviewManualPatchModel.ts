import { getFinancialSourceFieldLabel } from './overviewLabels';
import type { OverviewPageController } from './useOverviewPageController';
import { canReapplyDatasetVeeti,canReapplyFinancialVeeti } from './yearReview';

type ReviewStatusRow = OverviewPageController['reviewStatusRows'][number];
type SetupYearStatus = ReviewStatusRow['setupStatus'];

type ManualPatchControllerSlice = Pick<
  OverviewPageController,
  | 'currentYearData'
  | 'datasetSourceLabel'
  | 'excludedYearsSorted'
  | 'manualPatchMode'
  | 'manualPatchYear'
  | 'reviewStatusRows'
  | 't'
  | 'yearDataCache'
>;

export type OverviewManualPatchViewModel = {
  statementImportImpact: {
    currentFinancialSource: string | null;
    keepVeeti: string[];
    keepManual: string[];
    keepEmpty: string[];
  };
  currentFinancialFieldSources: Array<{
    sourceField: string;
    label: string;
    owner: string;
  }>;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  currentFinancialSourceLabel: string;
  isManualYearExcluded: boolean;
  currentManualYearStatus: SetupYearStatus | 'needs_attention';
  isCurrentYearReadyForReview: boolean;
  manualPatchDialogTitle: string;
  manualPatchDialogBody: string;
  yearActionsBody: string;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
};

export const buildOverviewManualPatchViewModel = (
  controller: ManualPatchControllerSlice,
  isAdmin: boolean,
): OverviewManualPatchViewModel => {
  const {
    currentYearData,
    datasetSourceLabel,
    excludedYearsSorted,
    manualPatchMode,
    manualPatchYear,
    reviewStatusRows,
    t,
    yearDataCache,
  } = controller;

  const statementImportImpact = (() => {
    if (manualPatchYear == null) {
      return {
        currentFinancialSource: null as string | null,
        keepVeeti: [] as string[],
        keepManual: [] as string[],
        keepEmpty: [] as string[],
      };
    }

    const yearData = yearDataCache[manualPatchYear];
    const datasets = yearData?.datasets ?? [];
    return {
      currentFinancialSource:
        datasets.find((dataset) => dataset.dataType === 'tilinpaatos')?.source ??
        null,
      keepVeeti: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'veeti',
        )
        .map((dataset) => dataset.dataType),
      keepManual: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'manual',
        )
        .map((dataset) => dataset.dataType),
      keepEmpty: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'none',
        )
        .map((dataset) => dataset.dataType),
    };
  })();

  const currentFinancialDataset =
    manualPatchYear != null
      ? yearDataCache[manualPatchYear]?.datasets.find(
          (dataset) => dataset.dataType === 'tilinpaatos',
        ) ?? null
      : null;

  const currentFinancialFieldSources = (() => {
    const fieldSources =
      currentFinancialDataset?.overrideMeta?.provenance?.fieldSources;
    if (!fieldSources || fieldSources.length === 0) {
      return [];
    }

    return fieldSources.map((fieldSource) => ({
      sourceField: fieldSource.sourceField,
      label: getFinancialSourceFieldLabel(t, fieldSource.sourceField),
      owner: datasetSourceLabel('manual', fieldSource.provenance),
    }));
  })();

  const currentFinancialSourceLabel = currentFinancialDataset
    ? datasetSourceLabel(
        currentFinancialDataset.source,
        currentFinancialDataset.overrideMeta?.provenance,
      )
    : t('v2Overview.sourceIncomplete', 'Incomplete');

  const isManualYearExcluded =
    manualPatchYear != null && excludedYearsSorted.includes(manualPatchYear);

  const currentManualYearStatus =
    manualPatchYear != null
      ? reviewStatusRows.find((row) => row.year === manualPatchYear)?.setupStatus ??
        (isManualYearExcluded ? 'excluded_from_plan' : 'ready_for_review')
      : 'needs_attention';

  const isCurrentYearReadyForReview =
    currentManualYearStatus === 'ready_for_review' ||
    currentManualYearStatus === 'reviewed';

  const manualPatchDialogTitle = isCurrentYearReadyForReview
    ? t('v2Overview.wizardQuestionReviewYear')
    : t('v2Overview.wizardQuestionFixYear');

  const manualPatchDialogBody = isManualYearExcluded
    ? t('v2Overview.manualPatchExcludedBody')
    : isCurrentYearReadyForReview
      ? t('v2Overview.wizardBodyReviewYear')
      : t('v2Overview.wizardBodyFixYear');

  const yearActionsBody = isManualYearExcluded
    ? t(
        'v2Overview.yearActionsExcludedBody',
        'Review the imported values, then restore the year to the plan or keep it excluded.',
      )
    : isCurrentYearReadyForReview
      ? t(
          'v2Overview.yearActionsReviewBody',
          'Approve the year as-is after reviewing the comparison, or open editing only if something needs to change.',
        )
      : t(
          'v2Overview.yearActionsFixBody',
          'Choose whether to correct the year, restore VEETI values, or exclude the year from the planning baseline.',
        );

  const keepYearButtonClass =
    isCurrentYearReadyForReview && manualPatchMode === 'review'
      ? 'v2-btn v2-btn-small v2-btn-primary'
      : 'v2-btn v2-btn-small';

  const fixYearButtonClass =
    currentManualYearStatus === 'needs_attention' && manualPatchMode === 'review'
      ? 'v2-btn v2-btn-small v2-btn-primary'
      : 'v2-btn v2-btn-small';

  return {
    statementImportImpact,
    currentFinancialFieldSources,
    canReapplyFinancialVeetiForYear:
      manualPatchYear != null &&
      canReapplyFinancialVeeti(yearDataCache[manualPatchYear], isAdmin),
    canReapplyPricesForYear: canReapplyDatasetVeeti(
      currentYearData,
      ['taksa'],
      isAdmin,
    ),
    canReapplyVolumesForYear: canReapplyDatasetVeeti(
      currentYearData,
      ['volume_vesi', 'volume_jatevesi'],
      isAdmin,
    ),
    currentFinancialSourceLabel,
    isManualYearExcluded,
    currentManualYearStatus,
    isCurrentYearReadyForReview,
    manualPatchDialogTitle,
    manualPatchDialogBody,
    yearActionsBody,
    keepYearButtonClass,
    fixYearButtonClass,
  };
};
