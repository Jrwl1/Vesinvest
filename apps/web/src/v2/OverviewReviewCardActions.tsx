import React from 'react';
import type { TFunction } from 'i18next';

import type { InlineCardField } from './overviewManualForms';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import type { MissingRequirement } from './overviewWorkflow';
import type { RepairAction, ReviewStatusRow } from './overviewReviewModel';

type OverviewReviewCardActionsProps = {
  t: TFunction;
  row: ReviewStatusRow;
  isInlineReviewActive: boolean;
  isAdmin: boolean;
  isCurrentYearReadyForReview: boolean;
  manualPatchBusy: boolean;
  documentImportBusy: boolean;
  workbookImportBusy: boolean;
  isManualYearExcluded: boolean;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
  buildRepairActions: (
    year: number,
    missingRequirements: MissingRequirement[],
  ) => RepairAction[];
  openInlineCardEditor: (
    year: number,
    focusField: InlineCardField | null,
    context?: 'step2' | 'step3',
    missing?: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void> | void;
  handleKeepCurrentYearValues: () => void;
  handleSwitchToManualEditMode: () => void;
  handleSwitchToDocumentImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
  handleRestoreManualYearToPlan: () => void;
  handleExcludeManualYearFromPlan: () => void;
  handleModalApplyVeetiFinancials: () => void;
  handleModalApplyVeetiPrices: () => void;
  handleModalApplyVeetiVolumes: () => void;
  closeInlineCardEditor: () => void;
};

export const OverviewReviewCardActions: React.FC<
  OverviewReviewCardActionsProps
> = ({
  t,
  row,
  isInlineReviewActive,
  isAdmin,
  isCurrentYearReadyForReview,
  manualPatchBusy,
  documentImportBusy,
  workbookImportBusy,
  isManualYearExcluded,
  canReapplyFinancialVeetiForYear,
  canReapplyPricesForYear,
  canReapplyVolumesForYear,
  keepYearButtonClass,
  fixYearButtonClass,
  buildRepairActions,
  openInlineCardEditor,
  handleKeepCurrentYearValues,
  handleSwitchToManualEditMode,
  handleSwitchToDocumentImportMode,
  handleSwitchToWorkbookImportMode,
  handleRestoreManualYearToPlan,
  handleExcludeManualYearFromPlan,
  handleModalApplyVeetiFinancials,
  handleModalApplyVeetiPrices,
  handleModalApplyVeetiVolumes,
  closeInlineCardEditor,
}) => (
  <div className="v2-year-status-actions">
    {isInlineReviewActive ? (
      <>
        {isCurrentYearReadyForReview ? (
          <button
            type="button"
            className={keepYearButtonClass}
            onClick={handleKeepCurrentYearValues}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.keepYearInPlan')}
          </button>
        ) : null}
        <button
          type="button"
          className={fixYearButtonClass}
          onClick={handleSwitchToManualEditMode}
          disabled={manualPatchBusy}
        >
          {t('v2Overview.fixYearValues')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small v2-btn-quiet"
          onClick={handleSwitchToDocumentImportMode}
          disabled={manualPatchBusy || documentImportBusy}
        >
          {t('v2Overview.documentImportAction', 'Import source PDF')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small v2-btn-quiet"
          onClick={handleSwitchToWorkbookImportMode}
          disabled={manualPatchBusy || workbookImportBusy}
        >
          {t('v2Overview.workbookImportAction', 'Import KVA workbook')}
        </button>
        <button
          type="button"
          className={`v2-btn v2-btn-small ${
            isManualYearExcluded
              ? 'v2-btn-plan-membership'
              : 'v2-btn-plan-membership v2-btn-plan-membership-danger'
          }`}
          onClick={
            isManualYearExcluded
              ? handleRestoreManualYearToPlan
              : handleExcludeManualYearFromPlan
          }
          disabled={manualPatchBusy}
        >
          {t(
            isManualYearExcluded
              ? 'v2Overview.restoreYearToPlan'
              : 'v2Overview.excludeYearFromPlan',
            isManualYearExcluded
              ? 'Palauta suunnitelmaan'
              : 'Pois suunnitelmasta',
          )}
        </button>
        {canReapplyFinancialVeetiForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small v2-btn-quiet"
            onClick={handleModalApplyVeetiFinancials}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiFinancials', 'Use VEETI financials')}
          </button>
        ) : null}
        {canReapplyPricesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small v2-btn-quiet"
            onClick={handleModalApplyVeetiPrices}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiPrices', 'Use VEETI prices')}
          </button>
        ) : null}
        {canReapplyVolumesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small v2-btn-quiet"
            onClick={handleModalApplyVeetiVolumes}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiVolumes', 'Use VEETI volumes')}
          </button>
        ) : null}
        {isAdmin && row.missingRequirements.length > 0 ? (
          <>
            {buildRepairActions(row.year, row.missingRequirements).map((action) => (
              <button
                key={action.key}
                type="button"
                className="v2-btn v2-btn-small v2-btn-quiet"
                onClick={() =>
                  void openInlineCardEditor(
                    row.year,
                    action.focusField,
                    'step3',
                    row.missingRequirements,
                  )
                }
                disabled={manualPatchBusy}
              >
                {action.label}
              </button>
            ))}
          </>
        ) : null}
        <button
          type="button"
          className="v2-btn v2-btn-small v2-btn-quiet"
          onClick={closeInlineCardEditor}
          disabled={manualPatchBusy}
        >
          {t('common.close', 'Close')}
        </button>
      </>
    ) : (
      <>
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() =>
            void openInlineCardEditor(
              row.year,
              null,
              'step3',
              row.missingRequirements,
            )
          }
        >
          {t('v2Overview.openReviewYearButton')}
        </button>
      </>
    )}
  </div>
);
