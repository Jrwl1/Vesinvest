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
import type { MissingRequirement } from './overviewWorkflow';
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
  parkedRows: BoardRow[];
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
  missingRequirementLabel: (requirement: MissingRequirement) => string;
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
  onToggleYear: (year: number) => void;
  onImportYears: () => void;
  onAddCurrentYearEstimate: (
    year: number,
    missingRequirements: MissingRequirement[],
  ) => Promise<void> | void;
  importYearsButtonClass: string;
  importingYears: boolean;
};

export const OverviewImportBoard: React.FC<Props> = ({
  t,
  workflowStep = 2,
  selectedYears,
  syncing,
  readyRows,
  suspiciousRows,
  blockedRows,
  parkedRows,
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
  onImportYears,
  onAddCurrentYearEstimate,
  importYearsButtonClass,
  importingYears,
  onToggleYear,
}) => {
  const sortRowsChronologically = React.useCallback(
    (rows: BoardRow[]) => [...rows].sort((a, b) => a.vuosi - b.vuosi),
    [],
  );
  const lanes = [
    {
      key: 'current_estimate' as const,
      title: t('v2Overview.currentYearEstimateTitle', 'Current year estimate'),
      body: null,
      rows: sortRowsChronologically(currentYearEstimateRows),
    },
    {
      key: 'ready' as const,
      title: t('v2Overview.trustLaneReadyTitle', 'Ready to review'),
      body: t(
        'v2Overview.trustLaneReadyBody',
        'These years look plausible enough to select now and verify after import.',
      ),
      rows: sortRowsChronologically(readyRows),
    },
    {
      key: 'suspicious' as const,
      title: t('v2Overview.trustLaneSuspiciousTitle', 'Suspicious but salvageable'),
      body: t(
        'v2Overview.trustLaneSuspiciousBody',
        'These years can still be selected, but the trust signals call for a human check before they become the planning baseline.',
      ),
      rows: sortRowsChronologically(suspiciousRows),
    },
    {
      key: 'blocked' as const,
      title: t('v2Overview.trustLaneBlockedTitle', 'Blocked until completed'),
      body: t(
        'v2Overview.trustLaneBlockedBody',
        'These years are missing key inputs and should stay out of the import selection until the gaps are fixed.',
      ),
      rows: sortRowsChronologically(blockedRows),
    },
    {
      key: 'parked' as const,
      title: t('v2Overview.trustLaneParkedTitle', 'Not in this import'),
      body: t(
        'v2Overview.trustLaneParkedBody',
        'These years stay available, but they are intentionally parked outside the current import selection.',
      ),
      rows: sortRowsChronologically(parkedRows),
    },
  ];

  return (
    <section>
      <article id="v2-import-years" className="v2-card v2-overview-step-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', { step: workflowStep })}
            </p>
            <h2>{t('v2Overview.wizardQuestionImportYears')}</h2>
          </div>
          <span className="v2-chip">
            {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
            {selectedYears.length}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyImportYears')}
        </p>

        {lanes.every((lane) => lane.rows.length === 0) ? (
          <p className="v2-muted">
            {t(
              'v2Overview.noImportedYears',
              'No imported years available yet.',
            )}
          </p>
        ) : (
          <div className="v2-import-board">
            {lanes.map((lane) => {
              if (lane.rows.length === 0) return null;
              const isCurrentEstimateLane = lane.key === 'current_estimate';
              const laneHeader = (
                <div className="v2-import-board-summary">
                  <div className="v2-year-readiness-section-head">
                    <h3>{lane.title}</h3>
                    {lane.body ? <p className="v2-muted">{lane.body}</p> : null}
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
                    const repairActions = isAdmin
                      ? buildRepairActions(row.vuosi, row.missingRequirements)
                      : [];
                    const sourceLayers = buildImportYearSourceLayers(yearData);
                    const provenanceSummary =
                      sourceLayers.length > 0
                        ? sourceLayers.map((layer) => sourceLayerText(layer)).join(' | ')
                        : renderDatasetCounts(
                            row.datasetCounts as Record<string, number> | undefined,
                          );
                    const isInlineCardActive = cardEditYear === row.vuosi;
                    const activeStep2Field =
                      isInlineCardActive && cardEditContext === 'step2'
                        ? cardEditFocusField
                        : null;
                    const quietOtherCards =
                      cardEditYear != null && cardEditYear !== row.vuosi;
                    return (
                      <article
                        key={`${lane.key}-${row.vuosi}`}
                        className={`v2-year-readiness-row ${lane.key} ${
                          isInlineCardActive ? 'active-edit' : ''
                        } ${quietOtherCards ? 'quiet' : ''}`.trim()}
                      >
                        <div className="v2-year-readiness-head">
                          {lane.key === 'blocked' || isCurrentEstimateLane ? (
                            <div className="v2-year-checkbox v2-year-select-disabled">
                              <strong>{row.vuosi}</strong>
                            </div>
                          ) : (
                            <label
                              className="v2-year-checkbox"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                name={`syncYear-${row.vuosi}`}
                                checked={selectedYears.includes(row.vuosi)}
                                onChange={() => onToggleYear(row.vuosi)}
                                disabled={syncing}
                              />
                              <strong>{row.vuosi}</strong>
                            </label>
                          )}
                          <div className="v2-badge-row">
                            {isCurrentEstimateLane ? (
                              <span className="v2-badge v2-status-provenance">
                                {t('v2Overview.currentYearEstimateBadge', 'Estimate')}
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

                        {row.missingSummary ? (
                          <div className={`v2-year-gap-summary ${lane.key}`}>
                            <strong>
                              {t(
                                'v2Overview.yearMissingCountLabel',
                                'Missing {{count}}/{{total}} required items',
                                {
                                  count: row.missingSummary.count,
                                  total: row.missingSummary.total,
                                },
                              )}
                            </strong>
                            <span>
                              {t(
                                'v2Overview.yearMissingFieldsLabel',
                                'Missing: {{fields}}',
                                { fields: row.missingSummary.fields },
                              )}
                            </span>
                          </div>
                        ) : null}

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
                              role={isAdmin ? 'button' : undefined}
                              tabIndex={isAdmin ? 0 : undefined}
                              onClick={() => {
                                if (!isAdmin) return;
                                void attemptOpenInlineCardEditor(
                                  row.vuosi,
                                  item.inlineField,
                                );
                              }}
                              onKeyDown={(event) => {
                                if (!isAdmin) return;
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
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isAdmin) return;
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

                        {row.trustNote ? (
                          <p
                            className={
                              lane.key === 'blocked'
                                ? 'v2-year-readiness-missing'
                                : 'v2-muted'
                            }
                          >
                            {row.trustNote}
                          </p>
                        ) : null}

                        <div className="v2-year-card-secondary">
                          <div className="v2-year-card-secondary-grid compact">
                            {secondaryStats.map((item) => {
                              const isSecondaryFieldActive =
                                activeStep2Field === item.focusField;
                              return isAdmin ? (
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
                          {repairActions.length > 0 ? (
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
                              <span>{provenanceSummary}</span>
                            </div>
                          )}
                        </div>

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
                                            missingRequirementLabel(item),
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

                        {lane.key === 'blocked' && isAdmin ? (
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
                      </article>
                    );
                  })}
                </div>
              );
              if (lane.key === 'blocked' || lane.key === 'parked') {
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
          <button
            type="button"
            className={importYearsButtonClass}
            onClick={onImportYears}
            disabled={syncing || importingYears || selectedYears.length === 0}
          >
            {importingYears
              ? t('v2Overview.importingYearsButton')
              : t('v2Overview.importYearsButton')}
          </button>
        </div>
      </article>
    </section>
  );
};
