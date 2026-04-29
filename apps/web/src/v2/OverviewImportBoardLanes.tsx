import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse } from '../api';
import { formatEur, formatNumber, formatPrice, formatVolume } from './format';
import {
  buildPriceForm,
  buildVolumeForm,
  CARD_SUMMARY_FIELD_TO_INLINE_FIELD,
  getDatasetRowValue,
  getEffectiveFirstRow,
  getEffectiveRows,
  IMPORT_BOARD_CANON_ROWS,
  parseManualNumber,
  type InlineCardField,
} from './overviewManualForms';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import type { MissingRequirement } from './overviewWorkflow';
import {
  buildImportYearSourceLayers,
  type ImportYearSourceLayer,
} from './yearReview';

const STEP2_STANDALONE_INLINE_FIELDS = new Set<InlineCardField>([
  'perusmaksuYhteensa',
]);

type LaneKey =
  | 'current_estimate'
  | 'ready'
  | 'suspicious'
  | 'blocked'
  | 'trashbin';

type SummaryMapRow = {
  effectiveValue: number | null;
};

export type OverviewImportBoardRow = {
  vuosi: number;
  completeness: Record<string, boolean>;
  datasetCounts?: Record<string, number>;
  lane?: string;
  missingCount?: number;
  missingRequirements?: string[];
  missingSummary?: { count?: number; fields: string } | null;
  sourceLayers?: ImportYearSourceLayer[] | null;
  sourceStatus?: string;
  summaryMap: Map<string, SummaryMapRow>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  trustLabel?: string;
  trustNote?: string | null;
  trustToneClass?: string;
};

type Lane = {
  key: LaneKey;
  title: string;
  rows: OverviewImportBoardRow[];
};

type Props = {
  t: TFunction;
  lanes: Lane[];
  isManageMode: boolean;
  selectedYears: number[];
  syncing: boolean;
  readyRows: OverviewImportBoardRow[];
  suspiciousRows: OverviewImportBoardRow[];
  blockedRows: OverviewImportBoardRow[];
  trashbinRows: OverviewImportBoardRow[];
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
    options?: { tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null },
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
  removingYear: number | null;
  onToggleYear: (year: number) => void;
  onAddCurrentYearEstimate: (
    year: number,
    missingRequirements: MissingRequirement[],
  ) => Promise<void> | void;
  onTrashYear: (year: number) => Promise<void> | void;
  onRestoreYear: (year: number) => Promise<void> | void;
  bucketLabel: (missingCount: number) => string;
  getMissingCount: (row: OverviewImportBoardRow) => number;
};

