import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  completeImportYearManuallyV2,
  createPlanningBaselineV2,
  excludeImportYearsV2,
  getImportYearDataV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
} from '../api';
import {
  getDatasetSourceLabel as buildDatasetSourceLabel,
  getFinancialComparisonLabel as buildFinancialComparisonLabel,
  getImportWarningLabel as buildImportWarningLabel,
  getMissingRequirementLabel as buildMissingRequirementLabel,
  getPriceComparisonLabel as buildPriceComparisonLabel,
  getSourceLayerText as buildSourceLayerText,
  getSourceStatusClassName as buildSourceStatusClassName,
  getSourceStatusLabel as buildSourceStatusLabel,
  getVolumeComparisonLabel as buildVolumeComparisonLabel,
  renderDatasetCounts as formatDatasetCounts,
  renderDatasetTypeList as formatDatasetTypeList,
} from './overviewLabels';
import { submitWorkbookImportWorkflow } from './overviewImportWorkflows';
import { useOverviewImportController } from './useOverviewImportController';
import { useOverviewManualPatchController } from './useOverviewManualPatchController';
import {
  renderOverviewHighlightedSearchMatch,
  renderOverviewStep2InlineFieldEditor,
  renderOverviewYearValuePreview,
} from './overviewRenderers';
import {
  buildOverviewFinancialComparisonRows,
  buildOverviewPriceComparisonRows,
  buildOverviewQdisImportComparisonRows,
  buildOverviewStatementImportComparisonRows,
  buildOverviewVolumeComparisonRows,
  buildOverviewWizardBackLabel,
  buildOverviewWorkbookImportComparisonYears,
} from './overviewReviewViewModel';
import {
  useOverviewSetupState,
} from './useOverviewSetupState';
import {
  getSyncBlockReasonKey,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  buildImportYearSourceLayers,
  canReapplyDatasetVeeti,
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
} from './yearReview';

export type OverviewPageControllerProps = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
  setupBackSignal?: number;
};

