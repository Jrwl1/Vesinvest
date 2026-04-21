import React from 'react';
import type { TFunction } from 'i18next';

import { DocumentImportPreviewDetails } from './DocumentImportPreviewDetails';
import {
  OverviewWorkbookImportWorkflow,
  type Props as OverviewWorkbookImportWorkflowProps,
} from './OverviewWorkbookImportWorkflow';
import type { V2ImportYearDataResponse } from '../api';
import type {
  InlineCardField,
  ManualFinancialForm,
  ManualPriceForm,
  ManualVolumeForm,
} from './overviewManualForms';
import type { MissingRequirement } from './overviewWorkflow';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import type { DocumentImportPreview } from './documentPdfImport';
import {
  renderDocumentImportPageValue,
  type ReviewStatusRow,
} from './overviewReviewModel';

type OverviewReviewCardBodyProps = {
  t: TFunction;
  row: ReviewStatusRow;
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
  currentYearData?: V2ImportYearDataResponse;
  documentFileInputRef: React.RefObject<HTMLInputElement | null>;
  workbookImportBusy: boolean;
  canConfirmImportWorkflow: boolean;
  isInlineCardDirty: boolean;
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
  missingRequirementLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string;
  saveInlineCardEdit: (syncAfterSave?: boolean) => Promise<void> | void;
  closeInlineCardEditor: () => void;
  workbookImportWorkflowProps: Omit<
    OverviewWorkbookImportWorkflowProps,
    'yearLabel'
  >;
};