export const OverviewImportBoardLanes: React.FC<Props> = ({
  t,
  lanes,
  isManageMode,
  selectedYears,
  syncing,
  suspiciousRows,
  blockedRows,
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
  removingYear,
  onToggleYear,
  onAddCurrentYearEstimate,
  onTrashYear,
  onRestoreYear,
  bucketLabel,
  getMissingCount,
}) => (
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
              const value = row.summaryMap.get(item.key)?.effectiveValue ?? null;
              const missing = value == null;
              const zero = !missing && value === 0;
              const inlineField = CARD_SUMMARY_FIELD_TO_INLINE_FIELD[item.key];
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
              (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 1,
            );
            const wastewaterPriceRow = priceRows.find(
              (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 2,
            );
            const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
            const wastewaterVolumeRow = getEffectiveFirstRow(
              yearData,
              'volume_jatevesi',
            );
            const secondaryStats = [
              {
                label: t('v2Overview.previewWaterPriceLabel', 'Water price'),
                focusField: 'waterUnitPrice' as InlineCardField,
                missing: !row.completeness.taksa || waterPriceRow == null,
                zero: waterPriceRow != null && priceForm.waterUnitPrice === 0,
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
                missing: !row.completeness.taksa || wastewaterPriceRow == null,
                zero:
                  wastewaterPriceRow != null &&
                  priceForm.wastewaterUnitPrice === 0,
                displayValue:
                  !row.completeness.taksa || wastewaterPriceRow == null
                    ? t('v2Overview.checkMissing', 'Missing')
                    : formatPrice(priceForm.wastewaterUnitPrice),
              },
              {
                label: t('v2Overview.previewWaterVolumeLabel', 'Sold water'),
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
                    : formatVolume(volumeForm.soldWaterVolume),
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
                    : formatVolume(volumeForm.soldWastewaterVolume),
              },
            ];
            const sourceLayers: ImportYearSourceLayer[] =
              Array.isArray(row.sourceLayers) && row.sourceLayers.length > 0
                ? row.sourceLayers
                : buildImportYearSourceLayers(yearData);
            const missingRequirements = (row.missingRequirements ?? []) as MissingRequirement[];
            const repairActions =
              isAdmin && !isTrashbinLane
                ? buildRepairActions(row.vuosi, missingRequirements)
                : [];
            const provenanceSummary =
              sourceLayers.length > 0
                ? sourceLayers.map((layer) => sourceLayerText(layer)).join(' | ')
                : renderDatasetCounts(
                    row.datasetCounts as Record<string, number> | undefined,
                  );
            const provenanceText = provenanceSummary || sourceStatusLabel(row.sourceStatus);
            const isInlineCardActive = cardEditYear === row.vuosi;
            const activeStep2Field =
              isInlineCardActive && cardEditContext === 'step2'
                ? cardEditFocusField
                : null;
            const quietOtherCards = cardEditYear != null && cardEditYear !== row.vuosi;
            const missingCount = getMissingCount(row);
            const canSelectRow = !isCurrentEstimateLane && !isTrashbinLane;
            const isSelected = selectedYears.includes(row.vuosi);
            const selectionStateLabel =
              isManageMode || !canSelectRow
                ? null
                : isSelected
                  ? t('v2Overview.importIncludedState', 'Included')
                  : t('v2Overview.importExcludedState', 'Not included');
            const blockerSummaryText =
              row.missingSummary != null
                ? t('v2Overview.yearMissingFieldsLabel', 'Missing: {{fields}}', {
                    fields: row.missingSummary.fields,
                  })
                : null;
            const rowTone =
              row.lane ??
              (blockedRows.some((item) => item.vuosi === row.vuosi)
                ? 'blocked'
                : suspiciousRows.some((item) => item.vuosi === row.vuosi)
                  ? 'suspicious'
                  : 'ready');
            const showBlockedAdminActions =
              rowTone === 'blocked' && isAdmin && !isTrashbinLane;

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
                        {t('v2Overview.currentYearEstimateBadge', 'Estimate')}
                      </span>
                    ) : null}
                    <span className={`v2-badge ${row.trustToneClass}`}>{row.trustLabel}</span>
                    <span className={`v2-badge ${sourceStatusClassName(row.sourceStatus)}`}>
                      {sourceStatusLabel(row.sourceStatus)}
                    </span>
                  </div>
                </div>

                <div className="v2-year-summary-line">
                  <strong>{bucketLabel(missingCount)}</strong>
                  {blockerSummaryText ? <span>{blockerSummaryText}</span> : null}
                </div>

                <div className="v2-year-canon-rows">
                  {canonRows.map((item) => (
                    <div
                      key={`${row.vuosi}-${item.key}`}
                      className={`v2-year-canon-row ${
                        item.emphasized ? 'result' : ''
                      } ${item.missing ? 'missing' : ''} ${item.zero ? 'zero' : ''} ${
                        activeStep2Field === item.inlineField ? 'editing-field' : ''
                      }`.trim()}
                      role={isAdmin && !isTrashbinLane ? 'button' : undefined}
                      tabIndex={isAdmin && !isTrashbinLane ? 0 : undefined}
                      onClick={() => {
                        if (!isAdmin || isTrashbinLane) return;
                        void attemptOpenInlineCardEditor(row.vuosi, item.inlineField);
                      }}
                      onKeyDown={(event) => {
                        if (!isAdmin || isTrashbinLane) return;
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return;
                        }
                        event.preventDefault();
                        void attemptOpenInlineCardEditor(row.vuosi, item.inlineField);
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
                          void attemptOpenInlineCardEditor(row.vuosi, item.inlineField);
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
                                missingRequirements,
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
                      rowTone === 'blocked' ? 'v2-year-readiness-missing' : 'v2-muted'
                    }
                  >
                    {row.trustNote}
                  </p>
                ) : null}

                {isInlineCardActive ? (
                  <div className="v2-inline-card-editor">
                    {loadingYearData === row.vuosi ? (
                      <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
                    ) : (
                      <>
                        {manualPatchError ? (
                          <div className="v2-alert v2-alert-error">{manualPatchError}</div>
                        ) : null}
                        {missingRequirements.length > 0 ? (
                          <p className="v2-manual-required-note">
                            {t(
                              'v2Overview.manualPatchRequiredHint',
                              'Required for sync readiness: {{requirements}}',
                              {
                                requirements: missingRequirements
                                  .map((item) =>
                                    missingRequirementLabel(item, {
                                      tariffRevenueReason: row.tariffRevenueReason,
                                    }),
                                  )
                                  .join(', '),
                              },
                            )}
                          </p>
                        ) : null}
                        {activeStep2Field != null &&
                        STEP2_STANDALONE_INLINE_FIELDS.has(activeStep2Field)
                          ? renderStep2InlineFieldEditor(activeStep2Field)
                          : null}
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
                      {sourceLayers.map((layer) => (
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

                {showBlockedAdminActions ? (
                  <div className="v2-year-card-actions-primary">
                    <button
                      type="button"
                      className="v2-btn v2-btn-small v2-btn-primary"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openInlineCardEditor(
                          row.vuosi,
                          null,
                          'step2',
                          missingRequirements,
                          'manualEdit',
                        );
                      }}
                    >
                      {t('v2Overview.manualPatchButton', 'Complete manually')}
                    </button>
                  </div>
                ) : null}

                {!isTrashbinLane && repairActions.length > 0 ? (
                  <div
                    className={`v2-year-card-repair-actions${
                      showBlockedAdminActions ? ' v2-year-card-actions-secondary' : ''
                    }`}
                  >
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
                            missingRequirements,
                            'manualEdit',
                          );
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {showBlockedAdminActions ? (
                  <div className="v2-year-card-repair-actions v2-year-card-actions-secondary">
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openInlineCardEditor(
                          row.vuosi,
                          null,
                          'step2',
                          missingRequirements,
                          'documentImport',
                        );
                      }}
                    >
                      {t('v2Overview.documentImportAction', 'Import source PDF')}
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
                          missingRequirements,
                          'workbookImport',
                        );
                      }}
                    >
                      {t('v2Overview.workbookImportAction', 'Repair from Excel')}
                    </button>
                  </div>
                ) : null}

                <div className="v2-year-card-repair-actions">
                  {isCurrentEstimateLane && !confirmedImportedYears.includes(row.vuosi) ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onAddCurrentYearEstimate(row.vuosi, missingRequirements);
                      }}
                    >
                      {t('v2Overview.currentYearEstimateAction', 'Add as estimate')}
                    </button>
                  ) : null}
                  {isCurrentEstimateLane &&
                  isAdmin &&
                  confirmedImportedYears.includes(row.vuosi) &&
                  missingRequirements.length > 0 ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openInlineCardEditor(
                          row.vuosi,
                          null,
                          'step2',
                          missingRequirements,
                          'manualEdit',
                        );
                      }}
                    >
                      {t('v2Overview.manualPatchButton', 'Complete manually')}
                    </button>
                  ) : null}
                  {!isCurrentEstimateLane && !isTrashbinLane && !showBlockedAdminActions ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      aria-label={`${t('v2Overview.importTrashAction', 'Move to trashbin')} ${row.vuosi}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onTrashYear(row.vuosi);
                      }}
                      disabled={removingYear === row.vuosi}
                    >
                      {t('v2Overview.importTrashAction', 'Move to trashbin')}
                    </button>
                  ) : null}
                  {showBlockedAdminActions ? (
                    <div className="v2-year-card-actions-tertiary">
                      <button
                        type="button"
                        className="v2-btn v2-btn-small"
                        aria-label={`${t('v2Overview.importTrashAction', 'Move to trashbin')} ${row.vuosi}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onTrashYear(row.vuosi);
                        }}
                        disabled={removingYear === row.vuosi}
                      >
                        {t('v2Overview.importTrashAction', 'Move to trashbin')}
                      </button>
                    </div>
                  ) : null}
                  {isTrashbinLane ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      aria-label={`${t('v2Overview.importRestoreAction', 'Restore year')} ${row.vuosi}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onRestoreYear(row.vuosi);
                      }}
                      disabled={removingYear === row.vuosi}
                    >
                      {t('v2Overview.importRestoreAction', 'Restore year')}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      );

      if (lane.key === 'trashbin' || lane.key === 'current_estimate') {
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
);
