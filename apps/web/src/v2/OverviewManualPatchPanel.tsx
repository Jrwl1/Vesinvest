import React from 'react';
import { formatEur, formatNumber, formatPrice } from './format';
import {
  OverviewQdisImportWorkflow,
  type Props as OverviewQdisImportWorkflowProps,
} from './OverviewQdisImportWorkflow';
import {
  OverviewWorkbookImportWorkflow,
  type Props as OverviewWorkbookImportWorkflowProps,
} from './OverviewWorkbookImportWorkflow';
import type { OverviewPageController } from './useOverviewPageController';
import type { OverviewManualPatchViewModel } from './overviewManualPatchModel';

type Props = {
  controller: OverviewPageController;
  manualPatchViewModel: OverviewManualPatchViewModel;
  workbookImportWorkflowProps: Omit<OverviewWorkbookImportWorkflowProps, 'yearLabel'>;
  qdisImportWorkflowProps: Omit<OverviewQdisImportWorkflowProps, 'yearLabel'>;
};

export const OverviewManualPatchPanel: React.FC<Props> = ({
  controller,
  manualPatchViewModel,
  workbookImportWorkflowProps,
  qdisImportWorkflowProps,
}) => {
  const {
    t,
    wizardDisplayStep,
    manualPatchYear,
    cardEditContext,
    isQdisImportMode,
    manualPatchError,
    loadingYearData,
    manualPatchMissing,
    missingRequirementLabel,
    isReviewMode,
    setupStatusLabel,
    renderDatasetTypeList,
    financialComparisonRows,
    hasFinancialComparisonDiffs,
    priceComparisonRows,
    hasPriceComparisonDiffs,
    volumeComparisonRows,
    hasVolumeComparisonDiffs,
    manualPatchBusy,
    statementImportBusy,
    statementFileInputRef,
    handleStatementPdfSelected,
    isStatementImportMode,
    statementImportPreview,
    statementImportStatus,
    statementImportError,
    statementImportComparisonRows,
    showFinancialSection,
    manualFinancials,
    setManualFinancials,
    showPricesSection,
    manualPrices,
    setManualPrices,
    showVolumesSection,
    manualVolumes,
    setManualVolumes,
    manualPatchMode,
    showAllManualSections,
    manualInvestments,
    setManualInvestments,
    manualEnergy,
    setManualEnergy,
    manualNetwork,
    setManualNetwork,
    manualReason,
    setManualReason,
    handleModalApplyVeetiFinancials,
    handleModalApplyVeetiPrices,
    handleModalApplyVeetiVolumes,
    workbookImportBusy,
    qdisImportBusy,
    handleKeepCurrentYearValues,
    handleSwitchToManualEditMode,
    handleSwitchToStatementImportMode,
    handleSwitchToWorkbookImportMode,
    handleSwitchToQdisImportMode,
    handleRestoreManualYearToPlan,
    handleExcludeManualYearFromPlan,
    closeManualPatchDialog,
    isWorkbookImportMode,
    canConfirmImportWorkflow,
    submitManualPatch,
    setInlineCardFieldRef,
  } = controller;
  const {
    statementImportImpact,
    currentFinancialFieldSources,
    canReapplyFinancialVeetiForYear,
    canReapplyPricesForYear,
    canReapplyVolumesForYear,
    currentFinancialSourceLabel,
    isManualYearExcluded,
    currentManualYearStatus,
    manualPatchDialogTitle,
    manualPatchDialogBody,
    yearActionsBody,
    keepYearButtonClass,
    fixYearButtonClass,
  } = manualPatchViewModel;

  return wizardDisplayStep === 4 &&
    manualPatchYear != null &&
    cardEditContext !== 'step3' ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
            <h3>{manualPatchDialogTitle}</h3>
            {isQdisImportMode ? null : (
              <p className="v2-muted">{manualPatchDialogBody}</p>
            )}
            <span className="v2-chip v2-status-provenance">
              {manualPatchYear}
            </span>
            {manualPatchError ? (
              <div className="v2-alert v2-alert-error">{manualPatchError}</div>
            ) : null}
            {loadingYearData === manualPatchYear ? (
              <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
            ) : null}

            {manualPatchMissing.length > 0 ? (
              <p className="v2-manual-required-note">
                {t(
                  'v2Overview.manualPatchRequiredHint',
                  'Required for sync readiness: {{requirements}}',
                  {
                    requirements: manualPatchMissing
                      .map((item) => missingRequirementLabel(item))
                      .join(', '),
                  },
                )}
              </p>
            ) : null}

            <section className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>
                  {t(
                    'v2Overview.yearDetailTitle',
                    'Year review surface',
                  )}
                </h4>
                <span className="v2-required-pill v2-required-pill-optional">
                  {currentFinancialSourceLabel}
                </span>
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
              {isReviewMode && !isStatementImportMode ? (
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
                    <span>
                      {t(
                        'v2Overview.yearDetailFinancialOwnership',
                        'Financial field ownership',
                      )}
                    </span>
                    <span>
                      {currentFinancialFieldSources
                        .map((field) => `${field.label}: ${field.owner}`)
                        .join(' | ')}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-impact-panel">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportEffectTitle',
                      'What this import changes',
                    )}
                  </h4>
                </div>
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectChanged',
                        'Will update',
                      )}
                    </span>
                    <span>
                      {t(
                        'v2Overview.datasetFinancials',
                        'Financial statement',
                      )}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectCurrentFinancialSource',
                        'Current financial source',
                      )}
                    </span>
                    <span>
                      {statementImportImpact.currentFinancialSource === 'manual'
                        ? t('v2Overview.sourceManual', 'Manual')
                        : statementImportImpact.currentFinancialSource ===
                          'veeti'
                        ? t('v2Overview.sourceVeeti', 'VEETI')
                        : t('v2Overview.sourceIncomplete', 'Incomplete')}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectKeepsVeeti',
                        'Keeps from VEETI',
                      )}
                    </span>
                    <span>
                      {renderDatasetTypeList(statementImportImpact.keepVeeti)}
                    </span>
                  </div>
                  {statementImportImpact.keepManual.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectKeepsManual',
                          'Keeps manual',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepManual)}
                      </span>
                    </div>
                  ) : null}
                  {statementImportImpact.keepEmpty.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectStillMissing',
                          'Still missing',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepEmpty)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
            {isWorkbookImportMode ? (
              <OverviewWorkbookImportWorkflow
                {...workbookImportWorkflowProps}
                yearLabel={manualPatchYear ?? '-'}
              />
            ) : null}
            {isQdisImportMode ? (
              <OverviewQdisImportWorkflow
                {...qdisImportWorkflowProps}
                yearLabel={manualPatchYear ?? '-'}
              />
            ) : null}

            {financialComparisonRows.length > 0 ||
            priceComparisonRows.length > 0 ||
            volumeComparisonRows.length > 0 ? (
              <details className="v2-manual-optional">
                <summary>
                  {t(
                    'v2Overview.yearSecondaryTools',
                    'Additional tools and restore actions',
                  )}
                </summary>
            {financialComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.financialComparisonTitle',
                      'VEETI vs effective financial values',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasFinancialComparisonDiffs
                        ? ''
                        : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasFinancialComparisonDiffs
                      ? t(
                          'v2Overview.financialComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.financialComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.financialComparisonBody',
                    'Review how the current effective year differs from the original VEETI financial row before saving changes.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {financialComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatEur(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatEur(row.effectiveValue)}
                        {row.changed
                          ? ` | ${t(
                              'v2Overview.financialComparisonDelta',
                              'Delta',
                            )}: ${formatEur(row.effectiveValue - row.veetiValue)}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyFinancialVeetiForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiFinancials}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiFinancials',
                      'Restore VEETI financials',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {priceComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.priceComparisonTitle',
                      'VEETI vs current unit prices',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasPriceComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasPriceComparisonDiffs
                      ? t(
                          'v2Overview.priceComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.priceComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.priceComparisonBody',
                    'Review raw VEETI prices against the current effective prices before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {priceComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatPrice(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatPrice(row.effectiveValue)}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyPricesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiPrices}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiPrices',
                      'Restore VEETI prices',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {volumeComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.volumeComparisonTitle',
                      'VEETI vs current sold volumes',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasVolumeComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasVolumeComparisonDiffs
                      ? t(
                          'v2Overview.volumeComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.volumeComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.volumeComparisonBody',
                    'Review raw VEETI sold volumes against the current effective values before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {volumeComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatNumber(row.veetiValue)} m3 |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatNumber(row.effectiveValue)} m3
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyVolumesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiVolumes}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiVolumes',
                      'Restore VEETI volumes',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}
              </details>
            ) : null}

            <input
              ref={statementFileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleStatementPdfSelected}
              disabled={statementImportBusy || manualPatchBusy}
              hidden
            />

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportWorkflowTitle',
                      'Import statement PDF for year {{year}}',
                      { year: manualPatchYear ?? '-' },
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.statementImportWorkflowBody',
                    'Upload the bookkeeping PDF, review the detected financial statement values, and confirm the import. Other datasets keep their current source.',
                  )}
                </p>
                <div className="v2-statement-import-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => statementFileInputRef.current?.click()}
                    disabled={statementImportBusy || manualPatchBusy}
                  >
                    {t(
                      statementImportPreview
                        ? 'v2Overview.statementImportReplaceFile'
                        : 'v2Overview.statementImportUploadFile',
                      statementImportPreview
                        ? 'Choose another PDF'
                        : 'Upload statement PDF',
                    )}
                  </button>
                  {statementImportPreview ? (
                    <span className="v2-muted">
                      {statementImportPreview.fileName}
                    </span>
                  ) : null}
                </div>
                {statementImportStatus ? (
                  <p className="v2-muted">{statementImportStatus}</p>
                ) : null}
                {statementImportError ? (
                  <div className="v2-alert v2-alert-error">
                    {statementImportError}
                  </div>
                ) : null}
                {statementImportPreview ? (
                  <div className="v2-statement-import-preview">
                    <div className="v2-keyvalue-list v2-statement-import-meta-grid">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaFile',
                            'Detected file',
                          )}
                        </span>
                        <span>{statementImportPreview.fileName}</span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaPage',
                            'Detected page',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.pageNumber != null
                            ? statementImportPreview.pageNumber
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaConfidence',
                            'OCR confidence',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.confidence != null
                            ? t(
                                'v2Overview.statementImportConfidence',
                                'confidence {{value}}%',
                                {
                                  value: Math.round(
                                    statementImportPreview.confidence,
                                  ),
                                },
                              )
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaScannedPages',
                            'Scanned pages',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Overview.statementImportScannedPages',
                            'scanned {{count}} pages',
                            {
                              count: statementImportPreview.scannedPageCount,
                            },
                          )}
                        </span>
                      </div>
                    </div>
                    <section className="v2-manual-section v2-statement-import-diff-panel">
                      <div className="v2-manual-section-head">
                        <h4>
                          {t(
                            'v2Overview.statementImportDiffTitle',
                            'VEETI, PDF, and current values',
                          )}
                        </h4>
                      </div>
                      <p className="v2-muted">
                        {t(
                          'v2Overview.statementImportDiffBody',
                          'Check what the PDF proposes against the original VEETI row and the current effective year before you confirm or sync.',
                        )}
                      </p>
                      {statementImportComparisonRows.length > 0 ? (
                        <div className="v2-statement-import-diff-table">
                          <div className="v2-statement-import-diff-head">
                            <span>
                              {t('v2Overview.statementImportDiffField', 'Field')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffVeeti', 'VEETI')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffPdf', 'PDF')}
                            </span>
                            <span>
                              {t(
                                'v2Overview.statementImportDiffCurrent',
                                'Current',
                              )}
                            </span>
                          </div>
                          {statementImportComparisonRows.map((row) => (
                            <div
                              key={row.key}
                              className={`v2-statement-import-diff-row ${
                                row.changedFromCurrent
                                  ? 'v2-statement-import-diff-row-changed'
                                  : ''
                              }`}
                            >
                              <span>
                                <strong>{row.label}</strong>
                                {row.sourceLine ? (
                                  <small className="v2-muted">
                                    {row.sourceLine}
                                  </small>
                                ) : null}
                              </span>
                              <span>
                                {row.veetiValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.veetiValue)}
                              </span>
                              <span>
                                {row.pdfValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.pdfValue)}
                              </span>
                              <span>
                                {row.currentValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.currentValue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="v2-muted">
                          {t(
                            'v2Overview.statementImportNoMappedValues',
                            'OCR did not produce mapped financial values yet. Upload another PDF before confirming the import.',
                          )}
                        </p>
                      )}
                    </section>
                    {statementImportPreview.warnings.length > 0 ? (
                      <div className="v2-statement-import-warnings">
                        {statementImportPreview.warnings.map((warning) => (
                          <p key={warning} className="v2-muted">
                            {warning}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="v2-muted v2-statement-import-placeholder">
                    {t(
                      'v2Overview.statementImportAwaitingFile',
                      'Upload the statement PDF to populate the OCR comparison before confirming the import.',
                    )}
                  </p>
                )}
              </section>
            ) : null}

            {showFinancialSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.manualSectionFinancials',
                      'Financial statement data',
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualFinancialRevenue',
                      'Revenue (Liikevaihto)',
                    )}
                    <input
                      name="manual-financials-liikevaihto"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liikevaihto}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liikevaihto: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialFixedRevenue',
                      'Fixed revenue total',
                    )}
                    <input
                      ref={setInlineCardFieldRef('perusmaksuYhteensa')}
                      name="manual-financials-perusmaksuYhteensa"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.perusmaksuYhteensa}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          perusmaksuYhteensa: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <small className="v2-muted">
                      {t(
                        'v2Overview.manualFinancialFixedRevenueHint',
                        'Annual fixed or non-volume revenue used to reconcile tariff revenue.',
                      )}
                    </small>
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialMaterials',
                      'Materials and services',
                    )}
                    <input
                      name="manual-financials-aineetJaPalvelut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.aineetJaPalvelut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          aineetJaPalvelut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialPersonnel',
                      'Personnel costs',
                    )}
                    <input
                      name="manual-financials-henkilostokulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.henkilostokulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          henkilostokulut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialOtherOpex',
                      'Other operating costs',
                    )}
                    <input
                      name="manual-financials-liiketoiminnanMuutKulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liiketoiminnanMuutKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liiketoiminnanMuutKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialDepreciation',
                      'Depreciation',
                    )}
                    <input
                      name="manual-financials-poistot"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.poistot}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          poistot: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialWriteDowns', 'Write-downs')}
                    <input
                      name="manual-financials-arvonalentumiset"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.arvonalentumiset}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          arvonalentumiset: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialNetFinance', 'Net finance')}
                    <input
                      name="manual-financials-rahoitustuototJaKulut"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.rahoitustuototJaKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          rahoitustuototJaKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialYearResult',
                      'Year result (Tilikauden ylijäämä/alijäämä)',
                    )}
                    <input
                      name="manual-financials-tilikaudenYliJaama"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.tilikaudenYliJaama}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          tilikaudenYliJaama: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <small className="v2-muted">
                      {t(
                        'v2Overview.manualFinancialYearResultHint',
                        'Update this saved Year result field directly when the visible result row should change.',
                      )}
                    </small>
                  </label>
                </div>
              </section>
            ) : null}

            {showPricesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>{t('v2Overview.manualSectionPrices', 'Unit prices')}</h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualPriceWater',
                      'Water unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-waterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.waterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          waterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualPriceWastewater',
                      'Wastewater unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-wastewaterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.wastewaterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          wastewaterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {showVolumesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t('v2Overview.manualSectionVolumes', 'Sold volumes')}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualVolumeWater',
                      'Sold water volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualVolumeWastewater',
                      'Sold wastewater volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWastewaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWastewaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWastewaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {manualPatchMode === 'manualEdit' ? (
            <details
              className="v2-manual-optional"
              open={showAllManualSections}
            >
              <summary>
                {t(
                  'v2Overview.manualOptionalSection',
                  'Optional context fields and note',
                )}
              </summary>
              <div className="v2-manual-grid">
                <label>
                  {t('v2Overview.manualInvestmentAmount', 'Investment amount')}
                  <input
                    name="manual-investments-investoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.investoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        investoinninMaara: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualReplacementInvestmentAmount',
                    'Replacement investment amount',
                  )}
                  <input
                    name="manual-investments-korvausInvestoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.korvausInvestoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        korvausInvestoinninMaara: Number(
                          event.target.value || 0,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualProcessElectricity',
                    'Process electricity',
                  )}
                  <input
                    name="manual-energy-prosessinKayttamaSahko"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualEnergy.prosessinKayttamaSahko}
                    onChange={(event) =>
                      setManualEnergy({
                        prosessinKayttamaSahko: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label>
                  {t('v2Overview.manualNetworkLength', 'Network length')}
                  <input
                    name="manual-network-verkostonPituus"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualNetwork.verkostonPituus}
                    onChange={(event) =>
                      setManualNetwork({
                        verkostonPituus: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
              </div>

              <label>
                {t('v2Overview.manualPatchReason', 'Reason for manual change')}
                <textarea
                  name="manual-reason"
                  className="v2-input"
                  rows={3}
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  placeholder={t(
                    'v2Overview.manualPatchReasonPlaceholder',
                    'Optional note describing why this year is edited manually',
                  )}
                />
              </label>
            </details>
            ) : null}

            {isQdisImportMode ? null : (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>{t('v2Overview.yearActionsTitle', 'Year actions')}</h4>
                </div>
                <p className="v2-muted">
                  {yearActionsBody}
                </p>
                <div className="v2-year-card-actions">
                  <button
                    type="button"
                    className={keepYearButtonClass}
                    onClick={handleKeepCurrentYearValues}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t('v2Overview.keepYearInPlan')}
                  </button>
                  <button
                    type="button"
                    className={fixYearButtonClass}
                    onClick={handleSwitchToManualEditMode}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t('v2Overview.fixYearValues')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleSwitchToStatementImportMode}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.statementImportAction',
                      'Import statement PDF',
                    )}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleSwitchToWorkbookImportMode}
                    disabled={manualPatchBusy || workbookImportBusy}
                  >
                    {t(
                      'v2Overview.workbookImportAction',
                      'Import KVA workbook',
                    )}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleSwitchToQdisImportMode}
                    disabled={manualPatchBusy || qdisImportBusy}
                  >
                    {t(
                      'v2Overview.qdisImportAction',
                      'Import QDIS PDF',
                    )}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={
                      isManualYearExcluded
                        ? handleRestoreManualYearToPlan
                        : handleExcludeManualYearFromPlan
                    }
                    disabled={manualPatchBusy || statementImportBusy}
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
                </div>
              </section>
            )}

            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeManualPatchDialog}
                disabled={manualPatchBusy || statementImportBusy || workbookImportBusy}
              >
                {t(
                  isReviewMode ? 'common.close' : 'common.cancel',
                  isReviewMode ? 'Close' : 'Cancel',
                )}
              </button>
              {isReviewMode || isWorkbookImportMode ? null : isQdisImportMode ? (
                <button
                  type="button"
                  className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
                  onClick={() => submitManualPatch(true)}
                  disabled={
                    manualPatchBusy ||
                    statementImportBusy ||
                    !canConfirmImportWorkflow
                  }
                >
                  {manualPatchBusy
                    ? t('common.loading', 'Loading...')
                    : t(
                        'v2Overview.qdisImportConfirmAndSync',
                        'Confirm QDIS import and sync year',
                      )}
                </button>
              ) : (
                <>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirm',
                      'Confirm statement import',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirm',
                      'Confirm QDIS import',
                    )
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
                onClick={() => submitManualPatch(true)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirmAndSync',
                      'Confirm import and sync year',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirmAndSync',
                      'Confirm QDIS import and sync year',
                    )
                  : t(
                      'v2Overview.manualPatchSaveAndSync',
                      'Save and sync year',
                    )}
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null;
};
