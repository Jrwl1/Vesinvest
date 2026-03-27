import React from 'react';
import type { TFunction } from 'i18next';

type QdisComparisonRow = {
  key: string;
  label: string;
  changedFromCurrent: boolean;
  veetiValue: number | null;
  pdfValue: number | null;
  currentValue: number;
};

export type Props = {
  t: TFunction;
  yearLabel: number | string;
  qdisImportBusy: boolean;
  manualPatchBusy: boolean;
  qdisFileInputRef: React.RefObject<HTMLInputElement>;
  qdisImportPreview: { fileName: string; warnings: string[] } | null;
  qdisImportStatus: string | null;
  qdisImportError: string | null;
  qdisImportComparisonRows: QdisComparisonRow[];
  formatPrice: (value: number) => string;
  formatNumber: (value: number) => string;
};

export const OverviewQdisImportWorkflow: React.FC<Props> = ({
  t,
  yearLabel,
  qdisImportBusy,
  manualPatchBusy,
  qdisFileInputRef,
  qdisImportPreview,
  qdisImportStatus,
  qdisImportError,
  qdisImportComparisonRows,
  formatPrice,
  formatNumber,
}) => (
  <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
    <div className="v2-manual-section-head">
      <h4>
        {t(
          'v2Overview.qdisImportWorkflowTitle',
          'Import QDIS PDF for year {{year}}',
          { year: yearLabel },
        )}
      </h4>
    </div>
    <p className="v2-muted">
      {t(
        'v2Overview.qdisImportWorkflowBody',
        'Upload the QDIS PDF, review the detected prices and sold volumes, and confirm them into the year patch flow.',
      )}
    </p>
    <div className="v2-statement-import-actions">
      <button
        type="button"
        className="v2-btn v2-btn-small"
        onClick={() => qdisFileInputRef.current?.click()}
        disabled={qdisImportBusy || manualPatchBusy}
      >
        {t(
          qdisImportPreview
            ? 'v2Overview.qdisImportReplaceFile'
            : 'v2Overview.qdisImportUploadFile',
          qdisImportPreview ? 'Choose another QDIS PDF' : 'Upload QDIS PDF',
        )}
      </button>
      {qdisImportPreview ? (
        <span className="v2-muted">{qdisImportPreview.fileName}</span>
      ) : null}
    </div>
    {qdisImportStatus ? <p className="v2-muted">{qdisImportStatus}</p> : null}
    {qdisImportError ? (
      <div className="v2-alert v2-alert-error">{qdisImportError}</div>
    ) : null}
    {qdisImportPreview ? (
      <section className="v2-manual-section v2-statement-import-diff-panel">
        <div className="v2-manual-section-head">
          <h4>
            {t(
              'v2Overview.qdisImportDiffTitle',
              'VEETI, QDIS PDF, and current values',
            )}
          </h4>
        </div>
        {qdisImportComparisonRows.length > 0 ? (
          <div className="v2-statement-import-diff-table">
            <div className="v2-statement-import-diff-head">
              <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
              <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
              <span>{t('v2Overview.qdisImportDiffPdf', 'QDIS PDF')}</span>
              <span>{t('v2Overview.statementImportDiffCurrent', 'Current')}</span>
            </div>
            {qdisImportComparisonRows.map((row) => (
              <div
                key={row.key}
                className={`v2-statement-import-diff-row ${
                  row.changedFromCurrent ? 'v2-statement-import-diff-row-changed' : ''
                }`}
              >
                <span>
                  <strong>{row.label}</strong>
                </span>
                <span>
                  {row.veetiValue == null
                    ? t('v2Overview.previewMissingValue', 'Missing data')
                    : row.key.includes('Price')
                    ? formatPrice(row.veetiValue)
                    : `${formatNumber(row.veetiValue)} m3`}
                </span>
                <span>
                  {row.pdfValue == null
                    ? t('v2Overview.previewMissingValue', 'Missing data')
                    : row.key.includes('Price')
                    ? formatPrice(row.pdfValue)
                    : `${formatNumber(row.pdfValue)} m3`}
                </span>
                <span>
                  {row.key.includes('Price')
                    ? formatPrice(row.currentValue)
                    : `${formatNumber(row.currentValue)} m3`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="v2-muted">
            {t(
              'v2Overview.qdisImportNoMappedValues',
              'QDIS PDF import did not detect prices or sold volumes yet. Upload another PDF before confirming the import.',
            )}
          </p>
        )}
        {qdisImportPreview.warnings.length > 0 ? (
          <div className="v2-statement-import-warnings">
            {qdisImportPreview.warnings.map((warning) => (
              <p key={warning} className="v2-muted">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    ) : (
      <p className="v2-muted v2-statement-import-placeholder">
        {t(
          'v2Overview.qdisImportAwaitingFile',
          'Upload the QDIS PDF to populate the price and volume comparison before confirming the import.',
        )}
      </p>
    )}
  </section>
);
