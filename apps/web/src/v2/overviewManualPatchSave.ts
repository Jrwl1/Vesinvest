import type { TFunction } from 'i18next';

import { completeImportYearManuallyV2,getImportYearDataV2,type V2ImportYearDataResponse,type V2ManualYearPatchPayload } from '../api';
import { sendV2OpsEvent } from './opsTelemetry';
import { getSyncBlockReasonLabel as buildSyncBlockReasonLabel } from './overviewLabels';
import type { InlineCardField } from './overviewManualForms';
import type { MissingRequirement,SetupWizardStep } from './overviewWorkflow';
import { markPersistedReviewedImportYears,resolveNextReviewQueueYear } from './yearReview';

type ReviewStatusRowLike = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  setupStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
};

export async function saveOverviewInlineCardEdit(params: {
  cardEditYear: number | null;
  cardEditContext: 'step2' | 'step3' | null;
  manualPatchMissing: MissingRequirement[];
  t: TFunction;
  buildManualPatchPayload: (year: number) => V2ManualYearPatchPayload | null;
  closeInlineCardEditor: () => void;
  openInlineCardEditor: (
    year: number,
    focusField?: InlineCardField | null,
    context?: 'step2' | 'step3',
    missingRequirements?: MissingRequirement[],
    mode?: 'review' | 'manualEdit' | 'documentImport' | 'workbookImport',
  ) => Promise<void>;
  populateManualEditorFromYearData: (yearData: V2ImportYearDataResponse) => void;
  setYearDataCache: React.Dispatch<React.SetStateAction<Record<number, V2ImportYearDataResponse>>>;
  setManualPatchBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setManualPatchError: React.Dispatch<React.SetStateAction<string | null>>;
  loadOverview: (options?: {
    preserveVisibleState?: boolean;
    deferSecondaryLoads?: boolean;
    refreshPlanningContext?: boolean;
    skipSecondaryLoads?: boolean;
  }) => Promise<void>;
  runSync: (years: number[]) => Promise<unknown>;
  reviewStatusRows: ReviewStatusRowLike[];
  confirmedImportedYears: number[];
  reviewStorageOrgId: string | null;
  baselineReady: boolean;
  setReviewedImportedYears: React.Dispatch<React.SetStateAction<number[]>>;
  setReviewContinueStep: React.Dispatch<React.SetStateAction<SetupWizardStep | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInfo: React.Dispatch<React.SetStateAction<string | null>>;
  setCardEditYear: React.Dispatch<React.SetStateAction<number | null>>;
  syncAfterSave?: boolean;
}): Promise<void> {
  const {
    cardEditYear,
    cardEditContext,
    manualPatchMissing,
    t,
    buildManualPatchPayload,
    closeInlineCardEditor,
    openInlineCardEditor,
    populateManualEditorFromYearData,
    setYearDataCache,
    setManualPatchBusy,
    setManualPatchError,
    loadOverview,
    runSync,
    reviewStatusRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    baselineReady,
    setReviewedImportedYears,
    setReviewContinueStep,
    setError,
    setInfo,
    setCardEditYear,
    syncAfterSave = false,
  } = params;
  if (cardEditYear == null) {
    return;
  }
  const payload = buildManualPatchPayload(cardEditYear);
  if (!payload) {
    return;
  }

  setManualPatchBusy(true);
  setManualPatchError(null);
  setError(null);
  setInfo(null);
  try {
    const currentYear = cardEditYear;
    const result = await completeImportYearManuallyV2(payload);
    const reopenCurrentYearForFollowup = false;
    const nextRows = reviewStatusRows.map((row) => ({
      year: row.year,
      planningRole: row.planningRole,
      setupStatus:
        row.year === currentYear && result.syncReady && !reopenCurrentYearForFollowup
          ? ('reviewed' as const)
          : row.setupStatus,
      missingRequirements: row.missingRequirements,
    }));
    const nextQueueYear = result.syncReady ? resolveNextReviewQueueYear(nextRows) : null;
    const nextQueueRow =
      nextQueueYear == null ? null : nextRows.find((row) => row.year === nextQueueYear) ?? null;

    if (result.syncReady && !reopenCurrentYearForFollowup) {
      setReviewedImportedYears(
        markPersistedReviewedImportYears(
          reviewStorageOrgId,
          [currentYear],
          [...confirmedImportedYears, currentYear],
        ),
      );
    }

    if (syncAfterSave && result.syncReady) {
      await runSync([currentYear]);
    } else {
      const refreshedYearData = await getImportYearDataV2(currentYear);
      setYearDataCache((prev) => ({ ...prev, [currentYear]: refreshedYearData }));
      populateManualEditorFromYearData(refreshedYearData);
      await loadOverview({
        preserveVisibleState: true,
        refreshPlanningContext: false,
        skipSecondaryLoads: true,
      });
      setCardEditYear(currentYear);
    }

    if (reopenCurrentYearForFollowup) {
      await openInlineCardEditor(currentYear, null, 'step3', manualPatchMissing);
    } else if (cardEditContext === 'step3' && result.syncReady) {
      if (nextQueueRow) {
        await openInlineCardEditor(nextQueueRow.year, null, 'step3', nextQueueRow.missingRequirements);
      } else {
        closeInlineCardEditor();
        setReviewContinueStep(baselineReady ? 6 : 5);
      }
    } else if (cardEditContext === 'step3') {
      setCardEditYear(currentYear);
    } else {
      closeInlineCardEditor();
    }

    const savedYear = result.status.years.find((row) => row.vuosi === currentYear);
    const savedYearReason = savedYear ? buildSyncBlockReasonLabel(t, savedYear) : null;
    setInfo(
      result.syncReady
        ? t('v2Overview.manualPatchSaved', { year: currentYear })
        : savedYearReason
          ? t('v2Overview.manualPatchSavedNeedsReview', {
              year: currentYear,
              reason: savedYearReason,
            })
          : t(
              'v2Overview.manualPatchSavedStillBlocked',
              'Year {{year}} was saved. Review is still incomplete.',
              { year: currentYear },
            ),
    );
    sendV2OpsEvent({
      event: 'veeti_manual_patch',
      status: 'ok',
      attrs: {
        year: currentYear,
        syncReady: result.syncReady,
        patchedDataTypeCount: result.patchedDataTypes.length,
        surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
      },
    });
  } catch (err) {
    sendV2OpsEvent({
      event: 'veeti_manual_patch',
      status: 'error',
      attrs: {
        year: cardEditYear,
        surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
      },
    });
    setManualPatchError(
      err instanceof Error
        ? err.message
        : t('v2Overview.manualPatchFailed', 'Manual year completion failed.'),
    );
  } finally {
    setManualPatchBusy(false);
  }
}
