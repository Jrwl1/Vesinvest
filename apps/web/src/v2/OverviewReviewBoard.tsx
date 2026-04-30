import type { TFunction } from 'i18next';
import React from 'react';

import type { V2ImportYearDataResponse } from '../api';
import {
  type DocumentImportPreview,
} from './documentPdfImportModel';
import type {
  InlineCardField,
  ManualFinancialForm,
  ManualPriceForm,
  ManualVolumeForm,
} from './overviewManualForms';
import { OverviewReviewCardActions } from './OverviewReviewCardActions';
import { OverviewReviewCardBody } from './OverviewReviewCardBody';
import {
  getReviewMissingRequirementLabel,
  type ReadinessState,
  type RepairAction,
  type ReviewBucketKey,
  type ReviewStatusRow,
} from './overviewReviewModel';
import {
  type Props as OverviewWorkbookImportWorkflowProps,
} from './OverviewWorkbookImportWorkflow';
import {
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  type MissingRequirement,
  type SetupYearStatus,
} from './overviewWorkflow';
import { OverviewYearWorkspace } from './OverviewYearWorkspace';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';

type Props = {
  t: TFunction;
  workflowStep?: number;
  wizardBackLabel: string | null;
  onBack: () => void;
  reviewStatusRows: ReviewStatusRow[];
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  cardEditContext: 'step2' | 'step3' | null;
  cardEditYear: number | null;
  manualPatchYear: number | null;
  renderYearValuePreview: (
    year: number,
    readiness: ReadinessState,
  ) => React.ReactNode;
  sourceStatusClassName: (status: string | undefined) => string;
  sourceStatusLabel: (status: string | undefined) => string;
  setupStatusClassName: (status: SetupYearStatus) => string;
  setupStatusLabel: (status: SetupYearStatus) => string;
  yearStatusRowClassName: (status: SetupYearStatus) => string;
  importWarningLabel: (warning: string) => string;
  missingRequirementLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string;
  isAdmin: boolean;
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
  saveReviewWorkspaceYear: (params: {
    year: number;
    financials: ManualFinancialForm;
    prices: ManualPriceForm;
    volumes: ManualVolumeForm;
    explicitMissing?: {
      financials: boolean;
      prices: boolean;
      volumes: boolean;
      financialFields?: Array<keyof ManualFinancialForm>;
    };
    syncAfterSave?: boolean;
  }) => Promise<{ yearData: V2ImportYearDataResponse }>;
  manualPatchMode: ManualPatchMode;
  manualPatchBusy: boolean;
  manualPatchError: string | null;
  documentImportBusy: boolean;
  documentImportStatus: string | null;
  documentImportError: string | null;
  documentImportPreview: DocumentImportPreview | null;
  documentImportReviewedKeys: DocumentImportPreview['matches'][number]['key'][];
  handleSelectDocumentImportMatch: (
    key: DocumentImportPreview['matches'][number]['key'],
    selectedMatch: DocumentImportPreview['matches'][number] | null,
  ) => void;
  isCurrentYearReadyForReview: boolean;
  isManualYearExcluded: boolean;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
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
  workbookImportBusy: boolean;
  canConfirmImportWorkflow: boolean;
  isInlineCardDirty: boolean;
  documentFileInputRef: React.RefObject<HTMLInputElement | null>;
  setInlineCardFieldRef: (
    field: InlineCardField,
  ) => (element: HTMLInputElement | null) => void;
  manualFinancials: ManualFinancialForm;
  setManualFinancials: React.Dispatch<React.SetStateAction<ManualFinancialForm>>;
  manualPrices: ManualPriceForm;
  setManualPrices: React.Dispatch<React.SetStateAction<ManualPriceForm>>;
  manualVolumes: ManualVolumeForm;
  setManualVolumes: React.Dispatch<React.SetStateAction<ManualVolumeForm>>;
  markManualFieldTouched: (field: InlineCardField) => void;
  saveInlineCardEdit: (syncAfterSave?: boolean) => Promise<void> | void;
  workbookImportWorkflowProps: Omit<OverviewWorkbookImportWorkflowProps, 'yearLabel'>;
  reviewContinueButtonClass: string;
  onContinueFromReview: () => void;
  importedBlockedYearCount: number;
  pendingReviewYearCount: number;
  technicalReadyYearsLabel: string;
};

