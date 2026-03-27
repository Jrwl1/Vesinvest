import React from 'react';
import type { TFunction } from 'i18next';

import {
  completeImportYearManuallyV2,
  createPlanningBaselineV2,
  excludeImportYearsV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
} from '../api';
import { submitWorkbookImportWorkflow } from './overviewImportWorkflows';
import { sendV2OpsEvent } from './opsTelemetry';
import type { MissingRequirement, SetupWizardStep } from './overviewWorkflow';
import type { OverviewImportController } from './useOverviewImportController';
import type {
  ManualPatchMode,
} from './useOverviewManualPatchEditor';
import type { OverviewManualPatchController } from './useOverviewManualPatchController';
import {
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
} from './yearReview';

type ReviewStatusRow = {
  year: number;
  setupStatus:
    | 'reviewed'
    | 'ready_for_review'
    | 'needs_attention'
    | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
};

type UseOverviewReviewControllerParams = {
  t: TFunction;
  importController: OverviewImportController;
  manualController: OverviewManualPatchController;
  reviewStatusRows: ReviewStatusRow[];
  reviewStorageOrgId: string | null;
  confirmedImportedYears: number[];
  reviewedImportedYearRows: Array<{ vuosi: number }>;
  importedBlockedYearCount: number;
  pendingTechnicalReviewYearCount: number;
  includedPlanningYears: number[];
  excludedYearsSorted: number[];
  correctedPlanningYears: number[];
  wizardBackStep: SetupWizardStep | null;
  openManualPatchDialog: (
    year: number,
    missingRequirements: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void>;
  resetManualPatchDialog: () => void;
  onGoToForecast: (scenarioId?: string | null) => void;
};

export function useOverviewReviewController({
  t,
  importController,
  manualController,
  reviewStatusRows,
  reviewStorageOrgId,
  confirmedImportedYears,
  reviewedImportedYearRows,
  importedBlockedYearCount,
  pendingTechnicalReviewYearCount,
  includedPlanningYears,
  excludedYearsSorted,
  correctedPlanningYears,
  wizardBackStep,
  openManualPatchDialog,
  resetManualPatchDialog,
  onGoToForecast,
}: UseOverviewReviewControllerParams) {
  const submitWorkbookImport = React.useCallback(
    async (syncAfterSave: boolean) => {
      const built = manualController.buildWorkbookImportPayloads();
      if (!built) {
        return;
      }

      manualController.setManualPatchBusy(true);
      manualController.setManualPatchError(null);
      importController.setError(null);
      importController.setInfo(null);
      try {
        const { syncedYears, nextQueueRow, shouldCloseInlineReview } =
          await submitWorkbookImportWorkflow({
            built,
            syncAfterSave,
            reviewStatusRows,
            reviewStorageOrgId,
            confirmedImportedYears,
            cardEditContext: manualController.cardEditContext,
            baselineReady: importController.baselineReady,
            runSync: importController.runSync,
            loadOverview: importController.loadOverview,
            setReviewedImportedYears: importController.setReviewedImportedYears,
            setYearDataCache: manualController.setYearDataCache,
          });

        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            years: built.yearsToSync.join(','),
            syncReadyCount: syncedYears.length,
            patchedYearCount: built.payloads.length,
          },
        });

        if (!syncAfterSave || syncedYears.length === 0) {
          importController.setInfo(
            t(
              'v2Overview.workbookImportSaved',
              'Workbook choices saved for {{count}} year(s).',
              { count: built.payloads.length },
            ),
          );
        }

        if (manualController.cardEditContext === 'step3' && nextQueueRow) {
          await manualController.openInlineCardEditor(
            nextQueueRow.year,
            null,
            'step3',
            nextQueueRow.missingRequirements,
          );
          return;
        }

        if (shouldCloseInlineReview) {
          manualController.closeInlineCardEditor();
          importController.setReviewContinueStep(
            importController.baselineReady ? 6 : 5,
          );
          return;
        }

        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }

        if (syncedYears.length > 0) {
          importController.setReviewContinueStep(
            importController.baselineReady ? 6 : 5,
          );
        }
        resetManualPatchDialog();
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            syncAfterSave,
            mode: 'workbookImport',
          },
        });
        manualController.setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportApplyFailed',
                'Applying workbook choices failed.',
              ),
        );
      } finally {
        manualController.setManualPatchBusy(false);
      }
    },
    [
      confirmedImportedYears,
      importController,
      manualController,
      openManualPatchDialog,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      t,
    ],
  );

  const submitManualPatch = React.useCallback(
    async (syncAfterSave: boolean) => {
      if (manualController.manualPatchYear == null) {
        return;
      }
      const payload = manualController.buildManualPatchPayload(
        manualController.manualPatchYear,
      );
      if (!payload) {
        return;
      }

      manualController.setManualPatchBusy(true);
      manualController.setManualPatchError(null);
      importController.setError(null);
      importController.setInfo(null);
      try {
        const currentYear = manualController.manualPatchYear;
        const result = await completeImportYearManuallyV2(payload);
        const reopenCurrentYearForFollowup =
          manualController.manualPatchMode === 'statementImport' &&
          result.syncReady;
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus:
            row.year === currentYear &&
            result.syncReady &&
            !reopenCurrentYearForFollowup
              ? ('reviewed' as const)
              : row.setupStatus,
          missingRequirements: row.missingRequirements,
        }));
        const nextQueueYear = result.syncReady
          ? resolveNextReviewQueueYear(nextRows)
          : null;
        const nextQueueRow =
          nextQueueYear == null
            ? null
            : nextRows.find((row) => row.year === nextQueueYear) ?? null;

        if (!reopenCurrentYearForFollowup) {
          importController.setReviewedImportedYears(
            markPersistedReviewedImportYears(
              reviewStorageOrgId,
              [currentYear],
              [...confirmedImportedYears, currentYear],
            ),
          );
        }
        manualController.setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[currentYear];
          return next;
        });
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            year: currentYear,
            syncReady: result.syncReady,
            patchedDataTypeCount: result.patchedDataTypes.length,
          },
        });
        if (syncAfterSave && result.syncReady) {
          await importController.runSync([currentYear]);
        } else {
          await importController.loadOverview({
            preserveVisibleState: true,
            preserveSelectionState: true,
            preserveReviewContinueStep: true,
            deferSecondaryLoads: true,
          });
          importController.setInfo(
            t('v2Overview.manualPatchSaved', { year: currentYear }),
          );
        }
        if (reopenCurrentYearForFollowup) {
          resetManualPatchDialog();
          await manualController.openInlineCardEditor(
            currentYear,
            null,
            'step3',
            manualController.manualPatchMissing,
          );
          return;
        }
        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }
        if (result.syncReady) {
          importController.setReviewContinueStep(
            importController.baselineReady ? 6 : 5,
          );
        }
        manualController.setManualPatchYear(null);
        manualController.setManualPatchMissing([]);
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            year: manualController.manualPatchYear,
            syncAfterSave,
          },
        });
        manualController.setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchFailed',
                'Manual year completion failed.',
              ),
        );
      } finally {
        manualController.setManualPatchBusy(false);
      }
    },
    [
      confirmedImportedYears,
      importController,
      manualController,
      openManualPatchDialog,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      t,
    ],
  );

  const handleDeleteYear = React.useCallback(
    async (year: number) => {
      const confirmed = window.confirm(
        t('v2Overview.excludeYearConfirm', {
          defaultValue:
            'Rajataanko vuosi {{year}} pois suunnitelmasta? Vuosi sÃ¤ilyy tyÃ¶tilassa ja sen voi palauttaa myÃ¶hemmin.',
          year,
        }),
      );
      if (!confirmed) {
        return;
      }

      importController.setRemovingYear(year);
      importController.setError(null);
      importController.setInfo(null);
      try {
        await excludeImportYearsV2([year]);
        importController.setInfo(
          t('v2Overview.excludeYearDoneSingle', {
            defaultValue: 'Vuosi {{year}} on nyt pois suunnitelmasta.',
            year,
          }),
        );
        await importController.loadOverview({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
      } catch (err) {
        importController.setError(
          err instanceof Error
            ? err.message
            : t('v2Overview.excludeYearFailedSingle', {
                defaultValue:
                  'Vuoden rajaaminen pois suunnitelmasta epÃ¤onnistui.',
              }),
        );
      } finally {
        importController.setRemovingYear(null);
      }
    },
    [importController, t],
  );

  const handleApplyVeetiReconcile = React.useCallback(
    async (year: number, dataTypes: string[]) => {
      importController.setError(null);
      importController.setInfo(null);
      try {
        await reconcileImportYearV2(year, {
          action: 'apply_veeti',
          dataTypes,
        });
        manualController.setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[year];
          return next;
        });
        await importController.loadOverview({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
        importController.setInfo(
          t('v2Overview.reconcileApplied', 'VEETI values restored for year {{year}}.', {
            year,
          }),
        );
        return true;
      } catch (err) {
        importController.setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.reconcileFailed',
                'Failed to apply VEETI values for the selected year.',
              ),
        );
        return false;
      }
    },
    [importController, manualController.setYearDataCache, t],
  );

  const handleKeepCurrentYearValues = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    const approvedYear = manualController.manualPatchYear;
    const nextRows = reviewStatusRows.map((row) => ({
      year: row.year,
      setupStatus:
        row.year === approvedYear && row.setupStatus === 'ready_for_review'
          ? ('reviewed' as const)
          : row.setupStatus,
      missingRequirements: row.missingRequirements,
    }));
    const nextReviewedYears = markPersistedReviewedImportYears(
      reviewStorageOrgId,
      [approvedYear],
      [...confirmedImportedYears, approvedYear],
    );
    const nextStep = resolveApprovedYearStep(nextRows, approvedYear);
    const nextQueueYear = resolveNextReviewQueueYear(nextRows);
    const nextQueueRow =
      nextQueueYear == null
        ? null
        : nextRows.find((row) => row.year === nextQueueYear) ?? null;

    importController.setReviewedImportedYears(nextReviewedYears);
    if (nextQueueRow) {
      if (manualController.cardEditContext === 'step3') {
        await manualController.openInlineCardEditor(
          nextQueueRow.year,
          null,
          'step3',
          nextQueueRow.missingRequirements,
        );
      } else {
        resetManualPatchDialog();
        await openManualPatchDialog(
          nextQueueRow.year,
          nextQueueRow.missingRequirements,
          'review',
        );
      }
      importController.setInfo(
        t(
          'v2Overview.keepCurrentYearValuesInfo',
          'No changes were applied for this year.',
        ),
      );
      return;
    }
    if (manualController.cardEditContext === 'step3') {
      manualController.closeInlineCardEditor();
    } else {
      resetManualPatchDialog();
    }
    importController.setReviewContinueStep(
      nextStep === 5 ? (importController.baselineReady ? 6 : 5) : null,
    );
    importController.setInfo(
      t(
        'v2Overview.keepCurrentYearValuesInfo',
        'No changes were applied for this year.',
      ),
    );
  }, [
    confirmedImportedYears,
    importController,
    manualController,
    openManualPatchDialog,
    resetManualPatchDialog,
    reviewStatusRows,
    reviewStorageOrgId,
    t,
  ]);

  const handleSwitchToStatementImportMode = React.useCallback(() => {
    manualController.setManualPatchMode('statementImport');
    manualController.setManualPatchError(null);
    manualController.setStatementImportError(null);
    manualController.setWorkbookImportError(null);
    manualController.setQdisImportError(null);
    manualController.statementFileInputRef.current?.click();
  }, [manualController]);

  const handleSwitchToWorkbookImportMode = React.useCallback(() => {
    manualController.setManualPatchMode('workbookImport');
    manualController.setManualPatchError(null);
    manualController.setWorkbookImportError(null);
    manualController.workbookFileInputRef.current?.click();
  }, [manualController]);

  const handleSwitchToQdisImportMode = React.useCallback(() => {
    manualController.setManualPatchMode('qdisImport');
    manualController.setManualPatchError(null);
    manualController.setQdisImportError(null);
    manualController.qdisFileInputRef.current?.click();
  }, [manualController]);

  const handleExcludeManualYearFromPlan = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    manualController.setManualPatchBusy(true);
    manualController.setManualPatchError(null);
    importController.setError(null);
    importController.setInfo(null);
    try {
      await excludeImportYearsV2([manualController.manualPatchYear]);
      importController.setInfo(
        t('v2Overview.excludeYearDone', 'Vuosi {{year}} on nyt pois suunnitelmasta.', {
          year: manualController.manualPatchYear,
        }),
      );
      resetManualPatchDialog();
      await importController.loadOverview({
        preserveVisibleState: true,
        preserveSelectionState: true,
        preserveReviewContinueStep: true,
        deferSecondaryLoads: true,
      });
    } catch (err) {
      manualController.setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearFailed',
              'Vuoden rajaaminen pois suunnitelmasta epÃ¤onnistui.',
            ),
      );
    } finally {
      manualController.setManualPatchBusy(false);
    }
  }, [importController, manualController, resetManualPatchDialog, t]);

  const handleRestoreManualYearToPlan = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    manualController.setManualPatchBusy(true);
    manualController.setManualPatchError(null);
    importController.setError(null);
    importController.setInfo(null);
    try {
      await restoreImportYearsV2([manualController.manualPatchYear]);
      importController.setInfo(
        t(
          'v2Overview.restoreYearDone',
          'Vuosi {{year}} on palautettu takaisin suunnitelmaan.',
          { year: manualController.manualPatchYear },
        ),
      );
      resetManualPatchDialog();
      await importController.loadOverview({
        preserveVisibleState: true,
        preserveSelectionState: true,
        preserveReviewContinueStep: true,
        deferSecondaryLoads: true,
      });
    } catch (err) {
      manualController.setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.restoreYearFailed',
              'Vuoden palauttaminen suunnitelmaan epÃ¤onnistui.',
            ),
      );
    } finally {
      manualController.setManualPatchBusy(false);
    }
  }, [importController, manualController, resetManualPatchDialog, t]);

  const handleModalApplyVeetiFinancials = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    const applied = await handleApplyVeetiReconcile(
      manualController.manualPatchYear,
      ['tilinpaatos'],
    );
    if (!applied) {
      return;
    }
    manualController.setManualPatchYear(null);
    manualController.setManualPatchMissing([]);
    manualController.setStatementImportError(null);
    manualController.setStatementImportStatus(null);
    manualController.setStatementImportPreview(null);
    if (manualController.statementFileInputRef.current) {
      manualController.statementFileInputRef.current.value = '';
    }
  }, [handleApplyVeetiReconcile, manualController]);

  const handleModalApplyVeetiPrices = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    await handleApplyVeetiReconcile(manualController.manualPatchYear, ['taksa']);
  }, [handleApplyVeetiReconcile, manualController.manualPatchYear]);

  const handleModalApplyVeetiVolumes = React.useCallback(async () => {
    if (manualController.manualPatchYear == null) {
      return;
    }
    await handleApplyVeetiReconcile(manualController.manualPatchYear, [
      'volume_vesi',
      'volume_jatevesi',
    ]);
  }, [handleApplyVeetiReconcile, manualController.manualPatchYear]);

  const handleContinueFromReview = React.useCallback(async () => {
    const target = resolveReviewContinueTarget(
      reviewStatusRows.map((row) => ({
        year: row.year,
        setupStatus: row.setupStatus,
      })),
    );
    const hasReviewedCorrectedYear = reviewStatusRows.some(
      (row) =>
        row.setupStatus === 'reviewed' &&
        (row.sourceStatus === 'MANUAL' || row.sourceStatus === 'MIXED'),
    );
    const correctedReviewedYear =
      target.selectedProblemYear == null &&
      hasReviewedCorrectedYear &&
      reviewedImportedYearRows.length > 0 &&
      importedBlockedYearCount === 0 &&
      pendingTechnicalReviewYearCount === 0 &&
      !importController.baselineReady
        ? reviewedImportedYearRows[0]?.vuosi ?? null
        : null;
    const reviewTargetYear = target.selectedProblemYear ?? correctedReviewedYear;
    if (reviewTargetYear != null) {
      importController.setReviewContinueStep(null);
      const selectedYear =
        reviewStatusRows.find((row) => row.year === reviewTargetYear) ?? null;
      if (selectedYear) {
        await manualController.openInlineCardEditor(
          selectedYear.year,
          null,
          'step3',
          selectedYear.missingRequirements,
        );
        return;
      }
      importController.handleGuideBlockedYears();
      return;
    }

    importController.setReviewContinueStep(target.nextStep);
    importController.setInfo(t('v2Overview.reviewContinueReadyHint'));
  }, [
    importController,
    importedBlockedYearCount,
    manualController,
    pendingTechnicalReviewYearCount,
    reviewStatusRows,
    reviewedImportedYearRows,
    t,
  ]);

  const handleCreatePlanningBaseline = React.useCallback(async () => {
    if (includedPlanningYears.length === 0) {
      return;
    }
    importController.setCreatingPlanningBaseline(true);
    importController.setError(null);
    importController.setInfo(null);
    try {
      const result = await createPlanningBaselineV2(includedPlanningYears);
      importController.setLatestPlanningBaselineSummary({
        includedYears: [...result.includedYears].sort((a, b) => b - a),
        excludedYears: [...excludedYearsSorted],
        correctedYears: [...correctedPlanningYears],
      });
      importController.setInfo(
        t('v2Overview.planningBaselineDone', {
          years:
            result.includedYears.length > 0
              ? result.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        }),
      );
      await importController.loadOverview();
    } catch (err) {
      importController.setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.planningBaselineFailed',
              'Suunnittelupohjan luonti epÃ¤onnistui.',
            ),
      );
    } finally {
      importController.setCreatingPlanningBaseline(false);
    }
  }, [
    correctedPlanningYears,
    excludedYearsSorted,
    importController,
    includedPlanningYears,
    t,
  ]);

  const handleWizardBack = React.useCallback(() => {
    if (wizardBackStep == null) {
      return;
    }
    manualController.closeInlineCardEditor();
    importController.setInfo(null);
    importController.setReviewContinueStep(wizardBackStep);
  }, [
    importController.setInfo,
    importController.setReviewContinueStep,
    manualController,
    wizardBackStep,
  ]);

  const handleOpenForecastHandoff = React.useCallback(() => {
    onGoToForecast();
  }, [onGoToForecast]);

  return {
    submitWorkbookImport,
    submitManualPatch,
    handleDeleteYear,
    handleApplyVeetiReconcile,
    handleKeepCurrentYearValues,
    handleSwitchToStatementImportMode,
    handleSwitchToWorkbookImportMode,
    handleSwitchToQdisImportMode,
    handleExcludeManualYearFromPlan,
    handleRestoreManualYearToPlan,
    handleModalApplyVeetiFinancials,
    handleModalApplyVeetiPrices,
    handleModalApplyVeetiVolumes,
    handleContinueFromReview,
    handleCreatePlanningBaseline,
    handleWizardBack,
    handleOpenForecastHandoff,
  };
}

export type OverviewReviewController = ReturnType<
  typeof useOverviewReviewController
>;