export function useOverviewPageController({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
  setupBackSignal,
}: OverviewPageControllerProps) {
  const { t } = useTranslation();

  const resolveSyncBlockReason = React.useCallback(
    (row: { completeness: Record<string, boolean> }): string | null => {
      const key = getSyncBlockReasonKey({
        vuosi: 0,
        completeness: row.completeness,
      });
      if (!key) {
        return null;
      }
      if (key === 'v2Overview.yearReasonMissingFinancials') {
        return t(key, 'Missing financial statement data.');
      }
      if (key === 'v2Overview.yearReasonMissingPrices') {
        return t(key, 'Missing price data (taksa).');
      }
      return t(key, 'Missing sold volume data.');
    },
    [t],
  );

  const pickDefaultSyncYears = React.useCallback(
    (rows: Array<{ vuosi: number; completeness: Record<string, boolean> }>) =>
      [...rows]
        .filter((row) => resolveSyncBlockReason(row) === null)
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi),
    [resolveSyncBlockReason],
  );

  const manualController = useOverviewManualPatchController({ t });
  const importController = useOverviewImportController({
    t,
    pickDefaultSyncYears,
    setYearDataCache: manualController.setYearDataCache,
  });

  const {
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    recommendedYears,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    parkedTrustBoardRows,
    blockedTrustBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    excludedYearsSorted,
    reviewStatusRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    pendingReviewYearCount,
    includedPlanningYears,
    acceptedPlanningYearRows,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
    setupWizardState,
    wizardDisplayStep,
    displaySetupWizardState,
    wizardBackStep,
    previewPrefetchYears,
    selectableImportYearRows,
  } = useOverviewSetupState({
    overview: importController.overview,
    yearDataCache: manualController.yearDataCache,
    selectedYears: importController.selectedYears,
    importedWorkspaceYears: importController.importedWorkspaceYears,
    backendAcceptedPlanningYears: importController.backendAcceptedPlanningYears,
    reviewedImportedYears: importController.reviewedImportedYears,
    setReviewedImportedYears: importController.setReviewedImportedYears,
    manualPatchYear: manualController.manualPatchYear,
    cardEditYear: manualController.cardEditYear,
    cardEditContext: manualController.cardEditContext,
    reviewContinueStep: importController.reviewContinueStep,
    baselineReady: importController.baselineReady,
    t,
  });

  const saveInlineCardEdit = React.useCallback(
    async (syncAfterSave = false) =>
      manualController.saveInlineCardEdit({
        syncAfterSave,
        loadOverview: importController.loadOverview,
        runSync: importController.runSync,
        reviewStatusRows,
        confirmedImportedYears,
        reviewStorageOrgId,
        baselineReady: importController.baselineReady,
        setReviewedImportedYears: importController.setReviewedImportedYears,
        setReviewContinueStep: importController.setReviewContinueStep,
        setError: importController.setError,
        setInfo: importController.setInfo,
      }),
    [
      confirmedImportedYears,
      importController,
      manualController,
      reviewStatusRows,
      reviewStorageOrgId,
    ],
  );

  const handleInlineCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        manualController.dismissInlineCardEditor(true);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') {
          return;
        }
        event.preventDefault();
        void saveInlineCardEdit(false);
      }
    },
    [manualController, saveInlineCardEdit],
  );

  const renderHighlightedSearchMatch = React.useCallback(
    (value: string): React.ReactNode =>
      renderOverviewHighlightedSearchMatch(value, importController.searchTerm),
    [importController.searchTerm],
  );

  const openManualPatchDialog = manualController.openManualPatchDialog;

  const resetManualPatchDialog = React.useCallback(() => {
    importController.setReviewContinueStep(null);
    manualController.resetManualPatchDialogState();
  }, [importController.setReviewContinueStep, manualController]);

  const closeManualPatchDialog = React.useCallback(() => {
    if (
      manualController.manualPatchBusy ||
      manualController.statementImportBusy ||
      manualController.workbookImportBusy
    ) {
      return;
    }
    resetManualPatchDialog();
  }, [manualController, resetManualPatchDialog]);

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => buildSourceStatusLabel(t, status),
    [t],
  );

  const sourceStatusClassName = React.useCallback(
    (status: string | undefined) => buildSourceStatusClassName(status),
    [],
  );

  const financialComparisonLabel = React.useCallback(
    (key: string) => buildFinancialComparisonLabel(t, key),
    [t],
  );

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: Parameters<typeof buildDatasetSourceLabel>[2],
    ) => buildDatasetSourceLabel(t, source, provenance),
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => formatDatasetTypeList(t, dataTypes),
    [t],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => buildImportWarningLabel(t, warning),
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => formatDatasetCounts(t, counts),
    [t],
  );

  const missingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) =>
      buildMissingRequirementLabel(t, requirement),
    [t],
  );

  const sourceLayerText = React.useCallback(
    (layer: ReturnType<typeof buildImportYearSourceLayers>[number]): string =>
      buildSourceLayerText(t, layer),
    [t],
  );

  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') =>
      buildPriceComparisonLabel(t, key),
    [t],
  );

  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') =>
      buildVolumeComparisonLabel(t, key),
    [t],
  );

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

  const loadYearPreviewData = React.useCallback(
    async (year: number) => {
      if (
        manualController.yearDataCache[year] ||
        importController.previewFetchYearsRef.current.has(year)
      ) {
        return;
      }
      importController.previewFetchYearsRef.current.add(year);
      try {
        const yearData = await getImportYearDataV2(year);
        manualController.setYearDataCache((prev) =>
          prev[year] ? prev : { ...prev, [year]: yearData },
        );
      } catch {
        // Preview cards fall back gracefully when data is unavailable.
      } finally {
        importController.previewFetchYearsRef.current.delete(year);
      }
    },
    [importController.previewFetchYearsRef, manualController],
  );

  const renderYearValuePreview = React.useCallback(
    (
      year: number,
      availability?: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
      options?: {
        compact?: boolean;
      },
    ) =>
      renderOverviewYearValuePreview({
        year,
        t,
        yearDataCache: manualController.yearDataCache,
        sourceLayerText,
        availability,
        options,
      }),
    [manualController.yearDataCache, sourceLayerText, t],
  );

  const renderStep2InlineFieldEditor = React.useCallback(
    (field: Parameters<typeof renderOverviewStep2InlineFieldEditor>[0]['field']) =>
      renderOverviewStep2InlineFieldEditor({
        field,
        t,
        cardEditYear: manualController.cardEditYear,
        manualPatchBusy: manualController.manualPatchBusy,
        manualFinancials: manualController.manualFinancials,
        setManualFinancials: manualController.setManualFinancials,
        manualPrices: manualController.manualPrices,
        setManualPrices: manualController.setManualPrices,
        manualVolumes: manualController.manualVolumes,
        setManualVolumes: manualController.setManualVolumes,
        setInlineCardFieldRef: manualController.setInlineCardFieldRef,
        handleInlineCardKeyDown,
        saveInlineCardEdit,
        dismissInlineCardEditor: manualController.dismissInlineCardEditor,
    }),
    [handleInlineCardKeyDown, manualController, saveInlineCardEdit, t],
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

  const setupStatusLabel = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return t('v2Overview.setupStatusReviewed', 'Reviewed');
      }
      if (status === 'ready_for_review') {
        return t('v2Overview.setupStatusTechnicalReady', 'Ready for review');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded');
      }
      return t('v2Overview.setupStatusNeedsAttention');
    },
    [t],
  );

  const setupStatusClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return 'v2-status-positive';
      }
      if (status === 'ready_for_review') {
        return 'v2-status-info';
      }
      if (status === 'excluded_from_plan') {
        return 'v2-status-provenance';
      }
      return 'v2-status-warning';
    },
    [],
  );

  const yearStatusRowClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => status,
    [],
  );

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
      const selectedYear = reviewStatusRows.find((row) => row.year === reviewTargetYear);
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

  const handleOpenForecastHandoff = React.useCallback(() => {
    onGoToForecast();
  }, [onGoToForecast]);

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
          waterPrice: t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)'),
          wastewaterPrice: t(
            'v2Overview.manualPriceWastewater',
            'Wastewater unit price (EUR/m3)',
          ),
          waterVolume: t('v2Overview.manualVolumeWater', 'Sold water volume (m3)'),
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
  const hasWorkbookImportPreviewValues = workbookImportComparisonYears.some((year) =>
    year.rows.some((row) => row.workbookValue != null),
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

  React.useEffect(() => {
    for (const year of previewPrefetchYears) {
      void loadYearPreviewData(year);
    }
  }, [loadYearPreviewData, previewPrefetchYears]);

  React.useEffect(() => {
    if (!displaySetupWizardState) {
      return;
    }
    onSetupWizardStateChange?.(displaySetupWizardState);
  }, [displaySetupWizardState, onSetupWizardStateChange]);

  React.useEffect(() => {
    if (!setupBackSignal) {
      return;
    }
    if (setupBackSignal === importController.handledSetupBackSignalRef.current) {
      return;
    }
    importController.handledSetupBackSignalRef.current = setupBackSignal;
    handleWizardBack();
  }, [handleWizardBack, importController.handledSetupBackSignalRef, setupBackSignal]);

  React.useEffect(() => {
    if (importController.loading) {
      return;
    }
    onSetupOrgNameChange?.(importController.overview?.importStatus.link?.nimi ?? null);
  }, [
    importController.loading,
    importController.overview?.importStatus.link?.nimi,
    onSetupOrgNameChange,
  ]);

  return {
    t,
    ...importController,
    ...manualController,
    resolveSyncBlockReason,
    pickDefaultSyncYears,
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    recommendedYears,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    parkedTrustBoardRows,
    blockedTrustBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    excludedYearsSorted,
    reviewStatusRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    pendingReviewYearCount,
    includedPlanningYears,
    acceptedPlanningYearRows,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
    setupWizardState,
    wizardDisplayStep,
    displaySetupWizardState,
    wizardBackStep,
    previewPrefetchYears,
    selectableImportYearRows,
    saveInlineCardEditBase: manualController.saveInlineCardEdit,
    saveInlineCardEdit,
    handleInlineCardKeyDown,
    renderHighlightedSearchMatch,
    openManualPatchDialog,
    resetManualPatchDialog,
    closeManualPatchDialog,
    submitWorkbookImport,
    submitManualPatch,
    renderStep2InlineFieldEditor,
    sourceStatusLabel,
    sourceStatusClassName,
    financialComparisonLabel,
    datasetSourceLabel,
    renderDatasetTypeList,
    importWarningLabel,
    renderDatasetCounts,
    loadYearPreviewData,
    renderYearValuePreview,
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
    setupStatusLabel,
    setupStatusClassName,
    yearStatusRowClassName,
    handleContinueFromReview,
    handleCreatePlanningBaseline,
    handleOpenForecastHandoff,
    missingRequirementLabel,
    sourceLayerText,
    priceComparisonLabel,
    volumeComparisonLabel,
    isReviewMode,
    showAllManualSections,
    isStatementImportMode,
    isWorkbookImportMode,
    isQdisImportMode,
    showFinancialSection,
    showPricesSection,
    showVolumesSection,
    financialComparisonRows,
    hasFinancialComparisonDiffs,
    priceComparisonRows,
    hasPriceComparisonDiffs,
    volumeComparisonRows,
    hasVolumeComparisonDiffs,
    currentYearData,
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
    handleWizardBack,
  };
}

export type OverviewPageController = ReturnType<typeof useOverviewPageController>;
