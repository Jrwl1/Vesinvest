import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse } from '../api';
import type { InlineCardField } from './overviewManualForms';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import {
  DEFAULT_BASELINE_YEAR_COUNT,
  getDefaultBaselineRunLength,
} from './overviewSelectors';
import {
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  type MissingRequirement,
} from './overviewWorkflow';
import {
  OverviewImportBoardLanes,
  type OverviewImportBoardRow,
} from './OverviewImportBoardLanes';
import type { ImportYearSourceLayer } from './yearReview';

type BoardRow = OverviewImportBoardRow;

type Props = {
  t: TFunction;
  workflowStep?: number;
  mode?: 'import' | 'manage';
  wizardBackLabel: string | null;
  onBack: () => void;
  selectedYears: number[];
  syncing: boolean;
  readyRows: OverviewImportBoardRow[];
  suspiciousRows: OverviewImportBoardRow[];
  blockedRows: OverviewImportBoardRow[];
  trashbinRows: OverviewImportBoardRow[];
  currentYearEstimateRows: OverviewImportBoardRow[];
  confirmedImportedYears: number[];
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  cardEditYear: number | null;
  cardEditContext: 'step2' | 'step3' | null;
  cardEditFocusField: InlineCardField | null;
  isAdmin: boolean;
  renderStep2InlineFieldEditor: (field: InlineCardField) => React.ReactNode;
  buildRepairActions: (
    year: number,
    missingRequirements: MissingRequirement[],
  ) => Array<{
    key: 'prices' | 'volumes' | 'tariffRevenue';
    label: string;
    focusField: InlineCardField;
  }>;
  sourceStatusLabel: (status: string | undefined) => string;
  sourceStatusClassName: (status: string | undefined) => string;
  sourceLayerText: (layer: ImportYearSourceLayer) => string;
  renderDatasetCounts: (counts?: Record<string, number>) => string;
  missingRequirementLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string;
  attemptOpenInlineCardEditor: (
    year: number,
    focusField: InlineCardField | null,
    context?: 'step2' | 'step3',
    missing?: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void> | void;
  openInlineCardEditor: (
    year: number,
    focusField: InlineCardField | null,
    context?: 'step2' | 'step3',
    missing?: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void> | void;
  loadingYearData: number | null;
  manualPatchError: string | null;
  blockedYearCount: number;
  removingYear: number | null;
  onToggleYear: (year: number) => void;
  onImportYears: () => void;
  onAddCurrentYearEstimate: (
    year: number,
    missingRequirements: MissingRequirement[],
  ) => Promise<void> | void;
  onTrashYear: (year: number) => Promise<void> | void;
  onRestoreYear: (year: number) => Promise<void> | void;
  importYearsButtonClass: string;
  importingYears: boolean;
};

type LaneKey =
  | 'current_estimate'
  | 'ready'
  | 'suspicious'
  | 'blocked'
  | 'trashbin';

export const OverviewImportBoard: React.FC<Props> = ({
  t,
  workflowStep = 2,
  mode = 'import',
  wizardBackLabel,
  onBack,
  selectedYears,
  syncing,
  readyRows,
  suspiciousRows,
  blockedRows,
  trashbinRows,
  currentYearEstimateRows,
  confirmedImportedYears,
  yearDataCache,
  cardEditYear,
  cardEditContext,
  cardEditFocusField,
  isAdmin,
  renderStep2InlineFieldEditor,
  buildRepairActions,
  sourceStatusLabel,
  sourceStatusClassName,
  sourceLayerText,
  renderDatasetCounts,
  missingRequirementLabel,
  attemptOpenInlineCardEditor,
  openInlineCardEditor,
  loadingYearData,
  manualPatchError,
  blockedYearCount,
  removingYear,
  onToggleYear,
  onImportYears,
  onAddCurrentYearEstimate,
  onTrashYear,
  onRestoreYear,
  importYearsButtonClass,
  importingYears,
}) => {
  const isManageMode = mode === 'manage';
  const getMissingCount = React.useCallback(
    (row: BoardRow) =>
      row.missingSummary?.count ?? row.missingCount ?? row.missingRequirements?.length ?? 0,
    [],
  );

  const getCompletenessScore = React.useCallback((row: BoardRow) => {
    const completeness = row.completeness ?? {};
    let score = 0;
    if (completeness.tilinpaatos === true) score += 4;
    if (completeness.taksa === true) score += 3;
    if (completeness.tariff_revenue !== false) score += 2;
    if (
      completeness.volume_vesi === true ||
      completeness.volume_jatevesi === true
    ) {
      score += 2;
    }
    return score;
  }, []);

  const sortRowsByUsefulness = React.useCallback(
    (rows: BoardRow[], options?: { prioritizeSelection?: boolean }) =>
      [...rows].sort((left, right) => {
        const leftSelected = selectedYears.includes(left.vuosi) ? 1 : 0;
        const rightSelected = selectedYears.includes(right.vuosi) ? 1 : 0;
        if (options?.prioritizeSelection && leftSelected !== rightSelected) {
          return rightSelected - leftSelected;
        }

        const completenessDelta =
          getCompletenessScore(right) - getCompletenessScore(left);
        if (completenessDelta !== 0) {
          return completenessDelta;
        }

        const missingDelta = getMissingCount(left) - getMissingCount(right);
        if (missingDelta !== 0) {
          return missingDelta;
        }

        return right.vuosi - left.vuosi;
      }),
    [getCompletenessScore, getMissingCount, selectedYears],
  );

  const sortedCurrentYearEstimateRows = React.useMemo(
    () => sortRowsByUsefulness(currentYearEstimateRows),
    [currentYearEstimateRows, sortRowsByUsefulness],
  );
  const sortedReadyRows = React.useMemo(
    () => sortRowsByUsefulness(readyRows, { prioritizeSelection: true }),
    [readyRows, sortRowsByUsefulness],
  );
  const sortedSuspiciousRows = React.useMemo(
    () => sortRowsByUsefulness(suspiciousRows, { prioritizeSelection: true }),
    [sortRowsByUsefulness, suspiciousRows],
  );
  const sortedBlockedRows = React.useMemo(
    () =>
      [...blockedRows].sort((left, right) => {
        const leftSelected = selectedYears.includes(left.vuosi) ? 1 : 0;
        const rightSelected = selectedYears.includes(right.vuosi) ? 1 : 0;
        if (leftSelected !== rightSelected) {
          return rightSelected - leftSelected;
        }

        const missingDelta = getMissingCount(left) - getMissingCount(right);
        if (missingDelta !== 0) {
          return missingDelta;
        }

        const completenessDelta =
          getCompletenessScore(right) - getCompletenessScore(left);
        if (completenessDelta !== 0) {
          return completenessDelta;
        }

        return right.vuosi - left.vuosi;
      }),
    [blockedRows, getCompletenessScore, getMissingCount, selectedYears],
  );
  const sortedHistoricalRows = React.useMemo(
    () => [...sortedReadyRows, ...sortedSuspiciousRows, ...sortedBlockedRows],
    [sortedBlockedRows, sortedReadyRows, sortedSuspiciousRows],
  );
  const sortedTrashbinRows = React.useMemo(
    () => sortRowsByUsefulness(trashbinRows),
    [sortRowsByUsefulness, trashbinRows],
  );

  const primaryRepairRow = sortedBlockedRows[0] ?? null;
  const hasSelectableImportRows = sortedHistoricalRows.length > 0;
  const includedCurrentEstimateYearsCount = React.useMemo(
    () =>
      sortedCurrentYearEstimateRows.filter((row) =>
        confirmedImportedYears.includes(row.vuosi),
      ).length,
    [confirmedImportedYears, sortedCurrentYearEstimateRows],
  );
  const selectedSelectableYearsCount = React.useMemo(
    () =>
      selectedYears.filter((year) =>
        sortedHistoricalRows.some((row) => row.vuosi === year),
      ).length,
    [selectedYears, sortedHistoricalRows],
  );
  const displayedYearCount = isManageMode
    ? sortedHistoricalRows.length + includedCurrentEstimateYearsCount
    : selectedSelectableYearsCount + includedCurrentEstimateYearsCount;
  const noSelectableYearsRemain = !hasSelectableImportRows;
  const shouldLeadWithRepair =
    isAdmin && noSelectableYearsRemain && primaryRepairRow != null;
  const availableHistoricalBaselineYears = React.useMemo(
    () => getDefaultBaselineRunLength(sortedHistoricalRows),
    [sortedHistoricalRows],
  );
  const showThinBaselineHint =
    !isManageMode &&
    availableHistoricalBaselineYears > 0 &&
    availableHistoricalBaselineYears < DEFAULT_BASELINE_YEAR_COUNT;

  const bucketLabel = React.useCallback(
    (missingCount: number) => {
      if (missingCount <= 0) return t('v2Overview.importBucket0Title');
      if (missingCount === 1) return t('v2Overview.importBucket1Title');
      if (missingCount === 2) return t('v2Overview.importBucket2Title');
      return t('v2Overview.importBucket3PlusTitle');
    },
    [t],
  );

  const lanes = React.useMemo(
    () =>
      [
        { key: 'ready' as LaneKey, title: t('v2Overview.reviewBucketReadyTitle'), rows: sortedReadyRows },
        {
          key: 'suspicious' as LaneKey,
          title: t('v2Overview.reviewBucketRepairTitle'),
          rows: sortedSuspiciousRows,
        },
        {
          key: 'blocked' as LaneKey,
          title: t('v2Overview.reviewBucketSparseTitle'),
          rows: sortedBlockedRows,
        },
        {
          key: 'current_estimate' as LaneKey,
          title: t('v2Overview.currentYearEstimateTitle', 'Optional current-year estimate'),
          rows: sortedCurrentYearEstimateRows,
        },
        {
          key: 'trashbin' as LaneKey,
          title: t('v2Overview.reviewBucketExcludedTitle'),
          rows: sortedTrashbinRows,
        },
      ].filter((lane) => lane.rows.length > 0),
    [
      sortedBlockedRows,
      sortedCurrentYearEstimateRows,
      sortedReadyRows,
      sortedSuspiciousRows,
      sortedTrashbinRows,
      t,
    ],
  );

  return (
    <section>
      <article id="v2-import-years" className="v2-card v2-overview-step-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', {
                step: workflowStep,
                total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
              })}
            </p>
            <h2>
              {isManageMode
                ? t('v2Overview.wizardQuestionReviewYears')
                : t('v2Overview.wizardQuestionImportYears')}
            </h2>
          </div>
          <span className="v2-chip">
            {isManageMode
              ? t('v2Overview.wizardSummaryImportedYears')
              : t('v2Overview.selectedYearsLabel', 'Selected years')}
            : {displayedYearCount}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {isManageMode
            ? t('v2Overview.wizardBodyReviewYears')
            : t('v2Overview.wizardBodyImportYears')}
        </p>
        {!isAdmin ? (
          <p className="v2-muted v2-overview-role-hint">
            {t(
              'v2Overview.adminOnlyImportHint',
              'Admin access is required to import, remove, or repair baseline years.',
            )}
          </p>
        ) : null}
        {showThinBaselineHint ? (
          <p className="v2-muted v2-overview-baseline-hint">
            {t(
              'v2Overview.baselineThinHint',
              'Only {{count}} consecutive historical years are available right now.',
              { count: availableHistoricalBaselineYears },
            )}
          </p>
        ) : null}

        {lanes.length === 0 ? (
          <p className="v2-muted">
            {t(
              'v2Overview.noImportedYears',
              'No imported years available yet.',
            )}
          </p>
        ) : (
          <OverviewImportBoardLanes
            t={t}
            lanes={lanes}
            isManageMode={isManageMode}
            selectedYears={selectedYears}
            syncing={syncing}
            readyRows={readyRows}
            suspiciousRows={suspiciousRows}
            blockedRows={blockedRows}
            trashbinRows={trashbinRows}
            confirmedImportedYears={confirmedImportedYears}
            yearDataCache={yearDataCache}
            cardEditYear={cardEditYear}
            cardEditContext={cardEditContext}
            cardEditFocusField={cardEditFocusField}
            isAdmin={isAdmin}
            renderStep2InlineFieldEditor={renderStep2InlineFieldEditor}
            buildRepairActions={buildRepairActions}
            sourceStatusLabel={sourceStatusLabel}
            sourceStatusClassName={sourceStatusClassName}
            sourceLayerText={sourceLayerText}
            renderDatasetCounts={renderDatasetCounts}
            missingRequirementLabel={missingRequirementLabel}
            attemptOpenInlineCardEditor={attemptOpenInlineCardEditor}
            openInlineCardEditor={openInlineCardEditor}
            loadingYearData={loadingYearData}
            manualPatchError={manualPatchError}
            removingYear={removingYear}
            onToggleYear={onToggleYear}
            onAddCurrentYearEstimate={onAddCurrentYearEstimate}
            onTrashYear={onTrashYear}
            onRestoreYear={onRestoreYear}
            bucketLabel={bucketLabel}
            getMissingCount={getMissingCount}
          />
        )}

        {blockedYearCount > 0 && !isAdmin ? (
          <p className="v2-muted">
            {t(
              'v2Overview.manualPatchAdminOnlyHint',
              'Manual completion is available for admins only.',
            )}
          </p>
        ) : null}

        <div className="v2-actions-row">
          {wizardBackLabel ? (
            <button type="button" className="v2-btn" onClick={onBack}>
              {wizardBackLabel}
            </button>
          ) : null}
          {shouldLeadWithRepair ? (
            <>
              <button
                type="button"
                className={importYearsButtonClass}
                onClick={() =>
                  void openInlineCardEditor(
                    primaryRepairRow.vuosi,
                    null,
                    'step2',
                    primaryRepairRow.missingRequirements as MissingRequirement[] | undefined,
                    'manualEdit',
                  )
                }
                disabled={syncing || importingYears}
              >
                {t('v2Overview.manualPatchButton', 'Complete manually')}
              </button>
              <button
                type="button"
                className="v2-btn"
                onClick={() =>
                  void openInlineCardEditor(
                    primaryRepairRow.vuosi,
                    null,
                    'step2',
                    primaryRepairRow.missingRequirements as MissingRequirement[] | undefined,
                    'documentImport',
                  )
                }
                disabled={syncing || importingYears}
              >
                {t('v2Overview.documentImportAction', 'Import source PDF')}
              </button>
              <button
                type="button"
                className="v2-btn"
                onClick={() =>
                  void openInlineCardEditor(
                    primaryRepairRow.vuosi,
                    null,
                    'step2',
                    primaryRepairRow.missingRequirements as MissingRequirement[] | undefined,
                    'workbookImport',
                  )
                }
                disabled={syncing || importingYears}
              >
                {t('v2Overview.workbookImportAction', 'Repair from Excel')}
              </button>
            </>
          ) : !isManageMode && isAdmin ? (
            <button
              type="button"
              className={importYearsButtonClass}
              onClick={onImportYears}
              disabled={syncing || importingYears || selectedSelectableYearsCount === 0}
            >
              {importingYears && !isManageMode
                ? t('v2Overview.importingYearsButton')
                : isManageMode
                  ? t('v2Overview.manageYears')
                  : t('v2Overview.importYearsButton')}
            </button>
          ) : null}
        </div>
      </article>
    </section>
  );
};
