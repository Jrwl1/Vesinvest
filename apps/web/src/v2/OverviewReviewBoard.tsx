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
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
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

function getReviewMissingRequirementLabel(
  t: TFunction,
  fallbackLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string,
  requirement: MissingRequirement,
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null,
): string {
  if (requirement === 'tariffRevenue') {
    return fallbackLabel(requirement, { tariffRevenueReason });
  }
  return fallbackLabel(requirement);
}

function getReviewRepairActionLabel(t: TFunction, action: RepairAction): string {
  if (action.key === 'prices') {
    return t('v2Overview.repairPricesButton');
  }
  if (action.key === 'volumes') {
    return t('v2Overview.repairVolumesButton');
  }
  return t('v2Overview.manualFinancialFixedRevenue');
}

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
            {t('v2Overview.reapplyVeetiFinancials')}
          </button>
        ) : null}
        {canReapplyPricesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiPrices}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiPrices')}
          </button>
        ) : null}
        {canReapplyVolumesForYear ? (
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={handleModalApplyVeetiVolumes}
            disabled={manualPatchBusy}
          >
            {t('v2Overview.reapplyVeetiVolumes')}
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
          {t('v2Overview.openReviewYearButton')}
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
          {t(
            'v2Overview.manualPatchRequiredHint',
            {
              requirements: row.missingRequirements
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
                'Year result (Tilikauden ylijäämä/alijäämä)',
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
  missingRequirementLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string;
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
    explicitMissing?: {
      financials: boolean;
      prices: boolean;
      volumes: boolean;
    };
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
  isInlineCardDirty: boolean;
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
  markManualFieldTouched: (field: InlineCardField) => void;
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

function resolvePrimaryReviewYear(
  reviewStatusRows: ReviewStatusRow[],
): number | null {
  return (
    reviewStatusRows.find((row) => row.setupStatus === 'needs_attention')?.year ??
    reviewStatusRows.find((row) => row.setupStatus === 'ready_for_review')?.year ??
    reviewStatusRows.find((row) => row.setupStatus === 'reviewed')?.year ??
    reviewStatusRows.find((row) => row.setupStatus === 'excluded_from_plan')?.year ??
    null
  );
}

function buildDefaultPinnedYears(reviewStatusRows: ReviewStatusRow[]): number[] {
  const primaryYear = resolvePrimaryReviewYear(reviewStatusRows);
  return primaryYear == null ? [] : [primaryYear];
}

function getReviewBucket(row: ReviewStatusRow): ReviewBucketKey {
  if (row.setupStatus === 'excluded_from_plan') {
    return 'excluded';
  }
  if (row.setupStatus === 'reviewed' || row.setupStatus === 'ready_for_review') {
    return 'good_to_go';
  }
  const readyCount = row.readinessChecks.filter((check) => check.ready).length;
  const missing = new Set(row.missingRequirements);
  const isStructurallySparse =
    readyCount <= 1 ||
    missing.has('financials') ||
    (missing.has('prices') && missing.has('volumes'));
  return isStructurallySparse ? 'almost_nothing' : 'needs_filling';
}

function getReviewBucketLabel(t: TFunction, bucket: ReviewBucketKey): string {
  switch (bucket) {
    case 'good_to_go':
      return t('v2Overview.reviewBucketReadyTitle');
    case 'needs_filling':
      return t('v2Overview.reviewBucketRepairTitle');
    case 'almost_nothing':
      return t('v2Overview.blockedYearsTitle');
    case 'excluded':
      return t('v2Overview.reviewBucketExcludedTitle');
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
  isInlineCardDirty,
  documentFileInputRef,
  setInlineCardFieldRef,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  markManualFieldTouched,
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
  const explicitMultiSelectRef = React.useRef(false);
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
  const pinnedReviewRows = React.useMemo(
    () => reviewStatusRows.filter((row) => pinnedYears.includes(row.year)),
    [pinnedYears, reviewStatusRows],
  );
  const includedPlanningYearCount = React.useMemo(
    () => reviewStatusRows.filter((row) => row.setupStatus === 'reviewed').length,
    [reviewStatusRows],
  );
  const actionableReviewRowCount = React.useMemo(
    () =>
      reviewStatusRows.filter(
        (row) => row.setupStatus !== 'excluded_from_plan',
      ).length,
    [reviewStatusRows],
  );
  const baselineGateReady =
    includedPlanningYearCount > 0 &&
    importedBlockedYearCount === 0 &&
    pendingReviewYearCount === 0;
  const baselineGatePendingReview =
    includedPlanningYearCount > 0 &&
    importedBlockedYearCount === 0 &&
    pendingReviewYearCount > 0;
  const baselineGateStatusLabel = baselineGateReady
    ? t('v2Overview.wizardSummaryYes')
    : t('v2Overview.wizardSummaryNo');
  const baselineGatePrimaryDetail = baselineGateReady
    ? t('v2Overview.baselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const baselineGateSecondaryDetail =
    importedBlockedYearCount > 0
      ? t('v2Overview.reviewContinueBlockedHint')
      : baselineGatePendingReview
      ? t('v2Overview.reviewContinueTechnicalReadyBody', {
          years: technicalReadyYearsLabel,
        })
      : actionableReviewRowCount === 0
      ? t('v2Overview.noYearsSelected', 'None selected')
      : t('v2Overview.reviewContinueReadyBody');
  const nextReviewFocusYear = React.useMemo(
    () => resolvePrimaryReviewYear(reviewStatusRows),
    [reviewStatusRows],
  );
  const reviewActionsTitle = baselineGateReady
    ? t('v2Overview.baselineClosureTitle')
    : t('v2Overview.wizardContextReviewQueue');
  const visibleMissingRequirementLabel = React.useCallback(
    (
      requirement: MissingRequirement,
      options?: {
        tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      },
    ) =>
      getReviewMissingRequirementLabel(
        t,
        missingRequirementLabel,
        requirement,
        options?.tariffRevenueReason,
      ),
    [missingRequirementLabel, t],
  );
  const activeReviewYearCount = reviewStatusRows.filter(
    (row) => row.setupStatus !== 'excluded_from_plan',
  ).length;

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
        next = explicitMultiSelectRef.current ? [...next, manualPatchYear] : [manualPatchYear];
        allowEmptyPinnedYearsRef.current = false;
      }

      if (
        next.length === 0 &&
        reviewStatusRows.length > 0 &&
        (!allowEmptyPinnedYearsRef.current || availableYearsChanged)
      ) {
        next = defaultPinnedYears;
        allowEmptyPinnedYearsRef.current = false;
        explicitMultiSelectRef.current = false;
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
      explicitMultiSelectRef.current = next.length > 1;
      return next;
    });
  }, []);

  const handleFocusPinnedYear = React.useCallback((year: number) => {
    allowEmptyPinnedYearsRef.current = false;
    explicitMultiSelectRef.current = false;
    setPinnedYears((prev) => (sameYearOrder(prev, [year]) ? prev : [year]));
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
        {t('v2Overview.reviewYearsCount', { count: activeReviewYearCount })}
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
                  onClick={() => handleFocusPinnedYear(row.year)}
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
      missingRequirementLabel={visibleMissingRequirementLabel}
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
    ) : pinnedReviewRows.length > 0 ? (
      <div className="v2-year-status-list">
        {pinnedReviewRows.map((row) => {
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
              ? t('v2Overview.setupStatusReviewedHint')
              : row.setupStatus === 'ready_for_review'
              ? t('v2Overview.setupStatusTechnicalReadyHint')
              : t('v2Overview.setupStatusNeedsAttentionHint', {
                  requirements:
                    row.missingRequirements.length > 0
                      ? row.missingRequirements
                          .map((item) =>
                            visibleMissingRequirementLabel(
                              item,
                              {
                                tariffRevenueReason: row.tariffRevenueReason,
                              },
                            ),
                          )
                          .join(', ')
                      : t('v2Overview.setupStatusNeedsAttention'),
                });
          const baselineWarningNote =
            row.baselineWarnings?.includes('tariffRevenueMismatch')
              ? visibleMissingRequirementLabel('tariffRevenue', {
                  tariffRevenueReason: row.tariffRevenueReason,
                })
              : null;

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

              {baselineWarningNote ? (
                <p className="v2-muted v2-year-status-note">
                  {baselineWarningNote}
                </p>
              ) : null}

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
                  isInlineCardDirty={isInlineCardDirty}
                  setInlineCardFieldRef={setInlineCardFieldRef}
                  manualFinancials={manualFinancials}
                  setManualFinancials={setManualFinancials}
                  manualPrices={manualPrices}
                  setManualPrices={setManualPrices}
                  manualVolumes={manualVolumes}
                  setManualVolumes={setManualVolumes}
                  markManualFieldTouched={markManualFieldTouched}
                  missingRequirementLabel={visibleMissingRequirementLabel}
                  saveInlineCardEdit={saveInlineCardEdit}
                  closeInlineCardEditor={closeInlineCardEditor}
                  workbookImportWorkflowProps={workbookImportWorkflowProps}
                />
              ) : null}
            </article>
          );
        })}
      </div>
    ) : null}

    <div className="v2-overview-review-actions">
      <div className="v2-manual-section-head">
        <h4>{reviewActionsTitle}</h4>
      </div>
      <p className="v2-muted">{baselineGatePrimaryDetail}</p>
      <p className="v2-muted">{baselineGateSecondaryDetail}</p>
      <button
        type="button"
        className={reviewContinueButtonClass}
        onClick={() => {
          if (nextReviewFocusYear != null) {
            handleFocusPinnedYear(nextReviewFocusYear);
          }
          onContinueFromReview();
        }}
        disabled={actionableReviewRowCount === 0}
      >
        {t('v2Overview.reviewContinue')}
      </button>
    </div>
    </section>
  );
};
