import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse } from '../api';
import { formatEur, formatNumber, formatPrice } from './format';
import {
  buildPriceForm,
  buildVolumeForm,
  CARD_SUMMARY_FIELD_TO_INLINE_FIELD,
  getEffectiveFirstRow,
  getEffectiveRows,
  IMPORT_BOARD_CANON_ROWS,
  parseManualNumber,
  type InlineCardField,
} from './overviewManualForms';
import {
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  type MissingRequirement,
} from './overviewWorkflow';
import { buildImportYearSourceLayers } from './yearReview';

type BoardRow = any;

type Props = {
  t: TFunction;
  workflowStep?: number;
  wizardBackLabel: string | null;
  onBack: () => void;
  selectedYears: number[];
  syncing: boolean;
  readyRows: BoardRow[];
  suspiciousRows: BoardRow[];
  blockedRows: BoardRow[];
  trashbinRows: BoardRow[];
  currentYearEstimateRows: BoardRow[];
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
  sourceLayerText: (layer: any) => string;
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
    mode?: any,
  ) => Promise<void> | void;
  openInlineCardEditor: (
    year: number,
    focusField: InlineCardField | null,
    context?: 'step2' | 'step3',
    missing?: MissingRequirement[],
    mode?: any,
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
  | 'bucket_0'
  | 'bucket_1'
  | 'bucket_2'
  | 'bucket_3plus'
  | 'trashbin';

export const OverviewImportBoard: React.FC<Props> = ({
  t,
  workflowStep = 2,
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
  const getMissingCount = React.useCallback(
    (row: BoardRow) =>
      row.missingSummary?.count ??
      row.missingCount ??
      row.missingRequirements?.length ??
      0,
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
    (
      rows: BoardRow[],
      options?: {
        prioritizeSelection?: boolean;
      },
    ) =>
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
  const sortedHistoricalRows = React.useMemo(
    () =>
      sortRowsByUsefulness([...readyRows, ...suspiciousRows, ...blockedRows], {
        prioritizeSelection: true,
      }),
    [blockedRows, readyRows, sortRowsByUsefulness, suspiciousRows],
  );
  const sortedBlockedRows = React.useMemo(
    () => sortRowsByUsefulness(blockedRows),
    [blockedRows, sortRowsByUsefulness],
  );
  const sortedTrashbinRows = React.useMemo(
    () => sortRowsByUsefulness(trashbinRows),
    [sortRowsByUsefulness, trashbinRows],
  );

  const primaryRepairRow = sortedBlockedRows[0] ?? null;
  const hasSelectableImportRows = sortedHistoricalRows.length > 0;
  const selectedSelectableYearsCount = React.useMemo(
    () =>
      selectedYears.filter((year) =>
        sortedHistoricalRows.some((row) => row.vuosi === year),
      ).length,
    [selectedYears, sortedHistoricalRows],
  );
  const noSelectableYearsRemain = !hasSelectableImportRows;
  const shouldLeadWithRepair =
    isAdmin && noSelectableYearsRemain && primaryRepairRow != null;

  const bucketLabel = React.useCallback(
    (missingCount: number) => {
      if (missingCount <= 0) {
        return t('v2Overview.importBucket0Title', '0 missing');
      }
      if (missingCount === 1) {
        return t('v2Overview.importBucket1Title', '1 missing');
      }
      if (missingCount === 2) {
        return t('v2Overview.importBucket2Title', '2 missing');
      }
      return t('v2Overview.importBucket3PlusTitle', '3+ missing');
    },
    [t],
  );

  const lanes = React.useMemo(
    () =>
      [
        {
          key: 'current_estimate' as LaneKey,
          title: t(
            'v2Overview.currentYearEstimateTitle',
            'Current year estimate',
          ),
          rows: sortedCurrentYearEstimateRows,
        },
        {
          key: 'bucket_0' as LaneKey,
          title: t('v2Overview.importBucket0Title', '0 missing'),
          rows: sortedHistoricalRows.filter((row) => getMissingCount(row) <= 0),
        },
        {
          key: 'bucket_1' as LaneKey,
          title: t('v2Overview.importBucket1Title', '1 missing'),
          rows: sortedHistoricalRows.filter((row) => getMissingCount(row) === 1),
        },
        {
          key: 'bucket_2' as LaneKey,
          title: t('v2Overview.importBucket2Title', '2 missing'),
          rows: sortedHistoricalRows.filter((row) => getMissingCount(row) === 2),
        },
        {
          key: 'bucket_3plus' as LaneKey,
          title: t('v2Overview.importBucket3PlusTitle', '3+ missing'),
          rows: sortedHistoricalRows.filter((row) => getMissingCount(row) >= 3),
        },
        {
          key: 'trashbin' as LaneKey,
          title: t('v2Overview.importTrashbinTitle', 'Trashbin'),
          rows: sortedTrashbinRows,
        },
      ].filter((lane) => lane.rows.length > 0),
    [
      getMissingCount,
      sortedCurrentYearEstimateRows,
      sortedHistoricalRows,
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
            <h2>{t('v2Overview.wizardQuestionImportYears')}</h2>
          </div>
          <span className="v2-chip">
            {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
            {selectedSelectableYearsCount}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyImportYears')}
        </p>

        {lanes.length === 0 ? (
          <p className="v2-muted">
            {t(
              'v2Overview.noImportedYears',
              'No imported years available yet.',
            )}
          </p>
        ) : (
          <div className="v2-import-board">
            {lanes.map((lane) => {
              const isCurrentEstimateLane = lane.key === 'current_estimate';
              const isTrashbinLane = lane.key === 'trashbin';
              const laneHeader = (
                <div className="v2-import-board-summary">
                  <div className="v2-year-readiness-section-head">
                    <h3>{lane.title}</h3>
                  </div>
                  <span className="v2-import-board-count">{lane.rows.length}</span>
                </div>
              );

              const laneGrid = (
                <div className="v2-import-board-grid">
                  {lane.rows.map((row) => {
                    const yearData = yearDataCache[row.vuosi];
                    const canonRows = IMPORT_BOARD_CANON_ROWS.map((item) => {
                      const value =
                        row.summaryMap.get(item.key)?.effectiveValue ?? null;
                      const missing = value == null;
                      const zero = !missing && value === 0;
                      const inlineField =
                        CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key];
                      const resultToneClass =
                        item.key === 'result' && value != null
                          ? value >= 0
                            ? 'positive'
                            : 'negative'
                          : '';
                      return {
                        ...item,
                        missing,
                        zero,
                        inlineField,
                        resultToneClass,
                        label: t(item.labelKey, item.defaultLabel),
                        displayValue: missing
                          ? t('v2Overview.checkMissing', 'Missing')
                          : formatEur(value ?? 0),
                      };
                    });
                    const priceForm = buildPriceForm(yearData);
                    const volumeForm = buildVolumeForm(yearData);
                    const priceRows = getEffectiveRows(yearData, 'taksa');
                    const waterPriceRow = priceRows.find(
                      (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
                    );
                    const wastewaterPriceRow = priceRows.find(
                      (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
                    );
                    const waterVolumeRow = getEffectiveFirstRow(
                      yearData,
                      'volume_vesi',
                    );
                    const wastewaterVolumeRow = getEffectiveFirstRow(
                      yearData,
                      'volume_jatevesi',
                    );
                    const secondaryStats = [
                      {
                        label: t(
                          'v2Overview.previewWaterPriceLabel',
                          'Water price',
                        ),
                        focusField: 'waterUnitPrice' as InlineCardField,
                        missing: !row.completeness.taksa || waterPriceRow == null,
                        zero:
                          waterPriceRow != null &&
                          priceForm.waterUnitPrice === 0,
                        displayValue:
                          !row.completeness.taksa || waterPriceRow == null
                            ? t('v2Overview.checkMissing', 'Missing')
                            : formatPrice(priceForm.waterUnitPrice),
                      },
                      {
                        label: t(
                          'v2Overview.previewWastewaterPriceLabel',
                          'Wastewater price',
                        ),
                        focusField: 'wastewaterUnitPrice' as InlineCardField,
                        missing:
                          !row.completeness.taksa || wastewaterPriceRow == null,
                        zero:
                          wastewaterPriceRow != null &&
                          priceForm.wastewaterUnitPrice === 0,
                        displayValue:
                          !row.completeness.taksa || wastewaterPriceRow == null
                            ? t('v2Overview.checkMissing', 'Missing')
                            : formatPrice(priceForm.wastewaterUnitPrice),
                      },
                      {
                        label: t(
                          'v2Overview.previewWaterVolumeLabel',
                          'Sold water',
                        ),
                        focusField: 'soldWaterVolume' as InlineCardField,
                        missing:
                          !row.completeness.volume_vesi ||
                          Object.keys(waterVolumeRow).length === 0,
                        zero:
                          Object.keys(waterVolumeRow).length > 0 &&
                          volumeForm.soldWaterVolume === 0,
                        displayValue:
                          !row.completeness.volume_vesi ||
                          Object.keys(waterVolumeRow).length === 0
                            ? t('v2Overview.checkMissing', 'Missing')
                            : `${formatNumber(volumeForm.soldWaterVolume)} m3`,
                      },
                      {
                        label: t(
                          'v2Overview.previewWastewaterVolumeLabel',
                          'Sold wastewater',
                        ),
                        focusField: 'soldWastewaterVolume' as InlineCardField,
                        missing:
                          !row.completeness.volume_jatevesi ||
                          Object.keys(wastewaterVolumeRow).length === 0,
                        zero:
                          Object.keys(wastewaterVolumeRow).length > 0 &&
                          volumeForm.soldWastewaterVolume === 0,
                        displayValue:
                          !row.completeness.volume_jatevesi ||
                          Object.keys(wastewaterVolumeRow).length === 0
                            ? t('v2Overview.checkMissing', 'Missing')
                            : `${formatNumber(volumeForm.soldWastewaterVolume)} m3`,
                      },
                    ];
                    const repairActions =
                      isAdmin && !isTrashbinLane
                        ? buildRepairActions(row.vuosi, row.missingRequirements)
                        : [];
                    const sourceLayers =
                      row.sourceLayers?.length > 0
                        ? row.sourceLayers
                        : buildImportYearSourceLayers(yearData);
                    const provenanceSummary =
                      sourceLayers.length > 0
                        ? sourceLayers
                            .map((layer: any) => sourceLayerText(layer))
                            .join(' | ')
                        : renderDatasetCounts(
                            row.datasetCounts as Record<string, number> | undefined,
                          );
                    const provenanceText =
                      provenanceSummary || sourceStatusLabel(row.sourceStatus);
                    const isInlineCardActive = cardEditYear === row.vuosi;
                    const activeStep2Field =
                      isInlineCardActive && cardEditContext === 'step2'
                        ? cardEditFocusField
                        : null;
                    const quietOtherCards =
                      cardEditYear != null && cardEditYear !== row.vuosi;
                    const missingCount = getMissingCount(row);
                    const canSelectRow =
                      !isCurrentEstimateLane && !isTrashbinLane;
                    const isSelected = selectedYears.includes(row.vuosi);
                    const selectionStateLabel = canSelectRow
                      ? isSelected
                        ? t('v2Overview.importIncludedState', 'Included')
                        : t('v2Overview.importExcludedState', 'Not included')
                      : null;
                    const blockerSummaryText =
                      row.missingSummary != null
                        ? t(
                            'v2Overview.yearMissingFieldsLabel',
                            'Missing: {{fields}}',
                            { fields: row.missingSummary.fields },
                          )
                        : null;
                    const rowTone =
                      row.lane ??
                      (blockedRows.some((item) => item.vuosi === row.vuosi)
                        ? 'blocked'
                        : suspiciousRows.some((item) => item.vuosi === row.vuosi)
                          ? 'suspicious'
                          : 'ready');

                    return (
                      <article
                        key={`${lane.key}-${row.vuosi}`}
                        className={`v2-year-readiness-row ${rowTone} ${
                          isInlineCardActive ? 'active-edit' : ''
                        } ${quietOtherCards ? 'quiet' : ''}`.trim()}
                      >
                        <div className="v2-year-readiness-head">
                          {canSelectRow ? (
                            <label
                              className="v2-year-checkbox"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <span className="v2-year-checkbox-main">
                                <span className="v2-year-checkbox-control">
                              <input
                                type="checkbox"
                                name={`syncYear-${row.vuosi}`}
                                aria-label={String(row.vuosi)}
                                checked={selectedYears.includes(row.vuosi)}
                                onChange={() => onToggleYear(row.vuosi)}
                                disabled={syncing || removingYear === row.vuosi}
                              />
                                  <strong>{row.vuosi}</strong>
                                </span>
                                {selectionStateLabel ? (
                                  <span
                                    className={`v2-year-checkbox-state ${
                                      isSelected ? 'selected' : 'unselected'
                                    }`.trim()}
                                  >
                                    {selectionStateLabel}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ) : (
                            <div className="v2-year-checkbox v2-year-select-disabled">
                              <strong>{row.vuosi}</strong>
                            </div>
                          )}
                          <div className="v2-badge-row">
                            {isCurrentEstimateLane ? (
                              <span className="v2-badge v2-status-provenance">
                                {t(
                                  'v2Overview.currentYearEstimateBadge',
                                  'Estimate',
                                )}
                              </span>
                            ) : null}
                            <span className={`v2-badge ${row.trustToneClass}`}>
                              {row.trustLabel}
                            </span>
                            <span
                              className={`v2-badge ${sourceStatusClassName(
                                row.sourceStatus,
                              )}`}
                            >
                              {sourceStatusLabel(row.sourceStatus)}
                            </span>
                          </div>
                        </div>

                        <div className="v2-year-summary-line">
                          <strong>{bucketLabel(missingCount)}</strong>
                          {blockerSummaryText ? (
                            <span>{blockerSummaryText}</span>
                          ) : null}
                        </div>

                        <div className="v2-year-canon-rows">
                          {canonRows.map((item) => (
                            <div
                              key={`${row.vuosi}-${item.key}`}
                              className={`v2-year-canon-row ${
                                item.emphasized ? 'result' : ''
                              } ${item.missing ? 'missing' : ''} ${
                                item.zero ? 'zero' : ''
                              } ${
                                activeStep2Field === item.inlineField
                                  ? 'editing-field'
                                  : ''
                              }`.trim()}
                              role={isAdmin && !isTrashbinLane ? 'button' : undefined}
                              tabIndex={isAdmin && !isTrashbinLane ? 0 : undefined}
                              onClick={() => {
                                if (!isAdmin || isTrashbinLane) return;
                                void attemptOpenInlineCardEditor(
                                  row.vuosi,
                                  item.inlineField,
                                );
                              }}
                              onKeyDown={(event) => {
                                if (!isAdmin || isTrashbinLane) return;
                                if (event.key !== 'Enter' && event.key !== ' ') {
                                  return;
                                }
                                event.preventDefault();
                                void attemptOpenInlineCardEditor(
                                  row.vuosi,
                                  item.inlineField,
                                );
                              }}
                            >
                              <span>{item.label}</span>
                              <button
                                type="button"
                                data-edit-field={item.inlineField}
                                className={`v2-year-canon-value ${
                                  item.missing ? 'v2-year-preview-missing' : ''
                                } ${item.zero ? 'v2-year-preview-zero' : ''} ${
                                  item.resultToneClass
                                }`.trim()}
                                disabled={!isAdmin || isTrashbinLane}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isAdmin || isTrashbinLane) return;
                                  void attemptOpenInlineCardEditor(
                                    row.vuosi,
                                    item.inlineField,
                                  );
                                }}
                              >
                                {item.displayValue}
                              </button>
                              {activeStep2Field === item.inlineField
                                ? renderStep2InlineFieldEditor(item.inlineField)
                                : null}
                            </div>
                          ))}
                        </div>

                        <div className="v2-year-card-secondary compact">
                          <div className="v2-year-card-secondary-grid compact">
                            {secondaryStats.map((item) => {
                              const isSecondaryFieldActive =
                                activeStep2Field === item.focusField;
                              return isAdmin && !isTrashbinLane ? (
                                <div
                                  key={`${row.vuosi}-${item.label}`}
                                  className={`v2-year-preview-item secondary ${
                                    item.missing ? 'missing' : ''
                                  } ${item.zero ? 'zero' : ''} ${
                                    isSecondaryFieldActive ? 'editing-field' : ''
                                  }`.trim()}
                                >
                                  <button
                                    type="button"
                                    data-edit-field={item.focusField}
                                    className="v2-year-preview-item-button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void attemptOpenInlineCardEditor(
                                        row.vuosi,
                                        item.focusField,
                                        'step2',
                                        row.missingRequirements,
                                        'manualEdit',
                                      );
                                    }}
                                  >
                                    <span>{item.label}</span>
                                    <strong
                                      className={`${item.missing ? 'v2-year-preview-missing' : ''} ${
                                        item.zero ? 'v2-year-preview-zero' : ''
                                      }`.trim()}
                                    >
                                      {item.displayValue}
                                    </strong>
                                  </button>
                                  {isSecondaryFieldActive
                                    ? renderStep2InlineFieldEditor(item.focusField)
                                    : null}
                                </div>
                              ) : (
                                <div
                                  key={`${row.vuosi}-${item.label}`}
                                  className={`v2-year-preview-item secondary ${
                                    item.missing ? 'missing' : ''
                                  } ${item.zero ? 'zero' : ''}`.trim()}
                                >
                                  <span>{item.label}</span>
                                  <strong
                                    className={`${item.missing ? 'v2-year-preview-missing' : ''} ${
                                      item.zero ? 'v2-year-preview-zero' : ''
                                    }`.trim()}
                                  >
                                    {item.displayValue}
                                  </strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {row.trustNote ? (
                          <p
                            className={
                              rowTone === 'blocked'
                                ? 'v2-year-readiness-missing'
                                : 'v2-muted'
                            }
                          >
                            {row.trustNote}
                          </p>
                        ) : null}

                        {isInlineCardActive ? (
                          <div className="v2-inline-card-editor">
                            {loadingYearData === row.vuosi ? (
                              <p className="v2-muted">
                                {t('common.loading', 'Loading...')}
                              </p>
                            ) : (
                              <>
                                {manualPatchError ? (
                                  <div className="v2-alert v2-alert-error">
                                    {manualPatchError}
                                  </div>
                                ) : null}
                                {row.missingRequirements.length > 0 ? (
                                  <p className="v2-manual-required-note">
                                    {t(
                                      'v2Overview.manualPatchRequiredHint',
                                      'Required for sync readiness: {{requirements}}',
                                      {
                                        requirements: row.missingRequirements
                                          .map((item: MissingRequirement) =>
                                            missingRequirementLabel(item, {
                                              tariffRevenueReason:
                                                row.tariffRevenueReason,
                                            }),
                                          )
                                          .join(', '),
                                      },
                                    )}
                                  </p>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}

                        <details className="v2-year-technical-details">
                          <summary>
                            {t(
                              'v2Overview.yearTechnicalDetailsSummary',
                              'Technical source details',
                            )}
                          </summary>
                          {sourceLayers.length > 0 ? (
                            <div className="v2-year-source-list">
                              {sourceLayers.map((layer: any) => (
                                <span
                                  key={`${row.vuosi}-${layer.key}`}
                                  className="v2-year-source-pill"
                                >
                                  {sourceLayerText(layer)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="v2-year-card-meta">
                              <span>{provenanceText}</span>
                            </div>
                          )}
                        </details>

                        {!isTrashbinLane && repairActions.length > 0 ? (
                          <div className="v2-year-card-repair-actions">
                            {repairActions.map((action) => (
                              <button
                                key={`${row.vuosi}-${action.key}`}
                                type="button"
                                className="v2-btn v2-btn-small"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openInlineCardEditor(
                                    row.vuosi,
                                    action.focusField,
                                    'step2',
                                    row.missingRequirements,
                                    'manualEdit',
                                  );
                                }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {rowTone === 'blocked' && isAdmin && !isTrashbinLane ? (
                          <div className="v2-year-card-repair-actions">
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step2',
                                  row.missingRequirements,
                                  'documentImport',
                                );
                              }}
                            >
                              {t(
                                'v2Overview.documentImportAction',
                                'Import source PDF',
                              )}
                            </button>
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step2',
                                  row.missingRequirements,
                                  'workbookImport',
                                );
                              }}
                            >
                              {t(
                                'v2Overview.workbookImportAction',
                                'Import KVA workbook',
                              )}
                            </button>
                          </div>
                        ) : null}

                        <div className="v2-year-card-repair-actions">
                          {rowTone === 'blocked' && isAdmin && !isTrashbinLane ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small v2-btn-primary"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step2',
                                  row.missingRequirements,
                                  'manualEdit',
                                );
                              }}
                            >
                              {t(
                                'v2Overview.manualPatchButton',
                                'Complete manually',
                              )}
                            </button>
                          ) : null}
                          {isCurrentEstimateLane &&
                          !confirmedImportedYears.includes(row.vuosi) ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void onAddCurrentYearEstimate(
                                  row.vuosi,
                                  row.missingRequirements,
                                );
                              }}
                            >
                              {t(
                                'v2Overview.currentYearEstimateAction',
                                'Add as estimate',
                              )}
                            </button>
                          ) : null}
                          {isCurrentEstimateLane &&
                          isAdmin &&
                          confirmedImportedYears.includes(row.vuosi) &&
                          row.missingRequirements.length > 0 ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step2',
                                  row.missingRequirements,
                                  'manualEdit',
                                );
                              }}
                            >
                              {t(
                                'v2Overview.manualPatchButton',
                                'Complete manually',
                              )}
                            </button>
                          ) : null}
                          {!isCurrentEstimateLane && !isTrashbinLane ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              aria-label={`${t(
                                'v2Overview.importTrashAction',
                                'Move to trashbin',
                              )} ${row.vuosi}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onTrashYear(row.vuosi);
                              }}
                              disabled={removingYear === row.vuosi}
                            >
                              {t(
                                'v2Overview.importTrashAction',
                                'Move to trashbin',
                              )}
                            </button>
                          ) : null}
                          {isTrashbinLane ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              aria-label={`${t(
                                'v2Overview.importRestoreAction',
                                'Restore year',
                              )} ${row.vuosi}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onRestoreYear(row.vuosi);
                              }}
                              disabled={removingYear === row.vuosi}
                            >
                              {t(
                                'v2Overview.importRestoreAction',
                                'Restore year',
                              )}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              );

              if (lane.key === 'trashbin') {
                return (
                  <details
                    key={lane.key}
                    className={`v2-import-board-lane v2-import-board-lane-${lane.key}`}
                  >
                    <summary>{laneHeader}</summary>
                    {laneGrid}
                  </details>
                );
              }

              return (
                <section
                  key={lane.key}
                  className={`v2-import-board-lane v2-import-board-lane-${lane.key}`}
                >
                  {laneHeader}
                  {laneGrid}
                </section>
              );
            })}
          </div>
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
                    primaryRepairRow.missingRequirements,
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
                    primaryRepairRow.missingRequirements,
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
                    primaryRepairRow.missingRequirements,
                    'workbookImport',
                  )
                }
                disabled={syncing || importingYears}
              >
                {t('v2Overview.workbookImportAction', 'Import KVA workbook')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={importYearsButtonClass}
              onClick={onImportYears}
              disabled={
                syncing || importingYears || selectedSelectableYearsCount === 0
              }
            >
              {importingYears
                ? t('v2Overview.importingYearsButton')
                : t('v2Overview.importYearsButton')}
            </button>
          )}
        </div>
      </article>
    </section>
  );
};