function sameYearOrder(left: number[], right: number[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

function isRequiredReviewRow(row: ReviewStatusRow): boolean {
  return row.planningRole !== 'current_year_estimate';
}

function resolvePrimaryReviewYear(
  reviewStatusRows: ReviewStatusRow[],
): number | null {
  const requiredRows = reviewStatusRows.filter(isRequiredReviewRow);
  const candidateRows =
    requiredRows.length > 0 ? requiredRows : reviewStatusRows;
  return (
    candidateRows.find((row) => row.setupStatus === 'needs_attention')?.year ??
    candidateRows.find((row) => row.setupStatus === 'ready_for_review')?.year ??
    candidateRows.find((row) => row.setupStatus === 'reviewed')?.year ??
    candidateRows.find((row) => row.setupStatus === 'excluded_from_plan')?.year ??
    null
  );
}

type WorkspaceSelection = {
  activeYear: number | null;
  compareYears: number[];
};

function getReviewBucket(row: ReviewStatusRow): ReviewBucketKey {
  if (row.setupStatus === 'excluded_from_plan') {
    return 'excluded';
  }
  if (row.setupStatus === 'reviewed' || row.setupStatus === 'ready_for_review') {
    return 'good_to_go';
  }
  const readyCount = row.readinessChecks.filter((check) => check.ready).length;
  const missing = new Set(row.missingRequirements);
  const isStructurallySparse =
    readyCount <= 1 ||
    missing.has('financials') ||
    (missing.has('prices') && missing.has('volumes'));
  return isStructurallySparse ? 'almost_nothing' : 'needs_filling';
}

function getReviewBucketLabel(t: TFunction, bucket: ReviewBucketKey): string {
  switch (bucket) {
    case 'good_to_go':
      return t('v2Overview.reviewBucketReadyTitle');
    case 'needs_filling':
      return t('v2Overview.reviewBucketRepairTitle');
    case 'almost_nothing':
      return t('v2Overview.reviewBucketSparseTitle');
    case 'excluded':
      return t('v2Overview.reviewBucketExcludedTitle');
    default:
      return bucket;
  }
}

export const OverviewReviewBoard: React.FC<Props> = ({
  t,
  workflowStep = 3,
  reviewStatusRows,
  yearDataCache,
  cardEditContext,
  cardEditYear,
  manualPatchYear,
  renderYearValuePreview,
  sourceStatusClassName,
  sourceStatusLabel,
  setupStatusClassName,
  setupStatusLabel,
  yearStatusRowClassName,
  importWarningLabel,
  missingRequirementLabel,
  isAdmin,
  buildRepairActions,
  openInlineCardEditor,
  saveReviewWorkspaceYear,
  manualPatchMode,
  manualPatchBusy,
  manualPatchError,
  documentImportBusy,
  documentImportStatus,
  documentImportError,
  documentImportPreview,
  documentImportReviewedKeys,
  handleSelectDocumentImportMatch,
  isCurrentYearReadyForReview,
  isManualYearExcluded,
  canReapplyFinancialVeetiForYear,
  canReapplyPricesForYear,
  canReapplyVolumesForYear,
  keepYearButtonClass,
  fixYearButtonClass,
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
  workbookImportBusy,
  canConfirmImportWorkflow,
  isInlineCardDirty,
  documentFileInputRef,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  markManualFieldTouched,
  saveInlineCardEdit,
  workbookImportWorkflowProps,
  reviewContinueButtonClass,
  onContinueFromReview,
  importedBlockedYearCount,
  pendingReviewYearCount,
  technicalReadyYearsLabel,
}) => {
  const defaultActiveYear = React.useMemo(
    () => resolvePrimaryReviewYear(reviewStatusRows),
    [reviewStatusRows],
  );
  const availableYearsKey = React.useMemo(
    () => reviewStatusRows.map((row) => row.year).join(','),
    [reviewStatusRows],
  );
  const previousAvailableYearsKeyRef = React.useRef<string>('');
  const allowEmptyWorkspaceSelectionRef = React.useRef(false);
  const [workspaceSelection, setWorkspaceSelection] =
    React.useState<WorkspaceSelection>({
      activeYear: null,
      compareYears: [],
    });
  const workspaceYears = React.useMemo(() => {
    if (workspaceSelection.activeYear == null) {
      return [];
    }
    return [
      workspaceSelection.activeYear,
      ...workspaceSelection.compareYears.filter(
        (year) => year !== workspaceSelection.activeYear,
      ),
    ];
  }, [workspaceSelection]);
  const groupedRows = React.useMemo(
    () =>
      (['good_to_go', 'needs_filling', 'almost_nothing', 'excluded'] as const)
        .map((bucket) => ({
          bucket,
          rows: reviewStatusRows.filter((row) => getReviewBucket(row) === bucket),
        }))
        .filter((group) => group.rows.length > 0),
    [reviewStatusRows],
  );
  const showReviewHeaderCount = groupedRows.length === 0;
  const pinnedReviewRows = React.useMemo(
    () => {
      if (cardEditContext !== 'step3') {
        return [];
      }
      const expandedYear = manualPatchYear ?? cardEditYear;
      return expandedYear == null
        ? []
        : reviewStatusRows.filter((row) => row.year === expandedYear);
    },
    [cardEditContext, cardEditYear, manualPatchYear, reviewStatusRows],
  );
  const includedPlanningYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter(
        (row) => isRequiredReviewRow(row) && row.setupStatus === 'reviewed',
      ).length,
    [reviewStatusRows],
  );
  const actionableReviewRowCount = React.useMemo(
    () =>
      reviewStatusRows.filter(
        (row) =>
          isRequiredReviewRow(row) && row.setupStatus !== 'excluded_from_plan',
      ).length,
    [reviewStatusRows],
  );
  const baselineGateReady =
    includedPlanningYearCount > 0 &&
    importedBlockedYearCount === 0 &&
    pendingReviewYearCount === 0;
  const baselineGatePendingReview =
    includedPlanningYearCount > 0 &&
    importedBlockedYearCount === 0 &&
    pendingReviewYearCount > 0;
  const baselineGatePrimaryDetail = baselineGateReady
    ? t('v2Overview.baselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const baselineGateSecondaryDetail =
    importedBlockedYearCount > 0
      ? t('v2Overview.reviewContinueBlockedHint')
      : baselineGatePendingReview
      ? t('v2Overview.reviewContinueTechnicalReadyBody', {
          years: technicalReadyYearsLabel,
        })
      : actionableReviewRowCount === 0
      ? t('v2Overview.noYearsSelected', 'None selected')
      : t('v2Overview.reviewContinueReadyBody');
  const nextReviewFocusYear = React.useMemo(
    () => resolvePrimaryReviewYear(reviewStatusRows),
    [reviewStatusRows],
  );
  const reviewActionsTitle = baselineGateReady
    ? t('v2Overview.baselineClosureTitle')
    : t('v2Overview.wizardContextReviewQueue');
  const reviewActionSummary = baselineGateReady
    ? baselineGateSecondaryDetail
    : baselineGateSecondaryDetail || baselineGatePrimaryDetail;
  const visibleMissingRequirementLabel = React.useCallback(
    (
      requirement: MissingRequirement,
      options?: {
        tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      },
    ) =>
      getReviewMissingRequirementLabel(
        t,
        missingRequirementLabel,
        requirement,
        options?.tariffRevenueReason,
      ),
    [missingRequirementLabel, t],
  );
  const activeReviewYearCount = reviewStatusRows.filter(
    (row) => row.setupStatus !== 'excluded_from_plan',
  ).length;
  const previousBaselineGateReadyRef = React.useRef(baselineGateReady);
  const shouldAutoExpandWorkspace =
    !baselineGateReady || manualPatchYear != null || cardEditYear != null;

  React.useEffect(() => {
    if (
      baselineGateReady &&
      !previousBaselineGateReadyRef.current &&
      manualPatchYear == null &&
      cardEditYear == null
    ) {
      allowEmptyWorkspaceSelectionRef.current = true;
      setWorkspaceSelection({
        activeYear: null,
        compareYears: [],
      });
    }

    previousBaselineGateReadyRef.current = baselineGateReady;
  }, [baselineGateReady, cardEditYear, manualPatchYear]);

  React.useEffect(() => {
    const availableYears = new Set(reviewStatusRows.map((row) => row.year));
    const availableYearsChanged = previousAvailableYearsKeyRef.current !== availableYearsKey;

    setWorkspaceSelection((prev) => {
      let activeYear =
        prev.activeYear != null && availableYears.has(prev.activeYear)
          ? prev.activeYear
          : null;
      let compareYears = prev.compareYears.filter(
        (year) => availableYears.has(year) && year !== activeYear,
      );

      if (manualPatchYear != null && availableYears.has(manualPatchYear)) {
        activeYear = manualPatchYear;
        compareYears = compareYears.filter((year) => year !== manualPatchYear);
        allowEmptyWorkspaceSelectionRef.current = false;
      }

      if (
        activeYear == null &&
        reviewStatusRows.length > 0 &&
        (!allowEmptyWorkspaceSelectionRef.current || availableYearsChanged)
      ) {
        if (shouldAutoExpandWorkspace) {
          activeYear = defaultActiveYear;
          compareYears = compareYears.filter((year) => year !== activeYear);
          allowEmptyWorkspaceSelectionRef.current = false;
        } else {
          allowEmptyWorkspaceSelectionRef.current = true;
        }
      }

      if (
        prev.activeYear === activeYear &&
        sameYearOrder(prev.compareYears, compareYears)
      ) {
        return prev;
      }

      return { activeYear, compareYears };
    });

    previousAvailableYearsKeyRef.current = availableYearsKey;
  }, [
    availableYearsKey,
    defaultActiveYear,
    manualPatchYear,
    reviewStatusRows,
    shouldAutoExpandWorkspace,
  ]);

  const handleTogglePinnedYear = React.useCallback((year: number) => {
    setWorkspaceSelection((prev) => {
      if (prev.activeYear == null) {
        allowEmptyWorkspaceSelectionRef.current = false;
        return {
          activeYear: year,
          compareYears: prev.compareYears.filter(
            (currentYear) => currentYear !== year,
          ),
        };
      }

      if (prev.activeYear === year) {
        if (prev.compareYears.length > 0) {
          const [nextActiveYear, ...remainingCompareYears] = prev.compareYears;
          allowEmptyWorkspaceSelectionRef.current = false;
          return {
            activeYear: nextActiveYear,
            compareYears: remainingCompareYears.filter(
              (currentYear) => currentYear !== nextActiveYear,
            ),
          };
        }

        allowEmptyWorkspaceSelectionRef.current = true;
        return {
          activeYear: null,
          compareYears: [],
        };
      }

      const nextCompareYears = prev.compareYears.includes(year)
        ? prev.compareYears.filter((currentYear) => currentYear !== year)
        : [...prev.compareYears, year];
      allowEmptyWorkspaceSelectionRef.current = false;
      return sameYearOrder(prev.compareYears, nextCompareYears)
        ? prev
        : {
            activeYear: prev.activeYear,
            compareYears: nextCompareYears,
          };
    });
  }, []);

  const handleFocusPinnedYear = React.useCallback((year: number) => {
    allowEmptyWorkspaceSelectionRef.current = false;
    setWorkspaceSelection((prev) =>
      prev.activeYear === year && prev.compareYears.length === 0
        ? prev
        : { activeYear: year, compareYears: [] },
    );
  }, []);

  return (
    <section className="v2-card v2-overview-review-surface">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', {
            step: workflowStep,
            total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
          })}
        </p>
        <h2>{t('v2Overview.wizardQuestionReviewYears')}</h2>
      </div>
      {showReviewHeaderCount ? (
        <span className="v2-badge v2-status-provenance">
          {t('v2Overview.reviewYearsCount', { count: activeReviewYearCount })}
        </span>
      ) : null}
    </div>

    <p className="v2-muted v2-overview-review-body">
      {t('v2Overview.wizardBodyReviewYears')}
    </p>

    {groupedRows.length > 0 ? (
      <div className="v2-overview-review-groups">
        {groupedRows.map((group) => (
          <div
            key={group.bucket}
            className={`v2-overview-review-group ${group.bucket}`}
            data-review-group={group.bucket}
          >
            <div className="v2-overview-review-group-head">
              <strong>{getReviewBucketLabel(t, group.bucket)}</strong>
              <span className="v2-overview-review-group-count">
                {t('v2Overview.reviewYearsCount', { count: group.rows.length })}
              </span>
            </div>
            <div className="v2-overview-review-group-years">
              {group.rows.map((row) => (
                <button
                  key={`${group.bucket}-${row.year}`}
                  type="button"
                  className={`v2-chip ${
                    workspaceSelection.activeYear === row.year ? 'ok' : ''
                  }`}
                  data-review-group-year={`${group.bucket}-${row.year}`}
                  aria-pressed={workspaceSelection.activeYear === row.year}
                  onClick={() => handleFocusPinnedYear(row.year)}
                >
                  {row.year}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : null}

    <OverviewYearWorkspace
      t={t}
      reviewStatusRows={reviewStatusRows}
      activeYear={workspaceSelection.activeYear}
      workspaceYears={workspaceYears}
      openedDecisionYear={
        cardEditContext === 'step3' ? manualPatchYear ?? cardEditYear : null
      }
      hideSelectionControlsWhenEmpty={baselineGateReady}
      onTogglePinnedYear={handleTogglePinnedYear}
      yearDataCache={yearDataCache}
      sourceStatusClassName={sourceStatusClassName}
      sourceStatusLabel={sourceStatusLabel}
      missingRequirementLabel={visibleMissingRequirementLabel}
      openInlineCardEditor={openInlineCardEditor}
      saveYear={saveReviewWorkspaceYear}
      isAdmin={isAdmin}
      busy={
        manualPatchBusy || documentImportBusy || workbookImportBusy
      }
    />

    {reviewStatusRows.length === 0 ? (
      <div className="v2-empty-state">
        <p>{t('v2Overview.reviewYearsEmpty')}</p>
      </div>
    ) : pinnedReviewRows.length > 0 ? (
      <div className="v2-year-status-list">
        {pinnedReviewRows.map((row) => {
          const readiness: ReadinessState = {
            financials:
              row.readinessChecks.find((check) => check.key === 'financials')
                ?.ready === true,
            prices:
              row.readinessChecks.find((check) => check.key === 'prices')
                ?.ready === true,
            tariffRevenue:
              row.readinessChecks.find(
                (check) => check.key === 'tariffRevenue',
              )?.ready === true,
            volumes:
              row.readinessChecks.find((check) => check.key === 'volumes')
                ?.ready === true,
          };
          const isInlineReviewActive =
            cardEditContext === 'step3' &&
            cardEditYear === row.year &&
            manualPatchYear === row.year;
          const helperText =
            row.setupStatus === 'excluded_from_plan'
              ? t('v2Overview.setupStatusExcludedHint')
              : row.setupStatus === 'reviewed'
              ? t('v2Overview.setupStatusReviewedHint')
              : row.setupStatus === 'ready_for_review'
              ? t('v2Overview.setupStatusTechnicalReadyHint')
              : t('v2Overview.setupStatusNeedsAttentionHint', {
                  requirements:
                    row.missingRequirements.length > 0
                      ? row.missingRequirements
                          .map((item) =>
                            visibleMissingRequirementLabel(
                              item,
                              {
                                tariffRevenueReason: row.tariffRevenueReason,
                              },
                            ),
                          )
                          .join(', ')
                      : t('v2Overview.setupStatusNeedsAttention'),
                });
          const baselineWarningNote =
            row.baselineWarnings?.includes('tariffRevenueMismatch')
              ? visibleMissingRequirementLabel('tariffRevenue', {
                  tariffRevenueReason: row.tariffRevenueReason,
                })
              : null;

          return (
            <article
              key={row.year}
              className={`v2-year-status-row ${yearStatusRowClassName(
                row.setupStatus,
              )} ${isInlineReviewActive ? 'inline-active' : ''}`.trim()}
            >
              <div className="v2-year-status-head">
                <div className="v2-year-status-labels">
                  <strong>{row.year}</strong>
                  <span
                    className={`v2-badge ${sourceStatusClassName(
                      row.sourceStatus,
                    )}`}
                  >
                    {row.setupStatus === 'excluded_from_plan'
                      ? t('v2Overview.setupStatusExcludedShort')
                      : sourceStatusLabel(row.sourceStatus)}
                  </span>
                </div>
                <span className={`v2-badge ${setupStatusClassName(row.setupStatus)}`}>
                  {setupStatusLabel(row.setupStatus)}
                </span>
              </div>

              {renderYearValuePreview(row.year, readiness)}

              <p className="v2-year-status-note">{helperText}</p>

              {baselineWarningNote ? (
                <p className="v2-muted v2-year-status-note">
                  {baselineWarningNote}
                </p>
              ) : null}

              {row.warnings.length > 0 ? (
                <p className="v2-muted v2-year-status-note">
                  {row.warnings.map((warning) => importWarningLabel(warning)).join(' ')}
                </p>
              ) : null}

              <OverviewReviewCardActions
                t={t}
                row={row}
                isInlineReviewActive={isInlineReviewActive}
                isAdmin={isAdmin}
                isCurrentYearReadyForReview={isCurrentYearReadyForReview}
                manualPatchBusy={manualPatchBusy}
                documentImportBusy={documentImportBusy}
                workbookImportBusy={workbookImportBusy}
                isManualYearExcluded={isManualYearExcluded}
                canReapplyFinancialVeetiForYear={canReapplyFinancialVeetiForYear}
                canReapplyPricesForYear={canReapplyPricesForYear}
                canReapplyVolumesForYear={canReapplyVolumesForYear}
                keepYearButtonClass={keepYearButtonClass}
                fixYearButtonClass={fixYearButtonClass}
                buildRepairActions={buildRepairActions}
                openInlineCardEditor={openInlineCardEditor}
                handleKeepCurrentYearValues={handleKeepCurrentYearValues}
                handleSwitchToManualEditMode={handleSwitchToManualEditMode}
                handleSwitchToDocumentImportMode={handleSwitchToDocumentImportMode}
                handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
                handleRestoreManualYearToPlan={handleRestoreManualYearToPlan}
                handleExcludeManualYearFromPlan={handleExcludeManualYearFromPlan}
                handleModalApplyVeetiFinancials={handleModalApplyVeetiFinancials}
                handleModalApplyVeetiPrices={handleModalApplyVeetiPrices}
                handleModalApplyVeetiVolumes={handleModalApplyVeetiVolumes}
                closeInlineCardEditor={closeInlineCardEditor}
              />

              {isInlineReviewActive && manualPatchMode !== 'review' ? (
                <OverviewReviewCardBody
                  t={t}
                  row={row}
                  manualPatchMode={manualPatchMode}
                  manualPatchBusy={manualPatchBusy}
                  manualPatchError={manualPatchError}
                  documentImportBusy={documentImportBusy}
                  documentImportStatus={documentImportStatus}
                  documentImportError={documentImportError}
                  documentImportPreview={documentImportPreview}
                  documentImportReviewedKeys={documentImportReviewedKeys}
                  handleSelectDocumentImportMatch={handleSelectDocumentImportMatch}
                  currentYearData={yearDataCache[row.year]}
                  documentFileInputRef={documentFileInputRef}
                  workbookImportBusy={workbookImportBusy}
                  canConfirmImportWorkflow={canConfirmImportWorkflow}
                  isInlineCardDirty={isInlineCardDirty}
                  setInlineCardFieldRef={setInlineCardFieldRef}
                  manualFinancials={manualFinancials}
                  setManualFinancials={setManualFinancials}
                  manualPrices={manualPrices}
                  setManualPrices={setManualPrices}
                  manualVolumes={manualVolumes}
                  setManualVolumes={setManualVolumes}
                  markManualFieldTouched={markManualFieldTouched}
                  missingRequirementLabel={visibleMissingRequirementLabel}
                  saveInlineCardEdit={saveInlineCardEdit}
                  closeInlineCardEditor={closeInlineCardEditor}
                  workbookImportWorkflowProps={workbookImportWorkflowProps}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    ) : null}

    <div
      className={`v2-overview-review-actions${
        baselineGateReady ? ' v2-overview-review-actions-compact' : ''
      }${pinnedReviewRows.length > 0 ? ' has-open-year' : ''}`}
    >
      {!baselineGateReady ? (
        <div className="v2-manual-section-head">
          <h4>{reviewActionsTitle}</h4>
        </div>
      ) : null}
      <p className="v2-muted v2-overview-review-actions-copy">
        {reviewActionSummary}
      </p>
      <button
        type="button"
        className={`${reviewContinueButtonClass} v2-overview-review-continue${
          pinnedReviewRows.length > 0 ? ' v2-overview-review-continue-muted' : ''
        }`}
        onClick={() => {
          if (nextReviewFocusYear != null) {
            handleFocusPinnedYear(nextReviewFocusYear);
          }
          onContinueFromReview();
        }}
        disabled={actionableReviewRowCount === 0}
      >
        {t('v2Overview.reviewContinue')}
      </button>
    </div>
    </section>
  );
};
