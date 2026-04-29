import type { TFunction } from 'i18next';
import React from 'react';

export const OverviewManualPatchYearDetailsSection: React.FC<{
  t: TFunction;
  currentFinancialSourceLabel: string;
  isManualYearExcluded: boolean;
  isReviewMode: boolean;
  currentManualYearStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  setupStatusLabel: (
    status: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan',
  ) => string;
  currentFinancialFieldSources: Array<{ label: string; owner: string }>;
}> = ({
  t,
  currentFinancialSourceLabel,
  isManualYearExcluded,
  isReviewMode,
  currentManualYearStatus,
  setupStatusLabel,
  currentFinancialFieldSources,
}) => (
  <section className="v2-manual-section">
    <div className="v2-manual-section-head">
      <h4>{t('v2Overview.yearDetailTitle', 'Year review surface')}</h4>
      <span className="v2-required-pill v2-required-pill-optional">{currentFinancialSourceLabel}</span>
    </div>
    <p className="v2-muted">
      {isManualYearExcluded
        ? t(
            'v2Overview.yearDetailExcludedBody',
            'This year is excluded from the planning baseline, but you can still review the imported values and restore it when needed.',
          )
        : t(
            'v2Overview.yearDetailBody',
            'Review the imported year calmly before deciding what to edit, restore from VEETI, or keep as-is.',
          )}
    </p>
    {isReviewMode ? (
      <p className="v2-manual-review-note">
        {t(
          'v2Overview.reviewModeHint',
          'Edit fields stay hidden until you choose "Fix values". Start by reviewing the comparison and deciding what to do with the year.',
        )}
      </p>
    ) : null}
    <div className="v2-keyvalue-list">
      <div className="v2-keyvalue-row">
        <span>{t('v2Overview.yearDetailStatus', 'Current status')}</span>
        <span>{setupStatusLabel(currentManualYearStatus)}</span>
      </div>
      <div className="v2-keyvalue-row">
        <span>{t('v2Overview.yearDetailSource', 'Current source')}</span>
        <span>{currentFinancialSourceLabel}</span>
      </div>
      {currentFinancialFieldSources.length > 0 ? (
        <div className="v2-keyvalue-row">
          <span>{t('v2Overview.yearDetailFinancialOwnership', 'Financial field ownership')}</span>
          <span>
            {currentFinancialFieldSources.map((field) => `${field.label}: ${field.owner}`).join(' | ')}
          </span>
        </div>
      ) : null}
    </div>
  </section>
);

