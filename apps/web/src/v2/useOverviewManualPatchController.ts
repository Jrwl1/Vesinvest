import type { TFunction } from 'i18next';
import React from 'react';

import {
  type V2ManualYearPatchPayload,
  type V2WorkbookPreviewResponse,
} from '../api';
import {
  applyDocumentImportMatchSelection,
  clearDocumentImportMatchSelections,
  getDocumentImportCandidateKeys,
  requiresDocumentImportConfidenceReview,
  type DocumentImportFieldMatch,
  type DocumentImportPreview,
} from './documentPdfImportModel';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  createDocumentImportState,
  createWorkbookImportState,
} from './overviewImportWorkflows';
import {
  WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY,
} from './overviewManualForms';
import type { MissingRequirement } from './overviewWorkflow';
import {
  useOverviewManualPatchEditor,
  type ManualPatchMode,
} from './useOverviewManualPatchEditor';

export type GenericDocumentImportPreview = DocumentImportPreview;

type WorkbookImportSelections = Record<
  number,
  Partial<
    Record<
      V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
      'keep_veeti' | 'apply_workbook'
    >
  >
>;

export type UseOverviewManualPatchControllerParams = {
  t: TFunction;
};

export function useOverviewManualPatchController({
  t,
}: UseOverviewManualPatchControllerParams) {
  const [workbookImportBusy, setWorkbookImportBusy] = React.useState(false);
  const [workbookImportStatus, setWorkbookImportStatus] = React.useState<
    string | null
  >(null);
  const [workbookImportError, setWorkbookImportError] = React.useState<
    string | null
  >(null);
  const [workbookImportPreview, setWorkbookImportPreview] =
    React.useState<V2WorkbookPreviewResponse | null>(null);
  const [workbookImportSelections, setWorkbookImportSelections] =
    React.useState<WorkbookImportSelections>({});

  const [documentImportBusy, setDocumentImportBusy] = React.useState(false);
  const [documentImportStatus, setDocumentImportStatus] = React.useState<
    string | null
  >(null);
  const [documentImportError, setDocumentImportError] = React.useState<
    string | null
  >(null);
  const [documentImportPreview, setDocumentImportPreview] =
    React.useState<GenericDocumentImportPreview | null>(null);
  const [documentImportReviewedKeys, setDocumentImportReviewedKeys] =
    React.useState<DocumentImportFieldMatch['key'][]>([]);

  const workbookFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = React.useRef<HTMLInputElement | null>(null);

  const resetWorkbookImportState = React.useCallback(() => {
    setWorkbookImportError(null);
    setWorkbookImportStatus(null);
    setWorkbookImportPreview(null);
    setWorkbookImportSelections({});
    if (workbookFileInputRef.current) {
      workbookFileInputRef.current.value = '';
    }
  }, []);

  const resetDocumentImportState = React.useCallback(() => {
    setDocumentImportError(null);
    setDocumentImportStatus(null);
    setDocumentImportPreview(null);
    setDocumentImportReviewedKeys([]);
    if (documentFileInputRef.current) {
      documentFileInputRef.current.value = '';
    }
  }, []);

  const editor = useOverviewManualPatchEditor({
    t,
    documentImportPreview,
    documentImportBusy,
    workbookImportBusy,
    resetDocumentImportState,
    resetWorkbookImportState,
  });

  const openManualPatchDialog = React.useCallback(
    async (
      year: number,
      missing: MissingRequirement[],
      mode: ManualPatchMode = 'review',
    ) => {
      editor.setCardEditContext(null);
      editor.setCardEditYear(null);
      editor.setCardEditFocusField(null);
      editor.setManualPatchYear(year);
      editor.setManualPatchMode(mode);
      editor.setManualPatchMissing(missing);
      editor.setManualPatchError(null);
      editor.setManualReason('');
      editor.setManualFinancials({
        liikevaihto: 0,
        perusmaksuYhteensa: 0,
        aineetJaPalvelut: 0,
        henkilostokulut: 0,
        liiketoiminnanMuutKulut: 0,
        poistot: 0,
        arvonalentumiset: 0,
        rahoitustuototJaKulut: 0,
        tilikaudenYliJaama: 0,
        omistajatuloutus: 0,
        omistajanTukiKayttokustannuksiin: 0,
      });
      editor.setManualPrices({
        waterUnitPrice: 0,
        wastewaterUnitPrice: 0,
      });
      editor.setManualVolumes({
        soldWaterVolume: 0,
        soldWastewaterVolume: 0,
      });
      editor.setManualInvestments({
        investoinninMaara: 0,
        korvausInvestoinninMaara: 0,
      });
      editor.setManualEnergy({ prosessinKayttamaSahko: 0 });
      editor.setManualNetwork({ verkostonPituus: 0 });
      resetWorkbookImportState();
      resetDocumentImportState();
      await editor.loadYearIntoManualEditor(year);
    },
    [editor, resetDocumentImportState, resetWorkbookImportState],
  );

  const resetManualPatchDialogState = React.useCallback(() => {
    editor.setManualPatchYear(null);
    editor.setCardEditYear(null);
    editor.setCardEditFocusField(null);
    editor.setCardEditContext(null);
    editor.setManualPatchMode('review');
    editor.setManualPatchMissing([]);
    editor.setManualPatchError(null);
    editor.setManualReason('');
    resetWorkbookImportState();
    resetDocumentImportState();
  }, [editor, resetDocumentImportState, resetWorkbookImportState]);

  const closeManualPatchDialogState = React.useCallback(() => {
    if (
      editor.manualPatchBusy ||
      workbookImportBusy ||
      documentImportBusy
    ) {
      return;
    }
    resetManualPatchDialogState();
  }, [
    documentImportBusy,
    editor.manualPatchBusy,
    resetManualPatchDialogState,
    workbookImportBusy,
  ]);

  const handleWorkbookSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setWorkbookImportBusy(true);
      setWorkbookImportError(null);
      setWorkbookImportPreview(null);
      setWorkbookImportSelections({});
      setWorkbookImportStatus(
        t(
          'v2Overview.workbookImportStarting',
          'Preparing workbook comparison from the uploaded Excel file...',
        ),
      );

      try {
        const result = await createWorkbookImportState({
          file,
          manualReason: editor.manualReason,
          t,
          yearDataCache: editor.yearDataCache,
        });
        if (result.nextReason) {
          editor.setManualReason(result.nextReason);
        }
        setWorkbookImportPreview(result.preview);
        setWorkbookImportSelections(result.selections);
        if (Object.keys(result.loadedYears).length > 0) {
          editor.setYearDataCache((prev) => ({
            ...prev,
            ...result.loadedYears,
          }));
        }
        setWorkbookImportStatus(result.status);
      } catch (err) {
        setWorkbookImportError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportFailed',
                'Workbook import preview failed.',
              ),
        );
        setWorkbookImportStatus(null);
      } finally {
        setWorkbookImportBusy(false);
      }
    },
    [editor, t],
  );

  const handleDocumentPdfSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || editor.manualPatchYear == null) {
        return;
      }

      setDocumentImportBusy(true);
      setDocumentImportError(null);
      setDocumentImportPreview(null);
      setDocumentImportStatus(
        t(
          'v2Overview.documentImportStarting',
          'Preparing source-document import from the uploaded PDF...',
        ),
      );

      try {
        const result = await createDocumentImportState({
          file,
          manualReason: editor.manualReason,
          t,
        });
        const requiresReview = requiresDocumentImportConfidenceReview(
          result.preview,
        );
        const nextPreview = requiresReview
          ? clearDocumentImportMatchSelections(result.preview)
          : result.preview;
        setDocumentImportPreview(nextPreview);
        setDocumentImportReviewedKeys(
          requiresReview ? [] : getDocumentImportCandidateKeys(nextPreview),
        );
        setDocumentImportStatus(result.status);
        sendV2OpsEvent({
          event: 'document_pdf_import',
          status: 'ok',
          attrs: {
            year: editor.manualPatchYear,
            fileName: nextPreview.fileName,
            detectedPage: nextPreview.pageNumber,
            matchedFieldCount: getDocumentImportCandidateKeys(nextPreview).length,
            datasetKinds: nextPreview.datasetKinds.join(','),
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t('v2Overview.documentImportFailed', 'Document PDF import failed.');
        setDocumentImportError(message);
        setDocumentImportStatus(null);
        sendV2OpsEvent({
          event: 'document_pdf_import',
          status: 'error',
          attrs: {
            year: editor.manualPatchYear,
            fileName: file.name,
          },
        });
      } finally {
        setDocumentImportBusy(false);
      }
    },
    [editor, t],
  );

  const handleSelectDocumentImportMatch = React.useCallback(
    (
      key: DocumentImportFieldMatch['key'],
      selectedMatch: DocumentImportFieldMatch | null,
    ) => {
      setDocumentImportReviewedKeys((prev) =>
        prev.includes(key) ? prev : [...prev, key],
      );
      setDocumentImportPreview((prev) =>
        prev == null
          ? prev
          : applyDocumentImportMatchSelection({
              preview: prev,
              key,
              selectedMatch,
            }),
      );
    },
    [],
  );

  const buildWorkbookImportPayloads = React.useCallback(() => {
    if (!workbookImportPreview) {
      editor.setManualPatchError(
        t(
          'v2Overview.workbookImportNoPreview',
          'Upload the KVA workbook and review the comparison before saving workbook choices.',
        ),
      );
      return null;
    }

    const payloads: Array<{ year: number; payload: V2ManualYearPatchPayload }> = [];
    for (const year of workbookImportPreview.years) {
      const candidateRows = year.rows
        .filter((row) => row.workbookValue != null)
        .map((row) => ({
          sourceField: row.sourceField,
          workbookValue: row.workbookValue,
          action:
            workbookImportSelections[year.year]?.[row.sourceField] ??
            row.suggestedAction,
        }));
      const confirmedRows = candidateRows.filter(
        (row) => row.action === 'apply_workbook' && row.workbookValue != null,
      );
      if (confirmedRows.length === 0) {
        continue;
      }

      const financials: NonNullable<V2ManualYearPatchPayload['financials']> = {};
      for (const row of confirmedRows) {
        financials[WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY[row.sourceField]] =
          row.workbookValue ?? undefined;
      }

      payloads.push({
        year: year.year,
        payload: {
          year: year.year,
          reason:
            editor.manualReason.trim() ||
            t(
              'v2Overview.workbookImportReasonDefault',
              'Imported from KVA workbook: {{fileName}}',
              { fileName: workbookImportPreview.document.fileName },
            ),
          financials,
          workbookImport: {
            kind: 'kva_import',
            fileName: workbookImportPreview.document.fileName,
            sheetName: workbookImportPreview.sheetName,
            matchedYears: workbookImportPreview.matchedYears,
            matchedFields: candidateRows.map((row) => row.sourceField),
            confirmedSourceFields: confirmedRows.map((row) => row.sourceField),
            candidateRows,
            warnings: [],
          },
        },
      });
    }

    if (payloads.length === 0) {
      editor.setManualPatchError(
        t(
          'v2Overview.workbookImportNoSelection',
          'Choose at least one workbook value to apply before saving workbook choices.',
        ),
      );
      return null;
    }

    return {
      payloads,
      matchedYears: workbookImportPreview.matchedYears,
      yearsToSync: payloads.map((item) => item.year),
    };
  }, [editor, t, workbookImportPreview, workbookImportSelections]);

  return {
    ...editor,
    workbookImportBusy,
    setWorkbookImportBusy,
    workbookImportStatus,
    setWorkbookImportStatus,
    workbookImportError,
    setWorkbookImportError,
    workbookImportPreview,
    setWorkbookImportPreview,
    workbookImportSelections,
    setWorkbookImportSelections,
    documentImportBusy,
    setDocumentImportBusy,
    documentImportStatus,
    setDocumentImportStatus,
    documentImportError,
    setDocumentImportError,
    documentImportPreview,
    setDocumentImportPreview,
    documentImportReviewedKeys,
    setDocumentImportReviewedKeys,
    workbookFileInputRef,
    documentFileInputRef,
    resetDocumentImportState,
    resetWorkbookImportState,
    openManualPatchDialog,
    resetManualPatchDialogState,
    closeManualPatchDialogState,
    handleWorkbookSelected,
    handleDocumentPdfSelected,
    handleSelectDocumentImportMatch,
    buildWorkbookImportPayloads,
  };
}

export type OverviewManualPatchController = ReturnType<
  typeof useOverviewManualPatchController
>;
