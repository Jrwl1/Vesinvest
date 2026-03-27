import React from 'react';
import type { TFunction } from 'i18next';

import {
  buildOverviewFinancialComparisonRows,
  buildOverviewPriceComparisonRows,
  buildOverviewQdisImportComparisonRows,
  buildOverviewStatementImportComparisonRows,
  buildOverviewVolumeComparisonRows,
  buildOverviewWizardBackLabel,
  buildOverviewWorkbookImportComparisonYears,
} from './overviewReviewViewModel';
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
  const isStatementImportMode =
    manualController.manualPatchMode === 'statementImport';
  const isWorkbookImportMode =
    manualController.manualPatchMode === 'workbookImport';
  const isQdisImportMode = manualController.manualPatchMode === 'qdisImport';
  const showFinancialSection =
    manualController.manualPatchMode !== 'review' &&
    manualController.manualPatchMode !== 'qdisImport' &&
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

  const statementImportComparisonRows = React.useMemo(
    () =>
      buildOverviewStatementImportComparisonRows({
        statementImportPreview: manualController.statementImportPreview,
        currentYearData,
      }),
    [currentYearData, manualController.statementImportPreview],
  );
  const hasStatementImportPreviewValues = statementImportComparisonRows.some(
    (row) => row.pdfValue != null,
  );

  const qdisImportComparisonRows = React.useMemo(
    () =>
      buildOverviewQdisImportComparisonRows({
        currentYearData,
        qdisImportPreview: manualController.qdisImportPreview,
        labels: {
          waterPrice: t(
            'v2Overview.manualPriceWater',
            'Water unit price (EUR/m3)',
          ),
          wastewaterPrice: t(
            'v2Overview.manualPriceWastewater',
            'Wastewater unit price (EUR/m3)',
          ),
          waterVolume: t(
            'v2Overview.manualVolumeWater',
            'Sold water volume (m3)',
          ),
          wastewaterVolume: t(
            'v2Overview.manualVolumeWastewater',
            'Sold wastewater volume (m3)',
          ),
        },
      }),
    [currentYearData, manualController.qdisImportPreview, t],
  );
  const hasQdisPreviewValues = qdisImportComparisonRows.some(
    (row) => row.pdfValue != null,
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
  const canConfirmStatementImport =
    !isStatementImportMode ||
    (manualController.statementImportPreview != null &&
      hasStatementImportPreviewValues);
  const canConfirmQdisImport =
    !isQdisImportMode ||
    (manualController.qdisImportPreview != null && hasQdisPreviewValues);
  const canConfirmImportWorkflow =
    canConfirmStatementImport && canConfirmQdisImport;
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
    isStatementImportMode,
    isWorkbookImportMode,
    isQdisImportMode,
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
    statementImportComparisonRows,
    hasStatementImportPreviewValues,
    qdisImportComparisonRows,
    hasQdisPreviewValues,
    workbookImportComparisonYears,
    hasWorkbookImportPreviewValues,
    hasWorkbookApplySelections,
    canConfirmStatementImport,
    canConfirmQdisImport,
    canConfirmImportWorkflow,
    canReapplyPricesForYear,
    canReapplyVolumesForYear,
    wizardBackLabel,
  };
}

export type OverviewReviewSelectors = ReturnType<
  typeof useOverviewReviewSelectors
>;
