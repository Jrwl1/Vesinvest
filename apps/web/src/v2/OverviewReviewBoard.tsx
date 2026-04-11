import React from 'react';
import type { TFunction } from 'i18next';

import { DocumentImportPreviewDetails } from './DocumentImportPreviewDetails';
import { OverviewYearWorkspace } from './OverviewYearWorkspace';
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
import {
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  type MissingRequirement,
  type SetupYearStatus,
} from './overviewWorkflow';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import {
  getDocumentImportSelectedPageNumbers,
  type DocumentImportPreview,
} from './documentPdfImport';

type ReadinessState = {
  financials: boolean;
  prices: boolean;
  tariffRevenue: boolean;
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

type ReviewBucketKey =
  | 'good_to_go'
  | 'needs_filling'
  | 'almost_nothing'
  | 'excluded';

type RepairAction = {
  key: 'prices' | 'volumes' | 'tariffRevenue';
  label: string;
  focusField: InlineCardField;
};

type OverviewReviewCardActionsProps = {
  t: TFunction;
  row: ReviewStatusRow;
  isInlineReviewActive: boolean;
  isAdmin: boolean;
  isCurrentYearReadyForReview: boolean;
  manualPatchBusy: boolean;
  documentImportBusy: boolean;
  workbookImportBusy: boolean;
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
  handleSwitchToDocumentImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
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
  documentImportBusy,
  workbookImportBusy,
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
  handleSwitchToDocumentImportMode,
  handleSwitchToWorkbookImportMode,
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
        {canReapplyFinancialVeetiForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiFinancials}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiFinancials', 'Restore VEETI financials')}
          </button>
        ) : null}
        {canReapplyPricesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiPrices}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiPrices', 'Restore VEETI prices')}
          </button>
        ) : null}
        {canReapplyVolumesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiVolumes}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiVolumes', 'Restore VEETI volumes')}
          </button>
        ) : null}
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={closeInlineCardEditor}
          disabled={manualPatchBusy}
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
};

const OverviewReviewCardBody: React.FC<OverviewReviewCardBodyProps> = ({
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
              missingValueLabel={t(
                'v2Overview.previewMissingValue',
                'Missing data',
              )}
              reviewedKeys={documentImportReviewedKeys}
              onSelectMatch={handleSelectDocumentImportMatch}
            />
          ) : null}
          {documentImportPreview?.warnings.length ? (
            <p className="v2-muted">
              {documentImportPreview.warnings.join(' ')}
            </p>
          ) : null}
          <div className="v2-inline-card-editor-actions">
            <button
              type="button"
              className="v2-btn"
              onClick={() => void saveInlineCardEdit(false)}
              disabled={
                manualPatchBusy || documentImportBusy || !canConfirmImportWorkflow
              }
            >
              {manualPatchBusy
                ? t('common.loading', 'Loading...')
                : t('v2Overview.documentImportConfirm', 'Confirm source PDF')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={() => void saveInlineCardEdit(true)}
              disabled={
                manualPatchBusy || documentImportBusy || !canConfirmImportWorkflow
              }
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
  workflowStep?: number;
  wizardBackLabel: string | null;
  onBack: () => void;
  reviewStatusRows: ReviewStatusRow[];
  yearDataCache: Record<number, V2ImportYearDataResponse>;
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
  saveReviewWorkspaceYear: (params: {
    year: number;
    financials: ManualFinancialForm;
    prices: ManualPriceForm;
    volumes: ManualVolumeForm;
    syncAfterSave?: boolean;
  }) => Promise<{ yearData: V2ImportYearDataResponse }>;
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
  isCurrentYearReadyForReview: boolean;
  isManualYearExcluded: boolean;
  canReapplyFinancialVeetiForYear: boolean;
  canReapplyPricesForYear: boolean;
  canReapplyVolumesForYear: boolean;
  keepYearButtonClass: string;
  fixYearButtonClass: string;
  handleKeepCurrentYearValues: () => void;
  handleSwitchToManualEditMode: () => void;
  handleSwitchToDocumentImportMode: () => void;
  handleSwitchToWorkbookImportMode: () => void;
  handleRestoreManualYearToPlan: () => void;
  handleExcludeManualYearFromPlan: () => void;
  handleModalApplyVeetiFinancials: () => void;
  handleModalApplyVeetiPrices: () => void;
  handleModalApplyVeetiVolumes: () => void;
  closeInlineCardEditor: () => void;
  workbookImportBusy: boolean;
  canConfirmImportWorkflow: boolean;
  documentFileInputRef: React.RefObject<HTMLInputElement | null>;
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
  reviewContinueButtonClass: string;
  onContinueFromReview: () => void;
  importedBlockedYearCount: number;
  pendingReviewYearCount: number;
  technicalReadyYearsLabel: string;
};

