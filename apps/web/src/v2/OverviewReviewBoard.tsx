import React from 'react';
import type { TFunction } from 'i18next';

import { formatEur } from './format';
import {
  OverviewQdisImportWorkflow,
  type Props as OverviewQdisImportWorkflowProps,
} from './OverviewQdisImportWorkflow';
import {
  OverviewWorkbookImportWorkflow,
  type Props as OverviewWorkbookImportWorkflowProps,
} from './OverviewWorkbookImportWorkflow';
import type {
  InlineCardField,
  ManualFinancialForm,
  ManualPriceForm,
  ManualVolumeForm,
} from './overviewManualForms';
import type { MissingRequirement, SetupYearStatus } from './overviewWorkflow';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';

type ReadinessState = {
  financials: boolean;
  prices: boolean;
  volumes: boolean;
};

type ReviewStatusRow = {
  year: number;
  sourceStatus: string | undefined;
  readinessChecks: Array<{
    key: keyof ReadinessState;
    ready: boolean;
  }>;
  missingRequirements: MissingRequirement[];
  warnings: string[];
  setupStatus: SetupYearStatus;
};

type RepairAction = {
  key: 'prices' | 'volumes';
  label: string;
  focusField: InlineCardField;
};

type StatementImportPreview = {
  fileName: string;
};

type StatementImportComparisonRow = {
  key: string;
  label: string;
  sourceLine?: string | null;
  veetiValue: number | null;
  pdfValue: number | null;
  currentValue: number | null;
  changedFromCurrent: boolean;
};

type OverviewReviewCardActionsProps = {
  t: TFunction;
  row: ReviewStatusRow;
  isInlineReviewActive: boolean;
  isAdmin: boolean;
  isCurrentYearReadyForReview: boolean;
  manualPatchBusy: boolean;
  statementImportBusy: boolean;
  workbookImportBusy: boolean;
  qdisImportBusy: boolean;
  isManualYearExcluded: boolean;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
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
  handleKeepCurrentYearValues: () => void;
  handleSwitchToManualEditMode: () => void;
  handleSwitchToStatementImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
  handleSwitchToQdisImportMode: () => void;
  handleRestoreManualYearToPlan: () => void;
  handleExcludeManualYearFromPlan: () => void;
  handleModalApplyVeetiFinancials: () => void;
  handleModalApplyVeetiPrices: () => void;
  handleModalApplyVeetiVolumes: () => void;
  closeInlineCardEditor: () => void;
};

