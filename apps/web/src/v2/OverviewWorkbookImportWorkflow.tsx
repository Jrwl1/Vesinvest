import React from 'react';
import type { TFunction } from 'i18next';
import type { V2WorkbookPreviewResponse } from '../api';

type WorkbookComparisonYear = {
    year: number;
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    rows: Array<{
    sourceField: V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'];
    label: string;
    differs: boolean;
    veetiValue: number | null;
    workbookValue: number | null;
    selection: 'keep_veeti' | 'apply_workbook';
  }>;
};

type Props = {
  t: TFunction;
  yearLabel: number | string;
  workbookImportBusy: boolean;
  manualPatchBusy: boolean;
  workbookFileInputRef: React.RefObject<HTMLInputElement>;
  workbookImportPreview: {
    document: { fileName: string };
  } | null;
  workbookImportStatus: string | null;
  workbookImportError: string | null;
  hasWorkbookImportPreviewValues: boolean;
  workbookImportComparisonYears: WorkbookComparisonYear[];
  sourceStatusLabel: (status: WorkbookComparisonYear['sourceStatus']) => string;
  setWorkbookSelection: (
    year: number,
    sourceField: V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
    action: 'keep_veeti' | 'apply_workbook',
  ) => void;
  submitWorkbookImport: (syncAfterSave: boolean) => Promise<void>;
  hasWorkbookApplySelections: boolean;
  formatEur: (value: number) => string;
};

export const OverviewWorkbookImportWorkflow: React.FC<Props> = ({
  t,
  yearLabel,
  workbookImportBusy,
  manualPatchBusy,
  workbookFileInputRef,
  workbookImportPreview,
  workbookImportStatus,
  workbookImportError,
  hasWorkbookImportPreviewValues,
  workbookImportComparisonYears,
  sourceStatusLabel,
  setWorkbookSelection,
  submitWorkbookImport,
  hasWorkbookApplySelections,
  formatEur,
}) => (
  <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
    <div className="v2-manual-section-head">
      <h4>
        {t(
          'v2Overview.workbookImportWorkflowTitle',
          'Import KVA workbook for year {{year}}',
          { year: yearLabel },
        )}
      </h4>
    </div>
    <p className="v2-muted">
      {t(
        'v2Overview.workbookImportWorkflowBody',
        'Upload one KVA workbook, review the matched years, and choose row by row whether to keep VEETI or apply workbook values before saving.',
      )}
    </p>
    <div className="v2-statement-import-actions">
      <button
        type="button"
        className="v2-btn v2-btn-small"
        onClick={() => workbookFileInputRef.current?.click()}
        disabled={workbookImportBusy || manualPatchBusy}
      >
        {t(
          workbookImportPreview
            ? 'v2Overview.workbookImportReplaceFile'
            : 'v2Overview.workbookImportUploadFile',
          workbookImportPreview ? 'Choose another workbook' : 'Upload KVA workbook',
        )}
      </button>
      {workbookImportPreview ? (
        <span className="v2-muted">{workbookImportPreview.document.fileName}</span>
      ) : null}
    </div>
    {workbookImportStatus ? <p className="v2-muted">{workbookImportStatus}</p> : null}
    {workbookImportError ? (
      <div className="v2-alert v2-alert-error">{workbookImportError}</div>
    ) : null}
    {workbookImportPreview && hasWorkbookImportPreviewValues ? (
      <section className="v2-manual-section v2-statement-import-diff-panel">
        <div className="v2-manual-section-head">
          <h4>
            {t(
              'v2Overview.workbookImportDiffTitle',
              'VEETI and workbook values by year',
            )}
          </h4>
        </div>
        {workbookImportComparisonYears.map((year) => (
          <div key={year.year} className="v2-manual-section">
            <div className="v2-manual-section-head">
              <h4>{year.year}</h4>
              <span className="v2-badge v2-status-provenance">
                {sourceStatusLabel(year.sourceStatus)}
              </span>
            </div>
            <div className="v2-statement-import-diff-table">
              <div className="v2-statement-import-diff-head">
                <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                <span>{t('v2Overview.workbookImportDiffWorkbook', 'Workbook')}</span>
                <span>{t('v2Overview.workbookImportChoice', 'Choice')}</span>
              </div>
              {year.rows.map((row) => (
                <div
                  key={`${year.year}-${row.sourceField}`}
                  data-testid={`workbook-compare-${year.year}-${row.sourceField}`}
                  className={`v2-statement-import-diff-row ${
                    row.differs ? 'v2-statement-import-diff-row-changed' : ''
                  }`}
                >
                  <span>
                    <strong>{row.label}</strong>
                  </span>
                  <span>
                    {row.veetiValue == null
                      ? t('v2Overview.previewMissingValue', 'Missing data')
                      : formatEur(row.veetiValue)}
                  </span>
                  <span>
                    {row.workbookValue == null
                      ? t('v2Overview.workbookImportMissingValue', 'Not found in workbook')
                      : formatEur(row.workbookValue)}
                  </span>
                  <span className="v2-actions-row">
                    <button
                      type="button"
                      className={`v2-btn v2-btn-small ${
                        row.selection === 'keep_veeti' ? 'v2-btn-primary' : ''
                      }`}
                      aria-pressed={row.selection === 'keep_veeti'}
                      onClick={() =>
                        setWorkbookSelection(year.year, row.sourceField, 'keep_veeti')
                      }
                    >
                      {t('v2Overview.workbookChoiceKeepVeeti', 'Keep VEETI')}
                    </button>
                    <button
                      type="button"
                      className={`v2-btn v2-btn-small ${
                        row.selection === 'apply_workbook' ? 'v2-btn-primary' : ''
                      }`}
                      aria-pressed={row.selection === 'apply_workbook'}
                      onClick={() =>
                        setWorkbookSelection(
                          year.year,
                          row.sourceField,
                          'apply_workbook',
                        )
                      }
                    >
                      {t('v2Overview.workbookChoiceApply', 'Apply workbook')}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    ) : (
      <p className="v2-muted v2-statement-import-placeholder">
        {t(
          'v2Overview.workbookImportAwaitingFile',
          'Upload the KVA workbook to populate the year-by-year comparison before saving any workbook choices.',
        )}
      </p>
    )}
    <div className="v2-inline-card-editor-actions">
      <button
        type="button"
        className="v2-btn"
        onClick={() => void submitWorkbookImport(false)}
        disabled={manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections}
      >
        {manualPatchBusy
          ? t('common.loading', 'Loading...')
          : t('v2Overview.workbookImportConfirm', 'Apply workbook choices')}
      </button>
      <button
        type="button"
        className="v2-btn v2-btn-primary"
        onClick={() => void submitWorkbookImport(true)}
        disabled={manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections}
      >
        {manualPatchBusy
          ? t('common.loading', 'Loading...')
          : t(
              'v2Overview.workbookImportConfirmAndSync',
              'Apply workbook choices and sync years',
            )}
      </button>
    </div>
  </section>
);