function sameYearOrder(left: number[], right: number[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

function buildDefaultPinnedYears(reviewStatusRows: ReviewStatusRow[]): number[] {
  const preferredBuckets: ReviewBucketKey[] = [
    'good_to_go',
    'needs_filling',
    'almost_nothing',
    'excluded',
  ];
  const orderedYears = preferredBuckets.flatMap((bucket) =>
    reviewStatusRows
      .filter((row) => getReviewBucket(row) === bucket)
      .map((row) => row.year),
  );
  return orderedYears.slice(0, 3);
}

function getReviewBucket(row: ReviewStatusRow): ReviewBucketKey {
  if (row.setupStatus === 'excluded_from_plan') {
    return 'excluded';
  }
  if (row.setupStatus === 'reviewed' || row.setupStatus === 'ready_for_review') {
    return 'good_to_go';
  }
  const readyCount = row.readinessChecks.filter((check) => check.ready).length;
  return readyCount <= 1 ? 'almost_nothing' : 'needs_filling';
}

function getReviewBucketLabel(t: TFunction, bucket: ReviewBucketKey): string {
  switch (bucket) {
    case 'good_to_go':
      return t('v2Overview.reviewBucketReadyTitle', 'Good to go');
    case 'needs_filling':
      return t('v2Overview.reviewBucketRepairTitle', 'Needs filling');
    case 'almost_nothing':
      return t('v2Overview.reviewBucketSparseTitle', 'Almost nothing here');
    case 'excluded':
      return t('v2Overview.reviewBucketExcludedTitle', 'Excluded');
    default:
      return bucket;
  }
}

function renderDocumentImportPageValue(preview: DocumentImportPreview): string {
  const selectedPageNumbers = getDocumentImportSelectedPageNumbers(preview);
  if (selectedPageNumbers.length > 0) {
    return selectedPageNumbers.join(', ');
  }
  return preview.pageNumber != null ? String(preview.pageNumber) : '-';
}

export const OverviewReviewBoard: React.FC<Props> = ({
  t,
  workflowStep = 3,
  reviewStatusRows,
  yearDataCache,
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
  saveReviewWorkspaceYear,
  manualPatchMode,
  manualPatchBusy,
  manualPatchError,
  documentImportBusy,
  documentImportStatus,
  documentImportError,
  documentImportPreview,
  documentImportReviewedKeys,
  handleSelectDocumentImportMatch,
  isCurrentYearReadyForReview,
  isManualYearExcluded,
  canReapplyFinancialVeetiForYear,
  canReapplyPricesForYear,
  canReapplyVolumesForYear,
  keepYearButtonClass,
  fixYearButtonClass,
  handleKeepCurrentYearValues,
  handleSwitchToManualEditMode,
  handleSwitchToDocumentImportMode,
  handleSwitchToWorkbookImportMode,
  handleRestoreManualYearToPlan,
  handleExcludeManualYearFromPlan,
  handleModalApplyVeetiFinancials,
  handleModalApplyVeetiPrices,
  handleModalApplyVeetiVolumes,
  closeInlineCardEditor,
  workbookImportBusy,
  canConfirmImportWorkflow,
  documentFileInputRef,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  saveInlineCardEdit,
  workbookImportWorkflowProps,
  reviewContinueButtonClass,
  onContinueFromReview,
  importedBlockedYearCount,
  pendingReviewYearCount,
  technicalReadyYearsLabel,
}) => {
  const defaultPinnedYears = React.useMemo(
    () => buildDefaultPinnedYears(reviewStatusRows),
    [reviewStatusRows],
  );
  const availableYearsKey = React.useMemo(
    () => reviewStatusRows.map((row) => row.year).join(','),
    [reviewStatusRows],
  );
  const previousAvailableYearsKeyRef = React.useRef<string>('');
  const allowEmptyPinnedYearsRef = React.useRef(false);
  const [pinnedYears, setPinnedYears] = React.useState<number[]>([]);
  const groupedRows = React.useMemo(
    () =>
      (['good_to_go', 'needs_filling', 'almost_nothing', 'excluded'] as const)
        .map((bucket) => ({
          bucket,
          rows: reviewStatusRows.filter((row) => getReviewBucket(row) === bucket),
        }))
        .filter((group) => group.rows.length > 0),
    [reviewStatusRows],
  );

  React.useEffect(() => {
    const availableYears = new Set(reviewStatusRows.map((row) => row.year));
    const availableYearsChanged = previousAvailableYearsKeyRef.current !== availableYearsKey;

    setPinnedYears((prev) => {
      let next = prev.filter((year) => availableYears.has(year));

      if (
        manualPatchYear != null &&
        availableYears.has(manualPatchYear) &&
        !next.includes(manualPatchYear)
      ) {
        next = [...next, manualPatchYear];
        allowEmptyPinnedYearsRef.current = false;
      }

      if (
        next.length === 0 &&
        reviewStatusRows.length > 0 &&
        (!allowEmptyPinnedYearsRef.current || availableYearsChanged)
      ) {
        next = defaultPinnedYears;
        allowEmptyPinnedYearsRef.current = false;
      }

      return sameYearOrder(prev, next) ? prev : next;
    });

    previousAvailableYearsKeyRef.current = availableYearsKey;
  }, [availableYearsKey, defaultPinnedYears, manualPatchYear, reviewStatusRows]);

  const handleTogglePinnedYear = React.useCallback((year: number) => {
    setPinnedYears((prev) => {
      const next = prev.includes(year)
        ? prev.filter((currentYear) => currentYear !== year)
        : [...prev, year];
      allowEmptyPinnedYearsRef.current = next.length === 0;
      return next;
    });
  }, []);

  return (
    <section className="v2-card">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', {
            step: workflowStep,
            total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
          })}
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

    {groupedRows.length > 0 ? (
      <div className="v2-overview-review-groups">
        {groupedRows.map((group) => (
          <article
            key={group.bucket}
            className={`v2-subcard v2-overview-review-group ${group.bucket}`}
            data-review-group={group.bucket}
          >
            <div className="v2-section-header">
              <div>
                <p className="v2-overview-eyebrow">
                  {getReviewBucketLabel(t, group.bucket)}
                </p>
                <h3>
                  {t('v2Overview.reviewYearsCount', { count: group.rows.length })}
                </h3>
              </div>
              <span className="v2-badge v2-status-info">
                {group.rows.map((row) => row.year).join(', ')}
              </span>
            </div>
            <div className="v2-overview-review-group-years">
              {group.rows.map((row) => (
                <button
                  key={`${group.bucket}-${row.year}`}
                  type="button"
                  className={`v2-chip ${
                    pinnedYears.includes(row.year) ? 'ok' : ''
                  }`}
                  data-review-group-year={`${group.bucket}-${row.year}`}
                  aria-pressed={pinnedYears.includes(row.year)}
                  onClick={() => handleTogglePinnedYear(row.year)}
                >
                  {row.year}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    ) : null}

    <OverviewYearWorkspace
      t={t}
      reviewStatusRows={reviewStatusRows}
      pinnedYears={pinnedYears}
      onTogglePinnedYear={handleTogglePinnedYear}
      yearDataCache={yearDataCache}
      sourceStatusClassName={sourceStatusClassName}
      sourceStatusLabel={sourceStatusLabel}
      missingRequirementLabel={missingRequirementLabel}
      openInlineCardEditor={openInlineCardEditor}
      saveYear={saveReviewWorkspaceYear}
      busy={
        manualPatchBusy || documentImportBusy || workbookImportBusy
      }
    />

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
            tariffRevenue:
              row.readinessChecks.find(
                (check) => check.key === 'tariffRevenue',
              )?.ready === true,
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
                documentImportBusy={documentImportBusy}
                workbookImportBusy={workbookImportBusy}
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
                handleSwitchToDocumentImportMode={handleSwitchToDocumentImportMode}
                handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
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
                  documentImportBusy={documentImportBusy}
                  documentImportStatus={documentImportStatus}
                  documentImportError={documentImportError}
                  documentImportPreview={documentImportPreview}
                  documentImportReviewedKeys={documentImportReviewedKeys}
                  handleSelectDocumentImportMatch={handleSelectDocumentImportMatch}
                  currentYearData={yearDataCache[row.year]}
                  documentFileInputRef={documentFileInputRef}
                  workbookImportBusy={workbookImportBusy}
                  canConfirmImportWorkflow={canConfirmImportWorkflow}
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
};