const OverviewReviewCardActions: React.FC<OverviewReviewCardActionsProps> = ({
  t,
  row,
  isInlineReviewActive,
  isAdmin,
  isCurrentYearReadyForReview,
  manualPatchBusy,
  statementImportBusy,
  workbookImportBusy,
  qdisImportBusy,
  isManualYearExcluded,
  canReapplyFinancialVeetiForYear,
  canReapplyPricesForYear,
  canReapplyVolumesForYear,
  keepYearButtonClass,
  fixYearButtonClass,
  buildRepairActions,
  openInlineCardEditor,
  handleKeepCurrentYearValues,
  handleSwitchToManualEditMode,
  handleSwitchToStatementImportMode,
  handleSwitchToWorkbookImportMode,
  handleSwitchToQdisImportMode,
  handleRestoreManualYearToPlan,
  handleExcludeManualYearFromPlan,
  handleModalApplyVeetiFinancials,
  handleModalApplyVeetiPrices,
  handleModalApplyVeetiVolumes,
  closeInlineCardEditor,
}) => (
  <div className="v2-year-status-actions">
    {isInlineReviewActive ? (
      <>
        {isCurrentYearReadyForReview ? (
          <button
            type="button"
            className={keepYearButtonClass}
            onClick={handleKeepCurrentYearValues}
            disabled={manualPatchBusy || statementImportBusy}
          >
            {t('v2Overview.keepYearInPlan')}
          </button>
        ) : null}
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
          {t('v2Overview.statementImportAction', 'Import statement PDF')}
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
          onClick={handleSwitchToQdisImportMode}
          disabled={manualPatchBusy || qdisImportBusy}
        >
          {t('v2Overview.qdisImportAction', 'Import QDIS PDF')}
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
        {canReapplyFinancialVeetiForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiFinancials}
            disabled={manualPatchBusy || statementImportBusy}
          >
            {t('v2Overview.reapplyVeetiFinancials', 'Restore VEETI financials')}
          </button>
        ) : null}
        {canReapplyPricesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiPrices}
            disabled={manualPatchBusy || statementImportBusy}
          >
            {t('v2Overview.reapplyVeetiPrices', 'Restore VEETI prices')}
          </button>
        ) : null}
        {canReapplyVolumesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiVolumes}
            disabled={manualPatchBusy || statementImportBusy}
          >
            {t('v2Overview.reapplyVeetiVolumes', 'Restore VEETI volumes')}
          </button>
        ) : null}
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={closeInlineCardEditor}
          disabled={manualPatchBusy || statementImportBusy}
        >
          {t('common.close', 'Close')}
        </button>
      </>
    ) : (
      <>
        {isAdmin
          ? buildRepairActions(row.year, row.missingRequirements).map((action) => (
              <button
                key={`${row.year}-${action.key}`}
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() =>
                  void openInlineCardEditor(
                    row.year,
                    action.focusField,
                    'step3',
                    row.missingRequirements,
                    'manualEdit',
                  )
                }
              >
                {action.label}
              </button>
            ))
          : null}
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() =>
            void openInlineCardEditor(
              row.year,
              null,
              'step3',
              row.missingRequirements,
            )
          }
        >
          {row.setupStatus === 'ready_for_review' || row.setupStatus === 'reviewed'
            ? t('v2Overview.openReviewYearButton', 'Avaa ja tarkista')
            : t('v2Overview.yearDecisionAction')}
        </button>
      </>
    )}
  </div>
);

type OverviewReviewCardBodyProps = {
  t: TFunction;
  row: ReviewStatusRow;
  manualPatchMode: ManualPatchMode;
  manualPatchBusy: boolean;
  manualPatchError: string | null;
  statementImportBusy: boolean;
  statementImportStatus: string | null;
  statementImportPreview: StatementImportPreview | null;
  statementImportComparisonRows: StatementImportComparisonRow[];
  workbookImportBusy: boolean;
  qdisImportBusy: boolean;
  canConfirmImportWorkflow: boolean;
  statementFileInputRef: React.RefObject<HTMLInputElement | null>;
  setInlineCardFieldRef: (
    field: InlineCardField,
  ) => (element: HTMLInputElement | null) => void;
  manualFinancials: ManualFinancialForm;
  setManualFinancials: React.Dispatch<React.SetStateAction<ManualFinancialForm>>;
  manualPrices: ManualPriceForm;
  setManualPrices: React.Dispatch<React.SetStateAction<ManualPriceForm>>;
  manualVolumes: ManualVolumeForm;
  setManualVolumes: React.Dispatch<React.SetStateAction<ManualVolumeForm>>;
  missingRequirementLabel: (requirement: MissingRequirement) => string;
  saveInlineCardEdit: (syncAfterSave?: boolean) => Promise<void> | void;
  closeInlineCardEditor: () => void;
  workbookImportWorkflowProps: Omit<OverviewWorkbookImportWorkflowProps, 'yearLabel'>;
  qdisImportWorkflowProps: Omit<OverviewQdisImportWorkflowProps, 'yearLabel'>;
};

