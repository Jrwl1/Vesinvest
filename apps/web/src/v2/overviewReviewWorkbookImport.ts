import type { TFunction } from 'i18next';

import { sendV2OpsEvent } from './opsTelemetry';
import { submitWorkbookImportWorkflow } from './overviewImportWorkflows';
import type { MissingRequirement } from './overviewWorkflow';
import type { OverviewImportController } from './useOverviewImportController';
import type { OverviewManualPatchController } from './useOverviewManualPatchController';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';

type ReviewStatusRow = {
  year: number;
  completeness: Record<string, boolean>;
  setupStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
};

export async function submitOverviewWorkbookImport(params: {
  syncAfterSave: boolean;
  t: TFunction;
  manualController: OverviewManualPatchController;
  importController: OverviewImportController;
  reviewStatusRows: ReviewStatusRow[];
  reviewStorageOrgId: string | null;
  confirmedImportedYears: number[];
  resetManualPatchDialog: () => void;
  openManualPatchDialog: (
    year: number,
    missingRequirements: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void>;
}) {
  const {
    syncAfterSave,
    t,
    manualController,
    importController,
    reviewStatusRows,
    reviewStorageOrgId,
    confirmedImportedYears,
    resetManualPatchDialog,
    openManualPatchDialog,
  } = params;
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
        t('v2Overview.workbookImportSaved', 'Workbook choices saved for {{count}} year(s).', {
          count: built.payloads.length,
        }),
      );
    }

    if (manualController.cardEditContext === 'step3' && nextQueueRow) {
      await manualController.openInlineCardEditor(nextQueueRow.year, null, 'step3', nextQueueRow.missingRequirements);
      return;
    }

    if (shouldCloseInlineReview) {
      manualController.closeInlineCardEditor();
      importController.setReviewContinueStep(importController.baselineReady ? 6 : 5);
      return;
    }

    if (nextQueueRow) {
      resetManualPatchDialog();
      await openManualPatchDialog(nextQueueRow.year, nextQueueRow.missingRequirements, 'review');
      return;
    }

    if (syncedYears.length > 0) {
      importController.setReviewContinueStep(importController.baselineReady ? 6 : 5);
    }
    resetManualPatchDialog();
  } catch (err) {
    sendV2OpsEvent({
      event: 'veeti_manual_patch',
      status: 'error',
      attrs: { syncAfterSave, mode: 'workbookImport' },
    });
    manualController.setManualPatchError(
      err instanceof Error
        ? err.message
        : t('v2Overview.workbookImportApplyFailed', 'Applying workbook choices failed.'),
    );
  } finally {
    manualController.setManualPatchBusy(false);
  }
}