export const OverviewManualPatchActionSection: React.FC<{
  t: TFunction;
  isWorkbookImportMode: boolean;
  yearActionsBody: string;
  isCurrentYearReadyForReview: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
  handleKeepCurrentYearValues: () => void;
  handleSwitchToManualEditMode: () => void;
  handleSwitchToDocumentImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
  isManualYearExcluded: boolean;
  handleRestoreManualYearToPlan: () => void;
  handleExcludeManualYearFromPlan: () => void;
  manualPatchBusy: boolean;
  documentImportBusy: boolean;
  workbookImportBusy: boolean;
}> = ({
  t,
  isWorkbookImportMode,
  yearActionsBody,
  isCurrentYearReadyForReview,
  keepYearButtonClass,
  fixYearButtonClass,
  handleKeepCurrentYearValues,
  handleSwitchToManualEditMode,
  handleSwitchToDocumentImportMode,
  handleSwitchToWorkbookImportMode,
  isManualYearExcluded,
  handleRestoreManualYearToPlan,
  handleExcludeManualYearFromPlan,
  manualPatchBusy,
  documentImportBusy,
  workbookImportBusy,
}) =>
  !isWorkbookImportMode ? (
    <section className="v2-manual-section">
      <div className="v2-manual-section-head">
        <h4>{t('v2Overview.yearActionsTitle', 'Year actions')}</h4>
      </div>
      <p className="v2-muted">{yearActionsBody}</p>
      <div className="v2-year-card-actions">
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
          className="v2-btn v2-btn-small"
          onClick={handleSwitchToDocumentImportMode}
          disabled={manualPatchBusy || documentImportBusy}
        >
          {t('v2Overview.documentImportAction', 'Import source PDF')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={handleSwitchToWorkbookImportMode}
          disabled={manualPatchBusy || workbookImportBusy}
        >
          {t('v2Overview.workbookImportAction', 'Repair from Excel')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={isManualYearExcluded ? handleRestoreManualYearToPlan : handleExcludeManualYearFromPlan}
          disabled={manualPatchBusy}
        >
          {t(
            isManualYearExcluded ? 'v2Overview.restoreYearToPlan' : 'v2Overview.excludeYearFromPlan',
            isManualYearExcluded ? 'Palauta suunnitelmaan' : 'Pois suunnitelmasta',
          )}
        </button>
      </div>
    </section>
  ) : null;

export const OverviewManualPatchFooterActions: React.FC<{
  t: TFunction;
  closeDisabled: boolean;
  closeManualPatchDialog: () => void;
  isReviewMode: boolean;
  showManualSaveActions: boolean;
  manualPatchBusy: boolean;
  isDocumentImportMode: boolean;
  submitManualPatch: (syncAfterSave: boolean) => void;
  saveDisabled: boolean;
  wizardDisplayStep: number;
}> = ({
  t,
  closeDisabled,
  closeManualPatchDialog,
  isReviewMode,
  showManualSaveActions,
  manualPatchBusy,
  isDocumentImportMode,
  submitManualPatch,
  saveDisabled,
  wizardDisplayStep,
}) => (
  <div className="v2-modal-actions">
    <button type="button" className="v2-btn" onClick={closeManualPatchDialog} disabled={closeDisabled}>
      {t(isReviewMode ? 'common.close' : 'common.cancel', isReviewMode ? 'Close' : 'Cancel')}
    </button>
    {showManualSaveActions ? (
      <>
        <button type="button" className="v2-btn" onClick={() => submitManualPatch(false)} disabled={saveDisabled}>
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : isDocumentImportMode
              ? t('v2Overview.documentImportConfirm', 'Confirm document import')
              : t('v2Overview.manualPatchSave', 'Save year data')}
        </button>
        <button
          type="button"
          className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
          onClick={() => submitManualPatch(true)}
          disabled={saveDisabled}
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : isDocumentImportMode
              ? t('v2Overview.documentImportConfirmAndSync', 'Confirm document import and sync year')
              : t('v2Overview.manualPatchSaveAndSync', 'Save and sync year')}
        </button>
      </>
    ) : null}
  </div>
);

export const ComparisonSection: React.FC<{
  t: TFunction;
  title: string;
  body: string;
  changed: boolean;
  changedLabel: string;
  stableLabel: string;
  rows: Array<{ key: string; label: string; veetiValue: number; effectiveValue: number }>;
  formatValue: (value: number) => string;
  onRestore: (() => void) | null;
  restoreLabel: string;
  busy: boolean;
}> = ({ t, title, body, changed, changedLabel, stableLabel, rows, formatValue, onRestore, restoreLabel, busy }) => (
  <>
    <div className="v2-manual-section-head">
      <h4>{title}</h4>
      <span className={`v2-required-pill ${changed ? '' : 'v2-required-pill-optional'}`}>
        {changed ? changedLabel : stableLabel}
      </span>
    </div>
    <p className="v2-muted">{body}</p>
    <div className="v2-keyvalue-list">
      {rows.map((row) => (
        <div key={row.key} className="v2-keyvalue-row">
          <span>{row.label}</span>
          <span>
            {t('v2Overview.financialComparisonVeeti', 'VEETI')}: {formatValue(row.veetiValue)} |{' '}
            {t('v2Overview.financialComparisonEffective', 'Effective')}: {formatValue(row.effectiveValue)}
          </span>
        </div>
      ))}
    </div>
    {onRestore ? (
      <button type="button" className="v2-btn v2-btn-small" onClick={onRestore} disabled={busy}>
        {restoreLabel}
      </button>
    ) : null}
  </>
);