const OverviewReviewCardBody: React.FC<OverviewReviewCardBodyProps> = ({
  t,
  row,
  manualPatchMode,
  manualPatchBusy,
  manualPatchError,
  statementImportBusy,
  statementImportStatus,
  statementImportPreview,
  statementImportComparisonRows,
  workbookImportBusy,
  qdisImportBusy,
  canConfirmImportWorkflow,
  statementFileInputRef,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  missingRequirementLabel,
  saveInlineCardEdit,
  closeInlineCardEditor,
  workbookImportWorkflowProps,
  qdisImportWorkflowProps,
}) => {
  const isStatementImportMode = manualPatchMode === 'statementImport';
  const isWorkbookImportMode = manualPatchMode === 'workbookImport';
  const isQdisImportMode = manualPatchMode === 'qdisImport';

  return (
    <div className="v2-inline-card-editor">
      {manualPatchError ? (
        <div className="v2-alert v2-alert-error">{manualPatchError}</div>
      ) : null}
      {row.missingRequirements.length > 0 ? (
        <p className="v2-manual-required-note">
          {t(
            'v2Overview.manualPatchRequiredHint',
            'Required for sync readiness: {{requirements}}',
            {
              requirements: row.missingRequirements
                .map((item) => missingRequirementLabel(item))
                .join(', '),
            },
          )}
        </p>
      ) : null}

      {isStatementImportMode ? (
        <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.statementImportWorkflowTitle',
                'Import statement PDF for year {{year}}',
                { year: row.year },
              )}
            </h4>
          </div>
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
              <span className="v2-muted">{statementImportPreview.fileName}</span>
            ) : null}
          </div>
          {statementImportStatus ? (
            <p className="v2-muted">{statementImportStatus}</p>
          ) : null}
          {statementImportPreview ? (
            <section className="v2-manual-section v2-statement-import-diff-panel">
              <div className="v2-manual-section-head">
                <h4>
                  {t(
                    'v2Overview.statementImportDiffTitle',
                    'VEETI, PDF, and current values',
                  )}
                </h4>
              </div>
              {statementImportComparisonRows.length > 0 ? (
                <div className="v2-statement-import-diff-table">
                  <div className="v2-statement-import-diff-head">
                    <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                    <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                    <span>{t('v2Overview.statementImportDiffPdf', 'PDF')}</span>
                    <span>
                      {t('v2Overview.statementImportDiffCurrent', 'Current')}
                    </span>
                  </div>
                  {statementImportComparisonRows.map((diffRow) => (
                    <div
                      key={diffRow.key}
                      className={`v2-statement-import-diff-row ${
                        diffRow.changedFromCurrent
                          ? 'v2-statement-import-diff-row-changed'
                          : ''
                      }`}
                    >
                      <span>
                        <strong>{diffRow.label}</strong>
                        {diffRow.sourceLine ? (
                          <small className="v2-muted">{diffRow.sourceLine}</small>
                        ) : null}
                      </span>
                      <span>
                        {diffRow.veetiValue == null
                          ? t('v2Overview.previewMissingValue', 'Missing data')
                          : formatEur(diffRow.veetiValue)}
                      </span>
                      <span>
                        {diffRow.pdfValue == null
                          ? t('v2Overview.previewMissingValue', 'Missing data')
                          : formatEur(diffRow.pdfValue)}
                      </span>
                      <span>
                        {diffRow.currentValue == null
                          ? t('v2Overview.previewMissingValue', 'Missing data')
                          : formatEur(diffRow.currentValue)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : (
            <p className="v2-muted v2-statement-import-placeholder">
              {t(
                'v2Overview.statementImportAwaitingFile',
                'Upload the statement PDF to populate the OCR comparison before confirming the import.',
              )}
            </p>
          )}
          <div className="v2-inline-card-editor-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={() => void saveInlineCardEdit(false)}
              disabled={
                manualPatchBusy || statementImportBusy || !canConfirmImportWorkflow
              }
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.statementImportConfirm', 'Confirm statement import')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => void saveInlineCardEdit(true)}
              disabled={
                manualPatchBusy ||
                statementImportBusy ||
                qdisImportBusy ||
                !canConfirmImportWorkflow
              }
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t(
                    'v2Overview.statementImportConfirmAndSync',
                    'Confirm import and sync year',
                  )}
            </button>
            <button
              type="button"
              className="v2-btn"
              onClick={closeInlineCardEditor}
              disabled={manualPatchBusy || statementImportBusy || qdisImportBusy}
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
      {isQdisImportMode ? (
        <OverviewQdisImportWorkflow
          {...qdisImportWorkflowProps}
          yearLabel={row.year}
        />
      ) : null}

      {manualPatchMode === 'manualEdit' ? (
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
                onChange={(event) =>
                  setManualFinancials((prev) => ({
                    ...prev,
                    liikevaihto: Number(event.target.value || 0),
                  }))
                }
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
          <div className="v2-inline-card-editor-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={() => void saveInlineCardEdit(false)}
              disabled={manualPatchBusy}
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.manualPatchSave', 'Save year data')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => void saveInlineCardEdit(true)}
              disabled={manualPatchBusy}
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

type Props = {
  t: TFunction;
  wizardBackLabel: string | null;
  onBack: () => void;
  reviewStatusRows: ReviewStatusRow[];
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
  missingRequirementLabel: (requirement: MissingRequirement) => string;
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
  manualPatchMode: ManualPatchMode;
  manualPatchBusy: boolean;
  manualPatchError: string | null;
  isCurrentYearReadyForReview: boolean;
  isManualYearExcluded: boolean;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
  handleKeepCurrentYearValues: () => void;
  handleSwitchToManualEditMode: () => void;
  handleSwitchToStatementImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
  handleSwitchToQdisImportMode: () => void;
  handleRestoreManualYearToPlan: () => void;
  handleExcludeManualYearFromPlan: () => void;
  handleModalApplyVeetiFinancials: () => void;
  handleModalApplyVeetiPrices: () => void;
  handleModalApplyVeetiVolumes: () => void;
  closeInlineCardEditor: () => void;
  statementImportBusy: boolean;
  statementImportStatus: string | null;
  statementImportPreview: StatementImportPreview | null;
  statementImportComparisonRows: StatementImportComparisonRow[];
  workbookImportBusy: boolean;
  qdisImportBusy: boolean;
  canConfirmImportWorkflow: boolean;
  statementFileInputRef: React.RefObject<HTMLInputElement | null>;
  setInlineCardFieldRef: (
    field: InlineCardField,
  ) => (element: HTMLInputElement | null) => void;
  manualFinancials: ManualFinancialForm;
  setManualFinancials: React.Dispatch<React.SetStateAction<ManualFinancialForm>>;
  manualPrices: ManualPriceForm;
  setManualPrices: React.Dispatch<React.SetStateAction<ManualPriceForm>>;
  manualVolumes: ManualVolumeForm;
  setManualVolumes: React.Dispatch<React.SetStateAction<ManualVolumeForm>>;
  saveInlineCardEdit: (syncAfterSave?: boolean) => Promise<void> | void;
  workbookImportWorkflowProps: Omit<OverviewWorkbookImportWorkflowProps, 'yearLabel'>;
  qdisImportWorkflowProps: Omit<OverviewQdisImportWorkflowProps, 'yearLabel'>;
  reviewContinueButtonClass: string;
  onContinueFromReview: () => void;
  importedBlockedYearCount: number;
  pendingReviewYearCount: number;
  technicalReadyYearsLabel: string;
};

export const OverviewReviewBoard: React.FC<Props> = ({
  t,
  reviewStatusRows,
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
  manualPatchMode,
  manualPatchBusy,
  manualPatchError,
  isCurrentYearReadyForReview,
  isManualYearExcluded,
  canReapplyFinancialVeetiForYear,
  canReapplyPricesForYear,
  canReapplyVolumesForYear,
  keepYearButtonClass,
  fixYearButtonClass,
  handleKeepCurrentYearValues,
  handleSwitchToManualEditMode,
  handleSwitchToStatementImportMode,
  handleSwitchToWorkbookImportMode,
  handleSwitchToQdisImportMode,
  handleRestoreManualYearToPlan,
  handleExcludeManualYearFromPlan,
  handleModalApplyVeetiFinancials,
  handleModalApplyVeetiPrices,
  handleModalApplyVeetiVolumes,
  closeInlineCardEditor,
  statementImportBusy,
  statementImportStatus,
  statementImportPreview,
  statementImportComparisonRows,
  workbookImportBusy,
  qdisImportBusy,
  canConfirmImportWorkflow,
  statementFileInputRef,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  saveInlineCardEdit,
  workbookImportWorkflowProps,
  qdisImportWorkflowProps,
  reviewContinueButtonClass,
  onContinueFromReview,
  importedBlockedYearCount,
  pendingReviewYearCount,
  technicalReadyYearsLabel,
}) => (
  <section className="v2-card">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', { step: 3 })}
        </p>
        <h2>{t('v2Overview.wizardQuestionReviewYears')}</h2>
      </div>
      <span className="v2-badge v2-status-provenance">
        {t('v2Overview.reviewYearsCount', { count: reviewStatusRows.length })}
      </span>
    </div>

    <p className="v2-muted v2-overview-review-body">
      {t('v2Overview.wizardBodyReviewYears')}
    </p>

    {reviewStatusRows.length === 0 ? (
      <div className="v2-empty-state">
        <p>{t('v2Overview.reviewYearsEmpty')}</p>
      </div>
    ) : (
      <div className="v2-year-status-list">
        {reviewStatusRows.map((row) => {
          const readiness: ReadinessState = {
            financials:
              row.readinessChecks.find((check) => check.key === 'financials')
                ?.ready === true,
            prices:
              row.readinessChecks.find((check) => check.key === 'prices')
                ?.ready === true,
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
              ? t(
                  'v2Overview.setupStatusReviewedHint',
                  'Tämä vuosi on tarkistettu ja hyväksytty mukaan suunnittelupohjaan.',
                )
              : row.setupStatus === 'ready_for_review'
              ? t(
                  'v2Overview.setupStatusTechnicalReadyHint',
                  'Vuosi näyttää valmiilta. Tarkista vertailu ja hyväksy vuosi suunnittelupohjaan.',
                )
              : t('v2Overview.setupStatusNeedsAttentionHint', {
                  requirements:
                    row.missingRequirements.length > 0
                      ? row.missingRequirements
                          .map((item) => missingRequirementLabel(item))
                          .join(', ')
                      : t('v2Overview.setupStatusNeedsAttention'),
                });

          return (
            <article
              key={row.year}
              className={`v2-year-status-row ${yearStatusRowClassName(
                row.setupStatus,
              )}`}
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
                statementImportBusy={statementImportBusy}
                workbookImportBusy={workbookImportBusy}
                qdisImportBusy={qdisImportBusy}
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
                handleSwitchToStatementImportMode={handleSwitchToStatementImportMode}
                handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
                handleSwitchToQdisImportMode={handleSwitchToQdisImportMode}
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
                  statementImportBusy={statementImportBusy}
                  statementImportStatus={statementImportStatus}
                  statementImportPreview={statementImportPreview}
                  statementImportComparisonRows={statementImportComparisonRows}
                  workbookImportBusy={workbookImportBusy}
                  qdisImportBusy={qdisImportBusy}
                  canConfirmImportWorkflow={canConfirmImportWorkflow}
                  statementFileInputRef={statementFileInputRef}
                  setInlineCardFieldRef={setInlineCardFieldRef}
                  manualFinancials={manualFinancials}
                  setManualFinancials={setManualFinancials}
                  manualPrices={manualPrices}
                  setManualPrices={setManualPrices}
                  manualVolumes={manualVolumes}
                  setManualVolumes={setManualVolumes}
                  missingRequirementLabel={missingRequirementLabel}
                  saveInlineCardEdit={saveInlineCardEdit}
                  closeInlineCardEditor={closeInlineCardEditor}
                  workbookImportWorkflowProps={workbookImportWorkflowProps}
                  qdisImportWorkflowProps={qdisImportWorkflowProps}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    )}

    <div className="v2-overview-review-actions">
      <button
        type="button"
        className={reviewContinueButtonClass}
        onClick={onContinueFromReview}
        disabled={reviewStatusRows.length === 0}
      >
        {t('v2Overview.reviewContinue')}
      </button>
      <p className="v2-muted">
        {importedBlockedYearCount > 0
          ? t('v2Overview.reviewContinueBlockedHint')
          : pendingReviewYearCount > 0
          ? t(
              'v2Overview.reviewContinueTechnicalReadyBody',
              'Nämä vuodet odottavat vielä tarkistusta ja hyväksyntää: {{years}}.',
              { years: technicalReadyYearsLabel },
            )
          : t('v2Overview.reviewContinueReadyBody')}
      </p>
    </div>
  </section>
);