export const OverviewReviewCardBody: React.FC<OverviewReviewCardBodyProps> = ({
  t,
  row,
  manualPatchMode,
  manualPatchBusy,
  manualPatchError,
  documentImportBusy,
  documentImportStatus,
  documentImportError,
  documentImportPreview,
  documentImportReviewedKeys,
  handleSelectDocumentImportMatch,
  currentYearData,
  documentFileInputRef,
  workbookImportBusy,
  canConfirmImportWorkflow,
  isInlineCardDirty,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  markManualFieldTouched,
  missingRequirementLabel,
  saveInlineCardEdit,
  closeInlineCardEditor,
  workbookImportWorkflowProps,
}) => {
  const inlineError = manualPatchError ?? documentImportError;
  const isDocumentImportMode = manualPatchMode === 'documentImport';
  const isWorkbookImportMode = manualPatchMode === 'workbookImport';

  return (
    <div className="v2-inline-card-editor">
      {inlineError ? (
        <div className="v2-alert v2-alert-error">{inlineError}</div>
      ) : null}
      {row.missingRequirements.length > 0 ? (
        <p className="v2-manual-required-note">
          {t('v2Overview.manualPatchRequiredHint', {
            requirements: row.missingRequirements
              .map((item) =>
                missingRequirementLabel(item, {
                  tariffRevenueReason: row.tariffRevenueReason,
                }),
              )
              .join(', '),
          })}
        </p>
      ) : null}

      {isDocumentImportMode ? (
        <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.documentImportWorkflowTitle',
                'Import source PDF for year {{year}}',
                { year: row.year },
              )}
            </h4>
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
          {documentImportPreview ? (
            <div className="v2-keyvalue-list">
              <div className="v2-keyvalue-row">
                <span>{t('common.file', 'File')}</span>
                <span>{documentImportPreview.fileName}</span>
              </div>
              <div className="v2-keyvalue-row">
                <span>{t('common.page', 'Page')}</span>
                <span>{renderDocumentImportPageValue(documentImportPreview)}</span>
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
                    : '-'}
                </span>
              </div>
            </div>
          ) : (
            <p className="v2-muted v2-statement-import-placeholder">
              {t(
                'v2Overview.documentImportAwaitingFile',
                'Upload the source PDF to review the detected candidates before confirming the import.',
              )}
            </p>
          )}
          {documentImportPreview ? (
            <DocumentImportPreviewDetails
              preview={documentImportPreview}
              currentYearData={currentYearData}
              currentLabel={t('v2Overview.statementImportDiffCurrent', 'Current')}
              missingValueLabel={t('v2Overview.previewMissingValue', 'Missing data')}
              reviewedKeys={documentImportReviewedKeys}
              onSelectMatch={handleSelectDocumentImportMatch}
            />
          ) : null}
          {documentImportPreview?.warnings.length ? (
            <p className="v2-muted">{documentImportPreview.warnings.join(' ')}</p>
          ) : null}
          <div className="v2-inline-card-editor-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={() => void saveInlineCardEdit(false)}
              disabled={manualPatchBusy || documentImportBusy || !canConfirmImportWorkflow}
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.documentImportConfirm', 'Confirm source PDF')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => void saveInlineCardEdit(true)}
              disabled={manualPatchBusy || documentImportBusy || !canConfirmImportWorkflow}
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t(
                    'v2Overview.documentImportConfirmAndSync',
                    'Confirm PDF and sync year',
                  )}
            </button>
            <button
              type="button"
              className="v2-btn"
              onClick={closeInlineCardEditor}
              disabled={manualPatchBusy || documentImportBusy}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </section>
      ) : null}

      {isWorkbookImportMode ? (
        <OverviewWorkbookImportWorkflow
          {...workbookImportWorkflowProps}
          yearLabel={row.year}
        />
      ) : null}

      {manualPatchMode === 'manualEdit' || manualPatchMode === 'documentImport' ? (
        <>
          <div className="v2-inline-card-editor-grid">
            <label>
              {t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)')}
              <input
                ref={setInlineCardFieldRef('liikevaihto')}
                className="v2-input"
                type="number"
                min={0}
                step="0.01"
                value={manualFinancials.liikevaihto}
                onChange={(event) => {
                  markManualFieldTouched('liikevaihto');
                  setManualFinancials((prev) => ({
                    ...prev,
                    liikevaihto: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t('v2Overview.manualFinancialFixedRevenue')}
              <input
                ref={setInlineCardFieldRef('perusmaksuYhteensa')}
                className="v2-input"
                type="number"
                min={0}
                step="0.01"
                value={manualFinancials.perusmaksuYhteensa}
                onChange={(event) => {
                  markManualFieldTouched('perusmaksuYhteensa');
                  setManualFinancials((prev) => ({
                    ...prev,
                    perusmaksuYhteensa: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t('v2Overview.manualFinancialMaterials', 'Materials and services')}
              <input
                ref={setInlineCardFieldRef('aineetJaPalvelut')}
                className="v2-input"
                type="number"
                min={0}
                step="0.01"
                value={manualFinancials.aineetJaPalvelut}
                onChange={(event) => {
                  markManualFieldTouched('aineetJaPalvelut');
                  setManualFinancials((prev) => ({
                    ...prev,
                    aineetJaPalvelut: Number(event.target.value || 0),
                  }));
                }}
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
                onChange={(event) => {
                  markManualFieldTouched('henkilostokulut');
                  setManualFinancials((prev) => ({
                    ...prev,
                    henkilostokulut: Number(event.target.value || 0),
                  }));
                }}
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
                onChange={(event) => {
                  markManualFieldTouched('poistot');
                  setManualFinancials((prev) => ({
                    ...prev,
                    poistot: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t('v2Overview.manualFinancialOtherOpex', 'Other operating costs')}
              <input
                ref={setInlineCardFieldRef('liiketoiminnanMuutKulut')}
                className="v2-input"
                type="number"
                min={0}
                step="0.01"
                value={manualFinancials.liiketoiminnanMuutKulut}
                onChange={(event) => {
                  markManualFieldTouched('liiketoiminnanMuutKulut');
                  setManualFinancials((prev) => ({
                    ...prev,
                    liiketoiminnanMuutKulut: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t(
                'v2Overview.manualFinancialYearResult',
                'Year result (Tilikauden ylijÃ¤Ã¤mÃ¤/alijÃ¤Ã¤mÃ¤)',
              )}
              <input
                ref={setInlineCardFieldRef('tilikaudenYliJaama')}
                className="v2-input"
                type="number"
                step="0.01"
                value={manualFinancials.tilikaudenYliJaama}
                onChange={(event) => {
                  markManualFieldTouched('tilikaudenYliJaama');
                  setManualFinancials((prev) => ({
                    ...prev,
                    tilikaudenYliJaama: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)')}
              <input
                ref={setInlineCardFieldRef('waterUnitPrice')}
                className="v2-input"
                type="number"
                min={0}
                step="0.001"
                value={manualPrices.waterUnitPrice}
                onChange={(event) => {
                  markManualFieldTouched('waterUnitPrice');
                  setManualPrices((prev) => ({
                    ...prev,
                    waterUnitPrice: Number(event.target.value || 0),
                  }));
                }}
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
                onChange={(event) => {
                  markManualFieldTouched('wastewaterUnitPrice');
                  setManualPrices((prev) => ({
                    ...prev,
                    wastewaterUnitPrice: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
            <label>
              {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
              <input
                ref={setInlineCardFieldRef('soldWaterVolume')}
                className="v2-input"
                type="number"
                min={0}
                step="1"
                value={manualVolumes.soldWaterVolume}
                onChange={(event) => {
                  markManualFieldTouched('soldWaterVolume');
                  setManualVolumes((prev) => ({
                    ...prev,
                    soldWaterVolume: Number(event.target.value || 0),
                  }));
                }}
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
                onChange={(event) => {
                  markManualFieldTouched('soldWastewaterVolume');
                  setManualVolumes((prev) => ({
                    ...prev,
                    soldWastewaterVolume: Number(event.target.value || 0),
                  }));
                }}
              />
            </label>
          </div>
          <div className="v2-inline-card-editor-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={() => void saveInlineCardEdit(false)}
              disabled={manualPatchBusy || !isInlineCardDirty}
              title={
                !isInlineCardDirty
                  ? t(
                      'v2Overview.manualPatchNoChanges',
                      'No changes detected. Update at least one field before saving.',
                    )
                  : undefined
              }
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.manualPatchSave', 'Save year data')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => void saveInlineCardEdit(true)}
              disabled={manualPatchBusy || !isInlineCardDirty}
              title={
                !isInlineCardDirty
                  ? t(
                      'v2Overview.manualPatchNoChanges',
                      'No changes detected. Update at least one field before saving.',
                    )
                  : undefined
              }
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.manualPatchSaveAndSync', 'Save and sync year')}
            </button>
            <button
              type="button"
              className="v2-btn"
              onClick={closeInlineCardEditor}
              disabled={manualPatchBusy}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
