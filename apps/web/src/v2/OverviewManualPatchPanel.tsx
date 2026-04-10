import React from 'react';

import { DocumentImportPreviewDetails } from './DocumentImportPreviewDetails';
import { getDocumentImportSelectedPageNumbers } from './documentPdfImport';
import { formatEur, formatNumber, formatPrice } from './format';
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
};

type ComparisonRow = {
  key: string;
  label: string;
  veetiValue: number;
  effectiveValue: number;
};

function renderDocumentImportPageValue(
  pageNumber: number | null,
  matches: Array<{ pageNumber: number | null }>,
  missingLabel: string,
): string {
  const selectedPageNumbers = getDocumentImportSelectedPageNumbers({ matches });
  if (selectedPageNumbers.length > 0) {
    return selectedPageNumbers.join(', ');
  }
  return pageNumber != null ? String(pageNumber) : missingLabel;
}

export const OverviewManualPatchPanel: React.FC<Props> = ({
  controller,
  manualPatchViewModel,
  workbookImportWorkflowProps,
}) => {
  const {
    t,
    wizardDisplayStep,
    manualPatchYear,
    cardEditContext,
    isDocumentImportMode,
    manualPatchError,
    loadingYearData,
    manualPatchMissing,
    missingRequirementLabel,
    isReviewMode,
    setupStatusLabel,
    financialComparisonRows,
    hasFinancialComparisonDiffs,
    priceComparisonRows,
    hasPriceComparisonDiffs,
    volumeComparisonRows,
    hasVolumeComparisonDiffs,
    manualPatchBusy,
    documentImportBusy,
    documentFileInputRef,
    handleDocumentPdfSelected,
    documentImportPreview,
    documentImportReviewedKeys,
    documentImportStatus,
    documentImportError,
    handleSelectDocumentImportMatch,
    showFinancialSection,
    manualFinancials,
    setManualFinancials,
    showPricesSection,
    manualPrices,
    setManualPrices,
    showVolumesSection,
    manualVolumes,
    setManualVolumes,
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
    handleKeepCurrentYearValues,
    handleSwitchToManualEditMode,
    handleSwitchToDocumentImportMode,
    handleSwitchToWorkbookImportMode,
    handleRestoreManualYearToPlan,
    handleExcludeManualYearFromPlan,
    closeManualPatchDialog,
    isWorkbookImportMode,
    canConfirmImportWorkflow,
    submitManualPatch,
    setInlineCardFieldRef,
    currentYearData,
  } = controller;
  const {
    currentFinancialFieldSources,
    canReapplyFinancialVeetiForYear,
    canReapplyPricesForYear,
    canReapplyVolumesForYear,
    currentFinancialSourceLabel,
    isManualYearExcluded,
    currentManualYearStatus,
    isCurrentYearReadyForReview,
    manualPatchDialogTitle,
    manualPatchDialogBody,
    yearActionsBody,
    keepYearButtonClass,
    fixYearButtonClass,
  } = manualPatchViewModel;

  if (
    wizardDisplayStep !== 4 ||
    manualPatchYear == null ||
    cardEditContext === 'step3'
  ) {
    return null;
  }

  const closeDisabled =
    manualPatchBusy || documentImportBusy || workbookImportBusy;
  const saveDisabled =
    manualPatchBusy ||
    documentImportBusy ||
    workbookImportBusy ||
    !canConfirmImportWorkflow;
  const showManualSaveActions = !isReviewMode && !isWorkbookImportMode;

  return (
    <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
      <div className="v2-modal-card">
        <h3>{manualPatchDialogTitle}</h3>
        <p className="v2-muted">{manualPatchDialogBody}</p>
        <span className="v2-chip v2-status-provenance">{manualPatchYear}</span>

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
            <h4>{t('v2Overview.yearDetailTitle', 'Year review surface')}</h4>
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

        <details className="v2-manual-optional" open={isReviewMode}>
          <summary>
            {t(
              'v2Overview.yearSecondaryTools',
              'Additional tools and restore actions',
            )}
          </summary>
          {financialComparisonRows.length > 0 ? (
            <section className="v2-manual-section">
              <ComparisonSection
                t={t}
                title={t(
                  'v2Overview.financialComparisonTitle',
                  'VEETI vs effective financial values',
                )}
                body={t(
                  'v2Overview.financialComparisonBody',
                  'Review how the current effective year differs from the original VEETI financial row before saving changes.',
                )}
                changed={hasFinancialComparisonDiffs}
                changedLabel={t(
                  'v2Overview.financialComparisonDiffs',
                  'Differences detected',
                )}
                stableLabel={t(
                  'v2Overview.financialComparisonMatches',
                  'Matches VEETI',
                )}
                rows={financialComparisonRows}
                formatValue={formatEur}
                onRestore={
                  canReapplyFinancialVeetiForYear
                    ? handleModalApplyVeetiFinancials
                    : null
                }
                restoreLabel={t(
                  'v2Overview.reapplyVeetiFinancials',
                  'Restore VEETI financials',
                )}
                busy={manualPatchBusy}
              />
            </section>
          ) : null}
          {priceComparisonRows.length > 0 ? (
            <section className="v2-manual-section">
              <ComparisonSection
                t={t}
                title={t(
                  'v2Overview.priceComparisonTitle',
                  'VEETI vs current unit prices',
                )}
                body={t(
                  'v2Overview.priceComparisonBody',
                  'Review raw VEETI prices against the current effective prices before saving or restoring this section.',
                )}
                changed={hasPriceComparisonDiffs}
                changedLabel={t(
                  'v2Overview.priceComparisonDiffs',
                  'Differences detected',
                )}
                stableLabel={t(
                  'v2Overview.priceComparisonMatches',
                  'Matches VEETI',
                )}
                rows={priceComparisonRows}
                formatValue={formatPrice}
                onRestore={
                  canReapplyPricesForYear ? handleModalApplyVeetiPrices : null
                }
                restoreLabel={t(
                  'v2Overview.reapplyVeetiPrices',
                  'Restore VEETI prices',
                )}
                busy={manualPatchBusy}
              />
            </section>
          ) : null}
          {volumeComparisonRows.length > 0 ? (
            <section className="v2-manual-section">
              <ComparisonSection
                t={t}
                title={t(
                  'v2Overview.volumeComparisonTitle',
                  'VEETI vs current sold volumes',
                )}
                body={t(
                  'v2Overview.volumeComparisonBody',
                  'Review raw VEETI sold volumes against the current effective values before saving or restoring this section.',
                )}
                changed={hasVolumeComparisonDiffs}
                changedLabel={t(
                  'v2Overview.volumeComparisonDiffs',
                  'Differences detected',
                )}
                stableLabel={t(
                  'v2Overview.volumeComparisonMatches',
                  'Matches VEETI',
                )}
                rows={volumeComparisonRows}
                formatValue={(value) => `${formatNumber(value)} m3`}
                onRestore={
                  canReapplyVolumesForYear ? handleModalApplyVeetiVolumes : null
                }
                restoreLabel={t(
                  'v2Overview.reapplyVeetiVolumes',
                  'Restore VEETI volumes',
                )}
                busy={manualPatchBusy}
              />
            </section>
          ) : null}
        </details>

        <input
          ref={documentFileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleDocumentPdfSelected}
          disabled={documentImportBusy || manualPatchBusy}
          hidden
        />

        {isDocumentImportMode ? (
          <section className="v2-manual-section v2-statement-import-panel">
            <div className="v2-manual-section-head">
              <h4>
                {t(
                  'v2Overview.documentImportWorkflowTitle',
                  'Import source PDF for year {{year}}',
                  { year: manualPatchYear },
                )}
              </h4>
              <span className="v2-required-pill">
                {t('v2Overview.requiredField', 'Required')}
              </span>
            </div>
            <p className="v2-muted">
              {t(
                'v2Overview.documentImportWorkflowBody',
                'Upload one source PDF and confirm the detected financial, price, and volume rows before saving the year.',
              )}
            </p>
            <div className="v2-statement-import-actions">
              <button
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() => documentFileInputRef.current?.click()}
                disabled={documentImportBusy || manualPatchBusy}
              >
                {t(
                  documentImportPreview
                    ? 'v2Overview.documentImportReplaceFile'
                    : 'v2Overview.documentImportUploadFile',
                  documentImportPreview ? 'Choose another PDF' : 'Upload source PDF',
                )}
              </button>
              {documentImportPreview ? (
                <span className="v2-muted">{documentImportPreview.fileName}</span>
              ) : null}
            </div>
            {documentImportStatus ? (
              <p className="v2-muted">{documentImportStatus}</p>
            ) : null}
            {documentImportError ? (
              <div className="v2-alert v2-alert-error">
                {documentImportError}
              </div>
            ) : null}
            {documentImportPreview ? (
              <div className="v2-statement-import-preview">
                <div className="v2-keyvalue-list v2-statement-import-meta-grid">
                  <div className="v2-keyvalue-row">
                    <span>{t('common.file', 'File')}</span>
                    <span>{documentImportPreview.fileName}</span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('common.page', 'Page')}</span>
                    <span>
                      {renderDocumentImportPageValue(
                        documentImportPreview.pageNumber,
                        documentImportPreview.matches,
                        t('v2Overview.previewMissingValue', 'Missing data'),
                      )}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t('v2Overview.documentImportDetectedKinds', 'Detected data')}
                    </span>
                    <span>
                      {documentImportPreview.datasetKinds.length > 0
                        ? documentImportPreview.datasetKinds.join(', ')
                        : t('v2Overview.previewMissingValue', 'Missing data')}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Overview.documentImportConfidence', 'Confidence')}</span>
                    <span>
                      {documentImportPreview.confidence != null
                        ? t('v2Overview.documentImportConfidenceValue', '{{value}}%', {
                            value: Math.round(documentImportPreview.confidence),
                          })
                        : t('v2Overview.previewMissingValue', 'Missing data')}
                    </span>
                  </div>
                </div>
                <DocumentImportPreviewDetails
                  preview={documentImportPreview}
                  currentYearData={currentYearData}
                  currentLabel={t('v2Overview.statementImportDiffCurrent', 'Current')}
                  missingValueLabel={t(
                    'v2Overview.previewMissingValue',
                    'Missing data',
                  )}
                  reviewedKeys={documentImportReviewedKeys}
                  onSelectMatch={handleSelectDocumentImportMatch}
                />
                {documentImportPreview.warnings.length > 0 ? (
                  <div className="v2-statement-import-warnings">
                    {documentImportPreview.warnings.map((warning) => (
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
                  'v2Overview.documentImportAwaitingFile',
                  'Upload the source PDF to review the detected candidates before confirming the import.',
                )}
              </p>
            )}
          </section>
        ) : null}

        {isWorkbookImportMode ? (
          <OverviewWorkbookImportWorkflow
            {...workbookImportWorkflowProps}
            yearLabel={manualPatchYear}
          />
        ) : null}

        {showFinancialSection ? (
          <section className="v2-manual-section">
            <div className="v2-manual-section-head">
              <h4>
                {t(
                  'v2Overview.manualFinancialSectionTitle',
                  'Financial statement data',
                )}
              </h4>
            </div>
            <div className="v2-manual-grid">
              <label>
                {t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)')}
                <input
                  ref={setInlineCardFieldRef('liikevaihto')}
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
              </label>
              <label>
                {t(
                  'v2Overview.manualFinancialMaterials',
                  'Materials and services',
                )}
                <input
                  ref={setInlineCardFieldRef('aineetJaPalvelut')}
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
                {t('v2Overview.manualFinancialPersonnel', 'Personnel costs')}
                <input
                  ref={setInlineCardFieldRef('henkilostokulut')}
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
                  ref={setInlineCardFieldRef('liiketoiminnanMuutKulut')}
                  className="v2-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualFinancials.liiketoiminnanMuutKulut}
                  onChange={(event) =>
                    setManualFinancials((prev) => ({
                      ...prev,
                      liiketoiminnanMuutKulut: Number(event.target.value || 0),
                    }))
                  }
                />
              </label>
              <label>
                {t('v2Overview.manualFinancialDepreciation', 'Depreciation')}
                <input
                  ref={setInlineCardFieldRef('poistot')}
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
                {t(
                  'v2Overview.manualFinancialYearResult',
                  'Year result (Tilikauden ylijäämä/alijäämä)',
                )}
                <input
                  ref={setInlineCardFieldRef('tilikaudenYliJaama')}
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
              </label>
            </div>
          </section>
        ) : null}

        {showPricesSection ? (
          <section className="v2-manual-section">
            <div className="v2-manual-section-head">
              <h4>{t('v2Overview.manualPriceSectionTitle', 'Prices')}</h4>
            </div>
            <div className="v2-manual-grid">
              <label>
                {t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)')}
                <input
                  ref={setInlineCardFieldRef('waterUnitPrice')}
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
                  ref={setInlineCardFieldRef('wastewaterUnitPrice')}
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
              <h4>{t('v2Overview.manualVolumeSectionTitle', 'Sold volumes')}</h4>
            </div>
            <div className="v2-manual-grid">
              <label>
                {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
                <input
                  ref={setInlineCardFieldRef('soldWaterVolume')}
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
                  ref={setInlineCardFieldRef('soldWastewaterVolume')}
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

        {showAllManualSections ? (
          <details className="v2-manual-optional" open>
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
                  className="v2-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={manualInvestments.korvausInvestoinninMaara}
                  onChange={(event) =>
                    setManualInvestments((prev) => ({
                      ...prev,
                      korvausInvestoinninMaara: Number(event.target.value || 0),
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

        {!isWorkbookImportMode ? (
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
                {t('v2Overview.workbookImportAction', 'Import KVA workbook')}
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-small"
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
            </div>
          </section>
        ) : null}

        <div className="v2-modal-actions">
          <button
            type="button"
            className="v2-btn"
            onClick={closeManualPatchDialog}
            disabled={closeDisabled}
          >
            {t(
              isReviewMode ? 'common.close' : 'common.cancel',
              isReviewMode ? 'Close' : 'Cancel',
            )}
          </button>
          {showManualSaveActions ? (
            <>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={saveDisabled}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isDocumentImportMode
                  ? t('v2Overview.documentImportConfirm', 'Confirm document import')
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className={
                  wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'
                }
                onClick={() => submitManualPatch(true)}
                disabled={saveDisabled}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isDocumentImportMode
                  ? t(
                      'v2Overview.documentImportConfirmAndSync',
                      'Confirm document import and sync year',
                    )
                  : t('v2Overview.manualPatchSaveAndSync', 'Save and sync year')}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const ComparisonSection: React.FC<{
  t: OverviewPageController['t'];
  title: string;
  body: string;
  changed: boolean;
  changedLabel: string;
  stableLabel: string;
  rows: ComparisonRow[];
  formatValue: (value: number) => string;
  onRestore: (() => void) | null;
  restoreLabel: string;
  busy: boolean;
}> = ({
  t,
  title,
  body,
  changed,
  changedLabel,
  stableLabel,
  rows,
  formatValue,
  onRestore,
  restoreLabel,
  busy,
}) => (
  <>
    <div className="v2-manual-section-head">
      <h4>{title}</h4>
      <span
        className={`v2-required-pill ${changed ? '' : 'v2-required-pill-optional'}`}
      >
        {changed ? changedLabel : stableLabel}
      </span>
    </div>
    <p className="v2-muted">{body}</p>
    <div className="v2-keyvalue-list">
      {rows.map((row) => (
        <div key={row.key} className="v2-keyvalue-row">
          <span>{row.label}</span>
          <span>
            {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
            {formatValue(row.veetiValue)} |{' '}
            {t('v2Overview.financialComparisonEffective', 'Effective')}:{' '}
            {formatValue(row.effectiveValue)}
          </span>
        </div>
      ))}
    </div>
    {onRestore ? (
      <button
        type="button"
        className="v2-btn v2-btn-small"
        onClick={onRestore}
        disabled={busy}
      >
        {restoreLabel}
      </button>
    ) : null}
  </>
);
