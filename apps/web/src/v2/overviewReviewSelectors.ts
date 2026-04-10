import React from 'react';
import type { TFunction } from 'i18next';

import {
  buildOverviewFinancialComparisonRows,
  buildOverviewPriceComparisonRows,
  buildOverviewVolumeComparisonRows,
  buildOverviewWizardBackLabel,
  buildOverviewWorkbookImportComparisonYears,
} from './overviewReviewViewModel';
import {
  getDocumentImportCandidateKeys,
  requiresDocumentImportConfidenceReview,
} from './documentPdfImport';
import type { SetupWizardStep } from './overviewWorkflow';
import { canReapplyDatasetVeeti } from './yearReview';
import type { OverviewManualPatchController } from './useOverviewManualPatchController';

type UseOverviewReviewSelectorsParams = {
  t: TFunction;
  isAdmin: boolean;
  manualController: OverviewManualPatchController;
  wizardBackStep: SetupWizardStep | null;
  financialComparisonLabel: (key: string) => string;
  priceComparisonLabel: (key: 'waterUnitPrice' | 'wastewaterUnitPrice') => string;
  volumeComparisonLabel: (
    key: 'soldWaterVolume' | 'soldWastewaterVolume',
  ) => string;
};

export function useOverviewReviewSelectors({
  t,
  isAdmin,
  manualController,
  wizardBackStep,
  financialComparisonLabel,
  priceComparisonLabel,
  volumeComparisonLabel,
}: UseOverviewReviewSelectorsParams) {
  const isReviewMode = manualController.manualPatchMode === 'review';
  const showAllManualSections =
    manualController.manualPatchMode === 'manualEdit' &&
    manualController.manualPatchMissing.length === 0;
  const isDocumentImportMode =
    manualController.manualPatchMode === 'documentImport';
  const isWorkbookImportMode =
    manualController.manualPatchMode === 'workbookImport';
  const showFinancialSection =
    manualController.manualPatchMode !== 'review' &&
    manualController.manualPatchMode !== 'workbookImport';
  const showPricesSection =
    manualController.manualPatchMode !== 'review' &&
    manualController.manualPatchMode !== 'workbookImport';
  const showVolumesSection =
    manualController.manualPatchMode !== 'review' &&
    manualController.manualPatchMode !== 'workbookImport';

  const currentYearData =
    manualController.manualPatchYear != null
      ? manualController.yearDataCache[manualController.manualPatchYear]
      : undefined;

  const financialComparisonRows = React.useMemo(
    () =>
      manualController.manualPatchYear == null
        ? []
        : buildOverviewFinancialComparisonRows(
            manualController.yearDataCache[manualController.manualPatchYear],
            financialComparisonLabel,
          ),
    [
      financialComparisonLabel,
      manualController.manualPatchYear,
      manualController.yearDataCache,
    ],
  );
  const hasFinancialComparisonDiffs = financialComparisonRows.some(
    (row) => row.changed,
  );

  const priceComparisonRows = React.useMemo(
    () =>
      manualController.manualPatchYear == null
        ? []
        : buildOverviewPriceComparisonRows(
            manualController.yearDataCache[manualController.manualPatchYear],
            priceComparisonLabel,
          ),
    [
      manualController.manualPatchYear,
      manualController.yearDataCache,
      priceComparisonLabel,
    ],
  );
  const hasPriceComparisonDiffs = priceComparisonRows.some((row) => row.changed);

  const volumeComparisonRows = React.useMemo(
    () =>
      manualController.manualPatchYear == null
        ? []
        : buildOverviewVolumeComparisonRows(
            manualController.yearDataCache[manualController.manualPatchYear],
            volumeComparisonLabel,
          ),
    [
      manualController.manualPatchYear,
      manualController.yearDataCache,
      volumeComparisonLabel,
    ],
  );
  const hasVolumeComparisonDiffs = volumeComparisonRows.some(
    (row) => row.changed,
  );

  const hasDocumentPreviewValues =
    (manualController.documentImportPreview?.matchedFields.length ?? 0) > 0;
  const documentImportCandidateKeys =
    manualController.documentImportPreview == null
      ? []
      : getDocumentImportCandidateKeys(manualController.documentImportPreview);
  const documentImportReviewReady =
    manualController.documentImportPreview == null ||
    !requiresDocumentImportConfidenceReview(
      manualController.documentImportPreview,
    ) ||
    documentImportCandidateKeys.every((key) =>
      manualController.documentImportReviewedKeys.includes(key),
    );

  const workbookImportComparisonYears = React.useMemo(
    () =>
      buildOverviewWorkbookImportComparisonYears({
        workbookImportPreview: manualController.workbookImportPreview,
        workbookImportSelections: manualController.workbookImportSelections,
        yearDataCache: manualController.yearDataCache,
        financialComparisonLabel,
      }),
    [
      financialComparisonLabel,
      manualController.workbookImportPreview,
      manualController.workbookImportSelections,
      manualController.yearDataCache,
    ],
  );
  const hasWorkbookImportPreviewValues = workbookImportComparisonYears.some(
    (year) => year.rows.some((row) => row.workbookValue != null),
  );
  const hasWorkbookApplySelections = workbookImportComparisonYears.some((year) =>
    year.rows.some(
      (row) => row.selection === 'apply_workbook' && row.workbookValue != null,
    ),
  );
  const canConfirmDocumentImport =
    !isDocumentImportMode ||
    (manualController.documentImportPreview != null &&
      manualController.documentImportPreview.matches.length > 0 &&
      documentImportCandidateKeys.length > 0 &&
      documentImportReviewReady);
  const canConfirmImportWorkflow = canConfirmDocumentImport;
  const canReapplyPricesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['taksa'],
    isAdmin,
  );
  const canReapplyVolumesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['volume_vesi', 'volume_jatevesi'],
    isAdmin,
  );

  const wizardBackLabel = React.useMemo(
    () =>
      buildOverviewWizardBackLabel(wizardBackStep, (key, fallback) =>
        t(key, fallback ?? ''),
      ),
    [t, wizardBackStep],
  );

  return {
    isReviewMode,
    showAllManualSections,
    isDocumentImportMode,
    isWorkbookImportMode,
    showFinancialSection,
    showPricesSection,
    showVolumesSection,
    currentYearData,
    financialComparisonRows,
    hasFinancialComparisonDiffs,
    priceComparisonRows,
    hasPriceComparisonDiffs,
    volumeComparisonRows,
    hasVolumeComparisonDiffs,
    hasDocumentPreviewValues,
    workbookImportComparisonYears,
    hasWorkbookImportPreviewValues,
    hasWorkbookApplySelections,
    canConfirmDocumentImport,
    canConfirmImportWorkflow,
    canReapplyPricesForYear,
    canReapplyVolumesForYear,
    wizardBackLabel,
  };
}

export type OverviewReviewSelectors = ReturnType<
  typeof useOverviewReviewSelectors
>;
